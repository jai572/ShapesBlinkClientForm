// Shared by server and client code (no "server-only" here).

export type EmailStatus = "sending" | "sent" | "failed";

export interface RelocationContact {
  id: string;
  created_at: string;
  customer_name: string;
  phone: string;
  email: string;
  email_sent_at: string | null;
  email_status: EmailStatus | null;
  email_error: string | null;
  dup_count: number;
}

// An address used by this many different phone numbers is not one person's
// inbox (e.g. staff typing in walk-ins). Such contacts are never emailed and
// need to be reached by phone. Must match relocation_viewer_claim_emails().
export const SHARED_ADDRESS_MIN_PHONES = 3;

export const emailKey = (email: string) => email.trim().toLowerCase();

export function findSharedAddresses(contacts: RelocationContact[]): Set<string> {
  const phonesByEmail = new Map<string, Set<string>>();
  for (const c of contacts) {
    const key = emailKey(c.email);
    const phones = phonesByEmail.get(key) ?? new Set<string>();
    phones.add(c.phone);
    phonesByEmail.set(key, phones);
  }
  const shared = new Set<string>();
  for (const [key, phones] of phonesByEmail) {
    if (phones.size >= SHARED_ADDRESS_MIN_PHONES) shared.add(key);
  }
  return shared;
}

// ---------------------------------------------------------------------------
// Texting (through the salon's own Android phone; see 0007_relocation_sms.sql)
// ---------------------------------------------------------------------------

export type SmsStatus = "queued" | "sending" | "sent" | "failed";

export interface SmsItem {
  to_number: string; // +447xxxxxxxxx
  status: SmsStatus;
  sent_at: string | null;
  error: string | null;
}

export interface SmsOverview {
  gateway_set: boolean;
  gateway_last_seen: string | null;
  hourly_limit: number;
  sent_last_hour: number;
  manual_waiting: number;
  counts: { queued: number; sending: number; sent: number; failed: number };
  test: { status: SmsStatus | "cancelled"; error: string | null; created_at: string } | null;
  items: SmsItem[];
}

// UK mobile (07xxx, +447xxx, 00447xxx, 4407xxx) -> +447xxxxxxxxx, else null.
// Must match relocation_to_e164() in the database.
export function toUkMobile(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  if (/^07[1-57-9]\d{8}$/.test(d)) return "+44" + d.slice(1);
  if (/^447[1-57-9]\d{8}$/.test(d)) return "+" + d;
  if (/^00447[1-57-9]\d{8}$/.test(d)) return "+" + d.slice(2);
  if (/^4407[1-57-9]\d{8}$/.test(d)) return "+44" + d.slice(3);
  return null;
}
