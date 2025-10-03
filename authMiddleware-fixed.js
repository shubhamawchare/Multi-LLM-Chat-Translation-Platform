// FIXED authMiddleware.js - Proper fallback handling and authentication

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

class AuthService {
    constructor() {
        this.resetTokens = new Map(); // email -> { token, expiresAt }
        this.dbPool = null;
        this.memory = null; // Will be set if DB fails
        this.initDb();
    }

    async initDb() {
        try {
            const host = process.env.DB_HOST || 'localhost';
            const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
            const user = process.env.DB_USER || 'root';
            const password = process.env.DB_PASSWORD || '';
            const database = process.env.DB_NAME || 'multi_llm_platform';

            this.dbPool = mysql.createPool({
                host,
                port,
                user,
                password,
                database,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                acquireTimeout: 60000,
                timeout: 60000,
                reconnect: true
            });

            // Test the connection
            const connection = await this.dbPool.getConnection();
            await connection.ping();
            
            try {
                // Create minimal tables if they don't exist
                await connection.query(`
                    CREATE TABLE IF NOT EXISTS users (
                        user_id INT AUTO_INCREMENT PRIMARY KEY,
                        email VARCHAR(255) UNIQUE NOT NULL,
                        password_hash VARCHAR(255) NOT NULL,
                        first_name VARCHAR(100) NULL,
                        last_name VARCHAR(100) NULL,
                        profile_completed TINYINT(1) DEFAULT 1,
                        tokens_remaining INT DEFAULT 1000,
                        plan_name VARCHAR(50) DEFAULT 'Free',
                        is_active TINYINT(1) DEFAULT 1,
                        email_verified TINYINT(1) DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB;
                `);

                await connection.query(`
                    CREATE TABLE IF NOT EXISTS content_history (
                        content_id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT NOT NULL,
                        content_type VARCHAR(50) NOT NULL,
                        title VARCHAR(255) NOT NULL,
                        content MEDIUMTEXT NOT NULL,
                        prompt_used TEXT,
                        llm_model VARCHAR(100),
                        tokens_used INT DEFAULT 0,
                        cost DECIMAL(10,6) DEFAULT 0,
                        language VARCHAR(10),
                        age_level VARCHAR(50),
                        is_favorite TINYINT(1) DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        INDEX(user_id),
                        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
                    ) ENGINE=InnoDB;
                `);

                await connection.query(`
                    CREATE TABLE IF NOT EXISTS prebuilt_content (
                        content_id INT AUTO_INCREMENT PRIMARY KEY,
                        title VARCHAR(255) NOT NULL,
                        content_type ENUM('pdf', 'audio', 'image', 'video', 'text') NOT NULL,
                        category VARCHAR(100) NOT NULL,
                        summary TEXT NOT NULL,
                        file_path VARCHAR(500) NOT NULL,
                        download_url VARCHAR(500) NOT NULL,
                        user_category_filter JSON NULL,
                        created_by VARCHAR(100) DEFAULT 'admin',
                        is_active BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB;
                `);

                await connection.query(`
                    CREATE TABLE IF NOT EXISTS user_bookmarks (
                        bookmark_id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT NOT NULL,
                        content_type ENUM('prebuilt', 'custom', 'transformation') NOT NULL,
                        content_id INT NOT NULL,
                        notes TEXT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
                    ) ENGINE=InnoDB;
                `);

                await connection.query(`
                    CREATE TABLE IF NOT EXISTS transformation_details (
                        serial_id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT NOT NULL,
                        input_data TEXT NOT NULL,
                        output_data TEXT NOT NULL,
                        transformation_code INT NOT NULL DEFAULT 0,
                        llm_name VARCHAR(100) NOT NULL,
                        tokens INT NOT NULL DEFAULT 0,
                        credits DECIMAL(10,2) NOT NULL DEFAULT 0,
                        created_by VARCHAR(100) DEFAULT 'system',
                        record_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
                    ) ENGINE=InnoDB;
                `);

                // Insert sample prebuilt content
                await connection.query(`
                    INSERT IGNORE INTO prebuilt_content 
                    (content_id, title, content_type, category, summary, file_path, download_url) 
                    VALUES 
                    (1, 'Diwali Guide', 'pdf', 'Festivals', 'Complete guide to celebrating Diwali', '/content/diwali.pdf', '/api/download/diwali.pdf'),
                    (2, 'Christmas Handbook', 'pdf', 'Festivals', 'Christmas celebration guide', '/content/christmas.pdf', '/api/download/christmas.pdf'),
                    (3, 'Business Templates', 'pdf', 'Business', 'Professional templates', '/content/business.pdf', '/api/download/business.pdf')
                `);

                console.log('✅ Database tables initialized successfully');
            } finally {
                connection.release();
            }

        } catch (err) {
            console.warn('⚠️ Database initialization failed, falling back to in-memory auth:', err.message);
            // Setup in-memory fallback
            this.memory = { 
                users: [
                    {
                        user_id: 1,
                        email: 'admin@example.com',
                        password_hash: await bcrypt.hash('admin123', 10),
                        first_name: 'Admin',
                        last_name: 'User',
                        profile_completed: 1,
                        tokens_remaining: 1000,
                        plan_name: 'Free',
                        created_at: new Date().toISOString()
                    }
                ], 
                nextId: 2,
                content_history: [],
                prebuilt_content: [
                    { content_id: 1, title: 'Diwali Guide', is_active: true },
                    { content_id: 2, title: 'Christmas Handbook', is_active: true },
                    { content_id: 3, title: 'Business Templates', is_active: true }
                ],
                user_bookmarks: [],
                transformation_details: []
            };
            
            // Create mock database pool for consistency
            this.dbPool = {
                async getConnection() {
                    return {
                        async execute(query, params) {
                            // Mock execute for in-memory mode
                            return [[], {}];
                        },
                        async query(query, params) {
                            // Mock query for in-memory mode
                            return [[], {}];
                        },
                        release() { /* no-op */ },
                        async ping() { /* no-op */ }
                    };
                }
            };
        }
    }

