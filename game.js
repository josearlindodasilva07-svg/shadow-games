"use strict";

/* =========================================================
   SHADOW GAMES
   Voz + salas + Mimic Party prototype
   ========================================================= */

const MAX_PLAYERS = 5;
const TOTAL_ROUNDS = 4;
const RECORD_TIME = 5;

let username = "";
let roomCode = "";
let isHost = false;

let peer = null;
let localStream = null;

const connections = new Map();
const voiceCalls = new Map();

let microphoneEnabled = false;
let gameVoiceEnabled = false;

let gameStarted = false;
let currentRound = 1;

let currentReferenceBuffer = null;
let currentReferenceData = null;

let recordedBlob = null;
let recordedMime = "";

let players = [];
let recordings = {};
let scores = {};

let referenceReady = new Set();
let playbackQueue = [];
let playbackIndex = 0;

let recordTimer = null;
let countdownTimer = null;
let referenceTimeout = null;

const $ = id => document.getElementById(id);

const loginScreen = $("login");
const homeScreen = $("home");
const roomScreen = $("room");
const gameScreen = $("game");

const usernameInput = $("username");
const loginButton = $("loginButton");

const createButton = $("create");
const joinButton = $("join");
const logoutButton = $("logout");

const roomCodeElement = $("roomCode");
const copyCodeButton = $("copyCode");

const statusElement = $("status");
const playersElement = $("players");

const micButton = $("micButton");
const voiceStatus = $("voiceStatus");

const startButton = $("start");
const leaveRoomButton = $("leaveRoom");

const roundText = $("roundText");
const gamePlayers = $("gamePlayers");

const countdownScreen = $("countdownScreen");
const countdownNumber = $("countdownNumber");

const referenceScreen = $("referenceScreen");
const referenceButton = $("referenceButton");

const recordScreen = $("recordScreen");
const recordTimer = $("recordTimer");
const recordStatus = $("recordStatus");

const playbackScreen = $("playbackScreen");
const playbackName = $("playbackName");
const playbackStatus = $("playbackStatus");

const wheelScreen = $("wheelScreen");
const wheelElement = $("wheel");
const wheelResult = $("wheelResult");

const resultScreen = $("resultScreen");
const resultText = $("resultText");

const gameVoiceButton = $("gameVoiceButton");


/* =========================================================
   UTIL
   ========================================================= */

function showSection(section) {
  [loginScreen, homeScreen, roomScreen, gameScreen]
    .forEach(el => el.classList.add("hidden"));

  section.classList.remove("hidden");
}

