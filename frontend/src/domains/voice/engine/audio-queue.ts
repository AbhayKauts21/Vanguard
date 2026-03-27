/**
 * Audio Queue — sequential playback of audio chunks.
 *
 * TTS sentences are synthesized independently and arrive as audio Blobs.
 * This queue ensures they play back in order without overlapping, and
 * provides real-time audio level data via a Web Audio API AnalyserNode
 * for energy core avatar synchronization.
 *
 * Features:
 * - Sequential FIFO playback (no overlaps)
 * - AnalyserNode for real-time frequency data → avatar sync
 * - Graceful stop + flush
 * - Pause/resume support
 * - Callback on audio level change (60fps)
 */

export interface AudioQueueCallbacks {
  /** Called ~60fps with normalized audio level 0-1. */
  onAudioLevel: (level: number) => void;
  /** Called when all queued audio has finished playing. */
  onQueueDrained: () => void;
  /** Called when a chunk starts playing. */
  onChunkStart: (index: number) => void;
  /** Called on playback error. */
  onError: (error: string) => void;
}

interface QueueItem {
  blob: Blob;
  index: number;
}

export class AudioQueue {
  private queue: QueueItem[] = [];
  private isPlaying = false;
  private currentAudio: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private animationFrameId: number | null = null;
  private callbacks: AudioQueueCallbacks;
  private itemCounter = 0;
  private stopped = false;

  constructor(callbacks: AudioQueueCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Enqueue an audio blob for playback.
   * If nothing is currently playing, starts immediately.
   */
  enqueue(blob: Blob): void {
    if (this.stopped) return;

    this.queue.push({ blob, index: this.itemCounter++ });

    if (!this.isPlaying) {
      this.playNext();
    }
  }

  /**
   * Stop all playback, clear the queue, release resources.
   */
  stop(): void {
    this.stopped = true;
    this.queue = [];
    this.isPlaying = false;

    this.stopAnalyserLoop();

    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = "";
      this.currentAudio = null;
    }

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }

    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch { /* safe */ }
      this.sourceNode = null;
    }

    if (this.analyser) {
      try { this.analyser.disconnect(); } catch { /* safe */ }
      this.analyser = null;
    }

    if (this.audioContext) {
      try { this.audioContext.close(); } catch { /* safe */ }
      this.audioContext = null;
    }

    this.callbacks.onAudioLevel(0);
  }

  /**
   * Reset the queue for reuse (e.g. new voice turn).
   */
  reset(): void {
    this.stop();
    this.stopped = false;
    this.itemCounter = 0;
  }

  /** True if audio is currently playing or queued. */
  get active(): boolean {
    return this.isPlaying || this.queue.length > 0;
  }

  /** Number of items waiting in the queue (not including current). */
  get pending(): number {
    return this.queue.length;
  }

  // ────────────────────────────────────────────────

  private async playNext(): Promise<void> {
    if (this.stopped || this.queue.length === 0) {
      this.isPlaying = false;
      this.callbacks.onAudioLevel(0);
      this.callbacks.onQueueDrained();
      return;
    }

    this.isPlaying = true;
    const item = this.queue.shift()!;

    try {
      // Create audio element
      const objectUrl = URL.createObjectURL(item.blob);
      this.currentObjectUrl = objectUrl;

      const audio = new Audio(objectUrl);
      audio.preload = "auto";
      this.currentAudio = audio;

      this.callbacks.onChunkStart(item.index);

      // Ensure audio context is ready
      await this.ensureAudioContext();

      // Connect to analyser for level data
      this.connectAnalyser(audio);

      // Start analyser animation loop
      this.startAnalyserLoop();

      // Wait for the audio to finish
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("Audio playback failed."));

        audio.play().catch(reject);
      });

      // Cleanup this chunk
      this.stopAnalyserLoop();
      URL.revokeObjectURL(objectUrl);
      this.currentObjectUrl = null;
      this.currentAudio = null;

      if (this.sourceNode) {
        try { this.sourceNode.disconnect(); } catch { /* safe */ }
        this.sourceNode = null;
      }

      // Play next in queue
      this.playNext();
    } catch (err) {
      this.isPlaying = false;
      this.callbacks.onAudioLevel(0);
      this.callbacks.onError(
        err instanceof Error ? err.message : "Audio playback error.",
      );

      // Try to continue with next chunk despite error
      if (this.queue.length > 0) {
        this.playNext();
      } else {
        this.callbacks.onQueueDrained();
      }
    }
  }

  private async ensureAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state !== "closed") {
      // Resume if suspended (browser autoplay policy)
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }
      return;
    }

    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyser.connect(this.audioContext.destination);
  }

  private connectAnalyser(audio: HTMLAudioElement): void {
    if (!this.audioContext || !this.analyser) return;

    try {
      this.sourceNode = this.audioContext.createMediaElementSource(audio);
      this.sourceNode.connect(this.analyser);
    } catch {
      // MediaElementSource can only be created once per element — fallback
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

      // Calculate RMS-style average level, normalized to 0-1
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
  }
}
