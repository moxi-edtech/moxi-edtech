'use client'

import { useState } from 'react'

import { footerLinks, hero, navLinks, pricingNote, pricingIntro } from '../../data/landing'
import { useRevealOnScroll } from '../../hooks/useRevealOnScroll'

import { AudienceSection } from './sections/AudienceSection'
import { FinalCtaSection } from './sections/FinalCtaSection'
import { FooterSection } from './sections/FooterSection'
import { HeroSection } from './sections/HeroSection'
import { MobileMenu } from './sections/MobileMenu'
import { Navbar } from './sections/Navbar'
import { PilotSection } from './sections/PilotSection'
import { PortalsSection } from './sections/PortalsSection'
import { ProductSection } from './sections/ProductSection'
import { PricingSection } from './sections/PricingSection'
import { WaveDivider } from './sections/WaveDivider'

export function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useRevealOnScroll()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klasse.ao'
  const scheduleUrl =
    process.env.NEXT_PUBLIC_SCHEDULE_URL ?? 'https://wa.me/19981682877?text=Quero%20saber%20mais%20sobre%20o%20KLASSE'

  const primaryCta = { label: hero.primaryCta, href: `${appUrl}/onboarding` }
  const navPrimaryCta = { label: 'Começar', href: primaryCta.href }
  const mobilePrimaryCta = { label: 'Começar agora', href: primaryCta.href }
  const secondaryCta = { label: hero.secondaryCta, href: scheduleUrl }

  return (
    <>
      <Navbar
        appUrl={appUrl}
        links={navLinks}
        primaryCta={navPrimaryCta}
        secondaryCta={secondaryCta}
        onMenuToggle={() => setIsMenuOpen((prev) => !prev)}
      />
      <MobileMenu
        isOpen={isMenuOpen}
        links={navLinks}
        primaryCta={mobilePrimaryCta}
        secondaryCta={secondaryCta}
        loginHref={`${appUrl}/login`}
        onClose={() => setIsMenuOpen(false)}
      />
      <HeroSection
        titleLines={hero.titleLines}
        eyebrow={hero.eyebrow}
        subtitle={hero.subtitle}
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        note={hero.note}
      />
      <WaveDivider />
      <ProductSection />
      <AudienceSection />
      <PortalsSection />
      <PricingSection intro={pricingIntro} note={pricingNote} appUrl={appUrl} />
      <PilotSection />
      <FinalCtaSection primaryCta={primaryCta} secondaryCta={secondaryCta} />
      <FooterSection links={footerLinks} />
    </>
  )
}
