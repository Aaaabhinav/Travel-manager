const logger = require('../logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Saga consumer: handles ReserveTripSlot and ReleaseTripSlot commands
 * from the Booking Service orchestrator.
 */
module.exports = {
  async start(channel, db, exchange, publishEvent) {
    const QUEUE = 'trip.commands';

    await channel.assertQueue(QUEUE, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'travel.events.dlx',
        'x-dead-letter-routing-key': 'dlq.trip.commands',
      },
    });

    await channel.bindQueue(QUEUE, exchange, 'saga.trip.command.#');

    channel.consume(QUEUE, async (msg) => {
      if (!msg) return;

      let event;
      try {
        event = JSON.parse(msg.content.toString());
      } catch (e) {
        logger.error('Failed to parse saga command message', { error: e.message });
        channel.nack(msg, false, false); // send to DLQ
        return;
      }

      const { eventType, payload, sagaId, eventId } = event;

      logger.info('Received saga command', { eventType, sagaId, eventId });

      try {
        if (eventType === 'saga.trip.command.reserve' || eventType === 'ReserveTripSlot') {
          await handleReserveTripSlot(db, payload, sagaId, eventId, publishEvent);
        } else if (eventType === 'saga.trip.command.release' || eventType === 'ReleaseTripSlot') {
          await handleReleaseTripSlot(db, payload, sagaId, eventId, publishEvent);
        } else {
          logger.warn('Unknown saga command', { eventType });
        }

        channel.ack(msg);
      } catch (err) {
        logger.error('Error handling saga command', { eventType, sagaId, error: err.message, stack: err.stack });
        // Retry up to 3 times, then DLQ
        const retryCount = (msg.properties.headers && msg.properties.headers['x-retry-count']) || 0;
        if (retryCount < 3) {
          channel.nack(msg, false, false);
        } else {
          channel.nack(msg, false, false); // goes to DLQ
        }
      }
    });

    logger.info('Saga consumer started on queue: trip.commands');
  },
};

async function handleReserveTripSlot(db, payload, sagaId, eventId, publishEvent) {
  const tripId = payload.tripId || payload.trip_id;
  const userId = payload.userId || payload.user_id;
  const bookingId = payload.bookingId || payload.booking_id;
  const bookingDate = payload.bookingDate || payload.booking_date;

  // Idempotency check: if reservation already exists for this booking_id, return success
  const existing = await db.query(
    'SELECT * FROM trip_reservations WHERE booking_id = $1',
    [bookingId]
  );

  if (existing.rows.length > 0) {
    const reservation = existing.rows[0];
    if (reservation.status === 'RESERVED') {
      logger.info('Duplicate ReserveTripSlot — already reserved', { bookingId, sagaId });
      publishEvent('saga.booking.reply.trip-slot-reserved', {
        sagaId,
        bookingId,
        tripId,
        reservationId: reservation.id,
        status: 'RESERVED',
      });
      return;
    }
  }

  // Verify trip exists
  const tripResult = await db.query('SELECT * FROM trips WHERE id = $1', [tripId]);
  if (tripResult.rows.length === 0) {
    logger.warn('Trip not found for reservation', { tripId, sagaId });
    publishEvent('saga.booking.reply.trip-slot-rejected', {
      sagaId,
      bookingId,
      tripId,
      reason: 'Trip not found',
    });
    return;
  }

  const trip = tripResult.rows[0];

  // Verify trip belongs to user
  if (trip.user_id.toString() !== userId.toString()) {
    logger.warn('Trip does not belong to user', { tripId, userId, sagaId });
    publishEvent('saga.booking.reply.trip-slot-rejected', {
      sagaId,
      bookingId,
      tripId,
      reason: 'Trip does not belong to user',
    });
    return;
  }

  // Verify booking date falls within trip dates (if provided)
  if (bookingDate && trip.start_date && trip.end_date) {
    const bDate = new Date(bookingDate);
    const sDate = new Date(trip.start_date);
    const eDate = new Date(trip.end_date);
    if (bDate < sDate || bDate > eDate) {
      logger.warn('Booking date outside trip dates', { bookingDate, tripStart: trip.start_date, tripEnd: trip.end_date, sagaId });
      publishEvent('saga.booking.reply.trip-slot-rejected', {
        sagaId,
        bookingId,
        tripId,
        reason: `Booking date ${bookingDate} is outside trip dates (${trip.start_date} - ${trip.end_date})`,
      });
      return;
    }
  }

  // Create reservation
  const result = await db.query(
    `INSERT INTO trip_reservations (trip_id, booking_id, saga_id, status, reserved_at)
     VALUES ($1, $2, $3, 'RESERVED', NOW()) RETURNING *`,
    [tripId, bookingId, sagaId]
  );

  const reservation = result.rows[0];

  logger.info('Trip slot reserved', { reservationId: reservation.id, tripId, bookingId, sagaId });

  publishEvent('saga.booking.reply.trip-slot-reserved', {
    sagaId,
    bookingId,
    tripId,
    reservationId: reservation.id,
    status: 'RESERVED',
  });
}

async function handleReleaseTripSlot(db, payload, sagaId, eventId, publishEvent) {
  const tripId = payload.tripId || payload.trip_id;
  const bookingId = payload.bookingId || payload.booking_id;

  // Idempotent: if no reservation exists or already released, succeed as no-op
  const existing = await db.query(
    'SELECT * FROM trip_reservations WHERE booking_id = $1',
    [bookingId]
  );

  if (existing.rows.length === 0) {
    logger.info('No reservation found for ReleaseTripSlot (no-op)', { bookingId, sagaId });
    publishEvent('saga.booking.reply.trip-slot-released', {
      sagaId,
      bookingId,
      tripId,
      status: 'RELEASED',
    });
    return;
  }

  const reservation = existing.rows[0];
  if (reservation.status === 'RELEASED') {
    logger.info('Reservation already released (no-op)', { bookingId, sagaId });
    publishEvent('saga.booking.reply.trip-slot-released', {
      sagaId,
      bookingId,
      tripId,
      status: 'RELEASED',
    });
    return;
  }

  // Release the reservation
  await db.query(
    `UPDATE trip_reservations SET status = 'RELEASED', released_at = NOW() WHERE booking_id = $1`,
    [bookingId]
  );

  logger.info('Trip slot released', { bookingId, tripId, sagaId });

  publishEvent('saga.booking.reply.trip-slot-released', {
    sagaId,
    bookingId,
    tripId,
    status: 'RELEASED',
  });
}
