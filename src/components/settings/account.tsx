import { useRouter } from "@tanstack/react-router";
import { type SubmitEvent, useEffect, useRef, useState } from "react";

import { renameMe } from "#/functions/session.functions";
import { authClient } from "#/lib/auth-client";
import { textField } from "#/lib/form";

/** Who is signed in, with the name that signs their comments, which they can change here. */
export function Account({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) field.current?.select();
  }, [editing]);

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await renameMe({ data: { name: textField(new FormData(event.currentTarget), "name") } });
      setEditing(false);
      setError(null);
      await router.invalidate();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The name was not saved.");
    }
  }

  return (
    <div className="page-note account">
      {editing ? (
        <form className="account-name" onSubmit={(event) => void save(event)}>
          <label>
            <span className="sr-only">Your name</span>
            <input
              ref={field}
              name="name"
              defaultValue={name}
              maxLength={60}
              autoComplete="name"
              required
              onKeyDown={(event) => {
                if (event.key === "Escape") setEditing(false);
              }}
            />
          </label>
          <button type="submit" className="text-button">
            Save
          </button>
        </form>
      ) : (
        <p>
          Signed in as{" "}
          <button
            type="button"
            className="link-button"
            title="Change the name that signs your comments"
            onClick={() => setEditing(true)}
          >
            {name}
          </button>
          , {email}.{" "}
          <button
            type="button"
            className="link-button"
            onClick={() => void authClient.signOut().then(() => window.location.assign("/sign-in"))}
          >
            Sign out
          </button>
        </p>
      )}
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
