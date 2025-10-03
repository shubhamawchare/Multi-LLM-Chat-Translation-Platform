// ui.js -- Enhanced UI Manager for Multi-LLM Chat with New Providers

class UIManager {
  constructor() {
    this.elements = {
      modelBtn: document.getElementById('modelBtn'),
      modelDropdown: document.getElementById('modelDropdown'),
      currentModel: document.getElementById('currentModel'),
      currentProvider: document.getElementById('currentProvider'),
      messageInput: document.getElementById('messageInput'),
      sendButton: document.getElementById('sendButton'),
      messagesContainer: document.getElementById('messagesContainer'),
      charCount: document.getElementById('charCount'),
      typingIndicator: document.getElementById('typingIndicator'),
      settingsBtn: document.getElementById('settingsBtn'),
      clearChatBtn: document.getElementById('clearChatBtn'),
      imageGenBtn: document.getElementById('imageGenBtn'),
      designGenBtn: document.getElementById('designGenBtn'),
      capabilityTabs: document.getElementById('capabilityTabs'),
    };
    this.currentProvider = null;
    this.currentModel = null;
    this.isDropdownOpen = false;
    this.messageCount = 0;
    this.currentCapability = 'chat';
    this.setupEvents();
  }

  setupEvents() {
    // Dropdown open/close
    if (this.elements.modelBtn) {
      this.elements.modelBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleModelDropdown();
      });
    }

    document.addEventListener('click', (e) => {
      if (
        this.isDropdownOpen &&
        !this.elements.modelDropdown.contains(e.target) &&
        !this.elements.modelBtn.contains(e.target)
      ) this.closeModelDropdown();
    });

    // Message input
    if (this.elements.messageInput) {
      this.elements.messageInput.addEventListener('input', () => {
        this.updateCharCount();
        this.autoResizeTextarea();
        this.updateSendButton();
        this.updateInputPlaceholder();
      });

      this.elements.messageInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }

    // Send button
    if (this.elements.sendButton) {
      this.elements.sendButton.addEventListener('click', () => this.sendMessage());
    }

    // Clear chat button
    if (this.elements.clearChatBtn) {
      this.elements.clearChatBtn.addEventListener('click', () => this.clearChat());
    }

    // Image generation button
    if (this.elements.imageGenBtn) {
      this.elements.imageGenBtn.addEventListener('click', () => this.switchToCapability('image'));
    }

    // Design generation button
    if (this.elements.designGenBtn) {
      this.elements.designGenBtn.addEventListener('click', () => this.switchToCapability('design'));
    }

    // Capability tabs
    if (this.elements.capabilityTabs) {
      this.elements.capabilityTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('capability-tab')) {
          const capability = e.target.dataset.capability;
          this.switchToCapability(capability);
        }
      });
    }

    // Settings button
    if (this.elements.settingsBtn) {
      this.elements.settingsBtn.addEventListener('click', () => {
        this.showSettings();
      });
    }

    // Page leave warning
    window.addEventListener('beforeunload', (e) => {
      if (this.messageCount > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  switchToCapability(capability) {
    this.currentCapability = capability;
    this.updateCapabilityTabs();
    this.updateInputPlaceholder();
    this.updateAvailableModels();
  }

  updateCapabilityTabs() {
    if (!this.elements.capabilityTabs) return;
    
    const tabs = this.elements.capabilityTabs.querySelectorAll('.capability-tab');
    tabs.forEach(tab => {
      if (tab.dataset.capability === this.currentCapability) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  }

  updateInputPlaceholder() {
    if (!this.elements.messageInput) return;

    const placeholders = {
      chat: 'Type your message here...',
      image: 'Describe the image you want to generate...',
      design: 'Describe the design you want to create...',
      translation: 'Enter text to translate...',
      'web-search': 'Ask a question to search the web...'
    };

    this.elements.messageInput.placeholder = placeholders[this.currentCapability] || placeholders.chat;
  }

  async toggleModelDropdown() {
    if (this.isDropdownOpen) return this.closeModelDropdown();
    await this.loadModels();
    if (this.elements.modelDropdown) {
      this.elements.modelDropdown.classList.add('show');
      this.isDropdownOpen = true;
    }
  }

  closeModelDropdown() {
    if (this.elements.modelDropdown) {
      this.elements.modelDropdown.classList.remove('show');
      this.isDropdownOpen = false;
    }
  }

  async loadModels() {
    try {
      const response = await fetch('/api/models');
      if (!response.ok) throw new Error("Failed to fetch models");
      const models = await response.json();
      this.populateModelDropdown(models);
    } catch (error) {
      console.error('Error loading models:', error);
      this.elements.modelDropdown.innerHTML = '<div class="dropdown-item error">Error loading models</div>';
    }
  }

  updateAvailableModels() {
    // Re-populate dropdown based on current capability
    this.loadModels();
  }

  populateModelDropdown(models, selectedProvider = null, selectedModel = null) {
    if (!this.elements.modelDropdown) return;

    let html = '';
    
    // Filter models by capability if needed
    const filteredModels = this.filterModelsByCapability(models);

    Object.entries(filteredModels).forEach(([provider, providerModels]) => {
      const providerDisplayName = this.getProviderDisplayName(provider);
      html += `<div class="dropdown-section">
        <div class="dropdown-section-header">${providerDisplayName}</div>`;
      
      Object.entries(providerModels).forEach(([modelId, modelName]) => {
        const isSelected = provider === selectedProvider && modelId === selectedModel;
        const capabilityBadge = this.getModelCapabilityBadge(provider, modelId);
        html += `
          <div class="dropdown-item ${isSelected ? 'selected' : ''}" 
               onclick="window.app?.ui?.selectModel('${provider}', '${modelId}', '${modelName}')">
            <div class="model-info">
              <div class="model-name">${modelName}</div>
              <div class="model-capabilities">${capabilityBadge}</div>
            </div>
          </div>`;
      });
      html += '</div>';
    });

    if (html === '') {
      html = '<div class="dropdown-item">No models available for this capability</div>';
    }

    this.elements.modelDropdown.innerHTML = html;
  }

  filterModelsByCapability(models) {
    if (this.currentCapability === 'chat') return models;

    const filtered = {};
    Object.entries(models).forEach(([provider, providerModels]) => {
      const capabilities = this.getProviderCapabilities(provider);
      if (capabilities.includes(this.currentCapability)) {
        // Further filter models within provider if needed
        const filteredProviderModels = {};
        Object.entries(providerModels).forEach(([modelId, modelName]) => {
          if (this.modelSupportsCapability(provider, modelId, this.currentCapability)) {
            filteredProviderModels[modelId] = modelName;
          }
        });
        if (Object.keys(filteredProviderModels).length > 0) {
          filtered[provider] = filteredProviderModels;
        }
      }
    });
    return filtered;
  }

  getProviderCapabilities(provider) {
    const capabilities = {
      openai: ['chat', 'translation', 'image', 'language-detection'],
      anthropic: ['chat', 'translation', 'language-detection'],
      deepseek: ['chat', 'translation', 'language-detection'],
      mai: ['chat', 'translation', 'text-to-speech', 'language-detection'],
      adobe: ['image', 'image-editing'],
      canva: ['design', 'template-generation'],
      perplexity: ['chat', 'translation', 'web-search', 'language-detection'],
    };
    return capabilities[provider] || [];
  }

  modelSupportsCapability(provider, modelId, capability) {
    // Custom logic to determine if specific model supports capability
    if (capability === 'image') {
      return modelId.includes('dall-e') || modelId.includes('firefly') || 
             modelId.includes('image') || provider === 'adobe';
    }
    if (capability === 'design') {
      return provider === 'canva';
    }
    if (capability === 'text-to-speech') {
      return modelId.includes('voice') || modelId === 'mai-voice-1';
    }
    if (capability === 'web-search') {
      return provider === 'perplexity' || modelId.includes('online');
    }
    return true; // Default: assume model supports general capabilities
  }

  getProviderDisplayName(provider) {
    const names = {
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      deepseek: 'Deepseek AI',
      mai: 'Microsoft AI',
      adobe: 'Adobe AI',
      canva: 'Canva AI',
      perplexity: 'Perplexity AI',
    };
    return names[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
  }

  getModelCapabilityBadge(provider, modelId) {
    const capabilities = this.getProviderCapabilities(provider);
    let badges = capabilities.slice(0, 3).map(cap => {
      const badgeClass = cap === this.currentCapability ? 'capability-badge active' : 'capability-badge';
      return `<span class="${badgeClass}">${cap}</span>`;
    }).join(' ');
    
    if (capabilities.length > 3) {
      badges += ` <span class="capability-badge">+${capabilities.length - 3}</span>`;
    }
    
    return badges;
  }

  selectModel(provider, modelId, modelName) {
    this.currentProvider = provider;
    this.currentModel = modelId;
    
    // Update UI
    if (this.elements.currentModel) {
      this.elements.currentModel.textContent = modelName;
    }
    if (this.elements.currentProvider) {
      this.elements.currentProvider.textContent = this.getProviderDisplayName(provider);
    }

    // Dispatch event for app to handle
    document.dispatchEvent(new CustomEvent('modelChanged', {
      detail: { provider, modelId, modelName }
    }));

    this.closeModelDropdown();
    this.updateCapabilityAvailability();
  }

  updateCapabilityAvailability() {
    if (!this.elements.capabilityTabs) return;
    
    const capabilities = this.getProviderCapabilities(this.currentProvider);
    const tabs = this.elements.capabilityTabs.querySelectorAll('.capability-tab');
    
    tabs.forEach(tab => {
      const tabCapability = tab.dataset.capability;
      if (capabilities.includes(tabCapability)) {
        tab.classList.remove('disabled');
        tab.removeAttribute('disabled');
      } else {
        tab.classList.add('disabled');
        tab.setAttribute('disabled', 'true');
      }
    });
  }

  setModelInfo(info) {
    // Update model info display
    const modelInfoElement = document.getElementById('modelInfo');
    if (modelInfoElement) {
      modelInfoElement.textContent = info;
    }
  }

  updateCharCount() {
    if (!this.elements.messageInput || !this.elements.charCount) return;
    const length = this.elements.messageInput.value.length;
    this.elements.charCount.textContent = `${length} characters`;
  }

  autoResizeTextarea() {
    if (!this.elements.messageInput) return;
    const element = this.elements.messageInput;
    element.style.height = 'auto';
    element.style.height = Math.min(element.scrollHeight, 200) + 'px';
  }

  updateSendButton() {
    if (!this.elements.sendButton || !this.elements.messageInput) return;
    const hasText = this.elements.messageInput.value.trim().length > 0;
    this.elements.sendButton.disabled = !hasText;
  }

  sendMessage() {
    if (!this.elements.messageInput || !this.elements.sendButton) return;
    const message = this.elements.messageInput.value.trim();
    if (!message) return;

    // Dispatch appropriate event based on capability
    let eventType = 'sendMessage';
    if (this.currentCapability === 'image') {
      eventType = 'generateImage';
    } else if (this.currentCapability === 'design') {
      eventType = 'createDesign';
    }

    document.dispatchEvent(new CustomEvent(eventType, {
      detail: { message, capability: this.currentCapability }
    }));
  }

  clearInput() {
    if (this.elements.messageInput) {
      this.elements.messageInput.value = '';
      this.updateCharCount();
      this.autoResizeTextarea();
      this.updateSendButton();
    }
  }

  disableInput() {
    if (this.elements.messageInput) this.elements.messageInput.disabled = true;
    if (this.elements.sendButton) this.elements.sendButton.disabled = true;
  }

  enableInput() {
    if (this.elements.messageInput) this.elements.messageInput.disabled = false;
    this.updateSendButton();
  }

  addMessage(content, role, modelName = '') {
    if (!this.elements.messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${role}`;
    
    let roleDisplay = role === 'user' ? 'You' : (modelName || 'Assistant');
    let timestamp = new Date().toLocaleTimeString();

    // Handle special content types
    if (this.isImageUrl(content)) {
      content = `<img src="${content}" alt="Generated image" class="generated-image" />`;
    } else if (this.isDesignUrl(content)) {
      content = `<a href="${content}" target="_blank" class="design-link">View Design</a>`;
    } else if (this.containsAudioReference(content)) {
      const audioMatch = content.match(/\[Audio available: (.*?)\]/);
      if (audioMatch) {
        const audioUrl = audioMatch[1];
        content = content.replace(audioMatch[0], 
          `<audio controls><source src="${audioUrl}" type="audio/mpeg">Your browser does not support the audio element.</audio>`
        );
      }
    }

    messageDiv.innerHTML = `
      <div class="message-header">
        <span class="message-role">${roleDisplay}</span>
        <span class="message-time">${timestamp}</span>
      </div>
      <div class="message-content">${content}</div>
    `;

    this.elements.messagesContainer.appendChild(messageDiv);
    this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    this.messageCount++;
  }

  isImageUrl(content) {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(content) || 
           content.includes('Generated image:') ||
           content.includes('presignedUrl');
  }

  isDesignUrl(content) {
    return content.includes('canva.com') || content.includes('Created design:');
  }

  containsAudioReference(content) {
    return content.includes('[Audio available:');
  }

  showTyping() {
    if (this.elements.typingIndicator) {
      this.elements.typingIndicator.style.display = 'flex';
    }
  }

  hideTyping() {
    if (this.elements.typingIndicator) {
      this.elements.typingIndicator.style.display = 'none';
    }
  }

  clearChat() {
    if (this.elements.messagesContainer) {
      this.elements.messagesContainer.innerHTML = '';
    }
    this.messageCount = 0;
  }

  showSettings() {
    // Show settings modal/panel
    alert('Settings panel - Coming soon!');
  }

  focusInput() {
    if (this.elements.messageInput) {
      this.elements.messageInput.focus();
    }
  }

  getMessageCount() {
    return this.messageCount;
  }

  showError(message) {
    // Create error notification
    const errorDiv = document.createElement('div');
    errorDiv.className = 'notification error';
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 5000);
  }

  showSuccess(message) {
    // Create success notification
    const successDiv = document.createElement('div');
    successDiv.className = 'notification success';
    successDiv.textContent = message;
    
    document.body.appendChild(successDiv);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (successDiv.parentNode) {
        successDiv.parentNode.removeChild(successDiv);
      }
    }, 3000);
  }
}