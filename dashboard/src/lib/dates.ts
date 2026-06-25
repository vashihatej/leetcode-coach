export type DueClass = 'overdue' | 'due-today' | 'upcoming';

export function classifyDueDate(dueDateStr: string): DueClass {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr + 'T00:00:00');
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'due-today';
  return 'upcoming';
}
