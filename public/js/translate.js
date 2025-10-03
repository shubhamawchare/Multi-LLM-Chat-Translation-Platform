// translate.js - Main Translator Application Controller

class TranslatorApp {
    constructor() {
        this.ui = null;
        this.llmManager = null;
        this.isInitialized = false;
        this.translationHistory = [];
        this.currentTranslation = null;
        this.init();
    }

    async init() {
        try {
            console.log('Initializing AI Language Translator...');
            
            // Initialize UI Manager
            this.ui = new TranslateUIManager();
            console.log('Translate UI Manager initialized');

            // Initialize LLM Providers Manager
            this.llmManager = new LLMProvidersManager();
            console.log('LLM Manager initialized');

            // Setup event listeners
            this.setupEventListeners();

            // Initialize providers and languages
            await this.initializeProviders();
            await this.loadLanguages();

            // Load translation history from localStorage
            this.loadTranslationHistory();

            this.isInitialized = true;
            console.log('AI Language Translator initialized successfully');
        } catch (error) {
            console.error('Failed to initialize translator:', error);
            this.showError('Failed to initialize the translator. Please refresh the page and try again.');
        }
    }

    async initializeProviders() {
        try {
            await this.llmManager.initialize();
            
            // Populate model dropdown
            const availableModels = this.llmManager.getAvailableModels();
            const currentModel = this.llmManager.getCurrentModel();
            
            this.ui.populateModelDropdown(
                availableModels,
                currentModel?.provider,
                currentModel?.modelId
            );

            // Update model info
            if (currentModel) {
                this.ui.setCurrentModel(`${currentModel.modelName}`, currentModel.provider);
            } else {
                this.ui.setCurrentModel('No models available', '');
                this.ui.showError('No AI models are currently available. Please check your API keys and internet connection.');
            }
        } catch (error) {
            console.error('Failed to initialize providers:', error);
            this.ui.setCurrentModel('Failed to connect to AI services', '');
            throw error;
        }
    }

    async loadLanguages() {
        try {
            const response = await fetch('/api/languages');
            if (!response.ok) throw new Error('Failed to fetch languages');
            
            const languages = await response.json();
            this.ui.populateLanguageDropdowns(languages);
        } catch (error) {
            console.error('Failed to load languages:', error);
            this.showError('Failed to load supported languages');
        }
    }

    setupEventListeners() {
        // Model selection
        document.addEventListener('modelChanged', (event) => {
            this.handleModelChange(event.detail);
        });

        // Translation request
        document.addEventListener('translateRequest', (event) => {
            this.handleTranslateRequest(event.detail);
        });

        // Language swap
        document.addEventListener('swapLanguages', () => {
            this.handleLanguageSwap();
        });

        // Text changes for auto-detection
        document.addEventListener('sourceTextChange', (event) => {
            this.handleSourceTextChange(event.detail.text);
        });

        // Copy translation
        document.addEventListener('copyTranslation', () => {
            this.handleCopyTranslation();
        });

        // Clear source text
        document.addEventListener('clearSource', () => {
            this.handleClearSource();
        });

        // Paste text
        document.addEventListener('pasteText', () => {
            this.handlePasteText();
        });

        // Clear translation history
        document.addEventListener('clearHistory', () => {
            this.handleClearHistory();
        });

        // Handle online/offline events
        window.addEventListener('online', () => {
            this.ui.showSuccess('Connection restored');
            this.checkConnectionStatus();
        });

        window.addEventListener('offline', () => {
            this.ui.showError('Connection lost. Translation features may not work properly.');
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            this.handleKeyboardShortcuts(event);
        });
    }

    async handleModelChange(modelData) {
        const { provider, modelId, modelName } = modelData;
        try {
            this.llmManager.setModel(provider, modelId);
            this.ui.setCurrentModel(modelName, provider);
            console.log(`Successfully switched to ${provider}/${modelId} for translation`);
        } catch (error) {
            console.error('Failed to switch model:', error);
            this.ui.showError(this.llmManager.handleAPIError(error));
        }
    }

