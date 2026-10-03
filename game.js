"use strict";

const $ = id => document.getElementById(id);

const loginScreen = $("login");
const homeScreen = $("home");
const roomScreen = $("room");
const gameScreen = $("game");

const usernameInput = $("username");
const loginButton = $("loginButton");
const loginStatus = $("loginStatus");

const profileName = $("profileName");

const createButton = $("create");
const joinButton = $("join");
const logoutButton = $("logout");

const joinPanel = $("joinPanel");
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
   ESTADO
========================================================= */

let username = "";

let peer = null;
let isHost = false;

let roomCode = "";
let roomPeerId = "";

let players = new Map();
let roomConnections = new Map();

let localStream = null;
let micEnabled = false;
let gameVoiceEnabled = false;

let voiceCalls = new Map();
let remoteAudioElements = new Map();

let heartbeatTimer = null;
let pruneTimer = null;

let gameStarted = false;
let currentRound = 1;

const MAX_ROUNDS = 4;

let countdownTimer = null;
let recordTimer = null;
let playbackTimerHandle = null;

let mediaRecorder = null;
let recordedChunks = [];

let recordedBlob = null;
let recordedUrl = null;

let referenceAudioContext = null;

let activePlaybackAudio = null;


/* =========================================================
   UTILIDADES
========================================================= */

function showScreen(screen) {
  loginScreen.classList.add("hidden");
  homeScreen.classList.add("hidden");
  roomScreen.classList.add("hidden");
  gameScreen.classList.add("hidden");

  screen.classList.remove("hidden");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeRoomCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

function randomCode(length = 6) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "";

  for (let i = 0; i < length; i++) {
    result += chars[
      Math.floor(Math.random() * chars.length)
    ];
  }

  return result;
}

function randomPlayerId() {
  return (
    "shadow-player-" +
    Math.random().toString(36).slice(2, 12)
  );
}

function setStatus(text) {
  statusElement.textContent = text || "";
}

function setJoinStatus(text) {
  joinStatus.textContent = text || "";
}


/* =========================================================
   LOGIN
========================================================= */

function login() {
  const name = usernameInput.value.trim();

  if (!name) {
    loginStatus.textContent =
      "Digite um nome.";
    return;
  }

  username = name.slice(0, 16);

  localStorage.setItem(
    "shadow_games_username",
    username
  );

  profileName.textContent =
    username;

  loginStatus.textContent = "";

  showScreen(homeScreen);
}

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

function loadUser() {
  const saved =
    localStorage.getItem(
      "shadow_games_username"
    );

  if (saved) {
    username = saved;
    usernameInput.value = saved;
    profileName.textContent = saved;
    showScreen(homeScreen);
  } else {
    showScreen(loginScreen);
  }
}


/* =========================================================
   ENTRAR EM SALA
========================================================= */

joinButton.addEventListener(
  "click",
  () => {

    joinPanel.classList.remove(
      "hidden"
    );

    joinCodeInput.value = "";
    setJoinStatus("");

    setTimeout(() => {
      joinCodeInput.focus();
    }, 50);
  }
);

joinCancel.addEventListener(
  "click",
  () => {

    joinPanel.classList.add(
      "hidden"
    );

    joinCodeInput.value = "";
    setJoinStatus("");
  }
);

joinCodeInput.addEventListener(
  "input",
  () => {
    joinCodeInput.value =
      normalizeRoomCode(
        joinCodeInput.value
      );
  }
);

joinCodeInput.addEventListener(
  "keydown",
  event => {
    if (event.key === "Enter") {
      joinConfirm.click();
    }
  }
);

joinConfirm.addEventListener(
  "click",
  () => {

    const code =
      normalizeRoomCode(
        joinCodeInput.value
      );

    if (code.length < 4) {
      setJoinStatus(
        "Digite um código válido."
      );
      return;
    }

    setJoinStatus(
      "Conectando..."
    );

    joinRoom(code);
  }
);


/* =========================================================
   CRIAR SALA
========================================================= */

createButton.addEventListener(
  "click",
  createRoom
);

