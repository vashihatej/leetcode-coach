import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

const DIFF: Record<string, string> = {
  Easy: 'text-green-400', Medium: 'text-amber-400', Hard: 'text-red-400',
};

export default function RecentActivity() {
  const { data: attempts = [] } = useQuery({
    queryKey: ['recent-attempts'],
    queryFn: api.recentAttempts,
  });

  return (
    <div className="px-6 mb-6">
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
        Recent Attempts
      </h2>
      <div className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700/50">
        {attempts.map(a => {
          const hints = JSON.parse(a.hints_used || '[]') as number[];
          return (
            <div key={a.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`text-sm ${a.solved ? 'text-green-400' : 'text-red-400'}`}>
                  {a.solved ? '✓' : '✗'}
                </span>
                <span className="text-sm text-white">{a.title ?? a.slug}</span>
                <span className={`text-xs ${DIFF[a.difficulty ?? ''] ?? 'text-gray-500'}`}>
                  {a.difficulty}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {hints.length > 0 && (
                  <span>{hints.length} hint{hints.length !== 1 ? 's' : ''}</span>
                )}
                <span>{new Date(a.date).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}
        {attempts.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">
            No attempts yet. Start solving!
          </p>
        )}
      </div>
    </div>
  );
}
