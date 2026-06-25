import StatsBar from '../components/overview/StatsBar';
import ActivityHeatmap from '../components/overview/ActivityHeatmap';
import DueToday from '../components/overview/DueToday';
import RecentActivity from '../components/overview/RecentActivity';
import { useActivity } from '../hooks/useActivity';

export default function Overview() {
  const { data: activity = [] } = useActivity();
  return (
    <div>
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-white">Overview</h1>
      </div>
      <StatsBar />
      <div className="px-6 mb-6">
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
          Activity — past 52 weeks
        </h2>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <ActivityHeatmap data={activity} />
        </div>
      </div>
      <DueToday />
      <RecentActivity />
    </div>
  );
}
