"use strict";

/* =========================================================
   SHADOW GAMES V1.1
   3D + MULTIPLAYER + VOICE STATE
   ========================================================= */

const $ = id => document.getElementById(id);

/* =========================================================
   UI
   ========================================================= */

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
   USER
   ========================================================= */

let username = "";
let myPlayerId = "";
let myPeerId = "";

/* =========================================================
   PEER
   ========================================================= */

let peer = null;

let roomCode = "";
let isHost = false;
let hostPeerId = "";

const connections = new Map();
const voiceCalls = new Map();

/* =========================================================
   PLAYERS
   ========================================================= */

let players = [];

/*
  Cada jogador possui:
  voice = true/false

  Isso é separado do microfone físico.
*/

function getPlayer(playerId) {
  return players.find(p => p.id === playerId);
}

/* =========================================================
   VOICE
   ========================================================= */

let localStream = null;

let voiceEnabled = false;

/*
  Fases onde NINGUÉM pode conversar.
*/
let voiceLocked = false;

/*
  Estado anterior antes de bloquear.
*/
let voiceBeforeLock = false;

/* =========================================================
   GAME
   ========================================================= */

let gameRunning = false;
let currentRound = 1;

let currentPhase = "idle";

let mediaRecorder = null;
let recordedChunks = [];

let recordTimer = null;

/* =========================================================
   MOVEMENT
   ========================================================= */

let joystickActive = false;
let joystickPointerId = null;

let joystickX = 0;
let joystickY = 0;

const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false
};

let cameraYaw = 0;
let cameraPitch = 0.32;

let lastPositionSend = 0;

/* =========================================================
   THREE
   ========================================================= */

let scene;
let renderer;
let camera;
let myCharacter = null;
let cameraTarget = null;

const worldPlayers = new Map();

let lastFrameTime = performance.now();

/* =========================================================
   LOGIN
   ========================================================= */

function cleanName(value) {
  return String(value || "Player")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 16) || "Player";
}

function loadSavedUser() {
  const saved = localStorage.getItem("shadow_username");

  if (saved) {
    usernameInput.value = cleanName(saved);
  }
}

function login() {
  const value = cleanName(usernameInput.value);

  if (!value) {
    loginStatus.textContent = "Digite seu nome.";
    return;
  }

  username = value;

  localStorage.setItem(
    "shadow_username",
    username
  );

  myPlayerId =
    "player-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 9);

  profileName.textContent = username;
  profileAvatar.textContent =
    username.charAt(0).toUpperCase();

  loginScreen.classList.add("hidden");
  homeScreen.classList.remove("hidden");

  loginStatus.textContent = "";
}

function logout() {
  disconnectEverything();

  localStorage.removeItem(
    "shadow_username"
  );

  username = "";
  myPlayerId = "";

  usernameInput.value = "";

  homeScreen.classList.add("hidden");
  roomScreen.classList.add("hidden");
  gameScreen.classList.add("hidden");

  loginScreen.classList.remove("hidden");
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
   ROOM
   ========================================================= */

function generateRoomCode() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "";

  for (let i = 0; i < 6; i++) {
    result += chars[
      Math.floor(Math.random() * chars.length)
    ];
  }

  return result;
}

async function createRoom() {
  homeStatus.textContent =
    "Criando sala...";

  roomCode =
    generateRoomCode();

  isHost = true;

  hostPeerId =
    "shadow-room-" + roomCode;

  try {
    await createPeer(hostPeerId);

    players = [
      {
        id: myPlayerId,
        name: username,
        peerId: myPeerId,
        host: true,
        voice: false,
        x: 0,
        y: 0,
        z: 2
      }
    ];

    setupRoomUI();

    showRoom();

    connectionBadge.textContent =
      "Online";

    roomStatus.textContent =
      "Sala criada.";

    startHeartbeat();

    startHostCleanup();

    rebuildWorldPlayers();

  } catch (error) {
    isHost = false;

    homeStatus.textContent =
      "Não foi possível criar a sala.";
  }
}

function showJoin() {
  joinPanel.classList.remove("hidden");
  joinCodeInput.focus();
}

function cancelJoin() {
  joinPanel.classList.add("hidden");
  joinStatus.textContent = "";
}

async function joinRoom() {
  const code =
    joinCodeInput.value
      .trim()
      .toUpperCase();

  if (code.length !== 6) {
    joinStatus.textContent =
      "Digite um código de 6 caracteres.";
    return;
  }

  joinStatus.textContent =
    "Entrando...";

  roomCode = code;
  isHost = false;

  hostPeerId =
    "shadow-room-" + roomCode;

  try {
    const guestPeerId =
      "shadow-player-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 8);

    await createPeer(
      guestPeerId
    );

    const conn =
      peer.connect(
        hostPeerId,
        {
          reliable: true
        }
      );

    setupConnection(conn);

    const timeout =
      setTimeout(() => {

        if (!players.length) {

          joinStatus.textContent =
            "Não foi possível encontrar a sala.";

          disconnectEverything();
        }

      }, 12000);

    conn.__joinTimeout =
      timeout;

  } catch {
    joinStatus.textContent =
      "Não foi possível entrar.";
  }
}

/* =========================================================
   PEER
   ========================================================= */

