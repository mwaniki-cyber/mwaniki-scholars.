/* ============================================================
   MWANIKI SCHOLARS
   ORIGINAL CALL ENGINE
   chat_call_rooms
   chat_call_participants
   chat_call_signals
   ============================================================ */

import { supabase } from "./supabase.js";


/* ============================================================
   STATE
   ============================================================ */

const state = {
    user: null,

    room: null,

    targets: [],

    mode: "general",

    communityId: null,
    communityName: "",

    channelId: null,
    channelName: "",

    callType: "video",

    localStream: null,

    peers: new Map(),

    participants: new Map(),

    signalChannel: null,
    participantChannel: null,
    roomChannel: null,

    muted: false,
    cameraOn: true,
    screenSharing: false,

    joined: false,

    closing: false
};


/* ============================================================
   DOM
   ============================================================ */

const dom = {
    callTitle:
        document.getElementById(
            "callTitle"
        ),

    callSubtitle:
        document.getElementById(
            "callSubtitle"
        ),

    callStatus:
        document.getElementById(
            "callStatus"
        ),

    videoGrid:
        document.getElementById(
            "videoGrid"
        ),

    localVideo:
        document.getElementById(
            "localVideo"
        ),

    localPlaceholder:
        document.getElementById(
            "localPlaceholder"
        ),

    localAvatar:
        document.getElementById(
            "localAvatar"
        ),

    localMuteIndicator:
        document.getElementById(
            "localMuteIndicator"
        ),

    muteButton:
        document.getElementById(
            "muteButton"
        ),

    cameraButton:
        document.getElementById(
            "cameraButton"
        ),

    screenButton:
        document.getElementById(
            "screenButton"
        ),

    endCallButton:
        document.getElementById(
            "endCallButton"
        ),

    callError:
        document.getElementById(
            "callError"
        )
};


/* ============================================================
   HELPERS
   ============================================================ */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function initials(name) {
    const parts =
        String(name || "User")
            .trim()
            .split(/\s+/);

    if (
        parts.length === 1
    ) {
        return parts[0]
            .slice(0, 2)
            .toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
}

function showError(
    message
) {
    console.error(
        "[Call]",
        message
    );

    dom.callError.textContent =
        message;

    dom.callError.classList.remove(
        "hidden"
    );

    dom.callStatus.textContent =
        "Call error";
}

function setStatus(
    message
) {
    dom.callStatus.textContent =
        message;
}

function parseQuery() {
    const params =
        new URLSearchParams(
            window.location.search
        );

    state.mode =
        params.get("mode") ||
        "general";

    state.communityId =
        params.get(
            "community_id"
        ) || null;

    state.communityName =
        params.get(
            "community_name"
        ) || "";

    state.channelId =
        params.get(
            "channel_id"
        ) || null;

    state.channelName =
        params.get(
            "channel_name"
        ) || "";

    state.callType =
        params.get(
            "call_type"
        ) || "video";

    const targets =
        params.get("targets");

    state.targets =
        targets
            ? targets
                .split(",")
                .map(
                    (id) =>
                        id.trim()
                )
                .filter(Boolean)
            : [];
}


/* ============================================================
   AUTH
   ============================================================ */

async function getUser() {
    const {
        data,
        error
    } = await supabase.auth.getUser();

    if (error) {
        throw error;
    }

    if (!data?.user) {
        throw new Error(
            "You must be signed in."
        );
    }

    state.user =
        data.user;

    const name =
        state.user.user_metadata?.full_name ||
        state.user.user_metadata?.name ||
        state.user.email?.split("@")[0] ||
        "Mwaniki Scholar";

    dom.localAvatar.textContent =
        initials(name);
}


/* ============================================================
   CALL TITLE
   ============================================================ */

function renderTitle() {

    if (
        state.mode ===
        "community"
    ) {

        dom.callTitle.textContent =
            state.communityName ||
            "Community Call";

        dom.callSubtitle.textContent =
            state.channelName ||
            "Community voice room";

        return;
    }

    if (
        state.targets.length === 1
    ) {

        dom.callTitle.textContent =
            "Mwaniki Scholars Call";

        dom.callSubtitle.textContent =
            "Direct call";

        return;
    }

    dom.callTitle.textContent =
        "General Call";

    dom.callSubtitle.textContent =
        state.targets.length
            ? `${state.targets.length} selected`
            : "Mwaniki Scholars";
}


/* ============================================================
   LOCAL MEDIA
   ============================================================ */

async function acquireLocalMedia() {

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {
        throw new Error(
            "This browser does not support WebRTC media."
        );
    }

    const wantVideo =
        state.callType !==
        "audio";

    state.localStream =
        await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: wantVideo
        });

    dom.localVideo.srcObject =
        state.localStream;

    dom.localPlaceholder.classList.toggle(
        "hidden",
        wantVideo
    );

    state.cameraOn =
        wantVideo;

    updateLocalControls();
}


