import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useLists } from '../../hooks/useLists';
import ListCard from './ListCard';
import NewListModal from './NewListModal';

export default function ListsTab() {
  const { data: lists = [], isLoading } = useLists();
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">
          {lists.length} list{lists.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={14} /> New List
        </button>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

      <div className="space-y-3">
        {lists.map(l => <ListCard key={l.id} list={l} />)}
      </div>

      {!isLoading && lists.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-12">
          No lists yet. Hit &quot;New List&quot; to create one.
        </p>
      )}

      {showModal && <NewListModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
