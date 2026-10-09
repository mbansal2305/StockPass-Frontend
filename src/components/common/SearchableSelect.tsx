import React, { useState } from 'react';

export interface SearchableOption {
  id: string;
  label: string;
  searchText?: string;
}

interface SearchableSelectProps {
  id: string;
  value: string;
  options: SearchableOption[];
  placeholder: string;
  onChange: (value: string) => void;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  value,
  options,
  placeholder,
  onChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selectedOption = options.find(option => option.id === value);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter(option =>
        `${option.label} ${option.searchText || ''}`.toLowerCase().includes(normalizedQuery)
      )
    : options;

  const selectOption = (option: SearchableOption) => {
    onChange(option.id);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={`${id}-options`}
        autoComplete="off"
        value={isOpen ? query : selectedOption?.label || ''}
        onFocus={() => {
          setQuery('');
          setIsOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onBlur={() => setIsOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setIsOpen(false);
        }}
        placeholder={placeholder}
        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
      />
      {isOpen && (
        <div
          id={`${id}-options`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {filteredOptions.length ? filteredOptions.map(option => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.id === value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option)}
              className={`block w-full px-3 py-2 text-left text-xs hover:bg-blue-50 ${
                option.id === value ? 'bg-blue-50 text-blue-700' : 'text-slate-900'
              }`}
            >
              {option.label}
            </button>
          )) : (
            <p className="px-3 py-2 text-xs text-slate-500">No matching options</p>
          )}
        </div>
      )}
    </div>
  );
};
