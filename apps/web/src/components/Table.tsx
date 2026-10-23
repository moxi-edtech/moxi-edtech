export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto relative shadow-md sm:rounded-lg border border-border bg-card">
      <table className="w-full text-sm text-left text-muted-foreground">
        {children}
      </table>
    </div>
  );
}
