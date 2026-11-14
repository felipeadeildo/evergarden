import type { Element, Root } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { type ComponentProps, useMemo } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";

import { CodeBlock } from "./code-block";
import { Diagram } from "./diagram";

type WithNode<T extends keyof React.JSX.IntrinsicElements> = ComponentProps<T> & { node?: Element };

function Figure({ node, children, ...props }: WithNode<"figure">) {
  if (node?.properties.dataKind === "diagram") return <Diagram node={node} />;
  if (node?.properties.dataKind === "code") return <CodeBlock node={node}>{children}</CodeBlock>;
  return <figure {...props}>{children}</figure>;
}

function Table({ node: _node, ...props }: WithNode<"table">) {
  // Wide tables scroll inside the column instead of widening the page on a phone.
  return (
    <div className="table-scroll">
      <table {...props} />
    </div>
  );
}

function sectionHeading(Tag: "h2" | "h3" | "h4") {
  return function Heading({ node: _node, id, children, ...props }: WithNode<typeof Tag>) {
    return (
      <Tag id={id} {...props}>
        {children}
        {id ? (
          <a className="heading-link" href={`#${id}`} aria-label="Link to this section">
            §
          </a>
        ) : null}
      </Tag>
    );
  };
}

const components = {
  figure: Figure,
  table: Table,
  h2: sectionHeading("h2"),
  h3: sectionHeading("h3"),
  h4: sectionHeading("h4"),
};

/** The rendered markdown of one version, as React elements. */
export function DocumentBody({ tree }: { tree: Root }) {
  const body = useMemo(
    () => toJsxRuntime(tree, { Fragment, jsx, jsxs, components, passNode: true }),
    [tree],
  );
  return <div className="prose">{body}</div>;
}
