from datetime import datetime, timedelta

AVERAGE_SPEED_MPH     = 55
MAX_DRIVING_HOURS     = 11
MAX_WINDOW_HOURS      = 14
REQUIRED_REST_HOURS   = 10
BREAK_AFTER_HOURS     = 8
MAX_CYCLE_HOURS       = 70
FUEL_STOP_EVERY_MILES = 1000
PICKUP_DROPOFF_HOURS  = 1


def hod(dt):
    base = dt.replace(hour=0, minute=0, second=0, microsecond=0)
    return (dt - base).total_seconds() / 3600


def round15(hours):
    return round(hours * 4) / 4


def floor15(hours):
    import math
    return math.floor(hours * 4) / 4


def make_day_log(day_number, date, driving, on_duty, cycle, grid):
    return {
        'day_number':       day_number,
        'date':             date.strftime('%Y-%m-%d') if hasattr(date, 'strftime') else date,
        'driving_hours':    round(driving, 2),
        'on_duty_hours':    round(on_duty, 2),
        'off_duty_hours':   round(max(24 - driving - on_duty, 0), 2),
        'total_hours':      24,
        'cycle_hours_used': round(min(cycle, MAX_CYCLE_HOURS), 1),
        'shift_start_hour': 0,
        'grid':             grid,
    }


def record_event(events, status, start_dt, end_dt):
    """Append a timed event to the events list. Standalone function avoids closure bugs."""
    if end_dt > start_dt:
        events.append((status, start_dt, end_dt))


