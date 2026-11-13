import React, { useState } from 'react';
import { Shield, Eye, EyeOff, AlertTriangle, Lock, LogIn } from 'lucide-react';

// Admin password stored in localStorage so it persists per session
const ADMIN_PASSWORD_KEY = 'taccom_admin_auth';

export default function AdminAuthModal({ onAuthenticated, onCancel }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [attempts, setAttempts] = useState(0);

  // The admin password - change this via ?adminpw=YOURPASSWORD in URL or use default
  // Check URL param first so event organizer can set it on-the-fly
  const getAdminPassword = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlPw = urlParams.get('adminpw');
    if (urlPw) return urlPw;
    return 'TACCOM-HQ-2026'; // default password
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (attempts >= 5) {
      setError('Too many failed attempts. Close and reopen this dialog.');
      return;
    }

    if (password === getAdminPassword()) {
      // Store auth in sessionStorage so they don't need to re-enter on nav
      sessionStorage.setItem(ADMIN_PASSWORD_KEY, 'authenticated');
      onAuthenticated();
    } else {
      const remaining = 4 - attempts;
      setAttempts((prev) => prev + 1);
      setError(`INCORRECT ACCESS CODE. ${remaining > 0 ? `${remaining} attempts remaining.` : 'No more attempts.'}`);
      setPassword('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-gradient-to-b from-gray-900 to-black border-2 border-amber-800/80 rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.95)] relative">
        {/* Corner rivets */}
        <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-amber-800 border border-amber-600" />
        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-amber-800 border border-amber-600" />
        <div className="absolute bottom-3 left-3 w-2 h-2 rounded-full bg-amber-800 border border-amber-600" />
        <div className="absolute bottom-3 right-3 w-2 h-2 rounded-full bg-amber-800 border border-amber-600" />

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-950/80 border border-amber-600/60 mb-3 text-amber-400 shadow-[0_0_20px_rgba(217,119,6,0.3)]">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black font-display tracking-widest text-amber-400 uppercase">
            COMMAND HQ ACCESS
          </h2>
          <p className="text-xs font-mono text-gray-400 mt-1 uppercase tracking-wider">
            RESTRICTED — AUTHORIZED PERSONNEL ONLY
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-950/80 border border-red-700 text-red-200 px-3 py-2.5 rounded-lg text-xs font-mono flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-gray-300 font-bold mb-1.5">
              COMMAND HQ ACCESS CODE
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter access code..."
                autoFocus
                disabled={attempts >= 5}
                className="w-full bg-black/80 border border-amber-800/60 focus:border-amber-500 rounded-lg px-3.5 py-2.5 text-amber-200 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 pr-10 disabled:opacity-50 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] font-mono text-gray-500 mt-1">
              Default code: <span className="text-amber-600 font-bold">TACCOM-HQ-2026</span>
              {' '}(set via <code className="text-gray-400">?adminpw=YOUR_CODE</code> in URL)
            </p>
          </div>

          <button
            type="submit"
            disabled={attempts >= 5 || !password}
            className="w-full bg-gradient-to-r from-amber-700 hover:from-amber-600 to-orange-800 text-white font-display font-bold text-sm tracking-widest uppercase py-3 rounded-xl shadow-[0_8px_20px_rgba(217,119,6,0.3)] transition-all flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <LogIn className="w-4 h-4" />
            <span>AUTHENTICATE</span>
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="w-full text-xs font-mono text-gray-500 hover:text-gray-300 py-2 transition-colors"
          >
            CANCEL — Return to Operator Channel
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-gray-800/80 text-[10px] font-mono text-gray-600 text-center">
          UNAUTHORIZED ACCESS IS PROHIBITED AND LOGGED
        </div>
      </div>
    </div>
  );
}

// Helper to check if already authenticated this session
export function isAdminAuthenticated() {
  return sessionStorage.getItem(ADMIN_PASSWORD_KEY) === 'authenticated';
}

// Helper to clear admin session
export function clearAdminAuth() {
  sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
}
