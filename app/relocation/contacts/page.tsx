import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import RelocationContactsList from "@/components/RelocationContactsList";
import { ShieldIcon } from "@/components/Icons";
import { SALON_NAME } from "@/lib/constants";
import { emailMode } from "@/lib/email";
import { VIEWER_COOKIE, VIEWER_PATH, createAnonClient, type RelocationContact } from "@/lib/relocationViewer";
import { logout } from "./actions";

export const dynamic = "force-dynamic";
// Sending a batch of emails takes several seconds; the default would cut it off.
export const maxDuration = 60;

export const metadata: Metadata = {
  title: `${SALON_NAME} - Relocation Contacts`,
  robots: { index: false, follow: false },
};

export default async function RelocationContactsPage() {
  const token = (await cookies()).get(VIEWER_COOKIE)?.value;
  if (!token) redirect(`${VIEWER_PATH}/login`);

  const { data, error } = await createAnonClient().rpc("relocation_viewer_contacts_v2", { p_token: token });

  if (error?.code === "28000") {
    redirect(`${VIEWER_PATH}/login?error=${encodeURIComponent("Your session has expired. Please sign in again.")}`);
  }

  const contacts = (data ?? []) as RelocationContact[];

  return (
    <div className="h-screen h-[100dvh] overflow-hidden flex flex-col bg-[#fcfdfe]">
      <header className="shrink-0 z-50 glass border-b border-slate-100 px-5 sm:px-8 py-3 sm:py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-indigo-600 rounded-[0.9rem] sm:rounded-[1rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-200">
              <ShieldIcon />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter leading-none">{SALON_NAME}</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Relocation Contacts</p>
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="shrink-0 px-4 sm:px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all text-slate-600 border border-slate-200 hover:bg-slate-100"
            >
              Log Out
            </button>
          </form>
        </div>
      </header>

      <main className="flex min-h-0 w-full max-w-5xl flex-1 flex-col mx-auto px-5 sm:px-8 pt-4 sm:pt-6">
        {error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm font-semibold text-red-700">
            Couldn&rsquo;t load contacts right now. Please refresh the page.
          </div>
        ) : contacts.length === 0 ? (
          <div className="p-10 bg-white rounded-[2rem] card-shadow border border-slate-100 text-center text-slate-500 font-medium">
            No sign-ups yet.
          </div>
        ) : (
          <RelocationContactsList contacts={contacts} emailMode={emailMode()} />
        )}
      </main>

    </div>
  );
}
