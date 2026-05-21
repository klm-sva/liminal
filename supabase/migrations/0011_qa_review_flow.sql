-- QA review flow columns on orders table
alter table public.orders
  add column if not exists qa_status text not null default 'pending_review'
    check (qa_status in ('pending_review', 'approved', 'changes_requested')),
  add column if not exists qa_approved_at timestamptz,
  add column if not exists qa_changes_requested_at timestamptz,
  add column if not exists qa_instructions text,
  add column if not exists delivery_scheduled_at timestamptz,
  add column if not exists delay_email_sent boolean not null default false;
