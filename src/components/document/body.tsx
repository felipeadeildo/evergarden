import type { Element, Root } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Children, type ComponentProps, isValidElement, useMemo } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";

import { CalloutIcons } from "#/components/ui/icons";
import { stringProperty } from "#/lib/hast";

import { CodeBlock } from "./code-block";
import { Diagram } from "./diagram";
import { Anchor, Paragraph } from "./links";

type WithNode<T extends keyof React.JSX.IntrinsicElements> = ComponentProps<T> & { node?: Element };

function Figure({ node, children, ...props }: WithNode<"figure">) {
  if (node?.properties.dataKind === "diagram") return <Diagram node={node} />;
  if (node?.properties.dataKind === "code") return <CodeBlock node={node}>{children}</CodeBlock>;
  return <figure {...props}>{children}</figure>;
}

function isCalloutKind(kind: string): kind is keyof typeof CalloutIcons {
  return kind in CalloutIcons;
}

function Aside({ node, children, ...props }: WithNode<"aside">) {
  const kind = node && stringProperty(node, "dataCallout");
  const Icon = kind && isCalloutKind(kind) ? CalloutIcons[kind] : null;
  if (!Icon) return <aside {...props}>{children}</aside>;
  return (
    <aside {...props}>
      {Children.map(children, (child) =>
        isValidElement<{ className?: string; children?: React.ReactNode }>(child) &&
        child.props.className === "callout-title" ? (
          <p className="callout-title">
            <Icon />
            {child.props.children}
          </p>
        ) : (
          child
        ),
      )}
    </aside>
  );
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
  a: Anchor,
  p: Paragraph,
  aside: Aside,
  figure: Figure,
  table: Table,
  h2: sectionHeading("h2"),
  h3: sectionHeading("h3"),
  h4: sectionHeading("h4"),
};

export function DocumentBody({ tree }: { tree: Root }) {
  const body = useMemo(
    () => toJsxRuntime(tree, { Fragment, jsx, jsxs, components, passNode: true }),
    [tree],
  );
  return <div className="prose">{body}</div>;
}
