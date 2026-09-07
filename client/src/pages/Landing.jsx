import { Link } from 'react-router-dom';
import { PublicShell } from '../components/Shells';
import { Reveal } from '../components/Reveal';

const TICKER = ['Математика', 'Аналогии', 'Чтение', 'Грамматика', 'Госязык', 'Химия', 'Биология', 'Физика', 'История', 'Английский'];

const FEATURES = [
  { title: 'Банки вопросов', text: 'Основной тест, государственный язык и предметные: математика, физика, химия, биология, история, английский.' },
  { title: 'Конструктор теста', text: 'Собери сессию по темам и типу задания: 10, 20 или полный пробник. Тренировка или режим экзамена с таймером.' },
  { title: 'Флеш-карты', text: 'Формулы, правила, аналогии. Интервалы как в Anki: снова, сложно, хорошо, легко.' },
  { title: 'Разбор ошибок', text: 'Свой ответ, верный вариант, объяснение. Повторяй слабые темы, пока точность не вырастет.' },
  { title: 'Аналитика', text: 'Точность по разделам, календарь активности и ежедневная цель — видно, что учить дальше.' },
  { title: 'Рейтинг и серия', text: 'Видно, где ты среди других учеников. Серия дней не даёт сорваться за неделю до теста.' },
];

const TRACKS = [
  {
    title: 'Основной тест',
    tag: 'Обязателен всем',
    text: 'Математика, словесно-логический блок (аналогии и дополнение предложений), чтение и понимание, практическая грамматика родного языка. Это ядро сертификата ОРТ.',
    items: ['Математика', 'Аналогии', 'Дополнение предложений', 'Чтение', 'Грамматика'],
  },
  {
    title: 'Государственный язык',
    tag: 'Обязателен с 2024',
    text: 'Без теста по кыргызскому языку сертификат не выдают. Лексика, грамматика и чтение. На конкурс в вуз этот балл обычно не идёт, но сдать нужно.',
    items: ['Лексика и грамматика', 'Чтение текстов', '50 вопросов'],
  },
  {
    title: 'Предметные тесты',
    tag: 'По специальности',
    text: 'Нужны не всем. Медицина — химия и биология. IT и инженерия — математика и физика. Гуманитарии — история и язык. Сдавай только то, что требует факультет.',
    items: ['Химия', 'Биология', 'Физика', 'Математика', 'История', 'Английский'],
  },
];

const STEPS = [
  { n: '1', title: 'Выбери банк', text: 'Основной, госязык или предмет. Одна подписка открывает весь раздел, не отдельный предмет.' },
  { n: '2', title: 'Собери сессию', text: 'Тема × навык, число вопросов, «все / нерешённые / ошибки». Включи экзамен, если хочешь без подсказок.' },
  { n: '3', title: 'Разбери результат', text: 'Балл, точность, слабые темы. Ошибки уходят в разбор и могут стать карточками.' },
  { n: '4', title: 'Повтори завтра', text: 'Ежедневная цель, streak и очередь карточек на повторение. Система сама говорит, что учить дальше.' },
];

const WEAK = [
  { name: 'Аналогии', v: 61, hint: 'Чаще всего роняют балл: путают отношение «часть–целое» и синоним.' },
  { name: 'Математика', v: 68, hint: 'Проценты, текстовые задачи и геометрия без чертежа.' },
  { name: 'Чтение', v: 74, hint: 'Связанные вопросы по одному тексту — нельзя вырывать одно задание.' },
];

const FAQ = [
  {
    q: 'Это официальный тест ЦООМО?',
    a: 'Нет. ORT.KG — тренажёр для подготовки. Формат близок к ОРТ: варианты ответа, тексты с группой вопросов, тематические банки. Сам экзамен сдаётся через testing.kg.',
  },
  {
    q: 'С чего начать, если до теста мало времени?',
    a: 'Основной тест каждый день: математика + аналогии. Вечером — 20–30 карточек. Раз в неделю полный пробник в режиме экзамена. Предметные подключай только если они нужны факультету.',
  },
  {
    q: 'Чем тренировка отличается от экзамена?',
    a: 'В тренировке после сдачи сразу виден разбор. В режиме экзамена правильный ответ скрыт до конца, есть таймер и навигация по вопросам — как на настоящем бланке.',
  },
  {
    q: 'Нужна ли отдельная подписка на химию или физику?',
    a: 'Нет. Подписка одна на весь ORT.KG: основной, госязык и все предметные банки, плюс карточки и статистика.',
  },
  {
    q: 'Можно ли готовиться с телефона?',
    a: 'Да. Кабинет адаптивный: нижнее меню, крупные варианты ответа, карточки листаются одним касанием. Удобнее с экрана побольше, но ежедневная серия с телефона нормальна.',
  },
  {
    q: 'Есть ли демо без оплаты?',
    a: 'Да. Регистрация бесплатная. Часть тестов и карточек доступна сразу. Premium снимает лимиты и открывает полный разбор и аналитику.',
  },
];

