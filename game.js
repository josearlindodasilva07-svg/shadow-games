"use strict";

/* =========================================================
   SHADOW GAMES
   Multiplayer + Voice + Mimic Party style
   ========================================================= */


/* =========================
   ELEMENTOS
   ========================= */

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

const micButton = $("micButton");
const voiceStatus = $("voiceStatus");

const statusElement = $("status");
const playersElement = $("players");

const startButton = $("start");
const leaveRoomButton = $("leaveRoom");

const remoteAudios = $("remoteAudios");

const gamePlayers = $("gamePlayers");
const roundText = $("roundText");

const countdownScreen = $("countdownScreen");
const countdownNumber = $("countdownNumber");

const referenceScreen = $("referenceScreen");
const referenceButton = $("referenceButton");

const recordScreen = $("recordScreen");
const recordTimerElement = $("recordTimer");
const recordStatus = $("recordStatus");

const resultScreen = $("resultScreen");
const resultText = $("resultText");


/* =========================
   ESTADO
   ========================= */

let username = "";

let peer = null;
let peerId = "";

let roomCode = "";
let isHost = false;

let connections = new Map();

let localStream = null;
let microphoneEnabled = false;

/*
   IMPORTANTE:
   Voz da partida começa SEMPRE desligada.
*/
let gameVoiceEnabled = false;

let gameStarted = false;

let currentRound = 1;
const TOTAL_ROUNDS = 4;

let referencePlayed = false;
let recording = false;

let recordTimer = null;
let recordSeconds = 5;

let mediaRecorder = null;
let recordedChunks = [];

let myRecording = null;

let playerStates = new Map();

let roundRecordings = new Map();

let roundScores = new Map();

let referenceAudio = null;

let heartbeatTimer = null;

let joining = false;

let gameVoiceButton = null;


/* =========================
   REFERÊNCIAS DE SONS
   ========================= */

const SOUND_LIBRARY = [
    {
        name: "Gato",
        type: "animal",
        frequency: 520
    },
    {
        name: "Cachorro",
        type: "animal",
        frequency: 390
    },
    {
        name: "Campainha",
        type: "machine",
        frequency: 740
    },
    {
        name: "Alarme",
        type: "machine",
        frequency: 610
    },
    {
        name: "Robô",
        type: "voice",
        frequency: 280
    },
    {
        name: "Bip",
        type: "machine",
        frequency: 850
    }
];

let currentSound = null;


/* =========================================================
   UTILIDADES
   ========================================================= */

function randomId(length = 8) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let result = "";

    for (let i = 0; i < length; i++) {
        result += chars[
            Math.floor(Math.random() * chars.length)
        ];
    }

    return result;
}


function normalizeRoomCode(value) {
    return String(value || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6);
}


function showOnly(section) {
    login.classList.add("hidden");
    home.classList.add("hidden");
    room.classList.add("hidden");
    game.classList.add("hidden");

    section.classList.remove("hidden");
}


function setStatus(text) {
    if (statusElement) {
        statusElement.textContent = text;
    }
}


function wait(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}


function updateProfile() {
    if (profileName) {
        profileName.textContent = username || "-";
    }

    if (profileAvatar) {
        profileAvatar.textContent =
            username
                ? username.charAt(0).toUpperCase()
                : "?";
    }
}


function safeJsonParse(value) {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}


/* =========================================================
   LOGIN
   ========================================================= */

function loginUser() {
    const value = usernameInput.value.trim();

    if (!value) {
        usernameInput.focus();
        return;
    }

    username = value.slice(0, 16);

    localStorage.setItem(
        "shadow_games_username",
        username
    );

    updateProfile();

    showOnly(home);
}


/* =========================================================
   LOGOUT
   ========================================================= */

function logoutUser() {
    leaveRoom();

    username = "";

    localStorage.removeItem(
        "shadow_games_username"
    );

    usernameInput.value = "";

    showOnly(login);
}


/* =========================================================
   PEER
   ========================================================= */

