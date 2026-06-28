import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Trash2, BookOpen, Layers, BarChart2 } from 'lucide-react';
import { useListProblems, useDeleteList } from '../../hooks/useLists';
import type { ProblemList, ListProblem } from '../../lib/types';

// ─── helpers ────────────────────────────────────────────────────────────────

function safeParseTags(raw: string | null): string[] {
  try { return JSON.parse(raw ?? '[]') as string[]; } catch { return []; }
}

function prettifySlug(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

interface Section {
  tag: string;
  problems: ListProblem[];
}

function buildSections(problems: ListProblem[]): Section[] {
  const sections: Section[] = [];
  for (const p of problems) {
    const tag = safeParseTags(p.pattern_tags)[0] || 'Other';
    const last = sections[sections.length - 1];
    if (last?.tag === tag) {
      if (!last.problems.some(x => x.slug === p.slug)) last.problems.push(p);
    } else {
      sections.push({ tag, problems: [p] });
    }
  }
  return sections;
}

// ─── color coding ────────────────────────────────────────────────────────────

interface ColorScheme {
  border: string;
  bg: string;
  badge: string;
  num: string;
}

function getSectionColor(tag: string): ColorScheme {
  const first = tag.split(/\s+/)[0];
  const map: Record<string, ColorScheme> = {
    Linked:  { border: 'border-blue-500',   bg: 'bg-blue-500/10',   badge: 'bg-blue-500/20 text-blue-300',   num: 'text-blue-400'   },
    Queue:   { border: 'border-cyan-500',    bg: 'bg-cyan-500/10',   badge: 'bg-cyan-500/20 text-cyan-300',   num: 'text-cyan-400'   },
    Stack:   { border: 'border-cyan-500',    bg: 'bg-cyan-500/10',   badge: 'bg-cyan-500/20 text-cyan-300',   num: 'text-cyan-400'   },
    Recursion:{ border: 'border-violet-500', bg: 'bg-violet-500/10', badge: 'bg-violet-500/20 text-violet-300', num: 'text-violet-400' },
    Sorting: { border: 'border-pink-500',    bg: 'bg-pink-500/10',   badge: 'bg-pink-500/20 text-pink-300',   num: 'text-pink-400'   },
    Binary:  { border: 'border-orange-500',  bg: 'bg-orange-500/10', badge: 'bg-orange-500/20 text-orange-300', num: 'text-orange-400' },
    BST:     { border: 'border-orange-500',  bg: 'bg-orange-500/10', badge: 'bg-orange-500/20 text-orange-300', num: 'text-orange-400' },
    Depth:   { border: 'border-emerald-500', bg: 'bg-emerald-500/10', badge: 'bg-emerald-500/20 text-emerald-300', num: 'text-emerald-400' },
    Breadth: { border: 'border-emerald-500', bg: 'bg-emerald-500/10', badge: 'bg-emerald-500/20 text-emerald-300', num: 'text-emerald-400' },
    BFS:     { border: 'border-emerald-500', bg: 'bg-emerald-500/10', badge: 'bg-emerald-500/20 text-emerald-300', num: 'text-emerald-400' },
    DFS:     { border: 'border-emerald-500', bg: 'bg-emerald-500/10', badge: 'bg-emerald-500/20 text-emerald-300', num: 'text-emerald-400' },
    Tree:    { border: 'border-emerald-500', bg: 'bg-emerald-500/10', badge: 'bg-emerald-500/20 text-emerald-300', num: 'text-emerald-400' },
    Back:    { border: 'border-rose-500',    bg: 'bg-rose-500/10',   badge: 'bg-rose-500/20 text-rose-300',   num: 'text-rose-400'   },
    Heap:    { border: 'border-yellow-500',  bg: 'bg-yellow-500/10', badge: 'bg-yellow-500/20 text-yellow-300', num: 'text-yellow-400' },
    Priority:{ border: 'border-yellow-500',  bg: 'bg-yellow-500/10', badge: 'bg-yellow-500/20 text-yellow-300', num: 'text-yellow-400' },
    Hash:    { border: 'border-indigo-500',  bg: 'bg-indigo-500/10', badge: 'bg-indigo-500/20 text-indigo-300', num: 'text-indigo-400' },
    Hashing: { border: 'border-indigo-500',  bg: 'bg-indigo-500/10', badge: 'bg-indigo-500/20 text-indigo-300', num: 'text-indigo-400' },
    Graph:   { border: 'border-teal-500',    bg: 'bg-teal-500/10',   badge: 'bg-teal-500/20 text-teal-300',   num: 'text-teal-400'   },
    Dynamic: { border: 'border-purple-500',  bg: 'bg-purple-500/10', badge: 'bg-purple-500/20 text-purple-300', num: 'text-purple-400' },
    DP:      { border: 'border-purple-500',  bg: 'bg-purple-500/10', badge: 'bg-purple-500/20 text-purple-300', num: 'text-purple-400' },
  };
  return map[first] ?? { border: 'border-gray-500', bg: 'bg-gray-500/10', badge: 'bg-gray-500/20 text-gray-300', num: 'text-gray-400' };
}

// ─── difficulty badge ─────────────────────────────────────────────────────────

function DifficultyBadge({ difficulty }: { difficulty: string | null }) {
  if (!difficulty) return null;
  const d = difficulty.toLowerCase();
  const cls =
    d === 'easy'   ? 'bg-green-500/20 text-green-300' :
    d === 'medium' ? 'bg-amber-500/20 text-amber-300' :
    d === 'hard'   ? 'bg-red-500/20 text-red-300'     :
    'bg-gray-500/20 text-gray-300';
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}>
      {difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase()}
    </span>
  );
}

