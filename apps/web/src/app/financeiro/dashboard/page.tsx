import FinanceiroDashboardPage, { dynamic } from "../page";

export { dynamic };

export default function Page(props: { searchParams?: Promise<{ aluno?: string; view?: string }> }) {
  return <FinanceiroDashboardPage {...props} />;
}
