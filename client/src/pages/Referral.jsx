import { useState } from 'react';
import { loadProgress } from '../lib/progress';

export default function Referral() {
  const p = loadProgress();
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/register?ref=${p.referralCode}`;
  const pct = Math.min(100, (p.invited / 5) * 100);

  return (
    <div>
      <h1>Пригласи друзей — получай бонусы</h1>
      <div className="card">
        <p className="muted">Персональный код</p>
        <h2>{p.referralCode}</h2>
        <button
          className="btn"
          type="button"
          onClick={() => { navigator.clipboard.writeText(link); setCopied(true); }}
        >
          {copied ? 'Скопировано' : 'Скопировать ссылку'}
        </button>
      </div>
      <div className="grid-4" style={{ marginTop: 16 }}>
        <div className="card stat"><b>{p.invited}</b><span className="muted">приглашено</span></div>
        <div className="card stat"><b>{p.registered}</b><span className="muted">зарегистрировались</span></div>
        <div className="card stat"><b>{p.premiumFromRef}</b><span className="muted">оформили Premium</span></div>
        <div className="card stat"><b>7 дн.</b><span className="muted">бонус за 5 друзей</span></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Пригласи 5 друзей → получи 7 дней Premium</h3>
        <div className="progress"><i style={{ width: `${pct}%` }} /></div>
        <p className="muted">{p.invited} / 5</p>
      </div>
    </div>
  );
}
