import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  useEffect(() => { adminApi.users().then((d) => setUsers(d.users)).catch(() => {}); }, []);
  return (
    <div>
      <h1>Пользователи</h1>
      <div className="table-scroll">
      <table className="table">
        <thead><tr><th>Имя</th><th>Логин</th><th>Подписка</th><th></th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.login || '—'}</td>
              <td>{u.subscriptionEndDate ? new Date(u.subscriptionEndDate).toLocaleDateString('ru-KG') : 'нет'}</td>
              <td>
                <button className="btn sm ghost" type="button" onClick={async () => {
                  await adminApi.grant(u.id, 1);
                  setUsers((await adminApi.users()).users);
                }}>+1 месяц</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