function createPeer() {
    return new Promise((resolve, reject) => {

        if (peer) {
            try {
                peer.destroy();
            } catch {}
        }

        const id =
            "shadow-" +
            randomId(10);

        peer = new Peer(id);

        peer.on("open", (id) => {

            peerId = id;

            resolve(id);
        });

        peer.on("call", (call) => {

            answerIncomingCall(call);
        });

        peer.on("connection", (connection) => {

            setupDataConnection(connection);
        });

        peer.on("disconnected", () => {

            setStatus(
                "Conexão perdida. Reconectando..."
            );

            try {
                peer.reconnect();
            } catch {}
        });

        peer.on("error", (error) => {

            console.warn(
                "PeerJS:",
                error
            );

            if (
                error &&
                error.type === "peer-unavailable"
            ) {
                return;
            }

            setStatus(
                "Erro de conexão"
            );
        });

        peer.on("close", () => {

            peer = null;
            peerId = "";
        });
    });
}


/* =========================================================
   SALA
   ========================================================= */

async function createRoom() {

    if (joining) return;

    joining = true;

    try {

        await createPeer();

        roomCode =
            randomId(6);

        isHost = true;

        showRoom();

        setStatus(
            "Sala criada. Compartilhe o código."
        );

        updatePlayers();

        startHeartbeat();

    } catch (error) {

        console.error(error);

        alert(
            "Não foi possível criar a sala."
        );

    } finally {

        joining = false;
    }
}


async function joinRoom() {

    if (joining) return;

    const input =
        prompt("Digite o código da sala:");

    const code =
        normalizeRoomCode(input);

    if (code.length !== 6) {

        alert(
            "Código inválido."
        );

        return;
    }

    joining = true;

    try {

        await createPeer();

        roomCode = code;
        isHost = false;

        showRoom();

        setStatus(
            "Entrando na sala..."
        );

        connectToHost();

        startHeartbeat();

    } catch (error) {

        console.error(error);

        alert(
            "Não foi possível entrar na sala."
        );

    } finally {

        joining = false;
    }
}


/*
   PeerJS usa o ID do host.
   O host usa o próprio código da sala como identificador
   lógico através de localStorage.
*/
function getHostPeerId() {

    return (
        "shadow-room-" +
        roomCode
    );
}


/*
   Para manter o código da sala simples,
   o host recria o Peer usando o ID baseado no código.
*/
async function createHostPeer() {

    return new Promise((resolve, reject) => {

        if (peer) {
            try {
                peer.destroy();
            } catch {}
        }

        const id =
            getHostPeerId();

        peer = new Peer(id);

        peer.on("open", (id) => {

            peerId = id;

            resolve(id);
        });

        peer.on("call", (call) => {

            answerIncomingCall(call);
        });

        peer.on("connection", (connection) => {

            setupDataConnection(connection);
        });

        peer.on("error", (error) => {

            console.warn(
                "PeerJS:",
                error
            );

            reject(error);
        });
    });
}


/* =========================================================
   MOSTRAR SALA
   ========================================================= */

function showRoom() {

    showOnly(room);

    roomCodeElement.textContent =
        roomCode;

    if (startButton) {

        startButton.style.display =
            isHost
                ? "block"
                : "none";
    }

    updatePlayers();

    updateMicUI();
}


/* =========================================================
   CONEXÃO COM HOST
   ========================================================= */

function connectToHost() {

    const hostId =
        getHostPeerId();

    setStatus(
        "Conectando ao host..."
    );

    const connection =
        peer.connect(
            hostId,
            {
                reliable: true
            }
        );

    setupDataConnection(
        connection
    );
}


/* =========================================================
   DATA CONNECTION
   ========================================================= */

function setupDataConnection(connection) {

    if (!connection) {
        return;
    }

    connection.on("open", () => {

        connections.set(
            connection.peer,
            connection
        );

        sendToConnection(
            connection,
            {
                type: "hello",
                username,
                peerId,
                isHost
            }
        );

        if (isHost) {

            broadcastPlayers();

            sendGameState(
                connection
            );
        }

        updatePlayers();
    });


    connection.on("data", (data) => {

        handleNetworkMessage(
            connection,
            data
        );
    });


    connection.on("close", () => {

        connections.delete(
            connection.peer
        );

        updatePlayers();

        removeRemoteAudio(
            connection.peer
        );
    });


    connection.on("error", () => {

        connections.delete(
            connection.peer
        );

        updatePlayers();
    });
}


function sendToConnection(
    connection,
    data
) {

    if (
        connection &&
        connection.open
    ) {

        try {
            connection.send(data);
        } catch {}
    }
}


function broadcast(data) {

    connections.forEach(
        connection => {

            sendToConnection(
                connection,
                data
            );
        }
    );
}


/* =========================================================
   REDE
   ========================================================= */

