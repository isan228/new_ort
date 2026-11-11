const { Op } = require('sequelize');
const { Subject, Test, SimTopic } = require('../models');
const { getSetting, setSetting } = require('../models/AppSetting');

// ORT topic templates: the admin picks a topic and uploads questions into it.
const MATH_TOPICS = [
  {
    group: 'Арифметика',
    kind: 'standard',
    topics: [
      'Числа простые и составные. Делимость, НОД, НОК, остаток',
      'Рациональные числа. Свойства арифметических действий',
      'Иррациональные выражения. Корни',
      'Положительные и отрицательные числа. Модуль',
      'Обыкновенные и десятичные дроби',
      'Отношение. Пропорции. Проценты',
      'Степень',
      'Приближённые значения. Округление',
      'Числовые неравенства и их свойства (оценка сумм)',
      'Статистика, множества (круги Эйлера), комбинаторика, вероятность',
    ],
  },
  {
    group: 'Алгебра',
    kind: 'standard',
    topics: [
      'Тождественные преобразования',
      'Алгебраические дроби',
      'Преобразование выражений с корнями',
      'Многочлены. Формулы сокращённого умножения',
      'Логарифмы и показательные выражения',
      'Уравнения (алгебраические, логарифмические, показательные, тригонометрические)',
      'Системы линейных уравнений',
      'Неравенства',
      'Функции, область определения',
      'Графики функций',
    ],
  },
  {
    group: 'Геометрия',
    kind: 'geometry',
    topics: [
      'Параллельные и перпендикулярные прямые',
      'Треугольник (свойства углов и сторон)',
      'Виды треугольников',
      'Теорема Пифагора. Тригонометрия в треугольнике (30-60-90, 45-45-90)',
      'Четырёхугольники и многоугольники',
      'Окружность и круг. Вписанные/описанные окружности',
      'Длина окружности, площадь круга',
      'Площадь и периметр многоугольников',
      'Стереометрия (площади и объёмы 3D-фигур, диагонали)',
      'Декартовы координаты. Преобразования',
    ],
  },
];

// Chemistry subject test: 38 topics of the ЦООМО handbook (pp. 29–30).
const CHEMISTRY_TOPICS = [
  {
    group: 'Общая химия',
    kind: 'standard',
    topics: [
      'Физические и химические явления',
      'Чистые вещества и смеси',
      'Атомы, молекулы и ионы',
      'Основные законы химии',
      'Элементы и химические формулы',
      'Химические реакции',
      'Строение атома',
      'Валентность и электроотрицательность',
      'Периодический закон',
      'Химическая связь',
      'Строение молекул и кристаллов',
      'Скорость реакции',
      'Химическое равновесие',
      'Тепловой эффект реакции',
      'Растворы и электролиты',
      'Окислительно-восстановительные реакции',
    ],
  },
  {
    group: 'Неорганическая химия',
    kind: 'standard',
    topics: [
      'Классы неорганических веществ',
      'Водород',
      'Кислород и озон',
      'Вода',
      'Галогены',
      'Сера и её соединения',
      'Азот и его соединения',
      'Фосфор и его соединения',
      'Углерод и его соединения',
      'Кремний и его соединения',
      'Металлы',
    ],
  },
  {
    group: 'Органическая химия',
    kind: 'standard',
    topics: [
      'Строение органических соединений',
      'Органические реакции',
      'Гомологические ряды',
      'Алканы и циклоалканы',
      'Алкены, алкадиены и алкины',
      'Ароматические углеводороды',
      'Спирты, фенолы и простые эфиры',
      'Альдегиды, кислоты и сложные эфиры',
      'Углеводы',
      'Амины, аминокислоты и белки',
      'Полимеры и волокна',
    ],
  },
];

