import React, { useState, useEffect } from 'react';

interface ProgressEvent {
  step: string;
  message: string;
  pct: number;
}

interface ProgressBarProps {
  progress: number;
  logs: ProgressEvent[];
  stepStatus: {
    actions: 'pending' | 'running' | 'done' | 'error';
    rates: 'pending' | 'running' | 'done' | 'error';
    bulk: 'pending' | 'running' | 'done' | 'error';
    barrels: 'pending' | 'running' | 'done' | 'error';
  };
}

const LOADING_VERBS = [
  'Schlepping', 'Concocting', 'Transmuting', 'Propagating',
  'Cogitating', 'Pontificating', 'Imagining', 'Wondering',
  'Spelunking', 'Exploring', 'Connecting',
  'Vibing', 'Combobulating', 'Honking', 'Booping', 'Zesting', 'Julienneing', 'Canoodling',
  'Reticulating splines', 'Herding bits', 'Caffeinating the compiler',
  'Unsquishing data', 'Consulting the oracle', 'Tightening the bolts',
  'Polishing the pixels', 'Extrapolating nonsense', 'Synthesizing vibes',
  'Defragmenting the soul', 'Parsing the subtext', 'Recalibrating the flux capacitor',
  'Inverting the binary tree', 'Optimizing for happiness', 'Counting to infinity',
  'Ordering pizza for the CPU', 'Bribing the API', 'Distracting the bugs',
  'Chasing zeros', 'Teaching the server to sing', 'Looking for the "Any" key',
  'Hydrating context', 'Mapping dependencies', 'Assembling fragments',
  'Resolving ambiguities', 'Aligning vectors', 'Calculating the meaning of life',
  'Shuffling the deck', 'Inflating the ego', 'Warming up the transistors',
  'Adjusting the atmosphere', 'Poking the mainframe',
];

function randomVerbIndex(current?: number): number {
  let next: number;
  do {
    next = Math.floor(Math.random() * LOADING_VERBS.length);
  } while (next === current && LOADING_VERBS.length > 1);
  return next;
}

function useLoadingVerb(isRunning: boolean): string {
  const [index, setIndex] = useState(() => randomVerbIndex());

  useEffect(() => {
    if (!isRunning) return;
    setIndex(randomVerbIndex());
    const interval = setInterval(() => {
      setIndex((prev) => randomVerbIndex(prev));
    }, 10000);
    return () => clearInterval(interval);
  }, [isRunning]);

  return LOADING_VERBS[index];
}

function StepIndicator({ label, status }: { label: string; status: string }) {
  let icon = '';
  let color = 'text-gray-400';
  if (status === 'running') {
    icon = '\u27F3';
    color = 'text-violet-500 animate-spin';
  } else if (status === 'done') {
    icon = '\u2713';
    color = 'text-green-500';
  } else if (status === 'error') {
    icon = '\u2717';
    color = 'text-red-500';
  } else {
    icon = '\u25CB';
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`text-lg ${color}`}>{icon}</span>
      <span className={`text-sm ${status === 'pending' ? 'text-gray-400' : 'text-gray-700'}`}>{label}</span>
    </div>
  );
}

export default function ProgressBar({ progress, logs, stepStatus }: ProgressBarProps) {
  const isRunning = progress > 0 && progress < 100;
  const verb = useLoadingVerb(isRunning);

  return (
    <div className="space-y-4">
      {/* Step indicators */}
      <div className="flex gap-6">
        <StepIndicator label="Step 1: Actions" status={stepStatus.actions} />
        <StepIndicator label="Step 2: Rate Mapping" status={stepStatus.rates} />
        <StepIndicator label="Step 3: Bulk Inventory" status={stepStatus.bulk} />
        <StepIndicator label="Step 4: Barrel Inventory" status={stepStatus.barrels} />
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className="bg-violet-600 h-3 rounded-full transition-all duration-300"
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
      <p className="text-sm text-gray-500">
        {isRunning ? (
          <><span className="text-violet-600 font-medium">{verb}...</span> {progress}% complete</>
        ) : (
          `${progress}% complete`
        )}
      </p>

      {/* Log console */}
      <div className="bg-gray-900 text-green-400 p-4 rounded-md h-48 overflow-y-auto font-mono text-xs">
        {logs.map((log, i) => (
          <div key={i} className={log.pct === -1 ? 'text-yellow-400' : ''}>
            [{log.step}] {log.message}
          </div>
        ))}
        {logs.length === 0 && <div className="text-gray-500">Waiting to start...</div>}
      </div>
    </div>
  );
}
