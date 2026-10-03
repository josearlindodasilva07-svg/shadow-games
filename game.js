"use strict";

/* =========================================================
   SHADOW GAMES V1
   3D LOBBY + MULTIPLAYER
   Three.js + PeerJS
   ========================================================= */

const $ = id => document.getElementById(id);

const loginScreen = $("loginScreen");
const homeScreen = $("homeScreen");
const roomScreen = $("roomScreen");
const gameScreen = $("gameScreen");

const usernameInput = $("usernameInput");
const loginButton = $("loginButton");
const loginStatus = $("loginStatus");

const profileAvatar = $("profileAvatar");
const profileName = $("profileName");

const createRoomButton = $("createRoomButton");
const showJoinButton = $("showJoinButton");
const logoutButton = $("logoutButton");

const homeStatus = $("homeStatus");

const joinPanel = $("joinPanel");
const joinCodeInput = $("joinCodeInput");
const joinRoomButton = $("joinRoomButton");
const cancelJoinButton = $("cancelJoinButton");
const joinStatus = $("joinStatus");

const leaveRoomButton = $("leaveRoomButton");
const copyCodeButton = $("copyCodeButton");

const roomCodeText = $("roomCodeText");
const connectionBadge = $("connectionBadge");
const playerCount = $("playerCount");
const playersList = $("playersList");

const micButton = $("micButton");
const micButtonText = $("micButtonText");
const startGameButton = $("startGameButton");

const roomStatus = $("roomStatus");

const gameRound = $("gameRound");
const gamePlayerCount = $("gamePlayerCount");
const gameVoiceButton = $("gameVoiceButton");

const gameMessage = $("gameMessage");
const gameCenter = $("gameCenter");
const countdownNumber = $("countdownNumber");

const recordingPanel = $("recordingPanel");
const recordTimerElement = $("recordTimer");
const recordProgress = $("recordProgress");

const playbackPanel = $("playbackPanel");
const playbackName = $("playbackName");
const playbackStatus = $("playbackStatus");
const playbackScore = $("playbackScore");

const joystick = $("joystick");
const joystickKnob = $("joystickKnob");

/* =========================================================
   STATE
   ========================================================= */

let username = "";
let myPlayerId = "";
let myPeerId = "";

let peer = null;

let roomCode = "";
let isHost = false;
let hostPeerId = "";

let localStream = null;
let micEnabled = false;

let connections = new Map();
let voiceCalls = new Map();
let remotePlayers = new Map();

let players = [];

let heartbeatTimer = null;
let hostCleanupTimer = null;

let gameRunning = false;
let currentRound = 1;

let recordTimer = null;

let mediaRecorder = null;
let recordedChunks = [];

let joystickActive = false;
let joystickPointerId = null;
let joystickX = 0;
let joystickY = 0;

let cameraYaw = 0;
let cameraPitch = 0.32;

let lastFrameTime = performance.now();

let myCharacter = null;
let cameraTarget = null;

/* =========================================================
   LOGIN
   ========================================================= */

function loadSavedUser() {
  const saved = localStorage.getItem("shadow_username");

  if (saved) {
    usernameInput.value = saved;
  }
}

function login() {
  const value = usernameInput.value.trim();

  if (!value) {
    loginStatus.textContent = "Digite seu nome.";
    return;
  }

  username = value.slice(0, 16);

  localStorage.setItem("shadow_username", username);

  myPlayerId =
    "player-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 8);

  profileName.textContent = username;
  profileAvatar.textContent = username.charAt(0).toUpperCase();

  loginScreen.classList.add("hidden");
  homeScreen.classList.remove("hidden");

  homeStatus.textContent = "";
}

function logout() {
  disconnectEverything();

  localStorage.removeItem("shadow_username");

  username = "";
  myPlayerId = "";

  homeScreen.classList.add("hidden");
  roomScreen.classList.add("hidden");
  gameScreen.classList.add("hidden");

  loginScreen.classList.remove("hidden");

  usernameInput.value = "";
}

/* =========================================================
   SCREEN
   ========================================================= */

function showHome() {
  loginScreen.classList.add("hidden");
  roomScreen.classList.add("hidden");
  gameScreen.classList.add("hidden");

  homeScreen.classList.remove("hidden");
}

function showRoom() {
  loginScreen.classList.add("hidden");
  homeScreen.classList.add("hidden");
  gameScreen.classList.add("hidden");

  roomScreen.classList.remove("hidden");
}

function showGame() {
  loginScreen.classList.add("hidden");
  homeScreen.classList.add("hidden");
  roomScreen.classList.add("hidden");

  gameScreen.classList.remove("hidden");
}

/* =========================================================
   ROOM CODE
   ========================================================= */

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "";

  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }

  return result;
}

/* =========================================================
   PEER
   ========================================================= */

function createPeer(id) {
  return new Promise((resolve, reject) => {

    const p = new Peer(id, {
      debug: 0
    });

    p.on("open", peerId => {
      peer = p;
      myPeerId = peerId;

      resolve(p);
    });

    p.on("connection", conn => {
      handleIncomingConnection(conn);
    });

    p.on("call", call => {
      handleIncomingVoiceCall(call);
    });

    p.on("error", error => {
      console.warn("Peer error:", error);

      if (isHost) {
        connectionBadge.textContent = "Problema";
      }
    });

    p.on("disconnected", () => {
      connectionBadge.textContent = "Desconectado";
    });

    p.on("close", () => {
      connectionBadge.textContent = "Fechado";
    });

    setTimeout(() => {
      if (!peer) {
        reject(new Error("Não foi possível conectar."));
      }
    }, 15000);
  });
}

/* =========================================================
   CREATE ROOM
   ========================================================= */

async function createRoom() {

  homeStatus.textContent = "Criando sala...";

  roomCode = generateRoomCode();

  isHost = true;

  hostPeerId = "shadow-room-" + roomCode;

  try {

    await createPeer(hostPeerId);

    players = [
      {
        id: myPlayerId,
        name: username,
        peerId: myPeerId,
        host: true,
        x: 0,
        y: 0,
        z: 2
      }
    ];

    setupRoomUI();

    showRoom();

    connectionBadge.textContent = "Online";
    roomStatus.textContent = "Sala criada.";

    startHeartbeat();

    startHostCleanup();

    rebuildWorldPlayers();

  } catch (error) {

    isHost = false;

    homeStatus.textContent =
      "Não foi possível criar a sala.";
  }
}

