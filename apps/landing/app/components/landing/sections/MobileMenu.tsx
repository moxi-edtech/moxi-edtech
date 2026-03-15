interface NavLink {
  href: string
  label: string
}

interface MobileMenuProps {
  isOpen: boolean
  links: NavLink[]
  primaryCta: { label: string; href: string }
  secondaryCta: { label: string; href: string }
  loginHref: string
  onClose: () => void
}

export function MobileMenu({ isOpen, links, primaryCta, secondaryCta, loginHref, onClose }: MobileMenuProps) {
  return (
    <div className={`mobile-menu${isOpen ? ' open' : ''}`} id="mobileMenu">
      <button className="close-btn" onClick={onClose} type="button">
        ×
      </button>
      {links.map((link) => (
        <a key={link.href} href={link.href} onClick={onClose}>
          {link.label}
        </a>
      ))}
      <a href={primaryCta.href} className="btn-p" onClick={onClose}>
        {primaryCta.label}
      </a>
      <a href={secondaryCta.href} className="btn-s" onClick={onClose}>
        {secondaryCta.label}
      </a>
      <a href={loginHref} className="btn-s" onClick={onClose}>
        Entrar
      </a>
    </div>
  )
}
