"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VIEWER_COOKIE, VIEWER_PATH, VIEWER_SESSION_SECONDS, createAnonClient } from "@/lib/relocationViewer";
import { draftMarkers, renderEmail } from "@/lib/emailTemplate";
import { emailMode, sendMail } from "@/lib/email";

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

// ---------------------------------------------------------------------------
// Emailing sign-ups. Every action re-checks the viewer session itself: server
// actions are public HTTP endpoints, so the page being gated is not enough.
// ---------------------------------------------------------------------------

const SESSION_EXPIRED = "Your session has expired. Please sign in again.";
const BATCH_SIZE = 8; // keeps one request well inside the serverless time limit
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type SendBatchResult =
  | { ok: true; sent: number; failed: number; skipped: number; failures: { name: string; error: string }[] }
  | { ok: false; error: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function sendEmailBatch(ids: string[], subject: string, body: string): Promise<SendBatchResult> {
  const token = (await cookies()).get(VIEWER_COOKIE)?.value;
  if (!token) return { ok: false, error: SESSION_EXPIRED };

  if (!Array.isArray(ids) || ids.length === 0 || ids.length > BATCH_SIZE || !ids.every((id) => UUID.test(id))) {
    return { ok: false, error: "Invalid recipient list." };
  }
  subject = String(subject ?? "").trim();
  body = String(body ?? "").trim();
  if (!subject || subject.length > 200 || !body || body.length > 10000) {
    return { ok: false, error: "Please enter a subject and a message." };
  }

  if (emailMode() === "off") {
    return { ok: false, error: "Email is not connected yet. Add the Gmail details in Vercel first." };
  }
  const markers = draftMarkers(subject, body);
  if (markers.length > 0) {
    return { ok: false, error: `This is still a draft. Remove ${markers.join(" and ")} before sending to clients.` };
  }

  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("relocation_viewer_claim_emails", { p_token: token, p_ids: ids });
  if (error) {
    return { ok: false, error: error.code === "28000" ? SESSION_EXPIRED : "Could not start sending. Please try again." };
  }

  const recipients = (data ?? []) as { id: string; customer_name: string; email: string }[];
  let sent = 0;
  const failures: { name: string; error: string }[] = [];

  for (const r of recipients) {
    const message = renderEmail(subject, body, r.customer_name);
    let ok = true;
    let reason: string | undefined;
    try {
      await sendMail({ to: r.email, ...message });
    } catch (err) {
      ok = false;
      reason = err instanceof Error ? err.message : "Send failed";
    }

    // Record the outcome; retry once so a blip cannot leave a sent email unmarked.
    let marked = false;
    for (let attempt = 0; attempt < 2 && !marked; attempt++) {
      const res = await supabase.rpc("relocation_viewer_mark_emails", {
        p_token: token,
        p_id: r.id,
        p_ok: ok,
        p_error: reason ?? null,
      });
      marked = !res.error;
    }

    if (ok) {
      sent++;
      if (!marked) failures.push({ name: r.customer_name, error: "Sent, but could not be recorded. Do not resend." });
    } else {
      failures.push({ name: r.customer_name, error: reason ?? "Send failed" });
    }
    await sleep(250);
  }

  return { ok: true, sent, failed: failures.length, skipped: ids.length - recipients.length, failures };
}

export async function sendTestEmail(to: string, subject: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const token = (await cookies()).get(VIEWER_COOKIE)?.value;
  if (!token) return { ok: false, error: SESSION_EXPIRED };

  const { data: valid } = await createAnonClient().rpc("relocation_viewer_session_valid", { p_token: token });
  if (!valid) return { ok: false, error: SESSION_EXPIRED };

  to = String(to ?? "").trim();
  subject = String(subject ?? "").trim();
  body = String(body ?? "").trim();
  if (!EMAIL.test(to) || to.length > 320) return { ok: false, error: "Enter a valid email address to send the test to." };
  if (!subject || subject.length > 200 || !body || body.length > 10000) {
    return { ok: false, error: "Please enter a subject and a message." };
  }
  if (emailMode() === "off") {
    return { ok: false, error: "Email is not connected yet. Add the Gmail details in Vercel first." };
  }

  try {
    await sendMail({ to, ...renderEmail(subject, body, "Test") });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Send failed" };
  }
}
