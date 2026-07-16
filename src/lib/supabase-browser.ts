import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase singleton.
 *
 * Uses the public anon key so it is safe to include in client bundles.
 * A module-level variable ensures only ONE GoTrueClient is ever created
 * per browser tab, eliminating the "Multiple GoTrueClient instances"
 * console warning.
 */
let _browserClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (!_browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
      );
    }

    _browserClient = createClient(url, key);
  }

  return _browserClient;
}
