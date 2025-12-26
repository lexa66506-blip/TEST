# Исправление ошибки базы данных

## Проблема
```
Error: SQLITE_CONSTRAINT: NOT NULL constraint failed: users.hwid
Error: connect ECONNREFUSED 127.0.0.1:5432
```

## Решение

### Локально:
```bash
npm run reset-db
npm start
```

### На Render:

1. Зайди в Dashboard Render → твой сервис
2. Перейди в **Shell** (вкладка слева)
3. Выполни команды:
```bash
rm -f users.db
node reset-database.js
```
4. Перезапусти сервис (кнопка **Manual Deploy** → **Clear build cache & deploy**)

### Альтернативный способ для Render:

Добавь в настройках Render **Build Command**:
```bash
npm install && npm run reset-db
```

И **Start Command**:
```bash
npm start
```

## Что было исправлено:

1. ✅ Удалена старая база с неправильной схемой
2. ✅ Создана новая база с правильной схемой (hwid может быть NULL)
3. ✅ Убраны все зависимости от PostgreSQL

## Проверка:

После исправления попробуй зарегистрироваться снова. Ошибка должна исчезнуть.