/* =========================================================
   JOIN ROOM
   ========================================================= */

function showJoin() {
  joinPanel.classList.remove("hidden");
  joinCodeInput.focus();
}

function cancelJoin() {
  joinPanel.classList.add("hidden");
  joinStatus.textContent = "";
}

async function joinRoom() {

  const code = joinCodeInput.value
    .trim()
    .toUpperCase();

  if (code.length !== 6) {
    joinStatus.textContent = "Digite um código de 6 caracteres.";
    return;
  }

  joinStatus.textContent = "Entrando...";

  roomCode = code;
  isHost = false;

  hostPeerId = "shadow-room-" + roomCode;

  try {

    const guestPeerId =
      "shadow-player-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 7);

    await createPeer(guestPeerId);

    const conn = peer.connect(hostPeerId, {
      reliable: true,
      serialization: "binary"
    });

    setupConnection(conn, true);

    const timeout = setTimeout(() => {

      if (players.length === 0) {
        joinStatus.textContent =
          "Não foi possível encontrar a sala.";

        disconnectEverything();
      }

    }, 12000);

    conn.__joinTimeout = timeout;

  } catch (error) {

    joinStatus.textContent =
      "Não foi possível entrar.";
  }
}

/* =========================================================
   CONNECTION
   ========================================================= */

function setupConnection(conn, isHostConnection) {

  if (!conn || !conn.peer) return;

  const existing = connections.get(conn.peer);

  if (existing && existing.open) {
    try {
      conn.close();
    } catch {}

    return;
  }

  connections.set(conn.peer, conn);

  conn.on("open", () => {

    if (conn.__joinTimeout) {
      clearTimeout(conn.__joinTimeout);
    }

    if (isHost) {

      sendRoomState(conn);

      setTimeout(() => {
        setupVoiceForPeer(conn.peer);
      }, 300);

    } else {

      sendData(conn, {
        type: "HELLO",
        player: {
          id: myPlayerId,
          name: username,
          peerId: myPeerId
        }
      });

    }

    connectionBadge.textContent = "Online";
  });

  conn.on("data", data => {
    handleData(conn, data);
  });

  conn.on("close", () => {

    connections.delete(conn.peer);

    const removedPlayer = players.find(
      p => p.peerId === conn.peer
    );

    if (isHost && removedPlayer) {

      players = players.filter(
        p => p.peerId !== conn.peer
      );

      broadcastRoomState();

      removeWorldPlayer(removedPlayer.id);

    } else if (!isHost) {

      const wasHost =
        conn.peer === hostPeerId;

      if (wasHost) {

        roomStatus.textContent =
          "O dono da sala saiu.";

        connectionBadge.textContent =
          "Sala encerrada";

        stopHeartbeat();

        setTimeout(() => {
          disconnectEverything();
          showHome();
        }, 1200);
      }
    }

    voiceCalls.delete(conn.peer);

    renderPlayers();
  });

  conn.on("error", () => {
    connections.delete(conn.peer);
  });
}

function handleIncomingConnection(conn) {
  setupConnection(conn, false);
}

/* =========================================================
   DATA
   ========================================================= */

function sendData(conn, data) {

  if (!conn || !conn.open) return;

  try {
    conn.send(data);
  } catch {}
}

function broadcast(data, exceptPeerId = null) {

  for (const [peerId, conn] of connections) {

    if (peerId === exceptPeerId) continue;

    sendData(conn, data);
  }
}

function handleData(conn, data) {

  if (!data || !data.type) return;

  switch (data.type) {

    case "HELLO":
      handleHello(conn, data);
      break;

    case "ROOM_STATE":
      handleRoomState(data);
      break;

    case "PLAYER_UPDATE":
      handlePlayerUpdate(data);
      break;

    case "START_GAME":
      handleStartGame(data);
      break;

    case "PING":
      sendData(conn, {
        type: "PONG",
        time: Date.now()
      });
      break;

    case "PONG":
      break;

    default:
      break;
  }
}

/* =========================================================
   HELLO
   ========================================================= */

function handleHello(conn, data) {

  if (!isHost) return;

  if (!data.player) return;

  if (players.length >= 5) {

    sendData(conn, {
      type: "ROOM_FULL"
    });

    setTimeout(() => {
      try {
        conn.close();
      } catch {}
    }, 100);

    return;
  }

  const incoming = data.player;

  const already = players.find(
    p => p.id === incoming.id
  );

  if (already) {
    already.peerId = conn.peer;
    already.name = cleanName(incoming.name);
  } else {

    players.push({
      id: incoming.id,
      name: cleanName(incoming.name),
      peerId: conn.peer,
      host: false,

      x: randomSpawnX(),
      y: 0,
      z: randomSpawnZ()
    });
  }

  sendRoomState(conn);

  broadcastRoomState();

  setupVoiceForPeer(conn.peer);

  rebuildWorldPlayers();
}

/* =========================================================
   ROOM STATE
   ========================================================= */

function sendRoomState(conn) {

  sendData(conn, {
    type: "ROOM_STATE",

    roomCode,

    hostId: players.find(p => p.host)?.id || myPlayerId,

    hostPeerId,

    players: players.map(p => ({
      id: p.id,
      name: p.name,
      peerId: p.peerId,
      host: !!p.host,
      x: p.x,
      y: p.y,
      z: p.z
    }))
  });
}

function broadcastRoomState() {

  const state = {
    type: "ROOM_STATE",

    roomCode,

    hostId: players.find(p => p.host)?.id || myPlayerId,

    hostPeerId,

    players: players.map(p => ({
      id: p.id,
      name: p.name,
      peerId: p.peerId,
      host: !!p.host,
      x: p.x,
      y: p.y,
      z: p.z
    }))
  };

  broadcast(state);

  renderPlayers();
}

