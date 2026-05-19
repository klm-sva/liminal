import { createClient, createServiceClient } from "@/lib/supabase/server";
import FeedbackClient from "./_feedback-client";

export default async function FeedbackPage() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  const supabase = await createServiceClient();

  const { data: orderData } = user
    ? await supabase
        .from("orders")
        .select("id, credits(credit_code, credit_name, category)")
        .eq("customer_id", user.id)
        .in("status", ["delivered", "complete"])
        .order("created_at", { ascending: false })
    : { data: [] };

  type OrderWithCredit = { id: string; credits?: { credit_code: string; credit_name: string; category: string } | null };
  const orders = ((orderData ?? []) as unknown as OrderWithCredit[]).map((o) => {
    const c = o.credits;
    return {
      id:          o.id,
      credit_code: c?.credit_code ?? "",
      credit_name: c?.credit_name ?? "",
      category:    c?.category ?? "",
    };
  });

  return <FeedbackClient orders={orders} />;
}
