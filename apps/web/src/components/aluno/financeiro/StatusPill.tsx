export default function StatusPill({ status }: { status: 'pago' | 'pendente' | 'atrasado' }) {
  const map = {
    pago: 'bg-green-100 text-green-700',
    pendente: 'bg-yellow-100 text-yellow-700',
    atrasado: 'bg-red-100 text-red-700',
  } as const;
  return (
    <span className={`px-2 py-1 rounded-full text-xs ${map[status]}`}>{status}</span>
  );
}

