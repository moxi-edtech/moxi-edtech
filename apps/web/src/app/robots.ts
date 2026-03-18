import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_SITE_URL ?? "https://klasse.ao";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/forgot-password", "/reset-password", "/mudar-senha"],
        disallow: [
          "/admin",
          "/secretaria",
          "/financeiro",
          "/professor",
          "/aluno",
          "/super-admin",
          "/api",
          "/escola",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
