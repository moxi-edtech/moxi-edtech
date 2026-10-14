export function usePathname() { return "/escola/escola-de-testes/aluno/academico"; }
export function useSearchParams() {
  return new URLSearchParams("aluno=00000000-0000-4000-8000-000000000402&ano_letivo_id=00000000-0000-4000-8000-000000000404");
}
export function useRouter() { return { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch: async () => {} }; }
export function useParams() { return { id: "escola-de-testes" }; }
