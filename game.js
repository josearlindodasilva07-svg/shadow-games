"use strict";

/* =========================================================
   SHADOW GAMES
   Multiplayer + PeerJS + Voice + Room Presence
   ========================================================= */

const $ = id => document.getElementById(id);


/* =========================================================
   ELEMENTOS
========================================================= */

const loginScreen = $("loginScreen");
const homeScreen = $("homeScreen");
const joinScreen = $("joinScreen");
const roomScreen = $("roomScreen");
const gameScreen = $("gameScreen");

const usernameInput = $("username");
const loginButton = $("loginButton");
const loginError = $("loginError");

const profileName = $("profileName");
const profileAvatar = $("profileAvatar");

const createRoomButton = $("createRoomButton");
const joinRoomButton = $("joinRoomButton");
const logoutButton = $("logoutButton");

const joinBackButton = $("joinBackButton");
const roomCodeInput = $("roomCodeInput");
const confirmJoinButton = $("confirmJoinButton");
const joinError = $("joinError");

const roomCodeDisplay = $("roomCodeDisplay");
const copyRoomCodeButton = $("copyRoomCodeButton");

const playerCount = $("playerCount");
const playersList = $("playersList");

const roomMicButton = $("roomMicButton");
const roomVoiceStatus = $("roomVoiceStatus");

const roomHostControls = $("roomHostControls");
const startGameButton = $("startGameButton");
const roomWaiting = $("roomWaiting");
const roomStatus = $("roomStatus");

const leaveRoomButton = $("leaveRoomButton");

const gameRoundText = $("gameRoundText");
const gamePlayerCount = $("gamePlayerCount");
const gameVoiceButton = $("gameVoiceButton");
const gameProgressBar = $("gameProgressBar");

const countdownPanel = $("countdownPanel");
const countdownNumber = $("countdownNumber");

const referencePanel = $("referencePanel");
const referenceButton = $("referenceButton");

const recordPanel = $("recordPanel");
const recordTimerElement = $("recordTimer");
const recordStatus = $("recordStatus");

const playbackPanel = $("playbackPanel");
const playbackPlayer = $("playbackPlayer");
const playbackStatus = $("playbackStatus");

const resultPanel = $("resultPanel");
const resultScore = $("resultScore");
const resultDescription = $("resultDescription");
const resultPlayers = $("resultPlayers");

const finalPanel = $("finalPanel");
const finalPlayers = $("finalPlayers");
const backHomeButton = $("backHomeButton");

const remoteAudios = $("remoteAudios");


/* =========================================================
   CONFIG
========================================================= */

const MAX_PLAYERS = 5;
const TOTAL_ROUNDS = 4;
const RECORD_SECONDS = 5;
const HEARTBEAT_MS = 2500;
const PLAYER_TIMEOUT_MS = 8000;

const PEER_PREFIX = "shadow-games-";


/* =========================================================
   ESTADO
========================================================= */

let username = "";
let myPeerId = "";

let isHost = false;
let roomCode = "";
let roomPeerId = "";

let peer = null;

let roomConnections = new Map();
let players = new Map();

let microphoneStream = null;
let microphoneEnabled = false;

let gameVoiceEnabled = false;

let gameStarted = false;
let currentRound = 0;
let currentPhase = "idle";

let referenceFrequency = 440;

let mediaRecorder = null;
let recordedChunks = [];
let ownRecording = null;

let recordTimerHandle = null;
let heartbeatHandle = null;
let presenceCleanupHandle = null;

let destroyed = false;

let gameScores = new Map();

let receivedRecordings = new Map();

let playbackQueue = [];
let playbackIndex = 0;

let currentRoundResults = [];

let lastHostMessage = 0;


/* =========================================================
   UTIL
========================================================= */

function randomCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let output = "";

  for (let i = 0; i < length; i++) {
    output += chars[Math.floor(Math.random() * chars.length)];
  }

  return output;
}

function randomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function safeName(value) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 16);
}

