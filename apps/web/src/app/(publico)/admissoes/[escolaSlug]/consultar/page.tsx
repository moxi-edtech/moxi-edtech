import StatusInquiryForm from "./StatusInquiryForm";

export default async function ConsultarPage(props: { params: Promise<{ escolaSlug: string }> }) {
  const { escolaSlug } = await props.params;

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 md:py-20">
      <StatusInquiryForm escolaSlug={escolaSlug} />
    </main>
  );
}
