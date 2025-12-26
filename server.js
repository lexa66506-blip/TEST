const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// SQLite подключение
const db = new sqlite3.Database('./users.db', (err) => {
    if (err) {
        console.error('❌ Ошибка подключения к SQLite:', err);
    } else {
        console.log('✅ Подключено к SQLite базе данных');
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.use(session({
    secret: 'vodka-client-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 30 * 24 * 60 * 60 * 1000
    }
}));

// Инициализация таблиц
async function initDB() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Проверяем существует ли таблица users
            db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
                if (err) {
                    console.error('❌ Ошибка проверки таблицы:', err);
                    reject(err);
                    return;
                }
                
                if (row) {
                    // Таблица существует, проверяем схему
                    db.all("PRAGMA table_info(users)", (err, columns) => {
                        if (err) {
                            console.error('❌ Ошибка проверки схемы:', err);
                            reject(err);
                            return;
                        }
                        
                        // Проверяем есть ли колонка hwid и может ли она быть NULL
                        const hwidColumn = columns.find(col => col.name === 'hwid');
                        
                        if (hwidColumn && hwidColumn.notnull === 1) {
                            console.log('⚠️  Обнаружена старая схема с NOT NULL для hwid');
                            console.log('🔄 Выполняется миграция базы данных...');
                            
                            // Миграция: создаем новую таблицу и копируем данные
                            db.run('ALTER TABLE users RENAME TO users_old', (err) => {
                                if (err) {
                                    console.error('❌ Ошибка переименования таблицы:', err);
                                    reject(err);
                                    return;
                                }
                                
                                createTables(resolve, reject, true);
                            });
                        } else {
                            console.log('✅ Схема базы данных актуальна');
                            resolve();
                        }
                    });
                } else {
                    // Таблицы нет, создаем
                    createTables(resolve, reject, false);
                }
            });
        });
    });
}

