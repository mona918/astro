/**
 * Socket.IO Client Service
 * Auto-detects whether the page is served over HTTP (port 4000) or HTTPS (port 4443)
 * and connects back to the same host so LAN and localhost both work seamlessly.
 */

import { io } from 'socket.io-client';
import { webrtcService } from './webrtcService';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    // Auto-detect correct server URL:
    // - Vite dev server (:5173) → proxy to :4000 (Vite config handles it)
    // - Production HTTP (:4000) → same origin
    // - Production HTTPS (:4443) → same origin (HTTPS) so mic works on mobile
    let serverUrl = window.location.origin;
    if (window.location.port === '5173') {
      // Vite dev mode: connect directly to backend
      serverUrl = `${window.location.protocol}//${window.location.hostname}:4000`;
    }

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
    });

    webrtcService.setSocket(this.socket);

    this.socket.on('connect', () => {
      console.log('[TAC-COM] Connected to Tactical HQ Server:', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('[TAC-COM] Disconnected:', reason);
    });

    return this.socket;
  }

  getSocket() {
    if (!this.socket) return this.connect();
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
