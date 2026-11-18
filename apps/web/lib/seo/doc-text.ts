import type { TiptapDoc } from "@repo/shared";

/**
 * The plain text of a Tiptap document: blocks and hard breaks separated by a
 * space, adjacent text runs (a bold word part) joined as they are.
 */
export function docText(doc: TiptapDoc | null | undefined): string {
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node !== "object" || node === null) return;
    const { type, text, content } = node as { type?: unknown; text?: unknown; content?: unknown };
    // A line break inside a paragraph still separates words.
    if (type === "hardBreak") parts.push(" ");
    if (typeof text === "string") parts.push(text);
    if (Array.isArray(content)) {
      for (const child of content) walk(child);
      parts.push(" ");
    }
  };
  walk(doc);
  return parts.join("").replace(/\s+/g, " ").trim();
}
