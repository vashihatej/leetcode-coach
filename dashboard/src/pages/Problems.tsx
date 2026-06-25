import ProblemTable from '../components/problems/ProblemTable';

export default function Problems() {
  return (
    <div>
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-xl font-bold text-white">Problems</h1>
        <p className="text-sm text-gray-400 mt-1">
          Click any row to see full attempt history.
        </p>
      </div>
      <ProblemTable />
    </div>
  );
}
