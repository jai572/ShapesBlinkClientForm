"use server";

import { timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function fail(message: string): never {
  redirect(`/console/login?error=${encodeURIComponent(message)}`);
}

// Legacy check against the ADMIN_PIN env var. Only used until a PIN has been
// stored in the database (see supabase/migrations/0005_console_pin.sql).
function matchesEnvPin(pin: string) {
  const expected = process.env.ADMIN_PIN;
  if (!expected) return false;
  const a = Buffer.from(pin);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function login(formData: FormData) {
  const pin = String(formData.get("pin") ?? "");

  // Basic throttle against automated PIN guessing.
  await new Promise((resolve) => setTimeout(resolve, 800));

  const supabase = await createClient();
  const { data, error: pinError } = await supabase.rpc("console_pin_check", { p_pin: pin });

  if (data?.error === "locked") {
    fail("Too many attempts. Try again in 15 minutes.");
  }

  const pinOk = data?.ok === true || ((pinError || data?.error === "unset") && matchesEnvPin(pin));
  if (!pinOk) {
    fail("Invalid PIN");
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.ADMIN_EMAIL!,
    password: process.env.ADMIN_PASSWORD!,
  });

  if (error) {
    fail("Login is misconfigured. Contact the site admin.");
  }

  redirect("/console");
}
