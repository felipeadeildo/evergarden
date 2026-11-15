import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { Element } from "hast";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";

import { AttachIcon, DownloadIcon, FileIcon } from "#/components/ui/icons";
import { fileUrl, formatSize, MAX_FILE_BYTES } from "#/lib/files";
import { stringProperty } from "#/lib/hast";
import type { AttachedFile } from "#/server/db/schema";

type Files = {
  documentId: string;
  /** The version whose files these are, so a link never shows another version's copy. */
  version: number | "draft";
  byName: Map<string, AttachedFile>;
};

const FilesContext = createContext<Files | null>(null);

export function FilesProvider({
  documentId,
  version,
  files,
  children,
}: {
  documentId: string;
  version: number | "draft";
  files: AttachedFile[];
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ documentId, version, byName: new Map(files.map((file) => [file.name, file])) }),
    [documentId, version, files],
  );
  return <FilesContext value={value}>{children}</FilesContext>;
}

function useFile(node: Element | undefined): { file: AttachedFile; url: string } | null {
  const files = useContext(FilesContext);
  const name = node && stringProperty(node, "dataFile");
  const file = name ? files?.byName.get(name) : undefined;
  if (!files || !file) return null;
  return { file, url: fileUrl(files.documentId, file.name, files.version) };
}

type WithNode<T extends "a" | "img"> = ComponentProps<T> & { node?: Element };

/** `[the data](data.csv)`: a download with the file's size, when the version has that file. */
export function FileLink({ node, children, ...props }: WithNode<"a">) {
  const found = useFile(node);
  if (!found) return <a {...props}>{children}</a>;
  return (
    <a href={found.url} download={found.file.name} className="file-link">
      <DownloadIcon />
      {children}
      <span className="file-size">{formatSize(found.file.size)}</span>
    </a>
  );
}

/** `![chart](chart.png)`: the version's image, or the address as written when it has none. */
export function FileImage({ node, src, alt, ...props }: WithNode<"img">) {
  const found = useFile(node);
  return <img {...props} src={found?.url ?? src} alt={alt ?? ""} loading="lazy" />;
}

/**
 * Every file of the version, after the text. The owner attaches files here, by button or by
 * dropping them on the list; both add to the draft and then open it, ready to publish.
 */
export function FileList({ editable }: { editable: boolean }) {
  const files = useContext(FilesContext);
  const upload = useUpload();
  const [dropZone, dropping] = useDrop(editable, upload.send);
  const input = useRef<HTMLInputElement>(null);
  if (!files || (files.byName.size === 0 && !editable)) return null;

  return (
    <section
      ref={dropZone}
      aria-labelledby="files-heading"
      className="file-list"
      data-empty={files.byName.size === 0 || undefined}
      data-over={dropping || undefined}
    >
      <h2 id="files-heading" className={files.byName.size === 0 ? "sr-only" : undefined}>
        Files
      </h2>
      {files.byName.size > 0 ? (
        <ul>
          {[...files.byName.values()].map((file) => (
            <li key={file.name}>
              <FileIcon />
              <a href={fileUrl(files.documentId, file.name, files.version)} download={file.name}>
                {file.name}
              </a>
              <span className="file-size">{formatSize(file.size)}</span>
              {editable ? (
                <button
                  type="button"
                  className="row-action danger"
                  disabled={upload.pending}
                  onClick={() => void upload.remove(file.name)}
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {editable ? (
        <p className="file-attach">
          <button
            type="button"
            className="quiet-button"
            disabled={upload.pending}
            title={`Up to ${formatSize(MAX_FILE_BYTES)} each; use them in the text by name`}
            onClick={() => input.current?.click()}
          >
            <AttachIcon />
            {upload.pending ? "Attaching…" : "Attach files"}
          </button>
          <span>
            or drop them here, up to {formatSize(MAX_FILE_BYTES)} each. Use them in the text by
            name: <code>![chart](chart.png)</code>.
          </span>
          <input
            ref={input}
            type="file"
            multiple
            hidden
            onChange={(event) => void upload.send([...(event.currentTarget.files ?? [])])}
          />
        </p>
      ) : null}
      {upload.error ? (
        <p role="alert" className="form-error">
          {upload.error}
        </p>
      ) : null}
    </section>
  );
}

/** Dropping files on the list attaches them: a shortcut for the button beside it. */
function useDrop(enabled: boolean, send: (files: File[]) => Promise<void>) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(false);
  const dropped = useEffectEvent((files: File[]) => void send(files));

  useEffect(() => {
    if (!enabled || !element) return undefined;
    function onOver(event: DragEvent) {
      event.preventDefault();
      setActive(true);
    }
    function onLeave() {
      setActive(false);
    }
    function onDrop(event: DragEvent) {
      event.preventDefault();
      setActive(false);
      dropped([...(event.dataTransfer?.files ?? [])]);
    }
    element.addEventListener("dragover", onOver);
    element.addEventListener("dragleave", onLeave);
    element.addEventListener("drop", onDrop);
    return () => {
      element.removeEventListener("dragover", onOver);
      element.removeEventListener("dragleave", onLeave);
      element.removeEventListener("drop", onDrop);
    };
  }, [enabled, element]);

  return [setElement, active] as const;
}

type Change = { method: "PUT" | "DELETE"; name: string; file?: File };

/** Sends changes to the draft through the API, one file at a time, then opens the draft. */
function useUpload() {
  const files = useContext(FilesContext);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const change = useMutation({
    mutationFn: async (changes: Change[]) => {
      if (!files) return;
      for (const { method, name, file } of changes) {
        const url = `/api/v1/documents/${files.documentId}/files/${encodeURIComponent(name)}`;
        const response = await fetch(url, { method, body: file });
        if (!response.ok) {
          const failure: { message?: string } = await response.json();
          throw new Error(failure.message ?? `${name} could not be saved.`);
        }
      }
    },
    onSuccess: async () => {
      if (!files) return;
      queryClient.removeQueries({ queryKey: ["document", files.documentId] });
      await navigate({ to: "/d/$id", params: { id: files.documentId }, search: { v: "draft" } });
    },
  });

  return {
    pending: change.isPending,
    error: change.error?.message ?? null,
    send: (chosen: File[]) =>
      change.mutateAsync(chosen.map((file) => ({ method: "PUT", name: file.name, file }))),
    remove: (name: string) => change.mutateAsync([{ method: "DELETE", name }]),
  };
}
