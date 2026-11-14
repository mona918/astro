import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { X, Smartphone, Laptop, Check, Copy, ShieldAlert } from 'lucide-react';

export default function QrCodeModal({ isOpen, onClose, mobileUrl, desktopUrl }) {
  const canvasRef = useRef(null);
  const [copiedType, setCopiedType] = useState(null);

  useEffect(() => {
    if (isOpen && canvasRef.current && mobileUrl) {
      QRCode.toCanvas(
        canvasRef.current,
        mobileUrl,
        {
          width: 220,
          margin: 2,
          color: {
            dark: '#022c22', // deep emerald
            light: '#ecfdf5', // emerald-50
          },
        },
        (error) => {
          if (error) console.error('Failed to render QR Code', error);
        }
      );
    }
  }, [isOpen, mobileUrl]);

  if (!isOpen) return null;

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-radio-panel border border-emerald-500/60 rounded-2xl p-6 shadow-[0_0_40px_rgba(16,185,129,0.25)] text-gray-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center p-2.5 bg-emerald-950/80 border border-emerald-600/60 rounded-xl text-emerald-400 mb-2">
            <Smartphone className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold font-display uppercase tracking-widest text-emerald-300">
            CONNECT MOBILE HANDSET
          </h2>
          <p className="text-xs font-mono text-gray-400 mt-1">
            Scan with your phone's camera to join on the same Wi-Fi
          </p>
        </div>

        {/* QR Code Canvas */}
        <div className="flex justify-center my-4">
          <div className="p-3 bg-emerald-950/60 border-2 border-emerald-500/80 rounded-2xl shadow-inner">
            <canvas ref={canvasRef} className="rounded-xl" />
          </div>
        </div>

        {/* Links section */}
        <div className="space-y-3 font-mono text-xs">
          {/* Mobile HTTPS Link */}
          <div className="bg-black/50 border border-emerald-600/50 p-2.5 rounded-xl">
            <div className="flex items-center justify-between text-emerald-400 font-bold mb-1">
              <span className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" /> MOBILE (HTTPS / MIC ENABLED)
              </span>
              <button
                onClick={() => copyToClipboard(mobileUrl, 'mobile')}
                className="text-xs text-emerald-300 hover:text-white flex items-center gap-1"
              >
                {copiedType === 'mobile' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedType === 'mobile' ? 'COPIED' : 'COPY'}
              </button>
            </div>
            <div className="text-[11px] text-gray-300 select-all break-all">
              {mobileUrl}
            </div>
          </div>

          {/* Desktop HTTP Link */}
          <div className="bg-black/30 border border-gray-800 p-2.5 rounded-xl">
            <div className="flex items-center justify-between text-gray-400 font-bold mb-1">
              <span className="flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5" /> DESKTOP / LAPTOP (HTTP)
              </span>
              <button
                onClick={() => copyToClipboard(desktopUrl, 'desktop')}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
              >
                {copiedType === 'desktop' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedType === 'desktop' ? 'COPIED' : 'COPY'}
              </button>
            </div>
            <div className="text-[11px] text-gray-400 select-all break-all">
              {desktopUrl}
            </div>
          </div>

          {/* Mobile SSL Notice */}
          <div className="flex items-start gap-2 bg-amber-950/40 border border-amber-800/60 p-2.5 rounded-xl text-amber-200/90 text-[10px] leading-relaxed">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-300">1-TIME MOBILE PERMISSION: </span>
              When opening on phone, tap <span className="font-semibold text-white">"Advanced"</span> &rarr; <span className="font-semibold text-white">"Proceed"</span> to accept the local Wi-Fi certificate and allow microphone access.
            </div>
          </div>
        </div>

        {/* Done Button */}
        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-black font-display font-bold tracking-widest uppercase rounded-xl transition-colors shadow-lg"
        >
          CLOSE
        </button>
      </div>
    </div>
  );
}
