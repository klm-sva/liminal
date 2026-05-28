import { NextResponse }        from "next/server";
import { createClient }        from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const authClient = await createClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.program || !body?.responses) {
    return NextResponse.json({ error: "program and responses required" }, { status: 400 });
  }

  const { program, responses } = body as { program: string; responses: Record<string, unknown> };

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("gap_analysis_responses")
    .insert({ customer_id: user.id, program, responses })
    .select("id")
    .single();

  if (error) {
    console.error("[gap-analysis/responses] insert failed:", error.message);
    return NextResponse.json({ error: "Failed to save responses" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
