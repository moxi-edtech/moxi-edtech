import NovaMentoriaForm from "./NovaMentoriaForm";

export const metadata = {
  title: "Lançar Mentoria | KLASSE Formação",
  description: "Crie a sua mentoria ou evento em segundos.",
};

export default function NovaMentoriaPage() {
  return (
    <div className="py-8">
      <NovaMentoriaForm />
    </div>
  );
}