    async handleTranslateRequest(requestData) {
        if (!this.isInitialized) {
            this.ui.showError('Translator is still initializing. Please wait.');
            return;
        }

        const { text, sourceLang, targetLang } = requestData;

        if (!text || !text.trim()) {
            this.ui.showError('Please enter text to translate');
            return;
        }

        if (!targetLang) {
            this.ui.showError('Please select a target language');
            return;
        }

        const currentModel = this.llmManager.getCurrentModel();
        if (!currentModel) {
            this.ui.showError('Please select an AI model before translating');
            return;
        }

        try {
            // Show loading state
            this.ui.setTranslating(true);
            this.ui.clearTargetText();

            // Perform translation
            const result = await this.performTranslation(text, sourceLang, targetLang, currentModel);

            // Update UI with result
            this.ui.setTargetText(result.translatedText);
            this.ui.setTranslationInfo(currentModel.modelName);
            this.ui.updateTargetCharCount(result.translatedText.length);

            // Save to history
            this.addToHistory({
                sourceText: text,
                translatedText: result.translatedText,
                sourceLang: result.sourceLang,
                targetLang: result.targetLang,
                model: currentModel.modelName,
                provider: currentModel.provider,
                timestamp: new Date().toISOString()
            });

            // Update detected language if auto-detect was used
            if (sourceLang === 'auto' && result.sourceLang !== 'auto-detected') {
                this.ui.updateDetectedLanguage(result.sourceLang);
            }

            this.currentTranslation = result;
            console.log('Translation completed successfully');

        } catch (error) {
            console.error('Translation failed:', error);
            this.ui.showError(this.getTranslationErrorMessage(error));
        } finally {
            this.ui.setTranslating(false);
        }
    }