// Subject maths test (simulation): ORT.kg breakdown of the six official ЦООМО content lines, 49 topics.
const SUBJECT_MATH_TOPICS = [
  {
    group: 'Числа и вычисления',
    kind: 'standard',
    topics: [
      'Натуральные и целые числа',
      'Делимость, НОД и НОК',
      'Рациональные числа и дроби',
      'Проценты, отношения и пропорции',
      'Степени и корни',
      'Модуль и числовые промежутки',
    ],
  },
  {
    group: 'Преобразование выражений',
    kind: 'standard',
    topics: [
      'Одночлены и многочлены',
      'Формулы сокращённого умножения',
      'Разложение на множители',
      'Алгебраические дроби',
      'Иррациональные выражения',
      'Степенные выражения',
      'Логарифмические выражения',
      'Тригонометрические выражения',
    ],
  },
  {
    group: 'Уравнения и неравенства',
    kind: 'standard',
    topics: [
      'Линейные уравнения и системы',
      'Квадратные уравнения',
      'Рациональные уравнения',
      'Иррациональные уравнения',
      'Уравнения с модулем',
      'Показательные уравнения',
      'Логарифмические уравнения',
      'Тригонометрические уравнения',
      'Линейные и квадратные неравенства',
      'Рациональные неравенства',
      'Показательные и логарифмические неравенства',
      'Тригонометрические неравенства',
      'Системы и совокупности неравенств',
    ],
  },
  {
    group: 'Последовательности и прогрессии',
    kind: 'standard',
    topics: [
      'Числовые последовательности',
      'Арифметическая прогрессия',
      'Геометрическая прогрессия',
    ],
  },
  {
    group: 'Функции',
    kind: 'standard',
    topics: [
      'Понятие функции и область определения',
      'Графики и преобразования графиков',
      'Линейная и квадратичная функции',
      'Степенная и корневая функции',
      'Показательная и логарифмическая функции',
      'Тригонометрические функции и графики',
      'Производная и её применение',
    ],
  },
  {
    group: 'Геометрия',
    kind: 'standard',
    topics: [
      'Углы, прямые и параллельность',
      'Треугольники и их свойства',
      'Подобие и теорема Пифагора',
      'Четырёхугольники и многоугольники',
      'Окружность и круг',
      'Площади плоских фигур',
      'Координаты и векторы на плоскости',
      'Прямые и плоскости в пространстве',
      'Призмы и параллелепипеды',
      'Пирамиды',
      'Цилиндр, конус и шар',
      'Объёмы и площади поверхностей',
    ],
  },
];

// History subject test: 44 ORT.kg topics (21 world history, 23 history of Kyrgyzstan).
const HISTORY_TOPICS = [
  {
    group: 'Всеобщая история',
    kind: 'standard',
    topics: [
      'Историческое летоисчисление и хронология',
      'Первобытное общество и неолитическая революция',
      'Древний Египет и Междуречье',
      'Древние Китай и Индия',
      'Древняя Греция',
      'Древний Рим',
      'Феодализм и средневековые государства',
      'Христианство и ислам в Средние века',
      'Средневековые города и культура',
      'Средневековая Русь',
      'Великие географические открытия',
      'Революции Нового времени',
      'Промышленный переворот и индустриализация',
      'Государства и международные отношения Нового времени',
      'Россия в Новое время',
      'Первая мировая война',
      'Революции и становление СССР',
      'Вторая мировая война',
      'Холодная война и биполярный мир',
      'Социалистическая система и её распад',
      'Мировые кризисы и глобализация',
    ],
  },
  {
    group: 'История Кыргызстана',
    kind: 'standard',
    topics: [
      'Древнейшие культуры Кыргызстана',
      'Саки, усуни и Давань',
      'Кочевые и оседлые культуры Кыргызстана',
      'Великий Тюркский каганат',
      'Западно-Тюркский и Тюргешский каганаты',
      'Караханидское государство',
      'Древние и енисейские кыргызы',
      'Монгольское завоевание и Чингизиды',
      'Моголистан и Тимуриды',
      'Формирование кыргызской народности',
      'Кыргызстан в XIV–XVIII веках',
      'Джунгарское ханство и Цинский Китай',
      'Кокандское ханство и кыргызы',
      'Присоединение Кыргызстана к России',
      'Кыргызстан в Российской империи',
      'Восстание 1916 года',
      'Революции и установление советской власти в Кыргызстане',
      'Национально-государственное строительство Кыргызстана',
      'Кыргызстан в Великой Отечественной войне',
      'Кыргызстан в советский период',
      'Независимость и государственное развитие Кыргызстана',
      'Экономика и общество независимого Кыргызстана',
      'Кыргызстан в международных отношениях и диаспора',
    ],
  },
];

