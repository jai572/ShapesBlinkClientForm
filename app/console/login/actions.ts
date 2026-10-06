"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const pin = formData.get("pin") as string;

  // Basic throttle against automated PIN guessing.
  await new Promise((resolve) => setTimeout(resolve, 800));

  if (pin !== process.env.ADMIN_PIN) {
    redirect(`/console/login?error=${encodeURIComponent("Invalid PIN")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.ADMIN_EMAIL!,
    password: process.env.ADMIN_PASSWORD!,
  });

  if (error) {
    redirect(`/console/login?error=${encodeURIComponent("Login is misconfigured. Contact the site admin.")}`);
  }

  redirect("/console");
}
