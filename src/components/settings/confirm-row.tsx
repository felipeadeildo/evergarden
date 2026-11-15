import { type ReactNode, useState } from "react";

/** A row with an action that asks once, in the row itself, before it happens. */
export function ConfirmRow({
  icon,
  name,
  place,
  end,
  action,
  warning,
  confirm,
  onConfirm,
}: {
  icon: ReactNode;
  name: ReactNode;
  place: string;
  end: ReactNode;
  action: string;
  warning: string;
  confirm: string;
  onConfirm: () => Promise<unknown>;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li>
      <div className="row row-static">
        {icon}
        <span className="row-name">{name}</span>
        <span className="row-place">{place}</span>
        <span className="row-end">
          {end}
          <button
            type="button"
            className="row-action danger"
            aria-expanded={confirming}
            onClick={() => setConfirming(!confirming)}
          >
            {action}
          </button>
        </span>
        {confirming ? (
          <p className="row-confirm" role="alert">
            {warning}
            <button type="button" className="row-action danger" onClick={() => void onConfirm()}>
              {confirm}
            </button>
            <button type="button" className="row-action" onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </p>
        ) : null}
      </div>
    </li>
  );
}
