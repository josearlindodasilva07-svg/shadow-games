const $ = (id) => document.getElementById(id);

/* =========================
   CONTA
========================= */

let username = localStorage.getItem("shadow_username") || "";

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

const startButton = $("start");
const leaveRoomButton = $("leaveRoom");

const micButton = $("micButton");
const voiceStatus = $("voiceStatus");
const remoteAudios = $("remoteAudios");

const countdownScreen = $("countdownScreen");
const countdownNumber = $("countdownNumber");

const referenceScreen = $("referenceScreen");
const referenceButton = $("referenceButton");

const recordScreen = $("recordScreen");
const recordTimer = $("recordTimer");
const recordStatus = $("recordStatus");

const resultScreen = $("resultScreen");
const resultText = $("resultText");

const roundText = $("roundText");
const gamePlayers = $("gamePlayers");

let peer = null;
let hostConnection = null;

let roomCode = "";
let isHost = false;

let players = [];
let hostConnections = new Map();

let localStream = null;
let microphoneEnabled = false;

let gameVoiceEnabled = false;
let performanceVoiceMuted = false;

let voiceRetryTimer = null;

let gameVoiceButton = null;


/* =========================
   PARTIDA
========================= */

const TOTAL_ROUNDS = 4;
const RECORD_TIME = 5;

let gameStarted = false;
let currentRound = 0;

let currentReference = null;
let currentReferenceBuffer = null;

let referencePlayed = false;

let recording = false;
let recordedThisRound = false;

let mediaRecorder = null;
let recordChunks = [];

let recordingMicWasEnabled = false;

let expectedRoundPlayers = [];
let referenceReadyPlayers = new Set();

let roundRecordings = new Map();

let referenceReadyTimer = null;
let recordingWaitTimer = null;

let playbackStarted = false;
let playbackIndex = 0;

let playerScores = {};
let playerMultipliers = {};

let pendingSabotages = {};

let audioContext = null;


/* =========================
   SONS DE REFERÊNCIA
========================= */

const SOUND_PACK = [

    {
        category: "ANIMAIS",
        name: "Cachorro",
        description: "Imite o som.",
        events: [
            { type: "tone", start: 0.00, duration: 0.28, f1: 420, f2: 230, wave: "sawtooth", gain: 0.65 },
            { type: "tone", start: 0.42, duration: 0.28, f1: 470, f2: 240, wave: "sawtooth", gain: 0.65 },
            { type: "tone", start: 0.84, duration: 0.34, f1: 520, f2: 210, wave: "sawtooth", gain: 0.65 }
        ]
    },

    {
        category: "ANIMAIS",
        name: "Gato",
        description: "Imite o som.",
        events: [
            { type: "tone", start: 0.00, duration: 0.75, f1: 650, f2: 900, wave: "triangle", gain: 0.55 },
            { type: "tone", start: 0.95, duration: 0.55, f1: 900, f2: 620, wave: "triangle", gain: 0.55 }
        ]
    },

    {
        category: "ANIMAIS",
        name: "Sapo",
        description: "Imite o som.",
        events: [
            { type: "tone", start: 0.00, duration: 0.22, f1: 220, f2: 120, wave: "square", gain: 0.55 },
            { type: "tone", start: 0.35, duration: 0.22, f1: 260, f2: 140, wave: "square", gain: 0.55 },
            { type: "tone", start: 0.70, duration: 0.22, f1: 220, f2: 120, wave: "square", gain: 0.55 }
        ]
    },

    {
        category: "MÁQUINAS",
        name: "Alarme",
        description: "Imite o som.",
        events: [
            { type: "tone", start: 0.00, duration: 0.35, f1: 800, f2: 1100, wave: "square", gain: 0.45 },
            { type: "tone", start: 0.45, duration: 0.35, f1: 1100, f2: 800, wave: "square", gain: 0.45 },
            { type: "tone", start: 0.90, duration: 0.35, f1: 800, f2: 1100, wave: "square", gain: 0.45 }
        ]
    },

    {
        category: "MÁQUINAS",
        name: "Sirene",
        description: "Imite o som.",
        events: [
            { type: "tone", start: 0.00, duration: 1.80, f1: 350, f2: 1000, wave: "sine", gain: 0.55 }
        ]
    },

    {
        category: "MÁQUINAS",
        name: "Scanner",
        description: "Imite o som.",
        events: [
            { type: "tone", start: 0.00, duration: 0.16, f1: 500, f2: 500, wave: "square", gain: 0.45 },
            { type: "tone", start: 0.28, duration: 0.16, f1: 700, f2: 700, wave: "square", gain: 0.45 },
            { type: "tone", start: 0.56, duration: 0.16, f1: 900, f2: 900, wave: "square", gain: 0.45 },
            { type: "tone", start: 0.84, duration: 0.30, f1: 1100, f2: 500, wave: "square", gain: 0.45 }
        ]
    },

    {
        category: "VOZES",
        name: "Risada",
        description: "Imite o som.",
        events: [
            { type: "tone", start: 0.00, duration: 0.18, f1: 500, f2: 650, wave: "triangle", gain: 0.45 },
            { type: "tone", start: 0.25, duration: 0.18, f1: 580, f2: 700, wave: "triangle", gain: 0.45 },
            { type: "tone", start: 0.50, duration: 0.18, f1: 650, f2: 760, wave: "triangle", gain: 0.45 },
            { type: "tone", start: 0.75, duration: 0.25, f1: 700, f2: 500, wave: "triangle", gain: 0.45 }
        ]
    },

    {
        category: "VOZES",
        name: "Ei",
        description: "Imite o som.",
        events: [
            { type: "tone", start: 0.00, duration: 0.35, f1: 350, f2: 700, wave: "triangle", gain: 0.55 },
            { type: "tone", start: 0.50, duration: 0.45, f1: 650, f2: 450, wave: "triangle", gain: 0.55 }
        ]
    },

    {
        category: "VOZES",
        name: "Aaaah",
        description: "Imite o som.",
        events: [
            { type: "tone", start: 0.00, duration: 1.40, f1: 280, f2: 650, wave: "sine", gain: 0.50 }
        ]
    },

    {
        category: "OUTROS",
        name: "Laser",
        description: "Imite o som.",
        events: [
            { type: "tone", start: 0.00, duration: 0.75, f1: 1200, f2: 180, wave: "sawtooth", gain: 0.45 }
        ]
    },

    {
        category: "OUTROS",
        name: "Bip",
        description: "Imite o som.",
        events: [
            { type: "tone", start: 0.00, duration: 0.20, f1: 800, f2: 800, wave: "sine", gain: 0.50 },
            { type: "tone", start: 0.35, duration: 0.20, f1: 1000, f2: 1000, wave: "sine", gain: 0.50 },
            { type: "tone", start: 0.70, duration: 0.20, f1: 1200, f2: 1200, wave: "sine", gain: 0.50 }
        ]
    },

    {
        category: "OUTROS",
        name: "Batida",
        description: "Imite o som.",
        events: [
            { type: "tone", start: 0.00, duration: 0.16, f1: 130, f2: 80, wave: "sine", gain: 0.70 },
            { type: "tone", start: 0.35, duration: 0.16, f1: 130, f2: 80, wave: "sine", gain: 0.70 },
            { type: "tone", start: 0.70, duration: 0.30, f1: 170, f2: 70, wave: "sine", gain: 0.70 }
        ]
    }

];


