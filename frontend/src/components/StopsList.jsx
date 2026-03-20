const CFG = {
  off_duty:   { icon: '😴', color: '#8ba0b8', label: 'Off Duty',            bold: false },
  sleeper:    { icon: '🛏',  color: '#ce93d8', label: 'Sleeper Berth',       bold: false },
  driving:    { icon: '🚛', color: '#4fc3f7', label: 'Driving',             bold: false },
  on_duty:    { icon: '⚙️',  color: '#ffab40', label: 'On Duty (Not Drv.)', bold: false },
  start:      { icon: '🟢', color: '#69f0ae', label: 'Departure',           bold: true  },
  pickup:     { icon: '📦', color: '#4fc3f7', label: 'Pickup',              bold: true  },
  dropoff:    { icon: '✅', color: '#69f0ae', label: 'Delivered',           bold: true  },
  rest:       { icon: '🛏',  color: '#ce93d8', label: 'Sleeper Berth Rest', bold: true  },
  rest_break: { icon: '⏸',  color: '#fff176', label: '30-min Break',        bold: true  },
  fuel:       { icon: '⛽', color: '#80cbc4', label: 'Fuel Stop',           bold: true  },
  cycle_rest: { icon: '⚠️',  color: '#ff5252', label: '34-hr Restart',       bold: true  },
}

function decimalToTimeStr(h) {
  const totalMins = Math.round(h * 60)
  const hours     = Math.floor(totalMins / 60) % 24
  const mins      = totalMins % 60
  const ampm      = hours >= 12 ? 'PM' : 'AM'
  const hr12      = hours % 12 || 12
  return `${hr12}:${String(mins).padStart(2,'0')} ${ampm}`
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
  })
}