function randomCode() {
  return Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function send(connection, data) {
  if (!connection) return;

  try {
    if (connection.open) {
      connection.send(data);
    }
  } catch {}
}

function broadcast(data) {
  connections.forEach(connection => {
    send(connection, data);
  });
}

function setStatus(text) {
  statusElement.textContent = text;
}

function setGameVoiceButton() {
  gameVoiceButton.textContent =
    gameVoiceEnabled ? "Voz: ON" : "Voz: OFF";

  gameVoiceButton.classList.toggle(
    "active",
    gameVoiceEnabled
  );
}

function updateVoiceStatus() {
  if (!microphoneEnabled) {
    voiceStatus.textContent = "Microfone desligado";
    micButton.textContent = "Ativar microfone";
    micButton.classList.remove("active");
    return;
  }

  voiceStatus.textContent = "Microfone ligado";
  micButton.textContent = "Desativar microfone";
  micButton.classList.add("active");
}

function updatePlayersUI() {
  playersElement.innerHTML = "";

  players.forEach(player => {

    const row = document.createElement("div");

    row.className = "player-row";

    row.textContent =
      player.name +
      (player.host ? "  • Host" : "");

    playersElement.appendChild(row);
  });

  gamePlayers.textContent =
    `${players.length}/${MAX_PLAYERS}`;
}


/* =========================================================
   LOGIN
   ========================================================= */

function loadAccount() {
  const saved = localStorage.getItem(
    "shadow_games_username"
  );

  if (saved) {
    username = saved;

    $("profileName").textContent = username;

    showSection(homeScreen);
  }
}

loginButton.onclick = () => {

  const name = usernameInput.value.trim();

  if (!name) {
    usernameInput.focus();
    return;
  }

  username = name.substring(0, 16);

  localStorage.setItem(
    "shadow_games_username",
    username
  );

  $("profileName").textContent = username;

  showSection(homeScreen);
};

logoutButton.onclick = () => {

  localStorage.removeItem(
    "shadow_games_username"
  );

  username = "";

  usernameInput.value = "";

  showSection(loginScreen);
};


/* =========================================================
   PEER
   ========================================================= */

function createPeer(id = null) {

  return new Promise((resolve, reject) => {

    peer = id
      ? new Peer(id)
      : new Peer();

    peer.on("open", idOpened => {
      resolve(idOpened);
    });

    peer.on("error", error => {
      console.error(error);
      reject(error);
    });

    peer.on("disconnected", () => {
      try {
        peer.reconnect();
      } catch {}
    });

    peer.on("call", handleIncomingVoiceCall);
  });
}


/* =========================================================
   CREATE ROOM
   ========================================================= */

createButton.onclick = async () => {

  if (!username) return;

  try {

    setStatus("Criando sala...");

    roomCode = randomCode();

    await createPeer(
      "shadow-" + roomCode
    );

    isHost = true;

    players = [
      {
        id: peer.id,
        name: username,
        host: true
      }
    ];

    roomCodeElement.textContent = roomCode;

    startButton.classList.remove("hidden");

    setStatus("Sala criada. Aguardando jogadores...");

    showSection(roomScreen);

    updatePlayersUI();

    peer.on("connection", connection => {

      connection.on("open", () => {

        connections.set(
          connection.peer,
          connection
        );

        send(connection, {
          type: "room_state",
          players
        });

        connection.on("data", data => {
          handleHostMessage(
            connection,
            data
          );
        });

        connection.on("close", () => {

          removePlayer(
            connection.peer
          );

        });

        setTimeout(() => {
          callPlayer(connection.peer);
        }, 300);
      });
    });

  } catch (error) {

    setStatus(
      "Não foi possível criar a sala."
    );

    console.error(error);
  }
};


/* =========================================================
   JOIN ROOM
   ========================================================= */

joinButton.onclick = async () => {

  if (!username) return;

  const code = prompt(
    "Digite o código da sala:"
  );

  if (!code) return;

  roomCode = code
    .trim()
    .toUpperCase();

  try {

    setStatus("Entrando na sala...");

    await createPeer();

    isHost = false;

    showSection(roomScreen);

    roomCodeElement.textContent = roomCode;

    startButton.classList.add("hidden");

    const connection = peer.connect(
      "shadow-" + roomCode,
      {
        reliable: true
      }
    );

    connection.on("open", () => {

      connections.set(
        connection.peer,
        connection
      );

      send(connection, {
        type: "join",
        player: {
          id: peer.id,
          name: username,
          host: false
        }
      });

      setStatus(
        "Conectado. Aguardando o host..."
      );
    });

    connection.on("data", data => {
      handleGuestMessage(data);
    });

    connection.on("close", () => {

      setStatus(
        "Conexão com o host encerrada."
      );
    });

  } catch (error) {

    setStatus(
      "Não foi possível entrar na sala."
    );

    console.error(error);
  }
};


/* =========================================================
   PLAYER MANAGEMENT
   ========================================================= */

function removePlayer(id) {

  players = players.filter(
    player => player.id !== id
  );

  const connection = connections.get(id);

  if (connection) {
    try {
      connection.close();
    } catch {}
  }

  connections.delete(id);

  const call = voiceCalls.get(id);

  if (call) {
    try {
      call.close();
    } catch {}
  }

  voiceCalls.delete(id);

  updatePlayersUI();

  if (isHost) {
    broadcast({
      type: "room_state",
      players
    });
  }
}


/* =========================================================
   HOST MESSAGES
   ========================================================= */

function handleHostMessage(
  connection,
  data
) {

  if (!data || !data.type) return;

  if (data.type === "join") {

    if (players.length >= MAX_PLAYERS) {

      send(connection, {
        type: "room_full"
      });

      return;
    }

    const alreadyExists =
      players.some(
        p => p.id === data.player.id
      );

    if (!alreadyExists) {

      players.push(data.player);

      updatePlayersUI();

      broadcast({
        type: "room_state",
        players
      });

      callPlayer(data.player.id);
    }

    return;
  }


  if (data.type === "reference_ready") {

    referenceReady.add(data.playerId);

    if (
      referenceReady.size >=
      players.length
    ) {

      clearTimeout(
        referenceTimeout
      );

      startRecordCountdownHost();
    }

    return;
  }


  if (data.type === "recording") {

    recordings[data.playerId] = {
      playerId: data.playerId,
      name: data.name,
      audio: data.audio,
      mime: data.mime,
      score: 0
    };

    checkAllRecordings();

    return;
  }


  if (data.type === "voice_state") {

    broadcast({
      type: "voice_state",
      playerId: data.playerId,
      enabled: data.enabled
    });

    return;
  }
}


/* =========================================================
   GUEST MESSAGES
   ========================================================= */

function handleGuestMessage(data) {

  if (!data || !data.type) return;


  if (data.type === "room_state") {

    players = data.players || [];

    updatePlayersUI();

    setStatus(
      "Aguardando o host começar..."
    );

    return;
  }


  if (data.type === "room_full") {

    alert("A sala está cheia.");

    leaveRoom();

    return;
  }


  if (data.type === "game_start") {

    gameStarted = true;

    currentRound = data.round || 1;

    showSection(gameScreen);

    resetGameScreens();

    startGuestRound();

    return;
  }


  if (data.type === "reference") {

    currentReferenceData = data.audio;

    playReferenceFromData(
      data.audio
    );

    return;
  }


  if (data.type === "record_start") {

    startRecordingPhase();

    return;
  }


  if (data.type === "playback") {

    playGuestPlayback(
      data
    );

    return;
  }


  if (data.type === "wheel") {

    showWheel(data);

    return;
  }


  if (data.type === "round_result") {

    showRoundResult(
      data
    );

    return;
  }


  if (data.type === "game_finished") {

    showFinalResult(
      data
    );

    return;
  }


  if (data.type === "voice_state") {

    return;
  }
}


/* =========================================================
   START GAME
   ========================================================= */

startButton.onclick = () => {

  if (!isHost) return;

  if (players.length < 1) return;

  gameStarted = true;

  currentRound = 1;

  scores = {};

  players.forEach(player => {
    scores[player.id] = 0;
  });

  broadcast({
    type: "game_start",
    round: currentRound
  });

  showSection(gameScreen);

  resetGameScreens();

  startHostRound();
};


/* =========================================================
   ROUND
   ========================================================= */

function startHostRound() {

  roundText.textContent =
    `Rodada ${currentRound}`;

  recordings = {};

  referenceReady = new Set();

  recordedBlob = null;

  showOnly(countdownScreen);

  runCountdown(
    3,
    () => {

      createReferenceSound();

      broadcast({
        type: "reference",
        audio: currentReferenceData
      });

      playReferenceFromData(
        currentReferenceData
      );

      showOnly(referenceScreen);

      referenceTimeout = setTimeout(() => {

        if (
          referenceReady.size <
          players.length
        ) {
          startRecordCountdownHost();
        }

      }, 8000);
    }
  );
}


function startGuestRound() {

  roundText.textContent =
    `Rodada ${currentRound}`;

  showOnly(
    countdownScreen
  );

  runCountdown(
    3,
    () => {

      showOnly(
        referenceScreen
      );

      referenceButton.disabled = false;
    }
  );
}


/* =========================================================
   COUNTDOWN
   ========================================================= */

function runCountdown(
  seconds,
  callback
) {

  clearInterval(
    countdownTimer
  );

  let value = seconds;

  countdownNumber.textContent =
    value;

  countdownTimer =
    setInterval(() => {

      value--;

      if (value <= 0) {

        clearInterval(
          countdownTimer
        );

        countdownNumber.textContent =
          "GO";

        setTimeout(
          callback,
          500
        );

        return;
      }

      countdownNumber.textContent =
        value;

    }, 1000);
}


/* =========================================================
   REFERENCE SOUND
   ========================================================= */

function createReferenceSound() {

  const sampleRate = 44100;

  const duration = 1.6;

  const length =
    Math.floor(
      sampleRate * duration
    );

  const offline =
    new OfflineAudioContext(
      1,
      length,
      sampleRate
    );

  const oscillator =
    offline.createOscillator();

  const gain =
    offline.createGain();

  oscillator.type = "sine";

  oscillator.frequency.setValueAtTime(
    330,
    0
  );

  oscillator.frequency.linearRampToValueAtTime(
    440,
    0.45
  );

  oscillator.frequency.linearRampToValueAtTime(
    370,
    0.9
  );

  oscillator.frequency.linearRampToValueAtTime(
    500,
    1.35
  );

  gain.gain.setValueAtTime(
    0,
    0
  );

  gain.gain.linearRampToValueAtTime(
    0.5,
    0.05
  );

  gain.gain.setValueAtTime(
    0.5,
    1.3
  );

  gain.gain.linearRampToValueAtTime(
    0,
    1.6
  );

  oscillator.connect(gain);
  gain.connect(offline.destination);

  oscillator.start(0);
  oscillator.stop(duration);

  offline.startRendering()
    .then(buffer => {

      currentReferenceBuffer =
        buffer;

      currentReferenceData =
        audioBufferToBase64(
          buffer
        );

    });
}


/* =========================================================
   REFERENCE PLAYBACK
   ========================================================= */

referenceButton.onclick = async () => {

  if (!currentReferenceData) {
    return;
  }

  referenceButton.disabled = true;

  await playReferenceFromData(
    currentReferenceData
  );

  if (isHost) {

    referenceReady.add(
      peer.id
    );

    if (
      referenceReady.size >=
      players.length
    ) {

      startRecordCountdownHost();

    } else {

      setStatus(
        "Aguardando jogadores..."
      );
    }

  } else {

    const hostConnection =
      getHostConnection();

    send(hostConnection, {
      type: "reference_ready",
      playerId: peer.id
    });
  }
};


async function playReferenceFromData(data) {

  if (!data) return;

  try {

    const buffer =
      await base64ToAudioBuffer(
        data
      );

    await playAudioBuffer(
      buffer
    );

  } catch (error) {

    console.error(error);
  }
}


/* =========================================================
   RECORDING START
   ========================================================= */

function startRecordCountdownHost() {

  clearTimeout(
    referenceTimeout
  );

  broadcast({
    type: "record_start"
  });

  startRecordingPhase();
}


async function startRecordingPhase() {

  showOnly(
    recordScreen
  );

  recordStatus.textContent =
    "Preparando...";

  recordTimer.textContent =
    RECORD_TIME;

  /*
   Durante a gravação ninguém transmite
   voz para os outros.
  */
  stopOutgoingVoiceOnly();

  const stream =
    await getRecordingStream();

  if (!stream) {

    recordStatus.textContent =
      "Microfone indisponível";

    await sleep(500);

    submitRecording(
      null,
      ""
    );

    return;
  }

  recordStatus.textContent =
    "GRAVANDO";

  const chunks = [];

  let recorder;

  try {

    const options = {
      audioBitsPerSecond: 96000
    };

    if (
      MediaRecorder.isTypeSupported(
        "audio/webm;codecs=opus"
      )
    ) {
      options.mimeType =
        "audio/webm;codecs=opus";
    }

    recorder =
      new MediaRecorder(
        stream,
        options
      );

  } catch {

    recorder =
      new MediaRecorder(
        stream
      );
  }

  recordedMime =
    recorder.mimeType ||
    "audio/webm";

  recorder.ondataavailable =
    event => {

      if (
        event.data &&
        event.data.size > 0
      ) {
        chunks.push(
          event.data
        );
      }
    };

  recorder.onstop = async () => {

    const blob =
      new Blob(
        chunks,
        {
          type:
            recordedMime
        }
      );

    recordedBlob = blob;

    stream
      .getTracks()
      .forEach(
        track => track.stop()
      );

    const hasVoice =
      await detectRealAudio(
        blob
      );

    if (!hasVoice) {

      recordStatus.textContent =
        "Nenhum som detectado";

    }

    await submitRecording(
      blob,
      hasVoice
        ? "voice"
        : "silence"
    );

    /*
      Se a voz estava ligada antes,
      ela volta depois da gravação.
    */
    await restoreVoiceAfterRecording();
  };

  recorder.start();

  let time =
    RECORD_TIME;

  clearInterval(
    recordTimer
  );

  recordTimer =
    setInterval(() => {

      time--;

      recordTimer.textContent =
        Math.max(
          0,
          time
        );

      if (time <= 0) {

        clearInterval(
          recordTimer
        );

        if (
          recorder.state !==
          "inactive"
        ) {
          recorder.stop();
        }
      }

    }, 1000);
}


/* =========================================================
   RECORDING STREAM
   ========================================================= */

async function getRecordingStream() {

  try {

    const stream =
      await navigator.mediaDevices
        .getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 44100
          }
        });

    return stream;

  } catch (error) {

    console.error(error);

    return null;
  }
}


