import { StudentChat } from '../components/StudentChat';
import { useLang } from '../context/LangContext';

export default function Support() {
  const { t } = useLang();
  return (
    <div className="chat-page">
      <div>
        <h1>{t('chat.title')}</h1>
        <p className="muted">{t('chat.lead')}</p>
      </div>
      <StudentChat />
    </div>
  );
}