function initial(name) {
  return String(name || "?").charAt(0).toUpperCase();
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setStatus(text) {
  if (roomStatus) {
    roomStatus.textContent = text || "";
  }
}


/* =========================================================
   TELAS
========================================================= */

function showScreen(screen) {
  [
    loginScreen,
    homeScreen,
    joinScreen,
    roomScreen,
    gameScreen
  ].forEach(element => {
    element.classList.add("hidden");
  });

  screen.classList.remove("hidden");
}

function showLogin() {
  showScreen(loginScreen);
}

function showHome() {
  showScreen(homeScreen);

  profileName.textContent = username;
  profileAvatar.textContent = initial(username);
}

function showJoin() {
  showScreen(joinScreen);

  roomCodeInput.value = "";
  joinError.textContent = "";

  setTimeout(() => roomCodeInput.focus(), 100);
}

function showRoom() {
  showScreen(roomScreen);

  roomCodeDisplay.textContent = roomCode;
  renderPlayers();
  updateRoomButtons();
}

function showGame() {
  showScreen(gameScreen);

  gameVoiceEnabled = false;
  updateGameVoiceButton();

  gameStarted = true;
}


/* =========================================================
   LOGIN
========================================================= */

function login() {
  const name = safeName(usernameInput.value);

  if (!name) {
    loginError.textContent = "Digite um nome.";
    return;
  }

  if (name.length < 2) {
    loginError.textContent = "Use pelo menos 2 caracteres.";
    return;
  }

  loginError.textContent = "";

  username = name;

  localStorage.setItem("shadow_games_username", username);

  showHome();
}

function logout() {
  leaveRoom(true);

  username = "";

  localStorage.removeItem("shadow_games_username");

  showLogin();
}


/* =========================================================
   PEER
========================================================= */

function createPeer(id, onReady) {
  destroyed = false;

  try {
    peer = new Peer(id, {
      debug: 0
    });
  } catch (error) {
    setStatus("Erro ao iniciar conexão.");
    return;
  }

  peer.on("open", peerId => {
    myPeerId = peerId;

    if (onReady) {
      onReady(peerId);
    }
  });

  peer.on("connection", connection => {
    setupDataConnection(connection);
  });

  peer.on("call", call => {
    handleIncomingCall(call);
  });

  peer.on("disconnected", () => {
    if (destroyed) return;

    try {
      peer.reconnect();
    } catch {}
  });

  peer.on("error", error => {
    console.warn("PeerJS:", error);

    if (error && error.type === "unavailable-id") {
      setStatus("Essa sala já está sendo usada.");
    }
  });
}


/* =========================================================
   ROOM CODE / HOST
========================================================= */

function hostPeerId(code) {
  return PEER_PREFIX + "room-" + code;
}

function playerPeerId() {
  return PEER_PREFIX + "player-" + randomId();
}


/* =========================================================
   CRIAR SALA
========================================================= */

function createRoom() {
  if (!username) return;

  cleanupPeer();

  isHost = true;

  roomCode = randomCode();
  roomPeerId = hostPeerId(roomCode);

  players.clear();

  players.set("self", {
    id: "self",
    peerId: roomPeerId,
    name: username,
    host: true,
    mic: false,
    lastSeen: Date.now()
  });

  createPeer(roomPeerId, () => {
    startPresence();

    showRoom();

    roomHostControls.classList.remove("hidden");
    roomWaiting.classList.add("hidden");

    setStatus("Sala criada. Envie o código para seus amigos.");

    renderPlayers();
  });
}


/* =========================================================
   ENTRAR NA SALA
========================================================= */

function joinRoom() {
  const code = String(roomCodeInput.value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);

  if (code.length !== 6) {
    joinError.textContent = "Digite o código de 6 caracteres.";
    return;
  }

  joinError.textContent = "";

  cleanupPeer();

  isHost = false;

  roomCode = code;
  roomPeerId = hostPeerId(roomCode);

  const myId = playerPeerId();

  createPeer(myId, () => {

    const connection = peer.connect(roomPeerId, {
      reliable: true,
      serialization: "json"
    });

    setupDataConnection(connection, () => {

      sendToConnection(connection, {
        type: "hello",
        playerId: myPeerId,
        name: username,
        host: false,
        mic: false
      });

      startPresence();

      showRoom();

      roomHostControls.classList.add("hidden");
      roomWaiting.classList.remove("hidden");

      setStatus("Conectando à sala...");
    });
  });
}


/* =========================================================
   DATA CONNECTION
========================================================= */

function setupDataConnection(connection, onOpen) {
  if (!connection) return;

  const id = connection.peer;

  connection.on("open", () => {

    roomConnections.set(id, connection);

    if (onOpen) {
      onOpen();
    }

    if (isHost) {
      sendRoomState(connection);
    }
  });

  connection.on("data", data => {
    handleData(connection, data);
  });

  connection.on("close", () => {
    roomConnections.delete(id);

    if (isHost) {
      removePlayerByPeer(id);
      broadcastRoomState();
    } else {
      if (id === roomPeerId) {
        setStatus("O dono da sala saiu.");
        setTimeout(() => {
          leaveRoom();
        }, 1200);
      }
    }
  });

  connection.on("error", () => {
    roomConnections.delete(id);

    if (isHost) {
      removePlayerByPeer(id);
      broadcastRoomState();
    }
  });
}

function sendToConnection(connection, message) {
  if (!connection) return;

  try {
    if (connection.open) {
      connection.send(message);
    }
  } catch {}
}

function sendToHost(message) {
  if (isHost) return;

  const connection = roomConnections.get(roomPeerId);

  if (connection) {
    sendToConnection(connection, message);
  }
}


/* =========================================================
   DATA HANDLER
========================================================= */

function handleData(connection, data) {
  if (!data || typeof data !== "object") return;

  if (data.type === "hello") {

    if (!isHost) return;

    const playerId = connection.peer;

    if (players.size >= MAX_PLAYERS) {
      sendToConnection(connection, {
        type: "roomFull"
      });

      return;
    }

    players.set(playerId, {
      id: playerId,
      peerId: playerId,
      name: safeName(data.name) || "Jogador",
      host: false,
      mic: false,
      lastSeen: Date.now()
    });

    sendToConnection(connection, {
      type: "welcome",
      roomCode,
      hostPeerId: roomPeerId
    });

    broadcastRoomState();

    return;
  }


  if (data.type === "presence") {

    if (isHost) {

      const player = players.get(connection.peer);

      if (player) {
        player.lastSeen = Date.now();
        player.mic = !!data.mic;
      }

      broadcastRoomState();
    }

    return;
  }


  if (data.type === "roomState") {

    if (!isHost) {
      applyRoomState(data.players || []);
    }

    return;
  }


  if (data.type === "startGame") {

    if (!isHost) {
      beginGameClient(data.round || 1);
    }

    return;
  }


  if (data.type === "roundPhase") {

    if (!isHost) {
      handleRoundPhase(data);
    }

    return;
  }


  if (data.type === "recording") {

    if (!isHost) {
      receiveRecording(data);
    }

    return;
  }


  if (data.type === "playback") {

    if (!isHost) {
      handlePlayback(data);
    }

    return;
  }


  if (data.type === "roundResult") {

    if (!isHost) {
      showRoundResult(data);
    }

    return;
  }


  if (data.type === "finalResult") {

    if (!isHost) {
      showFinalResult(data);
    }

    return;
  }


  if (data.type === "roomFull") {

    setStatus("A sala está cheia.");

    setTimeout(() => {
      leaveRoom();
    }, 1000);

    return;
  }
}


/* =========================================================
   HOST STATE
========================================================= */

function sendRoomState(connection) {

  const list = getPlayerList();

  sendToConnection(connection, {
    type: "roomState",
    players: list
  });
}

function broadcastRoomState() {

  const list = getPlayerList();

  roomConnections.forEach(connection => {

    sendToConnection(connection, {
      type: "roomState",
      players: list
    });

  });

  renderPlayers();
}

function getPlayerList() {

  const result = [];

  players.forEach(player => {

    result.push({
      id: player.id,
      peerId: player.peerId,
      name: player.name,
      host: !!player.host,
      mic: !!player.mic
    });

  });

  return result;
}

function applyRoomState(list) {

  players.clear();

  list.forEach(player => {

    players.set(player.id, {
      ...player,
      lastSeen: Date.now()
    });

  });

  renderPlayers();
}


/* =========================================================
   PRESENCE
========================================================= */

function startPresence() {

  stopPresence();

  heartbeatHandle = setInterval(() => {

    if (destroyed) return;

    if (isHost) {

      checkDeadPlayers();

    } else {

      sendToHost({
        type: "presence",
        mic: microphoneEnabled
      });

    }

  }, HEARTBEAT_MS);
}

function stopPresence() {

  if (heartbeatHandle) {
    clearInterval(heartbeatHandle);
    heartbeatHandle = null;
  }
}

function checkDeadPlayers() {

  if (!isHost) return;

  const now = Date.now();
  let changed = false;

  players.forEach((player, id) => {

    if (id === "self") return;

    if (now - player.lastSeen > PLAYER_TIMEOUT_MS) {

      const connection = roomConnections.get(player.peerId);

      if (connection) {
        try {
          connection.close();
        } catch {}
      }

      roomConnections.delete(player.peerId);
      players.delete(id);

      changed = true;
    }
  });

  if (changed) {
    broadcastRoomState();
  }
}

function removePlayerByPeer(peerId) {

  players.forEach((player, id) => {

    if (player.peerId === peerId) {
      players.delete(id);
    }

  });

  renderPlayers();
}


/* =========================================================
   PLAYERS UI
========================================================= */

function renderPlayers() {

  if (!playersList) return;

  const list = getPlayerList();

  playerCount.textContent = `${list.length}/${MAX_PLAYERS}`;

  if (gamePlayerCount) {
    gamePlayerCount.textContent = `${list.length}/${MAX_PLAYERS}`;
  }

  playersList.innerHTML = "";

  list.forEach(player => {

    const row = document.createElement("div");
    row.className = "player-row";

    const avatar = document.createElement("div");
    avatar.className = "player-avatar";
    avatar.textContent = initial(player.name);

    const info = document.createElement("div");
    info.className = "player-info";

    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent =
      player.name + (player.host ? "  • DONO" : "");

    const role = document.createElement("div");
    role.className = "player-role";
    role.textContent =
      player.peerId === myPeerId || player.id === "self"
        ? "Você"
        : "Jogador";

    info.appendChild(name);
    info.appendChild(role);

    const mic = document.createElement("div");
    mic.className = "player-mic" + (player.mic ? " on" : "");
    mic.textContent = player.mic ? "MIC ON" : "MIC OFF";

    row.appendChild(avatar);
    row.appendChild(info);
    row.appendChild(mic);

    playersList.appendChild(row);
  });

  if (!list.length) {
    playersList.innerHTML =
      `<div class="status-text">Nenhum jogador conectado.</div>`;
  }
}

function updateRoomButtons() {

  if (isHost) {

    roomHostControls.classList.remove("hidden");
    roomWaiting.classList.add("hidden");

  } else {

    roomHostControls.classList.add("hidden");
    roomWaiting.classList.remove("hidden");

  }
}


/* =========================================================
   COPIAR CÓDIGO
========================================================= */

async function copyRoomCode() {

  if (!roomCode) return;

  try {

    await navigator.clipboard.writeText(roomCode);

    copyRoomCodeButton.textContent = "COPIADO";

    setTimeout(() => {
      copyRoomCodeButton.textContent = "COPIAR";
    }, 1200);

  } catch {

    const input = document.createElement("input");

    input.value = roomCode;
    document.body.appendChild(input);
    input.select();

    try {
      document.execCommand("copy");
    } catch {}

    input.remove();
  }
}


/* =========================================================
   MICROFONE
========================================================= */

async function requestMicrophone() {

  if (microphoneStream) {
    return microphoneStream;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus("Seu navegador não permite usar o microfone.");
    return null;
  }

  try {

    microphoneStream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000
        },
        video: false
      });

    return microphoneStream;

  } catch (error) {

    console.warn(error);

    setStatus("Permissão do microfone recusada.");

    return null;
  }
}

