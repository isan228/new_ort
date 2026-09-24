import { useEffect, useState } from 'react';
import { authApi } from '../api/client';
import { useLang } from '../context/LangContext';
import { ACHIEVEMENT_DEFS } from '../lib/progress';

export default function Achievements() {
  const { t } = useLang();
  const [open, setOpen] = useState({});

  useEffect(() => {
    authApi.stats()
      .then((data) => setOpen(data.achievements || {}))
      .catch(() => setOpen({}));
  }, []);

  return (
    <div>
      <h1>{t('ach.title')}</h1>
      <p className="muted">{t('ach.lead')}</p>
      <div className="cards">
        {ACHIEVEMENT_DEFS.map((a) => {
          const unlocked = !!open[a.id];
          return (
            <div key={a.id} className={`card ${unlocked ? '' : 'locked'}`}>
              <div style={{ fontSize: 28 }}>{a.icon}</div>
              <h3>{t(`ach.${a.id}.title`)}</h3>
              <p className="muted">{t(`ach.${a.id}.text`)}</p>
              <span className={`badge ${unlocked ? 'ok' : ''}`}>{unlocked ? t('ach.open') : t('ach.locked')}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