function handleNetworkMessage(
    connection,
    data
) {

    if (!data || !data.type) {
        return;
    }


    switch (data.type) {

        case "hello":

            playerStates.set(
                data.peerId,
                {
                    peerId: data.peerId,
                    username:
                        data.username || "Jogador"
                }
            );

            if (isHost) {

                broadcastPlayers();
            }

            updatePlayers();

            break;


        case "players":

            playerStates.clear();

            for (
                const player of
                data.players || []
            ) {

                playerStates.set(
                    player.peerId,
                    player
                );
            }

            updatePlayers();

            break;


        case "game-state":

            applyGameState(
                data
            );

            break;


        case "game-start":

            if (!isHost) {

                gameStarted = true;

                currentRound =
                    data.round || 1;

                showGame();

                startRound();
            }

            break;


        case "reference":

            currentSound =
                data.sound;

            currentRound =
                data.round || 1;

            showReferenceScreen();

            break;


        case "record-start":

            currentRound =
                data.round || 1;

            currentSound =
                data.sound;

            startRecordingPhase();

            break;


        case "recording":

            if (isHost) {

                receiveRecording(
                    data
                );
            }

            break;


        case "playback":

            playRemoteRecording(
                data
            );

            break;


        case "result":

            showRoundResult(
                data
            );

            break;


        case "next-round":

            currentRound =
                data.round;

            startRound();

            break;


        case "game-end":

            showFinalResult(
                data
            );

            break;
    }
}


/* =========================================================
   PLAYERS
   ========================================================= */

function getPlayersArray() {

    const list = [];

    if (peerId) {

        list.push({
            peerId,
            username:
                username || "Você",
            host:
                isHost
        });
    }

    playerStates.forEach(
        player => {

            if (
                player.peerId !== peerId
            ) {

                list.push({
                    peerId:
                        player.peerId,
                    username:
                        player.username,
                    host:
                        player.host
                });
            }
        }
    );

    return list;
}


function updatePlayers() {

    if (!playersElement) {
        return;
    }

    const players =
        getPlayersArray();

    playersElement.innerHTML = "";

    for (
        const player of players
    ) {

        const item =
            document.createElement("div");

        item.className =
            "player-item";

        const name =
            document.createElement("span");

        name.textContent =
            player.peerId === peerId
                ? `${player.username} (Você)`
                : player.username;

        item.appendChild(name);

        if (player.host) {

            const host =
                document.createElement("small");

            host.textContent =
                "HOST";

            item.appendChild(host);
        }

        playersElement.appendChild(
            item
        );
    }

    if (gamePlayers) {

        gamePlayers.textContent =
            `${players.length}/5`;
    }
}


function broadcastPlayers() {

    if (!isHost) {
        return;
    }

    const players =
        getPlayersArray();

    broadcast({
        type: "players",
        players
    });

    updatePlayers();
}


/* =========================================================
   HEARTBEAT
   ========================================================= */

function startHeartbeat() {

    clearInterval(
        heartbeatTimer
    );

    heartbeatTimer =
        setInterval(() => {

            if (
                !peer ||
                peer.destroyed
            ) {
                return;
            }

            if (isHost) {

                broadcastPlayers();
            }

        }, 3000);
}


/* =========================================================
   GAME STATE
   ========================================================= */

function sendGameState(
    connection
) {

    sendToConnection(
        connection,
        {
            type: "game-state",
            gameStarted,
            currentRound
        }
    );
}


function applyGameState(data) {

    gameStarted =
        !!data.gameStarted;

    currentRound =
        data.currentRound || 1;

    if (gameStarted) {

        showGame();
    }
}


/* =========================================================
   VOZ
   ========================================================= */

async function enableMicrophone() {

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        alert(
            "Seu navegador não suporta microfone."
        );

        return;
    }

    try {

        if (!localStream) {

            localStream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: false,
                            autoGainControl: false,
                            channelCount: 1,
                            sampleRate: 48000
                        },
                        video: false
                    });
        }

        microphoneEnabled = true;

        updateMicUI();

        await refreshOutgoingVoice();

    } catch (error) {

        console.error(error);

        microphoneEnabled = false;

        updateMicUI();

        alert(
            "Não foi possível acessar o microfone."
        );
    }
}


function disableMicrophone() {

    microphoneEnabled = false;

    /*
       Não paramos o localStream aqui.
       Isso evita ter que pedir permissão novamente.
    */

    closeOutgoingCalls();

    updateMicUI();
}


