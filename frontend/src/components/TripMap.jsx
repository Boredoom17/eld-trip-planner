import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const COLORS = {
  start:      '#69f0ae',
  pickup:     '#4fc3f7',
  dropoff:    '#ce93d8',
  rest:       '#ffab40',
  rest_break: '#fff176',
  fuel:       '#80cbc4',
  cycle_rest: '#ff5252',
}

const makePin = (type, label) => L.divIcon({
  className: '',
  html: `
    <div style="display:flex;flex-direction:column;align-items:center;">
      <div style="
        width:20px; height:20px; border-radius:50%;
        background:${COLORS[type] || '#fff'};
        border:3px solid white;
        box-shadow:0 2px 12px rgba(0,0,0,0.5);
      "></div>
    </div>`,
  iconSize:   [20, 20],
  iconAnchor: [10, 10],
})

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

const LEGEND = [
  { color: '#4fc3f7', label: 'Leg 1: Current → Pickup',  line: true },
  { color: '#ce93d8', label: 'Leg 2: Pickup → Dropoff',  line: true },
  { color: '#69f0ae', label: 'Start point'                           },
  { color: '#4fc3f7', label: 'Pickup location'                       },
  { color: '#ce93d8', label: 'Dropoff location'                      },
  { color: '#ffab40', label: '10-hr rest stop'                       },
  { color: '#fff176', label: '30-min mandatory break'                 },
  { color: '#80cbc4', label: 'Fuel stop (every 1000 mi)'             },
  { color: '#ff5252', label: '34-hr restart (70-hr limit)'           },
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

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
       <MapContainer
            center={center}
            zoom={5}
            minZoom={3}
            maxZoom={18}
            maxBounds={[[-90, -180], [90, 180]]}
            maxBoundsViscosity={1.0}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            worldCopyJump={false}
        >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com">CARTO</a> &copy; <a href="https://openstreetmap.org">OSM</a>'
        />

        <FitBounds points={allPoints} />

        {/* leg 1 line — always cyan/blue regardless of direction */}
        {routes.leg1.length > 0 && (
          <Polyline
            positions={routes.leg1}
            color="#4fc3f7"
            weight={5}
            opacity={1}
          />
        )}

        {/* leg 2 line — always purple regardless of direction */}
        {routes.leg2.length > 0 && (
          <Polyline
            positions={routes.leg2}
            color="#ce93d8"
            weight={5}
            opacity={1}
          />
        )}

        {/* markers */}
        {stops.map((stop, i) => {
          let pos = null
          if (stop.type === 'start')   pos = [coordinates.current.lat, coordinates.current.lng]
          if (stop.type === 'pickup')  pos = [coordinates.pickup.lat,  coordinates.pickup.lng]
          if (stop.type === 'dropoff') pos = [coordinates.dropoff.lat, coordinates.dropoff.lng]
          if (!pos) return null

          return (
            <Marker key={i} position={pos} icon={makePin(stop.type)}>
              <Popup>
                <div style={{
                  fontFamily: 'DM Sans, sans-serif',
                  lineHeight: 1.6, minWidth: '190px',
                }}>
                  <div style={{
                    fontWeight: 700, fontSize: '14px',
                    color: COLORS[stop.type], marginBottom: '6px',
                  }}>
                    {stop.label}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                    🕐 {formatPopupTime(stop.arrival_time)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#444' }}>
                    {stop.notes}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}

      </MapContainer>

      {/* legend overlay */}
      <div style={{
        position: 'absolute', bottom: '20px', left: '12px', zIndex: 1000,
        background: 'rgba(15, 30, 50, 0.96)',
        border: '1px solid #2a4060', borderRadius: '12px',
        padding: '14px 16px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        minWidth: '210px',
      }}>
        <div style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
          color: '#8ba0b8', marginBottom: '12px',
          fontFamily: 'Syne, sans-serif',
        }}>
          MAP LEGEND
        </div>
        {LEGEND.map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center',
            gap: '10px', marginBottom: '8px',
          }}>
            {item.line ? (
              <div style={{
                width: 24, height: 4,
                background: item.color,
                borderRadius: 2, flexShrink: 0,
              }} />
            ) : (
              <div style={{
                width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                background: item.color,
                border: '2px solid rgba(255,255,255,0.4)',
              }} />
            )}
            <span style={{ fontSize: '12px', color: '#dce8f5', lineHeight: 1.3 }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

    </div>
  )
}