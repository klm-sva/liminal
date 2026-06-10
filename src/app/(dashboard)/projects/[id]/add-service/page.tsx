import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AddServiceClient from "./_add-service-client";
import type { ProgramType } from "@/types/database";

const ALL_PROGRAMS: ProgramType[] = ["leed_bdc_v41", "well_v2", "well_hsr"];

export default async function AddServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, customer_id")
    .eq("id", id)
    .single();

  if (!project) notFound();
  if (user && project.customer_id !== user.id) notFound();

  const { data: creditsData } = await supabase
    .from("credits")
    .select("id, credit_code, credit_name, category, program, points_available, price")
    .eq("is_active", true)
    .order("credit_code");

  const credits = creditsData ?? [];

  const creditsByProgram = ALL_PROGRAMS.reduce<Record<ProgramType, typeof credits>>((acc, prog) => {
    acc[prog] = credits.filter((c) => c.program === prog);
    return acc;
  }, {} as Record<ProgramType, typeof credits>);

  return (
    <AddServiceClient
      project={{ id: project.id, name: project.name }}
      creditsByProgram={creditsByProgram as Record<ProgramType, Parameters<typeof AddServiceClient>[0]["creditsByProgram"][ProgramType]>}
      allPrograms={ALL_PROGRAMS}
    />
  );
}
