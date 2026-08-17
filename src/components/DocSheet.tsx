import Sheet from './Sheet';
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
export default function DocSheet({ docId, onClose }: { docId: string | null; onClose: () => void }) {
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
      <textarea
        className="field field--body"
        value={doc.body ?? ''}
        placeholder="Write it down…"
        rows={6}
        onChange={(e) => store.updateDoc(doc.id, { body: e.target.value })}
      />

      {doc.url && (
        <a className="linkout" href={doc.url} target="_blank" rel="noreferrer">
          {doc.url}
        </a>
      )}

      <div className="row-actions">
        <button type="button" className="btn" onClick={() => store.toggleDocPin(doc.id)}>
          {doc.pinned ? 'Unpin from Wall' : 'Pin to Wall'}
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
