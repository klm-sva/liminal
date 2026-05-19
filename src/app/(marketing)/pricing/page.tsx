import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";
import { createPublicClient } from "@/lib/supabase/server";
import type { Credit } from "@/types/database";

export const metadata: Metadata = { title: "Pricing — Liminal" };
export const dynamic = "force-dynamic";

// ─── Data ─────────────────────────────────────────────────────────────────────

const PILOT_PRICE_GAP = 499;

const GAP_ANALYSIS_CONFIG = [
  {
    key:      "leed_bdc_v41",
    label:    "LEED BD+C v4.1",
    headline: "LEED Gap Analysis",
    gradient: "linear-gradient(135deg, #388fa6 0%, #1c5e70 100%)",
    accentColor: "rgba(163,212,224,0.75)",
    description:
      "A scored baseline for your project. Every applicable credit inventoried, current points estimated, gap to your certification target calculated, and a prioritised credit shortlist delivered.",
    includes: [
      "Scored inventory of every applicable credit",
      "Points estimate vs. your certification target",
      "Category-by-category gap breakdown",
      "Prioritised credit shortlist by effort / impact",
      "Automation classification for each credit",
      "Downloadable report (editable output)",
    ],
    ctaLabel: "Order LEED gap analysis",
    href:     "/orders/gap-analysis",
  },
  {
    key:      "well_v2",
    label:    "WELL v2",
    headline: "WELL v2 Gap Analysis",
    gradient: "linear-gradient(135deg, #5fa8bb 0%, #388fa6 100%)",
    accentColor: "rgba(163,212,224,0.75)",
    description:
      "A complete readiness assessment for WELL v2 certification. Every applicable feature inventoried, current points estimated, gap to your certification level calculated, and a prioritised feature shortlist delivered.",
    includes: [
      "Scored inventory of every applicable feature",
      "Points estimate vs. Silver / Gold / Platinum target",
      "Concept-by-concept gap breakdown",
      "Prioritised feature shortlist by effort / impact",
      "Automation classification for each feature",
      "Downloadable report (editable output)",
    ],
    ctaLabel: "Order WELL v2 gap analysis",
    href:     "/orders/gap-analysis-well-v2",
  },
  {
    key:      "well_hsr",
    label:    "WELL Health-Safety",
    headline: "WELL HSR Gap Analysis",
    gradient: "linear-gradient(135deg, #c4a882 0%, #a8895e 100%)",
    accentColor: "rgba(237,194,153,0.80)",
    description:
      "A clear-eyed assessment of your WELL Health-Safety Rating readiness. All applicable features evaluated, gap to the rating threshold identified, and a targeted action plan to close it.",
    includes: [
      "All applicable features assessed against the standard",
      "Points estimate vs. rating threshold",
      "Concept-by-concept gap breakdown",
      "Prioritised action list with effort / impact ratings",
      "Automation classification for each feature",
      "Downloadable report (editable output)",
    ],
    ctaLabel: "Order WELL HSR gap analysis",
    href:     "/orders/gap-analysis-well-hsr",
  },
];

const PROGRAM_CONFIG: Record<string, { label: string; chip: string }> = {
  leed_bdc_v41: { label: "LEED BD+C v4.1",       chip: "#388fa6" },
  well_v2:      { label: "WELL v2",               chip: "#5fa8bb" },
  well_hsr:     { label: "WELL Health-Safety",    chip: "#c4a882" },
};

const PROGRAM_ORDER = ["leed_bdc_v41", "well_v2", "well_hsr"];

function deliverableTags(credit: Credit): string[] {
  const tags: string[] = [];
  if (credit.program === "leed_bdc_v41") {
    tags.push("Narrative");
    if (credit.has_leed_form)  tags.push("LEED form");
    if (credit.has_calculator) tags.push("Calculator");
  } else {
    tags.push("Documentation pkg");
    if (credit.has_calculator) tags.push("Calculator");
  }
  return tags;
}

// ─── Components ───────────────────────────────────────────────────────────────

function ProgramWindow({ programKey, credits }: { programKey: string; credits: Credit[] }) {
  const config = PROGRAM_CONFIG[programKey];

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

export default async function PricingPage() {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("credits")
    .select("*")
    .eq("is_active", true)
    .order("credit_code");
  const allCredits = (data ?? []) as Credit[];

  const creditsByProgram = allCredits.reduce<Record<string, Credit[]>>((acc, c) => {
    if (!acc[c.program]) acc[c.program] = [];
    acc[c.program].push(c as Credit);
    return acc;
  }, {});

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

        {/* ── Gap Analysis ────────────────────────────────────────── */}
        <section className="py-16" style={{ background: "#ffffff" }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

            <p
              className="text-xs font-bold uppercase tracking-widest mb-8"
              style={{ color: "#388fa6", letterSpacing: "0.14em" }}
            >
              Start here
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {GAP_ANALYSIS_CONFIG.map((ga) => (
                <div
                  key={ga.key}
                  className="flex flex-col p-7"
                  style={{
                    borderRadius: "16px",
                    background: ga.gradient,
                  }}
                >
                  {/* Program chip */}
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-4"
                    style={{ color: ga.accentColor, letterSpacing: "0.14em" }}
                  >
                    {ga.label}
                  </p>

                  {/* Headline */}
                  <h2
                    className="mb-3 leading-tight"
                    style={{
                      fontFamily: "var(--font-dm-serif)",
                      fontSize: "clamp(18px, 2vw, 22px)",
                      color: "#ffffff",
                    }}
                  >
                    {ga.headline}
                  </h2>

                  {/* Description */}
                  <p
                    className="text-xs leading-relaxed mb-5"
                    style={{ color: "rgba(255,255,255,0.68)" }}
                  >
                    {ga.description}
                  </p>

                  {/* Included list */}
                  <ul className="space-y-2 mb-6 flex-1">
                    {ga.includes.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs" style={{ color: "rgba(255,255,255,0.82)" }}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="shrink-0 mt-0.5" aria-hidden="true">
                          <circle cx="6.5" cy="6.5" r="6.5" fill="rgba(255,255,255,0.15)" />
                          <path d="M3.5 6.5l2 2 4-4" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>

                  {/* Price + CTA */}
                  <div
                    className="pt-5 mt-auto"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.18)" }}
                  >
                    <div className="flex items-end justify-between mb-4">
                      <div>
                        <p
                          className="leading-none"
                          style={{
                            fontFamily: "var(--font-dm-serif)",
                            fontSize: "40px",
                            color: "#ffffff",
                          }}
                        >
                          ${PILOT_PRICE_GAP}
                        </p>
                        <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.50)" }}>
                          introductory pilot · one-time fee
                        </p>
                      </div>
                      <p className="text-[10px] text-right" style={{ color: ga.accentColor }}>
                        Delivered<br />within 48 hrs
                      </p>
                    </div>
                    <Link
                      href="/signup"
                      className="block text-center text-xs font-semibold transition-opacity hover:opacity-90 px-4 py-2.5 w-full"
                      style={{
                        borderRadius: "100px",
                        background: "#ffffff",
                        color: "#1c5e70",
                      }}
                    >
                      {ga.ctaLabel}
                    </Link>
                  </div>
                </div>
              ))}
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
              <ProgramWindow key={key} programKey={key} credits={creditsByProgram[key] ?? []} />
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
