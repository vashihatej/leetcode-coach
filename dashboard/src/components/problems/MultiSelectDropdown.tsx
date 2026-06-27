import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export default function MultiSelectDropdown({ label, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function toggle(opt: string) {
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  }

  const active = selected.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors whitespace-nowrap ${
          active
            ? 'bg-indigo-900/30 border-indigo-700 text-indigo-300'
            : 'bg-gray-800 border-gray-700 text-white hover:border-gray-600'
        }`}
      >
        {active ? `${label} (${selected.length})` : label}
        <ChevronDown size={13} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-20 min-w-36 max-h-56 overflow-y-auto">
          {options.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-500">No options</p>
          )}
          {options.map(opt => (
            <label
              key={opt}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 cursor-pointer capitalize"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="accent-indigo-500"
              />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