/* =========================
   UTILIDADES
========================= */

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function hashString(text) {

    let hash = 0;

    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }

    return Math.abs(hash);
}

function getPlayerName(id) {

    const player = players.find(p => p.id === id);

    if (player) {
        return player.name;
    }

    if (id === getOwnPeerId()) {
        return username;
    }

    return "Jogador";
}

function getOwnPeerId() {

    return peer ? peer.id : "";
}

function getSupportedMimeType() {

    const types = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4"
    ];

    for (const type of types) {

        if (
            typeof MediaRecorder !== "undefined" &&
            MediaRecorder.isTypeSupported &&
            MediaRecorder.isTypeSupported(type)
        ) {
            return type;
        }
    }

    return "";
}


/* =========================
   AUDIO
========================= */

function getAudioContext() {

    if (!audioContext) {

        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContext) {
            throw new Error("Web Audio não suportado");
        }

        audioContext = new AudioContext();
    }

    return audioContext;
}

async function resumeAudioContext() {

    const ctx = getAudioContext();

    if (ctx.state === "suspended") {
        await ctx.resume();
    }

    return ctx;
}

function getReferenceDuration(reference) {

    let end = 0;

    for (const event of reference.events) {
        end = Math.max(
            end,
            event.start + event.duration
        );
    }

    return end + 0.15;
}

function createOfflineReference(reference) {

    const duration = getReferenceDuration(reference);

    const sampleRate = 44100;

    const OfflineContext =
        window.OfflineAudioContext ||
        window.webkitOfflineAudioContext;

    if (!OfflineContext) {
        return Promise.reject(
            new Error("OfflineAudioContext não suportado")
        );
    }

    const ctx = new OfflineContext(
        1,
        Math.ceil(duration * sampleRate),
        sampleRate
    );

    for (const event of reference.events) {

        if (event.type === "tone") {

            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();

            oscillator.type = event.wave || "sine";

            oscillator.frequency.setValueAtTime(
                event.f1,
                event.start
            );

            oscillator.frequency.linearRampToValueAtTime(
                event.f2,
                event.start + event.duration
            );

            gain.gain.setValueAtTime(
                0.0001,
                event.start
            );

            gain.gain.linearRampToValueAtTime(
                event.gain || 0.5,
                event.start + 0.015
            );

            gain.gain.exponentialRampToValueAtTime(
                0.0001,
                event.start + event.duration
            );

            oscillator.connect(gain);
            gain.connect(ctx.destination);

            oscillator.start(event.start);
            oscillator.stop(
                event.start + event.duration + 0.03
            );
        }
    }

    return ctx.startRendering();
}

async function playAudioBuffer(buffer) {

    const ctx = await resumeAudioContext();

    return new Promise(resolve => {

        const source = ctx.createBufferSource();

        source.buffer = buffer;

        source.connect(ctx.destination);

        source.onended = () => {
            resolve();
        };

        source.start(0);
    });
}

async function playReferenceOnce() {

    if (referencePlayed) {
        return true;
    }

    try {

        await resumeAudioContext();

        if (!currentReferenceBuffer) {

            currentReferenceBuffer =
                await createOfflineReference(
                    currentReference
                );
        }

        referencePlayed = true;

        referenceButton.disabled = true;
        referenceButton.textContent = "Som reproduzido";

        await playAudioBuffer(
            currentReferenceBuffer
        );

        sendToHost({
            type: "reference_ready",
            round: currentRound
        });

        if (isHost) {
            handleReferenceReady(
                getOwnPeerId()
            );
        }

        return true;

    } catch (error) {

        referencePlayed = false;

        referenceButton.disabled = false;
        referenceButton.textContent = "Ouvir som";

        return false;
    }
}


/* =========================
   BASE64
========================= */

function arrayBufferToBase64(buffer) {

    const bytes = new Uint8Array(buffer);

    let binary = "";

    const chunkSize = 0x8000;

    for (
        let i = 0;
        i < bytes.length;
        i += chunkSize
    ) {

        binary += String.fromCharCode(
            ...bytes.subarray(
                i,
                Math.min(
                    i + chunkSize,
                    bytes.length
                )
            )
        );
    }

    return btoa(binary);
}

function base64ToArrayBuffer(base64) {

    const binary = atob(base64);

    const bytes =
        new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes.buffer;
}


/* =========================
   LOGIN
========================= */

function showSection(section) {

    login.classList.add("hidden");
    home.classList.add("hidden");
    room.classList.add("hidden");
    game.classList.add("hidden");

    section.classList.remove("hidden");
}

function updateProfile() {

    profileName.textContent =
        username || "-";

    profileAvatar.textContent =
        username
            ? username.charAt(0).toUpperCase()
            : "?";
}

function enterAccount() {

    const name =
        usernameInput.value.trim();

    if (!name) {
        return;
    }

    username = name.slice(0, 16);

    localStorage.setItem(
        "shadow_username",
        username
    );

    updateProfile();

    showSection(home);
}

loginButton.addEventListener(
    "click",
    enterAccount
);

usernameInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {
            enterAccount();
        }
    }
);

logoutButton.addEventListener(
    "click",
    () => {

        username = "";

        localStorage.removeItem(
            "shadow_username"
        );

        usernameInput.value = "";

        showSection(login);
    }
);

if (username) {
    updateProfile();
    showSection(home);
}


/* =========================
   PEER / SALA
========================= */

function generateRoomCode() {

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let result = "";

    for (let i = 0; i < 6; i++) {

        result +=
            chars[
                Math.floor(
                    Math.random() *
                    chars.length
                )
            ];
    }

    return result;
}

function updateStatus(text) {

    statusElement.textContent = text;
}

function updatePlayersUI() {

    playersElement.innerHTML = "";

    for (const player of players) {

        const row =
            document.createElement("div");

        row.className = "player-row";

        const name =
            document.createElement("span");

        name.textContent =
            player.name;

        const state =
            document.createElement("span");

        state.textContent =
            player.id === getOwnPeerId()
                ? "Você"
                : "Online";

        row.appendChild(name);
        row.appendChild(state);

        playersElement.appendChild(row);
    }

    gamePlayers.textContent =
        `${players.length}/5`;
}

function addPlayer(player) {

    if (
        players.some(
            existing =>
                existing.id === player.id
        )
    ) {
        return;
    }

    if (players.length >= 5) {
        return;
    }

    players.push(player);

    updatePlayersUI();
}

function removePlayer(id) {

    players =
        players.filter(
            player =>
                player.id !== id
        );

    hostConnections.delete(id);

    updatePlayersUI();

    if (expectedRoundPlayers.length) {

        expectedRoundPlayers =
            expectedRoundPlayers.filter(
                playerId =>
                    playerId !== id
            );
    }
}

function sendToAll(message) {

    for (const connection of hostConnections.values()) {

        if (
            connection &&
            connection.open
        ) {

            try {
                connection.send(message);
            } catch {}
        }
    }
}

function sendToHost(message) {

    if (
        hostConnection &&
        hostConnection.open
    ) {

        try {
            hostConnection.send(message);
        } catch {}
    }
}

