import { useEffect, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../AuthContext'

function HpBar({ hp, maxHp }) {
  if (!maxHp) return null;
  const pct = Math.min(100, Math.max(0, (hp / maxHp) * 100));
  const color = pct > 50 ? 'var(--success)' : pct > 25 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div style={{ background: 'var(--border)', borderRadius: 4, height: 6, margin: '0.25rem 0' }}>
      <div style={{ width: `${pct}%`, background: color, borderRadius: 4, height: '100%', transition: 'width 0.3s' }} />
    </div>
  );
}

const EFFECT_TYPE_LABELS = { magia: 'Magia', condicao: 'Condição', buff: 'Buff', debuff: 'Debuff', other: 'Outro' };

function EffectBadge({ type }) {
  if (type === 'magia') return <span className="badge badge-purple">{EFFECT_TYPE_LABELS[type]}</span>;
  if (type === 'condicao') return <span className="badge badge-yellow">{EFFECT_TYPE_LABELS[type]}</span>;
  if (type === 'buff') return <span className="badge badge-green">{EFFECT_TYPE_LABELS[type]}</span>;
  if (type === 'debuff') return <span className="badge" style={{ color: 'var(--danger)', background: '#fde8e8' }}>{EFFECT_TYPE_LABELS[type]}</span>;
  return <span className="badge">{EFFECT_TYPE_LABELS[type] || type}</span>;
}

function StatBox({ label, value }) {
  const mod = Math.floor((value - 10) / 2);
  const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
  return (
    <div className="card" style={{ textAlign: 'center', padding: '0.6rem' }}>
      <div className="text-muted text-sm">{label}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{value}</div>
      <div className="text-muted text-sm">{modStr}</div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '1.25rem 0 0.75rem' }}>{children}</h2>;
}

const EMPTY_FORM = {
  name: '', class: '', level: 1, race: '', alignment: '', speed: 30,
  hp: 0, max_hp: 0, ac: 10, initiative: 0,
  str_score: 10, dex_score: 10, con_score: 10, int_score: 10, wis_score: 10, cha_score: 10,
  bab: 0, cmb: 0, cmd: 10, spell_resistance: 0,
  fortitude: 0, will_save: 0, reflex: 0, char_notes: ''
};

const CLASS_ALIASES = {
  mago:       ['wizard', 'mago', 'wiz'],
  feiticeiro: ['sorcerer', 'feiticeiro', 'sor'],
  bardo:      ['bard', 'bardo', 'brd'],
  clerigo:    ['cleric', 'clérigo', 'clr'],
  druida:     ['druid', 'druida', 'drd'],
  paladino:   ['paladin', 'paladino', 'pal'],
  ranger:     ['ranger', 'guardião', 'rgr'],
}