function createPeer(id) {
  return new Promise(
    (resolve, reject) => {

      const p =
        new Peer(id, {
          debug: 0
        });

      p.on(
        "open",
        peerId => {

          peer = p;
          myPeerId = peerId;

          resolve(p);
        }
      );

      p.on(
        "connection",
        conn => {
          setupConnection(conn);
        }
      );

      p.on(
        "call",
        call => {
          handleIncomingVoiceCall(call);
        }
      );

      p.on(
        "error",
        error => {

          console.warn(
            "Peer error:",
            error
          );
        }
      );

      p.on(
        "disconnected",
        () => {

          connectionBadge.textContent =
            "Desconectado";
        }
      );

      setTimeout(
        () => {

          if (!peer) {
            reject(
              new Error(
                "Timeout"
              )
            );
          }

        },
        15000
      );
    }
  );
}

/* =========================================================
   CONNECTION
   ========================================================= */

function setupConnection(conn) {

  if (!conn || !conn.peer) {
    return;
  }

  const existing =
    connections.get(conn.peer);

  if (
    existing &&
    existing.open
  ) {
    try {
      conn.close();
    } catch {}

    return;
  }

  connections.set(
    conn.peer,
    conn
  );

  conn.on(
    "open",
    () => {

      if (conn.__joinTimeout) {
        clearTimeout(
          conn.__joinTimeout
        );
      }

      if (isHost) {

        sendRoomState(conn);

        /*
          Voz NÃO começa automaticamente.
          Só começa quando os estados de voz
          permitirem.
        */

      } else {

        sendData(
          conn,
          {
            type: "HELLO",

            player: {
              id: myPlayerId,
              name: username,
              peerId: myPeerId,
              voice: false
            }
          }
        );
      }

      connectionBadge.textContent =
        "Online";
    }
  );

  conn.on(
    "data",
    data => {
      handleData(
        conn,
        data
      );
    }
  );

  conn.on(
    "close",
    () => {

      connections.delete(
        conn.peer
      );

      const removed =
        players.find(
          p => p.peerId === conn.peer
        );

      if (
        isHost &&
        removed
      ) {

        players =
          players.filter(
            p => p.id !== removed.id
          );

        removeWorldPlayer(
          removed.id
        );

        broadcastRoomState();

        closeVoiceWithPlayer(
          removed.peerId
        );
      }

      if (
        !isHost &&
        conn.peer === hostPeerId
      ) {

        roomStatus.textContent =
          "O dono da sala saiu.";

        closeAllVoice();

        setTimeout(
          () => {

            disconnectEverything();
            showHome();

          },
          1000
        );
      }

      renderPlayers();
    }
  );

  conn.on(
    "error",
    () => {
      connections.delete(
        conn.peer
      );
    }
  );
}

/* =========================================================
   DATA
   ========================================================= */

function sendData(
  conn,
  data
) {
  if (
    !conn ||
    !conn.open
  ) {
    return;
  }

  try {
    conn.send(data);
  } catch {}
}

function broadcast(
  data,
  exceptPeerId = null
) {
  for (
    const [
      peerId,
      conn
    ] of connections
  ) {

    if (
      peerId ===
      exceptPeerId
    ) {
      continue;
    }

    sendData(
      conn,
      data
    );
  }
}

function handleData(
  conn,
  data
) {
  if (
    !data ||
    !data.type
  ) {
    return;
  }

  switch (data.type) {

    case "HELLO":
      handleHello(
        conn,
        data
      );
      break;

    case "ROOM_STATE":
      handleRoomState(
        data
      );
      break;

    case "PLAYER_UPDATE":
      handlePlayerUpdate(
        data
      );
      break;

    case "VOICE_STATE":
      handleVoiceState(
        data
      );
      break;

    case "START_GAME":
      handleStartGame(
        data
      );
      break;

    case "PING":
      sendData(
        conn,
        {
          type: "PONG"
        }
      );
      break;

    case "ROOM_CLOSED":
      disconnectEverything();
      showHome();
      break;
  }
}

/* =========================================================
   HELLO
   ========================================================= */

function handleHello(
  conn,
  data
) {
  if (!isHost) {
    return;
  }

  if (!data.player) {
    return;
  }

  if (players.length >= 5) {

    sendData(
      conn,
      {
        type: "ROOM_FULL"
      }
    );

    setTimeout(
      () => {
        try {
          conn.close();
        } catch {}
      },
      100
    );

    return;
  }

  const incoming =
    data.player;

  const existing =
    players.find(
      p =>
        p.id ===
        incoming.id
    );

  if (existing) {

    existing.peerId =
      conn.peer;

    existing.name =
      cleanName(
        incoming.name
      );

  } else {

    players.push({
      id: incoming.id,
      name: cleanName(
        incoming.name
      ),
      peerId: conn.peer,
      host: false,
      voice: false,
      x: randomSpawnX(),
      y: 0,
      z: randomSpawnZ()
    });
  }

  sendRoomState(conn);

  broadcastRoomState();

  rebuildWorldPlayers();
}

/* =========================================================
   ROOM STATE
   ========================================================= */

function buildRoomState() {

  return {
    type: "ROOM_STATE",

    roomCode,

    hostPeerId,

    players:
      players.map(
        p => ({
          id: p.id,
          name: p.name,
          peerId: p.peerId,
          host: !!p.host,
          voice: !!p.voice,
          x: p.x,
          y: p.y,
          z: p.z
        })
      )
  };
}

function sendRoomState(
  conn
) {
  sendData(
    conn,
    buildRoomState()
  );
}

function broadcastRoomState() {
  broadcast(
    buildRoomState()
  );

  renderPlayers();
}

