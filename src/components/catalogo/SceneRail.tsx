import { catalogProducts } from '@/lib/catalogo/products'

export function SceneRail({
  active,
  onSelect,
}: {
  active: number
  onSelect: (index: number) => void
}) {
  const stops = ['Inicio', ...catalogProducts.map((p) => p.name)]

  return (
    <nav className="catalogo-rail" aria-label="Catálogo">
      <div className="catalogo-rail-track">
        {stops.map((label, i) => (
          <button
            key={label}
            type="button"
            className={`catalogo-rail-dot${active === i ? ' catalogo-rail-dot--active' : ''}`}
            onClick={() => onSelect(i)}
            aria-label={`Ir a ${label}`}
            aria-current={active === i ? 'true' : undefined}
          >
            <span className="catalogo-rail-label">{label}</span>
            <span className="catalogo-rail-pill" aria-hidden="true" />
          </button>
        ))}
      </div>
      <span className="catalogo-rail-counter">
        {String(Math.min(active, catalogProducts.length)).padStart(2, '0')} /{' '}
        {String(catalogProducts.length).padStart(2, '0')}
      </span>
    </nav>
  )
}