/* ============================================================
   MWANIKI SCHOLARS
   COMMUNITY CALL ENGINE
   ============================================================

   ONE CALL ENGINE ONLY

   Handles:
   - General calls
   - Direct calls
   - Community calls
   - Voice calls
   - Video calls
   - Microphone
   - Camera
   - Screen sharing
   - Supabase Realtime signalling
   - Multiple participants
   - ICE candidate queueing
   - Existing room joining
   ============================================================ */

import { supabase } from "./supabase.js";


/* ============================================================
   STATE
   ============================================================ */

const state = {

    user: null,

    profile: null,

    room: null,

    mode: "general",

    communityId: null,

    communityName: "",

    channelId: null,

    channelName: "",

    callType: "video",

    targets: [],

    localStream: null,

    screenStream: null,

    peers: new Map(),

    remoteStreams: new Map(),

    participants: new Map(),

    profiles: new Map(),

    signalChannel: null,

    participantChannel: null,

    roomChannel: null,

    joined: false,

    muted: false,

    cameraOn: true,

    screenSharing: false,

    closing: false,

    iceQueues: new Map(),

    remoteDescriptions: new Set(),

    initializationComplete: false
};


/* ============================================================
   DOM
   ============================================================ */

const $ = id =>
    document.getElementById(id);


const dom = {

    callTitle:
        $("callTitle"),

    callSubtitle:
        $("callSubtitle"),

    callStatus:
        $("callStatus"),

    videoGrid:
        $("videoGrid"),

    localVideo:
        $("localVideo"),

    localTile:
        $("localTile"),

    localPlaceholder:
        $("localPlaceholder"),

    localAvatar:
        $("localAvatar"),

    localMuteIndicator:
        $("localMuteIndicator"),

    muteButton:
        $("muteButton"),

    cameraButton:
        $("cameraButton"),

    screenButton:
        $("screenButton"),

    endCallButton:
        $("endCallButton"),

    callError:
        $("callError")
};


/* ============================================================
   BASIC HELPERS
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

    const text =
        String(
            name ||
            "Mwaniki Scholar"
        ).trim();

    const parts =
        text.split(/\s+/);

    if (parts.length === 1) {

        return parts[0]
            .slice(0, 2)
            .toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
}


function currentUserName() {

    return (
        state.profile?.full_name ||
        state.profile?.name ||
        state.profile?.display_name ||
        state.user?.user_metadata?.full_name ||
        state.user?.user_metadata?.name ||
        state.user?.user_metadata?.display_name ||
        state.user?.email?.split("@")[0] ||
        "Mwaniki Scholar"
    );
}


function profileName(profile) {

    return (
        profile?.full_name ||
        profile?.name ||
        profile?.display_name ||
        "Mwaniki Scholar"
    );
}


function profileAvatar(profile) {

    return (
        profile?.avatar_url ||
        profile?.photo_url ||
        profile?.image_url ||
        ""
    );
}


function setStatus(
    message,
    type = ""
) {

    if (!dom.callStatus) {
        return;
    }

    dom.callStatus.textContent =
        message;

    dom.callStatus.classList.remove(
        "connected",
        "error"
    );

    if (type) {

        dom.callStatus.classList.add(
            type
        );
    }
}


function showError(message) {

    console.error(
        "[Mwaniki Call]",
        message
    );

    if (dom.callError) {

        dom.callError.textContent =
            message;

        dom.callError.classList.remove(
            "hidden"
        );
    }

    setStatus(
        "Call error",
        "error"
    );
}


function hideError() {

    dom.callError
        ?.classList.add(
            "hidden"
        );
}


/* ============================================================
   QUERY PARAMETERS
   ============================================================ */

function parseQuery() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    state.mode =
        params.get("mode") ||
        "general";

    state.communityId =
        params.get("community_id") ||
        null;

    state.communityName =
        params.get("community_name") ||
        "";

    state.channelId =
        params.get("channel_id") ||
        null;

    state.channelName =
        params.get("channel_name") ||
        "";

    state.callType =
        params.get("call_type") ||
        "video";

    const targets =
        params.get("targets");

    state.targets =
        targets
            ? targets
                .split(",")
                .map(id => id.trim())
                .filter(Boolean)
            : [];

    /*
     * Existing room.
     *
     * This is important for incoming calls.
     * The invited user joins the caller's existing room
     * instead of creating a second room.
     */

    state.existingRoomId =
        params.get("room_id") ||
        null;
}


