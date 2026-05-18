/**
 * POST /api/webhooks/document-analysis
 *
 * Triggered when any project document is uploaded that isn't a drawing or spec.
 * Auto-detects the document type, extracts a compact profile, stores it in
 * Supabase Storage under {customerId}/{projectId}/doc-profiles/{type}.json.
 *
 * Called from the upload handler onUploadComplete alongside the specs-analysis
 * and drawing-analysis webhooks.
 *
 * Expects JSON body:
 *   { projectId, customerId, file: { filename, storagePath, mimeType } }
 */

import { NextResponse }        from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { z }                   from "zod";

const bodySchema = z.object({
  projectId:  z.string().uuid(),
  customerId: z.string().uuid(),
  file: z.object({
    filename:    z.string().min(1),
    storagePath: z.string().min(1),
    mimeType:    z.string(),
  }),
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
    .select("id, customer_id, doc_profiles_extracted")
    .eq("id", body.projectId)
    .eq("customer_id", body.customerId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const { data, error } = await serviceClient.storage
      .from("customer-uploads")
      .download(body.file.storagePath);

    if (error || !data) {
      return NextResponse.json(
        { error: `Could not download file: ${error?.message}` },
        { status: 400 },
      );
    }

    const { extractDocument } = await import("../../../../../pipeline/lib/document-extract");
    const result = await extractDocument(body.projectId, body.customerId, {
      filename: body.file.filename,
      buffer:   Buffer.from(await data.arrayBuffer()),
      mimeType: body.file.mimeType,
    });

    return NextResponse.json({
      projectId:    body.projectId,
      documentType: result.type_slug,
      sourceFile:   result.source_file,
      summary:      result.summary,
    });
  } catch (err) {
    const message = (err as Error).message;
    console.error(`[document-analysis webhook] Failed for project ${body.projectId}: ${message}`);
    return NextResponse.json(
      { error: "Document extraction failed", details: message },
      { status: 500 },
    );
  }
}
