import PatternGrid from '../components/patterns/PatternGrid';

export default function Patterns() {
  return (
    <div>
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-xl font-bold text-white">Patterns</h1>
        <p className="text-sm text-gray-400 mt-1">
          Click a card to see all problems using that pattern.
        </p>
      </div>
      <PatternGrid />
    </div>
  );
}
