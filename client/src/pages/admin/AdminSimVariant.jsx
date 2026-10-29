import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { simAdminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';
import { Crumbs, Modal, useIsEditor } from './adminUi';
import QuickUpload from './QuickUpload';
import {
  CountBadge,
  DifficultyBadge,
  SIM_DIFFICULTIES,
  SIM_FORMATS,
  StatusBadge,
  simPath,
} from './simUi';
import '../../styles/sim.css';

function BlockForm({ initial, onSubmit, onClose }) {
  const { t } = useLang();
  const [title, setTitle] = useState(initial?.title || '');
  const [minutes, setMinutes] = useState(String(initial?.minutes || 30));
  const [count, setCount] = useState('30');
  const [format, setFormat] = useState('standard');
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (!title.trim()) return;
      const body = { title: title.trim(), minutes: Number(minutes) };
      if (!initial) Object.assign(body, { count: Number(count) || null, format });
      onSubmit(body);
    }}>
      <label className="field">
        <span>{t('admin.simulation.blockTitle')}</span>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="field">
        <span>{t('admin.simulation.blockMinutes')}</span>
        <input type="number" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
      </label>
      {!initial && (
        <>
          <p className="muted">{t('admin.simulation.blockPartHint')}</p>
          <div className="sim-form-row">
            <label className="field">
              <span>{t('admin.simulation.partCount')}</span>
              <input type="number" min="0" value={count} onChange={(e) => setCount(e.target.value)} />
            </label>
            <label className="field">
              <span>{t('admin.simulation.format')}</span>
              <select value={format} onChange={(e) => setFormat(e.target.value)}>
                {SIM_FORMATS.map((key) => <option key={key} value={key}>{t(`admin.simulation.formats.${key}`)}</option>)}
              </select>
            </label>
          </div>
        </>
      )}
      <div className="row">
        <button className="btn" type="submit">{t('common.save')}</button>
        <button className="btn ghost" type="button" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}

function PartForm({ initial, onSubmit, onClose }) {
  const { t } = useLang();
  const [name, setName] = useState(initial?.name || '');
  const [count, setCount] = useState(String(initial?.requiredCount || 10));
  const [format, setFormat] = useState(initial?.format || 'standard');
  const locked = initial && initial.count > 0;
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (!name.trim()) return;
      const body = { name: name.trim(), requiredCount: Number(count) };
      if (!locked) body.format = format;
      onSubmit(body);
    }}>
      <label className="field">
        <span>{t('admin.simulation.partName')}</span>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>{t('admin.simulation.partCount')}</span>
        <input type="number" min="1" value={count} onChange={(e) => setCount(e.target.value)} />
      </label>
      <label className="field">
        <span>{t('admin.simulation.format')}</span>
        <select value={format} disabled={locked} onChange={(e) => setFormat(e.target.value)}>
          {SIM_FORMATS.map((key) => <option key={key} value={key}>{t(`admin.simulation.formats.${key}`)}</option>)}
        </select>
        {locked && <small className="field-hint">{t('admin.simulation.formatLocked')}</small>}
      </label>
      <div className="row">
        <button className="btn" type="submit">{t('common.save')}</button>
        <button className="btn ghost" type="button" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}

function MoveButtons({ onMove, first, last }) {
  return (
    <>
      <button className="btn ghost sm sim-move" type="button" disabled={first} onClick={() => onMove('up')} aria-label="↑">↑</button>
      <button className="btn ghost sm sim-move" type="button" disabled={last} onClick={() => onMove('down')} aria-label="↓">↓</button>
    </>
  );
}

