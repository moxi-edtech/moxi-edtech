export function usePathname() { return "/escola/escola-de-testes/aluno/academico"; }
export function useSearchParams() {
  const parameters = new URLSearchParams(window.location.search);
  if (!parameters.has("ano_letivo_id")) parameters.set("ano_letivo_id", "00000000-0000-4000-8000-000000000404");
  return parameters;
}
export function useRouter() { return { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch: async () => {} }; }
export function useParams() { return { id: "escola-de-testes" }; }
