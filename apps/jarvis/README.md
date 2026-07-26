# Jarvis

Jake's voice-driven AI assistant. A installable web app (PWA) — no app store, no native build — that listens for **"Hey Jarvis"**, talks back, and answers through Claude.

## What it actually does today

Three screens, sharing one brain and one event log:

| Screen | What it is |
| --- | --- |
| `/` — **Assistant** | The voice loop: **mic → wake word → speech-to-text → Claude → text-to-speech** |
| `/dashboard` — **Daily** | Motivation, practical tips, your sign, and today's training session |
| `/malti` — **Malti** | Context-aware Maltese dictionary: root, origin, plurals/conjugation, real usage |
| `/vault` — **Vault** | Password-gated private section |
| `/debug` — **Debug** | Live trace of the microphone, wake word and API calls |

Everything else on the Jarvis roadmap (Drive, Calendar, WhatsApp, Spotify, the driver module, …) is a connector to bolt on later — see `docs/JARVIS-PHASE-0.md` in the planning package for the full backlog.

### Malti — the dictionary

The point is to be worth more than Google Translate, so an entry carries what a translator drops:

- **Origin and root.** Maltese is Semitic (from Siculo-Arabic) written in Latin script, so words of Semitic origin sit on a consonantal root — `ktieb` (book) shares `k-t-b` with `kiteb` (he wrote) and `kittieb` (writer). Roughly half the vocabulary is instead Sicilian/Italian or English, and those have no root; the entry says which you are looking at.
- **Real inflection.** Broken plurals (`ktieb → kotba`, `tifel → tfal`) rather than a suffix rule, and the perfect conjugation across all persons for verbs.
- **Usage, not just meaning.** Register, frequency, and the traps — including how the article `il-` assimilates before sun letters (`ix-xemx`, `id-dar`, `it-tfal`).

Entries come back through structured outputs, so the shape is guaranteed rather than parsed hopefully. A word it does not know is reported as unknown instead of being invented.

Note that browsers ship **no Maltese voice or acoustic model**, so "Hear" and "Speak" fall back to your device's default language and only approximate the pronunciation. Typing is the reliable path.

### Debug — why it exists

A phone has no devtools, and this app's failure modes are silent: a speech recognition that stops re-arming is indistinguishable from nobody talking, and a denied microphone looks like a quiet room. `/debug` records every microphone request, wake-word match, API call with its latency, and speech-synthesis handoff, plus what the device itself supports (secure context, wake-word capability, whether it is running installed or in a tab). "Copy" lifts the whole log out as text.

The log is in memory only. It is never sent anywhere and clears when the app closes.

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
│   ├── page.tsx             the assistant screen
│   ├── malti/page.tsx       the dictionary
│   ├── debug/page.tsx       the debug console
│   ├── layout.tsx           PWA meta, manifest link, fonts
│   ├── globals.css
│   └── api/
│       ├── chat/route.ts    server route → Claude (the "brain")
│       └── malti/route.ts   dictionary lookup, structured output
├── components/
│   ├── JarvisVoice.tsx      wake word, press-to-talk, TTS, text fallback
│   ├── MaltiDictionary.tsx  lookup UI and entry rendering
│   ├── DebugConsole.tsx     live event log + device capabilities
│   └── BrandHeader.tsx      shared header and section nav
├── lib/
│   ├── speech.ts            shared Web Speech helpers
│   └── jarvisLog.ts         in-memory event log the debug console subscribes to
├── types/web-speech.d.ts    Web Speech API declarations (absent from TS's default lib)
├── public/
│   ├── manifest.json        PWA manifest (installable, standalone display)
│   ├── sw.js                minimal offline-shell service worker
│   └── icons/               app icons (192/512/maskable/apple-touch)
└── .env.example
```

### A note for whoever touches the voice loop next

The loop is driven by Web Speech callbacks that outlive the render which created them, which makes stale closures the dominant hazard here. Conversation state therefore lives in a **ref**, and the callbacks are kept stable — capturing state from a render freezes it there, and every later spoken turn silently sends the frozen value. Likewise, always `detachAndAbort` a recognition rather than calling `abort()` directly: `abort()` fires `onend` asynchronously, and a live handler will restart the instance you were replacing, leaving two competing for the microphone.

## Env vars

| Var | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Jarvis's brain. Get one at console.anthropic.com. Never commit it — `.env` is gitignored. |
| `JARVIS_VAULT_PASSWORD` | No | Unlocks `/vault`. Unset means the vault stays **closed**, not open. |

### What the vault gate actually does

The password is verified on the server with a constant-time comparison and is never sent to the
browser. Unlocking mints a 12-hour token signed with that password and stores it in an httpOnly
cookie, which JavaScript cannot read. `/vault` is `force-dynamic` and renders the private component
only after verifying that token, so the content is never in the HTML or the JS bundle for someone who
merely knows the URL. Repeated wrong guesses are rate-limited.

What it does **not** do is encrypt what the browser stores after unlocking. Notes live in
`localStorage` in the clear, so anyone who can unlock the device and open developer tools can read
them. It is a lock on the door, not a safe.

## Next slice

Per `docs/JARVIS-PHASE-0.md`: wire up Supabase for persistent memory/state, then ship the Daily Email Brief as the first connector-backed workflow.
