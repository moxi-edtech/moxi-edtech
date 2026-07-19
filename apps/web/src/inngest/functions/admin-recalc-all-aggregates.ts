import { createClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client";
import type { Database } from "~types/supabase";

function getSupabaseAdmin() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  }

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const adminRecalcAllAggregates = inngest.createFunction(
  {
    id: "admin-recalc-all-aggregates",
    retries: 2,
    triggers: [{ event: "admin/health.recalc-all-aggregates.requested" }],
  },
  async ({ event, step }) => {
    const requestedBy = String(event.data?.requested_by ?? "").trim();
    if (!requestedBy) {
      throw new Error("Evento sem requested_by");
    }

    const result = await step.run("recalculate-all-aggregates", async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase.rpc("admin_recalc_all_aggregates");

      if (error) {
        throw new Error(error.message);
      }

      return data;
    });

    return { ok: true, requested_by: requestedBy, result };
  }
);
