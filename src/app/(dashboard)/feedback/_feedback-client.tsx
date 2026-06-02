"use client";

import { useState } from "react";
import { CheckCircle2, MessageSquare } from "lucide-react";

interface OrderOption {
  id:          string;
  credit_code: string;
  credit_name: string;
  category:    string;
}

export default function FeedbackClient({ orders }: { orders: OrderOption[] }) {
  const firstId = orders[0]?.id ?? "";
  const [orderId,       setOrderId]       = useState(firstId);
  const [useful,        setUseful]        = useState<"yes" | "somewhat" | "no" | null>(null);
  const [wouldUseAgain, setWouldUseAgain] = useState<"yes" | "maybe" | "no" | null>(null);
  const [whatWorked,    setWhatWorked]    = useState("");
  const [whatToImprove, setWhatToImprove] = useState("");
  const [submitted,     setSubmitted]     = useState(false);
  const [submitting,    setSubmitting]    = useState(false);

  const selectedOrder = orders.find((o) => o.id === orderId) ?? orders[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1000));
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-certify-white flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="flex justify-center mb-5">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="30" stroke="#a3bfa1" strokeWidth="2.5" fill="none" />
              <path d="M20 33l9 9 15-18" stroke="#a3bfa1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="font-serif text-2xl text-certify-deep mb-2">Thanks for your feedback</h2>
          <p className="text-sm text-certify-cool-grey leading-relaxed">
            Your input directly shapes how we improve LIMINALsva. We read every response.
          </p>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-certify-white flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h2 className="font-serif text-2xl text-certify-deep mb-2">No completed orders yet</h2>
          <p className="text-sm text-certify-cool-grey">Place an order and receive your output before leaving feedback.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* Pilot feedback banner */}
        <div className="flex items-start gap-2.5 bg-certify-sand/20 border border-certify-sand/50 rounded-xl px-4 py-3 mb-8">
          <MessageSquare size={14} className="text-certify-dark-grey shrink-0 mt-0.5" />
          <p className="text-xs text-certify-dark-grey leading-relaxed">
            <strong>Pilot feedback.</strong> LIMINALsva is in early access. Your honest input helps us improve output quality, user experience, and document accuracy before public launch. This takes about 2 minutes.
          </p>
        </div>

        <h1 className="font-serif text-3xl text-certify-deep mb-1">Share your feedback</h1>
        <p className="text-certify-cool-grey text-sm mb-8">Tell us how your order went</p>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Order selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-certify-deep/70 mb-2">Which order are you reviewing?</label>
            <select
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="w-full bg-certify-white border border-certify-cool-grey/20 rounded-xl px-4 py-3 text-sm text-certify-deep focus:outline-none focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15 transition-all"
            >
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.id.slice(-6).toUpperCase()}: {o.credit_code} {o.credit_name}
                </option>
              ))}
            </select>
            {selectedOrder && (
              <p className="text-xs text-certify-cool-grey mt-1.5 ml-1">{selectedOrder.credit_code} · {selectedOrder.category}</p>
            )}
          </div>

          {/* Was it useful */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-certify-deep/70 mb-2">Was the output useful?</label>
            <div className="flex gap-2">
              {(["yes", "somewhat", "no"] as const).map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setUseful(val)}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    useful === val
                      ? "bg-certify-blue text-white border-certify-blue"
                      : "bg-white text-certify-dark-grey border-certify-cool-grey/20 hover:border-certify-blue/30"
                  }`}
                >
                  {val === "yes" ? "Yes" : val === "somewhat" ? "Somewhat" : "Not really"}
                </button>
              ))}
            </div>
          </div>

          {/* What worked */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-certify-deep/70 mb-2">What worked well?</label>
            <textarea
              value={whatWorked}
              onChange={(e) => setWhatWorked(e.target.value)}
              placeholder="e.g. The narrative structure was spot-on, the LEED form answers saved me hours…"
              rows={3}
              className="w-full bg-certify-white border border-certify-cool-grey/20 rounded-xl px-4 py-3 text-sm text-certify-deep placeholder:text-certify-cool-grey/50 focus:outline-none focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15 transition-all resize-none"
            />
          </div>

          {/* What could be improved */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-certify-deep/70 mb-2">What could be improved?</label>
            <textarea
              value={whatToImprove}
              onChange={(e) => setWhatToImprove(e.target.value)}
              placeholder="e.g. The calculator values needed adjustment, the narrative missed a key requirement…"
              rows={3}
              className="w-full bg-certify-white border border-certify-cool-grey/20 rounded-xl px-4 py-3 text-sm text-certify-deep placeholder:text-certify-cool-grey/50 focus:outline-none focus:border-certify-blue focus:ring-2 focus:ring-certify-blue/15 transition-all resize-none"
            />
          </div>

          {/* Would you use again */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-certify-deep/70 mb-2">Would you use LIMINALsva again?</label>
            <div className="flex gap-2">
              {(["yes", "maybe", "no"] as const).map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setWouldUseAgain(val)}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    wouldUseAgain === val
                      ? "bg-certify-blue text-white border-certify-blue"
                      : "bg-white text-certify-dark-grey border-certify-cool-grey/20 hover:border-certify-blue/30"
                  }`}
                >
                  {val === "yes" ? "Definitely" : val === "maybe" ? "Maybe" : "No"}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !useful || !wouldUseAgain}
            className="w-full flex items-center justify-center gap-2 bg-certify-blue hover:bg-certify-teal text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
          >
            {submitting ? (
              <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Sending…</>
            ) : (
              <><CheckCircle2 size={14} />Submit feedback</>
            )}
          </button>
          {(!useful || !wouldUseAgain) && (
            <p className="text-center text-xs text-certify-cool-grey -mt-2">Answer both rating questions to continue</p>
          )}
        </form>
      </div>
    </div>
  );
}
