/** Shared Web Speech API helpers used by both the Jarvis voice loop and the Malti dictionary. */

export function getSpeechRecognitionCtor(): { new (): SpeechRecognition } | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

/**
 * Detach handlers before aborting. abort() fires `onend` asynchronously, so a
 * still-attached handler would restart the very recognition we are replacing
 * and leave two instances competing for the microphone.
 */
export function detachAndAbort(ref: { current: SpeechRecognition | null }) {
  const recognition = ref.current;
  if (!recognition) return;
  recognition.onresult = null;
  recognition.onend = null;
  recognition.onerror = null;
  recognition.onstart = null;
  try {
    recognition.abort();
  } catch {
    // Aborting a recognition that never started throws in some browsers.
  }
  ref.current = null;
}

/** Prompts for microphone access and releases the track immediately. */
export async function requestMicrophone(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}

/**
 * Speaks `text`, resolving when playback finishes. Never rejects: a synthesis
 * failure must not tear down a caller's voice loop.
 */
export function speak(text: string, lang?: string): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve();
      return;
    }
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      if (lang) utterance.lang = lang;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch {
      resolve();
    }
  });
}
