import { createHmac } from "crypto";

function secret(): string {
  return process.env.QA_SECRET ?? process.env.CRON_SECRET ?? "";
}

export function signQaToken(orderId: string): string {
  return createHmac("sha256", secret()).update(orderId).digest("hex");
}

export function verifyQaToken(orderId: string, token: string): boolean {
  if (!token || !orderId) return false;
  const expected = signQaToken(orderId);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return diff === 0;
}
