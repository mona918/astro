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

## 6. LAN / Wi-Fi Multi-Device & Mobile Setup

The platform is engineered for multi-device events where laptops, phones, or tablets are connected to the **same Wi-Fi network**.

### Dual-Server Architecture (HTTP + HTTPS):
When you run `npm start`, the server boots both:
- **HTTP on Port 4000**: `http://<SERVER-IP>:4000` (for desktop/laptop browsers)
- **HTTPS on Port 4443**: `https://<SERVER-IP>:4443` (⚡ **REQUIRED FOR MOBILE PHONES**)

```
=====================================================
  TACTICAL RADIO SIMULATION PLATFORM (TAC-COM)       
=====================================================
> HTTP  (localhost):   http://localhost:4000
> HTTP  (LAN):         http://10.93.138.26:4000  [Wi-Fi]
> HTTPS (LAN + MIC):   https://10.93.138.26:4443  ⬅ USE ON MOBILE
> HTTPS (localhost):   https://localhost:4443
>
> Admin password:      TACCOM-HQ-2026  (or ?adminpw=YOURPW)
=====================================================
```

---

### Why HTTPS is Required on Mobile:
Modern mobile browsers (Chrome on Android, Safari on iOS) **strictly prohibit microphone access (`getUserMedia`)** over unencrypted LAN HTTP connections. By serving HTTPS on port `4443`, the browser unlocks native microphone and speaker hardware.

#### Accepting the Self-Signed Certificate on Mobile (1-time step):
When opening `https://<SERVER-IP>:4443` on Chrome/Safari for the first time:
1. You will see a standard "Your connection is not private" warning (caused by the local self-signed SSL certificate).
2. Tap **"Advanced"** (or **"Show Details"** on Safari / iOS).
3. Tap **"Proceed to <IP> (unsafe)"** or **"Visit this website"**.
4. The walkie-talkie interface will load immediately with full microphone and speaker access!

---

## 7. Security: Restricted Command HQ (Admin Access)

The Command HQ (Admin Dashboard) is protected by a tactical authorization gate to prevent unauthorized squad participants from accessing or tampering with round controls:

- **Default HQ Security Code**: `TACCOM-HQ-2026`
- **Session Persistence**: Stored in `sessionStorage` (stays authenticated until tab is closed).
- **Brute Force Protection**: 5 consecutive incorrect attempts temporarily lock the terminal for 60 seconds.
- **Custom Admin Code**: You can customize the admin password by starting the server with an environment variable or setting a URL query parameter:
  ```
  http://localhost:4000/?adminpw=MY_CUSTOM_CODE
  ```

---

## 8. Exact Step-by-Step Procedure: Testing with 2 Phones + 1 Laptop

Follow this exact procedure to verify the entire system in real life:

### Step 1: Connect All Devices to the Same Wi-Fi
Ensure the host laptop, Phone A, and Phone B are all connected to the **same Wi-Fi router / mobile hotspot**.

### Step 2: Start TAC-COM on the Laptop
In the project directory on your laptop:
```bash
npm start
```
Note the printed LAN IP (for example, `10.93.138.26`).

### Step 3: Open Command HQ on Laptop
1. Open `http://localhost:4000` in your laptop browser.
2. Click **"HQ ADMIN"** in the top right header.
3. Enter the HQ password: `TACCOM-HQ-2026` and tap **AUTHORIZE ACCESS**.
4. Click **[ START ROUND ]**. The round status changes to `ACTIVE`.

### Step 4: Open Handset on Phone A
1. On **Phone A**, open Chrome/Safari and visit:
   ```
   https://<YOUR-LAN-IP>:4443
   ```
   *(Example: `https://10.93.138.26:4443`)*
2. Tap **"Advanced"** → **"Proceed"** to accept the local SSL cert.
3. Enter Callsign: `VIPER-01`.
4. Select Channel: `ALPHA-01`.
5. Tap **"TEST MIC"** and grant microphone permissions when prompted.
6. Tap **"ENTER RADIO CHANNEL"**.

### Step 5: Open Handset on Phone B
1. On **Phone B**, open Chrome/Safari and visit:
   ```
   https://<YOUR-LAN-IP>:4443
   ```
2. Accept the certificate warning.
3. Enter Callsign: `VIPER-02`.
4. Select Channel: `ALPHA-01` (same channel).
5. Tap **"TEST MIC"** and grant microphone permissions.
6. Tap **"ENTER RADIO CHANNEL"**.

### Step 6: Test Voice Communication & Half-Duplex Locking
1. **Phone A speaks**:
   - Press and hold the big **PUSH TO TALK** button on Phone A.
   - Button lights up **🔴 TRANSMITTING**.
   - Speak clearly: *"Radio check, Viper-02, do you copy?"*
   - On Phone B, the button automatically locks to **🟡 CHANNEL BUSY (VIPER-01)**.
   - **Phone B will hear Phone A's voice loudly through the phone speaker!**
2. **Phone A releases PTT**:
   - Release the button on Phone A.
   - Both phones hear the military **Roger Beep + Squelch Tail**.
   - Both phones return to **🟢 CHANNEL READY**.
3. **Phone B responds**:
   - Press and hold PTT on Phone B.
   - Speak: *"Loud and clear, Viper-01, transmission received."*
   - Phone A hears Phone B through the speaker.
4. **Test Race Condition / Collision Prevention**:
   - While Phone A is holding PTT and transmitting, have Phone B try to press PTT.
   - Phone B is immediately rejected with a **buzzer tone** and `CHANNEL BUSY` lock. Only one person can ever speak at once!
5. **Test Radio Interference from Admin Dashboard**:
   - On the laptop admin dashboard, adjust **Voice Distortion** or **Static Noise** sliders, or select the **HARD** preset.
   - Notice the realistic analog radio degradation applied to incoming transmissions in real-time.

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
