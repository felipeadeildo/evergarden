import type { ReactNode } from "react";

import { useModal } from "./modal";

/** Rises from the bottom on phones and sits in the middle on larger screens. */
export function Sheet({
  open,
  onClose,
  label,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const dialog = useModal(open, onClose);

  return (
    <dialog
      ref={dialog}
      className={["sheet", className].filter(Boolean).join(" ")}
      aria-label={label}
      onClose={onClose}
    >
      {open ? children : null}
    </dialog>
  );
}
