import type { ReactNode } from 'react'
import { socialLinks } from '../../../data/landing'

interface FooterLink {
  href: string
  label: string
}

interface FooterSectionProps {
  links: FooterLink[]
}

const SOCIAL_ICONS: Record<string, ReactNode> = {
  facebook: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5h1.65V3.6c-.29-.04-1.27-.13-2.41-.13-2.38 0-4.01 1.45-4.01 4.12v2.3H7.5V13h2.78v8h3.22Z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM17.5 6a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z"
      />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6.94 5a1.94 1.94 0 1 1-3.88 0 1.94 1.94 0 0 1 3.88 0ZM3.2 8.48h3.6V21H3.2V8.48Zm5.8 0h3.45v1.71h.05c.48-.9 1.65-1.85 3.4-1.85 3.64 0 4.31 2.39 4.31 5.5V21h-3.6v-5.9c0-1.41-.03-3.22-1.96-3.22-1.96 0-2.26 1.53-2.26 3.11V21H9V8.48Z" />
    </svg>
  ),
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
        <div className="footer-social">
          {socialLinks.map((link) => (
            <a
              key={link.network}
              href={link.href}
              aria-label={link.label}
              title={link.label}
              target="_blank"
              rel="noopener noreferrer"
            >
              {SOCIAL_ICONS[link.network] ?? null}
            </a>
          ))}
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