function createRoom() {

  cleanupPeer();

  isHost = true;

  roomCode =
    randomCode(6);

  roomPeerId =
    "shadow-room-" +
    roomCode;

  peer = new Peer(
    roomPeerId,
    {
      debug: 0
    }
  );

  setStatus(
    "Criando sala..."
  );

  peer.on("open", () => {

    players.clear();

    players.set(
      peer.id,
      {
        id: peer.id,
        name: username,
        host: true,
        connected: true,
        lastSeen: Date.now()
      }
    );

    roomCodeElement.textContent =
      roomCode;

    startButton.classList.remove(
      "hidden"
    );

    setStatus(
      "Sala criada. Envie o código para seus amigos."
    );

    showScreen(roomScreen);

    startHeartbeat();
    startPrune();

    renderPlayers();
  });

  peer.on(
    "connection",
    connection => {
      setupDataConnection(
        connection
      );
    }
  );

  peer.on(
    "call",
    call => {
      answerVoiceCall(call);
    }
  );

  peer.on(
    "error",
    error => {
      console.error(
        "Peer:",
        error
      );
    }
  );
}


/* =========================================================
   ENTRAR
========================================================= */

function joinRoom(code) {

  cleanupPeer();

  isHost = false;

  roomCode = code;

  roomPeerId =
    "shadow-room-" +
    code;

  peer = new Peer(
    randomPlayerId(),
    {
      debug: 0
    }
  );

  peer.on("open", () => {

    const connection =
      peer.connect(
        roomPeerId,
        {
          reliable: true
        }
      );

    setupDataConnection(
      connection
    );

    connection.on(
      "open",
      () => {

        connection.send({
          type: "JOIN",
          id: peer.id,
          name: username
        });

        roomCodeElement.textContent =
          roomCode;

        startButton.classList.add(
          "hidden"
        );

        setStatus(
          "Conectado à sala."
        );

        showScreen(roomScreen);

        joinPanel.classList.add(
          "hidden"
        );

        startHeartbeat();

        renderPlayers();
      }
    );

    connection.on(
      "error",
      () => {

        setJoinStatus(
          "Não foi possível conectar à sala."
        );
      }
    );
  });

  peer.on(
    "call",
    call => {
      answerVoiceCall(call);
    }
  );

  peer.on(
    "error",
    error => {

      if (
        error.type ===
        "peer-unavailable"
      ) {
        setJoinStatus(
          "Sala não encontrada."
        );
      }
    }
  );
}


/* =========================================================
   DATA CONNECTION
========================================================= */

function setupDataConnection(
  connection
) {

  if (!connection) {
    return;
  }

  roomConnections.set(
    connection.peer,
    connection
  );

  connection.on(
    "data",
    message => {
      handleMessage(
        message,
        connection
      );
    }
  );

  connection.on(
    "open",
    () => {

      roomConnections.set(
        connection.peer,
        connection
      );
    }
  );

  connection.on(
    "close",
    () => {

      roomConnections.delete(
        connection.peer
      );

      if (isHost) {
        removePlayer(
          connection.peer
        );

        sendRoomState();
      }
    }
  );

  connection.on(
    "error",
    () => {

      roomConnections.delete(
        connection.peer
      );

      if (isHost) {
        removePlayer(
          connection.peer
        );

        sendRoomState();
      }
    }
  );
}


/* =========================================================
   MENSAGENS
========================================================= */

function handleMessage(
  message,
  connection
) {

  if (
    !message ||
    !message.type
  ) {
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
        applyRoomState(
          message.players
        );
      }

      break;


    case "HEARTBEAT":

      if (isHost) {

        const player =
          players.get(
            message.id
          );

        if (player) {
          player.lastSeen =
            Date.now();

          player.connected =
            true;
        }
      }

      break;


    case "LEAVE":

      if (isHost) {

        removePlayer(
          message.id
        );

        sendRoomState();
      }

      break;


    case "START_GAME":

      if (!isHost) {
        startGame(
          message.round || 1
        );
      }

      break;


    case "ROUND_COUNTDOWN":

      if (!isHost) {
        startCountdown(
          message.round
        );
      }

      break;


    case "REFERENCE":

      if (!isHost) {
        startReference();
      }

      break;


    case "RECORD_START":

      if (!isHost) {
        startRecording();
      }

      break;


    case "PLAYBACK_START":

      if (!isHost) {
        startPlayback();
      }

      break;


    case "ROUND_RESULT":

      if (!isHost) {
        showResult(
          message.score,
          message.round
        );
      }

      break;


    case "GAME_FINISH":

      if (!isHost) {
        finishGame();
      }

      break;
  }
}


