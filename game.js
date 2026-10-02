const login = document.getElementById("login");
const home = document.getElementById("home");
const room = document.getElementById("room");

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


let peer = null;
let hostConnection = null;

let isHost = false;
let myName = "";
let roomCode = "";

let players = [];

let localStream = null;
let microphoneEnabled = false;

const activeCalls = new Map();

const ACCOUNT_KEY = "shadow_games_account";


/* =========================
   CONTA
========================= */

function cleanName(name) {
  return name.trim().slice(0, 16);
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


function openHome() {

  login.classList.add("hidden");
  room.classList.add("hidden");
  home.classList.remove("hidden");

  profileName.textContent =
    myName;

  profileAvatar.textContent =
    myName.charAt(0).toUpperCase();

}


function openLogin() {

  login.classList.remove("hidden");
  home.classList.add("hidden");
  room.classList.add("hidden");

  usernameInput.value = "";

  usernameInput.focus();

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

    saveAccount(
      myName
    );

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


/* =========================
   INICIALIZAÇÃO
========================= */

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
   CÓDIGO DA SALA
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

  setStatus(
    `${players.length}/5 jogadores`
  );

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


function showRoom() {

  home.classList.add("hidden");
  login.classList.add("hidden");

  room.classList.remove("hidden");

  roomCodeElement.textContent =
    roomCode.toUpperCase();

}


function showHome() {

  room.classList.add("hidden");
  login.classList.add("hidden");

  home.classList.remove("hidden");

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


/* =========================
   VOZ
========================= */

async function enableMicrophone() {

  if (localStream) {

    setMicrophoneState(
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

    localStream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });


    setMicrophoneState(
      true
    );


    connectVoiceToPlayers();

  } catch (error) {

    console.error(
      "Microfone:",
      error
    );

    voiceStatus.textContent =
      "Permissão negada";

    microphoneEnabled =
      false;

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

  setMicrophoneState(
    false
  );

}


micButton.addEventListener(
  "click",
  async () => {

    if (
      !localStream
    ) {

      await enableMicrophone();

      return;

    }

    setMicrophoneState(
      !microphoneEnabled
    );

  }
);


/* =========================
   ÁUDIO DOS OUTROS
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


/* =========================
   CHAMADA DE VOZ
========================= */

function callPlayer(
  playerId
) {

  if (!peer) {
    return;
  }

  if (!localStream) {
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

  if (!localStream) {
    return;
  }


  call.answer(
    localStream
  );


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


function connectVoiceToPlayers() {

  if (
    !peer ||
    !localStream
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
        Somente o jogador com o ID
        menor inicia a chamada.
        Isso evita chamadas duplicadas.
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


/* =========================
   CHAMADAS RECEBIDAS
========================= */

function setupVoiceSystem() {

  if (!peer) {
    return;
  }


  peer.on(
    "call",
    (call) => {

      if (!localStream) {

        /*
          Ainda não ativou o microfone.
          Pedimos o microfone para poder
          responder à chamada.
        */

        enableMicrophone()
          .then(
            () => {

              if (
                localStream
              ) {

                answerVoiceCall(
                  call
                );

              }

            }
          )
          .catch(
            () => {}
          );

        return;

      }


      answerVoiceCall(
        call
      );

    }
  );

}


/* =========================
   CONEXÃO DE DADOS
========================= */

function sendToAll(
  message
) {

  if (
    !isHost ||
    !peer
  ) {
    return;
  }


  peer.connections.forEach(
    (list) => {

      list.forEach(
        (connection) => {

          if (
            connection.open
          ) {

            connection.send(
              message
            );

          }

        }
      );

    }
  );

}


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


  connectVoiceToPlayers();

}


/* =========================
   CONEXÃO DO HOST
========================= */

function setupHostConnection(
  connection
) {

  connection.on(
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
        "join"
      ) {

        if (
          players.length >= 5
        ) {

          connection.send({
            type: "room_full"
          });

          connection.close();

          return;

        }


        addPlayer(
          connection.peer,
          message.name
        );


        connection.send({
          type: "players",
          players: players
        });


        broadcastPlayers();

      }

    }
  );


  connection.on(
    "close",
    () => {

      removePlayer(
        connection.peer
      );

      broadcastPlayers();

    }
  );


  connection.on(
    "error",
    () => {

      removePlayer(
        connection.peer
      );

      broadcastPlayers();

    }
  );

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


    isHost = true;


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


    setupVoiceSystem();


    peer.on(
      "open",
      (id) => {

        roomCode =
          id;

        showRoom();


        startButton.style.display =
          "block";


        renderPlayers();
        updateStatus();


        /*
          A voz só começa quando
          o jogador apertar o botão
          do microfone.
        */

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
          "Conexão perdida."
        );

      }
    );


    peer.on(
      "close",
      () => {

        setStatus(
          "Sala encerrada."
        );

      }
    );


    peer.on(
      "error",
      (error) => {

        console.error(
          error
        );


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


          peer = null;

          isHost = false;

          roomCode = "";

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


    isHost = false;


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
              reliable: true
            }
          );


        hostConnection.on(
          "open",
          () => {

            hostConnection.send({
              type: "join",
              name: myName
            });


            showRoom();


            startButton.style.display =
              "none";


            setStatus(
              "Conectado."
            );

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
                message.players ||
                [];


              renderPlayers();
              updateStatus();


              connectVoiceToPlayers();

            }


            if (
              message.type ===
              "room_full"
            ) {

              alert(
                "A sala está cheia."
              );


              try {

                peer.destroy();

              } catch (e) {}


              location.reload();

            }


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

              } catch (e) {}


              peer = null;

              hostConnection =
                null;

            }


            if (
              message.type ===
              "start_game"
            ) {

              setStatus(
                "Partida iniciada!"
              );

              alert(
                "A partida começou!"
              );

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


            if (peer) {

              try {

                peer.destroy();

              } catch (e) {}

            }


            peer = null;

          }
        );


        hostConnection.on(
          "error",
          () => {

            players = [];

            renderPlayers();


            setStatus(
              "Conexão perdida."
            );


            hostConnection =
              null;

          }
        );

      }
    );


    peer.on(
      "disconnected",
      () => {

        players = [];

        renderPlayers();


        setStatus(
          "Conexão perdida."
        );

      }
    );


    peer.on(
      "close",
      () => {

        players = [];

        renderPlayers();


        setStatus(
          "Sala encerrada."
        );

      }
    );


    peer.on(
      "error",
      (error) => {

        console.error(
          error
        );


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


        players = [];

        renderPlayers();


        setStatus(
          "Não foi possível entrar."
        );

      }
    );

  }
);


