import { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import api from '../api'

export default function SpellLibrary() {
  const { user } = useAuth()
  const [spells, setSpells] = useState([])
  const [search, setSearch] = useState('')
  const [schoolFilter, setSchoolFilter] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importResult, setImportResult] = useState(null)
  const [importing, setImporting] = useState(false)
  const [selectedSpell, setSelectedSpell] = useState(null)

  async function load() {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (schoolFilter) params.set('school', schoolFilter)
    const r = await api.get(`/spell-library?${params}`)
    setSpells(r.data)
  }

  useEffect(() => { load() }, [search, schoolFilter])

  async function importSpells() {
    setImporting(true)
    setImportResult(null)
    try {
      const parsed = JSON.parse(importJson)
      const r = await api.post('/spell-library/import', parsed)
      setImportResult(r.data)
      load()
    } catch(e) {
      setImportResult({ error: e.response?.data?.error || 'JSON inválido: ' + e.message })
    } finally { setImporting(false) }
  }

  async function deleteSpell(id) {
    if (!confirm('Remover esta magia da biblioteca?')) return
    await api.delete(`/spell-library/${id}`)
    setSpells(prev => prev.filter(s => s.id !== id))
  }

  // Get unique schools for filter
  const schools = [...new Set(spells.map(s => s.school).filter(Boolean))].sort()

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Biblioteca de Magias</h1>
          <p className="text-muted text-sm">{spells.length} magias na biblioteca</p>
        </div>
        {(user?.is_mestre || user?.is_admin) && (
          <button className="btn-primary" onClick={() => { setShowImport(true); setImportResult(null); setImportJson('') }}>
            + Importar / Adicionar
          </button>
        )}
      </div>

      {/* Search and filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          placeholder="Buscar magia..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <select value={schoolFilter} onChange={e => setSchoolFilter(e.target.value)} style={{ minWidth: 160 }}>
          <option value="">Todas as escolas</option>
          {schools.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Spell list */}
      {spells.length === 0 && (
        <div className="card text-muted text-sm">
          Nenhuma magia na biblioteca ainda. Use "Importar / Adicionar" para adicionar magias.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
        {spells.map(spell => (
          <div key={spell.id} className="card" style={{ cursor: 'pointer' }} onClick={async () => {
              const r = await api.get(`/spell-library/${spell.id}`)
              setSelectedSpell(r.data)
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
              <strong style={{ fontSize: '0.95rem' }}>{spell.display_name || spell.name}</strong>
              {(user?.is_mestre || user?.is_admin) && (
                <button className="btn-ghost btn-sm" style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem' }}
                  onClick={e => { e.stopPropagation(); deleteSpell(spell.id) }}>✕</button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
              {spell.school && <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>{spell.school}</span>}
              {spell.subschool && <span className="badge" style={{ fontSize: '0.65rem', background: 'var(--surface2)', color: 'var(--text-muted)' }}>{spell.subschool}</span>}
              {(spell.levels || []).map(l => (
                <span key={`${l.class}-${l.level}`} className="badge badge-yellow" style={{ fontSize: '0.65rem' }}>{l.class} {l.level}</span>
              ))}
            </div>
            {spell.description_short && (
              <p className="text-muted text-sm" style={{ fontSize: '0.78rem', margin: 0 }}>
                {spell.description_short.substring(0, 120)}{spell.description_short.length > 120 ? '…' : ''}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {spell.casting_time && <span>{spell.casting_time}</span>}
              {spell.range && <span>{spell.range}</span>}
              {spell.duration && <span>{spell.duration}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Spell detail modal — closes on backdrop click */}
      {selectedSpell && (
        <div className="modal-backdrop" onClick={() => setSelectedSpell(null)}>
          <div className="modal" style={{ maxWidth: 640, maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 style={{ marginBottom: '0.25rem' }}>{selectedSpell.display_name || selectedSpell.name}</h2>
                {selectedSpell.description_short && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>{selectedSpell.description_short}</p>
                )}
              </div>
              <button className="btn-ghost btn-sm" onClick={() => setSelectedSpell(null)}>✕</button>
            </div>

            {/* School + levels badges */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
              {selectedSpell.school && <span className="badge badge-purple">{selectedSpell.school}{selectedSpell.subschool ? ` (${selectedSpell.subschool})` : ''}</span>}
              {(selectedSpell.descriptors || []).map(d => (
                <span key={d} className="badge" style={{ background: 'var(--surface2)', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{d}</span>
              ))}
              {(selectedSpell.levels || []).map(l => (
                <span key={`${l.class}-${l.level}`} className="badge badge-yellow" style={{ fontSize: '0.72rem' }}>{l.class} {l.level}°</span>
              ))}
            </div>

            {/* Stats table */}
            <table style={{ width: '100%', marginBottom: '1.25rem', borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  ['Tempo de conjuração', selectedSpell.casting_time],
                  ['Componentes', selectedSpell.components],
                  ['Alcance', selectedSpell.range],
                  ['Alvo', selectedSpell.target],
                  ['Área', selectedSpell.area],
                  ['Efeito', selectedSpell.effect],
                  ['Duração', selectedSpell.duration],
                  ['Teste de resistência', selectedSpell.saving_throw],
                  ['Resistência a magia', selectedSpell.spell_resistance],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <tr key={label} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem', padding: '0.35rem 1rem 0.35rem 0', whiteSpace: 'nowrap', verticalAlign: 'top', width: '40%' }}>{label}</td>
                    <td style={{ fontSize: '0.88rem', padding: '0.35rem 0', verticalAlign: 'top' }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Full description */}
            {selectedSpell.description_full && (
              <div style={{ fontSize: '0.9rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: '1rem' }}>
                {selectedSpell.description_full}
              </div>
            )}

            {/* Source */}
            {(() => {
              try {
                const src = typeof selectedSpell.source === 'string' ? JSON.parse(selectedSpell.source) : selectedSpell.source
                if (src?.sourceBook) return (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', margin: 0 }}>
                    Fonte: {src.sourceBook}{src.page ? `, p. ${src.page}` : ''}
                  </p>
                )
              } catch { return null }
            })()}
          </div>
        </div>
      )}

      {/* Import modal — does NOT close on backdrop click */}
      {showImport && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>Importar / Adicionar Magias</h2>
              <button className="btn-ghost btn-sm" onClick={() => setShowImport(false)}>✕</button>
            </div>

            <p className="text-muted text-sm" style={{ marginBottom: '0.75rem' }}>
              Cole um objeto JSON de magia ou um array de magias. Duplicatas (mesmo nome) são ignoradas automaticamente.
            </p>
            <textarea
              rows={12}
              value={importJson}
              onChange={e => setImportJson(e.target.value)}
              placeholder={'[\n  { "name": "...", "school": "...", "levels": [...], ... },\n  ...\n]'}
              style={{ fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical' }}
            />
            {importResult && (
              <div style={{ marginTop: '0.75rem', padding: '0.6rem', borderRadius: 'var(--radius)', background: importResult.error ? 'rgba(224,84,84,0.1)' : 'rgba(76,175,125,0.1)', color: importResult.error ? 'var(--danger)' : 'var(--success)', fontSize: '0.85rem' }}>
                {importResult.error
                  ? `Erro: ${importResult.error}`
                  : [
                      importResult.inserted > 0 && `✓ ${importResult.inserted} nova${importResult.inserted !== 1 ? 's' : ''}`,
                      importResult.updated > 0 && `↺ ${importResult.updated} atualizada${importResult.updated !== 1 ? 's' : ''}`,
                    ].filter(Boolean).join(' · ') || '0 alterações'
                }
                {importResult.errors?.length > 0 && (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.78rem', opacity: 0.8 }}>
                    Erros: {importResult.errors.map(e => e.name).join(', ')}
                  </div>
                )}
              </div>
            )}
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setShowImport(false)}>Fechar</button>
              <button className="btn-primary" onClick={importSpells} disabled={importing || !importJson.trim()}>
                {importing ? 'Importando...' : 'Importar JSON'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
