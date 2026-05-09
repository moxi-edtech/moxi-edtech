"use client";

import TabelasMensalidadeClient from '@/components/financeiro/TabelasMensalidadeClient'
import { useParams } from 'next/navigation'

export default function Page() {
  const params = useParams();
  const escolaId = params?.id as string;

  return (
    <div className="p-6">
      <TabelasMensalidadeClient escolaId={escolaId} />
    </div>
  )
}