function updateMicUI() {

    if (!micButton) {
        return;
    }

    if (microphoneEnabled) {

        micButton.textContent =
            "Desativar microfone";

        micButton.classList.add(
            "active"
        );

        if (voiceStatus) {

            voiceStatus.textContent =
                "Microfone ligado";
        }

    } else {

        micButton.textContent =
            "Ativar microfone";

        micButton.classList.remove(
            "active"
        );

        if (voiceStatus) {

            voiceStatus.textContent =
                "Microfone desligado";
        }
    }
}


/* =========================================================
   VOZ - SAÍDA
   ========================================================= */

function closeOutgoingCalls() {

    connections.forEach(
        connection => {

            if (
                connection._voiceCall
            ) {

                try {
                    connection._voiceCall.close();
                } catch {}

                connection._voiceCall =
                    null;
            }
        }
    );
}


async function refreshOutgoingVoice() {

    if (
        !microphoneEnabled ||
        !localStream
    ) {

        closeOutgoingCalls();

        return;
    }

    /*
       Durante a partida a voz só transmite
       se o botão da partida estiver ligado.
    */

    if (
        gameStarted &&
        !gameVoiceEnabled
    ) {

        closeOutgoingCalls();

        return;
    }

    connections.forEach(
        connection => {

            startOutgoingCall(
                connection
            );
        }
    );
}


function startOutgoingCall(
    connection
) {

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

    if (
        !connection ||
        !connection.peer
    ) {
        return;
    }

    if (
        connection._voiceCall
    ) {
        return;
    }

    try {

        const call =
            peer.call(
                connection.peer,
                localStream,
                {
                    metadata: {
                        voice: true
                    }
                }
            );

        connection._voiceCall =
            call;

        call.on("stream", stream => {

            playRemoteStream(
                connection.peer,
                stream
            );
        });

        call.on("close", () => {

            connection._voiceCall =
                null;
        });

        call.on("error", () => {

            connection._voiceCall =
                null;
        });

    } catch {

        connection._voiceCall =
            null;
    }
}


/* =========================================================
   VOZ - ENTRADA
   ========================================================= */

function answerIncomingCall(call) {

    if (!call) {
        return;
    }

    /*
       Mesmo com nosso microfone desligado,
       continuamos respondendo SEM enviar nosso áudio.
       Assim ainda conseguimos ouvir a outra pessoa.
    */

    const shouldSendAudio =
        microphoneEnabled &&
        localStream &&
        (
            !gameStarted ||
            gameVoiceEnabled
        );

    try {

        if (shouldSendAudio) {

            call.answer(
                localStream
            );

        } else {

            call.answer();
        }

    } catch {

        try {
            call.answer();
        } catch {}
    }

    call.on("stream", stream => {

        playRemoteStream(
            call.peer,
            stream
        );
    });

    call.on("close", () => {

        removeRemoteAudio(
            call.peer
        );
    });

    call.on("error", () => {

        removeRemoteAudio(
            call.peer
        );
    });
}


function playRemoteStream(
    peerId,
    stream
) {

    let audio =
        document.getElementById(
            `audio-${peerId}`
        );

    if (!audio) {

        audio =
            document.createElement(
                "audio"
            );

        audio.id =
            `audio-${peerId}`;

        audio.autoplay = true;
        audio.playsInline = true;

        audio.style.display =
            "none";

        remoteAudios.appendChild(
            audio
        );
    }

    audio.srcObject =
        stream;

    audio.muted = false;

    audio.play().catch(() => {});
}


function removeRemoteAudio(
    peerId
) {

    const audio =
        document.getElementById(
            `audio-${peerId}`
        );

    if (audio) {

        try {
            audio.pause();
        } catch {}

        audio.srcObject = null;

        audio.remove();
    }
}


/* =========================================================
   VOZ DA PARTIDA
   ========================================================= */

function createGameVoiceButton() {

    if (gameVoiceButton) {
        return;
    }

    const actions =
        document.querySelector(
            ".game-actions"
        );

    if (!actions) {
        return;
    }

    gameVoiceButton =
        document.createElement(
            "button"
        );

    gameVoiceButton.id =
        "gameVoiceButton";

    gameVoiceButton.type =
        "button";

    gameVoiceButton.textContent =
        "Voz: OFF";

    gameVoiceButton.onclick =
        toggleGameVoice;

    actions.appendChild(
        gameVoiceButton
    );

    updateGameVoiceButton();
}


