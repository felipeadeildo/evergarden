import { type RefObject, useEffect, useRef } from "react";

/** Opens and closes a <dialog> as a modal to follow `open`, so focus and Escape behave natively. */
export function useModal(open: boolean): RefObject<HTMLDialogElement | null> {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return dialog;
}
