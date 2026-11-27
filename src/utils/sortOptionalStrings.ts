export function sortOptionalStrings<T>(
  items: T[],
  getValue: (item: T) => string | null | undefined,
  ascending: boolean
): T[] {
  return items.slice().sort((a, b) => {
    const valueA = getValue(a);
    const valueB = getValue(b);
    if (!valueA) return valueB ? 1 : 0;
    if (!valueB) return -1;
    if (valueA < valueB) return ascending ? -1 : 1;
    if (valueA > valueB) return ascending ? 1 : -1;
    return 0;
  });
}
