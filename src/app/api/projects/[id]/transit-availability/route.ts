/**
 * POST /api/projects/[id]/transit-availability
 *
 * Credit-agnostic pre-purchase check: does usable GTFS transit schedule data
 * exist for this project's address? Backs the "Check availability" button on
 * any credit detail page that relies on this data source (currently LEED
 * LTc5 and WELL v2 V05's non-Transit-Score path) — the check itself doesn't
 * need to know which credit is asking, it only needs a project location.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 120;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, customer_id, address")
    .eq("id", id)
    .single();

  if (!project || project.customer_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!project.address || !project.address.trim()) {
    return NextResponse.json({ status: "address_required" });
  }

  const { geocodeAddress } = await import("../../../../../../pipeline/lib/geocode");
  const location = await geocodeAddress(project.address);

  if (!location) {
    return NextResponse.json({
      status: "unavailable",
      reason: "We couldn't locate this project's address. Please confirm it's a complete, valid street address.",
    });
  }

  try {
    const { checkTransitDataAvailability } = await import("../../../../../../pipeline/lib/gtfs-transit");
    const result = await checkTransitDataAvailability(location.lat, location.lon);

    return NextResponse.json({
      status:       result.available ? "available" : "unavailable",
      reason:       result.reason,
      feedsChecked: result.feedsChecked,
    });
  } catch (e) {
    console.error("[transit-availability] check failed:", (e as Error).message);
    return NextResponse.json(
      { error: "Transit availability check failed. Please try again." },
      { status: 500 }
    );
  }
}
