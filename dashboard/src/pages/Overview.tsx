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
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <ActivityHeatmap data={activity} />
        </div>
      </div>
      <DueToday />
      <RecentActivity />
    </div>
  );
}
