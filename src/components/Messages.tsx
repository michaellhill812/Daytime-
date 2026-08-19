import { useMemo, useState } from 'react';
import Sheet from './Sheet';
import { useDaytimeState, useStore } from '../store/context';
import { audienceLabel, displayName, messagesFor, unreadMessages } from '../store/selectors';
import { formatShortDay, formatTime } from '../lib/date';

/**
 * Notes between the people in a workspace.
 *
 * The badge counts what is waiting on you specifically — a message addressed
 * to someone else never lights it up, which is the whole reason for choosing
 * recipients at all.
 *
 * Read state lives on the message (`readBy`) rather than on the device, unlike
 * the updates feed: a message is a thing said to a person, so opening it on a
 * phone should clear it on a laptop too. The feed's "seen" marker is the
 * opposite case — it tracks a pair of eyes, so it stays local.
 */
export default function Messages() {
  const state = useDaytimeState();
  const store = useStore();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [to, setTo] = useState<string[]>([]);

  const me = store.actor;

  // Everyone in the workspace except you. Without a second person there is
  // nobody to write to, so the whole feature stays out of the way.
  const others = useMemo(
    () =>
      Object.keys(store.people)
        .filter((email) => !me || email.toLowerCase() !== me.toLowerCase())
        .sort(),
    [store.people, me],
  );

  const thread = useMemo(() => messagesFor(state, me), [state, me]);
  const unread = useMemo(() => unreadMessages(state, me), [state, me]);

  if (!me || others.length === 0) return null;

  const openThread = () => {
    setOpen(true);
    store.markMessagesRead(unread.map((m) => m.id));
  };

  const send = () => {
    if (!draft.trim()) return;
    store.sendMessage(draft, to);
    setDraft('');
  };

  const toggleRecipient = (email: string) => {
    setTo((current) =>
      current.includes(email) ? current.filter((e) => e !== email) : [...current, email],
    );
  };

  return (
    <>
      <button
        type="button"
        className={`bubble${unread.length > 0 ? ' bubble--live' : ''}`}
        aria-label={unread.length > 0 ? `${unread.length} unread notes` : 'Notes'}
        onClick={openThread}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
          <path
            d="M21 11.5a7.5 8.5 0 01-7.5 8.5 8.4 8.4 0 01-3.2-.6L4 21l1.3-3.9A8.5 8.5 0 013 11.5 7.5 8.5 0 0110.5 3h3A7.5 8.5 0 0121 11.5z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        {unread.length > 0 && <span className="bubble__count">{unread.length}</span>}
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Notes"
        subtitle={`Between everyone in this workspace`}
      >
        {thread.length === 0 ? (
          <p className="empty">Nothing yet.</p>
        ) : (
          <div className="thread">
            {thread.map((m) => {
              const mine = m.from.toLowerCase() === me.toLowerCase();
              return (
                <div key={m.id} className={`msg${mine ? ' msg--mine' : ''}`}>
                  <div className="msg__meta">
                    <span>{mine ? 'You' : displayName(m.from, store.people)}</span>
                    <span className="msg__to">&rarr; {audienceLabel(m, store.people, me)}</span>
                    <span className="msg__at">
                      {formatShortDay(new Date(m.at))} {formatTime(new Date(m.at))}
                    </span>
                  </div>
                  <div className="msg__body">{m.body}</div>
                  {mine && (
                    <button
                      type="button"
                      className="msg__del"
                      aria-label="Delete note"
                      onClick={() => store.removeMessage(m.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <section className="block">
          <h3 className="block__title">Send to</h3>
          <div className="chips">
            <button
              type="button"
              className={`chip chip--pick${to.length === 0 ? ' is-on' : ''}`}
              onClick={() => setTo([])}
            >
              Everyone
            </button>
            {others.map((email) => (
              <button
                key={email}
                type="button"
                className={`chip chip--pick${to.includes(email) ? ' is-on' : ''}`}
                onClick={() => toggleRecipient(email)}
              >
                {displayName(email, store.people)}
              </button>
            ))}
          </div>

          <div className="quick-add" style={{ marginTop: 12 }}>
            <input
              className="field"
              value={draft}
              placeholder="Write a note…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send();
              }}
            />
            <button
              type="button"
              className="btn btn--primary"
              onClick={send}
              disabled={!draft.trim()}
            >
              Send
            </button>
          </div>

          {/* Said plainly, because the alternative is someone assuming a
              privacy this cannot provide. The workspace is one shared
              document; addressing a note decides who it is shown to, not who
              is able to find it. */}
          <p className="block__hint">
            Notes are addressed, not private &mdash; everyone in the workspace shares one document,
            so anyone here could find any note.
          </p>
        </section>
      </Sheet>
    </>
  );
}
