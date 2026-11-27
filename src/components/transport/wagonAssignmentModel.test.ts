import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { WagonAssignmentState, WagonVehicle } from '../../api';
import { displayEditableQuantity, displayQuantity, displayRemainingQuantity, fromApi, hasVehicleAssignment, newEntry, newTrain, newWagon, proportionalQuantity, quantityUnits, remaining, remainingAfterEntry, stateWithVehicleEntry, toApi, trainName, updateEntryBags, validateEntry, vehicleAssignmentSummary, vehicleEntryChanged, vehicleSummaryTotals } from './wagonAssignmentModel';

const vehicles: WagonVehicle[] = [
  { id: 101, vehicle_no: 'MP09AB1234', gross_wt: '20.000', quantity_unit: 'quintal', bag_nos: '40' }
];

const saved: WagonAssignmentState = {
  bulk_transport: 1, status: 'pending', trains: [{
    id: 10, name: 'Train A', assignments: [
      { id: 100, transport: 101, wagon_number: 'W2', wagon_order: 2, quantity: '5.000', bag_nos: '10' },
      { id: 99, transport: 101, wagon_number: 'W1', wagon_order: 1, quantity: '12.500', bag_nos: '25' }
    ]
  }]
};

test('loads ordered wagons and retains IDs in the complete update', () => {
  const editor = fromApi(saved);
  assert.deepEqual(editor.trains[0].wagons.map(wagon => wagon.number), ['W1', 'W2']);
  assert.deepEqual(remaining(editor, vehicles[0]), { quantity: 2500, bags: 5 });
  assert.deepEqual(toApi(editor, 1, vehicles).trains[0].assignments.map(entry => [entry.id, entry.wagon_order]), [[99, 1], [100, 2]]);
  editor.trains[0].wagons.shift();
  assert.deepEqual(toApi(editor, 1, vehicles).trains[0].assignments.map(entry => [entry.id, entry.wagon_order]), [[100, 1]]);
});

test('allows excess quantity and bags across trains', () => {
  const editor = fromApi(saved);
  const train = newTrain('Train B');
  const wagon = newWagon('1');
  wagon.entries.push({ ...newEntry(), transport: '101', quantity: '2.501', bags: '5' });
  train.wagons.push(wagon);
  editor.trains.push(train);
  assert.equal(toApi(editor, 1, vehicles).trains[1].assignments[0].quantity, '2.501');
  wagon.entries[0].quantity = '2.500';
  wagon.entries[0].bags = '6';
  assert.equal(toApi(editor, 1, vehicles).trains[1].assignments[0].bag_nos, 6);
  assert.deepEqual(remaining(editor, vehicles[0]), { quantity: 0, bags: -1 });
  wagon.entries[0].bags = '';
  assert.equal(toApi(editor, 1, vehicles).trains[1].assignments[0].bag_nos, 0);
  assert.deepEqual(remaining(editor, vehicles[0]), { quantity: 0, bags: 5 });
  wagon.entries[0].bags = '5';
  assert.deepEqual(remaining(editor, vehicles[0]), { quantity: 0, bags: 0 });
  assert.equal(toApi(editor, 1, vehicles).trains[1].assignments[0].quantity, '2.500');
  wagon.entries[0].quantity = '';
  assert.equal(toApi(editor, 1, vehicles).trains[1].assignments[0].quantity, '0.000');
});

test('prevents duplicate vehicle assignments in a wagon but allows them in other wagons', () => {
  const editor = fromApi(saved);
  const [first, second] = editor.trains[0].wagons;
  const existing = first.entries[0];
  assert.equal(hasVehicleAssignment(first, '101'), true);
  assert.equal(hasVehicleAssignment(first, '101', existing.key), false);
  assert.equal(hasVehicleAssignment(first, '102'), false);
  assert.doesNotThrow(() => toApi(editor, 1, vehicles));

  first.entries.push({ ...newEntry(), transport: '101', quantity: '1', bags: '' });
  assert.equal(hasVehicleAssignment(first, '101', existing.key), true);
  assert.throws(() => toApi(editor, 1, vehicles), /MP09AB1234 is assigned more than once to wagon W1 in Train A/);
  first.entries.pop();
  assert.equal(hasVehicleAssignment(second, '101'), true);
  assert.doesNotThrow(() => toApi(editor, 1, vehicles));

  const legacy = structuredClone(saved);
  legacy.trains[0].assignments.push({ ...legacy.trains[0].assignments[1], id: 101 });
  const loaded = fromApi(legacy);
  assert.deepEqual(loaded.trains[0].wagons[0].entries.map(entry => entry.id), [99, 101]);
  assert.throws(() => toApi(loaded, 1, vehicles), /assigned more than once/);
  loaded.trains[0].wagons[0].entries.pop();
  assert.doesNotThrow(() => toApi(loaded, 1, vehicles));
});