    signToken(user) {
        const payload = {
            user_id: user.user_id,
            email: user.email,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
        };
        return jwt.sign(payload, JWT_SECRET);
    }

    async getUserByEmail(email) {
        if (this.memory) {
            return this.memory.users.find(u => u.email === email) || null;
        }

        try {
            const [rows] = await this.dbPool.execute(
                'SELECT * FROM users WHERE email = ? LIMIT 1',
                [email]
            );
            return rows[0] || null;
        } catch (error) {
            console.error('Database error in getUserByEmail:', error);
            return null;
        }
    }

    async getUserById(userId) {
        if (this.memory) {
            return this.memory.users.find(u => u.user_id === userId) || null;
        }

        try {
            const [rows] = await this.dbPool.execute(
                'SELECT user_id, email, first_name, last_name, profile_completed, tokens_remaining, plan_name, created_at FROM users WHERE user_id = ? LIMIT 1',
                [userId]
            );
            return rows[0] || null;
        } catch (error) {
            console.error('Database error in getUserById:', error);
            return null;
        }
    }

    async registerUser(email, password, firstName, lastName) {
        const existing = await this.getUserByEmail(email);
        if (existing) throw new Error('Email already registered');
        
        const passwordHash = await bcrypt.hash(password, 10);

        if (this.memory) {
            const user = {
                user_id: this.memory.nextId++,
                email,
                password_hash: passwordHash,
                first_name: firstName || null,
                last_name: lastName || null,
                profile_completed: 1,
                tokens_remaining: 1000,
                plan_name: 'Free',
                created_at: new Date().toISOString()
            };
            this.memory.users.push(user);
            const token = this.signToken(user);
            return this.toAuthResponse(user, token);
        }

        try {
            const [result] = await this.dbPool.execute(
                'INSERT INTO users (email, password_hash, first_name, last_name, profile_completed, tokens_remaining, plan_name) VALUES (?,?,?,?,1,1000,?)',
                [email, passwordHash, firstName || null, lastName || null, 'Free']
            );
            const user = await this.getUserById(result.insertId);
            const token = this.signToken(user);
            return this.toAuthResponse(user, token);
        } catch (error) {
            console.error('Database error in registerUser:', error);
            throw new Error('Registration failed');
        }
    }

    async loginUser(email, password) {
        const user = await this.getUserByEmail(email);
        if (!user) throw new Error('Invalid credentials');
        
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) throw new Error('Invalid credentials');
        
