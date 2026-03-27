/**
 * Unit tests for the SentenceChunker.
 *
 * Tests cover:
 * - Sentence boundary detection (period, exclamation, question, semicolon)
 * - Clause break detection (colon, em dash)
 * - Max buffer length forced flush
 * - Min sentence length gating
 * - Flush remaining text
 * - Reset behavior
 * - Multi-sentence streams
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SentenceChunker } from "@/domains/voice/engine/sentence-chunker";

describe("SentenceChunker", () => {
  let onSentence: ReturnType<typeof vi.fn<(sentence: string) => void>>;
  let chunker: SentenceChunker;

  beforeEach(() => {
    onSentence = vi.fn<(sentence: string) => void>();
    chunker = new SentenceChunker(onSentence);
  });

  describe("sentence boundary detection", () => {
    it("should emit on period followed by space/end", () => {
      chunker.feed("Hello world. ");
      expect(onSentence).toHaveBeenCalledTimes(1);
      expect(onSentence).toHaveBeenCalledWith("Hello world.");
    });

    it("should emit on exclamation mark", () => {
      chunker.feed("Great news! ");
      expect(onSentence).toHaveBeenCalledTimes(1);
      expect(onSentence).toHaveBeenCalledWith("Great news!");
    });

    it("should emit on question mark", () => {
      chunker.feed("How are you? ");
      expect(onSentence).toHaveBeenCalledTimes(1);
      expect(onSentence).toHaveBeenCalledWith("How are you?");
    });

    it("should emit on semicolon", () => {
      chunker.feed("First clause; ");
      expect(onSentence).toHaveBeenCalledTimes(1);
      expect(onSentence).toHaveBeenCalledWith("First clause;");
    });
  });

  describe("minimum sentence length", () => {
    it("should NOT emit very short fragments even with punctuation", () => {
      chunker.feed("OK. ");
      expect(onSentence).not.toHaveBeenCalled();
    });

    it("should emit when enough text accumulates past minimum", () => {
      chunker.feed("OK. ");
      chunker.feed("And then more text. ");
      expect(onSentence).toHaveBeenCalledTimes(1);
    });
  });

  describe("token-by-token feeding", () => {
    it("should accumulate tokens and emit on sentence boundary", () => {
      const tokens = ["Hello", " ", "world", ".", " "];
      for (const token of tokens) {
        chunker.feed(token);
      }
      expect(onSentence).toHaveBeenCalledTimes(1);
      expect(onSentence).toHaveBeenCalledWith("Hello world.");
    });

    it("should handle multiple sentences from streaming tokens", () => {
      const text = "First sentence. Second sentence. ";
      for (const char of text) {
        chunker.feed(char);
      }
      expect(onSentence).toHaveBeenCalledTimes(2);
      expect(onSentence).toHaveBeenNthCalledWith(1, "First sentence.");
      expect(onSentence).toHaveBeenNthCalledWith(2, "Second sentence.");
    });
  });

  describe("clause breaks", () => {
    it("should emit on colon after sufficient buffer length", () => {
      chunker.feed("Here is the explanation of the issue: ");
      expect(onSentence).toHaveBeenCalledTimes(1);
    });

    it("should emit on em dash after sufficient buffer length", () => {
      chunker.feed("The key finding was clear — ");
      expect(onSentence).toHaveBeenCalledTimes(1);
    });
  });

  describe("max buffer length", () => {
    it("should force flush on very long text without punctuation", () => {
      const longText = "a".repeat(201);
      chunker.feed(longText);
      expect(onSentence).toHaveBeenCalledTimes(1);
    });
  });

  describe("flush", () => {
    it("should emit remaining buffer on flush", () => {
      chunker.feed("Partial text");
      expect(onSentence).not.toHaveBeenCalled();

      chunker.flush();
      expect(onSentence).toHaveBeenCalledTimes(1);
      expect(onSentence).toHaveBeenCalledWith("Partial text");
    });

    it("should not emit empty buffer on flush", () => {
      chunker.flush();
      expect(onSentence).not.toHaveBeenCalled();
    });

    it("should not emit whitespace-only buffer on flush", () => {
      chunker.feed("   ");
      chunker.flush();
      expect(onSentence).not.toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("should clear buffer without emitting", () => {
      chunker.feed("Some buffered text");
      chunker.reset();

      expect(onSentence).not.toHaveBeenCalled();

      chunker.flush();
      expect(onSentence).not.toHaveBeenCalled();
    });
  });

  describe("multi-sentence stream", () => {
    it("should correctly split a paragraph into sentences", () => {
      const paragraph =
        "CLEO is an AI assistant. " +
        "It uses RAG for knowledge retrieval. " +
        "The vector store is Pinecone. ";

      // Feed token by token
      for (const char of paragraph) {
        chunker.feed(char);
      }

      expect(onSentence).toHaveBeenCalledTimes(3);
      expect(onSentence).toHaveBeenNthCalledWith(1, "CLEO is an AI assistant.");
      expect(onSentence).toHaveBeenNthCalledWith(2, "It uses RAG for knowledge retrieval.");
      expect(onSentence).toHaveBeenNthCalledWith(3, "The vector store is Pinecone.");
    });
  });
});
