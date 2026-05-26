import type { ProgramType, OrderStatus } from "@/types/database";

export const PROGRAM_LABELS: Record<ProgramType, string> = {
  leed_bdc_v41: "LEED BD+C v4.1",
  well_v2:      "WELL v2",
  well_hsr:     "WELL Health-Safety",
};

export const PROGRAM_SHORT: Record<ProgramType, string> = {
  leed_bdc_v41: "LEED",
  well_v2:      "WELL v2",
  well_hsr:     "WELL H-S",
};

export const PROGRAM_COLORS: Record<ProgramType, { text: string; bg: string; border: string }> = {
  leed_bdc_v41: { text: "#388fa6", bg: "#388fa615", border: "#388fa630" },
  well_v2:      { text: "#5fa8bb", bg: "#5fa8bb15", border: "#5fa8bb30" },
  well_hsr:     { text: "#edc299", bg: "#edc29915", border: "#edc29930" },
};

export const ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  awaiting_upload:      { label: "Upload Needed",  color: "#388fa6", bg: "#388fa615" },
  awaiting_ready:       { label: "Awaiting Ready", color: "#f59e0b", bg: "#f59e0b15" },
  under_review:         { label: "Under Review",   color: "#f59e0b", bg: "#f59e0b15" },
  documents_requested:  { label: "Docs Needed",    color: "#ef4444", bg: "#ef444415" },
  awaiting_ready_final: { label: "Final Review",   color: "#8b5cf6", bg: "#8b5cf615" },
  processing:           { label: "Processing",     color: "#388fa6", bg: "#388fa615" },
  complete:             { label: "Complete",        color: "#10b981", bg: "#10b98115" },
  failed:               { label: "Failed",          color: "#ef4444", bg: "#ef444415" },
  address_invalid:      { label: "Address Invalid", color: "#f59e0b", bg: "#f59e0b15" },
  pending_upload:       { label: "Upload Needed",  color: "#388fa6", bg: "#388fa615" },
  delivered:            { label: "Delivered",       color: "#10b981", bg: "#10b98115" },
};
