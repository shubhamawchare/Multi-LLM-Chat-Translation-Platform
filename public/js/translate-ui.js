// translate-ui.js -- UI Manager for Language Translator

class TranslateUIManager {
    constructor() {
        this.elements = {
            // Model selection
            modelBtn: document.getElementById('modelBtn'),
            modelDropdown: document.getElementById('modelDropdown'),
            currentModel: document.getElementById('currentModel'),

            // Language selection
            sourceLangSelect: document.getElementById('sourceLangSelect'),
            targetLangSelect: document.getElementById('targetLangSelect'),
            swapBtn: document.getElementById('swapBtn'),
            detectedLang: document.getElementById('detectedLang'),

            // Text areas
            sourceText: document.getElementById('sourceText'),
            targetText: document.getElementById('targetText'),
            sourceCharCount: document.getElementById('sourceCharCount'),
            targetCharCount: document.getElementById('targetCharCount'),

            // Buttons
            translateBtn: document.getElementById('translateBtn'),
            translateText: document.querySelector('.translate-text'),
            loadingSpinner: document.querySelector('.loading-spinner'),
            clearSourceBtn: document.getElementById('clearSourceBtn'),
            copyBtn: document.getElementById('copyBtn'),
            pasteBtn: document.getElementById('pasteBtn'),

            // Info displays
            translationInfo: document.getElementById('translationInfo'),
            usedModel: document.getElementById('usedModel'),

            // History
            translationHistory: document.getElementById('translationHistory'),
            historyList: document.getElementById('historyList'),
            clearHistoryBtn: document.getElementById('clearHistoryBtn'),

            // Notifications
            notifications: document.getElementById('notifications')
        };

        this.isDropdownOpen = false;
        this.isTranslating = false;
        this.languages = {};
        this.setupEvents();
    }

