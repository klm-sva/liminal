import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Project } from "@/types/database";

type ProjectUpdate = Partial<Pick<Project,
  "name" | "address" | "building_type" | "gross_sqft" | "stories" |
  "total_parking" | "certification_target" | "regular_occupants" |
  "peak_visitors" | "description" | "primary_occupancy" | "occupancy"
>>;

const ALLOWED: Set<string> = new Set([
  "name", "address", "building_type", "gross_sqft", "stories",
  "total_parking", "certification_target", "regular_occupants",
  "peak_visitors", "description", "primary_occupancy", "occupancy",
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, customer_id")
    .eq("id", id)
    .single();

  if (!project || project.customer_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const updates: ProjectUpdate = {};
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED.has(key) && value !== undefined) {
      (updates as Record<string, unknown>)[key] = value;
    }
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true });

  const { error } = await supabase.from("projects").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
