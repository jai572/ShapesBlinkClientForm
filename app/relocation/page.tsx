import type { Metadata } from "next";
import RelocationForm from "@/components/RelocationForm";
import { ShieldIcon } from "@/components/Icons";

const HEADER_NAME = "Shapes Blink and Brow";

export const metadata: Metadata = {
  title: `${HEADER_NAME} - We Are Moving`,
  description: `Leave your contact details and ${HEADER_NAME} will message you our new address.`,
};

export default function RelocationPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#fcfdfe]">
      <header className="sticky top-0 z-50 glass border-b border-slate-100 px-6 sm:px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-[1rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-200">
            <ShieldIcon />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{HEADER_NAME}</h1>
        </div>
      </header>
      <main className="flex-grow">
        <RelocationForm />
      </main>
      <footer className="py-12 text-center bg-white border-t border-slate-100">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">
          {HEADER_NAME} &bull; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
