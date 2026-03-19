import { useState } from 'react'
import {
  Box, TextField, Button, Grid, Typography,
  Paper, Slider, InputAdornment
} from '@mui/material'
import RouteIcon from '@mui/icons-material/Route'
import AccessTimeIcon from '@mui/icons-material/AccessTime'

export default function TripForm({ onSubmit, loading }) {
  const [form, setForm] = useState({
    current_location: '',
    pickup_location: '',
    dropoff_location: '',
    cycle_used_hours: 0,
  })

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <RouteIcon color="primary" />
        <Typography variant="h6" fontWeight={600}>
          Plan your trip
        </Typography>
      </Box>

      <Box component="form" onSubmit={handleSubmit}>
        <Grid container spacing={2}>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Current location"
              name="current_location"
              value={form.current_location}
              onChange={handleChange}
              placeholder="e.g. Chicago, IL"
              required
              variant="outlined"
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Pickup location"
              name="pickup_location"
              value={form.pickup_location}
              onChange={handleChange}
              placeholder="e.g. St. Louis, MO"
              required
              variant="outlined"
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Dropoff location"
              name="dropoff_location"
              value={form.dropoff_location}
              onChange={handleChange}
              placeholder="e.g. Nashville, TN"
              required
              variant="outlined"
            />
          </Grid>

          {/* cycle hours slider */}
          <Grid item xs={12}>
            <Box sx={{ px: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <AccessTimeIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  Hours already used this cycle: <strong>{form.cycle_used_hours} / 70 hrs</strong>
                </Typography>
              </Box>
              <Slider
                value={form.cycle_used_hours}
                onChange={(e, v) => setForm({ ...form, cycle_used_hours: v })}
                min={0}
                max={70}
                step={0.5}
                marks={[
                  { value: 0, label: '0' },
                  { value: 35, label: '35 hrs' },
                  { value: 70, label: '70 hrs (limit)' }
                ]}
                sx={{ color: form.cycle_used_hours > 60 ? 'error.main' : 'primary.main' }}
              />
            </Box>
          </Grid>

          <Grid item xs={12}>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                bgcolor: '#1a237e',
                px: 4,
                borderRadius: 2,
                '&:hover': { bgcolor: '#283593' }
              }}
            >
              {loading ? 'Planning...' : 'Plan Trip'}
            </Button>
          </Grid>

        </Grid>
      </Box>
    </Paper>
  )
}