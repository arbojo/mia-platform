'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface DriverLocation {
  id: string
  name: string
  vehicle: string | null
  last_lat: number | null
  last_lng: number | null
  last_gps_at: string | null
  status: string
  route_id: string | null
  current_visit?: {
    order_number: string
    customer_name: string
    address: string | null
    status: string
  } | null
  today_stats?: {
    delivered: number
    incidents: number
    total_orders: number
    collected: number
  }
}

interface CommandCenterMapProps {
  drivers: DriverLocation[]
  onDriverClick?: (driver: DriverLocation) => void
}

function getStaleness(lastGpsAt: string | null): {
  label: string
  color: string
  minutes: number
} {
  if (!lastGpsAt) {
    return { label: 'Sin señal', color: '#6b7280', minutes: Infinity }
  }
  const diff = Date.now() - new Date(lastGpsAt).getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 2) {
    return { label: 'Activo', color: '#22c55e', minutes }
  }
  if (minutes < 10) {
    return { label: `Última vez hace ${minutes} min`, color: '#eab308', minutes }
  }
  return { label: `Señal perdida hace ${minutes} min`, color: '#ef4444', minutes }
}

function createDriverIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'driver-marker',
    html: `<div style="
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: ${color};
      border: 2.5px solid white;
      box-shadow: 0 0 8px ${color}80, 0 2px 6px rgba(0,0,0,0.3);
      transition: all 0.3s ease;
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

function MapBounds({ drivers }: { drivers: DriverLocation[] }) {
  const map = useMap()

  useEffect(() => {
    const validDrivers = drivers.filter(
      (d) => d.last_lat != null && d.last_lng != null
    )
    if (validDrivers.length === 0) return

    if (validDrivers.length === 1) {
      map.setView(
        [validDrivers[0].last_lat!, validDrivers[0].last_lng!],
        15
      )
      return
    }

    const bounds = L.latLngBounds(
      validDrivers.map((d) => [d.last_lat!, d.last_lng!] as [number, number])
    )
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
  }, [drivers, map])

  return null
}

function DriverMarkers({
  drivers,
  onDriverClick,
}: {
  drivers: DriverLocation[]
  onDriverClick?: (driver: DriverLocation) => void
}) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  void tick

  return (
    <>
      {drivers.map((driver) => {
        if (driver.last_lat == null || driver.last_lng == null) return null
        const staleness = getStaleness(driver.last_gps_at)
        const icon = createDriverIcon(staleness.color)

        return (
          <Marker
            key={driver.id}
            position={[driver.last_lat, driver.last_lng]}
            icon={icon}
            eventHandlers={
              onDriverClick
                ? { click: () => onDriverClick(driver) }
                : undefined
            }
          >
            <Popup>
              <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '13px', minWidth: '180px' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                  {driver.name}
                </div>
                {driver.vehicle && (
                  <div style={{ color: '#666', fontSize: '12px' }}>
                    {driver.vehicle}
                  </div>
                )}
                <div
                  style={{
                    color: staleness.color,
                    fontSize: '11px',
                    marginTop: '4px',
                    fontWeight: 500,
                  }}
                >
                  {staleness.label}
                </div>
                {driver.current_visit && (
                  <div
                    style={{
                      marginTop: '6px',
                      padding: '4px 8px',
                      background: '#f0f9ff',
                      borderRadius: '4px',
                      fontSize: '11px',
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>
                      {driver.current_visit.order_number}
                    </div>
                    <div>{driver.current_visit.customer_name}</div>
                    {driver.current_visit.address && (
                      <div style={{ color: '#666' }}>
                        {driver.current_visit.address}
                      </div>
                    )}
                  </div>
                )}
                {driver.today_stats && (
                  <div
                    style={{
                      marginTop: '4px',
                      fontSize: '11px',
                      color: '#666',
                    }}
                  >
                    {driver.today_stats.delivered}/{driver.today_stats.total_orders} entregadas
                    {' · '}
                    ${driver.today_stats.collected}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}

export function CommandCenterMap({
  drivers,
  onDriverClick,
}: CommandCenterMapProps) {
  const validDrivers = drivers.filter(
    (d) => d.last_lat != null && d.last_lng != null
  )

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{
        border: '1px solid var(--atmosphere-border)',
        height: '360px',
      }}
    >
      <MapContainer
        center={[-34.6037, -58.3816]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {validDrivers.length > 0 && <MapBounds drivers={validDrivers} />}
        <DriverMarkers drivers={drivers} onDriverClick={onDriverClick} />
      </MapContainer>
    </div>
  )
}

export function DriverStalenessIndicator({ lastGpsAt }: { lastGpsAt: string | null }) {
  const staleness = getStaleness(lastGpsAt)

  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium"
      style={{ color: staleness.color }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: staleness.color }}
      />
      {staleness.label}
    </span>
  )
}
