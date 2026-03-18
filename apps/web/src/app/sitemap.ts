import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_SITE_URL ?? "https://klasse.ao";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: "/", priority: 1, changeFrequency: "weekly" as const },
    { path: "/login", priority: 0.2, changeFrequency: "monthly" as const },
    { path: "/forgot-password", priority: 0.1, changeFrequency: "monthly" as const },
    { path: "/reset-password", priority: 0.1, changeFrequency: "monthly" as const },
    { path: "/mudar-senha", priority: 0.1, changeFrequency: "monthly" as const },
  ];

  return routes.map((route) => ({
    url: `${siteUrl}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
