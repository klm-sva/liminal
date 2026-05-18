"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ShieldCheck, Lock, CheckCircle2 } from "lucide-react";
import StepProgress from "@/components/ui/StepProgress";
import { MOCK_CREDITS } from "@/lib/mock-data";

const STEPS = ["Program", "Credit", "Details", "Documents", "Payment"];

function PaymentForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const creditId     = searchParams.get("credit_id") ?? "";
  const isGapAnalysis = searchParams.get("type") === "gap-analysis";

  const credit = isGapAnalysis ? null : MOCK_CREDITS.find((c) => c.id === creditId);
  const price  = isGapAnalysis ? 499 : Math.round((credit?.price ?? 9700) / 100);
  const label  = isGapAnalysis ? "Gap Analysis" : (credit?.credit_name ?? "");

  const [card,     setCard]    = useState("");
  const [expiry,   setExpiry]  = useState("");
  const [cvc,      setCvc]     = useState("");
  const [name,     setName]    = useState("");
  const [paying,   setPaying]  = useState(false);
  const [coupon,   setCoupon]  = useState("");
  const [couponApplied, setCouponApplied] = useState(false);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    setPaying(true);
    await new Promise((r) => setTimeout(r, 1600));
    // Simulate created order
    const orderId = "order_new_001";
    if (isGapAnalysis) {
      router.push(`/orders/${orderId}/upload?type=gap-analysis`);
    } else {
      router.push(`/orders/${orderId}/upload?credit_id=${creditId}`);
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
            <span className="font-semibold text-certify-deep">${price.toFixed(0)}</span>
          </div>
          {credit && (
            <div className="flex items-center justify-between text-xs text-certify-cool-grey mb-3">
              <span>{credit.credit_code} · {credit.category}</span>
            </div>
          )}
          <div className="border-t border-certify-white pt-3 flex items-center justify-between">
            <span className="font-semibold text-certify-deep">Total</span>
            <span className="font-serif text-xl text-certify-deep">${price.toFixed(0)}</span>
          </div>
        </div>

        {/* Pilot pricing note */}
        <div className="flex items-start gap-2 bg-certify-sage/12 border border-certify-sage/25 rounded-xl px-4 py-3 mb-5">
          <CheckCircle2 size={13} className="text-certify-teal shrink-0 mt-0.5" />
          <p className="text-xs text-certify-teal leading-relaxed">
            Pilot pricing — this is the discounted rate for early-access participants. Pricing will increase at public launch.
          </p>
        </div>

        {/* Coupon code */}
        <div className="bg-white border border-certify-white rounded-2xl shadow-card p-5 mb-5">
          <h3 className="font-semibold text-certify-deep text-sm mb-3">Coupon code</h3>
          <div className="flex gap-2">
            <input
              value={coupon}
              onChange={(e) => { setCoupon(e.target.value); setCouponApplied(false); }}
              placeholder="Enter code"
              className="flex-1 bg-certify-white border border-certify-white rounded-xl px-4 py-3 text-sm text-certify-deep placeholder:text-certify-cool-grey/50 outline-none transition-all focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15"
            />
            <button
              type="button"
              onClick={() => { if (coupon.trim()) setCouponApplied(true); }}
              className="px-5 py-3 rounded-xl bg-certify-beige border border-certify-sand/40 text-sm font-semibold text-certify-deep hover:bg-certify-sand/30 transition-colors"
            >
              Apply
            </button>
          </div>
          {couponApplied && (
            <p className="mt-2 text-xs text-certify-teal font-medium">Code applied — discount will be reflected at launch.</p>
          )}
        </div>

        {/* Card form */}
        <form onSubmit={handlePay} className="bg-white border border-certify-white rounded-2xl shadow-card p-6 mb-5 space-y-4">
          <h3 className="font-semibold text-certify-deep text-sm">Card details</h3>

          <div>
            <label className="block text-xs font-semibold text-certify-deep/70 uppercase tracking-wider mb-1.5">Name on card</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              required
              className="block w-full bg-certify-white border border-certify-white rounded-xl px-4 py-3 text-sm text-certify-deep placeholder:text-certify-cool-grey/50 outline-none transition-all focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-certify-deep/70 uppercase tracking-wider mb-1.5">Card number</label>
            <div className="relative">
              <input
                value={card}
                onChange={(e) => setCard(e.target.value.replace(/\D/g, "").slice(0, 16))}
                placeholder="1234 5678 9012 3456"
                required
                className="input-style pr-10"
              />
              <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-certify-cool-grey/40" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-certify-deep/70 uppercase tracking-wider mb-1.5">Expiry</label>
              <input value={expiry} onChange={(e) => setExpiry(e.target.value)} placeholder="MM / YY" required className="block w-full bg-certify-white border border-certify-white rounded-xl px-4 py-3 text-sm text-certify-deep placeholder:text-certify-cool-grey/50 outline-none transition-all focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-certify-deep/70 uppercase tracking-wider mb-1.5">CVC</label>
              <input value={cvc} onChange={(e) => setCvc(e.target.value.slice(0, 4))} placeholder="•••" required className="block w-full bg-certify-white border border-certify-white rounded-xl px-4 py-3 text-sm text-certify-deep placeholder:text-certify-cool-grey/50 outline-none transition-all focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15" />
            </div>
          </div>

          <button
            type="submit"
            disabled={paying}
            className="w-full flex items-center justify-center gap-2 bg-certify-blue hover:bg-certify-teal text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-50 shadow-md"
          >
            {paying ? (
              <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Processing…</>
            ) : (
              <><Lock size={14} /> Pay ${price.toFixed(0)} and continue</>
            )}
          </button>
        </form>

        {/* Security note */}
        <div className="flex items-center justify-center gap-2 text-xs text-certify-cool-grey">
          <ShieldCheck size={13} />
          <span>Payments processed securely by Stripe. We never store your card details.</span>
        </div>
      </div>

    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-certify-white flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-certify-blue border-t-transparent rounded-full" /></div>}>
      <PaymentForm />
    </Suspense>
  );
}