/* =========================================================
   REAL AUDIO DETECTION
   ========================================================= */

async function detectRealAudio(blob) {

  if (!blob || blob.size < 1000) {
    return false;
  }

  try {

    const arrayBuffer =
      await blob.arrayBuffer();

    const context =
      new AudioContext();

    const buffer =
      await context.decodeAudioData(
        arrayBuffer.slice(0)
      );

    const data =
      buffer.getChannelData(0);

    let sum = 0;
    let peak = 0;

    for (
      let i = 0;
      i < data.length;
      i++
    ) {

      const value =
        Math.abs(data[i]);

      sum += value;

      if (value > peak) {
        peak = value;
      }
    }

    const average =
      sum / data.length;

    await context.close();

    /*
      Muito importante:

      silêncio real e ruído muito baixo
      não contam como tentativa.
    */

    if (
      peak < 0.025 ||
      average < 0.0035
    ) {
      return false;
    }

    return true;

  } catch {

    return false;
  }
}


/* =========================================================
   SUBMIT RECORDING
   ========================================================= */

async function submitRecording(
  blob,
  state
) {

  let audio = null;

  if (blob) {
    audio =
      await blobToBase64(
        blob
      );
  }

  const packet = {

    type: "recording",

    playerId:
      peer.id,

    name:
      username,

    audio,

    mime:
      recordedMime,

    state

  };

  if (isHost) {

    recordings[peer.id] = packet;

    checkAllRecordings();

  } else {

    send(
      getHostConnection(),
      packet
    );
  }
}


