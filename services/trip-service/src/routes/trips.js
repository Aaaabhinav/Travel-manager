const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');

const router = express.Router();

// ── Validation Schemas ───────────────────────────────────────────────────────
const createTripSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(2000).allow('', null),
  start_date: Joi.date().iso(),
  startDate: Joi.date().iso(),
  end_date: Joi.date().iso(),
  endDate: Joi.date().iso(),
  budget: Joi.number().positive().allow(null),
  status: Joi.string().valid('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED').default('PLANNED'),
  user_id: Joi.any(),
}).or('start_date', 'startDate').or('end_date', 'endDate');

const updateTripSchema = Joi.object({
  title: Joi.string().min(1).max(255),
  description: Joi.string().max(2000).allow('', null),
  start_date: Joi.date().iso(),
  startDate: Joi.date().iso(),
  end_date: Joi.date().iso(),
  endDate: Joi.date().iso(),
  budget: Joi.number().positive().allow(null),
  status: Joi.string().valid('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'),
});

const addDestinationSchema = Joi.object({
  destination_id: Joi.number().integer().positive().required(),
  day_number: Joi.number().integer().positive().allow(null),
  notes: Joi.string().max(1000).allow('', null),
});

const updateItinerarySchema = Joi.object({
  items: Joi.array().items(Joi.object({
    day_number: Joi.number().integer().positive().required(),
    title: Joi.string().max(255).required(),
    description: Joi.string().max(2000).allow('', null),
    destination_id: Joi.number().integer().positive().allow(null),
    activity_type: Joi.string().max(100).allow('', null),
    start_time: Joi.string().allow('', null),
    end_time: Joi.string().allow('', null),
  })).required(),
});

// Helper to get userId from gateway headers
function getUserId(req) {
  return req.headers['x-user-id'] || req.body?.user_id || '1';
}

function getUserRoles(req) {
  const roles = req.headers['x-user-roles'];
  return roles ? roles.split(',').map(r => r.trim()) : [];
}

