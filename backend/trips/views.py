import requests
import os
from dotenv import load_dotenv
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .hos_calculator import plan_trip

#loads datas from .env file
load_dotenv()
ORS_BASE_URL = "https://api.openrouteservice.org/v2/directions/driving-car"
ORS_API_KEY = os.getenv("ORS_API_KEY") 

def get_coordinates(place_name):
    """
    turns a place name like 'Chicago, IL' into lat/lng coordinates
    using OpenStreetMap's free geocoding — no API key needed for this part
    """
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        'q': place_name,
        'format': 'json',
        'limit': 1,
        'countrycodes': 'us',  # keep results inside USA
    }
    headers = {
        # nominatim requires a user agent — just put something descriptive
        'User-Agent': 'ELD-Trip-Planner/1.0'
    }
    response = requests.get(url, params=params, headers=headers)
    data = response.json()

    if not data:
        return None

    return {
        'lat': float(data[0]['lat']),
        'lng': float(data[0]['lon']),
        'display_name': data[0]['display_name']
    }


def get_route(coord1, coord2, api_key):
    """
    gets the actual road route between two coordinates
    returns distance in miles and duration in hours
    """
    headers = {
        'Authorization': api_key,
        'Content-Type': 'application/json'
    }
    body = {
        'coordinates': [
            [coord1['lng'], coord1['lat']],  # ORS wants [lng, lat] not [lat, lng]
            [coord2['lng'], coord2['lat']]
        ]
    }

    response = requests.post(ORS_BASE_URL, json=body, headers=headers)

    if response.status_code != 200:
        return None

    data = response.json()
    route = data['routes'][0]['summary']

    # ORS gives meters and seconds — convert to miles and hours
    miles = route['distance'] * 0.000621371
    hours = route['duration'] / 3600

    # also grab the actual route geometry so we can draw it on the map
    geometry = data['routes'][0]['geometry']

    return {
        'miles': round(miles, 1),
        'hours': round(hours, 2),
        'geometry': geometry
    }


@api_view(['POST'])
def plan_trip_view(request):
    """
    main endpoint — React sends trip details here, we send back the full plan
    """
    data = request.data

    # make sure all required fields came through
    required_fields = ['current_location', 'pickup_location', 'dropoff_location', 'cycle_used_hours']
    for field in required_fields:
        if field not in data:
            return Response(
                {'error': f'Missing field: {field}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    current_location = data['current_location']
    pickup_location = data['pickup_location']
    dropoff_location = data['dropoff_location']
    cycle_used_hours = float(data['cycle_used_hours'])

    # step 1 — turn place names into coordinates
    current_coords = get_coordinates(current_location)
    pickup_coords = get_coordinates(pickup_location)
    dropoff_coords = get_coordinates(dropoff_location)

    if not all([current_coords, pickup_coords, dropoff_coords]):
        return Response(
            {'error': 'Could not find one or more locations — try being more specific, e.g. "Chicago, IL"'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # step 2 — get the actual road routes for both legs
    api_key = ORS_API_KEY
    leg1_route = get_route(current_coords, pickup_coords, api_key)
    leg2_route = get_route(pickup_coords, dropoff_coords, api_key)

    if not leg1_route or not leg2_route:
        return Response(
            {'error': 'Could not calculate route — check your API key or try different locations'},
            status=status.HTTP_400_BAD_REQUEST
        )

    route_data = {
        'leg1_miles': leg1_route['miles'],
        'leg1_hours': leg1_route['hours'],
        'leg2_miles': leg2_route['miles'],
        'leg2_hours': leg2_route['hours'],
        'leg1_geometry': leg1_route['geometry'],
        'leg2_geometry': leg2_route['geometry'],
    }

    # step 3 — run the HOS calculator with all this info
    trip_plan = plan_trip(
        current_location,
        pickup_location,
        dropoff_location,
        cycle_used_hours,
        route_data
    )

    # step 4 — send everything back to React
    return Response({
        'success': True,
        'trip_plan': trip_plan,
        'coordinates': {
            'current': current_coords,
            'pickup': pickup_coords,
            'dropoff': dropoff_coords,
        },
        'route_geometry': {
            'leg1': leg1_route['geometry'],
            'leg2': leg2_route['geometry'],
        }
    })