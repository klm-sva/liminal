import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";

export const metadata: Metadata = { title: "How It Works — LIMINALsva" };

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: "1",
    title: "Choose a credit and see what's required",
    body: "Every credit shows a clear description of what the platform produces and what you need to provide, before you pay.",
  },
  {
    n: "2",
    title: "Payment unlocks your upload link",
    body: "After payment you receive a secure, private upload link for that order. Upload the documents listed for that credit.",
  },
  {
    n: "3",
    title: "If anything is missing we contact you first",
    body: "If your information is incomplete or unclear we email you before processing, not after.",
  },
  {
    n: "4",
    title: "Output arrives by email",
    body: "Editable output files attached, plus a link to your dashboard. Your documents are automatically deleted.",
  },
  {
    n: "5",
    title: "Review",
    body: "Review outputs and use them for certification submittal (edit drafts if needed, transfer credit form information, submit calculators, etc.). You also have the option of running the analysis a second time (you receive two runs per order).",
  },
  {
    n: "6",
    title: "We can navigate the entire process for you (optional)",
    body: "Hire us to help organize your certification submittal, submit your documentation and interact with the reviewer (this last step can be extensive). Contact us for options.",
  },
];

// ─── Choose Credit (mirrored from homepage) ───────────────────────────────────

const PROGRAMS = [
  { name: "LEED BD+C v4.1",           chip: "#388fa6", desc: "New construction & major renovation",        selected: true  },
  { name: "WELL v2",                   chip: "#5fa8bb", desc: "Health & wellbeing in the built environment", selected: false },
  { name: "WELL Health-Safety Rating", chip: "#c4a882", desc: "Operational policies for health & safety",   selected: false },
];

const PREVIEW_CREDITS = [
  { code: "LTc5", name: "Access to Quality Transit",    category: "Location & Transportation", price: 109 },
  { code: "SSc1", name: "Site Assessment",              category: "Sustainable Sites",         price: 179 },
  { code: "WEc1", name: "Outdoor Water Use Reduction",  category: "Water Efficiency",          price: 109 },
  { code: "EAp2", name: "Minimum Energy Performance",  category: "Energy & Atmosphere",       price: 139 },
];

// ─── Dashboard illustration ───────────────────────────────────────────────────

