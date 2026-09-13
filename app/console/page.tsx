import { createClient } from "@/lib/supabase/server";
import ConsoleTable from "@/components/ConsoleTable";
import type { Consultation } from "@/lib/types";

export default async function ConsolePage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consultations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-24 px-6 text-center">
        <p className="text-red-600 font-semibold">Failed to load records: {error.message}</p>
      </div>
    );
  }

  return <ConsoleTable entries={(data ?? []) as Consultation[]} />;
}
