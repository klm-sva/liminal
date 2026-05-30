-- Rename LEED-specific column names to program-neutral names.
-- has_leed_form → has_form
-- leed_form_link → form_link
ALTER TABLE credits RENAME COLUMN has_leed_form TO has_form;
ALTER TABLE credits RENAME COLUMN leed_form_link TO form_link;
