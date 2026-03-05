import type { Database } from "~types/supabase";
import { supabaseRouteClient } from "@/lib/supabaseServer";

export const createRouteClient = () => supabaseRouteClient<Database>();
