// ── config ────────────────────────────────────────────────────────────────────
const CFG = {
  start:      { icon: '🟢', color: '#69f0ae', label: 'Departure'             },
  pre_trip:   { icon: '🔧', color: '#ffab40', label: 'Pre-trip Inspection'   },
  rest_break: { icon: '⏸',  color: '#fff176', label: '30-min Mandatory Break'},
  fuel:       { icon: '⛽', color: '#80cbc4', label: 'Fuel Stop'             },
  pickup:     { icon: '📦', color: '#4fc3f7', label: 'Pickup'                },
  dropoff:    { icon: '✅', color: '#69f0ae', label: 'Delivered'             },
  cycle_rest: { icon: '⚠️',  color: '#ff5252', label: '34-hr Restart'         },
}

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtArrival(dtStr) {
  if (!dtStr) return ''
  const [, time] = dtStr.split(' ')
  const [hh, mm] = time.split(':').map(Number)
  const ampm = hh >= 12 ? 'PM' : 'AM'
  const hr   = hh % 12 || 12
  return `${hr}:${String(mm).padStart(2, '0')} ${ampm}`
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtHours(h) {
  const hrs  = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  if (hrs === 0) return `${mins} min`
  if (mins === 0) return `${hrs} hr`
  return `${hrs} hr ${mins} min`
}

function arrivalToDecimal(dtStr) {
  if (!dtStr) return 0
  const [hh, mm] = dtStr.split(' ')[1].split(':').map(Number)
  return hh + mm / 60
}

// ── build per-day event list ──────────────────────────────────────────────────
function buildDays(stops, days) {
  // Only truly actionable stops — not rest (shown in summary) or start (shown as header)
  const KEY_TYPES = new Set(['pre_trip', 'rest_break', 'fuel', 'pickup', 'dropoff', 'cycle_rest'])

  // find dates that have a cycle_rest event — the following day(s) are continuations
  const restartDates = new Set(
    stops
      .filter(s => s.type === 'cycle_rest')
      .map(s => s.arrival_time?.split(' ')[0])
  )

  return days.map((day, di) => {
    const date = day.date

    // a day is a "full restart" if it has ONLY off_duty all day
    const isRestart = day.grid?.length === 1 &&
                      day.grid[0].status === 'off_duty' &&
                      day.grid[0].end - day.grid[0].start >= 23.9

    // a day is a "restart continuation" if the previous day had cycle_rest
    // (the restart was already shown as an event card on the previous day)
    const prevDate = di > 0 ? days[di - 1].date : null
    const isRestartContinuation = isRestart && prevDate && restartDates.has(prevDate)

    const events = stops
      .filter(s => KEY_TYPES.has(s.type) && s.arrival_time?.split(' ')[0] === date)
      .sort((a, b) => arrivalToDecimal(a.arrival_time) - arrivalToDecimal(b.arrival_time))

    const startStop = di === 0 ? stops.find(s => s.type === 'start') : null

    const drivingHrs = (day.grid || [])
      .filter(s => s.status === 'driving')
      .reduce((acc, s) => acc + (s.end - s.start), 0)

    const sleeperHrs = (day.grid || [])
      .filter(s => s.status === 'sleeper' || s.status === 'off_duty')
      .reduce((acc, s) => acc + (s.end - s.start), 0)

    return {
      date, label: fmtDate(date), events, startStop,
      drivingHrs, sleeperHrs,
      isRestart, isRestartContinuation,
      dayNum: di + 1,
    }
  })
}

// ── sub-components ────────────────────────────────────────────────────────────
function DayHeader({ dayNum, label, isRestart }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
      <div style={{
        background: isRestart ? '#ff525222' : 'var(--accent)',
        color:      isRestart ? '#ff5252'   : '#151f2e',
        border:     isRestart ? '1px solid #ff525255' : 'none',
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: '11px', padding: '4px 14px',
        borderRadius: '20px', whiteSpace: 'nowrap',
      }}>
        Day {dayNum}
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{label}</div>
      <div style={{ flex: 1, height: '1px', background: 'var(--navy-border)' }} />
    </div>
  )
}

function DaySummary({ drivingHrs, sleeperHrs }) {
  if (drivingHrs < 0.1) return null
  return (
    <div style={{
      display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap',
    }}>
      {drivingHrs > 0 && (
        <span style={{
          fontSize: '11px', color: '#4fc3f7',
          background: '#4fc3f718', border: '1px solid #4fc3f728',
          padding: '3px 10px', borderRadius: '20px',
          fontFamily: 'var(--font-display)', fontWeight: 600,
        }}>
          🚛 {fmtHours(drivingHrs)} driving
        </span>
      )}
      {sleeperHrs > 0 && (
        <span style={{
          fontSize: '11px', color: '#ce93d8',
          background: '#ce93d818', border: '1px solid #ce93d828',
          padding: '3px 10px', borderRadius: '20px',
          fontFamily: 'var(--font-display)', fontWeight: 600,
        }}>
          🛏 {fmtHours(sleeperHrs)} rest
        </span>
      )}
    </div>
  )
}

