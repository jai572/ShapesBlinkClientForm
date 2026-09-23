import type { Metadata } from "next";
import { LockIcon } from "@/components/Icons";
import { SALON_NAME } from "@/lib/constants";
import { login } from "../actions";

export const metadata: Metadata = {
  title: `${SALON_NAME} - Relocation Contacts`,
  robots: { index: false, follow: false },
};

export default async function RelocationViewerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-slate-900/40 p-5">
      <div className="bg-white w-full max-w-md p-8 sm:p-10 rounded-[2.5rem] sm:rounded-[3rem] shadow-2xl border border-slate-100 text-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-indigo-600 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-200 mx-auto mb-6 sm:mb-8">
          <LockIcon />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter mb-2">Relocation Contacts</h2>
        <p className="text-slate-400 font-medium mb-8">Sign in to view {SALON_NAME} relocation sign-ups.</p>
        <form action={login} className="space-y-4 text-left">
          <div>
            <label htmlFor="username" className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              User ID
            </label>
            <input
              id="username"
              name="username"
              required
              autoComplete="username"
              autoCapitalize="none"
              className="w-full p-4 text-base bg-slate-50 border border-slate-200 rounded-2xl font-medium"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full p-4 text-base bg-slate-50 border border-slate-200 rounded-2xl font-medium"
            />
          </div>
          {error && <p className="text-sm font-semibold text-red-600 text-center">{error}</p>}
          <button
            type="submit"
            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
