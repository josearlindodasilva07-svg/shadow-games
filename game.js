"use strict";

/* =========================================================
   SHADOW GAMES
   ========================================================= */

const $ = (id) => document.getElementById(id);

const loginScreen = $("login");
const homeScreen = $("home");
const joinRoomScreen = $("joinPanel");
const roomScreen = $("room");
const gameScreen = $("game");

const usernameInput = $("username");
const loginButton = $("loginButton");
const loginStatus = $("loginStatus");

const profileName = $("profileName");
const profileAvatar = $("profileAvatar");

const createButton = $("create");
const joinButton = $("join");
const logoutButton = $("logout");

const joinCodeInput = $("joinCodeInput");
const joinConfirm = $("joinConfirm");
const joinCancel = $("joinCancel");
const joinStatus = $("joinStatus");

const roomCodeElement = $("roomCode");
const copyCodeButton = $("copyCode");
const statusElement = $("status");

const playersElement = $("players");
const startButton = $("start");
const leaveRoomButton = $("leaveRoom");

const micButton = $("micButton");
const voiceStatus = $("voiceStatus");
const remoteAudios = $("remoteAudios");

const gameVoiceButton = $("gameVoiceButton");
const gamePlayers = $("gamePlayers");

const roundText = $("roundText");

const countdownScreen = $("countdownScreen");
const countdownNumber = $("countdownNumber");

const referenceScreen = $("referenceScreen");
const referenceButton = $("referenceButton");
const referenceStatus = $("referenceStatus");

const recordScreen = $("recordScreen");
const recordTimerElement = $("recordTimer");
const recordStatus = $("recordStatus");

const playbackScreen = $("playbackScreen");
const playbackName = $("playbackName");
const playbackTimer = $("playbackTimer");
const playbackStatus = $("playbackStatus");

const resultScreen = $("resultScreen");
const resultText = $("resultText");


/* =========================================================
   STATE
   ========================================================= */

let username = "";
let peer = null;

let isHost = false;
let roomCode = "";
let roomPeerId = "";

let localStream = null;
let micEnabled = false;

let gameVoiceEnabled = false;

let roomConnections = new Map();
let players = new Map();

let voiceCalls = new Map();
let remoteAudioElements = new Map();

let heartbeatTimer = null;
let pruneTimer = null;

let currentRound = 1;
const MAX_ROUNDS = 4;

let gameStarted = false;
let roundRunning = false;

let countdownTimer = null;
let recordTimer = null;
let playbackTimerHandle = null;

let recordedBlob = null;
let recordedUrl = null;

let mediaRecorder = null;
let recordedChunks = [];

let referenceAudio = null;

let playbackIndex = 0;

let roundScores = {};
let totalScores = {};


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function showScreen(screen) {
  loginScreen.classList.add("hidden");
  homeScreen.classList.add("hidden");
  roomScreen.classList.add("hidden");
  gameScreen.classList.add("hidden");

  screen.classList.remove("hidden");
}

function setJoinStatus(text) {
  joinStatus.textContent = text || "";
}

function setStatus(text) {
  statusElement.textContent = text || "";
}

function normalizeRoomCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

function randomCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }

  return result;
}

function randomPlayerId() {
  return "shadow-player-" + Math.random().toString(36).slice(2, 12);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


/* =========================================================
   LOGIN
   ========================================================= */

function login() {
  const name = usernameInput.value.trim();

  if (!name) {
    loginStatus.textContent = "Digite um nome.";
    return;
  }

  username = name.slice(0, 16);

  localStorage.setItem(
    "shadow_games_username",
    username
  );

  profileName.textContent = username;

  profileAvatar.textContent = "";

  loginStatus.textContent = "";

  showScreen(homeScreen);
}

function loadSavedUser() {
  const saved = localStorage.getItem(
    "shadow_games_username"
  );

  if (!saved) {
    showScreen(loginScreen);
    return;
  }

  username = saved;
  usernameInput.value = username;
  profileName.textContent = username;

  showScreen(homeScreen);
}

loginButton.addEventListener("click", login);

usernameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    login();
  }
});

logoutButton.addEventListener("click", () => {
  leaveEverything();

  localStorage.removeItem(
    "shadow_games_username"
  );

  username = "";
  usernameInput.value = "";

  showScreen(loginScreen);
});


/* =========================================================
   JOIN UI
   ========================================================= */

joinButton.addEventListener("click", () => {
  joinRoomScreen.classList.remove("hidden");

  joinCodeInput.value = "";
  setJoinStatus("");

  setTimeout(() => {
    joinCodeInput.focus();
  }, 50);
});