/* =========================================================
   PLAYERS
========================================================= */

function addPlayer(
  id,
  name
) {

  if (
    !id ||
    id === peer.id
  ) {
    return;
  }

  players.set(
    id,
    {
      id,
      name:
        name ||
        "Jogador",
      host: false,
      connected: true,
      lastSeen: Date.now()
    }
  );

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

  closeVoice(id);

  renderPlayers();
}

function applyRoomState(
  list
) {

  players.clear();

  if (Array.isArray(list)) {

    list.forEach(
      player => {

        players.set(
          player.id,
          player
        );
      }
    );
  }

  renderPlayers();
}

function renderPlayers() {

  playersElement.innerHTML = "";

  players.forEach(
    player => {

      const row =
        document.createElement(
          "div"
        );

      row.className =
        "player";

      const left =
        document.createElement(
          "div"
        );

      left.className =
        "player-left";

      const dot =
        document.createElement(
          "div"
        );

      dot.className =
        "player-dot " +
        (
          player.connected !== false
            ? "online"
            : ""
        );

      const info =
        document.createElement(
          "div"
        );

      const name =
        document.createElement(
          "div"
        );

      name.className =
        "player-name";

      name.textContent =
        player.name +
        (
          player.id === peer?.id
            ? " (você)"
            : ""
        );

      const tag =
        document.createElement(
          "div"
        );

      tag.className =
        "player-tag";

      tag.textContent =
        player.host
          ? "Host"
          : "Jogador";

      info.appendChild(name);
      info.appendChild(tag);

      left.appendChild(dot);
      left.appendChild(info);

      row.appendChild(left);

      playersElement.appendChild(row);
    }
  );

  gamePlayers.textContent =
    `${players.size}/5`;
}


/* =========================================================
   ROOM STATE
========================================================= */

function roomPlayerList() {

  return Array.from(
    players.values()
  ).map(
    player => ({
      id: player.id,
      name: player.name,
      host: player.host,
      connected: player.connected
    })
  );
}

function sendTo(
  id,
  message
) {

  const connection =
    roomConnections.get(id);

  if (
    connection &&
    connection.open
  ) {

    try {
      connection.send(
        message
      );

      return true;

    } catch (_) {}
  }

  return false;
}

function broadcast(
  message
) {

  roomConnections.forEach(
    connection => {

      if (
        connection &&
        connection.open
      ) {

        try {
          connection.send(
            message
          );
        } catch (_) {}
      }
    }
  );
}

function sendRoomState() {

  broadcast({
    type:
      "ROOM_STATE",

    players:
      roomPlayerList()
  });

  renderPlayers();
}


/* =========================================================
   HEARTBEAT
========================================================= */

function startHeartbeat() {

  stopHeartbeat();

  heartbeatTimer =
    setInterval(
      () => {

        if (
          !peer ||
          peer.destroyed
        ) {
          return;
        }

        if (!isHost) {

          sendTo(
            roomPeerId,
            {
              type:
                "HEARTBEAT",

              id:
                peer.id
            }
          );
        }

      },
      1800
    );
}

function stopHeartbeat() {

  if (heartbeatTimer) {

    clearInterval(
      heartbeatTimer
    );

    heartbeatTimer = null;
  }
}

function startPrune() {

  if (!isHost) {
    return;
  }

  if (pruneTimer) {
    clearInterval(
      pruneTimer
    );
  }

  pruneTimer =
    setInterval(
      () => {

        const now =
          Date.now();

        players.forEach(
          (player, id) => {

            if (
              id === peer.id
            ) {
              return;
            }

            if (
              player.lastSeen &&
              now -
                player.lastSeen >
                4500
            ) {

              removePlayer(id);

              sendRoomState();
            }
          }
        );

      },
      1500
    );
}


/* =========================================================
   MICROFONE
========================================================= */

async function getMicrophone() {

  if (localStream) {
    return localStream;
  }

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

  return localStream;
}

