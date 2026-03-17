"use client";

/* Global error boundary for locale pages. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0a0a12] text-white/80">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-white/50">{error.message}</p>
      <button
        onClick={reset}
        className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm transition-colors hover:bg-white/10"
      >
        Try again
      </button>
    </main>
  );
}