joinCancel.addEventListener("click", () => {
  joinRoomScreen.classList.add("hidden");
  joinCodeInput.value = "";
  setJoinStatus("");
});

joinCodeInput.addEventListener("input", () => {
  joinCodeInput.value = normalizeRoomCode(
    joinCodeInput.value
  );
});

joinCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    joinConfirm.click();
  }
});

joinConfirm.addEventListener("click", () => {
  const code = normalizeRoomCode(
    joinCodeInput.value
  );

  if (code.length < 4) {
    setJoinStatus("Digite um código válido.");
    return;
  }

  setJoinStatus("Conectando à sala...");

  joinRoom(code);
});


/* =========================================================
   CREATE ROOM
   ========================================================= */

createButton.addEventListener("click", () => {
  createRoom();
});

function createRoom() {
  if (peer) {
    try {
      peer.destroy();
    } catch (_) {}
  }

  isHost = true;
  roomCode = randomCode(6);

  roomPeerId = "shadow-room-" + roomCode;

  setStatus("Criando sala...");

  peer = new Peer(roomPeerId, {
    debug: 0
  });

  peer.on("open", () => {
    players.clear();

    players.set(peer.id, {
      id: peer.id,
      name: username,
      host: true,
      connected: true,
      score: 0
    });

    roomCodeElement.textContent = roomCode;

    startButton.classList.remove("hidden");

    setStatus(
      "Sala criada. Envie o código para seus amigos."
    );

    showScreen(roomScreen);

    startHeartbeat();
    startPrune();

    renderPlayers();
  });

  peer.on("connection", (connection) => {
    handleDataConnection(connection);
  });

  peer.on("call", (call) => {
    handleIncomingVoiceCall(call);
  });

  peer.on("error", (error) => {
    console.error("Peer error:", error);

    if (error.type === "unavailable-id") {
      setStatus(
        "Esse código já está sendo usado. Crie outra sala."
      );

      try {
        peer.destroy();
      } catch (_) {}
    }
  });
}


/* =========================================================
   JOIN ROOM
   ========================================================= */

function joinRoom(code) {
  roomCode = code;
  roomPeerId = "shadow-room-" + code;

  isHost = false;

  if (peer) {
    try {
      peer.destroy();
    } catch (_) {}
  }

  peer = new Peer(randomPlayerId(), {
    debug: 0
  });

  peer.on("open", () => {
    const connection = peer.connect(
      roomPeerId,
      {
        reliable: true
      }
    );

    handleDataConnection(connection);

    connection.on("open", () => {
      connection.send({
        type: "JOIN",
        id: peer.id,
        name: username
      });

      showScreen(roomScreen);

      roomCodeElement.textContent = roomCode;

      startButton.classList.add("hidden");

      setStatus("Conectado à sala.");

      startHeartbeat();

      renderPlayers();

      setJoinStatus("");
    });

    connection.on("error", () => {
      setJoinStatus(
        "Não foi possível entrar nessa sala."
      );
    });
  });

  peer.on("call", (call) => {
    handleIncomingVoiceCall(call);
  });

  peer.on("error", (error) => {
    console.error("Peer error:", error);

    if (
      error.type === "peer-unavailable" ||
      error.type === "network"
    ) {
      setJoinStatus(
        "Sala não encontrada ou conexão indisponível."
      );
    }
  });
}


/* =========================================================
   DATA CONNECTION
   ========================================================= */

function handleDataConnection(connection) {
  roomConnections.set(
    connection.peer,
    connection
  );

  connection.on("data", (message) => {
    handleMessage(
      message,
      connection
    );
  });

  connection.on("open", () => {
    roomConnections.set(
      connection.peer,
      connection
    );
  });

  connection.on("close", () => {
    roomConnections.delete(
      connection.peer
    );

    if (isHost) {
      removePlayer(connection.peer);
    }
  });

  connection.on("error", () => {
    roomConnections.delete(
      connection.peer
    );

    if (isHost) {
      removePlayer(connection.peer);
    }
  });
}


/* =========================================================
   MESSAGES
   ========================================================= */

