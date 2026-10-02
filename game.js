const login = document.getElementById("login");
const home = document.getElementById("home");
const room = document.getElementById("room");
const game = document.getElementById("game");

const usernameInput = document.getElementById("username");
const loginButton = document.getElementById("loginButton");

const profileName = document.getElementById("profileName");
const profileAvatar = document.getElementById("profileAvatar");

const createButton = document.getElementById("create");
const joinButton = document.getElementById("join");
const logoutButton = document.getElementById("logout");

const copyCodeButton = document.getElementById("copyCode");
const leaveRoomButton = document.getElementById("leaveRoom");

const startButton = document.getElementById("start");

const roomCodeElement = document.getElementById("roomCode");
const statusElement = document.getElementById("status");
const playersElement = document.getElementById("players");

const micButton = document.getElementById("micButton");
const voiceStatus = document.getElementById("voiceStatus");
const remoteAudios = document.getElementById("remoteAudios");

const countdownScreen =
  document.getElementById("countdownScreen");

const countdownNumber =
  document.getElementById("countdownNumber");

const referenceScreen =
  document.getElementById("referenceScreen");

const recordScreen =
  document.getElementById("recordScreen");

const resultScreen =
  document.getElementById("resultScreen");

const roundText =
  document.getElementById("roundText");

const gamePlayers =
  document.getElementById("gamePlayers");

const recordTimer =
  document.getElementById("recordTimer");

const recordStatus =
  document.getElementById("recordStatus");

const resultText =
  document.getElementById("resultText");


/* =========================
   ESTADO
========================= */

let peer = null;
let hostConnection = null;

let isHost = false;

let myName = "";
let roomCode = "";

let players = [];

let localStream = null;
let microphoneEnabled = false;

let gameStarted = false;
let leavingRoom = false;

let heartbeatTimer = null;
let guestHeartbeatTimer = null;

let countdownTimer = null;

let voiceRetryTimer = null;
let voiceRetryUntil = 0;


/*
  playerId -> true/false
*/
const voiceStates = new Map();


/*
  playerId -> MediaConnection
*/
const activeCalls = new Map();


/*
  playerId -> DataConnection
*/
const hostConnections = new Map();


/*
  playerId -> timestamp
*/
const lastHeartbeat = new Map();


const ACCOUNT_KEY =
  "shadow_games_account";


/* =========================
   CONTA
========================= */

function cleanName(name) {

  return name
    .trim()
    .slice(0, 16);

}


function saveAccount(name) {

  localStorage.setItem(
    ACCOUNT_KEY,
    JSON.stringify({
      name: name
    })
  );

}


function loadAccount() {

  try {

    const saved =
      localStorage.getItem(
        ACCOUNT_KEY
      );

    if (!saved) {
      return null;
    }

    const account =
      JSON.parse(saved);

    if (!account.name) {
      return null;
    }

    return cleanName(
      account.name
    );

  } catch (error) {

    return null;

  }

}


function deleteAccount() {

  localStorage.removeItem(
    ACCOUNT_KEY
  );

}


/* =========================
   TELAS
========================= */

function openHome() {

  login.classList.add("hidden");
  room.classList.add("hidden");
  game.classList.add("hidden");

  home.classList.remove("hidden");

  profileName.textContent =
    myName;

  profileAvatar.textContent =
    myName
      .charAt(0)
      .toUpperCase();

}


function openLogin() {

  login.classList.remove("hidden");
  home.classList.add("hidden");
  room.classList.add("hidden");
  game.classList.add("hidden");

  usernameInput.value = "";

}


function showRoom() {

  login.classList.add("hidden");
  home.classList.add("hidden");
  game.classList.add("hidden");

  room.classList.remove("hidden");

  roomCodeElement.textContent =
    roomCode.toUpperCase();

}


function showGame() {

  login.classList.add("hidden");
  home.classList.add("hidden");
  room.classList.add("hidden");

  game.classList.remove("hidden");

  gamePlayers.textContent =
    `${players.length}/5`;

  roundText.textContent =
    "Rodada 1";

}


/* =========================
   LOGIN
========================= */

loginButton.addEventListener(
  "click",
  () => {

    const name =
      cleanName(
        usernameInput.value
      );

    if (!name) {

      alert(
        "Digite um nome de usuário."
      );

      return;

    }

    myName =
      name;

    saveAccount(
      myName
    );

    openHome();

  }
);