function connectToPeer(id, callback) {

    if (!peer) {
        return;
    }

    const connection =
        peer.connect(id, {
            reliable: true
        });

    connection.on(
        "open",
        () => callback(connection)
    );

    connection.on(
        "error",
        () => {}
    );
}

function createHost() {

    roomCode =
        generateRoomCode();

    isHost = true;

    peer =
        new Peer(roomCode);

    peer.on(
        "open",
        () => {

            players = [
                {
                    id: peer.id,
                    name: username
                }
            ];

            roomCodeElement.textContent =
                roomCode;

            updatePlayersUI();

            startButton.classList.remove(
                "hidden"
            );

            updateStatus(
                "Sala criada"
            );

            showSection(room);
        }
    );

    peer.on(
        "connection",
        connection => {

            connection.on(
                "open",
                () => {

                    connection.on(
                        "data",
                        message => {

                            handleHostMessage(
                                connection,
                                message
                            );
                        }
                    );

                    connection.on(
                        "close",
                        () => {

                            const playerId =
                                connection.peer;

                            removePlayer(
                                playerId
                            );

                            sendToAll({
                                type: "players",
                                players
                            });
                        }
                    );
                }
            );
        }
    );

    peer.on(
        "error",
        error => {

            updateStatus(
                "Erro na sala"
            );
        }
    );
}

function joinRoom(code) {

    roomCode =
        code
            .trim()
            .toUpperCase();

    if (!roomCode) {
        return;
    }

    isHost = false;

    peer =
        new Peer();

    peer.on(
        "open",
        () => {

            connectToPeer(
                roomCode,
                connection => {

                    hostConnection =
                        connection;

                    connection.on(
                        "data",
                        handleGuestMessage
                    );

                    connection.on(
                        "close",
                        () => {

                            updateStatus(
                                "Host saiu da sala"
                            );
                        }
                    );

                    connection.send({
                        type: "join",
                        name: username
                    });

                    roomCodeElement.textContent =
                        roomCode;

                    updateStatus(
                        "Conectado"
                    );

                    showSection(room);
                }
            );
        }
    );

    peer.on(
        "call",
        handleVoiceCall
    );

    peer.on(
        "error",
        () => {

            updateStatus(
                "Não foi possível entrar"
            );
        }
    );
}

createButton.addEventListener(
    "click",
    createHost
);

joinButton.addEventListener(
    "click",
    () => {

        const code =
            prompt(
                "Digite o código da sala"
            );

        if (code) {
            joinRoom(code);
        }
    }
);

copyCodeButton.addEventListener(
    "click",
    async () => {

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
    }
);


/* =========================
   MENSAGENS DO HOST
========================= */

function handleHostMessage(
    connection,
    message
) {

    if (!message || !message.type) {
        return;
    }

    if (message.type === "join") {

        if (gameStarted) {

            connection.send({
                type: "game_already_started"
            });

            connection.close();

            return;
        }

        if (players.length >= 5) {

            connection.send({
                type: "room_full"
            });

            connection.close();

            return;
        }

        const player = {
            id: connection.peer,
            name: String(
                message.name || "Jogador"
            ).slice(0, 16)
        };

        addPlayer(player);

        hostConnections.set(
            player.id,
            connection
        );

        connection.send({
            type: "players",
            players
        });

        sendToAll({
            type: "players",
            players
        });

        return;
    }

    if (message.type === "leave") {

        removePlayer(
            connection.peer
        );

        sendToAll({
            type: "players",
            players
        });

        return;
    }

    if (message.type === "voice_state") {

        broadcastVoiceState(
            connection.peer,
            message.enabled
        );

        return;
    }

    if (message.type === "reference_ready") {

        if (
            message.round ===
            currentRound
        ) {

            handleReferenceReady(
                connection.peer
            );
        }

        return;
    }

    if (message.type === "recording") {

        receiveGuestRecording(
            connection.peer,
            message
        );

        return;
    }

    if (message.type === "sabotage_target") {

        if (
            sabotageTargetResolver
        ) {

            const resolver =
                sabotageTargetResolver;

            sabotageTargetResolver =
                null;

            resolver(
                message.targetId
            );
        }

        return;
    }
}


/* =========================
   MENSAGENS DO GUEST
========================= */

function handleGuestMessage(message) {

    if (!message || !message.type) {
        return;
    }

    if (message.type === "players") {

        players =
            message.players || [];

        updatePlayersUI();

        return;
    }

    if (message.type === "voice_state") {

        updateRemoteVoiceState(
            message.playerId,
            message.enabled
        );

        return;
    }

    if (message.type === "game_already_started") {

        updateStatus(
            "A partida já começou"
        );

        return;
    }

    if (message.type === "room_full") {

        updateStatus(
            "Sala cheia"
        );

        return;
    }

    if (message.type === "game_start") {

        startGameAsGuest(
            message.players || []
        );

        return;
    }

    if (message.type === "round_begin") {

        handleRoundBegin(
            message
        );

        return;
    }

    if (message.type === "record_countdown") {

        runRecordCountdown();

        return;
    }

    if (message.type === "playback_take") {

        handlePlaybackTake(
            message
        );

        return;
    }

    if (message.type === "wheel_spin") {

        handleWheelSpin(
            message
        );

        return;
    }

    if (message.type === "sabotage_choose") {

        showGuestSabotageChooser(
            message
        );

        return;
    }

    if (message.type === "game_final") {

        showFinalResult(
            message.scores || []
        );

        return;
    }
}


/* =========================
   VOZ
========================= */

function updateMicUI() {

    if (microphoneEnabled) {

        micButton.textContent =
            "Desativar microfone";

        voiceStatus.textContent =
            "Microfone ligado";

        micButton.classList.add(
            "active"
        );

    } else {

        micButton.textContent =
            "Ativar microfone";

        voiceStatus.textContent =
            "Microfone desligado";

        micButton.classList.remove(
            "active"
        );
    }
}

async function enableMicrophone() {

    try {

        if (!navigator.mediaDevices) {
            throw new Error();
        }

        if (!localStream) {

            localStream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: false,
                            autoGainControl: false,
                            latency: 0
                        },
                        video: false
                    });
        }

        for (
            const track
            of localStream.getAudioTracks()
        ) {
            track.enabled = true;
        }

        microphoneEnabled = true;

        updateMicUI();

        if (
            !performanceVoiceMuted &&
            (!gameStarted || gameVoiceEnabled)
        ) {

            announceVoiceState(true);

            startVoiceRetry();
        }

    } catch {

        microphoneEnabled = false;

        updateMicUI();

        voiceStatus.textContent =
            "Permissão do microfone negada";
    }
}

function disableMicrophone() {

    if (localStream) {

        for (
            const track
            of localStream.getAudioTracks()
        ) {
            track.enabled = false;
        }
    }

    microphoneEnabled = false;

    updateMicUI();

    announceVoiceState(false);

    closeOutgoingVoiceCalls();
}

micButton.addEventListener(
    "click",
    async () => {

        if (microphoneEnabled) {

            gameVoiceEnabled = false;

            disableMicrophone();

            updateGameVoiceButton();

        } else {

            gameVoiceEnabled = true;

            await enableMicrophone();

            if (microphoneEnabled) {
                startVoiceRetry();
            }

            updateGameVoiceButton();
        }
    }
);

