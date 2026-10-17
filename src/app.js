const path = require('path');
const express = require('express');
const cors = require('cors');

const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1); // correct client IP behind Render/Vercel proxies

app.use(cors());
app.use(express.json());
// Pages/scripts are revalidated on every load, so nobody keeps running yesterday's invoice form
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: (res, file) => { if (/\.(html|js|css)$/.test(file)) res.setHeader('Cache-Control', 'no-cache'); },
}));

// `features` lets you confirm from a browser which version is really deployed: open /health
app.get('/health', (req, res) => res.json({ status: 'ok', features: ['typed-invoice-no', 'invoice-edit', 'csv-export', 'cheques'] }));
app.use('/api', routes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

module.exports = app;