def plan_trip(current_location, pickup_location, dropoff_location,
              cycle_used_hours, route_data, start_time_str=None):

    leg1_miles = route_data['leg1_miles']
    leg2_miles = route_data['leg2_miles']
    leg1_hours = round15(route_data['leg1_hours'])
    leg2_hours = round15(route_data['leg2_hours'])

    total_miles         = leg1_miles + leg2_miles
    total_driving_hours = leg1_hours + leg2_hours

    if start_time_str:
        try:
            current_time = datetime.strptime(start_time_str, '%Y-%m-%dT%H:%M')
        except Exception:
            current_time = datetime.now().replace(minute=0, second=0, microsecond=0)
    else:
        current_time = datetime.now().replace(minute=0, second=0, microsecond=0)

    stops            = []
    days             = []
    cycle_hours_used = float(cycle_used_hours)
    day_number       = 1
    remaining_driving = total_driving_hours
    remaining_miles   = total_miles
    pickup_done       = False
    leg1_remaining    = leg1_hours
    miles_since_fuel  = 0.0  # tracks miles driven since last fuel stop

    stops.append({
        'type':         'start',
        'label':        'Starting point',
        'location':     current_location,
        'arrival_time': current_time.strftime('%Y-%m-%d %H:%M'),
        'notes':        f'Trip begins. {round(MAX_CYCLE_HOURS - cycle_hours_used, 1)} hrs left in 70-hr cycle.'
    })

    while remaining_driving > 0:
        day_date     = current_time.date()
        day_midnight = datetime.combine(day_date, datetime.min.time())

        hours_driven_day  = 0.0
        hours_on_duty_day = 0.0
        hours_since_break = 0.0
        window_used       = 0.0
        raw_events        = []   # fresh list per day — avoids closure capture bug

        # midnight → shift start block (off duty or sleeper before driver wakes)
        if hod(current_time) > 0.001:
            rest_status = 'off_duty' if day_number == 1 else 'sleeper'
            record_event(raw_events, rest_status, day_midnight, current_time)

        # pre-trip inspection: 30 min on duty, not driving — required every shift
        pretrip_start = current_time
        stops.append({
            'type':         'pre_trip',
            'label':        'Pre-trip inspection',
            'location':     current_location if day_number == 1 else 'En route',
            'arrival_time': pretrip_start.strftime('%Y-%m-%d %H:%M'),
            'notes':        f'30-min pre-trip inspection (on duty, not driving). '
                            f'Departs at {(pretrip_start + timedelta(minutes=30)).strftime("%I:%M %p")}.'
        })
        current_time      += timedelta(minutes=30)
        window_used       += 0.5
        hours_on_duty_day += 0.5
        cycle_hours_used  += 0.5
        record_event(raw_events, 'on_duty', pretrip_start, current_time)

        had_34hr_restart = False

        while remaining_driving > 0 and window_used < MAX_WINDOW_HOURS:

            # check 70-hr cycle limit before every driving chunk
            if cycle_hours_used >= MAX_CYCLE_HOURS:
                restart_start    = current_time
                restart_end      = restart_start + timedelta(hours=34)
                day_end_midnight = day_midnight + timedelta(days=1)

                stops.append({
                    'type':         'cycle_rest',
                    'label':        '34-hr restart required',
                    'location':     'En route',
                    'arrival_time': restart_start.strftime('%Y-%m-%d %H:%M'),
                    'notes':        f'Hit 70-hr limit. Off duty 34 hrs. '
                                    f'Back {restart_end.strftime("%b %d %I:%M %p")}'
                })

                # record off duty from now until end of the current calendar day
                record_event(raw_events, 'off_duty', restart_start,
                             min(restart_end, day_end_midnight))

                # save current partial day
                grid = build_grid_from_events(raw_events, day_midnight, day_end_midnight)
                days.append(make_day_log(
                    day_number, day_date,
                    hours_driven_day, hours_on_duty_day,
                    cycle_hours_used, grid
                ))
                day_number += 1

                # add full off-duty days during the 34-hr window
                check_date = day_midnight + timedelta(days=1)
                while check_date + timedelta(days=1) <= restart_end:
                    full_grid = [{'status': 'off_duty', 'start': 0.0, 'end': 24.0}]
                    days.append(make_day_log(
                        day_number, check_date.date(),
                        0.0, 0.0, MAX_CYCLE_HOURS, full_grid
                    ))
                    day_number += 1
                    check_date += timedelta(days=1)

                # add the partial last day of the restart window
                if check_date.date() == restart_end.date() and restart_end > check_date:
                    full_grid = [{'status': 'off_duty', 'start': 0.0, 'end': 24.0}]
                    days.append(make_day_log(
                        day_number, check_date.date(),
                        0.0, 0.0, MAX_CYCLE_HOURS, full_grid
                    ))
                    day_number += 1

                # resume at next 8 AM after the restart ends
                resume_8am = restart_end.replace(hour=8, minute=0, second=0, microsecond=0)
                if resume_8am <= restart_end:
                    resume_8am += timedelta(days=1)

                current_time      = resume_8am
                cycle_hours_used  = 0.0
                hours_since_break = 0.0
                had_34hr_restart  = True
                break

            # mandatory 30-min break after 8 cumulative driving hours
            if hours_since_break >= BREAK_AFTER_HOURS:
                break_start = current_time
                stops.append({
                    'type':         'rest_break',
                    'label':        '30-min mandatory break',
                    'location':     'En route',
                    'arrival_time': current_time.strftime('%Y-%m-%d %H:%M'),
                    'notes':        f'Required after {BREAK_AFTER_HOURS}h driving. '
                                    f'Back at {(current_time + timedelta(minutes=30)).strftime("%I:%M %p")}'
                })
                current_time      += timedelta(minutes=30)
                window_used       += 0.5
                cycle_hours_used  += 0.5
                hours_on_duty_day += 0.5
                hours_since_break  = 0.0
                record_event(raw_events, 'on_duty', break_start, current_time)
                continue

            # fuel stop every 1000 miles — only triggered by actual driving miles
            if miles_since_fuel >= FUEL_STOP_EVERY_MILES:
                fuel_start          = current_time
                miles_driven_so_far = total_miles - remaining_miles
                stops.append({
                    'type':         'fuel',
                    'label':        'Fuel stop',
                    'location':     'En route',
                    'arrival_time': current_time.strftime('%Y-%m-%d %H:%M'),
                    'notes':        f'Fueling — {round(remaining_miles)} miles remaining. '
                                    f'Back at {(current_time + timedelta(minutes=30)).strftime("%I:%M %p")}',
                    'miles_marker': round(miles_driven_so_far),
                })
                current_time      += timedelta(minutes=30)
                window_used       += 0.5
                cycle_hours_used  += 0.5
                hours_on_duty_day += 0.5
                miles_since_fuel   = 0.0
                record_event(raw_events, 'on_duty', fuel_start, current_time)
                continue

            # calculate the largest safe driving chunk for this iteration
            hours_till_break = BREAK_AFTER_HOURS - hours_since_break
            hours_left_day   = MAX_DRIVING_HOURS  - hours_driven_day
            window_left      = MAX_WINDOW_HOURS   - window_used
            cycle_left       = MAX_CYCLE_HOURS    - cycle_hours_used

            if not pickup_done and leg1_remaining > 0:
                raw_chunk = min(leg1_remaining, hours_till_break,
                                hours_left_day, window_left, cycle_left)
            else:
                raw_chunk = min(remaining_driving, hours_till_break,
                                hours_left_day, window_left, cycle_left)

            chunk = floor15(raw_chunk)
            if chunk <= 0:
                if raw_chunk >= 0.25:
                    chunk = 0.25
                else:
                    break

            drive_start  = current_time
            miles_chunk  = chunk * AVERAGE_SPEED_MPH
            current_time      += timedelta(hours=chunk)
            hours_driven_day  += chunk
            hours_since_break += chunk
            window_used       += chunk
            cycle_hours_used  += chunk
            miles_since_fuel  += miles_chunk
            remaining_miles   -= miles_chunk
            record_event(raw_events, 'driving', drive_start, current_time)

            if not pickup_done:
                leg1_remaining -= chunk
                if leg1_remaining <= 0.001:
                    # arrived at pickup — any overshoot adjusts leg2
                    overshoot          = max(0.0, -leg1_remaining)
                    pickup_done        = True
                    remaining_driving  = leg2_hours - overshoot

                    pickup_start = current_time
                    stops.append({
                        'type':         'pickup',
                        'label':        'Pickup location',
                        'location':     pickup_location,
                        'arrival_time': current_time.strftime('%Y-%m-%d %H:%M'),
                        'notes':        f'1 hr loading. Departing '
                                        f'{(current_time + timedelta(hours=1)).strftime("%I:%M %p")}'
                    })
                    current_time      += timedelta(hours=PICKUP_DROPOFF_HOURS)
                    window_used       += PICKUP_DROPOFF_HOURS
                    cycle_hours_used  += PICKUP_DROPOFF_HOURS
                    hours_on_duty_day += PICKUP_DROPOFF_HOURS
                    # pickup/dropoff time is on-duty not driving — no miles accumulate
                    record_event(raw_events, 'on_duty', pickup_start, current_time)
            else:
                remaining_driving -= chunk

            # check if we just completed the trip
            if remaining_driving <= 0.001:
                dropoff_start = current_time
                stops.append({
                    'type':         'dropoff',
                    'label':        'Dropoff location',
                    'location':     dropoff_location,
                    'arrival_time': current_time.strftime('%Y-%m-%d %H:%M'),
                    'notes':        '1 hr unloading. Trip complete!'
                })
                current_time      += timedelta(hours=PICKUP_DROPOFF_HOURS)
                hours_on_duty_day += PICKUP_DROPOFF_HOURS
                cycle_hours_used  += PICKUP_DROPOFF_HOURS
                record_event(raw_events, 'on_duty', dropoff_start, current_time)
                remaining_driving = 0
                break

            # hit daily driving or window limit — end the driving day
            if (hours_driven_day >= MAX_DRIVING_HOURS or
                    window_used  >= MAX_WINDOW_HOURS):
                break

        if had_34hr_restart:
            continue

        # end of normal driving day — take 10-hr sleeper berth rest
        if remaining_driving > 0:
            rest_start = current_time
            rest_end   = current_time + timedelta(hours=REQUIRED_REST_HOURS)
            stops.append({
                'type':         'rest',
                'label':        f'Rest stop — night {day_number}',
                'location':     'En route',
                'arrival_time': rest_start.strftime('%Y-%m-%d %H:%M'),
                'notes':        f'10-hr sleeper berth rest. '
                                f'Resume at {rest_end.strftime("%I:%M %p")}'
            })
            record_event(raw_events, 'sleeper', rest_start, rest_end)
            current_time = rest_end

        day_end_dt = day_midnight + timedelta(hours=24)
        grid = build_grid_from_events(raw_events, day_midnight, day_end_dt)

        days.append(make_day_log(
            day_number, day_date,
            hours_driven_day, hours_on_duty_day,
            cycle_hours_used, grid
        ))
        day_number += 1

    return {
        'stops':               stops,
        'days':                days,
        'total_miles':         round(total_miles, 1),
        'total_days':          day_number - 1,
        'total_driving_hours': round(total_driving_hours, 1),
        'estimated_arrival':   current_time.strftime('%Y-%m-%d %H:%M'),
    }


