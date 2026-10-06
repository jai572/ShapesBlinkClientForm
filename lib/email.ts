import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { SALON_NAME } from "@/lib/constants";

// Sends through the salon's Gmail account using an app password (SMTP).
// Env (set in Vercel):
//   GMAIL_USER          the Gmail address to send from
//   GMAIL_APP_PASSWORD  a Google "app password" for that account
//   EMAIL_FROM_NAME     optional display name (default: the salon name)
//   EMAIL_REPLY_TO      optional reply-to address
// EMAIL_TRANSPORT=json is a local-testing switch that "sends" nowhere; it is
// ignored on Vercel so it can never silently swallow real emails.
export type EmailMode = "gmail" | "json" | "off";

export function emailMode(): EmailMode {
  if (process.env.EMAIL_TRANSPORT === "json" && !process.env.VERCEL) return "json";
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return "gmail";
  return "off";
}

let cached: Transporter | null = null;

function transporter(): Transporter {
  if (cached) return cached;
  cached =
    emailMode() === "json"
      ? nodemailer.createTransport({ jsonTransport: true })
      : nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: { user: process.env.GMAIL_USER!, pass: process.env.GMAIL_APP_PASSWORD!.replace(/\s+/g, "") },
        });
  return cached;
}

export async function sendMail(message: { to: string; subject: string; text: string; html: string }) {
  if (emailMode() === "off") throw new Error("Email is not connected.");
  await transporter().sendMail({
    from: { name: process.env.EMAIL_FROM_NAME || SALON_NAME, address: process.env.GMAIL_USER || "noreply@example.invalid" },
    replyTo: process.env.EMAIL_REPLY_TO || undefined,
    ...message,
  });
}
