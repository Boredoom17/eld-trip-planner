from datetime import datetime, timedelta
import math

# FMCSCA HOS rules and related constants 
AVERAGE_SPEED_MPH     = 55
MAX_DRIVING_HOURS     = 11        
MAX_WINDOW_HOURS      = 14       
REQUIRED_REST_HOURS   = 10        
BREAK_AFTER_HOURS     = 8         
BREAK_DURATION        = 0.5       # 30-min break — recorded as OFF DUTY
MAX_CYCLE_HOURS       = 70       
RESTART_HOURS         = 34        
FUEL_STOP_EVERY_MILES = 1000
PICKUP_DROPOFF_HOURS  = 1.0
POSTTRIP_HOURS        = 0.5
PRETRIP_HOURS         = 0.5

# MIN_USEFUL_DRIVE: don't start a shift if there isn't at least this much
# 2.4h of cycle left (barely enough for pretrip + 1.9h drive) will rest
# rather than do a nearly-empty day.
MIN_USEFUL_DRIVE      = 2.0

# On-duty overhead per driving day (for pre-planning).
# Break is OFF DUTY - doesn't count. Only pretrip (0.5h) + occasional fuel (0.5h).
# Using 0.75 as a conservative average.
OVERHEAD_PER_DAY      = 0.75

SHIFT_START_HOUR      = 6


# Helpers 

def hod(dt):
    """Hour-of-day as float 0–24."""
    base = dt.replace(hour=0, minute=0, second=0, microsecond=0)
    return (dt - base).total_seconds() / 3600


def round15(h):
    return round(h * 4) / 4


def floor15(h):
    return math.floor(h * 4) / 4


def next_morning(dt, hour=SHIFT_START_HOUR):
    """Next occurrence of hour:00 strictly after dt."""
    c = dt.replace(hour=hour, minute=0, second=0, microsecond=0)
    if c <= dt:
        c += timedelta(days=1)
    return c


def advance_past_date(current_time, last_date, hour=SHIFT_START_HOUR):
    """
    Ensure current_time is on a calendar date strictly after last_date.
    Prevents duplicate log-sheet dates when 10h rest ends same calendar day.
    """
    while current_time.date() <= last_date:
        current_time = datetime.combine(
            current_time.date() + timedelta(days=1),
            datetime.min.time()
        ).replace(hour=hour)
    return current_time


def make_day_log(day_number, date, driving, on_duty, cycle, grid):
    return {
        'day_number':       day_number,
        'date':             date.strftime('%Y-%m-%d') if hasattr(date, 'strftime') else date,
        'driving_hours':    round15(driving),
        'on_duty_hours':    round15(on_duty),
        'off_duty_hours':   round15(max(24.0 - driving - on_duty, 0.0)),
        'total_hours':      24,
        'cycle_hours_used': round15(min(cycle, MAX_CYCLE_HOURS)),
        'shift_start_hour': 0,
        'grid':             grid,
    }


def record_event(events, status, start_dt, end_dt):
    if end_dt > start_dt:
        events.append((status, start_dt, end_dt))


# Pre-planning: distribute driving hours evenly across days 

