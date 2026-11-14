import { type ReactNode, useEffect, useRef } from "react";

/**
 * A modal dialog that rises from the bottom on phones and sits in the middle on larger screens.
 * Built on <dialog>, so focus, Escape and the backdrop behave natively.
 */
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
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  // A click on the backdrop lands on the dialog itself; Escape already closes it natively.
  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialog}
      className={["sheet", className].filter(Boolean).join(" ")}
      aria-label={label}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      {open ? children : null}
    </dialog>
  );
}