function updateGameVoiceButton() {

    if (!gameVoiceButton) {
        return;
    }

    gameVoiceButton.textContent =
        gameVoiceEnabled
            ? "Voz: ON"
            : "Voz: OFF";
}


async function toggleGameVoice() {

    if (!gameStarted) {
        return;
    }

    gameVoiceEnabled =
        !gameVoiceEnabled;

    updateGameVoiceButton();

    if (
        gameVoiceEnabled &&
        !localStream
    ) {

        await enableMicrophone();

        if (!microphoneEnabled) {

            gameVoiceEnabled =
                false;

            updateGameVoiceButton();

            return;
        }
    }

    if (gameVoiceEnabled) {

        microphoneEnabled = true;

        updateMicUI();

        await refreshOutgoingVoice();

    } else {

        /*
           Desliga apenas nossa transmissão.
           Continuamos ouvindo os outros.
        */

        closeOutgoingCalls();
    }
}


/* =========================================================
   GAME
   ========================================================= */

function showGame() {

    showOnly(game);

    gameStarted = true;

    /*
       REGRA:
       ao entrar na partida, voz começa OFF.
    */

    gameVoiceEnabled = false;

    createGameVoiceButton();

    updateGameVoiceButton();

    if (roundText) {

        roundText.textContent =
            `Rodada ${currentRound}`;
    }

    if (gamePlayers) {

        const count =
            getPlayersArray().length;

        gamePlayers.textContent =
            `${count}/5`;
    }
}


/* =========================================================
   COMEÇAR PARTIDA
   ========================================================= */

async function startGame() {

    if (!isHost) {
        return;
    }

    const players =
        getPlayersArray();

    if (players.length < 1) {
        return;
    }

    gameStarted = true;

    currentRound = 1;

    gameVoiceEnabled = false;

    broadcast({
        type: "game-start",
        round: 1
    });

    showGame();

    await wait(500);

    startRound();
}


/* =========================================================
   RODADA
   ========================================================= */

async function startRound() {

    clearRecordingState();

    gameStarted = true;

    gameVoiceEnabled = false;

    updateGameVoiceButton();

    if (roundText) {

        roundText.textContent =
            `Rodada ${currentRound}`;
    }

    hideGameScreens();

    await countdown();

    chooseReferenceSound();

    if (isHost) {

        broadcast({
            type: "reference",
            round: currentRound,
            sound: currentSound
        });
    }

    showReferenceScreen();
}


/* =========================================================
   CONTAGEM
   ========================================================= */

async function countdown() {

    hideGameScreens();

    countdownScreen.classList.remove(
        "hidden"
    );

    for (
        let i = 3;
        i >= 1;
        i--
    ) {

        countdownNumber.textContent =
            i;

        await wait(1000);
    }

    countdownScreen.classList.add(
        "hidden"
    );
}


/* =========================================================
   ESCOLHER SOM
   ========================================================= */

function chooseReferenceSound() {

    currentSound =
        SOUND_LIBRARY[
            Math.floor(
                Math.random() *
                SOUND_LIBRARY.length
            )
        ];
}


/* =========================================================
   REFERÊNCIA
   ========================================================= */

function showReferenceScreen() {

    hideGameScreens();

    referenceScreen.classList.remove(
        "hidden"
    );

    referencePlayed = false;

    if (referenceButton) {

        referenceButton.disabled =
            false;

        referenceButton.textContent =
            "Reproduzir som";
    }
}


function playReferenceSound() {

    if (!currentSound) {
        return;
    }

    referencePlayed = true;

    if (referenceButton) {

        referenceButton.disabled =
            true;

        referenceButton.textContent =
            "Som reproduzido";
    }

    playGeneratedSound(
        currentSound
    );

    if (isHost) {

        setTimeout(() => {

            broadcast({
                type: "record-start",
                round: currentRound,
                sound: currentSound
            });

            startRecordingPhase();

        }, 1800);
    }
}


/* =========================================================
   GERAR SOM DE REFERÊNCIA
   ========================================================= */

