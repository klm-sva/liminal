import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";
import HeroSection from "@/components/marketing/HeroSection";
import LoomLoop from "@/components/marketing/LoomLoop";

export const metadata: Metadata = {
  title: "LIMINALsva — LEED & WELL Certification Documentation Platform",
  description:
    "Documentation for LEED BD+C v4.1, WELL v2, and WELL Health-Safety Rating. Automate credit narratives, track documentation, and submit with confidence.",
};

// ─── Trust Band ───────────────────────────────────────────────────────────────

function TrustBand() {
  const stats: { value: string; label: string }[] = [
    { value: "3",    label: "Programs" },
    { value: "200+", label: "Credits & features" },
    { value: "48hr", label: "Typical turnaround" },
  ];

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #388fa6 0%, #1c5e70 100%)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="max-w-5xl mx-auto px-4">
        <div className="grid grid-cols-3">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className="flex flex-col items-center text-center py-10 px-6"
              style={{
                borderRight:
                  i < stats.length - 1
                    ? "1px solid rgba(255,255,255,0.12)"
                    : "none",
              }}
            >
              <span
                className="mb-2 leading-none"
                style={{
                  fontFamily: "var(--font-dm-serif)",
                  fontSize: "clamp(28px, 4vw, 40px)",
                  color: "#a3d4e0",
                }}
              >
                {stat.value}
              </span>
              <span
                className="text-sm"
                style={{ color: "rgba(163,212,224,0.75)" }}
              >
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

const HOW_STEPS = [
  {
    n: "01",
    title: "Choose your credit or feature",
    body:
      "Select one of three programs, then the specific credit or feature you need. Each is processed as a separate order.",
  },
  {
    n: "02",
    title: "See what you'll need to provide",
    body:
      "Before you pay, the platform shows the exact information required. If anything is missing we contact you before processing, not after. No wasted runs, no surprises. You only pay when the output is ready to deliver value.",
  },
  {
    n: "03",
    title: "Upload and pay",
    body:
      "Secure payment, then a private upload link. Your documents are deleted after processing.",
  },
  {
    n: "04",
    title: "Receive your output",
    body:
      "Editable outputs delivered to your inbox and your dashboard — update directly in your browser and save as a PDF. Outputs include everything you need for the certification review and submittal process: Calculators, Maps, Narratives, Online form data, Draft Policies, and more.",
  },
] as const;

function HowItWorksBand() {
  return (
    <section
      className="py-24 lg:py-32"
      style={{ background: "#ffffff" }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <p
          className="mb-10 leading-tight"
          style={{
            fontFamily: "var(--font-dm-serif)",
            fontSize: "clamp(28px, 4vw, 48px)",
            color: "#2b4044",
          }}
        >
          Dramatically reduce your documentation time
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">

          {/* ── Left: text content ─────────────────────────────── */}
          <div>
            {/* Header */}
            <div className="mb-10">
              <p
                className="text-xs font-semibold uppercase mb-4"
                style={{ color: "#388fa6", letterSpacing: "0.12em" }}
              >
                How it Works
              </p>
              <h2
                className="mb-5 leading-tight"
                style={{
                  fontFamily: "var(--font-dm-serif)",
                  fontSize: "clamp(26px, 3.5vw, 36px)",
                  color: "#2b4044",
                }}
              >
                A curated process developed by seasoned experts, now available for you.
              </h2>
              <p
                className="text-sm font-semibold mb-3"
                style={{ color: "#4a6570" }}
              >
                Here&apos;s some of what we do (depending on the credit requirements of course):
              </p>
              <ul className="space-y-2 mb-6">
                {[
                  "Construction document, specification, and policy review",
                  "Product and material sheet retrieval (your specs tell us what to go find)",
                  "Narratives, reports, and calculator inputs",
                  "Map development, online form inputs, and draft policies",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 text-sm"
                    style={{ color: "#4a6570" }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                      style={{ background: "#388fa6" }}
                    />
                    {item}
                  </li>
                ))}
              </ul>
              <p
                className="text-base leading-relaxed mb-6"
                style={{ color: "#6b7e82" }}
              >
                We spent over two years developing this tool, and based it on a proprietary process we designed for our clients. We know that the administrative burden is one of the biggest barriers to these programs. This fixes that. Made available directly to you.
              </p>
              <ul className="space-y-2">
                {[
                  "Four simple steps.",
                  "No certification experience required on your end.",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 text-sm"
                    style={{ color: "#4a6570" }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                      style={{ background: "#388fa6" }}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Step cards — 2 × 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {HOW_STEPS.map((step) => (
                <div
                  key={step.n}
                  className="p-6"
                  style={{
                    borderRadius: "14px",
                    border: "1px solid rgba(56,143,166,0.15)",
                    background: "#f0f7fa",
                  }}
                >
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-3"
                    style={{ color: "#388fa6" }}
                  >
                    Step {step.n}
                  </p>
                  <h3
                    className="mb-2"
                    style={{
                      fontFamily: "var(--font-dm-serif)",
                      fontSize: "17px",
                      color: "#2b4044",
                    }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: "#6b7e82" }}
                  >
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Loom video ──────────────────────────────── */}
          <div className="lg:sticky lg:top-24">
            <div
              className="w-full overflow-hidden"
              style={{
                aspectRatio: "16 / 9",
                borderRadius: "16px",
                boxShadow: "0 8px 48px rgba(43,64,68,0.10)",
              }}
            >
              <LoomLoop embedId="c458d0c57f79417d9e78ac5c0fae14d8" />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

// ─── Choose Your Credit ───────────────────────────────────────────────────────

const PROGRAMS = [
  {
    name:     "LEED BD+C v4.1",
    chip:     "#388fa6",
    desc:     "New construction & major renovation",
    selected: true,
  },
  {
    name:     "WELL v2",
    chip:     "#5fa8bb",
    desc:     "Health & wellbeing in the built environment",
    selected: false,
  },
  {
    name:     "WELL Health-Safety Rating",
    chip:     "#c4a882",
    desc:     "Operational policies for health & safety",
    selected: false,
  },
];

const PREVIEW_CREDITS = [
  { code: "LTc5", name: "Access to Quality Transit",   category: "Location & Transportation", price: 109 },
  { code: "SSc1", name: "Site Assessment",              category: "Sustainable Sites",         price: 179 },
  { code: "WEc1", name: "Outdoor Water Use Reduction",  category: "Water Efficiency",          price: 109 },
  { code: "EAp2", name: "Minimum Energy Performance",  category: "Energy & Atmosphere",       price: 139 },
];

function ChooseCreditBand() {
  return (
    <section
      className="py-24 lg:py-28"
      style={{ background: "#e8f3fa" }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-12">
          <p
            className="text-xs font-semibold uppercase mb-4"
            style={{ color: "#388fa6", letterSpacing: "0.12em" }}
          >
            Gap analysis or individual credits
          </p>
          <h2
            className="mb-4 leading-tight"
            style={{
              fontFamily: "var(--font-dm-serif)",
              fontSize: "clamp(28px, 4vw, 38px)",
              color: "#2b4044",
            }}
          >
            Run a gap analysis for an overall certification strategy or choose one credit at a time and use the included dashboard to manage your projects
          </h2>
          <p
            className="text-base mx-auto"
            style={{ color: "#6b7e82", maxWidth: "400px" }}
          >
            Order exactly what you need. Each credit is priced individually and the dashboard management tool is free.
          </p>
        </div>

        {/* Two-panel selector */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">

          {/* ── Left: choose a program ──────────────────────────── */}
          <div
            className="p-6"
            style={{
              borderRadius: "16px",
              background: "#ffffff",
              border: "1px solid rgba(56,143,166,0.14)",
              boxShadow: "0 2px 16px rgba(43,64,68,0.05)",
            }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-widest mb-4"
              style={{ color: "#388fa6", letterSpacing: "0.14em" }}
            >
              1 · Choose a program
            </p>
            <div className="space-y-2.5">
              {PROGRAMS.map((prog) => (
                <div
                  key={prog.name}
                  className="flex items-center gap-3 p-3.5"
                  style={{
                    borderRadius: "10px",
                    border: prog.selected
                      ? "1.5px solid #388fa6"
                      : "1px solid rgba(43,64,68,0.09)",
                    background: prog.selected
                      ? "rgba(56,143,166,0.06)"
                      : "#fafbfc",
                  }}
                >
                  {/* Selection indicator */}
                  <div
                    className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
                    style={{
                      border: prog.selected
                        ? "1.5px solid #388fa6"
                        : "1.5px solid rgba(43,64,68,0.20)",
                      background: prog.selected ? "#388fa6" : "transparent",
                    }}
                  >
                    {prog.selected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>

                  {/* Program chip + desc */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="text-[10px] font-semibold text-white px-2 py-0.5"
                        style={{ borderRadius: "4px", background: prog.chip }}
                      >
                        {prog.name}
                      </span>
                    </div>
                    <p
                      className="text-xs"
                      style={{ color: "rgba(43,64,68,0.50)" }}
                    >
                      {prog.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: gap analysis or choose a credit ─────────── */}
          <div
            className="p-6"
            style={{
              borderRadius: "16px",
              background: "#ffffff",
              border: "1px solid rgba(56,143,166,0.14)",
              boxShadow: "0 2px 16px rgba(43,64,68,0.05)",
            }}
          >
            {/* Gap analysis option */}
            <p
              className="text-[10px] font-bold uppercase tracking-widest mb-3"
              style={{ color: "#388fa6", letterSpacing: "0.14em" }}
            >
              2 · Gap analysis · Recommended
            </p>
            <div
              className="flex items-center justify-between gap-3 px-3.5 py-3 mb-5"
              style={{
                borderRadius: "10px",
                border: "1.5px solid rgba(56,143,166,0.30)",
                background: "rgba(56,143,166,0.04)",
              }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: "#2b4044" }}>LEED Gap Analysis</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(43,64,68,0.50)" }}>Full certification strategy + prioritized credit roadmap</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-semibold block" style={{ color: "#2b4044" }}>$499</span>
                <span className="text-[9px]" style={{ color: "#9aafb4" }}>pilot price</span>
              </div>
            </div>

            {/* "or" divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: "rgba(43,64,68,0.10)" }} />
              <span className="text-xs font-medium" style={{ color: "rgba(43,64,68,0.35)" }}>or</span>
              <div className="flex-1 h-px" style={{ background: "rgba(43,64,68,0.10)" }} />
            </div>

            <div className="flex items-center justify-between mb-4">
              <p
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "#388fa6", letterSpacing: "0.14em" }}
              >
                Choose a credit
              </p>
              <span
                className="text-[10px] font-semibold text-white px-2 py-0.5"
                style={{ borderRadius: "4px", background: "#388fa6" }}
              >
                LEED BD+C v4.1
              </span>
            </div>

            <div className="space-y-2">
              {PREVIEW_CREDITS.map((credit, i) => (
                <div
                  key={credit.code}
                  className="flex items-center justify-between gap-3 px-3.5 py-3"
                  style={{
                    borderRadius: "10px",
                    border: "1px solid rgba(43,64,68,0.09)",
                    background: i === 0 ? "rgba(56,143,166,0.04)" : "#fafbfc",
                  }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className="text-[10px] font-semibold"
                        style={{ color: "rgba(43,64,68,0.40)" }}
                      >
                        {credit.code}
                      </span>
                      <span style={{ color: "rgba(43,64,68,0.20)", fontSize: "10px" }}>·</span>
                      <span
                        className="text-[10px]"
                        style={{ color: "rgba(43,64,68,0.40)" }}
                      >
                        {credit.category}
                      </span>
                    </div>
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: "#2b4044" }}
                    >
                      {credit.name}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <span
                        className="text-sm font-semibold block"
                        style={{ color: "#2b4044" }}
                      >
                        ${credit.price}
                      </span>
                      <span className="text-[9px]" style={{ color: "#9aafb4" }}>pilot price</span>
                    </div>
                  </div>
                </div>
              ))}

              {/* More credits hint */}
              <p
                className="text-xs text-center pt-1"
                style={{ color: "rgba(43,64,68,0.35)" }}
              >
                + 190 more credits &amp; features across all programs
              </p>
            </div>
          </div>
        </div>

        {/* Pilot pricing + no subscriptions callout */}
        <div
          className="text-center py-5 px-6"
          style={{
            borderRadius: "12px",
            background: "rgba(56,143,166,0.06)",
            border: "1px solid rgba(56,143,166,0.15)",
          }}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: "#1c5e70" }}
          >
            Pilot pricing locked in for your project. No subscriptions.
          </p>
          <p
            className="text-xs mt-1"
            style={{ color: "#6b7e82" }}
          >
            Place your first order and every credit for that project stays at today&apos;s pilot price. Pay per credit, nothing to cancel.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Programs Band ────────────────────────────────────────────────────────────

function ProgramVennGraphic() {
  const programs = [
    { name: "LEED BD+C v4.1",            sub: "New construction & major renovation",      color: "#a3bfa1" },
    { name: "WELL v2",                    sub: "Health & wellbeing in the built environment", color: "#7ab8c7" },
    { name: "WELL Health-Safety Rating",  sub: "Operational policies for health & safety",   color: "#c4a882" },
  ];
  return (
    <div className="w-full" style={{ maxWidth: "380px" }}>
      <div className="flex flex-col gap-4">
        {programs.map((p) => (
          <div
            key={p.name}
            className="flex items-center gap-4 px-5 py-4 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.12)", border: "1.5px solid rgba(255,255,255,0.20)" }}
          >
            <div
              className="shrink-0 rounded-full"
              style={{ width: "14px", height: "14px", background: p.color }}
            />
            <div>
              <p className="text-sm font-semibold" style={{ color: "#ffffff" }}>{p.name}</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.60)" }}>{p.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgramsBand() {
  return (
    <section
      className="py-24 lg:py-32"
      style={{
        background: "linear-gradient(135deg, #388fa6 0%, #1c5e70 100%)",
      }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left — copy */}
          <div>
            <p
              className="text-xs font-semibold uppercase mb-5"
              style={{ color: "rgba(163,212,224,0.85)", letterSpacing: "0.12em" }}
            >
              Certification programs
            </p>
            <h2
              className="mb-5 leading-tight"
              style={{
                fontFamily: "var(--font-dm-serif)",
                fontSize: "clamp(28px, 4vw, 38px)",
                color: "#ffffff",
              }}
            >
              Three Programs Offered
              <span style={{ fontSize: "0.55em", verticalAlign: "super", fontFamily: "var(--font-dm-sans)", fontWeight: 400 }}>*</span>
            </h2>
            <p
              className="mb-3 text-base leading-relaxed"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              Process any credit or feature individually and track your progress in the project management dashboard.
            </p>
            <p
              className="mb-8 text-xs"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              * We are actively working on adding more programs. Please let us know what programs you&apos;d like to see added.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center text-sm font-semibold transition-opacity hover:opacity-90 px-7 py-3"
              style={{
                borderRadius: "100px",
                background: "#FFFFFF",
                color: "#1c5e70",
              }}
            >
              Explore all programs
            </Link>
          </div>

          {/* Right — Venn graphic */}
          <div className="flex items-center justify-center">
            <ProgramVennGraphic />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <TrustBand />
        <HowItWorksBand />
        <ChooseCreditBand />
        <ProgramsBand />

        {/* ── Our Background ──────────────────────────────────────── */}
        <section
          className="py-24 lg:py-32"
          style={{ background: "linear-gradient(180deg, #f9f5ef 0%, #ffffff 100%)" }}
        >
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <span
              className="inline-block text-xs font-bold tracking-widest uppercase mb-5"
              style={{ color: "#388fa6", letterSpacing: "0.14em" }}
            >
              Our Background
            </span>
            <h2
              className="mb-8 leading-tight"
              style={{
                fontFamily: "var(--font-dm-serif)",
                fontSize: "clamp(24px, 3.5vw, 34px)",
                color: "#2b4044",
              }}
            >
              Decades of certification experience, distilled into a platform.
            </h2>
            <div className="space-y-5 text-base leading-relaxed" style={{ color: "#6b7e82" }}>
              <p>
                This platform was built by practitioners, not theorists. Our team has guided thousands of building certifications across commercial office, hospitality, mixed-use, and beyond. We have contributed directly to the development of LEED, WELL, and other programs through our work with USGBC, IWBI, BRE and others.
              </p>
              <p>
                Every element of this platform reflects that experience. The way documents are scoped to the way outputs are structured, these decisions come from years of doing this work ourselves. We built this automation to sharpen our own process, then made it available to you.
              </p>
            </div>
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
              Ready to try it on a real credit?
            </h2>
            <p className="mb-8 text-base leading-relaxed" style={{ color: "#6b7e82" }}>
              Join the pilot program and get your first LEED or WELL credit documentation package at introductory pricing.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 px-8 py-3.5"
              style={{
                background: "linear-gradient(135deg, #388fa6, #1c5e70)",
                borderRadius: "100px",
              }}
            >
              Join the pilot
            </Link>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
