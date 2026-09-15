-- HKC ERP Standard Chart of Accounts & Company Settings SQL Seed
-- Run this in the Supabase SQL editor to seed company's authentic 54 accounts and settings.

-- 1. Seed Company Settings
insert into public.company_settings (id, payload, created_at, updated_at)
values (
  'default',
  '{
    "company_name": "HKC Trading PLC",
    "base_currency": "ETB",
    "exchange_rates": { "USD": 58.50, "EUR": 63.20 },
    "cash_account_id": "1000-01-01",
    "primary_bank_account_id": "1000-02-26",
    "ar_account_id": "1300-03",
    "inventory_account_id": "1410-01",
    "ap_account_id": "2100-06",
    "tax_payable_account_id": "2000-05",
    "wht_payable_account_id": "2000-04",
    "income_tax_payable_account_id": "2000-02",
    "pension_payable_account_id": "2000-03",
    "retained_earnings_account_id": "3200",
    "share_capital_account_id": "3000",
    "sales_account_id": "4000-01-01",
    "cogs_account_id": "6000",
    "payroll_expense_account_id": "8000-01"
  }'::jsonb,
  now(),
  now()
)
on conflict (id) do update
set payload = excluded.payload, updated_at = now();

-- 2. Seed Authentic Company Chart of Accounts (54 Accounts)
select public.create_hkc_document_table('chart_of_accounts');

