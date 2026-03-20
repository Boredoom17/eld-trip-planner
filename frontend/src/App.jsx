import { useState, useRef, useCallback } from 'react'
import axios from 'axios'
import TripForm from './components/TripForm'
import TripMap from './components/TripMap'
import StopsList from './components/StopsList'
import LogSheet from './components/LogSheet'

function formatTime(dt) {
  if (!dt) return '—'
  const [, time] = dt.split(' ')
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatFullDateTime(dt) {
  if (!dt) return '—'
  const [date, time] = dt.split(' ')
  const d = new Date(`${date}T${time}`)
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  )
}

export default function App() {
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState(null)
  const [tripData, setTripData]           = useState(null)
  const [activeTab, setActiveTab]         = useState('map')
  const [leftWidth, setLeftWidth]         = useState(400)
  const [savedSchedule, setSavedSchedule] = useState(null)
  const dragging     = useRef(false)
  const containerRef = useRef(null)

  const handlePlanTrip = async (formData) => {
    setLoading(true)
    setError(null)
    setSavedSchedule(null)
    try {
      const res = await axios.post('http://127.0.0.1:8000/api/plan-trip/', formData)
      setTripData(res.data)
      setActiveTab('map')
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong — is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  const handleScheduleSave = useCallback((schedules) => {
    setSavedSchedule(schedules)
    if (tripData?.trip_plan?.days) {
      setTripData(prev => ({
        ...prev,
        trip_plan: {
          ...prev.trip_plan,
          days: prev.trip_plan.days.map((day, i) => ({
            ...day,
            driver_schedule: schedules[i] || null,
          })),
        },
      }))
    }
  }, [tripData])

  const onMouseDown = useCallback(() => { dragging.current = true }, [])
  const onMouseMove = useCallback((e) => {
    if (!dragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const w    = e.clientX - rect.left
    if (w > 280 && w < 680) setLeftWidth(w)
  }, [])
  const onMouseUp = useCallback(() => { dragging.current = false }, [])

  const tabs = [
    { key: 'map',   label: '🗺 Map'        },
    { key: 'stops', label: '📍 Stops'      },
    { key: 'logs',  label: '📋 Log Sheets' },
  ]

  return (
    <div
      ref={containerRef}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}
    >
      {/* ── LEFT PANEL ──────────────────────────────── */}
      <div style={{
        width: leftWidth, minWidth: leftWidth, flexShrink: 0,
        height: '100vh', overflowY: 'auto',
        background: 'var(--navy-light)',
        borderRight: '1px solid var(--navy-border)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* header */}
        <div style={{ padding: '22px 22px 16px', borderBottom: '1px solid var(--navy-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', gap: '5px' }}>
              {['#ff5252', '#69f0ae', '#4fc3f7'].map((c, i) => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
              ))}
            </div>
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: '13px', letterSpacing: '0.1em', color: 'var(--text)',
            }}>SPOTTER</span>
          </div>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: '20px', lineHeight: 1.2, color: 'var(--text)',
          }}>ELD Trip Planner</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px' }}>
            FMCSA Hours of Service compliance tool
          </div>
        </div>

        {/* form + results */}
        <div style={{ padding: '20px 22px', flex: 1 }}>
          <TripForm
            onSubmit={handlePlanTrip}
            loading={loading}
            tripDays={tripData?.trip_plan?.days || null}
            savedSchedule={savedSchedule}
            onScheduleSave={handleScheduleSave}
          />

          {error && (
            <div style={{
              marginTop: '14px', padding: '11px 14px',
              background: 'rgba(255,82,82,0.1)',
              border: '1px solid rgba(255,82,82,0.3)',
              borderRadius: '8px', fontSize: '13px', color: '#ff8a80',
            }}>
              {error}
            </div>
          )}

          {tripData && (
            <div className="fade-up" style={{ marginTop: '24px' }}>
              <div style={{
                fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
                color: 'var(--text-muted)', marginBottom: '10px',
                fontFamily: 'var(--font-display)',
              }}>TRIP SUMMARY</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { label: 'Distance',   value: `${tripData.trip_plan.total_miles} mi`,         color: 'var(--accent)'  },
                  { label: 'Days',       value: `${tripData.trip_plan.total_days} days`,         color: 'var(--accent3)' },
                  { label: 'Drive time', value: `${tripData.trip_plan.total_driving_hours} hrs`, color: 'var(--accent2)' },
                  { label: 'ETA',        value: formatTime(tripData.trip_plan.estimated_arrival),color: 'var(--text)'    },
                ].map((item, i) => (
                  <div key={i} style={{
                    background: 'var(--navy-card)',
                    border: '1px solid var(--navy-border)',
                    borderRadius: '10px', padding: '12px',
                  }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                      {item.label}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontWeight: 700,
                      fontSize: '16px', color: item.color,
                    }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div style={{
                marginTop: '8px', background: 'var(--navy-card)',
                border: '1px solid var(--navy-border)',
                borderRadius: '10px', padding: '11px 14px',
                fontSize: '12px', color: 'var(--text-muted)',
              }}>
                🏁 Estimated arrival:&nbsp;
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>
                  {formatFullDateTime(tripData.trip_plan.estimated_arrival)}
                </span>
              </div>

              <div style={{
                display: 'flex', gap: '3px', marginTop: '14px',
                background: 'var(--navy-card)', padding: '3px',
                borderRadius: '10px', border: '1px solid var(--navy-border)',
              }}>
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      flex: 1, padding: '7px 4px', borderRadius: '7px',
                      border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: '12px',
                      transition: 'all 0.2s',
                      background: activeTab === tab.key ? 'var(--accent)' : 'transparent',
                      color: activeTab === tab.key ? '#151f2e' : 'var(--text-muted)',
                    }}
                  >{tab.label}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── DRAG HANDLE ─────────────────────────────── */}
      <div
        onMouseDown={onMouseDown}
        style={{
          width: '5px', flexShrink: 0, cursor: 'col-resize',
          background: 'var(--navy-border)', transition: 'background 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--accent)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--navy-border)'}
      />

      {/* ── RIGHT PANEL ─────────────────────────────── */}
      <div style={{ flex: 1, height: '100vh', position: 'relative', overflow: 'hidden' }}>

        {/* empty state */}
        {!tripData && !loading && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'var(--navy)',
          }}>
            <div style={{ fontSize: '52px', marginBottom: '14px', opacity: 0.1 }}>🚛</div>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: '18px', color: 'var(--text-muted)', marginBottom: '6px',
            }}>Your route will appear here</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', opacity: 0.5 }}>
              Fill in the trip details and click Plan Trip
            </div>
          </div>
        )}

        {/* loading */}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'var(--navy)',
          }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
              {['#ff5252', '#69f0ae', '#4fc3f7'].map((c, i) => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: '50%', background: c,
                  animation: 'pulse 1.2s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: '15px',
              color: 'var(--text-muted)',
            }}>Calculating HOS schedule...</div>
          </div>
        )}

        {/* map */}
        <div style={{
          position: 'absolute', inset: 0,
          opacity: tripData && activeTab === 'map' ? 1 : 0,
          pointerEvents: tripData && activeTab === 'map' ? 'all' : 'none',
          transition: 'opacity 0.3s',
        }}>
          {tripData && (
            <TripMap
              coordinates={tripData.coordinates}
              routeGeometry={tripData.route_geometry}
              stops={tripData.trip_plan.stops}
            />
          )}
        </div>

        {/* stops */}
        {tripData && activeTab === 'stops' && (
          <div style={{
            position: 'absolute', inset: 0, overflowY: 'auto',
            background: 'var(--navy)', padding: '32px 40px',
          }}>
            <StopsList stops={tripData.trip_plan.stops} />
          </div>
        )}

        {/* log sheets */}
        {tripData && activeTab === 'logs' && (
          <div style={{
            position: 'absolute', inset: 0, overflowY: 'auto',
            background: 'var(--navy)', padding: '32px 40px',
          }}>
            <LogSheet
              days={tripData.trip_plan.days}
              scheduleReady={!!savedSchedule}
            />
          </div>
        )}

      </div>
    </div>
  )
}