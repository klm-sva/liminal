import type { Metadata }                    from "next";
import { notFound }                          from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import GapAnalysisOutputClient               from "./_output-client";
import type { Json }                         from "@/types/database";

export const metadata: Metadata = { title: "Gap Analysis Report" };

type GapCategory = {
  name:        string;
  score:       number;
  max:         number;
  recommended: string[];
};

export type GapAnalysisData = {
  program:             string;
  overall_score:       number;
  target_score:        number;
  certification_level?: string;
  max_possible?:       number;
  categories?:         GapCategory[];
  concepts?:           GapCategory[];
};

function parseResults(raw: Json | null): GapAnalysisData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as unknown as GapAnalysisData;
}

export default async function GapAnalysisOutputPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) notFound();

  const supabase = await createServiceClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id, gap_analysis_program, gap_analysis_results")
    .eq("id", orderId)
    .eq("customer_id", user.id)
    .single();

  if (!order) notFound();

  // Get the HTML output path from the most recent completed run
  let htmlContent: string | null = null;

  const { data: run } = await supabase
    .from("runs")
    .select("output_html_path")
    .eq("order_id", orderId)
    .eq("status", "completed")
    .not("output_html_path", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (run?.output_html_path) {
    const { data: signed } = await supabase.storage
      .from("order-outputs")
      .createSignedUrl(run.output_html_path, 3600);

    if (signed?.signedUrl) {
      try {
        const res = await fetch(signed.signedUrl);
        if (res.ok) htmlContent = await res.text();
      } catch {
        // Fall through
      }
    }
  }

  const programLabels: Record<string, string> = {
    leed_bd_c: "LEED BD+C v4.1",
    well_v2:   "WELL v2",
    well_hsr:  "WELL Health-Safety Rating",
  };

  const program      = order.gap_analysis_program ?? "leed_bd_c";
  const programLabel = programLabels[program] ?? program;
  const results      = parseResults(order.gap_analysis_results as Json | null);

  // Map gap analysis program key back to credits table program value
  const creditsProgramKey: Record<string, string> = {
    leed_bd_c: "leed_bdc_v41",
    well_v2:   "well_v2",
    well_hsr:  "well_hsr",
  };
  const creditsProgram = creditsProgramKey[program] ?? program;
  const { data: creditsData } = await supabase
    .from("credits")
    .select("id, credit_code")
    .eq("program", creditsProgram as import("@/types/database").ProgramType);
  const creditIdMap: Record<string, string> = {};
  for (const c of creditsData ?? []) {
    // Store the canonical code
    creditIdMap[c.credit_code] = c.id;
    // Store common AI-generated aliases so lookups survive Claude using the wrong prefix
    // LEED: Claude sometimes outputs "IEQc1" instead of "EQc1"
    if (c.credit_code.startsWith("EQ")) creditIdMap[`IEQ${c.credit_code.slice(2)}`] = c.id;
    // Store case-insensitive variants
    creditIdMap[c.credit_code.toLowerCase()] = c.id;
    creditIdMap[c.credit_code.toUpperCase()] = c.id;
  }

  return (
    <GapAnalysisOutputClient
      orderId={orderId}
      programLabel={programLabel}
      program={program}
      results={results}
      htmlContent={htmlContent}
      creditIdMap={creditIdMap}
    />
  );
}
