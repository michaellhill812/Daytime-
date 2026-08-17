import Sheet from './Sheet';
import TaskRow from './TaskRow';
import { usePeek } from './PeekProvider';
import type { FocusDigest } from '../store/selectors';
import { formatDayLabel } from '../lib/date';
import type { Task } from '../types';

interface FocusSheetProps {
  open: boolean;
  onClose: () => void;
  digest: FocusDigest;
  now: Date;
}

/**
 * What the hub's number stands for, unpacked. Three groups, in the order your
 * attention actually goes: what slipped, what's due, what's coming.
 */
export default function FocusSheet({ open, onClose, digest, now }: FocusSheetProps) {
  const { openDoc, openEvent } = usePeek();

  const group = (title: string, tasks: Task[], tone?: string) =>
    tasks.length > 0 && (
      <section className="block">
        <h3 className={`block__title${tone ? ` block__title--${tone}` : ''}`}>
          {title}
          <span className="block__count">{tasks.length}</span>
        </h3>
        <div className="list">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              now={now}
              showDomain
              onOpenDoc={openDoc}
              onOpenEvent={openEvent}
            />
          ))}
        </div>
      </section>
    );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={digest.count === 0 ? 'Nothing pressing' : `${digest.count} need you`}
      subtitle={formatDayLabel(now)}
    >
      {digest.count === 0 ? (
        <p className="empty">
          Everything with a deadline is handled. The wheel keeps the rest.
        </p>
      ) : (
        <>
          {group('Overdue', digest.overdue, 'alert')}
          {group('Today', digest.today)}
          {group('On deck', digest.deck, 'quiet')}
        </>
      )}
    </Sheet>
  );
}
