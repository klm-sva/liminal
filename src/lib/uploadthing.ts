import { createUploadthing, type FileRouter } from "uploadthing/next";
import { createClient, createServiceClient } from "@/lib/supabase/server";

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

          // Fetch order to build the correct storage path
          const { data: order } = await serviceClient
            .from("orders")
            .select("project_id, credit_id, runs_used")
            .eq("id", orderId)
            .single();

          if (order?.project_id && order?.credit_id) {
            const { data: credit } = await serviceClient
              .from("credits")
              .select("credit_code")
              .eq("id", order.credit_id)
              .single();

            if (credit?.credit_code) {
              const attemptNumber = order.runs_used + 1;
              const storagePath   = `${userId}/${order.project_id}/orders/${orderId}-${credit.credit_code}/attempt-${attemptNumber}/${file.name}`;

              const response    = await fetch(file.url);
              const arrayBuffer = await response.arrayBuffer();

              await serviceClient.storage
                .from("customer-uploads")
                .upload(storagePath, Buffer.from(arrayBuffer), {
                  contentType: file.type,
                  upsert:      true,
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
