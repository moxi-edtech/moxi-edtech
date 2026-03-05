type Props = {
  children: string;
  action?: string;
  onAction?: () => void;
};

export function SectionTitle({ children, action, onAction }: Props) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{children}</span>
      {action && (
        <button onClick={onAction} className="text-xs font-semibold text-klasse-green-600">
          {action}
        </button>
      )}
    </div>
  );
}
