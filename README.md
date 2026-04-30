<div align="center">

# 🚛 ELD Trip Planner
### FMCSA Hours of Service Compliance Tool

[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Django](https://img.shields.io/badge/Django-5.0-092E20?style=for-the-badge&logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?style=for-the-badge&logo=leaflet&logoColor=white)](https://leafletjs.com/)

**Plan Route** • **Schedule Shifts** • **Generate ELD Logs**

---

</div>

## 📖 Overview

ELD Trip Planner is a web application for commercial truck drivers and fleet managers to plan multi-day trips with full FMCSA Hours of Service compliance. Enter your current location, pickup, dropoff, and current cycle hours — get an optimized driving schedule with day-by-day ELD log sheets ready to download.

Built with a custom HOS calculator engine that handles all FMCSA regulations: driving limits, mandatory breaks, 10-hour rests, 70-hour cycle tracking, and 34-hour restarts — automatically distributed across the most efficient number of days.

**Live:** [eld-trip-planner-ad.vercel.app](https://eld-trip-planner-ad.vercel.app)

### ✨ Key Features

- 🗺️ **Interactive Route Map** — Full route visualization with stop markers via Leaflet
- ⏱️ **HOS-Compliant Scheduling** — All FMCSA regulations enforced automatically
- 📋 **ELD Daily Log Sheets** — FMCSA-format 24-hour grid, canvas-rendered
- 📄 **PDF Download** — Export all log sheets as a single PDF
- 📍 **Trip Stops Timeline** — Pre-trip inspection, breaks, fuel, pickup/dropoff, restarts
- 🔄 **34-hr Restart Handling** — Fires at the exact moment cycle limit is hit
- 📐 **Resizable Split Panel** — Drag to resize form/results on desktop

## 🛠️ Tech Stack

### Frontend
- **React** — UI framework
- **Vite** — Build tool
- **Leaflet** — Interactive maps
- **jsPDF** — PDF generation
- **Axios** — HTTP client

### Backend
- **Django** — Web framework
- **Django REST Framework** — API layer
- **OpenRouteService API** — Routing and geocoding
- **Gunicorn** — Production WSGI server
- **Whitenoise** — Static file serving

### Deploy
- **Vercel** — Frontend hosting
- **Railway** — Backend hosting (option)
- **Render** — Backend hosting (option, free tier supported)

## 🎯 How It Works

```
Enter Trip Details → ORS Routing API → HOS Calculator → Day-by-Day Schedule
                                                              ↓
                                              Route Map + Stops Timeline + ELD Sheets → PDF
```

### User Flow

1. **Enter trip details** — current location, pickup, dropoff, hours driven this week
2. **Plan trip** — ORS calculates route, HOS engine distributes driving across days
3. **Review results** — map with stops, full timeline, ELD log sheets per day
4. **Download logs** — export all daily sheets as PDF

## ⚙️ HOS Rules Implemented

| Rule | Value |
|---|---|
| Max driving per shift | 11 hours | 
| Driving window | 14 hours from shift start | 
| Mandatory break | 30 min after 8h cumulative driving | 
| Rest between shifts | 10 hours sleeper berth |
| Cycle limit | 70 hours / 8 days |
| Restart | 34 hours off-duty |
| Fuel stops | Every 1,000 miles | 
| Pickup / Dropoff | 1 hour each (on-duty not driving) |

**Break classification:** Mandatory break is OFF DUTY and does not count toward the 70-hr cycle per § 395.3(a)(3)(ii).

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.12+
- [OpenRouteService API key](https://openrouteservice.org) (free)

### Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Create .env
echo "SECRET_KEY=your-secret-key" > .env
echo "ORS_API_KEY=your-ors-key" >> .env
echo "DEBUG=True" >> .env

python manage.py migrate
python manage.py runserver
```

### Frontend Setup

```bash
cd frontend
npm install
echo "VITE_API_URL=http://127.0.0.1:8000" > .env.local
npm run dev
```

App runs at `http://localhost:5173`

## 🗂️ Project Structure

```
eld-trip-planner/
├── backend/
│   ├── core/                   # Django project config
│   ├── trips/
│   │   ├── hos_calculator.py   # HOS logic engine
│   │   ├── views.py            # API endpoints
│   │   └── urls.py
│   ├── requirements.txt
│   └── manage.py
│
└── frontend/
    └── src/
        ├── components/
        │   ├── TripForm.jsx     # Input form
        │   ├── TripMap.jsx      # Leaflet map
        │   ├── StopsList.jsx    # Trip timeline
        │   └── LogSheet.jsx     # ELD canvas sheets
        └── App.jsx
```

## 🌍 Environment Variables

### Backend

| Variable | Description |
|---|---|
| `SECRET_KEY` | Django secret key |
| `ORS_API_KEY` | OpenRouteService API key |
| `DEBUG` | `True` for dev, `False` for prod |
| `ALLOWED_HOSTS` | Space-separated allowed hosts |

### Frontend

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL |

## 📋 API

### `POST /api/plan-trip/`

```json
// Request
{
  "current_location": "Chicago, IL",
  "pickup_location": "Denver, CO",
  "dropoff_location": "New York, NY",
  "cycle_used_hours": 24.5,
  "start_time": "2026-03-21T08:00"
}

// Response
{
  "trip_plan": {
    "stops": [...],
    "days": [...],
    "total_miles": 2785.4,
    "total_days": 7,
    "total_driving_hours": 50.6,
    "estimated_arrival": "2026-03-27 09:15"
  },
  "coordinates": {...},
  "route_geometry": "..."
}
```

## 🐛 Known Limitations

- Speed assumed at 55 mph average (no real-time traffic)
- Single driver only — no team driving or split sleeper berth rule
- Geocoding accuracy depends on Nominatim / ORS

## 👨‍💻 Developer

**Aadarsha Chhetri** — [@Boredoom17](https://github.com/Boredoom17)

## 📄 License

MIT

---

<div align="center">

**⭐ Star this repo if you found it useful!**

[🌐 Live App](https://eld-trip-planner-ad.vercel.app) • [🐛 Report Bug](https://github.com/Boredoom17/eld-trip-planner/issues)

</div>
