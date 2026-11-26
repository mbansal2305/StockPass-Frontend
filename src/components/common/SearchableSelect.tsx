import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';

export interface SearchableOption {
  id: string;
  label: string;
  searchText?: string;
  highlightText?: string;
}

interface SearchableSelectProps {
  id: string;
  value: string;
  options: SearchableOption[];
  placeholder: string;
  onChange: (value: string) => void;
  highlightFirstMatch?: boolean;
  wrapOptions?: boolean;
  portalOptions?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  value,
  options,
  placeholder,
  onChange,
  highlightFirstMatch = false,
  wrapOptions = false,
  portalOptions = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>();
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find(option => option.id === value);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter(option =>
        `${option.label} ${option.searchText || ''}`.toLowerCase().includes(normalizedQuery)
      )
    : options;
  const activeOptionIndex = filteredOptions.length
    ? Math.min(activeIndex, filteredOptions.length - 1)
    : -1;

  useEffect(() => {
    if (!isOpen || !portalOptions) return;

    const updateDropdownPosition = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const spaceBelow = Math.max(80, window.innerHeight - rect.bottom - 8);
      setDropdownStyle({
        left: rect.left,
        top: rect.bottom,
        width: rect.width,
        maxHeight: Math.min(208, spaceBelow)
      });
    };

    const scrollableAncestors: HTMLElement[] = [];
    let ancestor = containerRef.current?.parentElement;
    while (ancestor && ancestor !== document.body) {
      const { overflowX, overflowY } = window.getComputedStyle(ancestor);
      if (/(auto|scroll)/.test(`${overflowX} ${overflowY}`)) {
        ancestor.addEventListener('scroll', updateDropdownPosition);
        scrollableAncestors.push(ancestor);
      }
      ancestor = ancestor.parentElement;
    }

    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition);
    return () => {
      scrollableAncestors.forEach(element => element.removeEventListener('scroll', updateDropdownPosition));
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition);
    };
  }, [isOpen, portalOptions]);

  const selectOption = (option: SearchableOption) => {
    onChange(option.id);
    setQuery('');
    setIsOpen(false);
  };

  const optionsList = (
    <div
      id={`${id}-options`}
      role="listbox"
      className={`${portalOptions ? 'fixed z-20' : 'absolute z-20 mt-1 max-h-52 w-full'} overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg`}
      style={portalOptions ? dropdownStyle : undefined}
    >
      {filteredOptions.length ? filteredOptions.map((option, index) => (
        <button
          key={option.id}
          id={`${id}-option-${index}`}
          type="button"
          role="option"
          aria-selected={option.id === value}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => selectOption(option)}
          className={`block w-full px-3 py-2 text-left text-xs hover:bg-blue-50 ${
            wrapOptions ? 'whitespace-normal break-words' : ''
          } ${
            index === activeOptionIndex ? 'bg-blue-50' : ''
          } ${
            option.id === value ? 'bg-blue-50 text-blue-700' : 'text-slate-900'
          }`}
        >
          {option.highlightText && option.label.startsWith(option.highlightText) ? (
            <>
              <span className="font-bold text-blue-700">{option.highlightText}</span>
              {option.label.slice(option.highlightText.length)}
            </>
          ) : option.label}
        </button>
      )) : (
        <p className="px-3 py-2 text-xs text-slate-500">No matching options</p>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className="relative">
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
          const selectedIndex = options.findIndex(option => option.id === value);
          setActiveIndex(selectedIndex);
        }}
        onClick={() => {
          if (!isOpen) {
            setQuery('');
            setIsOpen(true);
            setActiveIndex(options.findIndex(option => option.id === value));
          }
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(highlightFirstMatch ? 0 : -1);
          setIsOpen(true);
        }}
        onBlur={() => setIsOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsOpen(false);
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!isOpen) {
              setQuery('');
              setIsOpen(true);
              const selectedIndex = options.findIndex(option => option.id === value);
              setActiveIndex(selectedIndex);
            } else if (filteredOptions.length) {
              setActiveIndex(index => {
                if (event.key === 'ArrowDown') {
                  return index < 0 ? 0 : Math.min(index + 1, filteredOptions.length - 1);
                }
                return index < 0 ? filteredOptions.length - 1 : Math.max(index - 1, 0);
              });
            }
          } else if (event.key === 'Enter' && isOpen && activeOptionIndex >= 0) {
            event.preventDefault();
            selectOption(filteredOptions[activeOptionIndex]);
          } else if (event.key === 'Enter' && isOpen && filteredOptions.length) {
            event.preventDefault();
            selectOption(filteredOptions[0]);
          }
        }}
        placeholder={placeholder}
        aria-activedescendant={isOpen && activeOptionIndex >= 0 ? `${id}-option-${activeOptionIndex}` : undefined}
        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
      />
      {isOpen && (portalOptions
        ? dropdownStyle && createPortal(optionsList, document.body)
        : optionsList)}
    </div>
  );
};

interface MultiSearchableSelectProps {
  id: string;
  selectedIds: string[];
  options: SearchableOption[];
  placeholder: string;
  onChange: (values: string[]) => void;
  fullWidth?: boolean;
}

export const MultiSearchableSelect: React.FC<MultiSearchableSelectProps> = ({
  id,
  selectedIds,
  options,
  placeholder,
  onChange,
  fullWidth = false
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
      className={`relative ${fullWidth ? 'w-full' : 'shrink-0'}`}
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
        className={`${fullWidth ? 'w-full' : 'w-40 max-w-48'} rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600`}
      />
      {isOpen && (
        <div className={`absolute left-0 z-30 mt-1 ${fullWidth ? 'w-full' : 'w-64'} rounded-lg border border-slate-200 bg-white p-2 shadow-lg`}>
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
