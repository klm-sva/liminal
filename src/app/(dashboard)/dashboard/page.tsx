import type { Metadata } from "next";
import Link from "next/link";
import { Plus, FolderOpen, ShoppingBag } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import ProgramChip from "@/components/dashboard/ProgramChip";
import { ORDER_STATUS_CONFIG } from "@/lib/constants";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types/database";

export const metadata: Metadata = { title: "My Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string; payment_success?: string }>;
}) {
  const { demo } = await searchParams;

  // Get authenticated user
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  const supabase = await createServiceClient();

  // demo=empty forces the empty state
  const forceEmpty = demo === "empty";

  let projects: Array<{
    id: string;
    name: string;
    address: string | null;
    programs: string[];
    certification_target: string | null;
    gross_sqft: number | null;
  }> = [];

  const ordersByProject: Record<string, Array<{
    id: string;
    status: OrderStatus;
    credits: { credit_code: string; program: string } | null;
  }>> = {};

  type GapOrder = { id: string; status: OrderStatus; credits: { credit_code: string; program: string } | null };
  let gapOrders: GapOrder[] = [];

  if (user && !forceEmpty) {
    const { data: projectData } = await supabase
      .from("projects")
      .select("id, name, address, programs, certification_target, gross_sqft")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });

    projects = (projectData ?? []) as typeof projects;

    if (projects.length > 0) {
      const projectIds = projects.map((p) => p.id);
      const { data: orderData } = await supabase
        .from("orders")
        .select("id, project_id, status, credits(credit_code, program)")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false });

      type OrderWithCredit = { id: string; project_id: string; status: OrderStatus; credits: { credit_code: string; program: string } | null };
      for (const order of (orderData ?? []) as unknown as OrderWithCredit[]) {
        const pid = order.project_id;
        if (!ordersByProject[pid]) ordersByProject[pid] = [];
        ordersByProject[pid].push(order);
      }
    }

    const { data: gapData } = await supabase
      .from("orders")
      .select("id, status, credits(credit_code, program)")
      .eq("customer_id", user.id)
      .is("project_id", null)
      .order("created_at", { ascending: false });

    gapOrders = (gapData ?? []) as unknown as GapOrder[];
  }

  const hasProjects = !forceEmpty && projects.length > 0;

  const allOrders = Object.values(ordersByProject).flat();
  const totalOrders    = allOrders.length + gapOrders.length;
  const deliveredOrders = [...allOrders, ...gapOrders].filter((o) => o.status === "delivered" || o.status === "complete").length;
  const pendingOrders  = totalOrders - deliveredOrders;

  if (!hasProjects) {
    return (
      <>
        <DashboardHeader title="My Dashboard" subtitle="Welcome to Liminal" />

        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-certify-blue/10 border border-certify-blue/20 flex items-center justify-center mx-auto mb-6">
            <FolderOpen size={28} className="text-certify-blue" />
          </div>
          <h2 className="font-serif text-3xl text-certify-deep mb-3">No projects yet</h2>
          <p className="text-certify-cool-grey leading-relaxed mb-10 max-w-sm mx-auto">
            Get started by creating a project or run your first credit or feature.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <Link
              href="/projects/new"
              className="group bg-white border-2 border-certify-blue/20 hover:border-certify-blue rounded-2xl p-6 text-left transition-all duration-200 hover:shadow-glass"
            >
              <div className="w-10 h-10 rounded-xl bg-certify-blue/10 flex items-center justify-center mb-4 group-hover:bg-certify-blue/20 transition-colors">
                <Plus size={20} className="text-certify-blue" />
              </div>
              <h3 className="font-serif text-lg text-certify-deep mb-1">Create a project</h3>
              <p className="text-xs text-certify-cool-grey leading-relaxed">
                Set up your building project first, then browse and run credits or features.
              </p>
            </Link>

            <Link
              href="/orders/new/select-project"
              className="group bg-white border-2 border-certify-sage/30 hover:border-certify-sage rounded-2xl p-6 text-left transition-all duration-200 hover:shadow-glass"
            >
              <div className="w-10 h-10 rounded-xl bg-certify-sage/15 flex items-center justify-center mb-4 group-hover:bg-certify-sage/25 transition-colors">
                <ShoppingBag size={20} className="text-certify-teal" />
              </div>
              <h3 className="font-serif text-lg text-certify-deep mb-1">Run a feature or credit</h3>
              <p className="text-xs text-certify-cool-grey leading-relaxed">
                Choose a credit to document. We will create a project for you automatically using your uploaded drawings.
              </p>
            </Link>
          </div>

          <p className="text-xs text-certify-cool-grey/70 bg-certify-beige border border-certify-sand/40 rounded-xl px-4 py-3 inline-block">
            Running a credit or feature will automatically create a project if you don&apos;t have one yet.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <DashboardHeader
        title="My Dashboard"
        subtitle="All your certification projects in one place"
        metrics={[
          { label: "Projects",        value: projects.length   },
          { label: "Credits Ordered", value: totalOrders       },
          { label: "Delivered",       value: deliveredOrders, sub: "completed" },
          { label: "In Progress",     value: pendingOrders,   sub: "active"    },
        ]}
        actions={
          <>
            <Link href="/projects/new" className="flex items-center gap-1.5 text-sm font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/20 px-4 py-2.5 rounded-xl transition-colors">
              <Plus size={15} /> New Project
            </Link>
            <Link href="/orders/new/select-project" className="flex items-center gap-1.5 text-sm font-semibold bg-certify-blue hover:bg-certify-blue/90 text-white px-4 py-2.5 rounded-xl transition-colors shadow-md">
              <Plus size={15} /> New Order
            </Link>
          </>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-xl text-certify-deep">Projects</h2>
          <Link href="/projects/new" className="text-sm text-certify-blue hover:text-certify-teal font-medium transition-colors flex items-center gap-1">
            <Plus size={14} /> Add project
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {projects.map((project) => {
            const projectOrders = ordersByProject[project.id] ?? [];
            const ordersComplete = projectOrders.filter((o) => o.status === "delivered" || o.status === "complete").length;
            const progress = projectOrders.length > 0
              ? Math.round((ordersComplete / projectOrders.length) * 100)
              : 0;
            const programs = project.programs as string[];

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group bg-white rounded-2xl border border-certify-white shadow-card hover:shadow-glass hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
              >
                {/* Top accent */}
                <div
                  className="h-1.5"
                  style={{
                    background: programs.includes("leed_bdc_v41")
                      ? "linear-gradient(90deg, #388fa6, #1c5e70)"
                      : programs.includes("well_v2")
                      ? "linear-gradient(90deg, #5fa8bb, #388fa6)"
                      : "linear-gradient(90deg, #edc299, #5fa8bb)",
                  }}
                />
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <h3 className="font-serif text-lg text-certify-deep leading-tight group-hover:text-certify-teal transition-colors truncate">
                        {project.name}
                      </h3>
                      <p className="text-xs text-certify-cool-grey mt-0.5 truncate">{project.address}</p>
                    </div>
                  </div>

                  {/* Program chips */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {programs.map((p) => <ProgramChip key={p} program={p as import("@/types/database").ProgramType} />)}
                    {project.certification_target && (
                      <span className="text-[10px] font-medium px-2.5 py-1 rounded-lg bg-certify-beige text-certify-dark-grey border border-certify-sand/30">
                        Target: {project.certification_target}
                      </span>
                    )}
                  </div>

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-certify-cool-grey mb-1.5">
                      <span>Complete</span>
                      <span className="font-semibold text-certify-deep">{ordersComplete}/{projectOrders.length}</span>
                    </div>
                    <div className="h-2 bg-certify-white rounded-full overflow-hidden">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${progress}%`, background: "linear-gradient(90deg, #388fa6, #1c5e70)" }}
                      />
                    </div>
                  </div>

                  {/* Recent order statuses */}
                  <div className="flex flex-wrap gap-1.5">
                    {projectOrders.slice(0, 3).map((order) => {
                      const cfg = ORDER_STATUS_CONFIG[order.status];
                      return (
                        <span
                          key={order.id}
                          className="text-[10px] font-medium px-2 py-0.5 rounded"
                          style={{ color: cfg.color, backgroundColor: cfg.bg }}
                        >
                          {order.credits?.credit_code ?? "—"}
                        </span>
                      );
                    })}
                    {projectOrders.length > 3 && (
                      <span className="text-[10px] text-certify-cool-grey px-1 py-0.5">
                        +{projectOrders.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}

          {/* Add new card */}
          <Link
            href="/projects/new"
            className="bg-transparent border-2 border-dashed border-certify-cool-grey/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 hover:border-certify-blue/40 hover:bg-certify-blue/5 transition-all duration-200 min-h-[180px]"
          >
            <div className="w-10 h-10 rounded-xl bg-certify-white flex items-center justify-center">
              <Plus size={20} className="text-certify-cool-grey" />
            </div>
            <div>
              <p className="text-sm font-medium text-certify-cool-grey">New project</p>
              <p className="text-xs text-certify-cool-grey/60 mt-0.5">Upload drawings or enter details</p>
            </div>
          </Link>
        </div>

        {/* Gap Analysis Orders */}
        {gapOrders.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-serif text-xl text-certify-deep">Gap Analysis Orders</h2>
                <p className="text-xs text-certify-cool-grey mt-0.5">Orders not associated with a specific project</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {gapOrders.map((order) => {
                const cfg = ORDER_STATUS_CONFIG[order.status];
                return (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="group bg-white rounded-2xl border border-certify-white shadow-card hover:shadow-glass hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
                  >
                    <div className="h-1.5" style={{ background: "linear-gradient(90deg, #edc299, #5fa8bb)" }} />
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-xs text-certify-cool-grey font-medium uppercase tracking-wider mb-1">Gap Analysis</p>
                          <p className="text-sm font-medium text-certify-deep">Order #{order.id.slice(-6).toUpperCase()}</p>
                        </div>
                        <span
                          className="text-[10px] font-semibold px-2.5 py-1 rounded-lg shrink-0"
                          style={{ color: cfg.color, backgroundColor: cfg.bg }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      {order.credits && (
                        <p className="text-xs text-certify-cool-grey">{order.credits.credit_code}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
