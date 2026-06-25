import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../AuthContext'
import { useSessionEvents } from '../hooks/useSessionEvents'

function HpBar({ hp, maxHp }) {
  if (!maxHp) return null;
  const pct = Math.min(100, Math.max(0, (hp / maxHp) * 100));
  const color = pct > 50 ? 'var(--success)' : pct > 25 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div style={{ background: 'var(--border)', borderRadius: 4, height: 8, margin: '0.25rem 0' }}>
      <div style={{ width: `${pct}%`, background: color, borderRadius: 4, height: '100%', transition: 'width 0.3s' }} />
    </div>
  );
}

const CIRCLE_LABELS = ['Truques', '1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º', '9º']

function SpellPanel({ charId, castingType, spellData, locked, onToggleCast, onUpdateSlot, onUseSpell }) {
  const [open, setOpen] = useState(false)
  const isPrepared = castingType === 'prepared'
  const slots = spellData?.slots || []
  const prepared = spellData?.prepared || []
  const known = spellData?.known || []

  const allCircles = [...new Set([
    ...slots.filter(s => s.total_slots > 0).map(s => s.circle),
    ...prepared.map(p => p.circle),
    ...known.map(k => k.circle),
  ])].sort((a, b) => a - b)

  const hasData = allCircles.length > 0
  const isLoaded = spellData !== undefined

  // Summary for header: prepared shows available/cast counts, spontaneous shows slot totals
  const headerSummary = (() => {
    if (!isLoaded || !hasData) return null
    if (isPrepared) {
      const available = prepared.filter(p => !p.is_cast).length
      const cast = prepared.filter(p => p.is_cast).length
      if (prepared.length === 0) return null
      return (
        <span style={{ fontSize: '0.72rem', color: available === 0 ? 'var(--danger)' : 'var(--success)' }}>
          {available} disp · {cast} lanç
        </span>
      )
    } else {
      const activeSlots = slots.filter(s => s.total_slots > 0).slice(0, 4)
      if (activeSlots.length === 0) return null
      return (
        <span style={{ display: 'flex', gap: '0.3rem' }}>
          {activeSlots.map(s => {
            const circleKnown = known.filter(k => k.circle === s.circle)
            const totalUsed = circleKnown.reduce((sum, sp) => sum + (sp.times_cast || 0), 0)
            const rem = Math.max(0, s.total_slots - totalUsed)
            return (
              <span key={s.circle} style={{ fontSize: '0.7rem', color: rem === 0 ? 'var(--danger)' : 'var(--success)' }}>
                {CIRCLE_LABELS[s.circle]}:{rem}
              </span>
            )
          })}
        </span>
      )
    }
  })()

  return (
    <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
      <button
        className="btn-ghost btn-sm"
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>✨ Magias {isPrepared ? '(Preparado)' : '(Espontâneo)'}</span>
        <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {headerSummary}
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && !isLoaded && (
        <p className="text-muted text-sm" style={{ marginTop: '0.5rem' }}>Carregando...</p>
      )}
      {open && isLoaded && !hasData && (
        <p className="text-muted text-sm" style={{ marginTop: '0.5rem' }}>
          Nenhuma magia configurada. <a href={`/characters/${charId}/spells`}>Configurar →</a>
        </p>
      )}
      {open && isLoaded && hasData && (
        <div style={{ marginTop: '0.75rem' }}>
          {isPrepared ? (
            // Prepared caster: show memorized spells with cast toggles
            allCircles.map(circle => {
              const circlePrep = prepared.filter(p => p.circle === circle)
              if (circlePrep.length === 0) return null
              const available = circlePrep.filter(p => !p.is_cast).length
              const cast = circlePrep.filter(p => p.is_cast).length
              return (
                <div key={circle} style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {CIRCLE_LABELS[circle]}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: available === 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {available} disp · {cast} lanç
                    </span>
                  </div>
                  {circlePrep.map(prep => (
                    <div key={prep.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.3rem 0.4rem', marginBottom: '0.2rem', borderRadius: 'var(--radius)',
                      background: prep.is_cast ? 'var(--surface2)' : 'rgba(124,106,247,0.08)',
                      opacity: prep.is_cast ? 0.6 : 1,
                    }}>
                      <span style={{ fontSize: '0.85rem', textDecoration: prep.is_cast ? 'line-through' : 'none' }}>{prep.spell_name}</span>
                      <button
                        className={prep.is_cast ? 'btn-ghost btn-sm' : 'btn-primary btn-sm'}
                        style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem' }}
                        onClick={() => onToggleCast(prep.id, prep.is_cast)}
                      >{prep.is_cast ? '↺' : '✓ Lançar'}</button>
                    </div>
                  ))}
                </div>
              )
            })
          ) : (
            // Spontaneous caster: per-spell cast counters + derived remaining
            allCircles.map(circle => {
              const slot = slots.find(s => s.circle === circle) || { circle, total_slots: 0, used_slots: 0 }
              const circleKnown = known.filter(k => k.circle === circle)
              const totalUsed = circleKnown.reduce((sum, sp) => sum + (sp.times_cast || 0), 0)
              const remaining = Math.max(0, slot.total_slots - totalUsed)
              return (
                <div key={circle} style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {CIRCLE_LABELS[circle]}
                    </span>
                    {circle > 0 && slot.total_slots > 0 && (
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: remaining === 0 ? 'var(--danger)' : remaining <= 1 ? 'var(--warning)' : 'var(--success)' }}>
                        {remaining}/{slot.total_slots} restantes
                      </span>
                    )}
                  </div>
                  {circleKnown.map(spell => {
                    const timeCast = spell.times_cast || 0
                    const canCast = circle === 0 || remaining > 0
                    return (
                      <div key={spell.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.25rem 0.4rem', marginBottom: '0.2rem',
                        fontSize: '0.83rem', borderLeft: `2px solid ${timeCast > 0 ? 'var(--primary)' : 'var(--border)'}`,
                      }}>
                        <span>
                          {spell.name}
                          {timeCast > 0 && <span style={{ marginLeft: '0.35rem', fontSize: '0.7rem', opacity: 0.7 }}>({timeCast}×)</span>}
                        </span>
                        {circle > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <button className="btn-ghost btn-sm" style={{ padding: '0.05rem 0.4rem', fontSize: '0.75rem' }} disabled={timeCast === 0} onClick={() => onUseSpell(spell.id, -1)}>−</button>
                            <span style={{ minWidth: 16, textAlign: 'center', fontWeight: 700, fontSize: '0.78rem' }}>{timeCast}</span>
                            <button className="btn-primary btn-sm" style={{ padding: '0.05rem 0.4rem', fontSize: '0.75rem' }} disabled={!canCast} onClick={() => onUseSpell(spell.id, 1)}>⚡</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export default function SessionLive() {
  const { id } = useParams()
  const { user } = useAuth()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [initInputs, setInitInputs] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [charSpellData, setCharSpellData] = useState({}) // { [charId]: { slots, prepared } }

  async function loadSpells(chars) {
    const results = {}
    await Promise.all(chars.map(async c => {
      try {
        const [slotsRes, prepRes, knownRes] = await Promise.all([
          api.get(`/characters/${c.id}/spell-slots`),
          api.get(`/characters/${c.id}/prepared-spells`),
          api.get(`/characters/${c.id}/spells`),
        ])
        results[c.id] = { slots: slotsRes.data, prepared: prepRes.data, known: knownRes.data }
      } catch (_) {}
    }))
    setCharSpellData(results)
  }

  async function load() {
    try {
      const r = await api.get(`/sessions/${id}`)
      setSession(r.data)
      const mine = r.data.participants.filter(p => p.user_id === user?.id)
      if (mine.length > 0) loadSpells(mine)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [id])

  useSessionEvents(id, (event) => {
    if (event.type === 'spells_updated') {
      // Reload spells for the updated character if it's mine
      const char = session?.participants.find(p => p.id === event.character_id && p.user_id === user?.id)
      if (char) {
        api.get(`/characters/${char.id}/spell-slots`).then(r =>
          setCharSpellData(prev => ({ ...prev, [char.id]: { ...prev[char.id], slots: r.data } }))
        )
        api.get(`/characters/${char.id}/prepared-spells`).then(r =>
          setCharSpellData(prev => ({ ...prev, [char.id]: { ...prev[char.id], prepared: r.data } }))
        )
        api.get(`/characters/${char.id}/spells`).then(r =>
          setCharSpellData(prev => ({ ...prev, [char.id]: { ...prev[char.id], known: r.data } }))
        )
      }
    }
  })

  async function submitInitiative(charId) {
    const val = initInputs[charId]
    if (val === undefined || val === '') return
    setSubmitting(true)
    try {
      await api.post(`/sessions/${id}/my-initiative`, { initiative: Number(val) })
      load()
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleCastInLive(charId, prepId, isCast) {
    await api.patch(`/characters/${charId}/prepared-spells/${prepId}/cast`, {})
    const r = await api.get(`/characters/${charId}/prepared-spells`)
    setCharSpellData(prev => ({ ...prev, [charId]: { ...prev[charId], prepared: r.data } }))
  }

  async function useSpellInLive(charId, spellId, delta) {
    const r = await api.patch(`/characters/${charId}/spells/${spellId}/use`, { delta })
    setCharSpellData(prev => ({
      ...prev,
      [charId]: {
        ...prev[charId],
        known: (prev[charId]?.known || []).map(s => s.id === spellId ? r.data : s),
      },
    }))
  }

  async function updateSlotUsed(charId, circle, delta) {
    const spellData = charSpellData[charId]
    const slot = spellData?.slots.find(s => s.circle === circle) || { circle, total_slots: 0, used_slots: 0 }
    const newUsed = Math.max(0, Math.min(slot.total_slots, (slot.used_slots || 0) + delta))
    await api.put(`/characters/${charId}/spell-slots`, { circle, total_slots: slot.total_slots, used_slots: newUsed })
    setCharSpellData(prev => ({
      ...prev,
      [charId]: { ...prev[charId], slots: (prev[charId]?.slots || []).map(s => s.circle === circle ? { ...s, used_slots: newUsed } : s) }
    }))
  }

  if (loading) return <div className="page"><div className="spinner" /></div>
  if (!session) return <div className="page"><p className="text-muted">Sessão não encontrada.</p></div>

  const myChars = session.participants.filter(p => p.user_id === user?.id)
  const others = session.participants.filter(p => p.user_id !== user?.id)
  const locked = session?.spells_locked === 1

  return (
    <div className="page">
      <div className="mb-3">
        <Link to="/sessions" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>← Minhas Sessões</Link>
      </div>

      <div className="page-header">
        <div>
          <h1>{session.name}</h1>
          {session.campaign_name && <p className="text-muted text-sm">{session.campaign_name}</p>}
        </div>
        <div className="flex gap-2 items-center">
          <span className="badge badge-green" style={{ fontSize: '0.9rem', padding: '0.35rem 0.9rem' }}>🔴 Ao Vivo</span>
          <button className="btn-ghost btn-sm" onClick={load}>↻ Atualizar</button>
        </div>
      </div>

      {myChars.length === 0 && (
        <div className="card text-muted text-sm">Você não tem personagens nesta sessão.</div>
      )}

      {myChars.map(char => (
        <div key={char.id} className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--primary)' }}>
          <div className="page-header" style={{ marginBottom: '0.75rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>{char.name}</h2>
              <p className="text-muted text-sm">{char.class || ''}{char.class ? ' • ' : ''}Nível {char.level}</p>
            </div>
            <Link to={`/characters/${char.id}`} className="btn-ghost btn-sm">Ver Ficha</Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px,1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
            <div className="card" style={{ textAlign: 'center', padding: '0.5rem' }}>
              <div className="text-muted text-sm">HP</div>
              <div style={{ fontWeight: 700 }}>{char.hp}/{char.max_hp}</div>
              <HpBar hp={char.hp} maxHp={char.max_hp} />
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '0.5rem' }}>
              <div className="text-muted text-sm">CA</div>
              <div style={{ fontWeight: 700 }}>{char.ac}</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '0.5rem' }}>
              <div className="text-muted text-sm">XP</div>
              <div style={{ fontWeight: 700 }}>{char.total_xp.toLocaleString('pt-BR')}</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '0.5rem' }}>
              <div className="text-muted text-sm">Iniciativa</div>
              <div style={{ fontWeight: 700 }}>{char.encounter_initiative ?? '—'}</div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
            <p className="text-muted text-sm" style={{ marginBottom: '0.5rem' }}>
              Informe sua iniciativa {char.init_bonus !== 0 && `(bônus de iniciativa: ${char.init_bonus >= 0 ? '+' : ''}${char.init_bonus})`}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="number"
                placeholder="Ex: 14"
                value={initInputs[char.id] ?? ''}
                onChange={e => setInitInputs(v => ({ ...v, [char.id]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') submitInitiative(char.id) }}
                style={{ width: 90, fontSize: '1rem', padding: '0.4rem 0.6rem' }}
              />
              <button
                className="btn-primary"
                onClick={() => submitInitiative(char.id)}
                disabled={submitting || initInputs[char.id] === undefined || initInputs[char.id] === ''}
              >
                Confirmar
              </button>
            </div>
          </div>

          {char.uses_magic === 1 && (
            <SpellPanel
              charId={char.id}
              castingType={char.casting_type}
              spellData={charSpellData[char.id]}
              locked={locked}
              onToggleCast={(prepId, isCast) => toggleCastInLive(char.id, prepId, isCast)}
              onUpdateSlot={(circle, delta) => updateSlotUsed(char.id, circle, delta)}
              onUseSpell={(spellId, delta) => useSpellInLive(char.id, spellId, delta)}
            />
          )}
        </div>
      ))}

      {others.length > 0 && (
        <>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '1.5rem 0 0.75rem' }}>Outros Participantes</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: '0.75rem' }}>
            {others.map(p => (
              <div key={p.id} className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600 }}>⚔️ {p.name}</div>
                <div className="text-muted text-sm">{p.class ? `${p.class} • ` : ''}Nv {p.level}</div>
                {session.show_hp_to_players === 1 && (
                  <>
                    <div className="text-muted text-sm" style={{ marginTop: '0.25rem' }}>
                      HP: <strong>{p.hp}/{p.max_hp}</strong>
                    </div>
                    <HpBar hp={p.hp} maxHp={p.max_hp} />
                  </>
                )}
                {p.encounter_initiative != null && (
                  <div className="text-muted text-sm" style={{ marginTop: '0.25rem' }}>
                    Inic: <strong>{p.encounter_initiative}</strong>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