function EventCard({ event }) {
  const cfg = CFG[event.type]
  if (!cfg) return null

  const durations = {
    pre_trip:   '30 min',
    rest_break: '30 min',
    fuel:       '30 min',
    pickup:     '1 hr',
    dropoff:    '1 hr',
    rest:       null,
    cycle_rest: '34 hr',
    start:      null,
  }
  const dur = durations[event.type]

  // badge only for on-duty-not-driving events
  const showBadge = ['pre_trip', 'rest_break', 'fuel'].includes(event.type)

  return (
    <div style={{
      display: 'flex', gap: '14px', alignItems: 'flex-start',
      marginBottom: '8px',
    }}>
      {/* timeline dot */}
      <div style={{
        width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0,
        background: cfg.color, marginTop: '14px',
        boxShadow: `0 0 8px ${cfg.color}55`,
        border: '2px solid rgba(255,255,255,0.15)',
      }} />

      {/* card */}
      <div style={{
        flex: 1,
        background: cfg.color + '10',
        border: `1px solid ${cfg.color}28`,
        borderRadius: '10px',
        padding: '10px 14px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          {/* left: icon + title + badges */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '14px' }}>{cfg.icon}</span>
              <span style={{
                fontWeight: 700, fontSize: '13px', color: cfg.color,
                fontFamily: 'var(--font-display)',
              }}>
                {cfg.label}
              </span>
              {dur && (
                <span style={{
                  fontSize: '10px', color: cfg.color,
                  background: cfg.color + '20', border: `1px solid ${cfg.color}33`,
                  padding: '1px 7px', borderRadius: '20px',
                  fontFamily: 'var(--font-display)', fontWeight: 700,
                }}>
                  {dur}
                </span>
              )}
              {showBadge && (
                <span style={{
                  fontSize: '9px', color: '#ffab40',
                  background: '#ffab4015', border: '1px solid #ffab4030',
                  padding: '1px 6px', borderRadius: '20px',
                  fontFamily: 'var(--font-display)', fontWeight: 700,
                  letterSpacing: '0.04em',
                }}>
                  ON DUTY NOT DRIVING
                </span>
              )}
            </div>

            {/* location */}
            {event.location && event.location !== 'En route' && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                📍 {event.location}
              </div>
            )}

            {/* notes */}
            {event.notes && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', lineHeight: 1.5 }}>
                {event.notes}
              </div>
            )}
          </div>

          {/* right: time */}
          <div style={{
            fontSize: '13px', fontWeight: 600, color: cfg.color,
            fontFamily: 'var(--font-display)', whiteSpace: 'nowrap', flexShrink: 0,
            paddingTop: '2px',
          }}>
            {fmtArrival(event.arrival_time)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────
export default function StopsList({ stops, days }) {
  if (!stops?.length) return null

  const timeline = buildDays(stops, days || [])
  const dropoffStop = stops.find(s => s.type === 'dropoff')

  // total key events (excluding start which is implicit)
  const totalEvents = stops.filter(s => CFG[s.type] && s.type !== 'start').length

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto' }}>

      {/* header */}
      <div style={{
        fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
        color: 'var(--text-muted)', marginBottom: '28px',
        fontFamily: 'var(--font-display)',
      }}>
        FULL TRIP TIMELINE — {timeline.length} DAYS · {totalEvents} KEY EVENTS
      </div>

      {timeline.map((day, di) => {
        // completely skip days that are just continuation of prior day's restart
        if (day.isRestartContinuation) return null

        return (
          <div key={di} style={{ marginBottom: '32px' }}>
            <DayHeader dayNum={day.dayNum} label={day.label} isRestart={day.isRestart && !day.isRestartContinuation} />

            {day.isRestart ? (
              // ── 34-hr restart full day ──────────────────────────────────
              <div style={{
                marginLeft: '28px',
                background: '#ff525210', border: '1px solid #ff525228',
                borderRadius: '10px', padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>⚠️</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#ff5252', fontFamily: 'var(--font-display)' }}>
                        34-hr Restart — Off Duty
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        Driver fully off duty. Cycle hours reset to 0 upon resuming.
                      </div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '10px', color: '#ff5252',
                    background: '#ff525220', border: '1px solid #ff525235',
                    padding: '2px 8px', borderRadius: '20px',
                    fontFamily: 'var(--font-display)', fontWeight: 700,
                  }}>34 hr</span>
                </div>
              </div>
            ) : (
              // ── normal day ──────────────────────────────────────────────
              <div>
                <DaySummary drivingHrs={day.drivingHrs} sleeperHrs={day.sleeperHrs} />
                <div style={{ position: 'relative', paddingLeft: '28px' }}>
                  <div style={{
                    position: 'absolute', left: '6px', top: 0, bottom: 0,
                    width: '2px', background: 'var(--navy-border)',
                  }} />

                  {/* Day 1: show departure as first event */}
                  {day.startStop && (
                    <EventCard event={day.startStop} />
                  )}

                  {day.events.map((ev, ei) => (
                    <EventCard key={ei} event={ev} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* footer */}
      {dropoffStop && (
        <div style={{ textAlign: 'center', paddingBottom: '24px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '8px 24px',
            background: 'rgba(105,240,174,0.08)',
            border: '1px solid rgba(105,240,174,0.25)',
            borderRadius: '20px',
            color: '#69f0ae', fontSize: '13px', fontWeight: 600,
            fontFamily: 'var(--font-display)',
          }}>
            ✅ Trip complete · {fmtArrival(dropoffStop.arrival_time)}
          </div>
        </div>
      )}
    </div>
  )
}