function handleRoomState(data) {

  if (!Array.isArray(data.players)) return;

  players = data.players.map(p => ({
    id: String(p.id),
    name: cleanName(p.name),
    peerId: p.peerId,
    host: !!p.host,
    x: Number(p.x) || 0,
    y: Number(p.y) || 0,
    z: Number(p.z) || 0
  }));

  hostPeerId = data.hostPeerId || hostPeerId;

  roomCode = data.roomCode || roomCode;

  roomCodeText.textContent = roomCode;

  renderPlayers();

  rebuildWorldPlayers();

  if (!isHost) {

    const me = players.find(
      p => p.id === myPlayerId
    );

    if (me) {
      connectionBadge.textContent = "Online";
      joinPanel.classList.add("hidden");

      showRoom();

      roomStatus.textContent =
        "Você entrou na sala.";
    }
  }
}

/* =========================================================
   PLAYER UPDATE
   ========================================================= */

function handlePlayerUpdate(data) {

  if (!data.player) return;

  const p = players.find(
    x => x.id === data.player.id
  );

  if (!p) return;

  p.x = Number(data.player.x) || 0;
  p.y = Number(data.player.y) || 0;
  p.z = Number(data.player.z) || 0;

  updateRemoteCharacter(
    p.id,
    p.x,
    p.y,
    p.z
  );
}

function sendMyPosition() {

  const me = players.find(
    p => p.id === myPlayerId
  );

  if (!me || !myCharacter) return;

  me.x = myCharacter.position.x;
  me.y = myCharacter.position.y;
  me.z = myCharacter.position.z;

  const message = {
    type: "PLAYER_UPDATE",
    player: {
      id: myPlayerId,
      x: me.x,
      y: me.y,
      z: me.z
    }
  };

  if (isHost) {
    broadcast(message);

  } else {

    const hostConn = connections.get(hostPeerId);

    if (hostConn) {
      sendData(hostConn, message);
    }
  }
}

/* =========================================================
   PLAYER LIST
   ========================================================= */

function renderPlayers() {

  playersList.innerHTML = "";

  playerCount.textContent =
    `${players.length}/5`;

  gamePlayerCount.textContent =
    String(players.length);

  for (const player of players) {

    const item = document.createElement("div");

    item.className = "player-item";

    const avatar = document.createElement("div");

    avatar.className = "player-avatar";

    avatar.textContent =
      player.name.charAt(0).toUpperCase();

    const info = document.createElement("div");

    info.className = "player-info";

    const name = document.createElement("strong");

    name.textContent = player.name;

    const status = document.createElement("span");

    status.textContent =
      player.id === myPlayerId
        ? "Você"
        : "Jogador";

    info.appendChild(name);
    info.appendChild(status);

    item.appendChild(avatar);
    item.appendChild(info);

    if (player.host) {

      const hostTag = document.createElement("div");

      hostTag.className = "host-tag";

      hostTag.textContent = "HOST";

      item.appendChild(hostTag);
    }

    playersList.appendChild(item);
  }

  if (isHost) {
    startGameButton.disabled = players.length < 1;
    startGameButton.style.opacity = "1";
  }
}

/* =========================================================
   ROOM UI
   ========================================================= */

function setupRoomUI() {

  roomCodeText.textContent = roomCode;

  renderPlayers();

  if (isHost) {

    startGameButton.classList.remove("hidden");

    startGameButton.textContent =
      "Começar partida";

  } else {

    startGameButton.classList.add("hidden");
  }
}

/* =========================================================
   HOST CLEANUP
   ========================================================= */

function startHostCleanup() {

  if (!isHost) return;

  clearInterval(hostCleanupTimer);

  hostCleanupTimer = setInterval(() => {

    for (const [peerId, conn] of connections) {

      if (!conn.open) {

        connections.delete(peerId);

        const player = players.find(
          p => p.peerId === peerId
        );

        if (player) {

          players = players.filter(
            p => p.id !== player.id
          );

          removeWorldPlayer(player.id);
        }
      }
    }

    broadcastRoomState();

  }, 5000);
}

/* =========================================================
   HEARTBEAT
   ========================================================= */

function startHeartbeat() {

  stopHeartbeat();

  heartbeatTimer = setInterval(() => {

    for (const conn of connections.values()) {

      sendData(conn, {
        type: "PING",
        time: Date.now()
      });
    }

  }, 3000);
}

function stopHeartbeat() {

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/* =========================================================
   VOICE
   ========================================================= */

async function requestMicrophone() {

  if (localStream) return true;

  try {

    localStream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
          sampleRate: 48000,
          sampleSize: 16,
          latency: 0
        },
        video: false
      });

    for (const track of localStream.getAudioTracks()) {
      track.enabled = false;
    }

    return true;

  } catch (error) {

    roomStatus.textContent =
      "Permita o acesso ao microfone.";

    return false;
  }
}

async function toggleMic() {

  const ok = await requestMicrophone();

  if (!ok) return;

  micEnabled = !micEnabled;

  for (const track of localStream.getAudioTracks()) {
    track.enabled = micEnabled;
  }

  updateMicButton();

  if (micEnabled) {
    startVoiceCalls();
  }
}

function updateMicButton() {

  if (micEnabled) {

    micButton.classList.remove("off");
    micButton.classList.add("active");

    micButtonText.textContent =
      "Microfone ligado";

  } else {

    micButton.classList.remove("active");
    micButton.classList.add("off");

    micButtonText.textContent =
      "Microfone desligado";
  }
}

/*
  A chamada de voz é criada somente por quem tem o
  menor peerId entre os dois jogadores.

  Isso evita duas chamadas simultâneas para o mesmo jogador.
*/

function shouldInitiateVoice(remotePeerId) {

  return String(myPeerId) < String(remotePeerId);
}

function setupVoiceForPeer(remotePeerId) {

  if (!remotePeerId) return;

  if (voiceCalls.has(remotePeerId)) return;

  if (!shouldInitiateVoice(remotePeerId)) return;

  if (!localStream) return;

  try {

    const call = peer.call(
      remotePeerId,
      localStream
    );

    voiceCalls.set(remotePeerId, call);

    setupVoiceCall(call, remotePeerId);

  } catch {}
}