function announceVoiceState(enabled) {

    const message = {
        type: "voice_state",
        playerId: getOwnPeerId(),
        enabled
    };

    if (isHost) {

        broadcastVoiceState(
            getOwnPeerId(),
            enabled
        );

    } else {

        sendToHost(message);
    }
}

function broadcastVoiceState(
    playerId,
    enabled
) {

    sendToAll({
        type: "voice_state",
        playerId,
        enabled
    });

    updateRemoteVoiceState(
        playerId,
        enabled
    );
}

function updateRemoteVoiceState(
    playerId,
    enabled
) {

    // A voz é P2P.
    // O estado serve apenas para
    // ajudar a decidir novas chamadas.
}

function closeOutgoingVoiceCalls() {

    if (!peer) {
        return;
    }

    const connections =
        peer.connections || {};

    for (
        const peerId
        of Object.keys(connections)
    ) {

        for (
            const connection
            of connections[peerId]
        ) {

            if (
                connection &&
                typeof connection.close === "function"
            ) {

                try {
                    connection.close();
                } catch {}
            }
        }
    }
}

function closeAllVoiceCalls() {

    closeOutgoingVoiceCalls();

    remoteAudios
        .querySelectorAll("audio")
        .forEach(audio => {

            try {
                audio.pause();
            } catch {}

            audio.remove();
        });
}

function startVoiceRetry() {

    if (voiceRetryTimer) {
        return;
    }

    voiceRetryTimer =
        setInterval(() => {

            if (
                !peer ||
                !microphoneEnabled ||
                !gameVoiceEnabled ||
                performanceVoiceMuted
            ) {
                return;
            }

            callPlayers();

        }, 1200);
}

function callPlayers() {

    if (
        !peer ||
        !localStream ||
        !microphoneEnabled ||
        !gameVoiceEnabled ||
        performanceVoiceMuted
    ) {
        return;
    }

    const ownId =
        getOwnPeerId();

    for (const player of players) {

        if (
            player.id === ownId
        ) {
            continue;
        }

        try {

            peer.call(
                player.id,
                localStream,
                {
                    metadata: {
                        type: "shadow_voice"
                    }
                }
            );

        } catch {}
    }
}

function handleVoiceCall(call) {

    if (
        !call ||
        call.metadata?.type !== "shadow_voice"
    ) {
        return;
    }

    if (performanceVoiceMuted) {

        try {
            call.answer();
        } catch {}

        call.on(
            "stream",
            stream => {

                createRemoteAudio(
                    stream,
                    true
                );
            }
        );

        return;
    }

    if (
        microphoneEnabled &&
        localStream
    ) {

        try {
            call.answer(
                localStream
            );
        } catch {}

    } else {

        try {
            call.answer();
        } catch {}
    }

    call.on(
        "stream",
        stream => {

            createRemoteAudio(
                stream,
                performanceVoiceMuted
            );
        }
    );
}

function createRemoteAudio(
    stream,
    muted = false
) {

    let audio =
        document.querySelector(
            `audio[data-stream-id="${stream.id}"]`
        );

    if (audio) {
        return;
    }

    audio =
        document.createElement("audio");

    audio.autoplay = true;
    audio.playsInline = true;

    audio.dataset.streamId =
        stream.id;

    audio.muted =
        muted || performanceVoiceMuted;

    audio.srcObject =
        stream;

    remoteAudios.appendChild(
        audio
    );

    audio.play().catch(() => {});
}

function pauseVoiceChatForPerformance() {

    performanceVoiceMuted = true;

    closeAllVoiceCalls();

    remoteAudios
        .querySelectorAll("audio")
        .forEach(audio => {
            audio.muted = true;
        });

    updateGameVoiceButton();
}

function resumeVoiceChatAfterPerformance() {

    performanceVoiceMuted = false;

    closeAllVoiceCalls();

    remoteAudios
        .querySelectorAll("audio")
        .forEach(audio => {
            audio.muted = false;
        });

    updateGameVoiceButton();

    if (
        gameVoiceEnabled &&
        microphoneEnabled
    ) {

        setTimeout(
            startVoiceRetry,
            200
        );
    }
}


/* =========================
   BOTÃO DE VOZ NA PARTIDA
========================= */

function createGameVoiceButton() {

    if (gameVoiceButton) {
        return;
    }

    const actions =
        game.querySelector(
            ".game-actions"
        );

    if (!actions) {
        return;
    }

    gameVoiceButton =
        document.createElement("button");

    gameVoiceButton.id =
        "gameVoiceButton";

    gameVoiceButton.type =
        "button";

    gameVoiceButton.textContent =
        "Voz: OFF";

    actions.appendChild(
        gameVoiceButton
    );

    gameVoiceButton.addEventListener(
        "click",
        async () => {

            if (performanceVoiceMuted) {
                return;
            }

            if (gameVoiceEnabled) {

                gameVoiceEnabled = false;

                disableMicrophone();

            } else {

                gameVoiceEnabled = true;

                if (!microphoneEnabled) {
                    await enableMicrophone();
                } else {
                    startVoiceRetry();
                }
            }

            updateGameVoiceButton();
        }
    );
}

function updateGameVoiceButton() {

    if (!gameVoiceButton) {
        return;
    }

    if (performanceVoiceMuted) {

        gameVoiceButton.textContent =
            "Voz: BLOQUEADA";

        gameVoiceButton.disabled =
            true;

        return;
    }

    gameVoiceButton.disabled =
        false;

    gameVoiceButton.textContent =
        gameVoiceEnabled
            ? "Voz: ON"
            : "Voz: OFF";
}


/* =========================
   PARTIDA
========================= */

function ensureGameUI() {

    createGameVoiceButton();

    if (
        !document.getElementById(
            "shadowPlaybackScreen"
        )
    ) {

        const playback =
            document.createElement("div");

        playback.id =
            "shadowPlaybackScreen";

        playback.className =
            "game-center hidden";

        playback.innerHTML = `
            <div class="game-label">
                PLAYBACK
            </div>

            <h2 id="shadowPlaybackPlayer">
                Jogador
            </h2>

            <div id="shadowPlaybackEffect">
                Reproduzindo...
            </div>

            <div id="shadowPlaybackScore">
                --
            </div>
        `;

        game.appendChild(
            playback
        );
    }

    if (
        !document.getElementById(
            "shadowWheelScreen"
        )
    ) {

        const wheel =
            document.createElement("div");

        wheel.id =
            "shadowWheelScreen";

        wheel.className =
            "game-center hidden";

        wheel.innerHTML = `
            <div class="game-label">
                ROULETA
            </div>

            <h2 id="shadowWheelPlayer">
                Jogador
            </h2>

            <div id="shadowWheel">
                <span id="shadowWheelText">
                    ?
                </span>
            </div>

            <div id="shadowWheelResult">
                Girando...
            </div>

            <div id="shadowSabotageTargets"></div>
        `;

        game.appendChild(
            wheel
        );
    }

    if (
        !document.getElementById(
            "shadowFinalScreen"
        )
    ) {

        const final =
            document.createElement("div");

        final.id =
            "shadowFinalScreen";

        final.className =
            "game-center hidden";

        final.innerHTML = `
            <div class="game-label">
                FINAL
            </div>

            <h2>
                Resultado
            </h2>

            <div id="shadowFinalLeaderboard"></div>

            <button
                id="shadowFinalLeave"
                class="secondary"
            >
                Voltar para a sala
            </button>
        `;

        game.appendChild(
            final
        );

        document
            .getElementById(
                "shadowFinalLeave"
            )
            .addEventListener(
                "click",
                leaveRoom
            );
    }

    addGameStyles();
}