function fmtDuration(hours) {
  if (hours < 0.08) return null
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} hr`
  return `${h} hr ${m} min`
}

function fmtArrival(dtStr) {
  if (!dtStr) return ''
  const [, time] = dtStr.split(' ')
  const [hh, mm] = time.split(':').map(Number)
  const ampm = hh >= 12 ? 'PM' : 'AM'
  const hr   = hh % 12 || 12
  return `${hr}:${String(mm).padStart(2,'0')} ${ampm}`
}

function arrivalToDecimal(dtStr) {
  if (!dtStr) return 0
  const time = dtStr.split(' ')[1]
  const [hh, mm] = time.split(':').map(Number)
  return hh + mm / 60
}

function buildFullTimeline(days, stops) {
  // key stops to inject inline (pickup, fuel, rest_break, cycle_rest)
  const keyStops = stops.filter(s =>
    ['pickup', 'fuel', 'rest_break', 'cycle_rest'].includes(s.type)
  )
  return days.map(day => {
    const date    = day.date
    const entries = (day.grid || []).map(seg => ({
      type:     seg.status,
      start:    seg.start,
      end:      seg.end,
      duration: seg.end - seg.start,
      timeStr:  decimalToTimeStr(seg.start),
      endStr:   decimalToTimeStr(seg.end),
      date,
    }))
    const dayKeyStops = keyStops.filter(s => s.arrival_time?.split(' ')[0] === date)
    return { date, label: formatDateLabel(date), entries, keyStops: dayKeyStops }
  })
}

export default function StopsList({ stops, days }) {
  // fallback if days not passed
  if (!days || days.length === 0) {
    return (
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        {stops.map((s, i) => {
          const cfg = CFG[s.type] || CFG.driving
          return (
            <div key={i} style={{
              display: 'flex', gap: '14px', marginBottom: '8px',
              padding: '10px 14px', background: 'var(--navy-card)',
              border: `1px solid ${cfg.color}33`, borderRadius: '10px',
            }}>
              <span style={{ fontSize: '18px' }}>{cfg.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: cfg.color, fontWeight: 600 }}>{cfg.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.notes}</div>
              </div>
              <div style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 600 }}>
                {fmtArrival(s.arrival_time)}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const timeline    = buildFullTimeline(days, stops)
  const startStop   = stops.find(s => s.type === 'start')
  const dropoffStop = stops.find(s => s.type === 'dropoff')
  const pickupStop  = stops.find(s => s.type === 'pickup')
  const cycleStop   = stops.find(s => s.type === 'cycle_rest')
  const dropoffH    = dropoffStop ? arrivalToDecimal(dropoffStop.arrival_time) : -1
  const pickupH     = pickupStop  ? arrivalToDecimal(pickupStop.arrival_time)  : -1
  const dropoffDate = dropoffStop?.arrival_time?.split(' ')[0]
  const pickupDate  = pickupStop?.arrival_time?.split(' ')[0]
  const cycleDate   = cycleStop?.arrival_time?.split(' ')[0]
  const cycleH      = cycleStop  ? arrivalToDecimal(cycleStop.arrival_time)    : -1

  return (
    <div style={{ maxWidth: '580px', margin: '0 auto' }}>

      <div style={{
        fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
        color: 'var(--text-muted)', marginBottom: '24px',
        fontFamily: 'var(--font-display)',
      }}>
        FULL TRIP TIMELINE — {days.length} DAYS · {stops.length} KEY EVENTS
      </div>

      {timeline.map((day, di) => {
        const isLastDay    = di === timeline.length - 1
        // a restart day has only off_duty all day (no driving)
        const isRestartDay = day.entries.length === 1 &&
                             day.entries[0].type === 'off_duty' &&
                             day.entries[0].duration >= 23.9

        return (
          <div key={di} style={{ marginBottom: '32px' }}>

            {/* day header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px',
            }}>
              <div style={{
                background: isRestartDay ? '#ff525233' : 'var(--accent)',
                color: isRestartDay ? '#ff5252' : '#151f2e',
                border: isRestartDay ? '1px solid #ff525266' : 'none',
                fontFamily: 'var(--font-display)', fontWeight: 700,
                fontSize: '11px', padding: '4px 12px',
                borderRadius: '20px', whiteSpace: 'nowrap',
              }}>
                Day {di + 1}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                {day.label}
              </div>
              <div style={{ flex: 1, height: '1px', background: 'var(--navy-border)' }} />
            </div>

            <div style={{ position: 'relative', paddingLeft: '48px' }}>
              {/* vertical timeline line */}
              <div style={{
                position: 'absolute', left: '15px', top: 0, bottom: 0,
                width: '2px',
                background: isRestartDay ? '#ff525233' : 'var(--navy-border)',
              }} />

              {/* departure — day 1 only */}
              {di === 0 && startStop && (
                <TimelineRow
                  icon="🟢" color="#69f0ae" label="Departure"
                  sublabel={startStop.location}
                  note={startStop.notes}
                  time={fmtArrival(startStop.arrival_time)}
                  bold={true} highlight={true}
                />
              )}

              {/* restart day — show special full-day off-duty card */}
              {isRestartDay ? (
                <TimelineRow
                  icon="⚠️" color="#ff5252"
                  label="34-hr Restart (Off Duty)"
                  note="Driver is completely off duty. Parked at truck stop. Cycle hours reset to 0 after this rest."
                  time="12:00 AM → 12:00 AM"
                  duration="24 hr"
                  bold={true} highlight={true}
                />
              ) : (
                day.entries.map((entry, ei) => {
                  const cfg = CFG[entry.type] || CFG.driving
                  const dur = fmtDuration(entry.duration)

                  // find key stop overlapping this segment
                  const overlappingStop = day.keyStops.find(ks => {
                    const h = arrivalToDecimal(ks.arrival_time)
                    return h >= entry.start && h < entry.end
                  })

                  // SUPPRESS: short on_duty covered by a 30-min break
                  const isBreakSegment =
                    entry.type === 'on_duty' &&
                    overlappingStop?.type === 'rest_break' &&
                    entry.duration <= 0.6

                  // SUPPRESS: 1-hr on_duty after pickup (loading time)
                  const isPickupOnDuty =
                    entry.type === 'on_duty' &&
                    entry.duration <= 1.1 &&
                    day.date === pickupDate &&
                    Math.abs(entry.start - pickupH) < 0.2

                  // SUPPRESS: 1-hr on_duty after dropoff (unloading time)
                  const isDropoffOnDuty =
                    isLastDay &&
                    entry.type === 'on_duty' &&
                    day.date === dropoffDate &&
                    Math.abs(entry.start - dropoffH) < 0.2

                  // SUPPRESS: off_duty segment after dropoff on last day
                  const isPostDropoffRest =
                    isLastDay &&
                    (entry.type === 'off_duty' || entry.type === 'sleeper') &&
                    day.date === dropoffDate &&
                    entry.start >= dropoffH

                  // SUPPRESS: off_duty segment on restart trigger day
                  // after the cycle_rest event — the 34-hr Restart card explains it
                  const isPostRestartOffDuty =
                    entry.type === 'off_duty' &&
                    day.date === cycleDate &&
                    entry.start >= cycleH

                  if (isBreakSegment || isPickupOnDuty || isDropoffOnDuty ||
                      isPostDropoffRest || isPostRestartOffDuty) {
                    // still render break highlight if needed
                    if (isBreakSegment && overlappingStop) {
                      const kc = CFG[overlappingStop.type] || CFG.driving
                      return (
                        <TimelineRow key={ei}
                          icon={kc.icon} color={kc.color} label={kc.label}
                          sublabel={overlappingStop.location !== 'En route'
                            ? overlappingStop.location : null}
                          note={overlappingStop.notes}
                          time={fmtArrival(overlappingStop.arrival_time)}
                          duration="30 min"
                          bold={true} highlight={true}
                        />
                      )
                    }
                    return null
                  }

                  return (
                    <div key={ei}>
                      <TimelineRow
                        icon={cfg.icon} color={cfg.color} label={cfg.label}
                        time={`${entry.timeStr} → ${entry.endStr}`}
                        duration={dur}
                        bold={false} muted={true}
                      />
                      {/* inject key stop highlight if it falls in this segment */}
                      {overlappingStop && (() => {
                        const kc   = CFG[overlappingStop.type] || CFG.driving
                        const kdur = overlappingStop.type === 'rest_break' ? '30 min'
                                   : overlappingStop.type === 'fuel'       ? '30 min'
                                   : overlappingStop.type === 'pickup'     ? '1 hr'
                                   : overlappingStop.type === 'cycle_rest' ? '34 hr'
                                   : null
                        return (
                          <TimelineRow
                            icon={kc.icon} color={kc.color} label={kc.label}
                            sublabel={overlappingStop.location !== 'En route'
                              ? overlappingStop.location : null}
                            note={overlappingStop.notes}
                            time={fmtArrival(overlappingStop.arrival_time)}
                            duration={kdur}
                            bold={true} highlight={true}
                          />
                        )
                      })()}
                    </div>
                  )
                })
              )}

              {/* pickup — on the day it happens */}
              {!isRestartDay && (() => {
                const pickup = stops.find(s =>
                  s.type === 'pickup' && s.arrival_time?.split(' ')[0] === day.date
                )
                if (!pickup) return null
                return (
                  <TimelineRow
                    icon="📦" color="#4fc3f7" label="Pickup"
                    sublabel={pickup.location}
                    note={pickup.notes}
                    time={fmtArrival(pickup.arrival_time)}
                    duration="1 hr"
                    bold={true} highlight={true}
                  />
                )
              })()}

              {/* delivered — last day only */}
              {isLastDay && dropoffStop && (
                <TimelineRow
                  icon="✅" color="#69f0ae" label="Delivered"
                  sublabel={dropoffStop.location}
                  note={dropoffStop.notes}
                  time={fmtArrival(dropoffStop.arrival_time)}
                  duration="1 hr"
                  bold={true} highlight={true}
                />
              )}
            </div>
          </div>
        )
      })}

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
          ✅ Trip complete · {dropoffStop ? fmtArrival(dropoffStop.arrival_time) : ''}
        </div>
      </div>
    </div>
  )
}

function TimelineRow({ icon, color, label, sublabel, note, time, duration, bold, muted, highlight }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start',
      marginBottom: highlight ? '6px' : '2px',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', left: '-37px', top: '11px',
        width:  bold ? '14px' : '8px',
        height: bold ? '14px' : '8px',
        borderRadius: '50%',
        background: bold ? color : 'var(--navy-card)',
        border: `2px solid ${bold ? color : 'var(--navy-border)'}`,
        boxShadow: bold ? `0 0 8px ${color}55` : 'none',
        marginLeft: bold ? '-3px' : '1px',
        zIndex: 1,
      }} />

      <div style={{
        flex: 1,
        padding: highlight ? '10px 14px' : '4px 10px',
        background: highlight ? color + '12' : 'transparent',
        border: highlight ? `1px solid ${color}33` : '1px solid transparent',
        borderRadius: '10px',
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', gap: '12px',
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flex: 1 }}>
          <span style={{ fontSize: bold ? '15px' : '12px', lineHeight: 1.5, flexShrink: 0 }}>
            {icon}
          </span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{
                fontWeight: bold ? 700 : 400,
                fontSize: bold ? '13px' : '12px',
                color: muted ? 'var(--text-muted)' : (bold ? color : 'var(--text)'),
                fontFamily: bold ? 'var(--font-display)' : 'var(--font-body)',
              }}>
                {label}
              </span>
              {duration && (
                <span style={{
                  fontSize: '11px', color: color,
                  background: color + '18',
                  padding: '1px 7px', borderRadius: '20px',
                  fontFamily: 'var(--font-display)', fontWeight: 600,
                }}>
                  {duration}
                </span>
              )}
            </div>
            {sublabel && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                📍 {sublabel}
              </div>
            )}
            {note && highlight && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.5 }}>
                {note}
              </div>
            )}
          </div>
        </div>

        <div style={{
          fontSize: bold ? '13px' : '11px',
          fontWeight: bold ? 600 : 400,
          color: bold ? color : 'var(--text-muted)',
          fontFamily: 'var(--font-display)',
          whiteSpace: 'nowrap', flexShrink: 0, paddingTop: '2px',
        }}>
          {time}
        </div>
      </div>
    </div>
  )
}