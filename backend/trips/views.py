import requests
import os
import math
from dotenv import load_dotenv
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .hos_calculator import plan_trip

load_dotenv()

ORS_BASE_URL = "https://api.openrouteservice.org/v2/directions/driving-hgv"
ORS_API_KEY  = os.getenv("ORS_API_KEY")


def decode_polyline(encoded):
    """Decode ORS encoded polyline into list of (lat, lng) tuples."""
    points, index, lat, lng = [], 0, 0, 0
    while index < len(encoded):
        shift = result = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1f) << shift
            shift += 5
            if b < 0x20:
                break
        lat += (~(result >> 1) if result & 1 else result >> 1)
        shift = result = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1f) << shift
            shift += 5
            if b < 0x20:
                break
        lng += (~(result >> 1) if result & 1 else result >> 1)
        points.append((lat / 1e5, lng / 1e5))
    return points


def haversine_miles(p1, p2):
    """Great-circle distance in miles between two (lat, lng) points."""
    R = 3958.8
    lat1, lon1 = math.radians(p1[0]), math.radians(p1[1])
    lat2, lon2 = math.radians(p2[0]), math.radians(p2[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def reverse_geocode(lat, lng):
    """Return 'City, ST' for a coordinate using Nominatim (free, no key)."""
    try:
        resp = requests.get(
            'https://nominatim.openstreetmap.org/reverse',
            params={'lat': lat, 'lon': lng, 'format': 'json', 'zoom': 10},
            headers={'User-Agent': 'ELD-Trip-Planner/1.0'},
            timeout=6,
        )
        addr  = resp.json().get('address', {})
        city  = addr.get('city') or addr.get('town') or addr.get('village') or addr.get('county', '')
        state = addr.get('state', '')
        # shorten state to abbreviation (Nominatim returns full name)
        state_abbr = STATE_ABBR.get(state, state[:2].upper() if state else '')
        return f'{city}, {state_abbr}' if city else 'En route'
    except Exception:
        return 'En route'


# US state name → 2-letter abbreviation 
STATE_ABBR = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
    'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
    'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
    'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
    'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
    'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
    'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
    'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
    'Wisconsin': 'WI', 'Wyoming': 'WY',
}


def get_fuel_stop_coords(leg1_geometry, leg2_geometry, leg1_miles, leg2_miles,
                          fuel_every=1000):
    """
    Decode both route legs, walk cumulative miles, and at every `fuel_every`
    miles interpolate an exact on-road coordinate, then reverse-geocode it.
    Returns a list of {miles_marker, lat, lng, location}.
    """
    leg1_pts = decode_polyline(leg1_geometry)
    leg2_pts = decode_polyline(leg2_geometry)
    all_pts  = leg1_pts + leg2_pts

    total_miles = leg1_miles + leg2_miles
    results     = []
    cum_dist    = 0.0
    next_target = float(fuel_every)

    for i in range(1, len(all_pts)):
        seg_dist = haversine_miles(all_pts[i - 1], all_pts[i])
        if seg_dist == 0:
            continue
        cum_dist += seg_dist

        # one segment may cross multiple 1000-mile marks
        while next_target <= total_miles and cum_dist >= next_target:
            # how far into this segment is the fuel mark?
            overshoot = cum_dist - next_target
            frac      = max(0.0, min(1.0, 1.0 - overshoot / seg_dist))
            lat = all_pts[i - 1][0] + frac * (all_pts[i][0] - all_pts[i - 1][0])
            lng = all_pts[i - 1][1] + frac * (all_pts[i][1] - all_pts[i - 1][1])

            location = reverse_geocode(lat, lng)
            results.append({
                'miles_marker': round(next_target),
                'lat':          round(lat, 5),
                'lng':          round(lng, 5),
                'location':     location,
            })
            next_target += fuel_every

    return results


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

# Routing + fuel stop coordinate  interpolation 
def get_route(coord1, coord2, api_key):
    """
    Gets real road distance between two coordinates using OpenRouteService.
    Tries HGV profile first (truck-specific routing), falls back to car.
    Uses miles / 55mph for driving time.
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

            # get distance
            if 'distance' in summary and summary['distance']:
                dist_m = summary['distance']
            else:
                segments = route.get('segments', [{}])
                dist_m   = sum(s.get('distance', 0) for s in segments)

            # convert meters to miles
            miles = dist_m * 0.000621371
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
# Main endpoint and validation form 
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

    from datetime import datetime
    _today = datetime.now().strftime('%Y-%m-%d')
    start_time_str = data.get('start_time', None) or f'{_today}T08:00'
    
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

    # current - pickup must be different places
    if coords_too_close(current_coords, pickup_coords):
        return Response(
            {'error': 'Current location and pickup are too close together. The driver needs to travel to pick up the load.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # pickup - dropoff must be different places
    if coords_too_close(pickup_coords, dropoff_coords):
        return Response(
            {'error': 'Pickup and dropoff are the same location. Please enter a different delivery destination.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # NOTE: current == dropoff is intentionally allowed.

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

    # compute real on-road coordinates for every fuel stop
    fuel_coords = get_fuel_stop_coords(
        leg1['geometry'], leg2['geometry'],
        leg1['miles'],    leg2['miles'],
    )

    # enrich fuel stops with real coords by pairing them in order
    # (1st fuel stop in plan → 1st coord, 2nd → 2nd, etc.)
    fuel_stops_in_plan = [s for s in trip_plan['stops'] if s['type'] == 'fuel']
    for i, stop in enumerate(fuel_stops_in_plan):
        if i < len(fuel_coords):
            fc = fuel_coords[i]
            stop['location'] = fc['location']
            stop['lat']      = fc['lat']
            stop['lng']      = fc['lng']
            stop['notes']    = (
                f'Fueling near {fc["location"]} — '
                + stop['notes'].split('—', 1)[-1].strip()
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
        'fuel_stop_coords': fuel_coords,
    })