function handleMessage(message, connection) {
  if (!message || !message.type) {
    return;
  }

  switch (message.type) {

    case "JOIN":
      if (isHost) {
        addPlayer(
          message.id,
          message.name
        );

        sendRoomState();
      }
      break;

    case "ROOM_STATE":
      if (!isHost) {
        applyRoomState(message.players);
      }
      break;

    case "HEARTBEAT":
      if (isHost) {
        const player = players.get(message.id);

        if (player) {
          player.connected = true;
          player.lastSeen = Date.now();
        }
      }
      break;

    case "LEAVE":
      if (isHost) {
        removePlayer(message.id);
        sendRoomState();
      }
      break;

    case "START_GAME":
      if (!isHost) {
        startGameForEveryone(
          message.round || 1
        );
      }
      break;

    case "GAME_COUNTDOWN":
      if (!isHost) {
        startGuestCountdown(
          message.round
        );
      }
      break;

    case "REFERENCE":
      if (!isHost) {
        startGuestReference();
      }
      break;

    case "RECORD_START":
      if (!isHost) {
        startGuestRecording();
      }
      break;

    case "PLAYBACK_START":
      if (!isHost) {
        startGuestPlayback(message);
      }
      break;

    case "ROUND_RESULT":
      if (!isHost) {
        showGuestResult(
          message.scores,
          message.round
        );
      }
      break;

    case "GAME_FINISH":
      if (!isHost) {
        finishGame();
      }
      break;

    case "VOICE_STATE":
      updatePlayerVoiceState(
        message.id,
        message.enabled
      );
      break;
  }
}


/* =========================================================
   PLAYERS
   ========================================================= */

function addPlayer(id, name) {
  if (!id || id === peer.id) {
    return;
  }

  players.set(id, {
    id,
    name: name || "Jogador",
    host: false,
    connected: true,
    score: 0,
    lastSeen: Date.now()
  });

  renderPlayers();
}

function removePlayer(id) {
  players.delete(id);

  const connection =
    roomConnections.get(id);

  if (connection) {
    try {
      connection.close();
    } catch (_) {}
  }

  roomConnections.delete(id);

  closeVoiceCall(id);
  removeRemoteAudio(id);

  renderPlayers();
}

function applyRoomState(playerList) {
  players.clear();

  if (Array.isArray(playerList)) {
    playerList.forEach(player => {
      players.set(
        player.id,
        player
      );
    });
  }

  renderPlayers();
}

function renderPlayers() {
  playersElement.innerHTML = "";

  const list = Array.from(
    players.values()
  );

  list.forEach(player => {
    const row = document.createElement("div");
    row.className = "player";

    const left = document.createElement("div");
    left.className = "player-left";

    const dot = document.createElement("div");
    dot.className =
      "player-dot " +
      (player.connected !== false
        ? "online"
        : "");

    const info = document.createElement("div");

    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent =
      player.name +
      (player.id === peer?.id
        ? " (você)"
        : "");

    const tag = document.createElement("div");
    tag.className = "player-tag";

    tag.textContent = player.host
      ? "Host"
      : "Jogador";

    info.appendChild(name);
    info.appendChild(tag);

    left.appendChild(dot);
    left.appendChild(info);

    row.appendChild(left);

    playersElement.appendChild(row);
  });

  updateGamePlayerCount();
}

function updateGamePlayerCount() {
  gamePlayers.textContent =
    `${players.size}/${Math.max(5, players.size)}`;
}


/* =========================================================
   ROOM STATE
   ========================================================= */

function getRoomPlayerArray() {
  return Array.from(
    players.values()
  ).map(player => ({
    id: player.id,
    name: player.name,
    host: player.host,
    connected: player.connected,
    score: player.score || 0
  }));
}

function sendToPlayer(id, message) {
  const connection =
    roomConnections.get(id);

  if (
    connection &&
    connection.open
  ) {
    try {
      connection.send(message);
      return true;
    } catch (_) {}
  }

  return false;
}

function broadcast(message) {
  roomConnections.forEach(
    (connection) => {
      if (
        connection &&
        connection.open
      ) {
        try {
          connection.send(message);
        } catch (_) {}
      }
    }
  );
}

function sendRoomState() {
  broadcast({
    type: "ROOM_STATE",
    players: getRoomPlayerArray()
  });

  renderPlayers();
}


/* =========================================================
   HEARTBEAT / LEAVE
   ========================================================= */