function handleRoomState(
  data
) {

  if (
    !Array.isArray(
      data.players
    )
  ) {
    return;
  }

  players =
    data.players.map(
      p => ({
        id: String(p.id),
        name: cleanName(
          p.name
        ),
        peerId: p.peerId,
        host: !!p.host,
        voice: !!p.voice,
        x: Number(p.x) || 0,
        y: Number(p.y) || 0,
        z: Number(p.z) || 0
      })
    );

  hostPeerId =
    data.hostPeerId ||
    hostPeerId;

  roomCode =
    data.roomCode ||
    roomCode;

  roomCodeText.textContent =
    roomCode;

  renderPlayers();

  rebuildWorldPlayers();

  /*
    Atualiza imediatamente o áudio
    baseado no estado real da sala.
  */
  updateAllVoiceAudio();

  if (!isHost) {

    const me =
      getPlayer(
        myPlayerId
      );

    if (me) {

      connectionBadge.textContent =
        "Online";

      joinPanel.classList.add(
        "hidden"
      );

      showRoom();

      roomStatus.textContent =
        "Você entrou na sala.";
    }
  }
}

/* =========================================================
   VOICE STATE
   ========================================================= */

function setMyVoiceState(
  enabled
) {

  /*
    Nunca permite voz durante
    gravação ou reprodução.
  */

  if (voiceLocked) {
    enabled = false;
  }

  voiceEnabled =
    !!enabled;

  const me =
    getPlayer(
      myPlayerId
    );

  if (me) {
    me.voice =
      voiceEnabled;
  }

  updateVoiceButton();

  if (isHost) {

    broadcast({
      type: "VOICE_STATE",
      playerId: myPlayerId,
      enabled: voiceEnabled
    });

    broadcastRoomState();

  } else {

    const host =
      connections.get(
        hostPeerId
      );

    if (host) {

      sendData(
        host,
        {
          type: "VOICE_STATE",
          playerId: myPlayerId,
          enabled: voiceEnabled
        }
      );
    }
  }

  updateAllVoiceAudio();
}

function handleVoiceState(
  data
) {

  const player =
    getPlayer(
      data.playerId
    );

  if (!player) {
    return;
  }

  player.voice =
    !!data.enabled;

  /*
    O host é a autoridade.
  */

  if (isHost) {

    broadcast(
      {
        type: "VOICE_STATE",
        playerId:
          player.id,
        enabled:
          player.voice
      },
      null
    );

    broadcastRoomState();
  }

  updateAllVoiceAudio();
}

function updateVoiceButton() {

  const enabled =
    voiceEnabled &&
    !voiceLocked;

  if (
    micButton
  ) {

    if (enabled) {

      micButton.classList.add(
        "active"
      );

      micButton.classList.remove(
        "off"
      );

      micButtonText.textContent =
        "Microfone ligado";

    } else {

      micButton.classList.remove(
        "active"
      );

      micButton.classList.add(
        "off"
      );

      micButtonText.textContent =
        "Microfone desligado";
    }
  }

  if (
    gameVoiceButton
  ) {

    if (enabled) {

      gameVoiceButton.classList.add(
        "active"
      );

      gameVoiceButton.textContent =
        "Mic ON";

    } else {

      gameVoiceButton.classList.remove(
        "active"
      );

      gameVoiceButton.textContent =
        "Mic OFF";
    }
  }
}

/*
  REGRA:
  
  A voz só fica audível para mim quando:

  1. eu estou com voz ligada
  2. o outro jogador está com voz ligada
  3. não estamos gravando
  4. não estamos reproduzindo
*/

function canHearPlayer(
  playerId
) {

  if (voiceLocked) {
    return false;
  }

  if (!voiceEnabled) {
    return false;
  }

  const player =
    getPlayer(
      playerId
    );

  if (!player) {
    return false;
  }

  return !!player.voice;
}

function updateAllVoiceAudio() {

  const audios =
    document.querySelectorAll(
      "#remoteAudios audio"
    );

  for (
    const audio of audios
  ) {

    const peerId =
      audio.dataset.peer;

    const player =
      players.find(
        p =>
          p.peerId ===
          peerId
      );

    if (!player) {

      audio.muted = true;
      audio.volume = 0;

      continue;
    }

    const allowed =
      canHearPlayer(
        player.id
      );

    audio.muted =
      !allowed;

    audio.volume =
      allowed ? 1 : 0;
  }
}

/* =========================================================
   MICROPHONE
   ========================================================= */

async function requestMicrophone() {

  if (localStream) {
    return true;
  }

  try {

    localStream =
      await navigator.mediaDevices.getUserMedia(
        {
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
        }
      );

    for (
      const track of
      localStream.getAudioTracks()
    ) {
      track.enabled = false;
    }

    return true;

  } catch {

    roomStatus.textContent =
      "Permita o acesso ao microfone.";

    return false;
  }
}

async function toggleMic() {

  /*
    Durante gravação/reprodução
    o botão não faz nada.
  */

  if (voiceLocked) {
    return;
  }

  const ok =
    await requestMicrophone();

  if (!ok) {
    return;
  }

  setMyVoiceState(
    !voiceEnabled
  );
}

/* =========================================================
   VOICE CALLS
   ========================================================= */

/*
  IMPORTANTE:

  As conexões WebRTC podem existir mesmo quando
  a voz está OFF.

  Isso evita renegociação toda hora.

  O áudio é simplesmente silenciado.
*/

function shouldInitiateVoice(
  remotePeerId
) {

  return (
    String(myPeerId) <
    String(remotePeerId)
  );
}

function ensureVoiceCall(
  remotePeerId
) {

  if (!peer) {
    return;
  }

  if (!localStream) {
    return;
  }

  if (
    voiceCalls.has(
      remotePeerId
    )
  ) {
    return;
  }

  if (
    !shouldInitiateVoice(
      remotePeerId
    )
  ) {
    return;
  }

  try {

    const call =
      peer.call(
        remotePeerId,
        localStream
      );

    voiceCalls.set(
      remotePeerId,
      call
    );

    setupVoiceCall(
      call,
      remotePeerId
    );

  } catch {}
}

