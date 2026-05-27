# Menu Control System

Система контроля меню ресторанов с импортом прайс-листов и продаж (только XLSX/XLS), историей изменения цен, планированием и аналитикой.

## Stack
Next.js + TypeScript + Prisma + SQLite (с возможностью переключения на PostgreSQL).

## Установка
```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run build
npm run start
```

## Timeweb Cloud
1. Node.js 18+.
2. Build command: `npm run build`
3. Start command: `npm run start`
4. Для PostgreSQL: `DATABASE_PROVIDER="postgresql"` и `DATABASE_URL` вида `postgresql://...`.

## ENV
- `DATABASE_PROVIDER` = `sqlite` или `postgresql`
- `DATABASE_URL`
- `SESSION_SECRET`

## Формат отчета меню (XLSX/XLS)
Поддерживаются как «идеальные» заголовки, так и синонимы из выгрузок:
- Категория / Группа / Раздел
- Название блюда / Блюдо / Номенклатура
- Себестоимость / Фудкост
- Продажная цена / Цена продажи / Цена
- Дата начала / Дата действия
- Комментарий / Примечание

Пример: `public/examples/menu-template.csv`.

## Формат отчета продаж (XLSX/XLS)
Поддерживаемые поля:
- Название блюда / Блюдо / Номенклатура
- Количество продаж / Кол-во
- Выручка / Сумма
- periodStart / Начало периода / Дата с
- periodEnd / Конец периода / Дата по

Пример: `public/examples/sales-template.csv`.

## Что происходит при импорте меню
1. Парсим файл и нормализуем поля в единый формат.
2. Сопоставляем блюдо по `(restaurantId + name)`.
3. Если блюда нет — создаем `MenuItem`.
4. Если изменилась цена/себестоимость — пишем `MenuPriceChange` и обновляем `MenuItem`.
5. Считаем метрики:
   - `foodCostPercent = costPrice / salePrice * 100`
   - `markupRub = salePrice - costPrice`
   - `markupPercent = markupRub / costPrice * 100`

## Роли
- `admin` — доступ ко всем ресторанам.
- `restaurant_user` — доступ к одному ресторану (привязка в `User.restaurantId`).


## Важно по загрузке файлов
- В интерфейсе принимаются только Excel-файлы: `.xlsx` и `.xls`.
- Попытка загрузить CSV вернет ошибку в preview API.


## Deploy на Railway
1. Создайте новый проект в Railway и подключите GitHub-репозиторий.
2. Добавьте сервис **PostgreSQL** в том же проекте Railway.
3. В переменных приложения задайте:
   - `DATABASE_PROVIDER=postgresql`
   - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
   - `SESSION_SECRET=<длинная-случайная-строка>`
4. Railway автоматически выполнит build (`npm run build`) и start (`npm run start`) из `railway.json`.
5. После первого деплоя выполните инициализацию БД одной командой в Railway Shell:
   - `npm run db:push`
6. При необходимости заполните тестовые данные:
   - `npm run db:seed`

> Для production на Railway рекомендуется PostgreSQL; SQLite в контейнере использовать не стоит, так как файловая БД неустойчива при пересоздании инстанса.
