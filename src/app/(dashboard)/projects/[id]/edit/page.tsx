import { notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import EditProjectClient from "./_edit-client";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  const supabase = await createServiceClient();

  const { data: project } = await (supabase as any)
    .from("projects")
    .select("id, name, address, gross_sqft, stories, building_type, occupancy, description, project_narrative, flagged_fields, customer_id")
    .eq("id", id)
    .single();

  if (!project) notFound();
  if (user && project.customer_id !== user.id) notFound();

  return <EditProjectClient project={project as Parameters<typeof EditProjectClient>[0]["project"]} />;
}
