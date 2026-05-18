import type { Metadata } from "next";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";
import AboutHeroSection from "@/components/marketing/AboutHeroSection";
import Link from "next/link";

export const metadata: Metadata = { title: "Who We Are — Liminal" };

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main>

        <AboutHeroSection />

        {/* ── Our Background ────────────────────────────────────────────── */}
        <section
          className="py-24 lg:py-32"
          style={{
            background: "linear-gradient(180deg, #f9f5ef 0%, #ffffff 100%)",
          }}
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

        {/* ── CTA ──────────────────────────────────────────────────────── */}
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
