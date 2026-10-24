-- StartSys private records: employee identity, company-code uniqueness and durable queues.
create unique index if not exists startsys_team_code_company_unique on public.startsys_records(company_id) where kind='team-code';
create unique index if not exists startsys_employee_account_unique on public.startsys_records((data->>'accountId')) where kind='employee';
create unique index if not exists startsys_employee_login_unique on public.startsys_records(company_id,(data->>'loginFingerprint')) where kind='employee';
create index if not exists startsys_flow_due on public.startsys_records((data->>'status'),(data->>'dueAt')) where kind='flow-run';
create index if not exists startsys_personal_reply_due on public.startsys_records((data->>'status'),(data->>'dueAt')) where kind='reply-job';
