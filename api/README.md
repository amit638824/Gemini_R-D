# API — Gemini Live Chief of Staff

## Local

```bash
copy .env.example .env   # set GEMINI_API_KEY
npm install
npm run dev
```

## Build (JS → dist) + run prod

```bash
npm install
npm run build
npm start
```

Deploy target defaults: `https://apigemini.techwagger.com`

- Health: `/api/health`  
- Swagger: `/api/docs`  
- Live WS: `wss://apigemini.techwagger.com/ws/live`
