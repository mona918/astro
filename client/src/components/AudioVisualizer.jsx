import React, { useRef, useEffect } from 'react';

export default function AudioVisualizer({ isActive, isTransmitting, isListening, isInterrupted }) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Background subtle grid
      ctx.strokeStyle = 'rgba(56, 239, 125, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      if (isInterrupted) {
        // Draw harsh glitch / static spikes
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        for (let x = 0; x < width; x += 3) {
          const glitchY = centerY + (Math.random() * 2 - 1) * (height * 0.4);
          ctx.lineTo(x, glitchY);
        }
        ctx.stroke();
      } else if (isTransmitting || isListening) {
        // Active audio waveform (Red for transmit, Green for listen)
        const strokeColor = isTransmitting ? 'rgba(239, 68, 68, 0.9)' : 'rgba(56, 239, 125, 0.9)';
        ctx.strokeStyle = strokeColor;
        ctx.shadowColor = strokeColor;
        ctx.shadowBlur = 6;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(0, centerY);

        const freq1 = 0.045;
        const freq2 = 0.09;
        const amp = height * 0.35;

        for (let x = 0; x < width; x += 2) {
          const sine1 = Math.sin(x * freq1 + phase);
          const sine2 = Math.cos(x * freq2 - phase * 1.5);
          const noise = (Math.random() - 0.5) * 6;
          const y = centerY + (sine1 * 0.7 + sine2 * 0.3) * amp + noise;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        phase += isTransmitting ? 0.22 : 0.16;
      } else {
        // Squelch standby line (subtle breathing line)
        ctx.strokeStyle = 'rgba(56, 239, 125, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        for (let x = 0; x < width; x += 4) {
          const y = centerY + Math.sin(x * 0.05 + phase) * 2;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        phase += 0.03;
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isActive, isTransmitting, isListening, isInterrupted]);

  return (
    <canvas
      ref={canvasRef}
      width={240}
      height={38}
      className="w-full h-9 rounded bg-black/50 border border-emerald-950/80 shadow-inner"
    />
  );
}