/* =========================================================
   CHECK RECORDINGS
   ========================================================= */

function checkAllRecordings() {

  const count =
    Object.keys(
      recordings
    ).length;

  if (
    count >=
    players.length
  ) {

    startPlaybackHost();
  }
}


/* =========================================================
   PLAYBACK
   ========================================================= */

async function startPlaybackHost() {

  playbackQueue =
    players.slice();

  playbackIndex = 0;

  showOnly(
    playbackScreen
  );

  await playNextHostTake();
}


async function playNextHostTake() {

  if (
    playbackIndex >=
    playbackQueue.length
  ) {

    finishPlaybackHost();

    return;
  }

  const player =
    playbackQueue[
      playbackIndex
    ];

  const recording =
    recordings[
      player.id
    ];

  const finalTake =
    playbackIndex ===
    playbackQueue.length - 1;

  const score =
    await calculateScore(
      recording
    );

  if (recording) {
    recording.score = score;
  }

  showOnly(
    playbackScreen
  );

  playbackName.textContent =
    player.name;

  playbackStatus.textContent =
    "Reproduzindo...";

  broadcast({
    type: "playback",
    playerId: player.id,
    name: player.name,
    audio: recording
      ? recording.audio
      : null,
    mime: recording
      ? recording.mime
      : "",
    score,
    finalTake
  });

  /*
    Se houver áudio real,
    toca localmente.
  */
  if (
    recording &&
    recording.audio &&
    recording.state !== "silence"
  ) {

    await playRecording(
      recording.audio
    );

  } else {

    playbackStatus.textContent =
      "Nenhum som detectado";

    await sleep(1200);
  }

  scores[player.id] =
    (scores[player.id] || 0) +
    score;

  playbackIndex++;

  await sleep(500);

  await playNextHostTake();
}


