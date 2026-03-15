export function SchemaMarkup() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'KLASSE',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    description:
      'Sistema de gestão escolar para Angola. Controlo de propinas, matrículas, documentos MED e portais para todos os intervenientes escolares.',
    offers: {
      '@type': 'Offer',
      price: '80000',
      priceCurrency: 'AOA',
      priceValidUntil: '2026-12-31',
    },
    provider: {
      '@type': 'Organization',
      name: 'KLASSE',
      url: 'https://klasse.ao',
      areaServed: 'AO',
      availableLanguage: 'Portuguese',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
