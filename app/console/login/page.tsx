import { LockIcon } from "@/components/Icons";
import { SALON_NAME } from "@/lib/constants";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900/40 p-6">
      <div className="bg-white w-full max-w-md p-10 rounded-[3rem] shadow-2xl border border-slate-100 text-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-200 mx-auto mb-8">
          <LockIcon />
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">Vault Access</h2>
        <p className="text-slate-400 font-medium mb-8">Enter the PIN to view {SALON_NAME} records.</p>
        <form action={login} className="space-y-4" autoComplete="off">
          <input
            required
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            name="pin"
            placeholder="Admin PIN"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl text-center text-2xl tracking-[0.5em] font-medium"
          />
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            Verify Identity
          </button>
        </form>
      </div>
    </div>
  );
}
