/**
 * Strips markdown characters from a string to make it suitable for speech synthesis.
 * Removes headers, bold, italics, links, and list markers.
 */
export function stripMarkdown(text: string): string {
  if (!text) return "";

  return text
    // Remove headers (### Header)
    .replace(/^#+\s+/gm, "")
    // Remove bold/italics (**bold**, *italic*, __bold__, _italic_)
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    // Remove links ([text](url)) -> just text
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    // Remove inline code (`code`)
    .replace(/`(.*?)`/g, "$1")
    // Remove list markers (* item, - item, 1. item)
    .replace(/^[*-]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    // Clean up multiple spaces and newlines
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
