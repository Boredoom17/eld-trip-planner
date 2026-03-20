const STATUS = {
  off_duty: { icon: '😴', color: '#8ba0b8', label: 'Off Duty'              },
  sleeper:  { icon: '🛏',  color: '#ce93d8', label: 'Sleeper Berth'         },
  driving:  { icon: '🚛', color: '#4fc3f7', label: 'Driving'               },
  on_duty:  { icon: '⚙️',  color: '#ffab40', label: 'On Duty (Not Driving)' },
}

const EVENTS = {
  start:      { icon: '🟢', color: '#69f0ae', label: 'Departure',              duration: null,     badge: null                },
  pre_trip:   { icon: '🔧', color: '#ffab40', label: 'Pre-trip Inspection',    duration: '30 min', badge: 'ON DUTY NOT DRIVING' },
  rest_break: { icon: '⏸',  color: '#fff176', label: '30-min Mandatory Break', duration: '30 min', badge: 'ON DUTY NOT DRIVING' },
  fuel:       { icon: '⛽', color: '#80cbc4', label: 'Fuel Stop',              duration: '30 min', badge: 'ON DUTY NOT DRIVING' },
  pickup:     { icon: '📦', color: '#4fc3f7', label: 'Pickup',                 duration: '1 hr',   badge: null                },
  dropoff:    { icon: '✅', color: '#69f0ae', label: 'Delivered',              duration: '1 hr',   badge: null                },
  cycle_rest: { icon: '⚠️',  color: '#ff5252', label: '34-hr Restart',          duration: '34 hr',  badge: null                },
}

function fmtArrival(dtStr) {
  if (!dtStr) return ''
  const parts = dtStr.split(' ')
  if (parts.length < 2) return ''
  const [hh, mm] = parts[1].split(':').map(Number)
  const ampm = hh >= 12 ? 'PM' : 'AM'
  const hr   = hh % 12 || 12
  return `${hr}:${String(mm).padStart(2, '0')} ${ampm}`
}

