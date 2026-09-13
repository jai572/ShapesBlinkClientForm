"use client";

import { useState } from "react";
import { generateConsultationPDF } from "@/lib/pdf";
import { CONSENT_STATEMENT } from "@/lib/constants";
import { DownloadIcon } from "@/components/Icons";
import type { Consultation } from "@/lib/types";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-base font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function YesNoPill({ value }: { value: boolean }) {
  return (
    <span
      className={`inline-block px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
        value ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
      }`}
    >
      {value ? "Yes" : "No"}
    </span>
  );
}

export default function ConsultationDetail({
  entry,
  signatureUrl,
}: {
  entry: Consultation;
  signatureUrl: string | null;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      let dataUrl: string | null = null;
      if (signatureUrl) {
        const res = await fetch(signatureUrl);
        dataUrl = await blobToDataUrl(await res.blob());
      }
      generateConsultationPDF(entry, dataUrl);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 animate-fade-in pb-24">
      <div className="flex items-center justify-between mb-10">
        <a
          href="/console"
          className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
        >
          &larr; Back to Records
        </a>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50"
        >
          <DownloadIcon /> {downloading ? "Preparing..." : "Download PDF"}
        </button>
      </div>

      <div className="mb-10">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">
          {entry.first_name} {entry.last_name}
        </h1>
        <p className="text-slate-500 mt-2 font-medium">
          Submitted {new Date(entry.created_at).toLocaleString("en-GB")}
        </p>
      </div>

      <div className="space-y-8">
        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] card-shadow border border-slate-100">
          <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3">
            <div className="w-1.5 h-8 bg-indigo-600 rounded-full" /> Personal Profile
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Field label="Full Name" value={`${entry.first_name} ${entry.last_name}`} />
            <Field label="Email Address" value={entry.email} />
            <Field label="Phone Number" value={entry.mobile} />
            <Field label="Home Address" value={entry.address || "N/A"} />
          </div>
        </div>

        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] card-shadow border border-slate-100">
          <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3">
            <div className="w-1.5 h-8 bg-indigo-600 rounded-full" /> Medical Assessment
          </h2>
          {entry.medical_conditions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {entry.medical_conditions.map((c) => (
                <span
                  key={c}
                  className="px-4 py-2 bg-red-50 border border-red-100 text-red-700 rounded-xl text-[10px] font-black uppercase tracking-tight"
                >
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm font-medium text-slate-500">No relevant medical conditions reported.</p>
          )}
        </div>

        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] card-shadow border border-slate-100">
          <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3">
            <div className="w-1.5 h-8 bg-indigo-600 rounded-full" /> Treatment Setup
          </h2>
          <div className="space-y-6">
            <Field label="Requested Service" value={entry.treatment_name} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Previous Salon Visit
                </p>
                <YesNoPill value={entry.been_to_salon} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Patch Test Done</p>
                <YesNoPill value={entry.patch_test_status} />
              </div>
            </div>
            {!entry.patch_test_status && entry.no_patch_consent !== null && (
              <div>
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">
                  Consented to Treatment Without Patch Test
                </p>
                <YesNoPill value={entry.no_patch_consent} />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] card-shadow border border-slate-100">
          <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
            <div className="w-1.5 h-8 bg-indigo-600 rounded-full" /> Authorization
          </h2>
          <div className="mb-8 p-6 bg-slate-50 rounded-3xl border-l-8 border-indigo-600">
            <p className="text-sm font-semibold text-slate-700 leading-relaxed italic">&ldquo;{CONSENT_STATEMENT}&rdquo;</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <Field label="Legal Name" value={entry.recipient_name} />
              <Field label="Date Signed" value={new Date(entry.signed_date).toLocaleDateString("en-GB")} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Signature</p>
              {signatureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signatureUrl}
                  alt="Client signature"
                  className="w-full h-44 object-contain bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"
                />
              ) : (
                <div className="w-full h-44 flex items-center justify-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Signature Unavailable
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
