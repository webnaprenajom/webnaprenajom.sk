/**
 * One-shot team DB owner bootstrap (run after fresh reset).
 * Usage: node scripts/bootstrap-team-owner.mjs you@email.com
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

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

const email = (process.argv[2] || "maros@salelogics.sk").trim().toLowerCase();
const env = { ...loadEnvFile(".env"), ...loadEnvFile(".env.team") };
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.team or .env");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const tempPassword = randomBytes(12).toString("base64url");

const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const user = existing?.users?.find((u) => u.email?.toLowerCase() === email);

let userId = user?.id;
if (!userId) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });
  if (error) {
    console.error("createUser failed:", error.message);
    process.exit(1);
  }
  userId = data.user.id;
  console.log("created_auth_user", email);
  console.log("temp_password", tempPassword);
} else {
  console.log("auth_user_exists", email, userId);
}

const { data: grant, error: grantError } = await admin.rpc("grant_crm_owner_by_email", { p_email: email });
if (grantError) {
  console.error("grant_crm_owner_by_email failed:", grantError.message);
  process.exit(1);
}

console.log("grant_result", JSON.stringify(grant));

// Idempotent team_profiles for owner (RBAC implementer_name lookup).
const displayName =
  email.split("@")[0]?.replace(/[._-]+/g, " ").trim() || "Owner";
const implementerName = displayName
  .split(/\s+/)
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  .join(" ");

const { data: existingProfile } = await admin
  .from("team_profiles")
  .select("user_id")
  .eq("user_id", userId)
  .maybeSingle();

if (!existingProfile) {
  const { error: profileError } = await admin.from("team_profiles").upsert(
    {
      user_id: userId,
      display_name: displayName,
      implementer_name: implementerName,
      active: true,
    },
    { onConflict: "user_id" },
  );
  if (profileError) {
    console.error("team_profiles upsert failed:", profileError.message);
    process.exit(1);
  }
  console.log("team_profile_created", { user_id: userId, implementer_name: implementerName });
} else {
  console.log("team_profile_exists", userId);
}
