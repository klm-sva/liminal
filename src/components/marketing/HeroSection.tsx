"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

const GAP_ANALYSIS_OPTIONS = [
  { label: "LEED BD+C v4.1",        href: "/orders/gap-analysis" },
  { label: "WELL v2",               href: "/orders/gap-analysis-well-v2" },
  { label: "WELL Health-Safety Rating", href: "/orders/gap-analysis-well-hsr" },
];

const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?auto=format&fit=crop&w=1920&q=80",
];

const BADGES = [
  "No subscriptions.",
  "Pilot pricing locked in for your project.",
];

export default function HeroSection() {
  const [current, setCurrent] = useState(0);
  const [gapOpen, setGapOpen] = useState(false);
  const gapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (gapRef.current && !gapRef.current.contains(e.target as Node)) {
        setGapOpen(false);
      }
    }
    if (gapOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [gapOpen]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {/* ── Rotating image area ──────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          minHeight: "620px",
          boxShadow: "inset 0 0 0 3px #388fa6",
        }}
      >
        {/* Background images — crossfade via opacity transition */}
        {HERO_IMAGES.map((src, i) => (
          <div
            key={src}
            className="absolute inset-0"
            style={{
              backgroundImage: `url('${src}')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: i === current ? 1 : 0,
              transition: "opacity 1200ms ease-in-out",
            }}
          />
        ))}

        {/* Gradient overlay for readability */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(160deg, rgba(28,94,112,0.78) 0%, rgba(43,64,68,0.74) 100%)",
          }}
        />

        {/* Text content over image */}
        <div
          className="relative flex flex-col items-center justify-center text-center px-4 sm:px-6 lg:px-8"
          style={{ minHeight: "620px", paddingTop: "80px", paddingBottom: "72px" }}
        >
          {/* Eyebrow */}
          <p
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase" as const,
              color: "#a3d4e0",
              marginBottom: "20px",
            }}
          >
            Modernizing Building Certification
          </p>

          {/* H1 */}
          <h1
            style={{
              fontFamily: "var(--font-dm-serif)",
              fontSize: "clamp(36px, 5vw, 60px)",
              color: "#FFFFFF",
              lineHeight: 1.1,
              marginBottom: "20px",
              maxWidth: "760px",
            }}
          >
            Building certification, automated
          </h1>

          {/* Subheadline */}
          <p
            style={{
              fontSize: "18px",
              fontWeight: 300,
              color: "rgba(255,255,255,0.82)",
              maxWidth: "500px",
              marginBottom: "36px",
              lineHeight: 1.65,
            }}
          >
            Upload your project information. Receive professionally prepared
            certification documentation. Save up to 600 hours per project.
          </p>

          {/* Value badges */}
          <div
            className="flex flex-wrap items-center justify-center"
            style={{ gap: "10px", marginBottom: "40px" }}
          >
            {BADGES.map((text) => (
              <span
                key={text}
                style={{
                  background: "rgba(255,255,255,0.13)",
                  border: "1px solid rgba(255,255,255,0.26)",
                  borderRadius: "100px",
                  padding: "7px 18px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.90)",
                  backdropFilter: "blur(4px)",
                  WebkitBackdropFilter: "blur(4px)",
                  whiteSpace: "nowrap" as const,
                }}
              >
                {text}
              </span>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="flex flex-wrap items-center justify-center" style={{ gap: "14px" }}>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 px-8 py-3.5"
              style={{
                background: "linear-gradient(135deg, #388fa6, #1c5e70)",
                borderRadius: "100px",
                boxShadow: "0 2px 16px rgba(56,143,166,0.40)",
              }}
            >
              Lock in pilot pricing
            </Link>
            <div className="relative" ref={gapRef}>
              <button
                onClick={() => setGapOpen((o) => !o)}
                className="inline-flex items-center gap-2 text-sm font-semibold transition-colors px-8 py-3.5"
                style={{
                  borderRadius: "100px",
                  border: "1.5px solid rgba(255,255,255,0.40)",
                  color: "#ffffff",
                  background: "rgba(255,255,255,0.08)",
                }}
              >
                Start with a gap analysis (recommended)
                <ChevronDown
                  size={15}
                  style={{
                    transform: gapOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 200ms ease",
                  }}
                />
              </button>

              {gapOpen && (
                <div
                  className="absolute left-1/2 bottom-full mb-2 z-50 overflow-hidden"
                  style={{
                    transform: "translateX(-50%)",
                    minWidth: "240px",
                    borderRadius: "14px",
                    background: "linear-gradient(135deg, #388fa6 0%, #1c5e70 100%)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    boxShadow: "0 8px 32px rgba(28,94,112,0.50)",
                  }}
                >
                  {GAP_ANALYSIS_OPTIONS.map((opt) => (
                    <Link
                      key={opt.href}
                      href={opt.href}
                      onClick={() => setGapOpen(false)}
                      className="block px-5 py-3.5 text-sm font-medium transition-colors hover:bg-white/8"
                      style={{ color: "rgba(255,255,255,0.85)" }}
                    >
                      {opt.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 text-sm font-semibold transition-colors px-8 py-3.5"
              style={{
                borderRadius: "100px",
                border: "1.5px solid rgba(255,255,255,0.40)",
                color: "#ffffff",
                background: "rgba(255,255,255,0.08)",
              }}
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>

      {/* ── Teal accent band ─────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{ height: "5px", background: "linear-gradient(90deg, #388fa6, #1c5e70)" }}
      />
    </>
  );
}
