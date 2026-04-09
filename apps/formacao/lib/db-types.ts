import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

type GenericTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type GenericView = {
  Row: Record<string, unknown>;
  Relationships: [];
};

type PublicSchema = Database["public"];

export type FormacaoDatabase = Omit<Database, "public"> & {
  public: Omit<PublicSchema, "Tables" | "Views"> & {
    Tables: PublicSchema["Tables"] & Record<string, GenericTable>;
    Views: PublicSchema["Views"] & Record<string, GenericView>;
  };
};

export type FormacaoSupabaseClient = SupabaseClient<FormacaoDatabase>;