// Kyrgyz language and literature subject test: 42 ORT.kg topics, named in Kyrgyz.
const KYRGYZ_TOPICS = [
  {
    group: 'Кыргыз тили',
    kind: 'standard',
    topics: [
      'Тыбыштар жана тамгалар',
      'Үндүү жана үнсүз тыбыштар',
      'Үндөштүк закону',
      'Муун жана басым',
      'Орфоэпия жана туура айтылыш',
      'Сөздүн мааниси жана көп маанилүүлүк',
      'Синонимдер антонимдер жана омонимдер',
      'Фразеологизмдер',
      'Сөздүн курамы жана сөз жасоо',
      'Зат атооч',
      'Сын атооч',
      'Сан атооч',
      'Ат атооч',
      'Этиш жана анын формалары',
      'Тактооч жана кызматчы сөздөр',
      'Сөз айкашы жана сүйлөм мүчөлөрү',
      'Жөнөкөй жана татаал сүйлөмдөр',
      'Сүйлөмдүн түрлөрү',
      'Орфография жана туура жазуу',
      'Пунктуация',
      'Стилистика жана кеп маданияты',
    ],
  },
  {
    group: 'Кыргыз адабияты',
    kind: 'standard',
    topics: [
      'Элдик оозеки чыгармачылык',
      'Макал-лакаптар жана табышмактар',
      'Манас эпосу',
      'Кенже эпостор жана дастандар',
      'Төкмө акындар жана акындык өнөр',
      'XIX кылымдагы кыргыз адабияты',
      'XX кылымдын башындагы кыргыз адабияты',
      'Совет мезгилиндеги кыргыз адабияты',
      'Эгемендүүлүк мезгилиндеги адабият',
      'Кыргыз акындарынын өмүрү жана чыгармачылыгы',
      'Кыргыз жазуучуларынын өмүрү жана чыгармачылыгы',
      'Драматургдар жана драмалык чыгармалар',
      'Чыңгыз Айтматовдун өмүрү жана чыгармачылыгы',
      'Адабияттын тектери жана жанрлары',
      'Адабий каарман жана көркөм образ',
      'Тема идея жана автордук позиция',
      'Сюжет композиция жана конфликт',
      'Көркөм тил жана сүрөттөө каражаттары',
      'Ыр түзүлүшү жана поэтикалык каражаттар',
      'Адабий багыттар жана агымдар',
      'Көркөм текстти талдоо жана түшүнүү',
    ],
  },
];

// Biology subject test: 66 ORT.kg topics in six blocks.
const BIOLOGY_TOPICS = [
  {
    group: 'Растения, грибы, бактерии и лишайники',
    kind: 'standard',
    topics: [
      'Растительный мир',
      'Систематика растений',
      'Растительная клетка',
      'Ткани растений',
      'Органы растений',
      'Размножение растений',
      'Отделы растений',
      'Покрытосеменные',
      'Культурные растения',
      'Грибы',
      'Лишайники',
      'Бактерии',
    ],
  },
  {
    group: 'Животные',
    kind: 'standard',
    topics: [
      'Животные и растения',
      'Систематика животных',
      'Простейшие',
      'Кишечнополостные',
      'Плоские черви',
      'Круглые черви',
      'Кольчатые черви',
      'Моллюски',
      'Членистоногие',
      'Рыбы',
      'Земноводные',
      'Пресмыкающиеся',
      'Птицы',
      'Млекопитающие',
      'Эволюция животных',
      'Значение животных',
      'Охрана животных',
    ],
  },
  {
    group: 'Человек и его здоровье',
    kind: 'standard',
    topics: [
      'Ткани человека',
      'Органы и регуляция',
      'Опорно-двигательная система',
      'Кровь и иммунитет',
      'Сердце и сосуды',
      'Дыхательная система',
      'Пищеварение',
      'Обмен веществ',
      'Выделительная система',
      'Кожа',
      'Эндокринная система',
      'Размножение человека',
      'Нервная система',
      'Органы чувств',
    ],
  },
  {
    group: 'Общая биология и генетика',
    kind: 'standard',
    topics: [
      'Признаки жизни',
      'Вирусы',
      'Прокариоты',
      'Клетка и её вещества',
      'Клеточный обмен',
      'ДНК и генетический код',
      'Деление и размножение',
      'Развитие организма',
      'Изменчивость и мутации',
      'Законы наследования',
      'Генетические задачи',
      'Генетика человека',
      'Селекция и биотехнология',
      'Генетика популяций',
    ],
  },
  {
    group: 'Эволюция',
    kind: 'standard',
    topics: [
      'История эволюционных учений',
      'Микроэволюция',
      'Макроэволюция',
      'Происхождение человека',
    ],
  },
  {
    group: 'Экология',
    kind: 'standard',
    topics: [
      'Экологические факторы',
      'Отношения организмов',
      'Экосистемы и питание',
      'Биосфера',
      'Охрана природы',
    ],
  },
];

