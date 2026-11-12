import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export default function SignalMeter({ conditions, isInterrupted, isConnected }) {
  const [signalBars, setSignalBars] = useState(5);
  const [signalStatus, setSignalStatus] = useState('EXCELLENT');

  useEffect(() => {
    if (!isConnected) {
      setSignalBars(0);
      setSignalStatus('NO SIGNAL');
      return;
    }

    if (isInterrupted) {
      setSignalBars(1);
      setSignalStatus('CRITICAL');
      return;
    }

    // Calculate baseline signal based on Admin Radio Conditions
    const failureProb = conditions?.connectionFailureProb || 0;
    const staticLvl = conditions?.staticLevel || 0;
    const intProb = conditions?.signalInterruptionProb || 0;

    const penalty = (failureProb * 1.5) + (staticLvl * 0.3) + (intProb * 0.4);

    let baseBars = 5;
    if (penalty > 65) baseBars = 2;
    else if (penalty > 40) baseBars = 3;
    else if (penalty > 20) baseBars = 4;
    else baseBars = 5;

    // Small realistic radio signal jitter
    const interval = setInterval(() => {
      const jitter = Math.random() > 0.65 ? (Math.random() > 0.5 ? 1 : -1) : 0;
      const current = Math.max(1, Math.min(5, baseBars + jitter));
      setSignalBars(current);

      switch (current) {
        case 5: setSignalStatus('EXCELLENT'); break;
        case 4: setSignalStatus('GOOD'); break;
        case 3: setSignalStatus('FAIR'); break;
        case 2: setSignalStatus('WEAK'); break;
        case 1: setSignalStatus('CRITICAL'); break;
        default: setSignalStatus('NO SIGNAL'); break;
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [conditions, isInterrupted, isConnected]);

  const barHeights = ['h-2', 'h-3', 'h-4', 'h-5', 'h-6'];

  return (
    <div className="flex items-center space-x-2 bg-black/40 px-2.5 py-1 rounded border border-emerald-950/60 font-mono text-xs">
      <div className="flex items-end space-x-1 h-6">
        {[0, 1, 2, 3, 4].map((i) => {
          const isActive = i < signalBars;
          let color = 'bg-emerald-500';
          if (signalBars <= 2) color = 'bg-red-500';
          else if (signalBars <= 3) color = 'bg-amber-400';

          return (
            <div
              key={i}
              className={`w-1.5 ${barHeights[i]} rounded-xs transition-all duration-300 ${
                isActive ? `${color} shadow-[0_0_4px_currentColor]` : 'bg-gray-800/80'
              }`}
            />
          );
        })}
      </div>
      <div className="flex flex-col">
        <span className="text-[9px] uppercase tracking-wider text-emerald-500/70 font-semibold leading-tight">
          RSSI // {signalBars}/5
        </span>
        <span className={`text-[10px] font-bold tracking-tight leading-tight ${
          signalBars <= 1 ? 'text-red-400 animate-pulse' : signalBars <= 3 ? 'text-amber-400' : 'text-emerald-400'
        }`}>
          {signalStatus}
        </span>
      </div>
    </div>
  );
}
