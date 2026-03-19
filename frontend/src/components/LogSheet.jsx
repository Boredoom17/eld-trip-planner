import { useEffect, useRef } from 'react'
import { Box, Typography, Paper, Divider } from '@mui/material'

// the 4 rows on the log sheet grid, in order
const GRID_ROWS = [
  { key: 'off_duty',  label: 'Off Duty',         y: 0  },
  { key: 'sleeper',   label: 'Sleeper Berth',     y: 1  },
  { key: 'driving',   label: 'Driving',           y: 2  },
  { key: 'on_duty',   label: 'On Duty (Not Drv.)', y: 3 },
]

// maps our segment status to which row it belongs on
const STATUS_TO_ROW = {
  off_duty: 'off_duty',
  driving:  'driving',
  on_duty:  'on_duty',
}

// colors for each row — matches with FMCSA log sheet style
const ROW_COLORS = {
  off_duty: '#4caf50',
  sleeper:  '#2196f3',
  driving:  '#f44336',
  on_duty:  '#ff9800',
}

function drawLogSheet(canvas, dayData) {
  const ctx = canvas.getContext('2d')
  const W = canvas.width
  const H = canvas.height

  // clear whatever was there before
  ctx.clearRect(0, 0, W, H)

  // layout measurements
  const paddingLeft = 110  // space for row labels
  const paddingRight = 20
  const paddingTop = 60    // space for hour numbers
  const rowHeight = 36
  const gridWidth = W - paddingLeft - paddingRight
  const gridHeight = rowHeight * 4

  // white background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // ── title area ──────────────────────────────────────────
  ctx.fillStyle = '#1a237e'
  ctx.fillRect(0, 0, W, 36)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 13px Arial'
  ctx.textAlign = 'left'
  ctx.fillText("DRIVER'S DAILY LOG", 12, 23)
  ctx.font = '11px Arial'
  ctx.textAlign = 'right'
  ctx.fillText(`Day ${dayData.day_number}  —  ${dayData.date}`, W - 12, 23)

  // ── hour labels across the top ───────────────────────────
  ctx.fillStyle = '#333'
  ctx.font = '10px Arial'
  ctx.textAlign = 'center'

  // midnight label on left
  ctx.fillText('Mid-', paddingLeft, paddingTop - 18)
  ctx.fillText('night', paddingLeft, paddingTop - 8)

  // 1 through 23, then midnight again on right
  for (let h = 1; h <= 23; h++) {
    const x = paddingLeft + (h / 24) * gridWidth
    const label = h === 12 ? 'Noon' : h > 12 ? String(h - 12) : String(h)
    ctx.fillText(label, x, paddingTop - 6)
  }

  // midnight on the right side
  ctx.fillText('Mid-', W - paddingRight, paddingTop - 18)
  ctx.fillText('night', W - paddingRight, paddingTop - 8)

  // ── row labels on the left ───────────────────────────────
  GRID_ROWS.forEach((row, i) => {
    const y = paddingTop + i * rowHeight + rowHeight / 2
    ctx.fillStyle = '#333'
    ctx.font = '10px Arial'
    ctx.textAlign = 'right'
    ctx.fillText(row.label, paddingLeft - 6, y + 4)
  })

  // ── draw the grid background ─────────────────────────────
  ctx.strokeStyle = '#ccc'
  ctx.lineWidth = 0.5

  // outer border
  ctx.strokeRect(paddingLeft, paddingTop, gridWidth, gridHeight)

  // horizontal lines between rows
  for (let i = 1; i < 4; i++) {
    ctx.beginPath()
    ctx.moveTo(paddingLeft, paddingTop + i * rowHeight)
    ctx.lineTo(paddingLeft + gridWidth, paddingTop + i * rowHeight)
    ctx.stroke()
  }

  // vertical lines for each hour
  for (let h = 1; h < 24; h++) {
    const x = paddingLeft + (h / 24) * gridWidth
    ctx.beginPath()
    ctx.moveTo(x, paddingTop)
    ctx.lineTo(x, paddingTop + gridHeight)
    // make noon and midnight thicker so it's easier to read
    ctx.lineWidth = h === 12 ? 1.5 : 0.5
    ctx.stroke()
    ctx.lineWidth = 0.5
  }

  // half-hour tick marks inside each row
  ctx.strokeStyle = '#ddd'
  ctx.lineWidth = 0.3
  for (let h = 0; h < 24; h++) {
    const x = paddingLeft + ((h + 0.5) / 24) * gridWidth
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(x, paddingTop + i * rowHeight + rowHeight * 0.3)
      ctx.lineTo(x, paddingTop + i * rowHeight + rowHeight * 0.7)
      ctx.stroke()
    }
  }

  // ── draw the actual duty status lines ────────────────────
  dayData.grid.forEach(segment => {
    const rowKey = STATUS_TO_ROW[segment.status]
    if (!rowKey) return

    const rowIndex = GRID_ROWS.findIndex(r => r.key === rowKey)
    if (rowIndex === -1) return

    const x1 = paddingLeft + (segment.start / 24) * gridWidth
    const x2 = paddingLeft + (segment.end / 24) * gridWidth
    const y = paddingTop + rowIndex * rowHeight

    // colored fill for this segment
    ctx.fillStyle = ROW_COLORS[rowKey] + '33'  // light fill
    ctx.fillRect(x1, y + 1, x2 - x1, rowHeight - 2)

    // the thick horizontal line (like a real log sheet)
    ctx.strokeStyle = ROW_COLORS[rowKey]
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x1, y + rowHeight / 2)
    ctx.lineTo(x2, y + rowHeight / 2)
    ctx.stroke()

    // vertical drop lines at start and end of each segment
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x1, y + 4)
    ctx.lineTo(x1, y + rowHeight - 4)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x2, y + 4)
    ctx.lineTo(x2, y + rowHeight - 4)
    ctx.stroke()
  })

  // ── totals on the right side ─────────────────────────────
  const totalsX = W - paddingRight + 8
  ctx.fillStyle = '#333'
  ctx.font = '10px Arial'
  ctx.textAlign = 'left'

  const totals = [
    dayData.off_duty_hours,
    0,  // sleeper berth (not used in our basic version)
    dayData.driving_hours,
    dayData.on_duty_hours,
  ]

  totals.forEach((val, i) => {
    const y = paddingTop + i * rowHeight + rowHeight / 2 + 4
    ctx.fillStyle = ROW_COLORS[GRID_ROWS[i].key]
    ctx.font = 'bold 11px Arial'
    ctx.fillText(`${val}h`, totalsX, y)
  })

  // ── bottom summary area ───────────────────────────────────
  const summaryY = paddingTop + gridHeight + 16
  ctx.fillStyle = '#f5f5f5'
  ctx.fillRect(0, summaryY - 8, W, H - summaryY + 8)

  ctx.strokeStyle = '#ccc'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(0, summaryY - 8)
  ctx.lineTo(W, summaryY - 8)
  ctx.stroke()

  ctx.fillStyle = '#555'
  ctx.font = '10px Arial'
  ctx.textAlign = 'left'
  ctx.fillText(`Total driving: ${dayData.driving_hours} hrs`, paddingLeft, summaryY + 8)
  ctx.fillText(`On duty: ${dayData.on_duty_hours} hrs`, paddingLeft + 160, summaryY + 8)
  ctx.fillText(`Cycle total: ${dayData.cycle_hours_used} / 70 hrs`, paddingLeft + 320, summaryY + 8)

  // cycle usage bar
  const barY = summaryY + 20
  const barW = gridWidth * 0.6
  ctx.fillStyle = '#eee'
  ctx.fillRect(paddingLeft, barY, barW, 10)

  const usedW = (dayData.cycle_hours_used / 70) * barW
  const barColor = dayData.cycle_hours_used > 60 ? '#f44336' : dayData.cycle_hours_used > 40 ? '#ff9800' : '#4caf50'
  ctx.fillStyle = barColor
  ctx.fillRect(paddingLeft, barY, usedW, 10)

  ctx.strokeStyle = '#ccc'
  ctx.lineWidth = 0.5
  ctx.strokeRect(paddingLeft, barY, barW, 10)

  ctx.fillStyle = '#555'
  ctx.font = '9px Arial'
  ctx.textAlign = 'left'
  ctx.fillText('Cycle usage (70hr limit)', paddingLeft, barY + 22)
}

// one canvas per day
function DayLog({ dayData }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (canvasRef.current) {
      drawLogSheet(canvasRef.current, dayData)
    }
  }, [dayData])

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        borderRadius: 2,
        mb: 3,
        border: '1px solid #e0e0e0'
      }}
    >
      <canvas
        ref={canvasRef}
        width={820}
        height={220}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          borderRadius: '4px',
        }}
      />
    </Paper>
  )
}

export default function LogSheet({ days }) {
  return (
    <Box>
      <Typography variant="h6" fontWeight={600} mb={1}>
        Daily log sheets — {days.length} day{days.length > 1 ? 's' : ''}
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Generated automatically based on FMCSA Hours of Service rules.
        Each sheet shows the 24-hour duty status grid like the official form.
      </Typography>

      <Divider sx={{ mb: 3 }} />

      {days.map((day, i) => (
        <DayLog key={i} dayData={day} />
      ))}
    </Box>
  )
}