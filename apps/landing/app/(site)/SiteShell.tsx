'use client'

import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { FooterSection } from '../components/landing/sections/FooterSection'
import { MobileMenu } from '../components/landing/sections/MobileMenu'
import { Navbar } from '../components/landing/sections/Navbar'
import { footerLinks, navLinks } from '../data/landing'

export function SiteShell({ children }: { children: ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klasse.ao'
  const navPrimaryCta = { label: 'Começar agora', href: '/#onboarding' }
  const navLinksWithHome = useMemo(
    () => navLinks.map((link) => ({ ...link, href: link.href.startsWith('#') ? `/${link.href}` : link.href })),
    []
  )

  return (
    <div className="landing-site-shell min-h-screen flex flex-col">
      <Navbar
        appUrl={appUrl}
        links={navLinksWithHome}
        primaryCta={navPrimaryCta}
        onMenuToggle={() => setIsMenuOpen((prev) => !prev)}
      />
      <MobileMenu
        isOpen={isMenuOpen}
        links={navLinksWithHome}
        primaryCta={navPrimaryCta}
        loginHref={`${appUrl}/login`}
        onClose={() => setIsMenuOpen(false)}
      />
      <main className="relative top-0 z-10 flex-1 pt-32 md:pt-40 lg:pt-44">
        {children}
      </main>
      <div className="relative z-10 mt-auto">
        <FooterSection links={footerLinks} />
      </div>
    </div>
  )
}
