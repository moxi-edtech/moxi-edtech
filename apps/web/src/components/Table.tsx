export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto relative shadow-md sm:rounded-lg">
      <table className="w-full text-sm text-left text-gray-500">
        {children}
      </table>
    </div>
  );
}