async function toggleRoomMicrophone() {

  if (!microphoneEnabled) {

    const stream = await requestMicrophone();

    if (!stream) return;

    microphoneEnabled = true;

    await connectVoiceToPlayers();

  } else {

    microphoneEnabled = false;

    closeOutgoingVoice();

  }

  updateMicrophoneUI();
  sendPresence();
}

function updateMicrophoneUI() {

  if (microphoneEnabled) {

    roomMicButton.textContent = "ATIVO";
    roomMicButton.classList.add("on");
    roomMicButton.classList.remove("off");

    roomVoiceStatus.textContent = "Você está transmitindo sua voz";

  } else {

    roomMicButton.textContent = "ATIVAR";
    roomMicButton.classList.remove("on");
    roomMicButton.classList.add("off");

    roomVoiceStatus.textContent = "Microfone desligado";
  }

  updateGameVoiceButton();
}

function sendPresence() {

  if (isHost) {

    const me = players.get("self");

    if (me) {
      me.mic = microphoneEnabled;
      me.lastSeen = Date.now();
    }

    broadcastRoomState();

  } else {

    sendToHost({
      type: "presence",
      mic: microphoneEnabled
    });
  }
}


/* =========================================================
   VOZ PEER-TO-PEER
========================================================= */

async function connectVoiceToPlayers() {

  if (!peer || !microphoneStream || !microphoneEnabled) {
    return;
  }

  if (isHost) {

    for (const player of players.values()) {

      if (player.id === "self") continue;

      callPeer(player.peerId);
    }

  } else {

    callPeer(roomPeerId);
  }
}