function addGameStyles() {

    if (
        document.getElementById(
            "shadowGameDynamicStyle"
        )
    ) {
        return;
    }

    const style =
        document.createElement("style");

    style.id =
        "shadowGameDynamicStyle";

    style.textContent = `

        #shadowPlaybackScreen,
        #shadowWheelScreen,
        #shadowFinalScreen {
            width: 100%;
        }

        #shadowPlaybackPlayer {
            margin: 12px 0 8px;
        }

        #shadowPlaybackEffect {
            opacity: .7;
            font-size: 13px;
            min-height: 22px;
        }

        #shadowPlaybackScore {
            margin-top: 20px;
            font-size: 48px;
            font-weight: 900;
        }

        #shadowWheel {
            width: 190px;
            height: 190px;
            margin: 25px auto;
            border-radius: 50%;
            border: 8px solid rgba(255,255,255,.12);
            background:
                conic-gradient(
                    #ffffff 0deg 60deg,
                    #202020 60deg 120deg,
                    #ffffff 120deg 180deg,
                    #202020 180deg 240deg,
                    #ffffff 240deg 300deg,
                    #202020 300deg 360deg
                );
            display: flex;
            align-items: center;
            justify-content: center;
            transition:
                transform 2.2s cubic-bezier(.12,.75,.18,1);
        }

        #shadowWheel span {
            width: 82px;
            height: 82px;
            border-radius: 50%;
            background: #090909;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 13px;
        }

        #shadowWheelResult {
            min-height: 28px;
            font-size: 18px;
            font-weight: 900;
        }

        #shadowSabotageTargets {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            justify-content: center;
            margin-top: 18px;
        }

        .shadow-target {
            width: auto !important;
            margin: 0 !important;
            padding: 10px 14px !important;
            min-height: 40px !important;
        }

        #shadowFinalLeaderboard {
            width: 100%;
            margin: 20px 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .shadow-final-player {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 13px 15px;
            border-radius: 13px;
            background: rgba(255,255,255,.06);
        }

        .shadow-final-score {
            font-weight: 900;
        }

        #gameVoiceButton {
            width: auto !important;
            min-width: 92px;
            min-height: 38px !important;
            margin-top: 0 !important;
            padding: 0 12px;
            border-radius: 12px !important;
            font-size: 12px !important;
            font-weight: 800;
        }

    `;

    document.head.appendChild(
        style
    );
}

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

    document
        .getElementById(
            "shadowPlaybackScreen"
        )
        ?.classList.add("hidden");

    document
        .getElementById(
            "shadowWheelScreen"
        )
        ?.classList.add("hidden");

    document
        .getElementById(
            "shadowFinalScreen"
        )
        ?.classList.add("hidden");
}

function showGame() {

    ensureGameUI();

    showSection(game);

    gamePlayers.textContent =
        `${players.length}/5`;

    updateGameVoiceButton();
}

function initializeScores() {

    playerScores = {};
    playerMultipliers = {};

    for (const player of players) {

        playerScores[player.id] =
            0;

        playerMultipliers[player.id] =
            1;
    }
}

function startGameForEveryone() {

    if (!isHost) {
        return;
    }

    if (gameStarted) {
        return;
    }

    gameStarted = true;

    currentRound = 1;

    initializeScores();

    expectedRoundPlayers =
        players.map(
            player => player.id
        );

    showGame();

    sendToAll({
        type: "game_start",
        players
    });

    beginRoundHost();
}

function startGameAsGuest(
    gamePlayersList
) {

    gameStarted = true;

    currentRound = 1;

    players =
        gamePlayersList || [];

    initializeScores();

    showGame();

    updateGameVoiceButton();
}


/* =========================
   RODADA
========================= */

function chooseReference(round) {

    const seed =
        hashString(
            `${roomCode}:${round}`
        );

    return SOUND_PACK[
        seed % SOUND_PACK.length
    ];
}

async function beginRoundHost() {

    if (!gameStarted) {
        return;
    }

    if (
        currentRound >
        TOTAL_ROUNDS
    ) {

        finishGameHost();

        return;
    }

    expectedRoundPlayers =
        players.map(
            player => player.id
        );

    referenceReadyPlayers =
        new Set();

    roundRecordings =
        new Map();

    playbackStarted =
        false;

    referencePlayed =
        false;

    currentReference =
        chooseReference(
            currentRound
        );

    currentReferenceBuffer =
        null;

    roundText.textContent =
        `Rodada ${currentRound}`;

    showGame();

    hideGameScreens();

    countdownScreen.classList.remove(
        "hidden"
    );

    let count = 3;

    countdownNumber.textContent =
        count;

    const timer =
        setInterval(() => {

            count--;

            if (count <= 0) {

                clearInterval(timer);

                sendToAll({
                    type: "round_begin",
                    round: currentRound,
                    reference:
                        currentReference
                });

                handleRoundBegin({
                    type: "round_begin",
                    round: currentRound,
                    reference:
                        currentReference
                });

                return;
            }

            countdownNumber.textContent =
                count;

        }, 1000);
}

async function handleRoundBegin(
    message
) {

    currentRound =
        message.round;

    currentReference =
        message.reference;

    currentReferenceBuffer =
        null;

    referencePlayed =
        false;

    recordedThisRound =
        false;

    roundText.textContent =
        `Rodada ${currentRound}`;

    showGame();

    hideGameScreens();

    referenceScreen.classList.remove(
        "hidden"
    );

    const title =
        referenceScreen.querySelector(
            "h2"
        );

    const description =
        referenceScreen.querySelector(
            "p"
        );

    if (title) {
        title.textContent =
            currentReference.name;
    }

    if (description) {
        description.textContent =
            `${currentReference.category} • Ouça uma vez e memorize.`;
    }

    referenceButton.textContent =
        "Ouvir som";

    referenceButton.disabled =
        false;

    pauseVoiceChatForPerformance();

    const played =
        await playReferenceOnce();

    if (!played) {

        referenceButton.disabled =
            false;

        referenceButton.textContent =
            "Ouvir som";
    }
}

referenceButton.addEventListener(
    "click",
    () => {

        if (!referencePlayed) {
            playReferenceOnce();
        }
    }
);

function handleReferenceReady(
    playerId
) {

    referenceReadyPlayers.add(
        playerId
    );

    const allReady =
        expectedRoundPlayers.every(
            id =>
                referenceReadyPlayers
                    .has(id)
        );

    if (allReady) {
        startRecordCountdownHost();
    }
}

function startRecordCountdownHost() {

    if (!isHost) {
        return;
    }

    if (
        recording ||
        playbackStarted
    ) {
        return;
    }

    if (referenceReadyTimer) {

        clearTimeout(
            referenceReadyTimer
        );

        referenceReadyTimer =
            null;
    }

    sendToAll({
        type: "record_countdown",
        round: currentRound
    });

    runRecordCountdown();
}

