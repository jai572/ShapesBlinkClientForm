import { SALON_NAME } from "@/lib/constants";

// Shared by the compose screen (preview) and the server (actual send).

export const DEFAULT_SUBJECT = `[TEST] We're moving - ${SALON_NAME}`;

export const DEFAULT_BODY = `Dear {name},

This is a TEST email from ${SALON_NAME}. Please ignore it.

Due to unforeseen circumstances, we are moving to a new location. Our new address will be:

[NEW ADDRESS]

Thank you for your continued support.

${SALON_NAME}`;

export const EMAIL_FOOTER =
  "You are receiving this email because you left your contact details on our relocation page. " +
  "If you would rather not hear from us, just reply to this email and we will remove you.";

// Anything still in [TEST ...] or [NEW ADDRESS ...] brackets means the draft is
// not final. Sending to customers is blocked until these are gone.
const DRAFT_MARKER = /\[[^\]]*\b(?:TEST|NEW ADDRESS)\b[^\]]*\]/gi;

export function draftMarkers(subject: string, body: string): string[] {
  const found = new Set<string>();
  for (const text of [subject, body]) {
    for (const m of text.matchAll(DRAFT_MARKER)) found.add(m[0]);
  }
  return [...found];
}

// "neha patel" -> "Neha", "NEHA" -> "Neha", "McDonald" stays as typed.
export function firstName(fullName: string): string {
  const token = fullName.trim().split(/\s+/)[0] ?? "";
  const cleaned = token.replace(/^[^\p{L}]+|[^\p{L}'’-]+$/gu, "");
  if (!/\p{L}/u.test(cleaned)) return "there";
  const uniformCase = cleaned === cleaned.toLowerCase() || cleaned === cleaned.toUpperCase();
  if (!uniformCase) return cleaned;
  return cleaned.toLowerCase().replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function personalise(text: string, fullName: string): string {
  return text.replace(/\{name\}/gi, firstName(fullName));
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderEmail(subject: string, body: string, fullName: string) {
  const text = personalise(body, fullName).replace(/\r\n/g, "\n").trim();
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  return {
    subject: personalise(subject, fullName).replace(/[\r\n]+/g, " ").trim(),
    text: `${text}\n\n--\n${EMAIL_FOOTER}`,
    html:
      `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1f2937;max-width:560px">` +
      paragraphs +
      `<p style="margin:24px 0 0;padding-top:12px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">${escapeHtml(EMAIL_FOOTER)}</p>` +
      `</div>`,
  };
}
