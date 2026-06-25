import { useStats } from '../../hooks/useStats';

export default function StatsBar() {
  const { data } = useStats();
  const stats = [
    { label: 'Problems', value: data?.total_problems ?? '—' },
    { label: 'Solved', value: data?.solved_problems ?? '—' },
    { label: 'Patterns', value: data?.pattern_count ?? '—' },
    { label: 'Due Today', value: data?.due_today ?? '—' },
    { label: 'Streak', value: data != null ? `${data.streak}d` : '—' },
  ];
  return (
    <div className="grid grid-cols-5 gap-4 px-6 pb-6">
      {stats.map(({ label, value }) => (
        <div key={label} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-xs text-gray-400 mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
        </div>
      ))}
    </div>
  );
}
