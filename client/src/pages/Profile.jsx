import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, authApi, payApi, schoolDirectoryApi } from '../api/client';
import PromoField, { promoErrorText } from '../components/PromoField';
import CoinsToggle from '../components/CoinsToggle';
import { promoApplies } from '../lib/promo';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import PlanPicker from '../components/PlanPicker';
import SchoolPicker from '../components/SchoolPicker';
import { startCheckout } from '../lib/checkout';

function SchoolCard() {
  const { user, setUser } = useAuth();
  const { t } = useLang();
  const school = user?.school;
  const [editing, setEditing] = useState(false);
  const [listed, setListed] = useState(true);
  const [schoolId, setSchoolId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Without a school the card is only worth showing when the directory has something to pick.
  useEffect(() => {
    if (school) return;
    schoolDirectoryApi.regions().then((data) => setListed((data.regions || []).length > 0)).catch(() => setListed(false));
  }, [school]);

  async function save() {
    if (!schoolId) { setError(t('auth.err.SCHOOL_REQUIRED')); return; }
    setBusy(true);
    setError('');
    try {
      const data = await authApi.updateMe({ schoolId });
      setUser(data.user);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!school && !listed) return null;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="muted">{t('auth.school')}</div>
          {school ? (
            <>
              <h3 style={{ margin: '6px 0 4px' }}>{school.name}</h3>
              <p className="muted" style={{ margin: 0 }}>
                {[school.region || t('auth.noRegion'), school.district || t('auth.noDistrict')].join(' · ')}
              </p>
            </>
          ) : (
            <p style={{ margin: '6px 0 0' }}>{t('profile.noSchool')}</p>
          )}
        </div>
        {!editing && (
          <button className="btn ghost sm" type="button" onClick={() => { setEditing(true); setSchoolId(null); setError(''); }}>
            {school ? t('profile.changeSchool') : t('profile.setSchool')}
          </button>
        )}
      </div>
      {editing && (
        <div style={{ marginTop: 12, maxWidth: 480 }}>
          <SchoolPicker value={schoolId} onChange={setSchoolId} error={error} />
          <div className="row">
            <button className="btn" type="button" disabled={busy} onClick={save}>{busy ? t('common.loading') : t('common.save')}</button>
            <button className="btn ghost" type="button" onClick={() => setEditing(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Profile() {
  const { user, setUser } = useAuth();
  const { t, locale } = useLang();
  const initial = (user?.name || 'У')[0];
  const [plans, setPlans] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(user?.subscriptionPlanId || null);
  const [promo, setPromo] = useState(null);
  const [useCoins, setUseCoins] = useState(false);
  const coins = useCoins ? user?.coins || 0 : 0;

  useEffect(() => {
    payApi.plans().then((d) => setPlans(d.plans || [])).catch((err) => setError(err.message));
    authApi.stats().then(setStats).catch(() => setStats(null));
  }, []);

  const end = user?.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;
  const active = !!user?.subscriptionActive;
  const unlimited = !!user?.unlimited;
  const title = unlimited ? t('profile.unlimited') : (user?.subscriptionTitle || t('profile.noPlan'));

  async function renew(plan) {
    setSelectedId(plan.id);
    setError('');
    setBusy(true);
    try {
      const promoCode = promoApplies(promo, plan) ? promo.code : undefined;
      const result = await startCheckout(plan, { setUser, promoCode, useCoins: coins > 0 });
      if (result === 'demo') {
        setError('');
        setPromo(null);
        setUseCoins(false);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code?.startsWith('PROMO_')) {
        setPromo(null);
        setError(promoErrorText(t, err));
      } else {
        setError(err.message === 'no-url' ? t('pay.noUrl') : err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="card row" style={{ gap: 16 }}>
        <span className="avatar" style={{ width: 64, height: 64, fontSize: 24 }}>{initial}</span>
        <div>
          <h1>{user?.name}</h1>
          <p className="muted">{user?.login}</p>
        </div>
      </div>

      <SchoolCard />

      <div className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="muted">{t('profile.sub')}</div>
            <h2 style={{ margin: '6px 0 8px' }}>{title}</h2>
            {unlimited && <p className="ok" style={{ margin: 0 }}>{t('profile.unlimitedHint')}</p>}
            {!unlimited && active && end && <p className="ok" style={{ margin: 0 }}>{t('profile.until', { date: end.toLocaleDateString(locale) })}</p>}
            {!unlimited && !active && end && <p className="err" style={{ margin: 0 }}>{t('profile.expired', { date: end.toLocaleDateString(locale) })}</p>}
            {!unlimited && !active && !end && <p className="muted" style={{ margin: 0 }}>{t('profile.needPay')}</p>}
          </div>
          <span className={`badge ${active ? 'ok' : 'bad'}`}>
            {active ? t('profile.active') : t('profile.inactive')}
          </span>
        </div>
        {!unlimited && (
          <>
            <h3 style={{ marginTop: 20 }}>{active ? t('profile.renew') : t('profile.buy')}</h3>
            <p className="muted">{t('pay.renewHint')}</p>
            {error && <p className="err">{error}</p>}
            <PromoField promo={promo} onChange={setPromo} invited={!!user?.invited} />
            <CoinsToggle balance={user?.coins || 0} checked={useCoins} onChange={setUseCoins} />
            <PlanPicker plans={plans} selectedId={selectedId} onSelect={renew} promo={promo} coins={coins} />
            {busy && <p className="muted" style={{ marginTop: 12 }}>{t('common.loading')}</p>}
          </>
        )}
      </div>

      <div className="grid-4" style={{ marginTop: 16 }}>
        <div className="card stat"><b>{stats?.bestOfficial || 0}</b><span className="muted">{t('profile.best')}</span></div>
        <div className="card stat"><b>{stats?.questions || 0}</b><span className="muted">{t('profile.questions')}</span></div>
        <div className="card stat"><b>{stats?.streak || 0}</b><span className="muted">{t('home.streak')}</span></div>
        <div className="card stat"><b>{stats?.achievementsOpen || 0}</b><span className="muted">{t('profile.ach')}</span></div>
      </div>
      <div style={{ marginTop: 16 }}><Link className="btn" to="/app/settings">{t('profile.settings')}</Link></div>
    </div>
  );
}
