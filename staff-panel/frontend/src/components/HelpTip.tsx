import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type Props = {
  /** Accessible name for the ? button (Dutch). */
  label: string;
  /** Help body — never include secrets. */
  children: ReactNode;
  /** Optional wider panel */
  wide?: boolean;
};

/**
 * Dark-neon "?" help control: click/Enter toggles a small panel.
 * Accessible: aria-expanded, aria-controls, Escape to close.
 */
export function HelpTip({ label, children, wide }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className={`help-tip${wide ? ' help-tip--wide' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="help-tip__btn"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open ? (
        <span
          id={panelId}
          className="help-tip__panel"
          role="note"
          aria-live="polite"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}

/** Label row with inline HelpTip. */
export function LabelWithHelp({
  htmlFor,
  text,
  helpLabel,
  help,
}: {
  htmlFor?: string;
  text: string;
  helpLabel: string;
  help: ReactNode;
}) {
  return (
    <label className="server-label label-with-help" htmlFor={htmlFor}>
      <span>{text}</span>
      <HelpTip label={helpLabel}>{help}</HelpTip>
    </label>
  );
}
