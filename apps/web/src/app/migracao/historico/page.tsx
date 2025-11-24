import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";

export default function HistoricoImportacao() {
  const placeholders = [
    { importId: "demo-1", status: "uploaded", total: 120 },
    { importId: "demo-2", status: "imported", total: 87 },
  ];

  return (
    <main className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Histórico de Importações</h1>
        <p className="text-sm text-muted-foreground">Acompanhe importações recentes e resultados.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {placeholders.map((item) => (
          <Card key={item.importId}>
            <CardHeader>
              <CardTitle>Importação {item.importId}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">Status: {item.status}</p>
              <p className="text-sm">Registros: {item.total}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
