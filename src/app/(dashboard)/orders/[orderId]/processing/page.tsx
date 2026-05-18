"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Loader2, FileOutput } from "lucide-react";
import StepProgress from "@/components/ui/StepProgress";

type StatusRow = {
  label: string;
  state: "done" | "active" | "pending";
};

const FINAL_STATUSES: StatusRow[] = [
  { label: "Payment confirmed",    state: "done"    },
  { label: "Documents received",   state: "done"    },
  { label: "Analysis in progress", state: "done"    },
  { label: "Output ready",         state: "done"    },
];

const LOADING_STEPS: StatusRow[][] = [
  [
    { label: "Payment confirmed",    state: "done"    },
    { label: "Documents received",   state: "active"  },
    { label: "Analysis in progress", state: "pending" },
    { label: "Output pending",       state: "pending" },
  ],
  [
    { label: "Payment confirmed",    state: "done"    },
    { label: "Documents received",   state: "done"    },
    { label: "Analysis in progress", state: "active"  },
    { label: "Output pending",       state: "pending" },
  ],
  [
    { label: "Payment confirmed",    state: "done"    },
    { label: "Documents received",   state: "done"    },
    { label: "Analysis in progress", state: "done"    },
    { label: "Output ready",         state: "active"  },
  ],
];

export default function ProcessingPage({ params }: { params: Promise<{ orderId: string }> }) {
  const router   = useRouter();
  const { orderId } = use(params);

  const [step,  setStep]  = useState(0);
  const [done,  setDone]  = useState(false);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 1200),
      setTimeout(() => setStep(2), 3200),
      setTimeout(() => setStep(3), 5500),
      setTimeout(() => setDone(true), 7200),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const statuses = done ? FINAL_STATUSES : (LOADING_STEPS[step] ?? LOADING_STEPS[0]);

  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <StepProgress steps={["Pay", "Upload", "Processing", "Delivery"]} current={2} />
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
              <circle cx="36" cy="36" r="34" stroke="#a3bfa1" strokeWidth="2.5" fill="none" strokeDasharray={done ? "none" : "6 4"}>
                {!done && (
                  <animateTransform attributeName="transform" type="rotate" from="0 36 36" to="360 36 36" dur="8s" repeatCount="indefinite" />
                )}
              </circle>
              {done ? (
                <path d="M22 37l10 10 18-20" stroke="#a3bfa1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <g>
                  <circle cx="36" cy="36" r="6" fill="#a3bfa1" opacity="0.6">
                    <animate attributeName="opacity" values="0.4;1;0.4" dur="1.4s" repeatCount="indefinite" />
                  </circle>
                </g>
              )}
            </svg>
          </div>
        </div>

        <h1 className="font-serif text-3xl text-certify-deep text-center mb-2">
          {done ? "Your output is ready" : "Processing your order"}
        </h1>
        <p className="text-certify-cool-grey text-center text-sm mb-2">
          Order #{orderId.slice(-6).toUpperCase()}
        </p>
        {!done && (
          <p className="text-certify-cool-grey text-center text-xs mb-10">
            This typically takes 2 to 5 minutes. You can leave this page. We will email you when it is ready.
          </p>
        )}
        {done && (
          <p className="text-certify-cool-grey text-center text-xs mb-10">
            Your documentation is ready to download.
          </p>
        )}

        {/* Status rows */}
        <div className="bg-white border border-certify-white rounded-2xl shadow-card p-6 mb-6 space-y-4">
          {statuses.map((row, i) => (
            <div key={i} className="flex items-center gap-3">
              {row.state === "done" && (
                <CheckCircle2 size={18} className="text-certify-sage shrink-0" />
              )}
              {row.state === "active" && (
                <Loader2 size={18} className="text-certify-blue shrink-0 animate-spin" />
              )}
              {row.state === "pending" && (
                <Clock size={18} className="text-certify-cool-grey/30 shrink-0" />
              )}
              <span className={`text-sm font-medium ${
                row.state === "done"    ? "text-certify-deep" :
                row.state === "active"  ? "text-certify-blue" :
                                          "text-certify-cool-grey/50"
              }`}>
                {row.label}
              </span>
            </div>
          ))}
        </div>

        {/* CTA — only show when done */}
        {done && (
          <button
            onClick={() => router.push(`/orders/${orderId}/delivery`)}
            className="w-full flex items-center justify-center gap-2 bg-certify-blue hover:bg-certify-teal text-white font-semibold py-3.5 rounded-xl transition-all shadow-md"
          >
            <FileOutput size={15} />
            View your output
          </button>
        )}

        {!done && (
          <div className="flex items-center justify-center gap-2 text-xs text-certify-cool-grey">
            <Loader2 size={12} className="animate-spin" />
            <span>Processing your order. Do not close this tab.</span>
          </div>
        )}
      </div>
    </div>
  );
}
