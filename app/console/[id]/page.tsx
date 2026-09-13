import { createClient } from "@/lib/supabase/server";
import ConsultationDetail from "@/components/ConsultationDetail";
import type { Consultation } from "@/lib/types";

export default async function ConsultationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: entry, error } = await supabase
    .from("consultations")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !entry) {
    return (
      <div className="max-w-2xl mx-auto py-24 px-6 text-center">
        <p className="text-red-600 font-semibold">Record not found.</p>
        <a href="/console" className="mt-4 inline-block text-xs font-black text-indigo-600 uppercase tracking-widest">
          &larr; Back to Records
        </a>
      </div>
    );
  }

  const consultation = entry as Consultation;
  let signatureUrl: string | null = null;
  if (consultation.signature_path) {
    const { data: signed } = await supabase.storage
      .from("signatures")
      .createSignedUrl(consultation.signature_path, 300);
    signatureUrl = signed?.signedUrl ?? null;
  }

  return <ConsultationDetail entry={consultation} signatureUrl={signatureUrl} />;
}