def distribute_driving_hours(total_driving, cycle_available):
    """
    Pre-plan driving hours per day.

    Strategy: GREEDY / front-loaded. Fill each day to max (11h) from the
    front. Last day gets the remainder. If the last day < MIN_USEFUL_DRIVE,
    steal from the previous day so the last day reaches MIN_USEFUL_DRIVE.

    This gets the driver to the destination as fast as possible instead of
    spreading hours evenly (which wastes days doing half-shifts).

    On-duty overhead per day: OVERHEAD_PER_DAY (pretrip + occasional fuel).
    Break is OFF DUTY — does NOT count toward overhead or cycle.

    Returns list of per-day targets, each in [MIN_USEFUL_DRIVE, 11h].
    """
    if total_driving <= 0 or cycle_available <= 0:
        return []

    # Cap driving budget to what cycle allows (accounting for daily overhead)
    driving_budget = min(total_driving, cycle_available)
    for _ in range(10):
        days_est = max(1, math.ceil(driving_budget / MAX_DRIVING_HOURS))
        overhead = days_est * OVERHEAD_PER_DAY
        cap = cycle_available - overhead
        if cap <= 0:
            return []
        if driving_budget > cap:
            driving_budget = round15(cap)
        else:
            break

    if driving_budget < MIN_USEFUL_DRIVE:
        return []

    # Greedy fill: each day gets max (11h) until the remainder fits in one day
    targets = []
    remaining = driving_budget
    while remaining > 0:
        chunk = round15(min(remaining, MAX_DRIVING_HOURS))
        if chunk <= 0:
            break
        targets.append(chunk)
        remaining = round15(remaining - chunk)

    # If last day < MIN_USEFUL_DRIVE, move hours from second-to-last to last
    # until last reaches MIN_USEFUL_DRIVE (without letting second-to-last
    # exceed MAX_DRIVING_HOURS)
    if len(targets) > 1 and targets[-1] < MIN_USEFUL_DRIVE:
        needed = round15(MIN_USEFUL_DRIVE - targets[-1])
        room   = round15(MAX_DRIVING_HOURS - targets[-2])
        if room <= 0:
            # Can't give more to prev day — try stealing from it instead
            transfer = min(needed, round15(targets[-2] - MIN_USEFUL_DRIVE))
            if transfer > 0:
                targets[-2] = round15(targets[-2] - transfer)
                targets[-1] = round15(targets[-1] + transfer)
            else:
                # Last resort: drop the tiny last day, prev day absorbs if possible
                frag = targets.pop()
                if targets[-1] + frag <= MAX_DRIVING_HOURS:
                    targets[-1] = round15(targets[-1] + frag)
        else:
            transfer = min(needed, room)
            targets[-2] = round15(targets[-2] - transfer)
            targets[-1] = round15(targets[-1] + transfer)

    return [min(round15(t), MAX_DRIVING_HOURS) for t in targets if t >= MIN_USEFUL_DRIVE]


# Grid builder 

def build_grid_from_events(raw_events, day_start_dt, day_end_dt):
    """
    Convert timed events → 15-min-snapped segments covering 0–24h.
    Gaps → off_duty. Adjacent same-status segments → merged.
    """
    clipped = []
    for status, s, e in raw_events:
        cs = max(s, day_start_dt)
        ce = min(e, day_end_dt)
        if ce > cs:
            sh_min = round((cs - day_start_dt).total_seconds() / 60)
            eh_min = round((ce - day_start_dt).total_seconds() / 60)
            sh_min = round(sh_min / 15) * 15
            eh_min = round(eh_min / 15) * 15
            if eh_min > sh_min:
                clipped.append({'status': status,
                                'start': sh_min / 60.0,
                                'end':   eh_min / 60.0})

    clipped.sort(key=lambda x: x['start'])
    segs = []

    if not clipped or clipped[0]['start'] > 0.0:
        segs.append({'status': 'off_duty', 'start': 0.0,
                     'end': clipped[0]['start'] if clipped else 24.0})

    for ev in clipped:
        s, e = ev['start'], ev['end']
        if segs and segs[-1]['end'] < s - 0.001:
            segs.append({'status': 'off_duty', 'start': segs[-1]['end'], 'end': s})
        segs.append({'status': ev['status'], 'start': s, 'end': e})

    if segs and segs[-1]['end'] < 24.0:
        segs.append({'status': 'off_duty', 'start': segs[-1]['end'], 'end': 24.0})

    if not segs:
        return [{'status': 'off_duty', 'start': 0.0, 'end': 24.0}]

    merged = []
    for seg in segs:
        if (merged
                and merged[-1]['status'] == seg['status']
                and abs(merged[-1]['end'] - seg['start']) < 0.001):
            merged[-1]['end'] = seg['end']
        else:
            merged.append(dict(seg))

    if merged:
        merged[-1]['end'] = 24.0

    return merged


