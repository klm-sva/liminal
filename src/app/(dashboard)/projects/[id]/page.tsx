import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Edit, MessageSquare, FileText } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import ProgramChip from "@/components/dashboard/ProgramChip";
import OrderStatusBadge from "@/components/dashboard/OrderStatusBadge";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { OrderStatus, ProgramType } from "@/types/database";

export const metadata: Metadata = { title: "Project Dashboard" };

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

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  const supabase = await createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, address, programs, certification_target, gross_sqft, customer_id")
    .eq("id", id)
    .single();

  if (!project) notFound();

  // Only the owner can view
  if (user && project.customer_id !== user.id) notFound();

  const { data: orderData } = await supabase
    .from("orders")
    .select("id, status, created_at, credits(credit_code, credit_name, program, has_calculator, has_leed_form)")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  const orders = (orderData ?? []) as unknown as OrderRow[];
  const delivered = orders.filter((o) => o.status === "delivered" || o.status === "complete").length;
  const programs = (project.programs ?? []) as ProgramType[];
  const hasLeed = programs.includes("leed_bdc_v41");
  const isWellOnly = !hasLeed;

  return (
    <>
      <DashboardHeader
        title={project.name}
        subtitle={project.address ?? undefined}
        backHref="/dashboard"
        backLabel="Dashboard"
        metrics={[
          { label: "Credits Ordered", value: orders.length            },
          { label: "Delivered",       value: delivered                },
          { label: "In Progress",     value: orders.length - delivered },
          { label: "Sq Ft",           value: project.gross_sqft?.toLocaleString() ?? "—" },
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
          {programs.map((p) => <ProgramChip key={p} program={p} />)}
          {project.certification_target && (
            <span className="text-xs text-certify-cool-grey">
              Target: <strong className="text-certify-deep">{project.certification_target}</strong>
            </span>
          )}
        </div>

        {/* Gap analysis — WELL under development notice */}
        {isWellOnly && (
          <div className="bg-certify-beige border border-certify-sand/40 rounded-2xl px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-certify-sand mb-1">Gap Analysis</p>
            <p className="text-sm text-certify-dark-grey">The WELL gap analysis is currently under development and will be available soon.</p>
          </div>
        )}

        {/* Orders list */}
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
