import React, { useState, useEffect } from 'react';
import { Radio, Shield, Volume2, VolumeX, Wifi, WifiOff, Users } from 'lucide-react';
import { socketService } from './services/socketService';
import { audioEngine } from './audio/RadioAudioEngine';
import JoinChannelModal from './components/JoinChannelModal';
import RadioWalkieTalkie from './components/RadioWalkieTalkie';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  const [view, setView] = useState('JOIN'); // 'JOIN' | 'RADIO' | 'ADMIN'
  const [joinedTeam, setJoinedTeam] = useState(null);
  const [currentMember, setCurrentMember] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const socket = socketService.connect();

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);

  const handleJoinSuccess = ({ team, member }) => {
    setJoinedTeam(team);
    setCurrentMember(member);
    setView('RADIO');
  };

  const handleLeaveChannel = () => {
    const socket = socketService.getSocket();
    socket.emit('team:leave');
    setJoinedTeam(null);
    setCurrentMember(null);
    setView('JOIN');
  };

  const toggleMasterMute = () => {
    const muted = audioEngine.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="min-h-screen bg-radio-dark text-gray-200 flex flex-col justify-between selection:bg-emerald-500 selection:text-black">
      {/* Tactical Top Bar */}
      <header className="border-b border-gray-800 bg-radio-panel/80 backdrop-blur sticky top-0 z-40 px-3 sm:px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Platform Name */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-950 border border-emerald-600/70 rounded-xl text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-display font-extrabold text-sm sm:text-base tracking-widest text-emerald-400 uppercase">
                  TAC-COM // NET
                </span>
                <span className="hidden sm:inline-block text-[10px] bg-gray-800 text-gray-400 border border-gray-700 px-1.5 py-0.5 rounded font-mono">
                  v2.5 PTT
                </span>
              </div>
              <span className="text-[10px] font-mono text-gray-400 block -mt-0.5">
                HALF-DUPLEX RADIO PLATFORM
              </span>
            </div>
          </div>

          {/* Navigation & Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3 font-mono text-xs">
            {/* View Switching */}
            {view === 'ADMIN' ? (
              <button
                onClick={() => setView(joinedTeam ? 'RADIO' : 'JOIN')}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 flex items-center space-x-1.5 transition-colors"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">SWITCH TO OPERATOR</span>
              </button>
            ) : (
              <button
                onClick={() => setView('ADMIN')}
                className="px-3 py-1.5 bg-amber-950/70 hover:bg-amber-900 border border-amber-700/60 rounded-lg text-amber-300 flex items-center space-x-1.5 transition-colors"
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">HQ ADMIN</span>
              </button>
            )}

            {/* Mute Button */}
            <button
              onClick={toggleMasterMute}
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border flex items-center space-x-1 transition-colors ${
                isMuted
                  ? 'bg-red-950 border-red-700 text-red-300'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{isMuted ? 'MUTED' : 'AUDIO ON'}</span>
            </button>

            {/* Server Connection Status */}
            <div className="flex items-center space-x-1.5 bg-black/50 border border-gray-800 px-2.5 py-1.5 rounded-lg">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500 animate-ping'
                }`}
              />
              <span className="text-[11px] text-gray-400 hidden sm:inline">
                {isConnected ? 'ONLINE' : 'LINK DOWN'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center py-4 sm:py-6">
        {view === 'JOIN' && (
          <JoinChannelModal
            onJoinSuccess={handleJoinSuccess}
            onOpenAdmin={() => setView('ADMIN')}
          />
        )}

        {view === 'RADIO' && joinedTeam && currentMember && (
          <RadioWalkieTalkie
            teamData={joinedTeam}
            currentMember={currentMember}
            onLeaveChannel={handleLeaveChannel}
            onOpenAdmin={() => setView('ADMIN')}
          />
        )}

        {view === 'ADMIN' && (
          <AdminDashboard
            onSwitchToOperator={() => setView(joinedTeam ? 'RADIO' : 'JOIN')}
          />
        )}
      </main>

      {/* Tactical Footer */}
      <footer className="border-t border-gray-800/80 bg-black/60 py-2.5 px-4 text-center font-mono text-[11px] text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>TAC-COM // MIL-SPEC MULTI-TEAM AUDIO SIMULATION SYSTEM</span>
          <span>WEBRTC MESH // WEBAUDIO DSP // REAL-TIME SOCKET.IO</span>
        </div>
      </footer>
    </div>
  );
}