/* =========================
   SAIR DA SALA
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


  if (!peer) {

    showHome();

    return;

  }


  if (isHost) {

    sendToAll({
      type: "host_left"
    });


    players = [];

    renderPlayers();


    try {

      peer.destroy();

    } catch (error) {}


    peer = null;

    isHost = false;

    roomCode = "";


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

    peer = null;

  }


  players = [];

  renderPlayers();


  isHost = false;

  roomCode = "";


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

    closeAllVoice();


    if (peer) {

      try {

        peer.destroy();

      } catch (error) {}

    }


    peer = null;

    hostConnection =
      null;

    isHost = false;

    roomCode = "";

    players = [];


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


    try {

      await navigator.clipboard.writeText(
        roomCode.toUpperCase()
      );


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

    } catch (error) {

      const textArea =
        document.createElement(
          "textarea"
        );


      textArea.value =
        roomCode.toUpperCase();


      document.body.appendChild(
        textArea
      );


      textArea.select();


      document.execCommand(
        "copy"
      );


      textArea.remove();


      copyCodeButton.textContent =
        "Código copiado";


      setTimeout(
        () => {

          copyCodeButton.textContent =
            "Copiar código";

        },
        1500
      );

    }

  }
);


/* =========================
   COMEÇAR
========================= */

startButton.addEventListener(
  "click",
  () => {

    if (!isHost) {
      return;
    }


    sendToAll({
      type: "start_game"
    });


    setStatus(
      "Partida iniciada!"
    );


    alert(
      "A partida começou!"
    );

  }
);
