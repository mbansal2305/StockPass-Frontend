import React, { useState } from 'react';
import { Check } from 'lucide-react';

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

interface MultiSearchableSelectProps {
  id: string;
  selectedIds: string[];
  options: SearchableOption[];
  placeholder: string;
  onChange: (values: string[]) => void;
}

export const MultiSearchableSelect: React.FC<MultiSearchableSelectProps> = ({
  id,
  selectedIds,
  options,
  placeholder,
  onChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter(option =>
        `${option.label} ${option.searchText || ''}`.toLowerCase().includes(normalizedQuery)
      )
    : options;
  const selectedOptions = options.filter(option => selectedIds.includes(option.id));
  const searchPlaceholder = selectedOptions.length > 0
    ? `${selectedOptions.length} selected · Search ${placeholder.replace(/^All /, '').toLowerCase()}`
    : `Search ${placeholder.replace(/^All /, '').toLowerCase()}...`;

  const toggleOption = (optionId: string) => {
    onChange(selectedIds.includes(optionId)
      ? selectedIds.filter(idValue => idValue !== optionId)
      : [...selectedIds, optionId]);
  };

  return (
    <div
      className="relative shrink-0"
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOpen(false);
      }}
    >
      <input
        id={id}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={`${id}-options`}
        autoComplete="off"
        value={query}
        onFocus={() => setIsOpen(true)}
        onChange={event => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onKeyDown={event => {
          if (event.key === 'Escape') setIsOpen(false);
        }}
        placeholder={searchPlaceholder}
        className="w-40 max-w-48 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
      />
      {isOpen && (
        <div className="absolute left-0 z-30 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <div id={`${id}-options`} role="listbox" aria-multiselectable="true" className="max-h-52 overflow-y-auto">
            {filteredOptions.length ? filteredOptions.map(option => {
              const isSelected = selectedIds.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => toggleOption(option.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded px-2.5 py-2 text-left text-xs hover:bg-blue-50 ${
                    isSelected ? 'bg-blue-50 text-blue-800' : 'text-slate-700'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              );
            }) : (
              <p className="px-2.5 py-2 text-xs text-slate-500">No matching options</p>
            )}
          </div>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1.5 w-full border-t border-slate-100 px-2.5 pt-2 text-left text-xs font-medium text-blue-700 hover:text-blue-900"
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
};
