'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Status =
  | 'idle'
  | 'requesting-permission'
  | 'wake-listening'
  | 'active-listening'
  | 'thinking'
  | 'speaking'
  | 'permission-denied'
  | 'unsupported'
  | 'error';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const WAKE_PATTERN = /\bhey,?\s*jarvis\b/i;
const STATUS_LABEL: Record<Status, string> = {
  idle: 'Tap to activate',
  'requesting-permission': 'Requesting microphone access…',
  'wake-listening': 'Listening for "Hey Jarvis"',
  'active-listening': 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
  'permission-denied': 'Microphone access denied',
  unsupported: 'Voice input not supported in this browser',
  error: 'Something went wrong',
};

function getSpeechRecognitionCtor(): { new (): SpeechRecognition } | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export default function JarvisVoice() {
  const [status, setStatus] = useState<Status>('idle');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [textInput, setTextInput] = useState('');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [speechSupported, setSpeechSupported] = useState<boolean | null>(null);

  const wakeRecognitionRef = useRef<SpeechRecognition | null>(null);
  const commandRecognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldListenRef = useRef(false);
  const statusRef = useRef<Status>('idle');
  statusRef.current = status;

  useEffect(() => {
    setSpeechSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  const speak = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        resolve();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      setStatus('speaking');
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const sendToJarvis = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed) return;
      setStatus('thinking');
      setTranscript(trimmed);
      const nextHistory: ChatMessage[] = [...history, { role: 'user', content: trimmed }];
      setHistory(nextHistory);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed, history: nextHistory }),
        });
        const data = await res.json();
        const replyText: string = data.reply ?? data.error ?? "I couldn't reach the brain just now.";
        setReply(replyText);
        setHistory((h) => [...h, { role: 'assistant', content: replyText }]);
        await speak(replyText);
      } catch {
        const errText = 'I lost connection reaching the server. Try again in a moment.';
        setReply(errText);
        await speak(errText);
      }

      if (shouldListenRef.current) {
        startWakeListening();
      } else {
        setStatus('idle');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [history, speak],
  );

  const startCommandListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    wakeRecognitionRef.current?.abort();

    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    commandRecognitionRef.current = recognition;
    setStatus('active-listening');
    setTranscript('');

    let finalTranscript = '';
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) finalTranscript += text;
        else interim += text;
      }
      setTranscript(finalTranscript || interim);
    };
    recognition.onerror = () => {
      if (finalTranscript.trim()) sendToJarvis(finalTranscript);
      else if (shouldListenRef.current) startWakeListening();
      else setStatus('idle');
    };
    recognition.onend = () => {
      if (finalTranscript.trim()) sendToJarvis(finalTranscript);
      else if (shouldListenRef.current) startWakeListening();
      else setStatus('idle');
    };
    recognition.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendToJarvis]);

  const startWakeListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    commandRecognitionRef.current?.abort();

    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    wakeRecognitionRef.current = recognition;
    setStatus('wake-listening');
    setTranscript('');
    setReply('');

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result?.[0]?.transcript ?? '';
        if (WAKE_PATTERN.test(text)) {
          const afterWake = text.replace(WAKE_PATTERN, '').trim();
          recognition.abort();
          if (afterWake.length > 3) {
            sendToJarvis(afterWake);
          } else {
            startCommandListening();
          }
          return;
        }
      }
    };
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        shouldListenRef.current = false;
        setStatus('permission-denied');
        return;
      }
      if (shouldListenRef.current && statusRef.current === 'wake-listening') {
        try {
          recognition.start();
        } catch {
          setTimeout(() => shouldListenRef.current && startWakeListening(), 300);
        }
      }
    };
    recognition.onend = () => {
      if (shouldListenRef.current && statusRef.current === 'wake-listening') {
        try {
          recognition.start();
        } catch {
          setTimeout(() => shouldListenRef.current && startWakeListening(), 300);
        }
      }
    };
    recognition.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendToJarvis, startCommandListening]);

  const activate = useCallback(async () => {
    setStatus('requesting-permission');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setStatus('permission-denied');
      return;
    }
    shouldListenRef.current = true;
    if (getSpeechRecognitionCtor()) {
      startWakeListening();
    } else {
      setStatus('unsupported');
    }
  }, [startWakeListening]);

  const deactivate = useCallback(() => {
    shouldListenRef.current = false;
    wakeRecognitionRef.current?.abort();
    commandRecognitionRef.current?.abort();
    window.speechSynthesis?.cancel();
    setStatus('idle');
  }, []);

  const pressToTalk = useCallback(async () => {
    if (status === 'wake-listening' || status === 'idle') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        setStatus('permission-denied');
        return;
      }
      shouldListenRef.current = true;
      startCommandListening();
    }
  }, [status, startCommandListening]);

  const submitText = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!textInput.trim()) return;
      const message = textInput.trim();
      setTextInput('');
      sendToJarvis(message);
    },
    [textInput, sendToJarvis],
  );

  const dotColor =
    status === 'wake-listening' || status === 'active-listening'
      ? 'bg-crimson'
      : status === 'thinking' || status === 'speaking'
        ? 'bg-gold'
        : status === 'permission-denied' || status === 'error'
          ? 'bg-crimson'
          : 'bg-edge-2';

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-md">
      <div className="relative flex flex-col items-center gap-4">
        <button
          onClick={status === 'idle' || status === 'permission-denied' ? activate : deactivate}
          className="relative w-40 h-40 rounded-full border border-edge-2 bg-ink-2 flex items-center justify-center transition active:scale-95"
          aria-label="Toggle Jarvis"
        >
          <span
            className={`absolute inset-0 rounded-full ${dotColor} opacity-20 ${
              status === 'wake-listening' || status === 'active-listening' || status === 'speaking'
                ? 'animate-ping'
                : ''
            }`}
          />
          <span className={`w-4 h-4 rounded-full ${dotColor}`} />
        </button>
        <p className="font-mono text-xs tracking-widest uppercase text-muted">{STATUS_LABEL[status]}</p>
      </div>

      {(status === 'wake-listening' || status === 'idle') && speechSupported && (
        <button
          onClick={pressToTalk}
          className="font-mono text-xs tracking-widest uppercase border border-edge rounded-full px-4 py-2 text-muted hover:text-text hover:border-edge-2 transition"
        >
          Press to talk
        </button>
      )}

      {speechSupported === false && (
        <p className="text-center text-sm text-muted max-w-sm">
          This browser can&rsquo;t listen for &ldquo;Hey Jarvis&rdquo; — voice recognition in the browser is
          Chrome/Android only right now. Use the text box below, or open this page in Chrome on Android for
          hands-free wake-word listening.
        </p>
      )}

      {status === 'permission-denied' && (
        <p className="text-center text-sm text-crimson max-w-sm">
          Microphone access was denied. Enable it in your browser/site settings, then tap the button again.
        </p>
      )}

      {(transcript || reply) && (
        <div className="w-full rounded-xl border border-edge bg-ink-2 p-4 space-y-2">
          {transcript && (
            <p className="text-sm text-text">
              <span className="text-gold font-mono text-xs mr-2">YOU</span>
              {transcript}
            </p>
          )}
          {reply && (
            <p className="text-sm text-text">
              <span className="text-crimson font-mono text-xs mr-2">JARVIS</span>
              {reply}
            </p>
          )}
        </div>
      )}

      <form onSubmit={submitText} className="w-full flex gap-2">
        <input
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Type to Jarvis instead…"
          className="min-w-0 flex-1 rounded-full border border-edge bg-ink-2 px-4 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-edge-2"
        />
        <button
          type="submit"
          className="rounded-full border border-edge-2 bg-ink-3 px-4 py-2 text-sm text-text hover:border-gold transition"
        >
          Send
        </button>
      </form>
    </div>
  );
}
