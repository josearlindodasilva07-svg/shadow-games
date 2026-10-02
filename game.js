"use strict";

document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       ELEMENTOS
       ===================================================== */

    const $ = id => document.getElementById(id);

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


    /* =====================================================
       ESTADO
       ===================================================== */

    let username = "";

    let peer = null;
    let peerId = "";

    let roomCode = "";
    let isHost = false;

    const connections = new Map();

    let localStream = null;
    let microphoneEnabled = false;

    /*
       A voz da partida começa SEMPRE desligada.
    */
    let gameVoiceEnabled = false;

    let gameStarted = false;

    let currentRound = 1;

    const TOTAL_ROUNDS = 4;

    let currentSound = null;

    let recordTimer = null;

    let recordSeconds = 5;

    let mediaRecorder = null;

    let recordedChunks = [];

    let myRecording = null;

    let recording = false;

    const roundRecordings = new Map();

    const roundScores = new Map();

    let heartbeatTimer = null;

    let gameVoiceButton = null;

    let incomingVoiceMuted = false;

    let joining = false;


    /* =====================================================
       SONS
       ===================================================== */

    const SOUND_LIBRARY = [
        {
            name: "Gato",
            frequency: 520
        },
        {
            name: "Cachorro",
            frequency: 390
        },
        {
            name: "Campainha",
            frequency: 740
        },
        {
            name: "Alarme",
            frequency: 610
        },
        {
            name: "Robô",
            frequency: 280
        },
        {
            name: "Bip",
            frequency: 850
        }
    ];


    /* =====================================================
       UTILIDADES
       ===================================================== */

    function showOnly(section) {

        if (!section) return;

        login?.classList.add("hidden");
        home?.classList.add("hidden");
        room?.classList.add("hidden");
        game?.classList.add("hidden");

        section.classList.remove("hidden");
    }


    function wait(ms) {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    }


    function randomCode(length = 6) {

        const chars =
            "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

        let result = "";

        for (let i = 0; i < length; i++) {

            result +=
                chars[
                    Math.floor(
                        Math.random() * chars.length
                    )
                ];
        }

        return result;
    }


    function normalizeCode(value) {

        return String(value || "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "")
            .slice(0, 6);
    }


    function setStatus(text) {

        if (statusElement) {
            statusElement.textContent = text;
        }
    }


    function updateProfile() {

        if (profileName) {
            profileName.textContent =
                username || "-";
        }

        if (profileAvatar) {

            profileAvatar.textContent =
                username
                    ? username.charAt(0).toUpperCase()
                    : "?";
        }
    }


    function getHostPeerId() {

        return "shadow-room-" + roomCode;
    }


    /* =====================================================
       LOGIN
       ===================================================== */

    function loginUser() {

        const name =
            usernameInput?.value
                .trim()
                .slice(0, 16);

        if (!name) {

            usernameInput?.focus();

            return;
        }

        username = name;

        localStorage.setItem(
            "shadow_games_username",
            username
        );

        updateProfile();

        showOnly(home);
    }


    function logoutUser() {

        leaveRoom();

        username = "";

        localStorage.removeItem(
            "shadow_games_username"
        );

        if (usernameInput) {
            usernameInput.value = "";
        }

        showOnly(login);
    }


    /* =====================================================
       PEER HOST
       ===================================================== */

    function createHostPeer() {

        return new Promise(
            (resolve, reject) => {

                if (typeof Peer === "undefined") {

                    reject(
                        new Error(
                            "PeerJS não carregou."
                        )
                    );

                    return;
                }

                if (peer) {

                    try {
                        peer.destroy();
                    } catch {}

                    peer = null;
                }

                const id =
                    getHostPeerId();

                peer = new Peer(id);

                peer.on("open", id => {

                    peerId = id;

                    resolve(id);
                });


                peer.on("connection", connection => {

                    setupDataConnection(
                        connection
                    );
                });


                peer.on("call", call => {

                    answerIncomingCall(
                        call
                    );
                });


                peer.on("disconnected", () => {

                    try {
                        peer.reconnect();
                    } catch {}
                });


                peer.on("error", error => {

                    console.error(
                        "PeerJS:",
                        error
                    );

                    if (!isHost) {

                        setStatus(
                            "Erro ao conectar"
                        );
                    }
                });
            }
        );
    }


    /* =====================================================
       PEER CLIENTE
       ===================================================== */

    function createClientPeer() {

        return new Promise(
            (resolve, reject) => {

                if (typeof Peer === "undefined") {

                    reject(
                        new Error(
                            "PeerJS não carregou."
                        )
                    );

                    return;
                }

                if (peer) {

                    try {
                        peer.destroy();
                    } catch {}

                    peer = null;
                }

                /*
                   O jogador recebe um ID próprio.
                */

                const id =
                    "shadow-player-" +
                    randomCode(10);

                peer = new Peer(id);

                peer.on("open", id => {

                    peerId = id;

                    resolve(id);
                });


                peer.on("connection", connection => {

                    setupDataConnection(
                        connection
                    );
                });


                peer.on("call", call => {

                    answerIncomingCall(
                        call
                    );
                });


                peer.on("disconnected", () => {

                    try {
                        peer.reconnect();
                    } catch {}
                });


                peer.on("error", error => {

                    console.error(
                        "PeerJS:",
                        error
                    );
                });
            }
        );
    }


    /* =====================================================
       CRIAR SALA
       ===================================================== */

    async function createRoom() {

        if (joining) return;

        joining = true;

        try {

            roomCode =
                randomCode(6);

            isHost = true;

            setStatus(
                "Criando sala..."
            );

            await createHostPeer();

            showRoom();

            setStatus(
                "Sala criada. Compartilhe o código."
            );

            updatePlayers();

            startHeartbeat();

        } catch (error) {

            console.error(error);

            roomCode = "";
            isHost = false;

            alert(
                "Não foi possível criar a sala."
            );

        } finally {

            joining = false;
        }
    }


    /* =====================================================
       ENTRAR NA SALA
       ===================================================== */

    async function joinRoom() {

        if (joining) return;

        const input =
            prompt(
                "Digite o código da sala:"
            );

        const code =
            normalizeCode(input);

        if (code.length !== 6) {

            alert(
                "Código inválido."
            );

            return;
        }

        joining = true;

        try {

            roomCode = code;

            isHost = false;

            setStatus(
                "Conectando..."
            );

            await createClientPeer();

            showRoom();

            connectToHost();

            startHeartbeat();

        } catch (error) {

            console.error(error);

            alert(
                "Não foi possível entrar na sala."
            );

            roomCode = "";

        } finally {

            joining = false;
        }
    }


    /* =====================================================
       MOSTRAR SALA
       ===================================================== */

    function showRoom() {

        showOnly(room);

        if (roomCodeElement) {

            roomCodeElement.textContent =
                roomCode;
        }

        if (startButton) {

            startButton.style.display =
                isHost
                    ? "block"
                    : "none";
        }

        updatePlayers();

        updateMicUI();
    }


    /* =====================================================
       CONECTAR AO HOST
       ===================================================== */

    function connectToHost() {

        if (!peer) return;

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


    /* =====================================================
       DATA CONNECTION
       ===================================================== */

    function setupDataConnection(connection) {

        if (!connection) return;

        connection.on("open", () => {

            connections.set(
                connection.peer,
                connection
            );

            sendToConnection(
                connection,
                {
                    type: "hello",
                    peerId,
                    username
                }
            );

            if (isHost) {

                broadcastPlayers();
            }

            updatePlayers();

            setStatus(
                isHost
                    ? "Sala pronta"
                    : "Conectado à sala"
            );

            refreshOutgoingVoice();
        });


        connection.on("data", data => {

            handleNetworkMessage(
                connection,
                data
            );
        });


        connection.on("close", () => {

            connections.delete(
                connection.peer
            );

            removeRemoteAudio(
                connection.peer
            );

            updatePlayers();
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
            !connection ||
            !connection.open
        ) {
            return;
        }

        try {
            connection.send(data);
        } catch {}
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


    /* =====================================================
       MENSAGENS
       ===================================================== */

    function handleNetworkMessage(
        connection,
        data
    ) {

        if (!data || !data.type) {
            return;
        }

        switch (data.type) {

            case "hello":

                if (isHost) {

                    playerStates.set(
                        data.peerId,
                        {
                            peerId:
                                data.peerId,
                            username:
                                data.username ||
                                "Jogador",
                            host: false
                        }
                    );

                    broadcastPlayers();
                }

                break;


            case "players":

                playerStates.clear();

                for (
                    const player of
                    data.players || []
                ) {

                    if (
                        player.peerId !== peerId
                    ) {

                        playerStates.set(
                            player.peerId,
                            player
                        );
                    }
                }

                updatePlayers();

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

                currentRound =
                    data.round || 1;

                currentSound =
                    data.sound;

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

                muteIncomingVoice(true);

                playRemoteRecording(
                    data
                ).then(() => {

                    muteIncomingVoice(false);
                });

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


    /* =====================================================
       PLAYERS
       ===================================================== */

    const playerStates =
        new Map();


    function getPlayersArray() {

        const players = [];

        if (peerId) {

            players.push({
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

                    players.push(player);
                }
            }
        );

        return players;
    }


    function updatePlayers() {

        if (!playersElement) {
            return;
        }

        const players =
            getPlayersArray();

        playersElement.innerHTML = "";

        players.forEach(
            player => {

                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "player-item";

                const name =
                    document.createElement(
                        "span"
                    );

                name.textContent =
                    player.peerId === peerId
                        ? `${player.username} (Você)`
                        : player.username;

                item.appendChild(name);

                if (player.host) {

                    const host =
                        document.createElement(
                            "small"
                        );

                    host.textContent =
                        "HOST";

                    item.appendChild(host);
                }

                playersElement.appendChild(
                    item
                );
            }
        );

        if (gamePlayers) {

            gamePlayers.textContent =
                `${players.length}/5`;
        }
    }


    function broadcastPlayers() {

        if (!isHost) return;

        broadcast({
            type: "players",
            players:
                getPlayersArray()
        });

        updatePlayers();
    }


    /* =====================================================
       HEARTBEAT
       ===================================================== */

    function startHeartbeat() {

        clearInterval(
            heartbeatTimer
        );

        heartbeatTimer =
            setInterval(() => {

                if (isHost) {

                    broadcastPlayers();
                }

            }, 3000);
    }


    /* =====================================================
       MICROFONE
       ===================================================== */

    async function enableMicrophone() {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            alert(
                "Seu navegador não suporta microfone."
            );

            return false;
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

            localStream
                .getAudioTracks()
                .forEach(track => {

                    track.enabled = true;
                });

            microphoneEnabled = true;

            updateMicUI();

            await refreshOutgoingVoice();

            return true;

        } catch (error) {

            console.error(error);

            microphoneEnabled = false;

            updateMicUI();

            alert(
                "Não foi possível acessar o microfone."
            );

            return false;
        }
    }


    function disableMicrophone() {

        microphoneEnabled = false;

        closeOutgoingCalls();

        updateMicUI();
    }


    function updateMicUI() {

        if (!micButton) return;

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


    /* =====================================================
       VOZ
       ===================================================== */

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
           Durante a partida:
           OFF = não transmite.
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

            call.on(
                "stream",
                stream => {

                    playRemoteStream(
                        connection.peer,
                        stream
                    );
                }
            );

            call.on(
                "close",
                () => {

                    connection._voiceCall =
                        null;
                }
            );

            call.on(
                "error",
                () => {

                    connection._voiceCall =
                        null;
                }
            );

        } catch {

            connection._voiceCall =
                null;
        }
    }


    function answerIncomingCall(call) {

        if (!call) return;

        const sendAudio =
            microphoneEnabled &&
            localStream &&
            (
                !gameStarted ||
                gameVoiceEnabled
            );

        try {

            if (sendAudio) {

                call.answer(
                    localStream
                );

            } else {

                /*
                   Recebe voz sem enviar a própria.
                */

                call.answer();
            }

        } catch {

            try {
                call.answer();
            } catch {}
        }


        call.on(
            "stream",
            stream => {

                playRemoteStream(
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
            }
        );


        call.on(
            "error",
            () => {

                removeRemoteAudio(
                    call.peer
                );
            }
        );
    }


    function playRemoteStream(
        id,
        stream
    ) {

        let audio =
            document.getElementById(
                `audio-${id}`
            );

        if (!audio) {

            audio =
                document.createElement(
                    "audio"
                );

            audio.id =
                `audio-${id}`;

            audio.autoplay = true;
            audio.playsInline = true;

            audio.style.display =
                "none";

            remoteAudios?.appendChild(
                audio
            );
        }

        audio.srcObject =
            stream;

        audio.volume =
            incomingVoiceMuted
                ? 0
                : 1;

        audio.play().catch(() => {});
    }


    function removeRemoteAudio(id) {

        const audio =
            document.getElementById(
                `audio-${id}`
            );

        if (audio) {

            try {
                audio.pause();
            } catch {}

            audio.srcObject = null;

            audio.remove();
        }
    }


    function muteIncomingVoice(muted) {

        incomingVoiceMuted =
            muted;

        if (!remoteAudios) return;

        remoteAudios
            .querySelectorAll("audio")
            .forEach(audio => {

                audio.volume =
                    muted ? 0 : 1;
            });
    }


    /* =====================================================
       VOZ NA PARTIDA
       ===================================================== */

    function createGameVoiceButton() {

        if (gameVoiceButton) {
            return;
        }

        const actions =
            document.querySelector(
                ".game-actions"
            );

        if (!actions) return;

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

        if (!gameVoiceButton) return;

        gameVoiceButton.textContent =
            gameVoiceEnabled
                ? "Voz: ON"
                : "Voz: OFF";
    }


    async function toggleGameVoice() {

        if (!gameStarted) {
            return;
        }

        if (!gameVoiceEnabled) {

            if (!localStream) {

                const ok =
                    await enableMicrophone();

                if (!ok) {
                    return;
                }
            }

            microphoneEnabled = true;

            gameVoiceEnabled = true;

            updateMicUI();

            updateGameVoiceButton();

            await refreshOutgoingVoice();

        } else {

            /*
               OFF só desliga nossa transmissão.
               Continuamos ouvindo os outros.
            */

            gameVoiceEnabled = false;

            closeOutgoingCalls();

            updateGameVoiceButton();
        }
    }


    /* =====================================================
       GAME
       ===================================================== */

    function showGame() {

        showOnly(game);

        gameStarted = true;

        /*
           Sempre começa OFF.
        */

        gameVoiceEnabled = false;

        createGameVoiceButton();

        updateGameVoiceButton();

        if (roundText) {

            roundText.textContent =
                `Rodada ${currentRound}`;
        }

        updatePlayers();
    }


    /* =====================================================
       COMEÇAR
       ===================================================== */

    async function startGame() {

        if (!isHost) {
            return;
        }

        gameStarted = true;

        currentRound = 1;

        gameVoiceEnabled = false;

        closeOutgoingCalls();

        broadcast({
            type: "game-start",
            round: 1
        });

        showGame();

        await wait(700);

        startRound();
    }


    /* =====================================================
       RODADA
       ===================================================== */

    async function startRound() {

        clearRecordingState();

        gameStarted = true;

        gameVoiceEnabled = false;

        closeOutgoingCalls();

        muteIncomingVoice(false);

        updateGameVoiceButton();

        if (roundText) {

            roundText.textContent =
                `Rodada ${currentRound}`;
        }

        hideGameScreens();

        await countdown();

        currentSound =
            SOUND_LIBRARY[
                Math.floor(
                    Math.random() *
                    SOUND_LIBRARY.length
                )
            ];

        if (isHost) {

            broadcast({
                type: "reference",
                round:
                    currentRound,
                sound:
                    currentSound
            });
        }

        showReferenceScreen();
    }


    /* =====================================================
       CONTAGEM
       ===================================================== */

    async function countdown() {

        hideGameScreens();

        countdownScreen?.classList.remove(
            "hidden"
        );

        for (
            let i = 3;
            i >= 1;
            i--
        ) {

            if (countdownNumber) {

                countdownNumber.textContent =
                    i;
            }

            await wait(1000);
        }

        countdownScreen?.classList.add(
            "hidden"
        );
    }


    /* =====================================================
       REFERÊNCIA
       ===================================================== */

    function showReferenceScreen() {

        hideGameScreens();

        referenceScreen?.classList.remove(
            "hidden"
        );

        if (referenceButton) {

            referenceButton.disabled =
                false;

            referenceButton.textContent =
                "Reproduzir som";
        }
    }


    function playReferenceSound() {

        if (!currentSound) return;

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
                    round:
                        currentRound,
                    sound:
                        currentSound
                });

                startRecordingPhase();

            }, 1200);
        }
    }


    function playGeneratedSound(sound) {

        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContext) return;

        const context =
            new AudioContext();

        const oscillator =
            context.createOscillator();

        const gain =
            context.createGain();

        oscillator.type =
            "sine";

        oscillator.frequency.value =
            sound.frequency;

        gain.gain.setValueAtTime(
            0.0001,
            context.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
            0.35,
            context.currentTime + 0.05
        );

        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            context.currentTime + 0.8
        );

        oscillator.connect(gain);

        gain.connect(
            context.destination
        );

        oscillator.start();

        oscillator.stop(
            context.currentTime + 0.85
        );

        oscillator.onended = () => {

            try {
                context.close();
            } catch {}
        };
    }


    /* =====================================================
       GRAVAÇÃO
       ===================================================== */

    async function startRecordingPhase() {

        hideGameScreens();

        recordScreen?.classList.remove(
            "hidden"
        );

        muteIncomingVoice(true);

        closeOutgoingCalls();

        if (recordStatus) {

            recordStatus.textContent =
                "Preparando...";
        }

        if (recordTimerElement) {

            recordTimerElement.textContent =
                "3";
        }

        await wait(1000);

        if (recordTimerElement) {

            recordTimerElement.textContent =
                "2";
        }

        await wait(1000);

        if (recordTimerElement) {

            recordTimerElement.textContent =
                "1";
        }

        await wait(1000);

        startRecording();
    }


    async function startRecording() {

        recording = true;

        recordSeconds = 5;

        if (recordStatus) {

            recordStatus.textContent =
                "Gravando...";
        }

        if (recordTimerElement) {

            recordTimerElement.textContent =
                "5";
        }

        /*
           Se não houver microfone,
           tenta pedir permissão.
        */

        if (!localStream) {

            await enableMicrophone();
        }

        if (
            !localStream ||
            !microphoneEnabled
        ) {

            recording = false;

            if (recordStatus) {

                recordStatus.textContent =
                    "Microfone não disponível";
            }

            await wait(1000);

            finishRecording();

            return;
        }

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


        clearInterval(
            recordTimer
        );

        recordTimer =
            setInterval(() => {

                recordSeconds--;

                if (recordTimerElement) {

                    recordTimerElement.textContent =
                        recordSeconds;
                }

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


    function finishRecording() {

        if (
            !recording &&
            (!mediaRecorder ||
             mediaRecorder.state === "inactive")
        ) {
            return;
        }

        recording = false;

        clearInterval(
            recordTimer
        );

        recordTimer = null;

        if (recordTimerElement) {

            recordTimerElement.textContent =
                "0";
        }

        if (recordStatus) {

            recordStatus.textContent =
                "Gravação concluída";
        }

        if (
            mediaRecorder &&
            mediaRecorder.state !== "inactive"
        ) {

            try {
                mediaRecorder.stop();
            } catch {}
        }
    }


    /* =====================================================
       ENVIAR GRAVAÇÃO
       ===================================================== */

    async function sendRecordingToHost() {

        if (!myRecording) {

            if (isHost) {
                checkRecordings();
            }

            return;
        }

        if (isHost) {

            roundRecordings.set(
                peerId,
                {
                    peerId,
                    username,
                    blob:
                        myRecording
                }
            );

            checkRecordings();

            return;
        }


        const hostConnection =
            [...connections.values()][0];

        if (!hostConnection) {
            return;
        }

        try {

            const buffer =
                await myRecording.arrayBuffer();

            sendToConnection(
                hostConnection,
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


    /* =====================================================
       RECEBER GRAVAÇÃO
       ===================================================== */

    function receiveRecording(data) {

        if (!isHost) return;

        try {

            const blob =
                new Blob(
                    [data.buffer],
                    {
                        type:
                            "audio/webm"
                    }
                );

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

        } catch (error) {

            console.error(error);
        }
    }


    /* =====================================================
       CHECAR GRAVAÇÕES
       ===================================================== */

    function checkRecordings() {

        if (!isHost) return;

        const players =
            getPlayersArray();

        if (
            roundRecordings.size <
            players.length
        ) {

            return;
        }

        startPlayback();
    }


    /* =====================================================
       PLAYBACK
       ===================================================== */

    async function startPlayback() {

        if (!isHost) return;

        muteIncomingVoice(true);

        closeOutgoingCalls();

        const recordings =
            [...roundRecordings.values()];

        for (
            const recording of recordings
        ) {

            const buffer =
                await recording.blob
                    .arrayBuffer();

            broadcast({
                type: "playback",
                peerId:
                    recording.peerId,
                username:
                    recording.username,
                buffer
            });

            await playBlobLocally(
                recording.blob
            );

            await wait(700);
        }

        muteIncomingVoice(false);

        /*
           Se o jogador tinha voz ON,
           volta depois do playback.
        */

        if (gameVoiceEnabled) {

            refreshOutgoingVoice();
        }

        calculateRoundScores();
    }


    async function playRemoteRecording(data) {

        muteIncomingVoice(true);

        try {

            const blob =
                new Blob(
                    [data.buffer],
                    {
                        type:
                            "audio/webm"
                    }
                );

            await playBlobLocally(
                blob
            );

        } catch {}

        muteIncomingVoice(false);
    }


    function playBlobLocally(blob) {

        return new Promise(resolve => {

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

            audio.play().catch(() => {

                URL.revokeObjectURL(
                    url
                );

                resolve();
            });
        });
    }


    /* =====================================================
       PONTUAÇÃO
       ===================================================== */

    async function calculateRoundScores() {

        if (!isHost) return;

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

        const scores =
            Object.fromEntries(
                roundScores
            );

        broadcast({
            type: "result",
            scores,
            round:
                currentRound
        });

        showRoundResult({
            scores,
            round:
                currentRound
        });
    }


    async function analyzeRecording(blob) {

        try {

            const buffer =
                await blob.arrayBuffer();

            const AudioContext =
                window.AudioContext ||
                window.webkitAudioContext;

            const context =
                new AudioContext();

            const audio =
                await context.decodeAudioData(
                    buffer.slice(0)
                );

            const data =
                audio.getChannelData(0);

            let total = 0;
            let peak = 0;
            let count = 0;

            const step =
                Math.max(
                    1,
                    Math.floor(
                        data.length / 12000
                    )
                );

            for (
                let i = 0;
                i < data.length;
                i += step
            ) {

                const value =
                    Math.abs(data[i]);

                total += value;

                if (value > peak) {
                    peak = value;
                }

                count++;
            }

            const average =
                total /
                Math.max(
                    1,
                    count
                );


            /*
               SILÊNCIO NÃO GANHA 70.
            */

            if (
                average < 0.006 ||
                peak < 0.025
            ) {

                try {
                    context.close();
                } catch {}

                return 0;
            }


            /*
               Pontuação básica.
               Ainda não é IA real.
            */

            let score =
                Math.round(
                    average * 1000
                );

            score +=
                Math.round(
                    peak * 20
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
                context.close();
            } catch {}

            return score;

        } catch {

            return 0;
        }
    }


    /* =====================================================
       RESULTADO
       ===================================================== */

    function showRoundResult(data) {

        hideGameScreens();

        resultScreen?.classList.remove(
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


        if (
            isHost &&
            currentRound < TOTAL_ROUNDS
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

            }, 3500);


        } else if (
            isHost &&
            currentRound >= TOTAL_ROUNDS
        ) {

            setTimeout(() => {

                const scores =
                    Object.fromEntries(
                        roundScores
                    );

                broadcast({
                    type: "game-end",
                    scores
                });

                showFinalResult({
                    scores
                });

            }, 3500);
        }
    }


    function showFinalResult(data) {

        hideGameScreens();

        resultScreen?.classList.remove(
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


    /* =====================================================
       TELAS
       ===================================================== */

    function hideGameScreens() {

        countdownScreen?.classList.add(
            "hidden"
        );

        referenceScreen?.classList.add(
            "hidden"
        );

        recordScreen?.classList.add(
            "hidden"
        );

        resultScreen?.classList.add(
            "hidden"
        );
    }


    /* =====================================================
       LIMPAR RODADA
       ===================================================== */

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


    /* =====================================================
       COPIAR CÓDIGO
       ===================================================== */

    async function copyRoomCode() {

        if (!roomCode) return;

        try {

            await navigator.clipboard.writeText(
                roomCode
            );

            if (copyCodeButton) {

                copyCodeButton.textContent =
                    "Copiado";

                setTimeout(() => {

                    copyCodeButton.textContent =
                        "Copiar código";

                }, 1200);
            }

        } catch {

            prompt(
                "Copie o código:",
                roomCode
            );
        }
    }


    /* =====================================================
       SAIR
       ===================================================== */

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

        muteIncomingVoice(false);

        if (gameVoiceButton) {

            gameVoiceButton.remove();

            gameVoiceButton = null;
        }

        showOnly(home);
    }


    /* =====================================================
       EVENTOS
       ===================================================== */

    if (loginButton) {

        loginButton.addEventListener(
            "click",
            loginUser
        );
    }


    if (usernameInput) {

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
    }


    if (createButton) {

        createButton.addEventListener(
            "click",
            createRoom
        );
    }


    if (joinButton) {

        joinButton.addEventListener(
            "click",
            joinRoom
        );
    }


    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            logoutUser
        );
    }


    if (copyCodeButton) {

        copyCodeButton.addEventListener(
            "click",
            copyRoomCode
        );
    }


    if (micButton) {

        micButton.addEventListener(
            "click",
            async () => {

                if (microphoneEnabled) {

                    disableMicrophone();

                } else {

                    await enableMicrophone();
                }
            }
        );
    }


    if (startButton) {

        startButton.addEventListener(
            "click",
            startGame
        );
    }


    if (leaveRoomButton) {

        leaveRoomButton.addEventListener(
            "click",
            leaveRoom
        );
    }


    if (referenceButton) {

        referenceButton.addEventListener(
            "click",
            playReferenceSound
        );
    }


    /* =====================================================
       INICIALIZAÇÃO
       ===================================================== */

    function initialize() {

        /*
           IMPORTANTE:
           O login NÃO depende do PeerJS.
           O botão Entrar já está funcionando
           antes de qualquer conexão.
        */

        updateMicUI();

        const saved =
            localStorage.getItem(
                "shadow_games_username"
            );

        if (saved) {

            username =
                saved
                    .trim()
                    .slice(0, 16);

            updateProfile();

            showOnly(home);

        } else {

            showOnly(login);
        }
    }


    initialize();

});
