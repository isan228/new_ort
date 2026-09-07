import { useEffect, useMemo, useRef, useState } from 'react';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';

const TRACKS = [
  { id: 'main', key: 'admin.trackMain' },
  { id: 'state_lang', key: 'admin.trackLang' },
  { id: 'subject', key: 'admin.trackSubject' },
];

function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="card admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn ghost sm" type="button" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ListItem({ title, meta, extra, children }) {
  return (
    <div className="admin-list-item">
      <div style={{ minWidth: 0, flex: 1 }}>
        <h4>{title} {extra}</h4>
        {meta && <p className="muted" style={{ margin: '6px 0 0' }}>{meta}</p>}
      </div>
      <div className="row">{children}</div>
    </div>
  );
}

function emptyQuestion() {
  return {
    text: '',
    explanation: '',
    answers: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ],
    topic: '',
    skill: '',
  };
}

export default function AdminContent() {
  const { t } = useLang();
  const testsRef = useRef(null);
  const questionsRef = useRef(null);
  const flashRef = useRef(null);

  const [stats, setStats] = useState(null);
  const [plans, setPlans] = useState([]);
  const [tags, setTags] = useState([]);
  const [terms, setTerms] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [tests, setTests] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [cards, setCards] = useState([]);

  const [subjectFilter, setSubjectFilter] = useState('');
  const [questionTestId, setQuestionTestId] = useState('');
  const [flashTestId, setFlashTestId] = useState('');
  const [flashTagId, setFlashTagId] = useState('');
  const [flashTrack, setFlashTrack] = useState('');

  const [newTag, setNewTag] = useState('');
  const [newTagKind, setNewTagKind] = useState('topic');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);

  const trackLabel = (id) => t(TRACKS.find((tr) => tr.id === id)?.key || 'admin.trackMain');

  async function reloadSidebar() {
    const [st, pl, tg, tm] = await Promise.all([
      adminApi.stats(),
      adminApi.plans(),
      adminApi.tags(),
      adminApi.termImages(),
    ]);
    setStats(st);
    setPlans(pl.plans);
    setTags(tg.tags);
    setTerms(tm.items);
  }

  async function reloadSubjects() {
    setSubjects((await adminApi.subjects()).subjects);
  }

  async function reloadTests(subjectId = subjectFilter) {
    setTests((await adminApi.tests(subjectId || undefined)).tests);
  }

  async function reloadQuestions(testId = questionTestId) {
    if (!testId) { setQuestions([]); return; }
    setQuestions((await adminApi.questions(testId)).questions);
  }

  async function reloadCards(params = {}) {
    const query = {
      ...(params.testId || flashTestId ? { testId: params.testId || flashTestId } : {}),
      ...(params.tagId || flashTagId ? { tagId: params.tagId || flashTagId } : {}),
      ...(params.trackGroup || flashTrack ? { trackGroup: params.trackGroup || flashTrack } : {}),
    };
    setCards((await adminApi.flashcards(query)).flashcards || []);
  }

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([reloadSidebar(), reloadSubjects(), reloadTests(''), reloadCards({})]);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  useEffect(() => { reloadTests(subjectFilter).catch((e) => setError(e.message)); }, [subjectFilter]);
  useEffect(() => { reloadQuestions(questionTestId).catch((e) => setError(e.message)); }, [questionTestId]);
  useEffect(() => { reloadCards({}).catch((e) => setError(e.message)); }, [flashTestId, flashTagId, flashTrack]);
  useEffect(() => {
    if (questionTestId && tests.length && !tests.some((row) => String(row.id) === String(questionTestId))) {
      setQuestionTestId('');
    }
  }, [tests, questionTestId]);

  const allTests = useMemo(() => tests, [tests]);

  function note(text) {
    setMsg(text);
    setError('');
  }

  async function wrap(fn) {
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }

  async function savePlans() {
    await wrap(async () => {
      await adminApi.savePlans(plans);
      note(t('admin.saved'));
    });
  }

  async function addTag() {
    await wrap(async () => {
      if (!newTag.trim()) return;
      await adminApi.createTag({ name: newTag, kind: newTagKind });
      setNewTag('');
      setTags((await adminApi.tags()).tags);
    });
  }

  async function uploadQuestions(url) {
    if (!questionTestId) {
      setError(t('admin.pickTestFirst'));
      return;
    }
    const file = await pickFile('.txt');
    if (!file) return;
    await wrap(async () => {
      const data = await adminApi.uploadTxt(url, questionTestId, file);
      note(`+${data.created} / upd ${data.updated}`);
      await reloadQuestions();
      await reloadTests();
    });
  }

  async function uploadCards() {
    const file = await pickFile('.txt');
    if (!file) return;
    await wrap(async () => {
      const data = await adminApi.uploadTxt('/api/admin/upload-txt-flashcards', flashTestId || null, file, {
        trackGroup: flashTrack || 'main',
      });
      note(`+${data.created} / upd ${data.updated}`);
      await reloadCards();
    });
  }

  return (
    <div>
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <h1>{t('admin.program')}</h1>
          <p className="muted">{t('admin.programLead')}</p>
        </div>
      </div>
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="err">{error}</p>}

      <div className="admin-program">
        <aside className="admin-aside">
          <div className="card">
            <div className="kicker">{t('admin.subs')}</div>
            <div className="admin-mini-stats">
              <div className="admin-mini-stat"><span>{t('admin.active')}</span><b>{stats?.activeSubs ?? '—'}</b></div>
              <div className="admin-mini-stat"><span>{t('admin.expired')}</span><b>{stats?.expired ?? '—'}</b></div>
              <div className="admin-mini-stat"><span>{t('admin.ever')}</span><b>{stats?.everSubscribed ?? '—'}</b></div>
              <div className="admin-mini-stat"><span>{t('admin.paid')}</span><b>{stats?.paid ?? '—'}</b></div>
            </div>
            <p className="muted" style={{ margin: '12px 0 0', fontSize: 13 }}>
              {t('admin.revenue')}: <b>{stats?.revenue ?? '—'}</b> {t('common.som')}
            </p>
          </div>

          <div className="card">
            <div className="kicker">{t('admin.plans')}</div>
            <p className="muted" style={{ fontSize: 13 }}>{t('admin.plansHint')}</p>
            {plans.map((plan, i) => (
              <div key={plan.id || i} className="admin-plan-row">
                <label className="field" style={{ marginBottom: 8 }}>
                  <span>{plan.months === 12 ? t('admin.month12') : plan.months === 3 ? t('admin.month3') : t('admin.month1')}</span>
                  <input
                    type="number"
                    min="0"
                    value={plan.price}
                    onChange={(e) => {
                      const next = [...plans];
                      next[i] = { ...plan, price: Number(e.target.value) };
                      setPlans(next);
                    }}
                  />
                </label>
              </div>
            ))}
            <button className="btn sm" type="button" onClick={savePlans}>{t('admin.savePlans')}</button>
          </div>

          <details className="card admin-details" open>
            <summary>{t('admin.tags')}</summary>
            <p className="muted" style={{ fontSize: 13 }}>{t('admin.tagsHint')}</p>
            <div className="row" style={{ marginBottom: 8 }}>
              <input
                style={{ flex: 1, minWidth: 0 }}
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder={t('admin.newTag')}
              />
              <select value={newTagKind} onChange={(e) => setNewTagKind(e.target.value)}>
                <option value="topic">{t('admin.topic')}</option>
                <option value="skill">{t('admin.skill')}</option>
              </select>
              <button className="btn sm" type="button" onClick={addTag}>+</button>
            </div>
            <button
              className="btn ghost sm"
              type="button"
              onClick={() => wrap(async () => {
                const data = await adminApi.mergeDuplicateTags();
                note(data.message);
                setTags((await adminApi.tags()).tags);
              })}
            >
              {t('admin.mergeTags')}
            </button>
            <div className="admin-tag-list">
              {tags.map((tag) => (
                <div key={tag.id} className="admin-tag">
                  <span>
                    <b>{tag.name}</b>
                    <em className="muted"> · {tag.kind === 'skill' ? t('admin.skill') : t('admin.topic')}</em>
                  </span>
                  <button
                    className="btn bad sm"
                    type="button"
                    onClick={() => wrap(async () => {
                      if (!window.confirm(t('common.delete'))) return;
                      await adminApi.deleteTag(tag.id);
                      setTags((await adminApi.tags()).tags);
                    })}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </details>

          <details className="card admin-details">
            <summary>{t('admin.glossary')}</summary>
            <p className="muted" style={{ fontSize: 13 }}>{t('admin.glossaryHint')}</p>
            <button className="btn sm" type="button" style={{ width: '100%' }} onClick={() => setModal({ type: 'term' })}>
              {t('admin.addPhoto')}
            </button>
            <div className="admin-term-list">
              {terms.map((item) => (
                <div key={item.id} className="admin-term">
                  <img src={item.imageUrl} alt="" />
                  <div>
                    <b>{item.title}</b>
                    <p className="muted" style={{ margin: 0, fontSize: 12 }}>{(item.keywords || []).join(', ')}</p>
                  </div>
                  <button
                    className="btn bad sm"
                    type="button"
                    onClick={() => wrap(async () => {
                      if (!window.confirm(t('common.delete'))) return;
                      await adminApi.deleteTerm(item.id);
                      setTerms((await adminApi.termImages()).items);
                    })}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </details>
        </aside>

        <div>
          <div className="admin-section-head">
            <h3>{t('admin.subjects')}</h3>
            <button className="btn sm" type="button" onClick={() => setModal({ type: 'subject' })}>{t('admin.addSubject')}</button>
          </div>
          <div className="admin-list">
            {subjects.map((s) => (
              <ListItem
                key={s.id}
                title={s.name}
                extra={<span className="badge brand">{trackLabel(s.trackGroup)}</span>}
                meta={`${s.description ? `${s.description} · ` : ''}${t('admin.testsCount', { n: s.testCount || 0 })}`}
              >
                <button className="btn ghost sm" type="button" onClick={() => {
                  setSubjectFilter(String(s.id));
                  testsRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}>{t('admin.toTests')}</button>
                <button className="btn ghost sm" type="button" onClick={() => setModal({ type: 'subject', item: s })}>{t('common.edit')}</button>
                <button className="btn bad sm" type="button" onClick={() => wrap(async () => {
                  if (!window.confirm(t('common.delete'))) return;
                  await adminApi.deleteSubject(s.id);
                  await reloadSubjects();
                  await reloadTests();
                })}>{t('common.delete')}</button>
              </ListItem>
            ))}
            {!subjects.length && <p className="empty">{t('admin.addSubject')}</p>}
          </div>

          <div className="admin-section-head" ref={testsRef}>
            <h3>{t('admin.testsTitle')}</h3>
            <div className="row">
              <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
                <option value="">{t('admin.allSubjects')}</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button className="btn sm" type="button" onClick={() => setModal({ type: 'test' })}>{t('admin.addTest')}</button>
            </div>
          </div>
          <div className="admin-list">
            {allTests.map((test) => (
              <ListItem
                key={test.id}
                title={test.name}
                extra={<span className="badge">{test.Subject?.name || '—'}</span>}
                meta={t('admin.questionsCount', { n: test.questionCount || 0 })}
              >
                <button className="btn ghost sm" type="button" onClick={() => {
                  setQuestionTestId(String(test.id));
                  questionsRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}>{t('admin.toQuestions')}</button>
                <button className="btn ghost sm" type="button" onClick={() => setModal({ type: 'test', item: test })}>{t('common.edit')}</button>
                <button className="btn bad sm" type="button" onClick={() => wrap(async () => {
                  if (!window.confirm(t('common.delete'))) return;
                  await adminApi.deleteTest(test.id);
                  await reloadTests();
                  if (String(questionTestId) === String(test.id)) setQuestionTestId('');
                })}>{t('common.delete')}</button>
              </ListItem>
            ))}
            {!allTests.length && <p className="empty">{t('admin.addTest')}</p>}
          </div>

          <div className="admin-section-head" ref={questionsRef}>
            <h3>{t('admin.questionsTitle')}</h3>
            <div className="row">
              <select value={questionTestId} onChange={(e) => setQuestionTestId(e.target.value)}>
                <option value="">{t('admin.pickTest')}</option>
                {allTests.map((test) => (
                  <option key={test.id} value={test.id}>{test.name}{test.Subject?.name ? ` — ${test.Subject.name}` : ''}</option>
                ))}
              </select>
              <button className="btn sm" type="button" disabled={!questionTestId} onClick={() => setModal({ type: 'question' })}>
                {t('admin.addQuestion')}
              </button>
              <button className="btn ghost sm" type="button" disabled={!questionTestId} onClick={() => uploadQuestions('/api/admin/upload-txt-explained')}>
                {t('admin.txtExplained')}
              </button>
              <button className="btn ghost sm" type="button" disabled={!questionTestId} onClick={() => uploadQuestions('/api/admin/upload-txt-linked')}>
                {t('admin.txtLinked')}
              </button>
            </div>
          </div>
          <div className="admin-list">
            {!questionTestId && <p className="empty">{t('admin.pickTestFirst')}</p>}
            {questions.map((q) => (
              <ListItem
                key={q.id}
                title={q.text.slice(0, 140)}
                extra={q.groupId ? <span className="badge purple">linked</span> : null}
                meta={(q.tags || []).map((tag) => tag.name).join(' · ')}
              >
                <button className="btn ghost sm" type="button" onClick={() => setModal({ type: 'question', item: q })}>{t('common.edit')}</button>
                <button className="btn bad sm" type="button" onClick={() => wrap(async () => {
                  if (!window.confirm(t('common.delete'))) return;
                  await adminApi.deleteQuestion(q.id);
                  await reloadQuestions();
                  await reloadTests();
                })}>×</button>
              </ListItem>
            ))}
          </div>

          <div className="admin-section-head" ref={flashRef}>
            <h3>{t('admin.flashTitle')}</h3>
            <div className="row">
              <select value={flashTestId} onChange={(e) => setFlashTestId(e.target.value)}>
                <option value="">{t('admin.allTests')}</option>
                {allTests.map((test) => <option key={test.id} value={test.id}>{test.name}</option>)}
              </select>
              <select value={flashTagId} onChange={(e) => setFlashTagId(e.target.value)}>
                <option value="">{t('admin.allTags')}</option>
                {tags.filter((tag) => tag.kind === 'topic').map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
              </select>
              <select value={flashTrack} onChange={(e) => setFlashTrack(e.target.value)}>
                <option value="">{t('admin.allTracks')}</option>
                {TRACKS.map((tr) => <option key={tr.id} value={tr.id}>{t(tr.key)}</option>)}
              </select>
              <button className="btn sm" type="button" onClick={() => setModal({ type: 'flashcard' })}>{t('admin.addCard')}</button>
              <button className="btn ghost sm" type="button" onClick={uploadCards}>{t('admin.txtCards')}</button>
            </div>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>{t('admin.flashHint')}</p>
          <div className="admin-list">
            {cards.map((card) => (
              <ListItem
                key={card.id}
                title={card.frontText?.slice(0, 140)}
                extra={<span className="badge">{trackLabel(card.trackGroup)}</span>}
                meta={card.backText?.slice(0, 120)}
              >
                <button className="btn ghost sm" type="button" onClick={() => setModal({ type: 'flashcard', item: card })}>{t('common.edit')}</button>
                <button className="btn bad sm" type="button" onClick={() => wrap(async () => {
                  if (!window.confirm(t('common.delete'))) return;
                  await adminApi.deleteFlashcard(card.id);
                  await reloadCards();
                })}>×</button>
              </ListItem>
            ))}
          </div>
        </div>
      </div>

      {modal?.type === 'subject' && (
        <SubjectModal
          t={t}
          item={modal.item}
          onClose={() => setModal(null)}
          onSave={async (body) => {
            await wrap(async () => {
              if (modal.item) await adminApi.updateSubject(modal.item.id, body);
              else await adminApi.createSubject(body);
              await reloadSubjects();
              setModal(null);
              note(t('admin.saved'));
            });
          }}
        />
      )}
      {modal?.type === 'test' && (
        <TestModal
          t={t}
          item={modal.item}
          subjects={subjects}
          defaultSubjectId={subjectFilter}
          onClose={() => setModal(null)}
          onSave={async (body) => {
            await wrap(async () => {
              if (modal.item) await adminApi.updateTest(modal.item.id, body);
              else await adminApi.createTest(body);
              await reloadTests();
              setModal(null);
              note(t('admin.saved'));
            });
          }}
        />
      )}
      {modal?.type === 'question' && (
        <QuestionModal
          t={t}
          item={modal.item}
          onClose={() => setModal(null)}
          onSave={async (body) => {
            await wrap(async () => {
              if (modal.item) await adminApi.updateQuestion(modal.item.id, { ...body, testId: questionTestId });
              else await adminApi.createQuestion({ ...body, testId: Number(questionTestId) });
              await reloadQuestions();
              await reloadTests();
              setModal(null);
              note(t('admin.saved'));
            });
          }}
        />
      )}
      {modal?.type === 'flashcard' && (
        <FlashModal
          t={t}
          item={modal.item}
          tests={allTests}
          defaultTrack={flashTrack || 'main'}
          defaultTestId={flashTestId}
          onClose={() => setModal(null)}
          onSave={async (body) => {
            await wrap(async () => {
              if (modal.item) await adminApi.updateFlashcard(modal.item.id, body);
              else await adminApi.createFlashcard(body);
              await reloadCards();
              setModal(null);
              note(t('admin.saved'));
            });
          }}
        />
      )}
      {modal?.type === 'term' && (
        <TermModal
          t={t}
          onClose={() => setModal(null)}
          onSave={async (form) => {
            await wrap(async () => {
              await adminApi.createTerm(form);
              setTerms((await adminApi.termImages()).items);
              setModal(null);
              note(t('admin.saved'));
            });
          }}
        />
      )}
    </div>
  );
}

function SubjectModal({ t, item, onClose, onSave }) {
  const [name, setName] = useState(item?.name || '');
  const [description, setDescription] = useState(item?.description || '');
  const [trackGroup, setTrackGroup] = useState(item?.trackGroup || 'main');
  const [language, setLanguage] = useState(item?.language || 'ru');
  return (
    <Modal title={item ? t('common.edit') : t('admin.addSubject')} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave({ name, description, trackGroup, language }); }}>
        <label className="field"><span>{t('admin.name')}</span><input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label className="field"><span>{t('admin.description')}</span><input value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <label className="field">
          <span>{t('admin.program')}</span>
          <select value={trackGroup} onChange={(e) => setTrackGroup(e.target.value)}>
            {TRACKS.map((tr) => <option key={tr.id} value={tr.id}>{t(tr.key)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{t('admin.language')}</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="ru">ru</option>
            <option value="ky">ky</option>
            <option value="any">any</option>
          </select>
        </label>
        <div className="row">
          <button className="btn" type="submit">{t('common.save')}</button>
          <button className="btn ghost" type="button" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </form>
    </Modal>
  );
}

function TestModal({ t, item, subjects, defaultSubjectId, onClose, onSave }) {
  const [name, setName] = useState(item?.name || '');
  const [description, setDescription] = useState(item?.description || '');
  const [subjectId, setSubjectId] = useState(item?.subjectId || defaultSubjectId || subjects[0]?.id || '');
  return (
    <Modal title={item ? t('common.edit') : t('admin.addTest')} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave({ name, description, subjectId: Number(subjectId) }); }}>
        <label className="field">
          <span>{t('admin.subjects')}</span>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="field"><span>{t('admin.name')}</span><input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label className="field"><span>{t('admin.description')}</span><input value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <div className="row">
          <button className="btn" type="submit" disabled={!subjectId}>{t('common.save')}</button>
          <button className="btn ghost" type="button" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </form>
    </Modal>
  );
}

function QuestionModal({ t, item, onClose, onSave }) {
  const initial = item ? {
    text: item.text || '',
    explanation: item.explanation || '',
    answers: (item.answers?.length ? item.answers : emptyQuestion().answers).map((a, i, arr) => ({
      text: a.text || '',
      isCorrect: a.isCorrect ?? arr.findIndex((x) => x.isCorrect) === i,
    })),
    topic: (item.tags || []).find((tag) => tag.kind === 'topic')?.name || '',
    skill: (item.tags || []).find((tag) => tag.kind === 'skill')?.name || '',
  } : emptyQuestion();
  const [form, setForm] = useState(initial);

  function setAnswer(i, patch) {
    const answers = form.answers.map((a, idx) => {
      if (patch.isCorrect) return { ...a, isCorrect: idx === i, ...(idx === i ? patch : {}) };
      return idx === i ? { ...a, ...patch } : a;
    });
    setForm({ ...form, answers });
  }

  return (
    <Modal title={item ? t('common.edit') : t('admin.addQuestion')} onClose={onClose}>
      <form onSubmit={(e) => {
        e.preventDefault();
        onSave({
          text: form.text,
          explanation: form.explanation,
          answers: form.answers.filter((a) => a.text.trim()).map((a, i) => ({ ...a, sortOrder: i + 1 })),
          tags: [
            form.topic && { name: form.topic, kind: 'topic' },
            form.skill && { name: form.skill, kind: 'skill' },
          ].filter(Boolean),
        });
      }}>
        <label className="field"><span>{t('admin.questions')}</span>
          <textarea rows={4} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} required />
        </label>
        {form.answers.map((a, i) => (
          <label key={i} className="field">
            <span>{t('admin.answers')} {i + 1} {a.isCorrect ? `· ${t('admin.correct')}` : ''}</span>
            <div className="row">
              <input style={{ flex: 1 }} value={a.text} onChange={(e) => setAnswer(i, { text: e.target.value })} />
              <button className={`btn sm ${a.isCorrect ? '' : 'ghost'}`} type="button" onClick={() => setAnswer(i, { isCorrect: true })}>
                {t('admin.correct')}
              </button>
            </div>
          </label>
        ))}
        <label className="field"><span>{t('admin.explanation')}</span>
          <textarea rows={3} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
        </label>
        <div className="grid-2">
          <label className="field"><span>{t('admin.topic')}</span>
            <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
          </label>
          <label className="field"><span>{t('admin.skill')}</span>
            <input value={form.skill} onChange={(e) => setForm({ ...form, skill: e.target.value })} />
          </label>
        </div>
        <div className="row">
          <button className="btn" type="submit">{t('common.save')}</button>
          <button className="btn ghost" type="button" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </form>
    </Modal>
  );
}

function FlashModal({ t, item, tests, defaultTrack, defaultTestId, onClose, onSave }) {
  const [frontText, setFront] = useState(item?.frontText || '');
  const [backText, setBack] = useState(item?.backText || '');
  const [trackGroup, setTrack] = useState(item?.trackGroup || defaultTrack);
  const [testId, setTestId] = useState(item?.testId || defaultTestId || '');
  const [topic, setTopic] = useState((item?.QuestionTags || item?.questionTags || [])[0]?.name || '');
  return (
    <Modal title={item ? t('common.edit') : t('admin.addCard')} onClose={onClose}>
      <form onSubmit={(e) => {
        e.preventDefault();
        onSave({
          frontText,
          backText,
          trackGroup,
          testId: testId ? Number(testId) : null,
          topic,
        });
      }}>
        <label className="field"><span>{t('admin.front')}</span><textarea rows={3} value={frontText} onChange={(e) => setFront(e.target.value)} required /></label>
        <label className="field"><span>{t('admin.back')}</span><textarea rows={3} value={backText} onChange={(e) => setBack(e.target.value)} required /></label>
        <label className="field">
          <span>{t('admin.program')}</span>
          <select value={trackGroup} onChange={(e) => setTrack(e.target.value)}>
            {TRACKS.map((tr) => <option key={tr.id} value={tr.id}>{t(tr.key)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{t('admin.tests')}</span>
          <select value={testId} onChange={(e) => setTestId(e.target.value)}>
            <option value="">{t('admin.allTests')}</option>
            {tests.map((test) => <option key={test.id} value={test.id}>{test.name}</option>)}
          </select>
        </label>
        <label className="field"><span>{t('admin.topic')}</span><input value={topic} onChange={(e) => setTopic(e.target.value)} /></label>
        <div className="row">
          <button className="btn" type="submit">{t('common.save')}</button>
          <button className="btn ghost" type="button" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </form>
    </Modal>
  );
}

function TermModal({ t, onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [keywords, setKeywords] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  return (
    <Modal title={t('admin.addPhoto')} onClose={onClose}>
      <form onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData();
        form.append('title', title);
        form.append('keywords', keywords);
        form.append('description', description);
        if (file) form.append('image', file);
        onSave(form);
      }}>
        <label className="field"><span>{t('admin.name')}</span><input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
        <label className="field"><span>{t('admin.keywords')}</span><input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={t('admin.keywordsHint')} /></label>
        <label className="field"><span>{t('admin.description')}</span><input value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <label className="field"><span>{t('admin.image')}</span><input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} required /></label>
        <div className="row">
          <button className="btn" type="submit">{t('common.save')}</button>
          <button className="btn ghost" type="button" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </form>
    </Modal>
  );
}
