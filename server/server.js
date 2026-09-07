require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

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

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '4mb' }));
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
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api(?:\/|$)|\/uploads(?:\/|$)).*/, (req, res, next) => {
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) next(err);
    });
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
  });
}

boot().catch((err) => {
  console.error('Не удалось запустить сервер:', err);
  process.exit(1);
});