// arrival time + 1hr = when driver actually leaves after loading/unloading
function fmtDeparture(dtStr) {
  if (!dtStr) return ''
  const [date, time] = dtStr.split(' ')
  const d = new Date(`${date}T${time}`)
  d.setHours(d.getHours() + 1)
  const hh = d.getHours(), mm = d.getMinutes()
  const ampm = hh >= 12 ? 'PM' : 'AM'
  const hr   = hh % 12 || 12
  return `${hr}:${String(mm).padStart(2, '0')} ${ampm}`
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtHours(h) {
  if (h < 0.05) return null
  const hrs  = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  if (hrs === 0) return `${mins} min`
  if (mins === 0) return `${hrs} hr`
  return `${hrs} hr ${mins} min`
}

function decToTime(h) {
  const totalMins = Math.round(h * 60)
  const hours     = Math.floor(totalMins / 60) % 24
  const mins      = totalMins % 60
  const ampm      = hours >= 12 ? 'PM' : 'AM'
  const hr12      = hours % 12 || 12
  return `${hr12}:${String(mins).padStart(2, '0')} ${ampm}`
}

function arrivalH(dtStr) {
  if (!dtStr) return -1
  const parts = dtStr.split(' ')
  if (parts.length < 2) return -1
  const [hh, mm] = parts[1].split(':').map(Number)
  return hh + mm / 60
}

// Every item in the timeline — whether a status block or an event card —
// renders through this single component so sizing is always identical.
//
// variant='status'  
// variant='event'   - colored border, glowing dot, shows notes/location
function TimelineRow({ color, icon, label, timeStr, duration, badge, sublabel, note, variant }) {
  const isEvent = variant === 'event'

  return (
    <div style={{
      display: 'flex', gap: '10px', alignItems: 'stretch',
      marginBottom: '4px',
    }}>

      {/* left dot — same vertical position for every row */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: '14px', flexShrink: 0, width: '14px',
      }}>
        <div style={{
          width:  isEvent ? 12 : 8,
          height: isEvent ? 12 : 8,
          borderRadius: '50%',
          background: color,
          opacity: isEvent ? 1 : 0.55,
          boxShadow: isEvent ? `0 0 6px ${color}55` : 'none',
          border: isEvent ? '2px solid rgba(255,255,255,0.15)' : 'none',
          flexShrink: 0,
        }} />
      </div>

      {/* card body — fixed min-height so all rows are same size */}
      <div style={{
        flex: 1,
        minHeight: '40px',
        padding: '10px 12px',
        background: isEvent ? color + '0f' : color + '08',
        border: `1px solid ${isEvent ? color + '30' : color + '18'}`,
        borderRadius: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '10px',
      }}>
        {/* left content */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* title row */}
          <div style={{
            display: 'flex', alignItems: 'center',
            gap: '6px', flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: isEvent ? '14px' : '12px', lineHeight: 1, flexShrink: 0 }}>
              {icon}
            </span>
            <span style={{
              fontWeight: isEvent ? 700 : 500,
              fontSize: '12px',
              color: isEvent ? color : 'var(--text-muted)',
              fontFamily: isEvent ? 'var(--font-display)' : 'var(--font-body)',
              letterSpacing: isEvent ? '0.01em' : 0,
            }}>
              {label}
            </span>
            {duration && (
              <span style={{
                fontSize: '10px', color: color,
                background: color + '20',
                border: `1px solid ${color}30`,
                padding: '1px 6px', borderRadius: '20px',
                fontFamily: 'var(--font-display)', fontWeight: 700,
                flexShrink: 0,
              }}>
                {duration}
              </span>
            )}
            {badge && (
              <span style={{
                fontSize: '9px', color: '#ffab40',
                background: '#ffab4012',
                border: '1px solid #ffab4028',
                padding: '1px 5px', borderRadius: '20px',
                fontFamily: 'var(--font-display)', fontWeight: 700,
                letterSpacing: '0.04em', flexShrink: 0,
              }}>
                {badge}
              </span>
            )}
          </div>

          {/* time range — shown for status blocks only */}
          {timeStr && !isEvent && (
            <div style={{
              fontSize: '11px', color: color,
              marginTop: '3px',
              fontFamily: 'var(--font-display)', fontWeight: 600,
              opacity: 0.85,
            }}>
              {timeStr}
            </div>
          )}

          {/* location + notes — shown for events only */}
          {isEvent && sublabel && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
              📍 {sublabel}
            </div>
          )}
          {isEvent && note && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.5 }}>
              {note}
            </div>
          )}
        </div>

        {/* right: arrival time for events, nothing for status blocks */}
        {isEvent && (
          <div style={{
            fontSize: '12px', fontWeight: 600, color: color,
            fontFamily: 'var(--font-display)', whiteSpace: 'nowrap',
            flexShrink: 0, paddingTop: '1px',
          }}>
            {timeStr}
          </div>
        )}
      </div>
    </div>
  )
}

// Day Summary Pills 
function DaySummary({ grid }) {
  const drivingH = (grid || []).filter(s => s.status === 'driving')
    .reduce((a, s) => a + s.end - s.start, 0)
  const sleeperH = (grid || []).filter(s => s.status === 'sleeper')
    .reduce((a, s) => a + s.end - s.start, 0)

  if (drivingH < 0.1 && sleeperH < 0.1) return null

  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
      {drivingH > 0 && (
        <span style={{
          fontSize: '11px', color: '#4fc3f7',
          background: '#4fc3f718', border: '1px solid #4fc3f728',
          padding: '3px 10px', borderRadius: '20px',
          fontFamily: 'var(--font-display)', fontWeight: 600,
        }}>
          🚛 {fmtHours(drivingH)} driving
        </span>
      )}
      {sleeperH > 0 && (
        <span style={{
          fontSize: '11px', color: '#ce93d8',
          background: '#ce93d818', border: '1px solid #ce93d828',
          padding: '3px 10px', borderRadius: '20px',
          fontFamily: 'var(--font-display)', fontWeight: 600,
        }}>
          🛏 {fmtHours(sleeperH)} sleeper
        </span>
      )}
    </div>
  )
}

