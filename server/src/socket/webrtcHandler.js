/**
 * WebRTC Signaling Handler with Strict Team Channel Isolation
 */

const state = require('../state');

function registerWebRtcHandlers(io, socket) {
  // WebRTC SDP Signal (Offer / Answer)
  socket.on('webrtc:signal', ({ target, signal }) => {
    if (!target || !signal) return;

    const senderSock = state.sockets.get(socket.id);
    const targetSock = state.sockets.get(target);

    // Strict validation: both sockets must exist and belong to the same team
    if (!senderSock || !targetSock || senderSock.teamId !== targetSock.teamId) {
      console.warn(`[SECURITY] Blocked cross-channel WebRTC signal attempt from ${socket.id} to ${target}`);
      return;
    }

    // Forward signal securely to intended recipient
    io.to(target).emit('webrtc:signal', {
      sender: socket.id,
      signal
    });
  });

  // WebRTC ICE Candidate
  socket.on('webrtc:ice-candidate', ({ target, candidate }) => {
    if (!target || !candidate) return;

    const senderSock = state.sockets.get(socket.id);
    const targetSock = state.sockets.get(target);

    // Strict validation
    if (!senderSock || !targetSock || senderSock.teamId !== targetSock.teamId) {
      console.warn(`[SECURITY] Blocked cross-channel ICE candidate attempt from ${socket.id} to ${target}`);
      return;
    }

    io.to(target).emit('webrtc:ice-candidate', {
      sender: socket.id,
      candidate
    });
  });
}

module.exports = registerWebRtcHandlers;