function startHeartbeat() {
  stopHeartbeat();

  heartbeatTimer = setInterval(() => {

    if (!peer || peer.destroyed) {
      return;
    }

    if (isHost) {
      const me = players.get(peer.id);

      if (me) {
        me.lastSeen = Date.now();
        me.connected = true;
      }

      return;
    }

    sendToPlayer(
      roomPeerId,
      {
        type: "HEARTBEAT",
        id: peer.id
      }
    );

  }, 2500);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function startPrune() {
  if (!isHost) {
    return;
  }

  if (pruneTimer) {
    clearInterval(pruneTimer);
  }

  pruneTimer = setInterval(() => {
    const now = Date.now();

    players.forEach((player, id) => {

      if (id === peer.id) {
        return;
      }

      if (
        !player.lastSeen ||
        now - player.lastSeen > 6000
      ) {
        removePlayer(id);
        sendRoomState();
      }
    });

  }, 2000);
}

function sendLeave() {
  if (
    !peer ||
    peer.destroyed ||
    isHost
  ) {
    return;
  }

  try {
    const connection =
      roomConnections.get(roomPeerId);

    if (
      connection &&
      connection.open
    ) {
      connection.send({
        type: "LEAVE",
        id: peer.id
      });
    }
  } catch (_) {}
}

window.addEventListener(
  "beforeunload",
  () => {
    sendLeave();
  }
);


/* =========================================================
   COPY CODE
   ========================================================= */

copyCodeButton.addEventListener(
  "click",
  async () => {

    if (!roomCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        roomCode
      );

      copyCodeButton.textContent =
        "Código copiado";

      setTimeout(() => {
        copyCodeButton.textContent =
          "Copiar código";
      }, 1400);

    } catch (_) {
      setStatus(
        "Código: " + roomCode
      );
    }
  }
);


/* =========================================================
   MICROPHONE
   ========================================================= */

async function requestMicrophone() {
  if (localStream) {
    return localStream;
  }

  try {
    localStream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
          latency: 0,
          channelCount: 1,
          sampleRate: 48000,
          sampleSize: 16
        },
        video: false
      });

    return localStream;

  } catch (error) {
    console.error(
      "Microphone error:",
      error
    );

    throw error;
  }
}

function setLocalMicEnabled(enabled) {
  micEnabled = enabled;

  if (localStream) {
    localStream
      .getAudioTracks()
      .forEach(track => {
        track.enabled = enabled;
      });
  }

  updateMicUI();

  if (isHost) {
    const me = players.get(peer.id);

    if (me) {
      me.voice = enabled;
    }

    broadcast({
      type: "VOICE_STATE",
      id: peer.id,
      enabled
    });
  } else {
    sendToPlayer(
      roomPeerId,
      {
        type: "VOICE_STATE",
        id: peer.id,
        enabled
      }
    );
  }
}

function updateMicUI() {
  if (micEnabled) {
    micButton.textContent =
      "Desligar microfone";

    micButton.classList.add(
      "active"
    );

    voiceStatus.textContent =
      "Microfone ligado";
  } else {
    micButton.textContent =
      "Ativar microfone";

    micButton.classList.remove(
      "active"
    );

    voiceStatus.textContent =
      "Microfone desligado";
  }
}

micButton.addEventListener(
  "click",
  async () => {

    if (!micEnabled) {

      try {
        await requestMicrophone();

        setLocalMicEnabled(true);

        /*
         * Cria as chamadas imediatamente.
         * Não espera o DataConnection.
         */
        callAllVoicePeers();

      } catch (_) {

        voiceStatus.textContent =
          "Não foi possível acessar o microfone.";
      }

    } else {
      setLocalMicEnabled(false);
    }
  }
);


/* =========================================================
   VOICE
   ========================================================= */

function getVoicePeerIds() {
  const ids = [];

  players.forEach(
    (player, id) => {
      if (
        id !== peer?.id &&
        player.connected !== false
      ) {
        ids.push(id);
      }
    }
  );

  /*
   * Para convidados, o host pode ainda não
   * ter entrado na lista visual.
   */
  if (
    !isHost &&
    roomPeerId &&
    !ids.includes(roomPeerId)
  ) {
    ids.push(roomPeerId);
  }

  return ids;
}

function callAllVoicePeers() {
  if (
    !peer ||
    peer.destroyed ||
    !localStream ||
    !micEnabled
  ) {
    return;
  }

  getVoicePeerIds().forEach(
    id => startOutgoingVoiceCall(id)
  );
}

