import "server-only";
import { createClient } from "@supabase/supabase-js";

// The relocation contacts viewer has its own login, separate from the
// consultation console. Credentials are checked inside Postgres (see
// supabase/migrations/0004_relocation_viewer.sql); this cookie only carries
// the opaque session token those functions hand back.
export const VIEWER_COOKIE = "relocation_viewer";
export const VIEWER_PATH = "/relocation/contacts";
export const VIEWER_SESSION_SECONDS = 12 * 60 * 60;

export interface RelocationContact {
  id: string;
  created_at: string;
  customer_name: string;
  phone: string;
  email: string;
}

export function createAnonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
