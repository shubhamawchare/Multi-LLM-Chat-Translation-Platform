# Multi-LLM Chat & Translation Platform

A comprehensive Node.js web application that provides a unified interface for chatting with multiple AI providers and translating text between languages. Features support for OpenAI, Anthropic, Deepseek, Perplexity, Microsoft AI, Adobe AI, and Canva AI with optional user authentication and database integration.

## ✨ Features

Core Features

- Multi-Provider AI Chat: Support for OpenAI, Anthropic, Deepseek, Perplexity, Microsoft AI, Adobe AI, and Canva AI
- Real-time Translation: Translate text between 30+ languages with auto-detection
- Modern UI: Clean, responsive interface with dark/light mode support
- Token & Cost Tracking: Monitor usage and estimated costs across providers
- Model Selection: Choose from various models within each provider

Authentication & User Management

- Optional Authentication: User registration, login, and profile management
- Database Integration: Support for both MySQL and in-memory fallback
- User Dashboard: Personal content history, bookmarks, and usage statistics
- Profile Setup: Custom user profiles with preferences

Advanced Features

- Content History: Save and manage AI-generated content
- Bookmarking System: Save favorite responses and translations
- Token Management: Track remaining tokens and usage limits
- Responsive Design: Works seamlessly on desktop and mobile devices

## 🚀 Quick Start

Prerequisites

- Node.js 16.0 or higher
- npm (comes with Node.js)
- MySQL (optional - app works with in-memory storage)

## Installation

1. Clone the repository
   git clone https://github.com/yourusername/multi-llm-chat.git
   cd multi-llm-chat

2. Install dependencies
   npm install

3. Environment Setup
   cp file.env .env

4. Start the application
   npm run dev
   npm start

5. Access the application
   Open your browser to http://localhost:3000
   Chat interface: http://localhost:3000/
   Translation tool: http://localhost:3000/translate.html
   Dashboard: http://localhost:3000/dashboard.html (Working on it)

## ⚙️ Configuration

Required API Keys (Optional)
The application works without API keys but with limited functionality. Add the following to your .env file:

bash
# OpenAI (GPT models)
OPENAI_API_KEY=your_openai_api_key

# Anthropic (Claude models)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Deepseek AI
DEEPSEEK_API_KEY=your_deepseek_api_key

# Perplexity AI
PERPLEXITY_API_KEY=your_perplexity_api_key

# Microsoft Azure OpenAI (optional)
AZURE_OPENAI_API_KEY=your_azure_key
AZURE_OPENAI_ENDPOINT=your_azure_endpoint

# Adobe AI (Firefly)
ADOBE_CLIENT_ID=your_adobe_client_id

# Server Configuration
PORT=3000
JWT_SECRET=your_secure_jwt_secret


## ⚙️ Database Configuration (Optional)
For persistent user data, configure MySQL:

bash
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=multi_llm_platform


## 🏗️ Project Structure

<img width="797" height="511" alt="image" src="https://github.com/user-attachments/assets/421975b6-f5b6-481c-9c1f-97f1ffe7317a" />


## 🔧 API Endpoints

1. Health & Configuration
- GET /api/health - Check provider availability
- GET /api/models - Available models by provider
- GET /api/languages - Supported translation languages

2. Chat & Translation
- POST /api/chat - Send message to AI provider
- POST /api/translate - Translate text between languages

3. Authentication (Optional)
- POST /api/auth/register - User registration
- POST /api/auth/login - User login
- POST /api/auth/profile - Update user profile
- GET /api/user/content - Get user content history


## 🤖 Supported AI Providers

<img width="936" height="418" alt="image" src="https://github.com/user-attachments/assets/8814b564-d3db-4656-9588-503c7484a9a2" />


## 🌍 Translation Features

- 30+ Languages: Support for major world languages
- Auto-detection: Automatically detect source language
- Bulk Translation: Translate multiple texts at once
- History: Save translation history (with authentication)

 # Supported Languages
  English, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Korean, Chinese (Simplified/Traditional), Arabic, Hindi, Dutch, Swedish, Danish, Norwegian, Finnish, Polish, Turkish, Thai, Vietnamese,   Indonesian, Malay, Filipino, Hebrew, Persian, Urdu, Bengali, Gujarati, Tamil, Telugu, Kannada, Malayalam, Marathi, Punjabi.

## 📱 Usage

 # Chat Interface
 1. Select an AI provider and model
 2. Type your message in the input field
 3. Press Enter or click Send

 # Translation Tool
 1. Navigate to the translate page
 2. Select source and target languages (or use auto-detect)
 3. Enter text to translate
 4. Click Translate button
 5. Copy or save results

 # Dashboard (with Authentication)
 1. Register/login to access dashboard
 2. View content history and bookmarks
 3. Manage profile and preferences
 4. Track token usage and costs
 5. View response with token/cost information


## 🚀 Deployment

 # Local Development
   npm run dev  # Uses nodemon for auto-restart

 # Production Deployment
 1. Environment Variables: Set all required API keys
 2. Database: Configure MySQL connection (optional)
 3. Start Server: npm start

## 🔧 Development
   npm start        # Production server
   npm run dev      # Development with nodemon
   npm test         # Run tests (placeholder)


 # Adding New Providers
 
 1. Add API configuration in server.js
 2. Implement provider logic in the chat endpoint
 3. Update AVAILABLE_MODELS object
 4. Add client-side handling in llmProviders.js

## 🛡️ Security Features

- JWT Authentication: Secure token-based authentication
- Input Validation: Sanitize all user inputs
- Rate Limiting: Prevent API abuse
- CORS Protection: Configure allowed origins
- Environment Variables: Secure API key management


## 🎯 Roadmap

 - Add more AI providers (Cohere, Hugging Face)
 - Voice chat functionality
 - Image generation interface
 - Plugin system for extensions
 - Mobile app version
 - Advanced analytics dashboard 
