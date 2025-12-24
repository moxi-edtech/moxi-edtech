export function Card({ title, value, icon: Icon }: { title: string; value: string; icon: any; }) {
  return (
    <div className="p-4 border rounded-xl shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <Icon className="h-6 w-6 text-gray-400" />
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}