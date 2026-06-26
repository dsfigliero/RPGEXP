import { useEffect, useState, useMemo } from 'react'
import api from '../../api'

const BAB_LABELS = { FULL: 'BAB Completo', THREE_QUARTERS: 'BAB ¾', HALF: 'BAB ½' }
const CASTING_LABELS = { prepared: 'Preparado', spontaneous: 'Espontâneo', hybrid: 'Híbrido' }
const SAVE_LABELS = { GOOD: 'Boa', POOR: 'Fraca' }
const SAVE_LABELS_M = { GOOD: 'Bons', POOR: 'Fracos' }

export default function Classes() {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importResult, setImportResult] = useState(null)
  const [importing, setImporting] = useState(false)
  const [detailClass, setDetailClass] = useState(null)
  const [detailTab, setDetailTab] = useState('geral')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await api.get('/classes')
    setClasses(data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openCreate() { setModal({ name: '', description: '', uses_magic: 0, casting_type: 'prepared' }); setError('') }
  function openEdit(c, e) { e.stopPropagation(); setModal({ id: c.id, name: c.name, description: c.description, uses_magic: c.uses_magic, casting_type: c.casting_type || 'prepared' }); setError('') }

  async function save() {
    if (!modal.name.trim()) return setError('Nome obrigatório')
    setSaving(true)
    try {
      if (modal.id) await api.put(`/classes/${modal.id}`, modal)
      else await api.post('/classes', modal)
      setModal(null); load()
    } catch (err) { setError(err.response?.data?.error || 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  async function del(id, e) {
    e.stopPropagation()
    if (!confirm('Excluir classe? Personagens vinculados perderão a referência.')) return
    await api.delete(`/classes/${id}`); load()
  }

  async function importClass() {
    setImporting(true); setImportResult(null)
    try {
      const parsed = JSON.parse(importJson)
      const r = await api.post('/classes/import', parsed)
      setImportResult({ ok: true, action: r.data.action, name: r.data.class?.name })
      load()
    } catch (e) {
      setImportResult({ error: e.response?.data?.error || 'JSON inválido: ' + e.message })
    } finally { setImporting(false) }
  }

  function openDetail(c) { setDetailClass(c); setDetailTab('geral') }

  const detailData = useMemo(() => {
    if (!detailClass?.class_json) return null
    try { return JSON.parse(detailClass.class_json) } catch { return null }
  }, [detailClass])

  const featureMap = useMemo(() => {
    if (!detailData?.features) return {}
    return Object.fromEntries(detailData.features.map(f => [f.id, f]))
  }, [detailData])

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Classes de Personagem</h1>
          <p className="text-muted text-sm">{classes.length} classes cadastradas</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-ghost" onClick={() => { setShowImport(true); setImportJson(''); setImportResult(null) }}>
            Importar JSON
          </button>
          <button className="btn-primary" onClick={openCreate}>+ Nova Classe</button>
        </div>
      </div>

      {/* ── Class list ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {classes.map(c => {
          const tags = (() => { try { return JSON.parse(c.tags || '[]') } catch { return [] } })()
          return (
            <div key={c.id} className="card" style={{ cursor: 'pointer' }} onClick={() => openDetail(c)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '1rem' }}>{c.name}</span>
                    {c.hit_die && <span className="badge">{c.hit_die}</span>}
                    {c.uses_magic
                      ? <span className="badge badge-purple">{CASTING_LABELS[c.casting_type] || 'Conjurador'}</span>
                      : <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text-muted)' }}>Sem Magia</span>}
                    {c.bab_progression && <span className="badge badge-yellow" style={{ fontSize: '0.65rem' }}>{BAB_LABELS[c.bab_progression] || c.bab_progression}</span>}
                    {tags.map(t => <span key={t} className="badge" style={{ fontSize: '0.65rem', background: 'var(--surface2)', color: 'var(--text-muted)' }}>{t}</span>)}
                  </div>
                  {c.source_book && <div className="text-muted text-sm" style={{ marginTop: '0.15rem', fontSize: '0.75rem' }}>{c.source_book}</div>}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }} onClick={e => e.stopPropagation()}>
                  <button className="btn-ghost btn-sm" onClick={e => openEdit(c, e)}>Editar</button>
                  <button className="btn-danger btn-sm" onClick={e => del(c.id, e)}>Excluir</button>
                </div>
              </div>
            </div>
          )
        })}
        {classes.length === 0 && (
          <div className="card text-muted text-sm">Nenhuma classe cadastrada. Use "Importar JSON" ou "+ Nova Classe".</div>
        )}
      </div>

      {/* ── Detail modal ─────────────────────────────────────────── */}
      {detailClass && (
        <div className="modal-backdrop" onClick={() => setDetailClass(null)}>
          <div className="modal" style={{ maxWidth: 780, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ marginBottom: '0.35rem' }}>{detailClass.name}</h2>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {detailClass.hit_die && <span className="badge">{detailClass.hit_die}</span>}
                  {detailClass.uses_magic
                    ? <span className="badge badge-purple">{CASTING_LABELS[detailClass.casting_type] || 'Conjurador'}</span>
                    : <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text-muted)' }}>Sem Magia</span>}
                  {detailClass.bab_progression && <span className="badge badge-yellow" style={{ fontSize: '0.7rem' }}>{BAB_LABELS[detailClass.bab_progression]}</span>}
                  {detailClass.source_book && <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{detailClass.source_book}</span>}
                </div>
              </div>
              <button className="btn-ghost btn-sm" onClick={() => setDetailClass(null)}>✕</button>
            </div>

            {detailData && (
              <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border)', marginBottom: '1.25rem' }}>
                {[['geral', 'Geral'], ['progressao', 'Progressão'], ...(detailData.spellcasting ? [['conjuracao', 'Conjuração']] : [])].map(([key, label]) => (
                  <button key={key} onClick={() => setDetailTab(key)} style={{ padding: '0.5rem 1.1rem', border: 'none', borderBottom: detailTab === key ? '2px solid var(--primary)' : '2px solid transparent', background: 'none', color: detailTab === key ? 'var(--primary)' : 'var(--text-muted)', fontWeight: detailTab === key ? 600 : 400, cursor: 'pointer', fontSize: '0.88rem', marginBottom: '-1px' }}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* ── Tab: Geral ── */}
            {(!detailData || detailTab === 'geral') && (
              <>
                {detailData?.description?.flavor && (
                  <p style={{ fontSize: '0.9rem', lineHeight: 1.6, fontStyle: 'italic', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    {detailData.description.flavor}
                  </p>
                )}
                {detailData?.description?.role && (
                  <p style={{ fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1rem' }}>{detailData.description.role}</p>
                )}
                {!detailData && detailClass.description && (
                  <p style={{ fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1rem' }}>{detailClass.description}</p>
                )}

                {detailData && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    {[
                      ['Dado de Vida', detailClass.hit_die],
                      ['BAB', BAB_LABELS[detailData.progressionType?.baseAttackBonus] || null],
                      ['Fortitude', SAVE_LABELS[detailData.progressionType?.fortitudeSave] || null],
                      ['Reflexos', SAVE_LABELS_M[detailData.progressionType?.reflexSave] || null],
                      ['Vontade', SAVE_LABELS[detailData.progressionType?.willSave] || null],
                      ['Per./Nível', detailClass.skill_ranks_base != null ? `${detailClass.skill_ranks_base} + INT` : null],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <div key={label} className="card" style={{ textAlign: 'center', padding: '0.5rem 0.4rem' }}>
                        <div className="text-muted text-sm" style={{ fontSize: '0.7rem' }}>{label}</div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', marginTop: '0.2rem' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {detailData?.proficiencies && (detailData.proficiencies.weapons?.length > 0 || detailData.proficiencies.armor?.length > 0 || detailData.proficiencies.shields?.length > 0) && (
                  <>
                    <h3 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>Proficiências</h3>
                    <div style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
                      {detailData.proficiencies.weapons?.length > 0 && (
                        <div style={{ marginBottom: '0.25rem' }}>
                          <span className="text-muted">Armas: </span>
                          {detailData.proficiencies.weapons.map(w => w.items?.length > 0 ? w.items.join(', ') : w.category).join(', ')}
                        </div>
                      )}
                      {detailData.proficiencies.armor?.length > 0 && (
                        <div style={{ marginBottom: '0.25rem' }}>
                          <span className="text-muted">Armaduras: </span>{detailData.proficiencies.armor.join(', ')}
                        </div>
                      )}
                      {detailData.proficiencies.shields?.length > 0 && (
                        <div><span className="text-muted">Escudos: </span>{detailData.proficiencies.shields.join(', ')}</div>
                      )}
                    </div>
                  </>
                )}

                {detailData?.classSkills?.length > 0 && (
                  <>
                    <h3 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>Perícias de Classe</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '1.25rem' }}>
                      {detailData.classSkills.map(s => (
                        <span key={s.name} className="badge" style={{ background: 'var(--surface2)', color: 'var(--text)', fontSize: '0.75rem' }}>
                          {s.name} <span className="text-muted">({s.ability})</span>
                        </span>
                      ))}
                    </div>
                  </>
                )}

                {detailData?.features?.length > 0 && (
                  <>
                    <h3 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.75rem' }}>Habilidades</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {detailData.features.map(f => (
                        <div key={f.id} className="card" style={{ padding: '0.6rem 0.75rem' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{f.name}</span>
                            {f.type && f.type !== 'CLASS_FEATURE' && f.type !== 'NONE' && (
                              <span className="badge" style={{ fontSize: '0.62rem', background: 'var(--surface2)', color: 'var(--text-muted)' }}>{f.type}</span>
                            )}
                            {f.gainedAtLevels?.length > 0 && (
                              <span className="text-muted" style={{ fontSize: '0.72rem' }}>Nív. {f.gainedAtLevels.join(', ')}</span>
                            )}
                          </div>
                          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{f.description}</p>
                          {f.scaling?.values?.length > 0 && (
                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                              {f.scaling.values.map(sv => (
                                <span key={sv.level} className="badge" style={{ fontSize: '0.65rem', background: 'var(--surface2)', color: 'var(--text-muted)' }}>
                                  Nív.{sv.level}: +{sv.value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── Tab: Progressão ── */}
            {detailData && detailTab === 'progressao' && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      {['Nível', 'BAB', 'Fort', 'Ref', 'Von', 'Habilidades Adquiridas'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(detailData.levels || []).map(lvl => {
                      const featureNames = (lvl.features || [])
                        .map(fid => featureMap[fid]?.name || fid)
                        .filter((n, i, a) => a.indexOf(n) === i)
                      return (
                        <tr key={lvl.level} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.4rem 0.5rem', fontWeight: 700 }}>{lvl.level}°</td>
                          <td style={{ padding: '0.4rem 0.5rem' }}>{lvl.baseAttackBonus}</td>
                          <td style={{ padding: '0.4rem 0.5rem' }}>{lvl.fortitudeSave}</td>
                          <td style={{ padding: '0.4rem 0.5rem' }}>{lvl.reflexSave}</td>
                          <td style={{ padding: '0.4rem 0.5rem' }}>{lvl.willSave}</td>
                          <td style={{ padding: '0.4rem 0.5rem', color: featureNames.length ? 'inherit' : 'var(--border)' }}>
                            {featureNames.join(', ') || '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Tab: Conjuração ── */}
            {detailData?.spellcasting && detailTab === 'conjuracao' && (() => {
              const sc = detailData.spellcasting
              const maxSL = sc.maxSpellLevel ?? 9
              const spellCols = Array.from({ length: maxSL + 1 }, (_, i) => String(i))
              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    {[
                      ['Tipo', sc.type],
                      ['Estilo', CASTING_LABELS[sc.castingStyle?.toLowerCase()] || sc.castingStyle],
                      ['Atributo', sc.ability],
                      ['Círculo Máx.', sc.maxSpellLevel != null ? `${sc.maxSpellLevel}°` : null],
                      ['Lista', sc.spellListId],
                      ['Grimório', sc.usesSpellbook ? 'Sim' : 'Não'],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <div key={label} className="card" style={{ textAlign: 'center', padding: '0.5rem' }}>
                        <div className="text-muted text-sm" style={{ fontSize: '0.7rem' }}>{label}</div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', marginTop: '0.2rem' }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {sc.spontaneousCasting?.enabled && (
                    <div className="card" style={{ background: 'rgba(108,99,255,0.07)', marginBottom: '1rem', fontSize: '0.85rem', lineHeight: 1.5 }}>
                      <strong>Conjuração Espontânea:</strong> {sc.spontaneousCasting.description}
                    </div>
                  )}

                  {sc.spellsPerDay?.length > 0 && (
                    <>
                      <h3 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>Magias por Dia</h3>
                      <div style={{ overflowX: 'auto', marginBottom: '1.25rem' }}>
                        <table style={{ fontSize: '0.78rem', borderCollapse: 'collapse', width: '100%' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid var(--border)' }}>
                              <th style={{ padding: '0.35rem 0.6rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Nível</th>
                              {spellCols.map(sl => <th key={sl} style={{ padding: '0.35rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>{sl}°</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {sc.spellsPerDay.map(row => (
                              <tr key={row.classLevel} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '0.35rem 0.6rem', fontWeight: 600 }}>{row.classLevel}</td>
                                {spellCols.map(sl => (
                                  <td key={sl} style={{ padding: '0.35rem 0.5rem', textAlign: 'center', color: row.slots?.[sl] ? 'inherit' : 'var(--text-muted)', opacity: row.slots?.[sl] ? 1 : 0.3 }}>
                                    {row.slots?.[sl] ?? '—'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {sc.spellsKnown?.length > 0 && (
                    <>
                      <h3 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>Magias Conhecidas</h3>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ fontSize: '0.78rem', borderCollapse: 'collapse', width: '100%' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid var(--border)' }}>
                              <th style={{ padding: '0.35rem 0.6rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Nível</th>
                              {spellCols.map(sl => <th key={sl} style={{ padding: '0.35rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>{sl}°</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {sc.spellsKnown.map(row => (
                              <tr key={row.classLevel} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '0.35rem 0.6rem', fontWeight: 600 }}>{row.classLevel}</td>
                                {spellCols.map(sl => (
                                  <td key={sl} style={{ padding: '0.35rem 0.5rem', textAlign: 'center', color: row.known?.[sl] ? 'inherit' : 'var(--text-muted)', opacity: row.known?.[sl] ? 1 : 0.3 }}>
                                    {row.known?.[sl] ?? '—'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── Manual create/edit modal ─────────────────────────────── */}
      {modal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>{modal.id ? 'Editar' : 'Nova'} Classe</h2>
              <button className="btn-ghost btn-sm" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="form-group">
              <label>Nome</label>
              <input value={modal.name} onChange={e => setModal(m => ({ ...m, name: e.target.value }))} autoFocus />
            </div>
            <div className="form-group">
              <label>Descrição</label>
              <textarea rows={3} value={modal.description} onChange={e => setModal(m => ({ ...m, description: e.target.value }))} style={{ resize: 'vertical' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!modal.uses_magic} onChange={e => setModal(m => ({ ...m, uses_magic: e.target.checked ? 1 : 0 }))} />
                <span>Usuária de Magia</span>
              </label>
            </div>
            {!!modal.uses_magic && (
              <div className="form-group">
                <label>Estilo de Conjuração</label>
                <select value={modal.casting_type || 'prepared'} onChange={e => setModal(m => ({ ...m, casting_type: e.target.value }))}>
                  <option value="prepared">Preparado (Mago, Clérigo)</option>
                  <option value="spontaneous">Espontâneo (Feiticeiro, Bardo)</option>
                </select>
              </div>
            )}
            {error && <p className="error-msg">{error}</p>}
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import JSON modal ─────────────────────────────────────── */}
      {showImport && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 660 }}>
            <div className="modal-header">
              <h2>Importar Classe via JSON</h2>
              <button className="btn-ghost btn-sm" onClick={() => setShowImport(false)}>✕</button>
            </div>
            <p className="text-muted text-sm" style={{ marginBottom: '0.75rem' }}>
              Cole o JSON completo de uma classe Pathfinder 1e. Classes com o mesmo nome serão atualizadas automaticamente.
            </p>
            <textarea
              rows={14}
              value={importJson}
              onChange={e => setImportJson(e.target.value)}
              placeholder={'{\n  "name": "Fighter",\n  "hitDie": "d10",\n  "levels": [...],\n  "features": [...]\n}'}
              style={{ fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical' }}
            />
            {importResult && (
              <div style={{ marginTop: '0.75rem', padding: '0.6rem', borderRadius: 'var(--radius)', background: importResult.error ? 'rgba(224,84,84,0.1)' : 'rgba(76,175,125,0.1)', color: importResult.error ? 'var(--danger)' : 'var(--success)', fontSize: '0.85rem' }}>
                {importResult.error
                  ? `Erro: ${importResult.error}`
                  : `Classe "${importResult.name}" ${importResult.action === 'updated' ? 'atualizada' : 'criada'} com sucesso.`}
              </div>
            )}
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setShowImport(false)}>Fechar</button>
              <button className="btn-primary" onClick={importClass} disabled={importing || !importJson.trim()}>
                {importing ? 'Importando...' : 'Importar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
