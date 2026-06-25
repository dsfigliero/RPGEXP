import { useEffect, useState } from 'react'
import api from '../api'
import { useAuth } from '../AuthContext'

function parseMonsterJson(json) {
  try {
    const d = typeof json === 'string' ? JSON.parse(json) : json;

    // Parse attacks — handles both array (new schema) and string (legacy) for melee/ranged
    const attacks = [];

    function extractFromArray(src, suffix) {
      if (!src) return;
      if (Array.isArray(src)) {
        for (const item of src) {
          if (!item) continue;
          if (typeof item === 'string') {
            const trimmed = item.trim();
            if (!trimmed) continue;
            const dmgMatch = trimmed.match(/\(([^)]*\d+d\d+[^)]*)\)/i);
            const nameMatch = trimmed.match(/^(\+\d+\s+)?(.+?)(?:\s+\(|\s+\+\d+|\s*$)/);
            const name = nameMatch ? nameMatch[2].trim() : trimmed.replace(/\(.*\)/, '').trim();
            const damage = dmgMatch ? dmgMatch[1].replace(/plus.*$/i, '').trim() : '';
            if (name) attacks.push({ name: suffix ? `${name} (${suffix})` : name, damage });
          } else if (typeof item === 'object') {
            const name = item.name || item.attack || '';
            const damage = item.damage || item.damageBonus || '';
            if (name) attacks.push({ name: suffix ? `${name} (${suffix})` : name, damage });
          }
        }
      } else if (typeof src === 'string') {
        // Legacy string format
        const parts = src.split(' or ').flatMap(p => p.split(','));
        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed) continue;
          const dmgMatch = trimmed.match(/\(([^)]*\d+d\d+[^)]*)\)/i);
          const nameMatch = trimmed.match(/^(\+\d+\s+)?(.+?)(?:\s+\(|\s+\+\d+|\s*$)/);
          const name = nameMatch ? nameMatch[2].trim() : trimmed.replace(/\(.*\)/, '').trim();
          const damage = dmgMatch ? dmgMatch[1].replace(/plus.*$/i, '').trim() : '';
          if (name) attacks.push({ name: suffix ? `${name} (${suffix})` : name, damage });
        }
      }
    }

    extractFromArray(d.offense?.melee || d.melee, null);
    extractFromArray(d.offense?.ranged || d.ranged, 'distância');

    // Compose notes
    const subtypeStr = Array.isArray(d.subtype) ? d.subtype.join(', ') : (d.subtype || '');
    const saves = d.defense?.saves;
    const noteParts = [
      d.cr ? `CR ${d.cr}` : '',
      d.xp ? `XP ${d.xp}` : '',
      d.type ? d.type : '',
      subtypeStr ? `(${subtypeStr})` : '',
      d.alignment ? d.alignment : '',
      d.size ? d.size : '',
      saves ? `Fort ${saves.fort ?? 0}, Ref ${saves.ref ?? 0}, Von ${saves.will ?? 0}` : '',
      d.defense?.dr ? `DR ${d.defense.dr}` : '',
      d.defense?.sr ? `SR ${d.defense.sr}` : '',
      d.ecology?.environment ? d.ecology.environment : '',
      (!d.description_html && !d.description?.full && !d.description?.short) ? (typeof d.description === 'string' ? d.description : '') : '',
    ].filter(Boolean);

    return {
      name: d.name || d.displayName || '',
      max_hp: d.defense?.hp?.total ?? d.hp?.total ?? d.hp ?? 0,
      hp: d.defense?.hp?.total ?? d.hp?.total ?? d.hp ?? 0,
      ac: d.defense?.ac?.total ?? d.defense?.ac?.normal ?? d.ac?.normal ?? d.ac ?? 10,
      initiative: d.offense?.initiative?.total ?? d.initiative?.total ?? d.initiative ?? 0,
      notes: noteParts.join(' · '),
      attacks: JSON.stringify(attacks.length > 0 ? attacks : []),
      monster_data: JSON.stringify(d),
    };
  } catch(e) {
    return null;
  }
}

