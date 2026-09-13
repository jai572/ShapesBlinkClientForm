"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generateConsultationPDF } from "@/lib/pdf";
import { DownloadIcon, SearchIcon } from "@/components/Icons";
import type { Consultation } from "@/lib/types";

function dataUrlFromBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function ConsoleTable({ entries }: { entries: Consultation[] }) {
  const [search, setSearch] = useState("");
  const [exportingId, setExportingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return entries;
    return entries.filter((e) =>
      [`${e.first_name} ${e.last_name}`, e.email, e.mobile].some((field) =>
        field.toLowerCase().includes(q)
      )
    );
  }, [entries, search]);

  const handleExport = async (entry: Consultation) => {
    setExportingId(entry.id);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage.from("signatures").download(entry.signature_path);
      const signatureDataUrl = error || !data ? null : await dataUrlFromBlob(data);
      generateConsultationPDF(entry, signatureDataUrl);
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-12 px-6 animate-fade-in">
      <div className="flex flex-col md:flex-row items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter">Records Vault</h1>
          <p className="text-slate-500 mt-3 font-medium text-lg">Managing {entries.length} professional profiles.</p>
        </div>
      </div>
      <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center gap-6">
          <div className="relative flex-1">
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400">
              <SearchIcon />
            </span>
            <input
              className="w-full pl-16 pr-8 py-5 rounded-[2rem] border-none bg-white shadow-inner focus:ring-4 focus:ring-indigo-50 font-semibold text-slate-700"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Name</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Submission</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-10 py-16 text-center text-sm font-bold text-slate-400 uppercase tracking-widest">
                    No records match &ldquo;{search}&rdquo;
                  </td>
                </tr>
              )}
              {filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="px-10 py-8">
                    <p className="font-black text-slate-900 text-lg leading-tight">
                      {entry.first_name} {entry.last_name}
                    </p>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">{entry.email}</p>
                  </td>
                  <td className="px-10 py-8 text-sm font-bold text-slate-600">{entry.mobile || "N/A"}</td>
                  <td className="px-10 py-8 text-sm font-black text-slate-800 tracking-tight">
                    {new Date(entry.created_at).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-10 py-8 text-right">
                    <div className="inline-flex items-center gap-3">
                      <a
                        href={`/console/${entry.id}`}
                        className="inline-flex items-center gap-3 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-sm"
                      >
                        View Record
                      </a>
                      <button
                        onClick={() => handleExport(entry)}
                        disabled={exportingId === entry.id}
                        className="inline-flex items-center gap-3 px-6 py-3 bg-white border-2 border-slate-200 rounded-2xl text-[10px] font-black text-slate-700 hover:border-indigo-600 hover:text-indigo-600 transition-all uppercase tracking-widest shadow-sm disabled:opacity-50"
                      >
                        <DownloadIcon /> {exportingId === entry.id ? "..." : "PDF"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
