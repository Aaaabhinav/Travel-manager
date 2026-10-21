const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');
const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const tripRoutes = require('./routes/trips');
const destinationRoutes = require('./routes/destinations');
const sagaConsumer = require('./consumers/sagaConsumer');
const eventConsumer = require('./consumers/eventConsumer');

const app = express();
const PORT = process.env.PORT || 8082;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// ── Database ─────────────────────────────────────────────────────────────────
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres_pass',
  database: process.env.DB_NAME || 'trip_service_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Make pool available to routes
app.locals.db = pool;

// ── RabbitMQ ─────────────────────────────────────────────────────────────────
let rabbitChannel = null;
const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'travel.events';

async function connectRabbitMQ(retries = 10) {
  const url = process.env.RABBITMQ_URL || 'amqp://travel:travel_pass@localhost:5672/';
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await amqp.connect(url);
      rabbitChannel = await conn.createChannel();
      await rabbitChannel.assertExchange(EXCHANGE, 'topic', { durable: true });
      logger.info('Connected to RabbitMQ');

      conn.on('error', err => logger.error('RabbitMQ connection error', { error: err.message }));
      conn.on('close', () => {
        logger.warn('RabbitMQ connection closed, reconnecting...');
        setTimeout(() => connectRabbitMQ(retries), 5000);
      });

      // Start consumers
      await sagaConsumer.start(rabbitChannel, pool, EXCHANGE, publishEvent);
      await eventConsumer.start(rabbitChannel, pool, EXCHANGE);

      return;
    } catch (err) {
      logger.warn(`RabbitMQ connection attempt ${i + 1}/${retries} failed: ${err.message}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  logger.error('Failed to connect to RabbitMQ after retries');
}

function publishEvent(routingKey, payload) {
  if (!rabbitChannel) {
    logger.error('Cannot publish: RabbitMQ channel not ready');
    return;
  }
  const event = {
    eventId: uuidv4(),
    eventType: routingKey,
    occurredAt: new Date().toISOString(),
    source: 'trip-service',
    sagaId: payload.sagaId || null,
    payload,
  };
  rabbitChannel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(event)), {
    persistent: true,
    messageId: event.eventId,
  });
  logger.info('Published event', { routingKey, eventId: event.eventId });
}

app.locals.publishEvent = publishEvent;

// ── Health Check (MUST BE BEFORE ROUTER MOUNT) ──────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'UP',
      service: 'trip-service',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: 'UP',
        rabbitmq: rabbitChannel ? 'UP' : 'DOWN',
      },
    });
  } catch (err) {
    res.status(503).json({
      status: 'DOWN',
      service: 'trip-service',
      error: err.message,
    });
  }
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/destinations', destinationRoutes);
app.use('/trips', tripRoutes);
// Mount with /api prefix for Kong when strip_path is false
app.use('/api', destinationRoutes);
app.use('/api', tripRoutes);
// Also mount at root for Kong strip_path fallback (legacy)
app.use('/', tripRoutes);

// ── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', {
    requestId: req.requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
  });
  res.status(err.status || 500).json({
    timestamp: new Date().toISOString(),
    status: err.status || 500,
    error: err.name || 'Internal Server Error',
    message: err.message,
    path: req.path,
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({
    timestamp: new Date().toISOString(),
    status: 404,
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    path: req.path,
  });
});

// ── Start ────────────────────────────────────────────────────────────────────
async function start() {
  // Wait for DB
  let dbReady = false;
  for (let i = 0; i < 15; i++) {
    try {
      await pool.query('SELECT 1');
      dbReady = true;
      logger.info('Database connected');
      break;
    } catch (e) {
      logger.warn(`DB connection attempt ${i + 1}/15 failed`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  if (!dbReady) {
    logger.error('Failed to connect to database');
    process.exit(1);
  }

  await connectRabbitMQ();

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Trip Service started on port ${PORT}`);
  });
}

start().catch(err => {
  logger.error('Failed to start Trip Service', { error: err.message });
  process.exit(1);
});

module.exports = app;
