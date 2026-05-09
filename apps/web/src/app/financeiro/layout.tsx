import { Suspense } from 'react';
import ClientLayout from './client-layout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div>A carregar...</div>}>
      <ClientLayout>{children}</ClientLayout>
    </Suspense>
  )
}
