import { WhatsAppGlyph } from './WhatsAppGlyph'

export function WhatsAppButton({
  label = 'Me interesa · WhatsApp',
  large = false,
  href,
}: {
  label?: string
  large?: boolean
  href?: string
}) {
  const className = `catalogo-whatsapp-btn${large ? ' catalogo-whatsapp-btn--large' : ''}`

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className={className}
      >
        <span className="catalogo-whatsapp-glow" aria-hidden="true" />
        <WhatsAppGlyph size={large ? 22 : 18} />
        <span>{label}</span>
      </a>
    )
  }

  return (
    <button
      type="button"
      aria-label={label}
      className={className}
    >
      <span className="catalogo-whatsapp-glow" aria-hidden="true" />
      <WhatsAppGlyph size={large ? 22 : 18} />
      <span>{label}</span>
    </button>
  )
}