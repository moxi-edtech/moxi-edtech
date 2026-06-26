import type { DBWithRPC } from "@/types/supabase-augment";
import { supabaseRouteClient } from "@/lib/supabaseServer";

export const createRouteClient = () => supabaseRouteClient<DBWithRPC>();
