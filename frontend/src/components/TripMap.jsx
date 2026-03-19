import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import { Box, Typography, Chip } from '@mui/material'

// leaflet's default icon breaks in React/Vite — this fixes it
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// different colored pins for each stop type
const getMarkerIcon = (type) => {
  const colors = {
    start: '#2e7d32',
    pickup: '#1565c0',
    dropoff: '#6a1b9a',
    rest: '#e65100',
    rest_break: '#f9a825',
    fuel: '#00838f',
    cycle_rest: '#b71c1c',
  }
  const color = colors[type] || '#555'

  return L.divIcon({
    className: '',
    html: `
      <div style="
        background: ${color};
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      "></div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

// ORS returns encoded polyline — this decodes it into lat/lng pairs
const decodePolyline = (encoded) => {
  const points = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let shift = 0
    let result = 0
    let byte

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    lat += result & 1 ? ~(result >> 1) : result >> 1

    shift = 0
    result = 0

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    lng += result & 1 ? ~(result >> 1) : result >> 1

    points.push([lat / 1e5, lng / 1e5])
  }

  return points
}

const stopTypeLabels = {
  start: 'Start',
  pickup: 'Pickup',
  dropoff: 'Dropoff',
  rest: 'Rest stop',
  rest_break: 'Break',
  fuel: 'Fuel',
  cycle_rest: '34hr Restart',
}

const stopTypeColors = {
  start: 'success',
  pickup: 'primary',
  dropoff: 'secondary',
  rest: 'warning',
  rest_break: 'warning',
  fuel: 'info',
  cycle_rest: 'error',
}

export default function TripMap({ coordinates, routeGeometry, stops }) {
  const [routePoints, setRoutePoints] = useState({ leg1: [], leg2: [] })

  useEffect(() => {
    if (routeGeometry?.leg1) {
      setRoutePoints({
        leg1: decodePolyline(routeGeometry.leg1),
        leg2: decodePolyline(routeGeometry.leg2),
      })
    }
  }, [routeGeometry])

  // center the map roughly between start and dropoff
  const center = [
    (coordinates.current.lat + coordinates.dropoff.lat) / 2,
    (coordinates.current.lng + coordinates.dropoff.lng) / 2,
  ]

  return (
    <Box>
      <div className="map-container">
        <MapContainer
          center={center}
          zoom={6}
          style={{ height: '100%', width: '100%' }}
        >
          {/* OpenStreetMap tiles — completely free */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          />

          {/* draw the actual road route */}
          {routePoints.leg1.length > 0 && (
            <Polyline
              positions={routePoints.leg1}
              color="#1565c0"
              weight={4}
              opacity={0.8}
            />
          )}
          {routePoints.leg2.length > 0 && (
            <Polyline
              positions={routePoints.leg2}
              color="#6a1b9a"
              weight={4}
              opacity={0.8}
            />
          )}

          {/* pin for each stop */}
          {stops.map((stop, i) => {
            // skip stops that don't have real coordinates yet
            if (stop.location === 'En route') return null

            // for named locations use the coordinates we got from geocoding
            let position
            if (stop.type === 'start') position = [coordinates.current.lat, coordinates.current.lng]
            else if (stop.type === 'pickup') position = [coordinates.pickup.lat, coordinates.pickup.lng]
            else if (stop.type === 'dropoff') position = [coordinates.dropoff.lat, coordinates.dropoff.lng]
            else return null

            return (
              <Marker key={i} position={position} icon={getMarkerIcon(stop.type)}>
                <Popup>
                  <div className="stop-popup">
                    <strong>{stop.label}</strong><br />
                    {stop.location}<br />
                    <span style={{ color: '#666' }}>{stop.arrival_time}</span><br />
                    {stop.notes}
                  </div>
                </Popup>
              </Marker>
            )
          })}

        </MapContainer>
      </div>

      {/* map legend */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
        {Object.entries(stopTypeLabels).map(([type, label]) => (
          <Chip
            key={type}
            label={label}
            size="small"
            color={stopTypeColors[type] || 'default'}
            variant="outlined"
          />
        ))}
      </Box>
    </Box>
  )
}