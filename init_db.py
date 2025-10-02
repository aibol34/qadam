import sqlite3

DB_NAME = "qadamdap.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    # Таблица пользователей
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_confirmed INTEGER DEFAULT 0,
        confirm_token TEXT,
        expire_at TIMESTAMP,
        reset_code TEXT,                          -- код восстановления
        reset_expire TIMESTAMP,                   -- срок действия кода
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    conn.close()
    print(f"База {DB_NAME} и таблицы успешно созданы ✅")


if __name__ == "__main__":
    init_db()
