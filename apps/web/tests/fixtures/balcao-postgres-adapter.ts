/** Test-only PostgREST-shaped adapter. SQL and authorization run in PostgreSQL;
 * transport/authentication/Storage are explicit fixtures, never production hooks. */
export function postgresSupabase(tx: any, userId: string) {
  const identifier = (name: string) => { if (!/^[a-z_][a-z_0-9]*$/.test(name)) throw new Error("Unsafe fixture identifier"); return '"' + name + '"'; };
  return {
    auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      try {
        const keys = Object.keys(args);
        const rows = await tx.unsafe(`select public.${identifier(name)}(${keys.map((k, i) => `${identifier(k)} => $${i + 1}`).join(",")}) as data`, Object.values(args).map((v) => v !== null && typeof v === "object" ? tx.json(v) : v));
        return { data: rows[0]?.data, error: null };
      } catch (error) { return { data: null, error }; }
    },
    from: (name: string) => {
      const table = identifier(name); let columns = "*"; let single = false;
      const conditions: string[] = [], params: unknown[] = [], order: string[] = [];
      let limit = "";
      const q: any = {
        select(value: string) { columns = value.split(",").map((v) => v.trim() === "*" ? "*" : identifier(v.trim())).join(","); return q; },
        eq(key: string, value: unknown) { params.push(value); conditions.push(`${identifier(key)}=$${params.length}`); return q; },
        in(key: string, values: unknown[]) { const slots = values.map((v) => { params.push(v); return "$" + params.length; }); conditions.push(slots.length ? `${identifier(key)} in (${slots.join(",")})` : "false"); return q; },
        order(key: string, opts?: { ascending?: boolean }) { order.push(`${identifier(key)} ${opts?.ascending === false ? "desc" : "asc"}`); return q; },
        limit(value: number) { if (!Number.isInteger(value) || value < 1) throw new Error("Bad fixture limit"); limit = ` limit ${value}`; return q; },
        maybeSingle() { single = true; return q; },
        async then(resolve: any, reject: any) {
          try {
            const rows = await tx.unsafe(`select ${columns} from public.${table}${conditions.length ? " where " + conditions.join(" and ") : ""}${order.length ? " order by " + order.join(",") : ""}${limit}`, params);
            return resolve({ data: single ? rows[0] ?? null : [...rows], error: null });
          } catch (error) { return resolve({ data: null, error }); }
        },
      }; return q;
    },
  };
}
