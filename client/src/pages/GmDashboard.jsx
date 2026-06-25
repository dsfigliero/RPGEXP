import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'
import { useSessionEvents } from '../hooks/useSessionEvents'

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

function rollDice(notation) {
  if (!notation) return 0;
  const match = notation.match(/(\d+)d(\d+)([+-]\d+)?/i);
  if (!match) return parseInt(notation) || 0;
  const numDice = parseInt(match[1]);
  const dieSize = parseInt(match[2]);
  const modifier = parseInt(match[3] || '0');
  let total = modifier;
  for (let i = 0; i < numDice; i++) total += Math.floor(Math.random() * dieSize) + 1;
  return Math.max(0, total);
}

function parseMeleeAttacks(offense) {
  if (!offense) return [];
  const attacks = [];
  const process = (arr, type) => {
    if (!Array.isArray(arr)) return;
    arr.forEach(a => {
      if (typeof a === 'string') {
        attacks.push({ name: `${type}: ${a}`, damage: '', notes: '' });
      } else if (a && typeof a === 'object') {
        attacks.push({
          name: a.name || a.attack || type,
          damage: a.damage || a.damageBonus || '',
          notes: a.damageType || a.notes || ''
        });
      }
    });
  };
  process(offense.melee, 'Melê');
  process(offense.ranged, 'Distância');
  process(offense.specialAttacks, 'Especial');
  return attacks;
}

const CIRCLE_LABELS_SHORT = ['Trq', '1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º', '9º']

