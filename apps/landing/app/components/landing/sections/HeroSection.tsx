import Image from 'next/image'

interface HeroSectionProps {
  titleLines: string[]
  eyebrow: string
  subtitle: string
  primaryCta: { label: string; href: string }
  secondaryCta: { label: string; href: string }
  note: string
}

export function HeroSection({ titleLines, eyebrow, subtitle, primaryCta, secondaryCta, note }: HeroSectionProps) {
  return (
    <section className="hero z section-accent">
      <div className="container">
        <div className="hero-content">
          <div className="hero-copy">
            <div className="hero-eyebrow">{eyebrow}</div>
            <h1>
              {titleLines.map((line, index) => (
                <span key={line}>
                  {line}
                  {index < titleLines.length - 1 && <br />}
                </span>
              ))}
            </h1>
            <p className="hero-sub">{subtitle}</p>
            <div className="hero-ctas">
              <a href={primaryCta.href} className="btn-p">
                {primaryCta.label}
              </a>
              <a href={secondaryCta.href} className="btn-s">
                {secondaryCta.label}
              </a>
            </div>
            <div className="hero-proof">
              <div className="proof-text">
                <strong>{note}</strong>
              </div>
            </div>
          </div>
        </div>
        <Image
          src="/diretor%20com%20terno.PNG"
          alt="Director de escola angolana com terno"
          fill
          sizes="100vw"
          priority
          className="hero-bg-image"
        />
      </div>
    </section>
  )
}
