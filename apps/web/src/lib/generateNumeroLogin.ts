// lib/generateNumeroLogin.ts
import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";

type UserRole = NonNullable<Database["public"]["Enums"]["user_role"]>;

// Map de faixas iniciais por papel
const ROLE_START: Partial<Record<UserRole, number>> = {
  admin: 1,
  aluno: 1001,
  professor: 2001,
  secretaria: 3001,
  financeiro: 4001,
};

// Cache para otimização
const numeroLoginCache = new Map<string, Set<number>>();
const pendingGenerations = new Map<string, Promise<string>>();

const CONFIG = {
  MAX_ATTEMPTS: 1000,
  CACHE_TTL: 5 * 60 * 1000,
  DEFAULT_ROLE_START: 9001,
} as const;

type NumeroLoginGenerationOptions = {
  client?: any;
  useCache?: boolean;
  maxAttempts?: number;
  useDatabaseFunction?: boolean; // Nova opção para usar a função do banco
};

export async function generateNumeroLogin(
  escolaId: string,
  role: UserRole,
  options: NumeroLoginGenerationOptions = {}
): Promise<string> {
  const { 
    client, 
    useCache = true, 
    maxAttempts = CONFIG.MAX_ATTEMPTS,
    useDatabaseFunction = true // Por padrão usa a função segura do banco
  } = options;

  // Validações
  if (!escolaId?.trim() || !role?.trim()) {
    throw new Error("escolaId e role são obrigatórios");
  }

  const supabase = client ?? (await supabaseServerTyped<any>());
  const prefix = escolaId.replace(/-/g, "").slice(0, 3).toUpperCase();
  const start = ROLE_START[role] ?? CONFIG.DEFAULT_ROLE_START;

  // Tentar usar a função do banco primeiro (mais segura)
  if (useDatabaseFunction) {
    try {
      const { data: numeroLogin, error } = await supabase.rpc(
        'generate_unique_numero_login',
        {
          p_escola_id: escolaId,
          p_role: role,
          p_prefix: prefix,
          p_start: start
        }
      );

      if (!error) {
        return numeroLogin;
      }
      
      // Se falhar, fallback para a implementação em TypeScript
      console.warn('Função do banco falhou, usando fallback:', error);
    } catch (error) {
      console.warn('Erro ao chamar função do banco, usando fallback:', error);
    }
  }

  // Fallback: implementação original em TypeScript (com cache e concorrência)
  const cacheKey = `${escolaId}:${role}:${prefix}`;
  
  if (pendingGenerations.has(cacheKey)) {
    return pendingGenerations.get(cacheKey)!;
  }

  const generationPromise = (async (): Promise<string> => {
    try {
      let usedSuffixes: Set<number>;

      if (useCache && numeroLoginCache.has(cacheKey)) {
        usedSuffixes = numeroLoginCache.get(cacheKey)!;
      } else {
        const { data: users, error } = await supabase
          .from("profiles")
          .select("numero_login")
          .eq("escola_id", escolaId)
          .eq("role", role)
          .like("numero_login", `${prefix}%`)
          .order("numero_login", { ascending: true })
          .limit(1000);

        if (error) throw error;

        usedSuffixes = new Set(
          (users ?? [])
            .map(user => {
              const suffix = user.numero_login?.slice(-4);
              return suffix?.match(/^\d{4}$/) ? parseInt(suffix, 10) : NaN;
            })
            .filter(n => !isNaN(n) && n >= start)
        );

        if (useCache) {
          numeroLoginCache.set(cacheKey, usedSuffixes);
          setTimeout(() => numeroLoginCache.delete(cacheKey), CONFIG.CACHE_TTL);
        }
      }

      let nextNumber = start;
      let attempts = 0;

      while (usedSuffixes.has(nextNumber) && attempts < maxAttempts) {
        nextNumber++;
        attempts++;
        
        const nextRoleStart = Math.min(
          ...Object.values(ROLE_START).filter(s => s > start)
        );
        
        if (nextRoleStart < Infinity && nextNumber >= nextRoleStart) {
          throw new Error(`Limite de números para ${role} atingido`);
        }
      }

      if (attempts >= maxAttempts) {
        throw new Error(`Não foi possível gerar número único após ${maxAttempts} tentativas`);
      }

      if (useCache) {
        usedSuffixes.add(nextNumber);
      }

      const numeroLogin = `${prefix}${String(nextNumber).padStart(4, "0")}`;
      return numeroLogin;

    } finally {
      pendingGenerations.delete(cacheKey);
    }
  })();

  pendingGenerations.set(cacheKey, generationPromise);
  return generationPromise;
}

// Funções utilitárias
export function clearNumeroLoginCache(): void {
  numeroLoginCache.clear();
  pendingGenerations.clear();
}

export function getCacheStats(): { cacheSize: number; pendingSize: number } {
  return {
    cacheSize: numeroLoginCache.size,
    pendingSize: pendingGenerations.size,
  };
}