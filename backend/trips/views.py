import requests
import os
from dotenv import load_dotenv
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .hos_calculator import plan_trip

load_dotenv()

ORS_BASE_URL = "https://api.openrouteservice.org/v2/directions/driving-hgv"
ORS_API_KEY  = os.getenv("ORS_API_KEY")


def get_coordinates(place_name):
    """
    Geocodes a place name to lat/lng using OpenStreetMap Nominatim.
    Biased toward USA results.
    """
    url    = "https://nominatim.openstreetmap.org/search"
    params = {
        'q':              place_name,
        'format':         'json',
        'limit':          1,
        'countrycodes':   'us',
        'addressdetails': 1,
    }
    try:
        resp = requests.get(
            url, params=params,
            headers={'User-Agent': 'ELD-Trip-Planner/1.0'},
            timeout=8
        )
        data = resp.json()
        if not data:
            return None
        return {
            'lat':          float(data[0]['lat']),
            'lng':          float(data[0]['lon']),
            'display_name': data[0]['display_name'],
        }
    except Exception:
        return None


def get_route(coord1, coord2, api_key):
    """
    Gets real road distance between two coordinates using OpenRouteService.
    Tries HGV profile first (truck-specific routing), falls back to car.
    Uses miles / 55mph for driving time — FMCSA assumes 55mph average
    for property-carrying trucks. ORS duration is unreliable for HGV
    (returns ~43mph effective speed which inflates trip days).
    """
    headers = {'Authorization': api_key, 'Content-Type': 'application/json'}
    body    = {
        'coordinates': [
            [coord1['lng'], coord1['lat']],
            [coord2['lng'], coord2['lat']],
        ]
    }

    for profile in ['driving-hgv', 'driving-car']:
        try:
            url  = f'https://api.openrouteservice.org/v2/directions/{profile}'
            resp = requests.post(url, json=body, headers=headers, timeout=15)

            if resp.status_code != 200:
                continue

            data    = resp.json()
            route   = data['routes'][0]
            summary = route.get('summary', {})

            # get distance — ORS sometimes puts it in summary, sometimes segments
            if 'distance' in summary and summary['distance']:
                dist_m = summary['distance']
            else:
                segments = route.get('segments', [{}])
                dist_m   = sum(s.get('distance', 0) for s in segments)

            # convert meters to miles
            miles = dist_m * 0.000621371

            # FMCSA standard: 55mph average for property-carrying trucks
            # DO NOT use ORS duration — it returns ~43mph for HGV routes
            # which makes a 5-day trip appear as 7 days
            hours = miles / 55.0

            return {
                'miles':    round(miles, 1),
                'hours':    round(hours, 2),
                'geometry': route['geometry'],
            }

        except Exception:
            continue

    return None


def coords_too_close(c1, c2):
    """
    Returns True if two coordinates are within ~3-4 miles of each other
    (basically the same location).
    """
    return (
        abs(c1['lat'] - c2['lat']) < 0.05 and
        abs(c1['lng'] - c2['lng']) < 0.05
    )


@api_view(['POST'])
def plan_trip_view(request):
    """
    Main endpoint. React sends trip details, we return the full HOS plan.
    Flow: validate inputs → geocode → get truck routes → run HOS calculator
    """
    data = request.data

    # check all required fields are present
    for field in ['current_location', 'pickup_location', 'dropoff_location', 'cycle_used_hours']:
        if field not in data:
            return Response(
                {'error': f'Missing field: {field}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    current_location = data['current_location'].strip()
    pickup_location  = data['pickup_location'].strip()
    dropoff_location = data['dropoff_location'].strip()
    cycle_used_hours = float(data['cycle_used_hours'])
    start_time_str   = data.get('start_time', None)

    # basic presence check
    if not current_location or not pickup_location or not dropoff_location:
        return Response(
            {'error': 'All three location fields are required.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # at 70hrs the driver legally cannot start a new shift
    if cycle_used_hours < 0 or cycle_used_hours >= 70:
        return Response(
            {'error': 'Cycle hours must be between 0 and 69.5. At 70 hrs the driver cannot legally drive.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # geocode all three locations
    current_coords = get_coordinates(current_location)
    pickup_coords  = get_coordinates(pickup_location)
    dropoff_coords = get_coordinates(dropoff_location)

    if not current_coords:
        return Response(
            {'error': f'Could not find "{current_location}". Try a more specific name, e.g. "Chicago, IL"'},
            status=status.HTTP_400_BAD_REQUEST
        )
    if not pickup_coords:
        return Response(
            {'error': f'Could not find "{pickup_location}". Try a more specific name, e.g. "Denver, CO"'},
            status=status.HTTP_400_BAD_REQUEST
        )
    if not dropoff_coords:
        return Response(
            {'error': f'Could not find "{dropoff_location}". Try a more specific name, e.g. "Nashville, TN"'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # current → pickup must be different places
    if coords_too_close(current_coords, pickup_coords):
        return Response(
            {'error': 'Current location and pickup are too close together. The driver needs to travel to pick up the load.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # pickup → dropoff must be different places
    if coords_too_close(pickup_coords, dropoff_coords):
        return Response(
            {'error': 'Pickup and dropoff are the same location. Please enter a different delivery destination.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # NOTE: current == dropoff is intentionally allowed.
    # Drivers often return to their home terminal after delivering — totally normal.

    # get real road routes for both legs
    leg1 = get_route(current_coords, pickup_coords,  ORS_API_KEY)
    leg2 = get_route(pickup_coords,  dropoff_coords, ORS_API_KEY)

    if not leg1:
        return Response(
            {'error': 'Could not calculate route to pickup. Try more specific city names.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    if not leg2:
        return Response(
            {'error': 'Could not calculate route to dropoff. Try more specific city names.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # sanity check — under 1 mile means geocoding returned the same spot
    if leg1['miles'] < 1:
        return Response(
            {'error': 'Current location and pickup appear to be the same place.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    if leg2['miles'] < 1:
        return Response(
            {'error': 'Pickup and dropoff appear to be the same place.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    route_data = {
        'leg1_miles':    leg1['miles'],
        'leg1_hours':    leg1['hours'],
        'leg2_miles':    leg2['miles'],
        'leg2_hours':    leg2['hours'],
        'leg1_geometry': leg1['geometry'],
        'leg2_geometry': leg2['geometry'],
    }

    # run the HOS calculator — returns stops, daily logs, and trip summary
    trip_plan = plan_trip(
        current_location,
        pickup_location,
        dropoff_location,
        cycle_used_hours,
        route_data,
        start_time_str,
    )

    return Response({
        'success':   True,
        'trip_plan': trip_plan,
        'coordinates': {
            'current': current_coords,
            'pickup':  pickup_coords,
            'dropoff': dropoff_coords,
        },
        'route_geometry': {
            'leg1': leg1['geometry'],
            'leg2': leg2['geometry'],
        },
    })