'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  detachAndAbort,
  getSpeechRecognitionCtor,
  requestMicrophone,
  speak as speakText,
} from '@/lib/speech';
import { log } from '@/lib/jarvisLog';

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

/** Turns kept client-side. The server trims again; this just bounds memory growth. */
const MAX_HISTORY = 20;

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

export default function JarvisVoice() {
  const [status, setStatus] = useState<Status>('idle');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [textInput, setTextInput] = useState('');
  const [speechSupported, setSpeechSupported] = useState<boolean | null>(null);

  const wakeRecognitionRef = useRef<SpeechRecognition | null>(null);
  const commandRecognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldListenRef = useRef(false);
  const statusRef = useRef<Status>('idle');

  /**
   * Conversation history lives in a ref, not state. The recognition callbacks
   * that drive the voice loop are created once and re-invoke each other, so a
   * value captured from a render would freeze at that render's value and every
   * voice turn would be sent with the same stale history.
   */
  const historyRef = useRef<ChatMessage[]>([]);

  /** Breaks the mutual recursion between sendToJarvis and startWakeListening. */
  const startWakeListeningRef = useRef<() => void>(() => {});

  /** Keeps the ref and the rendered state in lockstep, so handlers that read
   *  statusRef never observe a status the UI has already moved past. */
  const updateStatus = useCallback((next: Status) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  useEffect(() => {
    const supported = getSpeechRecognitionCtor() !== null;
    setSpeechSupported(supported);
    log(
      supported ? 'info' : 'warn',
      'voice',
      supported
        ? 'SpeechRecognition available — wake word supported'
        : 'No SpeechRecognition in this browser — press-to-talk and text only',
      typeof navigator === 'undefined' ? undefined : navigator.userAgent,
    );
  }, []);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      detachAndAbort(wakeRecognitionRef);
      detachAndAbort(commandRecognitionRef);
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speak = useCallback(
    async (text: string) => {
      updateStatus('speaking');
      log('info', 'tts', 'Speaking reply', `${text.length} chars`);
      await speakText(text);
    },
    [updateStatus],
  );

  const sendToJarvis = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed) return;

      updateStatus('thinking');
      setTranscript(trimmed);
      setReply('');

      const outgoing: ChatMessage[] = [
        ...historyRef.current,
        { role: 'user', content: trimmed },
      ];
      historyRef.current = outgoing.slice(-MAX_HISTORY);

      log('info', 'api', 'POST /api/chat', `"${trimmed}" · ${outgoing.length} msg history`);
      const startedAt = Date.now();

      let replyText: string;
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed, history: outgoing }),
        });
        const data = await res.json();
        const elapsed = Date.now() - startedAt;

        if (data.reply) {
          log('success', 'api', `Reply in ${elapsed}ms`, data.reply);
        } else {
          log('error', 'api', `HTTP ${res.status} in ${elapsed}ms`, data.error ?? 'no reply field');
        }

        replyText = data.reply ?? data.error ?? "I couldn't reach the brain just now.";
        const assistantTurn: ChatMessage = { role: 'assistant', content: replyText };
        historyRef.current = [...historyRef.current, assistantTurn].slice(-MAX_HISTORY);
      } catch (error) {
        // Network failure: drop the user turn so a dead request doesn't
        // poison the next prompt with a question that was never answered.
        historyRef.current = historyRef.current.slice(0, -1);
        replyText = 'I lost connection reaching the server. Try again in a moment.';
        log('error', 'api', 'Request failed', error instanceof Error ? error.message : String(error));
      }

      setReply(replyText);
      await speak(replyText);

      if (shouldListenRef.current) {
        startWakeListeningRef.current();
      } else {
        updateStatus('idle');
      }
    },
    [speak, updateStatus],
  );

  const startCommandListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    detachAndAbort(wakeRecognitionRef);

    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    commandRecognitionRef.current = recognition;
    updateStatus('active-listening');
    setTranscript('');
    log('info', 'voice', 'Listening for your question');

    let finalTranscript = '';
    let settled = false;

    // onerror is followed by onend; guard so one utterance is sent once.
    const finish = () => {
      if (settled) return;
      settled = true;
      commandRecognitionRef.current = null;
      if (finalTranscript.trim()) {
        void sendToJarvis(finalTranscript);
      } else {
        log('warn', 'voice', 'Heard nothing usable, re-arming wake word');
        if (shouldListenRef.current) startWakeListeningRef.current();
        else updateStatus('idle');
      }
    };

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
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      log('warn', 'voice', `Recognition error: ${event.error}`);
      finish();
    };
    recognition.onend = finish;
    recognition.start();
  }, [sendToJarvis, updateStatus]);

  const startWakeListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    detachAndAbort(commandRecognitionRef);
    detachAndAbort(wakeRecognitionRef);

    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    wakeRecognitionRef.current = recognition;
    updateStatus('wake-listening');
    // The last exchange deliberately stays on screen while we wait for the
    // next wake word — clearing it here would erase the answer before it
    // could be read. sendToJarvis clears it when a new question starts.
    log('info', 'voice', 'Armed — listening for "Hey Jarvis"');

    // Chrome ends a continuous recognition every ~60s of quiet; restarting on
    // `end` is what keeps the wake word live indefinitely.
    const restartIfStillWanted = () => {
      if (!shouldListenRef.current || statusRef.current !== 'wake-listening') return;
      try {
        recognition.start();
      } catch {
        log('warn', 'voice', 'Restart threw, rebuilding recognition');
        setTimeout(() => {
          if (shouldListenRef.current) startWakeListeningRef.current();
        }, 300);
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i]?.[0]?.transcript ?? '';
        if (!WAKE_PATTERN.test(text)) continue;

        const afterWake = text.replace(WAKE_PATTERN, '').trim();
        log('success', 'voice', 'Wake word detected', text);
        detachAndAbort(wakeRecognitionRef);
        // "Hey Jarvis, what's my schedule" in one breath skips the second pass.
        if (afterWake.length > 3) void sendToJarvis(afterWake);
        else startCommandListening();
        return;
      }
    };
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        shouldListenRef.current = false;
        log('error', 'voice', 'Microphone permission denied by the browser');
        updateStatus('permission-denied');
        return;
      }
      log('warn', 'voice', `Wake recognition error: ${event.error}`);
      restartIfStillWanted();
    };
    recognition.onend = restartIfStillWanted;
    recognition.start();
  }, [sendToJarvis, startCommandListening, updateStatus]);

  useEffect(() => {
    startWakeListeningRef.current = startWakeListening;
  }, [startWakeListening]);

  const activate = useCallback(async () => {
    updateStatus('requesting-permission');
    log('info', 'mic', 'Requesting microphone access');
    if (!(await requestMicrophone())) {
      log('error', 'mic', 'Microphone access denied');
      updateStatus('permission-denied');
      return;
    }
    log('success', 'mic', 'Microphone granted');
    shouldListenRef.current = true;
    if (getSpeechRecognitionCtor()) startWakeListening();
    else updateStatus('unsupported');
  }, [startWakeListening, updateStatus]);

  const deactivate = useCallback(() => {
    shouldListenRef.current = false;
    detachAndAbort(wakeRecognitionRef);
    detachAndAbort(commandRecognitionRef);
    window.speechSynthesis?.cancel();
    log('info', 'voice', 'Stopped by user');
    updateStatus('idle');
  }, [updateStatus]);

  const pressToTalk = useCallback(async () => {
    if (status !== 'wake-listening' && status !== 'idle') return;
    if (!(await requestMicrophone())) {
      log('error', 'mic', 'Microphone access denied');
      updateStatus('permission-denied');
      return;
    }
    shouldListenRef.current = true;
    startCommandListening();
  }, [status, startCommandListening, updateStatus]);

  const submitText = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const message = textInput.trim();
      if (!message) return;
      setTextInput('');
      void sendToJarvis(message);
    },
    [textInput, sendToJarvis],
  );

  const listening = status === 'wake-listening' || status === 'active-listening';
  const busy = status === 'thinking' || status === 'speaking';
  const failed = status === 'permission-denied' || status === 'error';

  const dotColor = listening || failed ? 'bg-crimson' : busy ? 'bg-gold' : 'bg-edge-2';

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-md">
      <div className="relative flex flex-col items-center gap-4">
        <button
          onClick={status === 'idle' || failed ? activate : deactivate}
          className="relative w-40 h-40 rounded-full border border-edge-2 bg-ink-2 flex items-center justify-center transition active:scale-95"
          aria-label={status === 'idle' || failed ? 'Activate Jarvis' : 'Stop Jarvis'}
        >
          <span
            className={`absolute inset-0 rounded-full ${dotColor} opacity-20 ${
              listening || status === 'speaking' ? 'animate-ping' : ''
            }`}
          />
          <span className={`w-4 h-4 rounded-full ${dotColor}`} />
        </button>
        <p className="font-mono text-xs tracking-widest uppercase text-muted" role="status">
          {STATUS_LABEL[status]}
        </p>
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
          aria-label="Message Jarvis"
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
