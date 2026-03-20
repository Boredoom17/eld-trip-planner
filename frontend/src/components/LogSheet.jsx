import { useEffect, useRef } from 'react'

const ROWS = [
  { key: 'off_duty', label: '1. Off Duty',             color: '#2e7d32' },
  { key: 'sleeper',  label: '2. Sleeper Berth',         color: '#1565c0' },
  { key: 'driving',  label: '3. Driving',               color: '#b71c1c' },
  { key: 'on_duty',  label: '4. On Duty\n(Not Driving)', color: '#e65100' },
]

const STATUS_TO_ROW = {
  off_duty: 'off_duty',
  driving:  'driving',
  on_duty:  'on_duty',
  sleeper:  'sleeper',
}

// converts driver schedule blocks (from ScheduleModal) to grid segments
function scheduleToSegments(schedule) {
  if (!schedule || !Array.isArray(schedule) || schedule.length === 0) return null
  const segs = []
  schedule.forEach(entry => {
    if (!entry.start || !entry.end || !entry.status) return
    const [sh, sm] = entry.start.split(':').map(Number)
    const [eh, em] = entry.end.split(':').map(Number)
    const start = sh + sm / 60
    let   end   = eh + em / 60
    if (end === 0) end = 24
    if (end <= start) end = 24
    if (end > start) segs.push({ status: entry.status, start, end })
  })
  return segs.length > 0 ? segs : null
}

