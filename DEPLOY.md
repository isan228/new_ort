# Деплой ОРТ 2026

Без Docker. Один процесс Node отдаёт API и собранный React. Репозиторий: [isan228/new_ort](https://github.com/isan228/new_ort).

Локально код уезжает так:

```bash
npm run push
```

Скрипт ставит `origin` на этот GitHub, коммитит изменения (кроме `.env`) и пушит ветку `main`. Сообщение можно задать:

```bash
npm run push -- "тарифы и сиды химии"
```

Нужны Git и вход в GitHub (Git Credential Manager или SSH). Если коммит падает — один раз задай имя в своей системе, не в репозитории:

```bash
git config --global user.name "Твоё имя"
git config --global user.email "ты@email.com"
```

---

## Что должно быть на сервере

- Ubuntu 22.04 / 24.04 (или другой Linux)
- Node.js 20+
- PostgreSQL 14+
- nginx (для домена и HTTPS)
- git

Не ставь Docker.

---

## 1. Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v
```

## 2. PostgreSQL

Поставь пакет. Базу, пользователя и таблицы создаёт скрипт, не руками.

```bash
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

## 3. Код

```bash
sudo mkdir -p /var/www
sudo chown "$USER":"$USER" /var/www
cd /var/www
git clone https://github.com/isan228/new_ort.git ort-2026
cd ort-2026
```

## 4. Переменные окружения

```bash
cp .env.example .env
nano .env
```

Прод:

```
PORT=4000
NODE_ENV=production
DATABASE_URL=postgres://ort:СИЛЬНЫЙ_ПАРОЛЬ@127.0.0.1:5432/ort_2026
JWT_SECRET=длинная_случайная_строка
CLIENT_URL=https://твой-домен.kg
ADMIN_EMAIL=admin@твой-домен.kg
ADMIN_PASSWORD=смени_сразу
```

Файл `.env` на сервере не коммить и не пушь.

Смени пароль админа после первого входа. Демо `demo@ort.kg` на проде лучше выключить или сменить пароль в базе.

## 5. База, сборка и первый запуск

```bash
cd /var/www/ort-2026
npm install
npm run install:all
```

В `.env` должны быть `DATABASE_URL` и пароль суперпользователя Postgres:

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=пароль_суперпользователя
```

На Ubuntu, если TCP к `postgres` закрыт, скрипт сам пробует `sudo -u postgres psql`.

```bash
npm run setup:db
npm run build
NODE_ENV=production npm start
```

`setup:db` создаёт роль и базу из `DATABASE_URL`, таблицы, теги, тарифы и демо. Повторный запуск безопасен: существующую базу не ломает, сиды не дублируют предметы.

Проверка: `curl http://127.0.0.1:4000/api/health` → `{"ok":true,"product":"ort-2026"}`.

Останови процесс (Ctrl+C) и повесь его на systemd.

## 6. systemd

`sudo nano /etc/systemd/system/ort-2026.service`

```
[Unit]
Description=ORT 2026
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/ort-2026/server
Environment=NODE_ENV=production
EnvironmentFile=/var/www/ort-2026/.env
ExecStart=/usr/bin/node /var/www/ort-2026/server/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Права:

```bash
sudo chown -R www-data:www-data /var/www/ort-2026
sudo chmod 640 /var/www/ort-2026/.env
sudo systemctl daemon-reload
sudo systemctl enable --now ort-2026
sudo systemctl status ort-2026
```

Логи: `journalctl -u ort-2026 -f`

## 7. nginx + HTTPS

`sudo apt-get install -y nginx certbot python3-certbot-nginx`

`sudo nano /etc/nginx/sites-available/ort-2026`

```
server {
    listen 80;
    server_name твой-домен.kg www.твой-домен.kg;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/ort-2026 /etc/nginx/sites-enabled/ort-2026
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d твой-домен.kg -d www.твой-домен.kg
```

После этого сайт и `/api/*` идут на один порт 4000. React уже внутри `client/dist`.

## 8. Обновление после правок

На своём компьютере:

```bash
npm run push -- "что изменилось"
```

На сервере:

```bash
cd /var/www/ort-2026
sudo -u www-data git pull origin main
npm install
npm run install:all
npm run build
sudo systemctl restart ort-2026
```

Если `git pull` ругается на права — `sudo chown -R www-data:www-data /var/www/ort-2026`, `.env` не затирай.

## 9. Файлы загрузок

Картинки глоссария пишутся в `server/uploads/`. Каталог должен быть доступен пользователю сервиса (`www-data`). Бэкапь его вместе с базой.

Бэкап базы:

```bash
sudo -u postgres pg_dump ort_2026 > ort_2026_$(date +%F).sql
```

## 10. Мобилка позже

Тот же origin: `https://твой-домен.kg/api/...`, заголовок `Authorization: Bearer <JWT>`. CORS смотрит на `CLIENT_URL`; для приложения можно расширить список origin в `server/server.js`.