insert into public.chart_of_accounts (id, payload, created_at, updated_at)
values
  -- Cash & Banks
  ('1000', '{"id":"1000","code":"1000","name":"CASH","account_type":"Asset","peachtree_type":"Cash","parent_account_id":null,"is_active":true,"is_group":true}'::jsonb, now(), now()),
  ('1000-01-01', '{"id":"1000-01-01","code":"1000-01-01","name":"PETTY CASH-HEAD OFFICE","account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('1000-02-10', '{"id":"1000-02-10","code":"1000-02-10","name":"ABAY_TAB_AC_1722015651591011","account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('1000-02-13', '{"id":"1000-02-13","code":"1000-02-13","name":"AIB_GFB_AC_01304807538500","account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('1000-02-17', '{"id":"1000-02-17","code":"1000-02-17","name":"BOA_RDB_35292853","account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('1000-02-20', '{"id":"1000-02-20","code":"1000-02-20","name":"OIB_DRB_1074/3834909/001/3001/","account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('1000-02-21', '{"id":"1000-02-21","code":"1000-02-21","name":"BOA_FIB_40467351/104878358","account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('1000-02-26', '{"id":"1000-02-26","code":"1000-02-26","name":"CBE_ECB_AC_1000465135224","account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('1000-02-29', '{"id":"1000-02-29","code":"1000-02-29","name":"UNB_RDB_ECX_1737116287486015","account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('1000-02-31', '{"id":"1000-02-31","code":"1000-02-31","name":"UNB_RDB_ECX_1737116287486015 (Sec)","account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('1000-02-33', '{"id":"1000-02-33","code":"1000-02-33","name":"CBO_CATB_AC_1059900010301","account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('1000-02-41', '{"id":"1000-02-41","code":"1000-02-41","name":"AHADU","account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000","is_active":true,"is_group":false}'::jsonb, now(), now()),

  -- Receivables & Current Assets
  ('1100-03', '{"id":"1100-03","code":"1100-03","name":"PURCHASE ADVANCE","account_type":"Asset","peachtree_type":"Accounts Receivable","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('1101-03', '{"id":"1101-03","code":"1101-03","name":"NIGUSE ABERA","account_type":"Asset","peachtree_type":"Accounts Receivable","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('1101-04', '{"id":"1101-04","code":"1101-04","name":"LIYEW MENGISTE","account_type":"Asset","peachtree_type":"Accounts Receivable","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('1200-03', '{"id":"1200-03","code":"1200-03","name":"PRE-PAIED INSURANCE","account_type":"Asset","peachtree_type":"Accounts Receivable","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('1200-06', '{"id":"1200-06","code":"1200-06","name":"ESL CONTAINER DEPOSIT","account_type":"Asset","peachtree_type":"Accounts Receivable","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('1300-03', '{"id":"1300-03","code":"1300-03","name":"VET MEDICEN SALES RECIVABLE","account_type":"Asset","peachtree_type":"Accounts Receivable","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('1300-08', '{"id":"1300-08","code":"1300-08","name":"SUNDARY RECEIVABLE","account_type":"Asset","peachtree_type":"Accounts Receivable","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('1310', '{"id":"1310","code":"1310","name":"OWNER RECEIVABLE","account_type":"Asset","peachtree_type":"Accounts Receivable","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('1320-06-01', '{"id":"1320-06-01","code":"1320-06-01","name":"WITHOLD TAX RECIVABLE","account_type":"Asset","peachtree_type":"Accounts Receivable","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('1320-06-02', '{"id":"1320-06-02","code":"1320-06-02","name":"VAT RECIVABLE","account_type":"Asset","peachtree_type":"Accounts Receivable","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),

  -- Inventory & Goods In Transit
  ('1410-01', '{"id":"1410-01","code":"1410-01","name":"STOCK OF GREEN MUNG","account_type":"Asset","peachtree_type":"Inventory","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('1410-03', '{"id":"1410-03","code":"1410-03","name":"STOCK OF REDISH SESAME SEED","account_type":"Asset","peachtree_type":"Inventory","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('1500-09', '{"id":"1500-09","code":"1500-09","name":"GIT LC- TF260852143701 $171600","account_type":"Asset","peachtree_type":"Inventory","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('1500-10', '{"id":"1500-10","code":"1500-10","name":"GIT LC101ILSN260920003 $299999","account_type":"Asset","peachtree_type":"Inventory","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),

  -- Capital WIP & Other Assets
  ('1800-01', '{"id":"1800-01","code":"1800-01","name":"CIP (FARM LAND PREPARATION )","account_type":"Asset","peachtree_type":"Other Assets","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),

  -- Current Liabilities & Taxes
  ('2000-02', '{"id":"2000-02","code":"2000-02","name":"INCOME TAX PAYABLE","account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('2000-03', '{"id":"2000-03","code":"2000-03","name":"PENSION TAX PAYABLE","account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('2000-04', '{"id":"2000-04","code":"2000-04","name":"WHT PAYABLE","account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('2000-05', '{"id":"2000-05","code":"2000-05","name":"VAT PAYABLE","account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('2100-06', '{"id":"2100-06","code":"2100-06","name":"OTHER ACCRUALS","account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),

  -- Equity
  ('3000', '{"id":"3000","code":"3000","name":"SHARE CAPITAL","account_type":"Equity","peachtree_type":"Equity","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('3200', '{"id":"3200","code":"3200","name":"RETAINED EARNINGS","account_type":"Equity","peachtree_type":"Equity","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),

  -- Income / Revenue
  ('4000-01-01', '{"id":"4000-01-01","code":"4000-01-01","name":"SALES OF VETERINARY DRUG","account_type":"Revenue","peachtree_type":"Income","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('4000-03-02', '{"id":"4000-03-02","code":"4000-03-02","name":"CLEANING SERVICE","account_type":"Revenue","peachtree_type":"Income","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('4000-03-03', '{"id":"4000-03-03","code":"4000-03-03","name":"STORAGE","account_type":"Revenue","peachtree_type":"Income","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('4200', '{"id":"4200","code":"4200","name":"OTHER INCOME","account_type":"Revenue","peachtree_type":"Income","parent_account_id":null,"is_active":true,"is_group":false}'::jsonb, now(), now()),

  -- Cost of Sales
  ('6000', '{"id":"6000","code":"6000","name":"SELLING AND DISTRIBUTION","account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":null,"is_active":true,"is_group":true}'::jsonb, now(), now()),
  ('6000-01', '{"id":"6000-01","code":"6000-01","name":"SALARY AND BENEFIT","account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('6000-02', '{"id":"6000-02","code":"6000-02","name":"OVER TIME","account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('6000-04', '{"id":"6000-04","code":"6000-04","name":"PACKING AND BAGING","account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('6000-08', '{"id":"6000-08","code":"6000-08","name":"TRANSPORT COST","account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('6000-10', '{"id":"6000-10","code":"6000-10","name":"LOADING UNLOADING","account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('6000-22', '{"id":"6000-22","code":"6000-22","name":"OTHER","account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000","is_active":true,"is_group":false}'::jsonb, now(), now()),

  -- Operating Expenses
  ('8000', '{"id":"8000","code":"8000","name":"ADMINISTRATIVE & GENERAL EXPENSES","account_type":"Expense","peachtree_type":"Expenses","parent_account_id":null,"is_active":true,"is_group":true}'::jsonb, now(), now()),
  ('8000-01', '{"id":"8000-01","code":"8000-01","name":"SALARY AND WAGE","account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('8000-02', '{"id":"8000-02","code":"8000-02","name":"TRANSPORT ALLOWANCE","account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('8000-06', '{"id":"8000-06","code":"8000-06","name":"PENSION CONTRIBUTION","account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('8000-07', '{"id":"8000-07","code":"8000-07","name":"STATIONERY, PRINTING & OFF SUP","account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('8000-08', '{"id":"8000-08","code":"8000-08","name":"OFFICE RENT","account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('8000-09', '{"id":"8000-09","code":"8000-09","name":"TELEPHONE AND INTERNET","account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('8000-16', '{"id":"8000-16","code":"8000-16","name":"INSURANCE","account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('8000-18', '{"id":"8000-18","code":"8000-18","name":"AUDIT FEE & PROFFESSIONAL FEE","account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('8000-25', '{"id":"8000-25","code":"8000-25","name":"BANK SERVICE CHARGE","account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('8000-28', '{"id":"8000-28","code":"8000-28","name":"PENALITY","account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000","is_active":true,"is_group":false}'::jsonb, now(), now()),
  ('8000-30', '{"id":"8000-30","code":"8000-30","name":"MICELLANOUS","account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000","is_active":true,"is_group":false}'::jsonb, now(), now())
on conflict (id) do update
set payload = excluded.payload, updated_at = now();

-- 3. Seed Standard Tax Rules
select public.create_hkc_document_table('tax_rules');

insert into public.tax_rules (id, payload, created_at, updated_at)
values
  ('TAX-VAT-15', '{"id":"TAX-VAT-15","name":"Standard VAT (15%)","ratePercent":15,"type":"VAT/GST","accountCode":"2000-05","isInclusive":false,"isDeduction":false,"appliesTo":"BOTH","description":"Standard 15% Ethiopian Value Added Tax (Output VAT / Input VAT)","is_active":true}'::jsonb, now(), now()),
  ('TAX-WHT-2', '{"id":"TAX-WHT-2","name":"Withholding Tax (2% Services)","ratePercent":2,"type":"Withholding Tax (TDS)","accountCode":"1320-06-01","isInclusive":false,"isDeduction":true,"appliesTo":"BOTH","description":"2% Tax Deducted at Source for commercial service contracts","is_active":true}'::jsonb, now(), now()),
  ('TAX-WHT-3', '{"id":"TAX-WHT-3","name":"Withholding Tax (3% Goods/Rent)","ratePercent":3,"type":"Withholding Tax (TDS)","accountCode":"1320-06-01","isInclusive":false,"isDeduction":true,"appliesTo":"BOTH","description":"3% Withholding Tax asset deducted on goods supplies and rental","is_active":true}'::jsonb, now(), now()),
  ('TAX-TOT-2', '{"id":"TAX-TOT-2","name":"Turnover Tax (2% TOT)","ratePercent":2,"type":"Turnover Tax (TOT)","accountCode":"2000-05","isInclusive":false,"isDeduction":false,"appliesTo":"SALES","description":"2% Turnover Tax for non-VAT registered service transactions","is_active":true}'::jsonb, now(), now()),
  ('TAX-ZERO', '{"id":"TAX-ZERO","name":"Zero-Rated / Export Exempt (0%)","ratePercent":0,"type":"Exempt","accountCode":"2000-05","isInclusive":false,"isDeduction":false,"appliesTo":"BOTH","description":"Zero-rated export commodities (Green Mung, Sesame) and exempt supplies","is_active":true}'::jsonb, now(), now())
on conflict (id) do update
set payload = excluded.payload, updated_at = now();

-- 4. Seed Standard Tax Schedules (Multi-Tax Bundles)
select public.create_hkc_document_table('tax_schedules');

insert into public.tax_schedules (id, payload, created_at, updated_at)
values
  ('SCH-DOM-VAT', '{"id":"SCH-DOM-VAT","name":"Standard Domestic Sale (15% VAT)","taxRuleIds":["TAX-VAT-15"],"appliesTo":"SALES","isDefault":true,"description":"Standard 15% VAT for domestic commercial clients"}'::jsonb, now(), now()),
  ('SCH-GOV-WHT-2', '{"id":"SCH-GOV-WHT-2","name":"Gov & Corp Agency (15% VAT + 2% WHT)","taxRuleIds":["TAX-VAT-15","TAX-WHT-2"],"appliesTo":"SALES","isDefault":false,"description":"15% VAT added and 2% Withholding Tax deducted at source by withholding agent"}'::jsonb, now(), now()),
  ('SCH-GOV-WHT-3', '{"id":"SCH-GOV-WHT-3","name":"Gov Goods Supply (15% VAT + 3% WHT)","taxRuleIds":["TAX-VAT-15","TAX-WHT-3"],"appliesTo":"SALES","isDefault":false,"description":"15% VAT added and 3% Withholding Tax deducted on supplies to public bodies"}'::jsonb, now(), now()),
  ('SCH-EXP-ZERO', '{"id":"SCH-EXP-ZERO","name":"Export & Agri Commodity (0% Exempt)","taxRuleIds":["TAX-ZERO"],"appliesTo":"BOTH","isDefault":false,"description":"0% Tax for international buyers and raw agricultural commodity trade"}'::jsonb, now(), now()),
  ('SCH-PUR-WHT-2', '{"id":"SCH-PUR-WHT-2","name":"Purchase with 2% Supplier WHT","taxRuleIds":["TAX-VAT-15","TAX-WHT-2"],"appliesTo":"PURCHASES","isDefault":true,"description":"Standard purchase with 15% Input VAT and 2% WHT withheld from vendor payout"}'::jsonb, now(), now())
on conflict (id) do update
set payload = excluded.payload, updated_at = now();