test('allows further quantity assignments after a vehicle is fully allocated', () => {
  const editor = fromApi(saved);
  const wagon = newWagon('3');
  wagon.entries.push({ ...newEntry(), transport: '101', quantity: '5.000', bags: '5' });
  editor.trains[0].wagons.push(wagon);
  assert.deepEqual(remaining(editor, vehicles[0]), { quantity: -2500, bags: 0 });
  const next = newWagon('4');
  next.entries.push({ ...newEntry(), transport: '101', quantity: '1.000', bags: '' });
  editor.trains[0].wagons.push(next);
  assert.equal(toApi(editor, 1, vehicles).trains[0].assignments[3].quantity, '1.000');
});

test('validates empty wagons, invalid amounts and missing vehicles without discarding assignments', () => {
  const editor = fromApi(saved);
  editor.trains[0].wagons.push(newWagon('3'));
  assert.throws(() => toApi(editor, 1, vehicles), /empty wagon/);
  editor.trains[0].wagons.pop();
  editor.trains[0].wagons[0].entries[0].quantity = '0.0001';
  assert.throws(() => toApi(editor, 1, vehicles), /valid quantity/);
  assert.throws(() => toApi(editor, 1, []), /available vehicle/);
  assert.equal(quantityUnits('0.001'), 1);
  assert.equal(quantityUnits('-1'), null);
  assert.equal(trainName(26), 'Train AA');
});

test('rejects conflicting saved wagon information', () => {
  const invalid = structuredClone(saved);
  invalid.trains[0].assignments[1].wagon_order = 2;
  assert.throws(() => fromApi(invalid), /Conflicting wagon numbers/);
});

test('validates vehicle amounts independently of the remaining stock', () => {
  const editor = fromApi(saved);
  const entry = editor.trains[0].wagons[0].entries[0];
  const balance = remaining(editor, vehicles[0], entry.key);
  assert.deepEqual(balance, { quantity: 15000, bags: 30 });
  assert.equal(validateEntry({ ...entry, quantity: '15', bags: '30' }, vehicles[0]), null);
  assert.equal(validateEntry({ ...entry, quantity: '15.001', bags: '31' }, vehicles[0]), null);
  assert.match(validateEntry({ ...entry, quantity: '', bags: '' }, vehicles[0]) || '', /quantity or bags/);
  assert.match(validateEntry({ ...entry, bags: '1.5' }, vehicles[0]) || '', /whole bags/);
  assert.equal(toApi(editor, 1, vehicles).trains[0].assignments[0].id, 99);
});

test('calculates remaining amounts from the current edit without double counting', () => {
  const editor = fromApi(saved);
  const entry = editor.trains[0].wagons[0].entries[0];
  const balance = remaining(editor, vehicles[0], entry.key);
  assert.deepEqual(remainingAfterEntry(balance, entry), { quantity: 2500, bags: 5 });
  assert.deepEqual(remainingAfterEntry(balance, { ...entry, quantity: '16.001', bags: '32' }), { quantity: -1001, bags: -2 });
  assert.deepEqual(remainingAfterEntry(balance, { ...entry, quantity: '', bags: '' }), { quantity: 15000, bags: 30 });
  assert.deepEqual(remainingAfterEntry(balance, { ...entry, quantity: '2.', bags: 'abc' }), { quantity: 13000, bags: null });
  assert.deepEqual(remainingAfterEntry(balance, { ...entry, quantity: 'invalid', bags: '1' }), { quantity: null, bags: 29 });
});

