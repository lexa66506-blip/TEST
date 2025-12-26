# Как задеплоить сайт на Render

## Шаг 1: Создай репозиторий на GitHub

1. Зайди на https://github.com
2. Нажми "+" в правом верхнем углу → "New repository"
3. Название: `vodka-site` (или любое другое)
4. Выбери "Private" (приватный)
5. Нажми "Create repository"

## Шаг 2: Загрузи файлы на GitHub

После создания репозитория откроется страница. Нажми "uploading an existing file"

Загрузи ВСЕ файлы из папки vodkaSite:
- server.js
- package.json
- package-lock.json
- index.html
- cabinet.html
- admin.html
- logo.png
- Vodka.png
- и остальные файлы

НЕ загружай папки:
- node_modules (она большая и не нужна)
- .git

Нажми "Commit changes"

## Шаг 3: Создай аккаунт на Render

1. Зайди на https://render.com
2. Нажми "Get Started for Free"
3. Выбери "Sign up with GitHub" — это проще всего
4. Разреши доступ к GitHub

## Шаг 4: Создай Web Service

1. На главной странице Render нажми "New +"
2. Выбери "Web Service"
3. Нажми "Connect a repository"
4. Найди свой репозиторий `vodka-site` и нажми "Connect"

## Шаг 5: Настрой сервис

Заполни поля:
- Name: `vodka-site` (или любое)
- Region: выбери ближайший (Frankfurt или Oregon)
- Branch: `main`
- Runtime: `Node`
- Build Command: `npm install`
- Start Command: `node server.js`
- Instance Type: `Free`

Нажми "Create Web Service"

## Шаг 6: Дождись деплоя

Render начнёт собирать проект. Подожди 2-5 минут.
Когда статус станет "Live" — сервер готов!

## Шаг 7: Получи URL

После деплоя ты увидишь URL типа:
`https://vodka-site-xxxx.onrender.com`

Скопируй его.

## Шаг 8: Обнови URL в лоадере

Открой файл `loaderiik/LoaderUI/Services/AuthService.cs`

Найди строку:
```csharp
private const string BaseUrl = "https://vodkaclient-2.onrender.com";
```

Замени на свой новый URL:
```csharp
private const string BaseUrl = "https://vodka-site-xxxx.onrender.com";
```

## Готово!

Теперь у тебя свой сервер. Когда нужно обновить код:
1. Зайди на GitHub
2. Открой файл который хочешь изменить
3. Нажми карандаш (Edit)
4. Внеси изменения
5. Нажми "Commit changes"
6. Render автоматически передеплоит через 1-2 минуты

---

## Важно: База данных

На бесплатном Render база данных (users.db) будет сбрасываться при каждом передеплое!

Чтобы этого избежать, можно:
1. Использовать внешнюю БД (например Supabase или PlanetScale)
2. Или перейти на платный план Render с Persistent Disk

Для тестов бесплатного плана хватит.
