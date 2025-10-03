// dashboard.js - Enhanced Dashboard with improved features, real-time updates, and better error handling

class DashboardManager {
    constructor() {
        this.apiBase = '/api';
        this.updateInterval = null;
        this.init();
    }

    async init() {
        console.log('🚀 Initializing enhanced dashboard...');
        
        if (!this.isAuthenticated()) {
            return window.location.href = '/login';
        }

        await this.loadUserData();
        this.setupEventListeners();
        await this.loadDashboardCounts();
        await this.loadRecentActivity();
        this.setupRealTimeUpdates();
        
        console.log('✅ Enhanced dashboard ready');
    }

    isAuthenticated() {
        const token = localStorage.getItem('authToken');
        if (!token) return false;
        
        try {
            const { exp } = JSON.parse(atob(token.split('.')[1]));
            return exp * 1000 > Date.now();
        } catch {
            return false;
        }
    }

    getAuthHeaders() {
        return {
            'Authorization': 'Bearer ' + localStorage.getItem('authToken'),
            'Content-Type': 'application/json'
        };
    }

    async loadUserData() {
        try {
            const res = await fetch(this.apiBase + '/auth/profile', {
                headers: this.getAuthHeaders()
            });
            
            if (!res.ok) throw new Error('Failed to load user data');
            
            this.userData = await res.json();
            localStorage.setItem('userData', JSON.stringify(this.userData));
            
            this.updateUserDisplay();
        } catch (error) {
            console.warn('Failed to load user data:', error);
            this.showNotification('Failed to load user profile', 'error');
        }
    }