// Physics subject test: 56 topics in 16 sections; TXT files are named by the transliterated topic.
const PHYSICS_TOPICS = [
  {
    group: 'Кинематика',
    kind: 'standard',
    topics: [
      'Равномерное прямолинейное движение',
      'Равноускоренное движение',
      'Графики движения',
      'Движение по окружности',
    ],
  },
  {
    group: 'Динамика',
    kind: 'standard',
    topics: [
      'Законы Ньютона и взаимодействие тел',
      'Силы в механике',
      'Закон всемирного тяготения',
      'Равновесие тел',
    ],
  },
  {
    group: 'Законы сохранения в механике',
    kind: 'standard',
    topics: [
      'Импульс и столкновения',
      'Механическая работа и мощность',
      'Коэффициент полезного действия',
      'Механическая энергия и её сохранение',
    ],
  },
  {
    group: 'Гидро- и аэромеханика',
    kind: 'standard',
    topics: [
      'Давление жидкостей и газов',
      'Закон Паскаля и гидравлические устройства',
      'Закон Архимеда и движение жидкостей',
    ],
  },
  {
    group: 'Молекулярно-кинетическая теория',
    kind: 'standard',
    topics: [
      'Основы молекулярно-кинетической теории',
      'Идеальный газ и основное уравнение МКТ',
      'Уравнение состояния и газовые законы',
    ],
  },
  {
    group: 'Тепловые явления',
    kind: 'standard',
    topics: [
      'Температура и теплопередача',
      'Количество теплоты и тепловой баланс',
      'Фазовые переходы',
    ],
  },
  {
    group: 'Термодинамика',
    kind: 'standard',
    topics: [
      'Внутренняя энергия и работа газа',
      'Первый закон термодинамики и изопроцессы',
      'Тепловые двигатели и КПД',
    ],
  },
  {
    group: 'Свойства паров, жидкостей и твёрдых тел',
    kind: 'standard',
    topics: [
      'Пар и влажность воздуха',
      'Поверхностное натяжение и капиллярность',
      'Деформация твёрдых тел',
    ],
  },
  {
    group: 'Электростатика',
    kind: 'standard',
    topics: [
      'Электрический заряд и закон Кулона',
      'Электрическое поле',
      'Потенциал и напряжение',
      'Электроёмкость и конденсаторы',
    ],
  },
  {
    group: 'Постоянный ток в различных средах',
    kind: 'standard',
    topics: [
      'Закон Ома',
      'Последовательное и параллельное соединение проводников',
      'Работа и мощность тока',
      'Электрический ток в различных средах',
    ],
  },
  {
    group: 'Магнитное поле',
    kind: 'standard',
    topics: [
      'Магнитное поле и магнитная индукция',
      'Сила Ампера и сила Лоренца',
      'Магнитные свойства веществ',
    ],
  },
  {
    group: 'Механические колебания',
    kind: 'standard',
    topics: [
      'Гармонические колебания',
      'Маятники и энергия колебаний',
      'Резонанс и вынужденные колебания',
    ],
  },
  {
    group: 'Механические волны',
    kind: 'standard',
    topics: [
      'Виды и характеристики волн',
      'Звуковые волны',
      'Распространение и свойства волн',
    ],
  },
  {
    group: 'Переменный ток',
    kind: 'standard',
    topics: [
      'Электромагнитная индукция и самоиндукция',
      'Электромагнитные колебания и переменный ток',
      'Трансформаторы и электромагнитные волны',
    ],
  },
  {
    group: 'Геометрическая и волновая оптика',
    kind: 'standard',
    topics: [
      'Отражение и преломление света',
      'Линзы и оптические приборы',
      'Волновая оптика',
    ],
  },
  {
    group: 'Атомная физика',
    kind: 'standard',
    topics: [
      'Строение атома',
      'Строение ядра',
      'Радиоактивность',
      'Ядерные реакции',
      'Фотоэффект и квантовые свойства света',
      'Энергия и импульс фотона',
    ],
  },
];

