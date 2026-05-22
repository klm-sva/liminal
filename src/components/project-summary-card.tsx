import { Building2 } from "lucide-react";

interface Props {
  name:         string;
  address:      string | null;
  buildingType: string | null;
  grossSqft:    number | null;
}

export default function ProjectSummaryCard({ name, address, buildingType, grossSqft }: Props) {
  return (
    <div className="bg-certify-blue/5 border border-certify-blue/15 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
      <Building2 size={14} className="text-certify-blue shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-certify-deep truncate">{name}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
          {address      && <span className="text-xs text-certify-cool-grey">{address}</span>}
          {buildingType && <span className="text-xs text-certify-cool-grey">{buildingType}</span>}
          {grossSqft    && <span className="text-xs text-certify-cool-grey">{grossSqft.toLocaleString()} SF</span>}
        </div>
      </div>
    </div>
  );
}