function callPeer(peerId) {

  if (!peerId || peerId === myPeerId) {
    return;
  }

  if (!microphoneStream || !microphoneEnabled) {
    return;
  }

  try {

    const call = peer.call(peerId, microphoneStream);

    if (!call) return;

    call.on("stream", stream => {
      addRemoteAudio(peerId, stream);
    });

    call.on("close", () => {});

    call.on("error", () => {});

  } catch (error) {
    console.warn("voice call:", error);
  }
}

function handleIncomingCall(call) {

  if (!call) return;

  /*
    Mesmo com nosso microfone desligado,
    respondemos sem stream.
    Assim continuamos ouvindo quem está falando.
  */

  try {

    if (microphoneEnabled && microphoneStream) {

      call.answer(microphoneStream);

    } else {

      call.answer();

    }

  } catch {

    try {
      call.answer();
    } catch {}
  }

  call.on("stream", stream => {

    addRemoteAudio(call.peer, stream);

  });

  call.on("close", () => {});

  call.on("error", () => {});
}

function addRemoteAudio(peerId, stream) {

  if (!stream) return;

  let audio = document.getElementById("voice-" + peerId);

  if (!audio) {

    audio = document.createElement("audio");

    audio.id = "voice-" + peerId;
    audio.autoplay = true;
    audio.playsInline = true;

    remoteAudios.appendChild(audio);
  }

  audio.srcObject = stream;

  audio.muted = false;

  const playPromise = audio.play();

  if (playPromise) {
    playPromise.catch(() => {});
  }
}

function muteRemoteVoice() {

  remoteAudios
    .querySelectorAll("audio")
    .forEach(audio => {
      audio.muted = true;
    });
}

function unmuteRemoteVoice() {

  remoteAudios
    .querySelectorAll("audio")
    .forEach(audio => {
      audio.muted = false;

      const p = audio.play();

      if (p) {
        p.catch(() => {});
      }
    });
}

function closeOutgoingVoice() {

  /*
    Não destruímos PeerJS.
    Só paramos de mandar nosso áudio.
  */

  /*
    Como PeerJS não oferece uma forma universal de
    remover somente o stream de uma MediaConnection,
    encerramos nossas chamadas e elas serão recriadas
    quando o usuário ativar o microfone novamente.
  */

  if (!peer) return;

  try {

    const connections = peer.connections || {};

    Object.keys(connections).forEach(key => {

      const list = connections[key];

      if (!Array.isArray(list)) return;

      list.forEach(connection => {

        if (
          connection &&
          typeof connection.close === "function" &&
          connection.metadata &&
          connection.metadata.voice
        ) {
          try {
            connection.close();
          } catch {}
        }

      });
    });

  } catch {}

  /*
    Também paramos somente o envio local.
    O stream continua aberto porque pode ser usado
    para gravação da rodada.
  */
}

