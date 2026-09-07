import { Link } from 'react-router-dom';
import { PublicShell } from '../components/Shells';
import { Reveal } from '../components/Reveal';
import { useLang } from '../context/LangContext';

export default function Landing() {
  const { t, copy } = useLang();
  const land = copy.land;
  const ticker = [...land.ticker, ...land.ticker];

  return (
    <PublicShell>
      <div className="page page-wide">
        <section className="hero">
          <Reveal>
            <img src="/logo-icon.png" alt="ORT.KG" className="logo-hero" />
            <p className="badge brand">{t('land.badge')}</p>
            <h1 className="hero-title">{t('land.h1a')}<em>{t('land.h1em')}</em>{t('land.h1b')}</h1>
            <p className="muted" style={{ fontSize: 18, maxWidth: 540 }}>{t('land.lead')}</p>
            <div className="row hero-cta">
              <Link className="btn lg" to="/register">{t('land.start')}</Link>
              <Link className="btn ghost lg" to="/pricing">{t('land.tariffs')}</Link>
            </div>
            <div className="row" style={{ marginTop: 18 }}>
              {land.badges.map((item) => <span key={item} className="badge">{item}</span>)}
            </div>
          </Reveal>
          <div className="mock">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="muted">{t('land.today')}</div>
                <b style={{ fontSize: 32 }}>30 / 40</b>
              </div>
              <span className="badge ok">{t('land.dayGoal')}</span>
            </div>
            <div className="progress" style={{ margin: '14px 0' }}><i style={{ width: '75%' }} /></div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{t('land.next')}</p>
            <div className="stats-compact">
              <div className="card stat" style={{ boxShadow: 'none' }}><b>12</b><span className="muted">{t('land.streak')}</span></div>
              <div className="card stat" style={{ boxShadow: 'none' }}><b>1 284</b><span className="muted">{t('land.qs')}</span></div>
              <div className="card stat" style={{ boxShadow: 'none' }}><b>81%</b><span className="muted">{t('land.acc')}</span></div>
            </div>
            <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>{t('land.mockLine')}</p>
          </div>
        </section>

        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {ticker.map((item, i) => (
              <span key={`${item}-${i}`}>{item} <b>·</b></span>
            ))}
          </div>
        </div>

        <Reveal className="grid-4" style={{ marginTop: 36 }} delay={80}>
          <div className="card stat"><b>3</b><span className="muted">{t('land.s1')}</span></div>
          <div className="card stat"><b>{t('land.s2t')}</b><span className="muted">{t('land.s2')}</span></div>
          <div className="card stat"><b>{t('land.s3t')}</b><span className="muted">{t('land.s3')}</span></div>
          <div className="card stat"><b>SRS</b><span className="muted">{t('land.s4')}</span></div>
        </Reveal>

        <Reveal as="section" className="section" id="programma" delay={40}>
          <p className="kicker">{t('land.kickerProg')}</p>
          <h2>{t('land.hProg')}</h2>
          <p className="lead">{t('land.leadProg')}</p>
          <div className="tracks" style={{ marginTop: 20 }}>
            {land.tracks.map((track) => (
              <div key={track.title} className="card">
                <span className="badge brand">{track.tag}</span>
                <h3 style={{ marginTop: 10 }}>{track.title}</h3>
                <p className="muted">{track.text}</p>
                <div className="row">
                  {track.items.map((item) => <span key={item} className="badge">{item}</span>)}
                </div>
              </div>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 16, fontSize: 14 }}>{t('land.note')}</p>
        </Reveal>

        <section className="section">
          <p className="kicker">{t('land.kickerPlat')}</p>
          <h2>{t('land.hPlat')}</h2>
          <p className="lead">{t('land.leadPlat')}</p>
          <div className="cards stagger" style={{ marginTop: 20 }}>
            {land.features.map((f) => (
              <div key={f.title} className="card">
                <h3>{f.title}</h3>
                <p className="muted">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section" id="kak">
          <p className="kicker">{t('land.kickerHow')}</p>
          <h2>{t('land.hHow')}</h2>
          <div className="grid-2" style={{ marginTop: 20 }}>
            <div className="card">
              {land.steps.map((s) => (
                <div key={s.n} className="step" style={{ marginBottom: 18 }}>
                  <span className="step-num">{s.n}</span>
                  <div>
                    <h3>{s.title}</h3>
                    <p className="muted">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="card">
              <h3>{t('land.weakTitle')}</h3>
              <p className="muted">{t('land.weakLead')}</p>
              {land.weak.map((w) => (
                <div key={w.name} style={{ marginBottom: 14 }}>
                  <div className="bar-row"><span>{w.name}</span><div className="progress"><i style={{ width: `${w.v}%` }} /></div><b>{w.v}%</b></div>
                  <p className="muted" style={{ fontSize: 13 }}>{w.hint}</p>
                </div>
              ))}
              <Link className="btn" to="/register">{t('land.closeWeak')}</Link>
            </div>
          </div>
        </section>

        <section className="section">
          <p className="kicker">{t('land.kickerDay')}</p>
          <h2>{t('land.hDay')}</h2>
          <div className="grid-3" style={{ marginTop: 20 }}>
            <div className="card">
              <span className="badge">25 мин</span>
              <h3>{t('land.d1t')}</h3>
              <p className="muted">{t('land.d1')}</p>
            </div>
            <div className="card">
              <span className="badge purple">15 мин</span>
              <h3>{t('land.d2t')}</h3>
              <p className="muted">{t('land.d2')}</p>
            </div>
            <div className="card">
              <span className="badge ok">10 мин</span>
              <h3>{t('land.d3t')}</h3>
              <p className="muted">{t('land.d3')}</p>
            </div>
          </div>
        </section>

        <section className="section">
          <p className="kicker">{t('land.kickerWho')}</p>
          <h2>{t('land.hWho')}</h2>
          <div className="grid-3" style={{ marginTop: 20 }}>
            <div className="card">
              <h3>{t('land.w1t')}</h3>
              <p className="muted">{t('land.w1')}</p>
            </div>
            <div className="card">
              <h3>{t('land.w2t')}</h3>
              <p className="muted">{t('land.w2')}</p>
            </div>
            <div className="card">
              <h3>{t('land.w3t')}</h3>
              <p className="muted">{t('land.w3')}</p>
            </div>
          </div>
        </section>

        <section className="section" id="faq">
          <p className="kicker">{t('land.kickerFaq')}</p>
          <h2>{t('land.hFaq')}</h2>
          <div className="faq" style={{ marginTop: 16 }}>
            {land.faq.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="cta-band">
          <div>
            <h2>{t('land.ctaTitle')}</h2>
            <p className="muted" style={{ margin: 0 }}>{t('land.ctaText')}</p>
          </div>
          <div className="row">
            <Link className="btn lg" to="/register">{t('land.ctaReg')}</Link>
            <Link className="btn ghost lg" to="/login">{t('land.ctaIn')}</Link>
          </div>
        </div>

        <footer className="site-footer">
          <div className="row site-footer-inner">
            <span className="row">
              <img src="/logo-icon.png" alt="" className="logo-img" />
              <span>{t('land.footer')}</span>
            </span>
            <span>{t('land.notOfficial')}</span>
          </div>
        </footer>
      </div>
    </PublicShell>
  );
}
