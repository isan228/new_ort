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
CLIENT_URL=https://ort.kg
ADMIN_LOGIN=admin
ADMIN_EMAIL=admin@ort.kg
ADMIN_PASSWORD=смени_сразу

FINIK_API_KEY=ключ_от_finik
FINIK_ACCOUNT_ID=счёт_finik
```

Finik: в `.env` только API-ключ и account id. В корне проекта лежат `finik_private.pem` (подпись запросов) и `finik_public.pem` (этот файл один раз отправь в Finik). Вебхук и возврат уже `https://ort.kg/api/payments/webhook` и `https://ort.kg/pay/success`.

Файл `.env` на сервере не коммить и не пушь.

Админ входит только по ссылке `/админ` (логин `admin`). Смени пароль админа после первого входа. Демо-ученик `demo` / `demo123` на проде лучше выключить или сменить пароль в базе.

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

Файл юнита лежит в репозитории. Не надо писать его руками через nano.

```bash
sudo npm run setup:service
sudo systemctl status ort-2026
curl http://127.0.0.1:4000/api/health
```

Скрипт копирует сервис в `/etc/systemd/system/ort-2026.service`, ставит владельца `www-data` и делает `enable --now`.

Если скрипта ещё нет на сервере (старый clone) — создай юнит так:

```bash
sudo tee /etc/systemd/system/ort-2026.service >/dev/null <<'EOF'
[Unit]
Description=ORT 2026
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/ort-2026/server
EnvironmentFile=/var/www/ort-2026/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /var/www/ort-2026/server/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo chown -R www-data:www-data /var/www/ort-2026
sudo chown -R www-data:www-data /var/www/ort-2026
sudo systemctl daemon-reload
sudo systemctl enable --now ort-2026
sudo systemctl status ort-2026
```

Логи: `journalctl -u ort-2026 -f`

## 7. nginx + HTTPS

Сейчас по домену открывается «Welcome to nginx», пока включён сайт `default`. Его надо снять и поставить прокси на приложение.

```bash
sudo apt-get install -y nginx
sudo npm run setup:nginx
curl -I http://127.0.0.1/
curl http://127.0.0.1/api/health
```

Скрипт пишет `/etc/nginx/sites-available/ort-2026`, удаляет `sites-enabled/default` и делает `listen 80 default_server`, чтобы любой заход на IP/домен шёл в Node на порт 4000.

Домен можно передать явно:

```bash
sudo DOMAIN=ort.kg npm run setup:nginx
```

или прописать `CLIENT_URL=https://ort.kg` в `.env`.

Если скрипта на сервере ещё нет — вставь блок ниже как есть:

```bash
rm -f /etc/nginx/sites-enabled/default
tee /etc/nginx/sites-available/ort-2026 >/dev/null <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

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
EOF
ln -sfn /etc/nginx/sites-available/ort-2026 /etc/nginx/sites-enabled/ort-2026
nginx -t
systemctl reload nginx
```

Приложение должно быть запущено: `systemctl status ort-2026` и `curl http://127.0.0.1:4000/api/health`.

HTTPS:

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d твой-домен.kg -d www.твой-домен.kg
```

## 8. Обновление после правок

С компьютера:

```bash
npm run push -- "что изменилось"
```

На сервере одной командой:

```bash
cd /var/www/ort-2026
sudo npm run update
```

Скрипт сам делает `git pull` (без `git config --global`), ставит зависимости, при необходимости обновляет БД, собирает React, выставляет права `www-data` и перезапускает `ort-2026`. Файл `.env` не трогает.

Без pull (если код уже залит вручную): `sudo npm run update -- --skip-pull`  
Без `setup:db`: `sudo npm run update -- --skip-db`

## 9. Файлы загрузок

Картинки глоссария пишутся в `server/uploads/`. Каталог должен быть доступен пользователю сервиса (`www-data`). Бэкапь его вместе с базой.

Бэкап базы:

```bash
sudo -u postgres pg_dump ort_2026 > ort_2026_$(date +%F).sql
```

## 10. Мобилка позже

Тот же origin: `https://ort.kg/api/...`, заголовок `Authorization: Bearer <JWT>`. CORS уже включает `https://ort.kg`.
