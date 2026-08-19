import Sheet from './Sheet';
import Diagram from './Diagram';
import TaskRow from './TaskRow';
import { useDaytimeState, useStore } from '../store/context';
import { domainById, tasksForDoc } from '../store/selectors';
import { useNow } from '../hooks/useNow';
import { formatShortDay } from '../lib/date';

const KIND_LABEL: Record<string, string> = {
  note: 'Note',
  link: 'Link',
  image: 'Image',
  file: 'File',
};

/** Wall document detail, openable from any view. */
export default function DocSheet({
  docId,
  onClose,
}: {
  docId: string | null;
  onClose: () => void;
}) {
  const state = useDaytimeState();
  const store = useStore();
  const now = useNow();

  const doc = state.docs.find((d) => d.id === docId);
  if (!doc) return null;

  const domain = domainById(state, doc.domainId);
  const referencing = tasksForDoc(state, doc.id);

  return (
    <Sheet
      open
      onClose={onClose}
      title={doc.title}
      subtitle={`${KIND_LABEL[doc.kind] ?? 'Item'}${domain ? ` · ${domain.name}` : ''} · updated ${formatShortDay(new Date(doc.updatedAt))}`}
      accent={domain?.accent}
    >
      {doc.diagram && <Diagram name={doc.diagram} />}

      {/* Size to the content and let the sheet scroll: a long reference document
          is unreadable through a six-row porthole. */}
      <textarea
        className="field field--body"
        value={doc.body ?? ''}
        placeholder="Write it down…"
        rows={Math.min(Math.max((doc.body ?? '').split('\n').length + 1, 6), 80)}
        onChange={(e) => store.updateDoc(doc.id, { body: e.target.value })}
      />

      {doc.url && (
        <a className="linkout" href={doc.url} target="_blank" rel="noreferrer">
          {doc.url}
        </a>
      )}

      {/* Renaming and re-filing both have to be possible here: this is the only
          place either can be changed after the fact, and documents written
          before the Wall asked for a spoke have none at all. */}
      <div className="compose compose--inline">
        <label className="compose__label" htmlFor="doc-title">
          Title
        </label>
        <input
          id="doc-title"
          className="field"
          value={doc.title}
          placeholder="Untitled"
          onChange={(e) => store.updateDoc(doc.id, { title: e.target.value })}
        />

        <label className="compose__label" htmlFor="doc-domain">
          Spoke
        </label>
        <select
          id="doc-domain"
          className="field field--select"
          value={doc.domainId ?? ''}
          onChange={(e) => {
            const next = e.target.value;
            store.updateDoc(doc.id, next ? { domainId: next } : { domainId: undefined });
          }}
        >
          <option value="">No spoke</option>
          {state.domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="row-actions">
        <button type="button" className="btn" onClick={() => store.toggleDocPin(doc.id)}>
          {doc.pinned ? 'Unpin from top' : 'Pin to top'}
        </button>
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => {
            store.removeDoc(doc.id);
            onClose();
          }}
        >
          Delete
        </button>
      </div>

      {referencing.length > 0 && (
        <section className="block">
          <h3 className="block__title">Referenced by</h3>
          <div className="list">
            {referencing.map((task) => (
              <TaskRow key={task.id} task={task} now={now} showDomain />
            ))}
          </div>
        </section>
      )}
    </Sheet>
  );
}