// ── Handler for Create Trip ──────────────────────────────────────────────────
const createTripHandler = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ status: 401, error: 'Unauthorized', message: 'User ID required' });

    const { error, value } = createTripSchema.validate(req.body);
    if (error) return res.status(400).json({ status: 400, error: 'Validation Error', message: error.details[0].message });

    const startDateVal = value.start_date || value.startDate;
    const endDateVal = value.end_date || value.endDate;

    const db = req.app.locals.db;
    const result = await db.query(
      `INSERT INTO trips (user_id, title, description, start_date, end_date, budget, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, value.title, value.description, startDateVal, endDateVal, value.budget, value.status || 'PLANNED']
    );

    const trip = result.rows[0];
    
    // Publish TripCreated event
    const publish = req.app.locals.publishEvent;
    if (publish) {
      publish('event.trip.created', {
        tripId: trip.id,
        userId: parseInt(userId),
        title: trip.title,
        startDate: trip.start_date,
        endDate: trip.end_date,
        budget: trip.budget,
      });
    }

    logger.info('Trip created', { tripId: trip.id, userId, requestId: req.requestId });
    res.status(201).json(trip);
  } catch (err) {
    next(err);
  }
};

router.post('/', createTripHandler);
router.post('/trips', createTripHandler);

// ── GET /trips ───────────────────────────────────────────────────────────────
const getAllTripsHandler = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const db = req.app.locals.db;
    let query = 'SELECT * FROM trips ORDER BY created_at DESC';
    let params = [];
    if (userId) {
      query = 'SELECT * FROM trips WHERE user_id = $1 ORDER BY created_at DESC';
      params = [userId];
    }
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

router.get('/', getAllTripsHandler);
router.get('/trips', getAllTripsHandler);

// ── GET /trips/:id ───────────────────────────────────────────────────────────
const getTripByIdHandler = async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({ status: 400, error: 'Bad Request', message: 'Invalid numeric trip ID' });
    }
    const db = req.app.locals.db;
    const result = await db.query('SELECT * FROM trips WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 404, error: 'Not Found', message: 'Trip not found' });
    }

    const trip = result.rows[0];

    // Fetch destinations for this trip
    const dests = await db.query(
      `SELECT td.*, d.name, d.country, d.state, d.category, d.description as dest_description,
              d.image_url, d.latitude, d.longitude, d.avg_daily_cost, d.best_season
       FROM trip_destinations td
       JOIN destinations d ON td.destination_id = d.id
       WHERE td.trip_id = $1
       ORDER BY td.day_number`,
      [req.params.id]
    );

    trip.destinations = dests.rows;
    res.json(trip);
  } catch (err) {
    next(err);
  }
};

router.get('/:id', getTripByIdHandler);
router.get('/trips/:id', getTripByIdHandler);

// ── GET /users/:userId/trips ─────────────────────────────────────────────────
const getUserTripsHandler = async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query(
      'SELECT * FROM trips WHERE user_id = $1 ORDER BY created_at DESC',
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

router.get('/users/:userId/trips', getUserTripsHandler);
router.get('/users/:userId', getUserTripsHandler);

// ── PUT /trips/:id ───────────────────────────────────────────────────────────
const updateTripHandler = async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({ status: 400, error: 'Bad Request', message: 'Invalid numeric trip ID' });
    }
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ status: 401, error: 'Unauthorized', message: 'User ID required' });

    const { error, value } = updateTripSchema.validate(req.body);
    if (error) return res.status(400).json({ status: 400, error: 'Validation Error', message: error.details[0].message });

    const db = req.app.locals.db;

    const existing = await db.query('SELECT * FROM trips WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: 404, error: 'Not Found', message: 'Trip not found' });
    }
    const roles = getUserRoles(req);
    if (existing.rows[0].user_id.toString() !== userId && !roles.includes('ADMIN')) {
      return res.status(403).json({ status: 403, error: 'Forbidden', message: 'You can only update your own trips' });
    }

    const fields = [];
    const values = [];
    let idx = 1;
    for (const [key, val] of Object.entries(value)) {
      fields.push(`${key} = $${idx}`);
      values.push(val);
      idx++;
    }
    fields.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const result = await db.query(
      `UPDATE trips SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    const trip = result.rows[0];

    // If trip was cancelled, release reservations in trip_reservations
    if (value.status === 'CANCELLED') {
      await db.query(
        `UPDATE trip_reservations SET status = 'RELEASED', released_at = NOW() WHERE trip_id = $1`,
        [trip.id]
      );
    }

    const publish = req.app.locals.publishEvent;
    if (publish) {
      publish('event.trip.updated', { tripId: trip.id, userId: parseInt(userId), changes: value });
      if (value.status === 'CANCELLED') {
        publish('event.trip.cancelled', { tripId: trip.id, userId: parseInt(userId) });
      }
    }

    logger.info('Trip updated', { tripId: trip.id, userId, requestId: req.requestId });
    res.json(trip);
  } catch (err) {
    next(err);
  }
};

router.put('/:id', updateTripHandler);
router.put('/trips/:id', updateTripHandler);

// ── DELETE /trips/:id ────────────────────────────────────────────────────────
const deleteTripHandler = async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({ status: 400, error: 'Bad Request', message: 'Invalid numeric trip ID' });
    }
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ status: 401, error: 'Unauthorized', message: 'User ID required' });

    const db = req.app.locals.db;

    const existing = await db.query('SELECT * FROM trips WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: 404, error: 'Not Found', message: 'Trip not found' });
    }
    const roles = getUserRoles(req);
    if (existing.rows[0].user_id.toString() !== userId && !roles.includes('ADMIN')) {
      return res.status(403).json({ status: 403, error: 'Forbidden', message: 'You can only delete your own trips' });
    }

    await db.query(
      `UPDATE trip_reservations SET status = 'RELEASED', released_at = NOW() WHERE trip_id = $1`,
      [req.params.id]
    );
    await db.query('DELETE FROM trips WHERE id = $1', [req.params.id]);

    const publish = req.app.locals.publishEvent;
    if (publish) {
      publish('event.trip.deleted', {
        tripId: parseInt(req.params.id),
        userId: parseInt(userId),
      });
      publish('event.trip.cancelled', {
        tripId: parseInt(req.params.id),
        userId: parseInt(userId),
      });
    }

    logger.info('Trip deleted', { tripId: req.params.id, userId, requestId: req.requestId });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

