const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// Удаляем старую базу если существует
if (fs.existsSync('./users.db')) {
    fs.unlinkSync('./users.db');
    console.log('🗑️  Старая база данных удалена');
}

// Создаем новую базу
const db = new sqlite3.Database('./users.db', (err) => {
    if (err) {
        console.error('❌ Ошибка создания базы:', err);
        process.exit(1);
    }
    console.log('✅ Новая база данных создана');
});

// Создаем таблицы
db.serialize(() => {
    db.run(`
        CREATE TABLE users (
            uid INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            hwid TEXT,
            subscription_type TEXT,
            subscription_expires TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('❌ Ошибка создания таблицы users:', err);
            process.exit(1);
        }
        console.log('✅ Таблица users создана');
    });
    
    db.run(`
        CREATE TABLE keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key_code TEXT UNIQUE NOT NULL,
            subscription_type TEXT NOT NULL,
            duration_days INTEGER NOT NULL,
            used INTEGER DEFAULT 0,
            used_by INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            used_at TEXT
        )
    `, (err) => {
        if (err) {
            console.error('❌ Ошибка создания таблицы keys:', err);
            process.exit(1);
        }
        console.log('✅ Таблица keys создана');
        console.log('✅ База данных готова к использованию!');
        db.close();
    });
});