function startVoiceCalls() {

  if (!peer || !localStream) return;

  for (const player of players) {

    if (player.id === myPlayerId) continue;

    setupVoiceForPeer(player.peerId);
  }
}

function handleIncomingVoiceCall(call) {

  if (!call || !call.peer) return;

  if (voiceCalls.has(call.peer)) {
    try {
      call.close();
    } catch {}

    return;
  }

  /*
    Respondemos mesmo quando o nosso mic está OFF.
    Assim continuamos recebendo a voz do outro jogador.
  */

  if (!localStream) {

    createReceiveOnlyStream().then(stream => {

      try {
        call.answer(stream);
      } catch {}
    });

  } else {

    try {
      call.answer(localStream);
    } catch {}
  }

  voiceCalls.set(call.peer, call);

  setupVoiceCall(call, call.peer);
}

async function createReceiveOnlyStream() {

  const context =
    new AudioContext();

  const destination =
    context.createMediaStreamDestination();

  return destination.stream;
}

function setupVoiceCall(call, remotePeerId) {

  call.on("stream", stream => {

    let audio =
      document.querySelector(
        `audio[data-peer="${CSS.escape(remotePeerId)}"]`
      );

    if (!audio) {

      audio =
        document.createElement("audio");

      audio.autoplay = true;
      audio.playsInline = true;

      audio.dataset.peer =
        remotePeerId;

      $("remoteAudios").appendChild(audio);
    }

    audio.srcObject = stream;

    audio.volume = 1;

    audio.play().catch(() => {});
  });

  call.on("close", () => {

    voiceCalls.delete(remotePeerId);

    const audio =
      document.querySelector(
        `audio[data-peer="${CSS.escape(remotePeerId)}"]`
      );

    if (audio) {
      audio.remove();
    }
  });

  call.on("error", () => {
    voiceCalls.delete(remotePeerId);
  });
}

/* =========================================================
   GAME VOICE
   ========================================================= */

function toggleGameVoice() {

  if (!localStream) {
    toggleMic();
    return;
  }

  micEnabled = !micEnabled;

  for (const track of localStream.getAudioTracks()) {
    track.enabled = micEnabled;
  }

  if (micEnabled) {

    gameVoiceButton.textContent =
      "Mic ON";

    gameVoiceButton.classList.add("active");

  } else {

    gameVoiceButton.textContent =
      "Mic OFF";

    gameVoiceButton.classList.remove("active");
  }
}

/* =========================================================
   START GAME
   ========================================================= */

function startGame() {

  if (!isHost) return;

  if (gameRunning) return;

  gameRunning = true;
  currentRound = 1;

  broadcast({
    type: "START_GAME",
    round: currentRound
  });

  enterGame();
}

function handleStartGame(data) {

  if (isHost) return;

  gameRunning = true;

  currentRound =
    Number(data.round) || 1;

  enterGame();
}

function enterGame() {

  showGame();

  gameRound.textContent =
    `${currentRound}/4`;

  gamePlayerCount.textContent =
    String(players.length);

  gameVoiceButton.textContent =
    "Mic OFF";

  gameVoiceButton.classList.remove("active");

  if (localStream) {

    micEnabled = false;

    for (const track of localStream.getAudioTracks()) {
      track.enabled = false;
    }
  }

  startRound();
}

/* =========================================================
   ROUND
   ========================================================= */

function startRound() {

  gameRound.textContent =
    `${currentRound}/4`;

  gameMessage.textContent =
    "Prepare-se...";

  gameCenter.classList.remove("hidden");

  recordingPanel.classList.add("hidden");
  playbackPanel.classList.add("hidden");

  let value = 3;

  countdownNumber.textContent =
    value;

  const timer =
    setInterval(() => {

      value--;

      if (value <= 0) {

        clearInterval(timer);

        gameCenter.classList.add("hidden");

        showReference();

        return;
      }

      countdownNumber.textContent =
        value;

    }, 1000);
}

/* =========================================================
   REFERENCE
   ========================================================= */

function showReference() {

  gameMessage.textContent =
    "Ouça o som de referência";

  playReferenceSound();

  setTimeout(() => {

    startRecording();

  }, 2500);
}

function playReferenceSound() {

  const context =
    new (
      window.AudioContext ||
      window.webkitAudioContext
    )();

  const now =
    context.currentTime;

  const notes = [
    440,
    660,
    520
  ];

  notes.forEach((frequency, index) => {

    const osc =
      context.createOscillator();

    const gain =
      context.createGain();

    osc.type = "sine";

    osc.frequency.value =
      frequency;

    const start =
      now + index * 0.38;

    const end =
      start + 0.26;

    gain.gain.setValueAtTime(
      0,
      start
    );

    gain.gain.linearRampToValueAtTime(
      0.25,
      start + 0.03
    );

    gain.gain.linearRampToValueAtTime(
      0,
      end
    );

    osc.connect(gain);
    gain.connect(context.destination);

    osc.start(start);
    osc.stop(end + 0.03);
  });

  setTimeout(() => {
    context.close().catch(() => {});
  }, 2200);
}

/* =========================================================
   RECORDING
   ========================================================= */

