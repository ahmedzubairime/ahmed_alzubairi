import type { TiptapDoc } from "@repo/shared";
import { describe, expect, it } from "vitest";
import { docText } from "./doc-text";

describe("docText", () => {
  it("joins a document's text, blocks separated by a space", () => {
    const doc = {
      type: "doc" as const,
      content: [
        { type: "paragraph", content: [{ type: "text", text: "First" }, { type: "text", text: " line." }] },
        { type: "heading", content: [{ type: "text", text: "Second" }] },
      ],
    };
    expect(docText(doc)).toBe("First line. Second");
    expect(docText(null)).toBe("");
  });

  it("separates words across a hard break, but not across formatting runs", () => {
    const doc: TiptapDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "First" },
            { type: "hardBreak" },
            { type: "text", text: "Sec" },
            { type: "text", text: "ond", marks: [{ type: "bold" }] },
          ],
        },
      ],
    };
    expect(docText(doc)).toBe("First Second");
  });
});
