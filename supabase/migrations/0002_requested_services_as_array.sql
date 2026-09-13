-- Requested Service moves from free text to a checkbox multi-select.
alter table consultations drop column if exists treatment_name;
alter table consultations add column if not exists requested_services text[] not null default '{}';
alter table consultations alter column requested_services drop default;