// ─── stats bar ───────────────────────────────────────────────────────────────

function StatsBar({ problems, sections }: { problems: ListProblem[]; sections: Section[] }) {
  const counts = { easy: 0, medium: 0, hard: 0 };
  for (const p of problems) {
    const d = (p.difficulty ?? '').toLowerCase();
    if (d === 'easy') counts.easy++;
    else if (d === 'medium') counts.medium++;
    else if (d === 'hard') counts.hard++;
  }
  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-3 bg-gray-800/40 border-b border-gray-800/60 text-xs text-gray-400">
      <span className="flex items-center gap-1.5">
        <BookOpen size={12} className="text-gray-500" />
        <span className="font-medium text-gray-200">{problems.length}</span> problems
      </span>
      <span className="flex items-center gap-1.5">
        <Layers size={12} className="text-gray-500" />
        <span className="font-medium text-gray-200">{sections.length}</span> sections
      </span>
      <span className="flex items-center gap-1.5">
        <BarChart2 size={12} className="text-gray-500" />
        <span className="text-green-400 font-medium">{counts.easy} Easy</span>
        <span className="text-gray-600">/</span>
        <span className="text-amber-400 font-medium">{counts.medium} Medium</span>
        <span className="text-gray-600">/</span>
        <span className="text-red-400 font-medium">{counts.hard} Hard</span>
      </span>
    </div>
  );
}

// ─── collapsed header difficulty pill strip ───────────────────────────────────

