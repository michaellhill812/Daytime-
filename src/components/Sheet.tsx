import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Tints the sheet's top hairline, so a domain keeps its identity when opened. */
  accent?: string;
  children: ReactNode;
}

/**
 * The one panel style in the app. Rendered through a portal because the views
 * are transformed during transitions, and a transformed ancestor would
 * otherwise capture `position: fixed`.
 */
export default function Sheet({ open, onClose, title, subtitle, accent, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="sheet-layer" data-gesture="block">
      <button
        type="button"
        className="sheet-scrim"
        aria-label="Close"
        onClick={onClose}
      />
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={accent ? ({ '--sheet-accent': accent } as React.CSSProperties) : undefined}
      >
        <header className="sheet__head">
          <div className="sheet__titles">
            <h2 className="sheet__title">{title}</h2>
            {subtitle && <p className="sheet__subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </button>
        </header>
        <div className="sheet__body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
