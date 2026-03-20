const CFG = {
  start:      { icon: '🚛', color: '#69f0ae', label: 'Departure'     },
  pickup:     { icon: '📦', color: '#4fc3f7', label: 'Pickup'        },
  dropoff:    { icon: '✅', color: '#ce93d8', label: 'Delivered'     },
  rest:       { icon: '🛏', color: '#ffab40', label: '10-hr Rest'    },
  rest_break: { icon: '⏸', color: '#fff176', label: '30-min Break'  },
  fuel:       { icon: '⛽', color: '#80cbc4', label: 'Fuel Stop'     },
  cycle_rest: { icon: '⚠️', color: '#ff5252', label: '34-hr Restart' },
}

function fmtTime(dt) {
  if (!dt) return '—'
  const [date, time] = dt.split(' ')
  const d = new Date(`${date}T${time}`)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function StopsList({ stops }) {
  return (
    <div style={{ maxWidth: 540, margin: '0 auto' }}>
      <div style={{
        fontSize: 12, fontWeight: 700, letterSpacing: '0.12em',
        color: 'var(--text-muted)', marginBottom: 12,
        fontFamily: 'var(--font-display)',
      }}>
        STOP SCHEDULE
      </div>
      {stops.map((stop, i) => {
        const cfg = CFG[stop.type] || CFG.start
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 16,
            background: 'var(--navy-card)', border: '1px solid var(--navy-border)',
            borderRadius: 10, padding: '10px 18px', marginBottom: 10,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
          }}>
            <span style={{
              fontSize: 20, color: cfg.color, marginRight: 8
            }}>{cfg.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>
                {cfg.label}
              </div>
              {stop.location !== 'En route' && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {stop.location}
                </div>
              )}
              {stop.notes && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {stop.notes}
                </div>
              )}
            </div>
            <div style={{
              fontSize: 13, color: 'var(--accent)', fontWeight: 500, minWidth: 90, textAlign: 'right'
            }}>
              {fmtTime(stop.arrival_time)}
            </div>
          </div>
        )
      })}
    </div>
  )
}