function HeaderDifficultyStrip({ problems }: { problems: ListProblem[] }) {
  const counts = { easy: 0, medium: 0, hard: 0 };
  for (const p of problems) {
    const d = (p.difficulty ?? '').toLowerCase();
    if (d === 'easy') counts.easy++;
    else if (d === 'medium') counts.medium++;
    else if (d === 'hard') counts.hard++;
  }
  if (counts.easy + counts.medium + counts.hard === 0) return null;
  return (
    <div className="hidden sm:flex items-center gap-1.5 text-[10px]">
      {counts.easy > 0 && <span className="bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded font-medium">{counts.easy}E</span>}
      {counts.medium > 0 && <span className="bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded font-medium">{counts.medium}M</span>}
      {counts.hard > 0 && <span className="bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded font-medium">{counts.hard}H</span>}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  list: ProblemList;
}

export default function ListCard({ list }: Props) {
  const [open, setOpen] = useState(false);
  const { data: problems = [], isLoading } = useListProblems(open ? list.id : null);
  const deleteList = useDeleteList();

  const sections = buildSections(problems);

  return (
    <div className={`bg-gray-900 border rounded-xl overflow-hidden transition-colors ${open ? 'border-gray-700' : 'border-gray-800 hover:border-gray-700'}`}>

      {/* ── Collapsed / always-visible header ── */}
      <div
        className="flex items-center justify-between px-4 py-3.5 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex-shrink-0 text-gray-500">
            {open
              ? <ChevronDown size={15} className="text-gray-400" />
              : <ChevronRight size={15} className="text-gray-400" />}
          </span>
          <span className="text-sm font-semibold text-white truncate">{list.name}</span>
          <span className="flex-shrink-0 text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
            {list.problem_count} problems
          </span>
          {/* Show difficulty strip only when collapsed & we have data */}
          {!open && problems.length > 0 && <HeaderDifficultyStrip problems={problems} />}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-2.5 py-1 rounded-lg transition-colors"
          >
            {open ? 'Close' : 'View'}
            {open
              ? <ChevronDown size={11} />
              : <ChevronRight size={11} />}
          </button>
          <button
            onClick={e => { e.stopPropagation(); deleteList.mutate(list.id); }}
            title="Delete list"
            className="text-gray-600 hover:text-red-400 transition-colors p-1"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ── Expanded content ── */}
      {open && (
        <div className="border-t border-gray-800/60">
          {isLoading && (
            <div className="px-5 py-6 text-xs text-gray-500 flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full border border-gray-600 border-t-gray-400 animate-spin" />
              Loading problems…
            </div>
          )}

          {!isLoading && problems.length === 0 && (
            <p className="px-5 py-6 text-xs text-gray-500">No problems in this list yet.</p>
          )}

          {!isLoading && problems.length > 0 && (
            <>
              <StatsBar problems={problems} sections={sections} />

              <div className="divide-y divide-gray-800/40">
                {sections.map((section, sIdx) => {
                  const color = getSectionColor(section.tag);
                  const sectionNum = String(sIdx + 1).padStart(2, '0');
                  return (
                    <div key={`${section.tag}-${sIdx}`} className="px-5 py-4">
                      {/* Section header */}
                      <div className={`flex items-center gap-3 mb-3 pl-3 border-l-2 ${color.border} ${color.bg} py-1.5 pr-3 rounded-r-lg`}>
                        <span className={`text-[11px] font-bold font-mono ${color.num}`}>{sectionNum}</span>
                        <span className="text-sm font-semibold text-white flex-1">{section.tag}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${color.badge}`}>
                          {section.problems.length} {section.problems.length === 1 ? 'problem' : 'problems'}
                        </span>
                      </div>

                      {/* Problem rows */}
                      <div className="space-y-0.5 ml-1">
                        {section.problems.map((p, pIdx) => {
                          const title = p.title ?? prettifySlug(p.slug);
                          const href = p.url ?? `https://leetcode.com/problems/${p.slug}/`;
                          return (
                            <a
                              key={p.slug}
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800/60 transition-colors group"
                              onClick={e => e.stopPropagation()}
                            >
                              <span className="text-[11px] text-gray-600 font-mono w-5 flex-shrink-0 text-right">
                                {pIdx + 1}.
                              </span>
                              <span className="text-sm text-gray-200 group-hover:text-white flex-1 min-w-0 truncate">
                                {title}
                              </span>
                              <DifficultyBadge difficulty={p.difficulty} />
                              <ExternalLink
                                size={12}
                                className="text-gray-700 group-hover:text-gray-400 flex-shrink-0 transition-colors"
                              />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
