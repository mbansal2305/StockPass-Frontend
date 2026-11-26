import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { formatDateInputValue, formatDateInputDraft, parseDateInputValue } from '../../utils/dateInput';

interface DateInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hasError?: boolean;
}

export const DateInput: React.FC<DateInputProps> = ({ id, value, onChange, required, hasError }) => {
  const [draft, setDraft] = useState(() => formatDateInputValue(value));
  const [invalid, setInvalid] = useState(false);
  const [showError, setShowError] = useState(false);
  const textInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);

  useEffect(() => {
    setDraft(formatDateInputValue(value));
    setInvalid(false);
    setShowError(false);
    textInputRef.current?.setCustomValidity('');
  }, [value]);

  useLayoutEffect(() => {
    const input = textInputRef.current;
    if (input && caretRef.current !== null && document.activeElement === input) {
      input.setSelectionRange(caretRef.current, caretRef.current);
    }
    caretRef.current = null;
  }, [draft]);

  const updateDraft = (input: HTMLInputElement, raw: string, caret: number) => {
    const nextDraft = formatDateInputDraft(raw);
    const parsed = parseDateInputValue(nextDraft);
    const isInvalid = nextDraft !== '' && !parsed;
    caretRef.current = Math.min(formatDateInputDraft(raw.slice(0, caret)).length, nextDraft.length);
    if (nextDraft === draft) {
      input.value = nextDraft;
      input.setSelectionRange(caretRef.current, caretRef.current);
      caretRef.current = null;
    }
    setDraft(nextDraft);
    setInvalid(isInvalid);
    if (!isInvalid) setShowError(false);
    input.setCustomValidity(isInvalid ? 'Enter a valid date in DD/MM/YYYY format.' : '');
    if (parsed || !nextDraft) onChange(parsed || '');
  };

  const displayError = invalid && (showError || draft.replace(/\D/g, '').length === 8);
  const dateLabel = id.replace(/^(transport|order|bulk|expense|hisaab)-/, '').replace(/-/g, ' ');

  return (
    <div>
      <div className="relative">
        <input
          ref={textInputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          required={required}
          value={draft}
          placeholder="DD/MM/YYYY"
          aria-invalid={displayError || hasError || undefined}
          aria-describedby={displayError ? `${id}-error` : undefined}
          onFocus={event => event.currentTarget.select()}
          onChange={event => {
            const input = event.currentTarget;
            const caret = input.selectionStart ?? input.value.length;
            const nativeEvent = event.nativeEvent;
            if ('inputType' in nativeEvent && formatDateInputDraft(input.value) === draft && draft[caret] === '/') {
              if (nativeEvent.inputType === 'deleteContentBackward' && caret > 0) {
                updateDraft(input, input.value.slice(0, caret - 1) + input.value.slice(caret), caret - 1);
                return;
              }
              if (nativeEvent.inputType === 'deleteContentForward' && caret < input.value.length) {
                updateDraft(input, input.value.slice(0, caret) + input.value.slice(caret + 1), caret);
                return;
              }
            }
            updateDraft(input, input.value, caret);
          }}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
            const input = event.currentTarget;
            const start = input.selectionStart;
            const end = input.selectionEnd;
            if (start === null || start !== end) return;
            if (event.key === 'Backspace' && start > 1 && draft[start - 1] === '/') {
              event.preventDefault();
              updateDraft(input, draft.slice(0, start - 2) + draft.slice(start), start - 2);
            } else if (event.key === 'Delete' && draft[start] === '/' && start + 1 < draft.length) {
              event.preventDefault();
              updateDraft(input, draft.slice(0, start) + draft.slice(start + 2), start);
            }
          }}
          onBlur={() => {
            if (invalid) setShowError(true);
          }}
          onInvalid={() => setShowError(true)}
          className={`w-full rounded-lg border px-3 py-2 pr-10 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 ${
            hasError ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
          }`}
        />
        <button
          type="button"
          aria-label={`Choose ${dateLabel}`}
          onClick={() => {
            if (dateInputRef.current?.showPicker) dateInputRef.current.showPicker();
            else dateInputRef.current?.click();
          }}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500"
        >
          <Calendar className="h-4 w-4" aria-hidden="true" />
        </button>
        <input
          ref={dateInputRef}
          type="date"
          aria-hidden="true"
          tabIndex={-1}
          value={value}
          onChange={event => {
            setDraft(formatDateInputValue(event.target.value));
            setInvalid(false);
            setShowError(false);
            textInputRef.current?.setCustomValidity('');
            onChange(event.target.value);
          }}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        />
      </div>
      {displayError && <p id={`${id}-error`} className="mt-1 text-[10px] text-red-600">Enter a valid date in DD/MM/YYYY format.</p>}
    </div>
  );
};
