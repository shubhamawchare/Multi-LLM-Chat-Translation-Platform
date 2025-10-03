// main.js -- Enhanced Main Application Controller for Multi-LLM Chat

class MultiLLMChatApp {
  constructor() {
    this.ui = null;
    this.llmManager = null;
    this.isInitialized = false;
    this.currentMessageId = null;
    this.capabilities = ['chat', 'image', 'design', 'translation', 'web-search'];
    this.init();
  }

  async init() {
    try {
      console.log('Initializing Enhanced Multi-LLM Chat App...');
      
      // Initialize UI Manager
      this.ui = new UIManager();
      console.log('UI Manager initialized');
      
      // Initialize LLM Providers Manager
      this.llmManager = new LLMProvidersManager();
      console.log('LLM Manager initialized');
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Initialize providers
      await this.initializeProviders();
      
      // Setup capability tabs
      this.setupCapabilityTabs();
      
      this.isInitialized = true;
      console.log('Enhanced Multi-LLM Chat App initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showError('Failed to initialize the application. Please refresh the page and try again.');
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
        this.ui.setModelInfo(`Ready to chat with ${currentModel.modelName}`);
      } else {
        this.ui.setModelInfo('No models available. Please check your API configuration.');
        this.ui.showError('No AI models are currently available. Please check your API keys and internet connection.');
      }

    } catch (error) {
      console.error('Failed to initialize providers:', error);
      this.ui.setModelInfo('Failed to connect to AI services');
      throw error;
    }
  }

  setupCapabilityTabs() {
    // Create capability tabs in the UI
    const capabilityTabsContainer = document.getElementById('capabilityTabs');
    if (!capabilityTabsContainer) return;

    const capabilityLabels = {
      chat: '💬 Chat',
      image: '🎨 Image',
      design: '🎯 Design',
      translation: '🌐 Translate',
      'web-search': '🔍 Search'
    };

    let tabsHtml = '';
    this.capabilities.forEach(capability => {
      const activeClass = capability === 'chat' ? 'active' : '';
      tabsHtml += `
        <button class="capability-tab ${activeClass}" 
                data-capability="${capability}">
          ${capabilityLabels[capability] || capability}
        </button>
      `;
    });

    capabilityTabsContainer.innerHTML = tabsHtml;
  }