def save_day(days, day_number, day_date, day_midnight, raw_events,
             hours_driven, hours_on_duty, cycle_hours_used):
    day_end_dt = day_midnight + timedelta(hours=24)
    grid = build_grid_from_events(raw_events, day_midnight, day_end_dt)
    days.append(make_day_log(
        day_number, day_date,
        hours_driven, hours_on_duty,
        cycle_hours_used, grid
    ))


# Main trip planner 

def plan_trip(current_location, pickup_location, dropoff_location,
              cycle_used_hours, route_data, start_time_str=None):
    """
    Plan a two-leg trip (current → pickup → dropoff) with full FMCSA HOS compliance.

    Key rules enforced:
    - 11h driving limit per shift 
    - 14h driving window 
    - 30-min break after 8h cumulative driving — recorded as OFF DUTY
    - 10h consecutive rest between shifts
    - 70h/8-day cycle limit with 34h restart
    - Fuel stop every 1000 miles (fired immediately during driving, not next morning)
    """
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

    stops             = []
    days              = []
    cycle_hours_used  = float(cycle_used_hours)
    day_number        = 1
    remaining_driving = total_driving_hours
    remaining_miles   = total_miles
    pickup_done       = False
    leg1_remaining    = leg1_hours
    miles_since_fuel  = 0.0

    # Pre-plan driving targets per day
    cycle_available = MAX_CYCLE_HOURS - cycle_hours_used
    day_targets     = distribute_driving_hours(total_driving_hours, cycle_available)
    day_target_idx  = 0

    stops.append({
        'type':         'start',
        'label':        'Starting point',
        'location':     current_location,
        'arrival_time': current_time.strftime('%Y-%m-%d %H:%M'),
        'notes':        f'Trip begins. {round(MAX_CYCLE_HOURS - cycle_hours_used, 1)}h left in 70-hr cycle.',
    })

    safety = 0
    while remaining_driving > 0.001 and safety < 80:
        safety += 1

        day_date     = current_time.date()
        day_midnight = datetime.combine(day_date, datetime.min.time())

        # Cycle check: enough cycle left to start a meaningful shift? 
        # Must have pretrip (0.5h) + MIN_USEFUL_DRIVE (2.0h) = 2.5h minimum
        cycle_left_now = MAX_CYCLE_HOURS - cycle_hours_used
        if cycle_left_now < PRETRIP_HOURS + MIN_USEFUL_DRIVE:

            restart_start = current_time
            restart_end   = restart_start + timedelta(hours=RESTART_HOURS)

            stops.append({
                'type':         'cycle_rest',
                'label':        '34-hr restart required',
                'location':     'En route',
                'arrival_time': restart_start.strftime('%Y-%m-%d %H:%M'),
                'notes':        (f'70-hr cycle limit reached '
                                 f'({round15(cycle_hours_used)}h used). '
                                 f'Off duty 34 hrs. '
                                 f'Resumes {restart_end.strftime("%b %d at %I:%M %p")}.')
            })

            # Log partial current calendar day (all off-duty)
            raw_events = []
            if hod(restart_start) > 0.001:
                record_event(raw_events, 'off_duty', day_midnight, restart_start)
            day_end = day_midnight + timedelta(hours=24)
            record_event(raw_events, 'off_duty', restart_start, min(restart_end, day_end))
            save_day(days, day_number, day_date, day_midnight, raw_events,
                     0.0, 0.0, cycle_hours_used)
            day_number += 1

            # Compute resume_time first — bound the off-duty loop by resume date
            resume_time = next_morning(restart_end)
            check_date  = day_midnight + timedelta(days=1)
            while check_date.date() < resume_time.date():
                full_grid = [{'status': 'off_duty', 'start': 0.0, 'end': 24.0}]
                days.append(make_day_log(day_number, check_date.date(),
                                         0.0, 0.0, 0.0, full_grid))
                day_number  += 1
                check_date  += timedelta(days=1)

            current_time     = resume_time
            cycle_hours_used = 0.0

            day_targets    = distribute_driving_hours(remaining_driving, MAX_CYCLE_HOURS)
            day_target_idx = 0
            continue

        # Set up driving day 
        hours_driven_day  = 0.0
        hours_on_duty_day = 0.0
        hours_since_break = 0.0
        window_used       = 0.0
        raw_events        = []

        # Midnight → shift start status:
        # - 'off_duty'  : day 1 OR first day after a 34hr restart
        # - 'sleeper'   : normal mid-trip overnight rest
        #
        # cycle_hours_used == 0.0 is ONLY true right after a restart reset.
        if hod(current_time) > 0.001:
            if day_number == 1 or cycle_hours_used == 0.0:
                pre_status = 'off_duty'
            else:
                pre_status = 'sleeper'
            record_event(raw_events, pre_status, day_midnight, current_time)

        # Get today's target driving hours
        if day_target_idx < len(day_targets):
            day_drive_target = min(day_targets[day_target_idx], MAX_DRIVING_HOURS)
        else:
            day_drive_target = min(remaining_driving, MAX_DRIVING_HOURS)
        day_target_idx += 1

        # FIX: cap target to what cycle actually allows after pre-trip
        max_drive_this_cycle = round15(cycle_left_now - PRETRIP_HOURS)
        day_drive_target = min(day_drive_target, max_drive_this_cycle, MAX_DRIVING_HOURS)
        driven_today = 0.0

        # Pre-trip inspection — 30 min ON DUTY (not driving)
        pretrip_start = current_time
        stops.append({
            'type':         'pre_trip',
            'label':        'Pre-trip inspection',
            'location':     current_location if day_number == 1 else 'En route',
            'arrival_time': pretrip_start.strftime('%Y-%m-%d %H:%M'),
            'notes':        (f'30-min pre-trip inspection (on duty, not driving). '
                             f'Departs {(pretrip_start + timedelta(minutes=30)).strftime("%I:%M %p")}.')
        })
        current_time      += timedelta(minutes=30)
        window_used       += PRETRIP_HOURS
        hours_on_duty_day += PRETRIP_HOURS
        cycle_hours_used  += PRETRIP_HOURS          # pre-trip IS on-duty → counts
        record_event(raw_events, 'on_duty', pretrip_start, current_time)

        # Inner driving loop 
        inner_safety = 0
        while remaining_driving > 0.001 and window_used < MAX_WINDOW_HOURS and inner_safety < 60:
            inner_safety += 1

            # 30-min mandatory break after 8h cumulative driving
            # break may be off-duty — does NOT count toward cycle
            if hours_since_break >= BREAK_AFTER_HOURS:
                break_start = current_time
                break_end   = current_time + timedelta(minutes=30)
                stops.append({
                    'type':         'rest_break',
                    'label':        '30-min mandatory break',
                    'location':     'En route',
                    'arrival_time': current_time.strftime('%Y-%m-%d %H:%M'),
                    'notes':        (f'Required after {BREAK_AFTER_HOURS}h cumulative driving. '
                                     f'Back at {break_end.strftime("%I:%M %p")}.')
                })
                record_event(raw_events, 'off_duty', break_start, break_end)
                current_time      += timedelta(minutes=30)
                window_used       += BREAK_DURATION
                hours_since_break  = 0.0
                continue

            # Fuel stop every 1000 miles — fires at start of next inner loop
            # iteration after threshold is crossed during driving.
            if miles_since_fuel >= FUEL_STOP_EVERY_MILES:
                fuel_start = current_time
                fuel_end   = current_time + timedelta(minutes=30)
                stops.append({
                    'type':         'fuel',
                    'label':        'Fuel stop',
                    'location':     'En route',
                    'arrival_time': current_time.strftime('%Y-%m-%d %H:%M'),
                    'notes':        (f'Fueling — {round(remaining_miles)} miles remaining. '
                                     f'Back at {fuel_end.strftime("%I:%M %p")}.'),
                    'miles_marker': round(total_miles - remaining_miles),
                })
                record_event(raw_events, 'on_duty', fuel_start, fuel_end)
                current_time      += timedelta(minutes=30)
                window_used       += 0.5
                cycle_hours_used  += 0.5              # fueling IS on-duty → counts
                hours_on_duty_day += 0.5
                miles_since_fuel   = 0.0
                continue

            # Calculate maximum safe driving chunk for this iteration
            hours_till_break = BREAK_AFTER_HOURS - hours_since_break
            hours_left_day   = day_drive_target - driven_today
            window_left      = MAX_WINDOW_HOURS - window_used
            cycle_left       = MAX_CYCLE_HOURS - cycle_hours_used
            drive_cap_left   = MAX_DRIVING_HOURS - hours_driven_day

            if not pickup_done and leg1_remaining > 0:
                raw_chunk = min(leg1_remaining, hours_till_break, hours_left_day,
                                drive_cap_left, window_left, cycle_left)
            else:
                raw_chunk = min(remaining_driving, hours_till_break, hours_left_day,
                                drive_cap_left, window_left, cycle_left)

            chunk = floor15(raw_chunk)
            if chunk <= 0:
                if raw_chunk >= 0.25:
                    chunk = 0.25
                else:
                    break

            # Drive the chunk
            drive_start = current_time
            miles_chunk = chunk * AVERAGE_SPEED_MPH
            current_time      += timedelta(hours=chunk)
            hours_driven_day  += chunk
            driven_today      += chunk
            hours_since_break += chunk
            window_used       += chunk
            cycle_hours_used  += chunk                # driving IS on-duty → counts
            miles_since_fuel  += miles_chunk
            remaining_miles   -= miles_chunk
            record_event(raw_events, 'driving', drive_start, current_time)

            if not pickup_done:
                leg1_remaining -= chunk
                if leg1_remaining <= 0.001:
                    overshoot         = max(0.0, -leg1_remaining)
                    pickup_done       = True
                    remaining_driving = round15(leg2_hours - overshoot)

                    pickup_start = current_time
                    stops.append({
                        'type':         'pickup',
                        'label':        'Pickup location',
                        'location':     pickup_location,
                        'arrival_time': current_time.strftime('%Y-%m-%d %H:%M'),
                        'notes':        (f'1 hr loading (on duty, not driving). '
                                         f'Departs {(current_time + timedelta(hours=1)).strftime("%I:%M %p")}.')
                    })
                    record_event(raw_events, 'on_duty', pickup_start,
                                 pickup_start + timedelta(hours=PICKUP_DROPOFF_HOURS))
                    current_time      += timedelta(hours=PICKUP_DROPOFF_HOURS)
                    window_used       += PICKUP_DROPOFF_HOURS
                    cycle_hours_used  += PICKUP_DROPOFF_HOURS   # on-duty → counts
                    hours_on_duty_day += PICKUP_DROPOFF_HOURS
            else:
                remaining_driving = round15(remaining_driving - chunk)

            # Trip complete?
            if remaining_driving <= 0.001:
                dropoff_start = current_time
                stops.append({
                    'type':         'dropoff',
                    'label':        'Dropoff location',
                    'location':     dropoff_location,
                    'arrival_time': current_time.strftime('%Y-%m-%d %H:%M'),
                    'notes':        '1 hr unloading (on duty, not driving). Trip complete!'
                })
                record_event(raw_events, 'on_duty', dropoff_start,
                             dropoff_start + timedelta(hours=PICKUP_DROPOFF_HOURS))
                current_time      += timedelta(hours=PICKUP_DROPOFF_HOURS)
                hours_on_duty_day += PICKUP_DROPOFF_HOURS
                cycle_hours_used  += PICKUP_DROPOFF_HOURS

                # Post-trip inspection
                post_start = current_time
                stops.append({
                    'type':         'post_trip',
                    'label':        'Post-trip inspection',
                    'location':     dropoff_location,
                    'arrival_time': post_start.strftime('%Y-%m-%d %H:%M'),
                    'notes':        '30-min post-trip inspection. Driver goes off duty.'
                })
                record_event(raw_events, 'on_duty', post_start,
                             post_start + timedelta(minutes=30))
                current_time      += timedelta(minutes=30)
                hours_on_duty_day += POSTTRIP_HOURS
                cycle_hours_used  += POSTTRIP_HOURS

                remaining_driving = 0
                break

            # End driving day: target reached, window full, or 11h hard cap
            if (driven_today      >= day_drive_target or
                    window_used   >= MAX_WINDOW_HOURS  or
                    hours_driven_day >= MAX_DRIVING_HOURS):
                break

        # End of driving day 
        if remaining_driving > 0.001:

            # Cycle limit hit this shift → start 34hr restart IMMEDIATELY
            # The driver parks the moment they hit 70hrs.
            # 34hr clock starts from that exact moment, not next morning.
            if cycle_hours_used >= MAX_CYCLE_HOURS:
                restart_start = current_time
                restart_end   = restart_start + timedelta(hours=RESTART_HOURS)

                stops.append({
                    'type':         'cycle_rest',
                    'label':        '34-hr restart required',
                    'location':     'En route',
                    'arrival_time': restart_start.strftime('%Y-%m-%d %H:%M'),
                    'notes':        (f'70-hr cycle limit reached ({round15(cycle_hours_used)}h used). '
                                     f'Off duty 34 hrs. '
                                     f'Resumes {restart_end.strftime("%b %d at %I:%M %p")}.')
                })

                # Record off_duty from now to end of today
                day_end = day_midnight + timedelta(hours=24)
                record_event(raw_events, 'off_duty', restart_start, min(restart_end, day_end))

                # Save current day
                save_day(days, day_number, day_date, day_midnight, raw_events,
                         hours_driven_day, hours_on_duty_day, cycle_hours_used)
                day_number += 1

                # Compute resume_time first — bound the off-duty loop by resume date
                resume_time = next_morning(restart_end)
                if days:
                    from datetime import date as _date
                    last_saved = _date.fromisoformat(days[-1]['date'])
                    resume_time = advance_past_date(resume_time, last_saved)
                check_date = day_midnight + timedelta(days=1)
                while check_date.date() < resume_time.date():
                    full_grid = [{'status': 'off_duty', 'start': 0.0, 'end': 24.0}]
                    days.append(make_day_log(day_number, check_date.date(),
                                             0.0, 0.0, 0.0, full_grid))
                    day_number  += 1
                    check_date  += timedelta(days=1)

                current_time     = resume_time
                cycle_hours_used = 0.0

                day_targets    = distribute_driving_hours(remaining_driving, MAX_CYCLE_HOURS)
                day_target_idx = 0
                continue  # skip normal save_day below

            else:
                # Normal 10hr sleeper berth rest
                rest_start = current_time
                rest_end   = current_time + timedelta(hours=REQUIRED_REST_HOURS)

                stops.append({
                    'type':         'rest',
                    'label':        f'10-hr rest — night {day_number}',
                    'location':     'En route',
                    'arrival_time': rest_start.strftime('%Y-%m-%d %H:%M'),
                    'notes':        (f'Mandatory 10-hr sleeper berth rest. '
                                     f'Resumes {rest_end.strftime("%I:%M %p")}.')
                })
                record_event(raw_events, 'sleeper', rest_start, rest_end)

                rest_hod = hod(rest_end)
                if rest_hod < SHIFT_START_HOUR:
                    current_time = rest_end.replace(
                        hour=SHIFT_START_HOUR, minute=0, second=0, microsecond=0)
                    if current_time <= rest_end:
                        current_time += timedelta(days=1)
                else:
                    current_time = rest_end

                current_time = advance_past_date(current_time, day_date)

        save_day(days, day_number, day_date, day_midnight, raw_events,
                 hours_driven_day, hours_on_duty_day, cycle_hours_used)
        day_number += 1

    return {
        'stops':               stops,
        'days':                days,
        'total_miles':         round(total_miles, 1),
        'total_days':          day_number - 1,
        'total_driving_hours': round(total_driving_hours, 1),
        'estimated_arrival':   current_time.strftime('%Y-%m-%d %H:%M'),
    }