// Main 
export default function StopsList({ stops, days }) {
  if (!stops?.length || !days?.length) return null

  const startStop   = stops.find(s => s.type === 'start')
  const dropoffStop = stops.find(s => s.type === 'dropoff')
  const dropoffH    = dropoffStop ? arrivalH(dropoffStop.arrival_time) : 25
  const dropoffDate = dropoffStop?.arrival_time?.split(' ')[0]

  const namedEvents = stops.filter(s =>
    ['pre_trip', 'rest_break', 'fuel', 'pickup', 'cycle_rest'].includes(s.type)
  )

  const totalKeyEvents = stops.filter(s => EVENTS[s.type]).length

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>

      <div style={{
        fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
        color: 'var(--text-muted)', marginBottom: '28px',
        fontFamily: 'var(--font-display)',
      }}>
        FULL TRIP TIMELINE — {days.length} DAYS · {totalKeyEvents} KEY EVENTS
      </div>

      {days.map((day, di) => {
        const date      = day.date
        const isLastDay = di === days.length - 1

        const isAllOffDuty =
          day.grid?.length === 1 &&
          day.grid[0].status === 'off_duty' &&
          day.grid[0].end - day.grid[0].start >= 23.9

        const hasCycleRest     = stops.some(s => s.type === 'cycle_rest' && s.arrival_time?.startsWith(date))
        const prevHadCycleRest = di > 0 && stops.some(s => s.type === 'cycle_rest' && s.arrival_time?.startsWith(days[di - 1].date))
        const isRestartDay     = isAllOffDuty && (hasCycleRest || prevHadCycleRest)

        const dayEvents  = namedEvents.filter(s => s.arrival_time?.startsWith(date))
        const cycleRestH = (() => {
          const cr = stops.find(s => s.type === 'cycle_rest' && s.arrival_time?.startsWith(date))
          return cr ? arrivalH(cr.arrival_time) : -1
        })()

        const gridSegs = (day.grid || []).filter(s => s.end - s.start > 0.04)

        return (
          <div key={di} style={{ marginBottom: '36px' }}>

            {/* day header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                background: isRestartDay ? '#ff525222' : 'var(--accent)',
                color:      isRestartDay ? '#ff5252'   : '#151f2e',
                border:     isRestartDay ? '1px solid #ff525255' : 'none',
                fontFamily: 'var(--font-display)', fontWeight: 700,
                fontSize: '11px', padding: '4px 14px',
                borderRadius: '20px', whiteSpace: 'nowrap',
              }}>
                Day {di + 1}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{fmtDate(date)}</div>
              <div style={{ flex: 1, height: '1px', background: 'var(--navy-border)' }} />
            </div>

            {isRestartDay ? (
              <div style={{
                background: '#ff525210', border: '1px solid #ff525228',
                borderRadius: '10px', padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>⚠️</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#ff5252', fontFamily: 'var(--font-display)' }}>
                        34-hr Restart — Off Duty
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        Driver fully off duty. Parked and resting. Cycle hours reset to 0 upon resuming.
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
              <div>
                <DaySummary grid={day.grid} />

                {/* departure — day 1 only */}
                {di === 0 && startStop && (
                  <TimelineRow
                    variant="event"
                    color={EVENTS.start.color}
                    icon={EVENTS.start.icon}
                    label={EVENTS.start.label}
                    timeStr={fmtArrival(startStop.arrival_time)}
                    sublabel={startStop.location !== 'En route' ? startStop.location : null}
                    note={startStop.notes}
                  />
                )}

                {(() => {
                  const items = []

                  gridSegs.forEach(seg => {
                    if (di === 0 && seg.status === 'off_duty' && seg.end <= 8.5) return
                    if (cycleRestH >= 0 && seg.status === 'off_duty' && seg.start >= cycleRestH - 0.1) return
                    if (isLastDay && date === dropoffDate &&
                        (seg.status === 'off_duty' || seg.status === 'sleeper' || seg.status === 'on_duty') &&
                        seg.start >= dropoffH - 0.1) return
                    items.push({ kind: 'seg', time: seg.start, seg })
                  })

                  dayEvents.forEach(stop => {
                    items.push({ kind: 'event', time: arrivalH(stop.arrival_time), stop })
                  })

                  items.sort((a, b) => a.time - b.time)

                  // build and merge coverage ranges from events
                  const rawRanges = items
                    .filter(i => i.kind === 'event')
                    .map(i => ({ start: i.time - 0.05, end: i.time + 1.1 }))
                  rawRanges.sort((a, b) => a.start - b.start)
                  const coveredRanges = []
                  rawRanges.forEach(r => {
                    if (coveredRanges.length && r.start <= coveredRanges[coveredRanges.length - 1].end) {
                      coveredRanges[coveredRanges.length - 1].end = Math.max(coveredRanges[coveredRanges.length - 1].end, r.end)
                    } else {
                      coveredRanges.push({ ...r })
                    }
                  })

                  const rendered = []
                  items.forEach((item, idx) => {
                    if (item.kind === 'seg') {
                      const { seg } = item
                      if (seg.status === 'on_duty') {
                        const covered = coveredRanges.some(r => seg.start >= r.start && seg.end <= r.end)
                        if (covered) return
                      }
                      if (seg.status === 'off_duty' && seg.end - seg.start < 0.1) return

                      const s = STATUS[seg.status]
                      if (!s) return
                      rendered.push(
                        <TimelineRow
                          key={`seg-${idx}`}
                          variant="status"
                          color={s.color}
                          icon={s.icon}
                          label={s.label}
                          timeStr={`${decToTime(seg.start)} → ${decToTime(seg.end)}`}
                          duration={fmtHours(seg.end - seg.start)}
                        />
                      )
                    } else {
                      const { stop } = item
                      const e = EVENTS[stop.type]
                      if (!e) return
                      rendered.push(
                        <TimelineRow
                          key={`ev-${idx}`}
                          variant="event"
                          color={e.color}
                          icon={e.icon}
                          label={e.label}
                          timeStr={fmtArrival(stop.arrival_time)}
                          duration={e.duration}
                          badge={e.badge}
                          sublabel={stop.location && stop.location !== 'En route' ? stop.location : null}
                          note={stop.notes}
                        />
                      )
                    }
                  })

                  return rendered
                })()}

                {/* delivered — last day only */}
                {isLastDay && dropoffStop && (
                  <TimelineRow
                    variant="event"
                    color={EVENTS.dropoff.color}
                    icon={EVENTS.dropoff.icon}
                    label={EVENTS.dropoff.label}
                    timeStr={fmtArrival(dropoffStop.arrival_time)}
                    duration={EVENTS.dropoff.duration}
                    sublabel={dropoffStop.location !== 'En route' ? dropoffStop.location : null}
                    note={dropoffStop.notes}
                  />
                )}
              </div>
            )}
          </div>
        )
      })}

      {dropoffStop && (
        <div style={{ textAlign: 'center', paddingBottom: '28px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '8px 24px',
            background: 'rgba(105,240,174,0.08)',
            border: '1px solid rgba(105,240,174,0.25)',
            borderRadius: '20px',
            color: '#69f0ae', fontSize: '13px', fontWeight: 600,
            fontFamily: 'var(--font-display)',
          }}>
            ✅ Trip complete · {fmtDeparture(dropoffStop.arrival_time)}
          </div>
        </div>
      )}
    </div>
  )
}