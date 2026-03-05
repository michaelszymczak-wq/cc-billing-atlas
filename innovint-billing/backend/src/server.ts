import express from 'express';
import cors from 'cors';
import settingsRouter from './routes/settings';
import actionsRouter from './routes/actions';
import fruitIntakeRouter from './routes/fruitIntake';
import billableAddOnsRouter from './routes/billableAddOns';
import qbExportRouter from './routes/qbExport';

const app = express();
const PORT = 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));
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

app.listen(PORT, () => {
  console.log(`InnoVint Billing Engine backend running on http://localhost:${PORT}`);
});