function GmSpellPanel({ charId, castingType, spellData, onToggleCast, onUseSpell }) {
  const [open, setOpen] = useState(false)
  const isPrepared = castingType === 'prepared'
  const slots = spellData?.slots || []
  const prepared = spellData?.prepared || []
  const known = spellData?.known || []
  const activeSlots = slots.filter(s => s.total_slots > 0)

  const allCircles = [...new Set([
    ...activeSlots.map(s => s.circle),
    ...prepared.map(p => p.circle),
    ...known.map(k => k.circle),
  ])].sort((a, b) => a - b)

  const hasData = allCircles.length > 0
  const isLoaded = spellData !== undefined

  // Header summary
  const headerSummary = (() => {
    if (!isLoaded || !hasData) return null
    if (isPrepared) {
      const available = prepared.filter(p => !p.is_cast).length
      if (prepared.length === 0) return null
      return (
        <span style={{ fontSize: '0.7rem', color: available === 0 ? 'var(--danger)' : 'var(--success)' }}>
          {available} disp
        </span>
      )
    } else {
      if (activeSlots.length === 0) return null
      return (
        <span style={{ display: 'flex', gap: '0.3rem' }}>
          {activeSlots.slice(0, 4).map(s => {
            const circleKnown = known.filter(k => k.circle === s.circle)
            const totalUsed = circleKnown.reduce((sum, sp) => sum + (sp.times_cast || 0), 0)
            const rem = Math.max(0, s.total_slots - totalUsed)
            return (
              <span key={s.circle} style={{ fontSize: '0.7rem', color: rem === 0 ? 'var(--danger)' : 'var(--success)' }}>
                {CIRCLE_LABELS_SHORT[s.circle]}:{rem}
              </span>
            )
          })}
        </span>
      )
    }
  })()

  return (
    <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
      <button
        className="btn-ghost btn-sm"
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}
      >
        <span>✨ Magias {isPrepared ? '(Prep.)' : '(Espon.)'}</span>
        <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {headerSummary}
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && !isLoaded && (
        <p className="text-muted text-sm" style={{ marginTop: '0.4rem', fontSize: '0.78rem' }}>Carregando...</p>
      )}
      {open && isLoaded && !hasData && (
        <p className="text-muted text-sm" style={{ marginTop: '0.4rem', fontSize: '0.78rem' }}>Sem magias configuradas.</p>
      )}
      {open && isLoaded && hasData && (
        <div style={{ marginTop: '0.5rem' }}>
          {isPrepared ? (
            // Prepared caster view: memorized spells with cast toggles
            allCircles.map(circle => {
              const circlePrep = prepared.filter(p => p.circle === circle)
              if (circlePrep.length === 0) return null
              const available = circlePrep.filter(p => !p.is_cast).length
              return (
                <div key={circle} style={{ marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    <span>{circle === 0 ? 'Truques' : `${circle}º Círculo`}</span>
                    <span style={{ color: available === 0 ? 'var(--danger)' : 'inherit' }}>{available} disp</span>
                  </div>
                  {circlePrep.map(prep => (
                    <div key={prep.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0.35rem', marginBottom: '0.15rem', borderRadius: 4, background: prep.is_cast ? 'var(--surface2)' : 'rgba(124,106,247,0.08)', opacity: prep.is_cast ? 0.6 : 1 }}>
                      <span style={{ fontSize: '0.8rem', textDecoration: prep.is_cast ? 'line-through' : 'none' }}>{prep.spell_name}</span>
                      <button
                        className={prep.is_cast ? 'btn-ghost btn-sm' : 'btn-primary btn-sm'}
                        style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}
                        onClick={() => onToggleCast(charId, prep.id)}
                      >{prep.is_cast ? '↺' : '✓'}</button>
                    </div>
                  ))}
                </div>
              )
            })
          ) : (
            // Spontaneous caster view: per-spell cast counters
            allCircles.map(circle => {
              const slot = slots.find(s => s.circle === circle) || { circle, total_slots: 0, used_slots: 0 }
              const circleKnown = known.filter(k => k.circle === circle)
              const totalUsed = circleKnown.reduce((sum, sp) => sum + (sp.times_cast || 0), 0)
              const remaining = Math.max(0, slot.total_slots - totalUsed)
              return (
                <div key={circle} style={{ marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    <span>{circle === 0 ? 'Truques' : `${circle}º Círculo`}</span>
                    {circle > 0 && slot.total_slots > 0 && (
                      <span style={{ fontWeight: 700, color: remaining === 0 ? 'var(--danger)' : 'var(--text)' }}>
                        {remaining}/{slot.total_slots} restantes
                      </span>
                    )}
                  </div>
                  {circleKnown.map(spell => {
                    const timeCast = spell.times_cast || 0
                    const canCast = circle === 0 || remaining > 0
                    return (
                      <div key={spell.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0.35rem', marginBottom: '0.1rem', fontSize: '0.78rem', borderLeft: `2px solid ${timeCast > 0 ? 'var(--primary)' : 'var(--border)'}` }}>
                        <span>
                          {spell.name}
                          {timeCast > 0 && <span style={{ marginLeft: '0.3rem', opacity: 0.7 }}>({timeCast}×)</span>}
                        </span>
                        {circle > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <button className="btn-ghost btn-sm" style={{ padding: '0.05rem 0.35rem', fontSize: '0.72rem' }} disabled={timeCast === 0} onClick={() => onUseSpell(charId, spell.id, -1)}>−</button>
                            <span style={{ minWidth: 14, textAlign: 'center', fontWeight: 700 }}>{timeCast}</span>
                            <button className="btn-primary btn-sm" style={{ padding: '0.05rem 0.35rem', fontSize: '0.72rem' }} disabled={!canCast} onClick={() => onUseSpell(charId, spell.id, 1)}>⚡</button>
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

export default function GmDashboard() {
  const { sessionId } = useParams()
  const [session, setSession] = useState(null)
  const [npcs, setNpcs] = useState([])
  const [evalItems, setEvalItems] = useState([])
  const [libraryMonsters, setLibraryMonsters] = useState([])
  const [loading, setLoading] = useState(true)
  const [fields, setFields] = useState({ hp: true, ca: true, iniciativa: true, nivel: true, classe: true })
  const [sortByInit, setSortByInit] = useState(false)
  const [npcModal, setNpcModal] = useState(null)
  const [actionModal, setActionModal] = useState(null)
  const [actionForm, setActionForm] = useState({ evaluation_item_id: '', quantity: 1 })
  const [actionFeedback, setActionFeedback] = useState(null)
  const [damageModal, setDamageModal] = useState(null)
  const [editingInit, setEditingInit] = useState(null)
  const [initInputValue, setInitInputValue] = useState({})
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [combatLog, setCombatLog] = useState([])
  const [showLog, setShowLog] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [charSpellData, setCharSpellData] = useState({}) // { [charId]: { slots, prepared } }

  async function loadAllSpells(participants) {
    const results = {}
    await Promise.all((participants || []).filter(p => !p.is_npc && p.uses_magic === 1).map(async p => {
      try {
        const [slotsRes, prepRes, knownRes] = await Promise.all([
          api.get(`/characters/${p.id}/spell-slots`),
          api.get(`/characters/${p.id}/prepared-spells`),
          api.get(`/characters/${p.id}/spells`),
        ])
        results[p.id] = { slots: slotsRes.data, prepared: prepRes.data, known: knownRes.data }
      } catch (_) {}
    }))
    setCharSpellData(results)
  }

  async function gmToggleCast(charId, prepId) {
    await api.patch(`/characters/${charId}/prepared-spells/${prepId}/cast`, {})
    const r = await api.get(`/characters/${charId}/prepared-spells`)
    setCharSpellData(prev => ({ ...prev, [charId]: { ...prev[charId], prepared: r.data } }))
  }

  async function gmUseSpell(charId, spellId, delta) {
    const r = await api.patch(`/characters/${charId}/spells/${spellId}/use`, { delta })
    setCharSpellData(prev => ({
      ...prev,
      [charId]: {
        ...prev[charId],
        known: (prev[charId]?.known || []).map(s => s.id === spellId ? r.data : s),
      },
    }))
  }

  async function load() {
    const [sessRes, npcsRes, itemsRes, libRes] = await Promise.all([
      api.get(`/sessions/${sessionId}`),
      api.get(`/sessions/${sessionId}/npcs`),
      api.get('/evaluation-items'),
      api.get('/monsters').catch(() => ({ data: [] })),
    ])
    setSession(sessRes.data)
    setNpcs(npcsRes.data)
    setEvalItems(itemsRes.data)
    setLibraryMonsters(libRes.data)
    setLoading(false)
    if (showLog) loadCombatLog();
    loadAllSpells(sessRes.data.participants || [])
  }

  async function loadCombatLog() {
    const r = await api.get(`/sessions/${sessionId}/combat/log`);
    setCombatLog(r.data);
  }

  useEffect(() => { load() }, [sessionId])

  useSessionEvents(sessionId, async (event) => {
    if (event.type === 'spells_updated') {
      const charId = event.character_id
      try {
        const [slotsRes, prepRes, knownRes] = await Promise.all([
          api.get(`/characters/${charId}/spell-slots`),
          api.get(`/characters/${charId}/prepared-spells`),
          api.get(`/characters/${charId}/spells`),
        ])
        setCharSpellData(prev => ({ ...prev, [charId]: { slots: slotsRes.data, prepared: prepRes.data, known: knownRes.data } }))
      } catch (_) {}
    }
  })

  function toggleField(f) {
    setFields(prev => ({ ...prev, [f]: !prev[f] }))
  }

  function openNpcCreate() {
    setNpcModal({ name: '', hp: 0, max_hp: 0, ac: 10, initiative: 0, notes: '', attacks: [], monster_data: '', jsonInput: '', jsonError: '' })
    setError('')
  }

  function openNpcEdit(npc) {
    const parsedAttacks = (() => { try { return JSON.parse(npc.attacks || '[]'); } catch(e) { return []; } })();
    setNpcModal({ id: npc.id, name: npc.name, hp: npc.hp, max_hp: npc.max_hp, ac: npc.ac, initiative: npc.initiative, notes: npc.notes, attacks: parsedAttacks, monster_data: npc.monster_data || '', jsonInput: '', jsonError: '' })
    setError('')
  }

  async function saveNpc() {
    if (!npcModal.name.trim()) return setError('Nome obrigatório')
    setSaving(true)
    try {
      if (npcModal.id) {
        await api.put(`/sessions/${sessionId}/npcs/${npcModal.id}`, {
          name: npcModal.name, hp: npcModal.hp, max_hp: npcModal.max_hp,
          ac: npcModal.ac, initiative: npcModal.initiative, notes: npcModal.notes,
          attacks: JSON.stringify(npcModal.attacks)
        })
      } else {
        await api.post(`/sessions/${sessionId}/npcs`, {
          name: npcModal.name, hp: npcModal.hp, max_hp: npcModal.max_hp,
          ac: npcModal.ac, initiative: npcModal.initiative, notes: npcModal.notes,
          attacks: JSON.stringify(npcModal.attacks)
        })
      }
      setNpcModal(null)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function deleteNpc(npcId) {
    if (!confirm('Excluir NPC?')) return
    await api.delete(`/sessions/${sessionId}/npcs/${npcId}`)
    load()
  }

  function openDamageModal(p) {
    setDamageModal({ char: p, newHp: p.hp, lastRoll: null })
    setError('')
  }

  async function applyDamage() {
    if (!damageModal) return;
    const { char, newHp, lastRoll } = damageModal;
    const damage = char.hp - newHp;
    setSaving(true);
    try {
      await api.post(`/sessions/${sessionId}/combat/damage`, {
        character_id: char.id,
        damage,
        attacker_name: lastRoll?.attacker || '',
        attack_name: lastRoll?.attackName || '',
        roll_notation: lastRoll?.notation || '',
        roll_result: lastRoll?.result || 0,
      });
      setDamageModal(null);
      load();
      if (showLog) loadCombatLog();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao aplicar');
    } finally { setSaving(false); }
  }

  async function updateInitiative(card, newInitiative) {
    if (card._type === 'player') {
      await api.patch(`/sessions/${sessionId}/participants/${card.id}/initiative`, { initiative: newInitiative });
    } else {
      await api.put(`/sessions/${sessionId}/npcs/${card.id}`, { ...card, initiative: newInitiative, attacks: card.attacks || '[]' });
    }
    load();
  }

  function handleDragStart(e, index) {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }

  function handleDrop(e, dropIndex) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) { setDragIndex(null); setDragOverIndex(null); return; }
    const dragged = sorted[dragIndex];
    const newSorted = sorted.filter((_, i) => i !== dragIndex);
    const cardBefore = dropIndex === 0 ? newSorted[0] : newSorted[dropIndex - 1];
    const newInit = cardBefore ? cardInitiative(cardBefore) : cardInitiative(dragged);
    setDragIndex(null);
    setDragOverIndex(null);
    updateInitiative(dragged, newInit);
  }

  function openActionModal(participant) {
    setActionModal({ character_id: participant.id, character_name: participant.name })
    setActionForm({ evaluation_item_id: '', quantity: 1 })
    setError('')
  }

  async function submitAction() {
    if (!actionForm.evaluation_item_id) return setError('Selecione um item')
    setSaving(true)
    try {
      await api.post(`/sessions/${sessionId}/actions`, { character_id: actionModal.character_id, evaluation_item_id: actionForm.evaluation_item_id, quantity: actionForm.quantity })
      setActionFeedback(actionModal.character_id)
      setActionModal(null)
      setTimeout(() => setActionFeedback(null), 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao registrar')
    } finally {
      setSaving(false)
    }
  }

  function importMonsterJson() {
    try {
      const data = JSON.parse(npcModal.jsonInput);
      const attacks = parseMeleeAttacks(data.offense);
      setNpcModal(m => ({
        ...m,
        name: data.displayName || data.name || m.name,
        hp: data.defense?.hp?.total || m.hp,
        max_hp: data.defense?.hp?.total || m.max_hp,
        ac: data.defense?.ac?.total || m.ac,
        initiative: data.initiative || m.initiative,
        attacks: attacks.length > 0 ? attacks : m.attacks,
        jsonInput: '',
        jsonError: ''
      }));
    } catch(e) {
      setNpcModal(m => ({ ...m, jsonError: 'JSON inválido: ' + e.message }));
    }
  }

  if (loading) return <div className="page"><div className="spinner" /></div>
  if (!session) return <div className="page"><p className="text-muted">Sessão não encontrada.</p></div>

  const backLink = session.campaign_id ? `/campaigns/${session.campaign_id}` : `/sessions/${session.id}`
  const participants = session.participants || []

  const allCards = [
    ...participants.map(p => ({ ...p, _type: 'player' })),
    ...npcs.map(n => ({ ...n, _type: 'npc' })),
  ]

  function cardInitiative(card) {
    return card._type === 'player' ? (card.encounter_initiative ?? 0) : (card.initiative || 0);
  }

  const sorted = sortByInit
    ? [...allCards].sort((a, b) => cardInitiative(b) - cardInitiative(a))
    : allCards

  return (
    <div className="page">
      <div className="mb-3">
        <Link to={backLink} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>← Voltar</Link>
      </div>

      <div className="page-header">
        <h1>Dashboard — {session.name}</h1>
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={() => setShowSettings(s => !s)} title="Configurações da sessão">⚙️ Configurações</button>
          <button className="btn-primary btn-sm" onClick={openNpcCreate}>+ NPC</button>
        </div>
      </div>

      {showSettings && (
        <div className="card" style={{ marginBottom: '1rem', background: 'var(--surface2)' }}>
          <strong style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.9rem' }}>Configurações da Sessão</strong>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
            <input type="checkbox"
              checked={!!session?.show_hp_to_players}
              onChange={async e => {
                await api.patch(`/sessions/${sessionId}/config`, { show_hp_to_players: e.target.checked })
                load()
              }}
            />
            <span>Mostrar HP dos personagens para os jogadores no painel Ao Vivo</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', marginTop: '0.5rem' }}>
            <input type="checkbox"
              checked={!!session?.spells_locked}
              onChange={async e => {
                await api.patch(`/sessions/${sessionId}/config`, { spells_locked: e.target.checked })
                load()
              }}
            />
            <span>🔒 Bloquear alterações de magias dos jogadores</span>
          </label>
        </div>
      )}

      <div className="flex gap-2 mb-3" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
        {[['hp', 'HP'], ['ca', 'CA'], ['iniciativa', 'Iniciativa'], ['nivel', 'Nível'], ['classe', 'Classe']].map(([key, label]) => (
          <button key={key} className={fields[key] ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'} onClick={() => toggleField(key)}>
            {label}
          </button>
        ))}
        <button className={sortByInit ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'} onClick={() => setSortByInit(v => !v)}>
          ↕ Por Iniciativa
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: '1rem' }}>
        {sorted.map((card, idx) => {
          if (card._type === 'player') {
            const p = card
            return (
              <div
                key={`player-${p.id}`}
                className="card"
                draggable={sortByInit}
                onDragStart={sortByInit ? (e) => handleDragStart(e, idx) : undefined}
                onDragOver={sortByInit ? (e) => handleDragOver(e, idx) : undefined}
                onDrop={sortByInit ? (e) => handleDrop(e, idx) : undefined}
                style={{
                  display: 'flex', flexDirection: 'column', gap: '0.4rem',
                  cursor: sortByInit ? 'grab' : 'default',
                  outline: dragOverIndex === idx ? '2px dashed var(--primary)' : undefined,
                  opacity: dragIndex === idx ? 0.5 : 1,
                }}
              >
                <Link to={`/characters/${p.id}?back=/dashboard/${sessionId}`} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>
                  ⚔️ {p.name}
                </Link>
                {(fields.classe || fields.nivel) && (
                  <div className="text-muted text-sm">
                    {fields.classe && p.class && <span>{p.class}</span>}
                    {fields.classe && p.class && fields.nivel && <span> • </span>}
                    {fields.nivel && <span>Nv {p.level}</span>}
                  </div>
                )}
                {fields.hp && (
                  <div onClick={() => openDamageModal(p)} style={{ cursor: 'pointer' }} title="Clique para aplicar dano">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span>HP</span><span style={{ color: p.hp === 0 ? 'var(--danger)' : 'inherit' }}>{p.hp}/{p.max_hp}</span>
                    </div>
                    <HpBar hp={p.hp} maxHp={p.max_hp} />
                  </div>
                )}
                {(fields.ca || fields.iniciativa) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    {fields.ca && <span>CA: {p.ac}</span>}
                    {fields.iniciativa && (
                      editingInit === `player-${p.id}`
                        ? <input type="number"
                            value={initInputValue[`player-${p.id}`] ?? (p.encounter_initiative ?? 0)}
                            autoFocus
                            style={{ width: 55, fontSize: '0.85rem', padding: '0.1rem 0.3rem' }}
                            onChange={e => setInitInputValue(v => ({ ...v, [`player-${p.id}`]: +e.target.value }))}
                            onBlur={() => { updateInitiative(p, initInputValue[`player-${p.id}`] ?? 0); setEditingInit(null); }}
                            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingInit(null); }} />
                        : <span style={{ cursor: 'pointer', textDecoration: 'underline dotted' }} onClick={() => { setEditingInit(`player-${p.id}`); setInitInputValue(v => ({ ...v, [`player-${p.id}`]: p.encounter_initiative ?? 0 })) }} title="Clique para editar iniciativa">
                            Inic: {p.encounter_initiative != null ? `${p.encounter_initiative} (bônus: ${p.init_bonus >= 0 ? '+' : ''}${p.init_bonus})` : `— (bônus: ${p.init_bonus >= 0 ? '+' : ''}${p.init_bonus})`}
                          </span>
                    )}
                  </div>
                )}
                <button className="btn-ghost btn-sm" onClick={() => openActionModal(p)} style={{ marginTop: '0.25rem', width: '100%' }}>
                  {actionFeedback === p.id ? '✓ Registrado!' : '⚡ Registrar Ação'}
                </button>
                {p.uses_magic === 1 && (
                  <GmSpellPanel
                    charId={p.id}
                    castingType={p.casting_type}
                    spellData={charSpellData[p.id]}
                    onToggleCast={gmToggleCast}
                    onUseSpell={gmUseSpell}
                  />
                )}
              </div>
            )
          } else {
            const n = card
            return (
              <div
                key={`npc-${n.id}`}
                className="card"
                draggable={sortByInit}
                onDragStart={sortByInit ? (e) => handleDragStart(e, idx) : undefined}
                onDragOver={sortByInit ? (e) => handleDragOver(e, idx) : undefined}
                onDrop={sortByInit ? (e) => handleDrop(e, idx) : undefined}
                style={{
                  display: 'flex', flexDirection: 'column', gap: '0.4rem',
                  cursor: sortByInit ? 'grab' : 'default',
                  outline: dragOverIndex === idx ? '2px dashed var(--primary)' : undefined,
                  opacity: dragIndex === idx ? 0.5 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: n.hp === 0 ? 'var(--danger)' : 'inherit' }}>
                    👹 {n.name}
                  </span>
                  <span className={`badge ${n.hp === 0 ? '' : 'badge-yellow'}`}>{n.hp === 0 ? 'Derrotado' : 'NPC'}</span>
                </div>
                {fields.hp && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span>HP</span><span>{n.hp}/{n.max_hp}</span>
                    </div>
                    <HpBar hp={n.hp} maxHp={n.max_hp} />
                  </div>
                )}
                {(fields.ca || fields.iniciativa) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    {fields.ca && <span>CA: {n.ac}</span>}
                    {fields.iniciativa && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        {editingInit === `npc-${n.id}`
                          ? <input type="number"
                              value={initInputValue[`npc-${n.id}`] ?? n.initiative ?? 0}
                              autoFocus
                              style={{ width: 55, fontSize: '0.85rem', padding: '0.1rem 0.3rem' }}
                              onChange={e => setInitInputValue(v => ({ ...v, [`npc-${n.id}`]: +e.target.value }))}
                              onBlur={() => { updateInitiative(n, initInputValue[`npc-${n.id}`] ?? 0); setEditingInit(null); }}
                              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingInit(null); }} />
                          : <>
                              <span style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
                                onClick={() => { setEditingInit(`npc-${n.id}`); setInitInputValue(v => ({ ...v, [`npc-${n.id}`]: n.initiative || 0 })) }}
                                title="Clique para editar">
                                Inic: {n.initiative}
                              </span>
                              <button className="btn-ghost btn-sm" style={{ padding: '0.1rem 0.3rem', fontSize: '0.75rem' }}
                                title="Rolar 1d20 + modificador"
                                onClick={() => {
                                  const roll = Math.floor(Math.random() * 20) + 1 + (n.initiative || 0);
                                  updateInitiative(n, roll);
                                }}>
                                🎲
                              </button>
                            </>
                        }
                      </div>
                    )}
                  </div>
                )}
                {n.notes && <div className="text-muted text-sm">{n.notes}</div>}
                <div className="flex gap-2" style={{ marginTop: '0.25rem' }}>
                  <button className="btn-ghost btn-sm" onClick={() => openNpcEdit(n)}>Editar</button>
                  <button className="btn-danger btn-sm" onClick={() => deleteNpc(n.id)}>Excluir</button>
                </div>
              </div>
            )
          }
        })}
      </div>

      <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
        <button className="btn-ghost btn-sm" onClick={() => { setShowLog(v => !v); if (!showLog) loadCombatLog(); }}>
          {showLog ? '▲' : '▼'} Log de Combate
        </button>
        {showLog && (
          <div style={{ marginTop: '0.75rem' }}>
            {combatLog.length === 0
              ? <p className="text-muted text-sm">Nenhum evento de combate.</p>
              : (
                <div className="card" style={{ padding: 0 }}>
                  <table>
                    <thead>
                      <tr><th>Alvo</th><th>Atacante</th><th>Ataque</th><th>Dano</th><th>HP</th><th>Hora</th></tr>
                    </thead>
                    <tbody>
                      {combatLog.map(log => (
                        <tr key={log.id}>
                          <td style={{ fontWeight: 500 }}>{log.target_name}</td>
                          <td className="text-muted">{log.attacker_name || '—'}</td>
                          <td className="text-muted">{log.attack_name ? `${log.attack_name}${log.roll_notation ? ` (${log.roll_notation}=${log.roll_result})` : ''}` : '—'}</td>
                          <td style={{ color: 'var(--danger)', fontWeight: 600 }}>-{log.damage_dealt}</td>
                          <td className="text-muted">{log.hp_before}→{log.hp_after}</td>
                          <td className="text-muted">{new Date(log.created_at).toLocaleTimeString('pt-BR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        )}
      </div>

      {npcModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>{npcModal.id ? 'Editar NPC' : 'Novo NPC'}</h2>
              <button className="btn-ghost btn-sm" onClick={() => setNpcModal(null)}>✕</button>
            </div>
            {libraryMonsters.length > 0 && (
              <div className="form-group">
                <label>Carregar da Biblioteca</label>
                <select defaultValue="" onChange={e => {
                  if (!e.target.value) return
                  const m = libraryMonsters.find(x => x.id === +e.target.value)
                  if (!m) return
                  let attacks = []; try { attacks = JSON.parse(m.attacks || '[]') } catch(err) {}
                  setNpcModal(prev => ({
                    ...prev,
                    name: m.name,
                    hp: m.max_hp,
                    max_hp: m.max_hp,
                    ac: m.ac,
                    initiative: m.initiative,
                    notes: m.notes || '',
                    attacks,
                    monster_data: m.monster_data || '',
                  }))
                  e.target.value = ''
                }}>
                  <option value="">— Selecione da biblioteca —</option>
                  {libraryMonsters.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Nome</label>
              <input value={npcModal.name} onChange={e => setNpcModal(m => ({ ...m, name: e.target.value }))} autoFocus />
            </div>
            <div className="form-group">
              <label>PV Atual</label>
              <input type="number" min={0} value={npcModal.hp} onChange={e => setNpcModal(m => ({ ...m, hp: +e.target.value }))} />
            </div>
            <div className="form-group">
              <label>PV Máximo</label>
              <input type="number" min={0} value={npcModal.max_hp} onChange={e => setNpcModal(m => ({ ...m, max_hp: +e.target.value }))} />
            </div>
            <div className="form-group">
              <label>CA</label>
              <input type="number" min={0} value={npcModal.ac} onChange={e => setNpcModal(m => ({ ...m, ac: +e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Iniciativa</label>
              <input type="number" value={npcModal.initiative} onChange={e => setNpcModal(m => ({ ...m, initiative: +e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Notas</label>
              <input value={npcModal.notes} onChange={e => setNpcModal(m => ({ ...m, notes: e.target.value }))} />
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Ataques</span>
                <button className="btn-ghost btn-sm" type="button"
                  onClick={() => setNpcModal(m => ({ ...m, attacks: [...m.attacks, { name: '', damage: '', notes: '' }] }))}>
                  + Adicionar
                </button>
              </div>
              {npcModal.attacks.map((atk, i) => (
                <div key={i} className="flex gap-2" style={{ marginBottom: '0.4rem', alignItems: 'center' }}>
                  <input placeholder="Nome" value={atk.name} style={{ flex: 2 }}
                    onChange={e => setNpcModal(m => { const a = [...m.attacks]; a[i] = { ...a[i], name: e.target.value }; return { ...m, attacks: a }; })} />
                  <input placeholder="Dano (ex: 1d6+2)" value={atk.damage} style={{ flex: 2 }}
                    onChange={e => setNpcModal(m => { const a = [...m.attacks]; a[i] = { ...a[i], damage: e.target.value }; return { ...m, attacks: a }; })} />
                  <input placeholder="Notas" value={atk.notes} style={{ flex: 2 }}
                    onChange={e => setNpcModal(m => { const a = [...m.attacks]; a[i] = { ...a[i], notes: e.target.value }; return { ...m, attacks: a }; })} />
                  <button className="btn-danger btn-sm" type="button"
                    onClick={() => setNpcModal(m => ({ ...m, attacks: m.attacks.filter((_, j) => j !== i) }))}>✕</button>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Importar de JSON (Pathfinder 1e)</span>
              <textarea
                placeholder='Cole o JSON do monstro aqui...'
                value={npcModal.jsonInput}
                onChange={e => setNpcModal(m => ({ ...m, jsonInput: e.target.value, jsonError: '' }))}
                rows={4}
                style={{ width: '100%', marginTop: '0.5rem', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.75rem' }}
              />
              {npcModal.jsonError && <p className="error-msg">{npcModal.jsonError}</p>}
              <button className="btn-ghost btn-sm" type="button" onClick={importMonsterJson} disabled={!npcModal.jsonInput.trim()}>
                Importar
              </button>
            </div>

            {error && <p className="error-msg">{error}</p>}
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setNpcModal(null)}>Cancelar</button>
              <button className="btn-ghost btn-sm" onClick={async () => {
                await api.post('/monsters', {
                  name: npcModal.name,
                  hp: npcModal.max_hp,
                  max_hp: npcModal.max_hp,
                  ac: npcModal.ac,
                  initiative: npcModal.initiative,
                  notes: npcModal.notes,
                  attacks: JSON.stringify(npcModal.attacks || []),
                  monster_data: npcModal.monster_data || null,
                })
                alert(`"${npcModal.name}" salvo na biblioteca!`)
                load()
              }} disabled={!npcModal.name}>Salvar na Biblioteca</button>
              <button className="btn-primary" onClick={saveNpc} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {damageModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2>Ajustar HP — {damageModal.char.name}</h2>
              <button className="btn-ghost btn-sm" onClick={() => { setDamageModal(null); setError(''); }}>✕</button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.3rem' }}>
                <span>HP Atual: <strong>{damageModal.char.hp}/{damageModal.char.max_hp}</strong></span>
                <span style={{ color: damageModal.newHp > damageModal.char.hp ? 'var(--success)' : damageModal.newHp < damageModal.char.hp ? 'var(--danger)' : 'inherit' }}>
                  {damageModal.newHp > damageModal.char.hp ? `+${damageModal.newHp - damageModal.char.hp} cura` :
                   damageModal.newHp < damageModal.char.hp ? `-${damageModal.char.hp - damageModal.newHp} dano` : 'sem alteração'}
                </span>
              </div>
              <HpBar hp={damageModal.newHp} maxHp={damageModal.char.max_hp} />
              <div style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 700, margin: '0.4rem 0' }}>
                {damageModal.newHp} / {damageModal.char.max_hp}
              </div>
            </div>

            <div className="form-group">
              <label>Novo HP (arraste para ajustar)</label>
              <input type="range" min={0} max={damageModal.char.max_hp || 100}
                value={damageModal.newHp}
                onChange={e => setDamageModal(m => ({ ...m, newHp: +e.target.value, lastRoll: m.lastRoll }))}
                style={{ width: '100%' }} />
              {damageModal.lastRoll && (
                <p className="text-muted text-sm" style={{ marginTop: '0.25rem' }}>
                  {damageModal.lastRoll.attacker} — {damageModal.lastRoll.attackName}: {damageModal.lastRoll.notation} = <strong>{damageModal.lastRoll.result}</strong>
                </p>
              )}
            </div>

            {(() => {
              const activeNpcs = npcs.filter(n => n.hp > 0);
              if (activeNpcs.length === 0) return null;
              return (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginBottom: '0.75rem' }}>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                    Ataques dos Inimigos Ativos
                  </p>
                  {activeNpcs.map(npc => {
                    let attacks = [];
                    try { attacks = JSON.parse(npc.attacks || '[]'); } catch(e) {}
                    if (attacks.length === 0) return null;
                    return (
                      <div key={npc.id} style={{ marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>👹 {npc.name} ({npc.hp}/{npc.max_hp} HP)</span>
                        <div className="flex" style={{ flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.25rem' }}>
                          {attacks.map((atk, i) => (
                            <button key={i} className="btn-ghost btn-sm" style={{ fontSize: '0.78rem' }}
                              onClick={() => {
                                const result = rollDice(atk.damage);
                                const newHp = Math.max(0, damageModal.char.hp - result);
                                setDamageModal(m => ({
                                  ...m,
                                  newHp,
                                  lastRoll: { attacker: npc.name, attackName: atk.name, notation: atk.damage, result }
                                }));
                              }}
                            >
                              {atk.name}{atk.damage ? ` (${atk.damage})` : ''}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {error && <p className="error-msg">{error}</p>}
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => { setDamageModal(null); setError(''); }}>Cancelar</button>
              <button
                className={damageModal.newHp < damageModal.char.hp ? 'btn-danger' : 'btn-primary'}
                onClick={applyDamage}
                disabled={saving || damageModal.newHp === damageModal.char.hp}
              >
                {saving ? 'Aplicando...' : damageModal.newHp === damageModal.char.hp ? 'Sem Alteração' :
                 damageModal.newHp < damageModal.char.hp ? `Aplicar ${damageModal.char.hp - damageModal.newHp} de Dano` :
                 `Curar ${damageModal.newHp - damageModal.char.hp} de HP`}
              </button>
            </div>
          </div>
        </div>
      )}

      {actionModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>Registrar Ação — {actionModal.character_name}</h2>
              <button className="btn-ghost btn-sm" onClick={() => setActionModal(null)}>✕</button>
            </div>
            <div className="form-group">
              <label>Item de Avaliação</label>
              <select value={actionForm.evaluation_item_id} onChange={e => setActionForm(f => ({ ...f, evaluation_item_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {evalItems.map(i => (
                  <option key={i.id} value={i.id}>{i.name} ({i.xp_value.toLocaleString('pt-BR')} XP)</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Quantidade</label>
              <input type="number" min={1} value={actionForm.quantity} onChange={e => setActionForm(f => ({ ...f, quantity: +e.target.value }))} />
            </div>
            {error && <p className="error-msg">{error}</p>}
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setActionModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={submitAction} disabled={saving}>{saving ? 'Registrando...' : 'Registrar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
