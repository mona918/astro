/**
 * WebRTC Peer-to-Peer Audio Mesh Service
 * Uses HTML <audio> elements as primary output (mobile-compatible)
 * + Web Audio API for effects processing on top.
 */

import { audioEngine } from '../audio/RadioAudioEngine';

// Use STUN + fallback LAN candidates (no TURN needed on same Wi-Fi)
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

class WebRtcService {
  constructor() {
    this.socket = null;
    this.localStream = null;
    this.peers = new Map(); // peerId -> RTCPeerConnection
    this.isTransmitting = false;
    this.onMicStatusChange = null;
  }

  setSocket(socket) {
    this.socket = socket;
    this.setupSocketListeners();
  }

  // Acquire microphone
  async initLocalMicrophone() {
    if (this.localStream) return this.localStream;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          'Microphone not supported. Use HTTPS (https://...:4443) on mobile devices.'
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
        video: false,
      });

      this.localStream = stream;
      this.setMicrophoneEnabled(false); // muted until PTT granted
      if (this.onMicStatusChange) this.onMicStatusChange({ hasMic: true, error: null });
      return stream;
    } catch (err) {
      let msg = 'Microphone access denied or unavailable.';
      if (err.name === 'NotAllowedError') msg = 'Microphone permission denied. Allow it in your browser settings.';
      else if (err.name === 'NotFoundError') msg = 'No microphone found on this device.';
      else if (err.message) msg = err.message;

      if (this.onMicStatusChange) this.onMicStatusChange({ hasMic: false, error: msg });
      throw new Error(msg);
    }
  }

  setMicrophoneEnabled(enabled) {
    this.isTransmitting = enabled;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => { t.enabled = enabled; });
    }
  }

  setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('webrtc:signal', async ({ sender, signal }) => {
      try {
        let pc = this.peers.get(sender);
        if (!pc) pc = this.createPeerConnection(sender);

        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.socket.emit('webrtc:signal', { target: sender, signal: pc.localDescription });
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
        }
      } catch (err) {
        console.error('[WebRTC] Signal error from', sender, err);
      }
    });

    this.socket.on('webrtc:ice-candidate', async ({ sender, candidate }) => {
      try {
        const pc = this.peers.get(sender);
        if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('[WebRTC] ICE candidate error from', sender, err);
      }
    });

    this.socket.on('team:member-left', ({ socketId }) => {
      this.removePeer(socketId);
    });
  }

  createPeerConnection(peerId, isInitiator = false) {
    if (this.peers.has(peerId)) return this.peers.get(peerId);

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peers.set(peerId, pc);

    // Add local microphone tracks to outgoing stream
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    // ICE candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && this.socket) {
        this.socket.emit('webrtc:ice-candidate', { target: peerId, candidate });
      }
    };

    pc.onicecandidateerror = (e) => {
      // Non-fatal: local ICE candidates still work on LAN
      console.warn('[WebRTC] ICE candidate error (may be safe to ignore on LAN):', e.errorText);
    };

    // -------------------------------------------------------
    // KEY FIX: Attach incoming audio via HTML <audio> element
    // This is the ONLY reliable method on all mobile browsers.
    // The Web Audio API ctx.destination can route to earpiece
    // or be suspended on mobile — <audio> elements use the
    // system media output (speaker) automatically.
    // -------------------------------------------------------
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        audioEngine.attachPeerStream(peerId, event.streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${peerId} state: ${pc.connectionState}`);
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        this.removePeer(peerId);
      }
    };

    if (isInitiator) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          this.socket.emit('webrtc:signal', { target: peerId, signal: pc.localDescription });
        } catch (err) {
          console.error('[WebRTC] Offer error for peer', peerId, err);
        }
      };
    }

    return pc;
  }

  async connectToExistingPeers(existingPeers) {
    for (const peer of existingPeers) {
      const pc = this.createPeerConnection(peer.peerId, true);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.socket.emit('webrtc:signal', { target: peer.peerId, signal: pc.localDescription });
      } catch (e) {
        console.error('[WebRTC] Failed to initiate call to peer', peer.peerId, e);
      }
    }
  }

  removePeer(peerId) {
    const pc = this.peers.get(peerId);
    if (pc) {
      try { pc.close(); } catch (e) {}
      this.peers.delete(peerId);
    }
    audioEngine.detachPeerStream(peerId);
  }

  disconnectAll() {
    for (const [peerId] of this.peers.entries()) this.removePeer(peerId);
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
  }
}

export const webrtcService = new WebRtcService();