usernameInput.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key === "Enter"
    ) {

      loginButton.click();

    }

  }
);


const savedName =
  loadAccount();


if (savedName) {

  myName =
    savedName;

  openHome();

} else {

  openLogin();

}


/* =========================
   UTILIDADES
========================= */

function generateRoomCode() {

  const chars =
    "abcdefghijklmnopqrstuvwxyz";

  let code = "";

  for (
    let i = 0;
    i < 6;
    i++
  ) {

    code +=
      chars[
        Math.floor(
          Math.random() *
          chars.length
        )
      ];

  }

  return code;

}


function setStatus(text) {

  statusElement.textContent =
    text;

}


function updateStatus() {

  setStatus(
    `${players.length}/5 jogadores`
  );

  gamePlayers.textContent =
    `${players.length}/5`;

}


function escapeHTML(text) {

  const div =
    document.createElement(
      "div"
    );

  div.textContent =
    text;

  return div.innerHTML;

}


/* =========================
   JOGADORES
========================= */

function addPlayer(
  id,
  name
) {

  const existing =
    players.find(
      (player) =>
        player.id === id
    );


  if (existing) {

    existing.name =
      name;

  } else {

    players.push({
      id: id,
      name: name
    });

  }


  if (
    !voiceStates.has(id)
  ) {

    voiceStates.set(
      id,
      false
    );

  }


  renderPlayers();
  updateStatus();

}


function removePlayer(id) {

  if (!id) {
    return;
  }


  players =
    players.filter(
      (player) =>
        player.id !== id
    );


  voiceStates.delete(
    id
  );


  closeVoiceCall(
    id
  );


  removeRemoteAudio(
    id
  );


  hostConnections.delete(
    id
  );


  lastHeartbeat.delete(
    id
  );


  renderPlayers();
  updateStatus();

}


function renderPlayers() {

  playersElement.innerHTML =
    "";

  players.forEach(
    (player) => {

      const element =
        document.createElement(
          "div"
        );

      element.className =
        "player";

      const firstLetter =
        player.name
          .charAt(0)
          .toUpperCase();

      element.innerHTML = `
        <div class="avatar">
          ${escapeHTML(firstLetter)}
        </div>

        <div class="player-name">
          ${escapeHTML(player.name)}
        </div>

        <div class="player-status">
          Online
        </div>
      `;

      playersElement.appendChild(
        element
      );

    }
  );

}


/* =========================
   CONEXÕES
========================= */

function sendToAll(message) {

  if (!isHost) {
    return;
  }


  hostConnections.forEach(
    (connection) => {

      if (
        connection &&
        connection.open
      ) {

        try {

          connection.send(
            message
          );

        } catch (error) {}

      }

    }
  );

}


function sendToAllExcept(
  exceptId,
  message
) {

  if (!isHost) {
    return;
  }


  hostConnections.forEach(
    (connection, id) => {

      if (
        id === exceptId
      ) {

        return;

      }


      if (
        connection &&
        connection.open
      ) {

        try {

          connection.send(
            message
          );

        } catch (error) {}

      }

    }
  );

}


/* =========================
   VOZ
========================= */

function setVoiceState(
  playerId,
  enabled
) {

  if (!playerId) {
    return;
  }


  voiceStates.set(
    playerId,
    !!enabled
  );

}


function announceMyVoiceState(
  enabled
) {

  if (!peer) {
    return;
  }


  const myId =
    peer.id;


  setVoiceState(
    myId,
    enabled
  );


  const message = {
    type:
      "voice_state",

    playerId:
      myId,

    enabled:
      !!enabled
  };


  if (isHost) {

    sendToAll(
      message
    );

  } else if (
    hostConnection &&
    hostConnection.open
  ) {

    try {

      hostConnection.send(
        message
      );

    } catch (error) {}

  }


  startVoiceRetry();

}


function hostHandleVoiceState(
  playerId,
  enabled
) {

  if (!isHost) {
    return;
  }


  const exists =
    players.some(
      (player) =>
        player.id ===
        playerId
    );


  if (!exists) {
    return;
  }


  setVoiceState(
    playerId,
    enabled
  );


  /*
    O estado vai para todos.
  */

  sendToAll({
    type:
      "voice_state",

    playerId:
      playerId,

    enabled:
      !!enabled
  });


  if (!enabled) {

    closeVoiceCall(
      playerId
    );

    removeRemoteAudio(
      playerId
    );

  }


  startVoiceRetry();

}


