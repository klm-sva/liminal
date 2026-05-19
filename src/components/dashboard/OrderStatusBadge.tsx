import type { OrderStatus } from "@/types/database";
import { ORDER_STATUS_CONFIG } from "@/lib/constants";

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const cfg = ORDER_STATUS_CONFIG[status];
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border whitespace-nowrap"
      style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: `${cfg.color}40` }}
    >
      {cfg.label}
    </span>
  );
}
