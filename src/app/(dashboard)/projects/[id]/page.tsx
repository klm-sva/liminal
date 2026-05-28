import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Edit, MessageSquare, ArrowRight } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { OrderStatus, ProgramType, Json } from "@/types/database";
import ProjectClient from "./_project-client";

type GapAnalysisCategory = { name: string; score: number; max: number; recommended: string[] };
type GapAnalysisResults = {
  program:             string;
  overall_score:       number;
  target_score:        number;
  certification_level?: string;
  max_possible?:       number;
  categories?:         GapAnalysisCategory[];
  concepts?:           GapAnalysisCategory[];
};

export const metadata: Metadata = { title: "Project Dashboard" };

type OrderRow = {
  id: string;
  status: OrderStatus;
  created_at: string;
  credits: {
    credit_code: string;
    credit_name: string;
    program: ProgramType;
    has_calculator: boolean;
    has_leed_form: boolean;
  } | null;
};

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  const supabase = await createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, address, programs, certification_target, gross_sqft, customer_id")
    .eq("id", id)
    .single();

  if (!project) notFound();

  if (user && project.customer_id !== user.id) notFound();

  const { data: orderData } = await supabase
    .from("orders")
    .select("id, status, created_at, credits(credit_code, credit_name, program, has_calculator, has_leed_form)")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  const orders = (orderData ?? []) as unknown as OrderRow[];
  const delivered = orders.filter((o) => o.status === "delivered" || o.status === "complete").length;
  const programs = (project.programs ?? []) as ProgramType[];

  // Look up completed gap analysis for each program this project tracks
  const programToGapKey: Record<string, string> = {
    leed_bdc_v41: "leed_bd_c",
    well_v2:      "well_v2",
    well_hsr:     "well_hsr",
  };
  const gapPrograms = programs.map((p) => programToGapKey[p]).filter(Boolean);

  let completedGapAnalysis: { orderId: string; results: GapAnalysisResults; program: string } | null = null;

  if (gapPrograms.length > 0) {
    const { data: gapOrders } = await supabase
      .from("orders")
      .select("id, gap_analysis_program, gap_analysis_results")
      .eq("customer_id", project.customer_id)
      .eq("status", "complete")
      .not("gap_analysis_program", "is", null)
      .not("gap_analysis_results", "is", null)
      .in("gap_analysis_program", gapPrograms)
      .order("created_at", { ascending: false })
      .limit(1);

    const gap = gapOrders?.[0];
    if (gap?.gap_analysis_results && typeof gap.gap_analysis_results === "object") {
      completedGapAnalysis = {
        orderId: gap.id,
        program: gap.gap_analysis_program!,
        results: gap.gap_analysis_results as unknown as GapAnalysisResults,
      };
    }
  }

  return (
    <>
      <DashboardHeader
        title={project.name}
        subtitle={project.address ?? undefined}
        backHref="/dashboard"
        backLabel="Dashboard"
        metrics={[
          { label: "Credits Ordered", value: orders.length             },
          { label: "Delivered",       value: delivered                 },
          { label: "In Progress",     value: orders.length - delivered },
          { label: "Sq Ft",           value: project.gross_sqft?.toLocaleString() ?? "—" },
        ]}
        actions={
          <>
            <Link
              href={`/projects/${project.id}/edit`}
              className="flex items-center gap-1.5 text-sm font-medium bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3.5 py-2 rounded-xl transition-colors"
            >
              <Edit size={14} /> Edit
            </Link>
            <Link
              href={`/projects/${project.id}/add-service`}
              className="flex items-center gap-1.5 text-sm font-semibold bg-certify-blue hover:bg-certify-blue/90 text-white px-4 py-2 rounded-xl transition-colors shadow-md"
            >
              <Plus size={14} /> Add a Credit or Feature
            </Link>
          </>
        }
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">

        {/* Gap analysis card */}
        {completedGapAnalysis ? (
          /* ── Completed gap analysis — visual score card ── */
          (() => {
            const { orderId: gaOrderId, results, program: gaProgram } = completedGapAnalysis;
            const sections = results.categories ?? results.concepts ?? [];
            const gapToTarget = results.target_score - results.overall_score;
            const maxPossible = results.max_possible ?? 110;
            const programLabels: Record<string, string> = {
              leed_bd_c: "LEED BD+C v4.1",
              well_v2:   "WELL v2",
              well_hsr:  "WELL Health-Safety Rating",
            };
            return (
              <div
                className="relative overflow-hidden rounded-2xl p-6"
                style={{ background: "linear-gradient(135deg, #388fa6 0%, #1c5e70 100%)" }}
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-0 opacity-[0.04]"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                  }}
                />
                <div className="relative">
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1">Gap Analysis</p>
                      <p className="text-xs text-white/60">{programLabels[gaProgram] ?? gaProgram}</p>
                    </div>
                    <Link
                      href={`/orders/${gaOrderId}/gap-analysis-output`}
                      className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/30 font-semibold px-3.5 py-1.5 rounded-xl transition-colors text-xs"
                    >
                      View report <ArrowRight size={11} />
                    </Link>
                  </div>

                  {/* Score row */}
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <p className="font-serif text-5xl text-white leading-none">{results.overall_score}</p>
                      <p className="text-white/45 text-xs mt-1">/ {maxPossible} pts estimated</p>
                    </div>
                    <div className="text-right">
                      <div className="bg-certify-sand/20 border border-certify-sand/30 rounded-xl px-4 py-2">
                        <p className="text-certify-sand font-bold">{results.target_score} pts</p>
                        <p className="text-certify-sand/60 text-xs">
                          {results.certification_level ? `${results.certification_level} target` : "target"}
                        </p>
                      </div>
                      <p className="text-certify-sage text-xs font-semibold mt-1.5">
                        {gapToTarget > 0
                          ? `${gapToTarget} pts to ${results.certification_level ?? "target"}`
                          : "Target met"}
                      </p>
                    </div>
                  </div>

                  {/* Category bars (compact) */}
                  {sections.length > 0 && (
                    <div className="space-y-2.5">
                      {sections.map((sec) => {
                        const pct   = Math.round((sec.score / sec.max) * 100);
                        const isRec = sec.recommended.length > 0;
                        return (
                          <div key={sec.name}>
                            <div className="flex justify-between text-[11px] mb-0.5">
                              <span className={`font-medium ${isRec ? "text-certify-sage" : "text-white/65"}`}>
                                {sec.name}
                                {isRec && <span className="ml-1.5 opacity-70"> ↑</span>}
                              </span>
                              <span className="text-white/35">{sec.score}/{sec.max}</span>
                            </div>
                            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-1.5 rounded-full"
                                style={{ width: `${pct}%`, backgroundColor: isRec ? "#5fa8bb" : "#388fa6" }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()
        ) : (
          /* ── Promotional card — no gap analysis yet ── */
          <div
            className="relative overflow-hidden rounded-2xl px-5 py-5 flex flex-col sm:flex-row sm:items-center gap-4"
            style={{ background: "linear-gradient(135deg, #388fa6 0%, #1c5e70 100%)" }}
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
            <div className="relative flex-1">
              <p className="font-semibold text-white text-sm mb-1">Gap Analysis</p>
              <p className="text-white/65 text-xs leading-relaxed">
                Understand where your project stands before you begin. A gap analysis reviews your project against certification requirements, identifies your strongest credits and features, and gives you a recommended pursuit strategy. It is the recommended first step for any certification project.
              </p>
            </div>
            <div className="relative shrink-0">
              <Link
                href={`/projects/${project.id}/add-service`}
                className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white border border-white/30 font-semibold px-4 py-2 rounded-xl transition-colors text-sm group"
              >
                Learn more <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        )}

        {/* Interactive program pills + orders list */}
        <ProjectClient
          projectId={project.id}
          initialPrograms={programs}
          certificationTarget={project.certification_target ?? null}
          orders={orders}
        />

        {/* Pilot feedback link */}
        <div className="flex justify-end">
          <Link
            href="/feedback"
            className="inline-flex items-center gap-2 text-sm text-certify-cool-grey hover:text-certify-blue transition-colors"
          >
            <MessageSquare size={14} />
            Share pilot feedback
          </Link>
        </div>
      </div>
    </>
  );
}
