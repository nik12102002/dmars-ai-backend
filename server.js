require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const chatRoute = require('./routes/chat');

const app = express();

app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN ? [process.env.ALLOWED_ORIGIN] : true,
  credentials: false
}));

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests, please slow down.' }
}));

app.get('/health', function (req, res) {
  res.json({ ok: true, service: 'dmars-ai-backend' });
});

app.use('/api/chat', chatRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
  console.log('Server running on port ' + PORT);
});
