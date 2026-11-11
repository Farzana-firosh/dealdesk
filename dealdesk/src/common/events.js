// In-process domain event bus. Services publish what happened;
// the realtime layer subscribes and decides who gets notified.
// Used only for notifications, never for critical processing.
const { EventEmitter } = require('events');

const EVENTS = {
  DISCOUNT_REQUESTED: 'discount.requested',
  DISCOUNT_DECIDED: 'discount.decided',
  INVOICE_STATUS_CHANGED: 'invoice.status_changed',
  CHAT_MESSAGE: 'chat.message',
};

const bus = new EventEmitter();

function publish(event, payload) {
  // a failing listener must never break the business operation that published
  try {
    bus.emit(event, payload);
  } catch (err) {
    console.error(`[events] listener failed for ${event}`, err);
  }
}

module.exports = { bus, publish, EVENTS };