async function ensureVoiceConnections() {

  if (!microphoneEnabled) return;

  if (!microphoneStream) {

    const stream = await requestMicrophone();

    if (!stream) return;
  }

  await connectVoiceToPlayers();
}


/* =========================================================
   VOZ DURANTE O JOGO
========================================================= */

async function toggleGameVoice() {

  if (!gameVoiceEnabled) {

    if (!microphoneStream) {

      const stream = await requestMicrophone();

      if (!stream) return;
    }

    microphoneEnabled = true;
    gameVoiceEnabled = true;

    await connectVoiceToPlayers();

  } else {

    gameVoiceEnabled = false;

    microphoneEnabled = false;

    closeOutgoingVoice();
  }

  updateMicrophoneUI();
  updateGameVoiceButton();
  sendPresence();
}

function updateGameVoiceButton() {

  if (!gameVoiceButton) return;

  if (gameVoiceEnabled) {

    gameVoiceButton.textContent = "VOZ ON";
    gameVoiceButton.classList.add("on");
    gameVoiceButton.classList.remove("off");

  } else {

    gameVoiceButton.textContent = "VOZ OFF";
    gameVoiceButton.classList.remove("on");
    gameVoiceButton.classList.add("off");
  }
}


/* =========================================================
   COMEÇAR PARTIDA
========================================================= */

function startGame() {

  if (!isHost) return;

  const count = players.size;

  if (count < 1) return;

  gameStarted = true;
  currentRound = 1;

  gameScores.clear();

  players.forEach(player => {
    gameScores.set(player.id, 0);
  });

  broadcast({
    type: "startGame",
    round: 1
  });

  beginGameHost();
}

function beginGameClient(round) {

  gameStarted = true;
  currentRound = round || 1;

  gameVoiceEnabled = false;

  updateGameVoiceButton();

  showGame();

  startCountdown();
}

function beginGameHost() {

  showGame();

  gameVoiceEnabled = false;
  updateGameVoiceButton();

  startCountdown();
}

function broadcast(message) {

  roomConnections.forEach(connection => {
    sendToConnection(connection, message);
  });
}


/* =========================================================
   COUNTDOWN
========================================================= */

async function startCountdown() {

  currentPhase = "countdown";

  hideAllGamePanels();

  countdownPanel.classList.remove("hidden");

  gameRoundText.textContent =
    `RODADA ${currentRound}/${TOTAL_ROUNDS}`;

  gameProgressBar.style.width =
    `${(currentRound / TOTAL_ROUNDS) * 100}%`;

  for (let i = 3; i >= 1; i--) {

    countdownNumber.textContent = i;

    await wait(900);
  }

  countdownNumber.textContent = "GO";

  await wait(500);

  if (isHost) {

    startReferencePhase();

  }
}


/* =========================================================
   REFERÊNCIA
========================================================= */

function startReferencePhase() {

  currentPhase = "reference";

  broadcast({
    type: "roundPhase",
    phase: "reference",
    round: currentRound
  });

  showReference();

  /*
    A referência toca automaticamente.
    Não depende do jogador apertar botão.
  */

  playReferenceSound();

  setTimeout(() => {

    if (currentPhase !== "reference") return;

    startRecordingPhaseHost();

  }, 3000);
}

function showReference() {

  hideAllGamePanels();

  referencePanel.classList.remove("hidden");

  currentPhase = "reference";
}

function handleRoundPhase(data) {

  if (data.round !== currentRound) {
    currentRound = data.round;
  }

  if (data.phase === "reference") {

    showReference();

    playReferenceSound();

    setTimeout(() => {

      if (currentPhase === "reference") {
        prepareRecordingClient();
      }

    }, 3000);
  }
}


/* =========================================================
   SOM DE REFERÊNCIA
========================================================= */

function playReferenceSound() {

  /*
    Som simples de referência.
    Frequência fixa para que o sistema consiga
    comparar a gravação.
  */

  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) return;

  try {

    const context = new AudioContextClass();

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = referenceFrequency;

    gain.gain.setValueAtTime(0.0001, context.currentTime);

    gain.gain.exponentialRampToValueAtTime(
      0.35,
      context.currentTime + 0.08
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + 1.8
    );

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();

    oscillator.stop(context.currentTime + 1.9);

    oscillator.onended = () => {

      try {
        context.close();
      } catch {}

    };

  } catch {}
}

referenceButton.addEventListener("click", () => {

  if (currentPhase !== "reference") return;

  playReferenceSound();

});


/* =========================================================
   GRAVAÇÃO
========================================================= */

async function prepareRecordingClient() {

  currentPhase = "record";

  showRecordingUI();

  await startOwnRecording();
}

