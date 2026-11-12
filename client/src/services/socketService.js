/**
 * Socket.IO Client Service for Tactical Radio Platform
 * Automatically targets current LAN IP or host so any device on the network connects seamlessly.
 */

import { io } from 'socket.io-client';
import { webrtcService } from './webrtcService';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    // Auto-detect server URL:
    // If running under Vite dev on :5173, point to port :4000 on the same host (LAN IP or localhost)
    let serverUrl = window.location.origin;
    if (window.location.port === '5173') {
      serverUrl = `${window.location.protocol}//${window.location.hostname}:4000`;
    }

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
    });

    webrtcService.setSocket(this.socket);

    this.socket.on('connect', () => {
      console.log('[TAC-COM] Connected to Tactical HQ Server via', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('[TAC-COM] Disconnected from server:', reason);
    });

    return this.socket;
  }

  getSocket() {
    if (!this.socket) {
      return this.connect();
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
