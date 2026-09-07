import { loadProgress } from '../lib/progress';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LangContext';

export default function Favorites() {
  const { t } = useLang();
  const p = loadProgress();
  return (
    <div>
      <h1>{t('fav.title')}</h1>
      <p className="muted">{t('fav.lead')}</p>
      {!p.favorites?.length && (
        <div className="empty">
          {t('fav.empty')}
          <div style={{ marginTop: 12 }}><Link className="btn" to="/app/tests">{t('fav.start')}</Link></div>
        </div>
      )}
      <ul>
        {(p.favorites || []).map((id) => <li key={id}>{t('fav.q', { id })}</li>)}
      </ul>
    </div>
  );
}
