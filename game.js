(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const login = $("login");
  const home = $("home");
  const room = $("room");
  const game = $("game");

  const usernameInput = $("username");
  const loginButton = $("loginButton");

  const profileName = $("profileName");
  const profileAvatar = $("profileAvatar");

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
  const countdownHint = $("countdownHint");

  const referenceScreen = $("referenceScreen");
  const referenceButton = $("referenceButton");
  const referenceStatus = $("referenceStatus");

  const recordScreen = $("recordScreen");
  const recordTimerElement = $("recordTimer");
  const recordStatus = $("recordStatus");

  const playbackScreen = $("playbackScreen");
  const playbackTitle = $("playbackTitle");
  const playbackNumber = $("playbackNumber");
  const playbackStatus = $("playbackStatus");

  const resultScreen = $("resultScreen");
  const resultText = $("resultText");
  const nextRoundButton = $("nextRoundButton");

  const gameVoiceButton = $("gameVoiceButton");

  const MAX_PLAYERS = 5;
  const MAX_ROUNDS = 4;
  const RECORD_TIME = 7;

  let username = "";
  let peer = null;

  let isHost = false;
  let roomCode = "";
  let roomPeerId = "";

  let localStream = null;
  let microphoneEnabled = false;
  let gameVoiceEnabled = false;

  let roomConnections = new Map();
  let outgoingCalls = new Map();
  let incomingCalls = new Map();

  let players = new Map();

  let heartbeatTimer = null;
  let hostPruneTimer = null;

  let currentRound = 1;
  let gameStarted = false;

  let countdownTimer = null;
  let recordInterval = null;

  let mediaRecorder = null;
  let recordedChunks = [];

  let myRecording = null;

  let receivedRecordings = new Map();

  let currentPlaybackIndex = 0;
  let playbackQueue = [];

  let referencePlayed = false;

  let audioContext = null;
  let referenceBuffer = null;

  let audioElements = new Map();

  let reconnecting = false;

  function showOnly(section) {
    login.classList.add("hidden");
    home.classList.add("hidden");
    room.classList.add("hidden");
    game.classList.add("hidden");

    section.classList.remove("hidden");
  }

  function setStatus(text) {
    statusElement.textContent = text;
  }

  function randomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "";

    for (let i = 0; i < 6; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }

    return result;
  }

  function randomId(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 12);
  }

  function getPlayerList() {
    return Array.from(players.values());
  }

  function updatePlayersUI() {
    playersElement.innerHTML = "";

    const list = getPlayerList();

    list.forEach((player) => {
      const row = document.createElement("div");
      row.className = "player";

      const left = document.createElement("div");

      const name = document.createElement("span");
      name.className = "player-name";
      name.textContent = player.name;

      if (player.host) {
        const host = document.createElement("span");
        host.className = "player-host";
        host.textContent = "HOST";
        name.appendChild(host);
      }

      left.appendChild(name);

      const state = document.createElement("div");
      state.className = "player-state";

      if (player.id === getMyPeerId()) {
        state.textContent = "Você";
      } else {
        state.textContent = player.connected ? "Online" : "Conectando...";
      }

      row.appendChild(left);
      row.appendChild(state);

      playersElement.appendChild(row);
    });

    gamePlayers.textContent = `${list.length}/${MAX_PLAYERS}`;

    startButton.style.display = isHost ? "block" : "none";

    if (isHost && list.length < 1) {
      startButton.disabled = true;
    } else {
      startButton.disabled = false;
    }
  }

  function getMyPeerId() {
    return peer ? peer.id : "";
  }

  function addLocalPlayer() {
    players.set(getMyPeerId(), {
      id: getMyPeerId(),
      name: username,
      host: isHost,
      connected: true,
      lastSeen: Date.now()
    });

    updatePlayersUI();
  }

  function broadcast(message, exceptId = null) {
    roomConnections.forEach((connection, id) => {
      if (id === exceptId) return;

      if (connection && connection.open) {
        try {
          connection.send(message);
        } catch (_) {}
      }
    });
  }

  function sendToHost(message) {
    if (isHost) {
      handleMessage(message, getMyPeerId());
      return;
    }

    const connection = roomConnections.get(roomPeerId);

    if (!connection || !connection.open) {
      return;
    }

    try {
      connection.send(message);
    } catch (_) {}
  }

  function setupConnection(connection) {
    if (!connection) return;

    const id = connection.peer;

    roomConnections.set(id, connection);

    connection.on("open", () => {
      if (isHost) {
        const existing = players.get(id);

        if (existing) {
          existing.connected = true;
          existing.lastSeen = Date.now();
        }

        connection.send({
          type: "ROOM_STATE",
          players: getPlayerList()
        });

        connection.send({
          type: "HOST_INFO",
          hostId: getMyPeerId()
        });

        broadcast({
          type: "PLAYERS",
          players: getPlayerList()
        });

      } else {
        connection.send({
          type: "JOIN",
          id: getMyPeerId(),
          name: username
        });
      }

      updatePlayersUI();
    });

    connection.on("data", (data) => {
      handleMessage(data, id);
    });

    connection.on("close", () => {
      handleConnectionClosed(id);
    });

    connection.on("error", () => {
      handleConnectionClosed(id);
    });
  }

  function handleConnectionClosed(id) {
    roomConnections.delete(id);

    const call = outgoingCalls.get(id);

    if (call) {
      try {
        call.close();
      } catch (_) {}
      outgoingCalls.delete(id);
    }

    const incoming = incomingCalls.get(id);

    if (incoming) {
      try {
        incoming.close();
      } catch (_) {}
      incomingCalls.delete(id);
    }

    if (isHost) {
      removePlayer(id);

      broadcast({
        type: "PLAYERS",
        players: getPlayerList()
      });
    } else {
      const player = players.get(id);

      if (player) {
        player.connected = false;
        players.set(id, player);
      }

      updatePlayersUI();
    }
  }

  function removePlayer(id) {
    if (!players.has(id)) return;

    players.delete(id);

    const call = outgoingCalls.get(id);

    if (call) {
      try {
        call.close();
      } catch (_) {}

      outgoingCalls.delete(id);
    }

    const incoming = incomingCalls.get(id);

    if (incoming) {
      try {
        incoming.close();
      } catch (_) {}

      incomingCalls.delete(id);
    }

    updatePlayersUI();
  }

  function startHeartbeat() {
    stopHeartbeat();

    heartbeatTimer = setInterval(() => {
      const message = {
        type: "HEARTBEAT",
        id: getMyPeerId(),
        time: Date.now()
      };

      if (isHost) {
        const me = players.get(getMyPeerId());

        if (me) {
          me.lastSeen = Date.now();
          me.connected = true;
        }

        broadcast({
          type: "HOST_HEARTBEAT",
          time: Date.now()
        });

      } else {
        sendToHost(message);
      }
    }, 2500);

    if (isHost) {
      hostPruneTimer = setInterval(() => {
        const now = Date.now();

        players.forEach((player, id) => {
          if (id === getMyPeerId()) return;

          if (now - player.lastSeen > 8000) {
            removePlayer(id);

            const connection = roomConnections.get(id);

            if (connection) {
              try {
                connection.close();
              } catch (_) {}
            }
          }
        });

        broadcast({
          type: "PLAYERS",
          players: getPlayerList()
        });

      }, 3000);
    }
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    if (hostPruneTimer) {
      clearInterval(hostPruneTimer);
      hostPruneTimer = null;
    }
  }

  function handleMessage(message, senderId) {
    if (!message || !message.type) return;

    switch (message.type) {

      case "JOIN":
        if (!isHost) return;

        handleGuestJoin(message, senderId);
        break;

      case "HEARTBEAT":
        if (!isHost) return;

        if (players.has(senderId)) {
          const player = players.get(senderId);

          player.lastSeen = Date.now();
          player.connected = true;

          players.set(senderId, player);
        }

        break;

      case "HOST_HEARTBEAT":
        if (!isHost) {
          setStatus("Conectado");
        }
        break;

      case "ROOM_STATE":
        players.clear();

        message.players.forEach((player) => {
          players.set(player.id, {
            ...player
          });
        });

        updatePlayersUI();
        setStatus("Conectado à sala.");
        break;

      case "HOST_INFO":
        roomPeerId = message.hostId;
        break;

      case "PLAYERS":
        players.clear();

        message.players.forEach((player) => {
          players.set(player.id, {
            ...player
          });
        });

        updatePlayersUI();
        break;

      case "VOICE_STATE":
        break;

      case "GAME_START":
        if (!isHost) {
          startGuestGame(message.round || 1);
        }
        break;

      case "REFERENCE_START":
        if (!isHost) {
          beginReferenceScreen();
        }
        break;

      case "REFERENCE_PLAY":
        if (!isHost) {
          playReferenceSound();
        }
        break;

      case "RECORD_START":
        if (!isHost) {
          beginRecording();
        }
        break;

      case "RECORDING":
        if (isHost) {
          receivedRecordings.set(message.playerId, {
            playerId: message.playerId,
            name: message.name,
            blobData: message.blobData
          });

          checkAllRecordingsReceived();
        }
        break;

      case "PLAYBACK_START":
        if (!isHost) {
          startGuestPlayback(message.queue);
        }
        break;

      case "RESULT":
        if (!isHost) {
          showResult(message.text);
        }
        break;

      case "NEXT_ROUND":
        if (!isHost) {
          startGuestGame(message.round);
        }
        break;

      case "GAME_VOICE":
        break;

      case "LEAVE":
        if (isHost) {
          removePlayer(senderId);

          broadcast({
            type: "PLAYERS",
            players: getPlayerList()
          });
        }
        break;
    }
  }

  function handleGuestJoin(message, senderId) {
    if (players.size >= MAX_PLAYERS) {
      const connection = roomConnections.get(senderId);

      if (connection && connection.open) {
        connection.send({
          type: "ROOM_FULL"
        });

        setTimeout(() => {
          try {
            connection.close();
          } catch (_) {}
        }, 300);
      }

      return;
    }

    players.set(senderId, {
      id: senderId,
      name: String(message.name || "Jogador").slice(0, 16),
      host: false,
      connected: true,
      lastSeen: Date.now()
    });

    const connection = roomConnections.get(senderId);

    if (connection && connection.open) {
      connection.send({
        type: "ROOM_STATE",
        players: getPlayerList()
      });

      connection.send({
        type: "HOST_INFO",
        hostId: getMyPeerId()
      });
    }

    broadcast({
      type: "PLAYERS",
      players: getPlayerList()
    });

    updatePlayersUI();

    ensureVoiceCall(senderId);
  }

  function setupPeerEvents() {
    peer.on("open", () => {
      if (isHost) {
        roomPeerId = peer.id;

        roomCodeElement.textContent = roomCode;

        addLocalPlayer();

        setStatus("Sala criada. Aguardando jogadores.");

        startHeartbeat();

      } else {
        roomPeerId = `shadow-room-${roomCode}`;

        setStatus("Sala aberta. Conectando...");

        connectToHost();

        startHeartbeat();
      }
    });

    peer.on("connection", (connection) => {
      setupConnection(connection);
    });

    peer.on("call", (call) => {
      handleIncomingCall(call);
    });

    peer.on("disconnected", () => {
      setStatus("Reconectando...");

      if (!reconnecting) {
        reconnecting = true;

        setTimeout(() => {
          reconnecting = false;

          try {
            if (peer && !peer.destroyed) {
              peer.reconnect();
            }
          } catch (_) {}
        }, 1000);
      }
    });

    peer.on("error", (error) => {
      if (error && error.type === "peer-unavailable") {
        setStatus("Sala não encontrada.");
        return;
      }

      if (error && error.type === "unavailable-id") {
        setStatus("Essa sala já está sendo usada.");
        return;
      }

      setStatus("Conexão instável. Tentando novamente...");
    });

    peer.on("close", () => {
      stopHeartbeat();
    });
  }

  function createPeerForHost() {
    const id = `shadow-room-${roomCode}`;

    peer = new Peer(id, {
      debug: 0
    });

    isHost = true;

    setupPeerEvents();
  }

  function createPeerForGuest() {
    const id = randomId("shadow-player");

    peer = new Peer(id, {
      debug: 0
    });

    isHost = false;

    setupPeerEvents();
  }

  function connectToHost() {
    if (!peer || peer.destroyed) return;

    const connection = peer.connect(
      `shadow-room-${roomCode}`,
      {
        reliable: true,
        serialization: "json"
      }
    );

    roomConnections.set(`shadow-room-${roomCode}`, connection);

    setupConnection(connection);

    setTimeout(() => {
      if (!connection.open) {
        try {
          connection.close();
        } catch (_) {}

        setTimeout(() => {
          if (
            peer &&
            !peer.destroyed &&
            !roomConnections.has(`shadow-room-${roomCode}`)
          ) {
            connectToHost();
          }
        }, 800);
      }
    }, 5000);
  }

  /* =========================
     LOGIN
  ========================= */

  loginButton.addEventListener("click", () => {
    const name = usernameInput.value.trim();

    if (!name) {
      usernameInput.focus();
      return;
    }

    username = name.slice(0, 16);

    profileName.textContent = username;

    profileAvatar.textContent = "";

    const hue = Math.floor(Math.random() * 360);

    profileAvatar.style.background =
      `linear-gradient(135deg, hsl(${hue},70%,55%), hsl(${hue},60%,25%))`;

    showOnly(home);
  });

  usernameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      loginButton.click();
    }
  });

  logoutButton.addEventListener("click", () => {
    cleanupConnection();

    username = "";
    usernameInput.value = "";

    showOnly(login);
  });

  /* =========================
     ROOM
  ========================= */

  createButton.addEventListener("click", () => {
    createRoom();
  });

  joinButton.addEventListener("click", () => {
    const code = prompt("Digite o código da sala:");

    if (!code) return;

    const normalized = code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    if (normalized.length < 4) {
      alert("Código inválido.");
      return;
    }

    joinRoom(normalized);
  });

  function createRoom() {
    if (!username) return;

    cleanupConnection();

    roomCode = randomCode();

    roomCodeElement.textContent = roomCode;

    players.clear();
    roomConnections.clear();

    isHost = true;

    showOnly(room);

    setStatus("Criando sala...");

    startButton.style.display = "block";
    startButton.disabled = true;

    createPeerForHost();
  }

  function joinRoom(code) {
    if (!username) return;

    cleanupConnection();

    roomCode = code;

    roomCodeElement.textContent = roomCode;

    players.clear();
    roomConnections.clear();

    isHost = false;

    showOnly(room);

    setStatus("Entrando na sala...");

    startButton.style.display = "none";

    createPeerForGuest();
  }

  copyCodeButton.addEventListener("click", async () => {
    if (!roomCode) return;

    try {
      await navigator.clipboard.writeText(roomCode);
      setStatus("Código copiado.");
    } catch (_) {
      setStatus(`Código: ${roomCode}`);
    }
  });

  leaveRoomButton.addEventListener("click", () => {
    leaveRoom();
  });

  function leaveRoom() {
    if (peer && !isHost) {
      sendToHost({
        type: "LEAVE",
        id: getMyPeerId()
      });
    }

    cleanupConnection();

    showOnly(home);
  }

  function cleanupConnection() {
    stopHeartbeat();

    stopAllVoice();

    if (peer) {
      try {
        peer.destroy();
      } catch (_) {}
    }

    peer = null;

    roomConnections.clear();
    outgoingCalls.clear();
    incomingCalls.clear();

    players.clear();

    roomCode = "";
    roomPeerId = "";

    isHost = false;

    microphoneEnabled = false;
    gameVoiceEnabled = false;

    gameStarted = false;

    stopRecording();

    clearGameTimers();

    updateVoiceUI();
  }

  /* =========================
     MICROPHONE
  ========================= */

  micButton.addEventListener("click", async () => {
    if (microphoneEnabled) {
      disableMicrophone();
    } else {
      await enableMicrophone();
    }
  });

  async function enableMicrophone() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      voiceStatus.textContent = "Microfone não disponível";
      return false;
    }

    try {
      if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            latency: 0
          },
          video: false
        });
      }

      microphoneEnabled = true;

      localStream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });

      updateVoiceUI();

      if (!gameStarted || gameVoiceEnabled) {
        callAllPlayers();
      }

      return true;

    } catch (error) {
      voiceStatus.textContent = "Permissão do microfone negada";
      microphoneEnabled = false;
      updateVoiceUI();
      return false;
    }
  }

  function disableMicrophone() {
    microphoneEnabled = false;

    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }

    updateVoiceUI();

    /*
      Não fechamos as chamadas.
      Assim o jogador continua ouvindo os outros.
    */
  }

  function updateVoiceUI() {
    if (microphoneEnabled) {
      micButton.textContent = "Desligar microfone";
      micButton.classList.add("active");
      voiceStatus.textContent = "Microfone ligado";
    } else {
      micButton.textContent = "Ativar microfone";
      micButton.classList.remove("active");
      voiceStatus.textContent = "Microfone desligado";
    }

    if (gameVoiceButton) {
      if (gameVoiceEnabled) {
        gameVoiceButton.textContent = "Voz: ON";
        gameVoiceButton.classList.add("active");
      } else {
        gameVoiceButton.textContent = "Voz: OFF";
        gameVoiceButton.classList.remove("active");
      }
    }
  }

  /* =========================
     VOICE
  ========================= */

  function handleIncomingCall(call) {
    const id = call.peer;

    const canSend =
      microphoneEnabled &&
      (!gameStarted || gameVoiceEnabled);

    incomingCalls.set(id, call);

    call.on("stream", (stream) => {
      playRemoteStream(id, stream);
    });

    call.on("close", () => {
      incomingCalls.delete(id);
    });

    call.on("error", () => {
      incomingCalls.delete(id);
    });

    try {
      if (canSend && localStream) {
        call.answer(localStream);
      } else {
        call.answer();
      }
    } catch (_) {}
  }

  function ensureVoiceCall(id) {
    if (!peer) return;
    if (!id || id === getMyPeerId()) return;

    const connection = roomConnections.get(id);

    if (!connection || !connection.open) return;

    const alreadyCalling = outgoingCalls.get(id);

    if (alreadyCalling) {
      return;
    }

    const canSend =
      microphoneEnabled &&
      (!gameStarted || gameVoiceEnabled);

    if (!canSend) {
      return;
    }

    const call = peer.call(
      id,
      localStream,
      {
        metadata: {
          room: roomCode
        }
      }
    );

    if (!call) return;

    outgoingCalls.set(id, call);

    call.on("stream", (stream) => {
      playRemoteStream(id, stream);
    });

    call.on("close", () => {
      outgoingCalls.delete(id);
    });

    call.on("error", () => {
      outgoingCalls.delete(id);
    });
  }

  function callAllPlayers() {
    if (!microphoneEnabled) return;
    if (!localStream) return;

    if (gameStarted && !gameVoiceEnabled) {
      return;
    }

    players.forEach((player, id) => {
      if (id === getMyPeerId()) return;

      ensureVoiceCall(id);
    });

    roomConnections.forEach((connection, id) => {
      if (id === getMyPeerId()) return;

      ensureVoiceCall(id);
    });
  }

  function playRemoteStream(id, stream) {
    let audio = audioElements.get(id);

    if (!audio) {
      audio = document.createElement("audio");

      audio.autoplay = true;
      audio.playsInline = true;

      audio.style.display = "none";

      document.body.appendChild(audio);

      audioElements.set(id, audio);
    }

    audio.srcObject = stream;

    try {
      audio.play().catch(() => {});
    } catch (_) {}
  }

  function stopAllVoice() {
    outgoingCalls.forEach((call) => {
      try {
        call.close();
      } catch (_) {}
    });

    incomingCalls.forEach((call) => {
      try {
        call.close();
      } catch (_) {}
    });

    outgoingCalls.clear();
    incomingCalls.clear();

    audioElements.forEach((audio) => {
      try {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      } catch (_) {}
    });

    audioElements.clear();

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
    }

    localStream = null;
    microphoneEnabled = false;
  }

  /* =========================
     GAME VOICE
  ========================= */

  gameVoiceButton.addEventListener("click", async () => {
    if (!gameStarted) return;

    if (gameVoiceEnabled) {
      disableGameVoice();
      return;
    }

    if (!microphoneEnabled) {
      const enabled = await enableMicrophone();

      if (!enabled) return;
    }

    enableGameVoice();
  });

  function enableGameVoice() {
    if (!gameStarted) return;

    gameVoiceEnabled = true;

    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
    }

    updateVoiceUI();

    callAllPlayers();
  }

  function disableGameVoice() {
    gameVoiceEnabled = false;

    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }

    updateVoiceUI();

    /*
      As chamadas continuam abertas.
      O jogador continua ouvindo os outros.
    */
  }

  function muteGameVoice() {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }
  }

  function restoreGameVoice() {
    if (
      gameVoiceEnabled &&
      microphoneEnabled &&
      localStream
    ) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
    }
  }

  /* =========================
     GAME START
  ========================= */

  startButton.addEventListener("click", () => {
    if (!isHost) return;
    if (gameStarted) return;

    const list = getPlayerList();

    if (list.length < 1) return;

    startGameForEveryone();
  });

  function startGameForEveryone() {
    gameStarted = true;
    currentRound = 1;

    /*
      A voz começa DESLIGADA toda vez que uma partida começa.
    */
    gameVoiceEnabled = false;

    muteGameVoice();
    updateVoiceUI();

    showOnly(game);

    if (isHost) {
      broadcast({
        type: "GAME_START",
        round: 1
      });
    }

    runCountdown();
  }

  function startGuestGame(round) {
    gameStarted = true;
    currentRound = round || 1;

    gameVoiceEnabled = false;

    muteGameVoice();
    updateVoiceUI();

    showOnly(game);

    runCountdown();
  }

  function runCountdown() {
    clearGameTimers();

    showGameScreen(countdownScreen);

    let number = 5;

    countdownNumber.textContent = number;
    countdownHint.textContent = "A rodada vai começar";

    countdownTimer = setInterval(() => {
      number--;

      if (number <= 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;

        countdownNumber.textContent = "GO";

        setTimeout(() => {
          if (isHost) {
            beginReferencePhase();
          }
        }, 900);

        return;
      }

      countdownNumber.textContent = number;

    }, 1000);
  }

  function beginReferencePhase() {
    showGameScreen(referenceScreen);

    referencePlayed = false;

    referenceStatus.textContent =
      "A referência será reproduzida em instantes...";

    referenceButton.disabled = true;

    broadcast({
      type: "REFERENCE_START"
    });

    setTimeout(() => {
      playReferenceSound();

      broadcast({
        type: "REFERENCE_PLAY"
      });

      referenceButton.disabled = false;

      referenceStatus.textContent =
        "Ouça com atenção.";

      setTimeout(() => {
        beginRecordingPhase();
      }, 5500);

    }, 1200);
  }

  function beginReferenceScreen() {
    showGameScreen(referenceScreen);

    referenceButton.disabled = false;

    referenceStatus.textContent =
      "Aguardando o som de referência...";

    referencePlayed = false;
  }

  referenceButton.addEventListener("click", () => {
    if (referencePlayed) {
      return;
    }

    playReferenceSound();
  });

  function showGameScreen(screen) {
    countdownScreen.classList.add("hidden");
    referenceScreen.classList.add("hidden");
    recordScreen.classList.add("hidden");
    playbackScreen.classList.add("hidden");
    resultScreen.classList.add("hidden");

    screen.classList.remove("hidden");

    roundText.textContent = `Rodada ${currentRound}`;
    gamePlayers.textContent = `${players.size}/${MAX_PLAYERS}`;
  }

  /* =========================
     REFERENCE SOUND
  ========================= */

  async function playReferenceSound() {
    referencePlayed = true;

    referenceButton.disabled = true;
    referenceStatus.textContent = "Reproduzindo...";

    try {
      if (!audioContext) {
        audioContext = new (
          window.AudioContext ||
          window.webkitAudioContext
        )();
      }

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const duration = 2.4;

      const sampleRate = audioContext.sampleRate;
      const length = Math.floor(sampleRate * duration);

      const buffer = audioContext.createBuffer(
        1,
        length,
        sampleRate
      );

      const data = buffer.getChannelData(0);

      /*
        Pequena sequência melódica.
        Serve como referência local até existirem
        packs reais de sons.
      */

      const notes = [
        440,
        554.37,
        659.25,
        554.37,
        493.88
      ];

      const noteDuration = duration / notes.length;

      for (let i = 0; i < length; i++) {
        const time = i / sampleRate;
        const noteIndex = Math.min(
          notes.length - 1,
          Math.floor(time / noteDuration)
        );

        const frequency = notes[noteIndex];

        const localTime =
          time - noteIndex * noteDuration;

        const attack = Math.min(1, localTime * 30);

        const release =
          Math.max(
            0,
            Math.min(1, (noteDuration - localTime) * 15)
          );

        const envelope = attack * release;

        data[i] =
          Math.sin(
            2 * Math.PI * frequency * time
          ) *
          envelope *
          0.45;
      }

      referenceBuffer = buffer;

      const source = audioContext.createBufferSource();

      source.buffer = buffer;
      source.connect(audioContext.destination);

      source.start();

      source.onended = () => {
        referenceStatus.textContent =
          "Agora prepare seu som.";

        referenceButton.disabled = false;
      };

    } catch (_) {
      referenceStatus.textContent =
        "Não foi possível reproduzir o som.";
      referenceButton.disabled = false;
    }
  }

  /* =========================
     RECORDING
  ========================= */

  function beginRecordingPhase() {
    if (!isHost) return;

    showGameScreen(recordScreen);

    recordStatus.textContent =
      "Prepare-se...";

    recordTimerElement.textContent = RECORD_TIME;

    muteGameVoice();

    broadcast({
      type: "RECORD_START"
    });

    setTimeout(() => {
      beginRecording();
    }, 1200);
  }

  async function prepareRecordingMicrophone() {
    if (!navigator.mediaDevices) {
      return false;
    }

    if (!localStream) {
      try {
        localStream =
          await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: false,
              autoGainControl: false,
              channelCount: 1,
              latency: 0
            },
            video: false
          });
      } catch (_) {
        return false;
      }
    }

    localStream.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });

    return true;
  }

  async function beginRecording() {
    showGameScreen(recordScreen);

    muteGameVoice();

    recordStatus.textContent =
      "Preparando gravação...";

    recordTimerElement.textContent = RECORD_TIME;

    const microphoneReady =
      await prepareRecordingMicrophone();

    if (!microphoneReady) {
      recordStatus.textContent =
        "Microfone indisponível.";

      await finishRecording(null);

      return;
    }

    if (!window.MediaRecorder) {
      recordStatus.textContent =
        "Gravação não suportada.";

      await finishRecording(null);

      return;
    }

    recordedChunks = [];

    let mimeType = "";

    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus"
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        break;
      }
    }

    try {
      mediaRecorder = mimeType
        ? new MediaRecorder(localStream, {
            mimeType
          })
        : new MediaRecorder(localStream);

    } catch (_) {
      await finishRecording(null);
      return;
    }

    mediaRecorder.ondataavailable = (event) => {
      if (
        event.data &&
        event.data.size > 0
      ) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const blob =
        recordedChunks.length > 0
          ? new Blob(
              recordedChunks,
              {
                type:
                  mimeType ||
                  "audio/webm"
              }
            )
          : null;

      await finishRecording(blob);
    };

    try {
      mediaRecorder.start();
    } catch (_) {
      await finishRecording(null);
      return;
    }

    let remaining = RECORD_TIME;

    recordTimerElement.textContent = remaining;

    recordStatus.textContent =
      "GRAVANDO — faça o som agora";

    recordInterval = setInterval(() => {
      remaining--;

      recordTimerElement.textContent =
        Math.max(0, remaining);

      if (remaining <= 0) {
        clearInterval(recordInterval);
        recordInterval = null;

        stopRecording();
      }
    }, 1000);
  }

  function stopRecording() {
    if (recordInterval) {
      clearInterval(recordInterval);
      recordInterval = null;
    }

    if (
      mediaRecorder &&
      mediaRecorder.state !== "inactive"
    ) {
      try {
        mediaRecorder.stop();
      } catch (_) {}
    }
  }

  async function finishRecording(blob) {
    mediaRecorder = null;

    muteGameVoice();

    myRecording = blob;

    recordStatus.textContent =
      "Gravação enviada. Aguarde...";

    if (!blob) {
      if (isHost) {
        receivedRecordings.set(getMyPeerId(), {
          playerId: getMyPeerId(),
          name: username,
          blobData: null
        });

        checkAllRecordingsReceived();
      }

      return;
    }

    if (isHost) {
      receivedRecordings.set(getMyPeerId(), {
        playerId: getMyPeerId(),
        name: username,
        blobData: await blobToDataURL(blob)
      });

      checkAllRecordingsReceived();

    } else {
      const data =
        await blobToDataURL(blob);

      sendToHost({
        type: "RECORDING",
        playerId: getMyPeerId(),
        name: username,
        blobData: data
      });
    }
  }

  function blobToDataURL(blob) {
    return new Promise((resolve) => {
      if (!blob) {
        resolve(null);
        return;
      }

      const reader = new FileReader();

      reader.onloadend = () => {
        resolve(reader.result);
      };

      reader.onerror = () => {
        resolve(null);
      };

      reader.readAsDataURL(blob);
    });
  }

  function dataURLToBlob(dataURL) {
    if (!dataURL) return null;

    try {
      const parts = dataURL.split(",");
      const mime =
        parts[0]
          .match(/:(.*?);/)[1];

      const binary =
        atob(parts[1]);

      const bytes =
        new Uint8Array(binary.length);

      for (let i = 0; i < binary.length; i++) {
        bytes[i] =
          binary.charCodeAt(i);
      }

      return new Blob(
        [bytes],
        {
          type: mime
        }
      );

    } catch (_) {
      return null;
    }
  }

  /* =========================
     RECORDING CHECK
  ========================= */

  function checkAllRecordingsReceived() {
    if (!isHost) return;

    const expected =
      getPlayerList()
        .filter((player) => player.connected);

    const ready =
      expected.every((player) =>
        receivedRecordings.has(player.id)
      );

    if (!ready) {
      return;
    }

    setTimeout(() => {
      startPlaybackForEveryone();
    }, 900);
  }

  /* =========================
     PLAYBACK
  ========================= */

  function startPlaybackForEveryone() {
    if (!isHost) return;

    playbackQueue =
      getPlayerList()
        .filter((player) =>
          receivedRecordings.has(player.id)
        )
        .map((player) => ({
          id: player.id,
          name: player.name
        }));

    currentPlaybackIndex = 0;

    muteGameVoice();

    broadcast({
      type: "PLAYBACK_START",
      queue: playbackQueue
    });

    playNextRecording();
  }

  function startGuestPlayback(queue) {
    playbackQueue = queue || [];
    currentPlaybackIndex = 0;

    muteGameVoice();

    showGameScreen(playbackScreen);

    playNextRecording();
  }

  function playNextRecording() {
    if (
      currentPlaybackIndex >=
      playbackQueue.length
    ) {
      finishPlayback();
      return;
    }

    const item =
      playbackQueue[currentPlaybackIndex];

    showGameScreen(playbackScreen);

    playbackTitle.textContent =
      item.name;

    playbackNumber.textContent =
      `${currentPlaybackIndex + 1}/${playbackQueue.length}`;

    playbackStatus.textContent =
      "Reproduzindo...";

    const recording =
      receivedRecordings.get(item.id);

    if (!recording || !recording.blobData) {
      setTimeout(() => {
        currentPlaybackIndex++;
        playNextRecording();
      }, 1200);

      return;
    }

    const blob =
      dataURLToBlob(recording.blobData);

    if (!blob) {
      setTimeout(() => {
        currentPlaybackIndex++;
        playNextRecording();
      }, 1000);

      return;
    }

    const url =
      URL.createObjectURL(blob);

    const audio =
      new Audio(url);

    audio.volume = 1;
    audio.preload = "auto";

    let finished = false;

    const finish = () => {
      if (finished) return;

      finished = true;

      URL.revokeObjectURL(url);

      currentPlaybackIndex++;

      setTimeout(() => {
        playNextRecording();
      }, 1000);
    };

    audio.onended = finish;
    audio.onerror = finish;

    audio.play().catch(() => {
      setTimeout(finish, 1500);
    });
  }

  function finishPlayback() {
    muteGameVoice();

    if (isHost) {
      calculateRoundResult();
    }
  }

  /* =========================
     SCORE
  ========================= */

  async function calculateRoundResult() {
    const scores = [];

    for (const player of getPlayerList()) {
      const recording =
        receivedRecordings.get(player.id);

      let score = 0;

      if (
        recording &&
        recording.blobData
      ) {
        const blob =
          dataURLToBlob(
            recording.blobData
          );

        score =
          await calculateAudioScore(blob);
      }

      scores.push({
        id: player.id,
        name: player.name,
        score
      });
    }

    scores.sort(
      (a, b) => b.score - a.score
    );

    const text =
      scores
        .map(
          (item, index) =>
            `${index + 1}. ${item.name} — ${item.score} pontos`
        )
        .join("\n");

    showResult(text);

    broadcast({
      type: "RESULT",
      text
    });
  }

  async function calculateAudioScore(blob) {
    if (!blob) return 0;

    try {
      const arrayBuffer =
        await blob.arrayBuffer();

      if (!audioContext) {
        audioContext =
          new (
            window.AudioContext ||
            window.webkitAudioContext
          )();
      }

      const buffer =
        await audioContext.decodeAudioData(
          arrayBuffer.slice(0)
        );

      const channel =
        buffer.getChannelData(0);

      if (!channel || channel.length === 0) {
        return 0;
      }

      /*
        Detecta silêncio de verdade.
        Isso impede o bug em que ficar calado
        dava uma pontuação alta.
      */

      let energy = 0;

      const step =
        Math.max(
          1,
          Math.floor(channel.length / 5000)
        );

      let count = 0;

      for (
        let i = 0;
        i < channel.length;
        i += step
      ) {
        energy +=
          Math.abs(channel[i]);

        count++;
      }

      const average =
        energy / count;

      if (average < 0.008) {
        return 0;
      }

      /*
        Pontuação básica por presença de áudio.
        Não considera timbre da voz como fator principal.
      */

      const loudness =
        Math.min(
          1,
          average / 0.08
        );

      let score =
        Math.round(
          35 +
          loudness * 45
        );

      /*
        Pequena variação pela duração.
      */

      const duration =
        buffer.duration;

      if (duration >= 1.2) {
        score += 10;
      }

      return Math.max(
        0,
        Math.min(100, score)
      );

    } catch (_) {
      return 0;
    }
  }

  /* =========================
     RESULT
  ========================= */

  function showResult(text) {
    showGameScreen(resultScreen);

    resultText.textContent = text;

    nextRoundButton.style.display =
      isHost
        ? "block"
        : "none";
  }

  nextRoundButton.addEventListener("click", () => {
    if (!isHost) return;

    if (currentRound >= MAX_ROUNDS) {
      endGame();
      return;
    }

    currentRound++;

    receivedRecordings.clear();
    playbackQueue = [];
    currentPlaybackIndex = 0;
    myRecording = null;

    broadcast({
      type: "NEXT_ROUND",
      round: currentRound
    });

    runCountdown();
  });

  function endGame() {
    gameStarted = false;

    gameVoiceEnabled = false;

    muteGameVoice();

    showOnly(room);

    setStatus(
      "Partida finalizada."
    );

    updateVoiceUI();

    if (isHost) {
      broadcast({
        type: "PLAYERS",
        players: getPlayerList()
      });
    }
  }

  /* =========================
     TIMERS
  ========================= */

  function clearGameTimers() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }

    if (recordInterval) {
      clearInterval(recordInterval);
      recordInterval = null;
    }
  }

  /* =========================
     PAGE EXIT
  ========================= */

  window.addEventListener(
    "beforeunload",
    () => {
      try {
        if (!isHost) {
          sendToHost({
            type: "LEAVE",
            id: getMyPeerId()
          });
        }
      } catch (_) {}

      stopHeartbeat();
    }
  );

  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        !document.hidden &&
        peer &&
        !peer.destroyed &&
        !peer.open
      ) {
        try {
          peer.reconnect();
        } catch (_) {}
      }
    }
  );

  /* =========================
     INITIAL STATE
  ========================= */

  updateVoiceUI();

  showOnly(login);

})();
