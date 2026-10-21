const logger = require('../logger');

/**
 * Event consumer: handles BookingConfirmed and BookingCancelled events
 * to update trip booking status.
 */
module.exports = {
  async start(channel, db, exchange) {
    const QUEUE = 'trip.events';

    await channel.assertQueue(QUEUE, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'travel.events.dlx',
        'x-dead-letter-routing-key': 'dlq.trip.events',
      },
    });

    await channel.bindQueue(QUEUE, exchange, 'event.booking.confirmed');
    await channel.bindQueue(QUEUE, exchange, 'event.booking.cancelled');

    channel.consume(QUEUE, async (msg) => {
      if (!msg) return;

      let event;
      try {
        event = JSON.parse(msg.content.toString());
      } catch (e) {
        logger.error('Failed to parse event message', { error: e.message });
        channel.nack(msg, false, false);
        return;
      }

      const { eventType, payload } = event;
      logger.info('Received event', { eventType, eventId: event.eventId });

      try {
        if (eventType === 'event.booking.confirmed' || eventType === 'BookingConfirmed') {
          await handleBookingConfirmed(db, payload);
        } else if (eventType === 'event.booking.cancelled' || eventType === 'BookingCancelled') {
          await handleBookingCancelled(db, payload);
        }

        channel.ack(msg);
      } catch (err) {
        logger.error('Error handling event', { eventType, error: err.message });
        channel.nack(msg, false, false);
      }
    });

    logger.info('Event consumer started on queue: trip.events');
  },
};

async function handleBookingConfirmed(db, payload) {
  const { bookingId, tripId } = payload;
  if (!bookingId) return;

  // Update reservation status to CONFIRMED
  await db.query(
    `UPDATE trip_reservations SET status = 'CONFIRMED' WHERE booking_id = $1`,
    [bookingId]
  );

  logger.info('Trip reservation confirmed', { bookingId, tripId });
}

async function handleBookingCancelled(db, payload) {
  const { bookingId, tripId } = payload;
  if (!bookingId) return;

  // Release the reservation
  await db.query(
    `UPDATE trip_reservations SET status = 'RELEASED', released_at = NOW() WHERE booking_id = $1`,
    [bookingId]
  );

  logger.info('Trip reservation released due to booking cancellation', { bookingId, tripId });
}
