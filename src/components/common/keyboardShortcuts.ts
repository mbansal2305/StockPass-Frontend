type ShortcutEvent = Pick<KeyboardEvent, 'defaultPrevented' | 'repeat' | 'isComposing' | 'ctrlKey' | 'altKey' | 'metaKey' | 'target'>;

export const shouldIgnoreShortcut = (event: ShortcutEvent): boolean => {
  if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return true;
  const target = event.target;
  return target instanceof HTMLElement
    && Boolean(target.isContentEditable || target.closest('input, textarea, select, [role="textbox"], [role="combobox"]'));
};
