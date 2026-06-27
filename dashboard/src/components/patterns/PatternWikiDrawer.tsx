import { useQuery } from '@tanstack/react-query';
import { X, Zap, AlertTriangle, Code2, GitBranch, Clock, MemoryStick } from 'lucide-react';
import { api } from '../../lib/api';
import type { Pattern } from '../../lib/types';

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-indigo-400">{icon}</span>
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function PatternWikiDrawer({
  pattern,
  onClose,
}: {
  pattern: Pattern | null;
  onClose: () => void;
}) {
  const { data: wiki, isLoading } = useQuery({
    queryKey: ['pattern-wiki', pattern?.name],
    queryFn: () => api.patternWiki(pattern!.name),
    enabled: !!pattern,
  });

  if (!pattern) return null;

  const instPct = Math.round((pattern.instinct_rate ?? 0) * 100);
  const signals = parseJson<string[]>(wiki?.signals ?? null, []);
  const mistakes = parseJson<string[]>(wiki?.mistakes ?? null, []);
  const related = parseJson<string[]>(wiki?.related ?? null, []);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[520px] bg-gray-900 border-l border-gray-800 overflow-y-auto shadow-2xl flex flex-col">

        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex justify-between items-start z-10">
          <div>
            <h2 className="font-semibold text-white text-lg capitalize">{pattern.name}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
              <span>{pattern.problem_count} problem{pattern.problem_count !== 1 ? 's' : ''} solved</span>
              <span className="text-green-400">{instPct}% instinct fired</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors mt-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1">
          {isLoading && (
            <p className="text-sm text-gray-500">Loading…</p>
          )}

          {!isLoading && !wiki && (
            <div className="rounded-lg border border-dashed border-gray-700 p-6 text-center">
              <p className="text-sm text-gray-400 mb-1">No wiki yet for this pattern.</p>
              <p className="text-xs text-gray-600">Claude will generate one after your next session using this pattern.</p>
            </div>
          )}

          {wiki && (
            <>
              {/* Description */}
              {wiki.description && (
                <p className="text-sm text-gray-300 leading-relaxed">{wiki.description}</p>
              )}

              {/* Complexity pills */}
              {(wiki.time_complexity || wiki.space_complexity) && (
                <div className="flex gap-2">
                  {wiki.time_complexity && (
                    <span className="flex items-center gap-1.5 text-xs bg-indigo-900/40 text-indigo-300 px-2.5 py-1 rounded-full border border-indigo-800/50">
                      <Clock size={11} />
                      Time: {wiki.time_complexity}
                    </span>
                  )}
                  {wiki.space_complexity && (
                    <span className="flex items-center gap-1.5 text-xs bg-purple-900/40 text-purple-300 px-2.5 py-1 rounded-full border border-purple-800/50">
                      <MemoryStick size={11} />
                      Space: {wiki.space_complexity}
                    </span>
                  )}
                </div>
              )}

              {/* Smell test */}
              {signals.length > 0 && (
                <Section icon={<Zap size={14} />} title="How to spot it">
                  <ul className="space-y-1.5">
                    {signals.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Core invariant + analogy */}
              {(wiki.invariant || wiki.analogy) && (
                <Section icon={<GitBranch size={14} />} title="Core invariant">
                  {wiki.invariant && (
                    <div className="bg-indigo-950/50 border border-indigo-900/60 rounded-lg p-3 mb-2">
                      <p className="text-sm text-indigo-200 leading-relaxed">{wiki.invariant}</p>
                    </div>
                  )}
                  {wiki.analogy && (
                    <p className="text-sm text-sky-300 italic pl-1">"{wiki.analogy}"</p>
                  )}
                </Section>
              )}

              {/* When NOT to use */}
              {wiki.when_not && (
                <Section icon={<AlertTriangle size={14} />} title="When not to use">
                  <p className="text-sm text-amber-300/80 leading-relaxed">{wiki.when_not}</p>
                </Section>
              )}

              {/* Template */}
              {wiki.template_code && (
                <Section icon={<Code2 size={14} />} title="Python template">
                  <pre className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs text-green-300 overflow-x-auto leading-relaxed font-mono whitespace-pre">
                    {wiki.template_code}
                  </pre>
                </Section>
              )}

              {/* Common traps */}
              {mistakes.length > 0 && (
                <Section icon={<AlertTriangle size={14} />} title="Common traps">
                  <ul className="space-y-1.5">
                    {mistakes.map((m, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <span className="text-red-400 mt-0.5 flex-shrink-0">✗</span>
                        {m}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Related patterns */}
              {related.length > 0 && (
                <Section icon={<GitBranch size={14} />} title="Often paired with">
                  <div className="flex flex-wrap gap-2">
                    {related.map(r => (
                      <span
                        key={r}
                        className="text-xs bg-gray-800 border border-gray-700 text-gray-300 px-2.5 py-1 rounded-full capitalize"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
