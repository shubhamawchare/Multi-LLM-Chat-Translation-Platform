# Multi-LLM Chat + Translator

A lightweight Node/Express app that lets you chat with multiple LLM providers and translate text between languages in a clean UI.

## Features

- Multi-provider Chat (OpenAI, Anthropic, Deepseek supported if API keys are present)
- Translator with language auto-detect
- Fast, static front-end (no auth required)
- Simple navigation between Chat and Translator

## Project Structure

```
public/
  index.html          # Chat UI
  translate.html      # Translator UI
  css/style.css       # Shared styles
  js/
    main.js           # Chat app controller
    ui.js             # Chat UI manager
    llmProviders.js   # Client-side provider manager
    translate.js      # Translator controller
    translate-ui.js   # Translator UI manager
server.js             # Express server + API endpoints
package.json
```

## Prerequisites

- Node.js 18+ (recommended) and npm
- Optional: API keys in a `.env` file to enable providers:

```
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
DEEPSEEK_API_KEY=your_deepseek_key
PORT=3000
```

If you don't provide keys, the app still runs, but provider availability will reflect what's configured.

## Install & Run

```bash
npm install
npm run dev
# Server: http://localhost:3000
```

## Usage

- Open `http://localhost:3000/` for Chat
- Click “Go to Translator” to open the translator at `/translate`
- In Chat, choose a provider/model and start chatting
- In Translator, pick languages and click Translate

## Deployment (GitHub)

1. Commit and push this repo to GitHub
2. Use any Node hosting (Render, Railway, Fly.io, etc.)
3. Set environment variables (API keys) in your hosting platform
4. Start the app with `node server.js` or use `npm run dev` during development

## Notes

- Auth and workspace UI were removed by request; app opens directly to Chat
- Endpoints `/api/chat` and `/api/translate` are public and do basic validation
- Costs/tokens are estimated heuristically on the server for display only

## License

MIT