function runRecordCountdown() {

    hideGameScreens();

    recordScreen.classList.remove(
        "hidden"
    );

    pauseVoiceChatForPerformance();

    let count = 3;

    recordTimer.textContent =
        count;

    recordStatus.textContent =
        "Prepare-se...";

    const timer =
        setInterval(() => {

            count--;

            if (count <= 0) {

                clearInterval(timer);

                startRecordingPhase();

                return;
            }

            recordTimer.textContent =
                count;

        }, 1000);
}


/* =========================
   GRAVAÇÃO
========================= */

async function prepareRecordingMicrophone() {

    recordingMicWasEnabled =
        microphoneEnabled;

    try {

        if (!localStream) {

            localStream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: false,
                            autoGainControl: false,
                            latency: 0
                        },
                        video: false
                    });
        }

        for (
            const track
            of localStream.getAudioTracks()
        ) {
            track.enabled = true;
        }

        return true;

    } catch {

        return false;
    }
}

function restoreMicrophoneAfterRecording() {

    if (!localStream) {
        return;
    }

    for (
        const track
        of localStream.getAudioTracks()
    ) {

        track.enabled =
            recordingMicWasEnabled;
    }

    microphoneEnabled =
        recordingMicWasEnabled;

    updateMicUI();
}

async function startRecordingPhase() {

    if (recording) {
        return;
    }

    if (recordedThisRound) {
        return;
    }

    recording = true;

    hideGameScreens();

    recordScreen.classList.remove(
        "hidden"
    );

    pauseVoiceChatForPerformance();

    const micReady =
        await prepareRecordingMicrophone();

    if (!micReady) {

        recording = false;

        recordStatus.textContent =
            "Microfone indisponível";

        await sleep(700);

        submitRecording(
            null,
            ""
        );

        return;
    }

    const mimeType =
        getSupportedMimeType();

    try {

        mediaRecorder =
            mimeType
                ? new MediaRecorder(
                    localStream,
                    { mimeType }
                )
                : new MediaRecorder(
                    localStream
                );

    } catch {

        recording = false;

        restoreMicrophoneAfterRecording();

        submitRecording(
            null,
            ""
        );

        return;
    }

    recordChunks = [];

    mediaRecorder.ondataavailable =
        event => {

            if (
                event.data &&
                event.data.size > 0
            ) {

                recordChunks.push(
                    event.data
                );
            }
        };

    mediaRecorder.onstop =
        async () => {

            const blob =
                new Blob(
                    recordChunks,
                    {
                        type:
                            mediaRecorder.mimeType ||
                            mimeType ||
                            "audio/webm"
                    }
                );

            recordedThisRound =
                true;

            recording =
                false;

            restoreMicrophoneAfterRecording();

            if (!blob.size) {

                submitRecording(
                    null,
                    ""
                );

                return;
            }

            try {

                const buffer =
                    await blob.arrayBuffer();

                const base64 =
                    arrayBufferToBase64(
                        buffer
                    );

                submitRecording(
                    base64,
                    blob.type
                );

            } catch {

                submitRecording(
                    null,
                    ""
                );
            }
        };

    try {

        mediaRecorder.start();

    } catch {

        recording = false;

        restoreMicrophoneAfterRecording();

        submitRecording(
            null,
            ""
        );

        return;
    }

    let seconds =
        RECORD_TIME;

    recordTimer.textContent =
        seconds;

    recordStatus.textContent =
        "Gravando...";

    const timer =
        setInterval(() => {

            seconds--;

            recordTimer.textContent =
                Math.max(
                    0,
                    seconds
                );

            if (seconds <= 0) {

                clearInterval(timer);

                if (
                    mediaRecorder &&
                    mediaRecorder.state ===
                        "recording"
                ) {

                    mediaRecorder.stop();
                }
            }

        }, 1000);
}

function submitRecording(
    audioBase64,
    mimeType
) {

    const message = {
        type: "recording",
        round: currentRound,
        playerId:
            getOwnPeerId(),
        audioBase64,
        mimeType
    };

    if (isHost) {

        receiveGuestRecording(
            getOwnPeerId(),
            message
        );

    } else {

        sendToHost(message);
    }
}

function receiveGuestRecording(
    playerId,
    message
) {

    if (
        !isHost ||
        message.round !== currentRound
    ) {
        return;
    }

    if (
        roundRecordings.has(
            playerId
        )
    ) {
        return;
    }

    roundRecordings.set(
        playerId,
        {
            audioBase64:
                message.audioBase64 || null,

            mimeType:
                message.mimeType ||
                "audio/webm"
        }
    );

    checkRecordingsComplete();
}

function checkRecordingsComplete() {

    if (
        !isHost ||
        playbackStarted
    ) {
        return;
    }

    const complete =
        expectedRoundPlayers.every(
            id =>
                roundRecordings.has(id)
        );

    if (complete) {

        beginPlaybackHost();

        return;
    }

    if (!recordingWaitTimer) {

        recordingWaitTimer =
            setTimeout(() => {

                recordingWaitTimer =
                    null;

                for (
                    const playerId
                    of expectedRoundPlayers
                ) {

                    if (
                        !roundRecordings.has(
                            playerId
                        )
                    ) {

                        roundRecordings.set(
                            playerId,
                            {
                                audioBase64: null,
                                mimeType:
                                    "audio/webm"
                            }
                        );
                    }
                }

                beginPlaybackHost();

            }, 8000);
    }
}


/* =========================
   PONTUAÇÃO SIMPLES
========================= */

function resampleArray(
    array,
    length
) {

    if (!array.length) {
        return new Array(length).fill(0);
    }

    if (array.length === length) {
        return array.slice();
    }

    const result = [];

    for (let i = 0; i < length; i++) {

        const position =
            i *
            (array.length - 1) /
            (length - 1);

        const left =
            Math.floor(position);

        const right =
            Math.min(
                left + 1,
                array.length - 1
            );

        const amount =
            position - left;

        result.push(
            array[left] *
                (1 - amount) +
            array[right] *
                amount
        );
    }

    return result;
}

function correlation(a, b) {

    if (
        !a.length ||
        !b.length ||
        a.length !== b.length
    ) {
        return 0;
    }

    let meanA = 0;
    let meanB = 0;

    for (let i = 0; i < a.length; i++) {

        meanA += a[i];
        meanB += b[i];
    }

    meanA /= a.length;
    meanB /= b.length;

    let numerator = 0;
    let varianceA = 0;
    let varianceB = 0;

    for (let i = 0; i < a.length; i++) {

        const da =
            a[i] - meanA;

        const db =
            b[i] - meanB;

        numerator +=
            da * db;

        varianceA +=
            da * da;

        varianceB +=
            db * db;
    }

    if (
        varianceA === 0 ||
        varianceB === 0
    ) {
        return 0;
    }

    return clamp(
        numerator /
            Math.sqrt(
                varianceA *
                varianceB
            ),
        -1,
        1
    );
}

