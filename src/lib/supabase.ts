import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Null until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set (see .env).
 * The anon/publishable key is meant to be public — Row Level Security in
 * supabase/schema.sql is what keeps each user's rows private.
 */
export const supabase = url && key ? createClient(url, key) : null;
