# Agent 3 Apply Diff
run_id: 0adcbb88-c317-43d3-a6e0-e8f89199305e
timestamp: 2026-06-19T00:00:00-03:00

## Target
apps/web/next.config.ts

## Diff
```diff
@@
 const nextConfig = {
   typedRoutes: false,
+  transpilePackages: ["@moxi/auth-middleware", "@moxi/tenant-sdk"],
```
