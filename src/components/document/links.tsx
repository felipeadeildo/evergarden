import { Link } from "@tanstack/react-router";
import type { Element } from "hast";
import { type ComponentProps, createContext, type ReactNode, useContext, useMemo } from "react";

import { DocumentIcon } from "#/components/ui/icons";
import { RelativeTime } from "#/components/ui/relative-time";
import { stringProperty } from "#/lib/hast";
import type { LinkedDocument } from "#/server/library";

import { FileLink } from "./files";

/** The documents a page links to that its reader may open, and the ids of those they may not. */
export type DocumentLinks = { open: LinkedDocument[]; hidden: string[] };

type Known = { open: Map<string, LinkedDocument>; hidden: Set<string> };

const LinksContext = createContext<Known>({ open: new Map(), hidden: new Set() });

export function LinksProvider({ links, children }: { links?: DocumentLinks; children: ReactNode }) {
  const known = useMemo(
    () => ({
      open: new Map((links?.open ?? []).map((entry) => [entry.id, entry])),
      hidden: new Set(links?.hidden ?? []),
    }),
    [links],
  );
  return <LinksContext value={known}>{children}</LinksContext>;
}

type Props<T extends "a" | "p"> = ComponentProps<T> & { node?: Element };

/**
 * A link to another document opens it in place and shows its current title when the text was only
 * its address. A reader who may not open it sees the text alone.
 */
export function Anchor({ node, children, ...props }: Props<"a">) {
  const { open, hidden } = useContext(LinksContext);
  if (node && stringProperty(node, "dataFile")) {
    return (
      <FileLink node={node} {...props}>
        {children}
      </FileLink>
    );
  }
  const id = node && stringProperty(node, "dataDocument");
  if (!id) return <a {...props}>{children}</a>;
  if (hidden.has(id)) return <span>{children}</span>;
  const target = open.get(id);
  if (!target) return <a {...props}>{children}</a>;
  const bare = node.properties.dataBare !== undefined;
  return (
    <Link to="/d/$id" params={{ id }} className="document-link">
      <DocumentIcon />
      {bare ? target.title : children}
    </Link>
  );
}

/** A paragraph that is only a link to a document: a card with its title, folder and age. */
export function Paragraph({ node, children, ...props }: Props<"p">) {
  const { open } = useContext(LinksContext);
  const link = node?.properties.dataCard === undefined ? undefined : node.children[0];
  const id = link?.type === "element" ? stringProperty(link, "dataDocument") : undefined;
  const target = id ? open.get(id) : undefined;
  if (!target) return <p {...props}>{children}</p>;
  return (
    <p {...props} className="document-card">
      <Link to="/d/$id" params={{ id: target.id }}>
        <DocumentIcon />
        <span className="document-card-title">{target.title}</span>
        {target.summary ? <span className="document-card-summary">{target.summary}</span> : null}
        <span className="document-card-meta">
          {target.folder ? `${target.folder}, ` : ""}version {target.version}, updated{" "}
          <RelativeTime date={target.updatedAt} />
        </span>
      </Link>
    </p>
  );
}