async function playGuestPlayback(data) {

  showOnly(
    playbackScreen
  );

  playbackName.textContent =
    data.name;

  playbackStatus.textContent =
    "Reproduzindo...";

  /*
    Voz fica fora durante
    a reprodução.
  */
  stopOutgoingVoiceOnly();

  if (
    data.audio
  ) {

    await playRecording(
      data.audio
    );

  } else {

    playbackStatus.textContent =
      "Nenhum som detectado";

    await sleep(1200);
  }

  if (data.finalTake) {

    await restoreVoiceAfterRecording();
  }
}


async function playRecording(data) {

  try {

    const buffer =
      await base64ToAudioBuffer(
        data
      );

    await playAudioBuffer(
      buffer
    );

  } catch {

    /*
      fallback
    */

    try {

      const audio =
        new Audio(
          "data:audio/webm;base64," +
          data
        );

      audio.volume = 1;

      await audio.play();

      await new Promise(
        resolve => {

          audio.onended =
            resolve;

          audio.onerror =
            resolve;
        }
      );

    } catch {}
  }
}


/* =========================================================
   SCORE
   ========================================================= */

async function calculateScore(
  recording
) {

  /*
    REGRA PRINCIPAL:

    Sem áudio = ZERO.

    Isso impede o bug dos 70 pontos
    quando o jogador não fala nada.
  */

  if (
    !recording ||
    !recording.audio ||
    recording.state === "silence"
  ) {
    return 0;
  }

  const valid =
    await detectRealAudioFromBase64(
      recording.audio
    );

  if (!valid) {
    return 0;
  }

  if (!currentReferenceBuffer) {
    return 0;
  }

  try {

    const playerBuffer =
      await base64ToAudioBuffer(
        recording.audio
      );

    const referenceFeatures =
      extractAudioFeatures(
        currentReferenceBuffer
      );

    const playerFeatures =
      extractAudioFeatures(
        playerBuffer
      );

    /*
      Pontuação simples e conservadora.

      Timbre NÃO entra na conta.
    */

    const rhythm =
      compareNumber(
        referenceFeatures.duration,
        playerFeatures.duration,
        1.2
      );

    const energy =
      compareNumber(
        referenceFeatures.energy,
        playerFeatures.energy,
        0.8
      );

    const attacks =
      compareNumber(
        referenceFeatures.attacks,
        playerFeatures.attacks,
        1.5
      );

    const pitch =
      compareNumber(
        referenceFeatures.pitch,
        playerFeatures.pitch,
        500
      );

    let score =
      rhythm * 0.35 +
      attacks * 0.25 +
      pitch * 0.25 +
      energy * 0.15;

    /*
      Impede pontuação alta para
      qualquer som aleatório.
    */

    if (
      playerFeatures.attacks === 0 ||
      playerFeatures.energy < 0.004
    ) {
      return 0;
    }

    score =
      Math.max(
        0,
        Math.min(
          100,
          Math.round(score)
        )
      );

    return score;

  } catch {

    return 0;
  }
}


function extractAudioFeatures(buffer) {

  const data =
    buffer.getChannelData(0);

  const sampleRate =
    buffer.sampleRate;

  let sum = 0;
  let peak = 0;
  let zeroCrossings = 0;
  let previous = data[0] || 0;

  let attacks = 0;

  const attackThreshold =
    0.025;

  for (
    let i = 0;
    i < data.length;
    i++
  ) {

    const value =
      Math.abs(data[i]);

    sum += value;

    if (value > peak) {
      peak = value;
    }

    if (
      previous <= 0 &&
      data[i] > 0
    ) {
      zeroCrossings++;
    }

    previous = data[i];

    if (
      i > 2048 &&
      value >
      attackThreshold &&
      Math.abs(
        data[i - 1]
      ) < attackThreshold
    ) {
      attacks++;
    }
  }

  const duration =
    buffer.duration;

  const energy =
    sum / data.length;

  let pitch = 0;

  if (duration > 0) {

    pitch =
      zeroCrossings /
      duration /
      2;
  }

  return {
    duration,
    energy,
    peak,
    attacks: Math.min(
      attacks,
      30
    ),
    pitch
  };
}


function compareNumber(
  a,
  b,
  tolerance
) {

  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b)
  ) {
    return 0;
  }

  const difference =
    Math.abs(a - b);

  return Math.max(
    0,
    100 -
    (difference / tolerance) * 100
  );
}


/* =========================================================
   WHEEL
   ========================================================= */

