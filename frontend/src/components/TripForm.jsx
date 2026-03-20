import { useState, useEffect, useRef, useCallback } from 'react'

const dropdownBus = new EventTarget()

async function searchPlaces(query) {
  if (query.length < 2) return []
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&countrycodes=us&limit=6&addressdetails=1`,
      { headers: { 'User-Agent': 'ELD-Trip-Planner/1.0' } }
    )
    const data = await res.json()
    return data.map(d => {
      const parts = d.display_name.split(',').map(s => s.trim())
      const city  = parts[0]
      const state = parts.find(p => /^[A-Z]{2}$/.test(p)) || ''
      return { label: state ? `${city}, ${state}` : parts.slice(0, 2).join(', ') }
    })
  } catch { return [] }
}

function LocationInput({ id, label, value, onChange, placeholder, icon }) {
  const [query, setQuery]         = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen]           = useState(false)
  const [focused, setFocused]     = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const timer      = useRef(null)
  const wrapRef    = useRef(null)
  const inputRef   = useRef(null)
  const justPicked = useRef(false)

  useEffect(() => { if (!value) setQuery('') }, [value])

  useEffect(() => {
    const handler = (e) => { if (e.detail.activeId !== id) { setOpen(false); setActiveIdx(-1) } }
    dropdownBus.addEventListener('focus', handler)
    return () => dropdownBus.removeEventListener('focus', handler)
  }, [id])

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (justPicked.current) { justPicked.current = false; return }
    clearTimeout(timer.current)
    if (query.length < 2) { setSuggestions([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      const results = await searchPlaces(query)
      setSuggestions(results)
      if (document.activeElement === inputRef.current) setOpen(results.length > 0)
      setActiveIdx(-1)
    }, 380)
    return () => clearTimeout(timer.current)
  }, [query])

  const pick = useCallback((s) => {
    justPicked.current = true
    setQuery(s.label); onChange(s.label)
    setOpen(false); setSuggestions([]); setActiveIdx(-1)
    setTimeout(() => inputRef.current?.blur(), 10)
  }, [onChange])

  const handleFocus = () => {
    setFocused(true)
    dropdownBus.dispatchEvent(new CustomEvent('focus', { detail: { activeId: id } }))
    if (!justPicked.current && query.length >= 2 && suggestions.length > 0) setOpen(true)
  }
  const handleBlur = () => {
    setFocused(false)
    setTimeout(() => { if (!wrapRef.current?.contains(document.activeElement)) setOpen(false) }, 150)
  }
  const handleKeyDown = (e) => {
    if (!open) return
    if (e.key === 'ArrowDown')                    { e.preventDefault(); setActiveIdx(i => Math.min(i+1, suggestions.length-1)) }
    else if (e.key === 'ArrowUp')                 { e.preventDefault(); setActiveIdx(i => Math.max(i-1, 0)) }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); pick(suggestions[activeIdx]) }
    else if (e.key === 'Escape')                  { setOpen(false); setActiveIdx(-1) }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', marginBottom: '6px' }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '5px', fontFamily: 'var(--font-display)' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', pointerEvents: 'none' }}>{icon}</span>
        <input
          id={id} ref={inputRef} value={query}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value) }}
          onFocus={handleFocus} onBlur={handleBlur} onKeyDown={handleKeyDown}
          placeholder={placeholder} autoComplete="off" spellCheck={false}
          style={{ width: '100%', padding: '11px 34px 11px 34px', background: 'var(--navy)', border: `1.5px solid ${focused ? 'var(--accent)' : 'var(--navy-border)'}`, borderRadius: '8px', color: 'var(--text)', fontSize: '13px', fontFamily: 'var(--font-body)', outline: 'none', transition: 'border-color 0.2s' }}
        />
        {query.length > 0 && (
          <button type="button" onMouseDown={e => { e.preventDefault(); justPicked.current = false; setQuery(''); onChange(''); setSuggestions([]); setOpen(false); inputRef.current?.focus() }} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '2px 4px', opacity: 0.6 }}>×</button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#1e2d42', border: '1.5px solid var(--navy-border)', borderRadius: '10px', overflow: 'hidden', zIndex: 9999, boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
          {suggestions.map((s, i) => (
            <div key={i} onMouseDown={e => { e.preventDefault(); pick(s) }}
              style={{ padding: '10px 14px', fontSize: '13px', color: i === activeIdx ? '#151f2e' : 'var(--text)', background: i === activeIdx ? 'var(--accent)' : 'transparent', cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? '1px solid var(--navy-border)' : 'none', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.1s, color 0.1s' }}
              onMouseEnter={e => { setActiveIdx(i); e.currentTarget.style.background = 'rgba(79,195,247,0.15)'; e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => { if (i !== activeIdx) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text)' } }}
            >
              <span style={{ opacity: 0.45, fontSize: '12px', flexShrink: 0 }}>📍</span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TripForm({ onSubmit, loading }) {
  const [form, setForm] = useState({
    current_location: '',
    pickup_location:  '',
    dropoff_location: '',
    cycle_used_hours: 0,
  })

  const pct         = (form.cycle_used_hours / 70) * 100
  const sliderColor = pct > 85 ? '#ff5252' : pct > 60 ? '#ffab40' : 'var(--accent)'

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.current_location || !form.pickup_location || !form.dropoff_location) return
    onSubmit({ ...form })
  }

  return (
    <form onSubmit={handleSubmit}>
      <LocationInput id="loc-current" label="CURRENT LOCATION" icon="🚛" value={form.current_location} onChange={v => setForm(f => ({ ...f, current_location: v }))} placeholder="e.g. Chicago, IL" />
      <div style={{ marginLeft: '15px', height: '12px', borderLeft: '2px dashed var(--navy-border)' }} />
      <LocationInput id="loc-pickup" label="PICKUP LOCATION" icon="📦" value={form.pickup_location} onChange={v => setForm(f => ({ ...f, pickup_location: v }))} placeholder="e.g. Denver, CO" />
      <div style={{ marginLeft: '15px', height: '12px', borderLeft: '2px dashed var(--navy-border)' }} />
      <LocationInput id="loc-dropoff" label="DROPOFF LOCATION" icon="✅" value={form.dropoff_location} onChange={v => setForm(f => ({ ...f, dropoff_location: v }))} placeholder="e.g. Nashville, TN" />

      <div style={{ marginTop: '18px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
          <label style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>HOURS DRIVEN THIS WEEK</label>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: sliderColor }}>
            {form.cycle_used_hours}<span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '11px' }}> / 70 hrs</span>
          </span>
        </div>
        <input type="range" min={0} max={69.5} step={0.5} value={form.cycle_used_hours} onChange={e => setForm(f => ({ ...f, cycle_used_hours: parseFloat(e.target.value) }))} style={{ width: '100%', accentColor: sliderColor, cursor: 'pointer' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>0 hrs</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>35 hrs</span>
          <span style={{ fontSize: '10px', color: pct > 85 ? '#ff5252' : 'var(--text-muted)' }}>{pct > 85 ? '⚠ Near limit!' : '70 hr max'}</span>
        </div>
        <div style={{ marginTop: '6px', height: '4px', borderRadius: '2px', background: 'var(--navy)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: sliderColor, borderRadius: '2px', transition: 'width 0.3s, background 0.3s' }} />
        </div>
        <div style={{ marginTop: '8px', padding: '8px 10px', background: 'var(--navy)', borderRadius: '7px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          ℹ️ Total hours on duty in the last 7 days. FMCSA limits drivers to 70 hrs — after that a 34-hr restart is required.
        </div>
      </div>

      <button type="submit" disabled={loading}
        style={{ width: '100%', padding: '13px', background: loading ? 'var(--navy-border)' : 'var(--accent)', color: loading ? 'var(--text-muted)' : '#151f2e', border: 'none', borderRadius: '8px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', letterSpacing: '0.06em', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
        onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#81d4fa' }}
        onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'var(--accent)' }}
      >
        {loading ? 'PLANNING...' : 'PLAN TRIP →'}
      </button>
    </form>
  )
}