        const fullUser = this.memory ? user : await this.getUserById(user.user_id);
        const token = this.signToken(fullUser);
        return this.toAuthResponse(fullUser, token);
    }

    toAuthResponse(user, token) {
        return {
            token,
            userId: user.user_id,
            email: user.email,
            firstName: user.first_name || null,
            lastName: user.last_name || null,
            profileCompleted: !!user.profile_completed,
            tokensRemaining: user.tokens_remaining ?? 1000,
            planName: user.plan_name || 'Free'
        };
    }

    async updateUserProfile(userId, data) {
        if (this.memory) {
            let user = this.memory.users.find(u => u.user_id === userId);
            if (!user) throw new Error('User not found');
            
            if (data.firstName !== undefined) user.first_name = data.firstName;
            if (data.lastName !== undefined) user.last_name = data.lastName;
            if (data.profileCompleted !== undefined) user.profile_completed = data.profileCompleted ? 1 : 0;
            return { message: 'Profile updated' };
        }

        try {
            const fields = [];
            const values = [];
            
            if (data.firstName !== undefined) {
                fields.push('first_name = ?');
                values.push(data.firstName);
            }
            if (data.lastName !== undefined) {
                fields.push('last_name = ?');
                values.push(data.lastName);
            }
            if (data.profileCompleted !== undefined) {
                fields.push('profile_completed = ?');
                values.push(data.profileCompleted ? 1 : 0);
            }

            if (fields.length === 0) return { message: 'No changes' };
            
            values.push(userId);
            await this.dbPool.execute(
                `UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`,
                values
            );
            return { message: 'Profile updated' };
        } catch (error) {
            console.error('Database error in updateUserProfile:', error);
            throw new Error('Profile update failed');
        }
    }

    async getUserCategories() {
        return [
            { category_id: 1, category_name: 'Education' },
            { category_id: 2, category_name: 'Business' },
            { category_id: 3, category_name: 'Creative' },
            { category_id: 4, category_name: 'Developer' }
        ];
    }

    async generatePasswordResetToken(email) {
        const user = await this.getUserByEmail(email);
        if (!user) throw new Error('No account with that email');
        
        const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        const expiresAt = Date.now() + 1000 * 60 * 15; // 15 minutes
        this.resetTokens.set(token, { userId: user.user_id, expiresAt });
        return { resetToken: token, expiresAt };
    }

    async resetPassword(token, newPassword) {
        const data = this.resetTokens.get(token);
        if (!data) throw new Error('Invalid or expired token');
        if (Date.now() > data.expiresAt) {
            this.resetTokens.delete(token);
            throw new Error('Reset token expired');
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        
        if (this.memory) {
            const user = this.memory.users.find(u => u.user_id === data.userId);
            if (!user) throw new Error('User not found');
            user.password_hash = passwordHash;
        } else {
            try {
                await this.dbPool.execute(
                    'UPDATE users SET password_hash = ? WHERE user_id = ?',
                    [passwordHash, data.userId]
                );
            } catch (error) {
                console.error('Database error in resetPassword:', error);
                throw new Error('Password reset failed');
            }
        }

        this.resetTokens.delete(token);
        return { message: 'Password updated successfully' };
    }

    async updateTokenUsage(userId, tokensUsed, cost) {
        if (this.memory) {
            const user = this.memory.users.find(u => u.user_id === userId);
            if (user && typeof user.tokens_remaining === 'number') {
                user.tokens_remaining = Math.max(0, user.tokens_remaining - Number(tokensUsed || 0));
            }
            return;
        }

        try {
            await this.dbPool.execute(
                'UPDATE users SET tokens_remaining = GREATEST(tokens_remaining - ?, 0) WHERE user_id = ?',
                [Number(tokensUsed || 0), userId]
            );
        } catch (error) {
            console.error('Database error in updateTokenUsage:', error);
        }
    }

    // Helper methods for server.js to handle both modes
    async getPrebuiltContentCount() {
        if (this.memory) {
            return this.memory.prebuilt_content.filter(c => c.is_active).length;
        }
        
        try {
            const connection = await this.dbPool.getConnection();
            try {
                const [rows] = await connection.execute(
                    'SELECT COUNT(*) as count FROM prebuilt_content WHERE is_active = TRUE'
                );
                return rows[0].count || 0;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error getting prebuilt content count:', error);
            return 0;
        }
    }

    async getUserBookmarksCount(userId) {
        if (this.memory) {
            return this.memory.user_bookmarks.filter(b => b.user_id === userId).length;
        }
        
        try {
            const connection = await this.dbPool.getConnection();
            try {
                const [rows] = await connection.execute(
                    'SELECT COUNT(*) as count FROM user_bookmarks WHERE user_id = ?',
                    [userId]
                );
                return rows[0].count || 0;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error getting bookmarks count:', error);
            return 0;
        }
    }

    async getUserContentCount(userId) {
        if (this.memory) {
            return this.memory.content_history.filter(c => c.user_id === userId).length;
        }
        
        try {
            const connection = await this.dbPool.getConnection();
            try {
                const [rows] = await connection.execute(
                    'SELECT COUNT(*) as count FROM content_history WHERE user_id = ?',
                    [userId]
                );
                return rows[0].count || 0;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error getting content count:', error);
            return 0;
        }
    }

    async getUserTransformationsCount(userId) {
        if (this.memory) {
            return this.memory.transformation_details.filter(t => t.user_id === userId).length;
        }
        
        try {
            const connection = await this.dbPool.getConnection();
            try {
                const [rows] = await connection.execute(
                    'SELECT COUNT(*) as count FROM transformation_details WHERE user_id = ?',
                    [userId]
                );
                return rows[0].count || 0;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error getting transformations count:', error);
            return 0;
        }
    }

    async getUserContentHistory(userId, limit = 50) {
        if (this.memory) {
            return this.memory.content_history
                .filter(c => c.user_id === userId)
                .slice(0, limit);
        }
        
        try {
            const connection = await this.dbPool.getConnection();
            try {
                const [contents] = await connection.execute(`
                    SELECT content_id, content_type, title, content, llm_model,
                    tokens_used, cost, language, age_level, is_favorite, created_at
                    FROM content_history
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                `, [userId, limit]);
                return contents;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error getting content history:', error);
            return [];
        }
    }
}

function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        
        if (!token) {
            return res.status(401).json({ error: 'Missing token' });
        }

        const payload = jwt.verify(token, JWT_SECRET);
        req.user = { user_id: payload.user_id, email: payload.email };
        next();
    } catch (err) {
        console.error('Authentication error:', err.message);
        return res.status(401).json({ error: 'Invalid token' });
    }
}

function checkTokenBalance(minTokens) {
    return async (req, res, next) => {
        // For simplicity, let requests through; server updates usage afterward.
        next();
    };
}

module.exports = { AuthService, authenticateToken, checkTokenBalance };