async function finishPlaybackHost() {

  showOnly(
    wheelScreen
  );

  wheelElement.textContent =
    "RODA";

  wheelResult.textContent =
    "Sorteando...";

  broadcast({
    type: "wheel"
  });

  await sleep(1800);

  const result =
    spinWheel();

  wheelElement.textContent =
    result.label;

  wheelResult.textContent =
    result.text;

  await sleep(1800);

  broadcast({
    type: "round_result",
    result: result.text,
    scores
  });

  showRoundResult({
    result: result.text,
    scores
  });

  await sleep(2200);

  if (
    currentRound >=
    TOTAL_ROUNDS
  ) {

    finishGame();

    return;
  }

  currentRound++;

  broadcast({
    type: "game_start",
    round: currentRound
  });

  await sleep(500);

  startHostRound();
}


function spinWheel() {

  const options = [

    {
      label: "+10",
      text: "Todos ganharam +10 pontos."
    },

    {
      label: "+20",
      text: "Todos ganharam +20 pontos."
    },

    {
      label: "x2",
      text: "A próxima pontuação vale o dobro."
    },

    {
      label: "NORMAL",
      text: "Nenhum efeito."
    }

  ];

  const selected =
    options[
      Math.floor(
        Math.random() *
        options.length
      )
    ];

  if (
    selected.label === "+10"
  ) {

    players.forEach(
      player => {
        scores[player.id] =
          (scores[player.id] || 0) +
          10;
      }
    );
  }

  if (
    selected.label === "+20"
  ) {

    players.forEach(
      player => {
        scores[player.id] =
          (scores[player.id] || 0) +
          20;
      }
    );
  }

  return selected;
}


function showWheel(data) {

  showOnly(
    wheelScreen
  );

  wheelElement.textContent =
    "RODA";

  wheelResult.textContent =
    "Sorteando...";
}


/* =========================================================
   RESULTS
   ========================================================= */

function showRoundResult(data) {

  showOnly(
    resultScreen
  );

  const list =
    players
      .map(player => {

        return (
          player.name +
          ": " +
          (scores[player.id] || 0)
        );

      })
      .join("\n");

  resultText.textContent =
    data.result +
    "\n\n" +
    list;
}


function finishGame() {

  const ranking =
    players
      .map(player => ({
        name: player.name,
        score:
          scores[player.id] || 0
      }))
      .sort(
        (a, b) =>
          b.score - a.score
      );

  broadcast({
    type: "game_finished",
    ranking
  });

  showFinalResult({
    ranking
  });
}


function showFinalResult(data) {

  showOnly(
    resultScreen
  );

  const text =
    data.ranking
      .map(
        (player, index) =>
          `${index + 1}. ${player.name} — ${player.score}`
      )
      .join("\n");

  resultText.textContent =
    "Resultado final\n\n" +
    text;
}


/* =========================================================
   VOICE
   ========================================================= */

micButton.onclick = async () => {

  if (microphoneEnabled) {

    disableMicrophone();

    return;
  }

  await enableMicrophone();
};


gameVoiceButton.onclick = async () => {

  /*
    IMPORTANTE:

    Voz da partida começa OFF.
    OFF não significa deixar de ouvir.
    Só para o envio do próprio microfone.
  */

  if (gameVoiceEnabled) {

    gameVoiceEnabled = false;

    stopOutgoingVoiceOnly();

    setGameVoiceButton();

    return;
  }

  if (!microphoneEnabled) {

    await enableMicrophone();

  }

  gameVoiceEnabled = true;

  startOutgoingVoice();

  setGameVoiceButton();
};


async function enableMicrophone() {

  if (microphoneEnabled) {
    return true;
  }

  try {

    localStream =
      await navigator.mediaDevices
        .getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000,
            latency: 0
          }
        });

    microphoneEnabled = true;

    /*
      Na partida continua OFF
      até o botão da partida ser usado.
    */

    if (!gameStarted) {
      startOutgoingVoice();
    }

    updateVoiceStatus();

    return true;

  } catch (error) {

    console.error(error);

    microphoneEnabled = false;

    updateVoiceStatus();

    alert(
      "Não foi possível acessar o microfone."
    );

    return false;
  }
}


function disableMicrophone() {

  microphoneEnabled = false;

  gameVoiceEnabled = false;

  stopOutgoingVoiceOnly();

  if (localStream) {

    localStream
      .getTracks()
      .forEach(
        track => {
          track.enabled = false;
        }
      );
  }

  updateVoiceStatus();

  setGameVoiceButton();
}


/*
  ESSA FUNÇÃO NÃO FECHA AS CHAMADAS RECEBIDAS.

  Ela somente para de transmitir.
*/

function stopOutgoingVoiceOnly() {

  voiceCalls.forEach(
    call => {

      try {
        call.close();
      } catch {}
    }
  );

  voiceCalls.clear();
}


function startOutgoingVoice() {

  if (
    !peer ||
    !localStream ||
    !microphoneEnabled
  ) {
    return;
  }

  if (
    gameStarted &&
    !gameVoiceEnabled
  ) {
    return;
  }

  players.forEach(
    player => {

      if (
        player.id === peer.id
      ) {
        return;
      }

      callPlayer(
        player.id
      );
    }
  );
}


