export const calculateBulkOrderProgress = (
  contractQuantity: number,
  fulfilledQuantity: number,
  orderEntry: number,
  originalOrderEntry: number
) => {
  const previousFulfilled = Math.max(0, fulfilledQuantity - originalOrderEntry);
  const projectedFulfilled = previousFulfilled + orderEntry;
  return {
    fulfilled: projectedFulfilled,
    remaining: contractQuantity - projectedFulfilled,
    available: Math.max(0, contractQuantity - previousFulfilled)
  };
};
