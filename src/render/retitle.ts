import { toString } from "mdast-util-to-string";
import remarkFrontmatter from "remark-frontmatter";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { parseDocument } from "yaml";

type Edit = { start: number; end: number; text: string };

/**
 * The markdown with a new title where the renderer reads it: the frontmatter `title`, and the
 * leading `# heading` when it is the title shown. With neither, a heading goes on top.
 */
export function retitle(markdown: string, title: string): string {
  const name = title.replace(/\s+/g, " ").trim();
  const tree = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).parse(markdown);
  const [first, second] = tree.children;
  const yaml = first?.type === "yaml" ? first : undefined;
  const lead = yaml ? second : first;
  const heading = lead?.type === "heading" && lead.depth === 1 ? lead : undefined;
  const edits: Edit[] = [];

  let frontmatterTitle: string | undefined;
  if (yaml?.position) {
    const fields = parseDocument(yaml.value);
    if (fields.errors.length === 0 && fields.has("title")) {
      frontmatterTitle = String(fields.get("title"));
      fields.set("title", name);
      edits.push({
        start: yaml.position.start.offset ?? 0,
        end: yaml.position.end.offset ?? 0,
        text: `---\n${fields.toString()}---`,
      });
    }
  }

  const headingShowsTitle =
    frontmatterTitle === undefined || toString(heading) === frontmatterTitle;
  if (heading?.position && headingShowsTitle) {
    edits.push({
      start: heading.position.start.offset ?? 0,
      end: heading.position.end.offset ?? 0,
      text: `# ${name}`,
    });
  }

  if (edits.length === 0) {
    const top = yaml?.position?.end.offset ?? 0;
    const before = markdown.slice(0, top);
    const after = markdown.slice(top).replace(/^\n+/, "");
    return `${before}${top ? "\n\n" : ""}# ${name}\n\n${after}`;
  }

  return edits
    .toSorted((a, b) => b.start - a.start)
    .reduce((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), markdown);
}