function callPlayer(playerId) {

  if (!peer) return;

  if (
    playerId === peer.id
  ) {
    return;
  }

  if (
    !localStream ||
    !microphoneEnabled
  ) {
    return;
  }

  if (
    gameStarted &&
    !gameVoiceEnabled
  ) {
    return;
  }

  if (
    voiceCalls.has(playerId)
  ) {
    return;
  }

  try {

    const call =
      peer.call(
        playerId,
        localStream,
        {
          metadata: {
            voice: true
          }
        }
      );

    if (!call) return;

    voiceCalls.set(
      playerId,
      call
    );

    call.on(
      "close",
      () => {

        if (
          voiceCalls.get(
            playerId
          ) === call
        ) {
          voiceCalls.delete(
            playerId
          );
        }
      }
    );

    call.on(
      "error",
      () => {

        if (
          voiceCalls.get(
            playerId
          ) === call
        ) {
          voiceCalls.delete(
            playerId
          );
        }
      }
    );

  } catch {}
}


/*
  RECEBER VOZ NÃO DEPENDE
  DO SEU MICROFONE ESTAR ON.
*/

function handleIncomingVoiceCall(call) {

  try {

    /*
      Se for chamada de voz,
      sempre responde sem exigir
      que o próprio microfone esteja ON.
    */

    if (
      localStream &&
      microphoneEnabled &&
      (
        !gameStarted ||
        gameVoiceEnabled
      )
    ) {

      call.answer(
        localStream
      );

    } else {

      /*
        Responde sem transmitir.
        O outro jogador continua
        podendo mandar áudio.
      */

      call.answer();
    }

    call.on(
      "stream",
      stream => {

        playIncomingStream(
          call.peer,
          stream
        );
      }
    );

    call.on(
      "close",
      () => {

        removeRemoteAudio(
          call.peer
        );
      }
    );

  } catch {}
}


function playIncomingStream(
  playerId,
  stream
) {

  let audio =
    document.getElementById(
      "voice-" + playerId
    );

  if (!audio) {

    audio =
      document.createElement(
        "audio"
      );

    audio.id =
      "voice-" + playerId;

    audio.autoplay = true;

    audio.playsInline = true;

    audio.volume = 1;

    audio.style.display =
      "none";

    document
      .getElementById(
        "remoteAudios"
      )
      .appendChild(audio);
  }

  audio.srcObject =
    stream;

  audio.play()
    .catch(() => {});
}


function removeRemoteAudio(
  playerId
) {

  const audio =
    document.getElementById(
      "voice-" + playerId
    );

  if (audio) {
    audio.remove();
  }
}


function getHostConnection() {

  if (isHost) {
    return null;
  }

  for (
    const connection
    of connections.values()
  ) {
    return connection;
  }

  return null;
}


/* =========================================================
   VOICE DURING GAME
   ========================================================= */

async function restoreVoiceAfterRecording() {

  if (!microphoneEnabled) {
    return;
  }

  if (
    gameStarted &&
    !gameVoiceEnabled
  ) {
    return;
  }

  if (localStream) {

    localStream
      .getTracks()
      .forEach(
        track => {
          track.enabled = true;
        }
      );
  }

  startOutgoingVoice();
}


function prepareVoiceForRecording() {

  stopOutgoingVoiceOnly();

  if (localStream) {

    localStream
      .getTracks()
      .forEach(
        track => {
          track.enabled = false;
        }
      );
  }
}


/* =========================================================
   AUDIO HELPERS
   ========================================================= */

function audioBufferToBase64(
  buffer
) {

  const channels =
    buffer.numberOfChannels;

  const length =
    buffer.length;

  const sampleRate =
    buffer.sampleRate;

  const interleaved =
    new Float32Array(
      length * channels
    );

  for (
    let channel = 0;
    channel < channels;
    channel++
  ) {

    const data =
      buffer.getChannelData(
        channel
      );

    for (
      let i = 0;
      i < length;
      i++
    ) {

      interleaved[
        i * channels + channel
      ] = data[i];
    }
  }

  const wav =
    encodeWAV(
      interleaved,
      channels,
      sampleRate
    );

  return arrayBufferToBase64(
    wav
  );
}


function encodeWAV(
  samples,
  channels,
  sampleRate
) {

  const buffer =
    new ArrayBuffer(
      44 +
      samples.length * 2
    );

  const view =
    new DataView(buffer);

  writeString(
    view,
    0,
    "RIFF"
  );

  view.setUint32(
    4,
    36 +
    samples.length * 2,
    true
  );

  writeString(
    view,
    8,
    "WAVE"
  );

  writeString(
    view,
    12,
    "fmt "
  );

  view.setUint32(
    16,
    16,
    true
  );

  view.setUint16(
    20,
    1,
    true
  );

  view.setUint16(
    22,
    channels,
    true
  );

  view.setUint32(
    24,
    sampleRate,
    true
  );

  view.setUint32(
    28,
    sampleRate *
    channels *
    2,
    true
  );

  view.setUint16(
    32,
    channels * 2,
    true
  );

  view.setUint16(
    34,
    16,
    true
  );

  writeString(
    view,
    36,
    "data"
  );

  view.setUint32(
    40,
    samples.length * 2,
    true
  );

  let offset = 44;

  for (
    let i = 0;
    i < samples.length;
    i++
  ) {

    const sample =
      Math.max(
        -1,
        Math.min(
          1,
          samples[i]
        )
      );

    view.setInt16(
      offset,
      sample < 0
        ? sample * 0x8000
        : sample * 0x7fff,
      true
    );

    offset += 2;
  }

  return buffer;
}


