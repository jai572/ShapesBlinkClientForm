"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getNextManualSms, manualSmsResult, type ManualSms } from "@/app/relocation/contacts/actions";
import { firstName } from "@/lib/emailTemplate";

// One person at a time: tap to open the phone's own Messages app with the text
// already written, press send there, come back and confirm. Progress is kept in
// the database, so closing this and coming back resumes where you left off.
export default function TapToText({ onClose }: { onClose: () => void }) {
  const [msg, setMsg] = useState<ManualSms | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [done, setDone] = useState(0);
  const [loading, setLoading] = useState(true);
  const [opened, setOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onPhone, setOnPhone] = useState(true);
  const [copied, setCopied] = useState<"msg" | "num" | null>(null);
  // The person just marked as sent, so a mis-tap can be taken back for a few seconds.
  const [justSent, setJustSent] = useState<{ id: string; name: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearUndo = useCallback(() => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    setJustSent(null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getNextManualSms();
    if (res.ok) {
      setMsg(res.message);
      setWaiting(res.waiting);
      setDone(res.done);
      setError(null);
    } else setError(res.error);
    setOpened(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    setOnPhone(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    load();
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, [load]);

  const answer = async (action: "sent" | "skip") => {
    if (!msg) return;
    setSaving(true);
    const res = await manualSmsResult(msg.id, action);
    setSaving(false);
    if (!res.ok) return setError(res.error ?? "Something went wrong.");
    clearUndo();
    if (action === "sent") {
      setJustSent({ id: msg.id, name: msg.name ? firstName(msg.name) : "customer" });
      undoTimer.current = setTimeout(() => setJustSent(null), 5000);
    }
    await load();
  };

  const undo = async () => {
    if (!justSent) return;
    const { id } = justSent;
    clearUndo();
    setSaving(true);
    const res = await manualSmsResult(id, "undo");
    setSaving(false);
    if (!res.ok) return setError(res.error ?? "Could not undo that.");
    await load();
  };

  const copy = async (what: "msg" | "num") => {
    if (!msg) return;
    try {
      await navigator.clipboard.writeText(what === "msg" ? msg.body : msg.to);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  };

  // "?&body=" is understood by both Android and iPhone.
  const href = msg ? `sms:${msg.to}?&body=${encodeURIComponent(msg.body)}` : "#";
  const total = done + waiting;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-white" role="dialog" aria-modal="true" aria-label="Tap to text">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-lg font-black tracking-tight text-slate-900">Tap to text</p>
          <p className="text-xs font-semibold text-slate-500">
            {done} done &middot; {waiting} left
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50">
          Back to list
        </button>
      </div>

      {justSent && (
        <div className="flex shrink-0 items-center justify-between gap-3 bg-emerald-50 px-5 py-2.5 text-sm font-bold text-emerald-800" aria-live="polite">
          <span>&#10003; Sent to {justSent.name}</span>
          <button type="button" disabled={saving} onClick={undo} className="rounded-lg px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-900 underline hover:bg-emerald-100 disabled:opacity-50">
            Undo
          </button>
        </div>
      )}

      {total > 0 && (
        <div className="h-1.5 shrink-0 bg-slate-100">
          <div className="h-full bg-indigo-600 transition-all" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-6">
        {error && <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

        {loading ? (
          <p className="m-auto text-sm font-semibold text-slate-400">Loading…</p>
        ) : !msg ? (
          <div className="m-auto max-w-sm text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-indigo-600 text-white">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-2xl font-black tracking-tight text-slate-900">{done > 0 ? "All done" : "Nothing waiting"}</h3>
            <p className="mt-2 font-medium text-slate-500">
              {done > 0 ? `${done} text${done === 1 ? "" : "s"} marked as sent. They show "Text sent" on the list.` : "There are no texts waiting. Choose people and press Text clients to add some."}
            </p>
            <button type="button" onClick={onClose} className="mt-6 w-full rounded-2xl bg-indigo-600 py-4 text-xs font-black uppercase tracking-widest text-white">
              Back to the list
            </button>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
            {!onPhone && (
              <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
                This opens your phone&rsquo;s Messages app, so use it on the phone. On a computer, use the copy buttons below instead.
              </p>
            )}
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Text to</p>
            <h3 className="mt-1 text-3xl font-black tracking-tight text-slate-900">{msg.name ? firstName(msg.name) : "Customer"}</h3>
            <p className="text-sm font-semibold text-slate-500">{msg.name} &middot; {msg.to}</p>

            <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-[15px] leading-relaxed text-slate-700">{msg.body}</div>

            <div className="mt-6">
              {!opened ? (
                <a
                  href={href}
                  onClick={() => setOpened(true)}
                  className="block w-full rounded-2xl bg-indigo-600 py-5 text-center text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-100 active:scale-[0.99]"
                >
                  Open Messages
                </a>
              ) : (
                <div className="space-y-3">
                  <p className="text-center text-sm font-semibold text-slate-600">Press send in Messages, then come back and tell me.</p>
                  <button type="button" disabled={saving} onClick={() => answer("sent")} className="w-full rounded-2xl bg-emerald-600 py-5 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-100 disabled:opacity-50">
                    {saving ? "Saving…" : "Yes, I sent it ✓"}
                  </button>
                  <div className="flex gap-3">
                    <a href={href} className="flex-1 rounded-2xl border border-slate-200 py-3.5 text-center text-xs font-black uppercase tracking-wider text-slate-600">Open again</a>
                    <button type="button" disabled={saving} onClick={() => answer("skip")} className="flex-1 rounded-2xl border border-slate-200 py-3.5 text-xs font-black uppercase tracking-wider text-slate-600 disabled:opacity-50">
                      I didn&rsquo;t send it
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-8 text-xs font-bold text-slate-400">
              <span>Having trouble?</span>
              <span className="flex gap-2">
                <button type="button" onClick={() => copy("msg")} className="rounded-lg border border-slate-200 px-3 py-1.5 uppercase tracking-wider text-slate-500">{copied === "msg" ? "Copied" : "Copy message"}</button>
                <button type="button" onClick={() => copy("num")} className="rounded-lg border border-slate-200 px-3 py-1.5 uppercase tracking-wider text-slate-500">{copied === "num" ? "Copied" : "Copy number"}</button>
                {opened ? null : (
                  <button type="button" disabled={saving} onClick={() => answer("skip")} className="rounded-lg border border-slate-200 px-3 py-1.5 uppercase tracking-wider text-slate-500">Skip</button>
                )}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