export default function Landing() {
  const ticker = [...TICKER, ...TICKER];
  return (
    <PublicShell>
      <div className="page page-wide">
        <section className="hero">
          <Reveal>
            <img src="/logo.png" alt="ORT.KG — твой путь к высоким баллам ОРТ" className="logo-hero" />
            <p className="badge brand">ОРТ 2026 · Кыргызстан</p>
            <h1 className="hero-title">Готовься к ОРТ <em>системно.</em> Каждый день — ближе к баллу.</h1>
            <p className="muted" style={{ fontSize: 18, maxWidth: 540 }}>
              Банки вопросов, конструктор теста, флеш-карты с интервалами и разбор ошибок.
              Не стопка PDF, а кабинет, в который возвращаешься каждый день.
            </p>
            <div className="row" style={{ marginTop: 20 }}>
              <Link className="btn lg" to="/register">Начать подготовку</Link>
              <Link className="btn ghost lg" to="/pricing">Смотреть тарифы</Link>
            </div>
            <div className="row" style={{ marginTop: 18 }}>
              <span className="badge">Основной тест</span>
              <span className="badge">Госязык</span>
              <span className="badge">Предметные</span>
              <span className="badge">Карточки</span>
            </div>
          </Reveal>
          <div className="mock">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="muted">Сегодня</div>
                <b style={{ fontSize: 32 }}>30 / 40</b>
              </div>
              <span className="badge ok">цель дня</span>
            </div>
            <div className="progress" style={{ margin: '14px 0' }}><i style={{ width: '75%' }} /></div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Дальше: аналогии · 10 вопросов</p>
            <div className="grid-3">
              <div className="card stat" style={{ boxShadow: 'none' }}><b>12</b><span className="muted">дней подряд</span></div>
              <div className="card stat" style={{ boxShadow: 'none' }}><b>1 284</b><span className="muted">вопросов</span></div>
              <div className="card stat" style={{ boxShadow: 'none' }}><b>81%</b><span className="muted">точность</span></div>
            </div>
            <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>Аналогии 61% · Математика 68% · Чтение 74% · Грамматика 91%</p>
          </div>
        </section>

        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {ticker.map((item, i) => (
              <span key={`${item}-${i}`}>{item} <b>·</b></span>
            ))}
          </div>
        </div>

        <Reveal className="grid-4" style={{ marginTop: 36 }} delay={80}>
          <div className="card stat"><b>3</b><span className="muted">трека ОРТ в одном кабинете</span></div>
          <div className="card stat"><b>2 режима</b><span className="muted">тренировка и экзамен с таймером</span></div>
          <div className="card stat"><b>Тема × навык</b><span className="muted">фильтр как на банке вопросов</span></div>
          <div className="card stat"><b>SRS</b><span className="muted">повторение карточек по интервалам</span></div>
        </Reveal>

        <Reveal as="section" className="section" id="programma" delay={40}>
          <p className="kicker">Программа ОРТ</p>
          <h2>ОРТ — это не один тест</h2>
          <p className="lead">
            В 2026 году обязательны основной тест и государственный язык. Предметные берутся только под выбранную специальность.
            ORT.KG повторяет эту структуру: три трека, отдельные банки, общая подписка.
          </p>
          <div className="tracks" style={{ marginTop: 20 }}>
            {TRACKS.map((t) => (
              <div key={t.title} className="card">
                <span className="badge brand">{t.tag}</span>
                <h3 style={{ marginTop: 10 }}>{t.title}</h3>
                <p className="muted">{t.text}</p>
                <div className="row">
                  {t.items.map((item) => <span key={item} className="badge">{item}</span>)}
                </div>
              </div>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 16, fontSize: 14 }}>
            Ориентир: медицина — химия + биология; IT и инженерия — математика + физика; экономика — чаще профильная математика.
            Официальная регистрация — на testing.kg, здесь — подготовка.
          </p>
        </Reveal>

        <section className="section">
          <p className="kicker">Платформа</p>
          <h2>Что внутри кабинета</h2>
          <p className="lead">Каждый экран отвечает на вопрос: что делать дальше и где теряются баллы.</p>
          <div className="cards stagger" style={{ marginTop: 20 }}>
            {FEATURES.map((f) => (
              <div key={f.title} className="card">
                <h3>{f.title}</h3>
                <p className="muted">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section" id="kak">
          <p className="kicker">Сценарий</p>
          <h2>Как готовиться на ORT.KG</h2>
          <div className="grid-2" style={{ marginTop: 20 }}>
            <div className="card">
              {STEPS.map((s) => (
                <div key={s.n} className="step" style={{ marginBottom: 18 }}>
                  <span className="step-num">{s.n}</span>
                  <div>
                    <h3>{s.title}</h3>
                    <p className="muted">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="card">
              <h3>Слабые места, с которых начинают</h3>
              <p className="muted">Типичная картина после первых пробников. Кабинет подсвечивает это в статистике.</p>
              {WEAK.map((w) => (
                <div key={w.name} style={{ marginBottom: 14 }}>
                  <div className="bar-row"><span>{w.name}</span><div className="progress"><i style={{ width: `${w.v}%` }} /></div><b>{w.v}%</b></div>
                  <p className="muted" style={{ fontSize: 13 }}>{w.hint}</p>
                </div>
              ))}
              <Link className="btn" to="/register">Закрыть слабые темы</Link>
            </div>
          </div>
        </section>

        <section className="section">
          <p className="kicker">День подготовки</p>
          <h2>45–70 минут, если заниматься каждый день</h2>
          <div className="grid-3" style={{ marginTop: 20 }}>
            <div className="card">
              <span className="badge">25 мин</span>
              <h3>Тест по банку</h3>
              <p className="muted">20–40 вопросов. Режим «нерешённые» или «ошибки», чтобы не топтаться на уже закрытом.</p>
            </div>
            <div className="card">
              <span className="badge purple">15 мин</span>
              <h3>Карточки</h3>
              <p className="muted">Очередь на сегодня: новые + повторение. Формулы и правила аналогий запоминаются быстрее, чем в конспекте.</p>
            </div>
            <div className="card">
              <span className="badge ok">10 мин</span>
              <h3>Разбор</h3>
              <p className="muted">Только ошибки. Если объяснение не зашло — в избранное и на повтор через день.</p>
            </div>
          </div>
        </section>

        <section className="section">
          <p className="kicker">Для кого</p>
          <h2>11 класс, повторная сдача, целевой факультет</h2>
          <div className="grid-3" style={{ marginTop: 20 }}>
            <div className="card">
              <h3>Сдаю ОРТ впервые</h3>
              <p className="muted">Начни с основного теста. Не бери все предметные «на всякий случай»: лишние тесты на конкурсе не помогают, а время отнимают.</p>
            </div>
            <div className="card">
              <h3>Нужна медицина / IT</h3>
              <p className="muted">Основной + профильные банки. Для медицины химия и биология обязательны парой. Для техники — математика и физика.</p>
            </div>
            <div className="card">
              <h3>Мало времени</h3>
              <p className="muted">Ежедневная цель и streak важнее марафона раз в неделю. Платформа показывает, сколько вопросов осталось сегодня.</p>
            </div>
          </div>
        </section>

        <section className="section" id="faq">
          <p className="kicker">Вопросы</p>
          <h2>Коротко по делу</h2>
          <div className="faq" style={{ marginTop: 16 }}>
            {FAQ.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="cta-band">
          <div>
            <h2>Начни с демо сегодня</h2>
            <p className="muted" style={{ margin: 0 }}>Регистрация за минуту. Кабинет, банки и карточки — сразу. Premium можно подключить, когда станет тесно.</p>
          </div>
          <div className="row">
            <Link className="btn lg" to="/register">Создать аккаунт</Link>
            <Link className="btn ghost lg" to="/login">Уже есть вход</Link>
          </div>
        </div>

        <footer className="site-footer">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="row">
              <img src="/logo.png" alt="" className="logo-img" style={{ height: 40 }} />
              <span>Подготовка к Общереспубликанскому тестированию</span>
            </span>
            <span>Не является сайтом ЦООМО</span>
          </div>
        </footer>
      </div>
    </PublicShell>
  );
}
