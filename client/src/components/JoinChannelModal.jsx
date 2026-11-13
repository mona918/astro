import React, { useState, useEffect } from 'react';
import { Radio, Users, Shield, Mic, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, KeyRound } from 'lucide-react';
import { socketService } from '../services/socketService';
import { webrtcService } from '../services/webrtcService';

const SUGGESTED_CALLSIGNS = [
  'Ghost-01', 'Viper-2', 'Echo-Lead', 'Hawk-9', 'Nomad-4', 'Raven-7', 'Sierra-3', 'Apex-1'
];

export default function JoinChannelModal({ onJoinSuccess, onOpenAdmin }) {
  const [callsign, setCallsign] = useState('');
  const [channelCode, setChannelCode] = useState('');
  const [availableTeams, setAvailableTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [micStatus, setMicStatus] = useState('UNCHECKED'); // 'UNCHECKED' | 'CHECKING' | 'READY' | 'DENIED'

  // Fetch available teams from API or Socket
  const refreshTeams = async () => {
    try {
      const res = await fetch('/api/teams');
      if (res.ok) {
        const data = await res.json();
        setAvailableTeams(data);
        if (data.length > 0 && !channelCode) {
          setChannelCode(data[0].channelCode);
        }
      }
    } catch (e) {
      console.warn('Could not fetch teams list via REST API, fallback to default', e);
    }
  };

  useEffect(() => {
    refreshTeams();
    // Random callsign suggestion
    const randomCall = SUGGESTED_CALLSIGNS[Math.floor(Math.random() * SUGGESTED_CALLSIGNS.length)];
    setCallsign(randomCall);
  }, []);

  // Test microphone permission
  const checkMicrophone = async () => {
    setMicStatus('CHECKING');
    try {
      await webrtcService.initLocalMicrophone();
      setMicStatus('READY');
      setError(null);
    } catch (err) {
      setMicStatus('DENIED');
      setError(err.message || 'Microphone access denied. Please allow microphone permissions.');
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!callsign.trim()) {
      setError('Please enter your operator callsign or ID.');
      return;
    }
    if (!channelCode.trim()) {
      setError('Please select or enter a valid channel code.');
      return;
    }

    setLoading(true);
    setError(null);

    const socket = socketService.getSocket();
    socket.emit('team:join', { channelCode, name: callsign.trim() }, (response) => {
      setLoading(false);
      if (response && response.error) {
        setError(response.error);
      } else if (response && response.success) {
        // Connect to existing team peers in WebRTC mesh
        if (response.existingPeers && response.existingPeers.length > 0) {
          webrtcService.connectToExistingPeers(response.existingPeers);
        }
        onJoinSuccess({
          team: response.team,
          member: response.member,
        });
      } else {
        setError('Failed to establish radio link with HQ.');
      }
    });
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gradient-to-b from-gray-900 to-black border-2 border-radio-bezel rounded-2xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.9)] relative">
        {/* Tactical Corner Rivets */}
        <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-gray-600 border border-gray-400"></div>
        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-gray-600 border border-gray-400"></div>
        <div className="absolute bottom-3 left-3 w-2 h-2 rounded-full bg-gray-600 border border-gray-400"></div>
        <div className="absolute bottom-3 right-3 w-2 h-2 rounded-full bg-gray-600 border border-gray-400"></div>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-950/80 border border-emerald-600/50 mb-3 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <Radio className="w-7 h-7 animate-pulse" />
          </div>
          <h1 className="text-2xl font-black font-display tracking-widest text-emerald-400 uppercase">
            TAC-COM // RADIO NET
          </h1>
          <p className="text-xs font-mono text-gray-400 mt-1 uppercase tracking-wider">
            Half-Duplex Tactical Simulation System
          </p>
        </div>

        {/* Error message if present */}
        {error && (
          <div className="mb-4 bg-red-950/80 border border-red-600 text-red-200 px-3.5 py-2.5 rounded-lg text-xs font-mono flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-4">
          {/* Callsign Input */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-gray-300 font-bold mb-1.5 flex items-center justify-between">
              <span>Operator Callsign / ID</span>
              <span className="text-[10px] text-emerald-500 font-normal">REQUIRED</span>
            </label>
            <input
              type="text"
              value={callsign}
              onChange={(e) => setCallsign(e.target.value)}
              placeholder="e.g. Viper-01"
              maxLength={20}
              className="w-full bg-black/80 border border-gray-700 focus:border-emerald-500 rounded-lg px-3.5 py-2.5 text-emerald-300 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
            />
            {/* Quick suggested callsigns */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SUGGESTED_CALLSIGNS.slice(0, 4).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setCallsign(tag)}
                  className="text-[10px] bg-gray-800/80 hover:bg-gray-700 text-gray-300 px-2 py-0.5 rounded font-mono border border-gray-700 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Assigned Team Channel Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-gray-300 font-bold">
                Assigned Radio Channel
              </label>
              <button
                type="button"
                onClick={refreshTeams}
                title="Refresh channels"
                className="text-gray-400 hover:text-emerald-400 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {availableTeams.length > 0 ? (
              <select
                value={channelCode}
                onChange={(e) => setChannelCode(e.target.value)}
                className="w-full bg-black/80 border border-gray-700 focus:border-emerald-500 rounded-lg px-3.5 py-2.5 text-emerald-300 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer"
              >
                {availableTeams.map((t) => (
                  <option key={t.id} value={t.channelCode} className="bg-gray-900 text-gray-200">
                    {t.channelCode} — {t.name} ({t.frequency}) [{t.membersCount}/{t.maxMembers}]
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={channelCode}
                onChange={(e) => setChannelCode(e.target.value.toUpperCase())}
                placeholder="e.g. ALPHA-01"
                className="w-full bg-black/80 border border-gray-700 focus:border-emerald-500 rounded-lg px-3.5 py-2.5 text-emerald-300 font-mono text-sm focus:outline-none uppercase"
              />
            )}
            <p className="text-[10px] font-mono text-gray-500 mt-1">
              Teams have private channels. Unauthorized channel cross-talk is prevented.
            </p>
          </div>

          {/* Microphone Hardware Pre-Check */}
          <div className="bg-black/40 border border-gray-800 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Mic className="w-4 h-4 text-emerald-400" />
              <div className="text-xs font-mono">
                <span className="text-gray-300 block font-semibold">Microphone Audio</span>
                <span className="text-[10px] text-gray-400">Required for Walkie-Talkie PTT</span>
              </div>
            </div>
            <div>
              {micStatus === 'READY' ? (
                <span className="inline-flex items-center space-x-1 text-emerald-400 text-xs font-mono font-bold bg-emerald-950/80 px-2 py-1 rounded border border-emerald-700/60">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>ARMED</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={checkMicrophone}
                  disabled={micStatus === 'CHECKING'}
                  className="text-xs font-mono px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded border border-gray-600 transition-colors"
                >
                  {micStatus === 'CHECKING' ? 'TESTING...' : 'TEST MIC'}
                </button>
              )}
            </div>
          </div>

          {/* Join Channel Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-600 hover:from-emerald-500 to-teal-700 text-white font-display font-bold text-sm tracking-widest uppercase py-3 rounded-xl shadow-[0_10px_20px_rgba(16,185,129,0.3)] hover:shadow-[0_10px_25px_rgba(16,185,129,0.5)] transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            <span>{loading ? 'CONNECTING TO FREQUENCY...' : 'ENTER RADIO CHANNEL'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Footer Admin Console Switch - goes through password gate */}
        <div className="mt-6 pt-4 border-t border-gray-800/80 text-center">
          <button
            type="button"
            onClick={onOpenAdmin}
            className="text-xs font-mono text-gray-500 hover:text-amber-400 flex items-center justify-center space-x-1.5 mx-auto transition-colors opacity-60 hover:opacity-100"
          >
            <Shield className="w-3 h-3 text-amber-700" />
            <span>Command HQ Access (Restricted)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
