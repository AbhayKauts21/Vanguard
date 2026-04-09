export const INTERRUPT_KEYWORD_PHRASES = [
  "stop talking",
  "hold on",
  "okay cleo",
  "ok cleo",
  "cleo stop",
  "please stop",
  "stop",
  "pause",
  "wait",
  "enough",
  "cancel",
  "quiet",
] as const;

const FILLER_ACKNOWLEDGEMENTS = new Set([
  "okay",
  "ok",
  "yeah",
  "yep",
  "hmm",
  "mm",
  "uh",
  "uhh",
  "right",
]);

const LEADING_DISCARD_WORDS = new Set([
  "and",
  "a",
  "an",
  "but",
  "there",
  "then",
  "just",
  "please",
  "okay",
  "ok",
  "well",
  "so",
  "um",
  "uh",
  "hey",
  "one",
  "sec",
  "second",
  "seconds",
  "minute",
  "moment",
]);

const CONTINUATION_STARTERS = new Set([
  "about",
  "can",
  "could",
  "compare",
  "describe",
  "explain",
  "give",
  "help",
  "how",
  "list",
  "show",
  "summarize",
  "tell",
  "what",
  "when",
  "where",
  "which",
  "why",
  "would",
]);

const MIN_SINGLE_WORD_STABLE_MS = 120;
const MIN_MULTI_WORD_STABLE_MS = 90;

export interface InterruptIntentInput {
  transcript: string;
  spokenText?: string;
  isFinal: boolean;
  stableMs: number;
}

export function normalizeInterruptTranscript(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitWords(text: string): string[] {
  return normalizeInterruptTranscript(text).split(" ").filter(Boolean);
}

function findInterruptKeywordPrefix(text: string): string | null {
  const normalized = normalizeInterruptTranscript(text);
  const sortedKeywords = [...INTERRUPT_KEYWORD_PHRASES].sort(
    (left, right) => right.length - left.length,
  );

  return (
    sortedKeywords.find(
      (phrase) => normalized === phrase || normalized.startsWith(`${phrase} `),
    ) ?? null
  );
}

export function extractInterruptContinuation(transcript: string): string {
  const normalized = normalizeInterruptTranscript(transcript);
  const matchedPhrase = findInterruptKeywordPrefix(normalized);

  if (!matchedPhrase) {
    return "";
  }

  const remainder = normalized.slice(matchedPhrase.length).trim();
  if (!remainder) {
    return "";
  }

  const words = remainder.split(" ").filter(Boolean);
  while (words.length > 0 && LEADING_DISCARD_WORDS.has(words[0] ?? "")) {
    words.shift();
  }

  if (words.length === 0) {
    return "";
  }

  if (words.length === 1 && !CONTINUATION_STARTERS.has(words[0] ?? "")) {
    return "";
  }

  return words.join(" ").trim();
}

export function transcriptLooksLikeEcho(
  transcript: string,
  spokenText: string,
): boolean {
  const candidate = normalizeInterruptTranscript(transcript);
  const spoken = normalizeInterruptTranscript(spokenText);

  if (!candidate || !spoken) {
    return false;
  }

  if (spoken.includes(candidate) || candidate.includes(spoken)) {
    return true;
  }

  const candidateWords = splitWords(candidate);
  const spokenWords = new Set(splitWords(spoken));

  if (candidateWords.length === 0) {
    return false;
  }

  const overlap = candidateWords.filter((word) => spokenWords.has(word)).length;
  return overlap / candidateWords.length >= 0.8;
}

export function isInterruptIntent({
  transcript,
  spokenText = "",
  isFinal,
  stableMs,
}: InterruptIntentInput): boolean {
  const normalized = normalizeInterruptTranscript(transcript);
  if (!normalized) {
    return false;
  }

  const words = normalized.split(" ").filter(Boolean);
  const matchedKeyword = findInterruptKeywordPrefix(normalized);

  if (FILLER_ACKNOWLEDGEMENTS.has(normalized)) {
    return false;
  }

  if (!matchedKeyword && transcriptLooksLikeEcho(normalized, spokenText)) {
    return false;
  }

  if (!matchedKeyword) {
    return false;
  }

  if (
    extractInterruptContinuation(normalized) === "" &&
    transcriptLooksLikeEcho(normalized, spokenText)
  ) {
    return false;
  }

  const minStableMs =
    words.length === 1 ? MIN_SINGLE_WORD_STABLE_MS : MIN_MULTI_WORD_STABLE_MS;

  return isFinal || stableMs >= minStableMs;
}
