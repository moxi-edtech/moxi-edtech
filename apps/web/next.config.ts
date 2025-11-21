// apps/web/next.config.ts
import path from 'path';

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
    console.warn(`[next.config] ${message}`);
  }

  if (missingServer.length > 0) {
    const message = `Missing optional Supabase server environment variables: ${missingServer.join(", ")}`;
    console.warn(`[next.config] ${message}. Server-side features that rely on these values may not function until they are configured.`);
  }
}

ensureSupabaseEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuração para standalone output (Docker)
  output: 'standalone',
  
  // Suas configurações existentes
  outputFileTracingRoot: path.join(__dirname, "../.."),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
};

// Bundle analyzer configuration
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

module.exports = withBundleAnalyzer(nextConfig);