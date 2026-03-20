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
    """Hour of day — decimal hours since midnight of dt's calendar date."""
    base = dt.replace(hour=0, minute=0, second=0, microsecond=0)
    return (dt - base).total_seconds() / 3600


def plan_trip(current_location, pickup_location, dropoff_location,
              cycle_used_hours, route_data, start_time_str=None):

    leg1_miles = route_data['leg1_miles']
    leg1_hours = route_data['leg1_hours']
    leg2_miles = route_data['leg2_miles']
    leg2_hours = route_data['leg2_hours']

    total_miles          = leg1_miles + leg2_miles
    total_driving_hours  = leg1_hours + leg2_hours

    if start_time_str:
        try:
            current_time = datetime.strptime(start_time_str, '%Y-%m-%dT%H:%M')
        except Exception:
            current_time = datetime.now().replace(minute=0, second=0, microsecond=0)
    else:
        current_time = datetime.now().replace(minute=0, second=0, microsecond=0)

    stops             = []
    days              = []
    cycle_hours_used  = float(cycle_used_hours)
    day_number        = 1
    remaining_driving = total_driving_hours
    remaining_miles   = total_miles
    pickup_done       = False
    leg1_remaining    = leg1_hours
    leg1_miles_rem    = leg1_miles

    stops.append({
        'type':         'start',
        'label':        'Starting point',
        'location':     current_location,
        'arrival_time': current_time.strftime('%Y-%m-%d %H:%M'),
        'notes':        f'Trip begins. {round(MAX_CYCLE_HOURS - cycle_hours_used, 1)} hrs left in 70-hr cycle.'
    })

    while remaining_driving > 0:
        # ── record exactly where this calendar day starts ──────────────
        day_date          = current_time.date()
        day_start_time    = current_time          # real datetime of shift start
        day_midnight      = datetime.combine(day_date, datetime.min.time())

        hours_driven_day  = 0.0
        hours_on_duty_day = 0.0
        hours_since_break = 0.0
        window_used       = 0.0
        miles_since_fuel  = 0.0

        # raw events list — (status, abs_start_dt, abs_end_dt)
        # we will slice these to the calendar day at the end
        raw_events = []

        def rec(status, start_dt, end_dt):
            """Record a raw event with absolute datetimes."""
            if end_dt > start_dt:
                raw_events.append((status, start_dt, end_dt))

        # off duty from midnight to shift start (driver was sleeping)
        if hod(current_time) > 0.001:
            rec('off_duty', day_midnight, current_time)

        # pre-trip inspection — 30 min on duty
        t = current_time
        current_time      += timedelta(minutes=30)
        window_used       += 0.5
        hours_on_duty_day += 0.5
        cycle_hours_used  += 0.5
        rec('on_duty', t, current_time)

        # ── main driving loop for this day ─────────────────────────────
        while remaining_driving > 0 and window_used < MAX_WINDOW_HOURS:

            # mandatory 30-min break after 8 cumulative driving hours
            if hours_since_break >= BREAK_AFTER_HOURS:
                t = current_time
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
                rec('on_duty', t, current_time)

            # fuel stop every 1000 miles
            if miles_since_fuel >= FUEL_STOP_EVERY_MILES:
                t = current_time
                stops.append({
                    'type':         'fuel',
                    'label':        'Fuel stop',
                    'location':     'En route',
                    'arrival_time': current_time.strftime('%Y-%m-%d %H:%M'),
                    'notes':        f'Fueling — {round(remaining_miles)} miles left. '
                                    f'Back at {(current_time + timedelta(minutes=30)).strftime("%I:%M %p")}'
                })
                current_time      += timedelta(minutes=30)
                window_used       += 0.5
                cycle_hours_used  += 0.5
                hours_on_duty_day += 0.5
                miles_since_fuel   = 0.0
                rec('on_duty', t, current_time)

            # 70-hr cycle limit
            if cycle_hours_used >= MAX_CYCLE_HOURS:
                stops.append({
                    'type':         'cycle_rest',
                    'label':        '34-hr restart required',
                    'location':     'En route',
                    'arrival_time': current_time.strftime('%Y-%m-%d %H:%M'),
                    'notes':        f'Hit 70-hr limit. Resting 34 hrs. '
                                    f'Back {(current_time + timedelta(hours=34)).strftime("%b %d %I:%M %p")}'
                })
                rec('off_duty', current_time,
                    current_time + timedelta(hours=34))
                current_time      += timedelta(hours=34)
                cycle_hours_used   = 0.0
                hours_since_break  = 0.0
                break

            # biggest safe driving chunk right now
            hours_till_break = BREAK_AFTER_HOURS - hours_since_break
            hours_left_day   = MAX_DRIVING_HOURS  - hours_driven_day
            window_left      = MAX_WINDOW_HOURS   - window_used

            if not pickup_done and leg1_remaining > 0:
                chunk = min(leg1_remaining, hours_till_break,
                            hours_left_day, window_left)
            else:
                chunk = min(remaining_driving, hours_till_break,
                            hours_left_day, window_left)

            if chunk <= 0:
                break

            # drive
            t = current_time
            miles_chunk        = chunk * AVERAGE_SPEED_MPH
            current_time      += timedelta(hours=chunk)
            hours_driven_day  += chunk
            hours_since_break += chunk
            window_used       += chunk
            cycle_hours_used  += chunk
            miles_since_fuel  += miles_chunk
            remaining_miles   -= miles_chunk
            rec('driving', t, current_time)

            if not pickup_done:
                leg1_remaining -= chunk
                leg1_miles_rem -= miles_chunk
                if leg1_remaining <= 0:
                    pickup_done        = True
                    remaining_driving -= (chunk + leg1_remaining)
                    t = current_time
                    stops.append({
                        'type':         'pickup',
                        'label':        'Pickup location',
                        'location':     pickup_location,
                        'arrival_time': current_time.strftime('%Y-%m-%d %H:%M'),
                        'notes':        f'1 hr loading. Departing {(current_time + timedelta(hours=1)).strftime("%I:%M %p")}'
                    })
                    current_time      += timedelta(hours=PICKUP_DROPOFF_HOURS)
                    window_used       += PICKUP_DROPOFF_HOURS
                    cycle_hours_used  += PICKUP_DROPOFF_HOURS
                    hours_on_duty_day += PICKUP_DROPOFF_HOURS
                    remaining_driving  = leg2_hours
                    rec('on_duty', t, current_time)
            else:
                remaining_driving -= chunk

            # reached dropoff
            if remaining_driving <= 0:
                t = current_time
                stops.append({
                    'type':         'dropoff',
                    'label':        'Dropoff location',
                    'location':     dropoff_location,
                    'arrival_time': current_time.strftime('%Y-%m-%d %H:%M'),
                    'notes':        '1 hr unloading. Trip complete!'
                })
                current_time      += timedelta(hours=PICKUP_DROPOFF_HOURS)
                hours_on_duty_day += PICKUP_DROPOFF_HOURS
                rec('on_duty', t, current_time)
                break

            if (hours_driven_day  >= MAX_DRIVING_HOURS or
                    window_used   >= MAX_WINDOW_HOURS):
                break

        # ── end of driving window ──────────────────────────────────────
        if remaining_driving > 0:
            rest_start = current_time
            rest_end   = current_time + timedelta(hours=REQUIRED_REST_HOURS)
            stops.append({
                'type':         'rest',
                'label':        f'Rest stop — night {day_number}',
                'location':     'En route',
                'arrival_time': rest_start.strftime('%Y-%m-%d %H:%M'),
                'notes':        f'10-hr mandatory rest. Resume at {rest_end.strftime("%I:%M %p")}'
            })
            rec('off_duty', rest_start, rest_end)
            current_time = rest_end

        # ── slice raw_events to THIS calendar day only ──────────────────
        # day spans day_midnight .. day_midnight+24h
        day_end = day_midnight + timedelta(hours=24)
        grid = build_grid_from_events(raw_events, day_midnight, day_end)

        days.append({
            'day_number':       day_number,
            'date':             day_date.strftime('%Y-%m-%d'),
            'driving_hours':    round(hours_driven_day,  2),
            'on_duty_hours':    round(hours_on_duty_day, 2),
            'off_duty_hours':   round(max(24 - hours_driven_day - hours_on_duty_day, 0), 2),
            'total_hours':      24,
            'cycle_hours_used': round(cycle_hours_used, 1),
            'shift_start_hour': hod(day_start_time),
            'grid':             grid,
        })

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
    Takes a list of (status, abs_start_dt, abs_end_dt) tuples,
    clips each to [day_start_dt, day_end_dt], converts to decimal
    hours 0-24, fills gaps as off_duty, merges adjacent same-status.
    Always returns segments that sum to exactly 24.0 hours.
    """
    day_seconds = 24 * 3600

    # clip each event to this calendar day and convert to decimal hours
    clipped = []
    for status, s, e in raw_events:
        cs = max(s, day_start_dt)
        ce = min(e, day_end_dt)
        if ce > cs:
            sh = (cs - day_start_dt).total_seconds() / 3600
            eh = (ce - day_start_dt).total_seconds() / 3600
            clipped.append({'status': status,
                            'start':  round(sh, 4),
                            'end':    round(eh, 4)})

    # sort by start
    clipped.sort(key=lambda x: x['start'])

    segs = []

    # fill from 0 to first event
    if not clipped or clipped[0]['start'] > 0.001:
        segs.append({'status': 'off_duty', 'start': 0.0,
                     'end': clipped[0]['start'] if clipped else 24.0})

    for ev in clipped:
        s, e = ev['start'], ev['end']
        # fill any gap
        if segs and segs[-1]['end'] < s - 0.001:
            segs.append({'status': 'off_duty',
                         'start': round(segs[-1]['end'], 4),
                         'end':   round(s, 4)})
        segs.append({'status': ev['status'],
                     'start':  round(s, 4),
                     'end':    round(e, 4)})

    # fill tail to 24
    if segs and segs[-1]['end'] < 23.999:
        segs.append({'status': 'off_duty',
                     'start': round(segs[-1]['end'], 4),
                     'end':   24.0})

    if not segs:
        return [{'status': 'off_duty', 'start': 0.0, 'end': 24.0}]

    # merge adjacent same-status
    merged = []
    for seg in segs:
        if (merged and
                merged[-1]['status'] == seg['status'] and
                abs(merged[-1]['end'] - seg['start']) < 0.01):
            merged[-1]['end'] = seg['end']
        else:
            merged.append(dict(seg))

    # force last segment to end at exactly 24.0
    if merged:
        merged[-1]['end'] = 24.0

    return merged