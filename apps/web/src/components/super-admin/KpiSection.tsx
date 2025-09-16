export default function KpiSection() {
  return (
    <section className="grid md:grid-cols-4 gap-6 mb-6">
      {[
        { title: "Escolas Ativas", value: "12", desc: "Instituições conectadas" },
        { title: "Usuários Globais", value: "230", desc: "Contas com acesso ao SaaS" },
        { title: "Matrículas", value: "1.245", desc: "Total agregado" },
        { title: "Financeiro", value: "87%", desc: "Taxa de pagamentos consolidados" },
      ].map((card, i) => (
        <div
          key={i}
          className="bg-white p-6 rounded-2xl shadow hover:shadow-md transition-transform hover:-translate-y-1 border border-moxinexa-light/50"
        >
          <h2 className="text-sm font-medium text-moxinexa-dark">{card.title}</h2>
          <p className="text-3xl font-bold text-moxinexa-teal mt-2">{card.value}</p>
          <p className="text-sm text-gray-500">{card.desc}</p>
        </div>
      ))}
    </section>
  );
}
