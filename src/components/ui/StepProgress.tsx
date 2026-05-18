import { Check } from "lucide-react";

interface StepProgressProps {
  steps: string[];
  current: number; // 0-based index
}

export default function StepProgress({ steps, current }: StepProgressProps) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide py-1">
      {steps.map((step, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <div key={step} className="flex items-center shrink-0">
            {/* Circle */}
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                done   ? "bg-certify-teal text-white"
                : active ? "bg-certify-blue text-white shadow-md"
                : "bg-certify-white border-2 border-certify-cool-grey/25 text-certify-cool-grey"
              }`}
              style={
                active
                  ? { boxShadow: "0 0 0 3px rgba(56,143,166,0.2)" }
                  : undefined
              }
            >
              {done ? <Check size={13} strokeWidth={2.5} /> : i + 1}
            </div>

            {/* Label — hidden on xs */}
            <span
              className={`ml-2 text-xs font-medium whitespace-nowrap hidden sm:block ${
                active ? "text-certify-deep" : "text-certify-cool-grey"
              }`}
            >
              {step}
            </span>

            {/* Connector */}
            {i < steps.length - 1 && (
              <div
                className={`w-6 sm:w-10 h-px mx-2 rounded-full transition-colors ${
                  done ? "bg-certify-teal" : "bg-certify-cool-grey/20"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
