/**
 * pipeline/lib/pipeline-utils.ts
 *
 * Shared reliability utilities: timeout wrapper, axios retry helper,
 * and step logger for console output with per-step timing.
 */

import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";

// ─── Timeout wrapper ──────────────────────────────────────────────────────────

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timeout after ${ms}ms: ${label}`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// ─── Axios GET with 10 s timeout and one retry ────────────────────────────────

export async function axiosGetWithRetry(
  url: string,
  options: AxiosRequestConfig = {},
  timeoutMs = 10000,
  label = "HTTP GET",
): Promise<AxiosResponse<any>> {
  const opts: AxiosRequestConfig = { ...options, timeout: timeoutMs };
  try {
    return await axios.get(url, opts);
  } catch (err) {
    console.warn(`  ⚠ ${label} failed — retrying after 2 s: ${(err as Error).message}`);
    await new Promise((r) => setTimeout(r, 2000));
    // Second failure propagates to caller — never hang silently
    return axios.get(url, opts);
  }
}

// ─── Step logger ──────────────────────────────────────────────────────────────
// Logs every pipeline step to the console with ISO timestamps and elapsed ms.
// In process-order.ts the caller also writes to the order_logs Supabase table.

export interface StepRecord {
  key:       string;
  name:      string;
  startedAt: number;
}

export class StepLogger {
  private steps = new Map<string, StepRecord>();

  /** Call at the start of a step. Returns a key to pass to complete() or fail(). */
  start(name: string): string {
    const key: string = `${name}|${Date.now()}`;
    const record: StepRecord = { key, name, startedAt: Date.now() };
    this.steps.set(key, record);
    console.log(`[${new Date().toISOString()}] ▶ START  ${name}`);
    return key;
  }

  /** Call when a step succeeds. Returns elapsed ms. */
  complete(key: string): number {
    const step = this.steps.get(key);
    if (!step) return 0;
    const ms = Date.now() - step.startedAt;
    console.log(`[${new Date().toISOString()}] ✓ DONE   ${step.name} — ${ms} ms`);
    return ms;
  }

  /** Call when a step fails. Returns elapsed ms. */
  fail(key: string, error: Error): number {
    const step = this.steps.get(key);
    if (!step) return 0;
    const ms = Date.now() - step.startedAt;
    console.error(
      `[${new Date().toISOString()}] ✗ FAIL   ${step.name} — ${ms} ms — ${error.message}`,
    );
    return ms;
  }

  /** Convenience: wrap an async call in start/complete/fail logging. */
  async run<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const key = this.start(name);
    try {
      const result = await fn();
      this.complete(key);
      return result;
    } catch (err) {
      this.fail(key, err as Error);
      throw err;
    }
  }
}
