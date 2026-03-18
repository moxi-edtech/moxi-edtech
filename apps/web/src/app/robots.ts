import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_SITE_URL ?? "https://klasse.ao";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/redes-escolares"],
        disallow: [
          "/login",
          "/forgot-password",
          "/reset-password",
          "/mudar-senha",
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
