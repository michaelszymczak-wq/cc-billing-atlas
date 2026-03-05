import express from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import settingsRouter from './routes/settings';
import actionsRouter from './routes/actions';
import fruitIntakeRouter from './routes/fruitIntake';
import billableAddOnsRouter from './routes/billableAddOns';
import qbExportRouter from './routes/qbExport';

const app = express();
const PORT = process.env.PORT || 3001;

// Serve frontend static files in production
const publicDir = path.join(__dirname, '..', 'public');
const hasPublic = fs.existsSync(path.join(publicDir, 'index.html'));

if (hasPublic) {
  // Production: single-origin, CORS not needed
  app.use(express.static(publicDir));
} else {
  // Development: frontend on separate port needs CORS
  app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'],
    credentials: true,
  }));
}

app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/settings', settingsRouter);
app.use('/api', actionsRouter);
app.use('/api/fruit-intake', fruitIntakeRouter);
app.use('/api/billable-add-ons', billableAddOnsRouter);
app.use('/api/export/quickbooks', qbExportRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback — serve index.html for non-API routes
if (hasPublic) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`InnoVint Billing Engine running on http://localhost:${PORT}`);
});
