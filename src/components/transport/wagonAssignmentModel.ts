import { WagonAssignmentState, WagonAssignmentStatus, WagonVehicle } from '../../api';
import { getShortUnitLabel } from '../../utils/formatters';

let nextKey = 0;
const key = () => `wagon-editor-${++nextKey}`;

export interface VehicleEntry {
  key: string;
  id?: number;
  transport: string;
  quantity: string;
  bags: string;
}

export interface VehicleEditor {
  trainKey: string;
  wagonKey: string;
  entry: VehicleEntry;
  original: VehicleEntry;
  isNew: boolean;
}

export function vehicleEntryChanged(original: VehicleEntry, current: VehicleEntry): boolean {
  return original.quantity !== current.quantity || original.bags !== current.bags;
}

export interface Wagon {
  key: string;
  number: string;
  entries: VehicleEntry[];
}

export function hasVehicleAssignment(wagon: Wagon, transport: string, excludeKey?: string): boolean {
  return wagon.entries.some(entry => entry.transport === transport && entry.key !== excludeKey);
}

export interface Train {
  key: string;
  id?: number;
  name: string;
  wagons: Wagon[];
}

export interface EditorState {
  status: WagonAssignmentStatus;
  trains: Train[];
}

export const newEntry = (): VehicleEntry => ({ key: key(), transport: '', quantity: '', bags: '' });
export const newWagon = (number: string): Wagon => ({ key: key(), number, entries: [] });
export const newTrain = (name: string): Train => ({ key: key(), name, wagons: [] });

export function trainName(index: number): string {
  let value = index + 1;
  let suffix = '';
  while (value > 0) {
    value--;
    suffix = String.fromCharCode(65 + value % 26) + suffix;
    value = Math.floor(value / 26);
  }
  return `Train ${suffix}`;
}

