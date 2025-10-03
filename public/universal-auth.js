// universal-auth.js - Universal authentication and logout handling for all pages with enhanced functionality

class UniversalAuthManager {
    constructor() {
        this.apiBase = '/api';
        this.authCheckInterval = null;
        this.init();
    }

    init() {
        // Check if we're on a protected page
        const currentPath = window.location.pathname;
        const protectedPaths = ['/', '/dashboard', '/translate', '/profile-setup'];
        const isProtectedPage = protectedPaths.includes(currentPath) || currentPath === '/workspace';

        if (isProtectedPage) {
            if (!this.isAuthenticated()) {
                this.redirectToLogin();
                return;
            }
            // Set up auth monitoring for protected pages
            this.setupAuthMonitoring();
        }

        // Add logout button to all pages if authenticated
        this.addLogoutButton();
        
        // Set up global event listeners
        this.setupGlobalEventListeners();
    }

    isAuthenticated() {
        const token = localStorage.getItem('authToken');
        if (!token) return false;

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const isValid = payload.exp * 1000 > Date.now();
            
            if (!isValid) {
                this.clearAuthData();
                return false;
            }
            return isValid;
        } catch (error) {
            console.error('Token validation error:', error);
            this.clearAuthData();
            return false;
        }
    }

    clearAuthData() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('rememberedEmail');
    }

    setupAuthMonitoring() {
        // Check authentication every 30 seconds
        this.authCheckInterval = setInterval(() => {
            if (!this.isAuthenticated()) {
                this.redirectToLogin();
            }
        }, 30000);

        // Check on page focus
        window.addEventListener('focus', () => {
            if (!this.isAuthenticated()) {
                this.redirectToLogin();
            }
        });
    }

    addLogoutButton() {
        if (!this.isAuthenticated()) return;

        // Check if logout button already exists
        if (document.getElementById('universalLogoutBtn')) return;

        // Create floating logout button
        const logoutContainer = document.createElement('div');
        logoutContainer.id = 'universalLogoutContainer';

        // Create styles
        const styles = document.createElement('style');
        styles.textContent = `
            #universalLogoutContainer {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 10px;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                padding: 8px 15px;
                border-radius: 25px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                border: 1px solid rgba(255, 255, 255, 0.2);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                transition: all 0.3s ease;
            }

            #universalLogoutContainer:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 25px rgba(0, 0, 0, 0.2);
            }

            .auth-user-info {
                display: flex;
                align-items: center;
                gap: 8px;
                color: #333;
            }

            .auth-user-avatar {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 600;
                font-size: 12px;
            }

            #universalLogoutBtn {
                background: #ff4757;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 15px;
                cursor: pointer;
                font-weight: 500;
                font-size: 12px;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 4px;
            }

            #universalLogoutBtn:hover {
                background: #ff3742;
                transform: scale(1.05);
            }

            .tokens-display {
                font-size: 11px;
                color: #666;
                background: rgba(102, 126, 234, 0.1);
                padding: 2px 6px;
                border-radius: 10px;
                border: 1px solid rgba(102, 126, 234, 0.2);
            }

            .current-time {
                font-size: 10px;
                color: #888;
                margin-left: 5px;
            }

            @media (max-width: 768px) {
                #universalLogoutContainer {
                    top: 10px;
                    right: 10px;
                    padding: 6px 12px;
                }
                .auth-user-info {
                    display: none;
                }
                #universalLogoutBtn {
                    padding: 8px 10px;
                    font-size: 11px;
                }
            }

            /* Dark mode support */
            @media (prefers-color-scheme: dark) {
                #universalLogoutContainer {
                    background: rgba(30, 30, 30, 0.95);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .auth-user-info {
                    color: #e0e0e0;
                }
                .tokens-display {
                    color: #b0b0b0;
                    background: rgba(102, 126, 234, 0.2);
                }
                .current-time {
                    color: #aaa;
                }
            }
        `;
        document.head.appendChild(styles);

        // Create HTML content with current time
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
            hour12: true, 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        const dateString = now.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });

        const userInfoHTML = `
            <div class="auth-user-info">
                <div class="auth-user-avatar" id="userAvatar">U</div>
                <div>
                    <div id="userName">User</div>
                    <div class="tokens-display" id="tokensDisplay">1000 tokens</div>
                </div>
                <div class="current-time" id="currentTime">${dateString} ${timeString}</div>
            </div>
            <button id="universalLogoutBtn">
                <span>🚪</span>
                <span>Logout</span>
            </button>
        `;

        logoutContainer.innerHTML = userInfoHTML;
        document.body.appendChild(logoutContainer);

        // Load user info
        this.loadUserInfo();
        
        // Start time updates
        this.startTimeUpdates();

        // Add logout event listener
        document.getElementById('universalLogoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleLogout();
        });
    }

    startTimeUpdates() {
        // Update time every minute
        setInterval(() => {
            const timeElement = document.getElementById('currentTime');
            if (timeElement) {
                const now = new Date();
                const timeString = now.toLocaleTimeString('en-US', { 
                    hour12: true, 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                const dateString = now.toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                });
                timeElement.textContent = `${dateString} ${timeString}`;
            }
        }, 60000); // Update every minute
    }

    async loadUserInfo() {
        try {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            const userNameEl = document.getElementById('userName');
            const userAvatarEl = document.getElementById('userAvatar');
            const tokensEl = document.getElementById('tokensDisplay');

            if (userNameEl && userData.firstName) {
                userNameEl.textContent = userData.firstName;
            } else if (userNameEl && userData.email) {
                userNameEl.textContent = userData.email.split('@')[0];
            }

            if (userAvatarEl && userData.firstName) {
                userAvatarEl.textContent = userData.firstName.charAt(0).toUpperCase();
            } else if (userAvatarEl && userData.email) {
                userAvatarEl.textContent = userData.email.charAt(0).toUpperCase();
            }

            if (tokensEl) {
                tokensEl.textContent = (userData.tokensRemaining || '1000') + ' tokens';
            }

            // Try to fetch fresh data
            const response = await fetch(this.apiBase + '/auth/profile', {
                headers: this.getAuthHeaders()
            });
            
            if (response.ok) {
                const freshData = await response.json();
                localStorage.setItem('userData', JSON.stringify(freshData));
                
                if (userNameEl && freshData.first_name) {
                    userNameEl.textContent = freshData.first_name;
                }
                if (tokensEl) {
                    tokensEl.textContent = (freshData.tokens_remaining || '1000') + ' tokens';
                }
            }
        } catch (error) {
            console.error('Failed to load user info:', error);
        }
    }

    setupGlobalEventListeners() {
        // Handle navigation links authentication
        document.addEventListener('click', (e) => {
            const target = e.target.closest('a');
            if (!target) return;

            const href = target.getAttribute('href');
            if (!href) return;

            // Protected routes
            const protectedRoutes = ['/', '/dashboard', '/translate', '/profile-setup', '/workspace'];
            const isProtectedRoute = protectedRoutes.some(route => 
                href === route || href.startsWith(route + '?')
            );

            if (isProtectedRoute && href !== '/login') {
                if (!this.isAuthenticated()) {
                    e.preventDefault();
                    this.redirectToLogin();
                    return;
                }
            }
        });

        // Handle form submissions that might need authentication
        document.addEventListener('submit', (e) => {
            const form = e.target;
            const action = form.getAttribute('action');
            
            if (action && action.startsWith('/api/') && 
                action !== '/api/auth/login' && 
                action !== '/api/auth/register') {
                if (!this.isAuthenticated()) {
                    e.preventDefault();
                    this.redirectToLogin();
                    return;
                }
            }
        });

        // Handle visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isAuthenticated()) {
                this.loadUserInfo();
            }
        });
    }

    redirectToLogin() {
        if (this.authCheckInterval) {
            clearInterval(this.authCheckInterval);
        }
        
        this.clearAuthData();
        
        // Show notification if possible
        this.showNotification('Session expired. Please login again.', 'info');
        
        // Redirect after a short delay to allow notification to show
        setTimeout(() => {
            window.location.replace('/login');
        }, 1000);
    }

    async handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            await this.performLogout();
        }
    }

    async performLogout() {
        try {
            if (this.authCheckInterval) {
                clearInterval(this.authCheckInterval);
            }

            // Show notification
            this.showNotification('Logging out...', 'info');

            // Try server logout
            try {
                await fetch(this.apiBase + '/auth/logout', {
                    method: 'POST',
                    headers: this.getAuthHeaders()
                });
            } catch (e) {
                console.log('Server logout failed, proceeding with client logout');
            }

            // Clear auth data
            this.clearAuthData();

            // Remove logout button
            const logoutContainer = document.getElementById('universalLogoutContainer');
            if (logoutContainer) {
                logoutContainer.remove();
            }

            // Show success message
            this.showNotification('Logged out successfully!', 'success');

            // Redirect to login after short delay
            setTimeout(() => {
                window.location.replace('/login');
            }, 1500);

        } catch (error) {
            console.error('Logout error:', error);
            this.showNotification('Logout failed. Redirecting to login...', 'error');
            setTimeout(() => {
                this.redirectToLogin();
            }, 2000);
        }
    }

    getAuthHeaders() {
        const token = localStorage.getItem('authToken');
        return {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        };
    }

    // Enhanced notification method
    showNotification(message, type = 'info') {
        // Try to find existing notification system
        if (window.dashboardManager && window.dashboardManager.showNotification) {
            window.dashboardManager.showNotification(message, type);
            return;
        }

        // Create temporary notification
        const notification = document.createElement('div');
        const bgColor = {
            'error': '#ff4757',
            'success': '#2ed573',
            'info': '#3742fa',
            'warning': '#ffa502'
        }[type] || '#3742fa';

        notification.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10001;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            transform: translateX(100%);
            transition: transform 0.3s ease;
            max-width: 300px;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Auto remove
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
    }
}

// Initialize universal auth manager
let universalAuthManager;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        universalAuthManager = new UniversalAuthManager();
    });
} else {
    universalAuthManager = new UniversalAuthManager();
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.UniversalAuthManager = UniversalAuthManager;
    window.universalAuthManager = universalAuthManager;
}