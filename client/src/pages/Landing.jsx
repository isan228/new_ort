import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicShell } from '../components/Shells';
import { Reveal } from '../components/Reveal';
import SiteFooter, { CtaArrow as Arrow, Underlined } from '../components/SiteFooter';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

const ICONS = {
  exam: 'M9 4h6M12 4v3M5.5 13a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0ZM12 10v3l2 1.5',
  builder: 'M4 6h10M4 12h16M4 18h7M17 4v4M9 10v4M14 16v4',
  review: 'M5 12.5 9.5 17 19 7.5',
  cards: 'M7 6h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM4 16V5a1 1 0 0 1 1-1h11',
  stats: 'M5 19V11M10 19V6M15 19v-5M20 19V9',
  main: 'M4 6.5 12 3l8 3.5-8 3.5-8-3.5ZM4 11.5l8 3.5 8-3.5M4 16.5 12 20l8-3.5',
  rank: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3',
  check: 'M5 12.5 9.5 17 19 7.5',
  plus: 'M12 5v14M5 12h14',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z',
};

function Icon({ name, size = 22, fill = false }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d={ICONS[name]}
        fill={fill ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Stars() {
  return (
    <span className="cl-stars" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => <Icon key={i} name="star" size={14} fill />)}
    </span>
  );
}

function QuestionMock({ p, reveal }) {
  return (
    <div className="cl-q">
      <div className="cl-q-top">
        <span>{p.item}</span>
        <span className="cl-q-dots"><i /><i /><i /></span>
      </div>
      <div className="cl-q-body">
        <p className="cl-q-stem">{p.q}</p>
        <div className="cl-q-answers">
          {p.a.map((text, i) => (
            <div key={text} className={`cl-q-ans ${i === 0 ? (reveal ? 'is-ok' : 'is-on') : ''}`}>
              <span className="cl-q-radio" />
              <b>{'ABCD'[i]}.</b>
              <span>{text}</span>
            </div>
          ))}
        </div>
        {reveal ? (
          <div className="cl-q-expl">
            <b>{p.correct} · {p.expl}</b>
            <p>{p.explText}</p>
          </div>
        ) : (
          <span className="cl-q-submit">{p.submit}</span>
        )}
      </div>
    </div>
  );
}

function BuilderMock({ p }) {
  return (
    <div className="cl-q">
      <div className="cl-q-top"><span>{p.builderTitle}</span></div>
      <div className="cl-q-body">
        {p.builderRows.map(([k, v]) => (
          <div key={k} className="cl-build-row"><span>{k}</span><b>{v}</b></div>
        ))}
        <span className="cl-q-submit">{p.submit}</span>
      </div>
    </div>
  );
}

function CardsMock({ p }) {
  return (
    <div className="cl-cards-stack">
      <div className="cl-flash back2" />
      <div className="cl-flash back1" />
      <div className="cl-flash">
        <span className="cl-flash-k">{p.cardFront}</span>
        <b>{p.cardBack}</b>
        <span className="cl-flash-hint">{p.cardFlip}</span>
      </div>
    </div>
  );
}