test('calculates quantity from the vehicle ratio when bags change', () => {
  const vehicle = vehicles[0];
  assert.equal(proportionalQuantity(vehicle, '10'), '5.000');
  assert.equal(proportionalQuantity(vehicle, '40'), '20.000');
  assert.equal(proportionalQuantity(vehicle, '50'), '25.000');
  assert.equal(proportionalQuantity(vehicle, '0'), '0.000');
  assert.equal(proportionalQuantity({ ...vehicle, gross_wt: '1', bag_nos: '3' }, '1'), '0.333');
  assert.equal(proportionalQuantity({ ...vehicle, gross_wt: '0.001', bag_nos: '2' }, '1'), '0.001');
  assert.equal(proportionalQuantity({ ...vehicle, gross_wt: '1000000', bag_nos: '1000000000' }, '999999999'), '999999.999');

  const entry = { ...newEntry(), transport: '101', quantity: '4.500', bags: '8' };
  assert.deepEqual(updateEntryBags(entry, vehicle, '10'), { ...entry, quantity: '5.000', bags: '10' });
  assert.deepEqual(updateEntryBags(entry, vehicle, ''), { ...entry, bags: '' });
  assert.deepEqual(updateEntryBags(entry, vehicle, '1.5'), { ...entry, bags: '1.5' });
  assert.deepEqual(updateEntryBags(entry, { ...vehicle, bag_nos: 0 }, '10'), { ...entry, bags: '10' });
  assert.equal(proportionalQuantity({ ...vehicle, gross_wt: null }, '10'), null);
});

test('prepares an open vehicle entry for saving without mutating the editor state', () => {
  const state = fromApi(saved);
  const train = state.trains[0];
  const wagon = train.wagons[0];
  const original = wagon.entries[0];
  const editor = { trainKey: train.key, wagonKey: wagon.key, original, entry: { ...original, quantity: '13' }, isNew: false };
  const updated = stateWithVehicleEntry(state, editor, vehicles);
  assert.equal(state.trains[0].wagons[0].entries[0].quantity, '12.500');
  assert.equal(toApi(updated, 1, vehicles).trains[0].assignments[0].id, 99);
  assert.equal(toApi(updated, 1, vehicles).trains[0].assignments[0].quantity, '13.000');
  assert.throws(() => stateWithVehicleEntry(state, { ...editor, entry: { ...editor.entry, quantity: 'bad' } }, vehicles), /valid quantity/);
  assert.throws(() => stateWithVehicleEntry(state, { ...editor, wagonKey: 'missing' }, vehicles), /wagon is no longer available/);

  const newWagonEntry = newWagon('3');
  train.wagons.push(newWagonEntry);
  const addedEntry = { ...newEntry(), transport: '101', quantity: '1', bags: '' };
  const newEditor = { trainKey: train.key, wagonKey: newWagonEntry.key, original: addedEntry, entry: addedEntry, isNew: true };
  const withAddedEntry = stateWithVehicleEntry(state, newEditor, vehicles);
  assert.equal(state.trains[0].wagons[2].entries.length, 0);
  assert.equal(toApi(withAddedEntry, 1, vehicles).trains[0].assignments[2].transport, 101);
  assert.throws(() => stateWithVehicleEntry(state, { ...newEditor, wagonKey: wagon.key }, vehicles), /already assigned/);
});

test('summarizes committed and in-progress assignments for each vehicle', () => {
  const editor = fromApi(saved);
  const vehicle = vehicles[0];
  const entry = editor.trains[0].wagons[0].entries[0];
  assert.deepEqual(vehicleAssignmentSummary(editor, vehicle), {
    assigned: { quantity: 17500, bags: 35 }, remaining: { quantity: 2500, bags: 5 }
  });
  assert.deepEqual(vehicleAssignmentSummary(editor, vehicle, { ...entry, quantity: '16', bags: '32' }), {
    assigned: { quantity: 21000, bags: 42 }, remaining: { quantity: -1000, bags: -2 }
  });
  assert.deepEqual(vehicleAssignmentSummary(editor, vehicle, { ...newEntry(), transport: '101', quantity: '2.5', bags: '5' }), {
    assigned: { quantity: 20000, bags: 40 }, remaining: { quantity: 0, bags: 0 }
  });
  assert.deepEqual(vehicleAssignmentSummary(editor, vehicle, { ...entry, quantity: 'bad', bags: '30' }), {
    assigned: { quantity: null, bags: 40 }, remaining: { quantity: null, bags: 0 }
  });
  const otherVehicle = { ...vehicle, id: 102, gross_wt: '10', bag_nos: '3' };
  assert.deepEqual(vehicleAssignmentSummary(editor, otherVehicle, entry), {
    assigned: { quantity: 0, bags: 0 }, remaining: { quantity: 10000, bags: 3 }
  });
  const anotherTrain = newTrain('Train B');
  const wagon = newWagon('1');
  wagon.entries.push({ ...newEntry(), transport: '101', quantity: '1', bags: '2' });
  anotherTrain.wagons.push(wagon);
  editor.trains.push(anotherTrain);
  assert.deepEqual(vehicleAssignmentSummary(editor, vehicle), {
    assigned: { quantity: 18500, bags: 37 }, remaining: { quantity: 1500, bags: 3 }
  });
  editor.trains.pop();
  editor.trains[0].wagons.shift();
  assert.deepEqual(vehicleAssignmentSummary(editor, vehicle), {
    assigned: { quantity: 5000, bags: 10 }, remaining: { quantity: 15000, bags: 30 }
  });
  editor.trains[0].wagons[0].entries[0].bags = 'invalid';
  assert.deepEqual(vehicleAssignmentSummary(editor, vehicle), {
    assigned: { quantity: 5000, bags: null }, remaining: { quantity: 15000, bags: null }
  });
});