function DashboardIllustration() {
  const projects = [
    { name: "550 Madison Avenue",      type: "Office",    program: "LEED BD+C v4.1", chipColor: "#388fa6", progress: 68, status: "In progress", gap: true  },
    { name: "Midtown Corporate Center", type: "Mixed-Use", program: "WELL v2",        chipColor: "#5fa8bb", progress: 42, status: "In progress", gap: true  },
    { name: "Harbor Square",           type: "Office",    program: "WELL HSR",       chipColor: "#c4a882", progress: 91, status: "Complete",    gap: false },
  ];

  return (
    <div style={{ borderRadius: "16px", overflow: "hidden", boxShadow: "0 24px 80px rgba(43,64,68,0.22)", border: "1px solid rgba(43,64,68,0.12)", background: "#f4f6f8" }}>
      <div className="px-6 py-5 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #2b4044 0%, #1c5e70 100%)" }}>
        <div>
          <p className="text-xs font-medium" style={{ color: "rgba(163,212,224,0.75)" }}>My Dashboard</p>
          <p className="text-lg font-semibold mt-0.5" style={{ fontFamily: "var(--font-dm-serif)", color: "#ffffff" }}>Portfolio Overview</p>
        </div>
        <div className="text-xs font-semibold px-4 py-2" style={{ borderRadius: "100px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.20)", color: "#ffffff" }}>
          + New order
        </div>
      </div>

      <div className="grid grid-cols-4 border-b" style={{ background: "linear-gradient(135deg, #1c5e70 0%, #2b4044 100%)", borderColor: "rgba(255,255,255,0.08)" }}>
        {[{ label: "Projects", value: "3" }, { label: "Orders", value: "12" }, { label: "Delivered", value: "8" }, { label: "Avg time", value: "48hr" }].map((m, i) => (
          <div key={m.label} className="flex flex-col items-center py-4" style={{ borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
            <span style={{ fontFamily: "var(--font-dm-serif)", fontSize: "22px", color: "#a3d4e0" }}>{m.value}</span>
            <span className="text-xs mt-0.5" style={{ color: "rgba(163,212,224,0.65)" }}>{m.label}</span>
          </div>
        ))}
      </div>

      <div className="p-5 space-y-3">
        {projects.map((proj) => (
          <div key={proj.name} className="p-4 bg-white" style={{ borderRadius: "10px", border: "1px solid rgba(43,64,68,0.08)" }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-white px-2 py-0.5" style={{ borderRadius: "5px", background: proj.chipColor, fontSize: "10px" }}>{proj.program}</span>
                  {proj.gap && <span className="text-xs font-medium px-2 py-0.5" style={{ borderRadius: "5px", background: "rgba(56,143,166,0.10)", color: "#388fa6", border: "1px solid rgba(56,143,166,0.25)", fontSize: "10px" }}>Gap analysis</span>}
                </div>
                <p className="text-sm font-semibold" style={{ color: "#2b4044" }}>{proj.name}</p>
                <p className="text-xs mt-0.5" style={{ color: "#8a9fa5" }}>{proj.type}</p>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 shrink-0" style={{ borderRadius: "100px", background: proj.status === "Complete" ? "rgba(163,191,161,0.15)" : "rgba(56,143,166,0.08)", color: proj.status === "Complete" ? "#3a6b38" : "#388fa6", fontSize: "10px" }}>{proj.status}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5" style={{ borderRadius: "100px", background: "rgba(43,64,68,0.08)" }}>
                <div style={{ height: "100%", borderRadius: "100px", width: `${proj.progress}%`, background: "linear-gradient(90deg, #388fa6, #1c5e70)" }} />
              </div>
              <span className="text-xs font-medium" style={{ color: "#6b7e82", minWidth: "32px" }}>{proj.progress}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HowItWorksPage() {
  return (
    <>
      <Navbar />
      <main>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section
          className="relative flex items-center overflow-hidden"
          style={{ background: "linear-gradient(135deg, #388fa6 0%, #1c5e70 100%)", minHeight: "420px" }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div
            aria-hidden="true"
            className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-15"
            style={{ background: "radial-gradient(circle, #a3d4e0 0%, transparent 70%)", transform: "translate(30%, -30%)" }}
          />
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-28 text-center w-full">
            <span
              className="inline-block text-xs font-bold tracking-widest uppercase mb-6"
              style={{ color: "rgba(163,212,224,0.75)", letterSpacing: "0.14em" }}
            >
              How It Works
            </span>
            <h1
              className="mb-5 leading-tight"
              style={{ fontFamily: "var(--font-dm-serif)", fontSize: "clamp(36px, 6vw, 60px)", color: "#ffffff" }}
            >
              From credit selection to submission-ready output
            </h1>
            <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
              After you choose a credit or gap analysis and upload your documents, LIMINALsva reviews your documents, retrieves supporting data from public databases, generates required maps, provides calculator inputs, prepares data to complete credit forms, drafts any required policy documents, and delivers formatted, editable output ready for certification submittal.
            </p>
            <p className="text-sm max-w-lg mx-auto mt-5 leading-relaxed" style={{ color: "rgba(163,212,224,0.80)" }}>
              LIMINALsva is currently in pilot. Pricing is locked in at today&apos;s rate for your entire project when you place your first order. Prices will increase at launch with plenty of notice.
            </p>
          </div>
        </section>

        {/* ── Steps ────────────────────────────────────────────── */}
        <section className="py-24 lg:py-32" style={{ background: "#ffffff" }}>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative">
              {/* Vertical connector line */}
              <div
                className="absolute left-[27px] top-10 bottom-10 w-px hidden sm:block"
                style={{ background: "rgba(56,143,166,0.18)" }}
              />

              <div className="space-y-10">
                {STEPS.map((step) => (
                  <div key={step.n} className="flex gap-7 items-start">
                    {/* Step number circle */}
                    <div
                      className="shrink-0 w-14 h-14 rounded-full flex items-center justify-center relative z-10"
                      style={{
                        background: "linear-gradient(135deg, #388fa6, #1c5e70)",
                        boxShadow: "0 4px 16px rgba(56,143,166,0.30)",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-dm-serif)",
                          fontSize: "22px",
                          color: "#ffffff",
                          lineHeight: 1,
                        }}
                      >
                        {step.n}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="pt-1 pb-4">
                      <h3
                        className="mb-2 leading-snug"
                        style={{
                          fontFamily: "var(--font-dm-serif)",
                          fontSize: "clamp(18px, 2.5vw, 22px)",
                          color: "#2b4044",
                        }}
                      >
                        {step.title}
                      </h3>
                      <p className="text-base leading-relaxed" style={{ color: "#6b7e82" }}>
                        {step.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Choose Credit (light blue) ────────────────────────── */}
        <section className="py-24 lg:py-28" style={{ background: "#e8f3fa" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

            <div className="text-center mb-12">
              <p className="text-xs font-semibold uppercase mb-4" style={{ color: "#388fa6", letterSpacing: "0.12em" }}>
                Gap analysis or individual credits
              </p>
              <h2
                className="mb-4 leading-tight"
                style={{ fontFamily: "var(--font-dm-serif)", fontSize: "clamp(28px, 4vw, 38px)", color: "#2b4044" }}
              >
                Run a gap analysis for an overall certification strategy or choose one credit at a time and use the included dashboard to manage your projects
              </h2>
              <p className="text-base mx-auto" style={{ color: "#6b7e82", maxWidth: "400px" }}>
                Order exactly what you need. Each credit is priced individually and the dashboard management tool is free.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">

              {/* Left: choose a program */}
              <div className="p-6" style={{ borderRadius: "16px", background: "#ffffff", border: "1px solid rgba(56,143,166,0.14)", boxShadow: "0 2px 16px rgba(43,64,68,0.05)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: "#388fa6", letterSpacing: "0.14em" }}>
                  1 · Choose a program
                </p>
                <div className="space-y-2.5">
                  {PROGRAMS.map((prog) => (
                    <div
                      key={prog.name}
                      className="flex items-center gap-3 p-3.5"
                      style={{
                        borderRadius: "10px",
                        border: prog.selected ? "1.5px solid #388fa6" : "1px solid rgba(43,64,68,0.09)",
                        background: prog.selected ? "rgba(56,143,166,0.06)" : "#fafbfc",
                      }}
                    >
                      <div
                        className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
                        style={{ border: prog.selected ? "1.5px solid #388fa6" : "1.5px solid rgba(43,64,68,0.20)", background: prog.selected ? "#388fa6" : "transparent" }}
                      >
                        {prog.selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-semibold text-white px-2 py-0.5" style={{ borderRadius: "4px", background: prog.chip }}>
                            {prog.name}
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: "rgba(43,64,68,0.50)" }}>{prog.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: gap analysis or choose a credit */}
              <div className="p-6" style={{ borderRadius: "16px", background: "#ffffff", border: "1px solid rgba(56,143,166,0.14)", boxShadow: "0 2px 16px rgba(43,64,68,0.05)" }}>

                {/* Gap analysis option */}
                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#388fa6", letterSpacing: "0.14em" }}>
                  2 · Gap analysis · Recommended
                </p>
                <div
                  className="flex items-center justify-between gap-3 px-3.5 py-3 mb-5"
                  style={{ borderRadius: "10px", border: "1.5px solid rgba(56,143,166,0.30)", background: "rgba(56,143,166,0.04)" }}
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
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#388fa6", letterSpacing: "0.14em" }}>
                    Choose a credit
                  </p>
                  <span className="text-[10px] font-semibold text-white px-2 py-0.5" style={{ borderRadius: "4px", background: "#388fa6" }}>
                    LEED BD+C v4.1
                  </span>
                </div>
                <div className="space-y-2">
                  {PREVIEW_CREDITS.map((credit, i) => (
                    <div
                      key={credit.code}
                      className="flex items-center justify-between gap-3 px-3.5 py-3"
                      style={{ borderRadius: "10px", border: "1px solid rgba(43,64,68,0.09)", background: i === 0 ? "rgba(56,143,166,0.04)" : "#fafbfc" }}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-semibold" style={{ color: "rgba(43,64,68,0.40)" }}>{credit.code}</span>
                          <span style={{ color: "rgba(43,64,68,0.20)", fontSize: "10px" }}>·</span>
                          <span className="text-[10px]" style={{ color: "rgba(43,64,68,0.40)" }}>{credit.category}</span>
                        </div>
                        <p className="text-sm font-medium truncate" style={{ color: "#2b4044" }}>{credit.name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold" style={{ color: "#2b4044" }}>${credit.price}</span>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-center pt-1" style={{ color: "rgba(43,64,68,0.35)" }}>
                    + 190 more credits &amp; features across all programs
                  </p>
                </div>
              </div>
            </div>

            {/* Pricing callout */}
            <div
              className="text-center py-5 px-6"
              style={{ borderRadius: "12px", background: "rgba(56,143,166,0.06)", border: "1px solid rgba(56,143,166,0.15)" }}
            >
              <p className="text-sm font-semibold" style={{ color: "#1c5e70" }}>Pilot pricing locked in for your project. No subscriptions.</p>
              <p className="text-xs mt-1" style={{ color: "#6b7e82" }}>Place your first order and every credit for that project stays at today&apos;s pilot price. Pay per credit, nothing to cancel.</p>
            </div>
          </div>
        </section>

        {/* ── Dashboard preview ─────────────────────────────────── */}
        <section className="py-24 lg:py-32" style={{ background: "#f0f7fa" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#388fa6", letterSpacing: "0.14em" }}>
                Your Dashboard
              </p>
              <h2
                className="mb-4 leading-tight"
                style={{ fontFamily: "var(--font-dm-serif)", fontSize: "clamp(26px, 4vw, 38px)", color: "#2b4044" }}
              >
                Your project, fully organized.
              </h2>
              <p className="text-base mx-auto" style={{ color: "#6b7e82", maxWidth: "420px" }}>
                Every credit or feature, every output, every run, tracked in your personal dashboard.
              </p>
            </div>
            <DashboardIllustration />
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <section className="py-24" style={{ background: "#ffffff" }}>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <span
                className="inline-block text-xs font-bold tracking-widest uppercase mb-4"
                style={{ color: "#388fa6", letterSpacing: "0.14em" }}
              >
                Questions
              </span>
              <h2 style={{ fontFamily: "var(--font-dm-serif)", fontSize: "clamp(24px, 3.5vw, 34px)", color: "#2b4044" }}>
                Common questions about the process.
              </h2>
            </div>
            <div className="space-y-5">
              {[
                { q: "How long does processing take?",       a: "Most credits process in under 48 hours." },
                { q: "What if I want to run the output again?", a: "Pilot participants receive discounted rates on a second run." },
                { q: "Are my documents stored permanently?", a: "No. Customer uploads are permanently deleted after your output is delivered. Output files remain in your account until you delete them." },
{ q: "Do I need to buy a whole program at once?", a: "No. You buy individual credits as you need them. No bundle requirement, no minimum order." },
              ].map((item) => (
                <div key={item.q} className="p-6 bg-white" style={{ borderRadius: "12px", border: "1px solid rgba(43,64,68,0.10)", boxShadow: "0 1px 4px rgba(43,64,68,0.04)" }}>
                  <p className="text-base font-semibold mb-2" style={{ fontFamily: "var(--font-dm-serif)", color: "#2b4044" }}>{item.q}</p>
                  <p className="text-sm leading-relaxed" style={{ color: "#6b7e82" }}>{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────── */}
        <section className="py-24 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #388fa6 0%, #1c5e70 100%)" }}>
          <div className="max-w-2xl mx-auto px-4 text-center">
            <h2
              className="mb-4"
              style={{ fontFamily: "var(--font-dm-serif)", fontSize: "clamp(26px, 4vw, 38px)", color: "#ffffff" }}
            >
              Start with one credit.
            </h2>
            <p className="mb-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.62)" }}>
              Pick any LEED or WELL credit, upload the required documents, and have submission-ready documentation in your inbox within the hour.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 px-8 py-3.5"
              style={{ background: "rgba(255,255,255,0.15)", borderRadius: "100px", border: "1.5px solid rgba(255,255,255,0.35)" }}
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