function receiveVoiceState(
  playerId,
  enabled
) {

  if (!playerId) {
    return;
  }


  setVoiceState(
    playerId,
    enabled
  );


  if (!enabled) {

    closeVoiceCall(
      playerId
    );

    removeRemoteAudio(
      playerId
    );

  }


  startVoiceRetry();

}


/* =========================
   MICROFONE
========================= */

async function enableMicrophone() {

  if (
    localStream
  ) {

    localStream
      .getAudioTracks()
      .forEach(
        (track) => {

          track.enabled =
            true;

        }
      );


    microphoneEnabled =
      true;


    micButton.textContent =
      "Desativar microfone";

    micButton.classList.add(
      "active"
    );

    micButton.classList.remove(
      "disabled"
    );

    voiceStatus.textContent =
      "Microfone ligado";


    announceMyVoiceState(
      true
    );

    return;

  }


  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    voiceStatus.textContent =
      "Microfone não suportado";

    return;

  }


  try {

    voiceStatus.textContent =
      "Pedindo permissão...";


    const stream =
      await navigator.mediaDevices
        .getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });


    localStream =
      stream;


    microphoneEnabled =
      true;


    localStream
      .getAudioTracks()
      .forEach(
        (track) => {

          track.enabled =
            true;

        }
      );


    micButton.textContent =
      "Desativar microfone";

    micButton.classList.add(
      "active"
    );

    micButton.classList.remove(
      "disabled"
    );

    voiceStatus.textContent =
      "Microfone ligado";


    announceMyVoiceState(
      true
    );

  } catch (error) {

    microphoneEnabled =
      false;

    voiceStatus.textContent =
      "Microfone não autorizado";

    micButton.textContent =
      "Ativar microfone";

    micButton.classList.remove(
      "active"
    );

  }

}


function disableMicrophone() {

  microphoneEnabled =
    false;


  if (localStream) {

    localStream
      .getAudioTracks()
      .forEach(
        (track) => {

          track.enabled =
            false;

        }
      );

  }


  micButton.textContent =
    "Ativar microfone";

  micButton.classList.remove(
    "active"
  );

  micButton.classList.add(
    "disabled"
  );

  voiceStatus.textContent =
    "Microfone desligado";


  announceMyVoiceState(
    false
  );


  closeAllVoiceCalls();

}


micButton.addEventListener(
  "click",
  async () => {

    if (
      microphoneEnabled
    ) {

      disableMicrophone();

    } else {

      await enableMicrophone();

    }

  }
);


/* =========================
   ÁUDIO REMOTO
========================= */

