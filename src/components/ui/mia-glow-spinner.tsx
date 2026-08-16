interface MiaGlowSpinnerProps {
  label?: string
}

export function MiaGlowSpinner({ label = 'Cargando…' }: MiaGlowSpinnerProps) {
  return (
    <span role="status" aria-live="polite" className="inline-flex flex-col items-center gap-3">
      <span aria-hidden="true" className="mia-glow-spinner" />
      <span className="sr-only">{label}</span>
    </span>
  )
}