// Russian language and literature subject test: 8 official language sections and 45 literature topics.
const RUSSIAN_TOPICS = [
  {
    group: 'Русский язык',
    kind: 'standard',
    topics: [
      'Фонетика',
      'Словообразование',
      'Лексика',
      'Морфология',
      'Синтаксис',
      'Орфография',
      'Пунктуация',
      'Стилистика',
    ],
  },
  {
    group: 'Русская литература',
    kind: 'standard',
    topics: [
      'Литературный герой и персонаж',
      'Роды и жанры литературы',
      'Сюжет и композиция',
      'Тема, проблема и идея произведения',
      'Изобразительно-выразительные средства',
      'Звуковые и речевые приёмы',
      'Гуманизм и психологизм литературы',
      'Традиции и новаторство',
      'Стихотворная речь и стихосложение',
      'Комическое в литературе',
      'Литературные направления и история литературы',
      'Грибоедов',
      'Пушкин',
      'Лермонтов',
      'Гоголь',
      'Островский',
      'Тургенев',
      'Тютчев, Фет и Некрасов',
      'Салтыков-Щедрин',
      'Литературная критика',
      'Достоевский',
      'Толстой',
      'Чехов',
      'Горький',
      'Бунин',
      'Куприн',
      'Серебряный век русской поэзии',
      'Блок',
      'Маяковский',
      'Есенин',
      'Цветаева',
      'Ахматова',
      'Пастернак',
      'Булгаков',
      'Шолохов',
      'Твардовский',
      'Солженицын',
      'Шаламов',
      'Поэзия второй половины XX века',
      'Бондарев',
      'Быков',
      'Шукшин',
      'Астафьев',
      'Айтматов',
      'Анализ художественного текста',
    ],
  },
];

const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[.\s]+$/g, '').replace(/\s+/g, ' ').trim();

async function descendants(rootId, subjectId) {
  const all = await Test.findAll({ where: { subjectId } });
  const out = [];
  const walk = (id) => all.filter((t) => t.parentId === id).forEach((t) => { out.push(t); walk(t.id); });
  walk(rootId);
  return out;
}

// Inside `parentId`: reuse groups with the template's names anywhere below it (e.g. under "Часть I"),
// otherwise create them; then add only the topics that are not there yet. Nothing is renamed or removed.
async function addTopics(subject, parentId, ortPart, groups) {
  const below = parentId ? await descendants(parentId, subject.id) : await Test.findAll({ where: { subjectId: subject.id } });
  const siblings = below.filter((t) => (t.parentId || null) === (parentId || null));
  for (const [gi, spec] of groups.entries()) {
    let group = below.find((t) => t.kind === 'group' && norm(t.name) === norm(spec.group));
    if (!group) {
      // A plain section with the same name may already sit at this level; keep the names apart.
      const clash = siblings.some((t) => norm(t.name) === norm(spec.group));
      group = await Test.create({
        name: clash ? `${spec.group}: темы` : spec.group,
        subjectId: subject.id,
        parentId: parentId || null,
        kind: 'group',
        ortPart,
        sortOrder: 100 + gi,
        hasExplanations: true,
        isActive: true,
      });
    }
    const children = below.filter((t) => t.parentId === group.id);
    for (const [ti, name] of spec.topics.entries()) {
      if (children.some((t) => norm(t.name) === norm(name))) continue;
      await Test.create({
        name,
        subjectId: subject.id,
        parentId: group.id,
        kind: spec.kind,
        ortPart: group.ortPart || ortPart,
        sortOrder: ti + 1,
        hasExplanations: true,
        isActive: true,
      });
    }
  }
}