function drawSheet(canvas, day) {
  const fmt = h => {
  const r = Math.round(h * 4) / 4
  return Number.isInteger(r) ? r.toFixed(1) : r.toString()
}
  const ctx = canvas.getContext('2d')
  const W   = canvas.width
  const H   = canvas.height

  ctx.clearRect(0, 0, W, H)

  const ML  = 136
  const MR  = 58
  const HDR = 50
  const NHR = 44
  const MT  = HDR + NHR
  const RH  = 50
  const GW  = W - ML - MR
  const GH  = RH * 4

  // white paper background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // ── header ─────────────────────────────────────
  ctx.fillStyle = '#1a2740'
  ctx.fillRect(0, 0, W, HDR)

  ;['#ff5252', '#69f0ae', '#4fc3f7'].forEach((c, i) => {
    ctx.beginPath()
    ctx.arc(16 + i * 16, HDR / 2, 5, 0, Math.PI * 2)
    ctx.fillStyle = c; ctx.fill()
  })

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 13px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText("DRIVER'S DAILY LOG", 64, 20)

  ctx.fillStyle = '#8ba0b8'
  ctx.font = '9.5px Arial, sans-serif'
  ctx.fillText('U.S. DOT — FMCSA  ·  Original: File at home terminal  ·  Duplicate: Driver retains 8 days', 64, 36)

  ctx.fillStyle = '#4fc3f7'
  ctx.font = 'bold 13px Arial, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`Day ${day.day_number}`, W - 10, 20)

  ctx.fillStyle = '#8ba0b8'
  ctx.font = '10px Arial, sans-serif'
  ctx.fillText(formatDate(day.date), W - 10, 36)

  // ── hour numbers strip ──────────────────────────
  ctx.fillStyle = '#f0f4f8'
  ctx.fillRect(ML, HDR, GW, NHR)
  ctx.strokeStyle = '#bbb'; ctx.lineWidth = 0.5
  ctx.strokeRect(ML, HDR, GW, NHR)

  const SLOTS = 96  // 24hrs × 4 (15-min slots)

  // tick marks
  for (let s = 0; s <= SLOTS; s++) {
    const x   = ML + (s / SLOTS) * GW
    const min = (s % 4) * 15
    const isH = min === 0
    const isHalf = min === 30
    const h = isH ? 14 : isHalf ? 9 : 5

    ctx.beginPath(); ctx.moveTo(x, HDR); ctx.lineTo(x, HDR + h)
    ctx.strokeStyle = isH ? '#888' : '#bbb'
    ctx.lineWidth   = isH ? 1 : 0.5; ctx.stroke()

    ctx.beginPath(); ctx.moveTo(x, HDR + NHR); ctx.lineTo(x, HDR + NHR - (isH ? 8 : isHalf ? 5 : 3))
    ctx.strokeStyle = isH ? '#999' : '#ccc'
    ctx.lineWidth   = isH ? 1 : 0.5; ctx.stroke()
  }

  // hour labels
  ctx.textAlign = 'center'
  for (let h = 0; h <= 24; h++) {
    const x = ML + (h / 24) * GW
    if (h === 0 || h === 24) {
      ctx.fillStyle = '#444'; ctx.font = 'bold 8.5px Arial, sans-serif'
      ctx.fillText('Mid-', x, HDR + 22); ctx.fillText('night', x, HDR + 31)
    } else if (h === 12) {
      ctx.fillStyle = '#b06000'; ctx.font = 'bold 10px Arial, sans-serif'
      ctx.fillText('Noon', x, HDR + 28)
    } else {
      ctx.fillStyle = '#444'
      ctx.font = h % 6 === 0 ? 'bold 10px Arial, sans-serif' : '9.5px Arial, sans-serif'
      ctx.fillText(h > 12 ? h - 12 : h, x, HDR + 28)
    }
  }

  ctx.fillStyle = '#888'; ctx.font = 'bold 8px Arial, sans-serif'
  ctx.fillText('A.M.', ML + (6  / 24) * GW, HDR + NHR - 3)
  ctx.fillText('P.M.', ML + (18 / 24) * GW, HDR + NHR - 3)

  // ── grid rows ───────────────────────────────────
  ROWS.forEach((row, i) => {
    const y = MT + i * RH

    ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f9fbfd'
    ctx.fillRect(ML, y, GW, RH)

    ctx.fillStyle = '#f0f4f8'
    ctx.fillRect(0, y, ML, RH)

    // colored left accent
    ctx.fillStyle = row.color
    ctx.fillRect(0, y, 4, RH)

    // row label
    const lines = row.label.split('\n')
    ctx.textAlign = 'right'
    if (lines.length === 2) {
      ctx.fillStyle = '#222'; ctx.font = 'bold 10px Arial, sans-serif'
      ctx.fillText(lines[0], ML - 7, y + RH / 2 - 5)
      ctx.fillStyle = '#555'; ctx.font = '9px Arial, sans-serif'
      ctx.fillText(lines[1], ML - 7, y + RH / 2 + 7)
    } else {
      ctx.fillStyle = '#222'; ctx.font = 'bold 10px Arial, sans-serif'
      ctx.fillText(row.label, ML - 7, y + RH / 2 + 4)
    }

    // row divider
    ctx.beginPath(); ctx.moveTo(0, y + RH); ctx.lineTo(W, y + RH)
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.8; ctx.stroke()
  })

  ctx.beginPath(); ctx.moveTo(0, MT); ctx.lineTo(W, MT)
  ctx.strokeStyle = '#bbb'; ctx.lineWidth = 0.8; ctx.stroke()

  // ── vertical lines inside grid ──────────────────
  for (let s = 0; s <= SLOTS; s++) {
    const x   = ML + (s / SLOTS) * GW
    const min = (s % 4) * 15
    const isH = min === 0; const isHalf = min === 30

    ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + GH)
    if (isH) { ctx.strokeStyle = s === 0 || s === 96 ? '#999' : '#ccc'; ctx.lineWidth = 0.7 }
    else if (isHalf) { ctx.strokeStyle = '#ddd'; ctx.lineWidth = 0.5 }
    else { ctx.strokeStyle = '#eee'; ctx.lineWidth = 0.3 }
    ctx.stroke()
  }

  // noon highlight
  const noonX = ML + (12 / 24) * GW
  ctx.beginPath(); ctx.moveTo(noonX, MT); ctx.lineTo(noonX, MT + GH)
  ctx.strokeStyle = '#b0600033'; ctx.lineWidth = 1.5; ctx.stroke()

  // outer grid border
  ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1.2
  ctx.strokeRect(ML, MT, GW, GH)

  // ── choose segments: driver schedule > calculated grid ──
  let rawSegments = null

  // if driver entered a schedule, prefer that for drawing
  if (day.driver_schedule && Array.isArray(day.driver_schedule)) {
    rawSegments = scheduleToSegments(day.driver_schedule)
  }
  // fall back to calculated grid
  if (!rawSegments) {
    rawSegments = day.grid
  }

  if (!rawSegments || rawSegments.length === 0) return

  // normalize: grid uses 'start'/'end', events use 'start_hour'/'end_hour'
  const segments = rawSegments.map(s => ({
    status: s.status,
    start:  s.start  !== undefined ? s.start  : s.start_hour,
    end:    s.end    !== undefined ? s.end    : s.end_hour,
  })).filter(s => STATUS_TO_ROW[s.status] && s.end > s.start)

  if (segments.length === 0) return

  const rowMidY = (rowKey) => {
    const ri = ROWS.findIndex(r => r.key === rowKey)
    return MT + ri * RH + RH / 2
  }

  // pass 1 — colored fills
  segments.forEach(seg => {
    const rowKey = STATUS_TO_ROW[seg.status]
    if (!rowKey) return
    const ri  = ROWS.findIndex(r => r.key === rowKey)
    const row = ROWS[ri]
    const x1  = ML + (seg.start / 24) * GW
    const x2  = ML + (seg.end   / 24) * GW
    const y   = MT + ri * RH
    ctx.fillStyle = row.color + '28'
    ctx.fillRect(x1, y + 1, x2 - x1, RH - 2)
  })

  // pass 2 — thick black connected step line (exactly like real FMCSA form)
  ctx.strokeStyle = '#111111'
  ctx.lineWidth   = 2.8
  ctx.lineJoin    = 'miter'
  ctx.lineCap     = 'square'
  ctx.beginPath()

  segments.forEach((seg, i) => {
    const rowKey = STATUS_TO_ROW[seg.status]
    const x1     = ML + (seg.start / 24) * GW
    const x2     = ML + (seg.end   / 24) * GW
    const y      = rowMidY(rowKey)
    if (i === 0) { ctx.moveTo(x1, y) } else { ctx.lineTo(x1, y) }
    ctx.lineTo(x2, y)
  })
  ctx.stroke()

  // red dots at every transition
  ctx.fillStyle = '#cc0000'
  const dot = (x, y) => {
    ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill()
  }
  segments.forEach((seg, i) => {
    const rowKey = STATUS_TO_ROW[seg.status]
    const x1     = ML + (seg.start / 24) * GW
    const x2     = ML + (seg.end   / 24) * GW
    const y      = rowMidY(rowKey)

    // dot at start of this segment
    dot(x1, y)

    // if previous segment was a different row, also dot at the PREVIOUS row's y
    // this marks both ends of the vertical drop line
    if (i > 0) {
      const prevRowKey = STATUS_TO_ROW[segments[i-1].status]
      if (prevRowKey !== rowKey) {
        dot(x1, rowMidY(prevRowKey))
      }
    }

    // dot at end of last segment
    if (i === segments.length - 1) {
      dot(x2, y)
    }
  })

  // totals column 
  ctx.fillStyle = '#f0f4f8'
  ctx.fillRect(ML + GW, MT, MR, GH)
  ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1
  ctx.strokeRect(ML + GW, MT, MR, GH)

  ctx.fillStyle = '#333'; ctx.font = 'bold 8px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('TOTAL', ML + GW + MR / 2, MT - 18)
  ctx.fillText('HOURS', ML + GW + MR / 2, MT - 8)

  // compute totals from the drawn segments
  const totals = { off_duty: 0, sleeper: 0, driving: 0, on_duty: 0 }
  segments.forEach(seg => {
    const rk = STATUS_TO_ROW[seg.status]
    if (rk) totals[rk] += (seg.end - seg.start)
  })

  ROWS.forEach((row, i) => {
    const cy  = MT + i * RH + RH / 2 + 5
    const val = Math.round((totals[row.key] || 0) * 10) / 10
    if (i > 0) {
      ctx.beginPath(); ctx.moveTo(ML + GW, MT + i * RH); ctx.lineTo(ML + GW + MR, MT + i * RH)
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.8; ctx.stroke()
    }
    ctx.fillStyle = '#111'; ctx.font = 'bold 13px Arial, sans-serif'
    ctx.textAlign = 'center'
    // round to nearest 0.25 then display as clean number
    const rounded = Math.round(val * 4) / 4
    ctx.fillText(Number.isInteger(rounded) ? rounded.toFixed(1) : rounded.toString(), ML + GW + MR / 2, cy)
  })

  // ── remarks ─────────────────────────────────────
  const remY = MT + GH + 1
  const remH = 34

  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, remY, W, remH)
  ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.5; ctx.strokeRect(0, remY, W, remH)

  ctx.fillStyle = '#333'; ctx.font = 'bold 9.5px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('REMARKS:', 10, remY + 13)

  ctx.fillStyle = '#555'; ctx.font = '9.5px Arial, sans-serif'
  ctx.fillText(
    `Driving: ${fmt(day.driving_hours)}h  ·  On Duty (Not Drv.): ${fmt(day.on_duty_hours)}h  ·  Off Duty: ${fmt(day.off_duty_hours)}h  ·  Cycle used: ${day.cycle_hours_used} / 70 hrs`,    78, remY + 13
  )

  ctx.beginPath(); ctx.moveTo(10, remY + 20); ctx.lineTo(W - 10, remY + 20)
  ctx.strokeStyle = '#eee'; ctx.lineWidth = 0.5; ctx.stroke()

  // ── 70-hr cycle bar ─────────────────────────────
  const barSecY = remY + remH

  ctx.fillStyle = '#f8f9fa'; ctx.fillRect(0, barSecY, W, H - barSecY)
  ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.5; ctx.strokeRect(0, barSecY, W, H - barSecY)

  const BX   = ML
  const BW   = GW
  const barY = barSecY + 8
  const pct  = Math.min(day.cycle_hours_used / 70, 1)
  const barC = pct > 0.85 ? '#c62828' : pct > 0.6 ? '#e65100' : '#2e7d32'

  ctx.fillStyle = '#333'; ctx.font = 'bold 8.5px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('70-HOUR / 8-DAY CYCLE:', BX, barY - 1)

  ctx.fillStyle = '#e0e0e0'
  ctx.beginPath(); ctx.roundRect(BX, barY + 2, BW, 9, 4); ctx.fill()

  if (pct > 0) {
    ctx.fillStyle = barC
    ctx.beginPath(); ctx.roundRect(BX, barY + 2, BW * pct, 9, 4); ctx.fill()
  }

  ;[60 / 70, 1].forEach(p => {
    const mx = BX + BW * p
    ctx.strokeStyle = '#c62828'; ctx.lineWidth = 1
    ctx.setLineDash([3, 2])
    ctx.beginPath(); ctx.moveTo(mx, barY); ctx.lineTo(mx, barY + 13); ctx.stroke()
    ctx.setLineDash([])
  })

  ctx.fillStyle = barC; ctx.font = 'bold 8.5px Arial, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`${Math.round(pct * 100)}%  (${day.cycle_hours_used} / 70 hrs)`, BX + BW, barY - 1)
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  })
}

