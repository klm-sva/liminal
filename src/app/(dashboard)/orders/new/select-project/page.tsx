import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import ProgramChip from "@/components/dashboard/ProgramChip";
import { MOCK_PROJECTS } from "@/lib/mock-data";

export const metadata: Metadata = { title: "Select Project" };

export default function SelectProjectPage() {
  return (
    <>
      <DashboardHeader
        title="New Order"
        subtitle="Select the project this credit or feature is for"
        backHref="/dashboard"
        backLabel="Dashboard"
      />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <p className="text-sm text-certify-cool-grey mb-6">
          Choose an existing project or create a new one. Your credit documentation will be linked to the selected project.
        </p>

        <div className="space-y-3 mb-4">
          {MOCK_PROJECTS.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}/add-service`}
              className="group flex items-center gap-4 bg-white border border-certify-white rounded-2xl px-5 py-4 hover:border-certify-blue/30 hover:shadow-glass transition-all duration-200"
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-certify-blue/10 flex items-center justify-center shrink-0 group-hover:bg-certify-blue/20 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#388fa6" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-certify-deep text-sm group-hover:text-certify-teal transition-colors truncate">
                  {project.name}
                </p>
                <p className="text-xs text-certify-cool-grey truncate mt-0.5">{project.address}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {project.programs.map((p) => <ProgramChip key={p} program={p} />)}
                </div>
              </div>

              <ArrowRight size={16} className="text-certify-cool-grey/40 group-hover:text-certify-blue group-hover:translate-x-1 transition-all shrink-0" />
            </Link>
          ))}
        </div>

        {/* New project — dashed border */}
        <Link
          href="/projects/new"
          className="flex items-center gap-4 border-2 border-dashed border-certify-cool-grey/25 hover:border-certify-blue/40 rounded-2xl px-5 py-4 transition-all duration-200 hover:bg-certify-blue/5 group"
        >
          <div className="w-10 h-10 rounded-xl bg-certify-white border border-certify-white flex items-center justify-center shrink-0">
            <Plus size={18} className="text-certify-cool-grey group-hover:text-certify-blue transition-colors" />
          </div>
          <div>
            <p className="text-sm font-semibold text-certify-cool-grey group-hover:text-certify-blue transition-colors">
              Create a new project
            </p>
            <p className="text-xs text-certify-cool-grey/60 mt-0.5">
              Upload your drawing set or enter project details manually
            </p>
          </div>
        </Link>

        <p className="text-xs text-certify-cool-grey/70 mt-5 text-center">
          Don&apos;t have a project yet? Running a credit or feature will offer to create one automatically from your uploaded drawings.
        </p>
      </div>
    </>
  );
}
