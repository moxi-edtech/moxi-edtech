// apps/web/next.config.ts
import path from 'path';

const LUCIDE_SOURCEMAP_STRIPPER = path.join(__dirname, "loaders", "strip-lucide-sourcemap.js");

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

  if (missingServer.length > 0 && isStrict) {
    const message = `Missing optional Supabase server environment variables: ${missingServer.join(", ")}`;
    console.warn(`[next.config] ${message}. Server-side features that rely on these values may not function until they are configured.`);
  }
}

ensureSupabaseEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuração para standalone output (Docker)
  output: 'standalone',
  typedRoutes: false,
  
  // Suas configurações existentes
  outputFileTracingRoot: path.join(__dirname, "../.."),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /node_modules[\\/]+lucide-react[\\/]dist[\\/]esm[\\/].*\.js$/,
      use: [
        {
          loader: LUCIDE_SOURCEMAP_STRIPPER,
        },
      ],
    });

    return config;
  },
};

// Bundle analyzer configuration
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

module.exports = withBundleAnalyzer(nextConfig);
