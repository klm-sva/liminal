"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPin, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

type CheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available" }
  | { status: "unavailable" }
  | { status: "address_required" }
  | { status: "error" };

export default function TransitAvailabilityGate({
  projectId,
  continueHref,
  price,
}: {
  projectId: string;
  continueHref: string;
  price: number;
}) {
  const [state, setState] = useState<CheckState>({ status: "idle" });

  async function runCheck() {
    setState({ status: "checking" });
    try {
      const res = await fetch(`/api/projects/${projectId}/transit-availability`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setState({ status: "error" }); return; }
      if (data.status === "available")        setState({ status: "available" });
      else if (data.status === "address_required") setState({ status: "address_required" });
      else                                     setState({ status: "unavailable" });
    } catch {
      setState({ status: "error" });
    }
  }

  const canContinue = state.status === "available";

  return (
    <>
      {/* Transit data availability check */}
      <div className="bg-white border border-certify-white rounded-2xl shadow-card p-5 mb-4">
        <p className="text-xs font-bold text-certify-deep/70 uppercase tracking-wider mb-1">Transit data availability</p>
        <p className="text-xs text-certify-cool-grey leading-relaxed mb-3">
          This credit relies on live transit provider data. Check availability for your project&apos;s location before purchasing.
        </p>

        {state.status === "idle" && (
          <button
            type="button"
            onClick={runCheck}
            className="inline-flex items-center gap-1.5 bg-certify-deep hover:bg-certify-navy text-white font-semibold px-4 py-2 rounded-xl transition-colors text-sm"
          >
            <MapPin size={14} /> Check availability
          </button>
        )}

        {state.status === "checking" && (
          <div className="inline-flex items-center gap-2 text-sm text-certify-cool-grey">
            <Loader2 size={14} className="animate-spin" /> Checking transit data…
          </div>
        )}

        {state.status === "available" && (
          <div className="flex items-start gap-2 text-sm text-certify-teal">
            <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
            <span>Transit data is available for this location. You can continue.</span>
          </div>
        )}

        {state.status === "unavailable" && (
          <div>
            <div className="flex items-start gap-2 text-sm text-red-700 mb-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>The platform is unable to process this due to insufficient, unavailable, or outdated data from the transit providers.</span>
            </div>
            <button type="button" onClick={runCheck} className="text-xs text-certify-blue hover:underline font-medium">
              Check again
            </button>
          </div>
        )}

        {state.status === "address_required" && (
          <div className="flex items-start gap-2 text-sm text-certify-dark-grey">
            <AlertTriangle size={15} className="shrink-0 mt-0.5 text-certify-sand" />
            <span>
              This project doesn&apos;t have an address yet.{" "}
              <Link href={`/projects/${projectId}/edit`} className="text-certify-blue hover:underline font-medium">
                Add one
              </Link>{" "}
              before checking availability.
            </span>
          </div>
        )}

        {state.status === "error" && (
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle size={15} className="shrink-0" />
            <span>Something went wrong.</span>
            <button type="button" onClick={runCheck} className="underline font-medium">Try again</button>
          </div>
        )}
      </div>

      {/* Price + CTA */}
      <div className="flex items-center justify-between bg-certify-beige border border-certify-sand/40 rounded-xl px-5 py-4 mb-4">
        <div>
          <p className="font-serif text-2xl text-certify-deep">${(price / 100).toFixed(0)}</p>
          <p className="text-xs text-certify-cool-grey">per credit order · pilot price</p>
        </div>
        {canContinue ? (
          <Link
            href={continueHref}
            className="inline-flex items-center gap-1.5 bg-certify-blue hover:bg-certify-teal text-white font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-md text-sm group"
          >
            Continue <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 bg-certify-cool-grey/20 text-certify-cool-grey font-semibold px-5 py-2.5 rounded-xl text-sm cursor-not-allowed"
            title="Check transit data availability first"
          >
            Continue <ArrowRight size={14} />
          </span>
        )}
      </div>
    </>
  );
}
