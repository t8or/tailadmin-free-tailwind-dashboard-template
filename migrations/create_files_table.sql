CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    user_id VARCHAR(100) DEFAULT '000',
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    storage_path TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    is_extracted BOOLEAN DEFAULT false,
    extracted_text TEXT
); 