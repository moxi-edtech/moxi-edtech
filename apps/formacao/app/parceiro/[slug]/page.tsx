import type { Metadata } from "next";
import { PartnerTalentPoolClient } from "./PartnerTalentPoolClient";

type Props = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Talentos Parceiros · ${slug}`,
    description: "Porta B2B de talentos anonimos recomendados pela instituicao parceira.",
  };
}

export default async function PartnerTalentPoolPage({ params }: Props) {
  const { slug } = await params;
  return <PartnerTalentPoolClient slug={slug} />;
}
