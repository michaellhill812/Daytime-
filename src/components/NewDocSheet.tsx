import { useEffect, useRef, useState } from 'react';
import Sheet from './Sheet';
import { useDaytimeState, useStore } from '../store/context';
import type { Doc } from '../types';

interface NewDocSheetProps {
  open: boolean;
  onClose: () => void;
  /** The Wall's active filter, used as the starting category. */
  defaultDomainId: string | null;
  onCreated: (doc: Doc) => void;
}

/**
 * The compose step for the Wall.
 *
 * Pinning something used to create an "Untitled" document with no category and
 * drop you straight into the editor, which meant the two things that make a
 * document findable — its name and its spoke — were the two you were most
 * likely to skip. Asking first costs one sheet and makes them the default
 * rather than an afterthought.
 */
export default function NewDocSheet({
  open,
  onClose,
  defaultDomainId,
  onCreated,
}: NewDocSheetProps) {
  const state = useDaytimeState();
  const store = useStore();

  const [title, setTitle] = useState('');
  const [domainId, setDomainId] = useState('');
  const [body, setBody] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  // Reopening starts clean, but inherits whichever spoke the Wall is filtered
  // to — if you're looking at Sessions, that's where the next thing goes.
  useEffect(() => {
    if (!open) return;
    setTitle('');
    setBody('');
    setDomainId(defaultDomainId ?? '');
    requestAnimationFrame(() => titleRef.current?.focus());
  }, [open, defaultDomainId]);

  if (!open) return null;

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    const doc = store.addDoc({
      title: trimmed,
      ...(domainId ? { domainId } : {}),
      ...(body.trim() ? { body } : {}),
    });
    onCreated(doc);
  };

  const accent = state.domains.find((d) => d.id === domainId)?.accent;

  return (
    <Sheet
      open
      onClose={onClose}
      title="Pin something"
      subtitle="Give it a name and a spoke so it can be found again."
      {...(accent ? { accent } : {})}
    >
      <div className="compose">
        <label className="compose__label" htmlFor="new-doc-title">
          Title
        </label>
        <input
          id="new-doc-title"
          ref={titleRef}
          className="field"
          value={title}
          placeholder="What is it?"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />

        <label className="compose__label" htmlFor="new-doc-domain">
          Spoke
        </label>
        <select
          id="new-doc-domain"
          className="field field--select"
          value={domainId}
          onChange={(e) => setDomainId(e.target.value)}
        >
          <option value="">No spoke</option>
          {state.domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <label className="compose__label" htmlFor="new-doc-body">
          Body
        </label>
        <textarea
          id="new-doc-body"
          className="field field--body"
          rows={6}
          value={body}
          placeholder="Optional — you can write this later."
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      <div className="row-actions">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={submit}
          disabled={!title.trim()}
        >
          Pin to Wall
        </button>
      </div>
    </Sheet>
  );
}
