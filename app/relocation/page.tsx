import type { Metadata, Viewport } from "next";
import RelocationForm from "@/components/RelocationForm";
import { ShieldIcon } from "@/components/Icons";
import { SALON_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${SALON_NAME} - We're Moving`,
  description: `Leave your contact details and ${SALON_NAME} will message you our new address.`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fcfdfe",
};

export default function RelocationPage() {
  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-[#fcfdfe]">
      <header className="sticky top-0 z-50 glass border-b border-slate-100 px-5 sm:px-8 py-3 sm:py-5 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="max-w-7xl mx-auto flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-indigo-600 rounded-[0.9rem] sm:rounded-[1rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-200">
            <ShieldIcon />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter leading-none">{SALON_NAME}</h1>
        </div>
      </header>
      <main className="flex-grow flex flex-col">
        <RelocationForm />
      </main>
      <footer className="py-4 sm:py-8 pb-[max(1rem,env(safe-area-inset-bottom))] text-center bg-white border-t border-slate-100">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">
          {SALON_NAME} &bull; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