function ensureAllVoiceCalls() {

  if (!localStream) {
    return;
  }

  for (
    const player of players
  ) {

    if (
      player.id ===
      myPlayerId
    ) {
      continue;
    }

    ensureVoiceCall(
      player.peerId
    );
  }
}

function handleIncomingVoiceCall(
  call
) {

  if (
    !call ||
    !call.peer
  ) {
    return;
  }

  if (
    voiceCalls.has(
      call.peer
    )
  ) {

    try {
      call.close();
    } catch {}

    return;
  }

  /*
    Se ainda não temos stream,
    criamos um stream vazio.
  */

  if (!localStream) {

    const audioContext =
      new (
        window.AudioContext ||
        window.webkitAudioContext
      )();

    const destination =
      audioContext
        .createMediaStreamDestination();

    try {
      call.answer(
        destination.stream
      );
    } catch {}

  } else {

    try {
      call.answer(
        localStream
      );
    } catch {}
  }

  voiceCalls.set(
    call.peer,
    call
  );

  setupVoiceCall(
    call,
    call.peer
  );
}

function setupVoiceCall(
  call,
  remotePeerId
) {

  call.on(
    "stream",
    stream => {

      let audio =
        document.querySelector(
          `audio[data-peer="${CSS.escape(remotePeerId)}"]`
        );

      if (!audio) {

        audio =
          document.createElement(
            "audio"
          );

        audio.autoplay = true;
        audio.playsInline = true;

        audio.dataset.peer =
          remotePeerId;

        $("remoteAudios")
          .appendChild(
            audio
          );
      }

      audio.srcObject =
        stream;

      /*
        O estado de voz decide
        se pode ou não escutar.
      */

      updateAllVoiceAudio();

      audio.play()
        .catch(() => {});
    }
  );

  call.on(
    "close",
    () => {

      voiceCalls.delete(
        remotePeerId
      );

      const audio =
        document.querySelector(
          `audio[data-peer="${CSS.escape(remotePeerId)}"]`
        );

      if (audio) {
        audio.remove();
      }
    }
  );

  call.on(
    "error",
    () => {

      voiceCalls.delete(
        remotePeerId
      );
    }
  );
}

function closeVoiceWithPlayer(
  peerId
) {

  const call =
    voiceCalls.get(
      peerId
    );

  if (call) {

    try {
      call.close();
    } catch {}

    voiceCalls.delete(
      peerId
    );
  }

  const audio =
    document.querySelector(
      `audio[data-peer="${CSS.escape(peerId)}"]`
    );

  if (audio) {
    audio.remove();
  }
}

function closeAllVoice() {

  for (
    const call of
    voiceCalls.values()
  ) {

    try {
      call.close();
    } catch {}
  }

  voiceCalls.clear();

  const audios =
    document.querySelectorAll(
      "#remoteAudios audio"
    );

  audios.forEach(
    audio => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    }
  );
}

/* =========================================================
   VOICE LOCK
   ========================================================= */

function lockVoice() {

  /*
    Salva o estado antes da fase.
  */

  voiceBeforeLock =
    voiceEnabled;

  voiceLocked = true;

  /*
    Microfone local OFF.
  */

  if (localStream) {

    for (
      const track of
      localStream.getAudioTracks()
    ) {
      track.enabled = false;
    }
  }

  /*
    Ninguém escuta ninguém.
  */

  const audios =
    document.querySelectorAll(
      "#remoteAudios audio"
    );

  audios.forEach(
    audio => {

      audio.muted = true;
      audio.volume = 0;
      audio.pause();
    }
  );

  updateVoiceButton();
}

function unlockVoice() {

  voiceLocked = false;

  /*
    Retorna ao estado que o jogador
    tinha antes da gravação.
  */

  voiceEnabled =
    voiceBeforeLock;

  const me =
    getPlayer(
      myPlayerId
    );

  if (me) {
    me.voice =
      voiceEnabled;
  }

  if (localStream) {

    for (
      const track of
      localStream.getAudioTracks()
    ) {
      track.enabled =
        voiceEnabled;
    }
  }

  updateVoiceButton();

  updateAllVoiceAudio();
}

/* =========================================================
   PLAYERS
   ========================================================= */

function renderPlayers() {

  playersList.innerHTML = "";

  playerCount.textContent =
    `${players.length}/5`;

  gamePlayerCount.textContent =
    String(players.length);

  for (
    const player of players
  ) {

    const item =
      document.createElement(
        "div"
      );

    item.className =
      "player-item";

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
        "strong"
      );

    name.textContent =
      player.name;

    const status =
      document.createElement(
        "span"
      );

    status.textContent =
      player.id ===
      myPlayerId
        ? "Você"
        : player.voice
          ? "Voz ligada"
          : "Voz desligada";

    info.appendChild(name);
    info.appendChild(status);

    item.appendChild(avatar);
    item.appendChild(info);

    if (player.host) {

      const hostTag =
        document.createElement(
          "div"
        );

      hostTag.className =
        "host-tag";

      hostTag.textContent =
        "HOST";

      item.appendChild(
        hostTag
      );
    }

    playersList.appendChild(
      item
    );
  }

  /*
    Depois de atualizar a lista,
    tenta estabelecer as conexões de voz.
  */

  if (localStream) {
    ensureAllVoiceCalls();
  }
}

/* =========================================================
   ROOM UI
   ========================================================= */

