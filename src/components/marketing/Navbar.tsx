"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="sticky top-0 z-50">

      {/* ── Pilot banner ─────────────────────────────────────────────────── */}
      <div
        className="w-full py-2 px-4"
        style={{ background: "linear-gradient(90deg, #388fa6, #1c5e70)" }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-white text-xs font-medium">
            Pilot program open. Introductory pricing in effect.
          </span>
          <span className="text-white/75 text-xs font-medium">
            Limited access
          </span>
        </div>
      </div>

      {/* ── Nav bar ──────────────────────────────────────────────────────── */}
      <nav
        className="border-b"
        style={{
          background: "rgba(43,64,68,0.08)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderColor: "rgba(43,64,68,0.12)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #388fa6, #1c5e70)" }}
              >
                <svg width="30" height="30" viewBox="0 0 20 20" fill="none" aria-hidden="true">
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

            {/* Desktop nav links — centered */}
            <div className="hidden lg:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
              <Link
                href="/about"
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors hover:text-certify-deep"
                style={{ color: "rgba(43,64,68,0.65)" }}
              >
                Who we are
              </Link>
              <Link
                href="/how-it-works"
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors hover:text-certify-deep"
                style={{ color: "rgba(43,64,68,0.65)" }}
              >
                How it works
              </Link>
              <Link
                href="/pricing"
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors hover:text-certify-deep"
                style={{ color: "rgba(43,64,68,0.65)" }}
              >
                Pricing
              </Link>
            </div>

            {/* Desktop CTA */}
            <div className="hidden lg:block">
              <Link
                href="/signup"
                className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{
                  background: "linear-gradient(135deg, #388fa6, #1c5e70)",
                  borderRadius: "100px",
                }}
              >
                Join the pilot
              </Link>
            </div>

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-lg transition-colors"
              style={{ color: "rgba(43,64,68,0.70)" }}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div
            className="lg:hidden border-t px-4 py-4 space-y-1"
            style={{ borderColor: "rgba(43,64,68,0.08)", background: "rgba(255,255,255,0.96)" }}
          >
            <Link
              href="/about"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 text-sm font-medium rounded-lg"
              style={{ color: "rgba(43,64,68,0.70)" }}
            >
              Who we are
            </Link>
            <Link
              href="/how-it-works"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 text-sm font-medium rounded-lg"
              style={{ color: "rgba(43,64,68,0.70)" }}
            >
              How it works
            </Link>
            <Link
              href="/pricing"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 text-sm font-medium rounded-lg"
              style={{ color: "rgba(43,64,68,0.70)" }}
            >
              Pricing
            </Link>
            <div className="pt-3 border-t" style={{ borderColor: "rgba(43,64,68,0.08)" }}>
              <Link
                href="/signup"
                className="block text-center text-sm font-semibold text-white px-5 py-2.5 transition-opacity hover:opacity-90"
                style={{
                  background: "linear-gradient(135deg, #388fa6, #1c5e70)",
                  borderRadius: "100px",
                }}
              >
                Join the pilot
              </Link>
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}