  setupEventListeners() {
    // Model selection
    document.addEventListener('modelChanged', (event) => {
      this.handleModelChange(event.detail);
    });

    // Send message (chat)
    document.addEventListener('sendMessage', (event) => {
      this.handleSendMessage(event.detail);
    });

    // Generate image
    document.addEventListener('generateImage', (event) => {
      this.handleGenerateImage(event.detail);
    });

    // Create design
    document.addEventListener('createDesign', (event) => {
      this.handleCreateDesign(event.detail);
    });

    // Translate text
    document.addEventListener('translateText', (event) => {
      this.handleTranslateText(event.detail);
    });

    // Web search
    document.addEventListener('webSearch', (event) => {
      this.handleWebSearch(event.detail);
    });

    // Handle window focus for potential reconnection
    window.addEventListener('focus', () => {
      this.checkConnectionStatus();
    });

    // Handle online/offline events
    window.addEventListener('online', () => {
      this.ui.showSuccess('Connection restored');
      this.checkConnectionStatus();
    });

    window.addEventListener('offline', () => {
      this.ui.showError('Connection lost. Some features may not work properly.');
    });

    // Handle beforeunload for unsaved data warning
    window.addEventListener('beforeunload', (event) => {
      if (this.ui?.getMessageCount() > 0) {
        event.preventDefault();
        event.returnValue = 'You have unsaved conversation history. Are you sure you want to leave?';
      }
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
      this.ui.setModelInfo(`Ready to use ${modelName}`);
      
      // Update capability availability based on selected model
      this.updateCapabilityAvailability(provider);
      
      console.log(`Successfully switched to ${provider}/${modelId}`);
      
    } catch (error) {
      console.error('Failed to switch model:', error);
      this.ui.showError(this.llmManager.handleAPIError(error));
    }
  }

  updateCapabilityAvailability(provider) {
    const capabilities = this.llmManager.getProviderCapabilities(provider);
    
    // Enable/disable capability tabs based on provider
    const tabs = document.querySelectorAll('.capability-tab');
    tabs.forEach(tab => {
      const capability = tab.dataset.capability;
      if (capabilities.includes(capability)) {
        tab.classList.remove('disabled');
        tab.disabled = false;
      } else {
        tab.classList.add('disabled');
        tab.disabled = true;
      }
    });
  }

  async handleSendMessage(detail) {
    if (!this.isInitialized) {
      this.ui.showError('Application is still initializing. Please wait.');
      return;
    }

    const message = detail.message || detail;
    if (!message || !message.trim()) {
      this.ui.showError('Please enter a message');
      return;
    }

    const currentModel = this.llmManager.getCurrentModel();
    if (!currentModel) {
      this.ui.showError('Please select a model before sending a message');
      return;
    }

    try {
      await this.executeAIRequest('chat', message, currentModel);
    } catch (error) {
      console.error('Unexpected error in handleSendMessage:', error);
      this.ui.showError('An unexpected error occurred. Please try again.');
    }
  }

  async handleGenerateImage(detail) {
    if (!this.isInitialized) {
      this.ui.showError('Application is still initializing. Please wait.');
      return;
    }

    const prompt = detail.message || detail;
    if (!prompt || !prompt.trim()) {
      this.ui.showError('Please describe the image you want to generate');
      return;
    }

    const currentModel = this.llmManager.getCurrentModel();
    if (!currentModel) {
      this.ui.showError('Please select a model before generating images');
      return;
    }

    // Check if current model supports image generation
    if (!this.llmManager.supportsCapability('image-generation')) {
      this.ui.showError('Current model does not support image generation. Please switch to OpenAI or Adobe AI.');
      return;
    }

    try {
      await this.executeAIRequest('image', prompt, currentModel);
    } catch (error) {
      console.error('Error generating image:', error);
      this.ui.showError('Failed to generate image. Please try again.');
    }
  }

  async handleCreateDesign(detail) {
    if (!this.isInitialized) {
      this.ui.showError('Application is still initializing. Please wait.');
      return;
    }

    const description = detail.message || detail;
    if (!description || !description.trim()) {
      this.ui.showError('Please describe the design you want to create');
      return;
    }

    const currentModel = this.llmManager.getCurrentModel();
    if (!currentModel || currentModel.provider !== 'canva') {
      this.ui.showError('Please select a Canva model for design creation');
      return;
    }

    try {
      await this.executeAIRequest('design', description, currentModel);
    } catch (error) {
      console.error('Error creating design:', error);
      this.ui.showError('Failed to create design. Please try again.');
    }
  }

  async handleTranslateText(detail) {
    // Implementation for translation
    this.ui.showError('Translation feature coming soon! Use the translate page for now.');
  }

  async handleWebSearch(detail) {
    const query = detail.message || detail;
    if (!query || !query.trim()) {
      this.ui.showError('Please enter a search query');
      return;
    }

    const currentModel = this.llmManager.getCurrentModel();
    if (!currentModel || !this.llmManager.supportsCapability('web-search')) {
      this.ui.showError('Please select Perplexity AI for web search capabilities');
      return;
    }

    try {
      await this.executeAIRequest('web-search', query, currentModel);
    } catch (error) {
      console.error('Error performing web search:', error);
      this.ui.showError('Failed to perform web search. Please try again.');
    }
  }

  async executeAIRequest(type, input, currentModel) {
    // Disable input and show loading states
    this.ui.disableInput();
    this.ui.clearInput();
    
    // Add user message to chat
    this.ui.addMessage(input, 'user');
    
    // Show typing indicator
    this.ui.showTyping();
    
    try {
      let result;
      
      switch (type) {
        case 'chat':
        case 'web-search':
          result = await this.llmManager.sendMessage(
            input,
            null, // onProgress callback
            null, // will handle in finally
            null  // will handle errors here
          );
          break;
          
        case 'image':
          result = await this.llmManager.generateImage(input);
          if (result.imageUrl) {
            result = `Generated image: ${result.imageUrl}`;
          } else {
            result = 'Image generated successfully, but URL not available';
          }
          break;
          
        case 'design':
          result = await this.llmManager.createDesign('presentation', input);
          if (result.designUrl) {
            result = `Design created: ${result.designUrl}`;
          } else {
            result = `Design created successfully with ID: ${result.designId}`;
          }
          break;
          
        default:
          throw new Error(`Unsupported request type: ${type}`);
      }
      
      // Add assistant response
      this.ui.addMessage(result, 'assistant', currentModel.modelName);
      console.log(`${type} request completed successfully`);
      
    } catch (error) {
      console.error(`Failed to execute ${type} request:`, error);
      const errorMessage = this.llmManager.handleAPIError(error);
      this.ui.showError(errorMessage);
      this.ui.addMessage(`❌ Error: ${errorMessage}`, 'assistant', currentModel.modelName);
      
    } finally {
      // Re-enable input and hide loading
      this.ui.hideTyping();
      this.ui.enableInput();
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
        this.ui.setModelInfo('Please select another model');
      }

    } catch (error) {
      console.error('Connection check failed:', error);
      // Don't show error for connection checks as they happen automatically
    }
  }

