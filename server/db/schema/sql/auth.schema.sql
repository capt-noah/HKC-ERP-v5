-- Authentication and RBAC Schema
-- Run this in the Supabase SQL editor for the project before using the server routes.

-- Create custom users table
CREATE TABLE IF NOT EXISTS public.users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('superadmin', 'sales_hr_manager', 'inventory_admin', 'finance_manager', 'hkc_docs_manager')),
  warehouse_id text, -- nullable, only strictly used for 'inventory_admin'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS set_updated_at ON public.users;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Only authenticated users/service_role can read users
DROP POLICY IF EXISTS "users authenticated read" ON public.users;
CREATE POLICY "users authenticated read" ON public.users FOR SELECT TO authenticated USING (true);

-- Only service_role can insert/update/delete (Superadmin actions will use service role logic on the backend)
DROP POLICY IF EXISTS "users service_role all" ON public.users;
CREATE POLICY "users service_role all" ON public.users TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.users FROM anon;
GRANT SELECT ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
