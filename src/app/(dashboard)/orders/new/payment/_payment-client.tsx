"use client";

import { useState } from "react";
import { ShieldCheck, Lock, CheckCircle2 } from "lucide-react";
import StepProgress from "@/components/ui/StepProgress";

const STEPS = ["Program", "Credit", "Details", "Documents", "Payment"];

interface Props {
  creditId:    string;
  creditName:  string;
  creditCode:  string;
  category:    string;
  price:       number; // in cents
  projectId?:  string;
  isGapAnalysis?: boolean;
}

export default function PaymentClient({
  creditId, creditName, creditCode, category, price, projectId, isGapAnalysis,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const displayPrice = isGapAnalysis ? 499 : Math.round(price / 100);
  const label        = isGapAnalysis ? "Gap Analysis" : creditName;

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credit_id:       isGapAnalysis ? undefined : creditId,
          is_gap_analysis: isGapAnalysis || undefined,
          project_id:      projectId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = typeof data?.error === "string"
          ? data.error
          : (data?.error?.message ?? JSON.stringify(data?.error) ?? "Failed to create checkout session");
        throw new Error(errMsg);
      }
      window.location.href = data.url;
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <StepProgress steps={STEPS} current={4} />
        </div>

        <h1 className="font-serif text-3xl text-certify-deep mb-8">Payment</h1>

        {/* Order summary */}
        <div className="bg-white border border-certify-white rounded-2xl shadow-card p-5 mb-5">
          <h3 className="font-semibold text-certify-deep text-sm mb-3">Order summary</h3>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-certify-dark-grey">{label}</span>
            <span className="font-semibold text-certify-deep">${displayPrice.toFixed(0)}</span>
          </div>
          {!isGapAnalysis && (
            <div className="flex items-center justify-between text-xs text-certify-cool-grey mb-3">
              <span>{creditCode} · {category}</span>
            </div>
          )}
          <div className="border-t border-certify-white pt-3 flex items-center justify-between">
            <span className="font-semibold text-certify-deep">Total</span>
            <span className="font-serif text-xl text-certify-deep">${displayPrice.toFixed(0)}</span>
          </div>
        </div>

        {/* Pilot pricing note */}
        <div className="flex items-start gap-2 bg-certify-sage/12 border border-certify-sage/25 rounded-xl px-4 py-3 mb-5">
          <CheckCircle2 size={13} className="text-certify-teal shrink-0 mt-0.5" />
          <p className="text-xs text-certify-teal leading-relaxed">
            Pilot pricing — this is the discounted rate for early-access participants. Pricing will increase at public launch.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* Pay button */}
        <button
          onClick={handlePay}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-certify-blue hover:bg-certify-teal text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-50 shadow-md mb-5"
        >
          {loading ? (
            <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Redirecting to checkout…</>
          ) : (
            <><Lock size={14} /> Pay ${displayPrice.toFixed(0)} with Stripe</>
          )}
        </button>

        {/* Security note */}
        <div className="flex items-center justify-center gap-2 text-xs text-certify-cool-grey">
          <ShieldCheck size={13} />
          <span>Payments processed securely by Stripe. We never store your card details.</span>
        </div>
      </div>
    </div>
  );
}
