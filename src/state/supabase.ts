import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The Supabase project behind accounts, or null when this build has none set up
 * (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing). Then accounts stay
 * hidden and UJI works exactly as it does without them, on this device only.
 * The publishable key is meant to be public: row-level security in
 * supabase/migrations decides who can read and write what.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/**
 * What brought the page here, read before the client tidies the address bar:
 * "signup" for an email-confirmation link, "recovery" for a forgot-password link.
 */
export const arrivedVia = typeof location === 'undefined' ? null : new URLSearchParams(location.hash.slice(1)).get('type');

export const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
