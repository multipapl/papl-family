# Family Canvas

Ручной редактор семейного дерева с темной Miro-подобной доской.

Приложение рассчитано на ручное заполнение: люди добавляются с canvas, располагаются вручную и сохраняются через API приложения. В актуальной версии нет GEDCOM-импорта и автоматической раскладки дерева.

Полная документация: [docs/APP.md](docs/APP.md).

## Локальный запуск

```bash
npm install
npm run dev
```

Локальный режим редактирования:

```text
http://localhost:3000/?edit=dev
```

Локальные изменения сохраняются в `.local/tree-snapshot.json`. Этот файл игнорируется git.

## Production

Для production-хранения используется Vercel KV.

Переменные окружения:

```text
KV_REST_API_URL
KV_REST_API_TOKEN
EDIT_SECRET
```

Production-режим редактирования:

```text
https://your-site.vercel.app/?edit=YOUR_EDIT_SECRET
```

## Команды

```bash
npm run lint
npm run build
```
