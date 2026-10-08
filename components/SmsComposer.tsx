"use client";

import { useEffect, useState } from "react";
import { cancelQueuedSms, createGatewayKey, getSmsOverview, queueSms, queueTestSms } from "@/app/relocation/contacts/actions";
import { DEFAULT_SMS, renderSms, smsDraftMarkers, smsLength } from "@/lib/smsTemplate";
import { firstName } from "@/lib/emailTemplate";
import type { RelocationContact, SmsOverview } from "@/lib/relocationTypes";

interface Props {
  recipients: RelocationContact[];
  initial: SmsOverview;
  onClose: () => void;
  onQueued: () => void;
  /** tap-to-text: close this and open the one-at-a-time screen */
  onStartTap: () => void;
}

const BASE = typeof window === "undefined" ? "" : window.location.origin;

export default function SmsComposer({ recipients, initial, onClose, onQueued, onStartTap }: Props) {
  const [method, setMethod] = useState<"tap" | "phone">("tap");
  const [overview, setOverview] = useState<SmsOverview>(initial);
  const [body, setBody] = useState(DEFAULT_SMS);
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState<"test" | "queue" | "stop" | "key" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Open the set-up steps until the phone has connected at least once.
  const [showSetup, setShowSetup] = useState(!initial.gateway_set || initial.gateway_last_seen === null);
  const [now, setNow] = useState(() => Date.now());

  // Live status of the phone and the queue.
  useEffect(() => {
    const t = setInterval(async () => {
      setNow(Date.now());
      const o = await getSmsOverview();
      if (o) setOverview(o);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const lastSeenAgo = overview.gateway_last_seen ? Math.max(0, Math.round((now - new Date(overview.gateway_last_seen).getTime()) / 1000)) : null;
  const phoneOnline = lastSeenAgo !== null && lastSeenAgo < 60;
  const markers = smsDraftMarkers(body);
  const previewName = recipients[0]?.customer_name ?? "Neha";
  const preview = renderSms(body, previewName);
  const len = smsLength(preview);
  const c = overview.counts;
  const waiting = c.queued + c.sending;
  const hoursLeft = Math.max(1, Math.ceil(waiting / overview.hourly_limit));
  const working = busy !== null;

  const run = async <T,>(what: typeof busy, fn: () => Promise<T>) => {
    setBusy(what);
    setNote(null);
    try {
      return await fn();
    } finally {
      setBusy(null);
    }
  };

  const sendTest = () =>
    run("test", async () => {
      const res = await queueTestSms(testTo, body);
      setNote(res.ok ? { ok: true, text: "Test text queued. It sends within about 20 seconds if the phone is connected." } : { ok: false, text: res.error ?? "Failed" });
      const o = await getSmsOverview();
      if (o) setOverview(o);
    });

  const queueAll = () =>
    run("queue", async () => {
      setConfirming(false);
      const res = await queueSms(recipients.map((r) => r.id), body, method);
      if (!res.ok) return setNote({ ok: false, text: res.error });
      if (method === "tap") {
        if (res.queued === 0) return setNote({ ok: false, text: "Nobody was added: they have already been texted, or have no valid UK mobile." });
        onStartTap();
        return;
      }
      setNote({ ok: true, text: `${res.queued} texts queued${res.skipped ? `, ${res.skipped} skipped (already texted or no valid mobile)` : ""}. They go out one at a time from the phone.` });
      const o = await getSmsOverview();
      if (o) setOverview(o);
      onQueued();
    });

  const stop = () =>
    run("stop", async () => {
      const res = await cancelQueuedSms();
      setNote(res.ok ? { ok: true, text: `Stopped. ${res.cancelled ?? 0} waiting texts were cancelled. Texts already sent can't be recalled.` } : { ok: false, text: res.error ?? "Failed" });
      const o = await getSmsOverview();
      if (o) setOverview(o);
    });

  const makeKey = () =>
    run("key", async () => {
      const res = await createGatewayKey();
      if (res.ok) {
        setNewKey(res.key);
        setCopied(false);
        const o = await getSmsOverview();
        if (o) setOverview(o);
      } else setNote({ ok: false, text: res.error });
    });

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const setupCommands = `pkg update && pkg install -y bash curl jq termux-api
printf '%s' '${newKey ?? "PASTE-YOUR-KEY-HERE"}' > ~/.shapes-sms-key
curl -fsS ${BASE}/api/sms/script -o ~/sms-gateway.sh && chmod +x ~/sms-gateway.sh
~/sms-gateway.sh`;

  const testStatus = overview.test;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/50 sm:p-6" role="dialog" aria-modal="true" aria-label="Write text message">
      <div className="mx-auto min-h-full max-w-2xl bg-white p-5 sm:min-h-0 sm:rounded-[2rem] sm:p-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-slate-900">Text clients</h3>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {recipients.length} {recipients.length === 1 ? "person" : "people"} selected, each addressed by first name.{method === "phone" ? " Sent one at a time from the salon phone." : " You send each one yourself from this phone."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-100">
            Close
          </button>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="How to send">
          {([
            ["tap", "Tap to text", "From this phone, one person at a time. You press send in your normal Messages app. No extra apps or permissions."],
            ["phone", "Automatic", "A script on the salon's Android phone (Termux) sends them for you, paced to protect the number."],
          ] as const).map(([value, title, text]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={method === value}
              onClick={() => setMethod(value)}
              className={`rounded-2xl border p-4 text-left transition-all ${method === value ? "border-indigo-600 bg-indigo-50 shadow-md" : "border-slate-200 bg-white hover:border-indigo-200"}`}
            >
              <span className="block text-sm font-black text-slate-900">{title}</span>
              <span className="mt-1 block text-xs font-medium leading-relaxed text-slate-500">{text}</span>
            </button>
          ))}
        </div>

        {method === "tap" && overview.manual_waiting > 0 && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm font-semibold text-indigo-900">
            <span>{overview.manual_waiting} people are still waiting from an earlier session.</span>
            <button type="button" onClick={onStartTap} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-indigo-700">
              Resume
            </button>
          </div>
        )}

        {method === "phone" && (
          <>
        <div className={`mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-4 text-sm font-semibold ${phoneOnline ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          <span>
            {phoneOnline
              ? `Phone connected (seen ${lastSeenAgo}s ago)`
              : overview.gateway_set
                ? lastSeenAgo === null
                  ? "Phone has not connected yet. Texts will wait in the queue until it does."
                  : "Phone not connected. Texts will wait in the queue until it is back."
                : "The phone isn't set up yet."}
          </span>
          <button type="button" onClick={() => setShowSetup((v) => !v)} className="text-xs font-black uppercase tracking-wider underline">
            {showSetup ? "Hide set-up" : "Set up the phone"}
          </button>
        </div>

        {showSetup && (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium leading-relaxed text-slate-700">
            <p className="mb-2 font-bold text-slate-900">One-time set-up on the salon&rsquo;s Android phone</p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Install <b>F-Droid</b> (f-droid.org), then from it install <b>Termux</b> and <b>Termux:API</b>. Use F-Droid&rsquo;s versions, not Google Play&rsquo;s.</li>
              <li>In Android settings, give <b>Termux:API</b> the <b>SMS</b> permission, and set Termux and Termux:API battery to <b>Unrestricted</b> so they keep running with the screen off.</li>
              <li>
                Press the button to create the phone&rsquo;s secret key. It is shown <b>once</b> and replaces any earlier key.
                <div className="mt-2">
                  <button type="button" disabled={working} onClick={makeKey} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-indigo-700 disabled:opacity-40">
                    {busy === "key" ? "Creating…" : newKey ? "Create a new key" : "Create key"}
                  </button>
                </div>
              </li>
              <li>Open Termux and paste these four lines (copy them with the button), then leave it running with the phone plugged in:</li>
            </ol>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">{setupCommands}</pre>
            <button type="button" disabled={!newKey} onClick={() => copy(setupCommands)} className="mt-2 rounded-xl border border-slate-300 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-white disabled:opacity-40">
              {copied ? "Copied" : newKey ? "Copy the four lines" : "Create the key first"}
            </button>
            <p className="mt-3 text-xs text-slate-500">Treat the key like a password: anyone with it can make the phone fetch and send queued texts. Create a new key any time to cut the old one off.</p>
          </div>
        )}

          </>
        )}

        {markers.length > 0 && (
          <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
            This is still a draft (it contains {markers.join(" and ")}). You can send a test text to your own mobile, but texting clients is blocked until those are removed.
          </p>
        )}

        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400" htmlFor="sms-body">
          Message <span className="normal-case tracking-normal text-slate-400">&mdash; <code>{"{name}"}</code> becomes each person&rsquo;s first name</span>
        </label>
        <textarea id="sms-body" rows={5} value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} className="mb-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-base font-medium leading-relaxed" />
        <p className={`mb-5 text-xs font-semibold ${len.parts > 2 || len.unicode ? "text-amber-700" : "text-slate-400"}`}>
          {len.chars} characters &middot; {len.parts} text{len.parts === 1 ? "" : "s"} each{len.unicode ? " (a special character such as a curly quote or emoji makes each text shorter)" : ""}
        </p>

        <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Preview for {firstName(previewName)}</p>
        <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm leading-relaxed text-slate-700">{preview}</div>

        {method === "phone" && (
          <>
        <div className="mb-6 rounded-2xl border border-slate-100 p-4">
          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400" htmlFor="sms-test">Send a test text to your own mobile first</label>
          <div className="flex flex-wrap gap-3">
            <input id="sms-test" type="tel" inputMode="tel" placeholder="07123 456789" value={testTo} onChange={(e) => setTestTo(e.target.value)} className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-base font-medium" />
            <button type="button" disabled={working || !testTo.trim()} onClick={sendTest} className="rounded-2xl border border-indigo-200 px-5 py-3 text-xs font-black uppercase tracking-wider text-indigo-700 hover:bg-indigo-50 disabled:opacity-40">
              {busy === "test" ? "Queuing…" : "Send test"}
            </button>
          </div>
          {testStatus && (
            <p className={`mt-2 text-sm font-semibold ${testStatus.status === "sent" ? "text-emerald-700" : testStatus.status === "failed" ? "text-red-600" : "text-slate-500"}`}>
              Last test: {testStatus.status === "sent" ? "sent" : testStatus.status === "failed" ? `failed${testStatus.error ? ` (${testStatus.error})` : ""}` : testStatus.status === "cancelled" ? "cancelled" : "waiting for the phone…"}
            </p>
          )}
        </div>

        {(waiting > 0 || c.sent > 0 || c.failed > 0) && (
          <div className="mb-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-medium text-slate-700" aria-live="polite">
            <p className="font-bold text-slate-900">
              Sent {c.sent} &middot; waiting {waiting} &middot; failed {c.failed}
            </p>
            <p className="mt-1 text-slate-500">
              To protect the salon number, at most {overview.hourly_limit} texts go out per hour ({overview.sent_last_hour} in the last hour).
              {waiting > 0 ? ` About ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"} left; keep the phone on and charged.` : ""}
            </p>
            {c.queued > 0 && (
              <button type="button" disabled={working} onClick={stop} className="mt-3 rounded-xl border border-red-200 px-4 py-2 text-xs font-black uppercase tracking-wider text-red-700 hover:bg-red-50 disabled:opacity-40">
                {busy === "stop" ? "Stopping…" : "Stop the remaining texts"}
              </button>
            )}
          </div>
        )}

          </>
        )}

        {note && <p className={`mb-4 text-sm font-semibold ${note.ok ? "text-emerald-700" : "text-red-600"}`}>{note.text}</p>}

        {confirming ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="mr-auto text-sm font-bold text-red-800">
              {method === "tap"
                ? `Add ${recipients.length} ${recipients.length === 1 ? "person" : "people"} to the tap-to-text list? You'll text them one at a time from this phone.`
                : `Queue ${recipients.length} ${recipients.length === 1 ? "text" : "texts"} from the salon number? You can stop the rest while they're going out.`}
            </p>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-white">Back</button>
            <button type="button" onClick={queueAll} className="rounded-xl bg-red-600 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-red-700">{method === "tap" ? "Yes, start" : "Yes, queue them"}</button>
          </div>
        ) : (
          <button
            type="button"
            disabled={working || markers.length > 0 || recipients.length === 0 || !body.trim()}
            onClick={() => setConfirming(true)}
            className="w-full rounded-2xl bg-indigo-600 py-5 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-40"
          >
            {method === "tap" ? `Start tap-to-text · ${recipients.length} ${recipients.length === 1 ? "person" : "people"}` : `Queue ${recipients.length} ${recipients.length === 1 ? "text" : "texts"}`}
          </button>
        )}
      </div>
    </div>
  );
}