function setTracksEnabled(
  enabled
) {

  if (!localStream) {
    return;
  }

  localStream
    .getAudioTracks()
    .forEach(
      track => {
        track.enabled =
          enabled;
      }
    );
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

    if (micEnabled) {

      micEnabled = false;

      /*
       * Só desativa a transmissão.
       * As chamadas recebidas continuam.
       */
      setTracksEnabled(false);

      updateMicUI();

      return;
    }

    try {

      await getMicrophone();

      micEnabled = true;

      setTracksEnabled(true);

      updateMicUI();

      /*
       * Chamada imediatamente.
       * Não espera DataConnection.
       */
      connectVoiceToEveryone();

    } catch (_) {

      voiceStatus.textContent =
        "Não foi possível acessar o microfone.";
    }
  }
);


/* =========================================================
   VOZ
========================================================= */

function voicePeerIds() {

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

  if (
    !isHost &&
    roomPeerId &&
    !ids.includes(roomPeerId)
  ) {
    ids.push(roomPeerId);
  }

  return ids;
}

function connectVoiceToEveryone() {

  if (
    !peer ||
    peer.destroyed ||
    !localStream ||
    !micEnabled
  ) {
    return;
  }

  voicePeerIds().forEach(
    id => {
      createVoiceCall(id);
    }
  );
}

function createVoiceCall(id) {

  if (
    !id ||
    id === peer?.id ||
    !localStream ||
    !micEnabled
  ) {
    return;
  }

  const old =
    voiceCalls.get(id);

  if (old) {
    try {
      old.close();
    } catch (_) {}
  }

  let call;

  try {

    call =
      peer.call(
        id,
        localStream,
        {
          metadata: {
            room: roomCode,
            user: username
          }
        }
      );

  } catch (_) {
    return;
  }

  if (!call) {
    return;
  }

  voiceCalls.set(
    id,
    call
  );

  call.on(
    "stream",
    stream => {

      attachRemoteAudio(
        id,
        stream
      );
    }
  );

  call.on(
    "close",
    () => {

      if (
        voiceCalls.get(id) ===
        call
      ) {
        voiceCalls.delete(id);
      }
    }
  );

  call.on(
    "error",
    () => {

      if (
        voiceCalls.get(id) ===
        call
      ) {
        voiceCalls.delete(id);
      }
    }
  );
}

function answerVoiceCall(
  call
) {

  if (!call) {
    return;
  }

  const callerId =
    call.peer;

  try {

    /*
     * Sempre responde.
     *
     * Se o microfone estiver desligado,
     * a pessoa continua recebendo áudio.
     */
    if (
      micEnabled &&
      localStream
    ) {

      call.answer(
        localStream
      );

    } else {

      call.answer();
    }

  } catch (_) {
    return;
  }

  call.on(
    "stream",
    stream => {

      attachRemoteAudio(
        callerId,
        stream
      );
    }
  );

  call.on(
    "close",
    () => {

      removeRemoteAudio(
        callerId
      );
    }
  );

  call.on(
    "error",
    () => {

      removeRemoteAudio(
        callerId
      );
    }
  );
}

function attachRemoteAudio(
  id,
  stream
) {

  let audio =
    remoteAudioElements.get(id);

  if (!audio) {

    audio =
      document.createElement(
        "audio"
      );

    audio.autoplay = true;
    audio.playsInline = true;
    audio.preload = "none";
    audio.volume = 1;

    audio.style.display =
      "none";

    remoteAudios.appendChild(
      audio
    );

    remoteAudioElements.set(
      id,
      audio
    );
  }

  /*
   * Não usa AudioContext.
   * Não cria ganho, compressor ou filtros.
   * Vai direto do WebRTC para o áudio.
   */
  if (
    audio.srcObject !==
    stream
  ) {

    audio.srcObject =
      stream;
  }

  const play =
    audio.play();

  if (play) {
    play.catch(
      () => {}
    );
  }
}

function removeRemoteAudio(
  id
) {

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

  remoteAudioElements.delete(
    id
  );
}

