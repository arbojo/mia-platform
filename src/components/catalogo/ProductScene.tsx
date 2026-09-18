/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from 'react'
import type { CatalogProduct } from '@/lib/catalogo/products'
import { buildWhatsAppHref } from '@/lib/catalogo/products'
import { WhatsAppButton } from './WhatsAppButton'

export function ProductScene({
  product,
  index,
  registerScene,
}: {
  product: CatalogProduct
  index: number
  registerScene: (el: HTMLElement | null, index: number) => void
}) {
  const sceneStyle = { '--accent': product.accent } as CSSProperties

  return (
    <section
      ref={(el) => registerScene(el, index)}
      className="catalogo-scene catalogo-product-scene"
      data-scene="product"
      id={`catalogo-${product.slug}`}
      style={sceneStyle}
    >
      <div className="catalogo-stage">
        <div className="catalogo-stage-bg" aria-hidden="true">
          <img
            src={product.image}
            alt=""
            className="catalogo-stage-bg-img"
            loading="lazy"
            decoding="async"
          />
          <div className="catalogo-stage-glow catalogo-stage-glow--a" />
          <div className="catalogo-stage-glow catalogo-stage-glow--b" />
        </div>

        <div className="catalogo-stage-media">
          <div className="catalogo-stage-media-scene">
            <img
              src={product.image}
              alt=""
              aria-hidden="true"
              className="catalogo-stage-media-img"
              loading="lazy"
              decoding="async"
            />
            <img
              src={product.image}
              alt={product.imageAlt}
              className="catalogo-stage-media-img-sharp"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>

        <div className="catalogo-stage-copy">
          <div className="catalogo-stage-copy-inner">
            <p className="catalogo-product-eyebrow">
              <span className="catalogo-product-index">{String(index + 1).padStart(2, '0')}</span>
              {product.eyebrow}
            </p>
            <h2 className="catalogo-product-name">{product.name}</h2>
            <p className="catalogo-product-tagline">{product.tagline}</p>

            <ul className="catalogo-product-benefits">
              {product.benefits.map((benefit) => (
                <li key={benefit}>
                  <span className="catalogo-benefit-dot" aria-hidden="true" />
                  {benefit}
                </li>
              ))}
            </ul>

            <p className="catalogo-product-price">
              {product.price}
              {product.priceNote ? <span className="catalogo-product-price-note"> · {product.priceNote}</span> : null}
            </p>

            <div className="catalogo-product-action">
              <WhatsAppButton href={buildWhatsAppHref(product.waMessage)} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}