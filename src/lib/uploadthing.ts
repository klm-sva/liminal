import { createUploadthing, type FileRouter } from "uploadthing/next";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendUploadConfirmationEmail } from "@/lib/resend";

const f = createUploadthing();

export const ourFileRouter = {
  creditDocument: f({
    pdf:          { maxFileSize: "32MB", maxFileCount: 10 },
    "image/png":  { maxFileSize: "16MB", maxFileCount: 5 },
    "image/jpeg": { maxFileSize: "16MB", maxFileCount: 5 },
  })
    .middleware(async ({ req }) => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      const url     = new URL(req.url);
      const orderId = url.searchParams.get("orderId") ?? req.headers.get("x-order-id") ?? null;

      return { userId: user.id, orderId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const { userId, orderId } = metadata;

      if (orderId) {
        try {
          const serviceClient = await createServiceClient();

          // Persist file URL to the most recent run for this order (re-submissions)
          const { data: latestRun } = await serviceClient
            .from("runs")
            .select("id, customer_upload_paths")
            .eq("order_id", orderId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (latestRun) {
            const existingPaths = (latestRun.customer_upload_paths ?? []) as string[];
            await serviceClient
              .from("runs")
              .update({ customer_upload_paths: [...existingPaths, file.url] })
              .eq("id", latestRun.id);
          }

          // Send upload confirmation email
          const [orderRes, customerRes] = await Promise.all([
            serviceClient.from("orders").select("credit_id, customer_id").eq("id", orderId).single(),
            serviceClient.from("customers").select("email, name").eq("id", userId).single(),
          ]);

          if (orderRes.data && customerRes.data) {
            const creditRes = await serviceClient
              .from("credits")
              .select("credit_name")
              .eq("id", orderRes.data.credit_id)
              .single();

            if (creditRes.data) {
              await sendUploadConfirmationEmail({
                to:         customerRes.data.email,
                name:       customerRes.data.name ?? "there",
                creditName: creditRes.data.credit_name,
                orderId,
                fileCount:  1,
              });
            }
          }
        } catch (err) {
          console.error(`[uploadthing] creditDocument post-upload failed: ${(err as Error).message}`);
        }
      }

      return { uploadedBy: userId, url: file.url };
    }),

  projectLogo: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async () => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.url };
    }),

  drawingSet: f({ pdf: { maxFileSize: "64MB", maxFileCount: 20 } })
    .middleware(async ({ req }) => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      const url       = new URL(req.url);
      const projectId = url.searchParams.get("projectId")
        ?? req.headers.get("x-project-id");

      if (!projectId) throw new Error("projectId required for drawing uploads");

      return { userId: user.id, projectId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const { userId, projectId } = metadata;

      const drawingPath = `${userId}/${projectId}/drawings/${file.name}`;

      const appUrl        = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const webhookSecret = process.env.WEBHOOK_SECRET ?? "";

      fetch(`${appUrl}/api/webhooks/drawing-analysis`, {
        method:  "POST",
        headers: {
          "Content-Type":    "application/json",
          "x-webhook-secret": webhookSecret,
        },
        body: JSON.stringify({
          projectId,
          customerId:   userId,
          drawingPaths: [drawingPath],
        }),
      }).catch((err) => {
        console.error(`[uploadthing] Drawing analysis webhook failed: ${err.message}`);
      });

      return { uploadedBy: userId, drawingPath };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
