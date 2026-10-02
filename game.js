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
  Guarda o estado REAL do microfone
  de cada jogador.

  playerId -> true / false
*/
const voiceStates = new Map();

const activeCalls = new Map();

const hostConnections = new Map();

const lastHeartbeat = new Map();

let heartbeatTimer = null;
let guestHeartbeatTimer = null;

let countdownTimer = null;

let gameStarted = false;

let leavingRoom = false;

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
      event.key ===
      "Enter"
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

  let code =
    "";

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
   ESTADO DA VOZ
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


/*
  O próprio jogador é o único
  que pode mudar seu estado.
*/
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

    /*
      Host atualiza todos,
      inclusive os outros jogadores.
    */

    sendToAll(
      message
    );

  } else {

    if (
      hostConnection &&
      hostConnection.open
    ) {

      try {

        hostConnection.send(
          message
        );

      } catch (error) {}

    }

  }


  /*
    Reconecta somente depois que
    o estado foi definido.
  */

  setTimeout(
    () => {

      reconnectVoice();

    },
    150
  );

}


/*
  Host recebeu mudança de voz
  de um jogador.
*/
function hostHandleVoiceState(
  playerId,
  enabled
) {

  if (!isHost) {
    return;
  }


  const playerExists =
    players.some(
      (player) =>
        player.id ===
        playerId
    );


  if (!playerExists) {
    return;
  }


  setVoiceState(
    playerId,
    enabled
  );


  /*
    Envia o estado para TODOS,
    inclusive quem ativou.

    Assim todos possuem a mesma
    informação.
  */

  sendToAll({
    type:
      "voice_state",
    playerId:
      playerId,
    enabled:
      !!enabled
  });


  /*
    Se desligou, derruba
    imediatamente as chamadas
    daquele jogador.
  */

  if (!enabled) {

    closeVoiceCall(
      playerId
    );

    removeRemoteAudio(
      playerId
    );

  }


  reconnectVoice();

}


/*
  Cliente recebeu o estado
  de outro jogador.
*/
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


  reconnectVoice();

}


/* =========================
   MICROFONE
========================= */

async function enableMicrophone() {

  /*
    Se já existe stream,
    somente habilita a faixa.
  */

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


  /*
    Desliga fisicamente a faixa
    de áudio.
  */

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


  /*
    Primeiro avisa todo mundo.
  */

  announceMyVoiceState(
    false
  );


  /*
    Depois fecha as chamadas
    que estavam transmitindo.
  */

  closeAllVoiceCalls();

}


