/**
 * Automated Verification Suite for Radio Communication Simulation Platform
 * Validates Section 25 requirements:
 * 1. Two members join same team
 * 2. Three members join same team (half-duplex lock)
 * 3. Simultaneous PTT race condition (server-authoritative lock)
 * 4. Team channel isolation (Team Alpha vs Team Bravo)
 * 5. Admin updates static noise level
 * 6. Admin updates transmission delay
 * 7. Signal interruption event
 * 8. Automatic PTT release on sudden client disconnect
 */

// Boot server inside same process so sandbox networking rules are seamlessly satisfied
require('../src/server');

const { io: ioClient } = require('../../client/node_modules/socket.io-client');

const SERVER_URL = 'http://127.0.0.1:4000';

function createClient() {
  return ioClient(SERVER_URL, {
    transports: ['websocket'],
    forceNew: true,
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTestSuite() {
  console.log('====================================================');
  console.log(' RUNNING TAC-COM AUTOMATED INTEGRATION TEST SUITE   ');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 8;

  await delay(500);

  // Setup Admin Client
  const admin = createClient();
  await new Promise((resolve) => admin.on('connect', resolve));
  admin.emit('admin:join');
  // Start round so PTT is enabled
  admin.emit('admin:round:start');
  await delay(200);

  try {
    // -----------------------------------------------------------
    // TEST 1: Two members join the same team
    // -----------------------------------------------------------
    console.log('[TEST 1] Two members join the same team...');
    const memberA1 = createClient();
    const memberA2 = createClient();

    let join1 = await new Promise((res) => {
      memberA1.emit('team:join', { channelCode: 'ALPHA-01', name: 'Alpha-One' }, res);
    });
    let join2 = await new Promise((res) => {
      memberA2.emit('team:join', { channelCode: 'ALPHA-01', name: 'Alpha-Two' }, res);
    });

    if (join1.success && join2.success && join1.team.members.length >= 1) {
      console.log('  -> PASS: Both members successfully joined Team ALPHA-01 channel.');
      passedTests++;
    } else {
      console.error('  -> FAIL: Failed joining team', { join1, join2 });
    }

    // -----------------------------------------------------------
    // TEST 2: Three members join same team, Member 1 transmits, others listen
    // -----------------------------------------------------------
    console.log('\n[TEST 2] Three members join same team. Member 1 transmits, others listen...');
    const memberA3 = createClient();
    await new Promise((res) => {
      memberA3.emit('team:join', { channelCode: 'ALPHA-01', name: 'Alpha-Three' }, res);
    });

    let a2Heard = false;
    let a3Heard = false;
    memberA2.on('ptt:speaker-changed', (data) => {
      if (data.isTransmitting && data.transmitterName === 'Alpha-One') a2Heard = true;
    });
    memberA3.on('ptt:speaker-changed', (data) => {
      if (data.isTransmitting && data.transmitterName === 'Alpha-One') a3Heard = true;
    });

    let pttReq1 = await new Promise((res) => memberA1.emit('ptt:request', {}, res));
    await delay(150);

    if (pttReq1.granted && a2Heard && a3Heard) {
      console.log('  -> PASS: Member 1 granted PTT. Members 2 and 3 received speaker-changed event.');
      passedTests++;
    } else {
      console.error('  -> FAIL: Half-duplex listening failed', { pttReq1, a2Heard, a3Heard });
    }

    // Release Member 1
    await new Promise((res) => memberA1.emit('ptt:release', {}, res));
    await delay(150);

    // -----------------------------------------------------------
    // TEST 3: Simultaneous PTT race condition
    // -----------------------------------------------------------
    console.log('\n[TEST 3] Simultaneous PTT press race condition...');
    const [p1, p2] = await Promise.all([
      new Promise((res) => memberA1.emit('ptt:request', {}, res)),
      new Promise((res) => memberA2.emit('ptt:request', {}, res))
    ]);

    const oneGranted = (p1.granted && !p2.granted) || (!p1.granted && p2.granted);
    const oneBusy = (p1.reason === 'CHANNEL_BUSY' || p2.reason === 'CHANNEL_BUSY');

    if (oneGranted && oneBusy) {
      console.log('  -> PASS: Exactly one client was granted transmission; the other received CHANNEL_BUSY.');
      passedTests++;
    } else {
      console.error('  -> FAIL: Race condition failed to resolve cleanly', { p1, p2 });
    }

    // Release active lock
    memberA1.emit('ptt:release');
    memberA2.emit('ptt:release');
    await delay(150);

    // -----------------------------------------------------------
    // TEST 4: Team channel isolation (Team Alpha vs Team Bravo)
    // -----------------------------------------------------------
    console.log('\n[TEST 4] Team channel isolation (Alpha vs Bravo)...');
    const memberB1 = createClient();
    await new Promise((res) => {
      memberB1.emit('team:join', { channelCode: 'BRAVO-02', name: 'Bravo-One' }, res);
    });

    let bravoLeaked = false;
    memberB1.on('ptt:speaker-changed', () => {
      bravoLeaked = true;
    });

    // Alpha transmits
    await new Promise((res) => memberA1.emit('ptt:request', {}, res));
    await delay(150);
    await new Promise((res) => memberA1.emit('ptt:release', {}, res));

    if (!bravoLeaked) {
      console.log('  -> PASS: Team Bravo received zero audio/speaker events from Team Alpha. Channel isolation verified.');
      passedTests++;
    } else {
      console.error('  -> FAIL: Team Bravo received cross-talk from Team Alpha!');
    }

    // -----------------------------------------------------------
    // TEST 5: Admin updates static level
    // -----------------------------------------------------------
    console.log('\n[TEST 5] Admin changes static level...');
    let staticUpdated = false;
    memberA1.on('conditions:updated', (conds) => {
      if (conds.staticLevel === 88) staticUpdated = true;
    });

    admin.emit('admin:conditions:update', { staticLevel: 88 });
    await delay(150);

    if (staticUpdated) {
      console.log('  -> PASS: Admin updated static level to 88% and it broadcast to client.');
      passedTests++;
    } else {
      console.error('  -> FAIL: Client did not receive static level update');
    }

    // -----------------------------------------------------------
    // TEST 6: Admin increases delay
    // -----------------------------------------------------------
    console.log('\n[TEST 6] Admin increases transmission delay...');
    let delayUpdated = false;
    memberA1.on('conditions:updated', (conds) => {
      if (conds.transmissionDelay === 1250) delayUpdated = true;
    });

    admin.emit('admin:conditions:update', { transmissionDelay: 1250 });
    await delay(150);

    if (delayUpdated) {
      console.log('  -> PASS: Admin updated delay to 1250ms and client received it.');
      passedTests++;
    } else {
      console.error('  -> FAIL: Client did not receive delay update');
    }

    // -----------------------------------------------------------
    // TEST 7: Signal interruption event
    // -----------------------------------------------------------
    console.log('\n[TEST 7] Signal interruption broadcast...');
    let interruptionHeard = false;
    memberA2.on('ptt:signal-interrupted', (data) => {
      if (data.duration === 950) interruptionHeard = true;
    });

    memberA1.emit('ptt:signal-interrupted', { teamName: 'Alpha Squad', duration: 950 });
    await delay(150);

    if (interruptionHeard) {
      console.log('  -> PASS: Signal interruption event broadcast to team channel listeners.');
      passedTests++;
    } else {
      console.error('  -> FAIL: Team listeners did not receive signal interruption event');
    }

    // -----------------------------------------------------------
    // TEST 8: Sudden disconnect while transmitting releases PTT
    // -----------------------------------------------------------
    console.log('\n[TEST 8] Participant disconnects while transmitting -> PTT lock auto-release...');
    // Member A1 acquires lock
    let pttLock = await new Promise((res) => memberA1.emit('ptt:request', {}, res));
    if (!pttLock.granted) {
      console.error('Failed to acquire initial lock for test 8');
    }

    let a2NotifiedIdle = false;
    memberA2.on('ptt:speaker-changed', (data) => {
      if (!data.isTransmitting && data.transmitterId === null) {
        a2NotifiedIdle = true;
      }
    });

    // Abruptly disconnect Member A1
    memberA1.disconnect();
    await delay(200);

    // Now Member A2 should be able to acquire PTT immediately because lock was released
    let a2Lock = await new Promise((res) => memberA2.emit('ptt:request', {}, res));

    if (a2Lock.granted && a2NotifiedIdle) {
      console.log('  -> PASS: PTT lock automatically released on disconnect! Channel immediately freed.');
      passedTests++;
    } else {
      console.error('  -> FAIL: Channel remained locked after transmitter disconnected', { a2Lock, a2NotifiedIdle });
    }

    // Cleanup
    memberA2.disconnect();
    memberA3.disconnect();
    memberB1.disconnect();
    admin.disconnect();

  } catch (err) {
    console.error('Unexpected test error:', err);
  }

  console.log('\n====================================================');
  console.log(` RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('====================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite();