function createRemoteAudio(
  playerId,
  stream
) {

  let audio =
    document.getElementById(
      `audio-${playerId}`
    );


  if (!audio) {

    audio =
      document.createElement(
        "audio"
      );

    audio.id =
      `audio-${playerId}`;

    audio.autoplay =
      true;

    audio.playsInline =
      true;

    audio.controls =
      false;

    audio.volume =
      1;

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

  const promise =
    audio.play();


  if (
    promise &&
    promise.catch
  ) {

    promise.catch(
      () => {

        /*
          Em alguns celulares
          o navegador segura o
          autoplay até o usuário
          tocar na tela.
        */

      }
    );

  }

}


function removeRemoteAudio(
  playerId
) {

  const audio =
    document.getElementById(
      `audio-${playerId}`
    );


  if (!audio) {
    return;
  }


  try {

    audio.pause();

  } catch (error) {}


  audio.srcObject =
    null;

  audio.remove();

}


/*
  Se o usuário tocar na tela,
  tentamos liberar áudios remotos
  que o navegador tenha bloqueado.
*/
document.addEventListener(
  "click",
  () => {

    remoteAudios
      .querySelectorAll(
        "audio"
      )
      .forEach(
        (audio) => {

          const promise =
            audio.play();

          if (
            promise &&
            promise.catch
          ) {

            promise.catch(
              () => {}
            );

          }

        }
      );

  }
);


/* =========================
   CHAMADAS
========================= */

function closeVoiceCall(
  playerId
) {

  const call =
    activeCalls.get(
      playerId
    );


  if (call) {

    try {

      call.close();

    } catch (error) {}

  }


  activeCalls.delete(
    playerId
  );


  removeRemoteAudio(
    playerId
  );

}


function closeAllVoiceCalls() {

  activeCalls.forEach(
    (call) => {

      try {

        call.close();

      } catch (error) {}

    }
  );


  activeCalls.clear();


  remoteAudios.innerHTML =
    "";

}


/*
  Apenas o menor ID inicia.
  Isso evita duas chamadas iguais.
*/
function shouldInitiateCall(
  remoteId
) {

  if (!peer) {
    return false;
  }


  return (
    String(peer.id) <
    String(remoteId)
  );

}


function callPlayer(
  playerId
) {

  if (!peer) {
    return;
  }


  if (
    !localStream ||
    !microphoneEnabled
  ) {

    return;

  }


  if (
    voiceStates.get(
      playerId
    ) !== true
  ) {

    return;

  }


  if (
    playerId ===
    peer.id
  ) {

    return;

  }


  if (
    activeCalls.has(
      playerId
    )
  ) {

    return;

  }


  let call;


  try {

    call =
      peer.call(
        playerId,
        localStream,
        {
          metadata: {
            voice:
              true
          }
        }
      );

  } catch (error) {

    return;

  }


  if (!call) {
    return;
  }


  activeCalls.set(
    playerId,
    call
  );


  call.on(
    "stream",
    (stream) => {

      if (
        voiceStates.get(
          playerId
        ) !== true
      ) {

        return;

      }


      createRemoteAudio(
        playerId,
        stream
      );

    }
  );


  call.on(
    "close",
    () => {

      activeCalls.delete(
        playerId
      );

      removeRemoteAudio(
        playerId
      );

      /*
        Se ainda deveria existir,
        tenta novamente.
      */

      if (
        microphoneEnabled &&
        voiceStates.get(
          playerId
        ) === true
      ) {

        startVoiceRetry();

      }

    }
  );


  call.on(
    "error",
    () => {

      activeCalls.delete(
        playerId
      );

      removeRemoteAudio(
        playerId
      );


      if (
        microphoneEnabled &&
        voiceStates.get(
          playerId
        ) === true
      ) {

        startVoiceRetry();

      }

    }
  );

}


/*
  Aceita uma chamada sem ligar
  nosso microfone.

  Se temos microfone ligado,
  mandamos nossa stream também.

  Se não temos, call.answer()
  cria chamada de mão única.
*/
function answerVoiceCall(
  call
) {

  if (!call) {
    return;
  }


  const callerId =
    call.peer;


  /*
    Se metadata disser que o
    caller está transmitindo,
    podemos aceitar.
  */

  const callerSaysVoice =
    !call.metadata ||
    call.metadata.voice !== false;


  if (!callerSaysVoice) {

    try {

      call.close();

    } catch (error) {}

    return;

  }


  /*
    Se já existe uma chamada
    melhor para esse jogador,
    não criamos duplicada.
  */

  if (
    activeCalls.has(
      callerId
    )
  ) {

    try {

      call.close();

    } catch (error) {}

    return;

  }


  try {

    if (
      localStream &&
      microphoneEnabled
    ) {

      call.answer(
        localStream
      );

    } else {

      /*
        Só ouvir.
        NÃO ativa microfone.
      */

      call.answer();

    }

  } catch (error) {

    try {

      call.close();

    } catch (e) {}

    return;

  }


  activeCalls.set(
    callerId,
    call
  );


  call.on(
    "stream",
    (stream) => {

      if (
        voiceStates.get(
          callerId
        ) !== true
      ) {

        removeRemoteAudio(
          callerId
        );

        return;

      }


      createRemoteAudio(
        callerId,
        stream
      );

    }
  );


  call.on(
    "close",
    () => {

      activeCalls.delete(
        callerId
      );

      removeRemoteAudio(
        callerId
      );

    }
  );


  call.on(
    "error",
    () => {

      activeCalls.delete(
        callerId
      );

      removeRemoteAudio(
        callerId
      );

    }
  );

}


/* =========================
   RECONEXÃO DA VOZ
========================= */

function tryConnectVoice() {

  if (!peer) {
    return;
  }


  if (
    !microphoneEnabled ||
    !localStream
  ) {

    return;

  }


  const now =
    Date.now();


  if (
    now >
    voiceRetryUntil
  ) {

    return;

  }


  players.forEach(
    (player) => {

      const playerId =
        player.id;


      if (
        playerId ===
        peer.id
      ) {

        return;

      }


      if (
        voiceStates.get(
          playerId
        ) !== true
      ) {

        closeVoiceCall(
          playerId
        );

        return;

      }


      if (
        shouldInitiateCall(
          playerId
        )
      ) {

        if (
          !activeCalls.has(
            playerId
          )
        ) {

          callPlayer(
            playerId
          );

        }

      }

    }
  );

}


function startVoiceRetry() {

  if (!peer) {
    return;
  }


  /*
    Tenta por 6 segundos.
  */

  voiceRetryUntil =
    Date.now() + 6000;


  if (
    voiceRetryTimer
  ) {

    return;

  }


  tryConnectVoice();


  voiceRetryTimer =
    setInterval(
      () => {

        if (
          Date.now() >
          voiceRetryUntil
        ) {

          clearInterval(
            voiceRetryTimer
          );

          voiceRetryTimer =
            null;

          return;

        }


        tryConnectVoice();

      },
      700
    );

}


function stopVoiceRetry() {

  if (
    voiceRetryTimer
  ) {

    clearInterval(
      voiceRetryTimer
    );

    voiceRetryTimer =
      null;

  }


  voiceRetryUntil =
    0;

}


/* =========================
   SISTEMA DE VOZ
========================= */

function setupVoiceSystem() {

  if (!peer) {
    return;
  }


  /*
    IMPORTANTE:

    receber chamada NÃO ativa
    o microfone.
  */

  peer.on(
    "call",
    (call) => {

      answerVoiceCall(
        call
      );

    }
  );

}


/* =========================
   HOST
========================= */

function setupHostConnection(
  connection
) {

  hostConnections.set(
    connection.peer,
    connection
  );


  lastHeartbeat.set(
    connection.peer,
    Date.now()
  );


  connection.on(
    "open",
    () => {

      lastHeartbeat.set(
        connection.peer,
        Date.now()
      );

    }
  );


  connection.on(
    "data",
    (message) => {

      if (
        !message ||
        !message.type
      ) {

        return;

      }


      lastHeartbeat.set(
        connection.peer,
        Date.now()
      );


      /* =====================
         ENTRAR
      ===================== */

      if (
        message.type ===
        "join"
      ) {

        if (
          players.length >= 5
        ) {

          try {

            connection.send({
              type:
                "room_full"
            });

          } catch (error) {}


          connection.close();

          return;

        }


        addPlayer(
          connection.peer,
          message.name
        );


        setVoiceState(
          connection.peer,
          false
        );


        try {

          connection.send({
            type:
              "players",
            players:
              players
          });

        } catch (error) {}


        broadcastPlayers();


        sendVoiceStatesTo(
          connection
        );


        return;

      }


      /* =====================
         SAIR
      ===================== */

      if (
        message.type ===
        "leave"
      ) {

        removeHostConnection(
          connection.peer
        );

        return;

      }


      /* =====================
         HEARTBEAT
      ===================== */

      if (
        message.type ===
        "heartbeat"
      ) {

        lastHeartbeat.set(
          connection.peer,
          Date.now()
        );


        try {

          connection.send({
            type:
              "heartbeat_ack"
          });

        } catch (error) {}

        return;

      }


      /* =====================
         VOZ
      ===================== */

      if (
        message.type ===
        "voice_state"
      ) {

        /*
          O host ignora o playerId
          enviado pelo cliente e usa
          o ID da própria conexão.

          Isso evita um jogador
          alterar o estado de outro.
        */

        hostHandleVoiceState(
          connection.peer,
          message.enabled
        );

        return;

      }

    }
  );


  connection.on(
    "close",
    () => {

      removeHostConnection(
        connection.peer
      );

    }
  );


  connection.on(
    "error",
    () => {

      removeHostConnection(
        connection.peer
      );

    }
  );

}


function sendVoiceStatesTo(
  connection
) {

  voiceStates.forEach(
    (enabled, playerId) => {

      if (
        connection &&
        connection.open
      ) {

        try {

          connection.send({
            type:
              "voice_state",

            playerId:
              playerId,

            enabled:
              enabled
          });

        } catch (error) {}

      }

    }
  );

}


function removeHostConnection(
  playerId
) {

  hostConnections.delete(
    playerId
  );


  lastHeartbeat.delete(
    playerId
  );


  const exists =
    players.some(
      (player) =>
        player.id ===
        playerId
    );


  if (!exists) {
    return;
  }


  removePlayer(
    playerId
  );


  broadcastPlayers();

}


/* =========================
   HEARTBEAT
========================= */

function startHostHeartbeat() {

  stopHostHeartbeat();


  heartbeatTimer =
    setInterval(
      () => {

        if (
          !isHost ||
          !peer
        ) {

          return;

        }


        const now =
          Date.now();


        hostConnections.forEach(
          (connection, id) => {

            const last =
              lastHeartbeat.get(
                id
              ) || 0;


            if (
              now - last >
              10000
            ) {

              try {

                connection.close();

              } catch (error) {}


              removeHostConnection(
                id
              );

              return;

            }


            if (
              connection.open
            ) {

              try {

                connection.send({
                  type:
                    "heartbeat"
                });

              } catch (error) {}

            }

          }
        );

      },
      3000
    );

}


function stopHostHeartbeat() {

  if (
    heartbeatTimer
  ) {

    clearInterval(
      heartbeatTimer
    );

    heartbeatTimer =
      null;

  }

}


function startGuestHeartbeat() {

  stopGuestHeartbeat();


  guestHeartbeatTimer =
    setInterval(
      () => {

        if (
          !hostConnection ||
          !hostConnection.open
        ) {

          return;

        }


        try {

          hostConnection.send({
            type:
              "heartbeat"
          });

        } catch (error) {}

      },
      3000
    );

}


function stopGuestHeartbeat() {

  if (
    guestHeartbeatTimer
  ) {

    clearInterval(
      guestHeartbeatTimer
    );

    guestHeartbeatTimer =
      null;

  }

}


/* =========================
   JOGADORES
========================= */

function broadcastPlayers() {

  if (!isHost) {
    return;
  }


  sendToAll({
    type:
      "players",
    players:
      players
  });


  renderPlayers();
  updateStatus();

}


/* =========================
   CRIAR SALA
========================= */

createButton.addEventListener(
  "click",
  () => {

    if (!myName) {

      openLogin();

      return;

    }


    isHost =
      true;

    gameStarted =
      false;

    leavingRoom =
      false;


    roomCode =
      generateRoomCode();


    players = [
      {
        id:
          roomCode,

        name:
          myName
      }
    ];


    voiceStates.clear();


    setVoiceState(
      roomCode,
      false
    );


    setStatus(
      "Criando sala..."
    );


    peer =
      new Peer(
        roomCode
      );


    setupVoiceSystem();


    peer.on(
      "open",
      (id) => {

        roomCode =
          id;


        setVoiceState(
          id,
          false
        );


        showRoom();


        startButton.style.display =
          "block";


        renderPlayers();
        updateStatus();


        startHostHeartbeat();

      }
    );


    peer.on(
      "connection",
      (connection) => {

        setupHostConnection(
          connection
        );

      }
    );


    peer.on(
      "disconnected",
      () => {

        setStatus(
          "Conexão com o servidor perdida."
        );

      }
    );


    peer.on(
      "close",
      () => {

        stopHostHeartbeat();
        stopVoiceRetry();

      }
    );


    peer.on(
      "error",
      (error) => {

        if (
          error.type ===
          "unavailable-id"
        ) {

          alert(
            "Esse código já está sendo usado. Crie outra sala."
          );


          try {

            peer.destroy();

          } catch (e) {}


          peer =
            null;

          isHost =
            false;

          roomCode =
            "";


          setStatus(
            "Erro ao criar sala."
          );

          return;

        }


        alert(
          "Erro na conexão: " +
          error.type
        );

      }
    );

  }
);


/* =========================
   ENTRAR
========================= */

joinButton.addEventListener(
  "click",
  () => {

    if (!myName) {

      openLogin();

      return;

    }


    const code =
      prompt(
        "Digite o código da sala:"
      );


    if (!code) {
      return;
    }


    roomCode =
      code
        .trim()
        .toLowerCase();


    if (
      roomCode.length !== 6
    ) {

      alert(
        "O código precisa ter 6 caracteres."
      );

      return;

    }


    isHost =
      false;

    gameStarted =
      false;

    leavingRoom =
      false;


    setStatus(
      "Entrando na sala..."
    );


    peer =
      new Peer();


    setupVoiceSystem();


    peer.on(
      "open",
      () => {

        hostConnection =
          peer.connect(
            roomCode,
            {
              reliable:
                true
            }
          );


        hostConnection.on(
          "open",
          () => {

            hostConnection.send({
              type:
                "join",

              name:
                myName
            });


            showRoom();


            startButton.style.display =
              "none";


            setStatus(
              "Conectado."
            );


            startGuestHeartbeat();

          }
        );


        hostConnection.on(
          "data",
          (message) => {

            if (
              !message ||
              !message.type
            ) {

              return;

            }


            /* ==================
               PLAYERS
            ================== */

            if (
              message.type ===
              "players"
            ) {

              players =
                Array.isArray(
                  message.players
                )
                  ? message.players
                  : [];


              const ids =
                new Set(
                  players.map(
                    (player) =>
                      player.id
                  )
                );


              voiceStates.forEach(
                (value, id) => {

                  if (
                    id !== peer.id &&
                    !ids.has(id)
                  ) {

                    voiceStates.delete(
                      id
                    );

                  }

                }
              );


              players.forEach(
                (player) => {

                  if (
                    !voiceStates.has(
                      player.id
                    )
                  ) {

                    voiceStates.set(
                      player.id,
                      false
                    );

                  }

                }
              );


              renderPlayers();
              updateStatus();


              startVoiceRetry();

              return;

            }


            /* ==================
               VOZ
            ================== */

            if (
              message.type ===
              "voice_state"
            ) {

              receiveVoiceState(
                message.playerId,
                message.enabled
              );

              return;

            }


            /* ==================
               HEARTBEAT
            ================== */

            if (
              message.type ===
              "heartbeat"
            ) {

              try {

                hostConnection.send({
                  type:
                    "heartbeat_ack"
                });

              } catch (error) {}

              return;

            }


            if (
              message.type ===
              "heartbeat_ack"
            ) {

              return;

            }


            /* ==================
               SALA CHEIA
            ================== */

            if (
              message.type ===
              "room_full"
            ) {

              alert(
                "A sala está cheia."
              );


              leaveRoom();

              return;

            }


            /* ==================
               HOST SAIU
            ================== */

            if (
              message.type ===
              "host_left"
            ) {

              players = [];

              voiceStates.clear();


              renderPlayers();


              setStatus(
                "O dono da sala saiu."
              );


              closeAllVoiceCalls();

              stopGuestHeartbeat();
              stopVoiceRetry();


              try {

                peer.destroy();

              } catch (error) {}


              peer =
                null;

              hostConnection =
                null;

              return;

            }


            /* ==================
               PARTIDA
            ================== */

            if (
              message.type ===
              "game_start"
            ) {

              gameStarted =
                true;


              players =
                message.players ||
                players;


              renderPlayers();
              updateStatus();


              startCountdown();

              return;

            }

          }
        );


        hostConnection.on(
          "close",
          () => {

            if (
              leavingRoom
            ) {

              return;

            }


            players = [];

            voiceStates.clear();


            renderPlayers();


            setStatus(
              "O dono da sala saiu."
            );


            closeAllVoiceCalls();

            stopGuestHeartbeat();
            stopVoiceRetry();


            hostConnection =
              null;


            if (peer) {

              try {

                peer.destroy();

              } catch (error) {}

            }


            peer =
              null;

          }
        );


        hostConnection.on(
          "error",
          () => {

            setStatus(
              "Conexão perdida."
            );

          }
        );

      }
    );


    peer.on(
      "disconnected",
      () => {

        setStatus(
          "Conexão perdida."
        );

      }
    );


    peer.on(
      "close",
      () => {

        stopGuestHeartbeat();
        stopVoiceRetry();

      }
    );


    peer.on(
      "error",
      (error) => {

        if (
          error.type ===
          "peer-unavailable"
        ) {

          alert(
            "Sala não encontrada."
          );

        } else {

          alert(
            "Erro na conexão: " +
            error.type
          );

        }

      }
    );

  }
);


/* =========================
   PARTIDA
========================= */

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

  resultScreen.classList.add(
    "hidden"
  );

}


