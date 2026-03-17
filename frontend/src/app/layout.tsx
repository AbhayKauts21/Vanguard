import type { ReactNode } from "react";

/* Root layout — required by Next.js. Locale layout handles full HTML shell. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
