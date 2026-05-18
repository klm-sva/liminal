import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Edit, MessageSquare, FileText, DownloadCloud } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import ProgramChip from "@/components/dashboard/ProgramChip";
import OrderStatusBadge from "@/components/dashboard/OrderStatusBadge";
import { MOCK_PROJECTS, MOCK_ORDERS, MOCK_GAP_ANALYSIS } from "@/lib/mock-data";

export const metadata: Metadata = { title: "Project Dashboard" };

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = MOCK_PROJECTS.find((p) => p.id === id) ?? MOCK_PROJECTS[0];
  if (!project) notFound();

  const orders      = MOCK_ORDERS.filter((o) => o.project_id === project.id);
  const delivered   = orders.filter((o) => o.status === "delivered").length;
  const hasLeed     = project.programs.some((p) => p === "leed_bdc_v41");
  const isWellOnly  = !hasLeed;
  const showGap     = hasLeed && project.gap_analysis_purchased;

  return (
    <>
      <DashboardHeader
        title={project.name}
        subtitle={project.address ?? undefined}
        backHref="/dashboard"
        backLabel="Dashboard"
        metrics={[
          { label: "Credits Ordered",    value: orders.length            },
          { label: "Delivered",         value: delivered                },
          { label: "In Progress",       value: orders.length - delivered },
          { label: "Sq Ft",             value: project.gross_sqft?.toLocaleString() ?? "—" },
        ]}
        actions={
          <>
            <Link
              href={`/projects/${project.id}/edit`}
              className="flex items-center gap-1.5 text-sm font-medium bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3.5 py-2 rounded-xl transition-colors"
            >
              <Edit size={14} /> Edit
            </Link>
            <Link
              href={`/projects/${project.id}/add-service`}
              className="flex items-center gap-1.5 text-sm font-semibold bg-certify-blue hover:bg-certify-blue/90 text-white px-4 py-2 rounded-xl transition-colors shadow-md"
            >
              <Plus size={14} /> Add a Credit or Feature
            </Link>
          </>
        }
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        {/* Program chips row */}
        <div className="flex flex-wrap items-center gap-2">
          {project.programs.map((p) => <ProgramChip key={p} program={p} />)}
          <span className="text-xs text-certify-cool-grey">Target: <strong className="text-certify-deep">{project.certification_target}</strong></span>
        </div>

        {/* ── Gap analysis — WELL under development notice ── */}
        {isWellOnly && (
          <div className="bg-certify-beige border border-certify-sand/40 rounded-2xl px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-certify-sand mb-1">Gap Analysis</p>
            <p className="text-sm text-certify-dark-grey">The WELL gap analysis is currently under development and will be available soon.</p>
          </div>
        )}

        {/* ── Gap analysis card (LEED only, if purchased) ── */}
        {showGap && (
          <div
            className="relative overflow-hidden rounded-2xl p-6"
            style={{ background: "linear-gradient(135deg, #388fa6 0%, #1c5e70 100%)" }}
          >
            <div aria-hidden="true" className="absolute inset-0 opacity-[0.04]"
              style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
            />
            <div className="relative">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-xs font-bold tracking-widest text-certify-light/50 uppercase mb-1">Gap Analysis</p>
                  <h3 className="font-serif text-2xl text-white">Credit Gap Report</h3>
                  <p className="text-white/50 text-sm mt-0.5">Based on your project data and program requirements</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-certify-sand font-serif text-5xl leading-none">{MOCK_GAP_ANALYSIS.overall_score}</p>
                  <p className="text-certify-sand/60 text-xs mt-0.5">/ 110 estimated pts</p>
                  <p className="text-certify-sage text-xs font-semibold mt-1">{MOCK_GAP_ANALYSIS.certification_level} threshold</p>
                </div>
              </div>

              {/* Category bars */}
              <div className="space-y-2.5 mb-5">
                {MOCK_GAP_ANALYSIS.categories.map((cat) => {
                  const pct = Math.round((cat.score / cat.max) * 100);
                  const isRecommended = MOCK_GAP_ANALYSIS.recommended_credits.some((c) =>
                    cat.recommended.includes(c)
                  );
                  return (
                    <div key={cat.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={`font-medium ${isRecommended ? "text-certify-sage" : "text-white/70"}`}>
                          {cat.name}
                          {isRecommended && <span className="ml-2 text-certify-sage/80">↑ opportunity</span>}
                        </span>
                        <span className="text-white/50">{cat.score}/{cat.max}</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: isRecommended ? "#5fa8bb" : "#388fa6",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Recommended credits */}
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <span className="text-xs text-white/40 uppercase tracking-wider font-semibold">Recommended:</span>
                {MOCK_GAP_ANALYSIS.recommended_credits.map((code) => (
                  <span key={code} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-certify-sage/20 border border-certify-sage/30 text-certify-sage">
                    {code}
                  </span>
                ))}
              </div>

              <div className="flex gap-3">
                <Link href={`/orders/gap-analysis/output`} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/20 px-4 py-2 rounded-xl transition-colors">
                  <DownloadCloud size={13} /> Download Report
                </Link>
                <Link href={`/projects/${project.id}/add-service`} className="flex items-center gap-1.5 text-xs font-semibold text-certify-deep bg-certify-sand hover:bg-certify-sand/90 px-4 py-2 rounded-xl transition-colors">
                  Order recommended credits →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── Orders list ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-certify-white shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-certify-white">
            <h2 className="font-serif text-lg text-certify-deep">Credits and Features</h2>
            <Link href={`/projects/${project.id}/add-service`} className="text-sm font-semibold text-certify-blue hover:text-certify-teal flex items-center gap-1 transition-colors">
              <Plus size={14} /> Add a credit or feature
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="py-16 text-center">
              <FileText size={32} className="text-certify-cool-grey/40 mx-auto mb-3" />
              <p className="text-certify-cool-grey text-sm">No credits or features ordered yet</p>
              <Link href={`/projects/${project.id}/add-service`} className="text-certify-blue text-sm hover:underline mt-1 inline-block">
                Browse available credits and features →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-certify-white">
              {orders.map((order) => (
                <div key={order.id} className="flex items-center gap-4 px-6 py-4 hover:bg-certify-white/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-certify-cool-grey">{order.credit_code}</span>
                      <span className="font-medium text-certify-deep text-sm truncate">{order.credit_name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <ProgramChip program={order.program} />
                      <span className="text-xs text-certify-cool-grey">{order.created_at}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <OrderStatusBadge status={order.status} />
                    {order.status === "delivered" && (
                      <Link href={`/orders/${order.id}/delivery`} className="text-xs font-semibold text-certify-blue hover:text-certify-teal transition-colors">
                        View →
                      </Link>
                    )}
                    {order.status === "pending_upload" && (
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

        {/* Pilot feedback link */}
        <div className="flex justify-end">
          <Link
            href="/feedback"
            className="inline-flex items-center gap-2 text-sm text-certify-cool-grey hover:text-certify-blue transition-colors"
          >
            <MessageSquare size={14} />
            Share pilot feedback
          </Link>
        </div>
      </div>
    </>
  );
}