function extractAudioFeatures(
    buffer
) {

    const data =
        buffer.getChannelData(0);

    const sampleRate =
        buffer.sampleRate;

    const frameSize =
        2048;

    const hop =
        1024;

    const envelope = [];
    const pitch = [];

    let previousRms = 0;

    let attacks = 0;

    for (
        let start = 0;
        start + frameSize <= data.length;
        start += hop
    ) {

        let sum = 0;
        let crossings = 0;

        let previous =
            data[start];

        for (
            let i = 0;
            i < frameSize;
            i++
        ) {

            const value =
                data[start + i];

            sum +=
                value * value;

            if (
                (value >= 0 &&
                    previous < 0) ||
                (value < 0 &&
                    previous >= 0)
            ) {

                crossings++;
            }

            previous =
                value;
        }

        const rms =
            Math.sqrt(
                sum / frameSize
            );

        envelope.push(rms);

        const frequency =
            crossings *
            sampleRate /
            (2 * frameSize);

        pitch.push(
            rms > 0.015 &&
            frequency >= 70 &&
            frequency <= 1200
                ? frequency
                : 0
        );

        if (
            rms >
                Math.max(
                    0.03,
                    previousRms * 1.8
                ) &&
            start / sampleRate > 0.12
        ) {

            attacks++;
        }

        previousRms =
            rms;
    }

    const env =
        resampleArray(
            envelope,
            32
        );

    const pitchResampled =
        resampleArray(
            pitch,
            32
        );

    const validPitch =
        pitchResampled.filter(
            value => value > 0
        );

    let pitchNormalized =
        new Array(32).fill(0);

    if (validPitch.length >= 2) {

        const sorted =
            validPitch
                .slice()
                .sort(
                    (a, b) =>
                        a - b
                );

        const median =
            sorted[
                Math.floor(
                    sorted.length / 2
                )
            ];

        pitchNormalized =
            pitchResampled.map(
                value =>
                    value > 0
                        ? Math.log2(
                            value /
                            median
                        )
                        : 0
            );
    }

    return {
        envelope: env,
        pitch: pitchNormalized,
        attacks
    };
}

async function calculateScore(
    audioBase64
) {

    if (
        !audioBase64 ||
        !currentReferenceBuffer
    ) {
        return 0;
    }

    try {

        const bytes =
            base64ToArrayBuffer(
                audioBase64
            );

        const ctx =
            getAudioContext();

        const buffer =
            await ctx.decodeAudioData(
                bytes.slice(0)
            );

        const referenceFeatures =
            extractAudioFeatures(
                currentReferenceBuffer
            );

        const recordingFeatures =
            extractAudioFeatures(
                buffer
            );

        const envelopeCorrelation =
            correlation(
                referenceFeatures.envelope,
                recordingFeatures.envelope
            );

        const pitchCorrelation =
            correlation(
                referenceFeatures.pitch,
                recordingFeatures.pitch
            );

        const referencePitch =
            referenceFeatures.pitch.some(
                value =>
                    Math.abs(value) > 0.01
            );

        const envelopeScore =
            ((envelopeCorrelation + 1) / 2) *
            100;

        const pitchScore =
            ((pitchCorrelation + 1) / 2) *
            100;

        const attackDifference =
            Math.abs(
                referenceFeatures.attacks -
                recordingFeatures.attacks
            );

        const attackScore =
            clamp(
                100 -
                attackDifference * 18,
                0,
                100
            );

        let score;

        if (referencePitch) {

            score =
                envelopeScore * 0.45 +
                pitchScore * 0.35 +
                attackScore * 0.20;

        } else {

            score =
                envelopeScore * 0.70 +
                attackScore * 0.30;
        }

        return Math.round(
            clamp(
                score,
                0,
                100
            )
        );

    } catch {

        return 0;
    }
}


/* =========================
   PLAYBACK
========================= */

async function beginPlaybackHost() {

    if (
        !isHost ||
        playbackStarted
    ) {
        return;
    }

    playbackStarted =
        true;

    if (recordingWaitTimer) {

        clearTimeout(
            recordingWaitTimer
        );

        recordingWaitTimer =
            null;
    }

    if (!currentReferenceBuffer) {

        try {

            currentReferenceBuffer =
                await createOfflineReference(
                    currentReference
                );

        } catch {}
    }

    const playbackData = [];

    for (
        const playerId
        of expectedRoundPlayers
    ) {

        const recording =
            roundRecordings.get(
                playerId
            );

        let rawScore = 0;

        let durationMs = 700;

        if (
            recording &&
            recording.audioBase64
        ) {

            rawScore =
                await calculateScore(
                    recording.audioBase64
                );

            try {

                const buffer =
                    await getAudioContext()
                        .decodeAudioData(
                            base64ToArrayBuffer(
                                recording.audioBase64
                            ).slice(0)
                        );

                durationMs =
                    Math.max(
                        700,
                        Math.round(
                            buffer.duration *
                            1000
                        )
                    );

            } catch {}
        }

        const multiplier =
            playerMultipliers[
                playerId
            ] || 1;

        let finalScore =
            Math.round(
                rawScore *
                multiplier
            );

        let sabotage =
            pendingSabotages[
                playerId
            ] || null;

        if (sabotage) {

            finalScore =
                Math.max(
                    0,
                    finalScore - 10
                );

            delete pendingSabotages[
                playerId
            ];
        }

        playerScores[playerId] =
            (
                playerScores[playerId] ||
                0
            ) + finalScore;

        playbackData.push({
            playerId,
            playerName:
                getPlayerName(
                    playerId
                ),
            audioBase64:
                recording
                    ?.audioBase64 ||
                null,
            mimeType:
                recording
                    ?.mimeType ||
                "audio/webm",
            rawScore,
            finalScore,
            durationMs,
            sabotage
        });
    }

    playbackIndex = 0;

    playNextTakeHost(
        playbackData
    );
}

async function playNextTakeHost(
    data
) {

    if (
        playbackIndex >=
        data.length
    ) {

        finishPlaybackHost();

        return;
    }

    const take =
        data[playbackIndex];

    sendToAll({
        type: "playback_take",
        ...take
    });

    await handlePlaybackTake(
        take
    );

    playbackIndex++;

    await sleep(600);

    playNextTakeHost(
        data
    );
}

async function handlePlaybackTake(
    take
) {

    pauseVoiceChatForPerformance();

    hideGameScreens();

    const playback =
        document.getElementById(
            "shadowPlaybackScreen"
        );

    const player =
        document.getElementById(
            "shadowPlaybackPlayer"
        );

    const effect =
        document.getElementById(
            "shadowPlaybackEffect"
        );

    const score =
        document.getElementById(
            "shadowPlaybackScore"
        );

    playback.classList.remove(
        "hidden"
    );

    player.textContent =
        take.playerName ||
        "Jogador";

    score.textContent =
        `${take.finalScore || 0}`;

    if (take.sabotage) {

        effect.textContent =
            `SABOTADO POR ${take.sabotage.byName}`;

    } else {

        effect.textContent =
            "Reproduzindo...";
    }

    if (!take.audioBase64) {

        effect.textContent +=
            " • sem gravação";

        await sleep(800);

        return;
    }

    try {

        await playRecording(
            take.audioBase64,
            take.mimeType,
            take.sabotage
        );

    } catch {

        await sleep(
            Math.max(
                700,
                take.durationMs || 700
            )
        );
    }

    await sleep(250);

    if (
        playbackIndex <
        expectedRoundPlayers.length - 1
    ) {

        // Continua silencioso entre os takes.
        pauseVoiceChatForPerformance();

    } else {

        resumeVoiceChatAfterPerformance();
    }
}

