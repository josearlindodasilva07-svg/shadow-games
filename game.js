"use strict";

/*
  SHADOW GAMES
  Multiplayer P2P
  PeerJS + WebRTC

  Principais correções:
  - Cada jogador possui playerId próprio.
  - Nome fica associado ao playerId.
  - Sala nunca usa o nome local para desenhar outro jogador.
  - Gravações são enviadas por DataConnection.
  - Áudios grandes são divididos em chunks.
  - Host reúne todas as gravações.
  - Host distribui as gravações para os jogadores.
  - Playback usa o áudio REAL gravado.
  - Pontuação analisa energia, duração, ritmo e presença de voz/som.
*/


/* =========================================================
   ELEMENTOS
========================================================= */

const $ = (id) => document.getElementById(id);

const loginSection = $("login");
const homeSection = $("home");
const roomSection = $("room");
const gameSection = $("game");

const usernameInput = $("username");
const loginButton = $("loginButton");
const loginStatus = $("loginStatus");

const profileAvatar = $("profileAvatar");
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

const connectionBadge = $("connectionBadge");
const statusElement = $("status");

const micButton = $("micButton");
const voiceStatus = $("voiceStatus");

const playerCountElement = $("playerCount");
const playersElement = $("players");

const startButton = $("start");
const leaveRoomButton = $("leaveRoom");

const gameVoiceButton = $("gameVoiceButton");

const roundText = $("roundText");
const gamePlayers = $("gamePlayers");

const countdownScreen = $("countdownScreen");
const countdownNumber = $("countdownNumber");
const countdownHint = $("countdownHint");

const referenceScreen = $("referenceScreen");
const referenceDescription = $("referenceDescription");
const referenceType = $("referenceType");
const referenceButton = $("referenceButton");
const referenceWait = $("referenceWait");

const recordScreen = $("recordScreen");
const recordTimerElement = $("recordTimer");
const recordStatus = $("recordStatus");

const uploadScreen = $("uploadScreen");
const uploadProgressBar = $("uploadProgressBar");
const uploadProgressText = $("uploadProgressText");

const playbackScreen = $("playbackScreen");
const playbackPlayerName = $("playbackPlayerName");
const playbackStatus = $("playbackStatus");
const playbackScore = $("playbackScore");

const resultScreen = $("resultScreen");
const resultList = $("resultList");
const resultText = $("resultText");

const finalScreen = $("finalScreen");
const finalList = $("finalList");
const backToRoomButton = $("backToRoom");

const remoteAudios = $("remoteAudios");


/* =========================================================
   CONSTANTES
========================================================= */

const MAX_PLAYERS = 5;
const TOTAL_ROUNDS = 4;

const RECORD_SECONDS = 7;
const REFERENCE_DELAY = 3500;

const HEARTBEAT_INTERVAL = 1500;
const PLAYER_TIMEOUT = 6000;

const CHUNK_SIZE = 24 * 1024;


/* =========================================================
   ESTADO DO USUÁRIO
========================================================= */

let username = "";
let playerId = "";

let peer = null;
let myPeerId = "";

let isHost = false;
let roomCode = "";
let hostPeerId = "";

let joinedRoom = false;
let gameStarted = false;

let localStream = null;
let micEnabled = false;
let gameVoiceEnabled = false;

let currentRound = 1;

let heartbeatTimer = null;
let roundTimer = null;
let recordTimer = null;

let recorder = null;
let recordingChunks = [];

let currentRecordingBlob = null;

let currentReferenceData = null;
let currentReferenceBuffer = null;

let referencePlayed = false;
let recordingStarted = false;

let playbackAudio = null;

let waitingForRecordings = false;

let roomPlayers = {};


/* =========================================================
   CONEXÕES DE DADOS
========================================================= */

const dataConnections = new Map();


/* =========================================================
   CONEXÕES DE VOZ
========================================================= */

const voiceCalls = new Map();
const incomingVoiceCalls = new Map();


/* =========================================================
   GRAVAÇÕES
========================================================= */

/*
  recordings[round][playerId] = {
    playerId,
    name,
    blob,
    url,
    size,
    received
  }
*/

const recordings = {};


/*
  transferBuffers[round][playerId] = {
    name,
    mimeType,
    totalChunks,
    chunks: [],
    received: 0,
    totalBytes: 0
  }
*/

const transferBuffers = {};


/*
  scores[round][playerId]
*/

const scores = {};


/* =========================================================
   LOGIN
========================================================= */

function createPlayerId() {

  let id = localStorage.getItem("shadow_player_id");

  if (!id) {

    id =
      "player-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 10);

    localStorage.setItem(
      "shadow_player_id",
      id
    );
  }

  return id;
}


function loadLogin() {

  const savedName =
    localStorage.getItem("shadow_username");

  if (savedName) {

    username = savedName;
    playerId = createPlayerId();

    showHome();
  }
}


function login() {

  const name =
    usernameInput.value
      .trim()
      .replace(/\s+/g, " ");

  if (!name) {

    loginStatus.textContent =
      "Digite um nome.";

    return;
  }

  if (name.length < 2) {

    loginStatus.textContent =
      "Use pelo menos 2 caracteres.";

    return;
  }

  username = name.slice(0, 16);

  playerId = createPlayerId();

  localStorage.setItem(
    "shadow_username",
    username
  );

  loginStatus.textContent = "";

  showHome();
}


function logout() {

  leaveRoom(true);

  localStorage.removeItem(
    "shadow_username"
  );

  username = "";
  showSection(loginSection);
}


/* =========================================================
   TELAS
========================================================= */

function showSection(section) {

  loginSection.classList.add("hidden");
  homeSection.classList.add("hidden");
  roomSection.classList.add("hidden");
  gameSection.classList.add("hidden");

  section.classList.remove("hidden");
}


function showHome() {

  profileName.textContent = username;

  profileAvatar.textContent =
    username.charAt(0).toUpperCase();

  showSection(homeSection);
}


function showRoom() {

  showSection(roomSection);

  if (gameStarted) {
    gameSection.classList.remove("hidden");
  }
}


function showGame() {

  gameSection.classList.remove("hidden");
  roomSection.classList.add("hidden");
}


/* =========================================================
   JOIN PANEL
========================================================= */

joinButton.addEventListener(
  "click",
  () => {

    joinPanel.classList.remove("hidden");

    joinCodeInput.value = "";

    joinStatus.textContent = "";

    setTimeout(() => {
      joinCodeInput.focus();
    }, 50);
  }
);


joinCancel.addEventListener(
  "click",
  () => {

    joinPanel.classList.add("hidden");

    joinStatus.textContent = "";
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

      joinStatus.textContent =
        "Digite um código válido.";

      return;
    }

    joinStatus.textContent =
      "Entrando na sala...";

    joinRoom(code);
  }
);


joinCodeInput.addEventListener(
  "keydown",
  (event) => {

    if (event.key === "Enter") {

      joinConfirm.click();
    }
  }
);


/* =========================================================
   ROOM CODE
========================================================= */

function generateRoomCode() {

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "";

  for (let i = 0; i < 6; i++) {

    result +=
      chars[
        Math.floor(
          Math.random() * chars.length
        )
      ];
  }

  return result;
}


