// FIXED server.js - Proper handling of database and in-memory modes

const express = require('express');
const cors = require('cors');
const path = require('path');
const { OpenAI } = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const fetch = require('node-fetch');
const mysql = require('mysql2/promise');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Auth is not required for this build. Keep placeholder for potential future use.
let authService = null;

// Initialize AI clients
const clients = {
    openai: process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null,
    anthropic: process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null,
    deepseek: process.env.DEEPSEEK_API_KEY ? { apiKey: process.env.DEEPSEEK_API_KEY } : null,
    perplexity: process.env.PERPLEXITY_API_KEY ? { apiKey: process.env.PERPLEXITY_API_KEY } : null,
    microsoft: process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT ? {
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        deployment: process.env.AZURE_OPENAI_DEPLOYMENT || ''
    } : null,
    adobe: process.env.ADOBE_API_KEY ? { apiKey: process.env.ADOBE_API_KEY } : null,
    canva: process.env.CANVA_API_KEY ? { apiKey: process.env.CANVA_API_KEY } : null,
    azureSpeech: process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION ? {
        key: process.env.AZURE_SPEECH_KEY,
        region: process.env.AZURE_SPEECH_REGION
    } : null,
};

// Deepseek chat helper
async function callDeepseekChat(model, message, history) {
    const url = 'https://api.deepseek.com/chat/completions';
    const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clients.deepseek.apiKey}`,
    };
    const body = JSON.stringify({
        model,
        messages: [...history.slice(-10), { role: 'user', content: message }],
    });

    const response = await fetch(url, { method: 'POST', headers, body });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Deepseek API error: ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Deepseek response unavailable';
}

// Available models
const AVAILABLE_MODELS = {
    openai: {
        'gpt-4': 'GPT-4',
        'gpt-4-turbo': 'GPT-4 Turbo',
        'gpt-3.5-turbo': 'GPT-3.5 Turbo',
    },
    anthropic: {
        'claude-3-5-sonnet-20241022': 'Claude-3.5 Sonnet',
        'claude-3-haiku-20240307': 'Claude-3 Haiku',
        'claude-3-sonnet-20240229': 'Claude-3 Sonnet',
    },
    deepseek: {
        'deepseek-chat': 'Deepseek Chat',
        'deepseek-coder': 'Deepseek Coder',
    },
    perplexity: {
        'sonar': 'Perplexity Sonar',
        'sonar-pro': 'Perplexity Sonar Pro'
    },
    microsoft: {
        'gpt-4o-mini': 'Azure OpenAI GPT-4o Mini'
    },
    adobe: {
        'firefly-image': 'Adobe Firefly Image'
    },
    canva: {
        'design': 'Canva Design'
    },
};

// Language codes
const SUPPORTED_LANGUAGES = {
    'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
    'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese',
    'ko': 'Korean', 'zh': 'Chinese (Simplified)', 'zh-tw': 'Chinese (Traditional)',
    'ar': 'Arabic', 'hi': 'Hindi', 'nl': 'Dutch', 'sv': 'Swedish',
    'da': 'Danish', 'no': 'Norwegian', 'fi': 'Finnish', 'pl': 'Polish',
    'tr': 'Turkish', 'th': 'Thai', 'vi': 'Vietnamese', 'id': 'Indonesian',
    'ms': 'Malay', 'tl': 'Filipino', 'he': 'Hebrew', 'fa': 'Persian',
    'ur': 'Urdu', 'bn': 'Bengali', 'gu': 'Gujarati', 'ta': 'Tamil',
    'te': 'Telugu', 'kn': 'Kannada', 'ml': 'Malayalam', 'mr': 'Marathi', 'pa': 'Punjabi',
};

function isProviderAvailable(provider) {
    return clients[provider] !== null;
}

function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}

function calculateCost(tokens, model = 'gpt-3.5-turbo') {
    const costPerToken = {
        'gpt-4': 0.00003,
        'gpt-4-turbo': 0.00001,
        'gpt-3.5-turbo': 0.000002,
        'claude-3-5-sonnet-20241022': 0.000015,
        'claude-3-haiku-20240307': 0.00000025,
        'claude-3-sonnet-20240229': 0.000003,
        'deepseek-chat': 0.0000014,
        'deepseek-coder': 0.0000014,
    };
    return tokens * (costPerToken[model] || 0.000002);
}

// (Auth endpoints removed for this public build)
// (Dashboard count endpoints removed)

// ===== EXISTING ROUTES =====

app.get('/api/health', async (req, res) => {
    const health = {};
    for (const provider of Object.keys(clients)) {
        try {
            health[provider] = !!clients[provider];
        } catch (e) {
            health[provider] = false;
        }
    }
    res.json(health);
});

app.get('/api/models', (req, res) => {
    const models = {};
    Object.entries(AVAILABLE_MODELS).forEach(([provider, modelsList]) => {
        if (isProviderAvailable(provider)) {
            models[provider] = modelsList;
        }
    });
    res.json(models);
});

app.get('/api/languages', (req, res) => {
    res.json(SUPPORTED_LANGUAGES);
});

// Enhanced chat endpoint with authentication and token tracking
app.post('/api/chat', async (req, res) => {
    const { provider, model, message, history = [] } = req.body;
    
    if (!provider || !model || !message) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (!isProviderAvailable(provider)) {
        return res.status(400).json({ error: `Provider ${provider} is not available` });
    }

    if (!AVAILABLE_MODELS[provider]?.[model]) {
        return res.status(400).json({ error: `Model ${model} not available for ${provider}` });
    }

    try {
        let responseText = '';
        const startTime = Date.now();

        if (provider === 'openai') {
            const completion = await clients.openai.chat.completions.create({
                model,
                messages: [...history.slice(-10), { role: 'user', content: message }],
                temperature: 0.7,
                max_tokens: 4000,
            });
            responseText = completion.choices[0].message.content;
        } else if (provider === 'anthropic') {
            const completion = await clients.anthropic.messages.create({
                model,
                max_tokens: 4000,
                temperature: 0.7,
                messages: [...history.slice(-10).filter(m => m.role !== 'system'), { role: 'user', content: message }],
            });
            responseText = completion.content[0].text;
        } else if (provider === 'deepseek') {
            responseText = await callDeepseekChat(model, message, history);
        } else if (provider === 'perplexity') {
            // Minimal Perplexity chat call (stub). Replace with real endpoint when key is present
            if (!clients.perplexity) throw new Error('Perplexity not configured');
            const resp = await fetch('https://api.perplexity.ai/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${clients.perplexity.apiKey}`
                },
                body: JSON.stringify({
                    model,
                    messages: [...history.slice(-10), { role: 'user', content: message }]
                })
            });
            if (!resp.ok) throw new Error('Perplexity API error');
            const data = await resp.json();
            responseText = data.choices?.[0]?.message?.content || 'Perplexity response unavailable';
        } else if (provider === 'microsoft') {
            if (!clients.microsoft) throw new Error('Azure OpenAI not configured');
            const { endpoint, deployment, apiKey } = clients.microsoft;
            const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`;
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': apiKey
                },
                body: JSON.stringify({
                    messages: [...history.slice(-10), { role: 'user', content: message }],
                    temperature: 0.7,
                    max_tokens: 2000
                })
            });
            if (!resp.ok) throw new Error('Azure OpenAI error');
            const data = await resp.json();
            responseText = data.choices?.[0]?.message?.content || 'Azure response unavailable';
        } else {
            throw new Error(`Unsupported provider: ${provider}`);
        }

        const executionTime = Date.now() - startTime;
        const tokensUsed = estimateTokens(message + responseText);
        const cost = calculateCost(tokensUsed, model);

        res.json({
            response: responseText,
            provider,
            model,
            tokensUsed,
            cost: parseFloat(cost.toFixed(6)),
            executionTime,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`Chat error for ${provider}/${model}:`, error);
        res.status(500).json({ error: error.message || 'An error occurred' });
    }
});

// Enhanced translation endpoint with authentication
app.post('/api/translate', async (req, res) => {
    const { provider, model, text, sourceLang, targetLang } = req.body;
    
    if (!provider || !model || !text || !targetLang) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (!isProviderAvailable(provider)) {
        return res.status(400).json({ error: `Provider ${provider} is not available` });
    }

    if (!AVAILABLE_MODELS[provider]?.[model]) {
        return res.status(400).json({ error: `Model ${model} not available for ${provider}` });
    }

    const sourceLanguage = SUPPORTED_LANGUAGES[sourceLang] || 'auto-detect';
    const targetLanguage = SUPPORTED_LANGUAGES[targetLang] || targetLang;
    const translationPrompt = sourceLang === 'auto'
        ? `Translate the following text to ${targetLanguage}. Only provide the translation, no explanations:\n\n"${text}"`
        : `Translate the following text from ${sourceLanguage} to ${targetLanguage}. Only provide the translation, no explanations:\n\n"${text}"`;

    try {
        let translatedText = '';
        const startTime = Date.now();

        if (provider === 'openai') {
            const completion = await clients.openai.chat.completions.create({
                model,
                messages: [{ role: 'user', content: translationPrompt }],
                temperature: 0.3,
                max_tokens: 2000,
            });
            translatedText = completion.choices[0].message.content.trim();
        } else if (provider === 'anthropic') {
            const completion = await clients.anthropic.messages.create({
                model,
                max_tokens: 2000,
                temperature: 0.3,
                messages: [{ role: 'user', content: translationPrompt }],
            });
            translatedText = completion.content[0].text.trim();
        } else if (provider === 'deepseek') {
            translatedText = await callDeepseekChat(model, translationPrompt, []);
        } else if (provider === 'perplexity') {
            if (!clients.perplexity) throw new Error('Perplexity not configured');
            const resp = await fetch('https://api.perplexity.ai/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${clients.perplexity.apiKey}`
                },
                body: JSON.stringify({ model, messages: [{ role: 'user', content: translationPrompt }] })
            });
            if (!resp.ok) throw new Error('Perplexity API error');
            const data = await resp.json();
            translatedText = data.choices?.[0]?.message?.content?.trim() || '';
        } else if (provider === 'microsoft') {
            if (!clients.microsoft) throw new Error('Azure OpenAI not configured');
            const { endpoint, deployment, apiKey } = clients.microsoft;
            const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`;
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
                body: JSON.stringify({ messages: [{ role: 'user', content: translationPrompt }], temperature: 0.3, max_tokens: 1000 })
            });
            if (!resp.ok) throw new Error('Azure OpenAI error');
            const data = await resp.json();
            translatedText = data.choices?.[0]?.message?.content?.trim() || '';
        } else {
            throw new Error(`Unsupported provider: ${provider}`);
        }

        translatedText = translatedText.replace(/^["']|["']$/g, '');

        const executionTime = Date.now() - startTime;
        const tokensUsed = estimateTokens(text + translatedText);
        const cost = calculateCost(tokensUsed, model);

        res.json({
            translatedText,
            sourceLang: sourceLang === 'auto' ? 'auto-detected' : sourceLang,
            targetLang,
            provider,
            model,
            tokensUsed,
            cost: parseFloat(cost.toFixed(6)),
            executionTime,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`Translation error for ${provider}/${model}:`, error);
        res.status(500).json({ error: error.message || 'Translation failed' });
    }
});

app.post('/api/detect-language', async (req, res) => {
    const { provider, model, text } = req.body;
    
    if (!provider || !model || !text) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }
    if (!isProviderAvailable(provider)) {
        return res.status(400).json({ error: `Provider ${provider} is not available` });
    }

    const detectionPrompt = `Detect the language of the following text and respond with only the language name in English (e.g., "English", "Spanish", "French", etc.):\n\n"${text}"`;

    try {
        let detectedLanguage = '';
        
        if (provider === 'openai') {
            const completion = await clients.openai.chat.completions.create({
                model,
                messages: [{ role: 'user', content: detectionPrompt }],
                temperature: 0.1,
                max_tokens: 50,
            });
            detectedLanguage = completion.choices[0].message.content.trim();
        } else if (provider === 'anthropic') {
            const completion = await clients.anthropic.messages.create({
                model,
                max_tokens: 50,
                temperature: 0.1,
                messages: [{ role: 'user', content: detectionPrompt }],
            });
            detectedLanguage = completion.content[0].text.trim();
        } else if (provider === 'deepseek') {
            detectedLanguage = await callDeepseekChat(model, detectionPrompt, []);
        } else if (provider === 'perplexity') {
            if (!clients.perplexity) throw new Error('Perplexity not configured');
            const resp = await fetch('https://api.perplexity.ai/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${clients.perplexity.apiKey}` },
                body: JSON.stringify({ model, messages: [{ role: 'user', content: detectionPrompt }] })
            });
            if (!resp.ok) throw new Error('Perplexity API error');
            const data = await resp.json();
            detectedLanguage = data.choices?.[0]?.message?.content?.trim() || '';
        }

        const langCode = Object.keys(SUPPORTED_LANGUAGES).find(
            code => SUPPORTED_LANGUAGES[code].toLowerCase() === detectedLanguage.toLowerCase()
        );

        res.json({
            detectedLanguage,
            languageCode: langCode || 'unknown',
            provider,
            model,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error(`Language detection error for ${provider}/${model}:`, error);
        res.status(500).json({ error: error.message || 'Language detection failed' });
    }
});

// Content history endpoint removed in public build

// Legacy redirects
app.get('/login', (req, res) => res.redirect('/'));
app.get('/dashboard', (req, res) => res.redirect('/'));
app.get('/profile-setup', (req, res) => res.redirect('/'));

// Serve main chat interface (protected)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve translator page
app.get('/translate', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'translate.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
    console.log(`🚀 Multi-LLM Platform server running on port ${PORT}`);
    console.log(`📍 Access the application at: http://localhost:${PORT}`);
});

module.exports = app;