function closeVoice(id) {

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


/* =========================================================
   VOZ DA PARTIDA
========================================================= */

function updateGameVoiceUI() {

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

    if (gameVoiceEnabled) {

      gameVoiceEnabled =
        false;

      /*
       * Só para de transmitir.
       * Não fecha chamadas.
       */
      setTracksEnabled(false);

      updateGameVoiceUI();

      return;
    }

    try {

      await getMicrophone();

      gameVoiceEnabled =
        true;

      micEnabled = true;

      setTracksEnabled(true);

      updateMicUI();
      updateGameVoiceUI();

      /*
       * Reativa as chamadas imediatamente.
       */
      connectVoiceToEveryone();

    } catch (_) {

      gameVoiceEnabled =
        false;

      updateGameVoiceUI();
    }
  }
);


/* =========================================================
   COMEÇAR PARTIDA
========================================================= */

startButton.addEventListener(
  "click",
  () => {

    if (!isHost) {
      return;
    }

    if (gameStarted) {
      return;
    }

    if (players.size < 1) {
      return;
    }

    gameStarted = true;
    currentRound = 1;

    broadcast({
      type:
        "START_GAME",

      round:
        currentRound
    });

    startGame(
      currentRound
    );
  }
);

function startGame(
  round
) {

  gameStarted = true;

  currentRound =
    round || 1;

  /*
   * A partida não mexe no estado da voz
   * até uma etapa que realmente precise.
   *
   * Portanto vocês conseguem conversar
   * normalmente na partida.
   */
  showScreen(gameScreen);

  gameVoiceEnabled =
    micEnabled;

  updateGameVoiceUI();

  roundText.textContent =
    `Rodada ${currentRound}`;

  gamePlayers.textContent =
    `${players.size}/5`;

  startCountdown(
    currentRound
  );
}


/* =========================================================
   CONTAGEM
========================================================= */

function startCountdown(
  round
) {

  hideGameScreens();

  countdownScreen.classList.remove(
    "hidden"
  );

  roundText.textContent =
    `Rodada ${round}`;

  let count = 5;

  countdownNumber.textContent =
    count;

  clearInterval(
    countdownTimer
  );

  countdownTimer =
    setInterval(
      () => {

        count--;

        countdownNumber.textContent =
          count;

        if (count <= 0) {

          clearInterval(
            countdownTimer
          );

          countdownTimer =
            null;

          if (isHost) {

            broadcast({
              type:
                "REFERENCE"
            });

            startReference();

          } else {

            /*
             * Convidados recebem REFERENCE.
             */
          }
        }

      },
      1000
    );
}


/* =========================================================
   REFERÊNCIA
========================================================= */

function startReference() {

  hideGameScreens();

  referenceScreen.classList.remove(
    "hidden"
  );

  referenceStatus.textContent =
    "Ouça com atenção.";

  /*
   * Pequena pausa para sincronizar
   * a interface de todos.
   */
  setTimeout(
    () => {

      playReferenceSound();

    },
    800
  );

  setTimeout(
    () => {

      if (isHost) {

        broadcast({
          type:
            "RECORD_START"
        });

        startRecording();
      }

    },
    5500
  );
}

referenceButton.addEventListener(
  "click",
  () => {
    playReferenceSound();
  }
);

function playReferenceSound() {

  try {

    if (
      referenceAudioContext
    ) {
      referenceAudioContext.close();
    }

    const AudioCtx =
      window.AudioContext ||
      window.webkitAudioContext;

    referenceAudioContext =
      new AudioCtx();

    const ctx =
      referenceAudioContext;

    const oscillator =
      ctx.createOscillator();

    const gain =
      ctx.createGain();

    oscillator.type =
      "sine";

    oscillator.frequency.value =
      440;

    gain.gain.value =
      0.001;

    oscillator.connect(gain);
    gain.connect(
      ctx.destination
    );

    const now =
      ctx.currentTime;

    oscillator.start(now);

    gain.gain.exponentialRampToValueAtTime(
      0.3,
      now + 0.04
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      now + 0.35
    );

    oscillator.stop(
      now + 0.4
    );

    referenceStatus.textContent =
      "Som reproduzido. Prepare sua imitação.";

  } catch (_) {}
}


/* =========================================================
   GRAVAÇÃO
========================================================= */

