import { useEffect, useRef, useCallback } from 'react'

const CARRIER_NAME   = 'Independent Carrier'
const OFFICE_ADDRESS = 'Washington, D.C., 20001'
const DRIVER_NAME    = 'John Doe'
const CODRIVER_NAME  = '—'
const VEHICLE_NUMBER = 'TRK-4872'
const SHIPPING_NO    = 'SHP-' + Math.floor(100000 + Math.random() * 900000)

const ROWS = [
  { key: 'off_duty', label: ['Off', 'Duty'] },
  { key: 'sleeper',  label: ['Sleeper', 'Berth'] },
  { key: 'driving',  label: ['Driving'] },
  { key: 'on_duty',  label: ['On Duty', '(Not', 'Driving)'] },
]

const STATUS_TO_ROW = {
  off_duty: 'off_duty', driving: 'driving',
  on_duty: 'on_duty',   sleeper: 'sleeper',
}

function toHHMM(h) {
  if (!h || h === 0) return '—'
  const totalMins = Math.round(h * 60)
  const hh = Math.floor(totalMins / 60)
  const mm = totalMins % 60
  return `${hh}:${String(mm).padStart(2, '0')}`
}

function fmtDateParts(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return {
    month: String(d.getMonth() + 1).padStart(2, '0'),
    day:   String(d.getDate()).padStart(2, '0'),
    year:  d.getFullYear(),
    full:  d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
  }
}

function shortCity(full) {
  if (!full) return ''
  const STATE_MAP = {
    'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA',
    'Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA',
    'Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS',
    'Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA',
    'Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO','Montana':'MT',
    'Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM',
    'New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK',
    'Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC',
    'South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT',
    'Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY',
  }
  const parts = full.split(',').map(s => s.trim())
  const city  = parts[0] || ''
  const abbr  = parts.map(p => STATE_MAP[p]).find(Boolean) || ''
  return abbr ? `${city}, ${abbr}` : city
}

