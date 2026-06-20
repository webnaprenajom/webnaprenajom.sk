import type { SupabaseClient } from "@supabase/supabase-js";

export const MIN_PASSWORD_LENGTH = 6;

export type PasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function validatePasswordChange(
  input: PasswordChangeInput,
  minLength = MIN_PASSWORD_LENGTH,
): { ok: true } | { ok: false; message: string } {
  const current = input.currentPassword.trim();
  const next = input.newPassword;
  const confirm = input.confirmPassword;

  if (!current) {
    return { ok: false, message: "Zadajte aktuálne heslo." };
  }
  if (!next) {
    return { ok: false, message: "Zadajte nové heslo." };
  }
  if (next.length < minLength) {
    return { ok: false, message: `Nové heslo musí mať aspoň ${minLength} znakov.` };
  }
  if (next !== confirm) {
    return { ok: false, message: "Nové heslo a potvrdenie sa nezhodujú." };
  }
  if (next === current) {
    return { ok: false, message: "Nové heslo musí byť odlišné od aktuálneho." };
  }
  return { ok: true };
}

export async function changeOwnPassword(
  supabase: SupabaseClient,
  email: string,
  input: PasswordChangeInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const validation = validatePasswordChange(input);
  if (!validation.ok) return validation;

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: input.currentPassword.trim(),
  });
  if (signInError) {
    return { ok: false, message: "Aktuálne heslo nie je správne." };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: input.newPassword });
  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  return { ok: true };
}
