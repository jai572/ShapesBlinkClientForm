import ConsultationForm from "@/components/ConsultationForm";
import { SALON_NAME } from "@/lib/constants";
import { ShieldIcon, FormIcon, LockIcon } from "@/components/Icons";

export default function IntakePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#fcfdfe]">
      <header className="sticky top-0 z-50 glass border-b border-slate-100 px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-[1rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-200">
              <ShieldIcon />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{SALON_NAME}</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Consultation System</p>
            </div>
          </div>
          <nav className="flex items-center gap-3">
            <a
              href="/intake"
              className="flex items-center gap-3 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all bg-indigo-600 text-white shadow-xl"
            >
              <FormIcon /> Intake
            </a>
            <a
              href="/console"
              className="flex items-center gap-3 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all text-slate-500 hover:bg-slate-100"
            >
              <LockIcon /> Console
            </a>
          </nav>
        </div>
      </header>
      <main className="flex-grow">
        <ConsultationForm />
      </main>
      <footer className="py-12 text-center bg-white border-t border-slate-100">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">
          {SALON_NAME} &bull; Secure Management &bull; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
