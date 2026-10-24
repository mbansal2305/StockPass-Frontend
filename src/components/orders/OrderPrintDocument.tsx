import React from 'react';
import { OrderStatus, OrderType, QuantityUnit } from '../../types';
import { formatCurrency, formatDate, formatQuantityWithUnit, getUnitLabel } from '../../utils/formatters';

interface OrderPrintDocumentProps {
  orderNumber: string;
  type: OrderType;
  status: OrderStatus;
  commodity: string;
  fromClient: string;
  toClient: string;
  quantity: number;
  unit: QuantityUnit;
  rate: number;
  contractDate: string;
  startDate: string;
  expiryDate: string;
  broker: string;
  notes: string;
}

export const OrderPrintDocument: React.FC<OrderPrintDocumentProps> = ({
  orderNumber,
  type,
  status,
  commodity,
  fromClient,
  toClient,
  quantity,
  unit,
  rate,
  contractDate,
  startDate,
  expiryDate,
  broker,
  notes
}) => (
  <div className="order-print-root" aria-hidden="true">
    <article className="order-print-paper">
      <header className="order-print-header">
        <div>
          <p className="order-print-eyebrow">{type}</p>
          <h1>Order {orderNumber || '-'}</h1>
        </div>
        <div className="order-print-status">
          <span>Status</span>
          <strong>{status}</strong>
        </div>
      </header>

      <section className="order-print-section">
        <h2>Order Information</h2>
        <dl className="order-print-grid">
          <div><dt>Commodity</dt><dd>{commodity || '-'}</dd></div>
          <div><dt>Contract Quantity</dt><dd>{formatQuantityWithUnit(quantity, unit)}</dd></div>
          <div><dt>Rate</dt><dd>{formatCurrency(rate)} per {getUnitLabel(unit)}</dd></div>
          <div><dt>Contract Value</dt><dd>{formatCurrency(quantity * rate)}</dd></div>
          <div><dt>Dispatch Origin</dt><dd>{fromClient || '-'}</dd></div>
          <div><dt>Destination</dt><dd>{toClient || '-'}</dd></div>
          <div><dt>Contract Date</dt><dd>{formatDate(contractDate)}</dd></div>
          <div><dt>Start Date</dt><dd>{formatDate(startDate)}</dd></div>
          <div><dt>Expiry Date</dt><dd>{formatDate(expiryDate)}</dd></div>
          <div><dt>Broker</dt><dd>{broker || 'Direct (No Broker)'}</dd></div>
        </dl>
      </section>

      {notes && (
        <section className="order-print-section">
          <h2>Terms &amp; Notes</h2>
          <p className="order-print-notes">{notes}</p>
        </section>
      )}
    </article>
  </div>
);
