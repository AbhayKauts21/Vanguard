const EXPLICIT_TAKEOVER_CUES = [
  "stop",
  "wait",
  "hold on",
  "actually",
  "no",
  "let me",
  "can you",
  "what about",
  "okay so",
  "ok so",
  "one sec",
  "one second",
];

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

const DIRECT_ADDRESS_PREFIXES = ["cleo", "hey cleo", "hey", "listen"];

const CONTINUATION_MARKERS = [
  "can",
  "could",
  "would",
  "should",
  "please",
  "what",
  "how",
  "why",
  "when",
  "where",
  "which",
  "compare",
  "tell",
  "show",
  "explain",
  "help",
  "instead",
  "actually",
  "but",
  "sorry",
];

const MIN_SINGLE_WORD_STABLE_MS = 260;
const MIN_MULTI_WORD_STABLE_MS = 180;

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

function startsWithPhrase(text: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => text === phrase || text.startsWith(`${phrase} `));
}

function hasContinuationShape(text: string, wordCount: number): boolean {
  if (text.includes("can you") || text.includes("could you")) {
    return true;
  }

  if (startsWithPhrase(text, DIRECT_ADDRESS_PREFIXES) && wordCount >= 2) {
    return true;
  }

  if (wordCount < 3) {
    return false;
  }

  const [firstWord = ""] = text.split(" ");
  return CONTINUATION_MARKERS.includes(firstWord);
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
  const wordCount = words.length;
  const hasExplicitCue = startsWithPhrase(normalized, EXPLICIT_TAKEOVER_CUES);

  if (FILLER_ACKNOWLEDGEMENTS.has(normalized)) {
    return false;
  }

  if (!hasExplicitCue && transcriptLooksLikeEcho(normalized, spokenText)) {
    return false;
  }

  if (wordCount === 1) {
    return hasExplicitCue && (isFinal || stableMs >= MIN_SINGLE_WORD_STABLE_MS);
  }

  if (hasExplicitCue) {
    return isFinal || stableMs >= MIN_MULTI_WORD_STABLE_MS;
  }

  if (startsWithPhrase(normalized, DIRECT_ADDRESS_PREFIXES) && wordCount >= 2) {
    return isFinal || stableMs >= MIN_MULTI_WORD_STABLE_MS;
  }

  if (!hasContinuationShape(normalized, wordCount)) {
    return false;
  }

  return isFinal || stableMs >= MIN_MULTI_WORD_STABLE_MS;
}
