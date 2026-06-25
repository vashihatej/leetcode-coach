import ReviewCard from '../components/review/ReviewCard';
import { useReview } from '../hooks/useReview';
import { classifyDueDate } from '../lib/dates';

export default function Review() {
  const { data: items = [], isLoading } = useReview();

  const overdue = items.filter(i => classifyDueDate(i.due_date) === 'overdue');
  const dueToday = items.filter(i => classifyDueDate(i.due_date) === 'due-today');
  const upcoming = items.filter(i => classifyDueDate(i.due_date) === 'upcoming');

  if (isLoading) {
    return <div className="p-6 text-gray-400 text-sm">Loading review queue…</div>;
  }

  return (
    <div className="p-6 space-y-8 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-white">Review Queue</h1>
        <p className="text-sm text-gray-400 mt-1">
          Spaced-repetition inbox — {items.length} problem{items.length !== 1 ? 's' : ''} scheduled.
        </p>
      </div>

      {/* Overdue */}
      <section>
        <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3">
          Overdue ({overdue.length})
        </h2>
        {overdue.length === 0 && items.length > 0 ? (
          <p className="text-sm text-gray-500 bg-gray-800/40 rounded-xl px-5 py-4">
            Nothing overdue — great work.
          </p>
        ) : (
          <div className="space-y-3">
            {overdue.map(i => <ReviewCard key={i.id} item={i} />)}
          </div>
        )}
      </section>

      {/* Due today */}
      {dueToday.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3">
            Due Today ({dueToday.length})
          </h2>
          <div className="space-y-3">
            {dueToday.map(i => <ReviewCard key={i.id} item={i} />)}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Upcoming ({upcoming.length})
          </h2>
          <div className="space-y-3">
            {upcoming.map(i => <ReviewCard key={i.id} item={i} />)}
          </div>
        </section>
      )}

      {items.length === 0 && (
        <p className="text-sm text-gray-500">No problems scheduled for review yet.</p>
      )}
    </div>
  );
}
