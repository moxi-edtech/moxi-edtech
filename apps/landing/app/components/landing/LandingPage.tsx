'use client'

import { useState } from 'react'

import { footerLinks, hero, navLinks, pricingNote, pricingIntro, pricingPlans } from '../../data/landing'
import { useRevealOnScroll } from '../../hooks/useRevealOnScroll'

import { AudienceSection } from './sections/AudienceSection'
import { DashboardSection } from './sections/DashboardSection'
import { FooterSection } from './sections/FooterSection'
import { HeroSection } from './sections/HeroSection'
import { MobileMenu } from './sections/MobileMenu'
import { Navbar } from './sections/Navbar'
import { OnboardingLeadSection } from './sections/OnboardingLeadSection'
import { PilotSection } from './sections/PilotSection'
import { PortalsSection } from './sections/PortalsSection'
import { ProductSection } from './sections/ProductSection'
import { PricingPanel, PricingSection } from './sections/PricingSection'
import { WaveDivider } from './sections/WaveDivider'

export function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useRevealOnScroll()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klasse.ao'
  const scheduleUrl =
    process.env.NEXT_PUBLIC_SCHEDULE_URL ?? 'https://wa.me/244933349106?text=Quero%20saber%20mais%20sobre%20o%20KLASSE'

  const primaryCta = { label: hero.primaryCta, href: '#onboarding' }
  const navPrimaryCta = { label: 'Começar', href: primaryCta.href }
  const mobilePrimaryCta = { label: 'Começar agora', href: primaryCta.href }

  return (
    <>
      <Navbar
        appUrl={appUrl}
        links={navLinks}
        primaryCta={navPrimaryCta}
        onMenuToggle={() => setIsMenuOpen((prev) => !prev)}
      />
      <MobileMenu
        isOpen={isMenuOpen}
        links={navLinks}
        primaryCta={mobilePrimaryCta}
        loginHref={`${appUrl}/login`}
        onClose={() => setIsMenuOpen(false)}
      />
      <div className="panel-stack">
        <div className="panel panel--hero">
          <HeroSection
            titleLines={hero.titleLines}
            eyebrow={hero.eyebrow}
            subtitle={hero.subtitle}
            primaryCta={primaryCta}
            note={hero.note}
          />
        </div>
        <div className="panel">
          <WaveDivider />
          <ProductSection />
        </div>
        <div className="panel panel--audience">
          <AudienceSection />
        </div>
        <div className="panel panel--dashboard">
          <DashboardSection />
        </div>
        <div className="panel panel--portals">
          <PortalsSection />
        </div>
        <div className="panel panel--pricing-desktop">
          <PricingSection intro={pricingIntro} note={pricingNote} appUrl={appUrl} />
        </div>
        {pricingPlans.map((plan, index) => (
          <div key={plan.name} className="panel panel--pricing-mobile">
            <PricingPanel
              plan={plan}
              intro={pricingIntro}
              note={pricingNote}
              appUrl={appUrl}
              showIntro={index === 0}
              showNote={index === pricingPlans.length - 1}
            />
          </div>
        ))}
        <div className="panel panel--pilot">
          <PilotSection />
        </div>
        <div className="panel panel--onboarding">
          <OnboardingLeadSection scheduleUrl={scheduleUrl} />
          <div className="panel-footer">
            <FooterSection links={footerLinks} />
          </div>
        </div>
      </div>
    </>
  )
}
