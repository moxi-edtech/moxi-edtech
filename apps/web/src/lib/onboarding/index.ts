// src/lib/onboarding/index.ts

export * from "./curriculum-presets";
export * from "./validators";
export * from "./helpers";
// Evite re-exportar de componentes para não criar ciclos entre lib ⇄ components
// Se precisar de tipos/metadados dos componentes, importe-os diretamente do caminho do componente.