// Simulation tests keep a flat topic dictionary per test; the group goes into the name ("Арифметика · Степень")
// so the admin can add a whole group to a part at once.
async function addSimTopics(test, groups) {
  const existing = await SimTopic.findAll({ where: { subjectId: test.id } });
  const names = new Set(existing.map((t) => norm(t.name)));
  let order = existing.reduce((max, t) => Math.max(max, t.sortOrder || 0), 0);
  for (const spec of groups) {
    for (const topic of spec.topics) {
      const name = `${spec.group} · ${topic}`;
      if (names.has(norm(name)) || names.has(norm(topic))) continue;
      order += 1;
      await SimTopic.create({ subjectId: test.id, name, sortOrder: order });
    }
  }
}

// Finds the practice subject (name LIKE `like` and matching `re`) or creates it. Created once: if the admin
// deletes it later, it stays deleted.
async function practiceSubjectOnce(key, like, re, attrs) {
  const candidates = await Subject.findAll({ where: { bank: 'practice', name: { [Op.iLike]: like } }, order: [['id', 'ASC']] });
  let subject = candidates.find((s) => re.test(s.name));
  if (!subject) {
    if (await getSetting(`${key}:created`)) return [];
    subject = await Subject.create({ trackGroup: 'subject', bank: 'practice', isActive: true, ...attrs });
    await setSetting(`${key}:created`, new Date().toISOString());
  }
  return [{ subject, parentId: null, ortPart: null }];
}

