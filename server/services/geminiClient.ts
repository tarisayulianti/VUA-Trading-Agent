import { GoogleGenAI } from '@google/genai';

export type GeminiAvailabilityStatus = 'ONLINE' | 'PERMISSION_DENIED' | 'QUOTA_EXCEEDED' | 'UNAVAILABLE' | 'NOT_CONFIGURED';

interface GeminiState {
  client: GoogleGenAI | null;
  currentApiKey: string | null;
  status: GeminiAvailabilityStatus;
  lastFailureTime: number;
  lastFailureMessage: string | null;
  cooldownMs: number;
}

const state: GeminiState = {
  client: null,
  currentApiKey: null,
  status: 'ONLINE',
  lastFailureTime: 0,
  lastFailureMessage: null,
  cooldownMs: 5 * 60 * 1000, // 5 minutes cooldown before probing again
};

/**
 * Returns a configured GoogleGenAI instance or null if not configured or in cooldown.
 */
export function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length === 0) {
    state.status = 'NOT_CONFIGURED';
    return null;
  }

  // If the API key was updated in secrets, reset the client and cooldown
  if (apiKey !== state.currentApiKey) {
    state.currentApiKey = apiKey;
    state.status = 'ONLINE';
    state.lastFailureTime = 0;
    state.lastFailureMessage = null;
    try {
      state.client = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    } catch {
      state.client = null;
    }
  }

  // If currently in a cooldown state due to 403 / permission denied, bypass network calls
  if (state.status === 'PERMISSION_DENIED' || state.status === 'QUOTA_EXCEEDED') {
    const elapsed = Date.now() - state.lastFailureTime;
    if (elapsed < state.cooldownMs) {
      return null;
    }
    // Cooldown elapsed, permit a single probe
  }

  if (!state.client) {
    try {
      state.client = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    } catch {
      state.client = null;
    }
  }

  return state.client;
}

/**
 * Records a Gemini call error and adjusts the circuit breaker.
 * Prevents continuous failing network calls and suppresses noisy stack traces in server logs.
 */
export function handleGeminiApiError(err: any): void {
  state.lastFailureTime = Date.now();
  const errorMessage = err?.message || String(err);
  state.lastFailureMessage = errorMessage;

  const isPermissionDenied =
    err?.status === 403 ||
    errorMessage.includes('PERMISSION_DENIED') ||
    errorMessage.includes('denied access');

  const isQuotaExceeded =
    err?.status === 429 ||
    errorMessage.includes('RESOURCE_EXHAUSTED') ||
    errorMessage.includes('Quota exceeded');

  if (isPermissionDenied) {
    state.status = 'PERMISSION_DENIED';
    console.info(
      '[VUA Reasoning Engine] Gemini API returned 403 (Permission Denied). Seamlessly routing deliberation to the institutional quantitative reasoning engine.'
    );
  } else if (isQuotaExceeded) {
    state.status = 'QUOTA_EXCEEDED';
    console.info(
      '[VUA Reasoning Engine] Gemini API quota reached. Operating via institutional quantitative reasoning engine.'
    );
  } else {
    state.status = 'UNAVAILABLE';
    console.info(
      `[VUA Reasoning Engine] Gemini API temporary notice: ${errorMessage.slice(0, 100)}. Falling back to quantitative engine.`
    );
  }
}

/**
 * Returns current Gemini status for telemetry and UI badges
 */
export function getGeminiCircuitBreakerStatus(): {
  status: GeminiAvailabilityStatus;
  isAvailable: boolean;
  message: string | null;
} {
  const isAvailable =
    state.status === 'ONLINE' &&
    Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');

  return {
    status: state.status,
    isAvailable,
    message: state.lastFailureMessage,
  };
}
