import { type CallToolResult, createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { authorOf, type Principal } from "#/server/access";
import { EvergardenError } from "#/server/errors";
import { SYNTAX_GUIDE } from "#/server/guide";
import {
  type DocumentEntry,
  type FolderEntry,
  list,
  publish,
  read,
  search,
  update,
} from "#/server/library";

const INSTRUCTIONS = [
  "evergarden stores the documents you write for your user (reports, plans, specs, dossiers)",
  "and the comments they leave on them. Call `guide` before your first `publish` to learn the",
  "syntax and how your user wants documents written.",
].join(" ");

/** Serves one MCP request for an authorised principal. The server is stateless. */
export function serveMcp(request: Request, principal: Principal): Promise<Response> {
  const origin = new URL(request.url).origin;
  return createMcpHandler(() => mcpServer(principal, origin)).fetch(request);
}

function mcpServer(principal: Principal, origin: string): McpServer {
  const server = new McpServer(
    { name: "evergarden", version: "0.1.0" },
    { instructions: INSTRUCTIONS },
  );
  const author = authorOf(principal);
  const url = (id: string) => `${origin}/d/${id}`;

  server.registerTool(
    "guide",
    {
      description:
        "Returns the markdown evergarden renders and how your user wants documents written.",
      annotations: { readOnlyHint: true },
    },
    () => text(SYNTAX_GUIDE),
  );

  server.registerTool(
    "publish",
    {
      description:
        "Creates a document and returns its id and URL. Publishing content identical to an existing document returns that document.",
      inputSchema: z.object({
        content: z
          .string()
          .describe("The markdown. Its frontmatter title or first heading becomes the title."),
        title: z
          .string()
          .optional()
          .describe("Used only when the content has no title of its own."),
        folder: z
          .string()
          .optional()
          .describe('A folder path such as "reports/2026", created when missing.'),
        repo: z
          .string()
          .optional()
          .describe(
            "The git remote of the repository you are working in. Files the document in its linked folder.",
          ),
      }),
    },
    (input) =>
      run(async () => {
        const result = await publish(input, author);
        const verb = result.created ? "Published" : "Already published as";
        return `${verb} ${result.id}, version ${result.version}: ${url(result.id)}`;
      }),
  );

  server.registerTool(
    "update",
    {
      description:
        "Saves a new version of a document. Comments stay attached to the text they point at.",
      inputSchema: z.object({
        id: z.string(),
        content: z.string().describe("The complete new markdown, not a patch."),
        base_version: z
          .int()
          .positive()
          .optional()
          .describe(
            "The version your change is based on. The call fails if a newer version exists.",
          ),
      }),
    },
    ({ id, content, base_version }) =>
      run(async () => {
        const result = await update(id, { content, baseVersion: base_version }, author);
        return result.changed
          ? `Saved version ${result.version} of ${id}: ${url(id)}`
          : `Nothing changed; ${id} stays at version ${result.version}.`;
      }),
  );

  server.registerTool(
    "read",
    {
      description: "Returns a document's markdown, the current version unless `version` is given.",
      inputSchema: z.object({ id: z.string(), version: z.int().positive().optional() }),
      annotations: { readOnlyHint: true },
    },
    ({ id, version }) =>
      run(async () => {
        const result = await read(id, version);
        const header = `<!-- evergarden ${id}, version ${result.version.number} of ${result.document.version}, ${url(id)} -->`;
        return `${header}\n${result.source}`;
      }),
  );

  server.registerTool(
    "list",
    {
      description:
        "Lists folders and documents as a tree, optionally only one folder or one repository's folder.",
      inputSchema: z.object({
        folder: z.string().optional().describe('A folder path such as "reports/2026".'),
        repo: z.string().optional().describe("A git remote URL."),
      }),
      annotations: { readOnlyHint: true },
    },
    (filter) => run(async () => formatTree(await list(filter))),
  );

  server.registerTool(
    "search",
    {
      description: "Searches titles and text. Every word must match, as a prefix.",
      inputSchema: z.object({ query: z.string() }),
      annotations: { readOnlyHint: true },
    },
    ({ query }) =>
      run(async () => {
        const hits = await search(query);
        if (hits.length === 0) return `No documents match "${query}".`;
        return hits.map((hit) => `- ${hit.title} (${hit.id})\n  ${hit.excerpt}`).join("\n");
      }),
  );

  return server;
}

function text(value: string): CallToolResult {
  return { content: [{ type: "text", text: value }] };
}

async function run(action: () => Promise<string>): Promise<CallToolResult> {
  try {
    return text(await action());
  } catch (error) {
    if (error instanceof EvergardenError) return { ...text(error.message), isError: true };
    throw error;
  }
}

function byPosition(a: { position: string }, b: { position: string }): number {
  return a.position < b.position ? -1 : 1;
}

function formatTree({
  folders,
  documents,
}: {
  folders: FolderEntry[];
  documents: DocumentEntry[];
}): string {
  if (folders.length === 0 && documents.length === 0) return "No documents.";
  const known = new Set(folders.map((entry) => entry.id));
  const lines: string[] = [];

  function printFolder(entry: FolderEntry, depth: number) {
    lines.push(`${"  ".repeat(depth)}${entry.name}/${entry.repo ? `  (${entry.repo})` : ""}`);
    printChildren(entry.id, depth + 1);
  }

  function printChildren(parentId: string | null, depth: number) {
    for (const entry of folders.filter((f) => f.parentId === parentId).toSorted(byPosition)) {
      printFolder(entry, depth);
    }
    for (const entry of documents.filter((d) => d.folderId === parentId).toSorted(byPosition)) {
      const date = entry.updatedAt.toISOString().slice(0, 10);
      lines.push(
        `${"  ".repeat(depth)}${entry.title}  ${entry.id}  v${entry.version}, ${date} by ${entry.updatedBy}`,
      );
    }
  }

  printChildren(null, 0);
  // A list filtered to one folder starts at that folder, whose parent is not in the result.
  const subtreeRoots = folders.filter((entry) => entry.parentId && !known.has(entry.parentId));
  for (const root of subtreeRoots.toSorted(byPosition)) printFolder(root, 0);
  return lines.join("\n");
}
