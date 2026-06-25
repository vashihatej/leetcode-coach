export interface Problem {
  id: number;
  slug: string;
  title: string | null;
  difficulty: string | null;
  topic_tags: string | null;
  url: string | null;
  last_solved: number | null;
  last_result_type: string | null;
  last_hints_used: string | null;
  attempt_count: number;
  due_date: string | null;
  ease: number | null;
  reps: number | null;
  patterns: string | null;
}

export interface Attempt {
  id: number;
  problem_id: number;
  date: string;
  solved: number;
  result_type: string | null;
  hints_used: string;
  time_spent: number | null;
  mistakes: string | null;
  final_approach: string | null;
}

export interface Pattern {
  id: number;
  name: string;
  mastery: 'not_started' | 'shaky' | 'solid';
  times_seen: number;
  times_instinct_fired: number;
  last_practiced: string | null;
  problem_count: number;
  instinct_rate: number;
}

export interface ReviewItem {
  id: number;
  problem_id: number;
  slug: string;
  title: string | null;
  difficulty: string | null;
  url: string | null;
  due_date: string;
  interval: number;
  ease: number;
  reps: number;
}

export interface ActivityPoint {
  date: string;
  count: number;
}

export interface Stats {
  total_problems: number;
  solved_problems: number;
  due_today: number;
  pattern_count: number;
  streak: number;
}

export interface WishlistItem {
  id: number;
  slug: string;
  title: string | null;
  difficulty: string | null;
  url: string | null;
  notes: string | null;
  added_at: string;
  prob_difficulty: string | null;
}

export interface RecentAttempt {
  id: number;
  date: string;
  solved: number;
  result_type: string | null;
  hints_used: string;
  time_spent: number | null;
  slug: string;
  title: string | null;
  difficulty: string | null;
  url: string | null;
  ease: number | null;
  reps: number | null;
}

export type ComfortLevel = 'instinct' | 'solid' | 'learning' | 'shaky' | 'new';