function setupRoomUI() {

  roomCodeText.textContent =
    roomCode;

  renderPlayers();

  if (isHost) {

    startGameButton.classList.remove(
      "hidden"
    );

  } else {

    startGameButton.classList.add(
      "hidden"
    );
  }
}

/* =========================================================
   POSITION
   ========================================================= */

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

function handlePlayerUpdate(
  data
) {

  if (!data.player) {
    return;
  }

  const player =
    getPlayer(
      data.player.id
    );

  if (!player) {
    return;
  }

  player.x =
    Number(data.player.x) || 0;

  player.y =
    Number(data.player.y) || 0;

  player.z =
    Number(data.player.z) || 0;

  updateRemoteCharacter(
    player.id,
    player.x,
    player.y,
    player.z
  );
}

function sendMyPosition() {

  if (!myCharacter) {
    return;
  }

  const me =
    getPlayer(
      myPlayerId
    );

  if (!me) {
    return;
  }

  me.x =
    myCharacter.position.x;

  me.y =
    myCharacter.position.y;

  me.z =
    myCharacter.position.z;

  const data = {
    type: "PLAYER_UPDATE",

    player: {
      id: myPlayerId,
      x: me.x,
      y: me.y,
      z: me.z
    }
  };

  if (isHost) {

    broadcast(data);

  } else {

    const host =
      connections.get(
        hostPeerId
      );

    if (host) {
      sendData(
        host,
        data
      );
    }
  }
}

function sendPositionThrottled() {

  const now =
    performance.now();

  if (
    now -
    lastPositionSend <
    60
  ) {
    return;
  }

  lastPositionSend =
    now;

  sendMyPosition();
}

/* =========================================================
   HOST CLEANUP
   ========================================================= */

let hostCleanupTimer = null;
let heartbeatTimer = null;

function startHostCleanup() {

  clearInterval(
    hostCleanupTimer
  );

  hostCleanupTimer =
    setInterval(
      () => {

        for (
          const [
            peerId,
            conn
          ] of connections
        ) {

          if (!conn.open) {

            connections.delete(
              peerId
            );

            const player =
              players.find(
                p =>
                  p.peerId ===
                  peerId
              );

            if (player) {

              players =
                players.filter(
                  p =>
                    p.id !==
                    player.id
                );

              removeWorldPlayer(
                player.id
              );
            }
          }
        }

        broadcastRoomState();

      },
      5000
    );
}

function startHeartbeat() {

  stopHeartbeat();

  heartbeatTimer =
    setInterval(
      () => {

        for (
          const conn of
          connections.values()
        ) {

          sendData(
            conn,
            {
              type: "PING"
            }
          );
        }

      },
      3000
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

/* =========================================================
   GAME START
   ========================================================= */

function startGame() {

  if (!isHost) {
    return;
  }

  if (gameRunning) {
    return;
  }

  gameRunning = true;

  currentRound = 1;

  /*
    Antes da partida começa sem voz.
  */

  lockVoice();

  broadcast({
    type: "START_GAME",
    round: currentRound
  });

  enterGame();
}

function handleStartGame(
  data
) {

  if (isHost) {
    return;
  }

  gameRunning = true;

  currentRound =
    Number(data.round) || 1;

  lockVoice();

  enterGame();
}

function enterGame() {

  showGame();

  gameRound.textContent =
    `${currentRound}/4`;

  gamePlayerCount.textContent =
    String(players.length);

  startRound();
}

/* =========================================================
   ROUND
   ========================================================= */

function startRound() {

  currentPhase =
    "countdown";

  gameRound.textContent =
    `${currentRound}/4`;

  gameMessage.textContent =
    "Prepare-se...";

  recordingPanel.classList.add(
    "hidden"
  );

  playbackPanel.classList.add(
    "hidden"
  );

  gameCenter.classList.remove(
    "hidden"
  );

  let value = 3;

  countdownNumber.textContent =
    value;

  const timer =
    setInterval(
      () => {

        value--;

        if (value <= 0) {

          clearInterval(
            timer
          );

          gameCenter.classList.add(
            "hidden"
          );

          showReference();

          return;
        }

        countdownNumber.textContent =
          value;

      },
      1000
    );
}

/* =========================================================
   REFERENCE
   ========================================================= */

function showReference() {

  currentPhase =
    "reference";

  /*
    Voz continua bloqueada.
    Só o som de referência é reproduzido.
  */

  lockVoice();

  gameMessage.textContent =
    "Ouça o som de referência";

  playReferenceSound();

  setTimeout(
    () => {

      startRecording();

    },
    2500
  );
}

function playReferenceSound() {

  const AudioContextClass =
    window.AudioContext ||
    window.webkitAudioContext;

  const context =
    new AudioContextClass();

  const now =
    context.currentTime;

  const notes = [
    440,
    660,
    520
  ];

  notes.forEach(
    (
      frequency,
      index
    ) => {

      const osc =
        context.createOscillator();

      const gain =
        context.createGain();

      osc.type =
        "sine";

      osc.frequency.value =
        frequency;

      const start =
        now +
        index * 0.38;

      const end =
        start +
        0.26;

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

      gain.connect(
        context.destination
      );

      osc.start(start);

      osc.stop(
        end + 0.03
      );
    }
  );

  setTimeout(
    () => {
      context.close()
        .catch(() => {});
    },
    2200
  );
}

/* =========================================================
   RECORDING
   ========================================================= */

async function startRecording() {

  currentPhase =
    "recording";

  /*
    ESSENCIAL:

    A voz fica travada ANTES
    de abrir a gravação.
  */

  lockVoice();

  recordingPanel.classList.remove(
    "hidden"
  );

  gameMessage.textContent =
    "Grave agora";

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
    O microfone é usado SOMENTE
    pelo MediaRecorder.

    Ele não é liberado para
    voice chat.
  */

  for (
    const track of
    localStream.getAudioTracks()
  ) {
    track.enabled = true;
  }

  recordedChunks = [];

  const mimeType =
    getSupportedMimeType();

  try {

    mediaRecorder =
      mimeType
        ? new MediaRecorder(
            localStream,
            {
              mimeType
            }
          )
        : new MediaRecorder(
            localStream
          );

  } catch {

    mediaRecorder =
      new MediaRecorder(
        localStream
      );
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

      handleOwnRecording(
        blob
      );
    };

  mediaRecorder.start(
    100
  );

  let seconds = 7;

  recordTimerElement.textContent =
    seconds;

  const started =
    performance.now();

  clearInterval(
    recordTimer
  );

  recordTimer =
    setInterval(
      () => {

        const elapsed =
          performance.now() -
          started;

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
            7 -
              Math.floor(
                elapsed / 1000
              )
          );

        recordTimerElement.textContent =
          seconds;

        if (
          elapsed >= 7000
        ) {

          clearInterval(
            recordTimer
          );

          stopRecording();
        }

      },
      50
    );
}

function getSupportedMimeType() {

  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4"
  ];

  for (
    const type of types
  ) {

    if (
      MediaRecorder.isTypeSupported &&
      MediaRecorder.isTypeSupported(
        type
      )
    ) {
      return type;
    }
  }

  return "";
}

