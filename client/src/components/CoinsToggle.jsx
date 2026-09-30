import { Link } from 'react-router-dom';
import { useLang } from '../context/LangContext';

export default function CoinsToggle({ balance, checked, onChange }) {
  const { t } = useLang();
  if (!balance) {
    return (
      <p className="coins-toggle-empty muted">
        <i className="coin-dot" />
        {t('coins.emptyHint')} <Link to="/app/referral">{t('coins.earn')}</Link>
      </p>
    );
  }
  return (
    <label className={`coins-toggle ${checked ? 'on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i className="coin-dot lg" />
      <span>
        <b>{t('coins.use')}</b>
        <small>{t('coins.balanceHint', { n: balance })}</small>
      </span>
    </label>
  );
}