router.delete('/:id', deleteTripHandler);
router.delete('/trips/:id', deleteTripHandler);

// ── POST /trips/:tripId/destinations ─────────────────────────────────────────
const addDestinationHandler = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ status: 401, error: 'Unauthorized', message: 'User ID required' });

    const { error, value } = addDestinationSchema.validate(req.body);
    if (error) return res.status(400).json({ status: 400, error: 'Validation Error', message: error.details[0].message });

    const db = req.app.locals.db;

    const trip = await db.query('SELECT * FROM trips WHERE id = $1', [req.params.tripId]);
    if (trip.rows.length === 0) {
      return res.status(404).json({ status: 404, error: 'Not Found', message: 'Trip not found' });
    }
    const roles = getUserRoles(req);
    if (trip.rows[0].user_id.toString() !== userId && !roles.includes('ADMIN')) {
      return res.status(403).json({ status: 403, error: 'Forbidden', message: 'Not your trip' });
    }

    const dest = await db.query('SELECT * FROM destinations WHERE id = $1', [value.destination_id]);
    if (dest.rows.length === 0) {
      return res.status(404).json({ status: 404, error: 'Not Found', message: 'Destination not found' });
    }

    const result = await db.query(
      `INSERT INTO trip_destinations (trip_id, destination_id, day_number, notes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.tripId, value.destination_id, value.day_number, value.notes]
    );

    logger.info('Destination added to trip', { tripId: req.params.tripId, destinationId: value.destination_id });
    res.status(201).json({ ...result.rows[0], destination: dest.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ status: 409, error: 'Conflict', message: 'Destination already added to this trip' });
    }
    next(err);
  }
};

router.post('/:tripId/destinations', addDestinationHandler);
router.post('/trips/:tripId/destinations', addDestinationHandler);

// ── DELETE /trips/:tripId/destinations/:destinationId ─────────────────────────
const deleteDestinationHandler = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ status: 401, error: 'Unauthorized', message: 'User ID required' });

    const db = req.app.locals.db;

    const trip = await db.query('SELECT * FROM trips WHERE id = $1', [req.params.tripId]);
    if (trip.rows.length === 0) {
      return res.status(404).json({ status: 404, error: 'Not Found', message: 'Trip not found' });
    }
    const roles = getUserRoles(req);
    if (trip.rows[0].user_id.toString() !== userId && !roles.includes('ADMIN')) {
      return res.status(403).json({ status: 403, error: 'Forbidden', message: 'Not your trip' });
    }

    // Fetch destination details before deleting for the event payload
    const destInfo = await db.query(
      `SELECT td.*, d.name as dest_name
       FROM trip_destinations td
       JOIN destinations d ON td.destination_id = d.id
       WHERE td.trip_id = $1 AND td.destination_id = $2`,
      [req.params.tripId, req.params.destinationId]
    );

    const result = await db.query(
      'DELETE FROM trip_destinations WHERE trip_id = $1 AND destination_id = $2 RETURNING *',
      [req.params.tripId, req.params.destinationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 404, error: 'Not Found', message: 'Destination not in this trip' });
    }

    // Publish removal event for downstream consumers / audit log
    const publish = req.app.locals.publishEvent;
    if (publish) {
      publish('event.trip.destination.removed', {
        tripId: parseInt(req.params.tripId),
        destinationId: parseInt(req.params.destinationId),
        destinationName: destInfo.rows[0]?.dest_name || `Destination #${req.params.destinationId}`,
        userId: parseInt(userId),
        removedAt: new Date().toISOString(),
      });
    }

    logger.info('Destination removed from trip', {
      tripId: req.params.tripId,
      destinationId: req.params.destinationId,
      userId,
    });

    res.json({
      message: 'Destination removed successfully',
      tripId: parseInt(req.params.tripId),
      destinationId: parseInt(req.params.destinationId),
      destinationName: destInfo.rows[0]?.dest_name,
    });
  } catch (err) {
    next(err);
  }
};

router.delete('/:tripId/destinations/:destinationId', deleteDestinationHandler);
router.delete('/trips/:tripId/destinations/:destinationId', deleteDestinationHandler);

module.exports = router;
