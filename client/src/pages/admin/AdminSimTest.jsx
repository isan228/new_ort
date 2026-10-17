import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { simAdminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';
import { Crumbs, InlineAdd, Modal, useIsEditor } from './adminUi';
import { SimTestForm } from './AdminSimHome';
import { CountBadge, DifficultyBadge, SIM_DIFFICULTIES, StatusBadge, simPath } from './simUi';
import '../../styles/sim.css';

function VariantForm({ nextNumber, onSubmit, onClose }) {
  const { t } = useLang();
  const [number, setNumber] = useState(String(nextNumber));
  const [difficulty, setDifficulty] = useState('medium');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ number: Number(number), difficulty }); }}>
      <label className="field">
        <span>{t('admin.simulation.number')}</span>
        <input type="number" min="1" value={number} onChange={(e) => setNumber(e.target.value)} />
      </label>
      <label className="field">
        <span>{t('admin.simulation.difficulty')}</span>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          {SIM_DIFFICULTIES.map((key) => <option key={key} value={key}>{t(`admin.simulation.diff.${key}`)}</option>)}
        </select>
      </label>
      <p className="muted">{t('admin.simulation.templateHint')}</p>
      <div className="row">
        <button className="btn" type="submit">{t('admin.simulation.createVariant')}</button>
        <button className="btn ghost" type="button" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}

function TopicRow({ topic, editor, onRename, onDelete }) {
  const { t } = useLang();
  const [name, setName] = useState(null);
  if (name !== null) {
    return (
      <InlineAdd
        value={name}
        onChange={setName}
        onCancel={() => setName(null)}
        onSubmit={async (value) => { await onRename(value); setName(null); }}
      />
    );
  }
  return (
    <div className="admin-list-item">
      <div style={{ flex: 1, minWidth: 0 }}>
        <h4>{topic.name}</h4>
        <p className="muted" style={{ margin: '4px 0 0' }}>{t('admin.simulation.topicUsed', { n: topic.used })}</p>
      </div>
      {!editor && (
        <div className="row">
          <button className="btn ghost sm" type="button" onClick={() => setName(topic.name)}>{t('common.edit')}</button>
          <button className="btn ghost sm" type="button" onClick={onDelete} disabled={topic.used > 0}>{t('common.delete')}</button>
        </div>
      )}
    </div>
  );
}

export default function AdminSimTest() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { testId } = useParams();
  const editor = useIsEditor();
  const [data, setData] = useState(null);
  const [modal, setModal] = useState(null);
  const [topicName, setTopicName] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function reload() {
    setData(await simAdminApi.test(testId));
  }

  useEffect(() => { reload().catch((err) => setError(err.message)); }, [testId]);

  async function run(fn) {
    setError('');
    setMsg('');
    try {
      await fn();
      await reload();
      setMsg(t('admin.saved'));
    } catch (err) {
      setError(err.message);
    }
  }

  if (!data) return <p className="muted">{error || t('common.loading')}</p>;
  const { test, variants, topics } = data;
  const nextNumber = variants.reduce((max, v) => Math.max(max, v.number), 0) + 1;

  return (
    <div>
      <Crumbs items={[{ label: t('admin.simulation.title'), to: simPath() }, { label: test.name }]} />
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <span className="badge">{t(`admin.simulation.tracks.${test.trackGroup}`)}</span>
          {test.isExtra && <span className="badge" style={{ marginLeft: 6 }}>{t('admin.simulation.extra')}</span>}
          <h1 style={{ marginTop: 8 }}>{test.name}</h1>
          <p className="muted">{t('admin.simulation.testLead')}</p>
        </div>
        {!editor && (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="btn ghost sm" type="button" onClick={() => setModal({ type: 'test' })}>{t('common.edit')}</button>
            <button className="btn" type="button" onClick={() => setModal({ type: 'variant' })}>{t('admin.simulation.addVariant')}</button>
          </div>
        )}
      </div>
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="err">{error}</p>}

      <h2>{t('admin.simulation.variants')}</h2>
      <div className="admin-list">
        {!variants.length && <div className="empty">{t('admin.simulation.noVariants')}</div>}
        {variants.map((v) => (
          <div key={v.id} className="admin-list-item">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4>
                {t('admin.simulation.variantN', { n: v.number })}
                {' '}
                <DifficultyBadge t={t} value={v.difficulty} />
                {' '}
                <StatusBadge t={t} status={v.status} />
              </h4>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                <CountBadge count={v.totals.count} need={v.totals.required} />
                {' · '}
                {t('admin.simulation.minutes', { n: v.totals.minutes })}
                {v.problems > 0 && <> · <span className="field-error">{t('admin.simulation.problemsN', { n: v.problems })}</span></>}
              </p>
            </div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button className="btn sm" type="button" onClick={() => navigate(simPath('variant', v.id))}>{t('admin.open')}</button>
              {!editor && (
                <button
                  className="btn ghost sm"
                  type="button"
                  onClick={() => {
                    if (!window.confirm(t('admin.simulation.confirmDeleteVariant', { n: v.number }))) return;
                    run(() => simAdminApi.deleteVariant(v.id));
                  }}
                >
                  {t('common.delete')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="admin-section-head">
        <div>
          <h2 style={{ margin: 0 }}>{t('admin.simulation.topics')}</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>{t('admin.simulation.topicsLead')}</p>
        </div>
        {!editor && topicName === null && (
          <button className="btn sm" type="button" onClick={() => setTopicName('')}>{t('admin.simulation.addTopic')}</button>
        )}
      </div>
      {topicName !== null && (
        <InlineAdd
          value={topicName}
          placeholder={t('admin.simulation.topicPh')}
          onChange={setTopicName}
          onCancel={() => setTopicName(null)}
          onSubmit={(name) => run(async () => {
            await simAdminApi.createTopic(test.id, name);
            setTopicName('');
          })}
        />
      )}
      <div className="admin-list">
        {!topics.length && <div className="empty">{t('admin.simulation.noTopics')}</div>}
        {topics.map((topic) => (
          <TopicRow
            key={topic.id}
            topic={topic}
            editor={editor}
            onRename={(name) => run(() => simAdminApi.updateTopic(topic.id, name))}
            onDelete={() => run(() => simAdminApi.deleteTopic(topic.id))}
          />
        ))}
      </div>

      {modal?.type === 'test' && (
        <Modal title={t('common.edit')} onClose={() => setModal(null)}>
          <SimTestForm
            initial={test}
            onClose={() => setModal(null)}
            onSubmit={(body) => run(async () => {
              await simAdminApi.updateTest(test.id, body);
              setModal(null);
            })}
          />
        </Modal>
      )}
      {modal?.type === 'variant' && (
        <Modal title={t('admin.simulation.addVariant')} onClose={() => setModal(null)}>
          <VariantForm
            nextNumber={nextNumber}
            onClose={() => setModal(null)}
            onSubmit={(body) => run(async () => {
              const { variant } = await simAdminApi.createVariant(test.id, body);
              setModal(null);
              navigate(simPath('variant', variant.variant.id));
            })}
          />
        </Modal>
      )}
    </div>
  );
}
