"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CONSENT_STATEMENT, MEDICAL_CONDITIONS, SALON_NAME } from "@/lib/constants";
import SignaturePad from "@/components/SignaturePad";

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  address: string;
  medicalConditions: string[];
  treatmentName: string;
  beenToSalon: "Yes" | "No";
  patchTestStatus: "Yes" | "No";
  noPatchConsent: "Yes" | "No";
  recipientName: string;
  signatureImage: string;
}

const initialState: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  mobile: "",
  address: "",
  medicalConditions: [],
  treatmentName: "",
  beenToSalon: "No",
  patchTestStatus: "No",
  noPatchConsent: "No",
  recipientName: "",
  signatureImage: "",
};

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)![1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export default function ConsultationForm() {
  const [data, setData] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const signedDate = new Date().toLocaleDateString("en-GB");

  const toggleMedical = (condition: string) => {
    setData((prev) => ({
      ...prev,
      medicalConditions: prev.medicalConditions.includes(condition)
        ? prev.medicalConditions.filter((c) => c !== condition)
        : [...prev.medicalConditions, condition],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!data.signatureImage) {
      setError("Please sign the document before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const signaturePath = `${Date.now()}-${data.lastName.replace(/\s+/g, "_")}.png`;

      const { error: uploadError } = await supabase.storage
        .from("signatures")
        .upload(signaturePath, dataUrlToBlob(data.signatureImage), { contentType: "image/png" });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("consultations").insert({
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        mobile: data.mobile,
        address: data.address,
        medical_conditions: data.medicalConditions,
        treatment_name: data.treatmentName,
        been_to_salon: data.beenToSalon === "Yes",
        patch_test_status: data.patchTestStatus === "Yes",
        no_patch_consent: data.patchTestStatus === "No" ? data.noPatchConsent === "Yes" : null,
        recipient_name: data.recipientName,
        signed_date: new Date().toISOString().slice(0, 10),
        signature_path: signaturePath,
      });
      if (insertError) throw insertError;

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-24 px-6 text-center animate-fade-in">
        <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-200 mx-auto mb-8">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3">Consultation Received</h1>
        <p className="text-slate-500 font-medium mb-10">
          Thank you, {data.firstName}. Your record has been securely submitted to {SALON_NAME}.
        </p>
        <button
          onClick={() => {
            setData(initialState);
            setError(null);
            setSubmitted(false);
          }}
          className="px-10 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-xl shadow-indigo-100"
        >
          Start Next Consultation
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto py-12 px-6 animate-fade-in pb-32">
      <div className="mb-12">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Client Consultation</h1>
        <p className="text-slate-500 mt-2 font-medium">Please provide accurate information for a safe treatment.</p>
      </div>

      <div className="space-y-10">
        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] card-shadow border border-slate-100">
          <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3">
            <div className="w-1.5 h-8 bg-indigo-600 rounded-full" /> Personal Profile
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">First Name</label>
              <input
                required
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white transition-all font-medium"
                value={data.firstName}
                onChange={(e) => setData({ ...data, firstName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Last Name</label>
              <input
                required
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white transition-all font-medium"
                value={data.lastName}
                onChange={(e) => setData({ ...data, lastName: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Email Address</label>
              <input
                required
                type="email"
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white transition-all font-medium"
                value={data.email}
                onChange={(e) => setData({ ...data, email: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Phone Number</label>
              <input
                required
                type="tel"
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white transition-all font-medium"
                value={data.mobile}
                onChange={(e) => setData({ ...data, mobile: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Home Address</label>
              <textarea
                rows={2}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white transition-all font-medium"
                value={data.address}
                onChange={(e) => setData({ ...data, address: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] card-shadow border border-slate-100">
          <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3">
            <div className="w-1.5 h-8 bg-indigo-600 rounded-full" /> Medical Assessment
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {MEDICAL_CONDITIONS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => toggleMedical(c)}
                className={`p-4 text-[10px] font-black rounded-xl border transition-all text-left uppercase tracking-tight ${
                  data.medicalConditions.includes(c)
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-lg"
                    : "bg-white border-slate-100 text-slate-500 hover:border-indigo-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] card-shadow border border-slate-100">
          <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3">
            <div className="w-1.5 h-8 bg-indigo-600 rounded-full" /> Treatment Setup
          </h2>
          <div className="space-y-8">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Requested Service</label>
              <input
                required
                placeholder="e.g. Volume Lash Full Set"
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white transition-all font-medium"
                value={data.treatmentName}
                onChange={(e) => setData({ ...data, treatmentName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Have you been to our salon?
                </label>
                <select
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium"
                  value={data.beenToSalon}
                  onChange={(e) => setData({ ...data, beenToSalon: e.target.value as "Yes" | "No" })}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Have you had a patch test done?
                </label>
                <select
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium"
                  value={data.patchTestStatus}
                  onChange={(e) => setData({ ...data, patchTestStatus: e.target.value as "Yes" | "No" })}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
            </div>
            {data.patchTestStatus === "No" && (
              <div className="animate-fade-in">
                <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-2">
                  Do you consent to treatment without a patch test?
                </label>
                <select
                  required
                  className="w-full p-4 bg-amber-50 border border-amber-200 rounded-2xl font-medium"
                  value={data.noPatchConsent}
                  onChange={(e) => setData({ ...data, noPatchConsent: e.target.value as "Yes" | "No" })}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] card-shadow border border-slate-100">
          <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
            <div className="w-1.5 h-8 bg-indigo-600 rounded-full" /> Authorization
          </h2>
          <div className="mb-10 p-6 bg-slate-50 rounded-3xl border-l-8 border-indigo-600">
            <p className="text-sm font-semibold text-slate-700 leading-relaxed italic">&ldquo;{CONSENT_STATEMENT}&rdquo;</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Legal Name</label>
                <input
                  required
                  className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-serif italic text-2xl text-slate-900 transition-all"
                  value={data.recipientName}
                  onChange={(e) => setData({ ...data, recipientName: e.target.value })}
                />
              </div>
              <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</p>
                <p className="text-2xl font-black text-indigo-900">{signedDate}</p>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Signature</label>
              <SignaturePad onSave={(img) => setData({ ...data, signatureImage: img })} />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm font-semibold text-red-700">{error}</div>
      )}

      <div className="mt-12 flex justify-end gap-5 sticky bottom-10 p-6 glass rounded-[2rem] border border-white/40 shadow-2xl z-50">
        <button
          type="submit"
          disabled={submitting}
          className="px-16 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-xl shadow-indigo-100 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Record"}
        </button>
      </div>
    </form>
  );
}
