import type { Element } from "hast";

export function stringProperty(node: Element, name: string): string | undefined {
  const value = node.properties[name];
  return typeof value === "string" ? value : undefined;
}