function startOutgoingVoiceCall(id) {
  if (
    !id ||
    id === peer?.id ||
    !localStream ||
    !micEnabled
  ) {
    return;
  }

  const oldCall = voiceCalls.get(id);

  if (oldCall) {
    try {
      oldCall.close();
    } catch (_) {}

    voiceCalls.delete(id);
  }

  try {

    const call = peer.call(
      id,
      localStream,
      {
        metadata: {
          room: roomCode,
          user: username
        }
      }
    );

    if (!call) {
      return;
    }

    voiceCalls.set(id, call);

    call.on("stream", stream => {
      attachRemoteAudio(
        id,
        stream
      );
    });

    call.on("close", () => {
      if (
        voiceCalls.get(id) === call
      ) {
        voiceCalls.delete(id);
      }
    });

    call.on("error", () => {
      if (
        voiceCalls.get(id) === call
      ) {
        voiceCalls.delete(id);
      }
    });

  } catch (error) {
    console.error(
      "Voice call error:",
      error
    );
  }
}

function handleIncomingVoiceCall(call) {

  if (!call) {
    return;
  }

  const callerId = call.peer;

  try {

    /*
     * Mesmo com o microfone desligado,
     * responde à chamada.
     *
     * Assim a pessoa continua ouvindo os outros.
     */
    if (micEnabled && localStream) {
      call.answer(localStream);
    } else {
      call.answer();
    }

    call.on("stream", stream => {
      attachRemoteAudio(
        callerId,
        stream
      );
    });

    call.on("close", () => {
      removeRemoteAudio(
        callerId
      );
    });

    call.on("error", () => {
      removeRemoteAudio(
        callerId
      );
    });

  } catch (error) {
    console.error(
      "Incoming voice error:",
      error
    );
  }
}

function attachRemoteAudio(
  id,
  stream
) {
  let audio =
    remoteAudioElements.get(id);

  if (!audio) {
    audio =
      document.createElement("audio");

    audio.autoplay = true;
    audio.playsInline = true;
    audio.controls = false;
    audio.volume = 1;

    audio.style.display = "none";

    remoteAudios.appendChild(audio);

    remoteAudioElements.set(
      id,
      audio
    );
  }

  /*
   * Não usamos AudioContext.
   * O áudio vai direto para o elemento
   * para evitar processamento e atraso extra.
   */
  audio.srcObject = stream;

  const playPromise =
    audio.play();

  if (
    playPromise &&
    typeof playPromise.catch === "function"
  ) {
    playPromise.catch(() => {});
  }
}

function removeRemoteAudio(id) {
  const audio =
    remoteAudioElements.get(id);

  if (!audio) {
    return;
  }

  try {
    audio.pause();
    audio.srcObject = null;
    audio.remove();
  } catch (_) {}

  remoteAudioElements.delete(id);
}

function closeVoiceCall(id) {
  const call =
    voiceCalls.get(id);

  if (call) {
    try {
      call.close();
    } catch (_) {}
  }

  voiceCalls.delete(id);

  removeRemoteAudio(id);
}

function updatePlayerVoiceState(
  id,
  enabled
) {
  const player =
    players.get(id);

  if (player) {
    player.voice = enabled;
  }
}


/* =========================================================
   GAME VOICE
   ========================================================= */

function updateGameVoiceButton() {

  if (gameVoiceEnabled) {

    gameVoiceButton.textContent =
      "Voz: ON";

    gameVoiceButton.classList.add(
      "active"
    );

    gameVoiceButton.classList.remove(
      "off"
    );

  } else {

    gameVoiceButton.textContent =
      "Voz: OFF";

    gameVoiceButton.classList.remove(
      "active"
    );

    gameVoiceButton.classList.add(
      "off"
    );
  }
}

gameVoiceButton.addEventListener(
  "click",
  async () => {

    /*
     * Isso controla somente a transmissão
     * da própria voz.
     *
     * OFF ainda escuta os outros.
     */

    if (gameVoiceEnabled) {

      gameVoiceEnabled = false;

      if (localStream) {
        localStream
          .getAudioTracks()
          .forEach(track => {
            track.enabled = false;
          });
      }

      updateGameVoiceButton();

      return;
    }

    try {

      await requestMicrophone();

      gameVoiceEnabled = true;

      localStream
        .getAudioTracks()
        .forEach(track => {
          track.enabled = true;
        });

      micEnabled = true;

      updateGameVoiceButton();
      updateMicUI();

      callAllVoicePeers();

    } catch (_) {

      gameVoiceEnabled = false;

      updateGameVoiceButton();
    }
  }
);


/* =========================================================
   START BUTTON
   ========================================================= */

