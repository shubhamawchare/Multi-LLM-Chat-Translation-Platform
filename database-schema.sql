
-- Additional tables for the Industrial Database Requirements
-- Adding to the existing multi_llm_platform database

USE multi_llm_platform;

-- 1.1 Transformation Master
CREATE TABLE transformation_master (
    record_id INT AUTO_INCREMENT PRIMARY KEY,
    from_type VARCHAR(50) NOT NULL,
    to_type VARCHAR(50) NOT NULL,
    transformation_code INT NOT NULL,
    created_by VARCHAR(100) DEFAULT 'system',
    record_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_stamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_transformation_code (transformation_code),
    INDEX idx_from_to (from_type, to_type),
    INDEX idx_created_date (record_date)
);

-- Insert transformation code mappings
INSERT INTO transformation_master (from_type, to_type, transformation_code, created_by) VALUES
('text', 'text', 0, 'admin'),
('text', 'image', 1, 'admin'),
('text', 'audio', 2, 'admin'),
('text', 'video', 3, 'admin'),
('image', 'text', 4, 'admin'),
('image', 'image', 5, 'admin'),
('image', 'audio', 6, 'admin'),
('audio', 'text', 7, 'admin'),
('audio', 'audio', 8, 'admin'),
('video', 'text', 9, 'admin');

-- 1.2 Transformation Details
CREATE TABLE transformation_details (
    serial_id INT AUTO_INCREMENT PRIMARY KEY,
    record_id INT NOT NULL,
    user_id INT NOT NULL,
    group_name VARCHAR(100) NULL,
    subgroup VARCHAR(100) NULL,
    category VARCHAR(100) NULL,
    subcategory VARCHAR(100) NULL,
    input_data TEXT NOT NULL,
    output_data TEXT NOT NULL,
    transformation_code INT NOT NULL,
    strength DECIMAL(3,2) DEFAULT 0.7,
    llm_name VARCHAR(100) NOT NULL,
    tokens INT NOT NULL,
    credits DECIMAL(10,2) NOT NULL,
    created_by VARCHAR(100) DEFAULT 'system',
    record_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_stamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (record_id) REFERENCES transformation_master(record_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (transformation_code) REFERENCES transformation_master(transformation_code),
    INDEX idx_user_transformations (user_id, record_date),
    INDEX idx_llm_usage (llm_name, tokens),
    INDEX idx_transformation_code_details (transformation_code)
);

-- 1.3 LLM Master
CREATE TABLE llm_master (
    llm_id INT AUTO_INCREMENT PRIMARY KEY,
    llm_name VARCHAR(100) NOT NULL UNIQUE,
    version VARCHAR(50) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    created_by VARCHAR(100) DEFAULT 'admin',
    record_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_stamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_provider (provider),
    INDEX idx_llm_name (llm_name)
);

-- Insert default LLM models
INSERT INTO llm_master (llm_name, version, provider, created_by) VALUES
('Falcon', '7B', 'HuggingFace', 'admin'),
('Falcon', '40B', 'HuggingFace', 'admin'),
('Mistral', '7B', 'HuggingFace', 'admin'),
('GPT-4', 'turbo', 'OpenAI', 'admin'),
('GPT-3.5', 'turbo', 'OpenAI', 'admin'),
('Claude-3', 'Sonnet', 'Anthropic', 'admin'),
('Claude-3', 'Haiku', 'Anthropic', 'admin'),
('Deepseek', 'Chat', 'Deepseek', 'admin'),
('Deepseek', 'Coder', 'Deepseek', 'admin');

-- 1.4 User Details (Enhanced - adding to existing users table)
CREATE TABLE user_details_extended (
    serial_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    favourites JSON NULL,
    bookmarks JSON NULL,
    created_by VARCHAR(100) DEFAULT 'system',
    record_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_details (user_id),
    INDEX idx_user_details (user_id)
);

-- 1.5 Input Details
CREATE TABLE input_details (
    input_id INT AUTO_INCREMENT PRIMARY KEY,
    record_id INT NOT NULL,
    user_id INT NOT NULL,
    input_content LONGTEXT NOT NULL,
    input_type VARCHAR(50) DEFAULT 'text',
    file_path VARCHAR(500) NULL,
    created_by VARCHAR(100) DEFAULT 'system',
    record_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_stamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (record_id) REFERENCES transformation_master(record_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_inputs (user_id, record_date),
    INDEX idx_input_type (input_type)
);

-- 1.6 Output Details
CREATE TABLE output_details (
    output_id INT AUTO_INCREMENT PRIMARY KEY,
    record_id INT NOT NULL,
    user_id INT NOT NULL,
    output_content LONGTEXT NOT NULL,
    output_type VARCHAR(50) DEFAULT 'text',
    file_path VARCHAR(500) NULL,
    created_by VARCHAR(100) DEFAULT 'system',
    record_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_stamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (record_id) REFERENCES transformation_master(record_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_outputs (user_id, record_date),
    INDEX idx_output_type (output_type)
);

-- Prebuilt content table for the dashboard sections
CREATE TABLE prebuilt_content (
    content_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content_type ENUM('pdf', 'audio', 'image', 'video', 'text') NOT NULL,
    category VARCHAR(100) NOT NULL,
    summary TEXT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    download_url VARCHAR(500) NOT NULL,
    user_category_filter JSON NULL, -- Which user categories can access this
    created_by VARCHAR(100) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_content_type (content_type),
    INDEX idx_category (category),
    INDEX idx_active (is_active)
);

-- Insert sample prebuilt content
INSERT INTO prebuilt_content (title, content_type, category, summary, file_path, download_url, user_category_filter) VALUES
('Diwali Celebration Guide', 'pdf', 'Festivals', 'Complete guide to celebrating Diwali with traditional customs, recipes, and decoration ideas', '/content/diwali_guide.pdf', '/api/download/diwali_guide.pdf', '["Students", "Individuals", "Teachers"]'),
('Christmas Carol Audio', 'audio', 'Festivals', 'Collection of traditional Christmas carols with instrumental versions', '/content/christmas_carols.mp3', '/api/download/christmas_carols.mp3', '["Students", "Teachers", "Kindergarten"]'),
('Educational Infographics', 'image', 'Education', 'Set of colorful educational infographics for various subjects', '/content/edu_infographics.png', '/api/download/edu_infographics.png', '["Teachers", "Students", "Institutions"]'),
('Business Presentation Template', 'pdf', 'Business', 'Professional presentation templates for business use', '/content/business_template.pdf', '/api/download/business_template.pdf', '["Professionals", "Enterprises"]'),
('Learning Video Series', 'video', 'Education', 'Educational video series for different age groups', '/content/learning_videos.mp4', '/api/download/learning_videos.mp4', '["Students", "Teachers", "Primary", "Secondary"]');

-- User bookmarks table
CREATE TABLE user_bookmarks (
    bookmark_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    content_type ENUM('prebuilt', 'custom', 'transformation') NOT NULL,
    content_id INT NOT NULL, -- References different tables based on content_type
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_bookmarks (user_id, content_type),
    INDEX idx_bookmark_content (content_type, content_id)
);

-- User favorites table (separate from bookmarks)
CREATE TABLE user_favorites (
    favorite_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    content_type ENUM('prebuilt', 'custom', 'transformation') NOT NULL,
    content_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_favorite (user_id, content_type, content_id),
    INDEX idx_user_favorites (user_id, content_type)
);
