import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";
import { MOCK_CREDITS } from "@/lib/mock-data";
import type { MockCredit } from "@/lib/mock-data";

export const metadata: Metadata = { title: "Pricing — Liminal" };

// ─── Data ─────────────────────────────────────────────────────────────────────

const PILOT_PRICE_GAP = 499;

const PROGRAM_CONFIG: Record<string, { label: string; chip: string }> = {
  leed_bdc_v41: { label: "LEED BD+C v4.1",       chip: "#388fa6" },
  well_v2:      { label: "WELL v2",               chip: "#5fa8bb" },
  well_hsr:     { label: "WELL Health-Safety",    chip: "#c4a882" },
};

const PROGRAM_ORDER = ["leed_bdc_v41", "well_v2", "well_hsr"];

function deliverableTags(credit: MockCredit): string[] {
  const tags: string[] = [];
  if (credit.program === "leed_bdc_v41") {
    tags.push("Narrative");
    if (credit.has_leed_form)  tags.push("LEED form");
    if (credit.has_calculator) tags.push("Calculator");
  } else {
    tags.push("Documentation pkg");
    if (credit.has_policy)     tags.push("Policy draft");
    if (credit.has_calculator) tags.push("Calculator");
  }
  return tags;
}

// ─── Components ───────────────────────────────────────────────────────────────