function playGeneratedSound(sound) {

    const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;

    if (!AudioContext) {
        return;
    }

    const ctx =
        new AudioContext();

    const oscillator =
        ctx.createOscillator();

    const gain =
        ctx.createGain();

    oscillator.type =
        "sine";

    oscillator.frequency.value =
        sound.frequency || 500;

    gain.gain.setValueAtTime(
        0.0001,
        ctx.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
        0.4,
        ctx.currentTime + 0.05
    );

    gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + 0.8
    );

    oscillator.connect(gain);

    gain.connect(
        ctx.destination
    );

    oscillator.start();

    oscillator.stop(
        ctx.currentTime + 0.85
    );

    oscillator.onended = () => {

        try {
            ctx.close();
        } catch {}
    };
}


/* =========================================================
   GRAVAÇÃO
   ========================================================= */

async function startRecordingPhase() {

    hideGameScreens();

    recordScreen.classList.remove(
        "hidden"
    );

    recording = false;

    recordStatus.textContent =
        "Preparando...";

    recordTimerElement.textContent =
        "3";

    await wait(1000);

    recordTimerElement.textContent =
        "2";

    await wait(1000);

    recordTimerElement.textContent =
        "1";

    await wait(1000);

    recordTimerElement.textContent =
        "5";

    startRecording();
}


async function startRecording() {

    /*
       Durante a gravação ninguém transmite voz.
       Isso evita os jogadores se ouvirem.
    */

    const previousVoice =
        gameVoiceEnabled;

    gameVoiceEnabled = false;

    closeOutgoingCalls();

    recording = true;

    recordSeconds = 5;

    recordStatus.textContent =
        "Gravando...";

    if (!localStream) {

        try {

            await enableMicrophone();

        } catch {}
    }

    if (
        localStream &&
        microphoneEnabled
    ) {

        createMediaRecorder();

    } else {

        finishRecording();

        return;
    }

    clearInterval(
        recordTimer
    );

    recordTimer =
        setInterval(() => {

            recordSeconds--;

            recordTimerElement.textContent =
                recordSeconds;

            if (
                recordSeconds <= 0
            ) {

                clearInterval(
                    recordTimer
                );

                recordTimer = null;

                finishRecording();
            }

        }, 1000);
}


function createMediaRecorder() {

    recordedChunks = [];

    let options = {};

    if (
        MediaRecorder.isTypeSupported(
            "audio/webm;codecs=opus"
        )
    ) {

        options.mimeType =
            "audio/webm;codecs=opus";

    } else if (
        MediaRecorder.isTypeSupported(
            "audio/webm"
        )
    ) {

        options.mimeType =
            "audio/webm";
    }

    try {

        mediaRecorder =
            new MediaRecorder(
                localStream,
                options
            );

    } catch {

        mediaRecorder =
            new MediaRecorder(
                localStream
            );
    }

    mediaRecorder.ondataavailable =
        event => {

            if (
                event.data &&
                event.data.size > 0
            ) {

                recordedChunks.push(
                    event.data
                );
            }
        };

    mediaRecorder.onstop =
        async () => {

            const blob =
                new Blob(
                    recordedChunks,
                    {
                        type:
                            mediaRecorder.mimeType ||
                            "audio/webm"
                    }
                );

            myRecording =
                blob;

            await sendRecordingToHost();
        };

    mediaRecorder.start();
}


function finishRecording() {

    if (!recording) {
        return;
    }

    recording = false;

    clearInterval(
        recordTimer
    );

    recordTimer = null;

    recordTimerElement.textContent =
        "0";

    recordStatus.textContent =
        "Gravação concluída";

    if (
        mediaRecorder &&
        mediaRecorder.state !== "inactive"
    ) {

        try {
            mediaRecorder.stop();
        } catch {}
    } else {

        sendRecordingToHost();
    }
}


/* =========================================================
   ENVIAR GRAVAÇÃO
   ========================================================= */

async function sendRecordingToHost() {

    if (isHost) {

        roundRecordings.set(
            peerId,
            {
                peerId,
                username,
                blob: myRecording
            }
        );

        checkRecordings();

        return;
    }

    /*
       Blob não pode ser enviado diretamente
       de forma confiável pelo DataConnection.
       Transformamos em ArrayBuffer.
    */

    if (!myRecording) {
        return;
    }

    try {

        const buffer =
            await myRecording.arrayBuffer();

        const connection =
            [...connections.values()][0];

        if (!connection) {
            return;
        }

        sendToConnection(
            connection,
            {
                type: "recording",
                peerId,
                username,
                buffer
            }
        );

    } catch (error) {

        console.error(error);
    }
}


/* =========================================================
   RECEBER GRAVAÇÃO
   ========================================================= */

