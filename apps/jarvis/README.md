# Jarvis

Jake's voice-driven AI assistant. A installable web app (PWA) — no app store, no native build — that listens for **"Hey Jarvis"**, talks back, and answers through Claude.

## What it actually does today

This is Phase 0: one page, one voice loop, one brain. It proves the pipeline end to end:

**mic → wake word → speech-to-text → Claude → text-to-speech**

Everything else on the Jarvis roadmap (Drive, Calendar, WhatsApp, Spotify, the driver module, …) is a connector to bolt on later — see `docs/JARVIS-PHASE-0.md` in the planning package for the full backlog.

## The one real platform limit

**True hands-free "Hey Jarvis" wake-word listening only works in Chrome on Android** (or desktop Chrome/Edge). That's not a bug in this app — Apple's WebKit/Safari does not expose a speech-recognition API to web pages at all, on iPhone or iPad, even inside an installed PWA. There is no web workaround for that; only a native Swift app could do true background voice recognition on iOS.

This app handles it automatically:
- **Chrome/Android**: tap the circle once, grant the mic permission, and it listens continuously for "Hey Jarvis" while the app is open.
- **iPhone/Safari or any other browser**: the circle switches to a **press-to-talk** button, plus a text box to type to Jarvis. Jarvis still *talks back* everywhere (text-to-speech is universally supported) — only *listening* for the wake word is Chrome/Android-only.

Also note, on **every** platform: a web page (PWA or not) can only listen while it's open in the foreground. No browser lets a web page listen with the screen off or the app backgrounded — that's a deliberate OS privacy restriction, not something this app can route around.

## Run it locally

```bash
corepack enable
pnpm install
cp apps/jarvis/.env.example apps/jarvis/.env
# put a real key in apps/jarvis/.env — get one at https://console.anthropic.com
pnpm --filter @ta-spiru/jarvis dev   # http://localhost:3002
```

## Deploy (Vercel)

1. Import this repo into Vercel, set the project root to `apps/jarvis`.
2. Add the `ANTHROPIC_API_KEY` environment variable in the Vercel project settings.
3. Deploy. Vercel serves over HTTPS by default — required for microphone access in the browser.

## Install it on your phone

- **Android (Chrome)**: open the deployed URL → Chrome menu (⋮) → **Add to Home screen** → **Install**. Launching it from the home screen icon gives it the full-screen standalone app look, and the mic/wake-word flow works exactly as in the browser tab.
- **iPhone (Safari)**: open the deployed URL → Share icon → **Add to Home Screen**. You get the app icon and full-screen look; use press-to-talk or the text box for input, since iOS Safari has no speech-recognition API to grant permission to.

The first time you tap the circle (or press-to-talk), the browser will prompt for microphone access — accept it. If you accidentally deny it, re-enable it from the site's permissions in your browser settings and reload.

## What's in this app

```
apps/jarvis/
├── app/
│   ├── page.tsx          the one screen
│   ├── layout.tsx        PWA meta, manifest link, fonts
│   ├── globals.css
│   └── api/chat/route.ts server route → Anthropic API (the "brain")
├── components/
│   └── JarvisVoice.tsx   wake-word detection, press-to-talk, TTS, text fallback
├── lib/speech.d.ts       Web Speech API type declarations (not in default TS lib)
├── public/
│   ├── manifest.json     PWA manifest (installable, standalone display)
│   ├── sw.js             minimal offline-shell service worker
│   └── icons/            app icons (192/512/maskable/apple-touch)
└── .env.example
```

## Env vars

| Var | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Jarvis's brain. Get one at console.anthropic.com. Never commit it — `.env` is gitignored. |

## Next slice

Per `docs/JARVIS-PHASE-0.md`: wire up Supabase for persistent memory/state, then ship the Daily Email Brief as the first connector-backed workflow.