function ProgramWindow({ programKey }: { programKey: string }) {
  const config   = PROGRAM_CONFIG[programKey];
  const credits  = MOCK_CREDITS.filter((c) => c.program === programKey);

  return (
    <div className="mb-10">
      {/* Program label row */}
      <div className="flex items-center gap-3 mb-4">
        <span
          className="text-xs font-semibold text-white px-3 py-1 shrink-0"
          style={{ borderRadius: "6px", background: config.chip }}
        >
          {config.label}
        </span>
        <div className="flex-1 h-px" style={{ background: "rgba(43,64,68,0.08)" }} />
        <span className="text-xs shrink-0" style={{ color: "rgba(43,64,68,0.35)" }}>
          {credits.length} {programKey === "leed_bdc_v41" ? "credits" : "features"}
        </span>
      </div>

      {/* Scrollable window */}
      <div
        style={{
          borderRadius: "14px",
          border: "1px solid rgba(43,64,68,0.10)",
          overflow: "hidden",
          boxShadow: "0 1px 6px rgba(43,64,68,0.04)",
        }}
      >
        {/* Column header */}
        <div
          className="grid gap-4 px-5 py-2.5"
          style={{
            gridTemplateColumns: "110px 1fr auto 72px",
            background: "rgba(43,64,68,0.03)",
            borderBottom: "1px solid rgba(43,64,68,0.08)",
          }}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(43,64,68,0.40)" }}>Code</span>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(43,64,68,0.40)" }}>Credit / Feature</span>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(43,64,68,0.40)" }}>Deliverables</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-right" style={{ color: "rgba(43,64,68,0.40)" }}>Price</span>
        </div>

        {/* Scrollable rows */}
        <div
          className="overflow-y-auto bg-white"
          style={{ maxHeight: "420px" }}
        >
          {credits.map((credit, i) => (
            <div
              key={credit.id}
              className="grid gap-4 px-5 py-3.5 items-start"
              style={{
                gridTemplateColumns: "110px 1fr auto 72px",
                borderBottom: i < credits.length - 1 ? "1px solid rgba(43,64,68,0.06)" : "none",
              }}
            >
              {/* Code + category */}
              <div>
                <p
                  className="text-xs font-semibold leading-none mb-1"
                  style={{ color: config.chip }}
                >
                  {credit.credit_code}
                </p>
                <p
                  className="text-[10px] leading-snug"
                  style={{ color: "rgba(43,64,68,0.42)" }}
                >
                  {credit.category}
                </p>
              </div>

              {/* Name + deliverable detail */}
              <div>
                <p
                  className="text-sm font-medium leading-snug mb-1"
                  style={{ color: "#2b4044" }}
                >
                  {credit.credit_name}
                </p>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "rgba(43,64,68,0.50)" }}
                >
                  {credit.deliverable_description}
                </p>
              </div>

              {/* Deliverable tags */}
              <div className="flex flex-wrap gap-1 justify-end" style={{ maxWidth: "220px" }}>
                {deliverableTags(credit).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-medium px-2 py-0.5 whitespace-nowrap"
                    style={{
                      borderRadius: "4px",
                      background: "rgba(56,143,166,0.08)",
                      color: "#1c5e70",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Price */}
              <div className="text-right">
                <p
                  className="text-sm font-semibold leading-none"
                  style={{ fontFamily: "var(--font-dm-serif)", color: "#2b4044" }}
                >
                  ${Math.round(credit.price / 100)}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: "#9aafb4" }}>pilot</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main>

        {/* ── Hero ───────────────────────────────────────────────── */}
        <section
          className="py-20 lg:py-28 text-center"
          style={{ background: "#f9f5ef" }}
        >
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <p
              className="text-xs font-bold uppercase tracking-widest mb-4"
              style={{ color: "#388fa6", letterSpacing: "0.14em" }}
            >
              Pricing
            </p>
            <h1
              className="mb-5 leading-tight"
              style={{
                fontFamily: "var(--font-dm-serif)",
                fontSize: "clamp(32px, 5vw, 52px)",
                color: "#2b4044",
              }}
            >
              Simple, per-credit pricing.
              <br />No subscriptions.
            </h1>
            <p
              className="text-base leading-relaxed mx-auto mb-8"
              style={{ color: "#6b7e82", maxWidth: "480px" }}
            >
              Buy exactly what you need. Every credit is individually priced. Order one or order twenty. Nothing is bundled, nothing is recurring.
            </p>

            {/* Pilot pricing banner */}
            <div
              className="px-6 py-4 text-left"
              style={{
                borderRadius: "12px",
                background: "rgba(56,143,166,0.08)",
                border: "1px solid rgba(56,143,166,0.25)",
                maxWidth: "560px",
                margin: "0 auto",
              }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: "#1c5e70" }}>
                Liminal is currently offering pilot pricing.
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "#6b7e82" }}>
                Pricing is being offered at a special rate and will increase when we fully launch the platform. Your project keeps the rate it started at and we will give you plenty of notice before any change.
              </p>
            </div>
          </div>
        </section>

        {/* ── LEED Gap Analysis ───────────────────────────────────── */}
        <section className="py-16" style={{ background: "#ffffff" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

            <p
              className="text-xs font-bold uppercase tracking-widest mb-8"
              style={{ color: "#388fa6", letterSpacing: "0.14em" }}
            >
              Start here
            </p>

            <div
              className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center p-8"
              style={{
                borderRadius: "16px",
                background: "linear-gradient(135deg, #388fa6 0%, #1c5e70 100%)",
              }}
            >
              {/* Copy */}
              <div>
                <p
                  className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{ color: "rgba(163,212,224,0.75)", letterSpacing: "0.14em" }}
                >
                  Recommended first step
                </p>
                <h2
                  className="mb-4 leading-tight"
                  style={{
                    fontFamily: "var(--font-dm-serif)",
                    fontSize: "clamp(22px, 3vw, 30px)",
                    color: "#ffffff",
                  }}
                >
                  LEED Gap Analysis
                </h2>
                <p
                  className="text-sm leading-relaxed mb-6"
                  style={{ color: "rgba(255,255,255,0.70)" }}
                >
                  A scored baseline for your project. Every applicable credit inventoried, current points estimated, gap to your certification target calculated, and a prioritised credit shortlist delivered.
                </p>

                {/* What's included */}
                <ul className="space-y-2 mb-6">
                  {[
                    "Scored inventory of every applicable credit",
                    "Points estimate vs. your certification target",
                    "Category-by-category gap breakdown",
                    "Prioritised credit shortlist by effort / impact",
                    "Automation classification for each credit",
                    "Downloadable report (editable output)",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-xs" style={{ color: "rgba(255,255,255,0.80)" }}>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="shrink-0 mt-0.5" aria-hidden="true">
                        <circle cx="6.5" cy="6.5" r="6.5" fill="rgba(255,255,255,0.15)" />
                        <path d="M3.5 6.5l2 2 4-4" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-90 px-6 py-3"
                  style={{
                    borderRadius: "100px",
                    background: "#ffffff",
                    color: "#1c5e70",
                  }}
                >
                  Order LEED gap analysis
                </Link>
              </div>

              {/* Price card */}
              <div
                className="flex flex-col items-center justify-center text-center p-8"
                style={{
                  borderRadius: "14px",
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.20)",
                }}
              >
                <p
                  className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{ color: "rgba(163,212,224,0.75)", letterSpacing: "0.14em" }}
                >
                  One-time fee
                </p>
                <p
                  className="leading-none mb-2"
                  style={{
                    fontFamily: "var(--font-dm-serif)",
                    fontSize: "64px",
                    color: "#ffffff",
                  }}
                >
                  ${PILOT_PRICE_GAP}
                </p>
                <p className="text-sm mb-1" style={{ color: "rgba(255,255,255,0.60)" }}>
                  introductory pilot pricing
                </p>
                <p className="text-xs" style={{ color: "rgba(163,212,224,0.65)" }}>
                  Delivered within 48 hours
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Individual Credits ───────────────────────────────────── */}
        <section
          className="py-16 lg:py-20"
          style={{ background: "#fafbfc" }}
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* Section header */}
            <div className="mb-10">
              <p
                className="text-xs font-bold uppercase tracking-widest mb-4"
                style={{ color: "#388fa6", letterSpacing: "0.14em" }}
              >
                Individual credits &amp; features
              </p>
              <h2
                className="leading-tight mb-2"
                style={{
                  fontFamily: "var(--font-dm-serif)",
                  fontSize: "clamp(22px, 3.5vw, 32px)",
                  color: "#2b4044",
                }}
              >
                Starting at $59.
              </h2>
              <p className="text-sm" style={{ color: "#6b7e82" }}>
                Each credit is priced based on the complexity of documentation required. Pilot pricing is offered at a reduced rate.
              </p>
            </div>

            {/* One scrollable window per program */}
            {PROGRAM_ORDER.map((key) => (
              <ProgramWindow key={key} programKey={key} />
            ))}

          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────────── */}
        <section
          className="py-20"
          style={{ background: "#f9f5ef" }}
        >
          <div className="max-w-xl mx-auto px-4 text-center">
            <h2
              className="mb-4"
              style={{
                fontFamily: "var(--font-dm-serif)",
                fontSize: "clamp(24px, 3.5vw, 32px)",
                color: "#2b4044",
              }}
            >
              Ready to start?
            </h2>
            <p
              className="text-base leading-relaxed mb-8"
              style={{ color: "#6b7e82" }}
            >
              Lock in pilot pricing and get your first credit at introductory pricing.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 px-8 py-3.5"
              style={{
                borderRadius: "100px",
                background: "linear-gradient(135deg, #388fa6, #1c5e70)",
                boxShadow: "0 2px 16px rgba(56,143,166,0.28)",
              }}
            >
              Lock in pilot pricing
            </Link>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
