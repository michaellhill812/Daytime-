import { useMemo, useState } from 'react';
import NewDocSheet from '../components/NewDocSheet';
import { usePeek } from '../components/PeekProvider';
import { useDaytimeState, useStore } from '../store/context';
import { creditFor, domainById, searchDocs, tasksForDoc } from '../store/selectors';
import { formatShortDay } from '../lib/date';
import type { Doc, DocKind } from '../types';

const KIND_MARK: Record<DocKind, string> = {
  note: 'M5 5h14v14H5z M8 9h8 M8 13h6',
  link: 'M10 14a4 4 0 006 0l3-3a4 4 0 10-6-6l-1 1 M14 10a4 4 0 00-6 0l-3 3a4 4 0 106 6l1-1',
  image: 'M4 5h16v14H4z M4 15l4-4 4 4 3-3 5 5 M9 9.5a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4z',
  file: 'M7 3h7l5 5v13H7z M14 3v5h5',
};

/**
 * The reference wall: the things you'd otherwise pin above a desk. Pinned items
 * come first, then most-recently-touched — the wall reorders itself around what
 * you actually keep looking at.
 */
export default function WallView({ active }: { active: boolean }) {
  const state = useDaytimeState();
  const { openDoc } = usePeek();
  const [filter, setFilter] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [query, setQuery] = useState('');

  const docs = useMemo(() => {
    const found = searchDocs(state, query);
    const list = filter ? found.filter((d) => d.domainId === filter) : found;
    return [...list].sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt),
    );
  }, [state, query, filter]);

  const addDoc = () => setComposing(true);

  return (
    <div className={`view view--wall${active ? ' is-active' : ''}`} aria-hidden={!active}>
      <header className="wall__head">
        <div className="wall__title-row">
          <h1 className="view__title">Wall</h1>
          <div className="search">
            <input
              className="field field--search"
              type="search"
              placeholder="Search the Wall…"
              value={query}
              aria-label="Search the Wall"
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className="search__clear"
                aria-label="Clear search"
                onClick={() => setQuery('')}
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div className="filters">
          <button
            type="button"
            className={`filter${filter === null ? ' is-on' : ''}`}
            onClick={() => setFilter(null)}
          >
            All
          </button>
          {state.domains.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`filter${filter === d.id ? ' is-on' : ''}`}
              style={{ '--filter': d.accent } as React.CSSProperties}
              onClick={() => setFilter(filter === d.id ? null : d.id)}
            >
              {d.name}
            </button>
          ))}
        </div>
      </header>

      {query && docs.length === 0 && (
        <p className="empty">Nothing on the Wall matches “{query.trim()}”.</p>
      )}

      <div className="wall__grid">
        {docs.map((doc) => (
          <WallCard key={doc.id} doc={doc} onOpen={() => openDoc(doc.id)} />
        ))}

        <div
          className="card card--add"
          role="button"
          tabIndex={0}
          onClick={addDoc}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              addDoc();
            }
          }}
        >
          <span className="card--add__plus" aria-hidden>
            +
          </span>
          <span>Add something</span>
        </div>
      </div>

      <NewDocSheet
        open={composing}
        onClose={() => setComposing(false)}
        defaultDomainId={filter}
        onCreated={(doc) => {
          setComposing(false);
          openDoc(doc.id);
        }}
      />
    </div>
  );
}

function WallCard({ doc, onOpen }: { doc: Doc; onOpen: () => void }) {
  const state = useDaytimeState();
  const store = useStore();
  const domain = domainById(state, doc.domainId);
  const refs = tasksForDoc(state, doc.id);
  const credit = creditFor(doc, store.actor);

  // A <div> rather than a <button>: Chrome doesn't report a button's flex content
  // height to the grid, so tall cards spilled past their own border.
  return (
    <div
      className={`card${doc.pinned ? ' card--pinned' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      style={{ '--card-accent': domain?.accent ?? 'rgba(255,255,255,0.22)' } as React.CSSProperties}
    >
      <span className="card__rule" aria-hidden />

      <span className="card__top">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden className="card__kind">
          <path
            d={KIND_MARK[doc.kind]}
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        {doc.pinned && <span className="card__pin" aria-label="Pinned" />}
      </span>

      <span className="card__title">{doc.title}</span>
      {doc.body && <span className="card__body">{doc.body}</span>}

      <span className="card__foot">
        {domain && <span style={{ color: domain.accent }}>{domain.name}</span>}
        <span>{formatShortDay(new Date(doc.updatedAt))}</span>
        {credit && <span className="card__by">added by {credit}</span>}
        {refs.length > 0 && (
          <span className="card__refs" title={`${refs.length} task(s) reference this`}>
            {refs.length}
          </span>
        )}
      </span>
    </div>
  );
}
