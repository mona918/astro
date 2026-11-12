/**
 * WebRTC Peer-to-Peer Audio Mesh Service for Tactical Radio Simulation
 * Handles local audio capture, peer connections, and links audio tracks to RadioAudioEngine.
 */

import { audioEngine } from '../audio/RadioAudioEngine';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

class WebRtcService {
  constructor() {
    this.socket = null;
    this.localStream = null;
    this.peers = new Map(); // peerId -> RTCPeerConnection
    this.isTransmitting = false;
    this.onMicStatusChange = null;
    this.onPeerListChange = null;
  }

  setSocket(socket) {
    this.socket = socket;
    this.setupSocketListeners();
  }

  // Acquire local microphone
  async initLocalMicrophone() {
    if (this.localStream) {
      return this.localStream;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser or connection does not support audio capture. (Note: On LAN, HTTPS or localhost is required)');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false, // keep some natural voice dynamics for radio DSP
          autoGainControl: true,
        },
        video: false,
      });

      this.localStream = stream;

      // Start with mic muted - audio track is disabled until server grants PTT!
      this.setMicrophoneEnabled(false);

      if (this.onMicStatusChange) {
        this.onMicStatusChange({ hasMic: true, error: null });
      }

      return stream;
    } catch (err) {
      console.error('Error obtaining microphone:', err);
      let errorMsg = 'Microphone access denied or unavailable.';
      if (err.name === 'NotAllowedError') {
        errorMsg = 'Microphone permission denied. Please allow microphone access in your browser settings.';
      } else if (err.name === 'NotFoundError') {
        errorMsg = 'No microphone device found on this system.';
      } else if (err.message) {
        errorMsg = err.message;
      }

      if (this.onMicStatusChange) {
        this.onMicStatusChange({ hasMic: false, error: errorMsg });
      }
      throw new Error(errorMsg);
    }
  }

  // Toggle outgoing audio track on PTT press/release
  setMicrophoneEnabled(enabled) {
    this.isTransmitting = enabled;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  // Setup Socket listeners for WebRTC signaling
  setupSocketListeners() {
    if (!this.socket) return;

    // Incoming SDP signal
    this.socket.on('webrtc:signal', async ({ sender, signal }) => {
      try {
        let pc = this.peers.get(sender);
        if (!pc) {
          pc = this.createPeerConnection(sender);
        }

        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          this.socket.emit('webrtc:signal', {
            target: sender,
            signal: pc.localDescription,
          });
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
        }
      } catch (err) {
        console.error('Error handling WebRTC signal from', sender, err);
      }
    });

    // Incoming ICE candidate
    this.socket.on('webrtc:ice-candidate', async ({ sender, candidate }) => {
      try {
        const pc = this.peers.get(sender);
        if (pc && candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('Error adding ICE candidate from', sender, err);
      }
    });

    // Peer disconnected
    this.socket.on('team:member-left', ({ socketId }) => {
      this.removePeer(socketId);
    });
  }

  // Create a peer connection with a team member
  createPeerConnection(peerId, isInitiator = false) {
    if (this.peers.has(peerId)) {
      return this.peers.get(peerId);
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peers.set(peerId, pc);

    // Add local audio tracks if microphone is initialized
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    // ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit('webrtc:ice-candidate', {
          target: peerId,
          candidate: event.candidate,
        });
      }
    };

    // When remote audio track arrives, connect directly into the Radio DSP Audio Engine!
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        audioEngine.attachPeerStream(peerId, event.streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.removePeer(peerId);
      }
    };

    // If initiator, create offer
    if (isInitiator) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          this.socket.emit('webrtc:signal', {
            target: peerId,
            signal: pc.localDescription,
          });
        } catch (err) {
          console.error('Error creating offer for peer', peerId, err);
        }
      };
    }

    return pc;
  }

  // Connect to existing team peers upon joining room
  async connectToExistingPeers(existingPeers) {
    for (const peer of existingPeers) {
      const pc = this.createPeerConnection(peer.peerId, true);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.socket.emit('webrtc:signal', {
          target: peer.peerId,
          signal: pc.localDescription,
        });
      } catch (e) {
        console.error('Failed to initiate call to peer', peer.peerId, e);
      }
    }
  }

  removePeer(peerId) {
    const pc = this.peers.get(peerId);
    if (pc) {
      try {
        pc.close();
      } catch (e) {}
      this.peers.delete(peerId);
    }
    audioEngine.detachPeerStream(peerId);
  }

  disconnectAll() {
    for (const [peerId] of this.peers.entries()) {
      this.removePeer(peerId);
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }
}

export const webrtcService = new WebRtcService();
