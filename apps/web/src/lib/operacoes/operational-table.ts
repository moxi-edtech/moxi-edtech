/** Client-side presentation helper for already tenant-scoped operational rows. */
const normalizeSearch = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-AO");

export function filterAndPaginateOperationalRows<T>({
  rows,
  search,
  getSearchText,
  page,
  pageSize,
}: {
  rows: ReadonlyArray<T>;
  search: string;
  getSearchText: (row: T) => string;
  page: number;
  pageSize: number;
}) {
  const term = normalizeSearch(search.trim());
  const filtered = term
    ? rows.filter((row) => normalizeSearch(getSearchText(row) ?? "").includes(term))
    : [...rows];
  const safeSize = Number.isFinite(pageSize) ? Math.max(1, Math.min(100, Math.trunc(pageSize))) : 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / safeSize));
  const safeRequestedPage = Number.isFinite(page) ? Math.trunc(page) : 1;
  const currentPage = Math.min(totalPages, Math.max(1, safeRequestedPage));
  const items = filtered.slice((currentPage - 1) * safeSize, currentPage * safeSize);
  return { items, filteredCount: filtered.length, currentPage, totalPages };
}
