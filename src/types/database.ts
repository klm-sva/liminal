export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ─── Enums ────────────────────────────────────────────────────────────────────

export type ProgramType    = "leed_bdc_v41" | "well_v2" | "well_hsr";
export type AutomationType = "full" | "partial" | "none";
export type QAStatus       = "pending_review" | "approved" | "changes_requested";
export type OrderStatus =
  | "awaiting_upload"
  | "awaiting_ready"
  | "under_review"
  | "documents_requested"
  | "awaiting_ready_final"
  | "processing"
  | "complete"
  | "failed"
  | "address_invalid"
  // legacy aliases
  | "pending_upload"
  | "delivered";
export type RunStatus = "pending" | "processing" | "completed" | "failed" | "address_invalid";

// ─── Table row types ───────────────────────────────────────────────────────────

export type Customer = {
  id:           string;
  email:        string;
  name:         string | null;
  organization: string | null;
  created_at:   string;
};

export type Credit = {
  id:                          string;
  program:                     ProgramType;
  category:                    string;
  credit_code:                 string;
  credit_name:                 string;
  points_available:            number | null;
  automation_type:             AutomationType;
  requirements_pdf_path:       string;
  has_form:                    boolean;
  form_link:                   string | null;
  has_calculator:              boolean;
  calculator_path:             string | null;
  well_verification_row:       number | null;
  prompt_text:                 string;
  required_customer_documents: string[];
  deliverable_description:     string;
  partial_notes:               string | null;
  price:                       number;
  is_active:                   boolean;
  stripe_product_id:           string | null;
  stripe_price_id:             string | null;
  created_at:                  string;
  updated_at:                  string;
};

export type Project = {
  id:                   string;
  customer_id:          string;
  name:                 string;
  address:              string | null;
  gross_sqft:           number | null;
  net_sqft:             number | null;
  stories:              number | null;
  stories_below_grade:  number | null;
  building_type:        string | null;
  occupancy:            string | null;
  primary_occupancy:    string | null;
  secondary_occupancies: string[] | null;
  description:          string | null;
  programs:             ProgramType[];
  certification_target: string | null;
  total_parking:        number | null;
  accessible_parking:   number | null;
  bicycle_parking:      number | null;
  site_area_sqft:       number | null;
  landscaping_sqft:     number | null;
  impervious_sqft:      number | null;
  building_footprint_sqft: number | null;
  dwelling_units:       number | null;
  occupant_load:        number | null;
  regular_occupants:    number | null;
  peak_visitors:        number | null;
  floor_to_floor_ft:    number | null;
  floor_to_ceiling_ft:  number | null;
  window_wall_ratio:    number | null;
  plumbing_fixtures:    Json | null;
  entrance_count:       number | null;
  main_entry_description: string | null;
  hvac_type:            string | null;
  lighting_type:        string | null;
  has_renewable_energy: boolean | null;
  has_water_reuse:      boolean | null;
  stormwater_features:  string | null;
  building_orientation: string | null;
  sustainability_notes: string | null;
  drawing_data:         Json | null;
  drawings_analyzed_at: string | null;
  auto_extracted:       boolean;
  specs_extracted:          boolean;
  doc_profiles_extracted:   Record<string, boolean>;
  flagged_fields:       string[];
  created_at:           string;
  updated_at:           string;
};

export type Order = {
  id:                       string;
  project_id:               string | null;
  customer_id:              string;
  credit_id:                string | null;
  status:                   OrderStatus;
  runs_used:                number;
  runs_remaining:           number;
  payment_id:               string | null;
  created_at:               string;
  delivered_at:             string | null;
  deletion_warning_sent:    boolean;
  qa_status:                QAStatus;
  qa_approved_at:           string | null;
  qa_changes_requested_at:  string | null;
  qa_instructions:          string | null;
  delivery_scheduled_at:    string | null;
  delay_email_sent:         boolean;
  gap_analysis_program:     string | null;
  gap_analysis_results:     Json | null;
};

export type Run = {
  id:                     string;
  order_id:               string;
  run_number:             number;
  attempt_number:         number | null;
  customer_upload_paths:  string[];
  output_docx_path:       string | null;
  output_html_path:       string | null;
  output_form_path:       string | null;
  output_calculator_path: string | null;
  status:                 RunStatus;
  review_issues:          string[] | null;
  error_message:          string | null;
  created_at:             string;
  completed_at:           string | null;
  deletion_scheduled_at:  string | null;
  compliance_path:        string | null;
};

