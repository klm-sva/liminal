import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Edit, MessageSquare, ArrowRight } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { OrderStatus, ProgramType } from "@/types/database";
import ProjectClient from "./_project-client";

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

  if (user && project.customer_id !== user.id) notFound();

  const { data: orderData } = await supabase
    .from("orders")
    .select("id, status, created_at, credits(credit_code, credit_name, program, has_calculator, has_leed_form)")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  const orders = (orderData ?? []) as unknown as OrderRow[];
  const delivered = orders.filter((o) => o.status === "delivered" || o.status === "complete").length;
  const programs = (project.programs ?? []) as ProgramType[];

  return (
    <>
      <DashboardHeader
        title={project.name}
        subtitle={project.address ?? undefined}
        backHref="/dashboard"
        backLabel="Dashboard"
        metrics={[
          { label: "Credits Ordered", value: orders.length             },
          { label: "Delivered",       value: delivered                 },
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

        {/* Gap analysis card */}
        <div
          className="relative overflow-hidden rounded-2xl px-5 py-5 flex flex-col sm:flex-row sm:items-center gap-4"
          style={{ background: "linear-gradient(135deg, #388fa6 0%, #1c5e70 100%)" }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div className="relative flex-1">
            <p className="font-semibold text-white text-sm mb-1">Gap Analysis</p>
            <p className="text-white/65 text-xs leading-relaxed">
              Understand where your project stands before you begin. A gap analysis reviews your project against certification requirements, identifies your strongest credits and features, and gives you a recommended pursuit strategy. It is the recommended first step for any certification project.
            </p>
          </div>
          <div className="relative shrink-0">
            <Link
              href={`/projects/${project.id}/add-service`}
              className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white border border-white/30 font-semibold px-4 py-2 rounded-xl transition-colors text-sm group"
            >
              Learn more <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Interactive program pills + orders list */}
        <ProjectClient
          projectId={project.id}
          initialPrograms={programs}
          certificationTarget={project.certification_target ?? null}
          orders={orders}
        />

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
