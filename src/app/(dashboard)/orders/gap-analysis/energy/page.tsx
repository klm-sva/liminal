"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, ArrowRight } from "lucide-react";

const SAVINGS_OPTIONS = ["Not yet modelled", "< 5%", "5–10%", "11–20%", "21–30%", "31–40%", "41–50%", "> 50%"];
const RENEWABLES_OPTIONS = ["None", "< 5% of total energy", "5–25%", "25–50%", "> 50%", "Net zero / 100% renewable"];

export default function GapAnalysisEnergyPage() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [savings,     setSavings]     = useState("");
  const [renewables,  setRenewables]  = useState("");

  function handleContinue() {
    router.push("/orders/new/payment?type=gap-analysis&price=49900");
  }

  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Link href="/orders/gap-analysis/documents" className="text-xs text-certify-cool-grey hover:text-certify-blue mb-6 inline-flex items-center gap-1 transition-colors">
          ← Documents
        </Link>

        <h1 className="font-serif text-3xl text-certify-deep mb-2">Energy model details</h1>
        <p className="text-certify-cool-grey mb-8 leading-relaxed">
          Tell us about your energy approach. This helps us estimate your EA category score more accurately.
        </p>

        <div className="bg-white border border-certify-white rounded-2xl shadow-card p-6 mb-6 space-y-6">
          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-certify-deep/70 uppercase tracking-wider mb-1.5">
              Energy strategy description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the building's primary energy strategy — e.g., high-efficiency HVAC, envelope improvements, lighting controls, on-site solar PV…"
              className="w-full bg-certify-white border border-certify-white focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15 rounded-xl px-4 py-3 text-sm text-certify-deep placeholder-certify-cool-grey/50 outline-none transition-all resize-none"
            />
          </div>

          {/* Savings estimate */}
          <div>
            <label className="block text-xs font-semibold text-certify-deep/70 uppercase tracking-wider mb-1.5">
              Estimated energy cost savings vs. baseline
            </label>
            <select
              value={savings}
              onChange={(e) => setSavings(e.target.value)}
              className="w-full bg-certify-white border border-certify-white focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15 rounded-xl px-4 py-3 text-sm text-certify-deep outline-none transition-all"
            >
              <option value="">Select a range…</option>
              {SAVINGS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>

          {/* Renewables */}
          <div>
            <label className="block text-xs font-semibold text-certify-deep/70 uppercase tracking-wider mb-1.5">
              On-site or off-site renewable energy contribution
            </label>
            <select
              value={renewables}
              onChange={(e) => setRenewables(e.target.value)}
              className="w-full bg-certify-white border border-certify-white focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15 rounded-xl px-4 py-3 text-sm text-certify-deep outline-none transition-all"
            >
              <option value="">Select a range…</option>
              {RENEWABLES_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>

          {/* Teal note */}
          <div className="flex items-start gap-2.5 bg-certify-teal/8 border border-certify-teal/20 rounded-xl px-4 py-3">
            <Info size={14} className="text-certify-teal shrink-0 mt-0.5" />
            <p className="text-xs text-certify-teal leading-relaxed">
              This information is used only to estimate your EA credit score for gap analysis purposes. It does not commit you to any particular energy performance target in your certification application.
            </p>
          </div>
        </div>

        <button
          onClick={handleContinue}
          className="w-full flex items-center justify-center gap-2 bg-certify-blue hover:bg-certify-teal text-white font-semibold py-3.5 rounded-xl transition-all shadow-md group"
        >
          Continue to payment <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
