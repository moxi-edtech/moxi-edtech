import { use } from "react";
import StructureMarketplace from "../../../../../../components/escola/settings/StructureMarketplace";

type Props = {
  params: Promise<{ id: string }>;
};

export default function EstruturaPage({ params }: Props) {
  const { id } = use(params);
  return (
    <div className="bg-slate-50 min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <StructureMarketplace escolaId={id} />
      </div>
    </div>
  );
}
