// login.js - Frontend authentication handling for Multi-LLM Platform

class AuthManager {
    constructor() {
        this.apiBase = '/api';
        this.currentTab = 'login';
        this.categories = [];
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadCategories();
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.form-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Form submissions
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Password confirmation validation
        document.getElementById('register-confirm-password').addEventListener('input', () => {
            this.validatePasswordMatch();
        });

        // Real-time email validation
        document.getElementById('login-email').addEventListener('blur', () => {
            this.validateEmail('login');
        });

        document.getElementById('register-email').addEventListener('blur', () => {
            this.validateEmail('register');
        });

        // Password strength validation
        document.getElementById('register-password').addEventListener('input', () => {
            this.validatePasswordStrength();
        });

        // Forgot password link
        document.getElementById('forgot-password-link').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleForgotPassword();
        });

        // Cancel button on login
        const cancelBtn = document.getElementById('login-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                // Clear inputs and go back to login page
                document.getElementById('login-email').value = '';
                document.getElementById('login-password').value = '';
                this.clearErrors();
            });
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.form-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update form sections
        document.querySelectorAll('.form-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${tabName}-section`).classList.add('active');

        this.currentTab = tabName;
        this.clearNotification();
    }

    async loadCategories() {
        try {
            const response = await fetch(`${this.apiBase}/user-categories`);
            if (!response.ok) throw new Error('Failed to load categories');
            
            this.categories = await response.json();
            this.renderCategories();
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    }

    renderCategories() {
        const container = document.getElementById('category-selection');
        container.innerHTML = '';

        this.categories.forEach(category => {
            const categoryElement = document.createElement('div');
            categoryElement.className = 'category-item';
            categoryElement.innerHTML = `
                <input type="checkbox" id="category-${category.category_id}" 
                       value="${category.category_id}" name="categories">
                <label for="category-${category.category_id}">${category.category_name}</label>
            `;
            container.appendChild(categoryElement);
        });
    }

    async handleLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const rememberMe = document.getElementById('remember-me')?.checked;

        if (!this.validateEmail('login') || !password) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        this.setLoading('login', true);

        try {
            const response = await fetch(`${this.apiBase}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // Store token
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('userData', JSON.stringify({
                userId: data.userId,
                email: data.email,
                firstName: data.firstName,
                lastName: data.lastName,
                profileCompleted: data.profileCompleted,
                tokensRemaining: data.tokensRemaining,
                planName: data.planName
            }));

            // Remember me: persist a flag and optionally extend token lifetime via server in future
            if (rememberMe) {
                localStorage.setItem('rememberMe', 'true');
                localStorage.setItem('rememberedEmail', email);
            } else {
                localStorage.removeItem('rememberMe');
                localStorage.removeItem('rememberedEmail');
            }

            this.showNotification('Login successful! Redirecting...', 'success');

            // Redirect after successful login
            setTimeout(() => {
                if (data.profileCompleted) {
                    window.location.href = '/dashboard';
                } else {
                    window.location.href = '/profile-setup';
                }
            }, 1500);

        } catch (error) {
            this.showNotification(error.message, 'error');
        } finally {
            this.setLoading('login', false);
        }
    }

    async handleRegister() {
        const formData = this.getRegisterFormData();

        if (!this.validateRegisterForm(formData)) {
            return;
        }

        this.setLoading('register', true);

        try {
            const response = await fetch(`${this.apiBase}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            // Store token
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('userData', JSON.stringify({
                userId: data.userId,
                email: data.email,
                firstName: formData.firstName,
                lastName: formData.lastName,
                profileCompleted: false,
                tokensRemaining: 1000, // Default free tokens
                planName: 'Free'
            }));

            this.showNotification('Registration successful! Setting up your profile...', 'success');

            // Redirect to profile setup
            setTimeout(() => {
                window.location.href = '/profile-setup';
            }, 1500);

        } catch (error) {
            this.showNotification(error.message, 'error');
        } finally {
            this.setLoading('register', false);
        }
    }

    getRegisterFormData() {
        const selectedCategories = Array.from(
            document.querySelectorAll('input[name="categories"]:checked')
        ).map(cb => parseInt(cb.value));

        return {
            email: document.getElementById('register-email').value,
            password: document.getElementById('register-password').value,
            confirmPassword: document.getElementById('register-confirm-password').value,
            firstName: document.getElementById('register-first-name').value || null,
            lastName: document.getElementById('register-last-name').value || null,
            categories: selectedCategories,
            acceptedTerms: document.getElementById('register-terms').checked
        };
    }

    validateRegisterForm(formData) {
        let isValid = true;

        // Clear previous errors
        this.clearErrors();

        // Email validation
        if (!this.validateEmail('register')) {
            isValid = false;
        }

        // Password validation
        if (!formData.password || formData.password.length < 8) {
            this.showFieldError('register-password', 'Password must be at least 8 characters long');
            isValid = false;
        }

        // Password match validation
        if (formData.password !== formData.confirmPassword) {
            this.showFieldError('register-confirm-password', 'Passwords do not match');
            isValid = false;
        }

        // Terms acceptance
        if (!formData.acceptedTerms) {
            this.showFieldError('register-terms', 'You must accept the Terms & Conditions');
            isValid = false;
        }

        return isValid;
    }

    validateEmail(type) {
        const emailInput = document.getElementById(`${type}-email`);
        const email = emailInput.value;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email) {
            this.showFieldError(`${type}-email`, 'Email is required');
            return false;
        }

        if (!emailRegex.test(email)) {
            this.showFieldError(`${type}-email`, 'Please enter a valid email address');
            return false;
        }

        this.clearFieldError(`${type}-email`);
        return true;
    }

    validatePasswordMatch() {
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;

        if (confirmPassword && password !== confirmPassword) {
            this.showFieldError('register-confirm-password', 'Passwords do not match');
            return false;
        } else {
            this.clearFieldError('register-confirm-password');
            return true;
        }
    }

    validatePasswordStrength() {
        const password = document.getElementById('register-password').value;
        const errorElement = document.getElementById('register-password-error');

        if (!password) {
            this.clearFieldError('register-password');
            return;
        }

        const requirements = [
            { regex: /.{8,}/, text: 'At least 8 characters' },
            { regex: /[A-Z]/, text: 'One uppercase letter' },
            { regex: /[a-z]/, text: 'One lowercase letter' },
            { regex: /\d/, text: 'One number' },
            { regex: /[!@#$%^&*(),.?":{}|<>]/, text: 'One special character' }
        ];

        const unmet = requirements.filter(req => !req.regex.test(password));
        
        if (unmet.length > 0) {
            errorElement.textContent = `Password should include: ${unmet.map(r => r.text).join(', ')}`;
            errorElement.style.color = 'var(--color-warning)';
        } else {
            errorElement.textContent = 'Strong password!';
            errorElement.style.color = 'var(--color-success)';
        }
    }

    async handleForgotPassword() {
        const email = prompt('Please enter your email address:');
        if (!email) return;

        try {
            const response = await fetch(`${this.apiBase}/auth/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send reset email');
            }

            this.showNotification('Password reset instructions sent to your email', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    setLoading(type, loading) {
        const button = document.getElementById(`${type}-button`);
        const spinner = document.getElementById(`${type}-spinner`);

        if (loading) {
            button.disabled = true;
            button.style.opacity = '0.6';
            spinner.classList.add('show');
        } else {
            button.disabled = false;
            button.style.opacity = '1';
            spinner.classList.remove('show');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.clearNotification();
        }, 5000);
    }

    clearNotification() {
        const notification = document.getElementById('notification');
        notification.style.display = 'none';
    }

    showFieldError(fieldId, message) {
        const errorElement = document.getElementById(`${fieldId}-error`);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.color = 'var(--color-error)';
        }
    }

    clearFieldError(fieldId) {
        const errorElement = document.getElementById(`${fieldId}-error`);
        if (errorElement) {
            errorElement.textContent = '';
        }
    }

    clearErrors() {
        document.querySelectorAll('.form-error').forEach(element => {
            element.textContent = '';
        });
    }

    // Utility function to check if user is authenticated
    static isAuthenticated() {
        const token = localStorage.getItem('authToken');
        if (!token) return false;

        try {
            // Basic JWT payload check (you might want to verify with server)
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp * 1000 > Date.now();
        } catch {
            return false;
        }
    }

    // Utility function to get user data
    static getUserData() {
        const userData = localStorage.getItem('userData');
        return userData ? JSON.parse(userData) : null;
    }

    // Utility function to logout
    static logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        window.location.href = '/login';
    }

    // Utility function to get auth headers
    static getAuthHeaders() {
        const token = localStorage.getItem('authToken');
        return token ? {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        } : {
            'Content-Type': 'application/json'
        };
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname;

    // On profile setup page, don't redirect back to itself (prevents refresh loop)
    if (currentPath === '/profile-setup') {
        if (AuthManager.isAuthenticated()) {
            const userData = AuthManager.getUserData();
            if (userData && userData.profileCompleted) {
                window.location.href = '/dashboard';
                return;
            }
        }
        // Do not initialize the full AuthManager on profile setup page
        return;
    }

    // Check if user is already authenticated on other pages (e.g., /login)
    if (AuthManager.isAuthenticated()) {
        const userData = AuthManager.getUserData();
        if (userData && userData.profileCompleted) {
            window.location.href = '/dashboard';
        } else {
            window.location.href = '/profile-setup';
        }
        return;
    }

    // Initialize authentication manager (login/register page)
    const mgr = new AuthManager();

    // Prefill email if rememberMe was set previously
    try {
        const remembered = localStorage.getItem('rememberMe') === 'true';
        const savedEmail = localStorage.getItem('rememberedEmail');
        if (remembered && savedEmail) {
            const emailInput = document.getElementById('login-email');
            const rememberBox = document.getElementById('remember-me');
            if (emailInput) emailInput.value = savedEmail;
            if (rememberBox) rememberBox.checked = true;
        }
    } catch {}
});

// Export for use in other modules
window.AuthManager = AuthManager;