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
    const navbar = document.getElementById('navbar')
    const panelStack = document.querySelector<HTMLElement>('.panel-stack')
    if (!navbar) return

    const handleScroll = () => {
      const scrollTop = panelStack ? panelStack.scrollTop : window.scrollY
      navbar.classList.toggle('scrolled', scrollTop > 50)
    }

    const updateNavHeight = () => {
      document.documentElement.style.setProperty('--nav-h', `${navbar.offsetHeight}px`)
    }

    handleScroll()
    updateNavHeight()
    panelStack?.addEventListener('scroll', handleScroll)
    window.addEventListener('scroll', handleScroll)

    const resizeObserver = new ResizeObserver(() => updateNavHeight())
    resizeObserver.observe(navbar)

    return () => {
      panelStack?.removeEventListener('scroll', handleScroll)
      window.removeEventListener('scroll', handleScroll)
      resizeObserver.disconnect()
    }
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="z nav-actions">
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
