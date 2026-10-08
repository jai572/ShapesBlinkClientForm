"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { sendEmailBatch, sendTestEmail } from "@/app/relocation/contacts/actions";
import { DEFAULT_BODY, DEFAULT_SUBJECT, EMAIL_FOOTER, draftMarkers, firstName, personalise } from "@/lib/emailTemplate";
import { emailKey, findSharedAddresses, toUkMobile, type RelocationContact, type SmsOverview } from "@/lib/relocationTypes";
import SmsComposer from "@/components/SmsComposer";

type Group = "unsent" | "sent" | "shared";
type Filter = "all" | Group;

const BATCH_SIZE = 8; // must not exceed the server-side limit in actions.ts

const formatWhen = (iso: string, withTime = true) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    ...(withTime ? { year: "numeric", hour: "2-digit", minute: "2-digit" } : {}),
  });

interface Props {
  contacts: RelocationContact[];
  emailMode: "gmail" | "json" | "off";
  /** null when texting isn't set up in the database yet */
  sms: SmsOverview | null;
}

export default function RelocationContactsList({ contacts, emailMode, sms }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"email" | "text" | null>(null);
  const selecting = mode !== null;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<{ sent: number; failed: number; failures: { name: string; error: string }[]; stopped?: string } | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const shared = useMemo(() => findSharedAddresses(contacts), [contacts]);
  const groupOf = (c: RelocationContact): Group =>
    shared.has(emailKey(c.email)) ? "shared" : c.email_sent_at ? "sent" : "unsent";

  // Not emailed first, then emailed, then shared addresses (need a phone call).
  const ordered = useMemo(() => {
    const rank: Record<Group, number> = { unsent: 0, sent: 1, shared: 2 };
    return contacts
      .map((c, i) => ({ c, i, g: groupOf(c) }))
      .sort((a, b) => rank[a.g] - rank[b.g] || a.i - b.i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, shared]);

  const counts = useMemo(() => {
    const n = { unsent: 0, sent: 0, shared: 0 };
    for (const { g } of ordered) n[g]++;
    return n;
  }, [ordered]);

  const visible = ordered.filter(({ g }) => filter === "all" || g === filter);
  const smsByNumber = useMemo(() => new Map((sms?.items ?? []).map((i) => [i.to_number, i])), [sms]);
  const smsOf = (c: RelocationContact) => smsByNumber.get(toUkMobile(c.phone) ?? "");
  // Texting: any valid UK mobile that hasn't been texted (or whose text failed).
  const textEligible = (c: RelocationContact) => {
    if (!sms || !toUkMobile(c.phone)) return false;
    const item = smsOf(c);
    return !item || item.status === "failed";
  };
  const selectable = (c: RelocationContact, g: Group) => (mode === "text" ? textEligible(c) : g === "unsent");

  // One email per distinct address (one text per distinct number), however many rows are ticked.
  const recipients = useMemo(() => {
    const seen = new Set<string>();
    const out: RelocationContact[] = [];
    for (const { c, g } of ordered) {
      if (!selected.has(c.id) || !selectable(c, g)) continue;
      const key = mode === "text" ? (toUkMobile(c.phone) ?? c.id) : emailKey(c.email);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
    return out;
  }, [ordered, selected, mode, sms]);

  const markers = draftMarkers(subject, body);
  const sending = progress !== null;
  const emailOff = emailMode === "off";

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAllVisible = () =>
    setSelected(new Set(visible.filter(({ c, g }) => selectable(c, g)).map(({ c }) => c.id)));

  // Texting only: everyone who can't be emailed but has a mobile number.
  const selectCantEmail = () =>
    setSelected(new Set(ordered.filter(({ c, g }) => g === "shared" && textEligible(c)).map(({ c }) => c.id)));

  const endSelecting = () => {
    setMode(null);
    setSelected(new Set());
    setComposing(false);
  };

  const closeCompose = () => {
    setComposing(false);
    setConfirming(false);
    setSummary(null);
    setTestMsg(null);
    if (summary) endSelecting();
  };

  const runTest = async () => {
    setTesting(true);
    setTestMsg(null);
    const res = await sendTestEmail(testTo, subject, body);
    setTestMsg(res.ok ? { ok: true, text: `Test sent to ${testTo.trim()}. Check the inbox (and spam).` } : { ok: false, text: res.error ?? "Send failed" });
    setTesting(false);
  };

  const runSend = async () => {
    setConfirming(false);
    setSummary(null);
    const ids = recipients.map((r) => r.id);
    const totals = { sent: 0, failed: 0, failures: [] as { name: string; error: string }[], stopped: undefined as string | undefined };
    setProgress({ done: 0, total: ids.length });

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const res = await sendEmailBatch(ids.slice(i, i + BATCH_SIZE), subject, body);
      if (!res.ok) {
        totals.stopped = res.error;
        break;
      }
      totals.sent += res.sent;
      totals.failed += res.failed;
      totals.failures.push(...res.failures);
      setProgress({ done: Math.min(i + BATCH_SIZE, ids.length), total: ids.length });
    }

    setProgress(null);
    setSummary(totals);
    router.refresh();
  };

  const badge = (c: RelocationContact, g: Group) => {
    if (g === "sent")
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-700">
          Email sent{c.email_sent_at ? ` · ${formatWhen(c.email_sent_at, false)}` : ""}
        </span>
      );
    if (g === "shared")
      return (
        <span
          title="This email address is used by many different phone numbers, so it can't reach this person. Contact them by phone."
          className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-amber-700"
        >
          Shared email · call instead
        </span>
      );
    if (c.email_status === "failed")
      return (
        <span title={c.email_error ?? undefined} className="inline-flex rounded-full bg-red-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-red-700">
          Failed · can retry
        </span>
      );
    if (c.email_status === "sending")
      return <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-500">Sending…</span>;
    if (c.dup_count > 1)
      return <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-500">Same email ×{c.dup_count}</span>;
    return null;
  };

  const smsBadge = (c: RelocationContact) => {
    const item = smsOf(c);
    if (!item) return null;
    if (item.status === "sent")
      return (
        <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-700">
          Text sent{item.sent_at ? ` · ${formatWhen(item.sent_at, false)}` : ""}
        </span>
      );
    if (item.status === "failed")
      return (
        <span title={item.error ?? undefined} className="inline-flex rounded-full bg-red-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-red-700">
          Text failed · can retry
        </span>
      );
    return <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-500">Text queued</span>;
  };

  const checkbox = (c: RelocationContact, g: Group) =>
    selectable(c, g) ? (
      <input
        type="checkbox"
        aria-label={`Select ${c.customer_name}`}
        checked={selected.has(c.id)}
        onChange={() => toggle(c.id)}
        className="h-5 w-5 shrink-0 cursor-pointer rounded accent-indigo-600"
      />
    ) : (
      <input type="checkbox" disabled aria-label="Cannot be emailed" className="h-5 w-5 shrink-0 rounded opacity-30" />
    );

  const chip = (value: Filter, label: string, n: number) => (
    <button
      key={value}
      type="button"
      onClick={() => setFilter(value)}
      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-all sm:px-4 sm:py-2 ${
        filter === value ? "bg-indigo-600 text-white shadow-lg" : "bg-white text-slate-500 border border-slate-200 hover:border-indigo-200"
      }`}
    >
      {label} · {n}
    </button>
  );

  const previewName = recipients[0]?.customer_name ?? "Neha";

  const sharedNote = (
    <>
      {counts.shared} sign-ups used one shared email address, so email can&rsquo;t reach them. Contact them by phone &mdash; they can&rsquo;t be selected.
    </>
  );
  const startsSharedGroup = (i: number) => visible[i].g === "shared" && (i === 0 || visible[i - 1].g !== "shared");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Fixed: everything above the names stays put; only the list scrolls. */}
      <div className="shrink-0">
        <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Sign-ups</h2>
            <p className="mt-0.5 hidden text-sm font-medium text-slate-500 sm:block">Customers waiting for your new address.</p>
          </div>
          <div className="flex shrink-0 items-center gap-3 sm:gap-5">
            <div className="text-right">
              <p className="text-2xl font-black leading-none text-indigo-600 sm:text-3xl">{contacts.length}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Total</p>
            </div>
            {!selecting && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode("email")}
                  className="rounded-2xl bg-indigo-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95 sm:px-6 sm:py-4"
                >
                  Email clients
                </button>
                <button
                  type="button"
                  disabled={!sms}
                  title={sms ? undefined : "Texting isn't set up yet"}
                  onClick={() => setMode("text")}
                  className="rounded-2xl border border-indigo-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-indigo-700 transition-all hover:bg-indigo-50 active:scale-95 disabled:opacity-40 sm:px-6 sm:py-4"
                >
                  Text clients
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:mb-4 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {chip("all", "All", contacts.length)}
          {chip("unsent", "Not emailed", counts.unsent)}
          {chip("sent", "Emailed", counts.sent)}
          {counts.shared > 0 && chip("shared", "Shared email", counts.shared)}
        </div>

        {selecting && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-100 bg-white p-3 shadow-md sm:mb-4 sm:gap-3 sm:p-4">
            <p className="mr-auto text-sm font-bold text-slate-700">
              {recipients.length} {recipients.length === 1 ? "person" : "people"} selected
            </p>
            {mode === "text" && counts.shared > 0 && (
              <button type="button" onClick={selectCantEmail} className="rounded-xl border border-amber-200 px-3 py-2 text-xs font-black uppercase tracking-wider text-amber-700 hover:bg-amber-50 sm:px-4">
                Select all who can&rsquo;t be emailed
              </button>
            )}
            <button type="button" onClick={selectAllVisible} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 sm:px-4">
              {mode === "text" ? "Select all not texted" : "Select all not emailed"}
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 sm:px-4">
              Clear
            </button>
            <button type="button" onClick={endSelecting} className="rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-100 sm:px-4">
              Cancel
            </button>
            <button
              type="button"
              disabled={recipients.length === 0}
              onClick={() => setComposing(true)}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg hover:bg-indigo-700 disabled:opacity-40"
            >
              {mode === "text" ? "Write text →" : "Write email →"}
            </button>
          </div>
        )}
      </div>

      {/* Scrolls: the list. On wider screens it is a card with pinned column names. */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-4 sm:rounded-[2rem] sm:border sm:border-slate-100 sm:bg-white sm:pb-0 sm:shadow-sm">
        {visible.length === 0 ? (
          <div className="rounded-[2rem] border border-slate-100 bg-white p-10 text-center font-medium text-slate-500 sm:border-0">Nothing to show here.</div>
        ) : (
          <>
            {/* Phones: one card per customer */}
            <ul className="space-y-3 sm:hidden">
              {visible.map(({ c, g }, i) => (
                <li key={c.id} className="list-none">
                  {startsSharedGroup(i) && (
                    <p className="mb-3 mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">{sharedNote}</p>
                  )}
                  <div className="flex gap-4 rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm">
                    {selecting && <div className="pt-1">{checkbox(c, g)}</div>}
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-black text-slate-900">{c.customer_name}</p>
                      <a href={`tel:${c.phone}`} className="mt-2 block font-semibold text-indigo-600">{c.phone}</a>
                      <a href={`mailto:${c.email}`} className="mt-1 block break-all font-medium text-slate-600">{c.email}</a>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {badge(c, g)}
                        {smsBadge(c)}
                        <span className="text-xs font-medium text-slate-400">{formatWhen(c.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Tablets and desktops: table with pinned column names */}
            <table className="hidden w-full text-left sm:table">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {selecting && <th className="sticky top-0 z-10 w-12 bg-slate-50 py-4 pl-6 shadow-[0_1px_0_0_#f1f5f9]" />}
                  <th className="sticky top-0 z-10 bg-slate-50 px-6 py-4 shadow-[0_1px_0_0_#f1f5f9]">Customer Name</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-6 py-4 shadow-[0_1px_0_0_#f1f5f9]">Phone Number</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-6 py-4 shadow-[0_1px_0_0_#f1f5f9]">Email</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-6 py-4 shadow-[0_1px_0_0_#f1f5f9]">Submitted</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-6 py-4 shadow-[0_1px_0_0_#f1f5f9]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map(({ c, g }, i) => (
                  <Fragment key={c.id}>
                    {startsSharedGroup(i) && (
                      <tr>
                        <td colSpan={selecting ? 6 : 5} className="bg-amber-50 px-6 py-3 text-sm font-semibold text-amber-800">{sharedNote}</td>
                      </tr>
                    )}
                    <tr className={`font-medium text-slate-700 ${g === "sent" ? "bg-emerald-50/30" : ""}`}>
                      {selecting && <td className="py-4 pl-6">{checkbox(c, g)}</td>}
                      <td className="px-6 py-4 font-bold text-slate-900">{c.customer_name}</td>
                      <td className="px-6 py-4"><a href={`tel:${c.phone}`} className="text-indigo-600 hover:underline">{c.phone}</a></td>
                      <td className="break-all px-6 py-4"><a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a></td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">{formatWhen(c.created_at)}</td>
                      <td className="px-6 py-4"><div className="flex flex-col items-start gap-1">{badge(c, g)}{smsBadge(c)}</div></td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {composing && mode === "email" && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/50 sm:p-6" role="dialog" aria-modal="true" aria-label="Write email">
          <div className="mx-auto min-h-full max-w-2xl bg-white p-5 sm:min-h-0 sm:rounded-[2rem] sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black tracking-tight text-slate-900">Write email</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  To {recipients.length} {recipients.length === 1 ? "person" : "people"}, each addressed by first name.
                </p>
              </div>
              <button type="button" disabled={sending} onClick={closeCompose} className="rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-100 disabled:opacity-40">
                Close
              </button>
            </div>

            {emailOff && (
              <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                Email isn&rsquo;t connected yet &mdash; the Gmail details haven&rsquo;t been added in Vercel. You can write and preview, but not send.
              </p>
            )}
            {markers.length > 0 && (
              <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                This is still a draft (it contains {markers.join(" and ")}). You can send a test to yourself, but sending to clients is blocked until those are removed.
              </p>
            )}

            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400" htmlFor="subject">Subject</label>
            <input id="subject" value={subject} maxLength={200} disabled={sending} onChange={(e) => setSubject(e.target.value)} className="mb-5 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-base font-medium" />

            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400" htmlFor="body">
              Message <span className="normal-case tracking-normal text-slate-400">&mdash; <code>{"{name}"}</code> becomes each person&rsquo;s first name</span>
            </label>
            <textarea id="body" rows={12} value={body} maxLength={10000} disabled={sending} onChange={(e) => setBody(e.target.value)} className="mb-5 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-base font-medium leading-relaxed" />

            <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Preview for {firstName(previewName)}</p>
            <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm leading-relaxed text-slate-700">
              <p className="mb-3 font-bold text-slate-900">{personalise(subject, previewName)}</p>
              <p className="whitespace-pre-wrap">{personalise(body, previewName)}</p>
              <p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-400">{EMAIL_FOOTER}</p>
            </div>

            <div className="mb-6 rounded-2xl border border-slate-100 p-4">
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400" htmlFor="testTo">Send a test to yourself first</label>
              <div className="flex flex-wrap gap-3">
                <input id="testTo" type="email" inputMode="email" placeholder="you@example.com" value={testTo} disabled={sending} onChange={(e) => setTestTo(e.target.value)} className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-base font-medium" />
                <button type="button" disabled={emailOff || testing || sending || !testTo.trim()} onClick={runTest} className="rounded-2xl border border-indigo-200 px-5 py-3 text-xs font-black uppercase tracking-wider text-indigo-700 hover:bg-indigo-50 disabled:opacity-40">
                  {testing ? "Sending…" : "Send test"}
                </button>
              </div>
              {testMsg && <p className={`mt-2 text-sm font-semibold ${testMsg.ok ? "text-emerald-700" : "text-red-600"}`}>{testMsg.text}</p>}
            </div>

            {progress && (
              <div className="mb-5" aria-live="polite">
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-indigo-600 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-600">Sending… {progress.done} of {progress.total}. Please keep this page open.</p>
              </div>
            )}

            {summary && (
              <div className="mb-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-medium text-slate-700" aria-live="polite">
                <p className="font-bold text-slate-900">Sent {summary.sent}{summary.failed > 0 ? `, ${summary.failed} failed` : ""}.</p>
                {summary.stopped && <p className="mt-1 text-red-600">Stopped early: {summary.stopped}</p>}
                {summary.failures.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-red-600">
                    {summary.failures.map((f, i) => <li key={i}>{f.name}: {f.error}</li>)}
                  </ul>
                )}
                <p className="mt-2 text-slate-500">Emailed people have moved down the list. Anyone who failed stays on top so you can retry.</p>
              </div>
            )}

            {confirming ? (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="mr-auto text-sm font-bold text-red-800">Send to {recipients.length} {recipients.length === 1 ? "person" : "people"}? This can&rsquo;t be undone.</p>
                <button type="button" onClick={() => setConfirming(false)} className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-white">Back</button>
                <button type="button" onClick={runSend} className="rounded-xl bg-red-600 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-red-700">Yes, send now</button>
              </div>
            ) : (
              <button
                type="button"
                disabled={emailOff || markers.length > 0 || sending || recipients.length === 0 || !subject.trim() || !body.trim() || summary !== null}
                onClick={() => setConfirming(true)}
                className="w-full rounded-2xl bg-indigo-600 py-5 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-40"
              >
                Send to {recipients.length} {recipients.length === 1 ? "person" : "people"}
              </button>
            )}
          </div>
        </div>
      )}
      {composing && mode === "text" && sms && (
        <SmsComposer
          recipients={recipients}
          initial={sms}
          onClose={() => {
            setComposing(false);
            router.refresh();
          }}
          onQueued={() => {
            endSelecting();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
