type Props = {
  label: string;
  colorClass?: string;
  bgClass?: string;
};

export function Pill({ label, colorClass = "text-klasse-green-700", bgClass = "bg-klasse-green-50" }: Props) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${colorClass} ${bgClass}`}>
      {label}
    </span>
  );
}
