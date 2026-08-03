import MensalidadesPrecosWorkspace from "./MensalidadesPrecosWorkspace";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  return (
    <MensalidadesPrecosWorkspace
      initialView={view === "precos" ? "precos" : "mensalidades"}
    />
  );
}
