import { ACHIEVEMENTS } from '../lib/progress';
import { useLang } from '../context/LangContext';

export default function Achievements() {
  const { t } = useLang();
  return (
    <div>
      <h1>{t('ach.title')}</h1>
      <p className="muted">{t('ach.lead')}</p>
      <div className="cards">
        {ACHIEVEMENTS.map((a) => (
          <div key={a.id} className={`card ${a.unlocked ? '' : 'locked'}`}>
            <div style={{ fontSize: 28 }}>{a.icon}</div>
            <h3>{t(`ach.${a.id}.title`)}</h3>
            <p className="muted">{t(`ach.${a.id}.text`)}</p>
            <span className={`badge ${a.unlocked ? 'ok' : ''}`}>{a.unlocked ? t('ach.open') : t('ach.locked')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
