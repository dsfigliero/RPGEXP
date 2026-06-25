import { useEffect, useState } from 'react'
import api from '../../api'

const FIELD_LABELS = {
  name: 'Nome', class: 'Classe', level: 'Nível', race: 'Raça', alignment: 'Alinhamento',
  speed: 'Velocidade', hp: 'PV Atual', max_hp: 'PV Máximo', ac: 'CA',
  initiative: 'Iniciativa', bab: 'BAB', cmb: 'CMB', cmd: 'CMD',
  spell_resistance: 'Res. Magia', fortitude: 'Fortitude', will_save: 'Vontade', reflex: 'Reflexos',
  str_score: 'FOR', dex_score: 'DES', con_score: 'CON', int_score: 'INT', wis_score: 'SAB', cha_score: 'CAR',
  char_notes: 'Anotações',
};

export default function CharacterLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    api.get('/characters/admin/change-logs').then(r => { setLogs(r.data); setLoading(false) })
  }, [])

  const filtered = filter
    ? logs.filter(l => l.character_name.toLowerCase().includes(filter.toLowerCase()) ||
        l.changed_by_email?.toLowerCase().includes(filter.toLowerCase()))
    : logs

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>Log de Alterações — Personagens</h1>
      </div>
      <div className="form-group" style={{ maxWidth: 300, marginBottom: '1rem' }}>
        <input placeholder="Filtrar por personagem ou usuário..." value={filter} onChange={e => setFilter(e.target.value)} />
      </div>
      {filtered.length === 0
        ? <div className="card text-muted text-sm">Nenhum registro encontrado.</div>
        : (
          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr><th>Personagem</th><th>Alterado por</th><th>Campos Alterados</th><th>Data/Hora</th></tr>
              </thead>
              <tbody>
                {filtered.map(log => {
                  let oldVals = {}, newVals = {};
                  try { oldVals = JSON.parse(log.old_values) } catch(e) {}
                  try { newVals = JSON.parse(log.new_values) } catch(e) {}
                  const fields = Object.keys(newVals)
                  return (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 500 }}>{log.character_name}</td>
                      <td className="text-muted">{log.changed_by_email || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          {fields.map(f => (
                            <span key={f} style={{ fontSize: '0.82rem' }}>
                              <span className="badge">{FIELD_LABELS[f] || f}</span>
                              {' '}<span className="text-muted">{String(oldVals[f])}</span>
                              {' → '}<span style={{ fontWeight: 600 }}>{String(newVals[f])}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="text-muted">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}
