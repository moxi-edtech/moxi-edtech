// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");

const REQUIRED_PUBLIC_ENV = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const OPTIONAL_SERVER_ENV = ["SUPABASE_SERVICE_ROLE_KEY"];

function ensureSupabaseEnv() {
  const missingPublic = REQUIRED_PUBLIC_ENV.filter((name) => !process.env[name]);
  const missingServer = OPTIONAL_SERVER_ENV.filter((name) => !process.env[name]);

  const isStrict = process.env.CI === "true" || process.env.NODE_ENV === "production";

  if (missingPublic.length > 0) {
    const message = `Missing required Supabase environment variables: ${missingPublic.join(", ")}`;
    if (isStrict) {
      throw new Error(`[next.config] ${message}`);
    }
    // eslint-disable-next-line no-console
    console.warn(`[next.config] ${message}`);
  }

  if (missingServer.length > 0) {
    const message = `Missing optional Supabase server environment variables: ${missingServer.join(", ")}`;
    // eslint-disable-next-line no-console
    console.warn(`[next.config] ${message}. Server-side features that rely on these values may not function until they are configured.`);
  }
}

ensureSupabaseEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Suas configurações existentes aqui...

  // Silence multi-lockfile root inference by pointing to monorepo root
  outputFileTracingRoot: path.join(__dirname, "../.."),
  eslint: {
    // Allow production builds to succeed even with ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

// Enable bundle analyzer when ANALYZE=true
// eslint-disable-next-line @typescript-eslint/no-var-requires
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

module.exports = withBundleAnalyzer(nextConfig);