async function startRecording() {

  recordingPanel.classList.remove("hidden");

  gameMessage.textContent =
    "Sua vez";

  recordTimerElement.textContent =
    "7";

  recordProgress.style.transform =
    "scaleX(1)";

  const ok =
    await requestMicrophone();

  if (!ok) {

    finishRecordingWithoutAudio();

    return;
  }

  /*
    Durante a gravação o microfone fica ON.
  */

  micEnabled = true;

  for (const track of localStream.getAudioTracks()) {
    track.enabled = true;
  }

  recordedChunks = [];

  try {

    mediaRecorder =
      new MediaRecorder(
        localStream,
        {
          mimeType:
            getSupportedMimeType()
        }
      );

  } catch {

    mediaRecorder =
      new MediaRecorder(localStream);
  }

  mediaRecorder.ondataavailable =
    event => {

      if (
        event.data &&
        event.data.size > 0
      ) {
        recordedChunks.push(
          event.data
        );
      }
    };

  mediaRecorder.onstop =
    () => {

      const blob =
        new Blob(
          recordedChunks,
          {
            type:
              mediaRecorder.mimeType ||
              "audio/webm"
          }
        );

      handleOwnRecording(blob);
    };

  mediaRecorder.start(100);

  let seconds = 7;

  recordTimerElement.textContent =
    seconds;

  const started =
    performance.now();

  clearInterval(recordTimer);

  recordTimer =
    setInterval(() => {

      const elapsed =
        performance.now() - started;

      const progress =
        Math.min(
          elapsed / 7000,
          1
        );

      recordProgress.style.transform =
        `scaleX(${1 - progress})`;

      seconds =
        Math.max(
          0,
          7 - Math.floor(elapsed / 1000)
        );

      recordTimerElement.textContent =
        seconds;

      if (elapsed >= 7000) {

        clearInterval(recordTimer);

        stopRecording();
      }

    }, 50);
}

function getSupportedMimeType() {

  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4"
  ];

  for (const type of types) {

    if (
      MediaRecorder.isTypeSupported &&
      MediaRecorder.isTypeSupported(type)
    ) {
      return type;
    }
  }

  return "";
}

function stopRecording() {

  if (
    mediaRecorder &&
    mediaRecorder.state !== "inactive"
  ) {
    mediaRecorder.stop();
  }
}

function finishRecordingWithoutAudio() {

  const blob =
    new Blob(
      [],
      {
        type: "audio/webm"
      }
    );

  handleOwnRecording(blob);
}

/* =========================================================
   OWN RECORDING
   ========================================================= */

function handleOwnRecording(blob) {

  /*
    A V1 mantém a gravação local por enquanto.
    A próxima camada do sistema pode enviar esse Blob
    para o host via DataConnection.
  */

  if (localStream) {

    micEnabled = false;

    for (const track of localStream.getAudioTracks()) {
      track.enabled = false;
    }
  }

  recordingPanel.classList.add("hidden");

  playLocalTake(blob);
}

function playLocalTake(blob) {

  playbackPanel.classList.remove("hidden");

  playbackName.textContent =
    username;

  playbackStatus.textContent =
    "Reproduzindo sua gravação...";

  playbackScore.textContent =
    "—";

  if (!blob || blob.size === 0) {

    playbackStatus.textContent =
      "Nenhuma gravação recebida.";

    playbackScore.textContent =
      "0";

    finishRound();

    return;
  }

  const url =
    URL.createObjectURL(blob);

  const audio =
    new Audio();

  audio.src = url;

  audio.volume = 1;

  audio.onended = () => {

    URL.revokeObjectURL(url);

    /*
      Pontuação provisória da V1.
      O sistema de análise de áudio entra na próxima etapa.
    */

    const score =
      Math.max(
        1,
        Math.min(
          100,
          Math.floor(
            45 +
            Math.random() * 45
          )
        )
      );

    playbackScore.textContent =
      String(score);

    playbackStatus.textContent =
      "Resultado";

    setTimeout(() => {
      finishRound();
    }, 1600);
  };

  audio.onerror = () => {

    URL.revokeObjectURL(url);

    playbackScore.textContent =
      "0";

    playbackStatus.textContent =
      "Erro ao reproduzir.";

    setTimeout(() => {
      finishRound();
    }, 1200);
  };

  audio.play().catch(() => {

    playbackStatus.textContent =
      "Toque na tela para liberar o áudio.";

    playbackPanel.onclick = () => {
      audio.play().catch(() => {});
    };
  });
}

/* =========================================================
   ROUND END
   ========================================================= */

function finishRound() {

  playbackPanel.classList.add("hidden");

  if (currentRound >= 4) {

    finishGame();

    return;
  }

  currentRound++;

  setTimeout(() => {

    startRound();

  }, 900);
}

function finishGame() {

  gameMessage.textContent =
    "Partida finalizada";

  playbackPanel.classList.remove("hidden");

  playbackName.textContent =
    "Shadow Games";

  playbackStatus.textContent =
    "A V1 da partida terminou.";

  playbackScore.textContent =
    "GG";

  setTimeout(() => {

    gameRunning = false;

    playbackPanel.classList.add("hidden");

    showRoom();

  }, 3000);
}

/* =========================================================
   WORLD / THREE.JS
   ========================================================= */

let scene;
let renderer;
let camera;

let clock;

const worldPlayers = new Map();

const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false
};

function init3D() {

  scene =
    new THREE.Scene();

  scene.background =
    new THREE.Color(0x050509);

  scene.fog =
    new THREE.Fog(
      0x050509,
      18,
      55
    );

  camera =
    new THREE.PerspectiveCamera(
      62,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );

  camera.position.set(
    0,
    4,
    7
  );

  renderer =
    new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance"
    });

  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      1.5
    )
  );

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  renderer.shadowMap.enabled = false;

  $("gameCanvas").appendChild(
    renderer.domElement
  );

  clock =
    new THREE.Clock();

  createLights();
  createEnvironment();
  createLocalCharacter();

  window.addEventListener(
    "resize",
    resize3D
  );

  setupCameraControls();

  animate3D();
}

function createLights() {

  const ambient =
    new THREE.HemisphereLight(
      0xb8a8ff,
      0x080810,
      2.1
    );

  scene.add(ambient);

  const light =
    new THREE.DirectionalLight(
      0xffffff,
      1.5
    );

  light.position.set(
    4,
    10,
    4
  );

  scene.add(light);

  const purple =
    new THREE.PointLight(
      0x783cff,
      18,
      25
    );

  purple.position.set(
    -6,
    4,
    -5
  );

  scene.add(purple);

  const purple2 =
    new THREE.PointLight(
      0xa05cff,
      12,
      20
    );

  purple2.position.set(
    8,
    3,
    6
  );

  scene.add(purple2);
}