startButton.addEventListener(
  "click",
  () => {

    if (!isHost) {
      return;
    }

    if (players.size < 1) {
      return;
    }

    if (gameStarted) {
      return;
    }

    gameStarted = true;
    currentRound = 1;

    gameVoiceEnabled = false;

    if (localStream) {
      localStream
        .getAudioTracks()
        .forEach(track => {
          track.enabled = false;
        });
    }

    updateGameVoiceButton();

    broadcast({
      type: "START_GAME",
      round: 1
    });

    startGameForEveryone(1);
  }
);


/* =========================================================
   GAME START
   ========================================================= */

function startGameForEveryone(round) {

  gameStarted = true;
  roundRunning = true;
  currentRound = round || 1;

  /*
   * A voz da partida começa DESLIGADA.
   */
  gameVoiceEnabled = false;

  if (localStream) {
    localStream
      .getAudioTracks()
      .forEach(track => {
        track.enabled = false;
      });
  }

  updateGameVoiceButton();

  startButton.classList.add("hidden");

  showScreen(gameScreen);

  updateGamePlayerCount();

  startCountdown(
    currentRound
  );
}


/* =========================================================
   COUNTDOWN
   ========================================================= */

function startCountdown(round) {

  hideGameScreens();

  countdownScreen.classList.remove(
    "hidden"
  );

  roundText.textContent =
    `Rodada ${round}`;

  let count = 5;

  countdownNumber.textContent =
    count;

  clearInterval(countdownTimer);

  countdownTimer = setInterval(() => {

    count--;

    countdownNumber.textContent =
      count;

    if (count <= 0) {

      clearInterval(
        countdownTimer
      );

      if (isHost) {

        broadcast({
          type: "REFERENCE",
          round: currentRound
        });

        startHostReference();

      } else {
        startGuestReference();
      }
    }

  }, 1000);
}

function startGuestCountdown(round) {
  startGameForEveryone(
    round || 1
  );
}


/* =========================================================
   REFERENCE
   ========================================================= */

function startHostReference() {

  hideGameScreens();

  referenceScreen.classList.remove(
    "hidden"
  );

  referenceStatus.textContent =
    "O som será reproduzido automaticamente.";

  /*
   * Não começa instantaneamente.
   * Dá tempo para todo mundo enxergar a tela.
   */
  setTimeout(() => {

    playReference();

    referenceStatus.textContent =
      "Agora preste atenção.";

    setTimeout(() => {

      if (isHost) {

        broadcast({
          type: "RECORD_START",
          round: currentRound
        });

        startHostRecording();
      }

    }, 5500);

  }, 1500);
}

function startGuestReference() {

  hideGameScreens();

  referenceScreen.classList.remove(
    "hidden"
  );

  referenceStatus.textContent =
    "O som será reproduzido.";

  setTimeout(() => {

    playReference();

    referenceStatus.textContent =
      "Agora preste atenção.";

  }, 1500);
}

function playReference() {

  /*
   * Som de referência simples.
   * A estrutura já fica preparada para
   * receber os packs reais depois.
   */

  if (referenceAudio) {
    try {
      referenceAudio.pause();
    } catch (_) {}
  }

  const audioContext =
    new (
      window.AudioContext ||
      window.webkitAudioContext
    )();

  const oscillator =
    audioContext.createOscillator();

  const gain =
    audioContext.createGain();

  oscillator.type = "sine";

  oscillator.frequency.value =
    440;

  gain.gain.value =
    0.001;

  oscillator.connect(gain);
  gain.connect(
    audioContext.destination
  );

  const now =
    audioContext.currentTime;

  oscillator.start(now);

  gain.gain.exponentialRampToValueAtTime(
    0.35,
    now + 0.05
  );

  gain.gain.exponentialRampToValueAtTime(
    0.001,
    now + 0.35
  );

  oscillator.stop(
    now + 0.4
  );

  referenceAudio = oscillator;
}


/* =========================================================
   RECORDING
   ========================================================= */

async function startHostRecording() {

  hideGameScreens();

  recordScreen.classList.remove(
    "hidden"
  );

  await prepareRecording();

  beginRecordingTimer();
}

async function startGuestRecording() {

  hideGameScreens();

  recordScreen.classList.remove(
    "hidden"
  );

  await prepareRecording();

  beginRecordingTimer();
}

async function prepareRecording() {

  recordStatus.textContent =
    "Prepare-se...";

  /*
   * Voz da partida fica desligada durante
   * a gravação para ninguém ouvir os outros.
   */
  if (localStream) {
    localStream
      .getAudioTracks()
      .forEach(track => {
        track.enabled = false;
      });
  }

  try {
    await requestMicrophone();
  } catch (_) {
    recordStatus.textContent =
      "Microfone não disponível.";
  }

  recordedChunks = [];
  recordedBlob = null;

  if (recordedUrl) {
    URL.revokeObjectURL(
      recordedUrl
    );

    recordedUrl = null;
  }

  await sleep(700);

  startMediaRecorder();
}

