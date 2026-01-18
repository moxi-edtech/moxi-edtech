type PostgrestLikeBuilder = {
  order: (column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => any;
  range: (from: number, to: number) => any;
  limit: (count: number) => any;
};

type OrderSpec = { column: string; ascending?: boolean; nullsFirst?: boolean };

type Kf2ListOptions = {
  limit?: number;
  offset?: number;
  defaultLimit?: number;
  order?: OrderSpec[];
};

export function kf2Range(limit?: number, offset?: number) {
  const l = Math.min(Math.max(Number(limit ?? 50), 1), 50);
  const o = Math.max(Number(offset ?? 0), 0);
  return { limit: l, offset: o, from: o, to: o + l - 1 };
}

export function applyKf2<T extends PostgrestLikeBuilder>(
  q: T,
  opts?: {
    limit?: number;
    offset?: number;
    order?: OrderSpec[];
  }
) {
  const { from, to } = kf2Range(opts?.limit, opts?.offset);

  const order =
    opts?.order?.length
      ? opts.order
      : [
          { column: "created_at", ascending: false },
          { column: "id", ascending: false },
        ];

  let qq: any = q;
  for (const o of order) {
    qq = qq.order(o.column, {
      ascending: o.ascending ?? true,
      nullsFirst: o.nullsFirst,
    });
  }

  return qq.range(from, to);
}

export function applyKf2ListInvariants<T extends PostgrestLikeBuilder>(
  q: T,
  opts?: Kf2ListOptions
) {
  return applyKf2(q, {
    limit: opts?.limit ?? opts?.defaultLimit,
    offset: opts?.offset,
    order: opts?.order,
  });
}