function createEnvironment() {

  const floorGeometry =
    new THREE.PlaneGeometry(
      80,
      80
    );

  const floorMaterial =
    new THREE.MeshStandardMaterial({
      color: 0x0d0d14,
      roughness: 0.88,
      metalness: 0.08
    });

  const floor =
    new THREE.Mesh(
      floorGeometry,
      floorMaterial
    );

  floor.rotation.x =
    -Math.PI / 2;

  scene.add(floor);

  const grid =
    new THREE.GridHelper(
      80,
      40,
      0x332052,
      0x17131e
    );

  grid.position.y =
    0.01;

  scene.add(grid);

  createBuilding(
    0,
    2,
    -12,
    26,
    5,
    0.7
  );

  createBuilding(
    -13,
    2,
    0,
    0.7,
    5,
    26
  );

  createBuilding(
    13,
    2,
    0,
    0.7,
    5,
    26
  );

  createPlatform(
    0,
    0.2,
    0,
    8,
    0.4,
    8
  );

  createNeonBlock(
    -5,
    1,
    -4
  );

  createNeonBlock(
    5,
    1,
    -4
  );

  createNeonBlock(
    0,
    1,
    -8
  );
}

function createBuilding(
  x,
  y,
  z,
  sx,
  sy,
  sz
) {

  const geometry =
    new THREE.BoxGeometry(
      sx,
      sy,
      sz
    );

  const material =
    new THREE.MeshStandardMaterial({
      color: 0x11111a,
      roughness: 0.7
    });

  const mesh =
    new THREE.Mesh(
      geometry,
      material
    );

  mesh.position.set(
    x,
    y,
    z
  );

  scene.add(mesh);
}

function createPlatform(
  x,
  y,
  z,
  sx,
  sy,
  sz
) {

  const geometry =
    new THREE.BoxGeometry(
      sx,
      sy,
      sz
    );

  const material =
    new THREE.MeshStandardMaterial({
      color: 0x17131f,
      roughness: 0.6,
      metalness: 0.2
    });

  const mesh =
    new THREE.Mesh(
      geometry,
      material
    );

  mesh.position.set(
    x,
    y,
    z
  );

  scene.add(mesh);

  const ring =
    new THREE.Mesh(
      new THREE.RingGeometry(
        3.1,
        3.25,
        48
      ),
      new THREE.MeshBasicMaterial({
        color: 0x8145ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65
      })
    );

  ring.rotation.x =
    -Math.PI / 2;

  ring.position.set(
    x,
    y + 0.21,
    z
  );

  scene.add(ring);
}

function createNeonBlock(
  x,
  y,
  z
) {

  const geometry =
    new THREE.BoxGeometry(
      1.2,
      2,
      1.2
    );

  const material =
    new THREE.MeshStandardMaterial({
      color: 0x3a2164,
      emissive: 0x6e35bb,
      emissiveIntensity: 1.4
    });

  const mesh =
    new THREE.Mesh(
      geometry,
      material
    );

  mesh.position.set(
    x,
    y,
    z
  );

  scene.add(mesh);
}

/* =========================================================
   CHARACTERS
   ========================================================= */

function createCharacter(player) {

  const group =
    new THREE.Group();

  const bodyMaterial =
    new THREE.MeshStandardMaterial({
      color:
        player.id === myPlayerId
          ? 0x8b4cff
          : 0x555565,
      roughness: 0.55
    });

  const skinMaterial =
    new THREE.MeshStandardMaterial({
      color: 0xf0b28b,
      roughness: 0.7
    });

  const body =
    new THREE.Mesh(
      new THREE.CapsuleGeometry(
        0.38,
        0.9,
        4,
        8
      ),
      bodyMaterial
    );

  body.position.y =
    0.9;

  group.add(body);

  const head =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.34,
        12,
        10
      ),
      skinMaterial
    );

  head.position.y =
    1.85;

  group.add(head);

  const nameCanvas =
    document.createElement("canvas");

  nameCanvas.width =
    512;

  nameCanvas.height =
    128;

  const ctx =
    nameCanvas.getContext("2d");

  ctx.clearRect(
    0,
    0,
    512,
    128
  );

  ctx.fillStyle =
    "rgba(5,5,10,0.82)";

  roundRect(
    ctx,
    35,
    28,
    442,
    70,
    22
  );

  ctx.fill();

  ctx.fillStyle =
    "#ffffff";

  ctx.font =
    "bold 42px Arial";

  ctx.textAlign =
    "center";

  ctx.textBaseline =
    "middle";

  ctx.fillText(
    cleanName(player.name),
    256,
    63
  );

  const texture =
    new THREE.CanvasTexture(
      nameCanvas
    );

  texture.needsUpdate =
    true;

  const labelMaterial =
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true
    });

  const label =
    new THREE.Sprite(
      labelMaterial
    );

  label.scale.set(
    2.5,
    0.63,
    1
  );

  label.position.y =
    2.45;

  group.add(label);

  group.position.set(
    player.x || 0,
    player.y || 0,
    player.z || 0
  );

  scene.add(group);

  return group;
}

function roundRect(
  ctx,
  x,
  y,
  width,
  height,
  radius
) {

  ctx.beginPath();

  ctx.moveTo(
    x + radius,
    y
  );

  ctx.lineTo(
    x + width - radius,
    y
  );

  ctx.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + radius
  );

  ctx.lineTo(
    x + width,
    y + height - radius
  );

  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x + width - radius,
    y + height
  );

  ctx.lineTo(
    x + radius,
    y + height
  );

  ctx.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - radius
  );

  ctx.lineTo(
    x,
    y + radius
  );

  ctx.quadraticCurveTo(
    x,
    y,
    x + radius,
    y
  );

  ctx.closePath();
}

/* =========================================================
   LOCAL PLAYER
   ========================================================= */

function createLocalCharacter() {

  const player = {
    id: myPlayerId,
    name: username,
    x: 0,
    y: 0,
    z: 2
  };

  myCharacter =
    createCharacter(player);

  cameraTarget =
    new THREE.Vector3(
      0,
      1.2,
      2
    );

  players.forEach(p => {

    if (
      p.id === myPlayerId
    ) {
      p.x = 0;
      p.y = 0;
      p.z = 2;
    }
  });
}

