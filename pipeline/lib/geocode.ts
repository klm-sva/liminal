/**
 * Address validation via Google Maps Geocoding API.
 * Returns { valid, reason } — called as a pre-processing gate before any
 * expensive pipeline work runs.
 */

interface ValidateResult {
  valid:  boolean;
  reason: string;
  lat?:   number;
  lng?:   number;
}

export async function validateAddress(address: string): Promise<ValidateResult> {
  if (!address || address.trim().length < 5) {
    return { valid: false, reason: "No project address was provided. Please add a full street address to your project before submitting." };
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    // If no API key is configured, skip the check rather than block all orders.
    console.warn("  [geocode] GOOGLE_MAPS_API_KEY not set — skipping address validation");
    return { valid: true, reason: "Address validation skipped (no API key)" };
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("key", key);

    const res  = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    const data = await res.json() as {
      status:  string;
      results: Array<{
        geometry:             { location: { lat: number; lng: number } };
        types:                string[];
        formatted_address:    string;
        address_components:   Array<{ types: string[] }>;
      }>;
    };

    if (data.status === "ZERO_RESULTS" || !data.results?.length) {
      return {
        valid:  false,
        reason: `The project address "${address}" could not be found. Please check the address and try again.`,
      };
    }

    if (data.status !== "OK") {
      // API error (quota, network, etc.) — fail open so we don't block orders.
      console.warn(`  [geocode] Geocoding API returned status ${data.status} — skipping validation`);
      return { valid: true, reason: `Geocoding API status: ${data.status}` };
    }

    const top = data.results[0];

    // Reject results that resolved only to a city, state, or country — not a street address.
    const hasStreet = top.address_components.some((c) =>
      c.types.includes("street_number") || c.types.includes("route")
    );

    if (!hasStreet) {
      return {
        valid:  false,
        reason: `The address "${address}" resolved to a general area, not a specific street address. Please provide a full street address including street number.`,
      };
    }

    return {
      valid:  true,
      reason: `Address verified: ${top.formatted_address}`,
      lat:    top.geometry.location.lat,
      lng:    top.geometry.location.lng,
    };
  } catch (err) {
    // Network timeout or parse error — fail open.
    console.warn(`  [geocode] Address validation error: ${(err as Error).message} — skipping`);
    return { valid: true, reason: "Address validation skipped (network error)" };
  }
}