function AddTopic({ part, topics, onAdd }) {
  const { t } = useLang();
  const used = new Set(part.topics.map((row) => row.topicId));
  const free = topics.filter((topic) => !used.has(topic.id));
  if (!topics.length) return <span className="muted sim-hint">{t('admin.simulation.noTopicsHint')}</span>;
  if (!free.length) return null;
  // Topics named "Группа · тема" can be added to the part as a whole group.
  const groups = new Map();
  for (const topic of free) {
    const [group, rest] = topic.name.split(' · ');
    if (rest) groups.set(group, [...(groups.get(group) || []), topic.id]);
  }
  const bulk = [...groups.entries()].filter(([, ids]) => ids.length > 1);
  return (
    <select
      className="sim-topic-add"
      value=""
      onChange={(e) => {
        const value = e.target.value;
        if (!value) return;
        if (value.startsWith('group:')) onAdd(groups.get(value.slice(6)));
        else onAdd([Number(value)]);
      }}
    >
      <option value="">{t('admin.simulation.addTopicToPart')}</option>
      {bulk.map(([group, ids]) => (
        <option key={`g-${group}`} value={`group:${group}`}>{t('admin.simulation.addTopicGroup', { group, n: ids.length })}</option>
      ))}
      {bulk.length > 0 && <option disabled>──────────</option>}
      {free.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
    </select>
  );
}

function PartRow({ part, index, total, editor, topics, run, setModal, navigate }) {
  const { t } = useLang();
  const canTopic = !editor && (part.topics.length > 0 || part.ownCount === 0);
  const uploaded = (ok, err) => run(async () => { if (err) throw new Error(err); });
  return (
    <div className="sim-part">
      <div className="sim-part-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{part.name}</b>
          <span className="muted sim-part-meta">
            {t(`admin.simulation.formats.${part.format}`)}
            {' · '}
            <CountBadge count={part.count} need={part.requiredCount} />
          </span>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {!part.topics.length && <QuickUpload testId={part.id} format={part.format} onDone={uploaded} />}
          {!part.topics.length && (
            <button className="btn sm" type="button" onClick={() => navigate(simPath('slot', part.id))}>
              {editor ? t('admin.simulation.upload') : t('admin.simulation.questions')}
            </button>
          )}
          {!editor && (
            <>
              <MoveButtons first={index === 0} last={index === total - 1} onMove={(dir) => run(() => simAdminApi.move('parts', part.id, dir))} />
              <button className="btn ghost sm" type="button" onClick={() => setModal({ type: 'part', item: part })}>{t('common.edit')}</button>
              <button
                className="btn ghost sm"
                type="button"
                onClick={() => {
                  if (!window.confirm(t('admin.simulation.confirmDeletePart', { name: part.name }))) return;
                  run(() => simAdminApi.deletePart(part.id));
                }}
              >
                {t('common.delete')}
              </button>
            </>
          )}
        </div>
      </div>
      {part.topics.length > 0 && (
        <div className="sim-topics">
          {part.topics.map((topic, i) => (
            <div key={topic.slotId} className="sim-topic">
              <span className="sim-topic-name">{topic.name}</span>
              <span className="muted">{t('admin.simulation.qN', { n: topic.count })}</span>
              <span style={{ flex: 1 }} />
              <QuickUpload testId={topic.slotId} format={part.format} onDone={uploaded} />
              <button className="btn sm" type="button" onClick={() => navigate(simPath('slot', topic.slotId))}>
                {editor ? t('admin.simulation.upload') : t('admin.simulation.questions')}
              </button>
              {!editor && (
                <>
                  <MoveButtons first={i === 0} last={i === part.topics.length - 1} onMove={(dir) => run(() => simAdminApi.move('slots', topic.slotId, dir))} />
                  <button
                    className="btn ghost sm"
                    type="button"
                    onClick={() => {
                      if (!window.confirm(t('admin.simulation.confirmRemoveTopic', { name: topic.name, n: topic.count }))) return;
                      run(() => simAdminApi.deleteSlot(topic.slotId));
                    }}
                  >
                    ×
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {canTopic && (
        <div className="sim-topic-bar">
          <AddTopic
            part={part}
            topics={topics}
            onAdd={(ids) => run(async () => {
              for (const id of ids) await simAdminApi.addTopic(part.id, id);
            })}
          />
          {!part.topics.length && <span className="muted sim-hint">{t('admin.simulation.topicsOptional')}</span>}
        </div>
      )}
    </div>
  );
}

function PublishPanel({ data, editor, run }) {
  const { t, locale } = useLang();
  const { variant, published, problems } = data;
  const isPublished = variant.status === 'published';
  return (
    <div className={`card sim-publish${problems.length ? ' has-problems' : ''}`}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <b>{isPublished ? t('admin.simulation.publishedTitle') : t('admin.simulation.draftTitle')}</b>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {published
              ? t('admin.simulation.publishedInfo', {
                v: published.version,
                date: new Date(published.createdAt).toLocaleString(locale),
                n: published.questionCount,
              })
              : t('admin.simulation.neverPublished')}
          </p>
        </div>
        {!editor && (
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <button className="btn" type="button" disabled={problems.length > 0} onClick={() => run(() => simAdminApi.publish(variant.id))}>
              {isPublished ? t('admin.simulation.republish') : t('admin.simulation.publish')}
            </button>
            {isPublished && (
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  if (!window.confirm(t('admin.simulation.confirmUnpublish'))) return;
                  run(() => simAdminApi.unpublish(variant.id));
                }}
              >
                {t('admin.simulation.unpublish')}
              </button>
            )}
          </div>
        )}
      </div>
      {isPublished && <p className="muted sim-hint">{t('admin.simulation.republishHint')}</p>}
      {problems.length > 0 && (
        <div className="sim-problems">
          <b>{t('admin.simulation.notReady', { n: problems.length })}</b>
          <ul>
            {problems.slice(0, 25).map((p) => <li key={p}>{p}</li>)}
            {problems.length > 25 && <li>{t('admin.simulation.moreProblems', { n: problems.length - 25 })}</li>}
          </ul>
        </div>
      )}
      {!problems.length && <p className="ok" style={{ margin: '10px 0 0' }}>{t('admin.simulation.ready')}</p>}
    </div>
  );
}

function VariantSettings({ data, run }) {
  const { t } = useLang();
  const { variant } = data;
  const [form, setForm] = useState({ number: String(variant.number), difficulty: variant.difficulty, allowRetake: variant.allowRetake });
  useEffect(() => {
    setForm({ number: String(variant.number), difficulty: variant.difficulty, allowRetake: variant.allowRetake });
  }, [variant.number, variant.difficulty, variant.allowRetake]);
  const dirty = String(variant.number) !== form.number || variant.difficulty !== form.difficulty || variant.allowRetake !== form.allowRetake;
  return (
    <div className="card sim-settings">
      <div className="sim-form-row">
        <label className="field">
          <span>{t('admin.simulation.number')}</span>
          <input type="number" min="1" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
        </label>
        <label className="field">
          <span>{t('admin.simulation.difficulty')}</span>
          <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
            {SIM_DIFFICULTIES.map((key) => <option key={key} value={key}>{t(`admin.simulation.diff.${key}`)}</option>)}
          </select>
        </label>
      </div>
      <label className="ar-check">
        <input type="checkbox" checked={form.allowRetake} onChange={(e) => setForm({ ...form, allowRetake: e.target.checked })} />
        <span>{t('admin.simulation.allowRetake')}</span>
      </label>
      <div className="row" style={{ marginTop: 10 }}>
        <button
          className="btn sm"
          type="button"
          disabled={!dirty}
          onClick={() => run(() => simAdminApi.updateVariant(variant.id, { ...form, number: Number(form.number) }))}
        >
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}

export default function AdminSimVariant() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { variantId } = useParams();
  const editor = useIsEditor();
  const [data, setData] = useState(null);
  const [topics, setTopics] = useState([]);
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function reload() {
    const next = await simAdminApi.variant(variantId);
    setData(next);
    const test = await simAdminApi.test(next.subject.id);
    setTopics(test.topics || []);
  }

  useEffect(() => { reload().catch((err) => setError(err.message)); }, [variantId]);

  async function run(fn) {
    setError('');
    setMsg('');
    try {
      const out = await fn();
      if (out?.variant?.variant) setData(out.variant);
      else await reload();
      setMsg(t('admin.saved'));
    } catch (err) {
      setError(err.message);
    }
  }

  if (!data) return <p className="muted">{error || t('common.loading')}</p>;
  const { subject, variant, blocks, totals } = data;

  return (
    <div>
      <Crumbs items={[
        { label: t('admin.simulation.title'), to: simPath() },
        { label: subject.name, to: simPath(subject.id) },
        { label: t('admin.simulation.variantN', { n: variant.number }) },
      ]} />
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <h1>
            {t('admin.simulation.variantN', { n: variant.number })}
            {' '}
            <DifficultyBadge t={t} value={variant.difficulty} />
            {' '}
            <StatusBadge t={t} status={variant.status} />
          </h1>
          <p className="muted">
            {subject.name}
            {' · '}
            <CountBadge count={totals.count} need={totals.required} />
            {' · '}
            {t('admin.simulation.minutes', { n: totals.minutes })}
            {data.attempts > 0 && ` · ${t('admin.simulation.attemptsN', { n: data.attempts })}`}
          </p>
        </div>
        {!editor && <button className="btn" type="button" onClick={() => setModal({ type: 'block' })}>{t('admin.simulation.addBlock')}</button>}
      </div>
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="err">{error}</p>}

      <PublishPanel data={data} editor={editor} run={run} />
      {!editor && <VariantSettings data={data} run={run} />}

      {!blocks.length && <div className="empty">{t('admin.simulation.noBlocks')}</div>}
      {blocks.map((block, bi) => {
        const need = block.parts.reduce((sum, p) => sum + (p.requiredCount || 0), 0);
        const have = block.parts.reduce((sum, p) => sum + p.count, 0);
        return (
          <section key={block.id} className="card sim-block">
            <header className="sim-block-head">
              <span className="sim-block-num">{bi + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3>{block.title}</h3>
                <span className="muted">
                  {t('admin.simulation.minutes', { n: block.minutes })}
                  {' · '}
                  <CountBadge count={have} need={need} />
                  {block.parts.length > 1 && ` · ${t('admin.simulation.sharedTimer')}`}
                </span>
              </div>
              {!editor && (
                <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                  <MoveButtons first={bi === 0} last={bi === blocks.length - 1} onMove={(dir) => run(() => simAdminApi.move('blocks', block.id, dir))} />
                  <button className="btn ghost sm" type="button" onClick={() => setModal({ type: 'block', item: block })}>{t('common.edit')}</button>
                  <button
                    className="btn ghost sm"
                    type="button"
                    onClick={() => {
                      if (!window.confirm(t('admin.simulation.confirmDeleteBlock', { name: block.title }))) return;
                      run(() => simAdminApi.deleteBlock(block.id));
                    }}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              )}
            </header>
            {block.parts.map((part, pi) => (
              <PartRow
                key={part.id}
                part={part}
                index={pi}
                total={block.parts.length}
                editor={editor}
                topics={topics}
                run={run}
                setModal={setModal}
                navigate={navigate}
              />
            ))}
            {!block.parts.length && <div className="empty">{t('admin.simulation.noParts')}</div>}
            {!editor && (
              <button className="btn ghost sm" type="button" style={{ marginTop: 10 }} onClick={() => setModal({ type: 'part', blockId: block.id })}>
                {t('admin.simulation.addPart')}
              </button>
            )}
          </section>
        );
      })}

      {modal?.type === 'block' && (
        <Modal title={modal.item ? t('common.edit') : t('admin.simulation.addBlock')} onClose={() => setModal(null)}>
          <BlockForm
            initial={modal.item}
            onClose={() => setModal(null)}
            onSubmit={(body) => run(async () => {
              const out = modal.item
                ? await simAdminApi.updateBlock(modal.item.id, body)
                : await simAdminApi.createBlock(variant.id, body);
              setModal(null);
              return out;
            })}
          />
        </Modal>
      )}
      {modal?.type === 'part' && (
        <Modal title={modal.item ? t('common.edit') : t('admin.simulation.addPart')} onClose={() => setModal(null)}>
          <PartForm
            initial={modal.item}
            onClose={() => setModal(null)}
            onSubmit={(body) => run(async () => {
              const out = modal.item
                ? await simAdminApi.updatePart(modal.item.id, body)
                : await simAdminApi.createPart(modal.blockId, body);
              setModal(null);
              return out;
            })}
          />
        </Modal>
      )}
    </div>
  );
}