function writeString(
  view,
  offset,
  string
) {

  for (
    let i = 0;
    i < string.length;
    i++
  ) {

    view.setUint8(
      offset + i,
      string.charCodeAt(i)
    );
  }
}


async function base64ToAudioBuffer(
  base64
) {

  const bytes =
    base64ToArrayBuffer(
      base64
    );

  const context =
    new AudioContext();

  const buffer =
    await context.decodeAudioData(
      bytes.slice(0)
    );

  await context.close();

  return buffer;
}


function playAudioBuffer(
  buffer
) {

  return new Promise(resolve => {

    const context =
      new AudioContext();

    const source =
      context.createBufferSource();

    source.buffer =
      buffer;

    source.connect(
      context.destination
    );

    source.onended = () => {

      context.close()
        .catch(() => {});

      resolve();
    };

    source.start();
  });
}


function blobToBase64(blob) {

  return new Promise(resolve => {

    const reader =
      new FileReader();

    reader.onloadend = () => {

      const result =
        reader.result;

      resolve(
        result.split(",")[1]
      );
    };

    reader.readAsDataURL(
      blob
    );
  });
}


function base64ToArrayBuffer(
  base64
) {

  const binary =
    atob(base64);

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let i = 0;
    i < binary.length;
    i++
  ) {

    bytes[i] =
      binary.charCodeAt(i);
  }

  return bytes.buffer;
}


async function detectRealAudioFromBase64(
  base64
) {

  try {

    const buffer =
      await base64ToAudioBuffer(
        base64
      );

    const data =
      buffer.getChannelData(0);

    let sum = 0;
    let peak = 0;

    for (
      let i = 0;
      i < data.length;
      i++
    ) {

      const value =
        Math.abs(data[i]);

      sum += value;

      peak =
        Math.max(
          peak,
          value
        );
    }

    const average =
      sum / data.length;

    return (
      peak >= 0.025 &&
      average >= 0.0035
    );

  } catch {

    return false;
  }
}


/* =========================================================
   UI
   ========================================================= */

function resetGameScreens() {

  [
    countdownScreen,
    referenceScreen,
    recordScreen,
    playbackScreen,
    wheelScreen,
    resultScreen
  ]
  .forEach(
    element =>
      element.classList.add(
        "hidden"
      )
  );

  countdownScreen.classList.remove(
    "hidden"
  );

  gameVoiceEnabled = false;

  setGameVoiceButton();
}


function showOnly(element) {

  [
    countdownScreen,
    referenceScreen,
    recordScreen,
    playbackScreen,
    wheelScreen,
    resultScreen
  ]
  .forEach(
    screen =>
      screen.classList.add(
        "hidden"
      )
  );

  element.classList.remove(
    "hidden"
  );
}


/* =========================================================
   LEAVE ROOM
   ========================================================= */

leaveRoomButton.onclick = () => {
  leaveRoom();
};


function leaveRoom() {

  clearInterval(
    countdownTimer
  );

  clearInterval(
    recordTimer
  );

  clearTimeout(
    referenceTimeout
  );

  stopOutgoingVoiceOnly();

  if (localStream) {

    localStream
      .getTracks()
      .forEach(
        track => track.stop()
      );

    localStream = null;
  }

  connections.forEach(
    connection => {

      try {
        connection.close();
      } catch {}
    }
  );

  connections.clear();

  voiceCalls.clear();

  if (peer) {

    try {
      peer.destroy();
    } catch {}

    peer = null;
  }

  players = [];

  recordings = {};

  scores = {};

  roomCode = "";

  isHost = false;

  gameStarted = false;

  microphoneEnabled = false;

  gameVoiceEnabled = false;

  updateVoiceStatus();

  showSection(homeScreen);
}


/* =========================================================
   COPY CODE
   ========================================================= */

copyCodeButton.onclick = async () => {

  try {

    await navigator.clipboard.writeText(
      roomCode
    );

    copyCodeButton.textContent =
      "Copiado";

    setTimeout(() => {

      copyCodeButton.textContent =
        "Copiar código";

    }, 1200);

  } catch {}
};


/* =========================================================
   GAME START STATE
   ========================================================= */

function gameStateChanged() {

  gameStarted = true;

  /*
    Sempre começa OFF.
  */

  gameVoiceEnabled = false;

  stopOutgoingVoiceOnly();

  setGameVoiceButton();
}


/* =========================================================
   RECORDING VOICE CONTROL PATCH
   ========================================================= */

const originalStartRecordingPhase =
  startRecordingPhase;


/*
  Antes de gravar, garante que
  nenhuma transmissão continue.
*/

window.prepareRecordingMicrophone =
  prepareVoiceForRecording;


/* =========================================================
   INITIALIZATION
   ========================================================= */

showSection(
  loginScreen
);

setGameVoiceButton();

updateVoiceStatus();

loadAccount();
