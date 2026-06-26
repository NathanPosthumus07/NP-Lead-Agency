// ============================================================
//  NpStudio — project configuration
//  This is the ONLY file you need to edit to connect your app.
// ============================================================
//
//  ⚠️  NEVER put your Supabase SECRET key in this file.
//      Only the *publishable* (anon) key belongs here — it is
//      designed to be public and is protected by the row-level
//      security rules in schema.sql.
//
window.NP_CONFIG = {
  // From Supabase → Settings → API
  SUPABASE_URL: "https://yauznqjxpawrnsnjpitq.supabase.co",

  // The PUBLISHABLE / anon key (safe for the browser)
  SUPABASE_ANON_KEY: "sb_publishable_2LuEkefgF_uYdRoumo5lkA_5bBdcyAC",

  // Optional: lock the workspace to just the two of you.
  // Leave [] to let anyone who signs up in. To restrict, add your
  // two emails, e.g. ["nate@npstudio.co", "phoebe@npstudio.co"]
  ALLOWED_EMAILS: [],

  // Cosmetic: maps a person's name to their accent color.
  PEOPLE: {
    "Nate":   "#6d4aff",
    "Phoebe": "#ec4899"
  }
};
