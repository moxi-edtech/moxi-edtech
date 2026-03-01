export type PostgrestLikeBuilder = {
  order: (column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => any;
  range: (from: number, to: number) => any;
  limit: (count: number) => any;
};

export type ListOrderSpec = { column: string; ascending?: boolean; nullsFirst?: boolean };

export type ListRange = {
  from: number;
  to: number;
};

export type ApplyListQueryDefaultsOptions = {
  limit?: number;
  offset?: number;
  range?: ListRange;
  defaultLimit?: number;
  order?: ListOrderSpec[];
  tieBreakerColumn?: string;
  maxLimit?: number;
};

const DEFAULT_ORDER: ListOrderSpec[] = [{ column: "created_at", ascending: false }];

function toPositiveInt(value: number | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.floor(parsed);
}

export function normalizeListRange(opts?: ApplyListQueryDefaultsOptions) {
  const maxLimit = Math.max(1, toPositiveInt(opts?.maxLimit, 50));
  const defaultLimit = Math.max(1, Math.min(toPositiveInt(opts?.defaultLimit, maxLimit), maxLimit));

  if (opts?.range) {
    const from = Math.max(0, toPositiveInt(opts.range.from, 0));
    const rawTo = Math.max(from, toPositiveInt(opts.range.to, from + defaultLimit - 1));
    const to = Math.min(rawTo, from + maxLimit - 1);
    return { from, to, limit: to - from + 1, offset: from, maxLimit };
  }

  const limit = Math.min(Math.max(toPositiveInt(opts?.limit, defaultLimit), 1), maxLimit);
  const offset = Math.max(toPositiveInt(opts?.offset, 0), 0);
  return { from: offset, to: offset + limit - 1, limit, offset, maxLimit };
}

export function applyListQueryDefaults<T extends PostgrestLikeBuilder>(q: T, opts?: ApplyListQueryDefaultsOptions) {
  const { from, to } = normalizeListRange(opts);
  const tieBreakerColumn = opts?.tieBreakerColumn || "id";
  const baseOrder = opts?.order?.length ? opts.order : DEFAULT_ORDER;
  const hasTieBreaker = baseOrder.some(order => order.column === tieBreakerColumn);
  const order = hasTieBreaker ? baseOrder : [...baseOrder, { column: tieBreakerColumn, ascending: false }];

  let qq: any = q;
  for (const currentOrder of order) {
    qq = qq.order(currentOrder.column, {
      ascending: currentOrder.ascending ?? true,
      nullsFirst: currentOrder.nullsFirst,
    });
  }

  return qq.range(from, to);
}
