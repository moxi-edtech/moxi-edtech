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
      </div>
    </footer>
  )
}
