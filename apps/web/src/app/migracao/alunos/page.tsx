import { Suspense } from 'react';
import AlunoMigrationWizard from './wizard';

export default function Page() {
  return (
    <Suspense fallback={<div>A carregar...</div>}>
      <AlunoMigrationWizard />
    </Suspense>
  )
}