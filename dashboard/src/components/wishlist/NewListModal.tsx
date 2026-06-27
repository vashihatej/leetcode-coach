import { useState } from 'react';
import { X } from 'lucide-react';
import { useCreateList, useBulkAddToList } from '../../hooks/useLists';

interface Props {
  onClose: () => void;
}

const PLACEHOLDER = `Singly Linked Lists
https://leetcode.com/problems/reverse-linked-list/
https://leetcode.com/problems/merge-two-sorted-lists/

Hashing
https://leetcode.com/problems/two-sum/
https://leetcode.com/problems/group-anagrams/`;

export default function NewListModal({ onClose }: Props) {
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createList = useCreateList();
  const bulkAdd = useBulkAddToList();
  const busy = createList.isPending || bulkAdd.isPending;

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) { setError('List name is required.'); return; }
    if (!text.trim()) { setError('Paste at least one problem URL.'); return; }
    try {
      const list = await createList.mutateAsync(name.trim());
      await bulkAdd.mutateAsync({ id: list.id, text });
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      setError(msg.includes('409') || msg.includes('already exists')
        ? 'A list with this name already exists.'
        : 'Failed to create list. Check the server logs.');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-white font-semibold">New Problem List</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <input
            type="text"
            placeholder="List name (e.g. NeetCode 75)"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          <textarea
            placeholder={PLACEHOLDER}
            value={text}
            onChange={e => setText(e.target.value)}
            rows={11}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none font-mono"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={busy}
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {busy ? 'Creating…' : 'Create List'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
