import { type CallToolResult, createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { sentence } from "#/lib/sharing";
import { authorOf, type Principal } from "#/server/access";
import {
  acceptSuggestion,
  addReply,
  commentOn,
  openComments,
  openCount,
  resolve,
} from "#/server/comments";
import { EvergardenError } from "#/server/errors";
import { GUIDE_TOPICS, guide } from "#/server/guide";
import {
  type DocumentEntry,
  type FolderEntry,
  getDocument,
  list,
  publish,
  read,
  search,
  update,
} from "#/server/library";
import { discardDraft, editDraft, getDraft, publishDraft } from "#/server/library/drafts";
import { findFolder, parseFolderPath } from "#/server/library/folders";
import { setSharing, sharingOf } from "#/server/sharing";

const INSTRUCTIONS = [
  "evergarden stores the documents you write for your user (reports, plans, specs, dossiers)",
  "and the comments they leave on them. Call `guide` before your first `publish` to learn the",
  "syntax and how your user wants documents written. When your user mentions comments, call",
  "`open_comments`, then reply, update the document and resolve each thread you addressed.",
].join(" ");

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
      description: [
        "How to write for evergarden. Call it without a topic before your first publish: it",
        "returns the essentials and what else you can write. Then call it with a topic when you",
        "need one: figures (timelines, decisions, checklists, boards, stats), diagrams (which",
        "Mermaid diagram fits, charts with legends), formulas (what a query computes, beside its",
        "code) or icons (inline icon names).",
      ].join(" "),
      inputSchema: {
        topic: z
          .enum(GUIDE_TOPICS)
          .optional()
          .describe("Leave out for the essentials and the list of topics."),
      },
      annotations: { readOnlyHint: true },
    },
    ({ topic }) => text(guide(topic)),
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
        content: z
          .string()
          .describe("The complete new markdown. To change a few passages, use `edit` instead."),
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
    "edit",
    {
      description:
        "Replaces passages in a document's draft, starting the draft from the current version if there is none. Readers see nothing until `publish_draft`. Each `old` must appear exactly once, unless `all` is set.",
      inputSchema: z.object({
        id: z.string(),
        edits: z
          .array(
            z.object({
              old: z
                .string()
                .describe("The exact text to replace, with enough around it to be unique."),
              new: z.string(),
              all: z.boolean().optional().describe("Replace every occurrence."),
            }),
          )
          .min(1),
      }),
    },
    ({ id, edits }) =>
      run(async () => {
        const draft = await editDraft(id, edits, author);
        return `Draft of ${id} on version ${draft.baseVersion}: ${draft.edits} edits so far. Call publish_draft when it is ready.`;
      }),
  );

  server.registerTool(
    "publish_draft",
    {
      description:
        "Saves the draft as the document's next version and moves open comments onto it.",
      inputSchema: z.object({ id: z.string() }),
    },
    ({ id }) =>
      run(async () => {
        const result = await publishDraft(id);
        return result.changed
          ? `Saved version ${result.version} of ${id}: ${url(id)}`
          : `The draft matched version ${result.version}; nothing changed.`;
      }),
  );

  server.registerTool(
    "discard_draft",
    {
      description: "Throws away a document's draft.",
      inputSchema: z.object({ id: z.string() }),
      annotations: { destructiveHint: true },
    },
    ({ id }) =>
      run(async () => {
        await discardDraft(id);
        return `Discarded the draft of ${id}.`;
      }),
  );

  server.registerTool(
    "read",
    {
      description:
        "Returns a document's markdown: the current version, an older `version`, or your `draft`.",
      inputSchema: z.object({
        id: z.string(),
        version: z.int().positive().optional(),
        draft: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    ({ id, version, draft }) =>
      run(async () => {
        if (draft) {
          const current = await getDraft(id);
          if (!current) return `${id} has no draft. Call edit to start one.`;
          return `<!-- evergarden ${id}, draft on version ${current.baseVersion}, ${current.edits} edits -->\n${current.markdown}`;
        }
        const [result, open] = await Promise.all([read(id, version), openCount(id)]);
        const comments = open
          ? `, ${open} open comment${open === 1 ? "" : "s"} (call open_comments)`
          : "";
        const header = `<!-- evergarden ${id}, version ${result.version.number} of ${result.document.version}${comments}, ${url(id)} -->`;
        return `${header}\n${result.source}`;
      }),
  );

  server.registerTool(
    "open_comments",
    {
      description:
        "Returns open comments as markdown: on one document, or on every document with the ones you have not seen first. Each shows the passage it points at, any suggested replacement and the thread.",
      inputSchema: z.object({ id: z.string().optional().describe("A document id; omit for all.") }),
    },
    ({ id }) => run(() => openComments(id)),
  );

  server.registerTool(
    "comment",
    {
      description:
        "Opens a comment on a passage of a document's current version, to ask your user something about it. Quote the passage exactly as it appears in the markdown.",
      inputSchema: z.object({
        id: z.string(),
        passage: z.string().describe("Text that appears exactly once in the current markdown."),
        body: z.string(),
      }),
    },
    ({ id, passage, body }) =>
      run(async () => `Commented ${await commentOn(id, { passage, body }, author)} on ${url(id)}`),
  );

  server.registerTool(
    "reply",
    {
      description: "Replies in a comment's thread.",
      inputSchema: z.object({ comment_id: z.string(), body: z.string() }),
    },
    ({ comment_id, body }) =>
      run(async () => {
        await addReply(comment_id, body, author);
        return `Replied on ${comment_id}.`;
      }),
  );

  server.registerTool(
    "resolve",
    {
      description:
        "Closes a comment's thread, usually after an update that addresses it. The note, one line on what changed, is posted as the last reply.",
      inputSchema: z.object({ comment_id: z.string(), note: z.string().optional() }),
    },
    ({ comment_id, note }) =>
      run(async () => {
        await resolve(comment_id, author, note);
        return `Resolved ${comment_id}.`;
      }),
  );

  server.registerTool(
    "accept_suggestion",
    {
      description:
        "Applies a comment's suggested replacement as a new version of the document, then resolves the comment.",
      inputSchema: z.object({ comment_id: z.string() }),
    },
    ({ comment_id }) =>
      run(
        async () =>
          `Saved version ${await acceptSuggestion(comment_id, author)} with the suggestion.`,
      ),
  );

  server.registerTool(
    "share",
    {
      description:
        "Sets who besides your user can open a document or a folder (and everything in it). Call it only when your user asks. Without `who`, returns the current setting.",
      inputSchema: z.object({
        id: z.string().optional().describe("A document id. Give this or `folder`."),
        folder: z.string().optional().describe('A folder path such as "reports/2026".'),
        who: z
          .enum(["only_me", "people", "link"])
          .optional()
          .describe("only_me stops sharing; people needs `people`; link is anyone with the URL."),
        people: z
          .array(z.string())
          .optional()
          .describe('Emails and whole domains, such as "ana@acme.com" or "@acme.com".'),
        can: z.enum(["read", "comment"]).default("read"),
        versions: z.enum(["current", "all"]).default("current"),
        expires_in_days: z.int().positive().optional(),
      }),
    },
    (input) =>
      run(async () => {
        const target = await shareTarget(input.id, input.folder);
        if (input.who) {
          await setSharing(
            target,
            input.who === "only_me"
              ? null
              : {
                  audience: input.who,
                  people: input.people ?? [],
                  permission: input.can,
                  versions: input.versions,
                  expiresInDays: input.expires_in_days ?? null,
                },
          );
        }
        const state = await sharingOf(target);
        const alone = state.inherited.length
          ? "Not shared on its own."
          : "Only your user can open it.";
        const lines = [state.own ? sentence(state.own) : alone];
        for (const above of state.inherited) {
          lines.push(`Through the folder ${above.through.name}: ${sentence(above)}`);
        }
        if (target.kind === "document") lines.push(url(target.id));
        return lines.join("\n");
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

async function shareTarget(id?: string, path?: string) {
  if (id) {
    await getDocument(id);
    return { kind: "document" as const, id };
  }
  const folderId = path ? await findFolder(parseFolderPath(path)) : null;
  if (!folderId)
    throw new EvergardenError("not_found", "Give a document id or an existing folder path.");
  return { kind: "folder" as const, id: folderId };
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