async function startRecordingPhaseHost() {

  currentPhase = "record";

  broadcast({
    type: "roundPhase",
    phase: "record",
    round: currentRound
  });

  showRecordingUI();

  await startOwnRecording();
}

function showRecordingUI() {

  hideAllGamePanels();

  recordPanel.classList.remove("hidden");

  currentPhase = "record";

  muteRemoteVoice();

  /*
    Voz normal da partida fica OFF durante a gravação.
  */

  gameVoiceEnabled = false;

  updateGameVoiceButton();

  recordStatus.textContent = "Faça o som agora";

  startRecordTimerUI();
}

async function startOwnRecording() {

  const stream = await requestMicrophone();

  if (!stream) {

    finishOwnRecording(null);

    return;
  }

  try {

    recordedChunks = [];

    mediaRecorder = new MediaRecorder(stream, {
      mimeType: getSupportedMimeType()
    });

    mediaRecorder.ondataavailable = event => {

      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {

      const blob = new Blob(
        recordedChunks,
        {
          type: mediaRecorder.mimeType || "audio/webm"
        }
      );

      finishOwnRecording(blob);
    };

    mediaRecorder.start(100);

    setTimeout(() => {

      stopOwnRecording();

    }, RECORD_SECONDS * 1000);

  } catch (error) {

    console.warn(error);

    finishOwnRecording(null);
  }
}

function getSupportedMimeType() {

  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4"
  ];

  for (const type of types) {

    try {

      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }

    } catch {}
  }

  return "";
}

function stopOwnRecording() {

  if (!mediaRecorder) return;

  if (mediaRecorder.state === "recording") {

    try {
      mediaRecorder.stop();
    } catch {}
  }
}

function startRecordTimerUI() {

  if (recordTimerHandle) {
    clearInterval(recordTimerHandle);
  }

  let remaining = RECORD_SECONDS;

  recordTimerElement.textContent = remaining;

  recordTimerHandle = setInterval(() => {

    remaining--;

    recordTimerElement.textContent =
      Math.max(remaining, 0);

    if (remaining <= 0) {

      clearInterval(recordTimerHandle);
      recordTimerHandle = null;
    }

  }, 1000);
}

function finishOwnRecording(blob) {

  ownRecording = blob;

  /*
    Host envia sua gravação para os convidados
    e aguarda as gravações deles.
  */

  if (isHost) {

    if (blob) {

      receivedRecordings.set("self", {
        playerId: "self",
        name: username,
        blob
      });

    } else {

      receivedRecordings.set("self", {
        playerId: "self",
        name: username,
        blob: null
      });
    }

    broadcastRecordingToGuests(blob);

    waitForAllRecordings();

  } else {

    sendRecordingToHost(blob);

    showWaitingForPlayback();
  }
}


/* =========================================================
   ENVIO DE GRAVAÇÃO
========================================================= */

async function blobToDataURL(blob) {

  if (!blob) return null;

  return new Promise(resolve => {

    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result);
    };

    reader.onerror = () => {
      resolve(null);
    };

    reader.readAsDataURL(blob);
  });
}

async function dataURLToBlob(dataURL) {

  if (!dataURL) return null;

  try {

    const response = await fetch(dataURL);

    return await response.blob();

  } catch {

    return null;
  }
}

async function broadcastRecordingToGuests(blob) {

  const dataURL = await blobToDataURL(blob);

  broadcast({
    type: "recording",
    playerId: "self",
    name: username,
    data: dataURL
  });
}

async function sendRecordingToHost(blob) {

  const dataURL = await blobToDataURL(blob);

  sendToHost({
    type: "recording",
    playerId: myPeerId,
    name: username,
    data: dataURL
  });
}

async function receiveRecording(data) {

  const blob = await dataURLToBlob(data.data);

  receivedRecordings.set(data.playerId, {
    playerId: data.playerId,
    name: data.name,
    blob
  });

  if (isHost) {
    waitForAllRecordings();
  }
}


/* =========================================================
   AGUARDAR TODAS AS GRAVAÇÕES
========================================================= */

function expectedPlayerCount() {

  return players.size;
}

function waitForAllRecordings() {

  if (!isHost) return;

  const expected = expectedPlayerCount();

  if (receivedRecordings.size < expected) {

    setTimeout(() => {
      waitForAllRecordings();
    }, 250);

    return;
  }

  startPlaybackPhase();
}


/* =========================================================
   PLAYBACK
========================================================= */

function startPlaybackPhase() {

  if (!isHost) return;

  currentPhase = "playback";

  playbackQueue = [];

  players.forEach(player => {

    const recording = receivedRecordings.get(player.id);

    if (!recording) {

      playbackQueue.push({
        playerId: player.id,
        name: player.name,
        blob: null
      });

    } else {

      playbackQueue.push(recording);
    }

  });

  playbackIndex = 0;

  playNextRecording();
}

