import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UTApi } from "uploadthing/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const f      = createUploadthing();
const utapi  = new UTApi();

async function deleteFromUploadThing(fileKey: string) {
  try {
    await utapi.deleteFiles(fileKey);
  } catch (err) {
    console.error(`[uploadthing] failed to delete file ${fileKey}:`, (err as Error).message);
  }
}

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

          const { data: order } = await serviceClient
            .from("orders")
            .select("project_id, credit_id, runs_used, gap_analysis_program")
            .eq("id", orderId)
            .single();

          let storagePath: string | null = null;

          if (order?.project_id && order?.credit_id) {
            const { data: credit } = await serviceClient
              .from("credits")
              .select("credit_code")
              .eq("id", order.credit_id)
              .single();

            if (credit?.credit_code) {
              const attemptNumber = order.runs_used + 1;
              storagePath = `${userId}/${order.project_id}/orders/${orderId}-${credit.credit_code}/attempt-${attemptNumber}/${file.name}`;
            }
          } else if (order?.gap_analysis_program) {
            const attemptNumber = order.runs_used + 1;
            storagePath = `${userId}/gap-analysis/${order.gap_analysis_program}/${orderId}/attempt-${attemptNumber}/${file.name}`;
          }

          if (storagePath) {
            const response    = await fetch(file.url);
            const arrayBuffer = await response.arrayBuffer();

            await serviceClient.storage
              .from("customer-uploads")
              .upload(storagePath, Buffer.from(arrayBuffer), {
                contentType: file.type,
                upsert:      true,
              });
          }
        } catch (err) {
          console.error(`[uploadthing] creditDocument post-upload failed: ${(err as Error).message}`);
        }
      }

      await deleteFromUploadThing(file.key);
      return { uploadedBy: userId };
    }),

  projectLogo: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async () => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // projectLogo is served directly from UploadThing URL — do not delete
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

      // Copy to Supabase Storage before firing the analysis webhook
      try {
        const serviceClient = await createServiceClient();
        const response      = await fetch(file.url);
        const arrayBuffer   = await response.arrayBuffer();

        await serviceClient.storage
          .from("customer-uploads")
          .upload(drawingPath, Buffer.from(arrayBuffer), {
            contentType: file.type,
            upsert:      true,
          });
      } catch (err) {
        console.error(`[uploadthing] drawingSet Supabase copy failed: ${(err as Error).message}`);
      }

      // Delete from UploadThing — Supabase is now the source of truth
      await deleteFromUploadThing(file.key);

      const appUrl        = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const webhookSecret = process.env.WEBHOOK_SECRET ?? "";

      fetch(`${appUrl}/api/webhooks/drawing-analysis`, {
        method:  "POST",
        headers: {
          "Content-Type":     "application/json",
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