function startMediaRecorder() {

  if (!localStream) {
    return;
  }

  const audioTracks =
    localStream.getAudioTracks();

  if (!audioTracks.length) {
    return;
  }

  const recordingStream =
    new MediaStream(audioTracks);

  let options = {};

  if (
    MediaRecorder.isTypeSupported(
      "audio/webm;codecs=opus"
    )
  ) {
    options.mimeType =
      "audio/webm;codecs=opus";
  }

  try {

    mediaRecorder =
      new MediaRecorder(
        recordingStream,
        options
      );

  } catch (_) {

    try {
      mediaRecorder =
        new MediaRecorder(
          recordingStream
        );
    } catch (error) {
      console.error(
        "MediaRecorder error:",
        error
      );

      return;
    }
  }

  mediaRecorder.ondataavailable =
    (event) => {

      if (
        event.data &&
        event.data.size > 0
      ) {
        recordedChunks.push(
          event.data
        );
      }
    };

  mediaRecorder.onstop = () => {

    recordedBlob =
      new Blob(
        recordedChunks,
        {
          type:
            mediaRecorder.mimeType ||
            "audio/webm"
        }
      );

    recordedUrl =
      URL.createObjectURL(
        recordedBlob
      );

    recordStatus.textContent =
      "Gravação concluída.";

    if (isHost) {
      finishRecordingHost();
    }
  };

  try {
    mediaRecorder.start();
  } catch (error) {
    console.error(
      "Recording start error:",
      error
    );
  }
}

function beginRecordingTimer() {

  let seconds = 7;

  recordTimerElement.textContent =
    seconds;

  recordStatus.textContent =
    "Gravando...";

  clearInterval(recordTimer);

  recordTimer =
    setInterval(() => {

      seconds--;

      recordTimerElement.textContent =
        seconds;

      if (seconds <= 0) {

        clearInterval(
          recordTimer
        );

        recordTimer = null;

        stopMediaRecorder();
      }

    }, 1000);
}

function stopMediaRecorder() {

  if (
    mediaRecorder &&
    mediaRecorder.state !== "inactive"
  ) {

    try {
      mediaRecorder.stop();
    } catch (_) {}
  } else {

    if (isHost) {
      finishRecordingHost();
    }
  }
}


/* =========================================================
   RECORDING FINISHED
   ========================================================= */

function finishRecordingHost() {

  /*
   * Para uma versão P2P simples,
   * o host mostra primeiro a própria gravação.
   * A estrutura já fica preparada para
   * enviar os blobs futuramente.
   */

  setTimeout(() => {

    broadcast({
      type: "PLAYBACK_START",
      round: currentRound
    });

    startPlayback();

  }, 1000);
}

function startGuestPlayback(message) {

  startPlayback();
}

function startPlayback() {

  hideGameScreens();

  playbackScreen.classList.remove(
    "hidden"
  );

  /*
   * Voz normal fica desligada durante playback.
   */
  if (localStream) {
    localStream
      .getAudioTracks()
      .forEach(track => {
        track.enabled = false;
      });
  }

  playbackName.textContent =
    username;

  playbackStatus.textContent =
    "Reproduzindo gravação...";

  if (recordedUrl) {

    const audio =
      new Audio(recordedUrl);

    audio.volume = 1;

    const duration =
      7;

    let remaining = duration;

    playbackTimer.textContent =
      remaining;

    clearInterval(
      playbackTimerHandle
    );

    playbackTimerHandle =
      setInterval(() => {

        remaining--;

        playbackTimer.textContent =
          Math.max(remaining, 0);

        if (remaining <= 0) {

          clearInterval(
            playbackTimerHandle
          );

          if (isHost) {
            finishRound();
          }
        }

      }, 1000);

    audio.play().catch(() => {});

  } else {

    playbackTimer.textContent =
      "0";

    playbackStatus.textContent =
      "Nenhuma gravação disponível.";

    setTimeout(() => {

      if (isHost) {
        finishRound();
      }

    }, 1500);
  }
}


/* =========================================================
   RESULT
   ========================================================= */

