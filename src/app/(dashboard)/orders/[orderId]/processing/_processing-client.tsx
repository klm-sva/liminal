"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter }                   from "next/navigation";
import StepProgress                    from "@/components/ui/StepProgress";

const POLLING_INTERVAL_MS = 5000;

export default function ProcessingClient({ orderId }: { orderId: string }) {
  const router   = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res  = await fetch(`/api/orders/${orderId}/status`);
        if (!res.ok) return;
        const data = await res.json() as { status: string; gap_analysis_program?: string | null };

        if (cancelled) return;

        if (data.status === "documents_requested") {
          clearInterval(timerRef.current!);
          router.push(`/orders/${orderId}/upload`);
          return;
        }

        if (data.status === "complete") {
          clearInterval(timerRef.current!);
          if (data.gap_analysis_program) {
            router.push(`/orders/${orderId}/gap-analysis-output`);
          } else {
            router.push(`/orders/${orderId}/delivery`);
          }
          return;
        }

        if (data.status === "failed") {
          clearInterval(timerRef.current!);
          setFailed(true);
          return;
        }
        // pending / under_review / processing / awaiting_* — keep polling
      } catch {
        // Network hiccup — keep polling
      }
    }

    poll();
    timerRef.current = setInterval(poll, POLLING_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [orderId, router]);

  if (failed) {
    return (
      <div className="min-h-screen bg-certify-white">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="mb-10">
            <StepProgress steps={["Pay", "Upload", "Processing", "Delivery"]} current={2} />
          </div>
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="font-serif text-3xl text-certify-deep mb-3">Processing failed</h1>
            <p className="text-certify-cool-grey text-sm leading-relaxed mb-6">
              Something went wrong while processing your order. Our team has been notified.
            </p>
            <a
              href="mailto:hello@liminalsva.com"
              className="inline-flex items-center justify-center bg-certify-blue hover:bg-certify-teal text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md text-sm"
            >
              Contact support
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-certify-white">
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <StepProgress steps={["Pay", "Upload", "Processing", "Delivery"]} current={2} />
        </div>
        <div className="text-center">
          <div className="flex justify-center mb-8">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-certify-blue/20" />
              <div className="absolute inset-0 rounded-full border-4 border-certify-blue border-t-transparent animate-spin" />
            </div>
          </div>
          <h1 className="font-serif text-3xl text-certify-deep mb-3">Processing your submission</h1>
          <p className="text-certify-cool-grey text-sm mb-2">Order #{orderId.slice(-6).toUpperCase()}</p>
          <p className="text-certify-cool-grey text-sm leading-relaxed">
            This may take several minutes. You can leave this page — we&apos;ll email you when
            your output is ready or if we need additional documents.
          </p>
        </div>
      </div>
    </div>
  );
}
