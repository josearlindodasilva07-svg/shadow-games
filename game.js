const home = document.getElementById("home");
const room = document.getElementById("room");

const nameInput = document.getElementById("name");
const createButton = document.getElementById("create");
const joinButton = document.getElementById("join");
const startButton = document.getElementById("start");

const roomCodeElement = document.getElementById("roomCode");
const statusElement = document.getElementById("status");
const playersElement = document.getElementById("players");

let peer = null;
let hostConnection = null;

let isHost = false;
let myName = "";
let roomCode = "";

let players = [];

function cleanName(name) {
  return name.trim().slice(0, 16);
}

function generateRoomCode() {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let code = "";

  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

function showRoom() {
  home.classList.add("hidden");
  room.classList.remove("hidden");

  roomCodeElement.textContent = roomCode.toUpperCase();
}

function setStatus(text) {
  statusElement.textContent = text;
}

function updateStatus() {
  setStatus(`${players.length}/5 jogadores`);
}

function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderPlayers() {
  playersElement.innerHTML = "";

  players.forEach((player) => {
    const element = document.createElement("div");

    element.className = "player";

    const firstLetter =
      player.name.charAt(0).toUpperCase();

    element.innerHTML = `
      <div class="avatar">${escapeHTML(firstLetter)}</div>
      <div class="player-name">${escapeHTML(player.name)}</div>
      <div class="player-status">Online</div>
    `;

    playersElement.appendChild(element);
  });
}

function addPlayer(id, name) {
  const existing = players.find(
    (player) => player.id === id
  );

  if (existing) {
    existing.name = name;
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
  players = players.filter(
    (player) => player.id !== id
  );

  renderPlayers();
  updateStatus();
}

function sendToAll(message) {
  if (!isHost || !peer) return;

  peer.connections.forEach((connectionList) => {
    connectionList.forEach((connection) => {
      if (connection.open) {
        connection.send(message);
      }
    });
  });
}

function broadcastPlayers() {
  if (!isHost) return;

  sendToAll({
    type: "players",
    players: players
  });

  renderPlayers();
  updateStatus();
}

function setupHostConnection(connection) {
  connection.on("open", () => {
    console.log("Jogador conectado:", connection.peer);
  });

  connection.on("data", (message) => {
    if (!message || !message.type) return;

    if (message.type === "join") {
      if (players.length >= 5) {
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
  });

  connection.on("close", () => {
    removePlayer(connection.peer);

    broadcastPlayers();
  });

  connection.on("error", () => {
    removePlayer(connection.peer);

    broadcastPlayers();
  });
}

createButton.addEventListener("click", () => {
  myName = cleanName(nameInput.value);

  if (!myName) {
    alert("Digite seu nome.");
    return;
  }

  isHost = true;
  roomCode = generateRoomCode();

  players = [
    {
      id: roomCode,
      name: myName
    }
  ];

  setStatus("Criando sala...");

  peer = new Peer(roomCode);

  peer.on("open", (id) => {
    roomCode = id;

    showRoom();

    startButton.style.display = "block";

    renderPlayers();

    updateStatus();
  });

  peer.on("connection", (connection) => {
    setupHostConnection(connection);
  });

  peer.on("error", (error) => {
    console.error(error);

    if (error.type === "unavailable-id") {
      alert("Esse código já está sendo usado. Crie outra sala.");

      peer.destroy();

      peer = null;
      isHost = false;
      roomCode = "";

      setStatus("Erro ao criar sala.");

      return;
    }

    alert("Erro na conexão: " + error.type);
  });
});

joinButton.addEventListener("click", () => {
  myName = cleanName(nameInput.value);

  if (!myName) {
    alert("Digite seu nome.");
    return;
  }

  const code = prompt("Digite o código da sala:");

  if (!code) return;

  roomCode = code.trim().toLowerCase();

  if (roomCode.length !== 6) {
    alert("O código precisa ter 6 caracteres.");
    return;
  }

  isHost = false;

  setStatus("Entrando na sala...");

  peer = new Peer();

  peer.on("open", () => {
    hostConnection = peer.connect(roomCode, {
      reliable: true
    });

    hostConnection.on("open", () => {
      hostConnection.send({
        type: "join",
        name: myName
      });

      showRoom();

      startButton.style.display = "none";

      setStatus("Conectado. Aguardando...");
    });

    hostConnection.on("data", (message) => {
      if (!message || !message.type) return;

      if (message.type === "players") {
        players = message.players || [];

        renderPlayers();
        updateStatus();
      }

      if (message.type === "room_full") {
        alert("A sala está cheia.");

        peer.destroy();

        location.reload();
      }

      if (message.type === "start_game") {
        setStatus("Partida iniciada!");

        alert("A partida começou!");
      }
    });

    hostConnection.on("close", () => {
      setStatus("O dono da sala saiu.");

      alert("O dono da sala saiu.");
    });

    hostConnection.on("error", () => {
      setStatus("Erro na conexão.");
    });
  });

  peer.on("error", (error) => {
    console.error(error);

    if (error.type === "peer-unavailable") {
      alert("Sala não encontrada.");
    } else {
      alert("Erro na conexão: " + error.type);
    }

    setStatus("Não foi possível entrar.");
  });
});

startButton.addEventListener("click", () => {
  if (!isHost) return;

  if (players.length < 1) return;

  sendToAll({
    type: "start_game"
  });

  setStatus("Partida iniciada!");

  alert("A partida começou!");
});
