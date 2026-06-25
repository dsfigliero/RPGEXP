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

export default function CharacterPanel() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const backTo = searchParams.get('back') || '/characters'
  const { user } = useAuth()
  const [char, setChar] = useState(null)
  const [effects, setEffects] = useState([])
  const [xpHistory, setXpHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState(null)
  const [effectModal, setEffectModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isOwner = char && char.user_id === user?.id
  const canEdit = isOwner || user?.is_admin

  async function load() {
    try {
      const [charRes, effectsRes, xpRes] = await Promise.all([
        api.get(`/characters/${id}/sheet`),
        api.get(`/characters/${id}/effects`).catch(() => ({ data: [] })),
        api.get(`/characters/${id}/xp-history`).catch(() => ({ data: [] })),
      ])
      setChar(charRes.data)
      setEffects(effectsRes.data)
      setXpHistory(xpRes.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  function openEdit() {
    setEditModal({ ...EMPTY_FORM, ...char })
    setError('')
  }

  async function saveEdit() {
    if (!editModal.name.trim()) return setError('Nome obrigatório')
    setSaving(true)
    try {
      await api.put(`/characters/${id}`, editModal)
      setEditModal(null)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar')
    } finally { setSaving(false) }
  }

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

  if (loading) return <div className="page"><div className="spinner" /></div>
  if (!char) return <div className="page"><p className="text-muted">Personagem não encontrado.</p></div>

  return (
    <div className="page">
      <div className="mb-3">
        <Link to={backTo} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>← Voltar</Link>
      </div>

      <div className="page-header">
        <div>
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
        </div>
        {canEdit && <button className="btn-ghost" onClick={openEdit}>Editar Ficha</button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px,1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="text-muted text-sm">HP</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.25rem 0' }}>{char.hp} / {char.max_hp}</div>
          <HpBar hp={char.hp} maxHp={char.max_hp} />
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="text-muted text-sm">CA</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.25rem 0' }}>{char.ac}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="text-muted text-sm">Iniciativa</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.25rem 0' }}>{char.initiative >= 0 ? '+' : ''}{char.initiative}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="text-muted text-sm">BAB</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.25rem 0' }}>+{char.bab}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="text-muted text-sm">XP</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.25rem 0' }}>{char.total_xp.toLocaleString('pt-BR')}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="text-muted text-sm">Vel.</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.25rem 0' }}>{char.speed}m</div>
        </div>
      </div>

      <SectionTitle>Atributos</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px,1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
        <StatBox label="FOR" value={char.str_score} />
        <StatBox label="DES" value={char.dex_score} />
        <StatBox label="CON" value={char.con_score} />
        <StatBox label="INT" value={char.int_score} />
        <StatBox label="SAB" value={char.wis_score} />
        <StatBox label="CAR" value={char.cha_score} />
      </div>

      <SectionTitle>Testes de Resistência</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px,1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {[['Fortitude', char.fortitude], ['Reflexos', char.reflex], ['Vontade', char.will_save]].map(([label, val]) => (
          <div key={label} className="card" style={{ textAlign: 'center' }}>
            <div className="text-muted text-sm">{label}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.25rem 0' }}>{val >= 0 ? '+' : ''}{val}</div>
          </div>
        ))}
      </div>

      <SectionTitle>Combate</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px,1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {[['CMB', char.cmb], ['CMD', char.cmd], ['Res. Magia', char.spell_resistance]].map(([label, val]) => (
          <div key={label} className="card" style={{ textAlign: 'center' }}>
            <div className="text-muted text-sm">{label}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.25rem 0' }}>{val}</div>
          </div>
        ))}
      </div>

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

      {char.char_notes && (
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

      {editModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>Editar Ficha</h2>
              <button className="btn-ghost btn-sm" onClick={() => setEditModal(null)}>✕</button>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Informações Gerais</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
              <div className="form-group"><label>Nome</label><input value={editModal.name} onChange={e => setEditModal(m => ({ ...m, name: e.target.value }))} autoFocus /></div>
              <div className="form-group"><label>Classe</label><input value={editModal.class} onChange={e => setEditModal(m => ({ ...m, class: e.target.value }))} /></div>
              <div className="form-group"><label>Raça</label><input value={editModal.race} onChange={e => setEditModal(m => ({ ...m, race: e.target.value }))} /></div>
              <div className="form-group"><label>Nível</label><input type="number" min={1} value={editModal.level} onChange={e => setEditModal(m => ({ ...m, level: +e.target.value }))} /></div>
              <div className="form-group"><label>Alinhamento</label>
                <select value={editModal.alignment} onChange={e => setEditModal(m => ({ ...m, alignment: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {['Leal e Bom','Neutro e Bom','Caótico e Bom','Leal e Neutro','Neutro','Caótico e Neutro','Leal e Mau','Neutro e Mau','Caótico e Mau'].map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 1rem' }}>PV e Defesa</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 1rem' }}>
              <div className="form-group"><label>PV Máximo</label><input type="number" min={0} value={editModal.max_hp} onChange={e => setEditModal(m => ({ ...m, max_hp: +e.target.value }))} /></div>
              <div className="form-group"><label>PV Atual</label><input type="number" min={0} value={editModal.hp} onChange={e => setEditModal(m => ({ ...m, hp: +e.target.value }))} /></div>
              <div className="form-group"><label>CA</label><input type="number" min={0} value={editModal.ac} onChange={e => setEditModal(m => ({ ...m, ac: +e.target.value }))} /></div>
              <div className="form-group"><label>Iniciativa</label><input type="number" value={editModal.initiative} onChange={e => setEditModal(m => ({ ...m, initiative: +e.target.value }))} /></div>
              <div className="form-group"><label>BAB</label><input type="number" min={0} value={editModal.bab} onChange={e => setEditModal(m => ({ ...m, bab: +e.target.value }))} /></div>
              <div className="form-group"><label>Velocidade (m)</label><input type="number" min={0} value={editModal.speed} onChange={e => setEditModal(m => ({ ...m, speed: +e.target.value }))} /></div>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 1rem' }}>Atributos</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0 0.5rem' }}>
              {[['FOR','str_score'],['DES','dex_score'],['CON','con_score'],['INT','int_score'],['SAB','wis_score'],['CAR','cha_score']].map(([label, key]) => (
                <div key={key} className="form-group"><label>{label}</label><input type="number" min={1} max={30} value={editModal[key]} onChange={e => setEditModal(m => ({ ...m, [key]: +e.target.value }))} /></div>
              ))}
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 1rem' }}>Testes de Resistência</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 1rem' }}>
              <div className="form-group"><label>Fortitude</label><input type="number" value={editModal.fortitude} onChange={e => setEditModal(m => ({ ...m, fortitude: +e.target.value }))} /></div>
              <div className="form-group"><label>Reflexos</label><input type="number" value={editModal.reflex} onChange={e => setEditModal(m => ({ ...m, reflex: +e.target.value }))} /></div>
              <div className="form-group"><label>Vontade</label><input type="number" value={editModal.will_save} onChange={e => setEditModal(m => ({ ...m, will_save: +e.target.value }))} /></div>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 1rem' }}>Manobras de Combate</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 1rem' }}>
              <div className="form-group"><label>CMB</label><input type="number" value={editModal.cmb} onChange={e => setEditModal(m => ({ ...m, cmb: +e.target.value }))} /></div>
              <div className="form-group"><label>CMD</label><input type="number" value={editModal.cmd} onChange={e => setEditModal(m => ({ ...m, cmd: +e.target.value }))} /></div>
              <div className="form-group"><label>Res. Magia</label><input type="number" min={0} value={editModal.spell_resistance} onChange={e => setEditModal(m => ({ ...m, spell_resistance: +e.target.value }))} /></div>
            </div>

            <div className="form-group">
              <label>Anotações / Traços</label>
              <textarea value={editModal.char_notes} onChange={e => setEditModal(m => ({ ...m, char_notes: e.target.value }))} rows={3} style={{ resize: 'vertical' }} />
            </div>

            {error && <p className="error-msg">{error}</p>}
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setEditModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

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
