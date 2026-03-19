from datetime import datetime, timedelta

# average speed we assume for trucks on US highways (mph)
AVERAGE_SPEED_MPH = 55

# all the FMCSA rules in one place — easy to find if anything changes
MAX_DRIVING_HOURS = 11
MAX_WINDOW_HOURS = 14
REQUIRED_REST_HOURS = 10
BREAK_AFTER_HOURS = 8
BREAK_DURATION_MINUTES = 30
MAX_CYCLE_HOURS = 70
FUEL_STOP_EVERY_MILES = 1000
PICKUP_DROPOFF_HOURS = 1


def plan_trip(current_location, pickup_location, dropoff_location, cycle_used_hours, route_data):
    """
    takes everything we know about the trip and builds a full day-by-day plan
    that keeps the driver legal under FMCSA rules
    """
    leg1_miles = route_data['leg1_miles']
    leg1_hours = route_data['leg1_hours']
    leg2_miles = route_data['leg2_miles']
    leg2_hours = route_data['leg2_hours']

    total_miles = leg1_miles + leg2_miles
    total_driving_hours = leg1_hours + leg2_hours

    stops = []
    days = []

    current_time = datetime.now().replace(minute=0, second=0, microsecond=0)
    cycle_hours_used = cycle_used_hours
    day_number = 1
    remaining_driving = total_driving_hours
    remaining_miles = total_miles
    pickup_done = False
    leg1_remaining = leg1_hours
    leg1_miles_remaining = leg1_miles
    day_start_time = current_time
    hours_driven_this_day = 0

    stops.append({
        'type': 'start',
        'label': 'Starting point',
        'location': current_location,
        'arrival_time': current_time.strftime('%Y-%m-%d %H:%M'),
        'notes': f'Beginning trip. {round(70 - cycle_hours_used, 1)} hrs left in cycle.'
    })

    while remaining_driving > 0:
        day_start_time = current_time
        hours_driven_this_day = 0
        hours_on_duty_today = 0
        hours_since_last_break = 0
        window_used = 0
        miles_since_last_fuel = 0

        # pre-trip inspection counts as on-duty time (not driving)
        current_time += timedelta(minutes=30)
        window_used += 0.5
        hours_on_duty_today += 0.5
        cycle_hours_used += 0.5

        while remaining_driving > 0 and window_used < MAX_WINDOW_HOURS:

            # mandatory 30min break after 8 cumulative hours of driving
            if hours_since_last_break >= BREAK_AFTER_HOURS:
                stops.append({
                    'type': 'rest_break',
                    'label': '30-min mandatory break',
                    'location': 'En route',
                    'arrival_time': current_time.strftime('%Y-%m-%d %H:%M'),
                    'notes': 'Required break after 8 hours of driving'
                })
                current_time += timedelta(minutes=30)
                window_used += 0.5
                cycle_hours_used += 0.5
                hours_since_last_break = 0

            # fuel stop every 1000 miles
            if miles_since_last_fuel >= FUEL_STOP_EVERY_MILES:
                stops.append({
                    'type': 'fuel',
                    'label': 'Fuel stop',
                    'location': 'En route',
                    'arrival_time': current_time.strftime('%Y-%m-%d %H:%M'),
                    'notes': f'Fueling up — {round(remaining_miles, 0)} miles still to go'
                })
                current_time += timedelta(minutes=30)
                window_used += 0.5
                cycle_hours_used += 0.5
                miles_since_last_fuel = 0

            # hit the 70hr weekly limit — need a 34hr restart
            if cycle_hours_used >= MAX_CYCLE_HOURS:
                stops.append({
                    'type': 'cycle_rest',
                    'label': '34-hr restart required',
                    'location': 'En route',
                    'arrival_time': current_time.strftime('%Y-%m-%d %H:%M'),
                    'notes': 'Hit the 70-hour weekly limit — need 34hr restart'
                })
                current_time += timedelta(hours=34)
                cycle_hours_used = 0
                hours_since_last_break = 0
                break

            # figure out the biggest chunk we can drive right now
            hours_till_break = BREAK_AFTER_HOURS - hours_since_last_break
            hours_left_today = MAX_DRIVING_HOURS - hours_driven_this_day
            window_left = MAX_WINDOW_HOURS - window_used

            if not pickup_done and leg1_remaining > 0:
                drive_chunk = min(
                    leg1_remaining,
                    hours_till_break,
                    hours_left_today,
                    window_left
                )
            else:
                drive_chunk = min(
                    remaining_driving,
                    hours_till_break,
                    hours_left_today,
                    window_left
                )

            if drive_chunk <= 0:
                break

            # drive the chunk
            miles_this_chunk = drive_chunk * AVERAGE_SPEED_MPH
            current_time += timedelta(hours=drive_chunk)
            hours_driven_this_day += drive_chunk
            hours_since_last_break += drive_chunk
            window_used += drive_chunk
            cycle_hours_used += drive_chunk
            miles_since_last_fuel += miles_this_chunk
            remaining_miles -= miles_this_chunk

            if not pickup_done:
                leg1_remaining -= drive_chunk
                leg1_miles_remaining -= miles_this_chunk

                if leg1_remaining <= 0:
                    pickup_done = True
                    remaining_driving -= (drive_chunk + leg1_remaining)
                    stops.append({
                        'type': 'pickup',
                        'label': 'Pickup location',
                        'location': pickup_location,
                        'arrival_time': current_time.strftime('%Y-%m-%d %H:%M'),
                        'notes': f'1 hour for loading. Back on road at {(current_time + timedelta(hours=1)).strftime("%H:%M")}'
                    })
                    current_time += timedelta(hours=PICKUP_DROPOFF_HOURS)
                    window_used += PICKUP_DROPOFF_HOURS
                    cycle_hours_used += PICKUP_DROPOFF_HOURS
                    remaining_driving = leg2_hours
            else:
                remaining_driving -= drive_chunk

            # made it to the dropoff!
            if remaining_driving <= 0:
                stops.append({
                    'type': 'dropoff',
                    'label': 'Dropoff location',
                    'location': dropoff_location,
                    'arrival_time': current_time.strftime('%Y-%m-%d %H:%M'),
                    'notes': '1 hour for unloading. Trip complete!'
                })
                current_time += timedelta(hours=PICKUP_DROPOFF_HOURS)
                break

            # ran out of drive time for today
            if hours_driven_this_day >= MAX_DRIVING_HOURS or window_used >= MAX_WINDOW_HOURS:
                break

        # end of day — mandatory 10hr rest before driving again
        if remaining_driving > 0:
            rest_start = current_time
            rest_end = current_time + timedelta(hours=REQUIRED_REST_HOURS)
            stops.append({
                'type': 'rest',
                'label': f'Rest stop — night {day_number}',
                'location': 'En route',
                'arrival_time': rest_start.strftime('%Y-%m-%d %H:%M'),
                'notes': f'10-hour mandatory rest. Back driving at {rest_end.strftime("%H:%M")}'
            })

            days.append(build_day_log(
                day_number,
                day_start_time,
                hours_driven_this_day,
                hours_on_duty_today,
                cycle_hours_used
            ))

            current_time = rest_end
            day_number += 1

    # log for the final day
    days.append(build_day_log(
        day_number,
        day_start_time,
        hours_driven_this_day,
        hours_on_duty_today,
        cycle_hours_used
    ))

    return {
        'stops': stops,
        'days': days,
        'total_miles': round(total_miles, 1),
        'total_days': day_number,
        'total_driving_hours': round(total_driving_hours, 1),
        'estimated_arrival': current_time.strftime('%Y-%m-%d %H:%M'),
    }


