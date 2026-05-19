import type { ProgramType } from "@/types/database";
import { PROGRAM_SHORT, PROGRAM_COLORS } from "@/lib/constants";

export default function ProgramChip({ program }: { program: ProgramType }) {
  const label  = PROGRAM_SHORT[program];
  const colors = PROGRAM_COLORS[program];
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border whitespace-nowrap"
      style={{ color: colors.text, backgroundColor: colors.bg, borderColor: colors.border }}
    >
      {label}
    </span>
  );
}