  handleKeyboardShortcuts(event) {
    // Only handle shortcuts when not typing in input fields
    if (event.target.tagName === 'TEXTAREA' || event.target.tagName === 'INPUT') {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'Enter':
          event.preventDefault();
          this.ui.focusInput();
          break;
        case 'k':
          event.preventDefault();
          this.clearChat();
          break;
        case '1':
          event.preventDefault();
          this.switchToCapability('chat');
          break;
        case '2':
          event.preventDefault();
          this.switchToCapability('image');
          break;
        case '3':
          event.preventDefault();
          this.switchToCapability('design');
          break;
        case '4':
          event.preventDefault();
          this.switchToCapability('translation');
          break;
        case '5':
          event.preventDefault();
          this.switchToCapability('web-search');
          break;
      }
    }

    // ESC key to close modals
    if (event.key === 'Escape') {
      this.ui.closeModelDropdown();
    }
  }

  switchToCapability(capability) {
    if (this.ui && typeof this.ui.switchToCapability === 'function') {
      this.ui.switchToCapability(capability);
    }
  }

  clearChat() {
    if (this.llmManager) {
      this.llmManager.clearHistory();
    }

    if (this.ui) {
      this.ui.clearChat();
    }

    this.ui.showSuccess('Chat cleared');
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

  getConversationHistory() {
    return this.llmManager?.getHistory() || [];
  }

  clearConversationHistory() {
    this.clearChat();
  }

  // Enhanced methods for new capabilities
  async generateImage(prompt, options = {}) {
    if (!this.llmManager) {
      throw new Error('LLM Manager not initialized');
    }
    return await this.llmManager.generateImage(prompt, options);
  }

  async createDesign(type, title, elements = []) {
    if (!this.llmManager) {
      throw new Error('LLM Manager not initialized');
    }
    return await this.llmManager.createDesign(type, title, elements);
  }

  getProviderCapabilities(provider) {
    if (!this.llmManager) return [];
    return this.llmManager.getProviderCapabilities(provider);
  }

  supportsCapability(capability) {
    if (!this.llmManager) return false;
    return this.llmManager.supportsCapability(capability);
  }
}

// Global error handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  
  // Show user-friendly error message
  const message = event.reason?.message || 'An unexpected error occurred';
  
  // Try to show error through UI if available
  if (window.app?.ui) {
    window.app.ui.showError(message);
  } else {
    // Fallback error display
    alert(`Error: ${message}`);
  }

  // Prevent the default unhandled rejection behavior
  event.preventDefault();
});

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing Enhanced Multi-LLM Chat App...');
  try {
    window.app = new MultiLLMChatApp();
  } catch (error) {
    console.error('Failed to initialize app:', error);
    alert('The application failed to start properly. Please refresh the page.');
  }
});