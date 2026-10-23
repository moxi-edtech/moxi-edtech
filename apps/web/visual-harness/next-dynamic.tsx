import React, { lazy, Suspense } from "react";

// Test-only adapter for Next dynamic(): preserve genuine React lazy loading.
export default function dynamic<Props extends object>(
  loader: () => Promise<{ default: React.ComponentType<Props> } | React.ComponentType<Props>>,
  options?: { loading?: () => React.ReactNode },
) {
  const Component = lazy(async () => {
    const result = await loader();
    return "default" in result ? result : { default: result };
  });
  return function FixtureDynamic(props: Props) {
    return <Suspense fallback={options?.loading?.() ?? null}><Component {...props} /></Suspense>;
  };
}
