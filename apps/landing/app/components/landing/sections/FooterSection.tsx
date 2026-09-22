interface FooterLink {
  href: string
  label: string
}

interface FooterSectionProps {
  links: FooterLink[]
}

export function FooterSection({ links }: FooterSectionProps) {
  return (
    <footer className="z">
      <div className="container">
        <div className="footer-inner">
            <div className="footer-logo">
              KLASSE<span>.</span>
              <span className="footer-logo-sub">Gestão Escolar</span>
            </div>
          <div className="footer-links">
            {links.map((link) => (
              <a key={link.label} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>
          <div className="footer-copy">© 2026 KLASSE. Feito em Angola, para Angola.</div>
        </div>
        <p className="footer-copy" style={{ marginTop: 20, lineHeight: 1.6 }}>
          KLASSE é um produto da MOXI SOLUÇÕES – COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, (SU), LDA.
        </p>
        <address className="footer-copy" style={{ marginTop: 8, lineHeight: 1.8, fontStyle: 'normal' }}>
          Sede: Bairro Azul, Rua dos Bombeiros, Nº S/N, Município de Menongue, Província de Cubango, Angola.
          <br />
          Telefone: <a href="tel:+244933349106" style={{ color: 'inherit', textDecoration: 'underline' }}>+244 933 349 106</a>
          <br />
          NIF: 5002637618
        </address>
      </div>
    </footer>
  )
}