/* ============================================================
   AUTH
   ============================================================ */

async function loadUser() {

    const {
        data,
        error
    } =
        await supabase.auth.getUser();

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
}


async function loadProfile() {

    if (!state.user) {
        return;
    }

    /*
     * student_profiles has had different deployments.
     * Try id first.
     */

    let result =
        await supabase
            .from("student_profiles")
            .select("*")
            .eq(
                "id",
                state.user.id
            )
            .maybeSingle();

    if (
        result.error ||
        !result.data
    ) {

        result =
            await supabase
                .from("student_profiles")
                .select("*")
                .eq(
                    "user_id",
                    state.user.id
                )
                .maybeSingle();
    }

    state.profile =
        result.data ||
        null;

    const name =
        currentUserName();

    dom.localAvatar.textContent =
        initials(name);

    const avatar =
        profileAvatar(
            state.profile
        );

    if (avatar) {

        dom.localAvatar.style.backgroundImage =
            `url("${avatar}")`;

        dom.localAvatar.style.backgroundSize =
            "cover";

        dom.localAvatar.style.backgroundPosition =
            "center";

        dom.localAvatar.textContent =
            "";
    }
}


/* ============================================================
   TITLE
   ============================================================ */

function renderTitle() {

    if (state.mode === "community") {

        dom.callTitle.textContent =
            state.communityName ||
            "Community Call";

        dom.callSubtitle.textContent =
            state.channelName ||
            "Community voice room";

        return;
    }

    if (state.mode === "direct") {

        dom.callTitle.textContent =
            "Mwaniki Scholars Call";

        dom.callSubtitle.textContent =
            "Direct call";

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
   MEDIA
   ============================================================ */

async function acquireLocalMedia() {

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        throw new Error(
            "This browser does not support microphone and camera access."
        );
    }

    const wantsVideo =
        state.callType !== "audio";

    setStatus(
        wantsVideo
            ? "Requesting microphone and camera..."
            : "Requesting microphone..."
    );

    state.localStream =
        await navigator.mediaDevices
            .getUserMedia({
                audio: true,
                video: wantsVideo
            });

    dom.localVideo.srcObject =
        state.localStream;

    state.cameraOn =
        wantsVideo;

    updateLocalControls();
}


function updateLocalControls() {

    dom.muteButton
        ?.classList.toggle(
            "active",
            state.muted
        );

    dom.cameraButton
        ?.classList.toggle(
            "active",
            !state.cameraOn
        );

    dom.screenButton
        ?.classList.toggle(
            "active",
            state.screenSharing
        );

    if (dom.muteButton) {

        dom.muteButton.textContent =
            state.muted
                ? "🔇"
                : "🎙";
    }

    if (dom.cameraButton) {

        dom.cameraButton.textContent =
            state.cameraOn
                ? "📹"
                : "🚫";
    }

    if (dom.screenButton) {

        dom.screenButton.textContent =
            state.screenSharing
                ? "⛶"
                : "🖥";
    }

    dom.localMuteIndicator
        ?.classList.toggle(
            "hidden",
            !state.muted
        );

    dom.localPlaceholder
        ?.classList.toggle(
            "hidden",
            state.cameraOn
        );
}


/* ============================================================
   WEBRTC CONFIG
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


/* ============================================================
   ROOM
   ============================================================ */

async function createRoom() {

    const roomCode =
        `mw-${Date.now()}-${crypto.randomUUID()}`;

    const scope =
        state.mode === "community"
            ? "community"
            : state.targets.length === 1
                ? "direct"
                : "general";

    const {
        data,
        error
    } =
        await supabase
            .from("chat_call_rooms")
            .insert({

                community_id:
                    state.communityId ||
                    null,

                room_code:
                    roomCode,

                call_scope:
                    scope,

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


async function loadExistingRoom() {

    if (!state.existingRoomId) {
        return;
    }

    const {
        data,
        error
    } =
        await supabase
            .from("chat_call_rooms")
            .select("*")
            .eq(
                "id",
                state.existingRoomId
            )
            .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {

        throw new Error(
            "The call room could not be found."
        );
    }

    if (
        data.status === "ended" ||
        data.room_status === "ended"
    ) {

        throw new Error(
            "This call has already ended."
        );
    }

    state.room =
        data;
}


/* ============================================================
   PARTICIPANTS
   ============================================================ */

async function ensureSelfParticipant() {

    if (!state.room) {
        return;
    }

    const {
        data: existing,
        error: findError
    } =
        await supabase
            .from("chat_call_participants")
            .select("*")
            .eq(
                "room_id",
                state.room.id
            )
            .eq(
                "user_id",
                state.user.id
            )
            .maybeSingle();

    if (findError) {

        console.error(
            "Participant lookup:",
            findError
        );
    }

    if (existing) {

        const {
            error
        } =
            await supabase
                .from(
                    "chat_call_participants"
                )
                .update({

                    status:
                        "joined",

                    joined_at:
                        existing.joined_at ||
                        new Date().toISOString(),

                    left_at:
                        null,

                    is_muted:
                        state.muted,

                    is_camera_on:
                        state.cameraOn,

                    is_screen_sharing:
                        state.screenSharing,

                    updated_at:
                        new Date().toISOString()

                })
                .eq(
                    "id",
                    existing.id
                );

        if (error) {
            throw error;
        }

        return;
    }

    const {
        error
    } =
        await supabase
            .from(
                "chat_call_participants"
            )
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

    if (!state.room) {
        return;
    }

    const uniqueTargets =
        [
            ...new Set(
                state.targets
                    .filter(
                        id =>
                            id &&
                            id !==
                            state.user.id
                    )
            )
        ];

    if (!uniqueTargets.length) {
        return;
    }

    const {
        data: existing
    } =
        await supabase
            .from(
                "chat_call_participants"
            )
            .select("user_id")
            .eq(
                "room_id",
                state.room.id
            );

    const existingIds =
        new Set(
            (existing || [])
                .map(
                    row =>
                        row.user_id
                )
        );

    const rows =
        uniqueTargets
            .filter(
                id =>
                    !existingIds.has(id)
            )
            .map(
                userId => ({

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

    if (!rows.length) {
        return;
    }

    const {
        error
    } =
        await supabase
            .from(
                "chat_call_participants"
            )
            .insert(rows);

    if (error) {
        throw error;
    }
}


async function loadParticipants() {

    if (!state.room) {
        return;
    }

    const {
        data,
        error
    } =
        await supabase
            .from(
                "chat_call_participants"
            )
            .select("*")
            .eq(
                "room_id",
                state.room.id
            );

    if (error) {
        throw error;
    }

    state.participants.clear();

    (data || [])
        .forEach(
            participant => {

                state.participants.set(
                    participant.user_id,
                    participant
                );
            }
        );

    await loadParticipantProfiles();

    connectToJoinedParticipants();
}


async function loadParticipantProfiles() {

    const ids =
        [
            ...state.participants.keys()
        ];

    if (!ids.length) {
        return;
    }

    const {
        data
    } =
        await supabase
            .from(
                "student_profiles"
            )
            .select("*")
            .in(
                "id",
                ids
            );

    state.profiles.clear();

    (data || [])
        .forEach(
            profile => {

                state.profiles.set(
                    profile.id,
                    profile
                );
            }
        );
}


function connectToJoinedParticipants() {

    state.participants
        .forEach(
            participant => {

                if (
                    participant.user_id ===
                    state.user.id
                ) {
                    return;
                }

                if (
                    participant.status !==
                    "joined"
                ) {
                    return;
                }

                /*
                 * Deterministic initiator:
                 * only one side creates the offer.
                 */

                const initiator =
                    String(state.user.id) <
                    String(participant.user_id);

                createPeer(
                    participant.user_id,
                    initiator
                );
            }
        );
}


/* ============================================================
   REALTIME
   ============================================================ */

function subscribeRealtime() {

    if (!state.room) {
        return;
    }

    /*
     * ROOM
     */

    state.roomChannel =
        supabase
            .channel(
                `mwaniki-call-room-${state.room.id}`
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
                payload => {

                    const row =
                        payload.new ||
                        payload.old;

                    if (!row) {
                        return;
                    }

                    if (
                        payload.new
                    ) {

                        state.room =
                            payload.new;
                    }

                    if (
                        row.status ===
                            "ended" ||
                        row.room_status ===
                            "ended"
                    ) {

                        endCall(false);
                    }
                }
            )
            .subscribe();


    /*
     * PARTICIPANTS
     */

    state.participantChannel =
        supabase
            .channel(
                `mwaniki-call-participants-${state.room.id}`
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table:
                        "chat_call_participants",
                    filter:
                        `room_id=eq.${state.room.id}`
                },
                async () => {

                    try {

                        await loadParticipants();

                    } catch (error) {

                        console.error(
                            "Participant realtime update:",
                            error
                        );
                    }
                }
            )
            .subscribe();


    /*
     * SIGNALS
     */

    state.signalChannel =
        supabase
            .channel(
                `mwaniki-call-signals-${state.room.id}`
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table:
                        "chat_call_signals",
                    filter:
                        `room_id=eq.${state.room.id}`
                },
                async payload => {

                    const signal =
                        payload.new;

                    if (!signal) {
                        return;
                    }

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

                    try {

                        await handleSignal(
                            signal
                        );

                    } catch (error) {

                        console.error(
                            "Signal handling:",
                            error
                        );
                    }
                }
            )
            .subscribe();
}


/* ============================================================
   SIGNALING
   ============================================================ */

async function sendSignal(
    receiverId,
    signalType,
    payload
) {

    if (
        !state.room ||
        !state.user
    ) {
        return;
    }

    const {
        error
    } =
        await supabase
            .from(
                "chat_call_signals"
            )
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
   PEERS
   ============================================================ */

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

    state.iceQueues.set(
        remoteUserId,
        []
    );


    /*
     * LOCAL TRACKS
     */

    if (state.localStream) {

        state.localStream
            .getTracks()
            .forEach(
                track => {

                    peer.addTrack(
                        track,
                        state.localStream
                    );
                }
            );
    }


    /*
     * ICE
     */

    peer.onicecandidate =
        async event => {

            if (!event.candidate) {
                return;
            }

            await sendSignal(
                remoteUserId,
                "ice-candidate",
                event.candidate.toJSON
                    ? event.candidate.toJSON()
                    : event.candidate
            );
        };


    /*
     * REMOTE TRACK
     */

    peer.ontrack =
        event => {

            const stream =
                event.streams?.[0];

            if (!stream) {
                return;
            }

            attachRemoteStream(
                remoteUserId,
                stream
            );
        };


    /*
     * CONNECTION
     */

    peer.onconnectionstatechange =
        () => {

            const status =
                peer.connectionState;

            console.log(
                "[Call]",
                remoteUserId,
                status
            );

            if (
                status === "connected"
            ) {

                setStatus(
                    "Connected",
                    "connected"
                );
            }

            if (
                [
                    "failed",
                    "closed"
                ].includes(status)
            ) {

                removeRemotePeer(
                    remoteUserId
                );
            }
        };


    /*
     * NEGOTIATION
     */

    if (initiator) {

        setTimeout(
            () => {

                createOffer(
                    remoteUserId,
                    peer
                );

            },
            150
        );
    }

    return peer;
}


/* ============================================================
   OFFER
   ============================================================ */

async function createOffer(
    remoteUserId,
    peer
) {

    try {

        if (
            peer.signalingState !==
            "stable"
        ) {
            return;
        }

        const offer =
            await peer.createOffer();

        await peer.setLocalDescription(
            offer
        );

        await sendSignal(
            remoteUserId,
            "offer",
            peer.localDescription
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

    if (!peer) {

        peer =
            createPeer(
                senderId,
                false
            );
    }


    if (type === "offer") {

        await peer.setRemoteDescription(
            new RTCSessionDescription(
                payload
            )
        );

        state.remoteDescriptions.add(
            senderId
        );

        await flushIceCandidates(
            senderId,
            peer
        );

        const answer =
            await peer.createAnswer();

        await peer.setLocalDescription(
            answer
        );

        await sendSignal(
            senderId,
            "answer",
            peer.localDescription
        );

        return;
    }


    if (type === "answer") {

        if (
            peer.signalingState ===
            "have-local-offer"
        ) {

            await peer.setRemoteDescription(
                new RTCSessionDescription(
                    payload
                );

            state.remoteDescriptions.add(
                senderId
            );

            await flushIceCandidates(
                senderId,
                peer
            );
        }

        return;
    }


    if (
        type ===
        "ice-candidate"
    ) {

        const candidate =
            new RTCIceCandidate(
                payload
            );

        /*
         * ICE may arrive before the offer.
         * Queue it until remoteDescription exists.
         */

        if (
            !peer.remoteDescription
        ) {

            const queue =
                state.iceQueues.get(
                    senderId
                ) || [];

            queue.push(
                candidate
            );

            state.iceQueues.set(
                senderId,
                queue
            );

            return;
        }

        try {

            await peer.addIceCandidate(
                candidate
            );

        } catch (error) {

            console.warn(
                "ICE candidate failed:",
                error
            );
        }
    }
}


/* ============================================================
   ICE QUEUE
   ============================================================ */

async function flushIceCandidates(
    userId,
    peer
) {

    const queue =
        state.iceQueues.get(
            userId
        ) || [];

    if (!queue.length) {
        return;
    }

    for (
        const candidate of queue
    ) {

        try {

            await peer.addIceCandidate(
                candidate
            );

        } catch (error) {

            console.warn(
                "Queued ICE candidate failed:",
                error
            );
        }
    }

    state.iceQueues.set(
        userId,
        []
    );
}


/* ============================================================
   REMOTE VIDEO
   ============================================================ */

function attachRemoteStream(
    userId,
    stream
) {

    state.remoteStreams.set(
        userId,
        stream
    );

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

        const participant =
            state.participants.get(
                userId
            );

        const profile =
            state.profiles.get(
                userId
            );

        const name =
            profileName(
                profile
            );

        const avatar =
            profileAvatar(
                profile
            );

        tile.innerHTML = `

            <video
                autoplay
                playsinline
            ></video>

            <div
                class="video-placeholder hidden"
            >

                <div
                    class="video-placeholder-avatar"
                >
                    ${
                        avatar
                            ? ""
                            : escapeHTML(
                                initials(name)
                            )
                    }
                </div>

                <span>
                    Camera off
                </span>

            </div>

            <span class="video-label">
                ${escapeHTML(name)}
            </span>

            <span
                class="video-mute hidden"
            >
                🔇
            </span>
        `;

        if (avatar) {

            const avatarElement =
                tile.querySelector(
                    ".video-placeholder-avatar"
                );

            avatarElement.style.backgroundImage =
                `url("${avatar}")`;

            avatarElement.style.backgroundSize =
                "cover";

            avatarElement.style.backgroundPosition =
                "center";
        }

        dom.videoGrid.appendChild(
            tile
        );
    }

    const video =
        tile.querySelector(
            "video"
        );

    if (video) {

        video.srcObject =
            stream;
    }

    updateRemoteTile(
        userId
    );
}


/* ============================================================
   REMOTE TILE STATE
   ============================================================ */

function updateRemoteTile(
    userId
) {

    const tile =
        document.querySelector(
            `[data-remote-user="${CSS.escape(userId)}"]`
        );

    if (!tile) {
        return;
    }

    const participant =
        state.participants.get(
            userId
        );

    const video =
        tile.querySelector(
            "video"
        );

    const placeholder =
        tile.querySelector(
            ".video-placeholder"
        );

    const mute =
        tile.querySelector(
            ".video-mute"
        );

    const cameraOn =
        participant?.is_camera_on !== false;

    if (video) {

        video.classList.toggle(
            "hidden",
            !cameraOn
        );
    }

    placeholder
        ?.classList.toggle(
            "hidden",
            cameraOn
        );

    mute
        ?.classList.toggle(
            "hidden",
            !participant?.is_muted
        );
}


/* ============================================================
   REMOVE REMOTE
   ============================================================ */

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
        } catch {}
    }

    state.peers.delete(
        userId
    );

    state.remoteStreams.delete(
        userId
    );

    state.iceQueues.delete(
        userId
    );

    const tile =
        document.querySelector(
            `[data-remote-user="${CSS.escape(userId)}"]`
        );

    tile?.remove();
}


/* ============================================================
   PARTICIPANT UPDATE
   ============================================================ */

async function updateParticipant(
    changes
) {

    if (!state.room) {
        return;
    }

    const {
        error
    } =
        await supabase
            .from(
                "chat_call_participants"
            )
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
            "Participant update:",
            error
        );
    }
}


/* ============================================================
   MUTE
   ============================================================ */

async function toggleMute() {

    if (!state.localStream) {
        return;
    }

    state.muted =
        !state.muted;

    state.localStream
        .getAudioTracks()
        .forEach(
            track => {

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


/* ============================================================
   CAMERA
   ============================================================ */

async function toggleCamera() {

    const track =
        state.localStream
            ?.getVideoTracks()
            ?. [0];

    if (!track) {

        showError(
            "No camera track is available for this call."
        );

        return;
    }

    state.cameraOn =
        !state.cameraOn;

    track.enabled =
        state.cameraOn;

    updateLocalControls();

    await updateParticipant({
        is_camera_on:
            state.cameraOn
    });
}


/* ============================================================
   SCREEN SHARE
   ============================================================ */

async function toggleScreenShare() {

    if (state.screenSharing) {

        await stopScreenShare();

        return;
    }

    if (
        !navigator.mediaDevices
            ?.getDisplayMedia
    ) {

        showError(
            "Screen sharing is not supported by this browser."
        );

        return;
    }

    try {

        state.screenStream =
            await navigator.mediaDevices
                .getDisplayMedia({
                    video: true
                });

        const screenTrack =
            state.screenStream
                .getVideoTracks()[0];

        if (!screenTrack) {
            return;
        }

        state.peers.forEach(
            peer => {

                const sender =
                    peer
                        .getSenders()
                        .find(
                            item =>
                                item.track?.kind ===
                                "video"
                        );

                if (sender) {

                    sender.replaceTrack(
                        screenTrack
                    );
                }
            }
        );

        /*
         * Show the shared screen locally too.
         */

        dom.localVideo.srcObject =
            state.screenStream;

        state.screenSharing =
            true;

        updateLocalControls();

        await updateParticipant({
            is_screen_sharing:
                true
        });

        screenTrack.onended =
            () => {

                stopScreenShare();
            };

    } catch (error) {

        console.error(
            "Screen sharing:",
            error
        );
    }
}


/* ============================================================
   STOP SCREEN SHARE
   ============================================================ */

async function stopScreenShare() {

    if (!state.screenSharing) {
        return;
    }

    const cameraTrack =
        state.localStream
            ?.getVideoTracks()
            ?. [0];

    if (cameraTrack) {

        state.peers.forEach(
            peer => {

                const sender =
                    peer
                        .getSenders()
                        .find(
                            item =>
                                item.track?.kind ===
                                "video"
                        );

                if (sender) {

                    sender.replaceTrack(
                        cameraTrack
                    );
                }
            }
        );
    }

    if (state.screenStream) {

        state.screenStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );
    }

    state.screenStream =
        null;

    if (state.localStream) {

        dom.localVideo.srcObject =
            state.localStream;
    }

    state.screenSharing =
        false;

    updateLocalControls();

    await updateParticipant({
        is_screen_sharing:
            false
    });
}


/* ============================================================
   END CALL
   ============================================================ */

async function endCall(
    updateRoom = true
) {

    if (state.closing) {
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

    } catch (error) {

        console.warn(
            "Could not update participant:",
            error
        );
    }


    /*
     * Only the creator ends the whole room.
     */

    if (
        updateRoom &&
        state.room &&
        state.room.created_by ===
        state.user?.id
    ) {

        await supabase
            .from(
                "chat_call_rooms"
            )
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


    /*
     * Close peers.
     */

    state.peers.forEach(
        peer => {

            try {
                peer.close();
            } catch {}
        }
    );

    state.peers.clear();


    /*
     * Stop screen.
     */

    if (state.screenStream) {

        state.screenStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        state.screenStream =
            null;
    }


    /*
     * Stop microphone/camera.
     */

    if (state.localStream) {

        state.localStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        state.localStream =
            null;
    }


    /*
     * Remove realtime channels.
     */

    try {

        if (state.signalChannel) {

            await supabase
                .removeChannel(
                    state.signalChannel
                );
        }

        if (state.participantChannel) {

            await supabase
                .removeChannel(
                    state.participantChannel
                );
        }

        if (state.roomChannel) {

            await supabase
                .removeChannel(
                    state.roomChannel
                );
        }

    } catch (error) {

        console.warn(
            "Realtime cleanup:",
            error
        );
    }


    setStatus(
        "Call ended"
    );

    /*
     * Browser tabs opened with window.open()
     * may be allowed to close.
     *
     * If the browser refuses, return to community.
     */

    setTimeout(
        () => {

            try {
                window.close();
            } catch {}

            setTimeout(
                () => {

                    if (
                        window.location.href
                    ) {

                        window.location.href =
                            "./community.html";
                    }

                },
                300
            );

        },
        700
    );
}


/* ============================================================
   INITIALIZATION
   ============================================================ */

async function initialize() {

    try {

        hideError();

        parseQuery();

        renderTitle();

        await loadUser();

        await loadProfile();

        /*
         * IMPORTANT:
         *
         * Existing room = incoming call.
         * No existing room = create outgoing call.
         */

        if (
            state.existingRoomId
        ) {

            setStatus(
                "Joining call..."
            );

            await loadExistingRoom();

        } else {

            setStatus(
                "Creating call..."
            );

            await createRoom();

            /*
             * Subscribe BEFORE inviting users.
             *
             * This reduces signaling races.
             */

            subscribeRealtime();
        }


        /*
         * For incoming calls subscribe before joining.
         */

        if (
            state.existingRoomId
        ) {

            subscribeRealtime();
        }


        /*
         * Media.
         */

        await acquireLocalMedia();


        /*
         * Join participant row.
         */

        await ensureSelfParticipant();


        /*
         * Outgoing caller invites targets.
         */

        if (
            !state.existingRoomId
        ) {

            await inviteTargets();
        }


        /*
         * Load current room participants.
         */

        await loadParticipants();


        state.joined =
            true;

        state.initializationComplete =
            true;

        setStatus(
            "Connected",
            "connected"
        );


        /*
         * Participant list may change immediately after
         * we join, so refresh once.
         */

        setTimeout(
            async () => {

                if (state.closing) {
                    return;
                }

                try {

                    await loadParticipants();

                } catch (error) {

                    console.error(
                        "Participant refresh:",
                        error
                    );
                }

            },
            800
        );

    } catch (error) {

        console.error(
            "[Mwaniki Call] Initialization failed:",
            error
        );

        showError(
            error?.message ||
            "Unable to start the call."
        );
    }
}


/* ============================================================
   EVENTS
   ============================================================ */

dom.muteButton
    ?.addEventListener(
        "click",
        toggleMute
    );


dom.cameraButton
    ?.addEventListener(
        "click",
        toggleCamera
    );


dom.screenButton
    ?.addEventListener(
        "click",
        toggleScreenShare
    );


dom.endCallButton
    ?.addEventListener(
        "click",
        () =>
            endCall(true)
    );


window.addEventListener(
    "beforeunload",
    () => {

        /*
         * Do not make asynchronous Supabase requests here.
         * Browsers can terminate them immediately.
         *
         * The tracks are still stopped to release
         * microphone/camera resources.
         */

        try {

            state.localStream
                ?.getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

            state.screenStream
                ?.getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

        } catch {}
    }
);


/* ============================================================
   START
   ============================================================ */

initialize();
