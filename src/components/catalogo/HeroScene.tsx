import type { Ref } from 'react'
import { BRAND_IMAGE, HERO_WA_MESSAGE, buildWhatsAppHref } from '@/lib/catalogo/products'
import { WhatsAppButton } from './WhatsAppButton'

export function HeroScene({ ref }: { ref?: Ref<HTMLElement> }) {
  return (
    <section
      ref={ref}
      className="catalogo-scene catalogo-hero"
      data-scene="hero"
      id="catalogo-inicio"
    >
      <div className="catalogo-hero-bg" aria-hidden="true">
        <div className="catalogo-hero-orb catalogo-hero-orb--a" />
        <div className="catalogo-hero-orb catalogo-hero-orb--b" />
      </div>

      <div className="catalogo-hero-inner">
        <div className="catalogo-hero-logo-wrap">
          <img className="catalogo-hero-logo" src={BRAND_IMAGE} alt="Vitanova" width={1408} height={768} />
        </div>
        <h1 className="catalogo-eyebrow-title">
          Encuentra lo que necesitas
          <span className="catalogo-eyebrow-em">en Vitanova</span>
        </h1>
        <p className="catalogo-sub">Cinco aliados para tu día a día.</p>

        <div className="catalogo-hero-cta">
          <WhatsAppButton label="Hablar por WhatsApp" href={buildWhatsAppHref(HERO_WA_MESSAGE)} />
        </div>
      </div>

      <div className="catalogo-scrollcue" aria-hidden="true">
        <span className="catalogo-scrollcue-line" />
        <span className="catalogo-scrollcue-label">Explora</span>
      </div>
    </section>
  )
}