export default function MonsterLibrary() {
  const { user } = useAuth()
  const [monsters, setMonsters] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [jsonImport, setJsonImport] = useState('')

  async function load() {
    const { data } = await api.get('/monsters')
    setMonsters(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setModal({ name: '', hp: 0, max_hp: 0, ac: 10, initiative: 0, notes: '', attacks: [], monster_data: '' })
    setJsonImport('')
    setError('')
  }

  function openEdit(m) {
    let attacks = []
    try { attacks = JSON.parse(m.attacks || '[]') } catch(e) {}
    setModal({ id: m.id, name: m.name, hp: m.hp, max_hp: m.max_hp, ac: m.ac, initiative: m.initiative, notes: m.notes || '', attacks, monster_data: m.monster_data || '' })
    setJsonImport('')
    setError('')
  }

  function importJson() {
    const parsed = parseMonsterJson(jsonImport)
    if (!parsed) return setError('JSON inválido')
    setModal(m => ({ ...m, ...parsed, attacks: (() => { try { return JSON.parse(parsed.attacks) } catch(e) { return [] } })() }))
    setJsonImport('')
    setError('')
  }

  async function save() {
    if (!modal.name.trim()) return setError('Nome obrigatório')
    setSaving(true)
    try {
      const payload = { ...modal, attacks: JSON.stringify(modal.attacks), monster_data: modal.monster_data || null }
      if (modal.id) await api.put(`/monsters/${modal.id}`, payload)
      else await api.post('/monsters', payload)
      setModal(null)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  async function del(id) {
    if (!confirm('Excluir monstro da biblioteca?')) return
    await api.delete(`/monsters/${id}`)
    load()
  }

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>Biblioteca de Monstros</h1>
        <button className="btn-primary" onClick={openCreate}>+ Novo Monstro</button>
      </div>

      {monsters.length === 0
        ? <div className="card text-muted text-sm">Nenhum monstro salvo ainda.</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: '0.75rem' }}>
            {monsters.map(m => {
              let attacks = []; try { attacks = JSON.parse(m.attacks || '[]') } catch(e) {}
              return (
                <div key={m.id} className="card">
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{m.name}</div>
                  <div className="text-muted text-sm" style={{ marginBottom: '0.4rem' }}>
                    HP {m.max_hp} · CA {m.ac} · Inic {m.initiative}
                    {attacks.length > 0 && ` · ${attacks.length} ataque(s)`}
                  </div>
                  {m.notes && <div className="text-muted text-sm" style={{ marginBottom: '0.5rem', fontSize: '0.78rem' }}>{m.notes}</div>}
                  <div className="flex gap-2" style={{ marginTop: '0.5rem' }}>
                    <button className="btn-ghost btn-sm" onClick={() => openEdit(m)}>Editar</button>
                    <button className="btn-danger btn-sm" onClick={() => del(m.id)}>Excluir</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      {modal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>{modal.id ? 'Editar' : 'Novo'} Monstro</h2>
              <button className="btn-ghost btn-sm" onClick={() => setModal(null)}>✕</button>
            </div>

            {/* JSON Import */}
            <div className="form-group">
              <label>Importar JSON (Pathfinder 1e)</label>
              <textarea rows={3} value={jsonImport} onChange={e => setJsonImport(e.target.value)} placeholder='Cole o JSON do monstro aqui...' style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem' }} />
              <button className="btn-ghost btn-sm" style={{ marginTop: '0.3rem' }} onClick={importJson} disabled={!jsonImport.trim()}>Importar</button>
            </div>

            <hr style={{ margin: '0.75rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Nome</label><input value={modal.name} onChange={e => setModal(m => ({ ...m, name: e.target.value }))} autoFocus /></div>
              <div className="form-group"><label>HP Máximo</label><input type="number" min={0} value={modal.max_hp} onChange={e => setModal(m => ({ ...m, max_hp: +e.target.value, hp: +e.target.value }))} /></div>
              <div className="form-group"><label>CA</label><input type="number" min={0} value={modal.ac} onChange={e => setModal(m => ({ ...m, ac: +e.target.value }))} /></div>
              <div className="form-group"><label>Iniciativa</label><input type="number" value={modal.initiative} onChange={e => setModal(m => ({ ...m, initiative: +e.target.value }))} /></div>
            </div>

            <div className="form-group"><label>Notas / CR / Tipo</label><textarea rows={2} value={modal.notes} onChange={e => setModal(m => ({ ...m, notes: e.target.value }))} style={{ resize: 'vertical' }} /></div>

            {/* Attacks */}
            <div className="form-group">
              <label>Ataques</label>
              {modal.attacks.map((atk, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <input placeholder="Nome" value={atk.name} onChange={e => setModal(m => { const a = [...m.attacks]; a[i] = { ...a[i], name: e.target.value }; return { ...m, attacks: a } })} style={{ flex: 2 }} />
                  <input placeholder="Dano (ex: 1d6+3)" value={atk.damage} onChange={e => setModal(m => { const a = [...m.attacks]; a[i] = { ...a[i], damage: e.target.value }; return { ...m, attacks: a } })} style={{ flex: 2 }} />
                  <button className="btn-danger btn-sm" onClick={() => setModal(m => ({ ...m, attacks: m.attacks.filter((_, j) => j !== i) }))}>✕</button>
                </div>
              ))}
              <button className="btn-ghost btn-sm" onClick={() => setModal(m => ({ ...m, attacks: [...m.attacks, { name: '', damage: '' }] }))}>+ Ataque</button>
            </div>

            {error && <p className="error-msg">{error}</p>}
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
