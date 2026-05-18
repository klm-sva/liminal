/**
 * POST /api/webhooks/specs-analysis
 *
 * Webhook receiver that triggers specs pre-extraction when a spec document
 * is uploaded. Called from the upload handler onUploadComplete.
 *
 * Expects JSON body:
 *   { projectId: string, customerId: string, files: { filename, storagePath, mimeType }[] }
 *
 * Secured with WEBHOOK_SECRET header check.
 */

import { NextResponse }        from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { z }                   from "zod";

const bodySchema = z.object({
  projectId:  z.string().uuid(),
  customerId: z.string().uuid(),
  files: z.array(z.object({
    filename:    z.string().min(1),
    storagePath: z.string().min(1),
    mimeType:    z.string(),
  })).min(1),
});

export async function POST(request: Request) {
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
      { status: 400 },
    );
  }

  const serviceClient = await createServiceClient();

  const { data: project, error: projectError } = await serviceClient
    .from("projects")
    .select("id, customer_id, specs_extracted")
    .eq("id", body.projectId)
    .eq("customer_id", body.customerId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.specs_extracted) {
    return NextResponse.json({ message: "Specs already extracted" });
  }

  try {
    // Download files from Storage
    const files: Array<{ filename: string; buffer: Buffer; mimeType: string }> = [];
    for (const f of body.files) {
      const { data, error } = await serviceClient.storage
        .from("customer-uploads")
        .download(f.storagePath);
      if (error || !data) {
        console.warn(`[specs-analysis webhook] Could not download ${f.filename}: ${error?.message}`);
        continue;
      }
      files.push({
        filename: f.filename,
        buffer:   Buffer.from(await data.arrayBuffer()),
        mimeType: f.mimeType,
      });
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "No files could be downloaded" }, { status: 400 });
    }

    const { extractSpecs } = await import("../../../../../pipeline/lib/specs-extract");
    const result = await extractSpecs(body.projectId, body.customerId, files);

    return NextResponse.json({
      projectId:    body.projectId,
      productCount: result.product_count,
      sourceFiles:  result.source_files,
    });
  } catch (err) {
    const message = (err as Error).message;
    console.error(`[specs-analysis webhook] Failed for project ${body.projectId}: ${message}`);
    return NextResponse.json(
      { error: "Specs extraction failed", details: message },
      { status: 500 },
    );
  }
}