function stopRecording() {

  /*
    Para imediatamente a captura.
  */

  if (
    mediaRecorder &&
    mediaRecorder.state !==
      "inactive"
  ) {

    mediaRecorder.stop();
  }
}

function finishRecordingWithoutAudio() {

  handleOwnRecording(
    new Blob(
      [],
      {
        type: "audio/webm"
      }
    )
  );
}

/* =========================================================
   PLAYBACK
   ========================================================= */

function handleOwnRecording(
  blob
) {

  currentPhase =
    "playback";

  /*
    IMPORTANTE:

    Microfone OFF.

    Voz continua bloqueada.

    Então ninguém conversa enquanto
    a gravação é reproduzida.
  */

  if (localStream) {

    for (
      const track of
      localStream.getAudioTracks()
    ) {
      track.enabled = false;
    }
  }

  lockVoice();

  recordingPanel.classList.add(
    "hidden"
  );

  playLocalTake(
    blob
  );
}

function playLocalTake(
  blob
) {

  currentPhase =
    "playback";

  lockVoice();

  playbackPanel.classList.remove(
    "hidden"
  );

  playbackName.textContent =
    username;

  playbackStatus.textContent =
    "Reproduzindo sua gravação...";

  playbackScore.textContent =
    "—";

  if (
    !blob ||
    blob.size === 0
  ) {

    playbackStatus.textContent =
      "Nenhuma gravação.";

    playbackScore.textContent =
      "0";

    setTimeout(
      finishRound,
      1200
    );

    return;
  }

  const url =
    URL.createObjectURL(
      blob
    );

  const audio =
    new Audio();

  audio.src =
    url;

  audio.volume = 1;

  audio.onended =
    () => {

      URL.revokeObjectURL(
        url
      );

      /*
        Pontuação temporária.
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

      setTimeout(
        finishRound,
        1600
      );
    };

  audio.onerror =
    () => {

      URL.revokeObjectURL(
        url
      );

      playbackScore.textContent =
        "0";

      playbackStatus.textContent =
        "Erro ao reproduzir.";

      setTimeout(
        finishRound,
        1200
      );
    };

  audio.play()
    .catch(
      () => {

        playbackStatus.textContent =
          "Toque na tela para reproduzir.";

        playbackPanel.onclick =
          () => {

            audio.play()
              .catch(
                () => {}
              );
          };
      }
    );
}

/* =========================================================
   ROUND END
   ========================================================= */

function finishRound() {

  playbackPanel.classList.add(
    "hidden"
  );

  /*
    Só aqui a voz pode voltar.
  */

  unlockVoice();

  currentPhase =
    "idle";

  if (
    currentRound >= 4
  ) {

    finishGame();

    return;
  }

  currentRound++;

  setTimeout(
    () => {

      startRound();

    },
    700
  );
}

function finishGame() {

  currentPhase =
    "finished";

  lockVoice();

  gameMessage.textContent =
    "Partida finalizada";

  playbackPanel.classList.remove(
    "hidden"
  );

  playbackName.textContent =
    "Shadow Games";

  playbackStatus.textContent =
    "Partida finalizada.";

  playbackScore.textContent =
    "GG";

  setTimeout(
    () => {

      gameRunning = false;

      playbackPanel.classList.add(
        "hidden"
      );

      /*
        Ao voltar para a sala,
        o jogador pode ligar a voz novamente.
      */

      currentPhase =
        "idle";

      voiceLocked = false;
      voiceBeforeLock = false;
      voiceEnabled = false;

      const me =
        getPlayer(
          myPlayerId
        );

      if (me) {
        me.voice = false;
      }

      if (localStream) {

        for (
          const track of
          localStream.getAudioTracks()
        ) {
          track.enabled = false;
        }
      }

      updateVoiceButton();

      showRoom();

      updateAllVoiceAudio();

    },
    2200
  );
}

/* =========================================================
   3D WORLD
   ========================================================= */

function init3D() {

  scene =
    new THREE.Scene();

  scene.background =
    new THREE.Color(
      0x050509
    );

  scene.fog =
    new THREE.Fog(
      0x050509,
      18,
      55
    );

  camera =
    new THREE.PerspectiveCamera(
      62,
      window.innerWidth /
        window.innerHeight,
      0.1,
      100
    );

  camera.position.set(
    0,
    4,
    7
  );

  renderer =
    new THREE.WebGLRenderer(
      {
        antialias: true,
        powerPreference:
          "high-performance"
      }
    );

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

  $("gameCanvas")
    .appendChild(
      renderer.domElement
    );

  createLights();
  createEnvironment();

  window.addEventListener(
    "resize",
    resize3D
  );

  setupCameraControls();
  setupJoystick();
  setupKeyboard();

  animate3D();
}

/* =========================================================
   LIGHTS
   ========================================================= */

function createLights() {

  const ambient =
    new THREE.HemisphereLight(
      0xb8a8ff,
      0x080810,
      2.1
    );

  scene.add(
    ambient
  );

  const directional =
    new THREE.DirectionalLight(
      0xffffff,
      1.5
    );

  directional.position.set(
    4,
    10,
    4
  );

  scene.add(
    directional
  );

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

  scene.add(
    purple
  );

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

  scene.add(
    purple2
  );
}

/* =========================================================
   ENVIRONMENT
   ========================================================= */

function createEnvironment() {

  const floor =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        80,
        80
      ),
      new THREE.MeshStandardMaterial(
        {
          color: 0x0d0d14,
          roughness: 0.88,
          metalness: 0.08
        }
      )
    );

  floor.rotation.x =
    -Math.PI / 2;

  scene.add(
    floor
  );

  const grid =
    new THREE.GridHelper(
      80,
      40,
      0x332052,
      0x17131e
    );

  grid.position.y =
    0.01;

  scene.add(
    grid
  );

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

  const mesh =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        sx,
        sy,
        sz
      ),
      new THREE.MeshStandardMaterial(
        {
          color: 0x11111a,
          roughness: 0.7
        }
      )
    );

  mesh.position.set(
    x,
    y,
    z
  );

  scene.add(
    mesh
  );
}

