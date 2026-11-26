import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';

export interface SearchableOption {
  id: string;
  label: string;
  searchText?: string;
  highlightText?: string;
}

export const scrollActiveOptionIntoView = (list: HTMLDivElement | null, activeIndex: number) => {
  const option = list?.children.item(activeIndex);
  if (!list || !option) return;

  const listTop = list.getBoundingClientRect().top + list.clientTop;
  const listBottom = listTop + list.clientHeight;
  const optionRect = option.getBoundingClientRect();
  if (optionRect.top < listTop) {
    list.scrollTop += optionRect.top - listTop;
  } else if (optionRect.bottom > listBottom) {
    list.scrollTop += optionRect.bottom - listBottom;
  }
};

interface SearchableSelectProps {
  id: string;
  value: string;
  options: SearchableOption[];
  placeholder: string;
  onChange: (value: string) => void;
  highlightFirstMatch?: boolean;
  selectOnTab?: boolean;
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
  selectOnTab = false,
  wrapOptions = false,
  portalOptions = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>();
  const containerRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
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

  useLayoutEffect(() => {
    if (!isOpen || activeOptionIndex < 0) return;
    scrollActiveOptionIntoView(optionsRef.current, activeOptionIndex);
  }, [isOpen, activeOptionIndex, normalizedQuery, filteredOptions.length, dropdownStyle]);

  const selectOption = (option: SearchableOption) => {
    onChange(option.id);
    setQuery('');
    setIsOpen(false);
  };

