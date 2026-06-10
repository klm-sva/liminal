import { createClient } from "@/lib/supabase/server";
import GapAnalysisQuestionnaireClient from "./_questionnaire-client";

export default async function GapAnalysisQuestionnairePage({
  searchParams,
}: {
  searchParams: Promise<{ project_id?: string }>;
}) {
  const { project_id } = await searchParams;

  let project = null;
  if (project_id) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("projects")
        .select("id, name, address, building_type, gross_sqft, stories, total_parking, certification_target, flagged_fields, customer_id")
        .eq("id", project_id)
        .eq("customer_id", user.id)
        .single();
      project = data ?? null;
    }
  }

  return <GapAnalysisQuestionnaireClient project={project} />;
}
