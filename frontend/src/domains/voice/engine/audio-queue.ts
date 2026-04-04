/**
 * Audio Queue — sequential playback of audio chunks using Web Audio API.
 *
 * This version uses AudioBufferSourceNode for maximum reliability and
 * precision across all browsers (including Safari).
 */

export interface AudioQueueCallbacks {
  onAudioLevel: (level: number) => void;
  onQueueDrained: () => void;
  onChunkStart: (index: number) => void;
  onError: (error: string) => void;
}

interface QueueItem {
  arrayBuffer: ArrayBuffer;
  index: number;
}

export class AudioQueue {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private animationFrameId: number | null = null;
  private callbacks: AudioQueueCallbacks;
  private itemCounter = 0;
  private stopped = false;

  constructor(callbacks: AudioQueueCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Enqueue an audio blob for playback.
   */
  async enqueue(blob: Blob): Promise<void> {
    if (this.stopped) return;

    if (blob.size === 0) {
      console.warn("[AudioQueue] Received empty blob, ignoring.");
      return;
    }

    try {
      const arrayBuffer = await blob.arrayBuffer();
      this.queue.push({ arrayBuffer, index: this.itemCounter++ });

      if (!this.isProcessing) {
        this.processQueue();
      }
    } catch (err) {
      console.error("[AudioQueue] Failed to prepare audio buffer:", err);
      this.callbacks.onError("Failed to prepare audio data.");
    }
  }

  stop(): void {
    this.stopped = true;
    this.queue = [];
    this.isProcessing = false;

    this.stopAnalyserLoop();

    if (this.currentSource) {
      try { this.currentSource.stop(); } catch { /* ignore */ }
      this.currentSource = null;
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      try { this.audioContext.close(); } catch { /* ignore */ }
      this.audioContext = null;
    }

    this.callbacks.onAudioLevel(0);
  }

  reset(): void {
    this.stop();
    this.stopped = false;
    this.itemCounter = 0;
  }

  /**
   * Clear all pending items in the queue without stopping the currently
   * playing chunk. Used for mid-speech sentiment hot-swaps.
   */
  clearPending(): void {
    this.queue = [];
  }

  async resume(): Promise<void> {
    await this.ensureAudioContext();
  }

  get active(): boolean {
    return this.isProcessing || this.queue.length > 0;
  }

  private async processQueue(): Promise<void> {
    if (this.stopped || this.queue.length === 0) {
      this.isProcessing = false;
      this.callbacks.onAudioLevel(0);
      this.callbacks.onQueueDrained();
      return;
    }

    this.isProcessing = true;
    const item = this.queue.shift()!;

    try {
      await this.ensureAudioContext();
      if (!this.audioContext) throw new Error("AudioContext not available.");

      this.callbacks.onChunkStart(item.index);

      // Decode the audio data
      const audioBuffer = await this.audioContext.decodeAudioData(item.arrayBuffer);
      
      // Create source node
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      this.currentSource = source;

      // Connect to analyser and then destination
      source.connect(this.analyser!);
      
      // Start analyser loop
      this.startAnalyserLoop();

      // Play and wait
      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
        source.start(0);
      });

      this.stopAnalyserLoop();
      this.currentSource = null;

      // Play next
      this.processQueue();
    } catch (err) {
      console.error(`[AudioQueue] Error processing chunk ${item.index}:`, err);
      this.callbacks.onError(err instanceof Error ? err.message : "Audio processing error.");
      
      this.stopAnalyserLoop();
      if (this.queue.length > 0) {
        this.processQueue();
      } else {
        this.isProcessing = false;
        this.callbacks.onQueueDrained();
      }
    }
  }

  private async ensureAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state !== "closed") {
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }
      return;
    }

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      this.analyser.connect(this.audioContext.destination);
    } catch (err) {
      console.error("[AudioQueue] Failed to initialize AudioContext:", err);
    }
  }

  private startAnalyserLoop(): void {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const tick = () => {
      if (!this.analyser || this.stopped) {
        this.callbacks.onAudioLevel(0);
        return;
      }

      this.analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const normalizedLevel = Math.min(1, average / 128);

      this.callbacks.onAudioLevel(normalizedLevel);
      this.animationFrameId = requestAnimationFrame(tick);
    };

    tick();
  }

  private stopAnalyserLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.callbacks.onAudioLevel(0);
  }
}