async function startRecording() {

  hideGameScreens();

  recordScreen.classList.remove(
    "hidden"
  );

  recordStatus.textContent =
    "Prepare-se...";

  /*
   * Durante a gravação ninguém transmite
   * voz pelo chat.
   */
  gameVoiceEnabled =
    false;

  setTracksEnabled(false);

  updateGameVoiceUI();

  try {

    await getMicrophone();

  } catch (_) {}

  await sleep(900);

  beginRecorder();

  let seconds = 7;

  recordTimerElement.textContent =
    seconds;

  recordStatus.textContent =
    "Gravando...";

  clearInterval(
    recordTimer
  );

  recordTimer =
    setInterval(
      () => {

        seconds--;

        recordTimerElement.textContent =
          seconds;

        if (seconds <= 0) {

          clearInterval(
            recordTimer
          );

          recordTimer =
            null;

          stopRecorder();
        }

      },
      1000
    );
}

function beginRecorder() {

  if (!localStream) {
    return;
  }

  recordedChunks = [];

  if (recordedUrl) {

    URL.revokeObjectURL(
      recordedUrl
    );

    recordedUrl = null;
  }

  recordedBlob = null;

  const tracks =
    localStream.getAudioTracks();

  if (!tracks.length) {
    return;
  }

  const stream =
    new MediaStream(tracks);

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
        stream,
        options
      );

  } catch (_) {

    mediaRecorder =
      new MediaRecorder(
        stream
      );
  }

  mediaRecorder.ondataavailable =
    event => {

      if (
        event.data &&
        event.data.size
      ) {

        recordedChunks.push(
          event.data
        );
      }
    };

  mediaRecorder.onstop =
    () => {

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

        setTimeout(
          () => {

            broadcast({
              type:
                "PLAYBACK_START"
            });

            startPlayback();

          },
          1000
        );
      }
    };

  try {
    mediaRecorder.start();
  } catch (_) {}
}

function stopRecorder() {

  if (
    mediaRecorder &&
    mediaRecorder.state !==
      "inactive"
  ) {

    try {
      mediaRecorder.stop();
    } catch (_) {}
  }
}


/* =========================================================
   PLAYBACK
========================================================= */

function startPlayback() {

  hideGameScreens();

  playbackScreen.classList.remove(
    "hidden"
  );

  /*
   * Aqui ninguém transmite voz.
   * O áudio recebido continua existindo,
   * mas as faixas locais ficam desligadas.
   */
  setTracksEnabled(false);

  gameVoiceEnabled =
    false;

  updateGameVoiceUI();

  playbackName.textContent =
    username;

  playbackStatus.textContent =
    "Ouça a gravação.";

  let seconds = 7;

  playbackTimer.textContent =
    seconds;

  clearInterval(
    playbackTimerHandle
  );

  if (activePlaybackAudio) {

    try {
      activePlaybackAudio.pause();
    } catch (_) {}

    activePlaybackAudio = null;
  }

  if (recordedUrl) {

    activePlaybackAudio =
      new Audio(
        recordedUrl
      );

    activePlaybackAudio.volume =
      1;

    activePlaybackAudio.preload =
      "auto";

    activePlaybackAudio
      .play()
      .catch(() => {});

  } else {

    playbackStatus.textContent =
      "Gravação indisponível.";
  }

  playbackTimerHandle =
    setInterval(
      () => {

        seconds--;

        playbackTimer.textContent =
          Math.max(
            0,
            seconds
          );

        if (seconds <= 0) {

          clearInterval(
            playbackTimerHandle
          );

          playbackTimerHandle =
            null;

          finishRound();
        }

      },
      1000
    );
}


/* =========================================================
   PONTUAÇÃO
========================================================= */

function calculateScore() {

  /*
   * Não usa mais o tamanho do arquivo
   * como se fosse uma IA.
   *
   * Silêncio recebe 0.
   */
  if (
    !recordedBlob ||
    recordedBlob.size < 4000
  ) {
    return 0;
  }

  /*
   * Base provisória enquanto o analisador
   * real de áudio não foi colocado.
   */
  return 50;
}

