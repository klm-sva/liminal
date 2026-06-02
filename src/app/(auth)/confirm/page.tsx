import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Check Your Inbox — LIMINALsva" };

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

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
        <div className="max-w-7xl mx-auto">
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
              LIMINALsva
            </span>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm text-center">

          {/* Check icon */}
          <div className="flex items-center justify-center mb-8">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(56,143,166,0.08)",
                border: "2px solid rgba(56,143,166,0.35)",
              }}
            >
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
                <circle cx="18" cy="18" r="17" stroke="#388fa6" strokeWidth="1.5" />
                <path
                  d="M10 18l5.5 5.5L26 12"
                  stroke="#388fa6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* Heading */}
          <h1
            className="mb-3"
            style={{
              fontFamily: "var(--font-dm-serif)",
              fontSize: "30px",
              color: "#2b4044",
            }}
          >
            Check your inbox
          </h1>

          <p className="leading-relaxed mb-2 text-sm" style={{ color: "#7a8f94" }}>
            We&apos;ve sent a magic link to
          </p>

          {email && (
            <p
              className="font-semibold text-lg mb-4"
              style={{ color: "#2b4044" }}
            >
              {email}
            </p>
          )}

          <p
            className="text-sm leading-relaxed mb-10"
            style={{ color: "#7a8f94", maxWidth: "300px", margin: "0 auto 40px" }}
          >
            Click the link in the email to access your dashboard. Valid for 24 hours. Check your spam folder if you don&apos;t see it within a minute.
          </p>

          {/* Primary CTA */}
          <Link
            href="/dashboard"
            className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 mb-4"
            style={{
              borderRadius: "100px",
              background: "linear-gradient(135deg, #388fa6, #1c5e70)",
              padding: "14px 24px",
              boxShadow: "0 2px 16px rgba(56,143,166,0.28)",
            }}
          >
            Continue to dashboard
          </Link>

          {/* Secondary */}
          <p className="text-xs" style={{ color: "#9aafb4" }}>
            Wrong email?{" "}
            <Link
              href="/signup"
              className="font-semibold hover:underline"
              style={{ color: "#388fa6" }}
            >
              Go back
            </Link>
          </p>
        </div>
      </div>

      {/* Bottom decoration */}
      <div
        aria-hidden="true"
        className="w-full h-1"
        style={{ background: "linear-gradient(90deg, transparent, rgba(56,143,166,0.15), transparent)" }}
      />
    </div>
  );
}