function rebuildWorldPlayers() {

  if (!scene) return;

  for (const [id, object] of worldPlayers) {

    const exists =
      players.some(
        p => p.id === id
      );

    if (!exists) {

      scene.remove(object);

      worldPlayers.delete(id);
    }
  }

  for (const player of players) {

    if (player.id === myPlayerId) {

      if (myCharacter) {

        myCharacter.position.set(
          player.x || 0,
          player.y || 0,
          player.z || 2
        );
      }

      continue;
    }

    if (!worldPlayers.has(player.id)) {

      const character =
        createCharacter(player);

      worldPlayers.set(
        player.id,
        character
      );
    } else {

      const character =
        worldPlayers.get(player.id);

      character.position.set(
        player.x,
        player.y,
        player.z
      );
    }
  }
}

function updateRemoteCharacter(
  id,
  x,
  y,
  z
) {

  const character =
    worldPlayers.get(id);

  if (!character) return;

  character.position.lerp(
    new THREE.Vector3(
      x,
      y,
      z
    ),
    0.25
  );
}

function removeWorldPlayer(id) {

  const character =
    worldPlayers.get(id);

  if (!character) return;

  scene.remove(character);

  worldPlayers.delete(id);
}

/* =========================================================
   MOVEMENT
   ========================================================= */

function updateMovement(delta) {

  if (!myCharacter) return;

  const speed =
    4.2;

  let forward =
    joystickY;

  let side =
    joystickX;

  if (keys.forward) forward += 1;
  if (keys.backward) forward -= 1;
  if (keys.right) side += 1;
  if (keys.left) side -= 1;

  const length =
    Math.sqrt(
      forward * forward +
      side * side
    );

  if (length > 1) {

    forward /= length;
    side /= length;
  }

  if (
    Math.abs(forward) < 0.01 &&
    Math.abs(side) < 0.01
  ) {
    return;
  }

  const moveX =
    Math.cos(cameraYaw) * side +
    Math.sin(cameraYaw) * forward;

  const moveZ =
    Math.cos(cameraYaw) * forward -
    Math.sin(cameraYaw) * side;

  myCharacter.position.x +=
    moveX * speed * delta;

  myCharacter.position.z +=
    moveZ * speed * delta;

  myCharacter.position.x =
    THREE.MathUtils.clamp(
      myCharacter.position.x,
      -11,
      11
    );

  myCharacter.position.z =
    THREE.MathUtils.clamp(
      myCharacter.position.z,
      -10,
      10
    );

  myCharacter.rotation.y =
    Math.atan2(
      moveX,
      moveZ
    );

  sendPositionThrottled();
}

let lastPositionSend = 0;

function sendPositionThrottled() {

  const now =
    performance.now();

  if (
    now - lastPositionSend <
    70
  ) {
    return;
  }

  lastPositionSend =
    now;

  sendMyPosition();
}

/* =========================================================
   CAMERA
   ========================================================= */

function updateCamera() {

  if (!myCharacter) return;

  const distance =
    6.2;

  const height =
    3.1;

  const target =
    myCharacter.position.clone();

  target.y += 1.1;

  cameraTarget.lerp(
    target,
    0.12
  );

  const horizontal =
    Math.cos(cameraPitch) *
    distance;

  const cameraX =
    myCharacter.position.x -
    Math.sin(cameraYaw) *
    horizontal;

  const cameraZ =
    myCharacter.position.z -
    Math.cos(cameraYaw) *
    horizontal;

  const desired =
    new THREE.Vector3(
      cameraX,
      myCharacter.position.y +
        height +
        Math.sin(cameraPitch) * distance,
      cameraZ
    );

  camera.position.lerp(
    desired,
    0.12
  );

  camera.lookAt(
    cameraTarget
  );
}

/* =========================================================
   CAMERA TOUCH
   ========================================================= */

let looking = false;
let lookPointerId = null;
let lastLookX = 0;
let lastLookY = 0;

function setupCameraControls() {

  renderer.domElement.addEventListener(
    "pointerdown",
    event => {

      if (
        joystick.contains(event.target)
      ) {
        return;
      }

      looking = true;
      lookPointerId =
        event.pointerId;

      lastLookX =
        event.clientX;

      lastLookY =
        event.clientY;
    }
  );

  renderer.domElement.addEventListener(
    "pointermove",
    event => {

      if (
        !looking ||
        event.pointerId !==
        lookPointerId
      ) {
        return;
      }

      const dx =
        event.clientX -
        lastLookX;

      const dy =
        event.clientY -
        lastLookY;

      lastLookX =
        event.clientX;

      lastLookY =
        event.clientY;

      cameraYaw -=
        dx * 0.006;

      cameraPitch -=
        dy * 0.004;

      cameraPitch =
        THREE.MathUtils.clamp(
          cameraPitch,
          -0.05,
          0.9
        );
    }
  );

  const stopLook = event => {

    if (
      event.pointerId ===
      lookPointerId
    ) {
      looking = false;
      lookPointerId = null;
    }
  };

  renderer.domElement.addEventListener(
    "pointerup",
    stopLook
  );

  renderer.domElement.addEventListener(
    "pointercancel",
    stopLook
  );
}

/* =========================================================
   JOYSTICK
   ========================================================= */

function setupJoystick() {

  joystick.addEventListener(
    "pointerdown",
    event => {

      event.preventDefault();

      joystickActive = true;
      joystickPointerId =
        event.pointerId;

      joystick.setPointerCapture(
        event.pointerId
      );

      updateJoystick(
        event.clientX,
        event.clientY
      );
    }
  );

  joystick.addEventListener(
    "pointermove",
    event => {

      if (
        !joystickActive ||
        event.pointerId !==
        joystickPointerId
      ) {
        return;
      }

      updateJoystick(
        event.clientX,
        event.clientY
      );
    }
  );

  const reset = event => {

    if (
      event.pointerId !==
      joystickPointerId
    ) {
      return;
    }

    joystickActive = false;

    joystickX = 0;
    joystickY = 0;

    joystickKnob.style.transform =
      "translate(0px, 0px)";
  };

  joystick.addEventListener(
    "pointerup",
    reset
  );

  joystick.addEventListener(
    "pointercancel",
    reset
  );
}