function normalizeRoomCode(code) {

  return String(code || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}


function hostPeerIdFor(code) {

  return "shadow-room-" + code;
}


/* =========================================================
   CRIAR SALA
========================================================= */

createButton.addEventListener(
  "click",
  createRoom
);


function createRoom() {

  if (joinedRoom) {
    return;
  }

  roomCode =
    generateRoomCode();

  isHost = true;

  hostPeerId =
    hostPeerIdFor(roomCode);

  connectionBadge.textContent =
    "Criando";

  startButton.disabled = true;

  statusElement.textContent =
    "Criando sala...";

  roomCodeElement.textContent =
    roomCode;

  peer =
    new Peer(
      hostPeerId,
      peerOptions()
    );

  setupPeerEvents();

  peer.on(
    "open",
    () => {

      myPeerId = peer.id;

      joinedRoom = true;

      roomPlayers = {};

      addOrUpdatePlayer({
        playerId,
        peerId: myPeerId,
        name: username,
        isHost: true,
        lastSeen: Date.now()
      });

      connectionBadge.textContent =
        "Online";

      connectionBadge.classList.add(
        "connected"
      );

      statusElement.textContent =
        "Sala pronta. Compartilhe o código.";

      showRoom();

      startHeartbeat();

      updateRoomUI();
    }
  );
}


/* =========================================================
   ENTRAR NA SALA
========================================================= */

function joinRoom(code) {

  if (joinedRoom) {
    return;
  }

  roomCode = code;

  isHost = false;

  hostPeerId =
    hostPeerIdFor(roomCode);

  connectionBadge.textContent =
    "Conectando";

  statusElement.textContent =
    "Entrando na sala...";

  roomCodeElement.textContent =
    roomCode;

  startButton.classList.add("hidden");

  joinPanel.classList.add("hidden");

  showRoom();

  /*
    O peer do jogador é separado do peer da sala.
    Isso evita misturar identidade de jogador
    com identidade do host.
  */

  const guestId =
    "shadow-player-" +
    Math.random()
      .toString(36)
      .slice(2, 10);

  peer =
    new Peer(
      guestId,
      peerOptions()
    );

  setupPeerEvents();

  peer.on(
    "open",
    () => {

      myPeerId = peer.id;

      joinedRoom = true;

      connectionBadge.textContent =
        "Online";

      connectionBadge.classList.add(
        "connected"
      );

      statusElement.textContent =
        "Conectando à sala...";

      startHeartbeat();

      connectToHost();
    }
  );
}


/* =========================================================
   PEER OPTIONS
========================================================= */

function peerOptions() {

  return {
    debug: 0,

    config: {
      iceServers: [
        {
          urls:
            "stun:stun.l.google.com:19302"
        }
      ],

      sdpSemantics:
        "unified-plan"
    }
  };
}


/* =========================================================
   PEER EVENTS
========================================================= */

function setupPeerEvents() {

  if (!peer) {
    return;
  }


  peer.on(
    "connection",
    (conn) => {

      setupDataConnection(
        conn
      );
    }
  );


  peer.on(
    "call",
    (call) => {

      handleIncomingVoiceCall(
        call
      );
    }
  );


  peer.on(
    "disconnected",
    () => {

      connectionBadge.textContent =
        "Reconectando";

      connectionBadge.classList.remove(
        "connected"
      );

      if (
        peer &&
        !peer.destroyed
      ) {

        try {
          peer.reconnect();
        } catch {}
      }
    }
  );


  peer.on(
    "error",
    (error) => {

      console.warn(
        "PeerJS:",
        error.type
      );

      if (
        error.type ===
          "peer-unavailable" &&
        !isHost &&
        joinedRoom
      ) {

        statusElement.textContent =
          "Sala não encontrada ou fechada.";

      } else if (
        error.type ===
        "unavailable-id"
      ) {

        if (isHost) {

          roomCode =
            generateRoomCode();

          hostPeerId =
            hostPeerIdFor(roomCode);

          roomCodeElement.textContent =
            roomCode;
        }
      }
    }
  );


  peer.on(
    "close",
    () => {

      connectionBadge.textContent =
        "Offline";

      connectionBadge.classList.remove(
        "connected"
      );
    }
  );
}


/* =========================================================
   DATA CONNECTION
========================================================= */

function connectToHost() {

  if (
    !peer ||
    peer.destroyed
  ) {
    return;
  }

  const conn =
    peer.connect(
      hostPeerId,
      {
        reliable: true,
        serialization: "binary"
      }
    );

  setupDataConnection(
    conn
  );
}


function setupDataConnection(conn) {

  if (!conn) {
    return;
  }

  const remoteId =
    conn.peer;

  const old =
    dataConnections.get(
      remoteId
    );

  /*
    Evita duplicar conexões.
  */

  if (
    old &&
    old !== conn &&
    old.open
  ) {

    try {
      conn.close();
    } catch {}

    return;
  }

  dataConnections.set(
    remoteId,
    conn
  );


  conn.on(
    "open",
    () => {

      if (conn !== dataConnections.get(remoteId)) {
        return;
      }

      if (isHost) {

        sendToConnection(
          conn,
          {
            type: "ROOM_HELLO",
            player: {
              playerId,
              peerId: myPeerId,
              name: username,
              isHost: true
            },
            players:
              serializePlayers(),
            gameStarted
          }
        );

      } else {

        sendToConnection(
          conn,
          {
            type: "JOIN",
            player: {
              playerId,
              peerId: myPeerId,
              name: username,
              isHost: false
            }
          }
        );
      }

      updateRoomUI();
    }
  );


  conn.on(
    "data",
    (message) => {

      handleDataMessage(
        conn,
        message
      );
    }
  );


  conn.on(
    "close",
    () => {

      if (
        dataConnections.get(
          remoteId
        ) === conn
      ) {

        dataConnections.delete(
          remoteId
        );
      }

      if (isHost) {

        removePlayerByPeerId(
          remoteId
        );

        broadcastRoomState();
      }

      updateRoomUI();
    }
  );


  conn.on(
    "error",
    () => {

      if (
        dataConnections.get(
          remoteId
        ) === conn
      ) {

        dataConnections.delete(
          remoteId
        );
      }

      if (isHost) {

        removePlayerByPeerId(
          remoteId
        );

        broadcastRoomState();
      }

      updateRoomUI();
    }
  );
}


/* =========================================================
   DATA SEND
========================================================= */

function sendToConnection(
  conn,
  data
) {

  if (
    !conn ||
    !conn.open
  ) {
    return false;
  }

  try {

    conn.send(data);

    return true;

  } catch {

    return false;
  }
}


function sendToPeer(
  peerIdToSend,
  data
) {

  const conn =
    dataConnections.get(
      peerIdToSend
    );

  if (!conn) {
    return false;
  }

  return sendToConnection(
    conn,
    data
  );
}


function broadcast(
  data,
  exceptPeerId = null
) {

  for (
    const [remotePeerId, conn]
    of dataConnections
  ) {

    if (
      remotePeerId ===
      exceptPeerId
    ) {
      continue;
    }

    sendToConnection(
      conn,
      data
    );
  }
}


/* =========================================================
   MESSAGE ROUTER
========================================================= */

function handleDataMessage(
  conn,
  message
) {

  if (!message) {
    return;
  }


  /*
    Mensagem JOIN
  */

  if (
    message.type ===
    "JOIN"
  ) {

    if (!isHost) {
      return;
    }

    handlePlayerJoin(
      conn,
      message.player
    );

    return;
  }


  /*
    Estado da sala
  */

  if (
    message.type ===
    "ROOM_STATE"
  ) {

    applyRoomState(
      message.players
    );

    if (
      typeof message.gameStarted ===
      "boolean"
    ) {

      gameStarted =
        message.gameStarted;
    }

    updateRoomUI();

    return;
  }


  /*
    Remoção de jogador
  */

  if (
    message.type ===
    "PLAYER_LEFT"
  ) {

    if (
      message.playerId
    ) {

      delete roomPlayers[
        message.playerId
      ];

      updateRoomUI();
    }

    return;
  }


  /*
    Heartbeat
  */

  if (
    message.type ===
    "HEARTBEAT"
  ) {

    if (
      isHost &&
      message.player
    ) {

      const existing =
        roomPlayers[
          message.player.playerId
        ];

      if (existing) {

        existing.lastSeen =
          Date.now();

        existing.peerId =
          message.player.peerId;

        existing.name =
          message.player.name;
      }

      broadcastRoomState();
    }

    return;
  }


  /*
    Começo da partida
  */

  if (
    message.type ===
    "GAME_START"
  ) {

    applyGameStart(
      message
    );

    return;
  }


  /*
    Referência
  */

  if (
    message.type ===
    "REFERENCE"
  ) {

    applyReference(
      message
    );

    return;
  }


  /*
    Começo da gravação
  */

  if (
    message.type ===
    "RECORD_START"
  ) {

    applyRecordStart(
      message
    );

    return;
  }


  /*
    Chunk de gravação
  */

  if (
    message.type ===
    "RECORD_META"
  ) {

    receiveRecordMeta(
      message
    );

    return;
  }


  if (
    message.type ===
    "RECORD_CHUNK"
  ) {

    receiveRecordChunk(
      message
    );

    return;
  }


  if (
    message.type ===
    "RECORD_COMPLETE"
  ) {

    receiveRecordComplete(
      message
    );

    return;
  }


  /*
    Playback
  */

  if (
    message.type ===
    "PLAYBACK_PLAN"
  ) {

    applyPlaybackPlan(
      message
    );

    return;
  }


  if (
    message.type ===
    "PLAYBACK_SCORE"
  ) {

    applyPlaybackScore(
      message
    );

    return;
  }


  /*
    Resultado
  */

  if (
    message.type ===
    "ROUND_RESULT"
  ) {

    applyRoundResult(
      message
    );

    return;
  }


  /*
    Próxima rodada
  */

  if (
    message.type ===
    "NEXT_ROUND"
  ) {

    applyNextRound(
      message
    );

    return;
  }


  /*
    Final
  */

  if (
    message.type ===
    "GAME_FINISH"
  ) {

    applyGameFinish(
      message
    );

    return;
  }
}


/* =========================================================
   PLAYERS
========================================================= */

function addOrUpdatePlayer(player) {

  if (!player) {
    return;
  }

  if (!player.playerId) {
    return;
  }

  /*
    O playerId é a identidade real.
    Nunca substituímos o nome de outro jogador
    pelo username local.
  */

  roomPlayers[
    player.playerId
  ] = {

    playerId:
      player.playerId,

    peerId:
      player.peerId || "",

    name:
      String(
        player.name || "Jogador"
      ).slice(0, 16),

    isHost:
      !!player.isHost,

    lastSeen:
      Date.now(),

    connected:
      true
  };
}


function removePlayerByPeerId(
  peerId
) {

  if (!peerId) {
    return;
  }

  for (
    const id in roomPlayers
  ) {

    if (
      roomPlayers[id].peerId ===
      peerId
    ) {

      delete roomPlayers[id];

      removeVoiceConnection(
        peerId
      );
    }
  }

  updateRoomUI();
}


function serializePlayers() {

  return Object.values(
    roomPlayers
  ).map(
    (player) => ({

      playerId:
        player.playerId,

      peerId:
        player.peerId,

      name:
        player.name,

      isHost:
        player.isHost,

      connected:
        player.connected
    })
  );
}


function applyRoomState(
  players
) {

  roomPlayers = {};

  if (!Array.isArray(players)) {
    return;
  }

  for (
    const player of players
  ) {

    addOrUpdatePlayer({
      ...player,
      lastSeen: Date.now()
    });
  }
}


function handlePlayerJoin(
  conn,
  player
) {

  if (!player) {
    return;
  }

  if (
    Object.keys(roomPlayers).length >=
    MAX_PLAYERS
  ) {

    sendToConnection(
      conn,
      {
        type: "ROOM_FULL"
      }
    );

    try {
      conn.close();
    } catch {}

    return;
  }


  /*
    Corrige identidade:
    peerId vem da conexão,
    nome vem do jogador que entrou.
  */

  const safePlayer = {

    playerId:
      String(
        player.playerId ||
        "player-" +
        Math.random()
          .toString(36)
          .slice(2)
      ),

    peerId:
      conn.peer,

    name:
      String(
        player.name ||
        "Jogador"
      ).slice(0, 16),

    isHost: false,

    lastSeen: Date.now(),

    connected: true
  };


  addOrUpdatePlayer(
    safePlayer
  );


  sendToConnection(
    conn,
    {
      type: "ROOM_STATE",
      players:
        serializePlayers(),
      gameStarted
    }
  );


  broadcastRoomState();
}


function broadcastRoomState() {

  if (!isHost) {
    return;
  }

  const message = {

    type: "ROOM_STATE",

    players:
      serializePlayers(),

    gameStarted
  };

  broadcast(message);

  updateRoomUI();
}


function updateRoomUI() {

  const players =
    Object.values(
      roomPlayers
    );

  const count =
    players.length;


  playerCountElement.textContent =
    `${count}/${MAX_PLAYERS}`;

  gamePlayers.textContent =
    `${count}/${MAX_PLAYERS}`;


  playersElement.innerHTML = "";


  const sorted =
    players.sort(
      (a, b) => {

        if (
          a.isHost &&
          !b.isHost
        ) {
          return -1;
        }

        if (
          !a.isHost &&
          b.isHost
        ) {
          return 1;
        }

        return a.name.localeCompare(
          b.name,
          "pt-BR"
        );
      }
    );


  for (
    const player of sorted
  ) {

    const item =
      document.createElement(
        "div"
      );

    item.className =
      "player";


    const avatar =
      document.createElement(
        "div"
      );

    avatar.className =
      "player-avatar";

    avatar.textContent =
      player.name
        .charAt(0)
        .toUpperCase();


    const info =
      document.createElement(
        "div"
      );

    info.className =
      "player-info";


    const name =
      document.createElement(
        "div"
      );

    name.className =
      "player-name";

    /*
      IMPORTANTE:
      usa o nome salvo naquele player.
    */

    name.textContent =
      player.name;


    const playerStatus =
      document.createElement(
        "div"
      );

    playerStatus.className =
      "player-status";

    if (
      player.playerId ===
      playerId
    ) {

      playerStatus.textContent =
        "Você";

    } else {

      playerStatus.textContent =
        "Conectado";
    }


    info.appendChild(name);
    info.appendChild(playerStatus);


    item.appendChild(avatar);
    item.appendChild(info);


    if (player.isHost) {

      const host =
        document.createElement(
          "div"
        );

      host.className =
        "player-host";

      host.textContent =
        "HOST";

      item.appendChild(host);
    }


    playersElement.appendChild(
      item
    );
  }


  if (isHost) {

    startButton.classList.remove(
      "hidden"
    );

    startButton.disabled =
      count < 1;

  } else {

    startButton.classList.add(
      "hidden"
    );
  }
}


/* =========================================================
   HEARTBEAT
========================================================= */

function startHeartbeat() {

  stopHeartbeat();

  heartbeatTimer =
    setInterval(
      () => {

        if (!joinedRoom) {
          return;
        }

        if (isHost) {

          prunePlayers();

        } else {

          sendHeartbeat();
        }

      },
      HEARTBEAT_INTERVAL
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


function sendHeartbeat() {

  const hostConnection =
    findHostConnection();

  if (
    !hostConnection ||
    !hostConnection.open
  ) {

    connectToHost();

    return;
  }


  sendToConnection(
    hostConnection,
    {
      type: "HEARTBEAT",

      player: {

        playerId,
        peerId: myPeerId,
        name: username
      }
    }
  );
}


function findHostConnection() {

  for (
    const [peerIdRemote, conn]
    of dataConnections
  ) {

    if (
      peerIdRemote ===
      hostPeerId
    ) {

      return conn;
    }
  }

  return null;
}


function prunePlayers() {

  const now =
    Date.now();

  let changed = false;


  for (
    const id in roomPlayers
  ) {

    if (
      id === playerId
    ) {
      continue;
    }

    const player =
      roomPlayers[id];

    if (
      now -
      (player.lastSeen || 0)
      >
      PLAYER_TIMEOUT
    ) {

      const peerIdRemote =
        player.peerId;

      delete roomPlayers[id];

      if (peerIdRemote) {

        const conn =
          dataConnections.get(
            peerIdRemote
          );

        if (conn) {

          try {
            conn.close();
          } catch {}
        }

        removeVoiceConnection(
          peerIdRemote
        );
      }

      broadcast({
        type: "PLAYER_LEFT",
        playerId: id
      });

      changed = true;
    }
  }


  if (changed) {
    broadcastRoomState();
  }

  updateRoomUI();
}


/* =========================================================
   VOICE
========================================================= */

micButton.addEventListener(
  "click",
  async () => {

    if (!micEnabled) {

      await enableMicrophone();

    } else {

      disableMicrophone();
    }
  }
);


gameVoiceButton.addEventListener(
  "click",
  async () => {

    /*
      OFF não fecha recebimento.
      Apenas para de transmitir.
    */

    if (!gameVoiceEnabled) {

      if (!localStream) {

        const ok =
          await enableMicrophone();

        if (!ok) {
          return;
        }
      }

      gameVoiceEnabled = true;

      setOutgoingTracksEnabled(
        true
      );

      updateGameVoiceButton();

      return;
    }


    gameVoiceEnabled = false;

    setOutgoingTracksEnabled(
      false
    );

    updateGameVoiceButton();
  }
);


async function enableMicrophone() {

  if (localStream) {

    micEnabled = true;

    setOutgoingTracksEnabled(
      !gameStarted ||
      gameVoiceEnabled
    );

    updateVoiceUI();

    establishVoiceConnections();

    return true;
  }


  try {

    localStream =
      await navigator.mediaDevices
        .getUserMedia({

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


    micEnabled = true;

    /*
      Dentro da partida começa OFF.
    */

    if (gameStarted) {

      gameVoiceEnabled = false;

      setOutgoingTracksEnabled(
        false
      );

    } else {

      setOutgoingTracksEnabled(
        true
      );
    }


    updateVoiceUI();

    establishVoiceConnections();

    return true;

  } catch (error) {

    console.warn(
      "Microfone:",
      error
    );

    voiceStatus.textContent =
      "Permissão do microfone negada.";

    return false;
  }
}


function disableMicrophone() {

  micEnabled = false;

  gameVoiceEnabled = false;

  /*
    Não fechamos as MediaConnections.
    Apenas desligamos o envio.
  */

  setOutgoingTracksEnabled(
    false
  );

  updateVoiceUI();

  updateGameVoiceButton();
}


function setOutgoingTracksEnabled(
  enabled
) {

  if (!localStream) {
    return;
  }

  for (
    const track of localStream.getAudioTracks()
  ) {

    track.enabled =
      !!enabled;
  }
}


function updateVoiceUI() {

  if (!micEnabled) {

    micButton.textContent =
      "Ativar microfone";

    micButton.classList.remove(
      "active"
    );

    voiceStatus.textContent =
      "Microfone desligado";

    return;
  }


  micButton.textContent =
    "Desativar microfone";

  micButton.classList.add(
    "active"
  );


  if (
    gameStarted &&
    !gameVoiceEnabled
  ) {

    voiceStatus.textContent =
      "Microfone preparado • voz da partida OFF";

  } else {

    voiceStatus.textContent =
      "Microfone ativo";
  }
}


function updateGameVoiceButton() {

  if (gameVoiceEnabled) {

    gameVoiceButton.textContent =
      "Voz: ON";

    gameVoiceButton.classList.remove(
      "off"
    );

    gameVoiceButton.classList.add(
      "active"
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


/* =========================================================
   VOICE CONNECTIONS
========================================================= */

function voicePeerIds() {

  return Object.values(
    roomPlayers
  )
    .filter(
      (player) =>
        player.playerId !==
        playerId &&
        player.peerId
    )
    .map(
      (player) =>
        player.peerId
    );
}


function establishVoiceConnections() {

  if (
    !peer ||
    !localStream
  ) {
    return;
  }


  /*
    Apenas o menor peerId inicia a chamada.
    Isso evita A chamar B e B chamar A ao mesmo tempo.
  */

  const others =
    voicePeerIds();


  for (
    const remotePeerId of others
  ) {

    if (
      remotePeerId ===
      myPeerId
    ) {
      continue;
    }


    const shouldInitiate =
      String(myPeerId)
        .localeCompare(
          String(remotePeerId)
        ) < 0;


    if (!shouldInitiate) {
      continue;
    }


    const existing =
      voiceCalls.get(
        remotePeerId
      );


    if (
      existing &&
      !existing.destroyed
    ) {
      continue;
    }


    createVoiceCall(
      remotePeerId
    );
  }
}


function createVoiceCall(
  remotePeerId
) {

  if (
    !peer ||
    !localStream ||
    !remotePeerId
  ) {
    return;
  }


  if (
    remotePeerId ===
    myPeerId
  ) {
    return;
  }


  const old =
    voiceCalls.get(
      remotePeerId
    );


  if (
    old &&
    !old.destroyed
  ) {

    return;
  }


  try {

    const call =
      peer.call(
        remotePeerId,
        localStream,
        {
          metadata: {
            playerId,
            name: username
          }
        }
      );


    voiceCalls.set(
      remotePeerId,
      call
    );


    setupVoiceCall(
      call,
      remotePeerId,
      true
    );

  } catch {}
}


function handleIncomingVoiceCall(
  call
) {

  if (!call) {
    return;
  }


  const remotePeerId =
    call.peer;


  /*
    Se já temos uma chamada recebida
    daquele peer, fechamos a antiga.
  */

  const old =
    incomingVoiceCalls.get(
      remotePeerId
    );


  if (
    old &&
    old !== call
  ) {

    try {
      old.close();
    } catch {}
  }


  incomingVoiceCalls.set(
    remotePeerId,
    call
  );


  try {

    /*
      Mesmo com voz OFF, respondemos sem
      fechar a chamada. Isso permite ouvir.
    */

    if (localStream) {

      call.answer(
        localStream
      );

    } else {

      call.answer();
    }

  } catch {

    try {
      call.close();
    } catch {}

    return;
  }


  setupVoiceCall(
    call,
    remotePeerId,
    false
  );
}


function setupVoiceCall(
  call,
  remotePeerId,
  outgoing
) {

  if (!call) {
    return;
  }


  call.on(
    "stream",
    (stream) => {

      attachRemoteVoice(
        remotePeerId,
        stream
      );
    }
  );


  call.on(
    "close",
    () => {

      if (
        voiceCalls.get(
          remotePeerId
        ) === call
      ) {

        voiceCalls.delete(
          remotePeerId
        );
      }


      if (
        incomingVoiceCalls.get(
          remotePeerId
        ) === call
      ) {

        incomingVoiceCalls.delete(
          remotePeerId
        );
      }
    }
  );


  call.on(
    "error",
    () => {

      if (
        voiceCalls.get(
          remotePeerId
        ) === call
      ) {

        voiceCalls.delete(
          remotePeerId
        );
      }


      if (
        incomingVoiceCalls.get(
          remotePeerId
        ) === call
      ) {

        incomingVoiceCalls.delete(
          remotePeerId
        );
      }
    }
  );
}


function attachRemoteVoice(
  remotePeerId,
  stream
) {

  let audio =
    document.querySelector(
      `audio[data-peer="${CSS.escape(remotePeerId)}"]`
    );


  if (!audio) {

    audio =
      document.createElement(
        "audio"
      );

    audio.dataset.peer =
      remotePeerId;

    audio.autoplay = true;
    audio.playsInline = true;

    audio.setAttribute(
      "playsinline",
      ""
    );

    audio.volume = 1;

    remoteAudios.appendChild(
      audio
    );
  }


  if (
    audio.srcObject !==
    stream
  ) {

    audio.srcObject =
      stream;
  }


  /*
    Tenta tocar imediatamente.
  */

  const playPromise =
    audio.play();


  if (
    playPromise &&
    typeof playPromise.catch ===
      "function"
  ) {

    playPromise.catch(
      () => {}
    );
  }
}


function removeVoiceConnection(
  remotePeerId
) {

  const outgoing =
    voiceCalls.get(
      remotePeerId
    );

  if (outgoing) {

    try {
      outgoing.close();
    } catch {}
  }


  const incoming =
    incomingVoiceCalls.get(
      remotePeerId
    );

  if (incoming) {

    try {
      incoming.close();
    } catch {}
  }


  voiceCalls.delete(
    remotePeerId
  );

  incomingVoiceCalls.delete(
    remotePeerId
  );


  const audio =
    document.querySelector(
      `audio[data-peer="${CSS.escape(remotePeerId)}"]`
    );

  if (audio) {

    try {
      audio.pause();
    } catch {}

    audio.srcObject = null;

    audio.remove();
  }
}


/* =========================================================
   START GAME
========================================================= */

startButton.addEventListener(
  "click",
  () => {

    if (!isHost) {
      return;
    }

    const count =
      Object.keys(
        roomPlayers
      ).length;

    if (count < 1) {
      return;
    }

    startGameHost();
  }
);


function startGameHost() {

  gameStarted = true;

  currentRound = 1;

  gameVoiceEnabled = false;

  /*
    Não ativa a voz automaticamente.
  */

  if (localStream) {

    setOutgoingTracksEnabled(
      false
    );
  }

  updateGameVoiceButton();
  updateVoiceUI();

  clearRoundTimers();

  const message = {

    type: "GAME_START",

    round: 1,

    totalRounds:
      TOTAL_ROUNDS,

    players:
      serializePlayers()
  };


  broadcast(message);

  applyGameStart(
    message
  );
}


function applyGameStart(
  message
) {

  gameStarted = true;

  currentRound =
    Number(
      message.round || 1
    );

  gameVoiceEnabled = false;

  if (localStream) {

    setOutgoingTracksEnabled(
      false
    );
  }

  updateGameVoiceButton();
  updateVoiceUI();

  showGame();

  updateRoundUI();

  beginRoundCountdown();
}


/* =========================================================
   ROUND UI
========================================================= */

function updateRoundUI() {

  roundText.textContent =
    `Rodada ${currentRound}`;

  gamePlayers.textContent =
    `${Object.keys(roomPlayers).length}/${MAX_PLAYERS}`;
}


/* =========================================================
   COUNTDOWN
========================================================= */

function beginRoundCountdown() {

  clearRoundTimers();

  hideAllGameScreens();

  countdownScreen.classList.remove(
    "hidden"
  );

  let number = 5;

  countdownNumber.textContent =
    number;

  countdownHint.textContent =
    "Prepare-se";


  roundTimer =
    setInterval(
      () => {

        number--;

        if (number <= 0) {

          clearInterval(
            roundTimer
          );

          roundTimer = null;

          if (isHost) {

            startReferencePhase();
          }

          return;
        }

        countdownNumber.textContent =
          number;

      },
      1000
    );
}


/* =========================================================
   REFERENCE
========================================================= */

function startReferencePhase() {

  const reference =
    createReference(
      currentRound
    );


  currentReferenceData =
    reference;


  const message = {

    type: "REFERENCE",

    round:
      currentRound,

    reference
  };


  broadcast(message);

  applyReference(
    message
  );
}


function applyReference(
  message
) {

  if (
    Number(message.round) !==
    Number(currentRound)
  ) {
    return;
  }


  currentReferenceData =
    message.reference;

  referencePlayed = false;

  hideAllGameScreens();

  referenceScreen.classList.remove(
    "hidden"
  );


  referenceType.textContent =
    String(
      currentReferenceData.type
    ).toUpperCase();


  referenceDescription.textContent =
    currentReferenceData.description;


  referenceWait.textContent =
    "Ouça o som antes de gravar.";


  /*
    Reproduz automaticamente uma vez.
    Depois deixa botão para ouvir novamente.
  */

  setTimeout(
    () => {

      playReference();

    },
    700
  );
}


/* =========================================================
   REFERENCE GENERATOR
========================================================= */

function createReference(
  round
) {

  const types = [
    {
      type: "Animal",
      description:
        "Um som curto com dois ataques."
    },
    {
      type: "Máquina",
      description:
        "Um som mecânico em sequência."
    },
    {
      type: "Voz",
      description:
        "Uma sequência de tons para imitar."
    },
    {
      type: "Ruído",
      description:
        "Um som com ataques rápidos."
    }
  ];


  const selected =
    types[
      (round - 1) %
      types.length
    ];


  /*
    Sequência de frequências.
    Não depende de arquivo externo.
  */

  const sequences = [
    [330, 440, 330],
    [180, 240, 180, 260],
    [392, 494, 392],
    [250, 500, 300, 600]
  ];


  return {

    type:
      selected.type,

    description:
      selected.description,

    frequencies:
      sequences[
        (round - 1) %
        sequences.length
      ],

    toneDuration:
      0.26,

    gap:
      0.11
  };
}


async function playReference() {

  if (
    !currentReferenceData
  ) {
    return;
  }


  referencePlayed = true;

  const data =
    currentReferenceData;


  const AudioContext =
    window.AudioContext ||
    window.webkitAudioContext;


  if (!AudioContext) {
    return;
  }


  const ctx =
    new AudioContext();


  try {

    if (
      ctx.state ===
      "suspended"
    ) {

      await ctx.resume();
    }


    let time =
      ctx.currentTime +
      0.05;


    for (
      const frequency
      of data.frequencies
    ) {

      const osc =
        ctx.createOscillator();

      const gain =
        ctx.createGain();


      osc.type =
        "sine";

      osc.frequency.value =
        frequency;


      gain.gain.setValueAtTime(
        0.0001,
        time
      );

      gain.gain.exponentialRampToValueAtTime(
        0.32,
        time + 0.025
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        time +
          data.toneDuration
      );


      osc.connect(
        gain
      );

      gain.connect(
        ctx.destination
      );


      osc.start(
        time
      );

      osc.stop(
        time +
          data.toneDuration +
          0.02
      );


      time +=
        data.toneDuration +
        data.gap;
    }


    setTimeout(
      () => {

        try {
          ctx.close();
        } catch {}

      },
      2200
    );


    referenceWait.textContent =
      "Quando terminar, a gravação começa.";

  } catch {

    try {
      ctx.close();
    } catch {}
  }


  if (isHost) {

    clearRoundTimers();

    roundTimer =
      setTimeout(
        () => {

          startRecordingPhase();

        },
        REFERENCE_DELAY
      );
  }
}


referenceButton.addEventListener(
  "click",
  playReference
);


/* =========================================================
   RECORD START
========================================================= */

function startRecordingPhase() {

  const message = {

    type: "RECORD_START",

    round:
      currentRound,

    duration:
      RECORD_SECONDS
  };


  broadcast(message);

  applyRecordStart(
    message
  );
}


async function applyRecordStart(
  message
) {

  if (
    Number(message.round) !==
    Number(currentRound)
  ) {
    return;
  }


  recordingStarted = true;

  currentRecordingBlob = null;

  hideAllGameScreens();

  recordScreen.classList.remove(
    "hidden"
  );


  recordStatus.textContent =
    "Preparando microfone...";


  /*
    Durante a gravação ninguém transmite
    voz do chat.
  */

  gameVoiceEnabled = false;

  if (localStream) {

    setOutgoingTracksEnabled(
      false
    );
  }

  updateGameVoiceButton();


  const ready =
    await prepareRecordingMicrophone();


  if (!ready) {

    recordStatus.textContent =
      "Microfone não disponível.";

  } else {

    recordStatus.textContent =
      "Grave agora.";
  }


  runRecordingTimer(
    Number(
      message.duration ||
      RECORD_SECONDS
    )
  );
}


async function prepareRecordingMicrophone() {

  if (!localStream) {

    const ok =
      await enableMicrophone();

    if (!ok) {
      return false;
    }
  }


  /*
    A gravação usa o stream local.
    Voz de chat permanece desligada.
  */

  setOutgoingTracksEnabled(
    false
  );

  return true;
}


/* =========================================================
   RECORD TIMER
========================================================= */

function runRecordingTimer(
  seconds
) {

  clearRecordTimer();

  let remaining =
    seconds;

  recordTimerElement.textContent =
    remaining;


  recordTimer =
    setInterval(
      () => {

        remaining--;

        recordTimerElement.textContent =
          Math.max(
            remaining,
            0
          );


        if (remaining <= 0) {

          clearRecordTimer();

          stopRecording();
        }

      },
      1000
    );
}


function clearRecordTimer() {

  if (recordTimer) {

    clearInterval(
      recordTimer
    );

    recordTimer = null;
  }
}


/* =========================================================
   START RECORDING
========================================================= */

async function startRecording() {

  if (!localStream) {

    const ok =
      await prepareRecordingMicrophone();

    if (!ok) {
      return false;
    }
  }


  recordingChunks = [];


  let options = {
    audioBitsPerSecond: 64000
  };


  if (
    MediaRecorder.isTypeSupported(
      "audio/webm;codecs=opus"
    )
  ) {

    options.mimeType =
      "audio/webm;codecs=opus";

  } else if (
    MediaRecorder.isTypeSupported(
      "audio/webm"
    )
  ) {

    options.mimeType =
      "audio/webm";

  } else if (
    MediaRecorder.isTypeSupported(
      "audio/ogg;codecs=opus"
    )
  ) {

    options.mimeType =
      "audio/ogg;codecs=opus";
  }


  try {

    recorder =
      new MediaRecorder(
        localStream,
        options
      );

  } catch {

    recorder =
      new MediaRecorder(
        localStream
      );
  }


  recorder.ondataavailable =
    (event) => {

      if (
        event.data &&
        event.data.size > 0
      ) {

        recordingChunks.push(
          event.data
        );
      }
    };


  recorder.onstop =
    () => {

      const mime =
        recorder.mimeType ||
        "audio/webm";


      currentRecordingBlob =
        new Blob(
          recordingChunks,
          {
            type: mime
          }
        );


      sendCurrentRecording();
    };


  recorder.start(
    150
  );


  return true;
}


/* =========================================================
   STOP RECORDING
========================================================= */

function stopRecording() {

  clearRecordTimer();


  if (
    recorder &&
    recorder.state !==
    "inactive"
  ) {

    try {
      recorder.stop();
    } catch {}
  }


  recordStatus.textContent =
    "Gravação concluída.";

  hideAllGameScreens();

  uploadScreen.classList.remove(
    "hidden"
  );

  uploadProgressBar.style.width =
    "0%";

  uploadProgressText.textContent =
    "0%";


  /*
    Impede voz de continuar durante
    a transferência.
  */

  gameVoiceEnabled = false;

  if (localStream) {

    setOutgoingTracksEnabled(
      false
    );
  }

  updateGameVoiceButton();
}


/* =========================================================
   SEND RECORDING
========================================================= */

async function sendCurrentRecording() {

  if (!currentRecordingBlob) {
    return;
  }


  const blob =
    currentRecordingBlob;


  const arrayBuffer =
    await blob.arrayBuffer();


  const totalBytes =
    arrayBuffer.byteLength;


  const totalChunks =
    Math.ceil(
      totalBytes /
      CHUNK_SIZE
    );


  /*
    Salva imediatamente a gravação local.
  */

  saveReceivedRecording(
    currentRound,
    playerId,
    username,
    blob
  );


  /*
    HOST:
    ele já possui o áudio.
    Só precisa esperar os demais.
  */

  if (isHost) {

    updateUploadProgress(
      100
    );

    registerLocalRecordingComplete();

    return;
  }


  const hostConnection =
    findHostConnection();


  if (
    !hostConnection ||
    !hostConnection.open
  ) {

    uploadProgressText.textContent =
      "Reconectando...";


    setTimeout(
      () => {

        sendCurrentRecording();

      },
      500
    );

    return;
  }


  sendToConnection(
    hostConnection,
    {
      type: "RECORD_META",

      round:
        currentRound,

      playerId,

      name:
        username,

      mimeType:
        blob.type ||
        "audio/webm",

      totalChunks,

      totalBytes
    }
  );


  for (
    let index = 0;
    index < totalChunks;
    index++
  ) {

    const start =
      index *
      CHUNK_SIZE;

    const end =
      Math.min(
        start +
        CHUNK_SIZE,
        totalBytes
      );


    const chunk =
      arrayBuffer.slice(
        start,
        end
      );


    let sent = false;


    /*
      Pequena espera se o DataChannel
      estiver momentaneamente cheio.
    */

    while (!sent) {

      sent =
        sendToConnection(
          hostConnection,
          {
            type:
              "RECORD_CHUNK",

            round:
              currentRound,

            playerId,

            index,

            totalChunks,

            chunk
          }
        );


      if (!sent) {

        await sleep(
          30
        );
      }
    }


    const progress =
      Math.round(
        ((index + 1) /
          totalChunks) *
        100
      );


    updateUploadProgress(
      progress
    );


    /*
      Evita lotar o DataChannel.
    */

    if (
      hostConnection.dataChannel &&
      hostConnection.dataChannel.bufferedAmount >
        512 * 1024
    ) {

      await waitForDataChannelDrain(
        hostConnection
      );
    }
  }


  sendToConnection(
    hostConnection,
    {
      type:
        "RECORD_COMPLETE",

      round:
        currentRound,

      playerId,

      name:
        username,

      mimeType:
        blob.type ||
        "audio/webm",

      totalChunks,

      totalBytes
    }
  );


  updateUploadProgress(
    100
  );
}


function updateUploadProgress(
  percent
) {

  const value =
    Math.max(
      0,
      Math.min(
        100,
        percent
      )
    );


  uploadProgressBar.style.width =
    value + "%";

  uploadProgressText.textContent =
    `${value}%`;
}


function waitForDataChannelDrain(
  conn
) {

  return new Promise(
    (resolve) => {

      const channel =
        conn.dataChannel;

      if (!channel) {

        resolve();

        return;
      }


      const check =
        () => {

          if (
            channel.bufferedAmount <=
            256 * 1024
          ) {

            resolve();

          } else {

            setTimeout(
              check,
              25
            );
          }
        };


      check();
    }
  );
}


/* =========================================================
   HOST RECEBE META
========================================================= */

function receiveRecordMeta(
  message
) {

  if (!isHost) {
    return;
  }


  if (
    Number(message.round) !==
    Number(currentRound)
  ) {
    return;
  }


  if (
    !message.playerId
  ) {
    return;
  }


  if (
    !transferBuffers[
      currentRound
    ]
  ) {

    transferBuffers[
      currentRound
    ] = {};
  }


  transferBuffers[
    currentRound
  ][
    message.playerId
  ] = {

    name:
      getPlayerName(
        message.playerId,
        message.name
      ),

    mimeType:
      message.mimeType ||
      "audio/webm",

    totalChunks:
      Number(
        message.totalChunks ||
        0
      ),

    chunks:
      new Array(
        Number(
          message.totalChunks ||
          0
        )
      ),

    received:
      0,

    totalBytes:
      Number(
        message.totalBytes ||
        0
      ),

    complete:
      false
  };
}


/* =========================================================
   HOST RECEBE CHUNK
========================================================= */

function receiveRecordChunk(
  message
) {

  if (!isHost) {
    return;
  }


  if (
    Number(message.round) !==
    Number(currentRound)
  ) {
    return;
  }


  const roundBuffers =
    transferBuffers[
      currentRound
    ];


  if (!roundBuffers) {
    return;
  }


  const buffer =
    roundBuffers[
      message.playerId
    ];


  if (!buffer) {
    return;
  }


  const index =
    Number(
      message.index
    );


  if (
    index < 0 ||
    index >=
    buffer.totalChunks
  ) {
    return;
  }


  if (
    buffer.chunks[index]
  ) {
    return;
  }


  buffer.chunks[index] =
    message.chunk;


  buffer.received++;


  /*
    Host recebeu uma parte.
    Distribui para os outros jogadores.
  */

  broadcast(
    message
  );


  const progress =
    buffer.totalChunks
      ? Math.round(
          (buffer.received /
            buffer.totalChunks) *
          100
        )
      : 0;


  /*
    Não precisamos mostrar o progresso
    de outro jogador na tela.
  */

  if (
    buffer.received >=
    buffer.totalChunks
  ) {

    finalizeHostTransfer(
      message.playerId
    );
  }
}


/* =========================================================
   HOST RECEBE COMPLETE
========================================================= */

function receiveRecordComplete(
  message
) {

  if (!isHost) {
    return;
  }


  if (
    Number(message.round) !==
    Number(currentRound)
  ) {
    return;
  }


  const player =
    getPlayerById(
      message.playerId
    );


  if (
    player &&
    player.name !==
    message.name
  ) {

    /*
      Mantém o nome oficial da sala.
    */
  }


  const roundBuffers =
    transferBuffers[
      currentRound
    ];


  const buffer =
    roundBuffers &&
    roundBuffers[
      message.playerId
    ];


  if (!buffer) {
    return;
  }


  buffer.complete = true;


  if (
    buffer.received >=
    buffer.totalChunks
  ) {

    finalizeHostTransfer(
      message.playerId
    );
  }
}


/* =========================================================
   FINALIZA TRANSFERÊNCIA NO HOST
========================================================= */

function finalizeHostTransfer(
  targetPlayerId
) {

  if (!isHost) {
    return;
  }


  const roundBuffers =
    transferBuffers[
      currentRound
    ];


  if (!roundBuffers) {
    return;
  }


  const buffer =
    roundBuffers[
      targetPlayerId
    ];


  if (
    !buffer ||
    buffer.finalized
  ) {
    return;
  }


  if (
    buffer.received <
    buffer.totalChunks
  ) {
    return;
  }


  buffer.finalized =
    true;


  const blob =
    chunksToBlob(
      buffer.chunks,
      buffer.mimeType
    );


  const name =
    getPlayerName(
      targetPlayerId,
      buffer.name
    );


  saveReceivedRecording(
    currentRound,
    targetPlayerId,
    name,
    blob
  );


  /*
    Host avisa todos que essa gravação
    terminou.
  */

  broadcast({
    type:
      "RECORD_COMPLETE",

    round:
      currentRound,

    playerId:
      targetPlayerId,

    name,

    mimeType:
      buffer.mimeType,

    totalChunks:
      buffer.totalChunks,

    totalBytes:
      buffer.totalBytes
  });


  checkAllRecordingsReady();
}


/* =========================================================
   LOCAL HOST RECORD
========================================================= */

function registerLocalRecordingComplete() {

  saveReceivedRecording(
    currentRound,
    playerId,
    username,
    currentRecordingBlob
  );

  checkAllRecordingsReady();
}


/* =========================================================
   GUEST RECEBE META
========================================================= */

function receiveGuestRecordMeta(
  message
) {

  if (isHost) {
    return;
  }


  if (
    Number(message.round) !==
    Number(currentRound)
  ) {
    return;
  }


  if (
    !transferBuffers[
      currentRound
    ]
  ) {

    transferBuffers[
      currentRound
    ] = {};
  }


  transferBuffers[
    currentRound
  ][
    message.playerId
  ] = {

    name:
      getPlayerName(
        message.playerId,
        message.name
      ),

    mimeType:
      message.mimeType ||
      "audio/webm",

    totalChunks:
      Number(
        message.totalChunks ||
        0
      ),

    chunks:
      new Array(
        Number(
          message.totalChunks ||
          0
        )
      ),

    received:
      0,

    totalBytes:
      Number(
        message.totalBytes ||
        0
      ),

    complete: false
  };
}


/*
  O router usa a mesma função receiveRecordMeta.
  Quando o guest receber RECORD_META do host,
  precisamos separar de onde veio.
*/

const originalReceiveRecordMeta =
  receiveRecordMeta;


/* =========================================================
   CHUNK RECEIVER UNIVERSAL
========================================================= */

function receiveChunkGuest(
  message
) {

  if (isHost) {
    return;
  }


  const roundBuffers =
    transferBuffers[
      currentRound
    ];


  if (!roundBuffers) {
    return;
  }


  const buffer =
    roundBuffers[
      message.playerId
    ];


  if (!buffer) {
    return;
  }


  const index =
    Number(
      message.index
    );


  if (
    index < 0 ||
    index >=
    buffer.totalChunks
  ) {
    return;
  }


  if (
    buffer.chunks[index]
  ) {
    return;
  }


  buffer.chunks[index] =
    message.chunk;


  buffer.received++;


  if (
    buffer.received >=
    buffer.totalChunks
  ) {

    finalizeGuestTransfer(
      message.playerId
    );
  }
}


function receiveCompleteGuest(
  message
) {

  if (isHost) {
    return;
  }


  const roundBuffers =
    transferBuffers[
      currentRound
    ];


  const buffer =
    roundBuffers &&
    roundBuffers[
      message.playerId
    ];


  if (!buffer) {
    return;
  }


  buffer.complete = true;


  if (
    buffer.received >=
    buffer.totalChunks
  ) {

    finalizeGuestTransfer(
      message.playerId
    );
  }
}


function finalizeGuestTransfer(
  targetPlayerId
) {

  if (isHost) {
    return;
  }


  const roundBuffers =
    transferBuffers[
      currentRound
    ];


  const buffer =
    roundBuffers &&
    roundBuffers[
      targetPlayerId
    ];


  if (
    !buffer ||
    buffer.finalized
  ) {
    return;
  }


  if (
    buffer.received <
    buffer.totalChunks
  ) {
    return;
  }


  buffer.finalized =
    true;


  const blob =
    chunksToBlob(
      buffer.chunks,
      buffer.mimeType
    );


  const name =
    getPlayerName(
      targetPlayerId,
      buffer.name
    );


  saveReceivedRecording(
    currentRound,
    targetPlayerId,
    name,
    blob
  );
}


/* =========================================================
   PATCH DATA ROUTER PARA META/CHUNKS
========================================================= */

function handleRecordingData(
  message
) {

  if (
    message.type ===
    "RECORD_META"
  ) {

    if (isHost) {

      receiveRecordMeta(
        message
      );

    } else {

      receiveGuestRecordMeta(
        message
      );
    }

    return true;
  }


  if (
    message.type ===
    "RECORD_CHUNK"
  ) {

    if (isHost) {

      receiveRecordChunk(
        message
      );

    } else {

      receiveChunkGuest(
        message
      );
    }

    return true;
  }


  if (
    message.type ===
    "RECORD_COMPLETE"
  ) {

    if (isHost) {

      receiveRecordComplete(
        message
      );

    } else {

      receiveCompleteGuest(
        message
      );
    }

    return true;
  }


  return false;
}


/* =========================================================
   SUBSTITUI MESSAGE ROUTER
========================================================= */

const oldHandleDataMessage =
  handleDataMessage;


/*
  Reimplementação para interceptar
  mensagens binárias da gravação.
*/

function routeDataMessage(
  conn,
  message
) {

  if (
    message &&
    (
      message.type ===
      "RECORD_META" ||
      message.type ===
      "RECORD_CHUNK" ||
      message.type ===
      "RECORD_COMPLETE"
    )
  ) {

    handleRecordingData(
      message
    );

    return;
  }


  handleNormalDataMessage(
    conn,
    message
  );
}


/*
  Conteúdo principal do router sem os
  três tipos de gravação.
*/

function handleNormalDataMessage(
  conn,
  message
) {

  if (!message) {
    return;
  }


  if (message.type === "JOIN") {

    if (isHost) {
      handlePlayerJoin(
        conn,
        message.player
      );
    }

    return;
  }


  if (message.type === "ROOM_STATE") {

    applyRoomState(
      message.players
    );

    if (
      typeof message.gameStarted ===
      "boolean"
    ) {

      gameStarted =
        message.gameStarted;
    }

    updateRoomUI();

    return;
  }


  if (message.type === "PLAYER_LEFT") {

    delete roomPlayers[
      message.playerId
    ];

    updateRoomUI();

    return;
  }


  if (message.type === "HEARTBEAT") {

    if (isHost && message.player) {

      const existing =
        roomPlayers[
          message.player.playerId
        ];

      if (existing) {

        existing.lastSeen =
          Date.now();

        existing.peerId =
          message.player.peerId;

        /*
          Nome vem do jogador.
          Não usamos username local.
        */

        existing.name =
          String(
            message.player.name ||
            existing.name
          ).slice(0, 16);
      }

      broadcastRoomState();
    }

    return;
  }


  if (message.type === "GAME_START") {

    applyGameStart(
      message
    );

    return;
  }


  if (message.type === "REFERENCE") {

    applyReference(
      message
    );

    return;
  }


  if (message.type === "RECORD_START") {

    applyRecordStart(
      message
    );

    return;
  }


  if (message.type === "PLAYBACK_PLAN") {

    applyPlaybackPlan(
      message
    );

    return;
  }


  if (message.type === "PLAYBACK_SCORE") {

    applyPlaybackScore(
      message
    );

    return;
  }


  if (message.type === "ROUND_RESULT") {

    applyRoundResult(
      message
    );

    return;
  }


  if (message.type === "NEXT_ROUND") {

    applyNextRound(
      message
    );

    return;
  }


  if (message.type === "GAME_FINISH") {

    applyGameFinish(
      message
    );

    return;
  }
}


/*
  Troca o callback usado pelas conexões.
*/

function installDataRouter() {

  /*
    O listener original foi criado
    em setupDataConnection.
    Como ele chama handleDataMessage,
    interceptamos substituindo a função
    global usada no próximo fluxo.
  */
}


/* =========================================================
   REDEFINE HANDLE DATA MESSAGE
========================================================= */

handleDataMessage = routeDataMessage;


/* =========================================================
   RECORDINGS
========================================================= */

function ensureRoundStorage(
  round
) {

  if (!recordings[round]) {
    recordings[round] = {};
  }

  if (!scores[round]) {
    scores[round] = {};
  }

  if (!transferBuffers[round]) {
    transferBuffers[round] = {};
  }
}


function saveReceivedRecording(
  round,
  targetPlayerId,
  name,
  blob
) {

  ensureRoundStorage(
    round
  );


  const old =
    recordings[round][
      targetPlayerId
    ];


  if (old && old.url) {

    try {
      URL.revokeObjectURL(
        old.url
      );
    } catch {}
  }


  const url =
    URL.createObjectURL(
      blob
    );


  recordings[round][
    targetPlayerId
  ] = {

    playerId:
      targetPlayerId,

    name:
      getPlayerName(
        targetPlayerId,
        name
      ),

    blob,

    url,

    size:
      blob.size,

    received: true
  };
}


function chunksToBlob(
  chunks,
  mimeType
) {

  const validChunks =
    chunks.filter(
      (chunk) =>
        chunk !== undefined &&
        chunk !== null
    );


  return new Blob(
    validChunks,
    {
      type:
        mimeType ||
        "audio/webm"
    }
  );
}


/* =========================================================
   CHECK ALL RECORDINGS
========================================================= */

function expectedPlayerIds() {

  return Object.values(
    roomPlayers
  )
    .filter(
      (player) =>
        player.connected !== false
    )
    .map(
      (player) =>
        player.playerId
    );
}


function allRecordingsReady() {

  const expected =
    expectedPlayerIds();


  const current =
    recordings[
      currentRound
    ] || {};


  if (
    expected.length === 0
  ) {
    return false;
  }


  return expected.every(
    (id) => {

      const recording =
        current[id];

      return !!(
        recording &&
        recording.blob &&
        recording.blob.size > 0
      );
    }
  );
}


function checkAllRecordingsReady() {

  if (!isHost) {
    return;
  }


  if (
    waitingForRecordings
  ) {
    return;
  }


  if (
    allRecordingsReady()
  ) {

    waitingForRecordings =
      true;

    beginPlaybackPhase();

    return;
  }


  /*
    Timeout de segurança.
    Se alguém caiu, não trava para sempre.
  */

  if (!roundTimer) {

    roundTimer =
      setTimeout(
        () => {

          roundTimer = null;

          if (
            isHost &&
            !waitingForRecordings
          ) {

            waitingForRecordings =
              true;

            beginPlaybackPhase();
          }

        },
        15000
      );
  }
}


/* =========================================================
   PLAYBACK
========================================================= */

function beginPlaybackPhase() {

  clearRoundTimers();

  const current =
    recordings[
      currentRound
    ] || {};


  const order =
    Object.keys(
      current
    ).filter(
      (id) =>
        current[id] &&
        current[id].blob &&
        current[id].blob.size > 0
    );


  /*
    Mantém a ordem da sala.
  */

  order.sort(
    (a, b) => {

      const pa =
        roomPlayers[a];

      const pb =
        roomPlayers[b];

      if (
        pa &&
        pb
      ) {

        if (
          pa.isHost &&
          !pb.isHost
        ) {
          return -1;
        }

        if (
          !pa.isHost &&
          pb.isHost
        ) {
          return 1;
        }
      }

      return String(a)
        .localeCompare(
          String(b)
        );
    }
  );


  const plan = {

    type:
      "PLAYBACK_PLAN",

    round:
      currentRound,

    order
  };


  broadcast(
    plan
  );


  applyPlaybackPlan(
    plan
  );
}


async function applyPlaybackPlan(
  message
) {

  if (
    Number(message.round) !==
    Number(currentRound)
  ) {
    return;
  }


  hideAllGameScreens();

  playbackScreen.classList.remove(
    "hidden"
  );


  /*
    Chat voice desligado durante playback.
  */

  gameVoiceEnabled = false;

  if (localStream) {

    setOutgoingTracksEnabled(
      false
    );
  }

  updateGameVoiceButton();


  const order =
    Array.isArray(message.order)
      ? message.order
      : [];


  await playPlaybackOrder(
    order
  );


  /*
    Só o host calcula e manda
    os resultados depois do playback.
  */

  if (isHost) {

    await calculateRoundScores(
      order
    );
  }
}


async function playPlaybackOrder(
  order
) {

  for (
    const targetPlayerId
    of order
  ) {

    const recording =
      recordings[
        currentRound
      ] &&
      recordings[
        currentRound
      ][
        targetPlayerId
      ];


    if (!recording) {
      continue;
    }


    const name =
      getPlayerName(
        targetPlayerId,
        recording.name
      );


    playbackPlayerName.textContent =
      name;


    playbackScore.classList.add(
      "hidden"
    );


    playbackStatus.textContent =
      "Reproduzindo áudio...";


    hideAllGameScreens();

    playbackScreen.classList.remove(
      "hidden"
    );


    await playBlob(
      recording.blob
    );


    /*
      Calcula a pontuação local
      apenas depois de ouvir.
    */

    const score =
      await scoreRecording(
        currentReferenceData,
        recording.blob
      );


    scores[
      currentRound
    ][
      targetPlayerId
    ] = score;


    playbackScore.textContent =
      score;


    playbackScore.classList.remove(
      "hidden"
    );


    playbackStatus.textContent =
      "Pontuação analisada.";


    await sleep(
      1000
    );
  }
}


function playBlob(
  blob
) {

  return new Promise(
    (resolve) => {

      if (!blob) {

        resolve();

        return;
      }


      const url =
        URL.createObjectURL(
          blob
        );


      const audio =
        new Audio();


      playbackAudio =
        audio;


      audio.preload =
        "auto";

      audio.src =
        url;


      audio.playsInline =
        true;


      const finish =
        () => {

          try {
            audio.pause();
          } catch {}

          audio.src = "";

          try {
            URL.revokeObjectURL(
              url
            );
          } catch {}

          if (
            playbackAudio ===
            audio
          ) {

            playbackAudio =
              null;
          }

          resolve();
        };


      audio.addEventListener(
        "ended",
        finish,
        {
          once: true
        }
      );


      audio.addEventListener(
        "error",
        finish,
        {
          once: true
        }
      );


      const promise =
        audio.play();


      if (
        promise &&
        typeof promise.catch ===
          "function"
      ) {

        promise.catch(
          () => {

            /*
              Se autoplay for bloqueado,
              tenta novamente.
            */

            setTimeout(
              () => {

                audio.play()
                  .catch(
                    finish
                  );

              },
              100
            );
          }
        );
      }


      /*
        Segurança:
        nunca fica preso se o áudio
        não disparar ended.
      */

      const fallback =
        setTimeout(
          finish,
          Math.max(
            2500,
            (blob.size / 8000) *
              1000 +
              9000
          )
        );


      const originalFinish =
        finish;

      /*
        O clearTimeout é feito quando
        o evento terminar.
      */

      audio.addEventListener(
        "ended",
        () => {
          clearTimeout(
            fallback
          );
        },
        {
          once: true
        }
      );
    }
  );
}


/* =========================================================
   SCORING
========================================================= */

/*
  Não é um modelo ML.
  É uma análise local de áudio.

  Pontos usados:
  - presença de áudio
  - duração útil
  - energia
  - ataques
  - ritmo aproximado
  - pitch aproximado quando possível

  Voz/timbre não são usados como fator principal.
*/

async function scoreRecording(
  reference,
  blob
) {

  if (
    !blob ||
    blob.size <
    100
  ) {

    return 0;
  }


  let audioBuffer;


  try {

    audioBuffer =
      await decodeBlob(
        blob
      );

  } catch {

    /*
      Mesmo se o navegador não conseguir
      decodificar perfeitamente, uma gravação
      real não deve automaticamente virar 0.
    */

    return 35;
  }


  if (!audioBuffer) {
    return 0;
  }


  const features =
    extractAudioFeatures(
      audioBuffer
    );


  if (
    features.rms <
    0.006
  ) {

    return 0;
  }


  /*
    BASE:
    se existe som real, começa com 25.
  */

  let score = 25;


  /*
    Duração útil
  */

  const durationScore =
    Math.min(
      20,
      features.activeRatio *
        25
    );


  score +=
    durationScore;


  /*
    Energia suficiente
  */

  if (
    features.rms >
    0.015
  ) {

    score += 10;

  } else if (
    features.rms >
    0.008
  ) {

    score += 6;
  }


  /*
    Ataques:
    falar, cantar, bater ou fazer som
    produz mudanças de energia.
  */

  const attackScore =
    Math.min(
      20,
      features.attacks.length *
        4
    );


  score +=
    attackScore;


  /*
    Ritmo:
    verifica espaçamento aproximado
    entre ataques.
  */

  const rhythm =
    rhythmConsistency(
      features.attacks
    );


  score +=
    rhythm * 15;


  /*
    Pitch:
    somente se conseguirmos detectar.
  */

  if (
    reference &&
    features.pitches.length > 0
  ) {

    const pitchScore =
      comparePitchPattern(
        reference.frequencies || [],
        features.pitches
      );


    score +=
      pitchScore * 10;
  }


  /*
    Nunca mais dá 0 para alguém que
    realmente produziu áudio.
  */

  score =
    Math.round(
      Math.max(
        1,
        Math.min(
          100,
          score
        )
      )
    );


  return score;
}


async function decodeBlob(
  blob
) {

  const arrayBuffer =
    await blob.arrayBuffer();


  const AudioContext =
    window.AudioContext ||
    window.webkitAudioContext;


  if (!AudioContext) {
    return null;
  }


  const ctx =
    new AudioContext();


  try {

    const buffer =
      await ctx.decodeAudioData(
        arrayBuffer
      );


    try {
      await ctx.close();
    } catch {}


    return buffer;

  } catch (error) {

    try {
      await ctx.close();
    } catch {}

    throw error;
  }
}


function extractAudioFeatures(
  audioBuffer
) {

  const channel =
    audioBuffer.getChannelData(
      0
    );


  const sampleRate =
    audioBuffer.sampleRate;


  const windowSize =
    Math.max(
      512,
      Math.floor(
        sampleRate *
        0.025
      )
    );


  const hop =
    Math.floor(
      sampleRate *
      0.0125
    );


  let energySum = 0;

  let activeWindows = 0;

  const energies = [];

  const pitches = [];


  for (
    let i = 0;
    i + windowSize <
    channel.length;
    i += hop
  ) {

    let sum = 0;

    let crossings = 0;

    let previous =
      channel[i];


    for (
      let j = 0;
      j < windowSize;
      j++
    ) {

      const sample =
        channel[
          i + j
        ];


      sum +=
        sample *
        sample;


      if (
        (sample >= 0 &&
          previous < 0) ||
        (sample < 0 &&
          previous >= 0)
      ) {

        crossings++;
      }


      previous =
        sample;
    }


    const rms =
      Math.sqrt(
        sum /
        windowSize
      );


    energySum +=
      rms;


    energies.push(
      rms
    );


    if (
      rms >
      0.008
    ) {

      activeWindows++;
    }


    /*
      Estimativa simples de pitch.
      Não serve para timbre, apenas para
      frequência fundamental aproximada.
    */

    const seconds =
      windowSize /
      sampleRate;


    const frequency =
      crossings /
      2 /
      seconds;


    if (
      frequency >= 70 &&
      frequency <= 1000
    ) {

      pitches.push(
        frequency
      );
    }
  }


  const rms =
    energies.length
      ? energySum /
        energies.length
      : 0;


  const activeRatio =
    energies.length
      ? activeWindows /
        energies.length
      : 0;


  const attacks =
    detectAttacks(
      energies
    );


  return {

    rms,

    activeRatio,

    attacks,

    pitches,

    duration:
      audioBuffer.duration
  };
}


function detectAttacks(
  energies
) {

  const attacks = [];


  if (
    energies.length <
    3
  ) {
    return attacks;
  }


  for (
    let i = 1;
    i <
    energies.length - 1;
    i++
  ) {

    const previous =
      energies[i - 1];

    const current =
      energies[i];

    const next =
      energies[i + 1];


    if (
      current >
      0.012 &&
      current >
      previous * 1.45 &&
      current >=
      next
    ) {

      attacks.push(
        i
      );
    }
  }


  /*
    Remove ataques muito próximos.
  */

  const filtered = [];


  for (
    const attack
    of attacks
  ) {

    const last =
      filtered[
        filtered.length - 1
      ];


    if (
      last === undefined ||
      attack - last >
        8
    ) {

      filtered.push(
        attack
      );
    }
  }


  return filtered;
}


function rhythmConsistency(
  attacks
) {

  if (
    attacks.length <
    2
  ) {

    return attacks.length === 1
      ? 0.45
      : 0;
  }


  const gaps = [];


  for (
    let i = 1;
    i <
    attacks.length;
    i++
  ) {

    gaps.push(
      attacks[i] -
      attacks[i - 1]
    );
  }


  const average =
    gaps.reduce(
      (a, b) => a + b,
      0
    ) /
    gaps.length;


  if (
    average <= 0
  ) {
    return 0;
  }


  let variance = 0;


  for (
    const gap of gaps
  ) {

    const diff =
      gap -
      average;

    variance +=
      diff * diff;
  }


  variance /=
    gaps.length;


  const deviation =
    Math.sqrt(
      variance
    );


  const normalized =
    deviation /
    average;


  return Math.max(
    0,
    Math.min(
      1,
      1 -
        normalized
    )
  );
}


function comparePitchPattern(
  referenceFrequencies,
  pitches
) {

  if (
    !referenceFrequencies.length ||
    !pitches.length
  ) {

    return 0.45;
  }


  const refAverage =
    referenceFrequencies.reduce(
      (a, b) => a + b,
      0
    ) /
    referenceFrequencies.length;


  const userAverage =
    pitches.reduce(
      (a, b) => a + b,
      0
    ) /
    pitches.length;


  /*
    Comparamos proporção em vez de timbre.
  */

  const refRange =
    Math.max(
      ...referenceFrequencies
    ) -
    Math.min(
      ...referenceFrequencies
    );


  const userRange =
    Math.max(
      ...pitches
    ) -
    Math.min(
      ...pitches
    );


  const avgRatio =
    Math.min(
      refAverage,
      userAverage
    ) /
    Math.max(
      refAverage,
      userAverage
    );


  const rangeRatio =
    Math.min(
      refRange + 1,
      userRange + 1
    ) /
    Math.max(
      refRange + 1,
      userRange + 1
    );


  return Math.max(
    0,
    Math.min(
      1,
      (
        avgRatio * .55 +
        rangeRatio * .45
      )
    )
  );
}


/* =========================================================
   HOST CALCULA RESULTADOS
========================================================= */

async function calculateRoundScores(
  order
) {

  ensureRoundStorage(
    currentRound
  );


  for (
    const targetPlayerId
    of order
  ) {

    const recording =
      recordings[
        currentRound
      ][
        targetPlayerId
      ];


    if (!recording) {

      scores[
        currentRound
      ][
        targetPlayerId
      ] = 0;

      continue;
    }


    const score =
      await scoreRecording(
        currentReferenceData,
        recording.blob
      );


    scores[
      currentRound
    ][
      targetPlayerId
    ] = score;


    broadcast({
      type:
        "PLAYBACK_SCORE",

      round:
        currentRound,

      playerId:
        targetPlayerId,

      score
    });
  }


  await sleep(
    700
  );


  finishRound();
}


/* =========================================================
   PLAYBACK SCORE
========================================================= */

function applyPlaybackScore(
  message
) {

  if (
    Number(message.round) !==
    Number(currentRound)
  ) {
    return;
  }


  ensureRoundStorage(
    currentRound
  );


  scores[
    currentRound
  ][
    message.playerId
  ] =
    Number(
      message.score
    );


  if (
    message.playerId ===
    playerId
  ) {

    playbackScore.textContent =
      message.score;

    playbackScore.classList.remove(
      "hidden"
    );
  }
}


/* =========================================================
   ROUND RESULT
========================================================= */

function finishRound() {

  if (!isHost) {
    return;
  }


  const currentScores =
    scores[
      currentRound
    ] || {};


  const rows =
    Object.values(
      roomPlayers
    ).map(
      (player) => ({

        playerId:
          player.playerId,

        name:
          player.name,

        score:
          Number(
            currentScores[
              player.playerId
            ] || 0
          )
      })
    );


  rows.sort(
    (a, b) =>
      b.score -
      a.score
  );


  const message = {

    type:
      "ROUND_RESULT",

    round:
      currentRound,

    scores:
      rows
  };


  broadcast(
    message
  );


  applyRoundResult(
    message
  );
}


function applyRoundResult(
  message
) {

  hideAllGameScreens();

  resultScreen.classList.remove(
    "hidden"
  );


  resultList.innerHTML = "";


  const rows =
    Array.isArray(
      message.scores
    )
      ? message.scores
      : [];


  for (
    let i = 0;
    i < rows.length;
    i++
  ) {

    const row =
      rows[i];


    const element =
      document.createElement(
        "div"
      );

    element.className =
      "score-row";


    const position =
      document.createElement(
        "div"
      );

    position.className =
      "score-position";

    position.textContent =
      `${i + 1}º`;


    const name =
      document.createElement(
        "div"
      );

    name.className =
      "score-name";

    name.textContent =
      getPlayerName(
        row.playerId,
        row.name
      );


    const score =
      document.createElement(
        "div"
      );

    score.className =
      "score-value";

    score.textContent =
      row.score;


    element.appendChild(
      position
    );

    element.appendChild(
      name
    );

    element.appendChild(
      score
    );


    resultList.appendChild(
      element
    );
  }


  const mine =
    rows.find(
      (row) =>
        row.playerId ===
        playerId
    );


  if (mine) {

    resultText.textContent =
      `Você fez ${mine.score} pontos.`;

  } else {

    resultText.textContent =
      "Rodada concluída.";
  }


  /*
    Voz volta somente depois da
    tela de resultado.
  */

  setTimeout(
    () => {

      if (
        gameStarted &&
        localStream
      ) {

        gameVoiceEnabled = false;

        updateGameVoiceButton();
      }

      if (
        isHost
      ) {

        if (
          currentRound <
          TOTAL_ROUNDS
        ) {

          const nextRound =
            currentRound + 1;


          const message = {

            type:
              "NEXT_ROUND",

            round:
              nextRound
          };


          broadcast(
            message
          );


          applyNextRound(
            message
          );

        } else {

          const finalMessage = {

            type:
              "GAME_FINISH",

            scores:
              calculateFinalScores()
          };


          broadcast(
            finalMessage
          );


          applyGameFinish(
            finalMessage
          );
        }
      }

    },
    3500
  );
}


/* =========================================================
   NEXT ROUND
========================================================= */

function applyNextRound(
  message
) {

  currentRound =
    Number(
      message.round
    );


  waitingForRecordings =
    false;


  ensureRoundStorage(
    currentRound
  );


  clearRoundTimers();

  updateRoundUI();

  beginRoundCountdown();
}


/* =========================================================
   FINAL SCORES
========================================================= */

function calculateFinalScores() {

  const total = {};


  for (
    const player
    of Object.values(
      roomPlayers
    )
  ) {

    total[
      player.playerId
    ] = {

      playerId:
        player.playerId,

      name:
        player.name,

      score: 0
    };
  }


  for (
    const round
    of Object.values(
      scores
    )
  ) {

    for (
      const playerIdScore
      in round
    ) {

      if (
        !total[
          playerIdScore
        ]
      ) {

        total[
          playerIdScore
        ] = {

          playerId:
            playerIdScore,

          name:
            getPlayerName(
              playerIdScore,
              "Jogador"
            ),

          score: 0
        };
      }


      total[
        playerIdScore
      ].score +=
        Number(
          round[
            playerIdScore
          ] || 0
        );
    }
  }


  return Object.values(
    total
  ).sort(
    (a, b) =>
      b.score -
      a.score
  );
}


/* =========================================================
   FINAL GAME
========================================================= */

function applyGameFinish(
  message
) {

  gameStarted = false;

  clearRoundTimers();

  gameVoiceEnabled = false;

  if (localStream) {

    setOutgoingTracksEnabled(
      false
    );
  }

  updateGameVoiceButton();

  hideAllGameScreens();

  finalScreen.classList.remove(
    "hidden"
  );


  finalList.innerHTML = "";


  const rows =
    Array.isArray(
      message.scores
    )
      ? message.scores
      : [];


  for (
    let i = 0;
    i < rows.length;
    i++
  ) {

    const row =
      rows[i];


    const element =
      document.createElement(
        "div"
      );

    element.className =
      "score-row";


    const position =
      document.createElement(
        "div"
      );

    position.className =
      "score-position";

    position.textContent =
      `${i + 1}º`;


    const name =
      document.createElement(
        "div"
      );

    name.className =
      "score-name";

    name.textContent =
      getPlayerName(
        row.playerId,
        row.name
      );


    const score =
      document.createElement(
        "div"
      );

    score.className =
      "score-value";

    score.textContent =
      row.score;


    element.appendChild(
      position
    );

    element.appendChild(
      name
    );

    element.appendChild(
      score
    );


    finalList.appendChild(
      element
    );
  }
}


/* =========================================================
   VOLTAR PARA SALA
========================================================= */

backToRoomButton.addEventListener(
  "click",
  () => {

    gameStarted = false;

    clearRoundTimers();

    gameVoiceEnabled =
      false;

    if (localStream) {

      setOutgoingTracksEnabled(
        !micEnabled
          ? false
          : true
      );
    }

    updateGameVoiceButton();
    updateVoiceUI();

    showRoom();

    broadcastRoomState();
  }
);


/* =========================================================
   CLEAR GAME
========================================================= */

function hideAllGameScreens() {

  countdownScreen.classList.add(
    "hidden"
  );

  referenceScreen.classList.add(
    "hidden"
  );

  recordScreen.classList.add(
    "hidden"
  );

  uploadScreen.classList.add(
    "hidden"
  );

  playbackScreen.classList.add(
    "hidden"
  );

  resultScreen.classList.add(
    "hidden"
  );

  finalScreen.classList.add(
    "hidden"
  );
}


function clearRoundTimers() {

  if (roundTimer) {

    clearTimeout(
      roundTimer
    );

    clearInterval(
      roundTimer
    );

    roundTimer = null;
  }

  clearRecordTimer();
}


/* =========================================================
   HELPERS DE JOGADOR
========================================================= */

function getPlayerById(
  targetPlayerId
) {

  return roomPlayers[
    targetPlayerId
  ] || null;
}


function getPlayerName(
  targetPlayerId,
  fallback
) {

  const player =
    getPlayerById(
      targetPlayerId
    );


  if (
    player &&
    player.name
  ) {

    return player.name;
  }


  if (
    targetPlayerId ===
    playerId
  ) {

    return username;
  }


  return String(
    fallback ||
    "Jogador"
  ).slice(0, 16);
}


/* =========================================================
   COPY
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
        1200
      );

    } catch {

      copyCodeButton.textContent =
        roomCode;

      setTimeout(
        () => {

          copyCodeButton.textContent =
            "Copiar código";

        },
        1200
      );
    }
  }
);


/* =========================================================
   LEAVE ROOM
========================================================= */

leaveRoomButton.addEventListener(
  "click",
  () => {

    leaveRoom(
      false
    );
  }
);


function leaveRoom(
  silent
) {

  if (
    !joinedRoom &&
    !peer
  ) {

    if (!silent) {
      showHome();
    }

    return;
  }


  if (
    !isHost
  ) {

    const hostConnection =
      findHostConnection();

    if (
      hostConnection &&
      hostConnection.open
    ) {

      sendToConnection(
        hostConnection,
        {
          type:
            "PLAYER_LEFT",

          playerId
        }
      );
    }
  }


  stopHeartbeat();

  clearRoundTimers();


  for (
    const call
    of voiceCalls.values()
  ) {

    try {
      call.close();
    } catch {}
  }


  for (
    const call
    of incomingVoiceCalls.values()
  ) {

    try {
      call.close();
    } catch {}
  }


  voiceCalls.clear();
  incomingVoiceCalls.clear();


  for (
    const conn
    of dataConnections.values()
  ) {

    try {
      conn.close();
    } catch {}
  }


  dataConnections.clear();


  if (localStream) {

    for (
      const track
      of localStream.getTracks()
    ) {

      try {
        track.stop();
      } catch {}
    }

    localStream = null;
  }


  if (peer) {

    try {
      peer.destroy();
    } catch {}
  }


  peer = null;

  joinedRoom = false;
  gameStarted = false;

  isHost = false;

  roomCode = "";
  hostPeerId = "";
  myPeerId = "";

  micEnabled = false;
  gameVoiceEnabled = false;

  roomPlayers = {};

  clearRecordingStorage();

  hideAllGameScreens();

  joinPanel.classList.add(
    "hidden"
  );

  if (!silent) {

    showHome();
  }
}


/* =========================================================
   CLEAR RECORDING STORAGE
========================================================= */

function clearRecordingStorage() {

  for (
    const round
    in recordings
  ) {

    for (
      const id
      in recordings[round]
    ) {

      const item =
        recordings[
          round
        ][id];


      if (
        item &&
        item.url
      ) {

        try {
          URL.revokeObjectURL(
            item.url
          );
        } catch {}
      }
    }
  }


  for (
    const key
    in recordings
  ) {

    delete recordings[key];
  }


  for (
    const key
    in scores
  ) {

    delete scores[key];
  }


  for (
    const key
    in transferBuffers
  ) {

    delete transferBuffers[key];
  }
}


/* =========================================================
   UTILS
========================================================= */

function sleep(
  ms
) {

  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );
}


/* =========================================================
   INITIALIZATION
========================================================= */

loginButton.addEventListener(
  "click",
  login
);


usernameInput.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key ===
      "Enter"
    ) {

      login();
    }
  }
);


/* =========================================================
   PEER ROOM STATE PATCH
========================================================= */

/*
  Corrige uma situação importante:
  quando o host recebe uma gravação,
  o router precisa encaminhar os chunks.
*/


const originalSetupDataConnection =
  setupDataConnection;


/*
  Os listeners criados anteriormente
  usam handleDataMessage, que já foi
  substituído por routeDataMessage.
*/


/* =========================================================
   GUEST RECORD META PATCH
========================================================= */

/*
  Quando o host encaminha RECORD_META,
  o guest precisa criar seu buffer.
*/


/* =========================================================
   START RECORDING AUTOMATICAMENTE
========================================================= */

/*
  O timer da gravação chama stopRecording,
  mas startRecording precisa ocorrer no começo.
*/

const originalApplyRecordStart =
  applyRecordStart;


/*
  Reescrevemos a função para garantir
  que a gravação realmente comece antes
  da contagem.
*/

applyRecordStart =
  async function(message) {

    if (
      Number(message.round) !==
      Number(currentRound)
    ) {
      return;
    }


    recordingStarted = true;

    currentRecordingBlob = null;

    hideAllGameScreens();

    recordScreen.classList.remove(
      "hidden"
    );


    gameVoiceEnabled = false;

    if (localStream) {

      setOutgoingTracksEnabled(
        false
      );
    }


    updateGameVoiceButton();


    const ready =
      await prepareRecordingMicrophone();


    if (!ready) {

      recordStatus.textContent =
        "Microfone não disponível.";

    } else {

      recordStatus.textContent =
        "Grave agora.";

      /*
        IMPORTANTE:
        a gravação começa aqui.
      */

      await startRecording();
    }


    runRecordingTimer(
      Number(
        message.duration ||
        RECORD_SECONDS
      )
    );
  };


/* =========================================================
   HOST RECORDING FLOW PATCH
========================================================= */

function registerHostLocalRecording() {

  if (
    currentRecordingBlob
  ) {

    saveReceivedRecording(
      currentRound,
      playerId,
      username,
      currentRecordingBlob
    );
  }
}


/* =========================================================
   HOST CHECK FALLBACK
========================================================= */

setInterval(
  () => {

    if (
      isHost &&
      gameStarted &&
      recordingStarted &&
      !waitingForRecordings &&
      recordings[
        currentRound
      ]
    ) {

      checkAllRecordingsReady();
    }

  },
  1000
);


/* =========================================================
   INITIAL LOAD
========================================================= */

playerId =
  createPlayerId();

loadLogin();

updateGameVoiceButton();

updateVoiceUI();
