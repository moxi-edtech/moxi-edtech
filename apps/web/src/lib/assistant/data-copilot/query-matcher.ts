type IntentMatcherOptions = {
  maxDistance?: number;
  minimumFuzzyLength?: number;
};

type IntentQueryParams = {
  query: string;
  scopeTerms: readonly string[];
  diagnosisTerms: readonly string[];
  contextMatches?: boolean;
  options?: IntentMatcherOptions;
};

export function normalizeAssistantText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ªº°]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function editDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array<number>(right.length + 1);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }

    for (let index = 0; index <= right.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[right.length];
}

export function matchesIntentTerms(
  query: string,
  terms: readonly string[],
  options: IntentMatcherOptions = {},
) {
  const normalizedQuery = normalizeAssistantText(query);
  if (!normalizedQuery) return false;

  const maxDistance = options.maxDistance ?? 1;
  const minimumFuzzyLength = options.minimumFuzzyLength ?? 6;
  const queryTokens = normalizedQuery.split(" ");

  return terms.some((term) => {
    const normalizedTerm = normalizeAssistantText(term);
    if (!normalizedTerm) return false;
    if (normalizedQuery.includes(normalizedTerm)) return true;

    return queryTokens.some((token) => {
      if (token.startsWith(normalizedTerm) || normalizedTerm.startsWith(token)) {
        return Math.min(token.length, normalizedTerm.length) >= 4;
      }

      if (token.length < minimumFuzzyLength || normalizedTerm.length < minimumFuzzyLength) {
        return false;
      }

      if (editDistance(token, normalizedTerm) <= maxDistance) {
        return true;
      }

      const comparablePrefix = token.slice(0, normalizedTerm.length);
      return comparablePrefix.length >= minimumFuzzyLength
        && editDistance(comparablePrefix, normalizedTerm) <= maxDistance;
    });
  });
}

export function matchesIntentQuery(params: IntentQueryParams) {
  const scopeMatches =
    Boolean(params.contextMatches) ||
    matchesIntentTerms(params.query, params.scopeTerms, params.options);
  if (!scopeMatches) return false;

  return matchesIntentTerms(params.query, params.diagnosisTerms, params.options);
}
