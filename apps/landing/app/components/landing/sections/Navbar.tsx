import { useEffect } from 'react'

interface NavLink {
  href: string
  label: string
}

interface NavbarProps {
  appUrl: string
  links: NavLink[]
  primaryCta: { label: string; href: string }
  secondaryCta: { label: string; href: string }
  onMenuToggle: () => void
}

export function Navbar({ appUrl, links, primaryCta, secondaryCta, onMenuToggle }: NavbarProps) {
  useEffect(() => {
    const handleScroll = () => {
      const navbar = document.getElementById('navbar')
      if (navbar) {
        navbar.classList.toggle('scrolled', window.scrollY > 50)
      }
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav id="navbar">
      <div className="container">
        <div className="nav-inner">
          <a href="#" className="nav-logo z">
            KLASSE<span>.</span>
            <span className="nav-logo-sub">Gestão Escolar</span>
          </a>
          <div className="nav-links z">
            {links.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="z">
            <a href={secondaryCta.href} className="btn-s" style={{ padding: '8px 18px', fontSize: 13 }}>
              {secondaryCta.label}
            </a>
            <a href={primaryCta.href} className="nav-cta">
              {primaryCta.label}
            </a>
            <a href={`${appUrl}/login`} className="btn-s" style={{ padding: '8px 18px', fontSize: 13 }}>
              Entrar
            </a>
            <button className="hamburger" onClick={onMenuToggle} aria-label="Menu" type="button">
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
