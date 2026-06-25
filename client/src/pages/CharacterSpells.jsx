import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../AuthContext'

const CIRCLE_NAMES = [
  'Truques (0)', '1º Círculo', '2º Círculo', '3º Círculo', '4º Círculo',
  '5º Círculo', '6º Círculo', '7º Círculo', '8º Círculo', '9º Círculo',
]

export default function CharacterSpells() {
  const { id } = useParams()
  const { user } = useAuth()
  const [char, setChar] = useState(null)
  const [knownSpells, setKnownSpells] = useState([])
  const [slots, setSlots] = useState([])
  const [prepared, setPrepared] = useState([])
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('grimoire')
  const [activeCircle, setActiveCircle] = useState(0)
  const [spellModal, setSpellModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showLibrarySearch, setShowLibrarySearch] = useState(false)
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryResults, setLibraryResults] = useState([])
  const [libraryLoading, setLibraryLoading] = useState(false)

  async function load() {
    try {
      const [charRes, spellsRes, slotsRes, prepRes, lockRes] = await Promise.all([
        api.get(`/characters/${id}/sheet`),
        api.get(`/characters/${id}/spells`),
        api.get(`/characters/${id}/spell-slots`),
        api.get(`/characters/${id}/prepared-spells`),
        api.get(`/characters/${id}/spell-lock-status`),
      ])
      setChar(charRes.data)
      setKnownSpells(spellsRes.data)
      setSlots(slotsRes.data)
      setPrepared(prepRes.data)
      setLocked(lockRes.data.spells_locked === 1)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const castingType = char?.class_info?.casting_type || 'prepared'
  const isPrepared = castingType === 'prepared'
  const canEdit = !locked

  function getSlot(circle) {
    return slots.find(s => s.circle === circle) || { circle, total_slots: 0, used_slots: 0 }
  }

  async function updateSlot(circle, field, delta) {
    const s = getSlot(circle)
    const newVal = Math.max(0, (s[field] || 0) + delta)
    await api.put(`/characters/${id}/spell-slots`, { ...s, [field]: newVal })
    setSlots(prev => {
      const idx = prev.findIndex(x => x.circle === circle)
      const updated = { ...s, [field]: newVal }
      return idx >= 0 ? prev.map((x, i) => i === idx ? updated : x) : [...prev, updated]
    })
  }

  async function resetCircleUsed(circle) {
    // For spontaneous: reset per-spell times_cast
    await api.patch(`/characters/${id}/spells/reset-day`, { circle })
    setKnownSpells(prev => prev.map(s => s.circle === circle ? { ...s, times_cast: 0 } : s))
  }

  async function useSpell(spell, delta) {
    const r = await api.patch(`/characters/${id}/spells/${spell.id}/use`, { delta })
    setKnownSpells(prev => prev.map(s => s.id === spell.id ? r.data : s))
  }

  async function resetCircleCast(circle) {
    const circlePrep = prepared.filter(p => p.circle === circle && p.is_cast)
    await Promise.all(circlePrep.map(p => api.patch(`/characters/${id}/prepared-spells/${p.id}/cast`, {})))
    setPrepared(prev => prev.map(p => p.circle === circle ? { ...p, is_cast: 0 } : p))
  }

  async function toggleCast(prep) {
    const r = await api.patch(`/characters/${id}/prepared-spells/${prep.id}/cast`, {})
    setPrepared(prev => prev.map(p => p.id === prep.id ? r.data : p))
  }

  async function addPrepared(circle, spell) {
    const r = await api.post(`/characters/${id}/prepared-spells`, { circle, spell_name: spell.name, known_spell_id: spell.id })
    setPrepared(prev => [...prev, r.data])
  }

  async function removePrepared(prepId) {
    await api.delete(`/characters/${id}/prepared-spells/${prepId}`)
    setPrepared(prev => prev.filter(p => p.id !== prepId))
  }

  async function saveSpell() {
    if (!spellModal?.name?.trim()) return setError('Nome obrigatório')
    setSaving(true)
    try {
      if (spellModal.id) {
        const r = await api.put(`/characters/${id}/spells/${spellModal.id}`, spellModal)
        setKnownSpells(prev => prev.map(s => s.id === spellModal.id ? r.data : s))
      } else {
        const r = await api.post(`/characters/${id}/spells`, spellModal)
        setKnownSpells(prev => [...prev, r.data])
      }
      setSpellModal(null)
    } catch (e) {
      setError(e.response?.data?.error || 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  async function deleteSpell(spellId) {
    if (!confirm('Remover esta magia do grimório/lista?')) return
    await api.delete(`/characters/${id}/spells/${spellId}`)
    setKnownSpells(prev => prev.filter(s => s.id !== spellId))
  }

  async function searchLibrary(q) {
    setLibrarySearch(q)
    if (!q.trim()) { setLibraryResults([]); return }
    setLibraryLoading(true)
    try {
      const r = await api.get(`/spell-library?q=${encodeURIComponent(q)}`)
      setLibraryResults(r.data)
    } finally { setLibraryLoading(false) }
  }

  function detectCircle(spell) {
    const className = char?.class_info?.name?.toLowerCase() || ''
    const ALIASES = {
      mago: ['wizard', 'mago', 'wiz'],
      feiticeiro: ['sorcerer', 'feiticeiro', 'sor'],
      bardo: ['bard', 'bardo', 'brd'],
      clerigo: ['cleric', 'clérigo', 'clr'],
      druida: ['druid', 'druida', 'drd'],
      paladino: ['paladin', 'paladino', 'pal'],
      ranger: ['ranger', 'guardião', 'rgr'],
    }
    let classKey = className
    for (const [key, aliases] of Object.entries(ALIASES)) {
      if (aliases.some(a => className.includes(a) || a.includes(className))) { classKey = key; break }
    }
    const match = spell.levels?.find(l => {
      const lc = (l.class || l.className || '').toLowerCase()
      const allAliases = ALIASES[classKey] || [className]
      return allAliases.some(a => lc.includes(a) || a.includes(lc))
    })
    return match?.level ?? activeCircle
  }

  async function addFromLibrary(libSpell) {
    const circle = detectCircle(libSpell)
    const r = await api.post(`/characters/${id}/spells`, {
      name: libSpell.display_name || libSpell.name,
      circle,
      school: libSpell.school || '',
      description: libSpell.description_full || libSpell.description_short || '',
      components: libSpell.components || '',
      casting_time: libSpell.casting_time || '',
      duration: libSpell.duration || '',
      range: libSpell.range || '',
      saving_throw: libSpell.saving_throw || '',
      notes: [libSpell.area && `Área: ${libSpell.area}`, libSpell.target && `Alvo: ${libSpell.target}`, libSpell.effect && `Efeito: ${libSpell.effect}`].filter(Boolean).join('\n'),
    })
    setKnownSpells(prev => [...prev, r.data])
    setActiveCircle(circle)
  }

  if (loading) return <div className="page"><div className="spinner" /></div>
  if (!char) return <div className="page"><p className="text-muted">Personagem não encontrado.</p></div>

  const classInfo = char.class_info
  if (!classInfo || classInfo.uses_magic === 0) {
    return (
      <div className="page">
        <div className="mb-3">
          <Link to={`/characters/${id}`} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>← {char.name}</Link>
        </div>
        <div className="card text-muted text-sm">{char.name} não usa magia.</div>
      </div>
    )
  }

  const allActiveCircles = [...new Set([
    0,
    ...knownSpells.map(s => s.circle),
    ...slots.filter(s => s.total_slots > 0).map(s => s.circle),
    ...prepared.map(p => p.circle),
  ])].sort((a, b) => a - b)

  function renderGrimoireTab() {
    const circleSpells = knownSpells.filter(s => s.circle === activeCircle)
    return (
      <div>
        <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>
          {isPrepared
            ? 'Estas são as magias que estão no seu grimório. Na aba "Preparação Diária" você escolhe quais memorizar a cada dia.'
            : 'Estas são as magias que você conhece. Você pode lançar qualquer uma delas usando seus usos diários.'}
        </p>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <strong>{CIRCLE_NAMES[activeCircle]}</strong>
            {!locked && (
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button className="btn-ghost btn-sm" onClick={() => { setShowLibrarySearch(true); setLibrarySearch(''); setLibraryResults([]) }}>
                  Biblioteca
                </button>
                <button className="btn-primary btn-sm" onClick={() => {
                  setSpellModal({ circle: activeCircle, name: '', school: '', description: '', components: '', casting_time: '', duration: '', range: '', saving_throw: '', notes: '' })
                  setError('')
                }}>
                  + Magia
                </button>
              </div>
            )}
          </div>
          {circleSpells.length === 0 && (
            <p className="text-muted text-sm">Nenhuma magia neste círculo.</p>
          )}
          {circleSpells.map(spell => (
            <div key={spell.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 500 }}>{spell.name}</span>
                  {spell.school && (
                    <span className="badge badge-purple" style={{ fontSize: '0.68rem' }}>{spell.school}</span>
                  )}
                </div>
                {spell.description && (
                  <div className="text-muted text-sm" style={{ marginTop: '0.1rem', fontSize: '0.78rem' }}>
                    {spell.description.substring(0, 100)}{spell.description.length > 100 ? '…' : ''}
                  </div>
                )}
                {(spell.casting_time || spell.range || spell.duration) && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                    {[
                      spell.casting_time && `⏱ ${spell.casting_time}`,
                      spell.range && `📍 ${spell.range}`,
                      spell.duration && `⌛ ${spell.duration}`,
                    ].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              {!locked && (
                <div style={{ display: 'flex', gap: '0.3rem', marginLeft: '0.5rem' }}>
                  <button className="btn-ghost btn-sm" style={{ fontSize: '0.75rem' }} onClick={() => { setSpellModal({ ...spell }); setError('') }}>✏️</button>
                  <button className="btn-danger btn-sm" style={{ fontSize: '0.75rem' }} onClick={() => deleteSpell(spell.id)}>✕</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderPreparationTab() {
    const s = getSlot(activeCircle)
    const circlePrep = prepared.filter(p => p.circle === activeCircle)
    const circleKnown = knownSpells.filter(k => k.circle === activeCircle)
    const castCount = circlePrep.filter(p => p.is_cast).length
    const availableCount = circlePrep.filter(p => !p.is_cast).length

    return (
      <div>
        <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>
          Escolha quais magias do grimório memorizar hoje. Cada círculo tem um número limitado de slots. Marque as magias conforme as lança durante o jogo.
        </p>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
            <div>
              <strong>{CIRCLE_NAMES[activeCircle]}</strong>
              <div className="text-muted text-sm" style={{ marginTop: '0.2rem' }}>
                {circlePrep.length === 0
                  ? 'Nenhuma magia memorizada'
                  : `${availableCount} disponível${availableCount !== 1 ? 'is' : ''} · ${castCount} lançada${castCount !== 1 ? 's' : ''}`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="text-muted text-sm">Slots:</span>
              {!locked ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <button className="btn-ghost btn-sm" style={{ padding: '0.1rem 0.5rem' }} onClick={() => updateSlot(activeCircle, 'total_slots', -1)}>−</button>
                  <span style={{ fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{s.total_slots}</span>
                  <button className="btn-ghost btn-sm" style={{ padding: '0.1rem 0.5rem' }} onClick={() => updateSlot(activeCircle, 'total_slots', 1)}>+</button>
                </div>
              ) : (
                <span style={{ fontWeight: 700 }}>{s.total_slots}</span>
              )}
            </div>
          </div>

          {circlePrep.length === 0 && (
            <p className="text-muted text-sm" style={{ marginBottom: '0.75rem' }}>
              {circleKnown.length > 0
                ? 'Nenhuma magia memorizada. Adicione abaixo.'
                : 'Adicione magias ao grimório (aba "Grimório") antes de memorizar.'}
            </p>
          )}
          {circlePrep.map(prep => (
            <div key={prep.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.4rem 0.5rem', marginBottom: '0.3rem', borderRadius: 'var(--radius)',
              background: prep.is_cast ? 'var(--surface2)' : 'rgba(124,106,247,0.1)',
              opacity: prep.is_cast ? 0.65 : 1,
              border: `1px solid ${prep.is_cast ? 'var(--border)' : 'var(--primary)'}`,
            }}>
              <span style={{ fontWeight: 500, textDecoration: prep.is_cast ? 'line-through' : 'none' }}>{prep.spell_name}</span>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button
                  className={prep.is_cast ? 'btn-ghost btn-sm' : 'btn-primary btn-sm'}
                  style={{ fontSize: '0.78rem' }}
                  onClick={() => toggleCast(prep)}
                >{prep.is_cast ? '↺ Restaurar' : '✓ Lançar'}</button>
                {!locked && (
                  <button className="btn-ghost btn-sm" style={{ fontSize: '0.75rem' }} onClick={() => removePrepared(prep.id)}>✕</button>
                )}
              </div>
            </div>
          ))}

          {!locked && circleKnown.length > 0 && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <span className="text-muted text-sm">Memorizar: </span>
              <select
                defaultValue=""
                onChange={e => {
                  const spell = circleKnown.find(k => k.id === +e.target.value)
                  if (spell) { addPrepared(activeCircle, spell); e.target.value = '' }
                }}
                style={{ width: 'auto', display: 'inline-block', marginLeft: '0.5rem', fontSize: '0.85rem' }}
              >
                <option value="" disabled>Escolher magia...</option>
                {circleKnown.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </div>
          )}

          {circlePrep.some(p => p.is_cast) && (
            <div style={{ marginTop: '0.5rem' }}>
              <button className="btn-ghost btn-sm" style={{ fontSize: '0.78rem' }} onClick={() => resetCircleCast(activeCircle)}>
                ↺ Restaurar todas as magias deste círculo
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderDailyUsesTab() {
    const s = getSlot(activeCircle)
    const circleKnown = knownSpells.filter(k => k.circle === activeCircle)
    const totalUsed = circleKnown.reduce((sum, sp) => sum + (sp.times_cast || 0), 0)
    const remaining = Math.max(0, s.total_slots - totalUsed)
    const anyUsed = totalUsed > 0

    return (
      <div>
        <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>
          Controle quantas vezes você lançou cada magia hoje. O total de usos é calculado automaticamente pela soma dos lançamentos individuais.
        </p>
        <div className="card">
          {/* Circle header — slot max config + remaining summary */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
            <div>
              <strong>{CIRCLE_NAMES[activeCircle]}</strong>
              {activeCircle > 0 && s.total_slots > 0 && (
                <div className="text-muted text-sm" style={{ marginTop: '0.2rem' }}>
                  <span style={{ color: remaining === 0 ? 'var(--danger)' : remaining <= 1 ? 'var(--warning)' : 'var(--success)', fontWeight: 700 }}>
                    {remaining}
                  </span> de {s.total_slots} usos restantes ({totalUsed} usados)
                </div>
              )}
            </div>
            {activeCircle > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Máx/dia</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {!locked ? (
                    <>
                      <button className="btn-ghost btn-sm" style={{ padding: '0.1rem 0.5rem' }} onClick={() => updateSlot(activeCircle, 'total_slots', -1)}>−</button>
                      <span style={{ fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{s.total_slots}</span>
                      <button className="btn-ghost btn-sm" style={{ padding: '0.1rem 0.5rem' }} onClick={() => updateSlot(activeCircle, 'total_slots', 1)}>+</button>
                    </>
                  ) : (
                    <span style={{ fontWeight: 700 }}>{s.total_slots}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Visual slot bar derived from totalUsed */}
          {activeCircle > 0 && s.total_slots > 0 && (
            <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {Array.from({ length: s.total_slots }, (_, i) => (
                <div key={i} style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: i < totalUsed ? 'var(--danger)' : 'var(--primary)',
                  opacity: i < totalUsed ? 0.4 : 1,
                  border: '2px solid var(--border)',
                }} />
              ))}
            </div>
          )}

          {/* Per-spell cast counters */}
          <div>
            <div className="text-muted text-sm" style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
              Magias conhecidas — controle individual de lançamentos:
            </div>
            {circleKnown.length === 0 && (
              <p className="text-muted text-sm">Nenhuma magia conhecida neste círculo. Adicione na aba "Magias Conhecidas".</p>
            )}
            {circleKnown.map(spell => {
              const timeCast = spell.times_cast || 0
              const canCast = activeCircle === 0 || remaining > 0
              return (
                <div key={spell.id} style={{
                  padding: '0.4rem 0.5rem', marginBottom: '0.35rem', borderRadius: 'var(--radius)',
                  background: timeCast > 0 ? 'var(--surface2)' : 'rgba(124,106,247,0.07)',
                  border: `1px solid ${timeCast > 0 ? 'var(--border)' : 'var(--primary)'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>{spell.name}</span>
                    {spell.school && (
                      <span className="badge badge-purple" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>{spell.school}</span>
                    )}
                    {timeCast > 0 && (
                      <span className="text-muted text-sm" style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                        ({timeCast}× hoje)
                      </span>
                    )}
                  </div>
                  {activeCircle > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <button
                        className="btn-ghost btn-sm"
                        style={{ padding: '0.1rem 0.5rem', fontSize: '0.8rem' }}
                        disabled={timeCast === 0}
                        onClick={() => useSpell(spell, -1)}
                      >−</button>
                      <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center', fontSize: '0.9rem' }}>{timeCast}</span>
                      <button
                        className="btn-primary btn-sm"
                        style={{ padding: '0.1rem 0.5rem', fontSize: '0.8rem' }}
                        disabled={!canCast}
                        onClick={() => useSpell(spell, 1)}
                        title={!canCast ? 'Sem usos restantes neste círculo' : 'Registrar lançamento'}
                      >⚡ +</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Reset all */}
          {anyUsed && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <button className="btn-ghost btn-sm" style={{ fontSize: '0.78rem' }} onClick={() => resetCircleUsed(activeCircle)}>
                ↺ Restaurar todos os usos deste círculo
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="mb-3">
        <Link to={`/characters/${id}`} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>← {char.name}</Link>
      </div>

      <div className="page-header">
        <div>
          <h1>Magias — {char.name}</h1>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
            <span className="badge badge-purple">{char.class_info?.name}</span>
            <span className="badge" style={{
              background: isPrepared ? 'rgba(76,175,125,0.15)' : 'rgba(240,168,67,0.15)',
              color: isPrepared ? 'var(--success)' : 'var(--warning)',
            }}>
              {isPrepared ? '📚 Conjurador Preparado' : '⚡ Conjurador Espontâneo'}
            </span>
          </div>
        </div>
      </div>

      {locked && (
        <div className="card" style={{ background: 'rgba(240,168,67,0.1)', border: '1px solid var(--warning)', marginBottom: '1rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🔒 Magias bloqueadas pelo Mestre. Você pode marcar magias como lançadas, mas não pode alterar sua lista ou preparação.
        </div>
      )}

      {/* Main tabs */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '1.5rem', borderBottom: '2px solid var(--border)' }}>
        {[
          { id: 'grimoire', label: isPrepared ? '📚 Grimório' : '📚 Magias Conhecidas' },
          { id: 'daily', label: isPrepared ? '🎯 Preparação Diária' : '⚡ Usos Diários' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.6rem 1.2rem', background: 'none', border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-2px',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === tab.id ? 700 : 400,
              fontSize: '0.9rem', cursor: 'pointer',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Circle tabs */}
      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {allActiveCircles.map(c => (
          <button key={c} onClick={() => setActiveCircle(c)}
            style={{
              padding: '0.3rem 0.75rem', fontSize: '0.8rem', borderRadius: 'var(--radius)',
              background: activeCircle === c ? 'var(--primary)' : 'var(--surface2)',
              color: activeCircle === c ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${activeCircle === c ? 'var(--primary)' : 'var(--border)'}`,
              cursor: 'pointer',
            }}>
            {c === 0 ? 'Truques' : `${c}º`}
            {knownSpells.filter(s => s.circle === c).length > 0 && (
              <span style={{ marginLeft: '0.3rem', background: 'rgba(255,255,255,0.2)', borderRadius: '99px', padding: '0 0.3rem', fontSize: '0.7rem' }}>
                {knownSpells.filter(s => s.circle === c).length}
              </span>
            )}
          </button>
        ))}
        {!locked && (
          <button className="btn-ghost btn-sm" style={{ fontSize: '0.8rem' }}
            onClick={() => {
              const maxCircle = Math.max(...allActiveCircles, -1)
              const next = Math.min(maxCircle + 1, 9)
              if (allActiveCircles.includes(next)) {
                setActiveCircle(next)
              } else if (next <= 9) {
                setActiveCircle(next)
                setSpellModal({ circle: next, name: '', school: '', description: '', components: '', casting_time: '', duration: '', range: '', saving_throw: '', notes: '' })
                setError('')
              }
            }}>+ Círculo</button>
        )}
      </div>

      {/* Tab content */}
      {activeTab === 'grimoire'
        ? renderGrimoireTab()
        : (isPrepared ? renderPreparationTab() : renderDailyUsesTab())}

      {/* Library search modal */}
      {showLibrarySearch && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 600, maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>Buscar na Biblioteca</h2>
              <button className="btn-ghost btn-sm" onClick={() => { setShowLibrarySearch(false); setLibraryResults([]) }}>✕</button>
            </div>
            <input
              autoFocus
              placeholder="Nome da magia..."
              value={librarySearch}
              onChange={e => searchLibrary(e.target.value)}
              style={{ marginBottom: '0.75rem' }}
            />
            {libraryLoading && <p className="text-muted text-sm">Buscando...</p>}
            {libraryResults.length === 0 && librarySearch && !libraryLoading && (
              <p className="text-muted text-sm">Nenhuma magia encontrada.</p>
            )}
            {libraryResults.map(spell => {
              const circle = detectCircle(spell)
              return (
                <div key={spell.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 500 }}>{spell.display_name || spell.name}</span>
                      {spell.school && <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>{spell.school}</span>}
                      <span className="badge badge-yellow" style={{ fontSize: '0.65rem' }}>Círculo {circle}</span>
                    </div>
                    {spell.description_short && <p className="text-muted text-sm" style={{ fontSize: '0.78rem', margin: '0.1rem 0 0' }}>{spell.description_short.substring(0, 100)}{spell.description_short.length > 100 ? '…' : ''}</p>}
                  </div>
                  <button
                    className="btn-primary btn-sm"
                    style={{ marginLeft: '0.75rem', whiteSpace: 'nowrap' }}
                    onClick={() => { addFromLibrary(spell); setShowLibrarySearch(false); setLibraryResults([]) }}
                  >+ Adicionar</button>
                </div>
              )
            })}
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => { setShowLibrarySearch(false); setLibraryResults([]) }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Spell modal */}
      {spellModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>{spellModal.id ? 'Editar Magia' : 'Adicionar Magia'}</h2>
              <button className="btn-ghost btn-sm" onClick={() => setSpellModal(null)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Nome</label>
                <input value={spellModal.name} onChange={e => setSpellModal(m => ({ ...m, name: e.target.value }))} autoFocus />
              </div>
              <div className="form-group">
                <label>Escola</label>
                <select value={spellModal.school || ''} onChange={e => setSpellModal(m => ({ ...m, school: e.target.value }))}>
                  <option value="">—</option>
                  {['Abjuração', 'Adivinhação', 'Conjuração', 'Encantamento', 'Evocação', 'Ilusão', 'Necromancia', 'Transmutação', 'Universal'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Círculo</label>
                <select value={spellModal.circle} onChange={e => setSpellModal(m => ({ ...m, circle: +e.target.value }))}>
                  {Array.from({ length: 10 }, (_, i) => <option key={i} value={i}>{CIRCLE_NAMES[i]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Tempo de Conjuração</label>
                <input value={spellModal.casting_time || ''} onChange={e => setSpellModal(m => ({ ...m, casting_time: e.target.value }))} placeholder="1 ação padrão" />
              </div>
              <div className="form-group">
                <label>Alcance</label>
                <input value={spellModal.range || ''} onChange={e => setSpellModal(m => ({ ...m, range: e.target.value }))} placeholder="Toque / 30 m" />
              </div>
              <div className="form-group">
                <label>Duração</label>
                <input value={spellModal.duration || ''} onChange={e => setSpellModal(m => ({ ...m, duration: e.target.value }))} placeholder="1 min/nível" />
              </div>
              <div className="form-group">
                <label>Teste de Resistência</label>
                <input value={spellModal.saving_throw || ''} onChange={e => setSpellModal(m => ({ ...m, saving_throw: e.target.value }))} placeholder="Fortitude nega" />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Componentes</label>
                <input value={spellModal.components || ''} onChange={e => setSpellModal(m => ({ ...m, components: e.target.value }))} placeholder="V, S, M" />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Descrição</label>
                <textarea rows={3} value={spellModal.description || ''} onChange={e => setSpellModal(m => ({ ...m, description: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Notas</label>
                <input value={spellModal.notes || ''} onChange={e => setSpellModal(m => ({ ...m, notes: e.target.value }))} />
              </div>
            </div>
            {error && <p className="error-msg">{error}</p>}
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setSpellModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={saveSpell} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
