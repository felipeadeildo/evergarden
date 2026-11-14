import type { Element } from "hast";

/** A string property of a hast element, such as `dataSourcepos`. */
export function stringProperty(node: Element, name: string): string | undefined {
  const value = node.properties[name];
  return typeof value === "string" ? value : undefined;
}