function DayLog({ day }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) drawSheet(ref.current, day)
  }, [day])

  return (
    <div style={{
      borderRadius: '6px', overflow: 'hidden',
      marginBottom: '28px',
      boxShadow: '0 2px 20px rgba(0,0,0,0.2)',
      border: '1px solid var(--navy-border)',
    }}>
      <canvas
        ref={ref}
        width={980}
        height={350}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      />
    </div>
  )
}

export default function LogSheet({ days, scheduleReady }) {
  return (
    <div style={{ maxWidth: '920px', margin: '0 auto' }}>
      <div style={{
        fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
        color: 'var(--text-muted)', marginBottom: '6px',
        fontFamily: 'var(--font-display)',
      }}>
        DAILY LOG SHEETS — {days.length} DAY{days.length > 1 ? 'S' : ''}
      </div>
      <div style={{
        fontSize: '12px', color: 'var(--text-muted)',
        marginBottom: '24px', lineHeight: 1.6,
      }}>
        Generated per FMCSA HOS rules ·
        24-hour grid with 15-minute intervals ·
        Connected step line matches the official FMCSA paper form
      </div>

      {!scheduleReady && (
        <div style={{
          padding: '20px 24px', marginBottom: '24px',
          background: 'rgba(79,195,247,0.06)',
          border: '1.5px dashed rgba(79,195,247,0.25)',
          borderRadius: '12px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '28px', marginBottom: '8px', opacity: 0.5 }}>📋</div>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: '14px', color: 'var(--text)', marginBottom: '6px',
          }}>
            Showing calculated schedule
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            The log sheets below are auto-calculated from HOS rules.
            Click <strong style={{ color: 'var(--accent)' }}>SET DRIVER SCHEDULE</strong> to
            enter actual times and redraw with real data.
          </div>
        </div>
      )}

      {days.map((day, i) => (
        <DayLog key={i} day={day} />
      ))}
    </div>
  )
}