function finishRound() {

  if (activePlaybackAudio) {

    try {
      activePlaybackAudio.pause();
    } catch (_) {}

    activePlaybackAudio = null;
  }

  const score =
    calculateScore();

  hideGameScreens();

  resultScreen.classList.remove(
    "hidden"
  );

  resultText.textContent =
    `Você fez ${score} pontos nesta rodada.`;

  /*
   * Depois do playback a conversa volta.
   */
  if (micEnabled) {

    gameVoiceEnabled =
      true;

    setTracksEnabled(true);

    updateGameVoiceUI();

    connectVoiceToEveryone();
  }

  if (isHost) {

    broadcast({
      type:
        "ROUND_RESULT",

      score,

      round:
        currentRound
    });

    setTimeout(
      () => {

        if (
          currentRound >=
          MAX_ROUNDS
        ) {

          broadcast({
            type:
              "GAME_FINISH"
          });

          finishGame();

        } else {

          currentRound++;

          broadcast({
            type:
              "ROUND_COUNTDOWN",

            round:
              currentRound
          });

          startCountdown(
            currentRound
          );
        }

      },
      4500
    );
  }
}

function showResult(
  score,
  round
) {

  hideGameScreens();

  resultScreen.classList.remove(
    "hidden"
  );

  resultText.textContent =
    typeof score === "number"
      ? `Você fez ${score} pontos nesta rodada.`
      : "Rodada concluída.";

  /*
   * Conversa volta depois do playback.
   */
  if (micEnabled) {

    gameVoiceEnabled =
      true;

    setTracksEnabled(true);

    updateGameVoiceUI();

    connectVoiceToEveryone();
  }
}


/* =========================================================
   FINAL
========================================================= */

function finishGame() {

  gameStarted = false;

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

  if (activePlaybackAudio) {

    try {
      activePlaybackAudio.pause();
    } catch (_) {}

    activePlaybackAudio = null;
  }

  /*
   * Voz normal volta ao terminar.
   */
  if (micEnabled) {
    setTracksEnabled(true);
    gameVoiceEnabled = true;
  } else {
    gameVoiceEnabled = false;
  }

  updateGameVoiceUI();

  setTimeout(
    () => {

      showScreen(
        roomScreen
      );

      setStatus(
        "Partida finalizada."
      );

      if (isHost) {
        startButton.classList.remove(
          "hidden"
        );
      }

    },
    1000
  );
}


/* =========================================================
   UI GAME
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
   COPIAR
========================================================= */

copyCodeButton.addEventListener(
  "click",
  async () => {

    try {

      await navigator.clipboard.writeText(
        roomCode
      );

      copyCodeButton.textContent =
        "Código copiado";

      setTimeout(
        () => {
          copyCodeButton.textContent =
            "Copiar código";
        },
        1400
      );

    } catch (_) {

      setStatus(
        "Código: " +
        roomCode
      );
    }
  }
);


/* =========================================================
   SAIR
========================================================= */

leaveRoomButton.addEventListener(
  "click",
  leaveEverything
);

function sendLeave() {

  if (
    !peer ||
    peer.destroyed ||
    isHost
  ) {
    return;
  }

  const connection =
    roomConnections.get(
      roomPeerId
    );

  if (
    connection &&
    connection.open
  ) {

    try {

      connection.send({
        type:
          "LEAVE",

        id:
          peer.id
      });

    } catch (_) {}
  }
}

function leaveEverything() {

  sendLeave();

  stopHeartbeat();

  if (pruneTimer) {

    clearInterval(
      pruneTimer
    );

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
      .forEach(
        track => track.stop()
      );

    localStream = null;
  }

  cleanupPeer();

  players.clear();

  roomCode = "";
  roomPeerId = "";

  isHost = false;
  gameStarted = false;

  micEnabled = false;
  gameVoiceEnabled = false;

  updateMicUI();
  updateGameVoiceUI();

  showScreen(
    homeScreen
  );
}

function cleanupPeer() {

  if (peer) {

    try {
      peer.destroy();
    } catch (_) {}

    peer = null;
  }
}

window.addEventListener(
  "beforeunload",
  sendLeave
);


/* =========================================================
   LOGOUT
========================================================= */

logoutButton.addEventListener(
  "click",
  () => {

    leaveEverything();

    localStorage.removeItem(
      "shadow_games_username"
    );

    username = "";

    usernameInput.value = "";

    showScreen(
      loginScreen
    );
  }
);


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

updateMicUI();
updateGameVoiceUI();

loadUser();
