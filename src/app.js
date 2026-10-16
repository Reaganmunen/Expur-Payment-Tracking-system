const path = require('path');
const express = require('express');
const cors = require('cors');

const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1); // correct client IP behind Render/Vercel proxies

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public'))); // frontend goes here later

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api', routes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

module.exports = app;