micButton.addEventListener(
  "click",
  async () => {

    /*
      CADA jogador controla
      SOMENTE o próprio botão.
    */

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


  const playPromise =
    audio.play();


  if (
    playPromise &&
    playPromise.catch
  ) {

    playPromise.catch(
      () => {}
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


/* =========================
   CHAMADAS DE VOZ
========================= */

function closeVoiceCall(
  playerId
) {

  const call =
    activeCalls.get(
      playerId
    );


  if (!call) {

    removeRemoteAudio(
      playerId
    );

    return;

  }


  try {

    call.close();

  } catch (error) {}


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
  SOMENTE conecta se:

  1. meu microfone está ligado
  2. o microfone do outro jogador
     também está ligado
  3. eu sou o menor ID do par

  Assim não existe chamada
  desnecessária.
*/
function connectVoiceToPlayers() {

  if (!peer) {
    return;
  }


  if (
    !localStream ||
    !microphoneEnabled
  ) {

    return;

  }


  const myId =
    peer.id;


  players.forEach(
    (player) => {

      const playerId =
        player.id;


      if (
        playerId ===
        myId
      ) {

        return;

      }


      /*
        O outro jogador NÃO ativou.
        Então não fazemos chamada.
      */

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


      /*
        Menor ID inicia.
      */

      if (
        String(myId) <
        String(playerId)
      ) {

        callPlayer(
          playerId
        );

      }

    }
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


  /*
    Confirma novamente que
    o outro jogador também
    autorizou o próprio microfone.
  */

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


  const call =
    peer.call(
      playerId,
      localStream
    );


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

      /*
        Se enquanto a chamada
        estava conectando alguém
        desligou o próprio mic,
        não mantemos o áudio.
      */

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

    }
  );

}


/*
  Quando alguém liga para nós,
  NÃO ativamos nosso microfone.

  Porém podemos ouvir o outro
  jogador mesmo estando com nosso
  próprio microfone desligado.

  Isso é importante:
  ouvir != transmitir.
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
    Se o outro jogador não está
    marcado como transmissor,
    não aceitamos a chamada.
  */

  if (
    voiceStates.get(
      callerId
    ) !== true
  ) {

    try {

      call.close();

    } catch (error) {}

    return;

  }


  /*
    Nosso microfone NÃO precisa
    estar ligado para ouvir.

    Sem stream = somente ouvir.
  */

  if (
    localStream &&
    microphoneEnabled
  ) {

    try {

      call.answer(
        localStream
      );

    } catch (error) {

      return;

    }

  } else {

    try {

      call.answer();

    } catch (error) {

      return;

    }

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


function reconnectVoice() {

  /*
    Fecha somente chamadas que
    não deveriam mais existir.
  */

  activeCalls.forEach(
    (call, playerId) => {

      const playerExists =
        players.some(
          (player) =>
            player.id ===
            playerId
        );


      const remoteEnabled =
        voiceStates.get(
          playerId
        ) === true;


      if (
        !playerExists ||
        !remoteEnabled ||
        !microphoneEnabled
      ) {

        closeVoiceCall(
          playerId
        );

      }

    }
  );


  /*
    Pequeno atraso para deixar
    o estado da sala chegar em
    todos os clientes.
  */

  setTimeout(
    () => {

      connectVoiceToPlayers();

    },
    250
  );

}


function setupVoiceSystem() {

  if (!peer) {
    return;
  }


  /*
    IMPORTANTE:

    Receber uma chamada NUNCA
    liga o microfone automaticamente.
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
   HOST - CONEXÃO
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


        /*
          Novo jogador começa
          sempre com microfone OFF.
        */

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

        /*
          Envia também os estados
          atuais dos microfones.
        */

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


  const wasPlayer =
    players.some(
      (player) =>
        player.id ===
        playerId
    );


  if (wasPlayer) {

    removePlayer(
      playerId
    );

    broadcastPlayers();

    sendToAll({
      type:
        "players",
      players:
        players
    });

  }

}


/* =========================
   HEARTBEAT DO HOST
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


            /*
              10 segundos sem
              qualquer mensagem =
              jogador desconectado.
            */

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
   HEARTBEAT DO JOGADOR
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
   BROADCAST JOGADORES
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


    voiceStates.set(
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
               JOGADORES
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


              /*
                Remove estados de
                jogadores que não existem.
              */

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
                    !ids.has(id) &&
                    id !== peer.id
                  ) {

                    voiceStates.delete(
                      id
                    );

                  }

                }
              );


              /*
                Garante estado OFF
                para jogadores novos.
              */

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


              reconnectVoice();

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


  /*
    Mantém exatamente a lógica
    que já estava funcionando:
    só começa quando todos estão
    conectados.
  */

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
   SAIR DA SALA
========================= */

function closeAllVoice() {

  closeAllVoiceCalls();


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


  /*
    =========================
    HOST
    =========================
  */

  if (
    isHost
  ) {

    /*
      Avisa os jogadores antes
      de destruir a sala.
    */

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

    voiceStates.clear();


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


  /*
    =========================
    JOGADOR
    =========================
  */

  if (
    hostConnection &&
    hostConnection.open
  ) {

    /*
      Primeiro avisa o host.
      Não fechamos imediatamente.
    */

    try {

      hostConnection.send({
        type:
          "leave"
      });

    } catch (error) {}

  }


  const connectionToClose =
    hostConnection;


  hostConnection =
    null;


  /*
    Dá um pequeno tempo para
    o pacote "leave" chegar.
  */

  setTimeout(
    () => {

      if (
        connectionToClose
      ) {

        try {

          connectionToClose.close();

        } catch (error) {}

      }

    },
    150
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
