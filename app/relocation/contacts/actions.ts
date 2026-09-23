"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VIEWER_COOKIE, VIEWER_PATH, VIEWER_SESSION_SECONDS, createAnonClient } from "@/lib/relocationViewer";

export async function login(formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  const { data, error } = await createAnonClient().rpc("relocation_viewer_login", {
    p_username: username,
    p_password: password,
  });

  if (error || !data?.ok) {
    const message =
      data?.error === "locked"
        ? "Too many attempts. Try again in 15 minutes."
        : error
          ? "Login is unavailable right now. Please try again."
          : "Incorrect user ID or password.";
    redirect(`${VIEWER_PATH}/login?error=${encodeURIComponent(message)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(VIEWER_COOKIE, data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: VIEWER_PATH,
    maxAge: VIEWER_SESSION_SECONDS,
  });

  redirect(VIEWER_PATH);
}

export async function logout() {
  const cookieStore = await cookies();
  const token = cookieStore.get(VIEWER_COOKIE)?.value;
  if (token) {
    await createAnonClient().rpc("relocation_viewer_logout", { p_token: token });
  }
  cookieStore.delete({ name: VIEWER_COOKIE, path: VIEWER_PATH });
  redirect(`${VIEWER_PATH}/login`);
}