  const optionsList = (
    <div
      ref={optionsRef}
      id={`${id}-options`}
      role="listbox"
      tabIndex={selectOnTab ? -1 : undefined}
      className={`${portalOptions ? 'fixed z-20' : 'absolute z-20 mt-1 max-h-52 w-full'} overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg`}
      style={portalOptions ? dropdownStyle : undefined}
    >
      {filteredOptions.length ? filteredOptions.map((option, index) => (
        <button
          key={option.id}
          id={`${id}-option-${index}`}
          type="button"
          role="option"
          tabIndex={selectOnTab ? -1 : undefined}
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
          setActiveIndex(selectedIndex < 0 && selectOnTab ? 0 : selectedIndex);
        }}
        onClick={() => {
          if (!isOpen) {
            setQuery('');
            setIsOpen(true);
            const selectedIndex = options.findIndex(option => option.id === value);
            setActiveIndex(selectedIndex < 0 && selectOnTab ? 0 : selectedIndex);
          }
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(highlightFirstMatch || selectOnTab ? 0 : -1);
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
              setActiveIndex(selectedIndex < 0 && selectOnTab ? 0 : selectedIndex);
            } else if (filteredOptions.length) {
              setActiveIndex(index => {
                if (event.key === 'ArrowDown') {
                  return index < 0 ? 0 : Math.min(index + 1, filteredOptions.length - 1);
                }
                return index < 0 ? filteredOptions.length - 1 : Math.max(index - 1, 0);
              });
            }
          } else if (event.key === 'Tab' && !event.shiftKey && selectOnTab && isOpen && activeOptionIndex >= 0) {
            selectOption(filteredOptions[activeOptionIndex]);
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

interface MultiSearchableSelectBaseProps {
  id: string;
  selectedIds: string[];
  options: SearchableOption[];
  placeholder: string;
  onChange: (values: string[]) => void;
  fullWidth?: boolean;
}

type MultiSearchableSelectProps = MultiSearchableSelectBaseProps & (
  | { keyboardNavigation: true; nextFocusId: string }
  | { keyboardNavigation?: false; nextFocusId?: never }
);

export const MultiSearchableSelect: React.FC<MultiSearchableSelectProps> = ({
  id,
  selectedIds,
  options,
  placeholder,
  onChange,
  fullWidth = false,
  keyboardNavigation,
  nextFocusId
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const optionsRef = useRef<HTMLDivElement>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter(option =>
        `${option.label} ${option.searchText || ''}`.toLowerCase().includes(normalizedQuery)
      )
    : options;
  const activeOptionIndex = filteredOptions.length ? Math.min(activeIndex, filteredOptions.length - 1) : -1;
  const selectedOptions = options.filter(option => selectedIds.includes(option.id));
  const searchPlaceholder = selectedOptions.length > 0
    ? `${selectedOptions.length} selected · Search ${placeholder.replace(/^All /, '').toLowerCase()}`
    : `Search ${placeholder.replace(/^All /, '').toLowerCase()}...`;

  useLayoutEffect(() => {
    if (keyboardNavigation && isOpen && activeOptionIndex >= 0) {
      scrollActiveOptionIntoView(optionsRef.current, activeOptionIndex);
    }
  }, [keyboardNavigation, isOpen, activeOptionIndex, normalizedQuery, filteredOptions.length]);

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
        aria-activedescendant={keyboardNavigation && isOpen && activeOptionIndex >= 0 ? `${id}-option-${activeOptionIndex}` : undefined}
        aria-description={keyboardNavigation ? 'Use Up and Down to navigate, Tab to toggle an option, Enter for the next filter, and Shift+Tab to go back.' : undefined}
        autoComplete="off"
        value={query}
        onFocus={() => {
          setIsOpen(true);
          if (keyboardNavigation) setActiveIndex(0);
        }}
        onClick={() => {
          if (keyboardNavigation && !isOpen) {
            setActiveIndex(0);
            setIsOpen(true);
          }
        }}
        onChange={event => {
          setQuery(event.target.value);
          setIsOpen(true);
          if (keyboardNavigation) setActiveIndex(0);
        }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Escape') {
            setIsOpen(false);
          } else if (keyboardNavigation && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            if (!isOpen) {
              setActiveIndex(0);
              setIsOpen(true);
            } else if (activeOptionIndex >= 0) {
              setActiveIndex(event.key === 'ArrowDown'
                ? Math.min(activeOptionIndex + 1, filteredOptions.length - 1)
                : Math.max(activeOptionIndex - 1, 0));
            }
          } else if (keyboardNavigation && event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && isOpen) {
            event.preventDefault();
            if (!event.repeat && activeOptionIndex >= 0) {
              toggleOption(filteredOptions[activeOptionIndex].id);
              setActiveIndex(Math.min(activeOptionIndex + 1, filteredOptions.length - 1));
            }
          } else if (keyboardNavigation && event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
            event.preventDefault();
            const next = document.getElementById(nextFocusId);
            if (next instanceof HTMLElement) next.focus();
            else console.error(`Next filter "${nextFocusId}" was not found`);
          }
        }}
        placeholder={searchPlaceholder}
        className={`${fullWidth ? 'w-full' : 'w-40 max-w-48'} rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600`}
      />
      {isOpen && (
        <div className={`absolute left-0 z-30 mt-1 ${fullWidth ? 'w-full' : 'w-64'} rounded-lg border border-slate-200 bg-white p-2 shadow-lg`}>
          <div
            ref={optionsRef}
            id={`${id}-options`}
            role="listbox"
            aria-multiselectable="true"
            tabIndex={keyboardNavigation ? -1 : undefined}
            className="max-h-52 overflow-y-auto"
          >
            {filteredOptions.length ? filteredOptions.map((option, index) => {
              const isSelected = selectedIds.includes(option.id);
              return (
                <button
                  key={option.id}
                  id={keyboardNavigation ? `${id}-option-${index}` : undefined}
                  type="button"
                  role="option"
                  tabIndex={keyboardNavigation ? -1 : undefined}
                  aria-selected={isSelected}
                  onMouseDown={event => { if (keyboardNavigation) event.preventDefault(); }}
                  onMouseMove={() => { if (keyboardNavigation) setActiveIndex(index); }}
                  onClick={() => toggleOption(option.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded px-2.5 py-2 text-left text-xs hover:bg-blue-50 ${
                    keyboardNavigation && index === activeOptionIndex
                      ? 'bg-blue-100 ring-1 ring-inset ring-blue-400'
                      : isSelected ? 'bg-blue-50' : ''
                  } ${
                    isSelected ? 'text-blue-800' : 'text-slate-700'
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
              tabIndex={keyboardNavigation ? -1 : undefined}
              onMouseDown={event => { if (keyboardNavigation) event.preventDefault(); }}
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
