import type { Ref } from 'react'
import { BRAND_IMAGE, CLOSING_WA_MESSAGE, buildWhatsAppHref } from '@/lib/catalogo/products'
import { WhatsAppButton } from './WhatsAppButton'

export function ClosingScene({ ref }: { ref?: Ref<HTMLElement> }) {
  return (
    <section
      ref={ref}
      className="catalogo-scene catalogo-closing"
      data-scene="closing"
      id="catalogo-contacto"
    >
      <div className="catalogo-closing-bg" aria-hidden="true">
        <div className="catalogo-hero-orb catalogo-hero-orb--b" />
      </div>
      <div className="catalogo-closing-inner">
        <div className="catalogo-hero-logo-wrap catalogo-closing-logo-wrap">
          <img className="catalogo-hero-logo catalogo-closing-logo" src={BRAND_IMAGE} alt="Vitanova" width={1408} height={768} />
        </div>
        <h2 className="catalogo-closing-title">¿Te interesa alguno?</h2>
        <p className="catalogo-closing-sub">Cuéntanos qué viste y lo resolvemos por WhatsApp.</p>
        <div className="catalogo-closing-cta">
          <WhatsAppButton label="Hablar por WhatsApp" large href={buildWhatsAppHref(CLOSING_WA_MESSAGE)} />
        </div>
        <p className="catalogo-closing-trust">Pago contra entrega</p>
      </div>
    </section>
  )
}