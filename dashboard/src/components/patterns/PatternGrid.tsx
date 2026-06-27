import { useState } from 'react';
import { usePatterns } from '../../hooks/usePatterns';
import PatternCard from './PatternCard';
import PatternProblems from './PatternProblems';
import PatternWikiDrawer from './PatternWikiDrawer';
import type { Pattern } from '../../lib/types';

export default function PatternGrid() {
  const { data: patterns = [], isLoading } = usePatterns();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [wikiPattern, setWikiPattern] = useState<Pattern | null>(null);

  if (isLoading) {
    return <p className="p-6 text-gray-400 text-sm">Loading patterns…</p>;
  }

  if (patterns.length === 0) {
    return (
      <p className="p-6 text-sm text-gray-500">
        No patterns tracked yet. Solve some problems to build your pattern map.
      </p>
    );
  }

  return (
    <>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {patterns.map(pat => (
          <div key={pat.name}>
            <PatternCard
              pattern={pat}
              isExpanded={expanded === pat.name}
              onToggle={() => setExpanded(prev => (prev === pat.name ? null : pat.name))}
              onOpenWiki={() => setWikiPattern(pat)}
            />
            {expanded === pat.name && <PatternProblems patternName={pat.name} />}
          </div>
        ))}
      </div>
      <PatternWikiDrawer pattern={wikiPattern} onClose={() => setWikiPattern(null)} />
    </>
  );
}
