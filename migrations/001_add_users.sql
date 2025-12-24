-- Migration: Add multi-user support
-- Run this to upgrade database schema

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Create API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    provider TEXT NOT NULL CHECK(provider IN ('gemini', 'local')),
    api_key_encrypted TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create request queue table
CREATE TABLE IF NOT EXISTS request_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    coins TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
    position INTEGER,
    result TEXT,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Modify history table to add user_id and question
-- SQLite doesn't support ALTER COLUMN, so we need to recreate table
CREATE TABLE IF NOT EXISTS history_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER DEFAULT 1, -- Default to admin for existing records
    question TEXT NOT NULL,
    result_json TEXT,
    interpretation TEXT,
    is_favorite BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_str TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Copy existing data
INSERT INTO history_new (id, user_id, question, result_json, interpretation, is_favorite, created_at, date_str)
SELECT id, 1, '', result_json, interpretation, is_favorite, created_at, date_str
FROM history;

-- Replace old table
DROP TABLE history;
ALTER TABLE history_new RENAME TO history;

-- Create default admin user (password: admin123)
-- Note: You may need to regenerate the hash using: python3 -c "from auth import hash_password; print(hash_password('admin123'))"
-- Then update the password_hash value below
INSERT OR IGNORE INTO users (id, username, password_hash, role) 
VALUES (1, 'admin', '$2b$12$mR1eEN36P6k.oLcCDB4JzebsLaCgn3ZauMj5j8WgdBDscCeN9F7lu', 'admin');

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_history_user_id ON history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_date ON history(date_str);
CREATE INDEX IF NOT EXISTS idx_queue_status ON request_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_user ON request_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_apikeys_user ON api_keys(user_id);

-- Migration complete
-- Default admin credentials: admin / admin123