function updateJoystick(
  clientX,
  clientY
) {

  const rect =
    joystick.getBoundingClientRect();

  const centerX =
    rect.left +
    rect.width / 2;

  const centerY =
    rect.top +
    rect.height / 2;

  let dx =
    clientX -
    centerX;

  let dy =
    clientY -
    centerY;

  const max =
    rect.width * 0.31;

  const distance =
    Math.sqrt(
      dx * dx +
      dy * dy
    );

  if (distance > max) {

    dx =
      dx / distance * max;

    dy =
      dy / distance * max;
  }

  joystickX =
    dx / max;

  joystickY =
    -dy / max;

  joystickKnob.style.transform =
    `translate(${dx}px, ${dy}px)`;
}

/* =========================================================
   KEYBOARD
   ========================================================= */

function setupKeyboard() {

  window.addEventListener(
    "keydown",
    event => {

      switch (
        event.key.toLowerCase()
      ) {

        case "w":
        case "arrowup":
          keys.forward = true;
          break;

        case "s":
        case "arrowdown":
          keys.backward = true;
          break;

        case "a":
        case "arrowleft":
          keys.left = true;
          break;

        case "d":
        case "arrowright":
          keys.right = true;
          break;
      }
    }
  );

  window.addEventListener(
    "keyup",
    event => {

      switch (
        event.key.toLowerCase()
      ) {

        case "w":
        case "arrowup":
          keys.forward = false;
          break;

        case "s":
        case "arrowdown":
          keys.backward = false;
          break;

        case "a":
        case "arrowleft":
          keys.left = false;
          break;

        case "d":
        case "arrowright":
          keys.right = false;
          break;
      }
    }
  );
}

/* =========================================================
   ANIMATION
   ========================================================= */

function animate3D() {

  requestAnimationFrame(
    animate3D
  );

  const now =
    performance.now();

  const delta =
    Math.min(
      (now - lastFrameTime) / 1000,
      0.05
    );

  lastFrameTime =
    now;

  updateMovement(delta);

  updateCamera();

  for (const character of worldPlayers.values()) {

    character.children.forEach(
      child => {

        if (
          child.isSprite &&
          camera
        ) {
          child.quaternion.copy(
            camera.quaternion
          );
        }
      }
    );
  }

  renderer.render(
    scene,
    camera
  );
}

/* =========================================================
   RESIZE
   ========================================================= */

function resize3D() {

  if (!camera || !renderer) return;

  camera.aspect =
    window.innerWidth /
    window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );
}

/* =========================================================
   UTILS
   ========================================================= */

function cleanName(value) {

  return String(value || "Player")
    .replace(
      /[\u0000-\u001F\u007F]/g,
      ""
    )
    .trim()
    .slice(0, 16) ||
    "Player";
}

function randomSpawnX() {

  return (
    Math.random() * 8
  ) - 4;
}

function randomSpawnZ() {

  return (
    Math.random() * 5
  ) - 1;
}

/* =========================================================
   COPY
   ========================================================= */

async function copyRoomCode() {

  try {

    await navigator.clipboard.writeText(
      roomCode
    );

    copyCodeButton.textContent =
      "Copiado";

    setTimeout(() => {

      copyCodeButton.textContent =
        "Copiar";

    }, 1300);

  } catch {

    roomStatus.textContent =
      "Código: " + roomCode;
  }
}

/* =========================================================
   DISCONNECT
   ========================================================= */

function disconnectEverything() {

  stopHeartbeat();

  if (hostCleanupTimer) {
    clearInterval(hostCleanupTimer);
    hostCleanupTimer = null;
  }

  for (const call of voiceCalls.values()) {

    try {
      call.close();
    } catch {}
  }

  voiceCalls.clear();

  for (const conn of connections.values()) {

    try {
      conn.close();
    } catch {}
  }

  connections.clear();

  if (localStream) {

    for (const track of localStream.getTracks()) {
      track.stop();
    }

    localStream = null;
  }

  micEnabled = false;

  if (peer) {

    try {
      peer.destroy();
    } catch {}
  }

  peer = null;

  players = [];

  roomCode = "";

  isHost = false;

  gameRunning = false;

  worldPlayers.forEach(
    object => scene?.remove(object)
  );

  worldPlayers.clear();
}

/* =========================================================
   LEAVE ROOM
   ========================================================= */

function leaveRoom() {

  if (isHost) {

    broadcast({
      type: "ROOM_CLOSED"
    });
  }

  disconnectEverything();

  joinCodeInput.value = "";

  roomStatus.textContent = "";

  showHome();
}

/* =========================================================
   EVENTS
   ========================================================= */

loginButton.addEventListener(
  "click",
  login
);

usernameInput.addEventListener(
  "keydown",
  event => {

    if (event.key === "Enter") {
      login();
    }
  }
);

createRoomButton.addEventListener(
  "click",
  createRoom
);

showJoinButton.addEventListener(
  "click",
  showJoin
);

cancelJoinButton.addEventListener(
  "click",
  cancelJoin
);

joinRoomButton.addEventListener(
  "click",
  joinRoom
);

joinCodeInput.addEventListener(
  "keydown",
  event => {

    if (event.key === "Enter") {
      joinRoom();
    }
  }
);

logoutButton.addEventListener(
  "click",
  logout
);

leaveRoomButton.addEventListener(
  "click",
  leaveRoom
);

copyCodeButton.addEventListener(
  "click",
  copyRoomCode
);

micButton.addEventListener(
  "click",
  toggleMic
);

gameVoiceButton.addEventListener(
  "click",
  toggleGameVoice
);

startGameButton.addEventListener(
  "click",
  startGame
);

/* =========================================================
   START
   ========================================================= */

loadSavedUser();

init3D();

setupJoystick();

setupKeyboard();

showHome();

if (localStorage.getItem("shadow_username")) {

  const saved =
    localStorage.getItem(
      "shadow_username"
    );

  username =
    cleanName(saved);

  usernameInput.value =
    username;
}
