import { createUploadthing, type FileRouter } from "uploadthing/next";
import { createClient } from "@/lib/supabase/server";

const f = createUploadthing();

export const ourFileRouter = {
  creditDocument: f({
    pdf:         { maxFileSize: "32MB", maxFileCount: 10 },
    "image/png": { maxFileSize: "16MB", maxFileCount: 5 },
    "image/jpeg": { maxFileSize: "16MB", maxFileCount: 5 },
  })
    .middleware(async () => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.url };
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

      // Caller must pass project_id as a query param or header
      const url       = new URL(req.url);
      const projectId = url.searchParams.get("projectId")
        ?? req.headers.get("x-project-id");

      if (!projectId) throw new Error("projectId required for drawing uploads");

      return { userId: user.id, projectId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const { userId, projectId } = metadata;

      // Store drawing in customer-uploads/{userId}/{projectId}/drawings/
      const drawingPath = `${userId}/${projectId}/drawings/${file.name}`;

      // Trigger drawing analysis webhook asynchronously
      const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? "";
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