export type CleanupQueue = {
  id:                    string;
  order_id:              string;
  file_paths:            string[];
  queued_at:             string;
  scheduled_deletion_at: string;
  processed:             boolean;
  processed_at:          string | null;
};

export type AuditLog = {
  id:          string;
  event_type:  string;
  entity_type: string;
  entity_id:   string;
  customer_id: string;
  metadata:    Json;
  created_at:  string;
};

// ─── Insert types (omit generated fields) ─────────────────────────────────────

export type CustomerInsert = Omit<Customer, "created_at">;

export type CreditInsert = Omit<Credit, "id" | "created_at" | "updated_at">;

export type ProjectInsert = Omit<Project, "id" | "auto_extracted" | "flagged_fields" | "created_at" | "updated_at">
  & Partial<Pick<Project, "auto_extracted" | "flagged_fields">>;

export type OrderInsert = Omit<Order, "id" | "status" | "runs_used" | "runs_remaining" | "created_at" | "delivered_at" | "deletion_warning_sent" | "qa_status" | "qa_approved_at" | "qa_changes_requested_at" | "qa_instructions" | "delivery_scheduled_at" | "delay_email_sent" | "payment_id" | "gap_analysis_program" | "gap_analysis_results">
  & Partial<Pick<Order, "status" | "payment_id" | "gap_analysis_program" | "gap_analysis_results">>;

export type RunInsert = Omit<
  Run,
  | "id" | "status" | "error_message" | "created_at" | "completed_at"
  | "output_docx_path" | "output_html_path" | "output_form_path" | "output_calculator_path"
  | "attempt_number" | "review_issues" | "deletion_scheduled_at" | "compliance_path"
> & Partial<Pick<Run,
  | "status" | "attempt_number" | "review_issues" | "deletion_scheduled_at" | "compliance_path"
  | "output_docx_path" | "output_html_path" | "output_form_path" | "output_calculator_path"
>>;

export type RunUpdate = Partial<Omit<Run, "id" | "created_at">>;

export type AuditLogInsert = Omit<AuditLog, "id" | "created_at">;

export type GapAnalysisResponse = {
  id:          string;
  customer_id: string;
  program:     string;
  responses:   Json;
  created_at:  string;
};

// ─── Supabase Database type map ────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      customers: {
        Row:           Customer;
        Insert:        CustomerInsert;
        Update:        Partial<CustomerInsert>;
        Relationships: [];
      };
      credits: {
        Row:           Credit;
        Insert:        CreditInsert;
        Update:        Partial<CreditInsert>;
        Relationships: [];
      };
      projects: {
        Row:           Project;
        Insert:        ProjectInsert;
        Update:        Partial<ProjectInsert>;
        Relationships: [];
      };
      orders: {
        Row:           Order;
        Insert:        OrderInsert;
        Update:        Partial<OrderInsert> & Partial<Pick<Order, "status" | "delivered_at" | "deletion_warning_sent" | "qa_status" | "qa_approved_at" | "qa_changes_requested_at" | "qa_instructions" | "delivery_scheduled_at" | "delay_email_sent">>;
        Relationships: [];
      };
      runs: {
        Row:           Run;
        Insert:        RunInsert;
        Update:        RunUpdate;
        Relationships: [];
      };
      cleanup_queue: {
        Row:           CleanupQueue;
        Insert:        Omit<CleanupQueue, "id" | "queued_at" | "scheduled_deletion_at" | "processed" | "processed_at">;
        Update:        Partial<CleanupQueue>;
        Relationships: [];
      };
      audit_log: {
        Row:           AuditLog;
        Insert:        AuditLogInsert;
        Update:        Partial<AuditLogInsert>;
        Relationships: [];
      };
      gap_analysis_responses: {
        Row:           GapAnalysisResponse;
        Insert:        Omit<GapAnalysisResponse, "id" | "created_at">;
        Update:        Partial<Omit<GapAnalysisResponse, "id" | "created_at">>;
        Relationships: [];
      };
    };
    Views:          Record<string, { Row: Record<string, unknown>; Relationships: [] }>;
    Functions:      Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
    CompositeTypes: Record<string, unknown>;
    Enums: {
      program_type:    ProgramType;
      automation_type: AutomationType;
      order_status:    OrderStatus;
      run_status:      RunStatus;
      qa_status:       QAStatus;
    };
  };
}