function receiveRecording(data) {

    if (!isHost) {
        return;
    }

    let blob = null;

    try {

        blob =
            new Blob(
                [data.buffer],
                {
                    type:
                        "audio/webm"
                }
            );

    } catch {

        return;
    }

    roundRecordings.set(
        data.peerId,
        {
            peerId:
                data.peerId,
            username:
                data.username,
            blob
        }
    );

    checkRecordings();
}


/* =========================================================
   CHECAR GRAVAÇÕES
   ========================================================= */

function checkRecordings() {

    if (!isHost) {
        return;
    }

    const players =
        getPlayersArray();

    /*
       Esperamos todos os jogadores.
    */

    if (
        roundRecordings.size <
        players.length
    ) {

        return;
    }

    startPlayback();
}


/* =========================================================
   PLAYBACK
   ========================================================= */

async function startPlayback() {

    if (!isHost) {
        return;
    }

    const recordings =
        [...roundRecordings.values()];

    for (
        const recording of recordings
    ) {

        broadcast({
            type: "playback",
            peerId:
                recording.peerId,
            username:
                recording.username,
            buffer:
                await blobToArrayBuffer(
                    recording.blob
                )
        });

        await wait(1000);

        await playBlobLocally(
            recording.blob
        );

        await wait(4500);
    }

    calculateRoundScores();
}


function blobToArrayBuffer(blob) {

    return blob.arrayBuffer();
}


function playRemoteRecording(
    data
) {

    try {

        const blob =
            new Blob(
                [data.buffer],
                {
                    type:
                        "audio/webm"
                }
            );

        playBlobLocally(
            blob
        );

    } catch {}
}


function playBlobLocally(blob) {

    return new Promise(
        resolve => {

            const url =
                URL.createObjectURL(
                    blob
                );

            const audio =
                new Audio(url);

            audio.volume = 1;

            audio.onended = () => {

                URL.revokeObjectURL(
                    url
                );

                resolve();
            };

            audio.onerror = () => {

                URL.revokeObjectURL(
                    url
                );

                resolve();
            };

            audio.play()
                .catch(() => {
                    resolve();
                });
        }
    );
}


/* =========================================================
   SCORE
   ========================================================= */

/*
   IMPORTANTE:
   O navegador não consegue fazer uma comparação
   profissional de melodia como o Mimic Party apenas
   com este código.

   Portanto NÃO damos uma pontuação alta
   simplesmente porque o jogador ficou em silêncio.

   Silêncio = pontuação muito baixa.
*/

async function calculateRoundScores() {

    if (!isHost) {
        return;
    }

    roundScores.clear();

    for (
        const recording of
        roundRecordings.values()
    ) {

        const score =
            await analyzeRecording(
                recording.blob
            );

        roundScores.set(
            recording.peerId,
            score
        );
    }

    broadcast({
        type: "result",
        scores:
            Object.fromEntries(
                roundScores
            ),
        round:
            currentRound
    });

    showRoundResult({
        scores:
            Object.fromEntries(
                roundScores
            ),
        round:
            currentRound
    });
}


async function analyzeRecording(blob) {

    try {

        const arrayBuffer =
            await blob.arrayBuffer();

        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;

        const ctx =
            new AudioContext();

        const audioBuffer =
            await ctx.decodeAudioData(
                arrayBuffer.slice(0)
            );

        const data =
            audioBuffer.getChannelData(0);

        let sum = 0;

        let peak = 0;

        const step =
            Math.max(
                1,
                Math.floor(
                    data.length / 10000
                )
            );

        let samples = 0;

        for (
            let i = 0;
            i < data.length;
            i += step
        ) {

            const value =
                Math.abs(data[i]);

            sum += value;

            peak =
                Math.max(
                    peak,
                    value
                );

            samples++;
        }

        const average =
            sum /
            Math.max(
                1,
                samples
            );

        /*
           Silêncio real:
           pontuação baixa.
        */

        if (
            average < 0.005 ||
            peak < 0.03
        ) {

            try {
                ctx.close();
            } catch {}

            return 0;
        }

        /*
           Aqui usamos presença de áudio
           apenas como filtro básico.
        */

        let score =
            Math.round(
                Math.min(
                    45,
                    average * 180
                )
            );

        score +=
            Math.round(
                Math.min(
                    25,
                    peak * 20
                )
            );

        score =
            Math.max(
                1,
                Math.min(
                    70,
                    score
                )
            );

        try {
            ctx.close();
        } catch {}

        return score;

    } catch {

        return 0;
    }
}


