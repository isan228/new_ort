import { useState } from 'react';
import { loadProgress } from '../lib/progress';
import { useLang } from '../context/LangContext';

export default function Referral() {
  const { t } = useLang();
  const p = loadProgress();
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/register?ref=${p.referralCode}`;
  const pct = Math.min(100, (p.invited / 5) * 100);

  return (
    <div>
      <h1>{t('ref.title')}</h1>
      <div className="card">
        <p className="muted">{t('ref.code')}</p>
        <h2>{p.referralCode}</h2>
        <button
          className="btn"
          type="button"
          onClick={() => { navigator.clipboard.writeText(link); setCopied(true); }}
        >
          {copied ? t('ref.copied') : t('ref.copy')}
        </button>
      </div>
      <div className="grid-4" style={{ marginTop: 16 }}>
        <div className="card stat"><b>{p.invited}</b><span className="muted">{t('ref.invited')}</span></div>
        <div className="card stat"><b>{p.registered}</b><span className="muted">{t('ref.registered')}</span></div>
        <div className="card stat"><b>{p.premiumFromRef}</b><span className="muted">{t('ref.premium')}</span></div>
        <div className="card stat"><b>7 {t('common.days')}</b><span className="muted">{t('ref.bonus')}</span></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>{t('ref.goal')}</h3>
        <div className="progress"><i style={{ width: `${pct}%` }} /></div>
        <p className="muted">{p.invited} / 5</p>
      </div>
    </div>
  );
}
