/**
 * supabase-client.js — initialises the Supabase client.
 * Leaf module: no imports from other project files.
 * The anon key is safe to expose in the browser when RLS is enabled on all tables.
 */

const SUPABASE_URL = 'https://oufldqfvllymlhipsdtu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nAd7H1ZK3yBLt8jPV3XKjQ_QA0kLgO2';

// supabase-js is loaded as a global from the CDN script in index.html
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
