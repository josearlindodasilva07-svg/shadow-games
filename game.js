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

/*
  Controle separado da voz durante
  a partida.

  Isso controla SOMENTE se meu
  microfone transmite.

  Não interfere no áudio recebido.
*/
let gameVoiceEnabled = true;

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
  Chamadas que eu iniciei.
*/
const outgoingCalls = new Map();


/*
  Chamadas que eu recebi.
*/
const incomingCalls = new Map();


/*
  Conexões de dados com o host.
*/
const hostConnections = new Map();


/*
  Último heartbeat.
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


function createGameVoiceButton() {

  let button =
    document.getElementById(
      "gameVoiceButton"
    );

  if (button) {
    return button;
  }

  button =
    document.createElement(
      "button"
    );

  button.id =
    "gameVoiceButton";

  button.type =
    "button";

  button.textContent =
    "Voz: ON";

  button.style.width =
    "100%";

  button.style.minHeight =
    "50px";

  button.style.marginTop =
    "12px";

  button.style.border =
    "1px solid #292c36";

  button.style.borderRadius =
    "15px";

  button.style.background =
    "#181a21";

  button.style.color =
    "#ffffff";

  button.style.fontSize =
    "14px";

  button.style.fontWeight =
    "800";

  const header =
    game.querySelector(
      ".game-header"
    );

  if (header) {
    header.appendChild(
      button
    );
  } else {
    game.insertBefore(
      button,
      game.firstChild
    );
  }

  button.addEventListener(
    "click",
    () => {

      gameVoiceEnabled =
        !gameVoiceEnabled;

      updateGameVoiceButton();

      /*
        Só muda a transmissão.
        O áudio recebido continua
        funcionando normalmente.
      */

      if (gameVoiceEnabled) {

        if (
          localStream &&
          microphoneEnabled
        ) {
          enableLocalAudioTransmission();
        }

      } else {

        disableLocalAudioTransmission();

      }

    }
  );

  return button;
}