function startCountdown() {

  showGame();

  hideGameScreens();


  countdownScreen.classList.remove(
    "hidden"
  );


  if (
    countdownTimer
  ) {

    clearInterval(
      countdownTimer
    );

  }


  let number =
    3;


  countdownNumber.textContent =
    number;


  countdownTimer =
    setInterval(
      () => {

        number--;


        if (
          number > 0
        ) {

          countdownNumber.textContent =
            number;

          return;

        }


        clearInterval(
          countdownTimer
        );


        countdownTimer =
          null;


        countdownNumber.textContent =
          "GO!";


        setTimeout(
          () => {

            countdownScreen.classList.add(
              "hidden"
            );

            referenceScreen.classList.remove(
              "hidden"
            );

          },
          700
        );

      },
      1000
    );

}


function startGameForEveryone() {

  if (!isHost) {
    return;
  }


  const connectedPlayers =
    players.filter(
      (player) => {

        if (
          player.id ===
          peer.id
        ) {

          return true;

        }


        const connection =
          hostConnections.get(
            player.id
          );


        return (
          connection &&
          connection.open
        );

      }
    );


  if (
    connectedPlayers.length !==
    players.length
  ) {

    setStatus(
      "Aguardando todos conectarem..."
    );

    return;

  }


  gameStarted =
    true;


  sendToAll({
    type:
      "game_start",

    players:
      players
  });


  startCountdown();

}


