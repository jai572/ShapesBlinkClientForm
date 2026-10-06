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
