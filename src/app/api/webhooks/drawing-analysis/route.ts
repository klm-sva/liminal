/**
 * POST /api/webhooks/drawing-analysis
 *
 * Webhook receiver that triggers drawing analysis after a drawing set upload
 * completes via UploadThing. Called from uploadthing.ts onUploadComplete.
 *
 * Expects JSON body:
 *   { projectId: string, customerId: string, drawingPaths: string[] }
 *
 * Secured with WEBHOOK_SECRET header check.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { z } from "zod";

const bodySchema = z.object({
  projectId:    z.string().uuid(),
  customerId:   z.string().uuid(),
  drawingPaths: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request) {
  // Verify internal webhook secret
  const secret = request.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", details: (err as Error).message },
      { status: 400 }
    );
  }

  const serviceClient = await createServiceClient();

  // Verify project exists and belongs to customer
  const { data: project, error: projectError } = await serviceClient
    .from("projects")
    .select("id, customer_id, auto_extracted")
    .eq("id", body.projectId)
    .eq("customer_id", body.customerId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.auto_extracted) {
    return NextResponse.json({ message: "Drawing analysis already complete" });
  }

  // Run analysis — in production this should be dispatched to a background worker.
  // Inline here for simplicity; the webhook response will be delayed while running.
  try {
    const { analyzeDrawings } = await import("../../../../../pipeline/drawing-analysis");
    const result = await analyzeDrawings(body.projectId, body.customerId, body.drawingPaths);
    return NextResponse.json({
      projectId:   result.projectId,
      profilePath: result.profilePath,
      flaggedFields: result.flaggedFields,
    });
  } catch (err) {
    const message = (err as Error).message;
    console.error(`[drawing-analysis webhook] Failed for project ${body.projectId}: ${message}`);
    return NextResponse.json(
      { error: "Drawing analysis failed", details: message },
      { status: 500 }
    );
  }
}
