import { Link } from "@tanstack/react-router";

import type { FolderStep } from "#/server/library";

/** Where a shared page sits, for a guest: the shared folders down to it, nothing above them. */
export function SharedPath({ path }: { path: FolderStep[] }) {
  if (path.length === 0) return null;
  return (
    <nav aria-label="Folder" className="shared-path">
      <ol>
        {path.map((step) => (
          <li key={step.id}>
            <Link to="/f/$id" params={{ id: step.id }}>
              {step.name}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
