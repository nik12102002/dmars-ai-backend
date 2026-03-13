'use strict';

require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');
const crypto    = require('crypto');
const winston   = require('winston');

/* ─────────────────────────────────────────
   LOGGER — structured, level-aware
───────────────────────────────────────── */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const m = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
            return `${timestamp} [${level}]: ${message}${m}`;
          })
        )
  ),
  transports: [new winston.transports.Console()]
});

/* ─────────────────────────────────────────
   STARTUP GUARD — fail fast if key missing
───────────────────────────────────────── */
if (!process.env.GROQ_API_KEY) {
  logger.error('GROQ_API_KEY is not set. Refusing to start.');
  process.exit(1);
}

/* ─────────────────────────────────────────
   CONFIG — all tunable via .env
───────────────────────────────────────── */
const CONFIG = {
  PORT:     process.env.PORT     || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
  RATE_LIMIT_MAX:    parseInt(process.env.RATE_LIMIT_MAX    || '20',    10),
};

/* ─────────────────────────────────────────
   ALLOWED ORIGINS — all 6 of your domains
───────────────────────────────────────── */
const ALLOWED_ORIGINS = new Set(
  process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://dmarsystems.netlify.app',
        'https://dmarsystems.com',
        'https://www.dmarsystems.com',
        'https://dmarssystems.com',
        'https://www.dmarssystems.com'
      ]
);

/* ─────────────────────────────────────────
   APP
───────────────────────────────────────── */
const app = express();

/* Security headers */
app.use(helmet({ contentSecurityPolicy: false }));

/* ✅ Fixed: body size capped at 32kb — was 1mb */
app.use(express.json({ limit: '32kb' }));

/* ✅ Fixed: morgan uses 'combined' in production, 'dev' locally */
app.use(morgan(CONFIG.NODE_ENV === 'production' ? 'combined' : 'dev'));

/* ✅ Fixed: CORS handles all 6 domains, no wildcard fallback */
app.use(cors({
  origin: (origin, cb) => {
    if (!origin && CONFIG.NODE_ENV !== 'production') return cb(null, true);
    if (origin && ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    logger.warn('CORS blocked', { origin });
    return cb(null, false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

/* ✅ Fixed: Request ID on every request for full traceability */
app.use((req, _res, next) => {
  req.id = crypto.randomUUID();
  next();
});

/* ✅ Fixed: Rate limit ONLY on /api routes — health check is exempt */
const apiLimiter = rateLimit({
  windowMs:        CONFIG.RATE_LIMIT_WINDOW,
  max:             CONFIG.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req) => req.ip,
  handler: (req, res) => {
    logger.warn('Rate limit hit', { reqId: req.id, ip: req.ip });
    res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }
});

/* ─────────────────────────────────────────
   ROUTES
───────────────────────────────────────── */

/* Health — NOT rate limited, Render pings this */
app.get('/health', (_req, res) => {
  res.json({
    status:  'ok',
    service: 'dmars-ai-backend',
    version: '2.0.0',
    env:     CONFIG.NODE_ENV,
    uptime:  Math.floor(process.uptime()) + 's'
  });
});

app.get('/', (_req, res) => {
  res.json({ status: 'DMARS AI backend running ✅' });
});

/* Chat — rate limited */
app.use('/api/chat', apiLimiter, require('./routes/chat'));

/* ─────────────────────────────────────────
   404 + GLOBAL ERROR HANDLER
───────────────────────────────────────── */
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { reqId: req.id, error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

/* ─────────────────────────────────────────
   START + GRACEFUL SHUTDOWN
───────────────────────────────────────── */
const server = app.listen(CONFIG.PORT, () => {
  logger.info('DMARS AI backend started', {
    port: CONFIG.PORT,
    env:  CONFIG.NODE_ENV
  });
});

const shutdown = (signal) => {
  logger.info(`${signal} — shutting down gracefully`);
  server.close(() => {
    logger.info('Server closed cleanly');
    process.exit(0);
  });
  setTimeout(() => { logger.error('Forced exit'); process.exit(1); }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
