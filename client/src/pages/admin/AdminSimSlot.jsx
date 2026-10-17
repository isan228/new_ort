import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminApi, simAdminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';
import { Crumbs, TxtFormatHelp, TxtUploadButtons, confirmDelete } from './adminUi';
import { QuestionList, QuestionModal, ReadingPassages } from './AdminSection';
import CompareBlock from './AdminCompare';
import { isCompare } from '../../lib/compare';
import { CountBadge, simPath, slotCrumbs } from './simUi';
import '../../styles/reading-book.css';
import '../../styles/sim.css';

export default function AdminSimSlot() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { slotId } = useParams();
  const [info, setInfo] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [passages, setPassages] = useState([]);
  const [editing, setEditing] = useState(undefined);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function reload() {
    const next = await simAdminApi.slot(slotId);
    setInfo(next);
    if (next.slot.hasTopics) {
      setQuestions([]);
      setPassages([]);
      return;
    }
    const [qs, ps] = await Promise.all([adminApi.questions(slotId), adminApi.passages(slotId)]);
    setQuestions(qs.questions || []);
    setPassages(ps.passages || []);
  }

  useEffect(() => { reload().catch((err) => setError(err.message)); }, [slotId]);

  async function done(ok, err) {
    if (err) {
      setMsg('');
      setError(err);
      return;
    }
    setError('');
    setMsg(ok);
    await reload();
  }

  if (!info) return <p className="muted">{error || t('common.loading')}</p>;
  const { slot, part, variant } = info;
  const format = slot.format;
  const own = questions.length + passages.reduce((sum, p) => sum + p.questionCount, 0);

  return (
    <div>
      <Crumbs items={slotCrumbs(t, info)} />
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <span className={`kind-badge kind-${format}`}>{t(`admin.simulation.formats.${format}`)}</span>
          <h1 style={{ marginTop: 8 }}>{slot.name}</h1>
          <p className="muted">
            {slot.isPart
              ? <>{t('admin.simulation.partFill')} <CountBadge count={part.count} need={part.requiredCount} /></>
              : <>{t('admin.simulation.topicFill', { n: own })} · {t('admin.simulation.partOf', { name: part.name })} <CountBadge count={part.count} need={part.requiredCount} /></>}
          </p>
        </div>
        <button className="btn ghost sm" type="button" onClick={() => navigate(simPath('variant', variant.id))}>
          {t('admin.simulation.backToVariant')}
        </button>
      </div>
      {variant.status === 'published' && <p className="muted sim-hint">{t('admin.simulation.slotPublishedHint')}</p>}
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="err">{error}</p>}

      {slot.hasTopics && <div className="empty">{t('admin.simulation.partHasTopics')}</div>}

      {!slot.hasTopics && format === 'standard' && (
        <>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <button className="btn sm" type="button" onClick={() => setEditing(null)}>+ {t('admin.q.add')}</button>
            <TxtUploadButtons testId={slot.id} onDone={done} />
          </div>
          <TxtFormatHelp math />
          <QuestionList
            questions={questions}
            onEdit={setEditing}
            onDelete={async (q) => {
              if (!confirmDelete(t)) return;
              try {
                await adminApi.deleteQuestion(q.id);
                await done(t('admin.saved'));
              } catch (err) {
                await done(null, err.message);
              }
            }}
          />
        </>
      )}

      {!slot.hasTopics && format === 'compare' && (
        <CompareBlock
          testId={slot.id}
          questions={questions.filter(isCompare)}
          onChanged={(ok) => done(ok)}
          onError={(err) => done(null, err)}
        />
      )}

      {!slot.hasTopics && format === 'reading' && (
        <ReadingPassages
          section={{ id: slot.id }}
          passages={passages}
          passagePath={(id) => simPath('slot', slot.id, 'reading', id)}
          onChanged={(ok) => done(ok)}
          onError={(err) => done(null, err)}
        />
      )}

      {editing !== undefined && (
        <QuestionModal
          key={editing?.id || 'new'}
          testId={slot.id}
          initial={editing}
          onClose={() => setEditing(undefined)}
          onSaved={async (ok) => {
            setEditing(undefined);
            await done(ok);
          }}
        />
      )}
    </div>
  );
}
