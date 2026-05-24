import { notFound, redirect } from "next/navigation";
import { createServiceClient }  from "@/lib/supabase/server";
import ReviewForm               from "./_review-form";

export const dynamic = "force-dynamic";

export default async function AdminReviewPage({
  params,
  searchParams,
}: {
  params:       Promise<{ orderId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { orderId } = await params;
  const { token }   = await searchParams;

  const supabase = await createServiceClient();

  // Auth check — only reviews@liminalsva.com
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== "reviews@liminalsva.com") {
    redirect("/login");
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status, qa_status, qa_approved_at, qa_changes_requested_at, qa_instructions, delivery_scheduled_at, delivered_at, delay_email_sent, customer_id, credit_id, project_id, created_at")
    .eq("id", orderId)
    .single();

  if (error || !order) notFound();

  const [customerRes, creditRes, projectRes, runRes] = await Promise.all([
    supabase.from("customers").select("name, email").eq("id", order.customer_id).single(),
    supabase.from("credits").select("credit_name, credit_code").eq("id", order.credit_id!).single(),
    supabase.from("projects").select("name").eq("id", order.project_id!).single(),
    supabase
      .from("runs")
      .select("id, output_html_path, completed_at, run_number")
      .eq("order_id", orderId)
      .eq("status", "completed")
      .order("run_number", { ascending: false })
      .limit(1)
      .single(),
  ]);

  const customer   = customerRes.data;
  const credit     = creditRes.data;
  const project    = projectRes.data;
  const latestRun  = runRes.data;

  // Generate signed output URLs (7-day expiry)
  const UPLOADS_BUCKET = "order-outputs";
  const htmlPath       = latestRun?.output_html_path ?? "";
  const editablePath   = htmlPath.replace("submission.html", "submission-editable.html");

  const [standardUrlRes, editableUrlRes] = await Promise.all([
    htmlPath    ? supabase.storage.from(UPLOADS_BUCKET).createSignedUrl(htmlPath,     7 * 24 * 3600) : { data: null },
    editablePath ? supabase.storage.from(UPLOADS_BUCKET).createSignedUrl(editablePath, 7 * 24 * 3600) : { data: null },
  ]);

  const standardHtmlUrl = standardUrlRes.data?.signedUrl ?? null;
  const editableHtmlUrl = editableUrlRes.data?.signedUrl ?? null;

  // Time remaining until auto-delivery
  const deliveryAt      = order.delivery_scheduled_at ? new Date(order.delivery_scheduled_at) : null;
  const now             = new Date();
  const msLeft          = deliveryAt ? deliveryAt.getTime() - now.getTime() : null;
  const hLeft           = msLeft != null ? Math.max(0, Math.floor(msLeft / 3600000)) : null;
  const mLeft           = msLeft != null ? Math.max(0, Math.floor((msLeft % 3600000) / 60000)) : null;
  const timeLabel       = msLeft != null && msLeft > 0 ? `${hLeft}h ${mLeft}m remaining` : "Past delivery window";

  const qaToken = token ?? "";

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 720, margin: "40px auto", padding: "0 24px" }}>
      <h1 style={{ marginBottom: 4 }}>QA Review</h1>
      <p style={{ color: "#888", marginTop: 0, marginBottom: 24 }}>
        Order <code style={{ background: "#f0f0f0", padding: "2px 6px", borderRadius: 3 }}>{orderId.slice(0, 8).toUpperCase()}</code>
      </p>

      {/* Order details */}
      <section style={{ background: "#f9f9f9", border: "1px solid #e0e0e0", borderRadius: 6, padding: "16px 20px", marginBottom: 24 }}>
        <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>Order Details</h2>
        <table style={{ borderCollapse: "collapse", fontSize: 14, width: "100%" }}>
          <tbody>
            <tr><td style={{ color: "#888", paddingRight: 16, paddingBottom: 6, width: 160 }}>Customer</td><td>{customer?.name ?? "—"} &lt;{customer?.email ?? "—"}&gt;</td></tr>
            <tr><td style={{ color: "#888", paddingRight: 16, paddingBottom: 6 }}>Credit</td><td>{credit?.credit_name ?? "—"} ({credit?.credit_code ?? "—"})</td></tr>
            <tr><td style={{ color: "#888", paddingRight: 16, paddingBottom: 6 }}>Project</td><td>{project?.name ?? "—"}</td></tr>
            <tr><td style={{ color: "#888", paddingRight: 16, paddingBottom: 6 }}>Order placed</td><td>{new Date(order.created_at).toLocaleString("en-US", { timeZone: "America/New_York" })} ET</td></tr>
            <tr><td style={{ color: "#888", paddingRight: 16, paddingBottom: 6 }}>QA status</td>
              <td style={{ fontWeight: 600, color: order.qa_status === "approved" ? "#27ae60" : order.qa_status === "changes_requested" ? "#e67e22" : "#333" }}>
                {order.qa_status}
              </td>
            </tr>
            <tr><td style={{ color: "#888", paddingRight: 16, paddingBottom: 6 }}>Auto-delivers</td>
              <td>
                {deliveryAt ? deliveryAt.toLocaleString("en-US", { timeZone: "America/New_York" }) + " ET" : "—"}
                {msLeft != null && (
                  <span style={{ color: msLeft > 0 ? "#c0392b" : "#27ae60", fontWeight: 600, marginLeft: 8 }}>
                    ({timeLabel})
                  </span>
                )}
              </td>
            </tr>
            {order.delivered_at && (
              <tr><td style={{ color: "#888", paddingRight: 16 }}>Delivered</td><td>{new Date(order.delivered_at).toLocaleString("en-US", { timeZone: "America/New_York" })} ET</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Output files */}
      <section style={{ background: "#f9f9f9", border: "1px solid #e0e0e0", borderRadius: 6, padding: "16px 20px", marginBottom: 24 }}>
        <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>Output Files</h2>
        {standardHtmlUrl ? (
          <p style={{ margin: "0 0 8px" }}>
            <a href={standardHtmlUrl} target="_blank" rel="noreferrer" style={{ color: "#388fa6" }}>
              Standard HTML Output
            </a>{" "}
            — submission.html
          </p>
        ) : (
          <p style={{ color: "#aaa", margin: "0 0 8px" }}>Standard HTML: not available</p>
        )}
        {editableHtmlUrl ? (
          <p style={{ margin: 0 }}>
            <a href={editableHtmlUrl} target="_blank" rel="noreferrer" style={{ color: "#388fa6" }}>
              Editable HTML Output
            </a>{" "}
            — submission-editable.html
          </p>
        ) : (
          <p style={{ color: "#aaa", margin: 0 }}>Editable HTML: not available</p>
        )}
      </section>

      {/* Previous change requests */}
      {order.qa_instructions && (
        <section style={{ background: "#fff8e1", border: "1px solid #f5a623", borderRadius: 6, padding: "16px 20px", marginBottom: 24 }}>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 16 }}>Previous Change Request</h2>
          {order.qa_changes_requested_at && (
            <p style={{ color: "#888", fontSize: 12, marginTop: 0, marginBottom: 8 }}>
              Requested: {new Date(order.qa_changes_requested_at).toLocaleString("en-US", { timeZone: "America/New_York" })} ET
            </p>
          )}
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 13, fontFamily: "monospace", background: "transparent" }}>
            {order.qa_instructions}
          </pre>
        </section>
      )}

      {/* Action form */}
      <ReviewForm orderId={orderId} token={qaToken} />
    </div>
  );
}
