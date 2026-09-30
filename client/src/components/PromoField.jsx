import { useEffect, useRef, useState } from 'react';
import { ApiError, payApi } from '../api/client';
import { useLang } from '../context/LangContext';
import { promoLabel } from '../lib/promo';

export function promoErrorText(t, err) {
  const code = err instanceof ApiError ? err.code : '';
  const key = `promo.err.${code}`;
  const text = code ? t(key) : key;
  return text === key ? (err?.message || t('promo.err.PROMO_NOT_FOUND')) : text;
}

export default function PromoField({ promo, onChange, initialCode = '', onInitialDone }) {
  const { t } = useLang();
  const [open, setOpen] = useState(!!initialCode);
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const autoTried = useRef(false);

  async function apply(value = code) {
    const clean = String(value || '').replace(/\s+/g, '').toUpperCase();
    if (!clean) return;
    setError('');
    setBusy(true);
    try {
      const data = await payApi.checkPromo(clean);
      onChange(data.promo);
      setCode('');
    } catch (err) {
      setError(promoErrorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!initialCode || autoTried.current) return;
    autoTried.current = true;
    apply(initialCode).finally(() => onInitialDone?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  if (promo) {
    return (
      <div className="promo-field">
        <div className="promo-applied">
          <span className="promo-chip">{promo.code}</span>
          <span>{t('promo.applied', { off: promoLabel(promo, t('common.som')) })}</span>
          <button className="btn ghost sm" type="button" onClick={() => onChange(null)}>{t('promo.remove')}</button>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="promo-field">
        <button className="promo-toggle" type="button" onClick={() => setOpen(true)}>{t('promo.have')}</button>
      </div>
    );
  }

  return (
    <div className="promo-field">
      <div className="promo-row">
        <input
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              apply();
            }
          }}
          placeholder={t('promo.placeholder')}
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={!!error}
        />
        <button className="btn sm" type="button" disabled={busy || !code.trim()} onClick={() => apply()}>
          {busy ? t('common.loading') : t('promo.apply')}
        </button>
      </div>
      {error && <small className="field-error">{error}</small>}
    </div>
  );
}