/* ============================================================
   CREATE ROOM
   ============================================================ */

async function createRoom() {

    const roomCode =
        `mw-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    const callScope =
        state.mode ===
        "community"
            ? "community"
            : state.targets.length === 1
                ? "direct"
                : "general";

    const {
        data,
        error
    } = await supabase
        .from("chat_call_rooms")
        .insert({
            community_id:
                state.communityId ||
                null,

            room_code:
                roomCode,

            call_scope:
                callScope,

            call_type:
                state.callType,

            status:
                "waiting",

            created_by:
                state.user.id,

            target_user_id:
                state.targets.length === 1
                    ? state.targets[0]
                    : null,

            room_status:
                "ringing",

            max_participants:
                100
        })
        .select()
        .single();

    if (error) {
        throw error;
    }

    state.room =
        data;

    return data;
}


/* ============================================================
   PARTICIPANT INSERT
   ============================================================ */

async function insertSelfParticipant() {

    const {
        error
    } = await supabase
        .from("chat_call_participants")
        .insert({
            room_id:
                state.room.id,

            user_id:
                state.user.id,

            status:
                "joined",

            is_muted:
                state.muted,

            is_camera_on:
                state.cameraOn,

            is_screen_sharing:
                state.screenSharing,

            joined_at:
                new Date().toISOString()
        });

    if (error) {
        throw error;
    }
}

async function inviteTargets() {

    const uniqueTargets =
        [
            ...new Set(
                state.targets
                    .filter(
                        (id) =>
                            id &&
                            id !==
                            state.user.id
                    )
            )
        ];

    if (
        !uniqueTargets.length
    ) {
        return;
    }

    const rows =
        uniqueTargets.map(
            (userId) => ({
                room_id:
                    state.room.id,

                user_id:
                    userId,

                status:
                    "invited",

                is_muted:
                    false,

                is_camera_on:
                    false,

                is_screen_sharing:
                    false
            })
        );

    const {
        error
    } = await supabase
        .from("chat_call_participants")
        .insert(rows);

    if (error) {
        throw error;
    }
}


/* ============================================================
   LOAD PARTICIPANTS
   ============================================================ */

async function loadParticipants() {

    const {
        data,
        error
    } = await supabase
        .from("chat_call_participants")
        .select(`
            id,
            room_id,
            user_id,
            status,
            is_muted,
            is_camera_on,
            is_screen_sharing,
            joined_at,
            left_at,
            created_at,
            updated_at
        `)
        .eq(
            "room_id",
            state.room.id
        );

    if (error) {
        throw error;
    }

    state.participants.clear();

    (data || []).forEach(
        (participant) => {

            state.participants.set(
                participant.user_id,
                participant
            );
        }
    );

    renderParticipants();
}


/* ============================================================
   REALTIME ROOM
   ============================================================ */

function subscribeRoom() {

    state.roomChannel =
        supabase
            .channel(
                `call-room-${state.room.id}`
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_call_rooms",
                    filter:
                        `id=eq.${state.room.id}`
                },
                (payload) => {

                    if (
                        payload.new
                    ) {
                        state.room =
                            payload.new;

                        if (
                            payload.new.status ===
                                "ended" ||
                            payload.new.room_status ===
                                "ended"
                        ) {
                            endCall(false);
                        }
                    }
                }
            )
            .subscribe();

    state.participantChannel =
        supabase
            .channel(
                `call-participants-${state.room.id}`
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_call_participants",
                    filter:
                        `room_id=eq.${state.room.id}`
                },
                async () => {

                    await loadParticipants();
                }
            )
            .subscribe();


    /*
     * Signalling is intentionally sent through the original
     * chat_call_signals table because that is the table with
     * sender_id, receiver_id and JSONB payload.
     */

    state.signalChannel =
        supabase
            .channel(
                `call-signals-${state.room.id}`
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "chat_call_signals",
                    filter:
                        `room_id=eq.${state.room.id}`
                },
                async (payload) => {

                    const signal =
                        payload.new;

                    if (
                        signal.sender_id ===
                        state.user.id
                    ) {
                        return;
                    }

                    if (
                        signal.receiver_id &&
                        signal.receiver_id !==
                            state.user.id
                    ) {
                        return;
                    }

                    await handleSignal(
                        signal
                    );
                }
            )
            .subscribe();
}


/* ============================================================
   SIGNAL SEND
   ============================================================ */

async function sendSignal(
    receiverId,
    signalType,
    payload
) {

    const {
        error
    } = await supabase
        .from("chat_call_signals")
        .insert({
            room_id:
                state.room.id,

            sender_id:
                state.user.id,

            receiver_id:
                receiverId ||
                null,

            signal_type:
                signalType,

            payload:
                payload || {}
        });

    if (error) {
        console.error(
            "Signal insert failed:",
            error
        );
    }
}


/* ============================================================
   PEER CONNECTIONS
   ============================================================ */

function getPeerConfig() {
    return {
        iceServers: [
            {
                urls:
                    "stun:stun.l.google.com:19302"
            },
            {
                urls:
                    "stun:stun1.l.google.com:19302"
            }
        ]
    };
}

function createPeer(
    remoteUserId,
    initiator
) {

    if (
        state.peers.has(
            remoteUserId
        )
    ) {
        return state.peers.get(
            remoteUserId
        );
    }

    const peer =
        new RTCPeerConnection(
            getPeerConfig()
        );

    state.peers.set(
        remoteUserId,
        peer
    );

    if (
        state.localStream
    ) {

        state.localStream
            .getTracks()
            .forEach(
                (track) => {

                    peer.addTrack(
                        track,
                        state.localStream
                    );
                }
            );
    }

    peer.onicecandidate =
        async (event) => {

            if (
                !event.candidate
            ) {
                return;
            }

            await sendSignal(
                remoteUserId,
                "ice-candidate",
                event.candidate
            );
        };

    peer.ontrack =
        (event) => {

            attachRemoteStream(
                remoteUserId,
                event.streams[0]
            );
        };

    peer.onconnectionstatechange =
        () => {

            if (
                [
                    "failed",
                    "disconnected",
                    "closed"
                ].includes(
                    peer.connectionState
                )
            ) {
                removeRemotePeer(
                    remoteUserId
                );
            }
        };

    if (initiator) {
        createOffer(
            remoteUserId,
            peer
        );
    }

    return peer;
}

async function createOffer(
    remoteUserId,
    peer
) {

    try {

        const offer =
            await peer.createOffer();

        await peer.setLocalDescription(
            offer
        );

        await sendSignal(
            remoteUserId,
            "offer",
            offer
        );

    } catch (error) {

        console.error(
            "Offer failed:",
            error
        );
    }
}


/* ============================================================
   SIGNAL HANDLER
   ============================================================ */

async function handleSignal(
    signal
) {

    const senderId =
        signal.sender_id;

    const payload =
        signal.payload || {};

    const type =
        signal.signal_type;

    let peer =
        state.peers.get(
            senderId
        );

    if (
        !peer
    ) {
        peer =
            createPeer(
                senderId,
                false
            );
    }

    try {

        if (
            type === "offer"
        ) {

            await peer.setRemoteDescription(
                new RTCSessionDescription(
                    payload
                )
            );

            const answer =
                await peer.createAnswer();

            await peer.setLocalDescription(
                answer
            );

            await sendSignal(
                senderId,
                "answer",
                answer
            );

            return;
        }


        if (
            type === "answer"
        ) {

            if (
                peer.signalingState !==
                "stable"
            ) {
                await peer.setRemoteDescription(
                    new RTCSessionDescription(
                        payload
                    )
                );
            }

            return;
        }


        if (
            type === "ice-candidate"
        ) {

            try {

                await peer.addIceCandidate(
                    new RTCIceCandidate(
                        payload
                    )
                );

            } catch (
                candidateError
            ) {

                console.warn(
                    "ICE candidate failed:",
                    candidateError
                );
            }

            return;
        }

    } catch (error) {

        console.error(
            "Signal handling failed:",
            error
        );
    }
}


/* ============================================================
   REMOTE VIDEO
   ============================================================ */

function attachRemoteStream(
    userId,
    stream
) {

    let tile =
        document.querySelector(
            `[data-remote-user="${CSS.escape(userId)}"]`
        );

    if (!tile) {

        tile =
            document.createElement(
                "div"
            );

        tile.className =
            "video-tile";

        tile.dataset.remoteUser =
            userId;

        tile.innerHTML = `
            <video
                autoplay
                playsinline
            ></video>

            <div
                class="video-placeholder hidden"
            >
                <div class="video-placeholder-avatar">
                    MS
                </div>
            </div>

            <span
                class="video-label"
            >
                Member
            </span>

            <span
                class="video-mute"
            >
                🎙
            </span>
        `;

        dom.videoGrid.appendChild(
            tile
        );
    }

    const video =
        tile.querySelector(
            "video"
        );

    video.srcObject =
        stream;
}

function removeRemotePeer(
    userId
) {

    const peer =
        state.peers.get(
            userId
        );

    if (peer) {

        try {
            peer.close();
        } catch {
            /* ignore */
        }
    }

    state.peers.delete(
        userId
    );

    const tile =
        document.querySelector(
            `[data-remote-user="${CSS.escape(userId)}"]`
        );

    tile?.remove();
}


/* ============================================================
   PARTICIPANTS UI
   ============================================================ */

function renderParticipants() {

    state.participants.forEach(
        (participant) => {

            if (
                participant.user_id ===
                state.user.id
            ) {
                return;
            }

            if (
                participant.status ===
                "joined"
            ) {

                /*
                 * In a real mesh call the initiator will establish
                 * the peer. We use deterministic ordering so that
                 * both sides do not create duplicate offers.
                 */

                const shouldInitiate =
                    state.user.id <
                    participant.user_id;

                createPeer(
                    participant.user_id,
                    shouldInitiate
                );
            }
        }
    );
}


/* ============================================================
   UPDATE PARTICIPANT STATE
   ============================================================ */

async function updateParticipant(
    changes
) {

    const {
        error
    } = await supabase
        .from("chat_call_participants")
        .update({
            ...changes,
            updated_at:
                new Date().toISOString()
        })
        .eq(
            "room_id",
            state.room.id
        )
        .eq(
            "user_id",
            state.user.id
        );

    if (error) {
        console.error(
            "Participant update failed:",
            error
        );
    }
}


/* ============================================================
   CONTROLS
   ============================================================ */

function updateLocalControls() {

    dom.muteButton.classList.toggle(
        "active",
        state.muted
    );

    dom.cameraButton.classList.toggle(
        "active",
        !state.cameraOn
    );

    dom.screenButton.classList.toggle(
        "active",
        state.screenSharing
    );

    dom.muteButton.textContent =
        state.muted
            ? "🔇"
            : "🎙";

    dom.cameraButton.textContent =
        state.cameraOn
            ? "📹"
            : "🚫";

    dom.localMuteIndicator.classList.toggle(
        "hidden",
        !state.muted
    );
}

async function toggleMute() {

    state.muted =
        !state.muted;

    state.localStream
        ?.getAudioTracks()
        .forEach(
            (track) => {
                track.enabled =
                    !state.muted;
            }
        );

    updateLocalControls();

    await updateParticipant({
        is_muted:
            state.muted
    });
}

async function toggleCamera() {

    const track =
        state.localStream
            ?.getVideoTracks()[0];

    if (!track) {
        showError(
            "No camera track is available."
        );
        return;
    }

    state.cameraOn =
        !state.cameraOn;

    track.enabled =
        state.cameraOn;

    dom.localPlaceholder.classList.toggle(
        "hidden",
        state.cameraOn
    );

    updateLocalControls();

    await updateParticipant({
        is_camera_on:
            state.cameraOn
    });
}

async function toggleScreenShare() {

    if (
        !navigator.mediaDevices?.getDisplayMedia
    ) {
        showError(
            "Screen sharing is not supported by this browser."
        );
        return;
    }

    if (
        state.screenSharing
    ) {
        return;
    }

    try {

        const screenStream =
            await navigator.mediaDevices.getDisplayMedia({
                video: true
            });

        const screenTrack =
            screenStream.getVideoTracks()[0];

        const senderPromises = [];

        state.peers.forEach(
            (peer) => {

                const sender =
                    peer.getSenders()
                        .find(
                            (item) =>
                                item.track?.kind ===
                                "video"
                        );

                if (sender) {
                    senderPromises.push(
                        sender.replaceTrack(
                            screenTrack
                        )
                    );
                }
            }
        );

        await Promise.all(
            senderPromises
        );

        state.screenSharing =
            true;

        updateLocalControls();

        await updateParticipant({
            is_screen_sharing:
                true
        });

        screenTrack.onended =
            async () => {

                const cameraTrack =
                    state.localStream
                        ?.getVideoTracks()[0];

                const restores = [];

                state.peers.forEach(
                    (peer) => {

                        const sender =
                            peer.getSenders()
                                .find(
                                    (item) =>
                                        item.track?.kind ===
                                        "video"
                                );

                        if (
                            sender &&
                            cameraTrack
                        ) {
                            restores.push(
                                sender.replaceTrack(
                                    cameraTrack
                                )
                            );
                        }
                    }
                );

                await Promise.all(
                    restores
                );

                state.screenSharing =
                    false;

                updateLocalControls();

                await updateParticipant({
                    is_screen_sharing:
                        false
                });
            };

    } catch (error) {

        console.error(
            "Screen sharing failed:",
            error
        );
    }
}


/* ============================================================
   END CALL
   ============================================================ */

async function endCall(
    updateRoom = true
) {

    if (
        state.closing
    ) {
        return;
    }

    state.closing =
        true;

    setStatus(
        "Ending call..."
    );

    try {

        await updateParticipant({
            status:
                "left",

            left_at:
                new Date().toISOString()
        });

    } catch {
        /* Continue cleanup. */
    }


    if (
        updateRoom &&
        state.room &&
        state.room.created_by ===
            state.user?.id
    ) {

        await supabase
            .from("chat_call_rooms")
            .update({
                status:
                    "ended",

                room_status:
                    "ended",

                ended_at:
                    new Date().toISOString(),

                updated_at:
                    new Date().toISOString()
            })
            .eq(
                "id",
                state.room.id
            );
    }


    state.peers.forEach(
        (peer) => {

            try {
                peer.close();
            } catch {
                /* ignore */
            }
        }
    );

    state.peers.clear();


    if (
        state.localStream
    ) {

        state.localStream
            .getTracks()
            .forEach(
                (track) =>
                    track.stop()
            );
    }


    if (
        state.signalChannel
    ) {
        supabase.removeChannel(
            state.signalChannel
        );
    }

    if (
        state.participantChannel
    ) {
        supabase.removeChannel(
            state.participantChannel
        );
    }

    if (
        state.roomChannel
    ) {
        supabase.removeChannel(
            state.roomChannel
        );
    }

    setStatus(
        "Call ended"
    );

    setTimeout(
        () => {
            window.close();
        },
        700
    );
}


/* ============================================================
   INITIALIZATION
   ============================================================ */

async function initialize() {

    try {

        parseQuery();

        renderTitle();

        await getUser();

        setStatus(
            "Requesting microphone and camera..."
        );

        await acquireLocalMedia();

        setStatus(
            "Creating call..."
        );

        await createRoom();

        await insertSelfParticipant();

        await inviteTargets();

        await loadParticipants();

        subscribeRoom();

        state.joined =
            true;

        setStatus(
            "Connected"
        );

        /*
         * Re-check participants shortly after subscriptions are
         * active so direct and group calls can begin negotiating.
         */

        setTimeout(
            async () => {

                if (
                    state.closing
                ) {
                    return;
                }

                await loadParticipants();

                renderParticipants();

            },
            800
        );

    } catch (error) {

        console.error(
            "[Call] Initialization failed:",
            error
        );

        showError(
            error.message ||
            "Unable to start the call."
        );
    }
}


/* ============================================================
   EVENTS
   ============================================================ */

dom.muteButton.addEventListener(
    "click",
    toggleMute
);

dom.cameraButton.addEventListener(
    "click",
    toggleCamera
);

dom.screenButton.addEventListener(
    "click",
    toggleScreenShare
);

dom.endCallButton.addEventListener(
    "click",
    () =>
        endCall(true)
);

window.addEventListener(
    "beforeunload",
    () => {

        if (
            state.localStream
        ) {
            state.localStream
                .getTracks()
                .forEach(
                    (track) =>
                        track.stop()
                );
        }

    }
);


/* ============================================================
   START
   ============================================================ */

initialize();