function calculateScore() {

  if (
    !recordedBlob ||
    recordedBlob.size < 1000
  ) {
    return 0;
  }

  /*
   * Evita o bug antigo onde silêncio
   * recebia uma pontuação alta.
   *
   * Ainda é uma pontuação básica.
   * O sistema de análise de melodia/rítmo
   * será colocado separado depois.
   */

  const size =
    recordedBlob.size;

  if (size < 4000) {
    return 0;
  }

  if (size < 9000) {
    return 20;
  }

  if (size < 16000) {
    return 40;
  }

  if (size < 30000) {
    return 55;
  }

  if (size < 60000) {
    return 70;
  }

  if (size < 100000) {
    return 80;
  }

  return 90;
}

function finishRound() {

  const score =
    calculateScore();

  roundScores[username] =
    score;

  totalScores[username] =
    (totalScores[username] || 0) +
    score;

  resultText.textContent =
    `Você fez ${score} pontos nesta rodada.`;

  hideGameScreens();

  resultScreen.classList.remove(
    "hidden"
  );

  if (isHost) {

    broadcast({
      type: "ROUND_RESULT",
      scores: {
        [username]: score
      },
      round: currentRound
    });

    setTimeout(() => {

      if (
        currentRound >= MAX_ROUNDS
      ) {

        broadcast({
          type: "GAME_FINISH"
        });

        finishGame();

      } else {

        currentRound++;

        broadcast({
          type: "GAME_COUNTDOWN",
          round: currentRound
        });

        startCountdown(
          currentRound
        );
      }

    }, 4000);
  }
}

function showGuestResult(
  scores,
  round
) {

  hideGameScreens();

  resultScreen.classList.remove(
    "hidden"
  );

  const score =
    scores?.[username];

  if (
    typeof score === "number"
  ) {

    totalScores[username] =
      (totalScores[username] || 0) +
      score;

    resultText.textContent =
      `Você fez ${score} pontos nesta rodada.`;

  } else {

    resultText.textContent =
      "Rodada concluída.";
  }
}


/* =========================================================
   FINISH GAME
   ========================================================= */

function finishGame() {

  gameStarted = false;
  roundRunning = false;

  clearInterval(
    countdownTimer
  );

  clearInterval(
    recordTimer
  );

  clearInterval(
    playbackTimerHandle
  );

  countdownTimer = null;
  recordTimer = null;
  playbackTimerHandle = null;

  if (localStream) {
    localStream
      .getAudioTracks()
      .forEach(track => {
        track.enabled = micEnabled;
      });
  }

  gameVoiceEnabled = false;

  updateGameVoiceButton();

  setTimeout(() => {

    setStatus(
      "Partida finalizada."
    );

    showScreen(roomScreen);

    if (isHost) {
      startButton.classList.remove(
        "hidden"
      );
    }

  }, 1000);
}


/* =========================================================
   GAME UI
   ========================================================= */

function hideGameScreens() {

  countdownScreen.classList.add(
    "hidden"
  );

  referenceScreen.classList.add(
    "hidden"
  );

  recordScreen.classList.add(
    "hidden"
  );

  playbackScreen.classList.add(
    "hidden"
  );

  resultScreen.classList.add(
    "hidden"
  );
}


/* =========================================================
   LEAVE ROOM
   ========================================================= */

leaveRoomButton.addEventListener(
  "click",
  () => {
    leaveEverything();
  }
);

function leaveEverything() {

  sendLeave();

  stopHeartbeat();

  if (pruneTimer) {
    clearInterval(pruneTimer);
    pruneTimer = null;
  }

  roomConnections.forEach(
    connection => {
      try {
        connection.close();
      } catch (_) {}
    }
  );

  roomConnections.clear();

  voiceCalls.forEach(
    call => {
      try {
        call.close();
      } catch (_) {}
    }
  );

  voiceCalls.clear();

  remoteAudioElements.forEach(
    audio => {
      try {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      } catch (_) {}
    }
  );

  remoteAudioElements.clear();

  if (localStream) {

    localStream
      .getTracks()
      .forEach(track => {
        track.stop();
      });

    localStream = null;
  }

  micEnabled = false;
  gameVoiceEnabled = false;

  players.clear();

  roomCode = "";
  roomPeerId = "";
  isHost = false;
  gameStarted = false;

  if (peer) {

    try {
      peer.destroy();
    } catch (_) {}

    peer = null;
  }

  updateMicUI();
  updateGameVoiceButton();

  showScreen(homeScreen);
}


/* =========================================================
   STARTUP
   ========================================================= */

updateMicUI();
updateGameVoiceButton();

loadSavedUser();
