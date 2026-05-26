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