async function playNextRecording() {

  if (playbackIndex >= playbackQueue.length) {

    finishPlaybackPhase();

    return;
  }

  const item = playbackQueue[playbackIndex];

  broadcast({
    type: "playback",
    index: playbackIndex,
    total: playbackQueue.length,
    playerId: item.playerId,
    name: item.name,
    data: await blobToDataURL(item.blob)
  });

  showPlayback(item.name);

  if (item.blob) {

    await playBlob(item.blob);

  } else {

    await wait(1200);
  }

  playbackIndex++;

  await wait(500);

  playNextRecording();
}

async function handlePlayback(data) {

  const blob = await dataURLToBlob(data.data);

  showPlayback(data.name);

  if (blob) {
    await playBlob(blob);
  } else {
    await wait(1200);
  }
}

function showPlayback(name) {

  hideAllGamePanels();

  playbackPanel.classList.remove("hidden");

  playbackPlayer.textContent = name || "Jogador";
  playbackStatus.textContent = "Ouvindo...";

  muteRemoteVoice();
}

function showWaitingForPlayback() {

  hideAllGamePanels();

  playbackPanel.classList.remove("hidden");

  playbackPlayer.textContent = "Aguardando...";
  playbackStatus.textContent =
    "As gravações estão sendo preparadas";

  muteRemoteVoice();
}

function playBlob(blob) {

  return new Promise(resolve => {

    if (!blob) {
      resolve();
      return;
    }

    const url = URL.createObjectURL(blob);

    const audio = new Audio();

    audio.src = url;
    audio.preload = "auto";

    audio.onended = () => {

      URL.revokeObjectURL(url);

      resolve();
    };

    audio.onerror = () => {

      URL.revokeObjectURL(url);

      resolve();
    };

    const promise = audio.play();

    if (promise) {

      promise.catch(() => {

        /*
          Em alguns celulares o navegador exige
          interação. Mesmo assim liberamos a rodada.
        */

        setTimeout(() => {

          URL.revokeObjectURL(url);
          resolve();

        }, 1200);
      });
    }

  });
}

function finishPlaybackPhase() {

  unmuteRemoteVoice();

  if (isHost) {

    calculateRoundResults();

  }
}


/* =========================================================
   SCORE
========================================================= */

async function calculateRoundResults() {

  const results = [];

  for (const item of playbackQueue) {

    let score = 0;

    if (item.blob) {

      score = await calculateAudioScore(item.blob);

    } else {

      score = 0;
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    const previous =
      gameScores.get(item.playerId) || 0;

    const total = previous + score;

    gameScores.set(item.playerId, total);

    results.push({
      playerId: item.playerId,
      name: item.name,
      score,
      total
    });
  }

  currentRoundResults = results;

  broadcast({
    type: "roundResult",
    results
  });

  showRoundResult({
    results
  });

  await wait(3500);

  if (currentRound >= TOTAL_ROUNDS) {

    finishGame();

  } else {

    currentRound++;

    receivedRecordings.clear();

    broadcast({
      type: "roundPhase",
      phase: "next",
      round: currentRound
    });

    broadcast({
      type: "startGame",
      round: currentRound
    });

    startCountdown();
  }
}

async function calculateAudioScore(blob) {

  /*
    Silêncio não recebe pontos automaticamente.
  */

  try {

    const arrayBuffer = await blob.arrayBuffer();

    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      return 0;
    }

    const context = new AudioContextClass();

    const audioBuffer =
      await context.decodeAudioData(arrayBuffer);

    const channel =
      audioBuffer.getChannelData(0);

    let sum = 0;
    let peak = 0;

    for (let i = 0; i < channel.length; i++) {

      const value = Math.abs(channel[i]);

      sum += value;

      if (value > peak) {
        peak = value;
      }
    }

    const average =
      sum / Math.max(channel.length, 1);

    /*
      Silêncio / gravação quase vazia.
    */

    if (peak < 0.015 || average < 0.002) {

      try {
        await context.close();
      } catch {}

      return 0;
    }

    /*
      Volume apenas evita que silêncio seja considerado
      uma boa resposta.

      O score base considera:
      - presença de som
      - estabilidade
      - duração
    */

    let score = 40;

    if (peak > 0.04) {
      score += 20;
    }

    if (peak > 0.10) {
      score += 10;
    }

    if (average > 0.005) {
      score += 10;
    }

    if (audioBuffer.duration >= 1) {
      score += 10;
    }

    if (audioBuffer.duration >= 3) {
      score += 10;
    }

    try {
      await context.close();
    } catch {}

    return Math.min(score, 100);

  } catch {

    return 0;
  }
}


/* =========================================================
   RESULTADO
========================================================= */

function showRoundResult(data) {

  hideAllGamePanels();

  resultPanel.classList.remove("hidden");

  const results =
    Array.isArray(data.results)
      ? data.results
      : [];

  const mine =
    results.find(item =>
      item.playerId === "self" ||
      item.playerId === myPeerId
    );

  resultScore.textContent =
    mine ? mine.score : "—";

  resultDescription.textContent =
    mine
      ? `${mine.score}/100 pontos nesta rodada`
      : "Rodada concluída";

  resultPlayers.innerHTML = "";

  const sorted = [...results]
    .sort((a, b) => b.score - a.score);

  sorted.forEach(item => {

    const row = document.createElement("div");
    row.className = "result-row";

    const name = document.createElement("div");
    name.className = "result-row-name";
    name.textContent = item.name;

    const score = document.createElement("div");
    score.className = "result-row-score";
    score.textContent = item.score + " pts";

    row.appendChild(name);
    row.appendChild(score);

    resultPlayers.appendChild(row);
  });

  unmuteRemoteVoice();
}