const TEMPLATES = [
  {
    key: 'mathTopics.v1',
    groups: MATH_TOPICS,
    async practiceTargets() {
      const out = [];
      const main = await Subject.findOne({ where: { name: 'Основной тест ОРТ', bank: 'practice' } });
      if (main) {
        const math = await Test.findOne({ where: { subjectId: main.id, parentId: null, kind: 'group', name: 'Математика' } })
          || await Test.findOne({ where: { subjectId: main.id, parentId: null, kind: 'group', ortPart: 'math' } });
        if (math) out.push({ subject: main, parentId: math.id, ortPart: math.ortPart || 'math' });
      }
      const subject = await Subject.findOne({ where: { name: 'Математика (предметный)', bank: 'practice' } });
      if (subject) out.push({ subject, parentId: null, ortPart: null });
      return out;
    },
    simWhere: { trackGroup: 'main' },
  },
  {
    key: 'subjectMathTopics.v1',
    groups: SUBJECT_MATH_TOPICS,
    async practiceTargets() {
      return [];
    },
    simWhere: { trackGroup: { [Op.ne]: 'main' }, name: { [Op.iLike]: '%математ%' } },
    // The main-exam maths topics were put into this dictionary earlier; they do not fit the subject test.
    async before(test) {
      const old = new Set(MATH_TOPICS.flatMap((g) => g.topics.map((topic) => norm(`${g.group} · ${topic}`))));
      const rows = await SimTopic.findAll({ where: { subjectId: test.id } });
      for (const row of rows) {
        if (!old.has(norm(row.name))) continue;
        if (await Test.count({ where: { simTopicId: row.id } })) continue;
        await row.destroy();
      }
    },
  },
  {
    key: 'chemTopics.v1',
    groups: CHEMISTRY_TOPICS,
    async practiceTargets() {
      const subject = await Subject.findOne({ where: { name: 'Химия', bank: 'practice' } })
        || await Subject.findOne({ where: { name: { [Op.iLike]: 'хими%' }, bank: 'practice' }, order: [['id', 'ASC']] });
      return subject ? [{ subject, parentId: null, ortPart: null }] : [];
    },
    simWhere: { name: { [Op.iLike]: '%хими%' } },
  },
  {
    key: 'historyTopics.v1',
    groups: HISTORY_TOPICS,
    async practiceTargets() {
      const subject = await Subject.findOne({ where: { name: 'История', bank: 'practice' } })
        || await Subject.findOne({ where: { name: { [Op.iLike]: 'истори%' }, bank: 'practice' }, order: [['id', 'ASC']] });
      return subject ? [{ subject, parentId: null, ortPart: null }] : [];
    },
    simWhere: { trackGroup: { [Op.ne]: 'main' }, name: { [Op.iLike]: 'истори%' } },
  },
  {
    key: 'kyrgyzTopics.v1',
    groups: KYRGYZ_TOPICS,
    // The practice bank has no such subject by default ("Государственный язык" is a different test), so it is created.
    async practiceTargets() {
      return practiceSubjectOnce('kyrgyzTopics.v1', '%кыргыз%', /литерат|адабият/i, { name: 'Кыргызский язык и литература', language: 'ky', sortOrder: 50 });
    },
    simWhere: { trackGroup: 'subject', name: { [Op.iLike]: '%кыргыз%' } },
  },
  {
    key: 'russianTopics.v1',
    groups: RUSSIAN_TOPICS,
    async practiceTargets() {
      return practiceSubjectOnce('russianTopics.v1', '%русск%', /литерат/i, { name: 'Русский язык и литература', language: 'ru', sortOrder: 51 });
    },
    simWhere: { trackGroup: 'subject', name: { [Op.iLike]: 'русский язык и литер%' } },
  },
  {
    key: 'biologyTopics.v1',
    groups: BIOLOGY_TOPICS,
    async practiceTargets() {
      const subject = await Subject.findOne({ where: { name: 'Биология', bank: 'practice' } })
        || await Subject.findOne({ where: { name: { [Op.iLike]: 'биолог%' }, bank: 'practice' }, order: [['id', 'ASC']] });
      return subject ? [{ subject, parentId: null, ortPart: null }] : [];
    },
    simWhere: { trackGroup: { [Op.ne]: 'main' }, name: { [Op.iLike]: 'биолог%' } },
  },
  {
    key: 'physicsTopics.v1',
    groups: PHYSICS_TOPICS,
    async practiceTargets() {
      const subject = await Subject.findOne({ where: { name: 'Физика', bank: 'practice' } })
        || await Subject.findOne({ where: { name: { [Op.iLike]: 'физик%' }, bank: 'practice' }, order: [['id', 'ASC']] });
      return subject ? [{ subject, parentId: null, ortPart: null }] : [];
    },
    simWhere: { trackGroup: { [Op.ne]: 'main' }, name: { [Op.iLike]: 'физик%' } },
  },
];

// Each template is applied once per subject, so topics the admin deletes later do not come back.
async function ensureSubjectTopics() {
  for (const template of TEMPLATES) {
    const done = (subjectId) => `${template.key}:${subjectId}`;
    for (const target of await template.practiceTargets()) {
      if (await getSetting(done(target.subject.id))) continue;
      await addTopics(target.subject, target.parentId, target.ortPart, template.groups);
      await setSetting(done(target.subject.id), new Date().toISOString());
    }
    const simTests = await Subject.findAll({ where: { bank: 'simulation', ...template.simWhere } });
    for (const test of simTests) {
      if (await getSetting(done(test.id))) continue;
      if (template.before) await template.before(test);
      await addSimTopics(test, template.groups);
      await setSetting(done(test.id), new Date().toISOString());
    }
  }
}

module.exports = {
  ensureSubjectTopics, MATH_TOPICS, CHEMISTRY_TOPICS, SUBJECT_MATH_TOPICS, HISTORY_TOPICS, KYRGYZ_TOPICS, BIOLOGY_TOPICS, RUSSIAN_TOPICS, PHYSICS_TOPICS,
};
