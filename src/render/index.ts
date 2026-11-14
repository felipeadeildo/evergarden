import type { Root } from "hast";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema, type Options as Schema } from "rehype-sanitize";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { VFile } from "vfile";

import { remarkDollarMath } from "./dollar-math";
import {
  type Heading,
  rehypeEvergarden,
  rehypeStripPositions,
  remarkFrontmatterTitle,
} from "./plugins";

export type { Heading };

/** Part of every cache key for rendered trees: bump it whenever the output changes. */
export const RENDERER_VERSION = 4;

export type Rendered = {
  tree: Root;
  /** From frontmatter `title` or a leading `# heading`; the heading is then removed from `tree`. */
  title: string | null;
  headings: Heading[];
  /** Plain text of the body, for the search index. */
  text: string;
  /** Client code the page has to load. */
  features: { math: boolean; diagram: boolean };
};

const schema: Schema = {
  ...defaultSchema,
  // Footnote ids already carry `user-content-`; prefixing again would break their links.
  clobber: [],
  attributes: {
    ...defaultSchema.attributes,
    code: [["className", /^language-./, "math-inline", "math-display"]],
  },
};

/** Renders markdown into a sanitised hast tree whose blocks carry `data-sourcepos="start-end"`. */
export async function render(source: string): Promise<Rendered> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkFrontmatterTitle)
    .use(remarkGfm)
    // remark-math would read "$5 and $10" as math; remarkDollarMath reads $x$ the way Pandoc does.
    .use(remarkMath, { singleDollarTextMath: false })
    .use(remarkDollarMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, schema)
    .use(rehypeEvergarden)
    .use(rehypeKatex, { output: "htmlAndMathml" })
    .use(rehypeStripPositions);

  const file = new VFile(source);
  const tree = await processor.run(processor.parse(file), file);
  const data = file.data.evergarden ?? {};

  return {
    tree,
    title: data.title ?? null,
    headings: data.headings ?? [],
    text: data.text ?? "",
    features: data.features ?? { math: false, diagram: false },
  };
}