function StatsMock({ p, rows }) {
  return (
    <div className="cl-q">
      <div className="cl-q-top"><span>{p.statsTitle}</span><span>{p.score}: 186,4</span></div>
      <div className="cl-q-body">
        {rows.map((row) => (
          <div key={row.name} className="cl-bar">
            <span>{row.name}</span>
            <div><i style={{ width: `${row.v}%` }} /></div>
            <b>{row.v}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function Preview({ kind, cl, weak }) {
  const p = cl.preview;
  const rows = [...weak, { name: 'Грамматика', v: 91 }];
  if (kind === 'builder') return <BuilderMock p={p} />;
  if (kind === 'cards') return <CardsMock p={p} />;
  if (kind === 'stats') return <StatsMock p={p} rows={rows} />;
  return <QuestionMock p={p} reveal={kind === 'review'} />;
}

const CHIPS = ['exam', 'builder', 'review', 'cards', 'stats'];
const BENTO_ICONS = ['main', 'builder', 'cards', 'review', 'stats', 'rank'];
const BENTO_PREVIEW = [null, 'builder', 'cards', 'review', 'stats', null];

export default function Landing() {
  const { copy } = useLang();
  const { user } = useAuth();
  const land = copy.land;
  const cl = land.cl;
  const [chip, setChip] = useState('exam');
  const [openFaq, setOpenFaq] = useState(0);
  const startTo = user ? '/app' : '/register';

  return (
    <PublicShell>
      <div className="cl-page">
        <section className="cl-hero">
          <div className="cl-container cl-hero-grid">
            <div className="cl-hero-copy">
              <div className="cl-proof"><Stars /><span>{cl.proof}</span></div>
              <h1 className="cl-h1">
                <Underlined>{cl.h1a}</Underlined>
                {' '}
                {cl.h1b}
              </h1>
              <div className="cl-bullets">
                {cl.bullets.map((item) => (
                  <div key={item.b} className="cl-bullet">
                    <span className="cl-bullet-ic"><Icon name="check" size={16} /></span>
                    <p><b>{item.b}</b> <span>{item.t}</span></p>
                  </div>
                ))}
              </div>
              <Link className="cl-cta" to={startTo}>
                <span>{cl.start}</span>
                <Arrow />
              </Link>
              <div className="cl-chips">
                {CHIPS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={chip === key}
                    className={`cl-chip ${chip === key ? 'is-on' : ''}`}
                    onClick={() => setChip(key)}
                  >
                    <Icon name={key} size={20} />
                    <span>{cl.chips[key]}</span>
                  </button>
                ))}
                <Link className="cl-chip cl-chip-more" to={startTo}>{cl.more}</Link>
              </div>
            </div>
            <div className="cl-hero-visual">
              <div className="cl-visual-frame">
                <Preview kind={chip} cl={cl} weak={land.weak} />
              </div>
            </div>
          </div>
        </section>

        <section className="cl-logos">
          <div className="cl-container cl-logos-row">
            <p className="cl-logos-k">{cl.logos}</p>
            <div className="cl-logos-list">
              {land.ticker.slice(0, 7).map((name) => <span key={name}>{name}</span>)}
            </div>
          </div>
        </section>

        <section className="cl-dark-wrap">
          <div className="cl-dark">
            <Reveal className="cl-dark-copy">
              <h2>{cl.darkH}</h2>
              <p>{cl.darkP}</p>
              <Link className="cl-cta cl-cta-glow" to={user ? '/app/exam' : '/register'}>
                <Icon name="exam" size={22} />
                <span>{cl.darkCta}</span>
              </Link>
            </Reveal>
            <Reveal className="cl-dark-visual" delay={80}>
              <div className="cl-exam">
                <div className="cl-exam-top">
                  <span>{cl.preview.item}</span>
                  <span className="cl-exam-timer">{cl.timer}</span>
                </div>
                <div className="cl-exam-body">
                  <div className="cl-exam-nav">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <span key={n} className={n === 7 ? 'is-on' : (n < 7 ? 'is-done' : '')}>{n}</span>
                    ))}
                  </div>
                  <div className="cl-exam-main">
                    <p className="cl-q-stem">{cl.preview.q}</p>
                    <div className="cl-q-answers">
                      {cl.preview.a.map((text, i) => (
                        <div key={text} className={`cl-q-ans ${i === 0 ? 'is-on' : ''}`}>
                          <span className="cl-q-radio" />
                          <b>{'ABCD'[i]}.</b>
                          <span>{text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="cl-gray" id="platforma">
          <div className="cl-container">
            <Reveal className="cl-head">
              <h2>{cl.bentoH}</h2>
              <p>{cl.bentoP}</p>
            </Reveal>
            <div className="cl-bento">
              {land.features.map((f, i) => (
                <Reveal key={f.title} className="cl-bento-card" delay={(i % 2) * 60}>
                  <div className="cl-bento-title">
                    <span className="cl-bento-ic"><Icon name={BENTO_ICONS[i]} size={18} /></span>
                    <h3>{f.title}</h3>
                  </div>
                  <p>{f.text}</p>
                  <div className="cl-bento-visual">
                    {BENTO_PREVIEW[i] ? (
                      <Preview kind={BENTO_PREVIEW[i]} cl={cl} weak={land.weak} />
                    ) : i === 0 ? (
                      <div className="cl-tags">
                        {land.ticker.map((name) => <span key={name}>{name}</span>)}
                      </div>
                    ) : (
                      <div className="cl-q">
                        <div className="cl-q-body">
                          {['Айгерим', 'Бекзат', 'Ты'].map((name, idx) => (
                            <div key={name} className={`cl-build-row ${idx === 2 ? 'is-me' : ''}`}>
                              <span>{idx + 1}. {name}</span>
                              <b>{[212, 204, 198][idx]}</b>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="cl-white" id="programma">
          <div className="cl-container">
            <Reveal className="cl-head">
              <h2>{cl.progH}</h2>
              <p>{land.leadProg}</p>
            </Reveal>
            <div className="cl-tracks">
              {land.tracks.map((track, i) => (
                <Reveal key={track.title} className="cl-card" delay={i * 60}>
                  <span className="cl-card-tag">{track.tag}</span>
                  <h3>{track.title}</h3>
                  <p>{track.text}</p>
                  <div className="cl-tags">
                    {track.items.map((item) => <span key={item}>{item}</span>)}
                  </div>
                </Reveal>
              ))}
            </div>
            <p className="cl-note">{land.note}</p>
          </div>
        </section>

        <section className="cl-white" id="kak">
          <div className="cl-container">
            <Reveal className="cl-head">
              <h2>{cl.howH}</h2>
              <p>{cl.howP}</p>
            </Reveal>
            <div className="cl-steps">
              {land.steps.map((s, i) => (
                <Reveal key={s.n} className="cl-card" delay={i * 50}>
                  <span className="cl-step-n">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="cl-white" id="faq">
          <div className="cl-container cl-narrow">
            <div className="cl-head">
              <h2>{cl.faqH}</h2>
              <p>{cl.faqP}</p>
            </div>
            <div className="cl-faq">
              {land.faq.map((item, i) => {
                const open = openFaq === i;
                return (
                  <div key={item.q} className={`cl-faq-item ${open ? 'is-open' : ''}`}>
                    <button type="button" aria-expanded={open} onClick={() => setOpenFaq(open ? -1 : i)}>
                      <span>{item.q}</span>
                      <Icon name="plus" size={20} />
                    </button>
                    {open && <p>{item.a}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <SiteFooter />
      </div>
    </PublicShell>
  );
}
