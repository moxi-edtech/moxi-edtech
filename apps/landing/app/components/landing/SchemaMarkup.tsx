export function SchemaMarkup() {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://klasse.ao/#organization',
        name: 'KLASSE',
        url: 'https://klasse.ao',
        logo: 'https://klasse.ao/logo-klasse.png',
        areaServed: 'AO',
      },
      {
        '@type': 'WebSite',
        '@id': 'https://klasse.ao/#website',
        url: 'https://klasse.ao',
        name: 'KLASSE',
        inLanguage: 'pt-AO',
        publisher: {
          '@id': 'https://klasse.ao/#organization',
        },
      },
      {
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
          '@id': 'https://klasse.ao/#organization',
        },
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