function createTables(resolve, reject, migrate = false) {
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
                reject(err);
                return;
            }
            console.log('✅ Таблица users создана');
            
            if (migrate) {
                // Копируем данные из старой таблицы
                db.run(`
                    INSERT INTO users (uid, username, password, hwid, subscription_type, subscription_expires, created_at)
                    SELECT uid, username, password, NULL, subscription_type, subscription_expires, created_at
                    FROM users_old
                `, (err) => {
                    if (err) {
                        console.error('❌ Ошибка миграции данных:', err);
                    } else {
                        console.log('✅ Данные пользователей мигрированы');
                        // Удаляем старую таблицу
                        db.run('DROP TABLE users_old', (err) => {
                            if (err) console.error('⚠️  Не удалось удалить старую таблицу:', err);
                        });
                    }
                });
            }
        });
        
        db.run(`
            CREATE TABLE IF NOT EXISTS keys (
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
                reject(err);
            } else {
                console.log('✅ Таблица keys создана');
                console.log('✅ База данных готова!');
                resolve();
            }
        });
    });
}

initDB();

// API: Регистрация
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Заполните все поля' });
    if (username.length < 3) return res.status(400).json({ success: false, message: 'Логин минимум 3 символа' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Пароль минимум 6 символов' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            [username, hashedPassword],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ success: false, message: 'Пользователь уже существует' });
                    }
                    console.error(err);
                    return res.status(500).json({ success: false, message: 'Ошибка сервера' });
                }
                
                req.session.userId = this.lastID;
                req.session.username = username;
                res.json({ success: true, message: 'Регистрация успешна!', uid: this.lastID, username });
            }
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// API: Вход
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Заполните все поля' });

    try {
        db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Ошибка сервера' });
            }
            
            if (!user) {
                return res.status(400).json({ success: false, message: 'Неверный логин или пароль' });
            }

            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return res.status(400).json({ success: false, message: 'Неверный логин или пароль' });
            }

            req.session.userId = user.uid;
            req.session.username = user.username;
            res.json({ success: true, message: 'Вход выполнен!', uid: user.uid, username: user.username });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// API: Проверка авторизации
app.get('/api/check-auth', async (req, res) => {
    if (!req.session.userId) return res.json({ authenticated: false });

    try {
        db.get(
            'SELECT uid, username, created_at, subscription_type, subscription_expires FROM users WHERE uid = ?',
            [req.session.userId],
            (err, user) => {
                if (err) {
                    console.error(err);
                    return res.json({ authenticated: false });
                }
                
                if (!user) return res.json({ authenticated: false });

                let isActive = false;
                if (user.subscription_type) {
                    if (user.subscription_type === 'lifetime') isActive = true;
                    else if (user.subscription_expires) isActive = new Date(user.subscription_expires) > new Date();
                }

                res.json({
                    authenticated: true,
                    uid: user.uid,
                    username: user.username,
                    created_at: user.created_at,
                    subscription_type: user.subscription_type,
                    subscription_expires: user.subscription_expires,
                    subscription_active: isActive
                });
            }
        );
    } catch (err) {
        console.error(err);
        res.json({ authenticated: false });
    }
});

// API: Выход
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Выход выполнен' });
});

// API: Админ - все пользователи
app.get('/api/admin/users', async (req, res) => {
    try {
        db.all(
            'SELECT uid, username, hwid, created_at, subscription_type, subscription_expires FROM users ORDER BY uid',
            [],
            (err, users) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ success: false, message: 'Ошибка сервера' });
                }
                res.json({ success: true, users });
            }
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// API: Удаление пользователя
app.post('/api/admin/delete-user', async (req, res) => {
    const { uid } = req.body;
    try {
        db.run('DELETE FROM users WHERE uid = ?', [uid], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Ошибка сервера' });
            }
            res.json({ success: true, message: 'Пользователь удален' });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// API: Генерация ключа
app.post('/api/admin/generate-key', async (req, res) => {
    const { subscription_type, duration_days } = req.body;
    const keyCode = 'VDK-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Math.random().toString(36).substring(2, 10).toUpperCase();

    try {
        db.run(
            'INSERT INTO keys (key_code, subscription_type, duration_days) VALUES (?, ?, ?)',
            [keyCode, subscription_type, duration_days],
            (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ success: false, message: 'Ошибка сервера' });
                }
                res.json({ success: true, key: keyCode });
            }
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// API: Все ключи
app.get('/api/admin/keys', async (req, res) => {
    try {
        db.all('SELECT * FROM keys ORDER BY id DESC', [], (err, keys) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Ошибка сервера' });
            }
            res.json({ success: true, keys });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// API: Активация ключа
app.post('/api/activate-key', async (req, res) => {
    const { key_code } = req.body;
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Не авторизован' });
    if (!key_code) return res.status(400).json({ success: false, message: 'Введите ключ' });

    try {
        db.get('SELECT * FROM keys WHERE key_code = ?', [key_code], (err, key) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Ошибка сервера' });
            }
            
            if (!key) return res.status(400).json({ success: false, message: 'Ключ не найден' });
            if (key.used) return res.status(400).json({ success: false, message: 'Ключ уже использован' });

            let expiresDate;
            if (key.subscription_type === 'lifetime') {
                const now = new Date();
                now.setFullYear(now.getFullYear() + 1337);
                expiresDate = now.toISOString();
            } else {
                const now = new Date();
                now.setDate(now.getDate() + key.duration_days);
                expiresDate = now.toISOString();
            }

            db.run(
                'UPDATE users SET subscription_type = ?, subscription_expires = ? WHERE uid = ?',
                [key.subscription_type, expiresDate, userId],
                (err) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ success: false, message: 'Ошибка активации' });
                    }
                    
                    db.run(
                        'UPDATE keys SET used = 1, used_by = ?, used_at = CURRENT_TIMESTAMP WHERE key_code = ?',
                        [userId, key_code],
                        (err) => {
                            if (err) {
                                console.error(err);
                                return res.status(500).json({ success: false, message: 'Ошибка активации' });
                            }
                            
                            res.json({ 
                                success: true, 
                                message: 'Подписка активирована!', 
                                subscription_type: key.subscription_type, 
                                expires: expiresDate 
                            });
                        }
                    );
                }
            );
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка активации' });
    }
});


// ========================================
// API ДЛЯ ЛОАДЕРА
// ========================================

app.post('/api/launcher/check-subscription', async (req, res) => {
    const { username, password, hwid } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Введите логин и пароль', has_subscription: false });
    }
    if (!hwid) {
        return res.status(400).json({ success: false, message: 'HWID не передан', has_subscription: false });
    }

    try {
        db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Ошибка сервера', has_subscription: false });
            }
            
            if (!user) {
                return res.status(401).json({ success: false, message: 'Неверный логин или пароль', has_subscription: false });
            }

            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return res.status(401).json({ success: false, message: 'Неверный логин или пароль', has_subscription: false });
            }

            // HWID логика
            if (!user.hwid) {
                db.run('UPDATE users SET hwid = ? WHERE uid = ?', [hwid, user.uid], (err) => {
                    if (err) console.error(err);
                    else console.log(`✅ HWID записан для ${username}: ${hwid}`);
                });
            } else if (user.hwid !== hwid) {
                return res.status(403).json({ success: false, message: 'Аккаунт привязан к другому ПК', has_subscription: false });
            }

            // Проверка подписки
            let hasSubscription = false;
            let subscriptionInfo = { type: user.subscription_type, expires: user.subscription_expires, active: false };

            if (user.subscription_type) {
                if (user.subscription_type === 'lifetime') {
                    hasSubscription = true;
                    subscriptionInfo.active = true;
                } else if (user.subscription_expires) {
                    hasSubscription = new Date(user.subscription_expires) > new Date();
                    subscriptionInfo.active = hasSubscription;
                }
            }

            res.json({
                success: true,
                message: hasSubscription ? 'Подписка активна' : 'Подписка отсутствует или истекла',
                has_subscription: hasSubscription,
                hwid: user.hwid || hwid,
                user: { uid: user.uid, username: user.username, created_at: user.created_at },
                subscription: subscriptionInfo
            });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера', has_subscription: false });
    }
});

app.get('/api/launcher/check-uid/:uid', async (req, res) => {
    const { uid } = req.params;
    
    try {
        db.get(
            'SELECT uid, username, subscription_type, subscription_expires FROM users WHERE uid = ?',
            [uid],
            (err, user) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ success: false, message: 'Ошибка сервера', has_subscription: false });
                }
                
                if (!user) {
                    return res.status(404).json({ success: false, message: 'Пользователь не найден', has_subscription: false });
                }

                let hasSubscription = false;
                
                if (user.subscription_type) {
                    if (user.subscription_type === 'lifetime') hasSubscription = true;
                    else if (user.subscription_expires) hasSubscription = new Date(user.subscription_expires) > new Date();
                }

                res.json({
                    success: true,
                    has_subscription: hasSubscription,
                    user: { uid: user.uid, username: user.username },
                    subscription: { type: user.subscription_type, expires: user.subscription_expires, active: hasSubscription }
                });
            }
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера', has_subscription: false });
    }
});

// API: Сброс HWID пользователя (админ)
app.post('/api/admin/reset-hwid', async (req, res) => {
    const { uid } = req.body;
    try {
        db.run('UPDATE users SET hwid = NULL WHERE uid = ?', [uid], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Ошибка сервера' });
            }
            res.json({ success: true, message: 'HWID сброшен' });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
