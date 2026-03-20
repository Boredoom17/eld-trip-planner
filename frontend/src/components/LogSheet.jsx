import { useEffect, useRef, useCallback } from 'react'

// Dummy datas
const CARRIER_NAME    = 'Spotter Freight Lines, Inc.'  
const OFFICE_ADDRESS  = 'Washington, D.C., 20001'
const DRIVER_NAME     = 'John Doe'
const CODRIVER_NAME   = '—'
const VEHICLE_NUMBER  = 'SFL-4872'
const SHIPPING_NO     = 'SFL-' + Math.floor(100000 + Math.random() * 900000)

const ROWS = [
  { key: 'off_duty', label: ['1. Off Duty'],                color: '#2e7d32' },
  { key: 'sleeper',  label: ['2. Sleeper Berth'],           color: '#1565c0' },
  { key: 'driving',  label: ['3. Driving'],                 color: '#b71c1c' },
  { key: 'on_duty',  label: ['4. On Duty', '(Not Driving)'],color: '#e65100' },
]

const STATUS_TO_ROW = {
  off_duty: 'off_duty', driving: 'driving',
  on_duty: 'on_duty',   sleeper: 'sleeper',
}

function fmt(h) {
  if (!h || h === 0) return '—'
  const r    = Math.round(h * 4) / 4
  const hrs  = Math.floor(r)
  const mins = Math.round((r - hrs) * 60)
  return `${hrs}.${String(mins).padStart(2, '0')}`
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

// Main canvas draw function 
function drawSheet(canvas, day, tripInfo) {
  const ctx  = canvas.getContext('2d')
  const W    = canvas.width    // 1100
  const H    = canvas.height   // 720

  ctx.clearRect(0, 0, W, H)

  // Page background 
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // Outer border
  ctx.strokeStyle = '#333'
  ctx.lineWidth   = 1.5
  ctx.strokeRect(10, 10, W - 20, H - 20)

  const PAD  = 22   // inner padding from border
  const CW   = W - PAD * 2   // content width

  // TOP HEADER ROW 
  // "U.S. DEPARTMENT OF TRANSPORTATION" top-left
  ctx.fillStyle  = '#333'
  ctx.font       = '9px Arial, sans-serif'
  ctx.textAlign  = 'left'
  ctx.fillText('U.S. DEPARTMENT OF TRANSPORTATION', PAD, 30)

  // "DRIVER'S DAILY LOG" centered
  ctx.font      = 'bold 15px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText("DRIVER'S DAILY LOG", W / 2, 28)
  ctx.font      = '9px Arial, sans-serif'
  ctx.fillText('(ONE CALENDAR DAY — 24 HOURS)', W / 2, 40)

  // Original/Duplicate top-right
  ctx.textAlign  = 'right'
  ctx.font       = '8px Arial, sans-serif'
  ctx.fillStyle  = '#444'
  ctx.fillText('ORIGINAL — Submit to carrier within 13 days', W - PAD, 28)
  ctx.fillText('DUPLICATE — Driver retains possession for eight days', W - PAD, 40)

  // DATE + MILES + VEHICLE ROW 
  const dateRow = 58
  const dp      = fmtDateParts(day.date)
  const dayMiles = Math.round((day.driving_hours || 0) * 55)

  // Date fields
  ctx.textAlign  = 'left'
  ctx.fillStyle  = '#111'
  ctx.font       = 'bold 22px Arial, sans-serif'
  ctx.fillText(dp.month, PAD, dateRow + 16)
  ctx.font       = 'bold 22px Arial, sans-serif'
  ctx.fillText(dp.day, PAD + 40, dateRow + 16)
  ctx.font       = 'bold 22px Arial, sans-serif'
  ctx.fillText(dp.year, PAD + 82, dateRow + 16)

  // underlines + labels
  ;[[PAD, 32, 'MONTH'], [PAD + 40, 32, 'DAY'], [PAD + 82, 52, 'YEAR']].forEach(([x, w, lbl]) => {
    ctx.strokeStyle = '#333'; ctx.lineWidth = 0.8
    ctx.beginPath(); ctx.moveTo(x, dateRow + 20); ctx.lineTo(x + w, dateRow + 20); ctx.stroke()
    ctx.fillStyle = '#666'; ctx.font = '7.5px Arial, sans-serif'; ctx.textAlign = 'left'
    ctx.fillText(`(${lbl})`, x, dateRow + 29)
  })

  // Miles center
  ctx.textAlign = 'center'
  ctx.fillStyle = '#111'
  ctx.font      = 'bold 22px Arial, sans-serif'
  ctx.fillText(dayMiles > 0 ? String(dayMiles) : '—', W / 2, dateRow + 16)
  ctx.strokeStyle = '#333'; ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.moveTo(W / 2 - 60, dateRow + 20); ctx.lineTo(W / 2 + 60, dateRow + 20); ctx.stroke()
  ctx.fillStyle = '#666'; ctx.font = '7.5px Arial, sans-serif'
  ctx.fillText('(TOTAL MILES DRIVING TODAY)', W / 2, dateRow + 29)

  // Vehicle number right
  ctx.textAlign = 'right'
  ctx.fillStyle = '#111'
  ctx.font      = 'bold 18px Arial, sans-serif'
  ctx.fillText(VEHICLE_NUMBER, W - PAD, dateRow + 16)
  ctx.strokeStyle = '#333'; ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.moveTo(W - PAD - 120, dateRow + 20); ctx.lineTo(W - PAD, dateRow + 20); ctx.stroke()
  ctx.fillStyle = '#666'; ctx.font = '7.5px Arial, sans-serif'
  ctx.fillText('VEHICLE NUMBERS—(SHOW EACH UNIT)', W - PAD, dateRow + 29)

  // Divider line
  const div1Y = dateRow + 36
  ctx.strokeStyle = '#bbb'; ctx.lineWidth = 0.7
  ctx.beginPath(); ctx.moveTo(PAD, div1Y); ctx.lineTo(W - PAD, div1Y); ctx.stroke()

  // CARRIER / SIGNATURE ROW 
  const sigRow = div1Y + 6
  const halfW  = (CW - 20) / 2

  // Certification text centered
  ctx.textAlign = 'center'
  ctx.fillStyle = '#555'
  ctx.font      = 'italic 8px Arial, sans-serif'
  ctx.fillText('I certify that these entries are true and correct', W / 2, sigRow + 8)

  // Carrier name left
  ctx.textAlign = 'left'
  ctx.fillStyle = '#111'
  ctx.font      = 'bold italic 16px Georgia, serif'
  ctx.fillText(CARRIER_NAME, PAD, sigRow + 28)
  ctx.strokeStyle = '#333'; ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.moveTo(PAD, sigRow + 32); ctx.lineTo(PAD + halfW, sigRow + 32); ctx.stroke()
  ctx.fillStyle = '#666'; ctx.font = '7.5px Arial, sans-serif'
  ctx.fillText('(NAME OF CARRIER OR CARRIERS)', PAD, sigRow + 40)

  // Driver signature right
  ctx.textAlign = 'right'
  ctx.fillStyle = '#111'
  ctx.font      = 'bold italic 16px Georgia, serif'
  ctx.fillText(DRIVER_NAME, W - PAD, sigRow + 28)
  ctx.strokeStyle = '#333'; ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.moveTo(W / 2 + 10, sigRow + 32); ctx.lineTo(W - PAD, sigRow + 32); ctx.stroke()
  ctx.fillStyle = '#666'; ctx.font = '7.5px Arial, sans-serif'
  ctx.fillText('(DRIVER\'S SIGNATURE IN FULL)', W - PAD, sigRow + 40)

  // Office address left
  ctx.textAlign = 'left'
  ctx.fillStyle = '#111'
  ctx.font      = 'bold italic 14px Georgia, serif'
  ctx.fillText(OFFICE_ADDRESS, PAD, sigRow + 58)
  ctx.strokeStyle = '#333'; ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.moveTo(PAD, sigRow + 62); ctx.lineTo(PAD + halfW, sigRow + 62); ctx.stroke()
  ctx.fillStyle = '#666'; ctx.font = '7.5px Arial, sans-serif'
  ctx.fillText('(MAIN OFFICE ADDRESS)', PAD, sigRow + 70)

  // Co-driver right
  ctx.textAlign = 'right'
  ctx.fillStyle = '#777'
  ctx.font      = '13px Georgia, serif'
  ctx.fillText(CODRIVER_NAME, W - PAD, sigRow + 58)
  ctx.strokeStyle = '#bbb'; ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.moveTo(W / 2 + 10, sigRow + 62); ctx.lineTo(W - PAD - 60, sigRow + 62); ctx.stroke()
  ctx.fillStyle = '#666'; ctx.font = '7.5px Arial, sans-serif'
  ctx.fillText('(NAME OF CO-DRIVER)', W - PAD - 60, sigRow + 70)

  // TOTAL HOURS label top-right of grid
  ctx.textAlign = 'right'
  ctx.fillStyle = '#333'
  ctx.font      = 'bold 8px Arial, sans-serif'
  ctx.fillText('TOTAL', W - PAD, sigRow + 58)
  ctx.fillText('HOURS', W - PAD, sigRow + 68)

  // GRID AREA 
  const ML   = PAD + 110   // left margin (row labels)
  const MR   = 52          // right margin (totals)
  const GW   = W - PAD - ML - MR - PAD + PAD  // grid width
  const NHR  = 40          // hour number strip height
  const RH   = 44          // each row height
  const GH   = RH * 4
  const GT   = sigRow + 78 // grid top (after header)
  const GNT  = GT + NHR    // grid rows top

  // Hour number strip
  ctx.fillStyle = '#f5f5f5'
  ctx.fillRect(ML, GT, GW, NHR)
  ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.5
  ctx.strokeRect(ML, GT, GW, NHR)

  const SLOTS = 96
  for (let s = 0; s <= SLOTS; s++) {
    const x      = ML + (s / SLOTS) * GW
    const min    = (s % 4) * 15
    const isHour = min === 0
    const isHalf = min === 30
    const tH     = isHour ? 12 : isHalf ? 7 : 4

    ctx.strokeStyle = isHour ? '#666' : '#ccc'
    ctx.lineWidth   = isHour ? 0.9 : 0.4
    ctx.beginPath(); ctx.moveTo(x, GT); ctx.lineTo(x, GT + tH); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x, GT + NHR); ctx.lineTo(x, GT + NHR - (isHour ? 7 : isHalf ? 4 : 2)); ctx.stroke()
  }

  ctx.textAlign = 'center'
  for (let h = 0; h <= 24; h++) {
    const x = ML + (h / 24) * GW
    if (h === 0 || h === 24) {
      ctx.fillStyle = '#333'; ctx.font = 'bold 7.5px Arial, sans-serif'
      ctx.fillText('Mid-', x, GT + 18); ctx.fillText('night', x, GT + 27)
    } else if (h === 12) {
      ctx.fillStyle = '#8B4513'; ctx.font = 'bold 9px Arial, sans-serif'
      ctx.fillText('Noon', x, GT + 24)
    } else {
      ctx.fillStyle = '#333'
      ctx.font = (h % 6 === 0) ? 'bold 9px Arial, sans-serif' : '8.5px Arial, sans-serif'
      ctx.fillText(h > 12 ? h - 12 : h, x, GT + 24)
    }
  }
  ctx.fillStyle = '#888'; ctx.font = '7px Arial, sans-serif'
  ctx.fillText('A.M.', ML + (6  / 24) * GW, GT + NHR - 4)
  ctx.fillText('P.M.', ML + (18 / 24) * GW, GT + NHR - 4)

  // Row backgrounds + labels
  ROWS.forEach((row, i) => {
    const y = GNT + i * RH
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(ML, y, GW, RH)
    ctx.fillStyle = '#fafafa'
    ctx.fillRect(PAD, y, ML - PAD, RH)

    // color bar on far left
    ctx.fillStyle = row.color
    ctx.fillRect(PAD, y, 4, RH)

    // row label
    ctx.textAlign = 'right'
    if (row.label.length === 2) {
      ctx.fillStyle = '#222'; ctx.font = 'bold 9.5px Arial, sans-serif'
      ctx.fillText(row.label[0], ML - 8, y + RH / 2 - 4)
      ctx.fillStyle = '#555'; ctx.font = '8.5px Arial, sans-serif'
      ctx.fillText(row.label[1], ML - 8, y + RH / 2 + 8)
    } else {
      ctx.fillStyle = '#222'; ctx.font = 'bold 9.5px Arial, sans-serif'
      ctx.fillText(row.label[0], ML - 8, y + RH / 2 + 4)
    }

    // row bottom border
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.7
    ctx.beginPath(); ctx.moveTo(PAD, y + RH); ctx.lineTo(W - PAD, y + RH); ctx.stroke()
  })

  // Top border of grid rows
  ctx.strokeStyle = '#999'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, GNT); ctx.lineTo(W - PAD, GNT); ctx.stroke()

  // Vertical grid lines
  for (let s = 0; s <= SLOTS; s++) {
    const x      = ML + (s / SLOTS) * GW
    const min    = (s % 4) * 15
    const isHour = min === 0; const isHalf = min === 30
    ctx.beginPath(); ctx.moveTo(x, GNT); ctx.lineTo(x, GNT + GH)
    if (isHour)      { ctx.strokeStyle = s === 0 || s === 96 ? '#888' : '#ccc'; ctx.lineWidth = 0.6 }
    else if (isHalf) { ctx.strokeStyle = '#ddd'; ctx.lineWidth = 0.4 }
    else             { ctx.strokeStyle = '#eee'; ctx.lineWidth = 0.25 }
    ctx.stroke()
  }
  // Noon line
  const noonX = ML + (12 / 24) * GW
  ctx.strokeStyle = '#8B451322'; ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.moveTo(noonX, GNT); ctx.lineTo(noonX, GNT + GH); ctx.stroke()

  // Grid outer border
  ctx.strokeStyle = '#888'; ctx.lineWidth = 1
  ctx.strokeRect(ML, GNT, GW, GH)

  // Draw activity segments 
  const segments = (day.grid || [])
    .map(s => ({ status: s.status, start: s.start ?? s.start_hour, end: s.end ?? s.end_hour }))
    .filter(s => STATUS_TO_ROW[s.status] && s.end > s.start)

  const rowMidY = key => {
    const ri = ROWS.findIndex(r => r.key === key)
    return GNT + ri * RH + RH / 2
  }

  // Colored fill
  segments.forEach(seg => {
    const key = STATUS_TO_ROW[seg.status]; if (!key) return
    const ri  = ROWS.findIndex(r => r.key === key)
    const col = ROWS[ri].color
    const x1  = ML + (seg.start / 24) * GW
    const x2  = ML + (seg.end   / 24) * GW
    ctx.fillStyle = col + '22'
    ctx.fillRect(x1, GNT + ri * RH + 1, x2 - x1, RH - 2)
  })

  // Step line
  ctx.strokeStyle = '#0000dd'; ctx.lineWidth = 2.2
  ctx.lineJoin = 'miter'; ctx.lineCap = 'square'
  ctx.beginPath()
  segments.forEach((seg, i) => {
    const key = STATUS_TO_ROW[seg.status]
    const x1  = ML + (seg.start / 24) * GW
    const x2  = ML + (seg.end   / 24) * GW
    const y   = rowMidY(key)
    if (i === 0) ctx.moveTo(x1, y); else ctx.lineTo(x1, y)
    ctx.lineTo(x2, y)
  })
  ctx.stroke()

  // Transition dots
  ctx.fillStyle = '#0000cc'
  const dot = (x, y) => { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill() }
  segments.forEach((seg, i) => {
    const key = STATUS_TO_ROW[seg.status]
    const x1  = ML + (seg.start / 24) * GW
    const x2  = ML + (seg.end   / 24) * GW
    const y   = rowMidY(key)
    dot(x1, y)
    if (i > 0 && STATUS_TO_ROW[segments[i-1].status] !== key)
      dot(x1, rowMidY(STATUS_TO_ROW[segments[i-1].status]))
    if (i === segments.length - 1) dot(x2, y)
  })

  // Totals column 
  const totals = { off_duty: 0, sleeper: 0, driving: 0, on_duty: 0 }
  segments.forEach(seg => {
    const k = STATUS_TO_ROW[seg.status]; if (k) totals[k] += seg.end - seg.start
  })
  Object.keys(totals).forEach(k => { totals[k] = Math.round(totals[k] * 4) / 4 })

  const TX = ML + GW   // totals column left
  ctx.fillStyle = '#f5f5f5'
  ctx.fillRect(TX, GNT, MR, GH)
  ctx.strokeStyle = '#aaa'; ctx.lineWidth = 0.8
  ctx.strokeRect(TX, GNT, MR, GH)

  ROWS.forEach((row, i) => {
    const cy  = GNT + i * RH + RH / 2 + 5
    const val = totals[row.key] || 0
    if (i > 0) {
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.6
      ctx.beginPath(); ctx.moveTo(TX, GNT + i * RH); ctx.lineTo(TX + MR, GNT + i * RH); ctx.stroke()
    }
    ctx.fillStyle  = val === 0 ? '#aaa' : '#111'
    ctx.font       = 'bold 12px Arial, sans-serif'
    ctx.textAlign  = 'center'
    ctx.fillText(fmt(val), TX + MR / 2, cy)
  })

  // REMARKS section 
  const remY = GNT + GH + 2
  const remH = 88

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(PAD, remY, CW, remH)
  ctx.strokeStyle = '#aaa'; ctx.lineWidth = 0.7
  ctx.strokeRect(PAD, remY, CW, remH)

  // Second hour ruler inside remarks (matches PDF exactly)
  ctx.fillStyle = '#f5f5f5'
  ctx.fillRect(ML, remY, GW, 22)
  ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.4
  ctx.strokeRect(ML, remY, GW, 22)
  for (let s = 0; s <= SLOTS; s++) {
    const x = ML + (s / SLOTS) * GW
    const min = (s % 4) * 15
    const isHour = min === 0; const isHalf = min === 30
    ctx.strokeStyle = isHour ? '#999' : '#ddd'
    ctx.lineWidth   = isHour ? 0.6 : 0.3
    ctx.beginPath(); ctx.moveTo(x, remY); ctx.lineTo(x, remY + (isHour ? 10 : isHalf ? 6 : 3)); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x, remY + 22); ctx.lineTo(x, remY + 22 - (isHour ? 10 : isHalf ? 6 : 3)); ctx.stroke()
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#555'; ctx.font = '7.5px Arial, sans-serif'
  for (let h = 0; h <= 24; h++) {
    const x = ML + (h / 24) * GW
    if (h === 0 || h === 24) { ctx.fillText('Mid-', x, remY + 10); ctx.fillText('night', x, remY + 17) }
    else if (h === 12) { ctx.fillStyle = '#8B4513'; ctx.fillText('Noon', x, remY + 14); ctx.fillStyle = '#555' }
    else ctx.fillText(h > 12 ? h - 12 : h, x, remY + 14)
  }

  // REMARKS label
  ctx.textAlign = 'left'; ctx.fillStyle = '#333'; ctx.font = 'bold 9px Arial, sans-serif'
  ctx.fillText('REMARKS', PAD + 4, remY + 34)

  // Vertical lines for duty-change annotations (at each status change time)
  const changeHours = []
  segments.forEach((seg, i) => {
    if (i === 0) changeHours.push(seg.start)
    if (i < segments.length - 1 && STATUS_TO_ROW[seg.status] !== STATUS_TO_ROW[segments[i+1].status])
      changeHours.push(seg.end)
  })
  changeHours.forEach(h => {
    const x = ML + (h / 24) * GW
    ctx.strokeStyle = '#999'; ctx.lineWidth = 0.5; ctx.setLineDash([2, 2])
    ctx.beginPath(); ctx.moveTo(x, remY + 22); ctx.lineTo(x, remY + remH - 4); ctx.stroke()
    ctx.setLineDash([])
  })

  // Remarks text — from/to route
  const from = shortCity(tripInfo?.from || '')
  const to   = shortCity(tripInfo?.to || '')
  ctx.fillStyle = '#444'; ctx.font = '8.5px Arial, sans-serif'
  ctx.fillText(`${from || 'Origin'}  →  ${to || 'Destination'}`, ML, remY + 36)

  // Duty summary line
  const summary = `Driving: ${fmt(totals.driving)}h   On Duty (Not Drv.): ${fmt(totals.on_duty)}h   Off Duty: ${fmt(totals.off_duty)}h   Sleeper: ${fmt(totals.sleeper)}h`
  ctx.fillStyle = '#555'; ctx.font = '8px Arial, sans-serif'
  ctx.fillText(summary, ML, remY + 50)

  // Cycle used
  ctx.fillText(`Cycle used: ${day.cycle_hours_used} / 70 hrs  ·  Day ${day.day_number} of trip`, ML, remY + 64)

  // =24 total right side
  ctx.textAlign = 'center'
  ctx.fillStyle = '#111'; ctx.font = 'bold 13px Arial, sans-serif'
  ctx.fillText('=24', TX + MR / 2, remY + remH / 2 + 6)
  ctx.strokeStyle = '#bbb'; ctx.lineWidth = 0.6
  ctx.strokeRect(TX, remY, MR, remH)

  // Pro/Shipping No
  ctx.textAlign = 'left'; ctx.fillStyle = '#444'; ctx.font = '8px Arial, sans-serif'
  ctx.fillText('Pro or Shipping No.', PAD + 4, remY + remH - 12)
  ctx.fillStyle = '#111'; ctx.font = 'bold 11px Arial, sans-serif'
  ctx.fillText(SHIPPING_NO, PAD + 90, remY + remH - 12)

  // 70-hr cycle bar 
  const barY = remY + remH + 6
  const pct  = Math.min(day.cycle_hours_used / 70, 1)
  const barC = pct > 0.85 ? '#c62828' : pct > 0.6 ? '#e65100' : '#2e7d32'

  ctx.fillStyle = '#333'; ctx.font = 'bold 8px Arial, sans-serif'; ctx.textAlign = 'left'
  ctx.fillText('70-HOUR / 8-DAY CYCLE:', ML, barY + 9)

  ctx.fillStyle = '#e0e0e0'
  ctx.beginPath(); ctx.roundRect(ML + 130, barY + 1, GW - 130, 10, 3); ctx.fill()
  if (pct > 0) {
    ctx.fillStyle = barC
    ctx.beginPath(); ctx.roundRect(ML + 130, barY + 1, (GW - 130) * pct, 10, 3); ctx.fill()
  }
  ctx.fillStyle = barC; ctx.font = 'bold 8px Arial, sans-serif'; ctx.textAlign = 'right'
  ctx.fillText(`${Math.round(pct * 100)}%  (${day.cycle_hours_used} / 70 hrs)`, TX + MR, barY + 9)
}

// Single page component 
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
      maxWidth: '960px',
      margin: '0 auto 48px',
      background: '#ffffff',
      boxShadow: '0 4px 32px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.1)',
      borderRadius: '2px',
      position: 'relative',
    }}>
      {/* Page label tab */}
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
        width={1100}
        height={720}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      />
    </div>
  )
}

// PDF Download 
async function downloadAsPDF(canvasRefs, days) {
  // Dynamically load jsPDF from CDN
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
    const imgData = canvas.toDataURL('image/jpeg', 0.95)
    if (i > 0) pdf.addPage()
    pdf.addImage(imgData, 'JPEG', 5, 5, 287, 200)
  }

  pdf.save(`ELD-Log-${days.length}-Days.pdf`)
}

// Root export 
export default function LogSheet({ days, tripInfo }) {
  const canvasRefs = useRef([])

  // reset refs array when days change
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
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>

      {/* Header */}
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
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            flexShrink: 0,
          }}
        >
          ⬇ Download PDF
        </button>
      </div>

      {/* One page per day */}
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