async function playRecording(
    base64,
    mimeType,
    sabotage
) {

    if (
        !sabotage
    ) {

        const blob =
            new Blob(
                [
                    base64ToArrayBuffer(
                        base64
                    )
                ],
                {
                    type:
                        mimeType ||
                        "audio/webm"
                }
            );

        const url =
            URL.createObjectURL(
                blob
            );

        const audio =
            new Audio(url);

        audio.playsInline =
            true;

        return new Promise(
            resolve => {

                audio.onended =
                    () => {

                        URL.revokeObjectURL(
                            url
                        );

                        resolve();
                    };

                audio.onerror =
                    () => {

                        URL.revokeObjectURL(
                            url
                        );

                        resolve();
                    };

                audio.play()
                    .catch(
                        () => resolve()
                    );
            }
        );
    }

    return playSabotagedRecording(
        base64,
        sabotage
    );
}

async function playSabotagedRecording(
    base64,
    sabotage
) {

    if (
        sabotage.effect ===
        "FART"
    ) {

        return playFart();
    }

    const ctx =
        await resumeAudioContext();

    const buffer =
        await ctx.decodeAudioData(
            base64ToArrayBuffer(
                base64
            ).slice(0)
        );

    const source =
        ctx.createBufferSource();

    source.buffer =
        buffer;

    if (
        sabotage.effect ===
        "PITCH"
    ) {

        source.playbackRate.value =
            1.25;
    }

    if (
        sabotage.effect ===
        "SATURAÇÃO"
    ) {

        const shaper =
            ctx.createWaveShaper();

        const curve =
            new Float32Array(
                44100
            );

        for (
            let i = 0;
            i < curve.length;
            i++
        ) {

            const x =
                i * 2 /
                curve.length -
                1;

            curve[i] =
                Math.tanh(
                    x * 4
                );
        }

        shaper.curve =
            curve;

        shaper.oversample =
            "2x";

        source.connect(
            shaper
        );

        shaper.connect(
            ctx.destination
        );

    } else if (
        sabotage.effect ===
        "ECHO"
    ) {

        const delay =
            ctx.createDelay();

        const feedback =
            ctx.createGain();

        const dry =
            ctx.createGain();

        delay.delayTime.value =
            0.22;

        feedback.gain.value =
            0.35;

        dry.gain.value =
            0.9;

        source.connect(
            dry
        );

        dry.connect(
            ctx.destination
        );

        source.connect(
            delay
        );

        delay.connect(
            feedback
        );

        feedback.connect(
            delay
        );

        delay.connect(
            ctx.destination
        );

    } else if (
        sabotage.effect ===
        "CORTADO"
    ) {

        const gain =
            ctx.createGain();

        source.connect(
            gain
        );

        gain.connect(
            ctx.destination
        );

        const step =
            0.18;

        for (
            let time = 0;
            time < buffer.duration;
            time += step * 2
        ) {

            gain.gain.setValueAtTime(
                1,
                time
            );

            gain.gain.setValueAtTime(
                0,
                Math.min(
                    time + step,
                    buffer.duration
                )
            );
        }

    } else {

        source.connect(
            ctx.destination
        );
    }

    return new Promise(
        resolve => {

            source.onended =
                resolve;

            source.start(0);
        }
    );
}

async function playFart() {

    const OfflineContext =
        window.OfflineAudioContext ||
        window.webkitOfflineAudioContext;

    const sampleRate =
        44100;

    const duration =
        1.2;

    const offline =
        new OfflineContext(
            1,
            Math.ceil(
                duration *
                sampleRate
            ),
            sampleRate
        );

    const oscillator =
        offline.createOscillator();

    const gain =
        offline.createGain();

    oscillator.type =
        "sawtooth";

    oscillator.frequency.setValueAtTime(
        95,
        0
    );

    oscillator.frequency.exponentialRampToValueAtTime(
        35,
        duration
    );

    gain.gain.setValueAtTime(
        0.001,
        0
    );

    gain.gain.linearRampToValueAtTime(
        0.75,
        0.08
    );

    gain.gain.exponentialRampToValueAtTime(
        0.001,
        duration
    );

    oscillator.connect(
        gain
    );

    gain.connect(
        offline.destination
    );

    oscillator.start(0);
    oscillator.stop(
        duration
    );

    const buffer =
        await offline.startRendering();

    await playAudioBuffer(
        buffer
    );
}

function finishPlaybackHost() {

    resumeVoiceChatAfterPerformance();

    hideGameScreens();

    resultScreen.classList.remove(
        "hidden"
    );

    resultText.textContent =
        "Todas as gravações foram reproduzidas.";

    setTimeout(() => {

        if (isHost) {
            currentRound++;

            beginRoundHost();
        }

    }, 1500);
}


/* =========================
   INICIAR PARTIDA
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

function leaveRoom() {

    gameStarted =
        false;

    if (referenceReadyTimer) {
        clearTimeout(
            referenceReadyTimer
        );
    }

    if (recordingWaitTimer) {
        clearTimeout(
            recordingWaitTimer
        );
    }

    if (voiceRetryTimer) {

        clearInterval(
            voiceRetryTimer
        );

        voiceRetryTimer =
            null;
    }

    closeAllVoiceCalls();

    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        localStream =
            null;
    }

    if (hostConnection) {

        try {
            hostConnection.send({
                type: "leave"
            });
        } catch {}

        try {
            hostConnection.close();
        } catch {}

        hostConnection =
            null;
    }

    for (
        const connection
        of hostConnections.values()
    ) {

        try {
            connection.close();
        } catch {}
    }

    hostConnections.clear();

    if (peer) {

        try {
            peer.destroy();
        } catch {}

        peer =
            null;
    }

    players = [];

    roomCode = "";

    isHost = false;

    microphoneEnabled =
        false;

    gameVoiceEnabled =
        false;

    performanceVoiceMuted =
        false;

    updateMicUI();

    showSection(home);
}

leaveRoomButton.addEventListener(
    "click",
    leaveRoom
);


/* =========================
   FINAL
========================= */

function finishGameHost() {

    gameStarted =
        false;

    resumeVoiceChatAfterPerformance();

    const leaderboard =
        players
            .map(player => ({
                id: player.id,
                name: player.name,
                score:
                    playerScores[
                        player.id
                    ] || 0
            }))
            .sort(
                (a, b) =>
                    b.score -
                    a.score
            );

    sendToAll({
        type: "game_final",
        scores: leaderboard
    });

    showFinalResult(
        leaderboard
    );
}

function showFinalResult(
    scores
) {

    hideGameScreens();

    const final =
        document.getElementById(
            "shadowFinalScreen"
        );

    const list =
        document.getElementById(
            "shadowFinalLeaderboard"
        );

    list.innerHTML = "";

    for (
        const player
        of scores
    ) {

        const row =
            document.createElement("div");

        row.className =
            "shadow-final-player";

        const name =
            document.createElement("span");

        name.textContent =
            player.name;

        const score =
            document.createElement("span");

        score.className =
            "shadow-final-score";

        score.textContent =
            `${player.score} pts`;

        row.appendChild(name);
        row.appendChild(score);

        list.appendChild(row);
    }

    final.classList.remove(
        "hidden"
    );

    updateGameVoiceButton();
}


/* =========================
   INICIALIZAÇÃO
========================= */

ensureGameUI();
updateMicUI();

if (peer) {

    peer.on(
        "call",
        handleVoiceCall
    );
}
