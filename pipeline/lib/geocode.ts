import axios from "axios";

interface ValidateResult {
  valid:  boolean;
  reason: string;
}

export async function validateAddress(address: string): Promise<ValidateResult> {
  if (!address || address.trim().length < 5) {
    return { valid: false, reason: "No project address was provided. Please add a full street address to your project before submitting." };
  }
  return { valid: true, reason: "Address present" };
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
    const { data } = await axios.get(url, { timeout: 10000 });
    if (data.status === "OK" && data.results?.[0]?.geometry?.location) {
      const { lat, lng } = data.results[0].geometry.location;
      return { lat, lon: lng };
    }
    console.warn(`  [geocode] No result for "${address}" — status: ${data.status}`);
    return null;
  } catch (err) {
    console.warn(`  [geocode] Geocoding failed: ${(err as Error).message}`);
    return null;
  }
}
