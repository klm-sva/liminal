"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import ProgramChip from "@/components/dashboard/ProgramChip";
import { MOCK_PROJECTS, MOCK_CREDITS, PROGRAM_LABELS, PROGRAM_COLORS } from "@/lib/mock-data";
import type { ProgramType } from "@/types/database";


const ALL_PROGRAMS: ProgramType[] = ["leed_bdc_v41", "well_v2", "well_hsr"];

export default function AddServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = MOCK_PROJECTS.find((p) => p.id === id) ?? MOCK_PROJECTS[0];
  const showGap = true;

  const [selectedProgram, setSelectedProgram] = useState<ProgramType>("leed_bdc_v41");

  const visibleCredits = MOCK_CREDITS.filter((c) => c.program === selectedProgram);

  return (
    <>
      <DashboardHeader
        title="Run a Credit or Feature"
        subtitle={project.name}
        backHref={`/projects/${project.id}`}
        backLabel="Project"
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">

        {/* Gap analysis promo */}
        {showGap && !project.gap_analysis_purchased && (
          <div
            className="relative overflow-hidden rounded-2xl p-6"
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
            <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="flex-1">
                <p className="text-xs font-bold tracking-widest text-white/50 uppercase mb-2">Start here</p>
                <h3 className="font-serif text-2xl text-white mb-2">Gap Analysis</h3>
                <p className="text-white/65 text-sm leading-relaxed mb-4">
                  Before ordering individual credits, run a gap analysis to get a scored baseline and a prioritized list of credits that will move you toward your certification threshold most efficiently.
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {["Scored credit inventory", "Points gap to target", "Recommended credit shortlist", "Automation breakdown"].map((item) => (
                    <span key={item} className="flex items-center gap-1 text-xs text-certify-sage font-medium">
                      <CheckCircle2 size={11} /> {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="shrink-0">
                <Link
                  href="/orders/gap-analysis"
                  className="inline-flex items-center gap-2 bg-white text-certify-teal font-semibold px-5 py-3 rounded-xl hover:bg-certify-light transition-colors shadow-lg text-sm group"
                >
                  Learn more <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Program selector */}
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-3"
            style={{ color: "#388fa6", letterSpacing: "0.14em" }}
          >
            1 · Choose a program
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_PROGRAMS.map((prog) => {
              const colors = PROGRAM_COLORS[prog];
              const selected = prog === selectedProgram;
              return (
                <button
                  key={prog}
                  onClick={() => setSelectedProgram(prog)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    border: selected ? `2px solid ${colors.text}` : `1.5px solid ${colors.border}`,
                    background: selected ? colors.bg : "#ffffff",
                    color: selected ? colors.text : "#4a6570",
                    boxShadow: selected ? `0 0 0 3px ${colors.bg}` : "none",
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: colors.text }}
                  />
                  {PROGRAM_LABELS[prog]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Credits list */}
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-3"
            style={{ color: "#388fa6", letterSpacing: "0.14em" }}
          >
            2 · Choose a credit or feature
          </p>

          {visibleCredits.length === 0 ? (
            <p className="text-sm text-certify-cool-grey py-8 text-center">
              No credits available for this program.
            </p>
          ) : (
            <div className="space-y-2.5">
              {visibleCredits.map((credit) => {
                return (
                  <Link
                    key={credit.id}
                    href={`/orders/new/credit/${credit.id}?project_id=${project.id}`}
                    className="group flex items-center gap-4 bg-white border border-certify-white rounded-2xl px-5 py-4 hover:border-certify-blue/30 hover:shadow-glass transition-all duration-200"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-xs font-bold text-certify-cool-grey">{credit.credit_code}</span>
                        <span className="font-semibold text-certify-deep text-sm group-hover:text-certify-teal transition-colors">
                          {credit.credit_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <ProgramChip program={credit.program} />
                        <span className="text-xs text-certify-cool-grey">{credit.category}</span>
                        {credit.points_available !== null && credit.points_available > 0 && (
                          <span className="text-xs text-certify-cool-grey">{credit.points_available} pts</span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="font-serif text-xl text-certify-deep">${(credit.price / 100).toFixed(0)}</p>
                      <ArrowRight
                        size={15}
                        className="text-certify-cool-grey/40 group-hover:text-certify-blue group-hover:translate-x-1 transition-all ml-auto mt-1"
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </>
  );
}
