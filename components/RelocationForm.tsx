"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface FormState {
  customerName: string;
  phone: string;
  email: string;
}

const initialState: FormState = {
  customerName: "",
  phone: "",
  email: "",
};

const inputClass =
  "w-full px-4 py-3 sm:p-4 text-base bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white transition-all font-medium";
const labelClass = "text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 sm:mb-2";

export default function RelocationForm() {
  const [data, setData] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from("relocation_contacts").insert({
        customer_name: data.customerName.trim(),
        phone: data.phone.trim(),
        email: data.email.trim(),
      });
      if (insertError) throw insertError;
      setSubmitted(true);
    } catch {
      setError("Sorry, we couldn't save your details. Please check them and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex-grow w-full max-w-2xl mx-auto px-5 sm:px-6 py-12 flex flex-col items-center justify-center text-center animate-fade-in">
        <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-200 mx-auto mb-8">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-3">Thank You</h2>
        <p className="text-slate-500 font-medium mb-10 max-w-sm">
          We&rsquo;ve got your details and will message you with our new address.
        </p>
        <button
          onClick={() => {
            setData(initialState);
            setError(null);
            setSubmitted(false);
          }}
          className="w-full sm:w-auto px-10 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-xl shadow-indigo-100"
        >
          Go Back to Fill a New Form
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex-grow w-full max-w-2xl mx-auto px-5 sm:px-6 py-6 sm:py-12 flex flex-col animate-fade-in"
    >
      <div className="mb-6 sm:mb-10">
        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">We&rsquo;re Moving</h2>
        <p className="text-slate-600 mt-3 sm:mt-4 font-medium leading-relaxed">
          Due to unforeseen circumstances, our salon is moving to a new location. Please leave your details and we&rsquo;ll
          message you our new address. Thank you for your continued support.
        </p>
      </div>

      <div className="bg-white p-5 sm:p-10 rounded-[1.75rem] sm:rounded-[2.5rem] card-shadow border border-slate-100 space-y-4 sm:space-y-8">
        <div>
          <label htmlFor="customerName" className={labelClass}>Customer Name</label>
          <input
            id="customerName"
            required
            maxLength={200}
            autoComplete="name"
            className={inputClass}
            value={data.customerName}
            onChange={(e) => setData({ ...data, customerName: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="phone" className={labelClass}>Phone Number</label>
          <input
            id="phone"
            required
            type="tel"
            minLength={5}
            maxLength={40}
            autoComplete="tel"
            className={inputClass}
            value={data.phone}
            onChange={(e) => setData({ ...data, phone: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>Email</label>
          <input
            id="email"
            required
            type="email"
            maxLength={320}
            autoComplete="email"
            className={inputClass}
            value={data.email}
            onChange={(e) => setData({ ...data, email: e.target.value })}
          />
        </div>
      </div>

      {error && (
        <div className="mt-4 sm:mt-8 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm font-semibold text-red-700">{error}</div>
      )}

      <p className="mt-3 sm:mt-4 px-1 text-xs text-slate-400 font-medium">
        We&rsquo;ll only use these details to tell you about our move.
      </p>

      <div className="mt-auto pt-5 sm:pt-10 flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto px-16 py-4 sm:py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-xl shadow-indigo-100 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit"}
        </button>
      </div>
    </form>
  );
}
