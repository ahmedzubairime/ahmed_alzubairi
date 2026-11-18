import type { TiptapDoc } from "@repo/shared";

/** The plain text of a Tiptap document, blocks separated by a space. */
export function docText(doc: TiptapDoc | null | undefined): string {
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node !== "object" || node === null) return;
    const { text, content } = node as { text?: unknown; content?: unknown };
    if (typeof text === "string") parts.push(text);
    if (Array.isArray(content)) {
      for (const child of content) walk(child);
      parts.push(" ");
    }
  };
  walk(doc);
  return parts.join("").replace(/\s+/g, " ").trim();
}
