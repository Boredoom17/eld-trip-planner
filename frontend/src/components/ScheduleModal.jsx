import { useState, useRef, useEffect } from 'react'

const STATUS_OPTS = [
  { value: 'off_duty', label: 'Off Duty',             color: '#69f0ae', icon: '😴' },
  { value: 'sleeper',  label: 'Sleeper Berth',         color: '#4fc3f7', icon: '🛏'  },
  { value: 'driving',  label: 'Driving',               color: '#ff6b6b', icon: '🚛'  },
  { value: 'on_duty',  label: 'On Duty (Not Driving)', color: '#ffab40', icon: '⚙️'  },
]

// ── Round Clock Picker ──────────────────────────────────────────────────────
function MiniClock({ value, onChange, onClose }) {
  const [step, setStep]   = useState('hour')
  const parsed            = (value || '00:00').split(':').map(Number)
  const [hour, setHour]   = useState(parsed[0])
  const [minute, setMinute] = useState(parsed[1])
  const canvasRef         = useRef(null)

  useEffect(() => { draw() }, [step, hour, minute])

  const draw = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const S   = canvas.width
    const cx  = S / 2, cy = S / 2, r = S / 2 - 6

    ctx.clearRect(0, 0, S, S)
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = '#0f1e32'; ctx.fill()
    ctx.strokeStyle = '#2a4060'; ctx.lineWidth = 1.5; ctx.stroke()

    if (step === 'hour') {
      for (let h = 1; h <= 12; h++) {
        const a   = (h / 12) * Math.PI * 2 - Math.PI / 2
        const nr  = r - 22
        const x   = cx + Math.cos(a) * nr
        const y   = cy + Math.sin(a) * nr
        const h24 = h === 12 ? (hour >= 12 ? 12 : 0) : (hour >= 12 ? h + 12 : h)
        const sel = hour === h24 || (h === 12 && (hour === 0 || hour === 12))
        if (sel) { ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fillStyle = '#4fc3f7'; ctx.fill() }
        ctx.fillStyle = sel ? '#0d1b2a' : '#eef0f4'
        ctx.font = `${sel ? 'bold ' : ''}13px sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(h, x, y)
      }
      const selH  = hour % 12 || 12
      const angle = (selH / 12) * Math.PI * 2 - Math.PI / 2
      ctx.beginPath(); ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(angle) * (r - 28), cy + Math.sin(angle) * (r - 28))
      ctx.strokeStyle = '#4fc3f7'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke()
    } else {
      for (let m = 0; m < 60; m += 5) {
        const a   = (m / 60) * Math.PI * 2 - Math.PI / 2
        const nr  = r - 22
        const x   = cx + Math.cos(a) * nr
        const y   = cy + Math.sin(a) * nr
        const sel = minute === m
        if (sel) { ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fillStyle = '#69f0ae'; ctx.fill() }
        ctx.fillStyle = sel ? '#0d1b2a' : '#eef0f4'
        ctx.font = `${sel ? 'bold ' : ''}12px sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(m === 0 ? '00' : m, x, y)
      }
      const angle = (minute / 60) * Math.PI * 2 - Math.PI / 2
      ctx.beginPath(); ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(angle) * (r - 28), cy + Math.sin(angle) * (r - 28))
      ctx.strokeStyle = '#69f0ae'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke()
    }
    ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = step === 'hour' ? '#4fc3f7' : '#69f0ae'; ctx.fill()
  }

  const handleClick = (e) => {
    const canvas = canvasRef.current
    const rect   = canvas.getBoundingClientRect()
    const x      = (e.clientX - rect.left) * (canvas.width  / rect.width)  - canvas.width  / 2
    const y      = (e.clientY - rect.top)  * (canvas.height / rect.height) - canvas.height / 2
    let angle = Math.atan2(y, x) + Math.PI / 2
    if (angle < 0) angle += Math.PI * 2

    if (step === 'hour') {
      let h    = Math.round((angle / (Math.PI * 2)) * 12)
      if (h === 0) h = 12
      const newH = hour >= 12 ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h)
      setHour(newH)
      setTimeout(() => setStep('minute'), 180)
    } else {
      let m = Math.round((angle / (Math.PI * 2)) * 60 / 5) * 5
      if (m >= 60) m = 0
      setMinute(m)
    }
  }

  const confirm = () => {
    onChange(`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`)
    onClose()
  }

  const display12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  const isAM      = hour < 12

  return (
    <div style={{
      background: '#1a2740', border: '1.5px solid #2a4060',
      borderRadius: '16px', padding: '14px', width: '220px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.8)', userSelect: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', marginBottom: '10px' }}>
        <button onClick={() => setStep('hour')} style={{
          background: step === 'hour' ? '#4fc3f7' : 'rgba(79,195,247,0.1)',
          border: 'none', borderRadius: '8px', padding: '4px 10px',
          color: step === 'hour' ? '#0d1b2a' : '#eef0f4',
          fontSize: '26px', fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace', minWidth: '52px', textAlign: 'center',
        }}>
          {String(display12).padStart(2,'0')}
        </button>
        <span style={{ color: '#4fc3f7', fontSize: '24px', fontWeight: 700, padding: '0 2px' }}>:</span>
        <button onClick={() => setStep('minute')} style={{
          background: step === 'minute' ? '#69f0ae' : 'rgba(105,240,174,0.1)',
          border: 'none', borderRadius: '8px', padding: '4px 10px',
          color: step === 'minute' ? '#0d1b2a' : '#eef0f4',
          fontSize: '26px', fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace', minWidth: '52px', textAlign: 'center',
        }}>
          {String(minute).padStart(2,'0')}
        </button>
        <button onClick={() => setHour(h => h >= 12 ? h - 12 : h + 12)} style={{
          background: 'var(--navy-card)', border: '1px solid #2a4060',
          borderRadius: '8px', padding: '4px 8px', marginLeft: '4px',
          color: 'var(--accent)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', lineHeight: 1.4,
        }}>
          {isAM ? 'AM' : 'PM'}
        </button>
      </div>
      <div style={{ textAlign: 'center', fontSize: '9px', color: '#8ba0b8', letterSpacing: '0.12em', marginBottom: '8px' }}>
        {step === 'hour' ? 'TAP HOUR' : 'TAP MINUTE'}
      </div>
      <canvas ref={canvasRef} width={192} height={192} onClick={handleClick}
        style={{ cursor: 'pointer', display: 'block', margin: '0 auto', borderRadius: '50%' }} />
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button onClick={onClose} style={{
          flex: 1, padding: '8px', background: 'transparent',
          border: '1px solid #2a4060', borderRadius: '8px',
          color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer',
        }}>Cancel</button>
        <button onClick={confirm} style={{
          flex: 2, padding: '8px', background: '#4fc3f7',
          border: 'none', borderRadius: '8px', color: '#0d1b2a',
          fontWeight: 700, fontSize: '12px', cursor: 'pointer',
          fontFamily: 'var(--font-display)', letterSpacing: '0.05em',
        }}>SET TIME</button>
      </div>
    </div>
  )
}

// ── Time Button ─────────────────────────────────────────────────────────────
function TimeButton({ value, onChange, label }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const fmt = (v) => {
    if (!v) return '--:--'
    const [h, m] = v.split(':').map(Number)
    const ampm   = h >= 12 ? 'PM' : 'AM'
    const hr     = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${String(hr).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 700, letterSpacing: '0.1em' }}>
        {label}
      </div>
      <button
        type="button" onClick={() => setOpen(o => !o)}
        style={{
          background: open ? 'rgba(79,195,247,0.12)' : 'var(--navy)',
          border: `1.5px solid ${open ? 'var(--accent)' : 'var(--navy-border)'}`,
          borderRadius: '8px', color: value ? 'var(--text)' : 'var(--text-muted)',
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px',
          padding: '7px 12px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}
      >
        <span style={{ fontSize: '12px' }}>🕐</span> {fmt(value)}
      </button>
      {open && (
        <div style={{ position: 'fixed', zIndex: 99999 }}
          ref={el => {
            if (el && ref.current) {
              const btn  = ref.current.getBoundingClientRect()
              const popH = 320
              el.style.top  = btn.bottom + popH > window.innerHeight
                ? `${btn.top - popH - 4}px`
                : `${btn.bottom + 4}px`
              el.style.left = `${Math.min(btn.left, window.innerWidth - 240)}px`
            }
          }}
        >
          <MiniClock value={value} onChange={v => { onChange(v); setOpen(false) }} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}

// ── Timeline Preview ─────────────────────────────────────────────────────────
function TimelinePreview({ entries }) {
  const toH = (t) => {
    if (!t) return 0
    const [h, m] = t.split(':').map(Number)
    let val = h + m / 60
    return val === 0 && t !== '00:00' ? 24 : val
  }
  const total = entries.reduce((s, e) => {
    const start = toH(e.start)
    let   end   = toH(e.end)
    if (end === 0) end = 24
    if (end <= start) end = 24
    return s + Math.max(end - start, 0)
  }, 0)
  const ok = Math.abs(total - 24) < 0.1

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{
        height: '30px', background: '#0f1e32', borderRadius: '8px',
        overflow: 'hidden', position: 'relative', marginBottom: '5px',
        border: '1px solid #2a4060',
      }}>
        {entries.map((e, i) => {
          const start = toH(e.start)
          let   end   = toH(e.end)
          if (end === 0) end = 24; if (end <= start) end = 24
          const opt = STATUS_OPTS.find(o => o.value === e.status) || STATUS_OPTS[0]
          return (
            <div key={e.id || i} style={{
              position: 'absolute',
              left: `${(start / 24) * 100}%`,
              width: `${((end - start) / 24) * 100}%`,
              top: 0, height: '100%',
              background: opt.color + '99',
              borderRight: '1px solid rgba(0,0,0,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {(end - start) > 1.5 && (
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#0d1b2a', whiteSpace: 'nowrap' }}>
                  {opt.icon}
                </span>
              )}
            </div>
          )
        })}
        {[6,12,18].map(h => (
          <div key={h} style={{
            position: 'absolute', left: `${(h/24)*100}%`,
            top: 0, height: '100%', borderLeft: '1px dashed rgba(255,255,255,0.15)',
            pointerEvents: 'none',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#4a6080', marginBottom: '8px' }}>
        <span>12AM</span><span>6AM</span><span>12PM</span><span>6PM</span><span>12AM</span>
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '7px 12px',
        background: ok ? 'rgba(105,240,174,0.08)' : 'rgba(255,82,82,0.08)',
        border: `1px solid ${ok ? 'rgba(105,240,174,0.25)' : 'rgba(255,82,82,0.25)'}`,
        borderRadius: '8px', fontSize: '12px',
      }}>
        <span style={{ color: 'var(--text-muted)' }}>Total hours entered</span>
        <span style={{ fontWeight: 700, color: ok ? '#69f0ae' : '#ff5252', fontFamily: 'var(--font-display)' }}>
          {total.toFixed(1)} / 24 {ok ? '✓' : '— must equal 24'}
        </span>
      </div>
    </div>
  )
}

// ── Schedule Modal ───────────────────────────────────────────────────────────
export default function ScheduleModal({ days, initialSchedule, onSave, onClose }) {
  const [selDay, setSelDay] = useState(0)

  // initialise from existing saved schedule if available (so edits persist)
  const [schedules, setSchedules] = useState(() => {
    const init = {}
    days.forEach((_, i) => {
      // if driver already saved a schedule, load it — otherwise use sensible defaults
      if (initialSchedule && initialSchedule[i]) {
        init[i] = initialSchedule[i].map(e => ({ ...e, id: e.id || Date.now() + Math.random() }))
      } else {
        init[i] = [
          { id: `${i}-1`, start: '00:00', end: '06:00', status: 'off_duty' },
          { id: `${i}-2`, start: '06:00', end: '06:30', status: 'on_duty'  },
          { id: `${i}-3`, start: '06:30', end: '14:30', status: 'driving'  },
          { id: `${i}-4`, start: '14:30', end: '15:00', status: 'on_duty'  },
          { id: `${i}-5`, start: '15:00', end: '00:00', status: 'off_duty' },
        ]
      }
    })
    return init
  })

  const entries = schedules[selDay] || []

  const update = (id, field, val) => {
    setSchedules(s => ({
      ...s,
      [selDay]: s[selDay].map(e => e.id === id ? { ...e, [field]: val } : e)
    }))
  }

  const remove = (id) => {
    setSchedules(s => ({
      ...s,
      [selDay]: s[selDay].filter(e => e.id !== id)
    }))
  }

  const add = () => {
    const newId = `${selDay}-${Date.now()}`
    setSchedules(s => ({
      ...s,
      [selDay]: [...s[selDay], { id: newId, start: '00:00', end: '00:00', status: 'off_duty' }]
    }))
  }

  // duration helper
  const getDuration = (start, end) => {
    if (!start || !end) return null
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    let dur = (eh + em / 60) - (sh + sm / 60)
    if (dur <= 0) dur += 24
    return dur > 0 ? dur : null
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 5000,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
    >
      <div style={{
        background: '#1a2740', border: '1.5px solid #2a4060',
        borderRadius: '20px', width: '100%', maxWidth: '620px',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)', overflow: 'hidden',
      }}>

        {/* header */}
        <div style={{
          padding: '18px 22px 14px', borderBottom: '1px solid #2a4060',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: 'var(--text)' }}>
              Driver Daily Schedule
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
              Enter actual times — this draws directly onto the log sheet
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.07)', border: 'none',
            borderRadius: '8px', color: 'var(--text-muted)',
            fontSize: '20px', cursor: 'pointer', padding: '4px 10px', lineHeight: 1,
          }}>×</button>
        </div>

        {/* day tabs */}
        <div style={{
          display: 'flex', gap: '6px', padding: '12px 22px',
          overflowX: 'auto', borderBottom: '1px solid #2a4060', flexShrink: 0,
        }}>
          {days.map((d, i) => (
            <button
              key={i} onClick={() => setSelDay(i)}
              style={{
                padding: '7px 14px', borderRadius: '10px', whiteSpace: 'nowrap',
                border: `1.5px solid ${selDay === i ? 'var(--accent)' : '#2a4060'}`,
                background: selDay === i ? 'rgba(79,195,247,0.15)' : 'var(--navy)',
                color: selDay === i ? 'var(--accent)' : 'var(--text-muted)',
                fontFamily: 'var(--font-display)', fontWeight: 600,
                fontSize: '11px', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>

          <TimelinePreview entries={entries} />

          {entries.map((entry, idx) => {
            const opt = STATUS_OPTS.find(o => o.value === entry.status) || STATUS_OPTS[0]
            const dur = getDuration(entry.start, entry.end)
            return (
              <div key={entry.id} style={{
                background: 'var(--navy)', borderRadius: '12px',
                padding: '12px 14px', marginBottom: '8px',
                borderLeft: `4px solid ${opt.color}`,
              }}>
                {/* top row — block number + duration + delete */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: '10px',
                }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                    Block {idx + 1}
                    {dur && (
                      <span style={{ color: opt.color, marginLeft: '8px', fontWeight: 700 }}>
                        {dur.toFixed(1)} hrs
                      </span>
                    )}
                  </span>
                  {/* delete button — icon style, top right */}
                  <button
                    type="button"
                    onClick={() => remove(entry.id)}
                    title="Delete this block"
                    style={{
                      width: '28px', height: '28px',
                      background: 'rgba(255,82,82,0.1)',
                      border: '1px solid rgba(255,82,82,0.25)',
                      borderRadius: '7px', color: '#ff6b6b',
                      cursor: 'pointer', fontSize: '16px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.15s', lineHeight: 1, flexShrink: 0,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,82,82,0.22)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,82,82,0.1)'}
                  >
                    🗑
                  </button>
                </div>

                {/* status pills */}
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {STATUS_OPTS.map(o => (
                    <button
                      key={o.value} type="button"
                      onClick={() => update(entry.id, 'status', o.value)}
                      style={{
                        padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
                        border: `1.5px solid ${entry.status === o.value ? o.color : '#2a4060'}`,
                        background: entry.status === o.value ? o.color + '22' : 'transparent',
                        color: entry.status === o.value ? o.color : 'var(--text-muted)',
                        fontSize: '11px', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '4px',
                        transition: 'all 0.12s',
                      }}
                    >
                      {o.icon} {o.label}
                    </button>
                  ))}
                </div>

                {/* time pickers */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                  <TimeButton label="FROM" value={entry.start} onChange={v => update(entry.id, 'start', v)} />
                  <div style={{ paddingBottom: '10px', color: opt.color, fontSize: '14px', fontWeight: 700 }}>→</div>
                  <TimeButton label="UNTIL" value={entry.end} onChange={v => update(entry.id, 'end', v)} />
                </div>
              </div>
            )
          })}

          {/* add block */}
          <button
            type="button" onClick={add}
            style={{
              width: '100%', padding: '10px', background: 'transparent',
              border: '1.5px dashed #2a4060', borderRadius: '10px',
              color: 'var(--accent)', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(79,195,247,0.05)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a4060'; e.currentTarget.style.background = 'transparent' }}
          >
            + Add time block
          </button>
          <div style={{ height: '8px' }} />
        </div>

        {/* footer */}
        <div style={{
          padding: '14px 22px', borderTop: '1px solid #2a4060',
          display: 'flex', gap: '10px', flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px', background: 'var(--navy)',
            border: '1px solid var(--navy-border)', borderRadius: '8px',
            color: 'var(--text-muted)', fontFamily: 'var(--font-display)',
            fontWeight: 600, fontSize: '13px', cursor: 'pointer',
          }}>Cancel</button>
          <button
            onClick={() => onSave(schedules)}
            style={{
              flex: 2, padding: '11px', background: 'var(--accent)',
              border: 'none', borderRadius: '8px', color: '#151f2e',
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: '13px', cursor: 'pointer', letterSpacing: '0.05em',
            }}
          >
            SAVE & APPLY TO LOG SHEETS →
          </button>
        </div>

      </div>
    </div>
  )
}