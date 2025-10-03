// llmProviders.js -- Enhanced LLM Providers Manager for Multi-LLM Chat

class LLMProvidersManager {
  constructor() {
    this.providers = {
      openai: { name: 'OpenAI', models: {}, available: false },
      anthropic: { name: 'Anthropic', models: {}, available: false },
      deepseek: { name: 'Deepseek AI', models: {}, available: false },
      microsoft: { name: 'Microsoft AI', models: {}, available: false },
      adobe: { name: 'Adobe AI', models: {}, available: false },
      canva: { name: 'Canva AI', models: {}, available: false },
      perplexity: { name: 'Perplexity AI', models: {}, available: false },
    };
    this.currentProvider = null;
    this.currentModel = null;
    this.conversationHistory = [];
  }

  async initialize() {
    await this.loadAvailableModels();
    if (!this.currentProvider || !this.currentModel) {
      this.autoSelectModel();
    }
  }

  async loadAvailableModels() {
    try {
      const response = await fetch('/api/models');
      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }

      const models = await response.json();
      Object.entries(this.providers).forEach(([provider, info]) => {
        if (models[provider] && Object.keys(models[provider]).length > 0) {
          info.models = models[provider];
          info.available = true;
        } else {
          info.models = {};
          info.available = false;
        }
      });
      return models;
    } catch (error) {
      console.error('Error loading models:', error);
      throw error;
    }
  }

  autoSelectModel() {
    // Priority order for auto-selection
    const priorityOrder = ['openai', 'anthropic', 'perplexity', 'microsoft', 'deepseek', 'adobe', 'canva'];
    
    for (const provider of priorityOrder) {
      if (this.providers[provider]?.available && Object.keys(this.providers[provider].models).length > 0) {
        const firstModel = Object.keys(this.providers[provider].models)[0];
        this.setModel(provider, firstModel);
        break;
      }
    }
  }

  setModel(provider, modelId) {
    if (!this.providers[provider] || !this.providers[provider].available || !this.providers[provider].models[modelId]) {
      throw new Error(`Model ${modelId} not available for provider ${provider}`);
    }

    this.currentProvider = provider;
    this.currentModel = modelId;
    this.conversationHistory = [];
    console.log(`Switched to ${provider}/${modelId}`);
  }

  getCurrentModel() {
    if (!this.currentProvider || !this.currentModel) return null;
    return {
      provider: this.currentProvider,
      modelId: this.currentModel,
      modelName: this.providers[this.currentProvider].models[this.currentModel],
      available: this.providers[this.currentProvider].available,
    };
  }

  getAvailableModels() {
    const result = {};
    Object.entries(this.providers).forEach(([provider, data]) => {
      if (data.available && Object.keys(data.models).length > 0) {
        result[provider] = data.models;
      }
    });
    return result;
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  getHistory() {
    return [...this.conversationHistory];
  }

  async sendMessage(message, onProgress, onComplete, onError) {
    if (!this.currentProvider || !this.currentModel) {
      const error = new Error('Model not selected');
      if (onError) onError(error);
      throw error;
    }

    if (!message.trim()) {
      const error = new Error('Message cannot be empty');
      if (onError) onError(error);
      throw error;
    }

    // Add user message to history
    this.conversationHistory.push({ role: 'user', content: message.trim() });

    try {
      let endpoint = '/api/chat';
      let requestData = {
        provider: this.currentProvider,
        model: this.currentModel,
        message,
        history: this.conversationHistory,
      };

      // Special handling for different model types
      if (this.currentModel.includes('image') || this.currentModel.includes('firefly')) {
        endpoint = '/api/generate-image';
        requestData = {
          provider: this.currentProvider,
          model: this.currentModel,
          prompt: message,
        };
      } else if (this.currentModel.includes('design') && this.currentProvider === 'canva') {
        endpoint = '/api/create-design';
        requestData = {
          type: 'presentation',
          title: message.substring(0, 50),
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      let responseContent = data.response || data.imageUrl || data.designUrl || 'No response available';

      // Handle special response types
      if (data.imageUrl) {
        responseContent = `Generated image: ${data.imageUrl}`;
      } else if (data.designUrl) {
        responseContent = `Created design: ${data.designUrl}`;
      }

      this.conversationHistory.push({ role: 'assistant', content: responseContent });

      if (onComplete) onComplete(responseContent);
      return responseContent;
    } catch (error) {
      this.conversationHistory.pop(); // Remove user message on error
      if (onError) onError(error);
      throw error;
    }
  }

  async generateImage(prompt, options = {}) {
    if (!this.currentProvider || !this.currentModel) {
      throw new Error('Model not selected');
    }

    const supportedProviders = ['openai', 'adobe'];
    if (!supportedProviders.includes(this.currentProvider)) {
      throw new Error(`Image generation not supported for provider: ${this.currentProvider}`);
    }

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: this.currentProvider,
          model: this.currentModel,
          prompt,
          options,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Image generation failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Image generation error:', error);
      throw error;
    }
  }

  async createDesign(type, title, elements = []) {
    if (this.currentProvider !== 'canva') {
      throw new Error('Design creation only supported with Canva');
    }

    try {
      const response = await fetch('/api/create-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title,
          elements,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Design creation failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Design creation error:', error);
      throw error;
    }
  }

  handleAPIError(error) {
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
    } else if (error.message.includes('not configured')) {
      return 'API not configured. Please check your environment variables.';
    } else if (error.message.includes('not supported')) {
      return `This feature is not supported for the selected provider: ${this.currentProvider}`;
    } else {
      return error.message || 'An unexpected error occurred.';
    }
  }

  async checkHealth() {
    try {
      const response = await fetch('/api/health');
      if (!response.ok) throw new Error('Health check failed');
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }

  // Enhanced method to get provider capabilities
  getProviderCapabilities(provider) {
    const capabilities = {
      openai: ['chat', 'translation', 'image-generation', 'language-detection'],
      anthropic: ['chat', 'translation', 'language-detection'],
      deepseek: ['chat', 'translation', 'language-detection'],
      microsoft: ['chat', 'translation', 'text-to-speech', 'language-detection'],
      adobe: ['image-generation', 'image-editing'],
      canva: ['design-creation', 'template-generation'],
      perplexity: ['chat', 'translation', 'web-search', 'language-detection'],
    };

    return capabilities[provider] || [];
  }

  // Check if current model supports specific capability
  supportsCapability(capability) {
    if (!this.currentProvider) return false;
    const capabilities = this.getProviderCapabilities(this.currentProvider);
    return capabilities.includes(capability);
  }

  // Get models filtered by capability
  getModelsByCapability(capability) {
    const result = {};
    Object.entries(this.providers).forEach(([provider, data]) => {
      if (data.available && this.getProviderCapabilities(provider).includes(capability)) {
        result[provider] = data.models;
      }
    });
    return result;
  }
}