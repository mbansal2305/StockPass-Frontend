import React, { InputHTMLAttributes, useEffect, useState } from 'react';
import { roundToTwoDecimals } from '../../utils/numbers';

interface DecimalInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'min' | 'max' | 'step'> {
  value: number;
  onChange: (value: number) => void;
}

export const DecimalInput: React.FC<DecimalInputProps> = ({ value, onChange, onFocus, onBlur, onClick, ...props }) => {
  const [inputValue, setInputValue] = useState(String(roundToTwoDecimals(value)));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setInputValue(String(roundToTwoDecimals(value)));
  }, [value, isFocused]);

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      value={inputValue}
      onFocus={event => {
        setIsFocused(true);
        event.currentTarget.select();
        onFocus?.(event);
      }}
      onClick={event => {
        event.currentTarget.select();
        onClick?.(event);
      }}
      onChange={event => {
        const nextValue = event.target.value;
        if (!/^\d*(?:\.\d{0,2})?$/.test(nextValue)) return;
        setInputValue(nextValue);
        onChange(nextValue === '' || nextValue === '.' ? 0 : roundToTwoDecimals(Number(nextValue)));
      }}
      onBlur={event => {
        setInputValue(String(roundToTwoDecimals(Number(inputValue) || 0)));
        setIsFocused(false);
        onBlur?.(event);
      }}
    />
  );
};