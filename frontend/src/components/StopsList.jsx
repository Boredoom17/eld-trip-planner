import {
  Box, Typography, Stepper, Step, StepLabel,
  StepContent, Paper, Chip
} from '@mui/material'
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation'
import HotelIcon from '@mui/icons-material/Hotel'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import InventoryIcon from '@mui/icons-material/Inventory'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import PauseCircleIcon from '@mui/icons-material/PauseCircle'
import WarningIcon from '@mui/icons-material/Warning'

const stopConfig = {
  start:      { icon: <PlayArrowIcon />,     color: '#2e7d32', label: 'Departure'    },
  pickup:     { icon: <InventoryIcon />,     color: '#1565c0', label: 'Pickup'       },
  dropoff:    { icon: <CheckCircleIcon />,   color: '#6a1b9a', label: 'Dropoff'      },
  rest:       { icon: <HotelIcon />,         color: '#e65100', label: 'Rest stop'    },
  rest_break: { icon: <PauseCircleIcon />,   color: '#f9a825', label: '30-min break' },
  fuel:       { icon: <LocalGasStationIcon />, color: '#00838f', label: 'Fuel stop'  },
  cycle_rest: { icon: <WarningIcon />,       color: '#b71c1c', label: '34hr Restart' },
}

export default function StopsList({ stops }) {
  return (
    <Box>
      <Typography variant="h6" fontWeight={600} mb={3}>
        Full stop schedule — {stops.length} stops total
      </Typography>

      <Stepper orientation="vertical" nonLinear>
        {stops.map((stop, i) => {
          const config = stopConfig[stop.type] || stopConfig.start

          return (
            <Step key={i} active expanded>
              <StepLabel
                StepIconComponent={() => (
                  <Box sx={{
                    color: config.color,
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    {config.icon}
                  </Box>
                )}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography fontWeight={600}>{stop.label}</Typography>
                  <Chip
                    label={config.label}
                    size="small"
                    sx={{
                      bgcolor: config.color,
                      color: 'white',
                      fontSize: '0.7rem'
                    }}
                  />
                </Box>
              </StepLabel>

              <StepContent>
                <Paper variant="outlined" sx={{ p: 2, mb: 1, borderRadius: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    📍 {stop.location}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    🕐 {stop.arrival_time}
                  </Typography>
                  <Typography variant="body2">
                    {stop.notes}
                  </Typography>
                </Paper>
              </StepContent>
            </Step>
          )
        })}
      </Stepper>
    </Box>
  )
}