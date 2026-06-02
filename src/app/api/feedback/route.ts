import { NextResponse }    from "next/server";
import { createClient }    from "@/lib/supabase/server";
import { sendFeedbackEmail } from "@/lib/resend";

export async function POST(req: Request) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { orderId, creditCode, creditName, useful, wouldUseAgain, whatWorked, whatToImprove } = body;

  if (!orderId || !useful || !wouldUseAgain) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("email, name")
    .eq("id", user.id)
    .single();

  await sendFeedbackEmail({
    customerEmail:  customer?.email ?? user.email ?? "",
    customerName:   customer?.name  ?? "Unknown",
    orderId,
    creditCode:     creditCode  ?? "",
    creditName:     creditName  ?? "",
    useful,
    wouldUseAgain,
    whatWorked:     whatWorked     ?? "",
    whatToImprove:  whatToImprove  ?? "",
  });

  return NextResponse.json({ ok: true });
}
