import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl

// ── custom fun markers ───────────────────────────────────────────────────────

const makeMarker = (emoji, bg, size = 36) => L.divIcon({
  className: '',
  html: `
    <div style="
      width:${size}px; height:${size}px;
      background:${bg};
      border-radius:50% 50% 50% 4px;
      transform: rotate(-45deg);
      border: 3px solid white;
      box-shadow: 0 3px 14px rgba(0,0,0,0.45);
      display:flex; align-items:center; justify-content:center;
    ">
      <span style="transform:rotate(45deg); font-size:${size * 0.42}px; line-height:1;">
        ${emoji}
      </span>
    </div>`,
  iconSize:   [size, size],
  iconAnchor: [size / 2, size],
  popupAnchor:[0, -size],
})

const MARKERS = {
  start:   () => makeMarker('🚛', '#1b2e1b', 40),
  pickup:  () => makeMarker('📦', '#0d2233', 38),
  dropoff: () => makeMarker('🏁', '#1e0d33', 38),
  fuel:    () => makeMarker('⛽', '#0d2626', 34),
}

// decodes ORS encoded polyline format into lat/lng array
const decodePoly = (enc) => {
  const pts = []
  let i = 0, lat = 0, lng = 0
  while (i < enc.length) {
    let s = 0, r = 0, b
    do { b = enc.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5 } while (b >= 0x20)
    lat += r & 1 ? ~(r >> 1) : r >> 1
    s = 0; r = 0
    do { b = enc.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5 } while (b >= 0x20)
    lng += r & 1 ? ~(r >> 1) : r >> 1
    pts.push([lat / 1e5, lng / 1e5])
  }
  return pts
}

function FitBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [60, 60] })
    }
  }, [points])
  return null
}

function formatPopupTime(dt) {
  if (!dt) return '—'
  const [date, time] = dt.split(' ')
  const d = new Date(`${date}T${time}`)
  return (
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  )
}

// ── legend — only 4 items actually on the map ────────────────────────────────
const LEGEND = [
  { color: '#4fc3f7', label: 'Leg 1: Current → Pickup', line: true },
  { color: '#ce93d8', label: 'Leg 2: Pickup → Dropoff', line: true },
  { emoji: '🚛', label: 'Start / Current location' },
  { emoji: '📦', label: 'Pickup location'          },
  { emoji: '🏁', label: 'Dropoff / Destination'    },
  { emoji: '⛽', label: 'Fuel stop (every 1000 mi)'},
]

export default function TripMap({ coordinates, routeGeometry, stops }) {
  const [routes, setRoutes] = useState({ leg1: [], leg2: [] })

  useEffect(() => {
    if (routeGeometry?.leg1) {
      setRoutes({
        leg1: decodePoly(routeGeometry.leg1),
        leg2: decodePoly(routeGeometry.leg2),
      })
    }
  }, [routeGeometry])

  const allPoints = [...routes.leg1, ...routes.leg2]
  const center    = [
    (coordinates.current.lat + coordinates.dropoff.lat) / 2,
    (coordinates.current.lng + coordinates.dropoff.lng) / 2,
  ]

  // only 4 marker types on the map
  const mappableStops = stops.filter(s =>
    ['start', 'pickup', 'dropoff', 'fuel'].includes(s.type)
  )

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapContainer
        center={center} zoom={5} minZoom={3} maxZoom={18}
        maxBounds={[[-90, -180], [90, 180]]} maxBoundsViscosity={1.0}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false} worldCopyJump={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com">CARTO</a> &copy; <a href="https://openstreetmap.org">OSM</a>'
        />

        <FitBounds points={allPoints} />

        {routes.leg1.length > 0 && (
          <Polyline positions={routes.leg1} color="#4fc3f7" weight={5} opacity={0.9} />
        )}
        {routes.leg2.length > 0 && (
          <Polyline positions={routes.leg2} color="#ce93d8" weight={5} opacity={0.9} />
        )}

        {mappableStops.map((stop, i) => {
          let pos = null
          if (stop.type === 'start')   pos = [coordinates.current.lat, coordinates.current.lng]
          if (stop.type === 'pickup')  pos = [coordinates.pickup.lat,  coordinates.pickup.lng]
          if (stop.type === 'dropoff') pos = [coordinates.dropoff.lat, coordinates.dropoff.lng]
          if (stop.type === 'fuel' && stop.lat && stop.lng) pos = [stop.lat, stop.lng]
          if (!pos) return null

          const icon = MARKERS[stop.type]?.()
          if (!icon) return null

          return (
            <Marker key={i} position={pos} icon={icon}>
              <Popup>
                <div style={{ fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6, minWidth: '200px' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                    {stop.label}
                  </div>
                  {stop.location && stop.location !== 'En route' && (
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                      📍 {stop.location}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                    🕐 {formatPopupTime(stop.arrival_time)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#444' }}>{stop.notes}</div>
                </div>
              </Popup>
            </Marker>
          )
        })}

      </MapContainer>

      {/* ── compact legend ─── */}
      <div style={{
        position: 'absolute', bottom: '20px', left: '12px', zIndex: 1000,
        background: 'rgba(15, 30, 50, 0.93)',
        border: '1px solid #2a4060', borderRadius: '12px',
        padding: '12px 14px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        minWidth: '195px',
      }}>
        <div style={{
          fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em',
          color: '#8ba0b8', marginBottom: '10px',
          fontFamily: 'Syne, sans-serif',
        }}>
          MAP LEGEND
        </div>
        {LEGEND.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '7px' }}>
            {item.line ? (
              <div style={{ width: 22, height: 4, background: item.color, borderRadius: 2, flexShrink: 0 }} />
            ) : (
              <span style={{ fontSize: '14px', flexShrink: 0 }}>{item.emoji}</span>
            )}
            <span style={{ fontSize: '11px', color: '#dce8f5', lineHeight: 1.3 }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}