function updateGameVoiceButton() {

  const button =
    document.getElementById(
      "gameVoiceButton"
    );

  if (!button) {
    return;
  }

  if (gameVoiceEnabled) {

    button.textContent =
      "Voz: ON";

    button.style.background =
      "#6d70ff";

    button.style.borderColor =
      "#6d70ff";

  } else {

    button.textContent =
      "Voz: OFF";

    button.style.background =
      "#181a21";

    button.style.borderColor =
      "#292c36";

  }
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

  createGameVoiceButton();

  updateGameVoiceButton();
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

  closePlayerVoice(
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


function closePlayerVoice(
  playerId
) {

  const outgoing =
    outgoingCalls.get(
      playerId
    );

  const incoming =
    incomingCalls.get(
      playerId
    );

  if (outgoing) {

    try {
      outgoing.close();
    } catch (error) {}

  }

  if (incoming) {

    try {
      incoming.close();
    } catch (error) {}

  }

  outgoingCalls.delete(
    playerId
  );

  incomingCalls.delete(
    playerId
  );

  removeRemoteAudio(
    playerId
  );
}


function closeAllVoiceCalls() {

  outgoingCalls.forEach(
    (call) => {

      try {
        call.close();
      } catch (error) {}

    }
  );

  incomingCalls.forEach(
    (call) => {

      try {
        call.close();
      } catch (error) {}

    }
  );

  outgoingCalls.clear();
  incomingCalls.clear();

  remoteAudios.innerHTML =
    "";
}


/*
  Liga a faixa de áudio local.

  O áudio recebido dos outros
  não é afetado.
*/
function enableLocalAudioTransmission() {

  if (!localStream) {
    return;
  }

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

  announceMyVoiceState(
    true
  );
}


/*
  Desliga somente a transmissão.

  Continua recebendo áudio.
*/
function disableLocalAudioTransmission() {

  if (!localStream) {
    return;
  }

  localStream
    .getAudioTracks()
    .forEach(
      (track) => {

        track.enabled =
          false;

      }
    );

  /*
    NÃO fecha incomingCalls.
    Portanto o jogador continua
    ouvindo os outros.
  */

  announceMyVoiceState(
    false
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

  /*
    Quando meu estado muda,
    precisamos reconstruir somente
    as chamadas de saída.

    As chamadas de entrada não são
    fechadas, porque ainda preciso
    ouvir os outros.
  */

  players.forEach(
    (player) => {

      if (
        player.id !== myId
      ) {

        const outgoing =
          outgoingCalls.get(
            player.id
          );

        if (outgoing) {

          try {
            outgoing.close();
          } catch (error) {}

          outgoingCalls.delete(
            player.id
          );

        }

      }

    }
  );

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
        player.id === playerId
    );

  if (!exists) {
    return;
  }

  setVoiceState(
    playerId,
    enabled
  );

  /*
    Não fecha a chamada de entrada.
    O jogador pode continuar ouvindo.

    Apenas a transmissão daquele
    jogador será atualizada pelo
    WebRTC.
  */

  sendToAll({

    type:
      "voice_state",

    playerId:
      playerId,

    enabled:
      !!enabled

  });

  startVoiceRetry();
}


function receiveVoiceState(
  playerId,
  enabled
) {

  if (!playerId) {
    return;
  }

  const oldState =
    voiceStates.get(
      playerId
    ) === true;

  const newState =
    !!enabled;

  setVoiceState(
    playerId,
    newState
  );

  if (
    oldState !== newState
  ) {

    const outgoing =
      outgoingCalls.get(
        playerId
      );

    if (outgoing) {

      try {
        outgoing.close();
      } catch (error) {}

      outgoingCalls.delete(
        playerId
      );

    }

    /*
      NÃO fecha incomingCalls.

      Mesmo que o outro desligue
      o próprio microfone, continuo
      podendo receber áudio quando
      ele voltar.
    */

  }

  startVoiceRetry();
}


/* =========================
   MICROFONE
========================= */

async function enableMicrophone() {

  if (localStream) {

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


    /*
      Configuração priorizando
      baixa latência.

      Mantemos somente echo
      cancellation para evitar
      retorno do áudio.
    */

    const stream =
      await navigator.mediaDevices
        .getUserMedia({

          audio: {

            echoCancellation:
              true,

            noiseSuppression:
              false,

            autoGainControl:
              false,

            latency:
              0,

            channelCount:
              1

          },

          video:
            false

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

    audio.muted =
      false;

    audio.volume =
      1;

    remoteAudios.appendChild(
      audio
    );

  }


  audio.autoplay =
    true;

  audio.playsInline =
    true;

  audio.muted =
    false;

  audio.volume =
    1;

  audio.srcObject =
    stream;


  /*
    Reprodução imediata.
  */

  const playAudio =
    () => {

      try {

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

      } catch (error) {}

    };


  audio.onloadedmetadata =
    playAudio;

  playAudio();
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


function unlockRemoteAudio() {

  remoteAudios
    .querySelectorAll(
      "audio"
    )
    .forEach(
      (audio) => {

        audio.muted =
          false;

        audio.volume =
          1;

        try {

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

        } catch (error) {}

      }
    );
}


document.addEventListener(
  "click",
  unlockRemoteAudio
);

document.addEventListener(
  "touchstart",
  unlockRemoteAudio,
  {
    passive: true
  }
);


/* =========================
   CHAMADAS DE SAÍDA
========================= */

function startOutgoingCall(
  playerId
) {

  if (!peer) {
    return;
  }


  /*
    Se minha voz está OFF,
    não crio transmissão.
  */

  if (
    !localStream ||
    !microphoneEnabled ||
    !gameVoiceEnabled
  ) {

    return;
  }


  if (
    playerId === peer.id
  ) {

    return;
  }


  if (
    outgoingCalls.has(
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
              true,

            sender:
              peer.id

          }

        }

      );

  } catch (error) {

    return;

  }


  if (!call) {
    return;
  }


  outgoingCalls.set(
    playerId,
    call
  );


  /*
    Se o outro jogador também
    estiver transmitindo, o stream
    dele chega aqui.
  */

  call.on(
    "stream",
    (stream) => {

      createRemoteAudio(
        playerId,
        stream
      );

    }
  );


  call.on(
    "close",
    () => {

      outgoingCalls.delete(
        playerId
      );

      /*
        Só reconecta se ainda
        estiver transmitindo.
      */

      if (
        microphoneEnabled &&
        gameVoiceEnabled
      ) {

        startVoiceRetry();

      }

    }
  );


  call.on(
    "error",
    () => {

      outgoingCalls.delete(
        playerId
      );

      /*
        Não removemos o áudio de
        entrada do jogador aqui.
      */

      if (
        microphoneEnabled &&
        gameVoiceEnabled
      ) {

        startVoiceRetry();

      }

    }
  );
}


/* =========================
   CHAMADAS DE ENTRADA
========================= */

function answerVoiceCall(
  call
) {

  if (!call) {
    return;
  }


  const playerId =
    call.peer;


  const oldCall =
    incomingCalls.get(
      playerId
    );


  if (oldCall) {

    try {
      oldCall.close();
    } catch (error) {}

    incomingCalls.delete(
      playerId
    );

  }


  try {

    /*
      Se meu microfone está ligado
      E a voz da partida está ON,
      envio meu áudio também.

      Caso contrário:

      call.answer()

      = continuo recebendo o áudio
        sem enviar meu microfone.
    */

    if (
      localStream &&
      microphoneEnabled &&
      gameVoiceEnabled
    ) {

      call.answer(
        localStream
      );

    } else {

      call.answer();

    }

  } catch (error) {

    try {
      call.close();
    } catch (e) {}

    return;
  }


  incomingCalls.set(
    playerId,
    call
  );


  call.on(
    "stream",
    (stream) => {

      createRemoteAudio(
        playerId,
        stream
      );

    }
  );


  call.on(
    "close",
    () => {

      incomingCalls.delete(
        playerId
      );

      removeRemoteAudio(
        playerId
      );

    }
  );


  call.on(
    "error",
    () => {

      incomingCalls.delete(
        playerId
      );

      removeRemoteAudio(
        playerId
      );

    }
  );
}


/* =========================
   SISTEMA DE VOZ
========================= */

function setupVoiceSystem() {

  if (!peer) {
    return;
  }


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
   RECONEXÃO DA VOZ
========================= */

function tryConnectVoice() {

  if (!peer) {
    return;
  }


  /*
    Só preciso transmitir se:
    - meu microfone está ligado
    - o botão da partida está ON
  */

  if (
    !microphoneEnabled ||
    !localStream ||
    !gameVoiceEnabled
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


      /*
        Não verificamos o estado
        do microfone do outro.

        Eu consigo falar com ele
        mesmo que ele esteja com
        o próprio microfone desligado.
      */

      if (
        !outgoingCalls.has(
          playerId
        )
      ) {

        startOutgoingCall(
          playerId
        );

      }

    }
  );
}


function startVoiceRetry() {

  if (!peer) {
    return;
  }


  voiceRetryUntil =
    Date.now() + 5000;


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
      500
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


      if (
        message.type ===
        "leave"
      ) {

        removeHostConnection(
          connection.peer
        );

        return;
      }


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


      if (
        message.type ===
        "voice_state"
      ) {

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
   HEARTBEAT HOST
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


/* =========================
   HEARTBEAT GUEST
========================= */

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
   BROADCAST
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

    gameVoiceEnabled =
      true;


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

    gameVoiceEnabled =
      true;


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


            if (
              message.type ===
              "game_start"
            ) {

              gameStarted =
                true;


              players =
                message.players ||
                players;


              gameVoiceEnabled =
                true;


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


  gameVoiceEnabled =
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


  gameVoiceEnabled =
    true;


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


  updateGameVoiceButton();
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

    openHome();


    leavingRoom =
      false;


    return;

  }


  if (
    hostConnection &&
    hostConnection.open
  ) {

    try {

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

  openHome();


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
