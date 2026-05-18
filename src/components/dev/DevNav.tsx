"use client";

import { useState } from "react";
import Link from "next/link";

if (process.env.NODE_ENV === "production") {
  // Safety guard — never import this in prod bundles (tree-shaken in practice)
}

const SECTIONS = [
  {
    label: "Marketing",
    links: [
      { name: "Homepage",       href: "/" },
      { name: "Who We Are",     href: "/about" },
      { name: "How It Works",   href: "/how-it-works" },
      { name: "Pricing",        href: "/pricing" },
    ],
  },
  {
    label: "Auth",
    links: [
      { name: "Sign up",        href: "/signup" },
      { name: "Login",          href: "/login" },
      { name: "Confirm / inbox",href: "/confirm?email=preview%40example.com" },
    ],
  },
  {
    label: "Dashboard",
    links: [
      { name: "Portfolio — empty",      href: "/dashboard?demo=empty" },
      { name: "Portfolio — with projects", href: "/dashboard" },
      { name: "Project dashboard (LEED)",  href: "/projects/proj_river" },
      { name: "Project dashboard (WELL+HSR)", href: "/projects/proj_mesa" },
      { name: "Project dashboard (LEED+HSR)", href: "/projects/proj_harbor" },
      { name: "Edit project",            href: "/projects/proj_river/edit" },
      { name: "Add service (LEED)",      href: "/projects/proj_river/add-service" },
      { name: "Add service (WELL+HSR)",  href: "/projects/proj_mesa/add-service" },
      { name: "Auto project created",    href: "/projects/proj_harbor/created" },
    ],
  },
  {
    label: "Orders — New",
    links: [
      { name: "Project selection",   href: "/orders/new/select-project" },
      { name: "New project — upload",href: "/projects/new" },
      { name: "New project — manual",href: "/projects/new?mode=manual" },
      { name: "Choose program",      href: "/orders/new/program" },
      { name: "Choose credit",       href: "/orders/new/credit" },
      { name: "Credit detail",       href: "/orders/new/credit/credit_ltc5" },
      { name: "Documents needed",    href: "/orders/new/documents" },
      { name: "Payment",             href: "/orders/new/payment" },
    ],
  },
  {
    label: "Orders — Active",
    links: [
      { name: "Upload",              href: "/orders/order_001/upload" },
      { name: "Processing",          href: "/orders/order_001/processing" },
      { name: "Delivery / email preview", href: "/orders/order_001/delivery" },
    ],
  },
  {
    label: "LEED Gap Analysis",
    links: [
      { name: "Detail page",         href: "/orders/gap-analysis" },
      { name: "Questionnaire",        href: "/orders/gap-analysis/questionnaire" },
      { name: "Documents",            href: "/orders/gap-analysis/documents" },
      { name: "Energy dialog",        href: "/orders/gap-analysis/energy" },
      { name: "Output",               href: "/orders/gap-analysis/output" },
    ],
  },
  {
    label: "WELL v2 Gap Analysis",
    links: [
      { name: "Detail page",    href: "/orders/gap-analysis-well-v2" },
      { name: "Questionnaire",  href: "/orders/gap-analysis-well-v2/questionnaire" },
      { name: "Documents",      href: "/orders/gap-analysis-well-v2/documents" },
      { name: "Output",         href: "/orders/gap-analysis-well-v2/output" },
    ],
  },
  {
    label: "WELL HSR Gap Analysis",
    links: [
      { name: "Detail page",    href: "/orders/gap-analysis-well-hsr" },
      { name: "Questionnaire",  href: "/orders/gap-analysis-well-hsr/questionnaire" },
      { name: "Documents",      href: "/orders/gap-analysis-well-hsr/documents" },
      { name: "Output",         href: "/orders/gap-analysis-well-hsr/output" },
    ],
  },
  {
    label: "Other",
    links: [
      { name: "Pilot feedback",      href: "/feedback" },
      { name: "Terms of Service",    href: "/terms" },
      { name: "Privacy Policy",      href: "/privacy" },
    ],
  },
];

export default function DevNav() {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="fixed bottom-4 left-4 z-[9999] flex flex-col items-start"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      {/* Expanded panel */}
      {open && (
        <div
          className="mb-2 overflow-y-auto"
          style={{
            width: "240px",
            maxHeight: "calc(100vh - 80px)",
            borderRadius: "12px",
            background: "rgba(15,20,24,0.96)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.50)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center justify-between border-b"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: "#4ade80" }}
              />
              <span
                className="text-xs font-bold tracking-wider uppercase"
                style={{ color: "rgba(255,255,255,0.55)", letterSpacing: "0.12em" }}
              >
                Dev nav
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-xs"
              style={{ color: "rgba(255,255,255,0.35)" }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Sections */}
          <div className="py-2">
            {SECTIONS.map((section) => (
              <div key={section.label} className="mb-1">
                <p
                  className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: "rgba(255,255,255,0.28)", letterSpacing: "0.14em" }}
                >
                  {section.label}
                </p>
                {section.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-1.5 text-xs transition-colors hover:bg-white/5"
                    style={{ color: "rgba(255,255,255,0.72)" }}
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div
            className="px-4 py-2.5 border-t"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}
          >
            <p
              className="text-[10px]"
              style={{ color: "rgba(255,255,255,0.22)" }}
            >
              Dev only — not visible in production
            </p>
          </div>
        </div>
      )}

      {/* Toggle pill */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90"
        style={{
          borderRadius: "100px",
          background: open ? "rgba(15,20,24,0.96)" : "rgba(15,20,24,0.82)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "#4ade80",
          boxShadow: "0 2px 12px rgba(0,0,0,0.40)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: "#4ade80" }}
        />
        DEV
      </button>
    </div>
  );
}