test('totals vehicles and live assignments without combining different units', () => {
  const editor = fromApi(saved);
  const otherVehicle: WagonVehicle = { id: 102, vehicle_no: 'OTHER', gross_wt: '3.500', quantity_unit: 'mt', bag_nos: '7' };
  const allVehicles = [vehicles[0], otherVehicle];
  const entry = editor.trains[0].wagons[0].entries[0];
  const summarize = (editingEntry?: typeof entry) => vehicleSummaryTotals(
    editor, allVehicles.map(vehicle => ({ vehicle, summary: vehicleAssignmentSummary(editor, vehicle, editingEntry) })), editingEntry
  );
  assert.deepEqual(summarize(), {
    quantities: [{ unit: 'Qtl', vehicles: 20000, assigned: 17500, difference: 2500 }, { unit: 'MT', vehicles: 3500, assigned: 0, difference: 3500 }],
    vehicleBags: 47, assignedBags: 35, differenceBags: 12, unavailableAssignment: false
  });
  const changed = { ...entry, quantity: '16', bags: '32' };
  assert.equal(summarize(changed).quantities[0].assigned, 21000);
  assert.equal(summarize(changed).quantities[0].difference, -1000);
  assert.equal(summarize(changed).assignedBags, 42);
  assert.equal(summarize(changed).differenceBags, 5);
  const full = { ...entry, quantity: '15', bags: '30' };
  assert.equal(summarize(full).quantities[0].difference, 0);
  assert.equal(summarize({ ...entry, bags: '39' }).differenceBags, -2);
  const invalid = { ...entry, quantity: 'invalid', bags: 'bad' };
  assert.equal(summarize(invalid).quantities[0].assigned, null);
  assert.equal(summarize(invalid).quantities[0].difference, null);
  assert.equal(summarize(invalid).assignedBags, null);
  assert.equal(summarize(invalid).differenceBags, null);
  editor.trains[0].wagons[0].entries.push({ ...newEntry(), transport: '999', quantity: '1', bags: '1' });
  assert.equal(summarize().unavailableAssignment, true);
  assert.equal(summarize().quantities[0].difference, null);
  assert.equal(summarize().differenceBags, null);
});

test('formats remaining quantities to at most two decimals without changing assignment precision', () => {
  assert.equal(displayRemainingQuantity(0), '0');
  assert.equal(displayRemainingQuantity(1234), '1.23');
  assert.equal(displayRemainingQuantity(1005), '1.01');
  assert.equal(displayRemainingQuantity(-1234), '-1.23');
  assert.equal(displayQuantity(1234), '1.234');
});

test('formats editable quantity to two decimals without changing saved precision', () => {
  assert.equal(displayEditableQuantity('1.234'), '1.23');
  assert.equal(displayEditableQuantity('1.235'), '1.24');
  assert.equal(displayEditableQuantity('9.999'), '10');
  assert.equal(displayEditableQuantity('0.001'), '0');
  assert.equal(displayEditableQuantity(''), '');
  const editor = fromApi(saved);
  const entry = editor.trains[0].wagons[0].entries[0];
  entry.quantity = '12.505';
  assert.equal(displayEditableQuantity(entry.quantity), '12.51');
  assert.equal(toApi(editor, 1, vehicles).trains[0].assignments[0].quantity, '12.505');
});

test('detects uncommitted quantity or bag changes and ignores reverted edits', () => {
  const original = { ...newEntry(), transport: '101', quantity: '12.500', bags: '25' };
  assert.equal(vehicleEntryChanged(original, { ...original }), false);
  assert.equal(vehicleEntryChanged(original, { ...original, quantity: '13' }), true);
  assert.equal(vehicleEntryChanged(original, { ...original, bags: '' }), true);
  assert.equal(vehicleEntryChanged(original, { ...original, quantity: '12.500', bags: '25' }), false);
  const newVehicle = { ...newEntry(), transport: '101' };
  assert.equal(vehicleEntryChanged(newVehicle, { ...newVehicle }), false);
});