/* =========================================================
   RESULTADO
   ========================================================= */

function showRoundResult(data) {

    hideGameScreens();

    resultScreen.classList.remove(
        "hidden"
    );

    const scores =
        data.scores || {};

    const myScore =
        Number(
            scores[peerId] || 0
        );

    if (resultText) {

        resultText.textContent =
            `Sua pontuação: ${myScore}/100`;
    }

    /*
       O host controla a próxima rodada.
    */

    if (
        isHost &&
        currentRound <
        TOTAL_ROUNDS
    ) {

        setTimeout(() => {

            currentRound++;

            roundRecordings.clear();

            roundScores.clear();

            broadcast({
                type: "next-round",
                round:
                    currentRound
            });

            startRound();

        }, 4000);

    } else if (
        isHost &&
        currentRound >= TOTAL_ROUNDS
    ) {

        setTimeout(() => {

            const finalScores =
                Object.fromEntries(
                    roundScores
                );

            broadcast({
                type: "game-end",
                scores:
                    finalScores
            });

            showFinalResult({
                scores:
                    finalScores
            });

        }, 4000);
    }
}


/* =========================================================
   FINAL
   ========================================================= */

function showFinalResult(data) {

    hideGameScreens();

    resultScreen.classList.remove(
        "hidden"
    );

    const scores =
        data.scores || {};

    const myScore =
        Number(
            scores[peerId] || 0
        );

    if (resultText) {

        resultText.textContent =
            `Partida encerrada. Sua pontuação: ${myScore}`;
    }

    gameStarted = false;

    gameVoiceEnabled = false;

    closeOutgoingCalls();

    updateGameVoiceButton();
}


/* =========================================================
   TELAS
   ========================================================= */

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


/* =========================================================
   LIMPAR GRAVAÇÃO
   ========================================================= */

function clearRecordingState() {

    clearInterval(
        recordTimer
    );

    recordTimer = null;

    recording = false;

    recordedChunks = [];

    myRecording = null;

    roundRecordings.clear();
}


/* =========================================================
   SAIR DA SALA
   ========================================================= */

function leaveRoom() {

    clearInterval(
        heartbeatTimer
    );

    heartbeatTimer = null;

    clearInterval(
        recordTimer
    );

    recordTimer = null;

    closeOutgoingCalls();

    connections.forEach(
        connection => {

            try {
                connection.close();
            } catch {}
        }
    );

    connections.clear();

    if (peer) {

        try {
            peer.destroy();
        } catch {}

        peer = null;
    }

    peerId = "";

    roomCode = "";

    isHost = false;

    gameStarted = false;

    gameVoiceEnabled = false;

    microphoneEnabled = false;

    playerStates.clear();

    roundRecordings.clear();

    roundScores.clear();

    if (gameVoiceButton) {

        gameVoiceButton.remove();

        gameVoiceButton = null;
    }

    showOnly(home);
}


/* =========================================================
   COPIAR CÓDIGO
   ========================================================= */

async function copyRoomCode() {

    if (!roomCode) {
        return;
    }

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

    } catch {

        prompt(
            "Copie o código:",
            roomCode
        );
    }
}


/* =========================================================
   EVENTOS
   ========================================================= */

loginButton.onclick = () => {

    loginUser();
};


usernameInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter"
        ) {

            loginUser();
        }
    }
);


createButton.onclick = () => {

    createRoom();
};


joinButton.onclick = () => {

    joinRoom();
};


logoutButton.onclick = () => {

    logoutUser();
};


copyCodeButton.onclick = () => {

    copyRoomCode();
};


micButton.onclick = async () => {

    if (microphoneEnabled) {

        disableMicrophone();

    } else {

        await enableMicrophone();
    }
};


startButton.onclick = () => {

    startGame();
};


leaveRoomButton.onclick = () => {

    leaveRoom();
};


referenceButton.onclick = () => {

    playReferenceSound();
};


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

function initialize() {

    /*
       NÃO existe nenhuma operação de PeerJS
       antes do usuário clicar em Entrar.
    */

    const saved =
        localStorage.getItem(
            "shadow_games_username"
        );

    if (saved) {

        username =
            saved.slice(0, 16);

        updateProfile();

        showOnly(home);

    } else {

        showOnly(login);
    }

    updateMicUI();
}


initialize();