function drawSheet(canvas, day, tripInfo) {
  const ctx = canvas.getContext('2d')
  const W   = canvas.width   // 1400
  const H   = canvas.height  // 860

  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // outer border
  ctx.strokeStyle = '#111'
  ctx.lineWidth   = 2.5
  ctx.strokeRect(14, 14, W - 28, H - 28)

  const PAD = 22
  const L   = PAD       // left edge
  const R   = W - PAD   // right edge

  // TOP HEADER 
  ctx.fillStyle = '#222'; ctx.font = '11px Arial, sans-serif'; ctx.textAlign = 'left'
  ctx.fillText('U.S. DEPARTMENT OF TRANSPORTATION', L, 34)

  ctx.font = 'bold 19px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#111'
  ctx.fillText("DRIVER'S DAILY LOG", W / 2, 33)
  ctx.font = '11px Arial, sans-serif'
  ctx.fillText('(ONE CALENDAR DAY — 24 HOURS)', W / 2, 48)

  ctx.textAlign = 'right'; ctx.font = '10px Arial, sans-serif'; ctx.fillStyle = '#333'
  ctx.fillText('ORIGINAL — Submit to carrier within 13 days', R, 33)
  ctx.fillText('DUPLICATE — Driver retains possession for eight days', R, 47)

  // DATE / MILES / VEHICLE ROW 
  const dp       = fmtDateParts(day.date)
  const dayMiles = Math.round((day.driving_hours || 0) * 55)
  const dY       = 80

  // Date
  ctx.textAlign = 'left'; ctx.fillStyle = '#111'
  ctx.font = 'bold 28px Arial, sans-serif'
  ctx.fillText(dp.month, L, dY + 20)
  ctx.fillText(dp.day,   L + 56, dY + 20)
  ctx.fillText(dp.year,  L + 112, dY + 20)

  ctx.font = '9.5px Arial, sans-serif'; ctx.fillStyle = '#555'
  ;[['(MONTH)', L], ['(DAY)', L+56], ['(YEAR)', L+112]].forEach(([lbl, x]) => {
    ctx.strokeStyle = '#333'; ctx.lineWidth = 0.8
    ctx.beginPath(); ctx.moveTo(x, dY + 25); ctx.lineTo(x + 44, dY + 25); ctx.stroke()
    ctx.fillText(lbl, x, dY + 35)
  })

  // Miles
  ctx.textAlign = 'center'; ctx.fillStyle = '#111'; ctx.font = 'bold 28px Arial, sans-serif'
  ctx.fillText(dayMiles > 0 ? String(dayMiles) : '—', W / 2, dY + 20)
  ctx.strokeStyle = '#333'; ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.moveTo(W/2 - 80, dY + 25); ctx.lineTo(W/2 + 80, dY + 25); ctx.stroke()
  ctx.fillStyle = '#555'; ctx.font = '9.5px Arial, sans-serif'
  ctx.fillText('(TOTAL MILES DRIVING TODAY)', W / 2, dY + 35)

  // Vehicle
  ctx.textAlign = 'right'; ctx.fillStyle = '#111'; ctx.font = 'bold 22px Arial, sans-serif'
  ctx.fillText(VEHICLE_NUMBER, R, dY + 20)
  ctx.strokeStyle = '#333'; ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.moveTo(R - 160, dY + 25); ctx.lineTo(R, dY + 25); ctx.stroke()
  ctx.fillStyle = '#555'; ctx.font = '9.5px Arial, sans-serif'
  ctx.fillText('VEHICLE NUMBERS—(SHOW EACH UNIT)', R, dY + 35)

  // divider
  const d1 = dY + 44
  ctx.strokeStyle = '#999'; ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.moveTo(L, d1); ctx.lineTo(R, d1); ctx.stroke()

  // CARRIER / SIGNATURE 
  const sY = d1 + 6
  const hw = (R - L - 16) / 2

  ctx.textAlign = 'center'; ctx.fillStyle = '#555'; ctx.font = 'italic 10px Arial, sans-serif'
  ctx.fillText('I certify that these entries are true and correct', W / 2, sY + 11)

  // Left: carrier
  ctx.textAlign = 'left'; ctx.fillStyle = '#111'; ctx.font = 'bold italic 19px Georgia, serif'
  ctx.fillText(CARRIER_NAME, L, sY + 32)
  ctx.strokeStyle = '#333'; ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.moveTo(L, sY + 37); ctx.lineTo(L + hw, sY + 37); ctx.stroke()
  ctx.fillStyle = '#666'; ctx.font = '9px Arial, sans-serif'
  ctx.fillText('(NAME OF CARRIER OR CARRIERS)', L, sY + 47)

  // Right: driver sig
  ctx.textAlign = 'right'; ctx.fillStyle = '#111'; ctx.font = 'bold italic 19px Georgia, serif'
  ctx.fillText(DRIVER_NAME, R, sY + 32)
  ctx.strokeStyle = '#333'; ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.moveTo(L + hw + 16, sY + 37); ctx.lineTo(R, sY + 37); ctx.stroke()
  ctx.fillStyle = '#666'; ctx.font = '9px Arial, sans-serif'
  ctx.fillText("(DRIVER'S SIGNATURE IN FULL)", R, sY + 47)

  // Left: office address
  ctx.textAlign = 'left'; ctx.fillStyle = '#111'; ctx.font = 'bold italic 15px Georgia, serif'
  ctx.fillText(OFFICE_ADDRESS, L, sY + 66)
  ctx.strokeStyle = '#333'; ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.moveTo(L, sY + 71); ctx.lineTo(L + hw, sY + 71); ctx.stroke()
  ctx.fillStyle = '#666'; ctx.font = '9px Arial, sans-serif'
  ctx.fillText('(MAIN OFFICE ADDRESS)', L, sY + 81)

  // Right: co-driver + TOTAL HOURS label
  ctx.textAlign = 'right'; ctx.fillStyle = '#777'; ctx.font = '14px Georgia, serif'
  ctx.fillText(CODRIVER_NAME, R - 70, sY + 66)
  ctx.strokeStyle = '#bbb'; ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.moveTo(L + hw + 16, sY + 71); ctx.lineTo(R - 70, sY + 71); ctx.stroke()
  ctx.fillStyle = '#666'; ctx.font = '9px Arial, sans-serif'
  ctx.fillText('(NAME OF CO-DRIVER)', R - 70, sY + 81)

  // GRID 
  const LBL_W  = 68   // row label width
  const TOT_W  = 62   // totals width
  const GL     = L + LBL_W        // grid left
  const GR     = R - TOT_W        // grid right
  const GW     = GR - GL          // grid width
  const RH     = 46               // row height
  const NHRT   = 36               // hour ruler height (top)
  const GT     = sY + 94          // grid top
  const GNT    = GT + NHRT        // grid rows top
  const GH     = RH * 4           // total grid height
  const GNB    = GNT + GH         // grid rows bottom
  const SLOTS  = 96

  // Hour ruler — draws top or bottom strip
  function drawHourRuler(yTop, rH) {
    ctx.fillStyle = '#f8f8f8'
    ctx.fillRect(GL, yTop, GW, rH)
    ctx.strokeStyle = '#bbb'; ctx.lineWidth = 0.5
    ctx.strokeRect(GL, yTop, GW, rH)

    ctx.textAlign = 'center'
    for (let h = 0; h <= 24; h++) {
      const x = GL + (h / 24) * GW
      if (h === 0 || h === 24) {
        ctx.fillStyle = '#333'; ctx.font = 'bold 8.5px Arial, sans-serif'
        ctx.fillText('Mid-', x, yTop + rH * 0.42)
        ctx.fillText('night', x, yTop + rH * 0.62)
      } else if (h === 12) {
        ctx.fillStyle = '#8B4513'; ctx.font = 'bold 11px Arial, sans-serif'
        ctx.fillText('Noon', x, yTop + rH * 0.62)
      } else {
        ctx.fillStyle = '#333'
        ctx.font = (h % 2 === 0) ? '11px Arial, sans-serif' : '9px Arial, sans-serif'
        ctx.fillText(String(h > 12 ? h - 12 : h), x, yTop + rH * 0.62)
      }
    }
  }

  drawHourRuler(GT, NHRT)

  // Row label area background
  ctx.fillStyle = '#f9f9f9'
  ctx.fillRect(L, GNT, LBL_W, GH)
  ctx.strokeStyle = '#bbb'; ctx.lineWidth = 0.7
  ctx.strokeRect(L, GNT, LBL_W, GH)

  // Row backgrounds + labels + horizontal dividers
  ROWS.forEach((row, i) => {
    const y = GNT + i * RH

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(GL, y, GW, RH)

    // row label
    ctx.textAlign = 'left'; ctx.fillStyle = '#111'
    if (row.label.length === 1) {
      ctx.font = 'bold 11px Arial, sans-serif'
      ctx.fillText(row.label[0], L + 4, y + RH / 2 + 4)
    } else if (row.label.length === 2) {
      ctx.font = 'bold 10.5px Arial, sans-serif'
      ctx.fillText(row.label[0], L + 4, y + RH / 2 - 3)
      ctx.fillText(row.label[1], L + 4, y + RH / 2 + 10)
    } else {
      ctx.font = 'bold 9.5px Arial, sans-serif'
      ctx.fillText(row.label[0], L + 4, y + RH / 2 - 7)
      ctx.fillText(row.label[1], L + 4, y + RH / 2 + 4)
      ctx.fillText(row.label[2], L + 4, y + RH / 2 + 14)
    }

    // horizontal divider
    ctx.strokeStyle = '#bbb'; ctx.lineWidth = 0.7
    ctx.beginPath(); ctx.moveTo(L, y + RH); ctx.lineTo(R, y + RH); ctx.stroke()
  })

  // top border of grid
  ctx.strokeStyle = '#777'; ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.moveTo(L, GNT); ctx.lineTo(R, GNT); ctx.stroke()

  // vertical grid lines
  for (let s = 0; s <= SLOTS; s++) {
    const x      = GL + (s / SLOTS) * GW
    const min    = (s % 4) * 15
    const isHour = min === 0
    const isHalf = min === 30
    ctx.beginPath(); ctx.moveTo(x, GNT); ctx.lineTo(x, GNB)
    if (isHour)      { ctx.strokeStyle = '#bbb'; ctx.lineWidth = 0.7 }
    else if (isHalf) { ctx.strokeStyle = '#ddd'; ctx.lineWidth = 0.4 }
    else             { ctx.strokeStyle = '#eee'; ctx.lineWidth = 0.25 }
    ctx.stroke()
  }
  // noon line accent
  const noonX = GL + (12 / 24) * GW
  ctx.strokeStyle = '#8B451333'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(noonX, GNT); ctx.lineTo(noonX, GNB); ctx.stroke()

  // grid outer border
  ctx.strokeStyle = '#777'; ctx.lineWidth = 1.2
  ctx.strokeRect(GL, GNT, GW, GH)

  //  Totals column 
  ctx.fillStyle = '#f8f8f8'
  ctx.fillRect(GR, GNT, TOT_W, GH)
  ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1
  ctx.strokeRect(GR, GNT, TOT_W, GH)

  // TOTAL HOURS label above the column
  ctx.textAlign = 'center'; ctx.fillStyle = '#333'; ctx.font = 'bold 9px Arial, sans-serif'
  ctx.fillText('TOTAL', GR + TOT_W / 2, GT + 14)
  ctx.fillText('HOURS', GR + TOT_W / 2, GT + 26)

  // Activity segments 
  const segments = (day.grid || [])
    .map(s => ({ status: s.status, start: s.start ?? s.start_hour, end: s.end ?? s.end_hour }))
    .filter(s => STATUS_TO_ROW[s.status] && s.end > s.start)

  const rowMidY = key => {
    const ri = ROWS.findIndex(r => r.key === key)
    return GNT + ri * RH + RH / 2
  }

  // colored fill
  const ROW_COLORS = { off_duty:'#2e7d3222', sleeper:'#1565c022', driving:'#b71c1c22', on_duty:'#e6510022' }
  segments.forEach(seg => {
    const key = STATUS_TO_ROW[seg.status]; if (!key) return
    const ri  = ROWS.findIndex(r => r.key === key)
    const x1  = GL + (seg.start / 24) * GW
    const x2  = GL + (seg.end   / 24) * GW
    ctx.fillStyle = ROW_COLORS[key] || '#00000011'
    ctx.fillRect(x1, GNT + ri * RH + 1, x2 - x1, RH - 2)
  })

  // step line — blue like original
  ctx.strokeStyle = '#1a56b0'; ctx.lineWidth = 2.5
  ctx.lineJoin = 'miter'; ctx.lineCap = 'square'
  ctx.beginPath()
  segments.forEach((seg, i) => {
    const key = STATUS_TO_ROW[seg.status]
    const x1  = GL + (seg.start / 24) * GW
    const x2  = GL + (seg.end   / 24) * GW
    const y   = rowMidY(key)
    if (i === 0) ctx.moveTo(x1, y); else ctx.lineTo(x1, y)
    ctx.lineTo(x2, y)
  })
  ctx.stroke()

  // transition dots
  ctx.fillStyle = '#1a56b0'
  const dot = (x, y) => { ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill() }
  segments.forEach((seg, i) => {
    const key = STATUS_TO_ROW[seg.status]
    const x1  = GL + (seg.start / 24) * GW
    const x2  = GL + (seg.end   / 24) * GW
    const y   = rowMidY(key)
    dot(x1, y)
    if (i > 0 && STATUS_TO_ROW[segments[i-1].status] !== key)
      dot(x1, rowMidY(STATUS_TO_ROW[segments[i-1].status]))
    if (i === segments.length - 1) dot(x2, y)
  })

  // Totals 
  const totalMins = { off_duty: 0, sleeper: 0, driving: 0, on_duty: 0 }
  segments.forEach(seg => {
    const k = STATUS_TO_ROW[seg.status]
    if (k) totalMins[k] += Math.round((seg.end - seg.start) * 60)
  })

  ROWS.forEach((row, i) => {
    const cy   = GNT + i * RH + RH / 2 + 5
    const mins = totalMins[row.key] || 0
    const hh   = Math.floor(mins / 60)
    const mm   = mins % 60
    const lbl  = mins === 0 ? '—' : `${hh}:${String(mm).padStart(2,'0')}`

    if (i > 0) {
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.7
      ctx.beginPath(); ctx.moveTo(GR, GNT + i * RH); ctx.lineTo(R, GNT + i * RH); ctx.stroke()
    }
    ctx.fillStyle  = mins === 0 ? '#bbb' : '#111'
    ctx.font       = 'bold 14px Arial, sans-serif'
    ctx.textAlign  = 'center'
    ctx.fillText(lbl, GR + TOT_W / 2, cy)
  })

  // REMARKS SECTION 
  const remY = GNB + 1
  const remH = 86

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(L, remY, R - L, remH)
  ctx.strokeStyle = '#999'; ctx.lineWidth = 0.8
  ctx.strokeRect(L, remY, R - L, remH)

  // REMARKS label
  ctx.textAlign = 'left'; ctx.fillStyle = '#222'; ctx.font = 'bold 11px Arial, sans-serif'
  ctx.fillText('REMARKS', L + 4, remY + 18)

  // Summary lines
  const drivMins   = totalMins.driving
  const onDutyMins = totalMins.on_duty
  const offMins    = totalMins.off_duty
  const sleepMins  = totalMins.sleeper
  const toT = m => { const h = Math.floor(m/60); const mn = m%60; return m===0?'—':`${h}:${String(mn).padStart(2,'0')}` }

  ctx.fillStyle = '#444'; ctx.font = '10.5px Arial, sans-serif'
  ctx.fillText(`Driving: ${toT(drivMins)}h   On Duty (Not Drv.): ${toT(onDutyMins)}h   Off Duty: ${toT(offMins)}h   Sleeper: ${toT(sleepMins)}h`, GL, remY + 20)

  const cycleVal  = day.cycle_hours_used || 0
  const cycleMins = Math.round(cycleVal * 60)
  const cycleHH   = Math.floor(cycleMins / 60)
  const cycleMM   = cycleMins % 60
  const cycleStr  = `${cycleHH}:${String(cycleMM).padStart(2, '0')}`
  ctx.fillStyle = '#555'; ctx.font = '10px Arial, sans-serif'
  ctx.fillText(`Cycle used: ${cycleStr} / 70:00 hrs  ·  Day ${day.day_number} of trip`, GL, remY + 36)

  // =24 right side
  ctx.textAlign = 'center'; ctx.fillStyle = '#111'; ctx.font = 'bold 16px Arial, sans-serif'
  ctx.fillText('=24', GR + TOT_W / 2, remY + remH / 2 + 6)
  ctx.strokeStyle = '#aaa'; ctx.lineWidth = 0.8
  ctx.strokeRect(GR, remY, TOT_W, remH)

  // Shipping No
  ctx.textAlign = 'left'; ctx.fillStyle = '#555'; ctx.font = '9.5px Arial, sans-serif'
  ctx.fillText('Pro or Shipping No.', L + 4, remY + remH - 12)
  ctx.fillStyle = '#111'; ctx.font = 'bold 12px Arial, sans-serif'
  ctx.fillText(SHIPPING_NO, L + 110, remY + remH - 12)

  // 70-HR CYCLE BAR 
  const barY     = remY + remH + 8
  const pct      = Math.min(cycleVal / 70, 1)
  const barC     = pct > 0.85 ? '#c62828' : pct > 0.6 ? '#e65100' : '#2e7d32'
  const barLabel = `${Math.round(pct * 100)}%  (${cycleStr} / 70:00 hrs)`

  const BAR_X = GL + 160
  const BAR_W = GW - 160 - 180
  const PCT_X = BAR_X + BAR_W + 10

  ctx.font = 'bold 10px Arial, sans-serif'
  ctx.fillStyle = '#333'; ctx.textAlign = 'left'
  ctx.fillText('70-HOUR / 8-DAY CYCLE:', GL, barY + 10)

  ctx.fillStyle = '#e0e0e0'
  ctx.beginPath(); ctx.roundRect(BAR_X, barY, BAR_W, 12, 3); ctx.fill()

  if (pct > 0) {
    ctx.fillStyle = barC
    ctx.beginPath(); ctx.roundRect(BAR_X, barY, BAR_W * pct, 12, 3); ctx.fill()
  }

  ctx.fillStyle = '#333'; ctx.textAlign = 'left'; ctx.font = 'bold 10px Arial, sans-serif'
  ctx.fillText(barLabel, PCT_X, barY + 10)
}