export default function CharacterPanel() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const backTo = searchParams.get('back') || '/characters'
  const { user } = useAuth()
  const [char, setChar] = useState(null)
  const [effects, setEffects] = useState([])
  const [xpHistory, setXpHistory] = useState([])
  const [feats, setFeats] = useState([])
  const [allFeats, setAllFeats] = useState([])
  const [addingFeat, setAddingFeat] = useState(false)
  const [loading, setLoading] = useState(true)
  const [effectModal, setEffectModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Inline edit state
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState(null)

  // Spell state
  const [knownSpells, setKnownSpells] = useState([])
  const [spellSlots, setSpellSlots] = useState([])
  const [preparedSpells, setPreparedSpells] = useState([])
  const [spellLocked, setSpellLocked] = useState(false)
  const [spellTab, setSpellTab] = useState('grimoire')
  const [spellCircle, setSpellCircle] = useState(1)
  const [showLibrary, setShowLibrary] = useState(false)
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryResults, setLibraryResults] = useState([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [manualSpellForm, setManualSpellForm] = useState(null)

  const isOwner = char && char.user_id === user?.id
  const canEdit = isOwner || user?.is_admin

  async function load() {
    try {
      const [charRes, effectsRes, xpRes, featsRes, allFeatsRes] = await Promise.all([
        api.get(`/characters/${id}/sheet`),
        api.get(`/characters/${id}/effects`).catch(() => ({ data: [] })),
        api.get(`/characters/${id}/xp-history`).catch(() => ({ data: [] })),
        api.get(`/characters/${id}/feats`).catch(() => ({ data: [] })),
        api.get('/feats').catch(() => ({ data: [] })),
      ])
      const charData = charRes.data
      setChar(charData)
      setEffects(effectsRes.data)
      setXpHistory(xpRes.data)
      setFeats(featsRes.data)
      setAllFeats(allFeatsRes.data)

      if (charData?.class_info?.uses_magic === 1) {
        const [spellsRes, slotsRes, prepRes, lockRes] = await Promise.all([
          api.get(`/characters/${id}/spells`).catch(() => ({ data: [] })),
          api.get(`/characters/${id}/spell-slots`).catch(() => ({ data: [] })),
          api.get(`/characters/${id}/prepared-spells`).catch(() => ({ data: [] })),
          api.get(`/characters/${id}/spell-lock-status`).catch(() => ({ data: { spells_locked: 0 } })),
        ])
        setKnownSpells(spellsRes.data)
        setSpellSlots(slotsRes.data)
        setPreparedSpells(prepRes.data)
        setSpellLocked(lockRes.data.spells_locked === 1)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  function openEffectForm() { setEffectModal({ name: '', description: '', effect_type: 'other' }); setError('') }

  async function saveEffect() {
    if (!effectModal.name.trim()) return setError('Nome obrigatório')
    setSaving(true)
    try {
      await api.post(`/characters/${id}/effects`, effectModal)
      setEffectModal(null)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  async function removeEffect(effectId) {
    await api.delete(`/characters/${id}/effects/${effectId}`)
    load()
  }

  // ---- Spell helpers ----
  function getClassKey(charData) {
    const className = (charData || char)?.class_info?.name?.toLowerCase() || ''
    for (const [key, aliases] of Object.entries(CLASS_ALIASES)) {
      if (aliases.some(a => className.includes(a) || a.includes(className))) return key
    }
    return className
  }

  function detectSpellCircle(spell, charData) {
    const cd = charData || char
    const classKey = getClassKey(cd)
    const className = cd?.class_info?.name?.toLowerCase() || ''
    const allAliases = CLASS_ALIASES[classKey] || [className]
    const match = spell.levels?.find(l => {
      const lc = (l.class || l.className || '').toLowerCase()
      return allAliases.some(a => lc.includes(a) || a.includes(lc))
    })
    return match?.level ?? spellCircle
  }

  async function searchSpellLibrary(q, circle) {
    setLibraryLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      const r = await api.get(`/spell-library?${params}`)
      const classKey = getClassKey(char)
      const className = char?.class_info?.name?.toLowerCase() || ''
      const allAliases = CLASS_ALIASES[classKey] || [className]
      let filtered = r.data.filter(spell =>
        (spell.levels || []).some(l => {
          const lc = (l.class || l.className || '').toLowerCase()
          return allAliases.some(a => lc.includes(a) || a.includes(lc))
        })
      )
      if (circle !== undefined) {
        filtered = filtered.filter(spell => detectSpellCircle(spell, char) === circle)
      }
      setLibraryResults(filtered)
    } finally { setLibraryLoading(false) }
  }

  function getSpellSlot(circle) {
    return spellSlots.find(s => s.circle === circle) || { circle, total_slots: 0, used_slots: 0 }
  }

  // ---- Render spell section ----
  function renderSpellSection() {
    const castingType = char.class_info?.casting_type || 'prepared'
    const isPrepared = castingType === 'prepared'

    const circlesWithSpells = [...new Set(knownSpells.map(s => s.circle))]
    const circlesWithSlots = spellSlots.map(s => s.circle)
    const allCircles = [...new Set([...circlesWithSpells, ...circlesWithSlots])].sort((a, b) => a - b)

    const CIRCLE_NAMES = ['Truques (0)', '1º Círculo', '2º Círculo', '3º Círculo', '4º Círculo', '5º Círculo', '6º Círculo', '7º Círculo', '8º Círculo', '9º Círculo']

    const circleSpells = knownSpells.filter(s => s.circle === spellCircle)

    return (
      <div style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <SectionTitle>Magias</SectionTitle>
          {spellLocked && <span className="badge badge-yellow" style={{ fontSize: '0.72rem' }}>Bloqueado pelo Mestre</span>}
        </div>

        {/* Main tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button className={`btn-sm ${spellTab === 'grimoire' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSpellTab('grimoire')}>
            📚 {isPrepared ? 'Grimório' : 'Magias Conhecidas'}
          </button>
          <button className={`btn-sm ${spellTab === 'daily' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSpellTab('daily')}>
            {isPrepared ? '🎯 Preparação Diária' : '⚡ Usos Diários'}
          </button>
        </div>

        {/* Circle tabs */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {(spellTab === 'daily' ? spellSlots.map(s => s.circle).sort((a, b) => a - b) : allCircles).map(c => (
            <button key={c}
              className={`btn-sm ${spellCircle === c ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '0.75rem' }}
              onClick={() => setSpellCircle(c)}>
              {c}°
            </button>
          ))}
          {spellTab === 'grimoire' && !spellLocked && canEdit && (
            <button className="btn-ghost btn-sm" style={{ fontSize: '0.75rem' }} onClick={() => {
              const next = allCircles.length > 0 ? Math.max(...allCircles) + 1 : 1
              if (next <= 9) { setSpellCircle(next); setShowLibrary(true); searchSpellLibrary('', next) }
            }}>+ Círculo</button>
          )}
        </div>

        {spellTab === 'grimoire' && (
          <div>
            {canEdit && (
              <div className="card" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <span className="text-muted text-sm">Usos {spellCircle}°:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button className="btn-ghost btn-sm" onClick={async () => {
                    const s = getSpellSlot(spellCircle)
                    const newVal = Math.max(0, (s.total_slots || 0) - 1)
                    await api.put(`/characters/${id}/spell-slots`, { circle: spellCircle, total_slots: newVal, used_slots: s.used_slots || 0 })
                    setSpellSlots(prev => { const idx = prev.findIndex(x => x.circle === spellCircle); const updated = { ...s, total_slots: newVal }; return idx >= 0 ? prev.map((x, i) => i === idx ? updated : x) : [...prev, updated] })
                  }}>−</button>
                  <span style={{ fontWeight: 600, minWidth: 24, textAlign: 'center' }}>{getSpellSlot(spellCircle).total_slots}</span>
                  <button className="btn-ghost btn-sm" onClick={async () => {
                    const s = getSpellSlot(spellCircle)
                    const newVal = (s.total_slots || 0) + 1
                    await api.put(`/characters/${id}/spell-slots`, { circle: spellCircle, total_slots: newVal, used_slots: s.used_slots || 0 })
                    setSpellSlots(prev => { const idx = prev.findIndex(x => x.circle === spellCircle); const updated = { ...s, total_slots: newVal }; return idx >= 0 ? prev.map((x, i) => i === idx ? updated : x) : [...prev, updated] })
                  }}>+</button>
                </div>
                {!spellLocked && (
                  <button className="btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => {
                    setShowLibrary(true)
                    setLibrarySearch('')
                    searchSpellLibrary('', spellCircle)
                  }}>＋ Adicionar Magia</button>
                )}
              </div>
            )}

            {circleSpells.length === 0 && (
              <p className="text-muted text-sm">Nenhuma magia no {spellCircle}° círculo.</p>
            )}
            {circleSpells.map(spell => (
              <div key={spell.id} className="card" style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong style={{ fontSize: '0.9rem' }}>{spell.name}</strong>
                  {spell.school && <span className="badge badge-purple" style={{ fontSize: '0.65rem', marginLeft: '0.5rem' }}>{spell.school}</span>}
                  {spell.casting_time && <span className="text-muted text-sm" style={{ fontSize: '0.78rem', display: 'block' }}>⏱ {spell.casting_time}{spell.duration ? ` · ${spell.duration}` : ''}</span>}
                  {spell.description && <p className="text-muted text-sm" style={{ fontSize: '0.78rem', margin: '0.2rem 0 0' }}>{spell.description.substring(0, 120)}{spell.description.length > 120 ? '…' : ''}</p>}
                </div>
                {canEdit && !spellLocked && (
                  <button className="btn-ghost btn-sm" style={{ color: 'var(--danger)', fontSize: '0.75rem', marginLeft: '0.5rem' }}
                    onClick={async () => {
                      await api.delete(`/characters/${id}/spells/${spell.id}`)
                      setKnownSpells(prev => prev.filter(s => s.id !== spell.id))
                    }}>✕</button>
                )}
              </div>
            ))}
          </div>
        )}

        {spellTab === 'daily' && isPrepared && (
          <div>
            <p className="text-muted text-sm">Acesse a página completa de magias para gerenciar memorização.</p>
            <a href={`/characters/${id}/spells`} className="btn-ghost btn-sm" style={{ textDecoration: 'none', display: 'inline-block', marginTop: '0.5rem' }}>Abrir página de magias →</a>
          </div>
        )}

        {spellTab === 'daily' && !isPrepared && (
          <div>
            {(() => {
              const slot = getSpellSlot(spellCircle)
              const circleKnown = knownSpells.filter(s => s.circle === spellCircle)
              const totalUsed = circleKnown.reduce((sum, s) => sum + (s.times_cast || 0), 0)
              const remaining = (slot.total_slots || 0) - totalUsed
              return (
                <>
                  <div className="card" style={{ marginBottom: '0.75rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span className="text-muted text-sm">Total {spellCircle}°:</span>
                    <strong>{slot.total_slots}</strong>
                    <span className="text-muted text-sm">Restantes:</span>
                    <strong style={{ color: remaining <= 0 ? 'var(--danger)' : 'var(--success)' }}>{remaining}</strong>
                    <button className="btn-ghost btn-sm" style={{ marginLeft: 'auto', fontSize: '0.75rem' }} onClick={async () => {
                      await api.patch(`/characters/${id}/spells/reset-day`, { circle: spellCircle })
                      setKnownSpells(prev => prev.map(s => s.circle === spellCircle ? { ...s, times_cast: 0 } : s))
                    }}>Reiniciar dia</button>
                  </div>
                  {circleKnown.map(spell => (
                    <div key={spell.id} className="card" style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 500 }}>{spell.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button className="btn-ghost btn-sm" disabled={!spell.times_cast} onClick={async () => {
                          const r = await api.patch(`/characters/${id}/spells/${spell.id}/use`, { delta: -1 })
                          setKnownSpells(prev => prev.map(s => s.id === spell.id ? r.data : s))
                        }}>−</button>
                        <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 600 }}>{spell.times_cast || 0}</span>
                        <button className="btn-ghost btn-sm" disabled={remaining <= 0} onClick={async () => {
                          const r = await api.patch(`/characters/${id}/spells/${spell.id}/use`, { delta: 1 })
                          setKnownSpells(prev => prev.map(s => s.id === spell.id ? r.data : s))
                        }}>⚡+</button>
                      </div>
                    </div>
                  ))}
                </>
              )
            })()}
          </div>
        )}

        {/* Library search modal */}
        {showLibrary && (
          <div className="modal-backdrop">
            <div className="modal" style={{ maxWidth: 600, maxHeight: '85vh', overflowY: 'auto' }}>
              <div className="modal-header">
                <h2>Adicionar Magia — {spellCircle}° Círculo</h2>
                <button className="btn-ghost btn-sm" onClick={() => { setShowLibrary(false); setLibraryResults([]) }}>✕</button>
              </div>
              <input
                autoFocus
                placeholder="Buscar na biblioteca..."
                value={librarySearch}
                onChange={e => { setLibrarySearch(e.target.value); searchSpellLibrary(e.target.value, spellCircle) }}
                style={{ marginBottom: '0.75rem' }}
              />
              {libraryLoading && <p className="text-muted text-sm">Buscando...</p>}
              {!libraryLoading && libraryResults.length === 0 && (
                <p className="text-muted text-sm">Nenhuma magia encontrada para {char.class_info?.name} no {spellCircle}° círculo.</p>
              )}
              {libraryResults.map(spell => (
                <div key={spell.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 500 }}>{spell.display_name || spell.name}</span>
                      {spell.school && <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>{spell.school}</span>}
                    </div>
                    {spell.description_short && <p className="text-muted text-sm" style={{ fontSize: '0.78rem', margin: '0.1rem 0 0' }}>{spell.description_short.substring(0, 100)}</p>}
                  </div>
                  <button className="btn-primary btn-sm" style={{ marginLeft: '0.75rem', whiteSpace: 'nowrap' }}
                    onClick={async () => {
                      const circle = detectSpellCircle(spell, char)
                      await api.post(`/characters/${id}/spells`, {
                        name: spell.display_name || spell.name,
                        circle,
                        school: spell.school || '',
                        description: spell.description_full || spell.description_short || '',
                        components: spell.components || '',
                        casting_time: spell.casting_time || '',
                        duration: spell.duration || '',
                        range: spell.range || '',
                        saving_throw: spell.saving_throw || '',
                        notes: [spell.area && `Área: ${spell.area}`, spell.target && `Alvo: ${spell.target}`].filter(Boolean).join('\n'),
                      }).then(r => {
                        setKnownSpells(prev => [...prev, r.data])
                        setShowLibrary(false)
                        setLibraryResults([])
                        setSpellCircle(circle)
                      })
                    }}>+ Adicionar</button>
                </div>
              ))}
              <div style={{ padding: '0.75rem 0', borderTop: '1px solid var(--border)', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Não encontrou?{' '}
                <button style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.82rem', padding: 0 }}
                  onClick={() => { setShowLibrary(false); setManualSpellForm({ name: '', circle: spellCircle, school: '', description: '', components: '', casting_time: '', duration: '', range: '', saving_throw: '', notes: '' }) }}>
                  Adicionar manualmente →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manual spell form modal */}
        {manualSpellForm && (
          <div className="modal-backdrop">
            <div className="modal" style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="modal-header">
                <h2>Adicionar Magia Manualmente</h2>
                <button className="btn-ghost btn-sm" onClick={() => setManualSpellForm(null)}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Nome</label><input value={manualSpellForm.name} onChange={e => setManualSpellForm(m => ({ ...m, name: e.target.value }))} autoFocus /></div>
                <div className="form-group"><label>Círculo</label><input type="number" min={0} max={9} value={manualSpellForm.circle} onChange={e => setManualSpellForm(m => ({ ...m, circle: +e.target.value }))} /></div>
                <div className="form-group"><label>Escola</label><input value={manualSpellForm.school} onChange={e => setManualSpellForm(m => ({ ...m, school: e.target.value }))} /></div>
                <div className="form-group"><label>Tempo de Conjuração</label><input value={manualSpellForm.casting_time} onChange={e => setManualSpellForm(m => ({ ...m, casting_time: e.target.value }))} /></div>
                <div className="form-group"><label>Duração</label><input value={manualSpellForm.duration} onChange={e => setManualSpellForm(m => ({ ...m, duration: e.target.value }))} /></div>
                <div className="form-group"><label>Alcance</label><input value={manualSpellForm.range} onChange={e => setManualSpellForm(m => ({ ...m, range: e.target.value }))} /></div>
                <div className="form-group"><label>Resistência</label><input value={manualSpellForm.saving_throw} onChange={e => setManualSpellForm(m => ({ ...m, saving_throw: e.target.value }))} /></div>
                <div className="form-group"><label>Componentes</label><input value={manualSpellForm.components} onChange={e => setManualSpellForm(m => ({ ...m, components: e.target.value }))} /></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Descrição</label><textarea rows={3} value={manualSpellForm.description} onChange={e => setManualSpellForm(m => ({ ...m, description: e.target.value }))} /></div>
              </div>
              <div className="modal-footer">
                <button className="btn-ghost" onClick={() => setManualSpellForm(null)}>Cancelar</button>
                <button className="btn-primary" onClick={async () => {
                  if (!manualSpellForm.name.trim()) return
                  const r = await api.post(`/characters/${id}/spells`, manualSpellForm)
                  setKnownSpells(prev => [...prev, r.data])
                  setSpellCircle(manualSpellForm.circle)
                  setManualSpellForm(null)
                }}>Salvar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading) return <div className="page"><div className="spinner" /></div>
  if (!char) return <div className="page"><p className="text-muted">Personagem não encontrado.</p></div>

  return (
    <div className="page">
      <div className="mb-3">
        <Link to={backTo} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>← Voltar</Link>
      </div>

      {/* Sticky edit bar */}
      {editMode && (
        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface)', borderBottom: '2px solid var(--primary)', padding: '0.5rem 0', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <span className="text-muted text-sm" style={{ flex: 1, alignSelf: 'center' }}>Modo edição</span>
          <button className="btn-ghost btn-sm" onClick={() => { setEditMode(false); setEditForm(null) }}>Cancelar</button>
          <button className="btn-primary btn-sm" disabled={saving} onClick={async () => {
            if (!editForm.name?.trim()) return setError('Nome obrigatório')
            setSaving(true)
            try { await api.put(`/characters/${id}`, editForm); setEditMode(false); setEditForm(null); load() }
            catch (err) { setError(err.response?.data?.error || 'Erro ao salvar') }
            finally { setSaving(false) }
          }}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      )}

      <div className="page-header">
        <div>
          {editMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <input
                value={editForm.name}
                onChange={e => setEditForm(m => ({ ...m, name: e.target.value }))}
                style={{ fontSize: '1.4rem', fontWeight: 700, background: 'transparent', border: '1px solid var(--primary)', borderRadius: 'var(--radius)', padding: '0.2rem 0.5rem' }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input placeholder="Classe" value={editForm.class} onChange={e => setEditForm(m => ({ ...m, class: e.target.value }))} style={{ width: 120, fontSize: '0.85rem' }} />
                <input placeholder="Raça" value={editForm.race} onChange={e => setEditForm(m => ({ ...m, race: e.target.value }))} style={{ width: 100, fontSize: '0.85rem' }} />
                <input type="number" min={1} placeholder="Nível" value={editForm.level} onChange={e => setEditForm(m => ({ ...m, level: +e.target.value }))} style={{ width: 60, fontSize: '0.85rem' }} />
                <select value={editForm.alignment} onChange={e => setEditForm(m => ({ ...m, alignment: e.target.value }))} style={{ fontSize: '0.85rem' }}>
                  <option value="">Alinhamento...</option>
                  {['Leal e Bom','Neutro e Bom','Caótico e Bom','Leal e Neutro','Neutro','Caótico e Neutro','Leal e Mau','Neutro e Mau','Caótico e Mau'].map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <>
              <h1>{char.name}</h1>
              <p className="text-muted text-sm mt-1">
                Nível {char.level}
                {char.class ? ` • ${char.class}` : ''}
                {char.race ? ` • ${char.race}` : ''}
                {char.alignment ? ` • ${char.alignment}` : ''}
              </p>
              {!isOwner && char.user_email && (
                <p className="text-muted text-sm">Jogador: {char.user_email}</p>
              )}
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {canEdit && (
            <button className="btn-ghost" onClick={() => {
              if (editMode) {
                setEditMode(false); setEditForm(null)
              } else {
                setEditMode(true); setEditForm({ ...EMPTY_FORM, ...char }); setError('')
              }
            }}>
              {editMode ? 'Editando...' : '✏️ Editar'}
            </button>
          )}
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {/* HP / combat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px,1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="text-muted text-sm">HP</div>
          {editMode ? (
            <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center', margin: '0.25rem 0' }}>
              <input type="number" value={editForm.hp} onChange={e => setEditForm(m => ({ ...m, hp: +e.target.value }))} style={{ width: 50, textAlign: 'center', fontWeight: 700, fontSize: '1rem', background: 'transparent', border: '1px solid var(--primary)', borderRadius: 'var(--radius)', padding: '0.2rem' }} />
              <span style={{ fontWeight: 700, fontSize: '1rem', alignSelf: 'center' }}>/</span>
              <input type="number" value={editForm.max_hp} onChange={e => setEditForm(m => ({ ...m, max_hp: +e.target.value }))} style={{ width: 50, textAlign: 'center', fontWeight: 700, fontSize: '1rem', background: 'transparent', border: '1px solid var(--primary)', borderRadius: 'var(--radius)', padding: '0.2rem' }} />
            </div>
          ) : (
            <>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.25rem 0' }}>{char.hp} / {char.max_hp}</div>
              <HpBar hp={char.hp} maxHp={char.max_hp} />
            </>
          )}
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="text-muted text-sm">CA</div>
          {editMode ? (
            <input type="number" value={editForm.ac} onChange={e => setEditForm(m => ({ ...m, ac: +e.target.value }))} style={{ width: '100%', textAlign: 'center', fontWeight: 700, fontSize: '1.2rem', background: 'transparent', border: '1px solid var(--primary)', borderRadius: 'var(--radius)', padding: '0.2rem', margin: '0.25rem 0' }} />
          ) : (
            <div style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.25rem 0' }}>{char.ac}</div>
          )}
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="text-muted text-sm">Iniciativa</div>
          {editMode ? (
            <input type="number" value={editForm.initiative} onChange={e => setEditForm(m => ({ ...m, initiative: +e.target.value }))} style={{ width: '100%', textAlign: 'center', fontWeight: 700, fontSize: '1.2rem', background: 'transparent', border: '1px solid var(--primary)', borderRadius: 'var(--radius)', padding: '0.2rem', margin: '0.25rem 0' }} />
          ) : (
            <div style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.25rem 0' }}>{char.initiative >= 0 ? '+' : ''}{char.initiative}</div>
          )}
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="text-muted text-sm">BAB</div>
          {editMode ? (
            <input type="number" min={0} value={editForm.bab} onChange={e => setEditForm(m => ({ ...m, bab: +e.target.value }))} style={{ width: '100%', textAlign: 'center', fontWeight: 700, fontSize: '1.2rem', background: 'transparent', border: '1px solid var(--primary)', borderRadius: 'var(--radius)', padding: '0.2rem', margin: '0.25rem 0' }} />
          ) : (
            <div style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.25rem 0' }}>+{char.bab}</div>
          )}
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="text-muted text-sm">XP</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.25rem 0' }}>{char.total_xp.toLocaleString('pt-BR')}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="text-muted text-sm">Vel.</div>
          {editMode ? (
            <input type="number" min={0} value={editForm.speed} onChange={e => setEditForm(m => ({ ...m, speed: +e.target.value }))} style={{ width: '100%', textAlign: 'center', fontWeight: 700, fontSize: '1.2rem', background: 'transparent', border: '1px solid var(--primary)', borderRadius: 'var(--radius)', padding: '0.2rem', margin: '0.25rem 0' }} />
          ) : (
            <div style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.25rem 0' }}>{char.speed}m</div>
          )}
        </div>
      </div>

      <SectionTitle>Atributos</SectionTitle>
      {editMode ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px,1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
          {[['FOR','str_score'],['DES','dex_score'],['CON','con_score'],['INT','int_score'],['SAB','wis_score'],['CAR','cha_score']].map(([label, key]) => (
            <div key={key} className="card" style={{ textAlign: 'center', padding: '0.6rem' }}>
              <div className="text-muted text-sm">{label}</div>
              <input type="number" min={1} max={30} value={editForm[key]} onChange={e => setEditForm(m => ({ ...m, [key]: +e.target.value }))} style={{ width: '100%', textAlign: 'center', fontWeight: 700, fontSize: '1rem', background: 'transparent', border: '1px solid var(--primary)', borderRadius: 'var(--radius)', padding: '0.2rem' }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px,1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
          <StatBox label="FOR" value={char.str_score} />
          <StatBox label="DES" value={char.dex_score} />
          <StatBox label="CON" value={char.con_score} />
          <StatBox label="INT" value={char.int_score} />
          <StatBox label="SAB" value={char.wis_score} />
          <StatBox label="CAR" value={char.cha_score} />
        </div>
      )}

      <SectionTitle>Testes de Resistência</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px,1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {editMode ? (
          [['Fortitude','fortitude'],['Reflexos','reflex'],['Vontade','will_save']].map(([label, key]) => (
            <div key={key} className="card" style={{ textAlign: 'center' }}>
              <div className="text-muted text-sm">{label}</div>
              <input type="number" value={editForm[key]} onChange={e => setEditForm(m => ({ ...m, [key]: +e.target.value }))} style={{ width: '100%', textAlign: 'center', fontWeight: 700, fontSize: '1.2rem', background: 'transparent', border: '1px solid var(--primary)', borderRadius: 'var(--radius)', padding: '0.2rem', margin: '0.25rem 0' }} />
            </div>
          ))
        ) : (
          [['Fortitude', char.fortitude], ['Reflexos', char.reflex], ['Vontade', char.will_save]].map(([label, val]) => (
            <div key={label} className="card" style={{ textAlign: 'center' }}>
              <div className="text-muted text-sm">{label}</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.25rem 0' }}>{val >= 0 ? '+' : ''}{val}</div>
            </div>
          ))
        )}
      </div>

      <SectionTitle>Combate</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px,1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {editMode ? (
          [['CMB','cmb'],['CMD','cmd'],['Res. Magia','spell_resistance']].map(([label, key]) => (
            <div key={key} className="card" style={{ textAlign: 'center' }}>
              <div className="text-muted text-sm">{label}</div>
              <input type="number" value={editForm[key]} onChange={e => setEditForm(m => ({ ...m, [key]: +e.target.value }))} style={{ width: '100%', textAlign: 'center', fontWeight: 700, fontSize: '1.2rem', background: 'transparent', border: '1px solid var(--primary)', borderRadius: 'var(--radius)', padding: '0.2rem', margin: '0.25rem 0' }} />
            </div>
          ))
        ) : (
          [['CMB', char.cmb], ['CMD', char.cmd], ['Res. Magia', char.spell_resistance]].map(([label, val]) => (
            <div key={label} className="card" style={{ textAlign: 'center' }}>
              <div className="text-muted text-sm">{label}</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.25rem 0' }}>{val}</div>
            </div>
          ))
        )}
      </div>

      {/* Notes in edit mode */}
      {editMode && (
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label>Anotações / Traços</label>
          <textarea value={editForm.char_notes || ''} onChange={e => setEditForm(m => ({ ...m, char_notes: e.target.value }))} rows={3} style={{ resize: 'vertical' }} />
        </div>
      )}

      {canEdit && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <strong>Talentos</strong>
            <button className="btn-ghost btn-sm" onClick={() => setAddingFeat(true)}>+ Adicionar</button>
          </div>
          {feats.length === 0 && <p className="text-muted text-sm">Nenhum talento.</p>}
          {feats.map(f => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div>
                <span style={{ fontWeight: 500 }}>{f.name}</span>
                {f.description && <span className="text-muted text-sm" style={{ marginLeft: '0.5rem' }}>({f.description})</span>}
              </div>
              <button className="btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                onClick={async () => {
                  await api.delete(`/characters/${id}/feats/${f.id}`)
                  setFeats(prev => prev.filter(x => x.id !== f.id))
                }}>✕</button>
            </div>
          ))}
          {addingFeat && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <select defaultValue="" id="feat-select" style={{ flex: 1 }}>
                <option value="">Escolha um talento...</option>
                {allFeats.filter(f => !feats.find(x => x.id === f.id)).map(f => (
                  <option key={f.id} value={f.id}>{f.name}{f.description ? ` — ${f.description}` : ''}</option>
                ))}
              </select>
              <button className="btn-primary btn-sm" onClick={async () => {
                const sel = document.getElementById('feat-select')
                if (!sel.value) return
                await api.post(`/characters/${id}/feats`, { feat_id: +sel.value })
                const { data } = await api.get(`/characters/${id}/feats`)
                setFeats(data)
                setAddingFeat(false)
              }}>Adicionar</button>
              <button className="btn-ghost btn-sm" onClick={() => setAddingFeat(false)}>Cancelar</button>
            </div>
          )}
        </div>
      )}

      {isOwner && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="flex justify-between items-center mb-3">
            <SectionTitle>Efeitos Ativos</SectionTitle>
            <button className="btn-ghost btn-sm" onClick={openEffectForm}>+ Adicionar</button>
          </div>
          {effects.length === 0
            ? <p className="text-muted text-sm">Nenhum efeito ativo.</p>
            : (
              <div className="flex" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                {effects.map(ef => (
                  <span key={ef.id} className="chip" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <EffectBadge type={ef.effect_type} />
                    <strong>{ef.name}</strong>
                    {ef.description && <span className="text-muted text-sm"> — {ef.description}</span>}
                    <button onClick={() => removeEffect(ef.id)} title="Remover">✕</button>
                  </span>
                ))}
              </div>
            )}
        </div>
      )}

      {!editMode && char.char_notes && (
        <>
          <SectionTitle>Anotações</SectionTitle>
          <div className="card" style={{ whiteSpace: 'pre-wrap' }}>{char.char_notes}</div>
        </>
      )}

      <SectionTitle>Histórico de XP</SectionTitle>
      {xpHistory.length === 0
        ? <p className="text-muted text-sm">Nenhum XP registrado ainda.</p>
        : (
          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr><th>Sessão</th><th>Campanha</th><th>XP</th><th>Data</th></tr>
              </thead>
              <tbody>
                {xpHistory.map(r => (
                  <tr key={r.id}>
                    <td>{r.session_name}</td>
                    <td className="text-muted">{r.campaign_name || '—'}</td>
                    <td className="text-success font-bold">+{r.xp_granted.toLocaleString('pt-BR')} XP</td>
                    <td className="text-muted">{new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {char.class_info?.uses_magic === 1 && renderSpellSection()}

      {effectModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>Adicionar Efeito</h2>
              <button className="btn-ghost btn-sm" onClick={() => setEffectModal(null)}>✕</button>
            </div>
            <div className="form-group"><label>Nome</label><input value={effectModal.name} onChange={e => setEffectModal(m => ({ ...m, name: e.target.value }))} autoFocus /></div>
            <div className="form-group"><label>Descrição</label><input value={effectModal.description} onChange={e => setEffectModal(m => ({ ...m, description: e.target.value }))} /></div>
            <div className="form-group">
              <label>Tipo</label>
              <select value={effectModal.effect_type} onChange={e => setEffectModal(m => ({ ...m, effect_type: e.target.value }))}>
                <option value="magia">Magia</option>
                <option value="condicao">Condição</option>
                <option value="buff">Buff</option>
                <option value="debuff">Debuff</option>
                <option value="other">Outro</option>
              </select>
            </div>
            {error && <p className="error-msg">{error}</p>}
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setEffectModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={saveEffect} disabled={saving}>{saving ? 'Salvando...' : 'Adicionar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
