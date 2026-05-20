"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FileText } from "lucide-react";
import ProgramChip from "@/components/dashboard/ProgramChip";
import OrderStatusBadge from "@/components/dashboard/OrderStatusBadge";
import { PROGRAM_LABELS, PROGRAM_COLORS, PROGRAM_SHORT } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { ProgramType, OrderStatus } from "@/types/database";

type OrderRow = {
  id: string;
  status: OrderStatus;
  created_at: string;
  credits: {
    credit_code: string;
    credit_name: string;
    program: ProgramType;
    has_calculator: boolean;
    has_leed_form: boolean;
  } | null;
};

const ALL_PROGRAMS: ProgramType[] = ["leed_bdc_v41", "well_v2", "well_hsr"];

interface Props {
  projectId: string;
  initialPrograms: ProgramType[];
  certificationTarget: string | null;
  orders: OrderRow[];
}

export default function ProjectClient({ projectId, initialPrograms, certificationTarget, orders }: Props) {
  const router = useRouter();
  const [programs, setPrograms] = useState<ProgramType[]>(initialPrograms);
  const [filter, setFilter] = useState<ProgramType | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [adding, setAdding] = useState(false);

  const availableToAdd = ALL_PROGRAMS.filter((p) => !programs.includes(p));
  const filteredOrders = filter ? orders.filter((o) => o.credits?.program === filter) : orders;

  async function handleAddProgram(prog: ProgramType) {
    setAdding(true);
    const newPrograms = [...programs, prog];
    const supabase = createClient();
    if (!supabase) { setAdding(false); return; }
    const { error } = await supabase
      .from("projects")
      .update({ programs: newPrograms })
      .eq("id", projectId);
    if (!error) {
      setPrograms(newPrograms);
      setShowAddMenu(false);
      router.refresh();
    }
    setAdding(false);
  }

  return (
    <div className="space-y-6">
      {/* Program filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {programs.map((p) => {
          const colors = PROGRAM_COLORS[p];
          const active = filter === p;
          return (
            <button
              key={p}
              onClick={() => setFilter(active ? null : p)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all"
              style={{
                color: colors.text,
                background: active ? colors.bg : `${colors.bg}80`,
                border: `1.5px solid ${active ? colors.text : colors.border}`,
                boxShadow: active ? `0 0 0 2px ${colors.bg}` : "none",
              }}
            >
              {PROGRAM_SHORT[p]}
              {active && <span className="ml-1 opacity-50 text-[10px]">✕</span>}
            </button>
          );
        })}

        {certificationTarget && (
          <span className="text-xs text-certify-cool-grey">
            Target: <strong className="text-certify-deep">{certificationTarget}</strong>
          </span>
        )}

        {availableToAdd.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="flex items-center gap-1 text-xs font-medium text-certify-cool-grey hover:text-certify-blue border border-dashed border-certify-cool-grey/30 hover:border-certify-blue/40 px-2.5 py-1 rounded-full transition-colors"
            >
              <Plus size={11} /> Add program
            </button>
            {showAddMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowAddMenu(false)}
                />
                <div className="absolute top-full left-0 mt-1 bg-white border border-certify-white rounded-xl shadow-glass z-20 min-w-[190px] py-1">
                  {availableToAdd.map((p) => {
                    const colors = PROGRAM_COLORS[p];
                    return (
                      <button
                        key={p}
                        onClick={() => handleAddProgram(p)}
                        disabled={adding}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-certify-white/60 transition-colors disabled:opacity-50"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colors.text }} />
                        {PROGRAM_LABELS[p]}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Orders list */}
      <div className="bg-white rounded-2xl border border-certify-white shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-certify-white">
          <h2 className="font-serif text-lg text-certify-deep">
            Credits and Features
            {filter && (
              <span className="ml-2 text-sm font-sans text-certify-cool-grey font-normal">
                · {PROGRAM_SHORT[filter]} only
              </span>
            )}
          </h2>
          <Link
            href={`/projects/${projectId}/add-service`}
            className="text-sm font-semibold text-certify-blue hover:text-certify-teal flex items-center gap-1 transition-colors"
          >
            <Plus size={14} /> Add a credit or feature
          </Link>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="py-16 text-center">
            <FileText size={32} className="text-certify-cool-grey/40 mx-auto mb-3" />
            <p className="text-certify-cool-grey text-sm">
              {filter
                ? `No ${PROGRAM_SHORT[filter]} credits ordered yet`
                : "No credits or features ordered yet"}
            </p>
            <Link
              href={`/projects/${projectId}/add-service`}
              className="text-certify-blue text-sm hover:underline mt-1 inline-block"
            >
              Browse available credits and features →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-certify-white">
            {filteredOrders.map((order) => (
              <div key={order.id} className="flex items-center gap-4 px-6 py-4 hover:bg-certify-white/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-certify-cool-grey">{order.credits?.credit_code ?? "—"}</span>
                    <span className="font-medium text-certify-deep text-sm truncate">{order.credits?.credit_name ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {order.credits?.program && <ProgramChip program={order.credits.program} />}
                    <span className="text-xs text-certify-cool-grey">{new Date(order.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <OrderStatusBadge status={order.status} />
                  {(order.status === "delivered" || order.status === "complete") && (
                    <Link href={`/orders/${order.id}/delivery`} className="text-xs font-semibold text-certify-blue hover:text-certify-teal transition-colors">
                      View →
                    </Link>
                  )}
                  {(order.status === "pending_upload" || order.status === "awaiting_upload") && (
                    <Link href={`/orders/${order.id}/upload`} className="text-xs font-semibold text-certify-blue hover:text-certify-teal transition-colors">
                      Upload →
                    </Link>
                  )}
                  {order.status === "processing" && (
                    <Link href={`/orders/${order.id}/processing`} className="text-xs font-semibold text-certify-blue hover:text-certify-teal transition-colors">
                      View →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