/* =========================================================
   FINAL
========================================================= */

function finishGame() {

  const results = [];

  players.forEach(player => {

    results.push({
      playerId: player.id,
      name: player.name,
      total: gameScores.get(player.id) || 0
    });

  });

  results.sort((a, b) => b.total - a.total);

  broadcast({
    type: "finalResult",
    results
  });

  showFinalResult({
    results
  });
}

function showFinalResult(data) {

  hideAllGamePanels();

  finalPanel.classList.remove("hidden");

  const results =
    Array.isArray(data.results)
      ? data.results
      : [];

  finalPlayers.innerHTML = "";

  results.forEach((item, index) => {

    const row = document.createElement("div");
    row.className = "final-row";

    const name = document.createElement("div");
    name.className = "final-row-name";

    name.textContent =
      `${index + 1}. ${item.name}`;

    const score = document.createElement("div");
    score.className = "final-row-score";

    score.textContent =
      `${item.total} pts`;

    row.appendChild(name);
    row.appendChild(score);

    finalPlayers.appendChild(row);
  });

  unmuteRemoteVoice();
}


/* =========================================================
   GAME UI
========================================================= */

function hideAllGamePanels() {

  [
    countdownPanel,
    referencePanel,
    recordPanel,
    playbackPanel,
    resultPanel,
    finalPanel
  ].forEach(panel => {

    if (panel) {
      panel.classList.add("hidden");
    }

  });
}


/* =========================================================
   LEAVE ROOM
========================================================= */

function leaveRoom(returnHome = true) {

  destroyed = true;

  stopPresence();

  if (recordTimerHandle) {
    clearInterval(recordTimerHandle);
    recordTimerHandle = null;
  }

  gameStarted = false;
  currentPhase = "idle";

  closeOutgoingVoice();

  if (microphoneStream) {

    microphoneStream
      .getTracks()
      .forEach(track => {

        try {
          track.stop();
        } catch {}

      });

    microphoneStream = null;
  }

  microphoneEnabled = false;
  gameVoiceEnabled = false;

  roomConnections.forEach(connection => {

    try {
      connection.close();
    } catch {}

  });

  roomConnections.clear();

  players.clear();
  receivedRecordings.clear();
  gameScores.clear();

  cleanupPeer();

  isHost = false;
  roomCode = "";
  roomPeerId = "";
  myPeerId = "";

  remoteAudios.innerHTML = "";

  if (returnHome) {
    showHome();
  }
}

function cleanupPeer() {

  if (!peer) return;

  try {
    peer.destroy();
  } catch {}

  peer = null;
}


/* =========================================================
   EVENTOS
========================================================= */

loginButton.addEventListener("click", login);

usernameInput.addEventListener("keydown", event => {

  if (event.key === "Enter") {
    login();
  }

});

createRoomButton.addEventListener("click", createRoom);

joinRoomButton.addEventListener("click", showJoin);

joinBackButton.addEventListener("click", showHome);

confirmJoinButton.addEventListener("click", joinRoom);

roomCodeInput.addEventListener("input", () => {

  roomCodeInput.value =
    roomCodeInput.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);

});

roomCodeInput.addEventListener("keydown", event => {

  if (event.key === "Enter") {
    joinRoom();
  }

});

copyRoomCodeButton.addEventListener(
  "click",
  copyRoomCode
);

roomMicButton.addEventListener(
  "click",
  toggleRoomMicrophone
);

startGameButton.addEventListener(
  "click",
  startGame
);

leaveRoomButton.addEventListener(
  "click",
  () => leaveRoom(true)
);

gameVoiceButton.addEventListener(
  "click",
  toggleGameVoice
);

backHomeButton.addEventListener(
  "click",
  () => leaveRoom(true)
);

logoutButton.addEventListener(
  "click",
  logout
);


/* =========================================================
   PAGE EXIT
========================================================= */

window.addEventListener("beforeunload", () => {

  destroyed = true;

  try {

    if (isHost) {

      broadcast({
        type: "hostLeaving"
      });

    } else {

      sendToHost({
        type: "leaving"
      });

    }

  } catch {}

  stopPresence();

  roomConnections.forEach(connection => {

    try {
      connection.close();
    } catch {}

  });

  if (microphoneStream) {

    microphoneStream
      .getTracks()
      .forEach(track => {

        try {
          track.stop();
        } catch {}

      });
  }

  try {

    if (peer) {
      peer.destroy();
    }

  } catch {}
});


/* =========================================================
   RECUPERAR NOME
========================================================= */

(function init() {

  const saved =
    localStorage.getItem("shadow_games_username");

  if (saved) {

    username = safeName(saved);

    if (username) {
      showHome();
      return;
    }
  }

  showLogin();

})();
