import { Suspense } from "react";
import { AtivarAcessoClient } from "./AtivarAcessoClient";

export default function AtivarAcessoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <AtivarAcessoClient />
    </Suspense>
  );
}
