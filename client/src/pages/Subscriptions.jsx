import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { payApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Subscriptions() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    payApi.plans().then((d) => setPlans(d.plans || []));
  }, []);

  async function buy(plan) {
    setError('');
    try {
      const created = await payApi.create(plan.id);
      const confirmed = await payApi.confirmDemo(created.payment.id);
      setUser(confirmed.user);
      navigate('/ort');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="serif">Подписка ОРТ</h1>
      <p className="muted">
        Одна подписка открывает основной тест, госязык и все предметные банки.
        {user?.subscriptionActive
          ? ` Активна до ${new Date(user.subscriptionEndDate).toLocaleDateString('ru-KG')}.`
          : ' Сейчас доступа нет.'}
      </p>
      {error && <p className="err">{error}</p>}
      <div className="grid-3">
        {plans.map((plan) => (
          <div key={plan.id} className="card">
            <h3>{plan.title}</h3>
            <p className="serif" style={{ fontSize: 32, margin: '8px 0' }}>{plan.price} сом</p>
            {plan.oldPrice && <p className="muted"><s>{plan.oldPrice} сом</s></p>}
            <button className="btn" type="button" onClick={() => buy(plan)}>Оплатить (демо)</button>
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 16 }}>
        Демо-оплата сразу продлевает `subscriptionEndDate`. Позже сюда подключится платежный шлюз; webhook уже ждёт тип `ort_subscription`.
      </p>
    </div>
  );
}
