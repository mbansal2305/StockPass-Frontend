import type React from 'react';

export const handleFormEnterKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
  if (event.key !== 'Enter' || event.nativeEvent.isComposing || !(event.target instanceof HTMLInputElement)) return;
  if (event.target.type === 'checkbox') {
    event.preventDefault();
    if (!event.repeat) event.target.click();
  } else if (event.target.type !== 'file') {
    event.preventDefault();
  }
};
