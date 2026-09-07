import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';

export default function AdminFlashcards() {
  const { t } = useLang();
  const [cards, setCards] = useState([]);
  const [msg, setMsg] = useState('');
  useEffect(() => { adminApi.flashcards().then((d) => setCards(d.flashcards || [])); }, []);

  async function upload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const data = await adminApi.uploadTxt('/api/admin/upload-txt-flashcards', null, file, { trackGroup: 'main' });
      setMsg(`+${data.created} / upd ${data.updated}`);
      setCards((await adminApi.flashcards()).flashcards || []);
    };
    input.click();
  }

  return (
    <div>
      <h1>{t('nav.flashcards')}</h1>
      {msg && <p className="ok">{msg}</p>}
      <div className="row">
        <button className="btn ghost" type="button" onClick={upload}>TXT flashcards</button>
      </div>
      <form className="card" style={{ marginTop: 16 }} onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.target);
        await adminApi.createFlashcard({
          trackGroup: form.get('trackGroup'),
          frontText: form.get('frontText'),
          backText: form.get('backText'),
          topic: form.get('topic'),
        });
        e.target.reset();
        setCards((await adminApi.flashcards()).flashcards || []);
      }}>
        <select name="trackGroup"><option value="main">Основной</option><option value="state_lang">Госязык</option><option value="subject">Предметный</option></select>
        <input name="frontText" placeholder="Лицо" required />
        <input name="backText" placeholder="Оборот" required />
        <input name="topic" placeholder="Тема колоды" />
        <button className="btn" type="submit">+ Flashcard</button>
      </form>
      <ul>
        {cards.map((c) => (
          <li key={c.id}>{c.frontText?.slice(0, 80)}
            <button type="button" onClick={async () => { await adminApi.deleteFlashcard(c.id); setCards((await adminApi.flashcards()).flashcards || []); }}>×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
