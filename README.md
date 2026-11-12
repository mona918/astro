# TAC-COM // Tactical Radio Communication Simulation Platform

A real-time, web-based military-grade walkie-talkie / radio communication platform designed for multi-team competitions, field simulations, and tactical events operating over local Wi-Fi / LAN.

![TAC-COM Platform](https://img.shields.io/badge/TAC--COM-MIL--STD--810G-10b981?style=for-the-badge&logo=satellite&logoColor=white)
![WebRTC Mesh](https://img.shields.io/badge/AUDIO-WebRTC%20Mesh%20%2B%20WebAudio%20DSP-blue?style=for-the-badge)
![Half Duplex](https://img.shields.io/badge/COMMUNICATION-Half--Duplex%20PTT%20Lock-dc2626?style=for-the-badge)

---

## 1. Overview & Core Mission

Standard VoIP voice chats (such as Discord, WhatsApp, or Zoom) are full-duplex systems where all parties speak concurrently over crystal-clear connections. **TAC-COM** accurately recreates the tactile constraints, electromagnetic interference, discipline, and half-duplex mechanics of genuine military/emergency handheld transceivers (VHF/UHF walkie-talkies):

- **Half-Duplex Lock**: Only ONE operator in a squad can transmit at any moment. When someone keys the mic, all other squad members automatically enter listen mode.
- **Server-Authoritative Concurrency Protection**: Race conditions from simultaneous button presses are arbitrated server-side with zero audio collisions.
- **Isolated Team Channels**: Squad communications are strictly partitioned (`ALPHA-01`, `BRAVO-02`, `CHARLIE-03`). Teams cannot eavesdrop or leak audio into unauthorized channels.
- **Realistic Radio DSP Effects**: Real-time atmospheric background static hiss, 300Hz–3kHz bandpass filtering, harmonic saturation, Quindar/Roger beeps, and squelch tail audio.
- **Simulated Unreliable Field Conditions**: Configurable atmospheric transmission delay, random signal interruptions (EMP bursts), and carrier dropouts controlled dynamically from the Command HQ dashboard.

---

## 2. Architecture & Technologies

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TACTICAL RADIO SYSTEM ARCHITECTURE              │
└────────────────────────────────────────────────────────────────────────┘

 [ Client Browser: Operator Handset ]         [ Client Browser: Command HQ ]
  ├── React 18 + Tailwind UI                  ├── Admin Dashboard Controls
  ├── Web Audio API DSP Pipeline              ├── Real-time Preset Modulator
  ├── WebRTC MediaStream Capture              └── Master Event Log Feed
  └── Socket.IO Client (Signaling & PTT)                   │
              ▲                                            ▼
              │                                            │
              ▼                                            ▼
  ┌──────────────────────────────────────────────────────────────┐
  │         Node.js / Express / Socket.IO Server (:4000)         │
  │  ├── 0.0.0.0 Bind (Multi-device LAN / Wi-Fi Access)          │
  │  ├── Server-Authoritative Half-Duplex Transmission Lock      │
  │  ├── WebRTC Mesh Signaling (Isolated Room Verification)      │
  │  ├── Round State Machine (NOT_STARTED, ACTIVE, PAUSED)       │
  │  └── Static Production Frontend Asset Serving                │
  └──────────────────────────────────────────────────────────────┘
              ▲
              │ WebRTC Direct Audio Mesh (P2P on same LAN)
              ▼
 [ Client Browser: Peer Squad Operator ]
  ├── WebRTC PeerConnection
  ├── WebAudio Delay Node (0 - 3000ms latency)
  ├── Dual BiquadFilter (Highpass 350Hz + Lowpass 2900Hz)
  ├── WaveShaper (Saturation / Distortion)
  ├── DynamicsCompressor (Radio AGC)
  └── Procedural Static & Roger Beep Generator
```

### Technology Stack:
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, HTML5 Canvas Oscilloscope.
- **Audio Processing**: Native Web Audio API (Zero external MP3 dependencies; procedural noise buffers, wave shapers, and frequency filtering).
- **Voice Communication**: WebRTC Peer Connection mesh for direct, ultra-low latency peer-to-peer audio transmission.
- **Real-Time Signaling & State**: Node.js, Express, Socket.IO.

---

## 3. Key Features

### A. Operator Handset (Walkie-Talkie Interface)
- **Authentic Handheld Chassis**: Military-style bezel, hardware antenna, volume/mute knob, and channel status lights.
- **Tactical Backlit CRT / LCD Screen**: Displays frequency (e.g. `142.850 MHz`), assigned channel code, 5-bar RSSI signal meter, and live 300Hz–3.2kHz audio oscilloscope waveform.
- **Massive Tactile PUSH-TO-TALK (PTT) Button**:
  - Touch & Mouse Hold support
  - Keyboard Shortcut: **SPACEBAR** (hold to talk, release to listen, default page scrolling disabled)
  - Color-coded visual states:
    - 🟢 `CHANNEL READY` / `IDLE`
    - 🔴 `TRANSMITTING` (pulsing red LED, mic unmuted)
    - 🟡 `CHANNEL BUSY` (yellow lock, displays active speaker callsign)
    - ⚠️ `SIGNAL INTERRUPTED` (hazard stripes, atmospheric static)
    - ⚫ `CONNECTION LOST` / `RECONNECTING`
- **Acoustic Audio Feedback**:
  - Tactile relay click upon pressing PTT.
  - Iconic military dual-tone NASA Quindar / Roger beep (1200Hz + 950Hz) + squelch hiss when releasing PTT.
  - Double staccato buzz on channel busy.
  - Warning pips on carrier dropouts.

### B. Command HQ (Admin Dashboard)
- **Round Lifecycle Controls**: Start Round, Pause Round, Stop Round, and Reset Round. PTT transmission is automatically gated and disabled when a round is not active.
- **Multi-Squad Live Monitoring**: Real-time status cards for each team displaying connected operators, channel frequency, capacity, and current speaker indicator.
- **Dynamic Radio Conditions & Presets**:
  - `EASY`: Low static (10%), slight saturation (15%), 50ms delay, 0% interruptions.
  - `MEDIUM`: Realistic field conditions (35% static, 40% distortion, 250ms delay, 15% interruption prob).
  - `HARD`: Severe weather simulation (65% static, 70% distortion, 750ms delay, 35% interruption prob).
  - `EXTREME`: Hostile electronic warfare (90% static, 90% distortion, 1500ms delay, 55% interruption prob).
  - `CUSTOM`: Granular sliders to fine-tune Static, Distortion, Transmission Delay, Interruption Probability, Interruption Duration, and Connection Failure Probability.
- **Demo / Evaluation Simulator**: Trigger simulated ghost transmissions, EMP interruptions, or carrier drops without needing multiple physical devices.
- **Master Communication Log**: Real-time audit trail of all transmissions, connections, and interruptions across all squads.

---

## 4. Installation & Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or later.
- Modern web browser (Chrome, Edge, Firefox, Safari).

### Step 1: Install Dependencies
Run the installation command from the project root:

```bash
# In the project root directory
npm run install:all
```

Or install `server` and `client` individually:
```bash
cd server && npm install
cd ../client && npm install
cd ..
```

### Step 2: Build the Frontend
```bash
npm run build
```
*(This builds the production React application directly into `server/public`)*

### Step 3: Start the TAC-COM Server
```bash
npm start
```
The server will boot and display your local and LAN Wi-Fi addresses:
```
=====================================================
  TACTICAL RADIO SIMULATION PLATFORM (TAC-COM)       
=====================================================
> Server running on port: 4000
> Local access:        http://localhost:4000
> LAN Wi-Fi (Wi-Fi): http://192.168.1.15:4000
=====================================================
```

---

## 5. Development Mode

If you are developing or modifying UI components with Vite hot-reload:

```bash
# Terminal 1: Start Backend Server
npm run dev:server

# Terminal 2: Start Frontend Development Server
npm run dev:client
```
Visit `http://localhost:5173` (requests to `/socket.io` and `/api` are automatically proxied to `:4000`).

---

## 6. LAN / Wi-Fi Multi-Device Setup

The platform is engineered for events where multiple laptops, phones, or tablets are connected to the **same Wi-Fi network**.

### Step 1: Identify Server IP
When the server starts, it prints your local network IP (e.g., `http://192.168.1.15:4000`).

### Step 2: Connect Devices
- **Command HQ (Admin)**: Open `http://localhost:4000` or `http://<SERVER-IP>:4000` on the host machine. Click **"SWITCH TO COMMAND HQ (ADMIN DASHBOARD)"**.
- **Squad Participants**: On phones, tablets, or laptops connected to the same Wi-Fi, open `http://<SERVER-IP>:4000`.

### Important Browser Note for Mobile LAN Microphones:
Modern browsers (Chrome, Edge, Safari) protect microphone access via `getUserMedia` on secure contexts (`localhost` or `HTTPS`).
When accessing over local HTTP via LAN IP (e.g. `http://192.168.1.15:4000`) on other devices:
- **Chrome / Edge Flag (Recommended for testing on Android/PC)**:
  1. Open `chrome://flags/#unsafely-treat-insecure-origin-as-secure` on the client device.
  2. Add your server's IP (e.g. `http://192.168.1.15:4000`) to the whitelist and enable it.
  3. Relaunch the browser.
- **Localhost Testing**: Multiple browser tabs on `http://localhost:4000` (or `incognito` windows) enjoy full microphone access without any flags!

---

## 7. How to Operate & Test

### How Admin Starts a Match:
1. Open the platform and navigate to **COMMAND HQ**.
2. Review the squad channels (`Alpha Squad`, `Bravo Unit`, `Charlie Recon`) or click **"CREATE TEAM CHANNEL"** to add custom squads.
3. Select your desired radio condition preset (`EASY`, `MEDIUM`, `HARD`, `EXTREME`).
4. Click **[ START ROUND ]**. All operator handsets will switch from `STANDBY` to `🟢 CHANNEL READY`.

### How Squad Members Communicate:
1. Enter your operator callsign (e.g. `Viper-01`, `Ghost-Lead`).
2. Select your assigned team channel (e.g. `ALPHA-01`).
3. Click **"TEST MIC"** to arm your microphone, then click **"ENTER RADIO CHANNEL"**.
4. To speak:
   - Click and hold the large red **PUSH TO TALK** button, or press and hold the **SPACEBAR**.
   - Your button turns red: `🔴 TRANSMITTING`. Speak into your microphone.
   - When finished, release the button/Spacebar. You will hear the **Roger beep**, and the channel is freed for other squad members.
5. If another squad member is speaking, your button turns amber: `🟡 CHANNEL BUSY (VIPER-01 IS TALKING)`. You cannot interrupt them until they release PTT.

---

## 8. Automated Integration Test Suite

The platform includes a built-in automated test suite covering all half-duplex and security requirements:

```bash
node server/test/simulation.test.js
```

### Verified Test Cases:
1. **Two members join the same team** -> Channel connection and state synchronization verified.
2. **Three members join same team** -> Member 1 transmits, Members 2 & 3 receive speaker events.
3. **Simultaneous PTT race condition** -> Only one client granted transmission; second client receives `CHANNEL_BUSY`.
4. **Team channel isolation** -> Team Alpha transmission produces zero leakage or events on Team Bravo.
5. **Static level update** -> Admin updates static noise level; broadcast verified.
6. **Transmission delay update** -> Admin updates latency buffer delay; broadcast verified.
7. **Signal interruption simulation** -> Atmospheric EMP dropout event broadcast verified.
8. **Transmitter disconnect release** -> Sudden operator disconnect automatically releases PTT lock with zero channel stall.

---

## 9. Audio Pipeline Details

```
Microphone Stream
       │
       ▼
WebRTC Outbound Mesh (Muted when PTT idle; Enabled when PTT granted)
       │
       ▼ (Direct Peer-to-Peer Stream over LAN)
WebAudio Context Receiver
       │
       ▼
DelayNode (Transmission Delay: 0 - 3000ms)
       │
       ▼
Highpass Filter (350Hz, Q=1.2: Removes mic rumble, mimics walkie-talkie speaker)
       │
       ▼
Lowpass Filter (2900Hz, Q=1.0: Strict military VHF voice band limit)
       │
       ▼
Peaking Filter (1.8kHz, +5dB: Vocal punch and presence)
       │
       ▼
WaveShaper Node (Asymmetric soft saturation curve for radio overdrive)
       │
       ▼
DynamicsCompressor (Threshold -24dB, Ratio 12:1: Radio AGC limiter)
       │
       ▼
Interruption Gate (GainNode: Drops to 0 during atmospheric dropouts)
       │
       ▼
Atmospheric Static Mixer (Blends procedural pink/white VHF noise)
       │
       ▼
Destination (Speakers / Headphones)
```

---

## 10. Troubleshooting

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **"Microphone access denied"** | Browser blocked mic permission | Click the lock/tune icon in the browser address bar and set Microphone to "Allow". |
| **"Channel capacity reached"** | Team has reached max members | Admin can create another channel or increase team size. |
| **"Round has not started yet"** | Admin has not clicked Start Round | Admin must click **[ START ROUND ]** in Command HQ. |
| **Microphone blocked on mobile Wi-Fi** | Chrome blocks HTTP mic on non-localhost | Enable `chrome://flags/#unsafely-treat-insecure-origin-as-secure` with your LAN IP. |
| **Audio feedback / echo during local testing** | Two tabs open on same machine with speakers active | Use headphones or mute one of the tabs using the top-bar audio toggle. |

---

## 11. License
MIT License. Built for competition, tactical simulations, and emergency team drills.