// Quantities are calculated as thousandths to avoid floating-point allocation errors.
export function quantityUnits(value: string): number | null {
  if (!/^\d+(?:\.\d{1,3})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const units = Number(whole) * 1000 + Number(fraction.padEnd(3, '0'));
  return Number.isSafeInteger(units) ? units : null;
}

export function bagUnits(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const bags = Number(value);
  return Number.isSafeInteger(bags) ? bags : null;
}

export function displayQuantity(units: number): string {
  return (units / 1000).toFixed(3);
}

export function displayEditableQuantity(value: string): string {
  const units = quantityUnits(value);
  if (units === null) return value;
  const hundredths = Math.floor(units / 10) + (units % 10 >= 5 ? 1 : 0);
  const fraction = String(hundredths % 100).padStart(2, '0').replace(/0+$/, '');
  return `${Math.floor(hundredths / 100)}${fraction ? `.${fraction}` : ''}`;
}

export function proportionalQuantity(vehicle: WagonVehicle, bags: string): string | null {
  const totalQuantity = quantityUnits(String(vehicle.gross_wt ?? ''));
  const totalBags = bagUnits(String(vehicle.bag_nos ?? ''));
  const assignedBags = bagUnits(bags);
  if (totalQuantity === null || totalBags === null || totalBags === 0 || assignedBags === null) return null;
  const denominator = BigInt(totalBags);
  const units = (BigInt(totalQuantity) * BigInt(assignedBags) * 2n + denominator) / (denominator * 2n);
  if (units > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return `${units / 1000n}.${String(units % 1000n).padStart(3, '0')}`;
}

export function updateEntryBags(entry: VehicleEntry, vehicle: WagonVehicle | undefined, bags: string): VehicleEntry {
  const quantity = vehicle ? proportionalQuantity(vehicle, bags) : null;
  return { ...entry, bags, quantity: quantity ?? entry.quantity };
}

export function displayRemainingQuantity(units: number): string {
  return (units / 1000).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function fromApi(data: WagonAssignmentState): EditorState {
  if (!data || !Array.isArray(data.trains) || !['draft', 'pending', 'submitted'].includes(data.status)) {
    throw new Error('Invalid wagon assignment data');
  }
  return {
    status: data.status,
    trains: data.trains.map(train => {
      if (!Number.isSafeInteger(train.id) || !train.id || train.id < 1 || typeof train.name !== 'string' || !Array.isArray(train.assignments)) {
        throw new Error('Invalid train assignments');
      }
      const wagons = new Map<number, Wagon>();
      for (const assignment of train.assignments) {
        if (!Number.isSafeInteger(assignment.id) || !assignment.id || assignment.id < 1 || !Number.isSafeInteger(assignment.transport) || assignment.transport < 1
          || !Number.isInteger(assignment.wagon_order) || assignment.wagon_order < 1 || !assignment.wagon_number) {
          throw new Error('Invalid wagon details in saved assignments');
        }
        let wagon = wagons.get(assignment.wagon_order);
        if (!wagon) {
          wagon = newWagon(assignment.wagon_number);
          wagons.set(assignment.wagon_order, wagon);
        } else if (wagon.number !== assignment.wagon_number) {
          throw new Error('Conflicting wagon numbers in saved assignments');
        }
        wagon.entries.push({
          key: key(), id: assignment.id, transport: String(assignment.transport),
          quantity: assignment.quantity == null ? '' : String(assignment.quantity),
          bags: assignment.bag_nos == null ? '' : String(assignment.bag_nos)
        });
      }
      return {
        key: key(), id: train.id, name: train.name,
        wagons: [...wagons.entries()].sort(([a], [b]) => a - b).map(([, wagon]) => wagon)
      };
    })
  };
}

export function remaining(state: EditorState, vehicle: WagonVehicle, excludeKey?: string): { quantity: number; bags: number } {
  let quantity = quantityUnits(String(vehicle.gross_wt ?? '0')) ?? 0;
  let bags = bagUnits(String(vehicle.bag_nos ?? '0')) ?? 0;
  for (const train of state.trains) for (const wagon of train.wagons) for (const entry of wagon.entries) {
    if (entry.transport !== String(vehicle.id) || entry.key === excludeKey) continue;
    quantity -= quantityUnits(entry.quantity) ?? 0;
    bags -= bagUnits(entry.bags) ?? 0;
  }
  return { quantity, bags };
}

export function remainingAfterEntry(
  balance: { quantity: number; bags: number },
  entry: VehicleEntry
): { quantity: number | null; bags: number | null } {
  const quantityText = entry.quantity.endsWith('.') ? entry.quantity.slice(0, -1) : entry.quantity;
  const quantity = entry.quantity === '' ? 0 : quantityUnits(quantityText);
  const bags = entry.bags === '' ? 0 : bagUnits(entry.bags);
  return {
    quantity: quantity === null ? null : balance.quantity - quantity,
    bags: bags === null ? null : balance.bags - bags
  };
}

export function vehicleAssignmentSummary(state: EditorState, vehicle: WagonVehicle, editingEntry?: VehicleEntry): {
  assigned: { quantity: number | null; bags: number | null };
  remaining: { quantity: number | null; bags: number | null };
} {
  const totalQuantity = quantityUnits(String(vehicle.gross_wt ?? '0'));
  const totalBags = bagUnits(String(vehicle.bag_nos ?? '0'));
  let quantity = totalQuantity;
  let bags = totalBags;
  let foundEditingEntry = false;
  const applyEntry = (entry: VehicleEntry) => {
    const balance = remainingAfterEntry({ quantity: quantity ?? 0, bags: bags ?? 0 }, entry);
    if (quantity !== null) quantity = balance.quantity;
    if (bags !== null) bags = balance.bags;
  };
  for (const train of state.trains) for (const wagon of train.wagons) for (const entry of wagon.entries) {
    if (entry.transport !== String(vehicle.id)) continue;
    if (editingEntry?.key === entry.key && editingEntry.transport === entry.transport) {
      foundEditingEntry = true;
      applyEntry(editingEntry);
    } else {
      applyEntry(entry);
    }
  }
  if (editingEntry?.transport === String(vehicle.id) && !foundEditingEntry) applyEntry(editingEntry);
  return {
    assigned: {
      quantity: totalQuantity === null || quantity === null ? null : totalQuantity - quantity,
      bags: totalBags === null || bags === null ? null : totalBags - bags
    },
    remaining: { quantity, bags }
  };
}

export function vehicleSummaryTotals(
  state: EditorState,
  summaries: { vehicle: WagonVehicle; summary: ReturnType<typeof vehicleAssignmentSummary> }[],
  editingEntry?: VehicleEntry
): {
  quantities: { unit: string; vehicles: number | null; assigned: number | null; difference: number | null }[];
  vehicleBags: number | null;
  assignedBags: number | null;
  differenceBags: number | null;
  unavailableAssignment: boolean;
} {
  const quantities = new Map<string, { unit: string; vehicles: number | null; assigned: number | null }>();
  const add = (a: number | null, b: number | null): number | null => {
    if (a === null || b === null || !Number.isSafeInteger(a + b)) return null;
    return a + b;
  };
  let vehicleBags: number | null = 0;
  let assignedBags: number | null = 0;
  for (const { vehicle, summary } of summaries) {
    const unit = getShortUnitLabel(vehicle.quantity_unit);
    const unitKey = unit.toLowerCase();
    const totals = quantities.get(unitKey) ?? { unit, vehicles: 0, assigned: 0 };
    totals.vehicles = unit ? add(totals.vehicles, quantityUnits(String(vehicle.gross_wt ?? '0'))) : null;
    totals.assigned = unit ? add(totals.assigned, summary.assigned.quantity) : null;
    quantities.set(unitKey, totals);
    vehicleBags = add(vehicleBags, bagUnits(String(vehicle.bag_nos ?? '0')));
    assignedBags = add(assignedBags, summary.assigned.bags);
  }
  const vehicleIds = new Set(summaries.map(({ vehicle }) => String(vehicle.id)));
  const unavailableAssignment = state.trains.some(train => train.wagons.some(wagon =>
    wagon.entries.some(entry => !vehicleIds.has(entry.transport))
  )) || Boolean(editingEntry && !vehicleIds.has(editingEntry.transport));
  const difference = (vehicles: number | null, assigned: number | null): number | null =>
    unavailableAssignment || vehicles === null || assigned === null || !Number.isSafeInteger(vehicles - assigned)
      ? null : vehicles - assigned;
  return {
    quantities: [...quantities.values()].map(total => ({ ...total, difference: difference(total.vehicles, total.assigned) })),
    vehicleBags, assignedBags, differenceBags: difference(vehicleBags, assignedBags), unavailableAssignment
  };
}

export function validateEntry(entry: VehicleEntry, vehicle: WagonVehicle): string | null {
  const quantity = entry.quantity === '' ? 0 : quantityUnits(entry.quantity);
  const bags = entry.bags === '' ? 0 : bagUnits(entry.bags);
  if (quantity === null || bags === null) return `Enter a valid quantity (up to 3 decimals) and whole bags for ${vehicle.vehicle_no}.`;
  if (quantity === 0 && bags === 0) return `Enter a quantity or bags for ${vehicle.vehicle_no}.`;
  return null;
}

export function stateWithVehicleEntry(state: EditorState, editor: VehicleEditor, vehicles: WagonVehicle[]): EditorState {
  const vehicle = vehicles.find(item => String(item.id) === editor.entry.transport);
  if (!vehicle) throw new Error('This vehicle is no longer available. Remove or replace it before saving.');
  const wagon = state.trains.find(train => train.key === editor.trainKey)?.wagons.find(item => item.key === editor.wagonKey);
  if (!wagon) throw new Error('This wagon is no longer available. Reopen the vehicle entry before saving.');
  if (editor.isNew && hasVehicleAssignment(wagon, editor.entry.transport)) {
    throw new Error(`${vehicle.vehicle_no} is already assigned to this wagon. Edit the existing assignment instead.`);
  }
  if (!editor.isNew && !wagon.entries.some(entry => entry.key === editor.entry.key)) {
    throw new Error('This vehicle assignment is no longer available. Reopen it before saving.');
  }
  const validationError = validateEntry(editor.entry, vehicle);
  if (validationError) throw new Error(validationError);
  return {
    ...state,
    trains: state.trains.map(train => train.key !== editor.trainKey ? train : {
      ...train,
      wagons: train.wagons.map(item => item.key !== editor.wagonKey ? item : {
        ...item,
        entries: editor.isNew
          ? [...item.entries, editor.entry]
          : item.entries.map(entry => entry.key === editor.entry.key ? editor.entry : entry)
      })
    })
  };
}

export function toApi(state: EditorState, bulkId: number, vehicles: WagonVehicle[]): WagonAssignmentState {
  if (!Number.isSafeInteger(bulkId) || bulkId <= 0) throw new Error('Invalid bulk transport ID');
  const vehicleMap = new Map(vehicles.map(vehicle => [String(vehicle.id), vehicle]));
  for (const vehicle of vehicles) {
    if (quantityUnits(String(vehicle.gross_wt ?? '0')) === null || bagUnits(String(vehicle.bag_nos ?? '0')) === null) {
      throw new Error(`Invalid available quantity or bags for ${vehicle.vehicle_no}`);
    }
  }
  const trains = state.trains.map(train => {
    if (!train.name.trim()) throw new Error('Enter a name for each train.');
    const numbers = new Set<string>();
    const assignments = train.wagons.flatMap((wagon, index) => {
      const number = wagon.number.trim();
      if (!number) throw new Error(`Enter a wagon number for ${train.name}.`);
      if (numbers.has(number.toLowerCase())) throw new Error(`Wagon ${number} is duplicated in ${train.name}.`);
      numbers.add(number.toLowerCase());
      if (!wagon.entries.length) throw new Error(`Add a vehicle to wagon ${number}, or remove the empty wagon before saving.`);
      return wagon.entries.map(entry => {
        const vehicle = vehicleMap.get(entry.transport);
        if (!vehicle) throw new Error(`Select an available vehicle for wagon ${number}.`);
        if (hasVehicleAssignment(wagon, entry.transport, entry.key)) {
          throw new Error(`${vehicle.vehicle_no} is assigned more than once to wagon ${number} in ${train.name}. Remove the duplicate before saving.`);
        }
        const entryError = validateEntry(entry, vehicle);
        if (entryError) throw new Error(entryError);
        const quantity = quantityUnits(entry.quantity) ?? 0;
        const bags = bagUnits(entry.bags) ?? 0;
        return {
          ...(entry.id === undefined ? {} : { id: entry.id }),
          transport: vehicle.id, wagon_number: number, wagon_order: index + 1,
          quantity: displayQuantity(quantity), bag_nos: bags
        };
      });
    });
    return { ...(train.id === undefined ? {} : { id: train.id }), name: train.name.trim(), assignments };
  });
  return { bulk_transport: bulkId, status: state.status, trains };
}
