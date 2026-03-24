import type { MetadataRoute } from 'next'

const BASE_URL = 'https://klasse.ao'

const ROUTES = [
  '/',
  '/sistema-de-gestao-escolar',
  '/gestao-de-propinas',
  '/matriculas-escolares',
  '/notas-escolares',
  '/presencas-escolares',
  '/secretaria-escolar',
  '/financeiro-escolar',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return ROUTES.map((path, index) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: index === 0 ? 1 : index === 1 ? 0.9 : 0.8,
  }))
}
