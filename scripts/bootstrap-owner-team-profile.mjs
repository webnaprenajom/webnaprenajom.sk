/**
 * Idempotent: ensure every owner in user_roles has a team_profiles row.
 * Usage: node scripts/bootstrap-owner-team-profile.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnvFile(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function namesFromEmail(email) {
  const local = (email.split("@")[0] || "owner").replace(/[._-]+/g, " ").trim() || "Owner";
  const displayName = local
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return { displayName, implementerName: displayName };
}

const env = { ...loadEnvFile(".env"), ...loadEnvFile(".env.team") };
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: owners, error: ownersErr } = await admin.from("user_roles").select("user_id").eq("role", "owner");
if (ownersErr) {
  console.error("user_roles read failed:", ownersErr.message);
  process.exit(1);
}

if (!owners?.length) {
  console.log("no_owners_found");
  process.exit(0);
}

for (const { user_id: userId } of owners) {
  const { data: existing } = await admin.from("team_profiles").select("user_id").eq("user_id", userId).maybeSingle();
  if (existing) {
    console.log("team_profile_exists", userId);
    continue;
  }

  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId);
  if (userErr || !userData?.user) {
    console.error("getUserById failed", userId, userErr?.message);
    process.exit(1);
  }

  const email = userData.user.email || "";
  const { displayName, implementerName } = namesFromEmail(email);

  const { error: profileErr } = await admin.from("team_profiles").upsert(
    {
      user_id: userId,
      display_name: displayName,
      implementer_name: implementerName,
      active: true,
    },
    { onConflict: "user_id" },
  );

  if (profileErr) {
    console.error("team_profiles upsert failed", userId, profileErr.message);
    process.exit(1);
  }

  console.log("team_profile_created", { user_id: userId, implementer_name: implementerName });
}
