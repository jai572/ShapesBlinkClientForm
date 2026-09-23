import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ShieldIcon } from "@/components/Icons";
import { SALON_NAME } from "@/lib/constants";
import { VIEWER_COOKIE, VIEWER_PATH, createAnonClient, type RelocationContact } from "@/lib/relocationViewer";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${SALON_NAME} - Relocation Contacts`,
  robots: { index: false, follow: false },
};

const formatSubmitted = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function RelocationContactsPage() {
  const token = (await cookies()).get(VIEWER_COOKIE)?.value;
  if (!token) redirect(`${VIEWER_PATH}/login`);

  const { data, error } = await createAnonClient().rpc("relocation_viewer_contacts", { p_token: token });

  if (error?.code === "28000") {
    redirect(`${VIEWER_PATH}/login?error=${encodeURIComponent("Your session has expired. Please sign in again.")}`);
  }

  const contacts = (data ?? []) as RelocationContact[];

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-[#fcfdfe]">
      <header className="sticky top-0 z-50 glass border-b border-slate-100 px-5 sm:px-8 py-3 sm:py-5">
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

      <main className="flex-grow w-full max-w-5xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        <div className="mb-6 sm:mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Sign-ups</h2>
            <p className="text-slate-500 mt-2 font-medium">Customers waiting for your new address, newest first.</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-3xl sm:text-4xl font-black text-indigo-600 leading-none">{contacts.length}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total</p>
          </div>
        </div>

        {error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm font-semibold text-red-700">
            Couldn&rsquo;t load contacts right now. Please refresh the page.
          </div>
        ) : contacts.length === 0 ? (
          <div className="p-10 bg-white rounded-[2rem] card-shadow border border-slate-100 text-center text-slate-500 font-medium">
            No sign-ups yet.
          </div>
        ) : (
          <>
            {/* Phones: one card per customer */}
            <ul className="sm:hidden space-y-3">
              {contacts.map((c) => (
                <li key={c.id} className="bg-white p-5 rounded-[1.5rem] card-shadow border border-slate-100">
                  <p className="text-lg font-black text-slate-900">{c.customer_name}</p>
                  <a href={`tel:${c.phone}`} className="block mt-2 font-semibold text-indigo-600">
                    {c.phone}
                  </a>
                  <a href={`mailto:${c.email}`} className="block mt-1 font-medium text-slate-600 break-all">
                    {c.email}
                  </a>
                  <p className="mt-3 text-xs font-medium text-slate-400">{formatSubmitted(c.created_at)}</p>
                </li>
              ))}
            </ul>

            {/* Tablets and desktops: table */}
            <div className="hidden sm:block bg-white rounded-[2rem] card-shadow border border-slate-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Customer Name</th>
                    <th className="px-6 py-4">Phone Number</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contacts.map((c) => (
                    <tr key={c.id} className="font-medium text-slate-700">
                      <td className="px-6 py-4 font-bold text-slate-900">{c.customer_name}</td>
                      <td className="px-6 py-4">
                        <a href={`tel:${c.phone}`} className="text-indigo-600 hover:underline">
                          {c.phone}
                        </a>
                      </td>
                      <td className="px-6 py-4 break-all">
                        <a href={`mailto:${c.email}`} className="hover:underline">
                          {c.email}
                        </a>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">{formatSubmitted(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      <footer className="py-4 sm:py-8 text-center bg-white border-t border-slate-100">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">
          {SALON_NAME} &bull; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
