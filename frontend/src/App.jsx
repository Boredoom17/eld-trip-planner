import { useState } from 'react'
import axios from 'axios'
import {
  Container, Box, Typography, Alert,
  CircularProgress, Tabs, Tab, Paper
} from '@mui/material'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import TripForm from './components/TripForm'
import TripMap from './components/TripMap'
import StopsList from './components/StopsList'
import LogSheet from './components/LogSheet'

export default function App() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tripData, setTripData] = useState(null)
  const [activeTab, setActiveTab] = useState(0)

  const handlePlanTrip = async (formData) => {
    setLoading(true)
    setError(null)
    setTripData(null)

    try {
      const response = await axios.post(
        'http://127.0.0.1:8000/api/plan-trip/',
        formData
      )
      setTripData(response.data)
      // jump straight to the results tab once we have data
      setActiveTab(1)
    } catch (err) {
      setError(
        err.response?.data?.error ||
        'Something went wrong — make sure the backend is running'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f0f2f5' }}>

      {/* header */}
      <Box sx={{
        bgcolor: '#1a237e',
        color: 'white',
        py: 2.5,
        px: 3,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        boxShadow: 3
      }}>
        <LocalShippingIcon sx={{ fontSize: 36 }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>
            ELD Trip Planner
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            FMCSA Hours of Service Compliance Tool
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="xl" sx={{ py: 4 }}>

        {/* trip form always visible at top */}
        <TripForm onSubmit={handlePlanTrip} loading={loading} />

        {/* loading spinner */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, gap: 2, alignItems: 'center' }}>
            <CircularProgress size={28} />
            <Typography color="text.secondary">
              Calculating your route and HOS schedule...
            </Typography>
          </Box>
        )}

        {/* error message */}
        {error && (
          <Alert severity="error" sx={{ mt: 3 }}>
            {error}
          </Alert>
        )}

        {/* results section — only shows after a trip is planned */}
        {tripData && (
          <Paper elevation={2} sx={{ mt: 4, borderRadius: 3, overflow: 'hidden' }}>

            {/* quick summary bar */}
            <Box sx={{
              bgcolor: '#1a237e',
              color: 'white',
              px: 3,
              py: 2,
              display: 'flex',
              gap: 4,
              flexWrap: 'wrap'
            }}>
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>Total distance</Typography>
                <Typography fontWeight={700}>{tripData.trip_plan.total_miles} miles</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>Total days</Typography>
                <Typography fontWeight={700}>{tripData.trip_plan.total_days} days</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>Driving hours</Typography>
                <Typography fontWeight={700}>{tripData.trip_plan.total_driving_hours} hrs</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>Estimated arrival</Typography>
                <Typography fontWeight={700}>{tripData.trip_plan.estimated_arrival}</Typography>
              </Box>
            </Box>

            {/* tabs for map / stops / log sheets */}
            <Tabs
              value={activeTab}
              onChange={(e, v) => setActiveTab(v)}
              sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
            >
              <Tab label="Map & Route" />
              <Tab label="Stop Schedule" />
              <Tab label="Daily Log Sheets" />
            </Tabs>

            <Box sx={{ p: 3 }}>
              {activeTab === 0 && (
                <TripMap
                  coordinates={tripData.coordinates}
                  routeGeometry={tripData.route_geometry}
                  stops={tripData.trip_plan.stops}
                />
              )}
              {activeTab === 1 && (
                <StopsList stops={tripData.trip_plan.stops} />
              )}
              {activeTab === 2 && (
                <LogSheet days={tripData.trip_plan.days} />
              )}
            </Box>

          </Paper>
        )}
      </Container>
    </Box>
  )
}