    updateUserDisplay() {
        const nameEl = document.getElementById('userName');
        const planEl = document.getElementById('userPlan');
        const tokensEl = document.getElementById('tokensRemaining');
        const emailEl = document.getElementById('userEmail');
        const joinDateEl = document.getElementById('joinDate');

        if (nameEl) {
            const displayName = this.userData.first_name 
                ? `Welcome back, ${this.userData.first_name}!`
                : `Welcome back, ${this.userData.email.split('@')[0]}!`;
            nameEl.textContent = displayName;
        }

        if (planEl) {
            planEl.textContent = this.userData.plan_name || 'Free Plan';
        }

        if (tokensEl) {
            tokensEl.textContent = this.userData.tokens_remaining || '0';
        }

        if (emailEl) {
            emailEl.textContent = this.userData.email || '';
        }

        if (joinDateEl && this.userData.created_at) {
            const joinDate = new Date(this.userData.created_at);
            joinDateEl.textContent = joinDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    }

    async loadDashboardCounts() {
        const countElements = [
            { id: 'prebuiltCount', endpoint: '/content/prebuilt/count', suffix: ' items available' },
            { id: 'bookmarksCount', endpoint: '/content/bookmarks/count', suffix: ' bookmarked' },
            { id: 'customCount', endpoint: '/content/custom/count', suffix: ' custom items' },
            { id: 'advancedCount', endpoint: '/transformations/count', suffix: ' transformations' }
        ];

        for (const item of countElements) {
            try {
                const response = await fetch(this.apiBase + item.endpoint, {
                    headers: this.getAuthHeaders()
                });

                if (response.ok) {
                    const data = await response.json();
                    const element = document.getElementById(item.id);
                    if (element) {
                        element.textContent = data.count + item.suffix;
                        element.classList.add('count-loaded');
                    }
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (error) {
                console.error(`Error loading ${item.id}:`, error);
                const element = document.getElementById(item.id);
                if (element) {
                    element.textContent = '0' + item.suffix;
                    element.classList.add('count-error');
                }
            }
        }
    }

    async loadRecentActivity() {
        try {
            const response = await fetch(this.apiBase + '/content/history', {
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                const activities = await response.json();
                this.displayRecentActivity(activities.slice(0, 5)); // Show last 5 activities
            }
        } catch (error) {
            console.error('Failed to load recent activity:', error);
        }
    }

    displayRecentActivity(activities) {
        const container = document.getElementById('recentActivity');
        if (!container) return;

        if (activities.length === 0) {
            container.innerHTML = '<p class="no-activity">No recent activity</p>';
            return;
        }

        const activitiesHTML = activities.map(activity => {
            const date = new Date(activity.created_at);
            const timeAgo = this.getTimeAgo(date);
            
            return `
                <div class="activity-item">
                    <div class="activity-icon">${this.getActivityIcon(activity.content_type)}</div>
                    <div class="activity-details">
                        <div class="activity-title">${activity.title}</div>
                        <div class="activity-meta">
                            <span class="activity-model">${activity.llm_model}</span>
                            <span class="activity-time">${timeAgo}</span>
                        </div>
                    </div>
                    ${activity.is_favorite ? '<div class="activity-favorite">⭐</div>' : ''}
                </div>
            `;
        }).join('');

        container.innerHTML = activitiesHTML;
    }

    getActivityIcon(contentType) {
        const icons = {
            'custom': '💬',
            'translation': '🌐',
            'image': '🎨',
            'design': '🎯',
            'default': '📄'
        };
        return icons[contentType] || icons.default;
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
        
        return date.toLocaleDateString();
    }

    setupRealTimeUpdates() {
        // Update current time every second
        this.updateCurrentTime();
        setInterval(() => this.updateCurrentTime(), 1000);

        // Update dashboard counts every 5 minutes
        this.updateInterval = setInterval(() => {
            this.loadDashboardCounts();
            this.loadRecentActivity();
        }, 5 * 60 * 1000);

        // Update token count every minute
        setInterval(() => this.loadUserData(), 60 * 1000);
    }

    updateCurrentTime() {
        const timeElements = document.querySelectorAll('.current-time');
        const now = new Date();
        
        const timeString = now.toLocaleTimeString('en-US', {
            hour12: true,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        const dateString = now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        timeElements.forEach(el => {
            if (el.classList.contains('time-only')) {
                el.textContent = timeString;
            } else if (el.classList.contains('date-only')) {
                el.textContent = dateString;
            } else {
                el.textContent = `${dateString}, ${timeString}`;
            }
        });
    }

    setupEventListeners() {
        // Logout functionality - handled by universal auth manager
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.onclick = () => {
                if (confirm('Are you sure you want to logout?')) {
                    if (window.universalAuthManager) {
                        window.universalAuthManager.performLogout();
                    } else {
                        this.fallbackLogout();
                    }
                }
            };
        }

        // Settings navigation
        document.querySelectorAll('a[href="/profile-setup"]').forEach(a => {
            a.onclick = e => {
                e.preventDefault();
                window.location.href = '/profile-setup';
            };
        });

        // Section cards navigation
        document.querySelectorAll('.section-card').forEach(card => {
            card.onclick = () => {
                const sectionType = card.getAttribute('data-section') || 
                                  card.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
                if (sectionType) {
                    this.openSection(sectionType);
                }
            };
        });

        // Quick actions
        this.setupQuickActions();

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'l':
                        e.preventDefault();
                        if (confirm('Logout?')) {
                            this.fallbackLogout();
                        }
                        break;
                    case 'r':
                        e.preventDefault();
                        this.refreshDashboard();
                        break;
                }
            }
        });
    }

    setupQuickActions() {
        // Quick chat action
        const quickChatBtn = document.getElementById('quickChat');
        if (quickChatBtn) {
            quickChatBtn.onclick = () => window.location.href = '/';
        }

        // Quick translate action
        const quickTranslateBtn = document.getElementById('quickTranslate');
        if (quickTranslateBtn) {
            quickTranslateBtn.onclick = () => window.location.href = '/translate';
        }

        // Refresh dashboard
        const refreshBtn = document.getElementById('refreshDashboard');
        if (refreshBtn) {
            refreshBtn.onclick = () => this.refreshDashboard();
        }
    }

    async refreshDashboard() {
        this.showNotification('Refreshing dashboard...', 'info');
        
        try {
            await Promise.all([
                this.loadUserData(),
                this.loadDashboardCounts(),
                this.loadRecentActivity()
            ]);
            
            this.showNotification('Dashboard refreshed!', 'success');
        } catch (error) {
            console.error('Dashboard refresh failed:', error);
            this.showNotification('Failed to refresh dashboard', 'error');
        }
    }

    fallbackLogout() {
        localStorage.clear();
        this.showNotification('Logged out successfully!', 'success');
        setTimeout(() => {
            window.location.href = '/login';
        }, 1000);
    }

    async openSection(type) {
        if (!this.isAuthenticated()) {
            return window.location.href = '/login';
        }

        // Inject modal if missing
        if (!document.getElementById('modal')) {
            this.createModal();
        }

        const sectionTitles = {
            'prebuilt': '📚 Prebuilt Content',
            'bookmarks': '🔖 Your Bookmarks',
            'custom': '✨ Custom Content',
            'advanced': '🚀 Advanced Requests'
        };

        document.getElementById('modalTitle').textContent = sectionTitles[type] || type;
        const body = document.getElementById('modalBody');
        body.innerHTML = '<div class="loading">Loading...</div>';

        const modal = document.getElementById('modal');
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';

        try {
            if (type === 'prebuilt') {
                await this.loadPrebuiltContent(body);
            } else if (type === 'custom') {
                await this.loadCustomContent(body);
            } else if (type === 'bookmarks') {
                await this.loadBookmarks(body);
            } else {
                body.innerHTML = `<div class="coming-soon">
                    <h3>${type.charAt(0).toUpperCase() + type.slice(1)} coming soon!</h3>
                    <p>This feature is under development and will be available in a future update.</p>
                </div>`;
            }
        } catch (error) {
            console.error(`Error loading ${type}:`, error);
            body.innerHTML = `<div class="error-message">Failed to load ${type} content. Please try again later.</div>`;
        }
    }

    createModal() {
        const modalHTML = `
            <div id="modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 id="modalTitle">Content</h2>
                        <button class="modal-close" onclick="this.closest('.modal').style.display='none'; document.body.style.overflow=''">&times;</button>
                    </div>
                    <div id="modalBody" class="modal-body">
                        Loading...
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Add modal styles
        if (!document.getElementById('modalStyles')) {
            const styles = document.createElement('style');
            styles.id = 'modalStyles';
            styles.textContent = `
                .modal {
                    display: none;
                    position: fixed;
                    z-index: 1000;
                    left: 0;
                    top: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0,0,0,0.5);
                    backdrop-filter: blur(5px);
                }
                .modal-content {
                    background-color: var(--color-surface);
                    margin: 5% auto;
                    padding: 0;
                    border-radius: 12px;
                    width: 90%;
                    max-width: 800px;
                    max-height: 80vh;
                    overflow: hidden;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                }
                .modal-header {
                    padding: 20px;
                    border-bottom: 1px solid var(--color-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .modal-header h2 {
                    margin: 0;
                    color: var(--color-text);
                }
                .modal-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: var(--color-text-secondary);
                }
                .modal-close:hover {
                    color: var(--color-text);
                }
                .modal-body {
                    padding: 20px;
                    max-height: 60vh;
                    overflow-y: auto;
                }
                .loading {
                    text-align: center;
                    padding: 40px;
                    color: var(--color-text-secondary);
                }
                .error-message {
                    text-align: center;
                    padding: 40px;
                    color: var(--color-error);
                }
                .coming-soon {
                    text-align: center;
                    padding: 40px;
                }
                .coming-soon h3 {
                    color: var(--color-primary);
                    margin-bottom: 10px;
                }
            `;
            document.head.appendChild(styles);
        }
    }

    async loadPrebuiltContent(container) {
        // Sample prebuilt content - in real app, this would come from API
        const sampleContent = [
            {
                id: 1,
                title: 'Diwali Celebration Guide',
                summary: 'Complete guide to celebrating Diwali with traditional customs, recipes, and decoration ideas',
                type: 'PDF',
                category: 'Festivals'
            },
            {
                id: 2,
                title: 'Christmas Traditions Handbook',
                summary: 'Explore Christmas customs around the world with beautiful illustrations and stories',
                type: 'PDF',
                category: 'Festivals'
            },
            {
                id: 3,
                title: 'Educational Infographics Pack',
                summary: 'Set of colorful educational infographics for various subjects including science and math',
                type: 'Images',
                category: 'Education'
            }
        ];

        let html = '<div class="content-grid">';
        sampleContent.forEach(item => {
            html += `
                <div class="content-item">
                    <div class="content-header">
                        <h4>${item.title}</h4>
                        <span class="content-type">${item.type}</span>
                    </div>
                    <p class="content-summary">${item.summary}</p>
                    <div class="content-actions">
                        <button class="btn btn-primary btn-sm" onclick="alert('Download functionality coming soon!')">
                            📥 Download
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="alert('Preview functionality coming soon!')">
                            👁️ Preview
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        // Add content grid styles
        html += `
            <style>
                .content-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                    margin-top: 20px;
                }
                .content-item {
                    border: 1px solid var(--color-border);
                    border-radius: 8px;
                    padding: 16px;
                    background: var(--color-background);
                }
                .content-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 10px;
                }
                .content-header h4 {
                    margin: 0;
                    font-size: 16px;
                    color: var(--color-text);
                }
                .content-type {
                    background: var(--color-primary);
                    color: white;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                }
                .content-summary {
                    color: var(--color-text-secondary);
                    font-size: 14px;
                    margin-bottom: 15px;
                }
                .content-actions {
                    display: flex;
                    gap: 10px;
                }
                .btn-sm {
                    padding: 6px 12px;
                    font-size: 12px;
                }
            </style>
        `;

        container.innerHTML = html;
    }

    async loadCustomContent(container) {
        try {
            const response = await fetch(this.apiBase + '/content/history', {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) throw new Error('Failed to load content');

            const contents = await response.json();
            
            if (contents.length === 0) {
                container.innerHTML = '<div class="no-content">No custom content found. Start creating content to see it here!</div>';
                return;
            }

            let html = '<div class="content-list">';
            contents.slice(0, 10).forEach(item => {
                const date = new Date(item.created_at).toLocaleDateString();
                html += `
                    <div class="content-list-item">
                        <div class="content-info">
                            <h4>${item.title}</h4>
                            <div class="content-meta">
                                <span>📅 ${date}</span>
                                <span>🤖 ${item.llm_model}</span>
                                <span>🔢 ${item.tokens_used} tokens</span>
                            </div>
                        </div>
                        ${item.is_favorite ? '<div class="favorite-indicator">⭐</div>' : ''}
                    </div>
                `;
            });
            html += '</div>';

            container.innerHTML = html;
        } catch (error) {
            throw error;
        }
    }

    async loadBookmarks(container) {
        container.innerHTML = '<div class="coming-soon"><h3>Bookmarks feature coming soon!</h3><p>You\'ll be able to bookmark your favorite content and access it quickly from here.</p></div>';
    }

    // Enhanced notification system
    showNotification(message, type = 'info', duration = 3000) {
        // Remove existing notifications
        const existing = document.querySelectorAll('.dashboard-notification');
        existing.forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `dashboard-notification notification-${type}`;
        
        const colors = {
            success: '#2ed573',
            error: '#ff4757',
            warning: '#ffa502',
            info: '#3742fa'
        };

        notification.style.cssText = `
            position: fixed;
            top: 90px;
            right: 20px;
            background: ${colors[type]};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1001;
            font-size: 14px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
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
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }

    // Cleanup when leaving the page
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new DashboardManager();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.dashboardManager) {
        window.dashboardManager.destroy();
    }
});