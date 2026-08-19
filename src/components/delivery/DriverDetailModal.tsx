'use client'

import { X, MapPin, Package, TrendingUp } from 'lucide-react'
import { DriverStalenessIndicator } from '@/components/delivery/CommandCenterMap'

interface DriverDetail {
  id: string
  name: string
  vehicle: string | null
  status: string
  last_lat: number | null
  last_lng: number | null
  last_gps_at: string | null
  route_id: string | null
  current_visit: {
    order_number: string
    customer_name: string
    address: string | null
    status: string
  } | null
  today_stats: {
    delivered: number
    incidents: number
    total_orders: number
    collected: number
  }
  route_visits?: Array<{
    order_number: string
    customer_name: string
    address: string | null
    status: string
    amount: number | null
    sequence: number
  }>
}

interface DriverDetailModalProps {
  driver: DriverDetail
  onClose: () => void
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: '#6b7280' },
  en_camino: { label: 'En camino', color: '#eab308' },
  en_ubicacion: { label: 'En ubicación', color: '#3b82f6' },
  entregado: { label: 'Entregado', color: '#22c55e' },
  incidencia: { label: 'Incidencia', color: '#ef4444' },
  revisit: { label: 'Reprogramada', color: '#a855f7' },
}

export function DriverDetailModal({ driver, onClose }: DriverDetailModalProps) {
  const stats = driver.today_stats
  const effectiveness =
    stats.total_orders > 0
      ? Math.round((stats.delivered / stats.total_orders) * 100)
      : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden"
        style={{
          borderRadius: 'var(--mod-radius-lg)',
          border: '1px solid var(--atmosphere-border)',
          backgroundColor: 'var(--atmosphere-bg)',
          backdropFilter: 'blur(24px) saturate(1.4)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between p-5"
          style={{ borderBottom: '1px solid var(--atmosphere-border)' }}
        >
          <div>
            <h3
              className="text-lg font-semibold"
              style={{ color: 'var(--atmosphere-text)' }}
            >
              {driver.name}
            </h3>
            <div className="mt-0.5 flex items-center gap-2">
              {driver.vehicle && (
                <span
                  className="text-xs"
                  style={{ color: 'var(--atmosphere-text-secondary)' }}
                >
                  {driver.vehicle}
                </span>
              )}
              <DriverStalenessIndicator lastGpsAt={driver.last_gps_at} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--atmosphere-text-secondary)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {driver.current_visit && (
            <div
              className="rounded-xl p-3.5"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--atmosphere-accent) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--atmosphere-accent) 15%, transparent)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-3.5 w-3.5" style={{ color: 'var(--atmosphere-accent)' }} />
                <span
                  className="text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--atmosphere-accent)' }}
                >
                  Parada actual
                </span>
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
                {driver.current_visit.order_number} — {driver.current_visit.customer_name}
              </p>
              {driver.current_visit.address && (
                <p className="mt-0.5 text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                  {driver.current_visit.address}
                </p>
              )}
              <span
                className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: `${STATUS_LABELS[driver.current_visit.status]?.color ?? '#6b7280'}15`,
                  color: STATUS_LABELS[driver.current_visit.status]?.color ?? '#6b7280',
                }}
              >
                {STATUS_LABELS[driver.current_visit.status]?.label ?? driver.current_visit.status}
              </span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Cobrado', value: `$${stats.collected.toLocaleString()}`, color: 'var(--atmosphere-accent)' },
              { label: 'Entregadas', value: `${stats.delivered}/${stats.total_orders}`, color: 'var(--mia-green)' },
              { label: 'Efectividad', value: `${effectiveness}%`, color: effectiveness >= 80 ? 'var(--mia-green)' : 'var(--mia-orange)' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg p-2.5 text-center"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--atmosphere-bg) 60%, transparent)',
                  border: '1px solid var(--atmosphere-border)',
                }}
              >
                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}>
                  {item.label}
                </p>
                <p className="mt-0.5 text-lg font-semibold" style={{ color: item.color }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {driver.route_visits && driver.route_visits.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Package className="h-3.5 w-3.5" style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.5 }} />
                <span
                  className="text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}
                >
                  Ruta de hoy
                </span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {driver.route_visits.map((visit, i) => {
                  const statusInfo = STATUS_LABELS[visit.status] ?? { label: visit.status, color: '#6b7280' }
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg px-3 py-2"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--atmosphere-bg) 60%, transparent)',
                        border: '1px solid var(--atmosphere-border)',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                          style={{
                            backgroundColor: `${statusInfo.color}15`,
                            color: statusInfo.color,
                          }}
                        >
                          {visit.sequence}
                        </span>
                        <div>
                          <p className="text-xs font-medium" style={{ color: 'var(--atmosphere-text)' }}>
                            {visit.order_number}
                          </p>
                          <p className="text-[10px]" style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}>
                            {visit.customer_name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className="inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                          style={{
                            backgroundColor: `${statusInfo.color}15`,
                            color: statusInfo.color,
                          }}
                        >
                          {statusInfo.label}
                        </span>
                        {visit.amount != null && (
                          <p className="mt-0.5 text-[10px] font-medium" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                            ${visit.amount}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {stats.incidents > 0 && (
            <div
              className="flex items-center gap-2 rounded-lg p-2.5"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--mia-orange) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--mia-orange) 15%, transparent)',
              }}
            >
              <TrendingUp className="h-3.5 w-3.5" style={{ color: 'var(--mia-orange)' }} />
              <span className="text-xs" style={{ color: 'var(--mia-orange)' }}>
                {stats.incidents} incidencia{stats.incidents !== 1 ? 's' : ''} registrada{stats.incidents !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