def build_grid_from_events(raw_events, day_start_dt, day_end_dt):
    """
    Convert a list of (status, start_dt, end_dt) events into a clean
    list of {status, start, end} hour-offset segments covering 0–24.
    Gaps between events are filled with off_duty.
    Adjacent same-status segments are merged.
    """
    clipped = []
    for status, s, e in raw_events:
        cs = max(s, day_start_dt)
        ce = min(e, day_end_dt)
        if ce > cs:
            sh = round15((cs - day_start_dt).total_seconds() / 3600)
            eh = round15((ce - day_start_dt).total_seconds() / 3600)
            if eh > sh:
                clipped.append({'status': status, 'start': sh, 'end': eh})

    clipped.sort(key=lambda x: x['start'])
    segs = []

    # fill any gap before the first event with off_duty
    if not clipped or clipped[0]['start'] > 0.0:
        segs.append({
            'status': 'off_duty', 'start': 0.0,
            'end': clipped[0]['start'] if clipped else 24.0
        })

    for ev in clipped:
        s, e = ev['start'], ev['end']
        # fill gaps between events with off_duty
        if segs and segs[-1]['end'] < s - 0.001:
            segs.append({'status': 'off_duty', 'start': segs[-1]['end'], 'end': s})
        segs.append({'status': ev['status'], 'start': s, 'end': e})

    # fill any remaining gap at end of day
    if segs and segs[-1]['end'] < 24.0:
        segs.append({'status': 'off_duty', 'start': segs[-1]['end'], 'end': 24.0})

    if not segs:
        return [{'status': 'off_duty', 'start': 0.0, 'end': 24.0}]

    # merge adjacent segments of the same status
    merged = []
    for seg in segs:
        if (merged and
                merged[-1]['status'] == seg['status'] and
                abs(merged[-1]['end'] - seg['start']) < 0.01):
            merged[-1]['end'] = seg['end']
        else:
            merged.append(dict(seg))

    # always close the day at exactly 24.0
    if merged:
        merged[-1]['end'] = 24.0

    return merged