function LogPage({ day, tripInfo, onCanvas }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (canvasRef.current) {
      drawSheet(canvasRef.current, day, tripInfo)
      if (onCanvas) onCanvas(canvasRef.current)
    }
  }, [day, tripInfo])

  const dp = fmtDateParts(day.date)

  return (
    <div style={{
      width: '100%',
      maxWidth: '1100px',
      margin: '0 auto 48px',
      background: '#ffffff',
      boxShadow: '0 4px 32px rgba(0,0,0,0.15)',
      borderRadius: '2px',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: '-28px', left: '0',
        fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)',
        fontFamily: 'var(--font-display)', letterSpacing: '0.08em',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span style={{
          background: 'var(--accent)', color: '#151f2e',
          padding: '2px 10px', borderRadius: '20px', fontSize: '10px',
        }}>
          Day {day.day_number}
        </span>
        {dp.full}
      </div>
      <canvas
        ref={canvasRef}
        width={1400}
        height={860}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      />
    </div>
  )
}

async function downloadAsPDF(canvasRefs, days) {
  if (!window.jspdf) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      script.onload  = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }
  const { jsPDF } = window.jspdf
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  for (let i = 0; i < canvasRefs.length; i++) {
    const canvas = canvasRefs[i]
    if (!canvas) continue
    const imgData = canvas.toDataURL('image/jpeg', 0.98)
    if (i > 0) pdf.addPage()
    pdf.addImage(imgData, 'JPEG', 5, 5, 287, 200)
  }
  pdf.save(`ELD-Log-${days.length}-Days.pdf`)
}

