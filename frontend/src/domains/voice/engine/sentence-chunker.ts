/**
 * Sentence Chunker — splits streaming tokens into speakable sentence fragments.
 *
 * As SSE tokens arrive one-by-one, we buffer them and emit complete sentences
 * for the TTS engine. This avoids:
 * - Sending single words to TTS (wasteful, robotic pauses)
 * - Waiting for the full response (defeats streaming UX)
 *
 * Strategy: emit on sentence-ending punctuation (. ! ? ; :) or after a
 * configurable max-characters threshold (for very long sentences).
 */

/** Punctuation marks that signal a sentence boundary. */
const SENTENCE_ENDINGS = /[.!?;]\s*$/;

/** Secondary break point — em dash, colon, ellipsis followed by space. */
const CLAUSE_BREAKS = /[:\u2014—]\s+$/;

/** Max characters before forcing a flush (prevents very long TTS waits). */
const MAX_BUFFER_LENGTH = 200;

/** Min characters before considering a sentence worth speaking. */
const MIN_SENTENCE_LENGTH = 10;

export class SentenceChunker {
  private buffer = "";
  private onSentence: (sentence: string) => void;

  constructor(onSentence: (sentence: string) => void) {
    this.onSentence = onSentence;
  }

  /**
   * Feed a new token into the chunker.
   * May trigger zero or more sentence emissions.
   */
  feed(token: string): void {
    this.buffer += token;

    // Check for natural sentence endings
    if (
      this.buffer.length >= MIN_SENTENCE_LENGTH &&
      SENTENCE_ENDINGS.test(this.buffer)
    ) {
      this.emit();
      return;
    }

    // Check for clause breaks (secondary, less aggressive)
    if (
      this.buffer.length >= MIN_SENTENCE_LENGTH * 2 &&
      CLAUSE_BREAKS.test(this.buffer)
    ) {
      this.emit();
      return;
    }

    // Force flush on very long buffers (e.g. code blocks, long lists)
    if (this.buffer.length >= MAX_BUFFER_LENGTH) {
      this.emit();
    }
  }

  /**
   * Flush any remaining buffered text. Call when the stream ends.
   */
  flush(): void {
    const text = this.buffer.trim();
    if (text.length > 0) {
      this.onSentence(text);
    }
    this.buffer = "";
  }

  /**
   * Reset the chunker without emitting.
   */
  reset(): void {
    this.buffer = "";
  }

  /** Emit the current buffer and clear it. */
  private emit(): void {
    const text = this.buffer.trim();
    if (text.length > 0) {
      this.onSentence(text);
    }
    this.buffer = "";
  }
}
