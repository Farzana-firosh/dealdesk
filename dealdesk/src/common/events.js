// In-process domain event bus. Services publish what happened;
// the realtime layer subscribes and decides who gets notified.
// Used only for realtime delivery, never for critical processing.
const { EventEmitter } = require('events');
const logger = require('./logger');

const EVENTS = {
  DISCOUNT_REQUESTED: 'discount.requested',
  DISCOUNT_DECIDED: 'discount.decided',
  INVOICE_STATUS_CHANGED: 'invoice.status_changed',
  CHAT_MESSAGE: 'chat.message',
  USER_DEACTIVATED: 'user.deactivated',
};

const bus = new EventEmitter();

function publish(event, payload) {
  // a failing listener must never break the business operation that published
  try {
    bus.emit(event, payload);
  } catch (err) {
    logger.error({ err, event }, 'event listener failed');
  }
}

module.exports = { bus, publish, EVENTS };
