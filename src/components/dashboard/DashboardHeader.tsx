import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Metric {
  label: string;
  value: string | number;
  sub?: string;
}

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  metrics?: Metric[];
  actions?: React.ReactNode;
}

export default function DashboardHeader({
  title,
  subtitle,
  backHref,
  backLabel,
  metrics,
  actions,
}: DashboardHeaderProps) {
  return (
    <div
      className="w-full"
      style={{
        background: "linear-gradient(135deg, #2b4044 0%, #1c5e70 100%)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors mb-5"
          >
            <ArrowLeft size={13} />
            {backLabel ?? "Back"}
          </Link>
        )}

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl md:text-4xl text-white leading-tight mb-1">
              {title}
            </h1>
            {subtitle && (
              <p className="text-white/55 text-sm">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
        </div>

        {metrics && metrics.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="bg-white/8 border border-white/10 rounded-xl px-4 py-3"
              >
                <p className="text-2xl font-serif text-white leading-none">{m.value}</p>
                <p className="text-xs font-medium text-white/60 mt-1">{m.label}</p>
                {m.sub && <p className="text-xs text-white/35 mt-0.5">{m.sub}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