function createPlatform(
  x,
  y,
  z,
  sx,
  sy,
  sz
) {

  const mesh =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        sx,
        sy,
        sz
      ),
      new THREE.MeshStandardMaterial(
        {
          color: 0x17131f,
          roughness: 0.6,
          metalness: 0.2
        }
      )
    );

  mesh.position.set(
    x,
    y,
    z
  );

  scene.add(
    mesh
  );

  const ring =
    new THREE.Mesh(
      new THREE.RingGeometry(
        3.1,
        3.25,
        48
      ),
      new THREE.MeshBasicMaterial(
        {
          color: 0x8145ff,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.65
        }
      )
    );

  ring.rotation.x =
    -Math.PI / 2;

  ring.position.set(
    x,
    y + 0.21,
    z
  );

  scene.add(
    ring
  );
}

function createNeonBlock(
  x,
  y,
  z
) {

  const mesh =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        1.2,
        2,
        1.2
      ),
      new THREE.MeshStandardMaterial(
        {
          color: 0x3a2164,
          emissive: 0x6e35bb,
          emissiveIntensity: 1.4
        }
      )
    );

  mesh.position.set(
    x,
    y,
    z
  );

  scene.add(
    mesh
  );
}

/* =========================================================
   CHARACTER
   ========================================================= */

function createCharacter(
  player
) {

  const group =
    new THREE.Group();

  const body =
    new THREE.Mesh(
      new THREE.CapsuleGeometry(
        0.38,
        0.9,
        4,
        8
      ),
      new THREE.MeshStandardMaterial(
        {
          color:
            player.id ===
            myPlayerId
              ? 0x8b4cff
              : 0x555565
        }
      )
    );

  body.position.y =
    0.9;

  group.add(
    body
  );

  const head =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.34,
        12,
        10
      ),
      new THREE.MeshStandardMaterial(
        {
          color: 0xf0b28b
        }
      )
    );

  head.position.y =
    1.85;

  group.add(
    head
  );

  group.position.set(
    player.x || 0,
    player.y || 0,
    player.z || 0
  );

  scene.add(
    group
  );

  return group;
}

function createLocalCharacter() {

  const me =
    getPlayer(
      myPlayerId
    );

  if (!me) {
    return;
  }

  myCharacter =
    createCharacter(
      me
    );

  cameraTarget =
    new THREE.Vector3(
      0,
      1.2,
      2
    );
}

