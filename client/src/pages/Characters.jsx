import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function Characters() {
  const [characters, setCharacters] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const [charsRes, classesRes] = await Promise.all([
      api.get('/characters'),
      api.get('/classes').catch(() => ({ data: [] })),
    ])
    setCharacters(charsRes.data)
    setClasses(classesRes.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setModal({ name: '', class: '', class_id: null, level: 1, race: '', alignment: '', speed: 30,
      hp: 0, max_hp: 0, ac: 10, initiative: 0,
      str_score: 10, dex_score: 10, con_score: 10, int_score: 10, wis_score: 10, cha_score: 10,
      bab: 0, cmb: 0, cmd: 10, spell_resistance: 0,
      fortitude: 0, will_save: 0, reflex: 0, char_notes: '' })
    setError('')
  }

  async function save() {
    if (!modal.name.trim()) return setError('Nome obrigatório')
    setSaving(true)
    try {
      await api.post('/characters', modal)
      setModal(null)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function del(id) {
    if (!confirm('Excluir personagem?')) return
    await api.delete(`/characters/${id}`)
    load()
  }

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>Meus Personagens</h1>
        <button className="btn-primary" onClick={openCreate}>+ Adicionar</button>
      </div>

      {characters.length === 0
        ? <div className="card text-muted text-sm">Nenhum personagem cadastrado ainda.</div>
        : (
          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Classe</th>
                  <th>Nível</th>
                  <th>XP Total</th>
                  <th>HP</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {characters.map(c => (
                  <tr key={c.id}>
                    <td><Link to={`/characters/${c.id}`} style={{ fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>{c.name}</Link></td>
                    <td className="text-muted">{c.class || '—'}</td>
                    <td><span className="badge badge-purple">Nível {c.level}</span></td>
                    <td>{c.total_xp.toLocaleString('pt-BR')} XP</td>
                    <td className="text-muted">{c.hp}/{c.max_hp}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn-danger btn-sm" onClick={() => del(c.id)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {modal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>Novo Personagem</h2>
              <button className="btn-ghost btn-sm" onClick={() => setModal(null)}>✕</button>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Informações Gerais</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
              <div className="form-group"><label>Nome</label><input value={modal.name} onChange={e => setModal(m => ({ ...m, name: e.target.value }))} autoFocus /></div>
              <div className="form-group">
                <label>Classe</label>
                <select value={modal.class_id || ''} onChange={e => {
                  const cls = classes.find(c => c.id === +e.target.value)
                  setModal(m => ({ ...m, class_id: e.target.value ? +e.target.value : null, class: cls ? cls.name : '' }))
                }}>
                  <option value="">Selecione uma classe...</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.uses_magic ? ' ✨' : ''}</option>
                  ))}
                </select>
              </div>
              <div className="form-group"><label>Raça</label><input value={modal.race} onChange={e => setModal(m => ({ ...m, race: e.target.value }))} /></div>
              <div className="form-group"><label>Nível</label><input type="number" min={1} value={modal.level} onChange={e => setModal(m => ({ ...m, level: +e.target.value }))} /></div>
              <div className="form-group"><label>Alinhamento</label>
                <select value={modal.alignment} onChange={e => setModal(m => ({ ...m, alignment: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {['Leal e Bom','Neutro e Bom','Caótico e Bom','Leal e Neutro','Neutro','Caótico e Neutro','Leal e Mau','Neutro e Mau','Caótico e Mau'].map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 1rem' }}>PV e Defesa</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 1rem' }}>
              <div className="form-group"><label>PV Máximo</label><input type="number" min={0} value={modal.max_hp} onChange={e => setModal(m => ({ ...m, max_hp: +e.target.value }))} /></div>
              <div className="form-group"><label>PV Atual</label><input type="number" min={0} value={modal.hp} onChange={e => setModal(m => ({ ...m, hp: +e.target.value }))} /></div>
              <div className="form-group"><label>CA</label><input type="number" min={0} value={modal.ac} onChange={e => setModal(m => ({ ...m, ac: +e.target.value }))} /></div>
              <div className="form-group"><label>Iniciativa</label><input type="number" value={modal.initiative} onChange={e => setModal(m => ({ ...m, initiative: +e.target.value }))} /></div>
              <div className="form-group"><label>BAB</label><input type="number" min={0} value={modal.bab} onChange={e => setModal(m => ({ ...m, bab: +e.target.value }))} /></div>
              <div className="form-group"><label>Velocidade (m)</label><input type="number" min={0} value={modal.speed} onChange={e => setModal(m => ({ ...m, speed: +e.target.value }))} /></div>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 1rem' }}>Atributos</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0 0.5rem' }}>
              {[['FOR','str_score'],['DES','dex_score'],['CON','con_score'],['INT','int_score'],['SAB','wis_score'],['CAR','cha_score']].map(([label, key]) => (
                <div key={key} className="form-group"><label>{label}</label><input type="number" min={1} max={30} value={modal[key]} onChange={e => setModal(m => ({ ...m, [key]: +e.target.value }))} /></div>
              ))}
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 1rem' }}>Testes de Resistência</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 1rem' }}>
              <div className="form-group"><label>Fortitude</label><input type="number" value={modal.fortitude} onChange={e => setModal(m => ({ ...m, fortitude: +e.target.value }))} /></div>
              <div className="form-group"><label>Reflexos</label><input type="number" value={modal.reflex} onChange={e => setModal(m => ({ ...m, reflex: +e.target.value }))} /></div>
              <div className="form-group"><label>Vontade</label><input type="number" value={modal.will_save} onChange={e => setModal(m => ({ ...m, will_save: +e.target.value }))} /></div>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 1rem' }}>Manobras de Combate</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 1rem' }}>
              <div className="form-group"><label>CMB</label><input type="number" value={modal.cmb} onChange={e => setModal(m => ({ ...m, cmb: +e.target.value }))} /></div>
              <div className="form-group"><label>CMD</label><input type="number" value={modal.cmd} onChange={e => setModal(m => ({ ...m, cmd: +e.target.value }))} /></div>
              <div className="form-group"><label>Res. Magia</label><input type="number" min={0} value={modal.spell_resistance} onChange={e => setModal(m => ({ ...m, spell_resistance: +e.target.value }))} /></div>
            </div>

            <div className="form-group">
              <label>Anotações / Traços</label>
              <textarea value={modal.char_notes} onChange={e => setModal(m => ({ ...m, char_notes: e.target.value }))} rows={3} style={{ resize: 'vertical' }} />
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