    setupEvents() {
        // Model dropdown
        if (this.elements.modelBtn) {
            this.elements.modelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleModelDropdown();
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isDropdownOpen && 
                !this.elements.modelDropdown.contains(e.target) &&
                !this.elements.modelBtn.contains(e.target)) {
                this.closeModelDropdown();
            }
        });

        // Source text events
        if (this.elements.sourceText) {
            this.elements.sourceText.addEventListener('input', () => {
                const text = this.elements.sourceText.value;
                this.updateSourceCharCount(text.length);
                this.autoResizeTextarea(this.elements.sourceText);
                
                // Dispatch custom event for text change
                document.dispatchEvent(new CustomEvent('sourceTextChange', {
                    detail: { text }
                }));
            });

            this.elements.sourceText.addEventListener('paste', () => {
                setTimeout(() => {
                    const text = this.elements.sourceText.value;
                    this.updateSourceCharCount(text.length);
                    document.dispatchEvent(new CustomEvent('sourceTextChange', {
                        detail: { text }
                    }));
                }, 10);
            });
        }

        // Target text events
        if (this.elements.targetText) {
            this.elements.targetText.addEventListener('input', () => {
                this.updateTargetCharCount(this.elements.targetText.value.length);
            });
        }

        // Translate button
        if (this.elements.translateBtn) {
            this.elements.translateBtn.addEventListener('click', () => {
                this.triggerTranslation();
            });
        }

        // Language swap
        if (this.elements.swapBtn) {
            this.elements.swapBtn.addEventListener('click', () => {
                document.dispatchEvent(new CustomEvent('swapLanguages'));
            });
        }

        // Action buttons
        if (this.elements.clearSourceBtn) {
            this.elements.clearSourceBtn.addEventListener('click', () => {
                document.dispatchEvent(new CustomEvent('clearSource'));
            });
        }

        if (this.elements.copyBtn) {
            this.elements.copyBtn.addEventListener('click', () => {
                document.dispatchEvent(new CustomEvent('copyTranslation'));
            });
        }

        if (this.elements.pasteBtn) {
            this.elements.pasteBtn.addEventListener('click', () => {
                document.dispatchEvent(new CustomEvent('pasteText'));
            });
        }

        if (this.elements.clearHistoryBtn) {
            this.elements.clearHistoryBtn.addEventListener('click', () => {
                document.dispatchEvent(new CustomEvent('clearHistory'));
            });
        }

        // Keyboard shortcuts for translation
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                if (e.target === this.elements.sourceText) {
                    e.preventDefault();
                    this.triggerTranslation();
                }
            }
        });

        // Language selection changes
        if (this.elements.sourceLangSelect) {
            this.elements.sourceLangSelect.addEventListener('change', () => {
                if (this.elements.sourceLangSelect.value !== 'auto') {
                    this.clearDetectedLanguage();
                }
            });
        }
    }

    async toggleModelDropdown() {
        if (this.isDropdownOpen) {
            return this.closeModelDropdown();
        }
        
        await this.loadModels();
        this.elements.modelDropdown.classList.add('show');
        this.isDropdownOpen = true;
    }

    closeModelDropdown() {
        this.elements.modelDropdown.classList.remove('show');
        this.isDropdownOpen = false;
    }

    async loadModels() {
        try {
            const response = await fetch('/api/models');
            if (!response.ok) throw new Error('Failed to fetch models');
            
            const models = await response.json();
            this.populateModelDropdown(models);
        } catch (error) {
            console.error('Error loading models:', error);
            this.elements.modelDropdown.innerHTML = '<div class="dropdown-error">Failed to load models</div>';
        }
    }

    populateModelDropdown(models, currentProvider = null, currentModel = null) {
        if (!this.elements.modelDropdown) return;

        let html = '';
        const providers = Object.keys(models);

        if (providers.length === 0) {
            html = '<div class="dropdown-error">No models available</div>';
        } else {
            providers.forEach(provider => {
                const providerModels = models[provider];
                const providerName = this.getProviderDisplayName(provider);
                
                html += `
                    <div class="model-group">
                        <div class="model-group-title">${providerName}</div>
                `;
                
                Object.entries(providerModels).forEach(([modelId, modelName]) => {
                    const isActive = currentProvider === provider && currentModel === modelId;
                    html += `
                        <button class="model-item ${isActive ? 'active' : ''}" 
                                data-provider="${provider}" 
                                data-model-id="${modelId}"
                                data-model-name="${modelName}">
                            <div class="model-icon ${provider}">
                                ${this.getProviderIcon(provider)}
                            </div>
                            <div class="model-details">
                                <div class="model-name">${modelName}</div>
                                <div class="model-description">${this.getModelDescription(provider, modelId)}</div>
                            </div>
                        </button>
                    `;
                });
                
                html += '</div>';
            });
        }

        this.elements.modelDropdown.innerHTML = html;

        // Add click handlers to model items
        this.elements.modelDropdown.querySelectorAll('.model-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const provider = item.dataset.provider;
                const modelId = item.dataset.modelId;
                const modelName = item.dataset.modelName;

                // Update active state
                this.elements.modelDropdown.querySelectorAll('.model-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                // Close dropdown
                this.closeModelDropdown();

                // Dispatch model change event
                document.dispatchEvent(new CustomEvent('modelChanged', {
                    detail: { provider, modelId, modelName }
                }));
            });
        });
    }

    populateLanguageDropdowns(languages) {
        this.languages = languages;

        // Populate source language dropdown (with auto-detect)
        if (this.elements.sourceLangSelect) {
            let sourceHtml = '<option value="auto">Detect Language</option>';
            Object.entries(languages).forEach(([code, name]) => {
                sourceHtml += `<option value="${code}">${name}</option>`;
            });
            this.elements.sourceLangSelect.innerHTML = sourceHtml;
        }

        // Populate target language dropdown
        if (this.elements.targetLangSelect) {
            let targetHtml = '';
            Object.entries(languages).forEach(([code, name]) => {
                const selected = code === 'en' ? 'selected' : '';
                targetHtml += `<option value="${code}" ${selected}>${name}</option>`;
            });
            this.elements.targetLangSelect.innerHTML = targetHtml;
        }
    }

    triggerTranslation() {
        if (this.isTranslating) return;

        const text = this.getSourceText();
        const sourceLang = this.getSourceLanguage();
        const targetLang = this.getTargetLanguage();

        if (!text.trim()) {
            this.showError('Please enter text to translate');
            return;
        }

        if (sourceLang === targetLang && sourceLang !== 'auto') {
            this.showError('Source and target languages cannot be the same');
            return;
        }

        document.dispatchEvent(new CustomEvent('translateRequest', {
            detail: { text, sourceLang, targetLang }
        }));
    }

    setTranslating(isTranslating) {
        this.isTranslating = isTranslating;
        
        if (this.elements.translateBtn) {
            this.elements.translateBtn.disabled = isTranslating;
        }
        
        if (this.elements.translateText && this.elements.loadingSpinner) {
            if (isTranslating) {
                this.elements.translateText.style.display = 'none';
                this.elements.loadingSpinner.style.display = 'inline-flex';
            } else {
                this.elements.translateText.style.display = 'inline';
                this.elements.loadingSpinner.style.display = 'none';
            }
        }
    }

    setCurrentModel(modelName, provider = '') {
        if (this.elements.currentModel) {
            const providerIcon = provider ? this.getProviderIcon(provider) : '';
            this.elements.currentModel.innerHTML = `${providerIcon} ${modelName}`;
        }
    }

    swapLanguageSelections() {
        if (!this.elements.sourceLangSelect || !this.elements.targetLangSelect) return;

        const sourceValue = this.elements.sourceLangSelect.value;
        const targetValue = this.elements.targetLangSelect.value;

        // Don't swap if source is auto-detect
        if (sourceValue === 'auto') {
            this.showInfo('Cannot swap when using auto-detect. Please select a specific source language.');
            return;
        }

        this.elements.sourceLangSelect.value = targetValue;
        this.elements.targetLangSelect.value = sourceValue;
    }

    updateDetectedLanguage(languageCode) {
        if (!this.elements.detectedLang) return;

        const languageName = this.languages[languageCode] || languageCode;
        const detectValue = this.elements.detectedLang.querySelector('.detect-value');
        
        if (detectValue && languageCode && languageCode !== 'unknown') {
            detectValue.textContent = languageName;
            this.elements.detectedLang.style.display = 'block';
        } else {
            this.clearDetectedLanguage();
        }
    }

    clearDetectedLanguage() {
        if (this.elements.detectedLang) {
            this.elements.detectedLang.style.display = 'none';
        }
    }

    setTranslationInfo(modelName) {
        if (this.elements.translationInfo && this.elements.usedModel) {
            this.elements.usedModel.textContent = modelName;
            this.elements.translationInfo.style.display = 'block';
        }
    }

    clearTranslationInfo() {
        if (this.elements.translationInfo) {
            this.elements.translationInfo.style.display = 'none';
        }
    }

    updateSourceCharCount(count) {
        if (this.elements.sourceCharCount) {
            this.elements.sourceCharCount.textContent = count;
        }
    }

    updateTargetCharCount(count) {
        if (this.elements.targetCharCount) {
            this.elements.targetCharCount.textContent = count;
        }
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }

    // Text manipulation methods
    getSourceText() {
        return this.elements.sourceText ? this.elements.sourceText.value : '';
    }

    setSourceText(text) {
        if (this.elements.sourceText) {
            this.elements.sourceText.value = text;
            this.updateSourceCharCount(text.length);
            this.autoResizeTextarea(this.elements.sourceText);
        }
    }

    getTargetText() {
        return this.elements.targetText ? this.elements.targetText.value : '';
    }

    setTargetText(text) {
        if (this.elements.targetText) {
            this.elements.targetText.value = text;
            this.updateTargetCharCount(text.length);
            this.autoResizeTextarea(this.elements.targetText);
        }
    }

    clearSourceText() {
        this.setSourceText('');
        this.focusSourceText();
    }

    clearTargetText() {
        this.setTargetText('');
    }

    getSourceLanguage() {
        return this.elements.sourceLangSelect ? this.elements.sourceLangSelect.value : 'auto';
    }

    getTargetLanguage() {
        return this.elements.targetLangSelect ? this.elements.targetLangSelect.value : 'en';
    }

    focusSourceText() {
        if (this.elements.sourceText) {
            this.elements.sourceText.focus();
        }
    }

    // Translation history methods
    updateTranslationHistory(history) {
        if (!this.elements.historyList) return;

        if (history.length === 0) {
            if (this.elements.translationHistory) {
                this.elements.translationHistory.style.display = 'none';
            }
            return;
        }

        if (this.elements.translationHistory) {
            this.elements.translationHistory.style.display = 'block';
        }

        let html = '';
        history.forEach((item, index) => {
            const sourceLanguage = this.languages[item.sourceLang] || item.sourceLang;
            const targetLanguage = this.languages[item.targetLang] || item.targetLang;
            const date = new Date(item.timestamp).toLocaleString();

            html += `
                <div class="history-item" data-index="${index}">
                    <div class="history-content">
                        <div class="history-text">
                            <div class="history-source">${this.truncateText(item.sourceText, 50)}</div>
                            <div class="history-arrow">→</div>
                            <div class="history-target">${this.truncateText(item.translatedText, 50)}</div>
                        </div>
                        <div class="history-meta">
                            <span class="history-languages">${sourceLanguage} → ${targetLanguage}</span>
                            <span class="history-model">${item.model}</span>
                            <span class="history-date">${date}</span>
                        </div>
                    </div>
                    <div class="history-actions">
                        <button class="history-btn reuse-btn" title="Reuse translation">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                                <path d="M21 3v5h-5"/>
                                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                                <path d="M3 21v-5h5"/>
                            </svg>
                        </button>
                        <button class="history-btn copy-btn" title="Copy translation">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        });

        this.elements.historyList.innerHTML = html;

        // Add event handlers for history items
        this.elements.historyList.querySelectorAll('.reuse-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                const item = history[index];
                this.setSourceText(item.translatedText);
                this.setTargetText('');
                // Swap languages
                if (this.elements.sourceLangSelect && this.elements.targetLangSelect) {
                    this.elements.sourceLangSelect.value = item.targetLang;
                    this.elements.targetLangSelect.value = item.sourceLang;
                }
            });
        });

        this.elements.historyList.querySelectorAll('.copy-btn').forEach((btn, index) => {
            btn.addEventListener('click', async () => {
                const item = history[index];
                try {
                    await navigator.clipboard.writeText(item.translatedText);
                    this.showSuccess('Translation copied to clipboard');
                } catch (error) {
                    this.showError('Failed to copy to clipboard');
                }
            });
        });
    }

    // Notification methods
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showInfo(message) {
        this.showNotification(message, 'info');
    }

    showNotification(message, type = 'info') {
        if (!this.elements.notifications) return;

        const notification = document.createElement('div');
        notification.className = `notification notification--${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close">×</button>
            </div>
        `;

        this.elements.notifications.appendChild(notification);

        // Add close handler
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);

        // Animate in
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
    }

    // Utility methods
    getProviderDisplayName(provider) {
        const names = {
            'openai': 'OpenAI',
            'anthropic': 'Anthropic',
            'deepseek': 'Deepseek AI'
        };
        return names[provider] || provider;
    }

    getProviderIcon(provider) {
        const icons = {
            'openai': '🤖',
            'anthropic': '🧠',
            'deepseek': '🌊'
        };
        return icons[provider] || '🤖';
    }

    getModelDescription(provider, modelId) {
        const descriptions = {
            'openai': {
                'gpt-4': 'Most capable model',
                'gpt-4-turbo': 'Fast and capable',
                'gpt-3.5-turbo': 'Fast and efficient'
            },
            'anthropic': {
                'claude-3-5-sonnet-20241022': 'Latest and most capable',
                'claude-3-haiku-20240307': 'Fast and light',
                'claude-3-sonnet-20240229': 'Balanced performance'
            },
            'deepseek': {
                'deepseek-chat': 'General purpose',
                'deepseek-coder': 'Code-focused'
            }
        };
        return descriptions[provider]?.[modelId] || 'AI language model';
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
}