function rebuildWorldPlayers() {

  if (!scene) {
    return;
  }

  for (
    const [
      id,
      object
    ] of worldPlayers
  ) {

    if (
      !players.some(
        p =>
          p.id === id
      )
    ) {

      scene.remove(
        object
      );

      worldPlayers.delete(
        id
      );
    }
  }

  if (
    !myCharacter &&
    players.length
  ) {
    createLocalCharacter();
  }

  for (
    const player of players
  ) {

    if (
      player.id ===
      myPlayerId
    ) {

      if (myCharacter) {

        myCharacter.position.set(
          player.x,
          player.y,
          player.z
        );
      }

      continue;
    }

    if (
      !worldPlayers.has(
        player.id
      )
    ) {

      const character =
        createCharacter(
          player
        );

      worldPlayers.set(
        player.id,
        character
      );

    } else {

      const character =
        worldPlayers.get(
          player.id
        );

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
    worldPlayers.get(
      id
    );

  if (!character) {
    return;
  }

  character.position.lerp(
    new THREE.Vector3(
      x,
      y,
      z
    ),
    0.25
  );
}

function removeWorldPlayer(
  id
) {

  const character =
    worldPlayers.get(
      id
    );

  if (!character) {
    return;
  }

  scene.remove(
    character
  );

  worldPlayers.delete(
    id
  );
}

/* =========================================================
   MOVEMENT
   ========================================================= */

function updateMovement(
  delta
) {

  if (!myCharacter) {
    return;
  }

  let forward =
    joystickY;

  let side =
    joystickX;

  if (keys.forward) {
    forward += 1;
  }

  if (keys.backward) {
    forward -= 1;
  }

  if (keys.right) {
    side += 1;
  }

  if (keys.left) {
    side -= 1;
  }

  const length =
    Math.sqrt(
      forward * forward +
      side * side
    );

  if (length > 1) {

    forward /=
      length;

    side /=
      length;
  }

  if (
    Math.abs(forward) <
      0.01 &&
    Math.abs(side) <
      0.01
  ) {
    return;
  }

  const moveX =
    Math.cos(cameraYaw) *
      side +
    Math.sin(cameraYaw) *
      forward;

  const moveZ =
    Math.cos(cameraYaw) *
      forward -
    Math.sin(cameraYaw) *
      side;

  myCharacter.position.x +=
    moveX *
    4.2 *
    delta;

  myCharacter.position.z +=
    moveZ *
    4.2 *
    delta;

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

/* =========================================================
   CAMERA
   ========================================================= */

function updateCamera() {

  if (!myCharacter) {
    return;
  }

  const target =
    myCharacter.position.clone();

  target.y += 1.1;

  if (!cameraTarget) {
    cameraTarget =
      target.clone();
  }

  cameraTarget.lerp(
    target,
    0.12
  );

  const distance =
    6.2;

  const horizontal =
    Math.cos(
      cameraPitch
    ) *
    distance;

  const desired =
    new THREE.Vector3(
      myCharacter.position.x -
        Math.sin(cameraYaw) *
        horizontal,

      myCharacter.position.y +
        3.1 +
        Math.sin(cameraPitch) *
        distance,

      myCharacter.position.z -
        Math.cos(cameraYaw) *
        horizontal
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

      /*
        O joystick tem prioridade.
      */

      if (
        event.target.closest &&
        event.target.closest(
          "#joystick"
        )
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

  const stop =
    event => {

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
    stop
  );

  renderer.domElement.addEventListener(
    "pointercancel",
    stop
  );
}

/* =========================================================
   JOYSTICK
   ========================================================= */

function setupJoystick() {

  if (!joystick) {
    return;
  }

  joystick.addEventListener(
    "pointerdown",
    event => {

      event.preventDefault();
      event.stopPropagation();

      joystickActive = true;

      joystickPointerId =
        event.pointerId;

      try {
        joystick.setPointerCapture(
          event.pointerId
        );
      } catch {}

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

      event.preventDefault();

      updateJoystick(
        event.clientX,
        event.clientY
      );
    }
  );

  const reset =
    event => {

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
    rect.width *
    0.31;

  const distance =
    Math.sqrt(
      dx * dx +
      dy * dy
    );

  if (
    distance >
    max
  ) {

    dx =
      dx / distance *
      max;

    dy =
      dy / distance *
      max;
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
      (now -
        lastFrameTime) /
        1000,
      0.05
    );

  lastFrameTime =
    now;

  updateMovement(
    delta
  );

  updateCamera();

  renderer.render(
    scene,
    camera
  );
}

/* =========================================================
   RESIZE
   ========================================================= */

function resize3D() {

  if (
    !camera ||
    !renderer
  ) {
    return;
  }

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
   COPY
   ========================================================= */

async function copyRoomCode() {

  try {

    await navigator.clipboard.writeText(
      roomCode
    );

    copyCodeButton.textContent =
      "Copiado";

    setTimeout(
      () => {
        copyCodeButton.textContent =
          "Copiar";
      },
      1300
    );

  } catch {

    roomStatus.textContent =
      "Código: " +
      roomCode;
  }
}

/* =========================================================
   LEAVE
   ========================================================= */

function leaveRoom() {

  if (isHost) {

    broadcast({
      type: "ROOM_CLOSED"
    });
  }

  disconnectEverything();

  joinCodeInput.value = "";

  showHome();
}

/* =========================================================
   DISCONNECT
   ========================================================= */

function disconnectEverything() {

  stopHeartbeat();

  clearInterval(
    hostCleanupTimer
  );

  hostCleanupTimer =
    null;

  /*
    Desliga completamente a voz.
  */

  voiceEnabled = false;
  voiceLocked = false;

  closeAllVoice();

  for (
    const conn of
    connections.values()
  ) {

    try {
      conn.close();
    } catch {}
  }

  connections.clear();

  if (localStream) {

    for (
      const track of
      localStream.getTracks()
    ) {
      track.stop();
    }

    localStream = null;
  }

  if (peer) {

    try {
      peer.destroy();
    } catch {}
  }

  peer = null;

  players = [];

  roomCode = "";

  isHost = false;

  hostPeerId = "";

  gameRunning = false;

  currentPhase =
    "idle";

  for (
    const object of
    worldPlayers.values()
  ) {

    if (scene) {
      scene.remove(
        object
      );
    }
  }

  worldPlayers.clear();

  myCharacter = null;

  updateVoiceButton();
}

/* =========================================================
   BUTTONS
   ========================================================= */

loginButton.addEventListener(
  "click",
  login
);

usernameInput.addEventListener(
  "keydown",
  event => {

    if (
      event.key ===
      "Enter"
    ) {
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

    if (
      event.key ===
      "Enter"
    ) {
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
  () => {

    /*
      Durante qualquer fase bloqueada,
      não existe voice chat.
    */

    if (voiceLocked) {
      return;
    }

    toggleMic();
  }
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

showHome();
