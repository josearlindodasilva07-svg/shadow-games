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

let countdownTimer = null;

let heartbeatTimer = null;
let heartbeatTimeoutTimer = null;

const activeCalls = new Map();

const hostConnections = new Map();

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

    myName = name;

    saveAccount(myName);

    openHome();

  }
);


usernameInput.addEventListener(
  "keydown",
  (event) => {

    if (event.key === "Enter") {

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

  for (let i = 0; i < 6; i++) {

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

  const count =
    players.length;

  setStatus(
    `${count}/5 jogadores`
  );

  gamePlayers.textContent =
    `${count}/5`;

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

  removeRemoteAudio(id);
  closeVoiceCall(id);

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
   ENVIAR PARA TODOS
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


/* =========================
   VOZ
========================= */

/*
  IMPORTANTE:

  Nunca pedimos o microfone
  automaticamente.

  Se o jogador não ativou o
  microfone, ele pode receber
  áudio, mas não transmite.
*/


async function enableMicrophone() {

  if (localStream) {

    setMicrophoneState(true);

    announceVoiceState(true);

    reconnectVoice();

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


    setMicrophoneState(true);

    announceVoiceState(true);

    reconnectVoice();

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


function setMicrophoneState(
  enabled
) {

  microphoneEnabled =
    enabled;


  if (!localStream) {

    micButton.textContent =
      enabled
        ? "Desativar microfone"
        : "Ativar microfone";

    return;

  }


  localStream
    .getAudioTracks()
    .forEach(
      (track) => {

        track.enabled =
          enabled;

      }
    );


  if (enabled) {

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

  } else {

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

  }

}


function disableMicrophone() {

  if (!localStream) {
    return;
  }


  setMicrophoneState(false);

  announceVoiceState(false);

  reconnectVoice();

}


micButton.addEventListener(
  "click",
  async () => {

    if (!localStream) {

      await enableMicrophone();

      return;

    }


    if (microphoneEnabled) {

      disableMicrophone();

    } else {

      setMicrophoneState(true);

      announceVoiceState(true);

      reconnectVoice();

    }

  }
);


/* =========================
   ESTADO DA VOZ
========================= */

function announceVoiceState(
  enabled
) {

  const message = {
    type: "voice_state",
    playerId: peer
      ? peer.id
      : "",
    enabled: enabled
  };


  if (isHost) {

    sendToAll(message);

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

}


function handleVoiceState(
  playerId,
  enabled
) {

  if (!playerId) {
    return;
  }


  /*
    Se o outro jogador desligou
    o microfone, encerramos a
    chamada dele para nós.
  */

  if (!enabled) {

    closeVoiceCall(
      playerId
    );

    removeRemoteAudio(
      playerId
    );

    return;

  }


  /*
    Se ele ligou o microfone,
    quem tiver o menor ID inicia
    a chamada.

    Isso evita duas chamadas
    simultâneas para o mesmo par.
  */

  connectVoiceToPlayers();

}


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

    remoteAudios.appendChild(
      audio
    );

  }


  audio.srcObject =
    stream;


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
    return;
  }


  try {

    call.close();

  } catch (error) {}


  activeCalls.delete(
    playerId
  );

}


function callPlayer(
  playerId
) {

  if (!peer) {
    return;
  }


  /*
    Só fazemos chamada quando
    ESTE jogador autorizou o
    próprio microfone.
  */

  if (
    !localStream ||
    !microphoneEnabled
  ) {

    return;

  }


  if (
    playerId === peer.id
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

      createRemoteAudio(
        playerId,
        stream
      );

    }
  );


  call.on(
    "close",
    () => {

      removeRemoteAudio(
        playerId
      );

      activeCalls.delete(
        playerId
      );

    }
  );


  call.on(
    "error",
    () => {

      removeRemoteAudio(
        playerId
      );

      activeCalls.delete(
        playerId
      );

    }
  );

}


function answerVoiceCall(
  call
) {

  /*
    Se este jogador não ativou
    o microfone, NÃO pedimos
    permissão.

    Respondemos sem enviar
    nosso próprio áudio.
  */

  if (
    !microphoneEnabled ||
    !localStream
  ) {

    try {

      call.answer();

    } catch (error) {}

    return;

  }


  try {

    call.answer(
      localStream
    );

  } catch (error) {

    return;

  }


  activeCalls.set(
    call.peer,
    call
  );


  call.on(
    "stream",
    (stream) => {

      createRemoteAudio(
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

      activeCalls.delete(
        call.peer
      );

    }
  );


  call.on(
    "error",
    () => {

      removeRemoteAudio(
        call.peer
      );

      activeCalls.delete(
        call.peer
      );

    }
  );

}


function reconnectVoice() {

  if (!peer) {
    return;
  }


  /*
    Fecha as chamadas atuais.
    Depois reconecta somente os
    pares que realmente precisam.
  */

  activeCalls.forEach(
    (call) => {

      try {

        call.close();

      } catch (error) {}

    }
  );


  activeCalls.clear();


  document
    .querySelectorAll(
      "#remoteAudios audio"
    )
    .forEach(
      (audio) => {

        try {

          audio.pause();

        } catch (error) {}

        audio.remove();

      }
    );


  setTimeout(
    () => {

      connectVoiceToPlayers();

    },
    300
  );

}


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


  players.forEach(
    (player) => {

      if (
        player.id ===
        peer.id
      ) {

        return;

      }


      /*
        Apenas o menor ID inicia
        a chamada.
      */

      if (
        String(peer.id) <
        String(player.id)
      ) {

        callPlayer(
          player.id
        );

      }

    }
  );

}


function setupVoiceSystem() {

  if (!peer) {
    return;
  }


  peer.on(
    "call",
    (call) => {

      /*
        NUNCA chamar
        enableMicrophone() aqui.

        O usuário precisa ter
        ativado o próprio microfone.
      */

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
              type: "room_full"
            });

          } catch (error) {}


          connection.close();

          return;

        }


        addPlayer(
          connection.peer,
          message.name
        );


        try {

          connection.send({
            type: "players",
            players: players
          });

        } catch (error) {}


        broadcastPlayers();

        return;

      }


      /* =====================
         HEARTBEAT
      ===================== */

      if (
        message.type ===
        "heartbeat"
      ) {

        try {

          connection.send({
            type: "heartbeat_ack"
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

        sendToAllExcept(
          connection.peer,
          message
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
        player.id === playerId
    );


  if (wasPlayer) {

    removePlayer(
      playerId
    );

    broadcastPlayers();

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
              Se passou muito tempo
              sem qualquer mensagem,
              consideramos desconectado.
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


        broadcastPlayers();

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


  heartbeatTimeoutTimer =
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
    heartbeatTimeoutTimer
  ) {

    clearInterval(
      heartbeatTimeoutTimer
    );

    heartbeatTimeoutTimer =
      null;

  }

}


/* =========================
   BROADCAST DE JOGADORES
========================= */

function broadcastPlayers() {

  if (!isHost) {
    return;
  }


  sendToAll({
    type: "players",
    players: players
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


    roomCode =
      generateRoomCode();


    players = [
      {
        id: roomCode,
        name: myName
      }
    ];


    setStatus(
      "Criando sala..."
    );


    peer =
      new Peer(
        roomCode
      );


    peer.on(
      "open",
      (id) => {

        roomCode =
          id;


        setupVoiceSystem();

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
   ENTRAR NA SALA
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


    setStatus(
      "Entrando na sala..."
    );


    peer =
      new Peer();


    peer.on(
      "open",
      () => {

        setupVoiceSystem();


        hostConnection =
          peer.connect(
            roomCode,
            {
              reliable: true
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


              renderPlayers();

              updateStatus();


              connectVoiceToPlayers();

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
                    "heartbeat"
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
               VOZ
            ================== */

            if (
              message.type ===
              "voice_state"
            ) {

              handleVoiceState(
                message.playerId,
                message.enabled
              );

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

              renderPlayers();


              setStatus(
                "O dono da sala saiu."
              );


              closeAllVoice();


              try {

                peer.destroy();

              } catch (error) {}


              peer =
                null;

              hostConnection =
                null;


              stopGuestHeartbeat();

              return;

            }


            /* ==================
               COMEÇAR PARTIDA
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

            players = [];

            renderPlayers();


            setStatus(
              "O dono da sala saiu."
            );


            closeAllVoice();


            hostConnection =
              null;


            stopGuestHeartbeat();


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


  if (countdownTimer) {

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


        if (number > 0) {

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
    Só começamos se as conexões
    dos jogadores estiverem abertas.
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


/* =========================
   BOTÃO COMEÇAR
========================= */

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


  if (!peer) {

    showHome();

    return;

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

    renderPlayers();


    try {

      peer.destroy();

    } catch (error) {}


    peer =
      null;

    isHost =
      false;

    roomCode =
      "";


    showHome();

    return;

  }


  if (hostConnection) {

    try {

      hostConnection.close();

    } catch (error) {}


    hostConnection =
      null;

  }


  if (peer) {

    try {

      peer.destroy();

    } catch (error) {}

    peer =
      null;

  }


  players = [];

  renderPlayers();


  isHost =
    false;

  roomCode =
    "";


  showHome();

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
