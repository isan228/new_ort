require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { ensureDatabase } = require('./utils/ensureDatabase');
const { prepareAppData } = require('./utils/prepareAppData');
const { requireAdmin } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const testsRoutes = require('./routes/tests');
const adminRoutes = require('./routes/admin');
const paymentsRoutes = require('./routes/payments');
const termImagesRoutes = require('./routes/termImages');

const app = express();
const port = Number(process.env.PORT) || 4000;

const allowedOrigins = new Set(
  [process.env.CLIENT_URL, 'https://ort.kg', 'https://www.ort.kg', 'http://localhost:5173', 'http://127.0.0.1:5173']
    .filter(Boolean),
);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, true);
  },
  credentials: true,
}));
app.use('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
app.use((req, res, next) => {
  if (Buffer.isBuffer(req.body)) return next();
  return express.json({ limit: '4mb' })(req, res, next);
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, product: 'ort-2026' });
});

app.use('/api/auth', authRoutes);
app.use('/api/tests', testsRoutes);
app.use('/api/admin', requireAdmin, adminRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/term-images', termImagesRoutes);

const clientDist = path.join(__dirname, '..', 'client', 'dist');
const indexHtml = path.join(clientDist, 'index.html');
const serveFrontend = fs.existsSync(indexHtml);

if (serveFrontend) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    return res.sendFile(indexHtml);
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Ошибка сервера' });
});

async function boot() {
  await ensureDatabase();
  await prepareAppData();

  app.listen(port, () => {
    console.log(`ОРТ 2026 API: http://localhost:${port}`);
    if (serveFrontend) console.log('Фронт: client/dist');
    else console.warn('Нет client/dist — выполни npm run build');
  });
}

boot().catch((err) => {
  console.error('Не удалось запустить сервер:', err);
  process.exit(1);
});
