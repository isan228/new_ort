import { useEffect, useState } from 'react';
import { schoolDirectoryApi } from '../api/client';
import { useLang } from '../context/LangContext';

// Region → district → school from the admin's directory. Reports the directory size so the form
// knows whether a school is required (an empty directory leaves registration open).
export default function SchoolPicker({ value, onChange, onReady, error }) {
  const { t } = useLang();
  const [regions, setRegions] = useState(null);
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [schools, setSchools] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    schoolDirectoryApi.regions()
      .then((data) => {
        setRegions(data.regions || []);
        onReady?.((data.regions || []).length > 0);
      })
      .catch(() => {
        setRegions([]);
        onReady?.(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const districts = regions?.find((r) => r.key === region)?.districts || [];

  useEffect(() => {
    setSchools(null);
    if (!region || !district) return undefined;
    let stop = false;
    setLoadError('');
    schoolDirectoryApi.schools(region, district)
      .then((data) => { if (!stop) setSchools(data.schools || []); })
      .catch((err) => { if (!stop) setLoadError(err.message); });
    return () => { stop = true; };
  }, [region, district]);

  if (!regions?.length) return null;

  function pickRegion(next) {
    setRegion(next);
    const list = regions.find((r) => r.key === next)?.districts || [];
    setDistrict(list.length === 1 ? list[0].key : '');
    onChange(null);
  }

  function pickDistrict(next) {
    setDistrict(next);
    onChange(null);
  }

  return (
    <>
      <label className={`field ${error && !region ? 'has-error' : ''}`}>
        <span>{t('auth.region')}</span>
        <select value={region} onChange={(e) => pickRegion(e.target.value)}>
          <option value="">{t('auth.pickRegion')}</option>
          {regions.map((r) => <option key={r.key} value={r.key}>{r.name || t('auth.noRegion')}</option>)}
        </select>
      </label>
      <label className={`field ${error && region && !district ? 'has-error' : ''}`}>
        <span>{t('auth.district')}</span>
        <select value={district} onChange={(e) => pickDistrict(e.target.value)} disabled={!region}>
          <option value="">{t('auth.pickDistrict')}</option>
          {districts.map((d) => <option key={d.key} value={d.key}>{d.name || t('auth.noDistrict')}</option>)}
        </select>
      </label>
      <label className={`field ${error ? 'has-error' : ''}`}>
        <span>{t('auth.school')}</span>
        <select
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value) || null)}
          disabled={!schools?.length}
          aria-invalid={!!error}
        >
          <option value="">{region && district && !schools ? t('common.loading') : t('auth.pickSchool')}</option>
          {(schools || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {loadError && <small className="field-error">{loadError}</small>}
        {error && <small className="field-error">{error}</small>}
      </label>
    </>
  );
}
