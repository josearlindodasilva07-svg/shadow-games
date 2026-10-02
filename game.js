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

function renderPlayers() {
  playersElement.innerHTML = "";

  players.forEach((player) => {
    const element = document.createElement("div");

    element.className = "player";

    const firstLetter = player.name
      .charAt(0)
      .toUpperCase();

    element.innerHTML = `
      <div class="avatar">${firstLetter}</div>
      <div class="player-name">${player.name}</div>
      <div class="player-status">Online</div>
    `;

    playersElement.appendChild(element);
  });
}

function setStatus(text) {
  statusElement.textContent = text;
}

function sendToAll(message) {
  if (!isHost) return;

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
}

function addPlayer(id, name) {
  const existing = players.find((player) => player.id === id);

  if (existing) {
    existing.name = name;
  } else {
    players.push({
      id: id,
      name: name
    });
  }

  renderPlayers();
}

function removePlayer(id) {
  players = players.filter((player) => player.id !== id);

  renderPlayers();
}

function setupHostConnection(connection) {
  connection.on("open", () => {
    connection.on("data", (message) => {
      if (!message || !message.type) return;

      if (message.type === "join") {
        addPlayer(connection.peer, message.name);

        connection.send({
          type: "players",
          players: players
        });

        broadcastPlayers();

        setStatus(`${players.length}/5 jogadores`);
      }

      if (message.type === "ping") {
        connection.send({
          type: "pong"
        });
      }
    });
  });

  connection.on("close", () => {
    removePlayer(connection.peer);
    broadcastPlayers();

    setStatus(`${players.length}/5 jogadores`);
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

    roomCodeElement.textContent = roomCode.toUpperCase();

    showRoom();

    startButton.style.display = "block";

    renderPlayers();

    setStatus("Sala criada. Aguardando jogadores...");
  });

  peer.on("connection", (connection) => {
    setupHostConnection(connection);
  });

  peer.on("error", (error) => {
    console.error(error);

    if (error.type === "unavailable-id") {
      alert("Esse código já está sendo usado. Crie outra sala.");

      if (peer) {
        peer.destroy();
      }

      isHost = false;
      peer = null;
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

        setStatus(`${players.length}/5 jogadores`);
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
