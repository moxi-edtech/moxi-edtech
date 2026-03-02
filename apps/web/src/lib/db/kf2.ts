import {
  applyListQueryDefaults,
  normalizeListRange,
  type ApplyListQueryDefaultsOptions,
  type ListOrderSpec,
  type PostgrestLikeBuilder,
} from "@/lib/search/applyListQueryDefaults";

type Kf2ListOptions = ApplyListQueryDefaultsOptions;

export function kf2Range(limit?: number, offset?: number) {
  return normalizeListRange({ limit, offset });
}

export function applyKf2<T extends PostgrestLikeBuilder>(q: T, opts?: {
  limit?: number;
  offset?: number;
  range?: { from: number; to: number };
  order?: ListOrderSpec[];
}) {
  return applyListQueryDefaults(q, opts);
}

export function applyKf2ListInvariants<T extends PostgrestLikeBuilder>(q: T, opts?: Kf2ListOptions) {
  return applyListQueryDefaults(q, opts);
}
