import type { Root } from "hast";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema, type Options as Schema } from "rehype-sanitize";
import remarkDirective from "remark-directive";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { VFile } from "vfile";

import { maskComarkClosers, remarkEvergardenDirectives } from "./directives";
import { remarkDollarMath } from "./dollar-math";
import {
  type Heading,
  rehypeEvergarden,
  rehypeStripPositions,
  remarkFrontmatterFields,
} from "./plugins";

export type { Heading };

/** Part of every cache key for rendered trees: bump it whenever the output changes. */
export const RENDERER_VERSION = 13;

export type Rendered = {
  tree: Root;
  /** From frontmatter `title` or a leading `# heading`; the heading is then removed from `tree`. */
  title: string | null;
  /** From frontmatter `summary`. */
  summary: string | null;
  /** Frontmatter `index: true`: the document readers of its folder start with. */
  entry: boolean;
  headings: Heading[];
  text: string;
  features: { math: boolean; diagram: boolean };
  /** Ids of the documents this one links to. */
  links: string[];
};

const schema: Schema = {
  ...defaultSchema,
  // Footnote ids already carry `user-content-`; prefixing again would break their links.
  clobber: [],
  attributes: {
    ...defaultSchema.attributes,
    code: [["className", /^language-./, "math-inline", "math-display"]],
    div: [...(defaultSchema.attributes?.div ?? []), "dataBlock", "dataTitle", "dataTab"],
    span: [...(defaultSchema.attributes?.span ?? []), "dataIcon"],
  },
};

export async function render(source: string): Promise<Rendered> {
  const { masked, closers } = maskComarkClosers(source);
  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkFrontmatterFields)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkEvergardenDirectives, closers, source)
    // remark-math would read "$5 and $10" as math; remarkDollarMath reads $x$ the way Pandoc does.
    .use(remarkMath, { singleDollarTextMath: false })
    .use(remarkDollarMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, schema)
    .use(rehypeEvergarden)
    .use(rehypeKatex, { output: "htmlAndMathml" })
    .use(rehypeStripPositions);

  // Same length as the source, so every offset in the tree points into the source too.
  const file = new VFile(masked);
  const tree = await processor.run(processor.parse(file), file);
  const data = file.data.evergarden ?? {};

  return {
    tree,
    title: data.title ?? null,
    summary: data.summary ?? null,
    entry: data.entry ?? false,
    headings: data.headings ?? [],
    text: data.text ?? "",
    features: data.features ?? { math: false, diagram: false },
    links: data.links ?? [],
  };
}