    async performTranslation(text, sourceLang, targetLang, model) {
        const response = await fetch('/api/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                provider: model.provider,
                model: model.modelId,
                text: text.trim(),
                sourceLang,
                targetLang
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    async handleSourceTextChange(text) {
        this.ui.updateSourceCharCount(text.length);

        // Auto-detect language if in auto-detect mode and text is present
        const sourceLang = this.ui.getSourceLanguage();
        if (sourceLang === 'auto' && text.trim() && text.length > 10) {
            this.debounceDetectLanguage(text.trim());
        } else if (sourceLang === 'auto' && !text.trim()) {
            this.ui.clearDetectedLanguage();
        }
    }

    debounceDetectLanguage = this.debounce(async (text) => {
        await this.detectLanguage(text);
    }, 1000);

    async detectLanguage(text) {
        const currentModel = this.llmManager.getCurrentModel();
        if (!currentModel) return;

        try {
            const response = await fetch('/api/detect-language', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    provider: currentModel.provider,
                    model: currentModel.modelId,
                    text: text
                })
            });

            if (response.ok) {
                const result = await response.json();
                this.ui.updateDetectedLanguage(result.languageCode || 'unknown');
            }
        } catch (error) {
            console.error('Language detection failed:', error);
        }
    }

    handleLanguageSwap() {
        const sourceText = this.ui.getSourceText();
        const targetText = this.ui.getTargetText();
        
        // Only swap if we have a completed translation
        if (targetText && this.currentTranslation) {
            this.ui.setSourceText(targetText);
            this.ui.setTargetText('');
            this.ui.swapLanguageSelections();
            this.ui.clearTranslationInfo();
            this.ui.clearDetectedLanguage();
            this.currentTranslation = null;
        } else {
            this.ui.swapLanguageSelections();
        }
    }

    async handleCopyTranslation() {
        const targetText = this.ui.getTargetText();
        if (!targetText) {
            this.ui.showError('No translation to copy');
            return;
        }

        try {
            await navigator.clipboard.writeText(targetText);
            this.ui.showSuccess('Translation copied to clipboard');
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            this.ui.showError('Failed to copy to clipboard');
        }
    }

    handleClearSource() {
        this.ui.clearSourceText();
        this.ui.clearTargetText();
        this.ui.clearDetectedLanguage();
        this.ui.clearTranslationInfo();
        this.currentTranslation = null;
    }

    async handlePasteText() {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                this.ui.setSourceText(text);
            } else {
                this.ui.showError('Clipboard is empty');
            }
        } catch (error) {
            console.error('Failed to paste from clipboard:', error);
            this.ui.showError('Failed to access clipboard');
        }
    }

    handleClearHistory() {
        this.translationHistory = [];
        this.saveTranslationHistory();
        this.ui.updateTranslationHistory([]);
        this.ui.showSuccess('Translation history cleared');
    }

    handleKeyboardShortcuts(event) {
        // Don't handle shortcuts when typing in input fields
        if (event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT') {
            return;
        }

        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 'Enter':
                    event.preventDefault();
                    this.ui.focusSourceText();
                    break;
                case 't':
                    event.preventDefault();
                    this.ui.triggerTranslation();
                    break;
                case 'c':
                    if (event.shiftKey) {
                        event.preventDefault();
                        this.handleCopyTranslation();
                    }
                    break;
                case 'v':
                    if (event.shiftKey) {
                        event.preventDefault();
                        this.handlePasteText();
                    }
                    break;
                case 's':
                    event.preventDefault();
                    this.handleLanguageSwap();
                    break;
            }
        }

        if (event.key === 'Escape') {
            this.ui.closeModelDropdown();
        }
    }

    addToHistory(translation) {
        this.translationHistory.unshift(translation);
        
        // Keep only last 50 translations
        if (this.translationHistory.length > 50) {
            this.translationHistory = this.translationHistory.slice(0, 50);
        }

        this.saveTranslationHistory();
        this.ui.updateTranslationHistory(this.translationHistory.slice(0, 10)); // Show only 10 in UI
    }

    loadTranslationHistory() {
        try {
            const saved = localStorage.getItem('translationHistory');
            if (saved) {
                this.translationHistory = JSON.parse(saved);
                this.ui.updateTranslationHistory(this.translationHistory.slice(0, 10));
            }
        } catch (error) {
            console.error('Failed to load translation history:', error);
        }
    }

    saveTranslationHistory() {
        try {
            localStorage.setItem('translationHistory', JSON.stringify(this.translationHistory));
        } catch (error) {
            console.error('Failed to save translation history:', error);
        }
    }

    async checkConnectionStatus() {
        if (!this.llmManager) return;

        try {
            await this.llmManager.checkHealth();
            
            // Re-populate model dropdown in case availability changed
            const availableModels = this.llmManager.getAvailableModels();
            const currentModel = this.llmManager.getCurrentModel();
            
            this.ui.populateModelDropdown(
                availableModels,
                currentModel?.provider,
                currentModel?.modelId
            );

            // Check if current model is still available
            if (currentModel && !currentModel.available) {
                this.ui.showError(`Current model ${currentModel.modelName} is no longer available`);
                this.ui.setCurrentModel('Please select another model', '');
            }
        } catch (error) {
            console.error('Connection check failed:', error);
        }
    }

    getTranslationErrorMessage(error) {
        if (error.message.includes('HTTP 401')) {
            return 'Invalid API key. Please check your credentials.';
        } else if (error.message.includes('HTTP 403')) {
            return 'Access denied. Please check your API permissions.';
        } else if (error.message.includes('HTTP 429')) {
            return 'Rate limit exceeded. Please try again later.';
        } else if (error.message.includes('HTTP 500')) {
            return 'Server error. Please try again later.';
        } else if (error.message.includes('Failed to fetch')) {
            return 'Network error. Please check your connection.';
        } else {
            return error.message || 'Translation failed. Please try again.';
        }
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    showError(message) {
        if (this.ui) {
            this.ui.showError(message);
        } else {
            alert(`Error: ${message}`);
        }
    }

    // Public API methods
    getCurrentModel() {
        return this.llmManager?.getCurrentModel();
    }

    getAvailableModels() {
        return this.llmManager?.getAvailableModels() || {};
    }

    getTranslationHistory() {
        return [...this.translationHistory];
    }

    clearTranslationHistory() {
        this.handleClearHistory();
    }
}

// Global error handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    const message = event.reason?.message || 'An unexpected error occurred';
    
    if (window.translatorApp?.ui) {
        window.translatorApp.ui.showError(message);
    } else {
        alert(`Error: ${message}`);
    }
    
    event.preventDefault();
});

// Initialize the translator when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing AI Language Translator...');
    try {
        window.translatorApp = new TranslatorApp();
    } catch (error) {
        console.error('Failed to initialize translator:', error);
        alert('The translator failed to start properly. Please refresh the page.');
    }
});