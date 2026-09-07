import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';

export default function AdminPlans() {
  const [plans, setPlans] = useState([]);
  const [msg, setMsg] = useState('');
  useEffect(() => { adminApi.plans().then((d) => setPlans(d.plans)); }, []);
  return (
    <div>
      <h1>Подписки</h1>
      {msg && <p className="ok">{msg}</p>}
      {plans.map((plan, i) => (
        <div key={plan.id} className="card" style={{ marginBottom: 12 }}>
          <div className="grid-2">
            <label className="field"><span>Название</span>
              <input value={plan.title} onChange={(e) => {
                const next = [...plans]; next[i] = { ...plan, title: e.target.value }; setPlans(next);
              }} />
            </label>
            <label className="field"><span>Цена, сом</span>
              <input type="number" value={plan.price} onChange={(e) => {
                const next = [...plans]; next[i] = { ...plan, price: Number(e.target.value) }; setPlans(next);
              }} />
            </label>
          </div>
        </div>
      ))}
      <button className="btn" type="button" onClick={async () => { await adminApi.savePlans(plans); setMsg('Сохранено'); }}>Сохранить</button>
    </div>
  );
}