def build_day_log(day_number, start_time, hours_driven, hours_on_duty, cycle_total):
    """
    builds the data for one day's log sheet —
    the frontend uses this to draw the actual grid on canvas
    """
    off_duty_hours = 24 - hours_driven - hours_on_duty

    return {
        'day_number': day_number,
        'date': start_time.strftime('%Y-%m-%d'),
        'off_duty_hours': round(max(off_duty_hours, 0), 2),
        'driving_hours': round(hours_driven, 2),
        'on_duty_hours': round(hours_on_duty, 2),
        'total_hours': 24,
        'cycle_hours_used': round(cycle_total, 1),
        'grid': build_grid_segments(start_time, hours_driven, hours_on_duty),
    }


def build_grid_segments(start_time, hours_driven, hours_on_duty):
    """
    builds the segments for the 24hr grid on the log sheet
    each segment has a status and start/end hour so the canvas knows what to draw
    """
    segments = []
    current_hour = 0

    # pre-trip inspection first (30 mins on duty)
    segments.append({'status': 'on_duty', 'start': 0, 'end': 0.5})
    current_hour = 0.5

    # main driving block
    drive_end = current_hour + hours_driven
    segments.append({'status': 'driving', 'start': current_hour, 'end': min(drive_end, 24)})
    current_hour = min(drive_end, 24)

    # post-trip paperwork (30 mins on duty)
    if current_hour + 0.5 <= 24:
        segments.append({'status': 'on_duty', 'start': current_hour, 'end': current_hour + 0.5})
        current_hour += 0.5

    # rest of the day is off duty
    if current_hour < 24:
        segments.append({'status': 'off_duty', 'start': current_hour, 'end': 24})

    return segments