startButton.addEventListener(
  "click",
  () => {

    if (!isHost) {
      return;
    }


    startGameForEveryone();

  }
);


/* =========================
   SAIR
========================= */

function closeAllVoice() {

  closeAllVoiceCalls();

  stopVoiceRetry();


  if (localStream) {

    localStream
      .getTracks()
      .forEach(
        (track) => {

          try {

            track.stop();

          } catch (error) {}

        }
      );

  }


  localStream =
    null;

  microphoneEnabled =
    false;

  voiceStates.clear();


  micButton.textContent =
    "Ativar microfone";

  micButton.classList.remove(
    "active"
  );

  micButton.classList.remove(
    "disabled"
  );

  voiceStatus.textContent =
    "Microfone desligado";

}


function leaveRoom() {

  if (
    leavingRoom
  ) {

    return;

  }


  leavingRoom =
    true;


  closeAllVoice();


  stopHostHeartbeat();
  stopGuestHeartbeat();


  if (
    countdownTimer
  ) {

    clearInterval(
      countdownTimer
    );

    countdownTimer =
      null;

  }


  /* =====================
     HOST
  ===================== */

  if (isHost) {

    sendToAll({
      type:
        "host_left"
    });


    hostConnections.forEach(
      (connection) => {

        try {

          connection.close();

        } catch (error) {}

      }
    );


    hostConnections.clear();
    lastHeartbeat.clear();


    players = [];


    if (peer) {

      try {

        peer.destroy();

      } catch (error) {}

    }


    peer =
      null;

    hostConnection =
      null;

    isHost =
      false;

    roomCode =
      "";

    gameStarted =
      false;


    renderPlayers();
    showHome();


    leavingRoom =
      false;

    return;

  }


  /* =====================
     JOGADOR
  ===================== */

  if (
    hostConnection &&
    hostConnection.open
  ) {

    try {

      /*
        Aviso imediato para o host.
      */

      hostConnection.send({
        type:
          "leave"
      });

    } catch (error) {}

  }


  const oldConnection =
    hostConnection;


  hostConnection =
    null;


  /*
    Dá tempo para o host receber
    o "leave".
  */

  setTimeout(
    () => {

      if (oldConnection) {

        try {

          oldConnection.close();

        } catch (error) {}

      }

    },
    200
  );


  if (peer) {

    try {

      peer.destroy();

    } catch (error) {}

  }


  peer =
    null;


  players = [];

  voiceStates.clear();


  isHost =
    false;

  roomCode =
    "";

  gameStarted =
    false;


  renderPlayers();
  showHome();


  leavingRoom =
    false;

}


leaveRoomButton.addEventListener(
  "click",
  () => {

    leaveRoom();

  }
);


/* =========================
   TROCAR CONTA
========================= */

logoutButton.addEventListener(
  "click",
  () => {

    leaveRoom();

    deleteAccount();

    openLogin();

  }
);


/* =========================
   COPIAR CÓDIGO
========================= */

copyCodeButton.addEventListener(
  "click",
  async () => {

    if (!roomCode) {
      return;
    }


    const code =
      roomCode.toUpperCase();


    try {

      await navigator.clipboard.writeText(
        code
      );

    } catch (error) {

      const textarea =
        document.createElement(
          "textarea"
        );


      textarea.value =
        code;


      document.body.appendChild(
        textarea
      );


      textarea.select();


      document.execCommand(
        "copy"
      );


      textarea.remove();

    }


    const oldText =
      copyCodeButton.textContent;


    copyCodeButton.textContent =
      "Código copiado";


    setTimeout(
      () => {

        copyCodeButton.textContent =
          oldText;

      },
      1500
    );

  }
);
