// lib/generateNumeroLogin.ts
import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";

type UserRole = NonNullable<Database["public"]["Enums"]["user_role"]>;

// Map de faixas iniciais por papel
const ROLE_START: Partial<Record<UserRole, number>> = {
  admin: 1,       // 0001 em diante
  aluno: 1001,    // 1001 em diante
  professor: 2001,// 2001 em diante
  secretaria: 3001,// 3001 em diante
  financeiro: 4001,// 4001 em diante
};

// Aceita um cliente opcional (ex.: service role) para contornar RLS quando necessário
export async function generateNumeroLogin(
  escolaId: string,
  role: UserRole,
  client?: any
) {
  // Usa cliente "any" para permitir campos que ainda não estão nos types gerados
  const supabase = client ?? (await supabaseServerTyped<any>());

  // 1. Descobrir prefixo da escola
  // Melhor: usar um campo "prefixo" na tabela escolas, mas aqui derivei dos 3 primeiros chars do UUID
  const prefix = escolaId.replace(/-/g, "").slice(0, 3).toUpperCase();

  // 2. Definir faixa inicial com base no role
  const start = ROLE_START[role] ?? 9001; // fallback para "outros"

  // 3. Buscar último numero_login usado para esse papel nessa escola
  const { data: lastUser, error } = await supabase
    .from("profiles")
    .select("numero_login")
    .eq("escola_id", escolaId)
    .eq("role", role)
    // filtra pelo prefixo atual para evitar formatos legados
    .like("numero_login", `${prefix}%`)
    .order("numero_login", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  let nextNumber: number;

  if (!lastUser?.numero_login) {
    // Se não existe ninguém desse papel ainda, começa na faixa
    nextNumber = start;
  } else {
    // Extrai apenas os 4 últimos dígitos do numero_login
    const lastSuffix = parseInt(String(lastUser.numero_login || "").slice(-4), 10);
    nextNumber = Number.isFinite(lastSuffix) ? lastSuffix + 1 : start;
  }

  // 4. Montar numero_login final (prefix + sufixo com 4 dígitos)
  const numeroLogin = `${prefix}${String(nextNumber).padStart(4, "0")}`;

  return numeroLogin;
}
