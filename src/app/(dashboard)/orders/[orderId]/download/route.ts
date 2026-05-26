import { NextResponse }        from "next/server";
import { createClient }        from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

const OUTPUTS_BUCKET = "order-outputs";

const MIME_TYPES: Record<string, string> = {
  html: "text/html",
  pdf:  "application/pdf",
  png:  "image/png",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const url  = new URL(request.url);
  const path = url.searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "path parameter required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the customer owns this order
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("customer_id", user.id)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const serviceClient = await createServiceClient();
  const { data: fileData, error: downloadError } = await serviceClient.storage
    .from(OUTPUTS_BUCKET)
    .download(path);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const filename  = path.split("/").pop() ?? "download";
  const ext       = filename.split(".").pop()?.toLowerCase() ?? "";
  const mimeType  = MIME_TYPES[ext] ?? "application/octet-stream";

  const buffer = Buffer.from(await fileData.arrayBuffer());

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":        mimeType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length":      buffer.byteLength.toString(),
    },
  });
}