export default function LogSheet({ days, tripInfo }) {
  const canvasRefs = useRef([])
  canvasRefs.current = []

  const handleDownload = useCallback(async () => {
    try {
      await downloadAsPDF(canvasRefs.current, days)
    } catch (e) {
      console.error('PDF download failed:', e)
      alert('PDF download failed. Please try again.')
    }
  }, [days])

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
        <div>
          <div style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
            color: 'var(--text-muted)', marginBottom: '4px',
            fontFamily: 'var(--font-display)',
          }}>
            DAILY LOG SHEETS — {days.length} DAY{days.length > 1 ? 'S' : ''}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            FMCSA-compliant form · 24-hour grid · 15-minute intervals
          </div>
        </div>
        <button
          onClick={handleDownload}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            background: 'var(--accent)', color: '#151f2e',
            border: 'none', borderRadius: '8px',
            padding: '9px 18px', cursor: 'pointer',
            fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: '12px', letterSpacing: '0.04em',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)', flexShrink: 0,
          }}
        >
          ⬇ Download PDF
        </button>
      </div>
      {days.map((day, i) => (
        <LogPage
          key={`${day.date}-${i}`}
          day={day}
          tripInfo={tripInfo}
          onCanvas={el => { canvasRefs.current[i] = el }}
        />
      ))}
    </div>
  )
}