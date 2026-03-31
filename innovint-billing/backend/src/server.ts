import express from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import { authenticate, requireRole } from './middleware/auth';
import settingsRouter from './routes/settings';
import actionsRouter from './routes/actions';
import fruitIntakeRouter from './routes/fruitIntake';
import billableAddOnsRouter from './routes/billableAddOns';
import invoiceExportRouter from './routes/invoiceExport';
import usersRouter from './routes/users';

const app = express();
const PORT = process.env.PORT || 3004;

// Serve frontend static files in production
const publicDir = path.join(__dirname, '..', 'public');
const hasPublic = fs.existsSync(path.join(publicDir, 'index.html'));

if (hasPublic) {
  // Production: single-origin, CORS not needed
  app.use(express.static(publicDir));
} else {
  // Development: frontend on separate port needs CORS
  app.use(cors({
    origin: ['http://localhost:5175', 'http://127.0.0.1:5175', 'http://localhost:5176', 'http://127.0.0.1:5176'],
    credentials: true,
  }));
}

app.use(express.json({ limit: '10mb' }));

// Health check (public — before authenticated routes)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/users', usersRouter);                                                        // auth handled per-route
app.use('/api/settings', authenticate, requireRole('admin', 'team_member'), settingsRouter);
app.use('/api/fruit-intake', authenticate, requireRole('admin', 'team_member'), fruitIntakeRouter);
app.use('/api/billable-add-ons', billableAddOnsRouter);                                    // mixed auth per-route
app.use('/api/export/invoices', authenticate, requireRole('admin', 'team_member'), invoiceExportRouter);
app.use('/api', authenticate, requireRole('admin', 'team_member'), actionsRouter);

// SPA fallback — serve index.html for non-API routes
if (hasPublic) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`CC Billing Atlas running on http://localhost:${PORT}`);
});
