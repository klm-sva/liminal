"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Metadata } from "next";

function LogoMark() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ background: "linear-gradient(135deg, #388fa6, #1c5e70)" }}
      >
        <svg width="34" height="34" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path fillRule="evenodd" clipRule="evenodd" d="M11 2L18.8 15.5L3.2 15.5ZM11 5.5L15.75 13.75L6.25 13.75Z" fill="rgba(0,0,0,0.30)" />
          <path fillRule="evenodd" clipRule="evenodd" d="M10 1L17.8 14.5L2.2 14.5ZM10 4.5L14.75 12.75L5.25 12.75Z" fill="white" />
        </svg>
      </div>
      <span
        className="text-xl tracking-tight"
        style={{ fontFamily: "var(--font-dm-serif)", color: "#2b4044" }}
      >
        Liminal
      </span>
    </Link>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Auth service not configured — add Supabase credentials to .env.local");
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (authError) throw authError;
      router.push(`/confirm?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#f9f5ef" }}
    >
      {/* Top accent band */}
      <div
        aria-hidden="true"
        style={{ height: "4px", background: "linear-gradient(90deg, #388fa6, #1c5e70)" }}
      />

      {/* Top bar */}
      <div className="w-full px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <LogoMark />
          <p className="text-sm" style={{ color: "#7a8f94" }}>
            New to Liminal?{" "}
            <Link
              href="/signup"
              className="font-semibold transition-colors"
              style={{ color: "#388fa6" }}
            >
              Join the pilot
            </Link>
          </p>
        </div>
      </div>

      {/* Form area */}
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">

          {/* Card */}
          <div
            className="bg-white p-8"
            style={{
              borderRadius: "20px",
              border: "1px solid rgba(56,143,166,0.12)",
              boxShadow: "0 4px 32px rgba(43,64,68,0.08)",
            }}
          >
            <h1
              className="mb-2"
              style={{
                fontFamily: "var(--font-dm-serif)",
                fontSize: "30px",
                color: "#2b4044",
              }}
            >
              Welcome back
            </h1>
            <p
              className="text-sm leading-relaxed mb-8"
              style={{ color: "#7a8f94" }}
            >
              Enter your email and we&apos;ll send a magic link. No password needed.
            </p>

            {error && (
              <div
                className="mb-5 px-4 py-3 text-sm"
                style={{
                  borderRadius: "10px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#b91c1c",
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email */}
              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                  htmlFor="email"
                  style={{ color: "rgba(43,64,68,0.55)", letterSpacing: "0.10em" }}
                >
                  Email address <span style={{ color: "#388fa6" }}>*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourfirm.com"
                  className="w-full outline-none transition-all text-sm"
                  style={{
                    borderRadius: "10px",
                    border: "1px solid rgba(43,64,68,0.14)",
                    background: "#fafbfc",
                    padding: "12px 16px",
                    color: "#2b4044",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#388fa6";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(56,143,166,0.12)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(43,64,68,0.14)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              {/* Magic link note */}
              <div
                className="flex items-start gap-3 px-4 py-3"
                style={{
                  borderRadius: "10px",
                  background: "#e8f3fa",
                  border: "1px solid rgba(56,143,166,0.18)",
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 15 15"
                  fill="none"
                  className="shrink-0 mt-0.5"
                  aria-hidden="true"
                >
                  <circle cx="7.5" cy="7.5" r="7.5" fill="#388fa6" fillOpacity="0.15" />
                  <path d="M7 4.5h1v4.5H7zM7 10h1v1.5H7z" fill="#388fa6" />
                </svg>
                <p className="text-xs leading-relaxed" style={{ color: "#1c5e70" }}>
                  We&apos;ll send a secure login link to your inbox. Valid for 24 hours. No password required.
                </p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderRadius: "100px",
                  background: "linear-gradient(135deg, #388fa6, #1c5e70)",
                  padding: "14px 24px",
                  boxShadow: "0 2px 16px rgba(56,143,166,0.30)",
                }}
              >
                {loading ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <>Send magic link <ArrowRight size={15} /></>
                )}
              </button>
            </form>

            {/* Legal */}
            <p
              className="text-center text-xs mt-6 leading-relaxed"
              style={{ color: "#9aafb4" }}
            >
              By continuing you agree to our{" "}
              <Link href="/terms" className="hover:underline" style={{ color: "#388fa6" }}>
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="hover:underline" style={{ color: "#388fa6" }}>
                Privacy Policy
              </Link>.
            </p>
          </div>

          {/* Pilot note */}
          <p
            className="text-center text-xs mt-5"
            style={{ color: "#9aafb4" }}
          >
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold hover:underline"
              style={{ color: "#388fa6" }}
            >
              Join the pilot program →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
