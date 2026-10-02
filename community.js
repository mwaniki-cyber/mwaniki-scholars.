/* ============================================================
   MWANIKI SCHOLARS
   COMMUNITY CALL ENGINE
   VERSION: CLEAN SINGLE CALL ENGINE
   ============================================================ */

import { supabase } from "./supabase.js";


/* ============================================================
   GLOBAL DUPLICATE GUARD
   ============================================================ */

if (window.__MWANIKI_UNIVERSAL_CALL_ENGINE__) {

    console.warn(
        "⚠️ Mwaniki Universal Call Engine already loaded. Duplicate ignored."
    );

} else {

    window.__MWANIKI_UNIVERSAL_CALL_ENGINE__ = true;


    /* ========================================================
       DATABASE
       ======================================================== */

    const db = supabase;


    /* ========================================================
       CONSTANTS
       ======================================================== */

    const CALL_TYPE = {
        AUDIO: "audio",
        VIDEO: "video"
    };

    const CALL_SCOPE = {
        GENERAL: "general",
        COMMUNITY: "community",
        DIRECT: "direct"
    };

    const ROOM_STATUS = {
        WAITING: "waiting",
        ACTIVE: "active",
        ENDED: "ended"
    };

    const PARTICIPANT_STATUS = {
        INVITED: "invited",
        JOINED: "joined",
        DECLINED: "declined",
        LEFT: "left"
    };


    /* ========================================================
       STATE
       ======================================================== */

    const state = {

        user: null,

        profile: null,

        currentCommunity: null,

        currentRoom: null,

        currentCallType: null,

        currentCallScope: null,

        selectedUsers: [],

        onlineUsers: [],

        participants: [],

        profiles: new Map(),

        localStream: null,

        screenStream: null,

        peerConnections: new Map(),

        remoteStreams: new Map(),

        realtimeChannels: [],

        roomChannel: null,

        incomingChannel: null,

        audioMuted: false,

        cameraEnabled: true,

        screenSharing: false,

        pickerOpen: false,

        initialized: false,

        initializing: false,

        endingCall: false

    };


    /* ========================================================
       BASIC HELPERS
       ======================================================== */

    function byId(id) {

        return document.getElementById(id);

    }


    function query(selector) {

        return document.querySelector(selector);

    }


    function queryAll(selector) {

        return Array.from(
            document.querySelectorAll(selector)
        );

    }


    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    function escapeAttribute(value) {

        return escapeHTML(value);

    }


    function getInitials(name) {

        const words =
            String(name || "Student")
                .trim()
                .split(/\s+/)
                .filter(Boolean);

        if (!words.length) {
            return "S";
        }

        if (words.length === 1) {

            return words[0]
                .slice(0, 2)
                .toUpperCase();

        }

        return (
            words[0][0] +
            words[1][0]
        ).toUpperCase();

    }


    function toast(
        message,
        type = "info"
    ) {

        let element =
            byId("mwanikiCallToast");

        if (!element) {

            element =
                document.createElement("div");

            element.id =
                "mwanikiCallToast";

            element.style.cssText = `
                position:fixed;
                right:20px;
                bottom:20px;
                z-index:999999;
                padding:13px 18px;
                border-radius:12px;
                background:#087f73;
                color:#fff;
                font-family:Arial,sans-serif;
                font-size:14px;
                box-shadow:0 10px 30px rgba(0,0,0,.25);
                transition:.2s;
            `;

            document.body.appendChild(
                element
            );

        }

        element.textContent =
            message;

        element.style.background =
            type === "error"
                ? "#c62828"
                : type === "success"
                    ? "#087f73"
                    : "#333";

        element.style.opacity =
            "1";

        clearTimeout(
            element.__timer
        );

        element.__timer =
            setTimeout(
                () => {
                    element.style.opacity =
                        "0";
                },
                3500
            );

    }


    /* ========================================================
       CURRENT USER
       ======================================================== */

    async function loadCurrentUser() {

        const {
            data,
            error
        } =
            await db.auth.getUser();

        if (error) {
            throw error;
        }

        state.user =
            data?.user || null;

        return state.user;

    }


    /* ========================================================
       PROFILE
       ======================================================== */

    async function loadProfile() {

        if (!state.user?.id) {
            return null;
        }

        const {
            data,
            error
        } =
            await db
                .from("students")
                .select("*")
                .eq("id", state.user.id)
                .maybeSingle();

        if (error) {

            console.warn(
                "⚠️ Student profile could not be loaded:",
                error
            );

            state.profile = null;

            return null;
        }

        state.profile =
            data || null;

        if (data) {

            state.profiles.set(
                String(state.user.id),
                data
            );

        }

        return data;

    }


    /* ========================================================
       DISPLAY NAME
       ======================================================== */

    function getDisplayName(profile) {

        if (!profile) {

            if (
                state.user?.user_metadata
                    ?.full_name
            ) {

                return state.user
                    .user_metadata
                    .full_name;

            }

            if (
                state.user?.user_metadata
                    ?.name
            ) {

                return state.user
                    .user_metadata
                    .name;

            }

            if (state.user?.email) {

                return state.user.email
                    .split("@")[0];

            }

            return "Mwaniki Scholar";

        }


        return (
            profile.full_name ||
            profile.name ||
            profile.student_name ||
            profile.display_name ||
            profile.username ||
            profile.email ||
            "Mwaniki Scholar"
        );

    }


    /* ========================================================
       PHOTO
       ======================================================== */

    function getPhoto(profile) {

        if (!profile) {
            return "";
        }

        return (
            profile.photo_url ||
            profile.avatar_url ||
            profile.profile_image ||
            profile.profile_photo ||
            profile.image_url ||
            ""
        );

    }


    /* ========================================================
       PROFILE CACHE
       ======================================================== */

    async function loadProfiles(
        userIds
    ) {

        const ids =
            Array.from(
                new Set(
                    (userIds || [])
                        .filter(Boolean)
                        .map(String)
                )
            );

        if (!ids.length) {

            return new Map();

        }


        const missing =
            ids.filter(
                id =>
                    !state.profiles.has(id)
            );


        if (missing.length) {

            const {
                data,
                error
            } =
                await db
                    .from("students")
                    .select("*")
                    .in("id", missing);


            if (!error && data) {

                data.forEach(
                    profile => {

                        if (profile?.id) {

                            state.profiles.set(
                                String(profile.id),
                                profile
                            );

                        }

                    }
                );

            } else if (error) {

                console.warn(
                    "⚠️ Could not load call profiles:",
                    error
                );

            }

        }


        const result =
            new Map();


        ids.forEach(
            id => {

                if (
                    state.profiles.has(id)
                ) {

                    result.set(
                        id,
                        state.profiles.get(id)
                    );

                }

            }
        );


        return result;

    }


    /* ========================================================
       CURRENT COMMUNITY
       ======================================================== */

    function syncCommunity() {

        const community =
            window
                .mwanikiCommunity
                ?.state
                ?.currentCommunity;

        if (community) {

            state.currentCommunity =
                community;

            return community;

        }


        const storedId =
            localStorage.getItem(
                "mwanikiCommunityId"
            );


        if (storedId) {

            state.currentCommunity = {
                id: storedId
            };

        }


        return state.currentCommunity;

    }


    /* ========================================================
       ONLINE USERS
       ======================================================== */

    async function loadOnlineUsers() {

        if (!state.user?.id) {

            await loadCurrentUser();

        }


        if (!state.user?.id) {

            toast(
                "Please sign in before starting a call.",
                "error"
            );

            return [];

        }


        const cutoff =
            new Date(
                Date.now() -
                5 * 60 * 1000
            ).toISOString();


        const {
            data: presence,
            error
        } =
            await db
                .from("chat_presence")
                .select(
                    "user_id,status,last_seen_at,updated_at"
                )
                .eq(
                    "status",
                    "online"
                )
                .gte(
                    "last_seen_at",
                    cutoff
                );


        if (error) {

            console.error(
                "❌ Online users query failed:",
                error
            );

            toast(
                "Could not load online users.",
                "error"
            );

            return [];

        }


        const ids =
            (presence || [])
                .map(
                    row =>
                        String(row.user_id)
                )
                .filter(
                    id =>
                        id !==
                        String(state.user.id)
                );


        if (!ids.length) {

            state.onlineUsers =
                [];

            return [];

        }


        const profiles =
            await loadProfiles(ids);


        state.onlineUsers =
            ids
                .map(
                    id => {

                        const profile =
                            profiles.get(id);


                        return {

                            id,

                            profile,

                            name:
                                getDisplayName(
                                    profile
                                ),

                            photo:
                                getPhoto(
                                    profile
                                )

                        };

                    }
                )
                .filter(Boolean);


        return state.onlineUsers;

    }


    /* ========================================================
       USER PICKER
       ======================================================== */

    function ensurePicker() {

        if (
            byId(
                "mwanikiCallPicker"
            )
        ) {

            return;

        }


        const picker =
            document.createElement(
                "div"
            );


        picker.id =
            "mwanikiCallPicker";


        picker.className =
            "mwaniki-call-picker";


        picker.style.cssText = `
            position:fixed;
            inset:0;
            z-index:999990;
            display:none;
            align-items:center;
            justify-content:center;
            background:rgba(0,0,0,.65);
            padding:20px;
        `;


        picker.innerHTML = `

            <div
                class="mwaniki-call-picker-box"
                style="
                    width:min(520px,100%);
                    max-height:85vh;
                    overflow:auto;
                    background:#fff;
                    border-radius:18px;
                    padding:22px;
                    box-shadow:0 20px 60px rgba(0,0,0,.35);
                "
            >

                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                        margin-bottom:15px;
                    "
                >

                    <div>

                        <h2
                            id="mwanikiCallPickerTitle"
                            style="margin:0;"
                        >
                            Choose people
                        </h2>

                        <p
                            style="
                                margin:5px 0 0;
                                color:#666;
                                font-size:13px;
                            "
                        >
                            Select the online users you want to call.
                        </p>

                    </div>

                    <button
                        type="button"
                        id="mwanikiCallPickerClose"
                        style="
                            border:0;
                            background:none;
                            font-size:26px;
                            cursor:pointer;
                        "
                    >
                        ×
                    </button>

                </div>


                <div
                    id="mwanikiOnlineUsers"
                >
                    Loading online users...
                </div>


                <div
                    style="
                        display:flex;
                        gap:10px;
                        margin-top:18px;
                    "
                >

                    <button
                        type="button"
                        id="mwanikiStartVoiceCall"
                        style="
                            flex:1;
                            padding:12px;
                            border:0;
                            border-radius:10px;
                            cursor:pointer;
                        "
                    >
                        🎙️ Voice Call
                    </button>


                    <button
                        type="button"
                        id="mwanikiStartVideoCall"
                        style="
                            flex:1;
                            padding:12px;
                            border:0;
                            border-radius:10px;
                            cursor:pointer;
                        "
                    >
                        📹 Video Call
                    </button>

                </div>

            </div>

        `;


        document.body.appendChild(
            picker
        );


        byId(
            "mwanikiCallPickerClose"
        )?.addEventListener(
            "click",
            closePicker
        );


        byId(
            "mwanikiStartVoiceCall"
        )?.addEventListener(
            "click",
            () =>
                createSelectedCall(
                    CALL_TYPE.AUDIO
                )
        );


        byId(
            "mwanikiStartVideoCall"
        )?.addEventListener(
            "click",
            () =>
                createSelectedCall(
                    CALL_TYPE.VIDEO
                )
        );

    }


    /* ========================================================
       RENDER ONLINE USERS
       ======================================================== */

    function renderOnlineUsers() {

        const container =
            byId(
                "mwanikiOnlineUsers"
            );

        if (!container) {
            return;
        }


        if (
            !state.onlineUsers.length
        ) {

            container.innerHTML = `
                <div
                    style="
                        padding:25px;
                        text-align:center;
                        color:#777;
                    "
                >
                    No other users are currently online.
                </div>
            `;

            return;

        }


        container.innerHTML =
            state.onlineUsers
                .map(
                    user => {

                        const photo =
                            user.photo;


                        return `

                            <label
                                style="
                                    display:flex;
                                    align-items:center;
                                    gap:12px;
                                    padding:10px;
                                    border-radius:10px;
                                    cursor:pointer;
                                    margin-bottom:5px;
                                "
                            >

                                <input
                                    type="checkbox"
                                    class="mwaniki-call-user"
                                    value="${escapeAttribute(
                                        user.id
                                    )}"
                                >

                                ${
                                    photo

                                        ? `
                                            <img
                                                src="${escapeAttribute(
                                                    photo
                                                )}"
                                                alt="${escapeAttribute(
                                                    user.name
                                                )}"
                                                style="
                                                    width:42px;
                                                    height:42px;
                                                    border-radius:50%;
                                                    object-fit:cover;
                                                "
                                            >
                                          `

                                        : `
                                            <span
                                                style="
                                                    width:42px;
                                                    height:42px;
                                                    border-radius:50%;
                                                    display:flex;
                                                    align-items:center;
                                                    justify-content:center;
                                                    background:#087f73;
                                                    color:#fff;
                                                    font-weight:bold;
                                                "
                                            >
                                                ${escapeHTML(
                                                    getInitials(
                                                        user.name
                                                    )
                                                )}
                                            </span>
                                          `
                                }


                                <span
                                    style="
                                        flex:1;
                                        font-weight:600;
                                    "
                                >
                                    ${escapeHTML(
                                        user.name
                                    )}
                                </span>


                                <span
                                    style="
                                        color:#0a9f5a;
                                        font-size:12px;
                                    "
                                >
                                    ● Online
                                </span>

                            </label>

                        `;

                    }
                )
                .join("");

    }


    /* ========================================================
       OPEN PICKER
       ======================================================== */

    async function openPicker(
        scope = CALL_SCOPE.GENERAL
    ) {

        ensurePicker();


        state.currentCallScope =
            scope;


        const picker =
            byId(
                "mwanikiCallPicker"
            );


        if (!picker) {
            return;
        }


        picker.style.display =
            "flex";


        state.pickerOpen =
            true;


        const container =
            byId(
                "mwanikiOnlineUsers"
            );


        if (container) {

            container.innerHTML =
                "Loading online users...";

        }


        const users =
            await loadOnlineUsers();


        state.selectedUsers =
            [];


        renderOnlineUsers();

    }


    /* ========================================================
       CLOSE PICKER
       ======================================================== */

    function closePicker() {

        const picker =
            byId(
                "mwanikiCallPicker"
            );


        if (picker) {

            picker.style.display =
                "none";

        }


        state.pickerOpen =
            false;

        state.selectedUsers =
            [];

    }


    /* ========================================================
       READ SELECTED USERS
       ======================================================== */

    function getSelectedUsers() {

        return queryAll(
            ".mwaniki-call-user:checked"
        )
            .map(
                input =>
                    String(
                        input.value
                    )
            );

    }


    /* ========================================================
       ROOM CODE
       ======================================================== */

    function createRoomCode() {

        return (
            "MW-" +
            Date.now()
                .toString(36)
                .toUpperCase() +
            "-" +
            Math.random()
                .toString(36)
                .slice(2, 8)
                .toUpperCase()
        );

    }


    /* ========================================================
       CREATE ROOM
       ======================================================== */

    async function createRoom({

        communityId = null,

        callScope,

        callType

    }) {

        if (!state.user?.id) {

            await loadCurrentUser();

        }


        if (!state.user?.id) {

            throw new Error(
                "You must be signed in."
            );

        }


        const payload = {

            community_id:
                communityId || null,

            room_code:
                createRoomCode(),

            call_scope:
                callScope,

            call_type:
                callType,

            status:
                ROOM_STATUS.WAITING,

            created_by:
                state.user.id

        };


        const {
            data,
            error
        } =
            await db
                .from(
                    "chat_call_rooms"
                )
                .insert(
                    payload
                )
                .select("*")
                .single();


        if (error) {

            console.error(
                "❌ Call room creation failed:",
                error
            );

            throw error;

        }


        return data;

    }


    /* ========================================================
       ADD PARTICIPANTS
       ======================================================== */

    async function addParticipants(
        roomId,
        userIds
    ) {

        const ids =
            Array.from(
                new Set(
                    [
                        state.user?.id,
                        ...(userIds || [])
                    ]
                    .filter(Boolean)
                    .map(String)
                )
            );


        if (!ids.length) {
            return;
        }


        const rows =
            ids.map(
                userId => ({

                    room_id:
                        roomId,

                    user_id:
                        userId,

                    status:
                        userId ===
                        String(
                            state.user.id
                        )
                            ? PARTICIPANT_STATUS.JOINED
                            : PARTICIPANT_STATUS.INVITED,

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
        } =
            await db
                .from(
                    "chat_call_participants"
                )
                .insert(
                    rows
                );


        if (error) {

            console.error(
                "❌ Participant creation failed:",
                error
            );

            throw error;

        }

    }


    /* ========================================================
       CREATE SELECTED CALL
       ======================================================== */

    async function createSelectedCall(
        callType
    ) {

        const selected =
            getSelectedUsers();


        if (!selected.length) {

            toast(
                "Select at least one online user.",
                "error"
            );

            return;

        }


        try {

            const scope =
                state.currentCallScope ||
                CALL_SCOPE.GENERAL;


            let communityId =
                null;


            if (
                scope ===
                CALL_SCOPE.COMMUNITY
            ) {

                syncCommunity();


                communityId =
                    state.currentCommunity?.id ||
                    null;


                if (!communityId) {

                    toast(
                        "No active community is selected.",
                        "error"
                    );

                    return;

                }

            }


            closePicker();


            const room =
                await createRoom({

                    communityId,

                    callScope:
                        scope,

                    callType

                });


            await addParticipants(
                room.id,
                selected
            );


            await enterRoom(
                room
            );


        } catch (error) {

            console.error(
                "❌ Could not create call:",
                error
            );


            toast(
                error.message ||
                "Could not start the call.",
                "error"
            );

        }

    }


    /* ========================================================
       GENERAL CALL
       ======================================================== */

    async function startGeneralCall(
        callType = CALL_TYPE.VIDEO
    ) {

        state.currentCallScope =
            CALL_SCOPE.GENERAL;


        await openPicker(
            CALL_SCOPE.GENERAL
        );

    }


    /* ========================================================
       COMMUNITY CALL
       ======================================================== */

    async function startCommunityCall(
        callType = CALL_TYPE.VIDEO
    ) {

        syncCommunity();


        if (
            !state.currentCommunity?.id
        ) {

            toast(
                "Select a community first.",
                "error"
            );

            return;

        }


        state.currentCallScope =
            CALL_SCOPE.COMMUNITY;


        await openPicker(
            CALL_SCOPE.COMMUNITY
        );

    }


    /* ========================================================
       DIRECT CALL
       ======================================================== */

    async function startDirectCall(
        callType = CALL_TYPE.VIDEO,
        userId = null
    ) {

        /*
         * IMPORTANT:
         * userId is optional for compatibility.
         * Students are NEVER asked to type a UUID.
         */

        if (userId) {

            const selected =
                String(userId);


            const room =
                await createRoom({

                    communityId:
                        null,

                    callScope:
                        CALL_SCOPE.DIRECT,

                    callType

                });


            await addParticipants(
                room.id,
                [selected]
            );


            await enterRoom(
                room
            );

            return;

        }


        state.currentCallScope =
            CALL_SCOPE.DIRECT;


        await openPicker(
            CALL_SCOPE.DIRECT
        );

    }


    /* ========================================================
       ENTER ROOM
       ======================================================== */

    async function enterRoom(
        room
    ) {

        state.currentRoom =
            room;

        state.currentCallType =
            room.call_type;

        state.currentCallScope =
            room.call_scope;


        await createLocalStream(
            room.call_type
        );


        await db
            .from(
                "chat_call_participants"
            )
            .update({

                status:
                    PARTICIPANT_STATUS.JOINED,

                joined_at:
                    new Date()
                        .toISOString()

            })
            .eq(
                "room_id",
                room.id
            )
            .eq(
                "user_id",
                state.user.id
            );


        await db
            .from(
                "chat_call_rooms"
            )
            .update({

                status:
                    ROOM_STATUS.ACTIVE,

                started_at:
                    new Date()
                        .toISOString(),

                updated_at:
                    new Date()
                        .toISOString()

            })
            .eq(
                "id",
                room.id
            );


        await loadRoomParticipants(
            room.id
        );


        openCallWindow();

        showLocalStream();


        subscribeToRoom(
            room.id
        );


        await connectToExistingParticipants();


        toast(
            "Call started.",
            "success"
        );

    }


    /* ========================================================
       LOCAL MEDIA
       ======================================================== */

    async function createLocalStream(
        callType
    ) {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            throw new Error(
                "Your browser does not support microphone/camera access."
            );

        }


        if (state.localStream) {

            state.localStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

        }


        state.localStream =
            await navigator
                .mediaDevices
                .getUserMedia({

                    audio: true,

                    video:
                        callType ===
                        CALL_TYPE.VIDEO

                });


        state.audioMuted =
            false;


        state.cameraEnabled =
            callType ===
            CALL_TYPE.VIDEO;


        return state.localStream;

    }


    /* ========================================================
       LOAD ROOM PARTICIPANTS
       ======================================================== */

    async function loadRoomParticipants(
        roomId
    ) {

        const {
            data,
            error
        } =
            await db
                .from(
                    "chat_call_participants"
                )
                .select("*")
                .eq(
                    "room_id",
                    roomId
                )
                .neq(
                    "status",
                    PARTICIPANT_STATUS.LEFT
                );


        if (error) {

            console.error(
                "❌ Could not load call participants:",
                error
            );

            throw error;

        }


        state.participants =
            data || [];


        await loadProfiles(
            state.participants.map(
                participant =>
                    participant.user_id
            )
        );


        return state.participants;

    }


    /* ========================================================
       PEER CONNECTION
       ======================================================== */

    async function createPeer(
        remoteUserId
    ) {

        const id =
            String(remoteUserId);


        if (
            state.peerConnections.has(id)
        ) {

            return state.peerConnections.get(
                id
            );

        }


        const peer =
            new RTCPeerConnection({

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

            });


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


        peer.onicecandidate =
            async event => {

                if (
                    !event.candidate
                ) {

                    return;

                }


                await sendSignal({

                    roomId:
                        state.currentRoom.id,

                    receiverId:
                        id,

                    signalType:
                        "ice-candidate",

                    payload:
                        event.candidate

                });

            };


        peer.ontrack =
            event => {

                const stream =
                    event.streams?.[0];


                if (!stream) {
                    return;
                }


                state.remoteStreams.set(
                    id,
                    stream
                );


                renderRemoteStream(
                    id,
                    stream
                );

            };


        peer.onconnectionstatechange =
            () => {

                if (
                    [
                        "failed",
                        "closed",
                        "disconnected"
                    ].includes(
                        peer.connectionState
                    )
                ) {

                    cleanupPeer(id);

                }

            };


        state.peerConnections.set(
            id,
            peer
        );


        return peer;

    }


    /* ========================================================
       INITIATE PEER
       ======================================================== */

    async function initiatePeer(
        remoteUserId
    ) {

        const peer =
            await createPeer(
                remoteUserId
            );


        const offer =
            await peer.createOffer();


        await peer.setLocalDescription(
            offer
        );


        await sendSignal({

            roomId:
                state.currentRoom.id,

            receiverId:
                String(remoteUserId),

            signalType:
                "offer",

            payload:
                offer

        });

    }


    /* ========================================================
       ANSWER PEER
       ======================================================== */

    async function answerPeer(
        remoteUserId,
        offer
    ) {

        const peer =
            await createPeer(
                remoteUserId
            );


        await peer.setRemoteDescription(
            new RTCSessionDescription(
                offer
            )
        );


        const answer =
            await peer.createAnswer();


        await peer.setLocalDescription(
            answer
        );


        await sendSignal({

            roomId:
                state.currentRoom.id,

            receiverId:
                String(remoteUserId),

            signalType:
                "answer",

            payload:
                answer

        });

    }


    /* ========================================================
       RECEIVE ANSWER
       ======================================================== */

    async function receiveAnswer(
        remoteUserId,
        answer
    ) {

        const peer =
            state.peerConnections.get(
                String(remoteUserId)
            );


        if (!peer) {
            return;
        }


        await peer.setRemoteDescription(
            new RTCSessionDescription(
                answer
            )
        );

    }


    /* ========================================================
       RECEIVE ICE
       ======================================================== */

    async function receiveIce(
        remoteUserId,
        candidate
    ) {

        const peer =
            state.peerConnections.get(
                String(remoteUserId)
            );


        if (!peer) {
            return;
        }


        try {

            await peer.addIceCandidate(
                new RTCIceCandidate(
                    candidate
                )
            );

        } catch (error) {

            console.warn(
                "ICE candidate error:",
                error
            );

        }

    }


    /* ========================================================
       DETERMINISTIC INITIATOR
       ======================================================== */

    function shouldInitiate(
        remoteUserId
    ) {

        if (!state.user?.id) {
            return false;
        }


        return (
            String(state.user.id)
                .localeCompare(
                    String(remoteUserId)
                ) < 0
        );

    }


    /* ========================================================
       CONNECT TO PARTICIPANTS
       ======================================================== */

    async function connectToExistingParticipants() {

        const others =
            state.participants
                .filter(
                    participant =>
                        String(
                            participant.user_id
                        ) !==
                        String(
                            state.user.id
                        )
                );


        for (
            const participant
            of others
        ) {

            const remoteId =
                String(
                    participant.user_id
                );


            if (
                shouldInitiate(
                    remoteId
                )
            ) {

                try {

                    await initiatePeer(
                        remoteId
                    );

                } catch (error) {

                    console.error(
                        "Peer initiation failed:",
                        error
                    );

                }

            }

        }

    }


    /* ========================================================
       SEND SIGNAL
       ======================================================== */

    async function sendSignal({

        roomId,

        receiverId = null,

        signalType,

        payload

    }) {

        if (!state.user?.id) {
            return;
        }


        const {
            error
        } =
            await db
                .from(
                    "chat_call_signals"
                )
                .insert({

                    room_id:
                        roomId,

                    sender_id:
                        state.user.id,

                    receiver_id:
                        receiverId || null,

                    signal_type:
                        signalType,

                    payload:
                        payload || {}

                });


        if (error) {

            console.error(
                "❌ Signal error:",
                error
            );

        }

    }


    /* ========================================================
       ROOM REALTIME
       ======================================================== */

    function subscribeToRoom(
        roomId
    ) {

        cleanupRoomSubscription();


        state.roomChannel =
            db
                .channel(
                    `mwaniki-call-room-${roomId}`
                )
                .on(
                    "postgres_changes",
                    {
                        event:
                            "INSERT",

                        schema:
                            "public",

                        table:
                            "chat_call_signals",

                        filter:
                            `room_id=eq.${roomId}`

                    },
                    payload => {

                        handleSignal(
                            payload.new
                        );

                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event:
                            "*",

                        schema:
                            "public",

                        table:
                            "chat_call_participants",

                        filter:
                            `room_id=eq.${roomId}`

                    },
                    async () => {

                        await loadRoomParticipants(
                            roomId
                        );

                    }
                )
                .subscribe();

    }


    /* ========================================================
       HANDLE SIGNAL
       ======================================================== */

    async function handleSignal(
        signal
    ) {

        if (!signal) {
            return;
        }


        if (
            String(signal.sender_id) ===
            String(state.user?.id)
        ) {

            return;

        }


        if (
            signal.receiver_id &&
            String(signal.receiver_id) !==
            String(state.user?.id)
        ) {

            return;

        }


        const sender =
            String(
                signal.sender_id
            );


        switch (
            signal.signal_type
        ) {

            case "offer":

                await answerPeer(
                    sender,
                    signal.payload
                );

                break;


            case "answer":

                await receiveAnswer(
                    sender,
                    signal.payload
                );

                break;


            case "ice-candidate":

                await receiveIce(
                    sender,
                    signal.payload
                );

                break;


            case "leave":

                cleanupPeer(
                    sender
                );

                break;

        }

    }


    /* ========================================================
       CLEANUP PEER
       ======================================================== */

    function cleanupPeer(
        userId
    ) {

        const id =
            String(userId);


        const peer =
            state.peerConnections.get(
                id
            );


        if (peer) {

            try {
                peer.close();
            } catch (_) {}

        }


        state.peerConnections.delete(
            id
        );


        state.remoteStreams.delete(
            id
        );


        document
            .querySelector(
                `[data-call-remote-id="${CSS.escape(id)}"]`
            )
            ?.remove();

    }


    /* ========================================================
       CLEAN ROOM SUBSCRIPTION
       ======================================================== */

    function cleanupRoomSubscription() {

        if (
            state.roomChannel
        ) {

            try {

                db.removeChannel(
                    state.roomChannel
                );

            } catch (_) {}

        }


        state.roomChannel =
            null;

    }


    /* ========================================================
       CALL WINDOW
       ======================================================== */

    function ensureCallWindow() {

        if (
            byId(
                "mwanikiCallWindow"
            )
        ) {

            return;

        }


        const element =
            document.createElement(
                "div"
            );


        element.id =
            "mwanikiCallWindow";


        element.style.cssText = `
            position:fixed;
            inset:0;
            z-index:999980;
            display:none;
            flex-direction:column;
            background:#111;
            color:#fff;
        `;


        element.innerHTML = `

            <div
                style="
                    height:64px;
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    padding:0 20px;
                    background:#171717;
                "
            >

                <div>

                    <strong
                        id="mwanikiCallTitle"
                    >
                        Mwaniki Call
                    </strong>

                    <div
                        id="mwanikiCallStatus"
                        style="
                            font-size:12px;
                            opacity:.7;
                        "
                    >
                        Connecting...
                    </div>

                </div>


                <button
                    id="mwanikiCallClose"
                    type="button"
                    style="
                        background:none;
                        border:0;
                        color:#fff;
                        font-size:28px;
                        cursor:pointer;
                    "
                >
                    ×
                </button>

            </div>


            <div
                id="mwanikiCallStage"
                style="
                    flex:1;
                    display:flex;
                    flex-wrap:wrap;
                    align-content:center;
                    justify-content:center;
                    gap:15px;
                    padding:20px;
                    overflow:auto;
                "
            >

                <div
                    style="
                        width:min(420px,45vw);
                        min-width:260px;
                        position:relative;
                        background:#222;
                        border-radius:15px;
                        overflow:hidden;
                    "
                >

                    <video
                        id="mwanikiLocalVideo"
                        autoplay
                        muted
                        playsinline
                        style="
                            width:100%;
                            display:block;
                            background:#000;
                        "
                    ></video>

                    <span
                        style="
                            position:absolute;
                            left:10px;
                            bottom:10px;
                            background:rgba(0,0,0,.6);
                            padding:5px 9px;
                            border-radius:8px;
                        "
                    >
                        You
                    </span>

                </div>


                <div
                    id="mwanikiRemoteTiles"
                    style="
                        display:flex;
                        flex-wrap:wrap;
                        gap:15px;
                        justify-content:center;
                    "
                ></div>

            </div>


            <div
                style="
                    display:flex;
                    justify-content:center;
                    gap:15px;
                    padding:18px;
                    background:#171717;
                "
            >

                <button
                    id="mwanikiMuteButton"
                    type="button"
                >
                    🎙️
                </button>

                <button
                    id="mwanikiCameraButton"
                    type="button"
                >
                    📷
                </button>

                <button
                    id="mwanikiScreenButton"
                    type="button"
                >
                    🖥️
                </button>

                <button
                    id="mwanikiLeaveButton"
                    type="button"
                    style="
                        background:#c62828;
                        color:#fff;
                    "
                >
                    ☎ Leave
                </button>

            </div>

        `;


        document.body.appendChild(
            element
        );


        byId(
            "mwanikiCallClose"
        )?.addEventListener(
            "click",
            leaveCall
        );


        byId(
            "mwanikiMuteButton"
        )?.addEventListener(
            "click",
            toggleMute
        );


        byId(
            "mwanikiCameraButton"
        )?.addEventListener(
            "click",
            toggleCamera
        );


        byId(
            "mwanikiScreenButton"
        )?.addEventListener(
            "click",
            toggleScreenShare
        );


        byId(
            "mwanikiLeaveButton"
        )?.addEventListener(
            "click",
            leaveCall
        );

    }


    /* ========================================================
       SHOW CALL WINDOW
       ======================================================== */

    function openCallWindow() {

        ensureCallWindow();


        const element =
            byId(
                "mwanikiCallWindow"
            );


        if (element) {

            element.style.display =
                "flex";

        }


        const title =
            byId(
                "mwanikiCallTitle"
            );


        if (title) {

            title.textContent =
                state.currentCallScope ===
                CALL_SCOPE.GENERAL

                    ? "General Call"

                    : state.currentCallScope ===
                      CALL_SCOPE.COMMUNITY

                        ? (
                            state.currentCommunity
                                ?.name ||
                            "Community Call"
                          )

                        : "Direct Call";

        }


        const status =
            byId(
                "mwanikiCallStatus"
            );


        if (status) {

            status.textContent =
                state.currentCallType ===
                CALL_TYPE.AUDIO
                    ? "Voice call"
                    : "Video call";

        }

    }


    /* ========================================================
       LOCAL VIDEO
       ======================================================== */

    function showLocalStream() {

        const video =
            byId(
                "mwanikiLocalVideo"
            );


        if (
            video &&
            state.localStream
        ) {

            video.srcObject =
                state.localStream;

            video.play()
                .catch(
                    () => {}
                );

        }

    }


    /* ========================================================
       REMOTE VIDEO
       ======================================================== */

    async function renderRemoteStream(
        userId,
        stream
    ) {

        const container =
            byId(
                "mwanikiRemoteTiles"
            );


        if (!container) {
            return;
        }


        const id =
            String(userId);


        let tile =
            document.querySelector(
                `[data-call-remote-id="${CSS.escape(id)}"]`
            );


        if (!tile) {

            tile =
                document.createElement(
                    "div"
                );


            tile.dataset.callRemoteId =
                id;


            tile.style.cssText = `
                width:min(420px,45vw);
                min-width:260px;
                position:relative;
                background:#222;
                border-radius:15px;
                overflow:hidden;
            `;


            const video =
                document.createElement(
                    "video"
                );


            video.autoplay =
                true;

            video.playsInline =
                true;


            video.style.cssText = `
                width:100%;
                display:block;
                background:#000;
            `;


            tile.appendChild(
                video
            );


            const label =
                document.createElement(
                    "span"
                );


            label.className =
                "mwaniki-remote-name";


            label.style.cssText = `
                position:absolute;
                left:10px;
                bottom:10px;
                background:rgba(0,0,0,.6);
                padding:5px 9px;
                border-radius:8px;
            `;


            label.textContent =
                "Mwaniki Scholar";


            tile.appendChild(
                label
            );


            container.appendChild(
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

            video.play()
                .catch(
                    () => {}
                );

        }


        const profiles =
            await loadProfiles(
                [id]
            );


        const profile =
            profiles.get(id);


        const label =
            tile.querySelector(
                ".mwaniki-remote-name"
            );


        if (label) {

            label.textContent =
                getDisplayName(
                    profile
                );

        }

    }


    /* ========================================================
       MUTE
       ======================================================== */

    async function toggleMute() {

        if (!state.localStream) {
            return;
        }


        state.audioMuted =
            !state.audioMuted;


        state.localStream
            .getAudioTracks()
            .forEach(
                track => {

                    track.enabled =
                        !state.audioMuted;

                }
            );


        const button =
            byId(
                "mwanikiMuteButton"
            );


        if (button) {

            button.textContent =
                state.audioMuted
                    ? "🔇"
                    : "🎙️";

        }


        await updateParticipant({

            is_muted:
                state.audioMuted

        });

    }


    /* ========================================================
       CAMERA
       ======================================================== */

    async function toggleCamera() {

        if (!state.localStream) {
            return;
        }


        const tracks =
            state.localStream
                .getVideoTracks();


        if (!tracks.length) {

            toast(
                "This is an audio-only call.",
                "info"
            );

            return;

        }


        state.cameraEnabled =
            !state.cameraEnabled;


        tracks.forEach(
            track => {

                track.enabled =
                    state.cameraEnabled;

            }
        );


        const button =
            byId(
                "mwanikiCameraButton"
            );


        if (button) {

            button.textContent =
                state.cameraEnabled
                    ? "📷"
                    : "🚫";

        }


        await updateParticipant({

            is_camera_on:
                state.cameraEnabled

        });

    }


    /* ========================================================
       SCREEN SHARE
       ======================================================== */

    async function toggleScreenShare() {

        if (
            state.screenSharing
        ) {

            await stopScreenShare();

            return;

        }


        if (
            !navigator.mediaDevices
                ?.getDisplayMedia
        ) {

            toast(
                "Screen sharing is not supported.",
                "error"
            );

            return;

        }


        try {

            state.screenStream =
                await navigator
                    .mediaDevices
                    .getDisplayMedia({
                        video:true
                    });


            const track =
                state.screenStream
                    .getVideoTracks()[0];


            for (
                const peer
                of state.peerConnections.values()
            ) {

                const sender =
                    peer
                        .getSenders()
                        .find(
                            item =>
                                item.track
                                    ?.kind ===
                                "video"
                        );


                if (sender) {

                    await sender.replaceTrack(
                        track
                    );

                }

            }


            state.screenSharing =
                true;


            const video =
                byId(
                    "mwanikiLocalVideo"
                );


            if (video) {

                video.srcObject =
                    state.screenStream;

            }


            await updateParticipant({

                is_screen_sharing:
                    true

            });


            track.onended =
                () => {

                    stopScreenShare();

                };

        } catch (error) {

            console.warn(
                "Screen sharing cancelled:",
                error
            );

        }

    }


    /* ========================================================
       STOP SCREEN SHARE
       ======================================================== */

    async function stopScreenShare() {

        const cameraTrack =
            state.localStream
                ?.getVideoTracks()[0];


        for (
            const peer
            of state.peerConnections.values()
        ) {

            const sender =
                peer
                    .getSenders()
                    .find(
                        item =>
                            item.track
                                ?.kind ===
                            "video"
                    );


            if (
                sender &&
                cameraTrack
            ) {

                await sender.replaceTrack(
                    cameraTrack
                );

            }

        }


        state.screenStream
            ?.getTracks()
            .forEach(
                track =>
                    track.stop()
            );


        state.screenStream =
            null;


        state.screenSharing =
            false;


        showLocalStream();


        await updateParticipant({

            is_screen_sharing:
                false

        });

    }


    /* ========================================================
       UPDATE PARTICIPANT
       ======================================================== */

    async function updateParticipant(
        values
    ) {

        if (
            !state.currentRoom?.id ||
            !state.user?.id
        ) {

            return;

        }


        const {
            error
        } =
            await db
                .from(
                    "chat_call_participants"
                )
                .update(
                    values
                )
                .eq(
                    "room_id",
                    state.currentRoom.id
                )
                .eq(
                    "user_id",
                    state.user.id
                );


        if (error) {

            console.warn(
                "Participant update failed:",
                error
            );

        }

    }


    /* ========================================================
       LEAVE CALL
       ======================================================== */

    async function leaveCall() {

        if (
            state.endingCall
        ) {

            return;

        }


        state.endingCall =
            true;


        try {

            await updateParticipant({

                status:
                    PARTICIPANT_STATUS.LEFT,

                left_at:
                    new Date()
                        .toISOString(),

                is_muted:
                    true,

                is_camera_on:
                    false,

                is_screen_sharing:
                    false

            });


            if (
                state.currentRoom
            ) {

                await sendSignal({

                    roomId:
                        state.currentRoom.id,

                    receiverId:
                        null,

                    signalType:
                        "leave",

                    payload:{}

                });


                if (
                    state.currentRoom
                        .created_by ===
                    state.user?.id
                ) {

                    await db
                        .from(
                            "chat_call_rooms"
                        )
                        .update({

                            status:
                                ROOM_STATUS.ENDED,

                            ended_at:
                                new Date()
                                    .toISOString()

                        })
                        .eq(
                            "id",
                            state.currentRoom.id
                        );

                }

            }

        } catch (error) {

            console.error(
                "Leave call error:",
                error
            );

        }


        state.peerConnections
            .forEach(
                peer => {

                    try {
                        peer.close();
                    } catch (_) {}

                }
            );


        state.peerConnections.clear();


        state.remoteStreams.clear();


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


        cleanupRoomSubscription();


        state.localStream =
            null;

        state.screenStream =
            null;

        state.currentRoom =
            null;

        state.participants =
            [];


        const windowElement =
            byId(
                "mwanikiCallWindow"
            );


        if (windowElement) {

            windowElement.style.display =
                "none";

        }


        const localVideo =
            byId(
                "mwanikiLocalVideo"
            );


        if (localVideo) {

            localVideo.srcObject =
                null;

        }


        const remote =
            byId(
                "mwanikiRemoteTiles"
            );


        if (remote) {

            remote.innerHTML =
                "";

        }


        state.endingCall =
            false;


        toast(
            "You left the call.",
            "info"
        );

    }


    /* ========================================================
       INCOMING CALLS
       ======================================================== */

    function subscribeToIncomingCalls() {

        if (
            !state.user?.id
        ) {

            return;

        }


        if (
            state.incomingChannel
        ) {

            return;

        }


        state.incomingChannel =
            db
                .channel(
                    `mwaniki-incoming-${state.user.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event:
                            "INSERT",

                        schema:
                            "public",

                        table:
                            "chat_call_participants",

                        filter:
                            `user_id=eq.${state.user.id}`

                    },
                    payload => {

                        handleIncomingCall(
                            payload.new
                        );

                    }
                )
                .subscribe();

    }


    /* ========================================================
       HANDLE INCOMING CALL
       ======================================================== */

    async function handleIncomingCall(
        participant
    ) {

        if (
            !participant?.room_id
        ) {

            return;

        }


        if (
            participant.status !==
            PARTICIPANT_STATUS.INVITED
        ) {

            return;

        }


        const {
            data: room,
            error
        } =
            await db
                .from(
                    "chat_call_rooms"
                )
                .select("*")
                .eq(
                    "id",
                    participant.room_id
                )
                .maybeSingle();


        if (
            error ||
            !room ||
            room.status ===
            ROOM_STATUS.ENDED
        ) {

            return;

        }


        const profiles =
            await loadProfiles(
                [room.created_by]
            );


        const caller =
            profiles.get(
                String(
                    room.created_by
                )
            );


        showIncomingCall({

            room,

            participant,

            callerName:
                getDisplayName(
                    caller
                ),

            callerPhoto:
                getPhoto(
                    caller
                )

        });

    }


    /* ========================================================
       INCOMING UI
       ======================================================== */

    function showIncomingCall({
        room,
        participant,
        callerName,
        callerPhoto
    }) {

        byId(
            "mwanikiIncomingCall"
        )?.remove();


        const element =
            document.createElement(
                "div"
            );


        element.id =
            "mwanikiIncomingCall";


        element.style.cssText = `
            position:fixed;
            right:20px;
            bottom:20px;
            z-index:999999;
            width:min(390px,calc(100vw - 40px));
            background:#fff;
            color:#222;
            border-radius:18px;
            padding:18px;
            box-shadow:0 20px 60px rgba(0,0,0,.3);
        `;


        element.innerHTML = `

            <div
                style="
                    display:flex;
                    gap:12px;
                    align-items:center;
                "
            >

                ${
                    callerPhoto

                        ? `
                            <img
                                src="${escapeAttribute(
                                    callerPhoto
                                )}"
                                style="
                                    width:52px;
                                    height:52px;
                                    border-radius:50%;
                                    object-fit:cover;
                                "
                            >
                          `

                        : `
                            <div
                                style="
                                    width:52px;
                                    height:52px;
                                    border-radius:50%;
                                    display:flex;
                                    align-items:center;
                                    justify-content:center;
                                    background:#087f73;
                                    color:#fff;
                                    font-weight:bold;
                                "
                            >
                                ${escapeHTML(
                                    getInitials(
                                        callerName
                                    )
                                )}
                            </div>
                          `
                }


                <div>

                    <strong>
                        ${escapeHTML(
                            callerName
                        )}
                    </strong>

                    <div
                        style="
                            font-size:13px;
                            color:#777;
                        "
                    >
                        Incoming ${
                            room.call_type ===
                            CALL_TYPE.AUDIO
                                ? "voice"
                                : "video"
                        } call
                    </div>

                </div>

            </div>


            <div
                style="
                    display:flex;
                    gap:10px;
                    margin-top:15px;
                "
            >

                <button
                    id="mwanikiAnswerCall"
                    type="button"
                    style="
                        flex:1;
                        padding:10px;
                        border:0;
                        border-radius:10px;
                        background:#087f73;
                        color:#fff;
                        cursor:pointer;
                    "
                >
                    Answer
                </button>


                <button
                    id="mwanikiDeclineCall"
                    type="button"
                    style="
                        flex:1;
                        padding:10px;
                        border:0;
                        border-radius:10px;
                        background:#ddd;
                        cursor:pointer;
                    "
                >
                    Decline
                </button>

            </div>

        `;


        document.body.appendChild(
            element
        );


        byId(
            "mwanikiAnswerCall"
        )?.addEventListener(
            "click",
            async () => {

                element.remove();

                await answerIncomingCall(
                    room,
                    participant
                );

            }
        );


        byId(
            "mwanikiDeclineCall"
        )?.addEventListener(
            "click",
            async () => {

                element.remove();

                await declineCall(
                    participant.id
                );

            }
        );

    }


    /* ========================================================
       ANSWER
       ======================================================== */

    async function answerIncomingCall(
        room,
        participant
    ) {

        try {

            state.currentRoom =
                room;

            state.currentCallType =
                room.call_type;

            state.currentCallScope =
                room.call_scope;


            await createLocalStream(
                room.call_type
            );


            await db
                .from(
                    "chat_call_participants"
                )
                .update({

                    status:
                        PARTICIPANT_STATUS.JOINED,

                    joined_at:
                        new Date()
                            .toISOString()

                })
                .eq(
                    "id",
                    participant.id
                );


            await loadRoomParticipants(
                room.id
            );


            openCallWindow();

            showLocalStream();


            subscribeToRoom(
                room.id
            );


            await connectToExistingParticipants();


            toast(
                "Call connected.",
                "success"
            );

        } catch (error) {

            console.error(
                "❌ Answer call failed:",
                error
            );


            toast(
                error.message ||
                "Could not answer the call.",
                "error"
            );

        }

    }


    /* ========================================================
       DECLINE
       ======================================================== */

    async function declineCall(
        participantId
    ) {

        if (!participantId) {
            return;
        }


        const {
            error
        } =
            await db
                .from(
                    "chat_call_participants"
                )
                .update({

                    status:
                        PARTICIPANT_STATUS.DECLINED,

                    left_at:
                        new Date()
                            .toISOString()

                })
                .eq(
                    "id",
                    participantId
                );


        if (error) {

            console.error(
                "Decline call failed:",
                error
            );

        }

    }


    /* ========================================================
       BUTTON HELPERS
       ======================================================== */

    function bind(
        selector,
        callback
    ) {

        queryAll(selector)
            .forEach(
                button => {

                    if (
                        button.dataset
                            .mwanikiCallBound
                    ) {

                        return;

                    }


                    button.dataset
                        .mwanikiCallBound =
                        "true";


                    button.addEventListener(
                        "click",
                        event => {

                            event.preventDefault();

                            callback();

                        }
                    );

                }
            );

    }


    /* ========================================================
       CALL BUTTONS
       ======================================================== */

    function bindButtons() {

        bind(
            "#generalCallButton",
            () =>
                startGeneralCall(
                    CALL_TYPE.VIDEO
                )
        );


        bind(
            "[data-general-call]",
            () =>
                startGeneralCall(
                    CALL_TYPE.VIDEO
                )
        );


        bind(
            "#generalVoiceCallButton",
            () =>
                startGeneralCall(
                    CALL_TYPE.AUDIO
                )
        );


        bind(
            "#videoCallButton",
            () =>
                startCommunityCall(
                    CALL_TYPE.VIDEO
                )
        );


        bind(
            ".video-call-button",
            () =>
                startCommunityCall(
                    CALL_TYPE.VIDEO
                )
        );


        bind(
            '[data-call-type="video"]',
            () =>
                startCommunityCall(
                    CALL_TYPE.VIDEO
                )
        );


        bind(
            "#voiceCallButton",
            () =>
                startCommunityCall(
                    CALL_TYPE.AUDIO
                )
        );


        bind(
            ".voice-call-button",
            () =>
                startCommunityCall(
                    CALL_TYPE.AUDIO
                )
        );


        bind(
            '[data-call-type="voice"]',
            () =>
                startCommunityCall(
                    CALL_TYPE.AUDIO
                )
        );


        bind(
            "#directCallButton",
            () =>
                startDirectCall(
                    CALL_TYPE.VIDEO
                )
        );


        bind(
            "[data-direct-call]",
            () =>
                startDirectCall(
                    CALL_TYPE.VIDEO
                )
        );

    }


    /* ========================================================
       INITIALIZATION
       ======================================================== */

    async function initialize() {

        if (
            state.initialized ||
            state.initializing
        ) {

            return;

        }


        state.initializing =
            true;


        console.log(
            "📞 Mwaniki Universal Call Engine loading..."
        );


        try {

            await loadCurrentUser();


            if (!state.user) {

                console.warn(
                    "⚠️ No signed-in user. Waiting for authentication."
                );

            } else {

                await loadProfile();

                subscribeToIncomingCalls();

            }


            syncCommunity();

            ensurePicker();

            ensureCallWindow();

            bindButtons();


            state.initialized =
                true;


            console.log(
                "✅ Mwaniki Universal Call Engine ready"
            );

        } catch (error) {

            console.error(
                "❌ Call engine initialization failed:",
                error
            );

        } finally {

            state.initializing =
                false;

        }

    }


    /* ========================================================
       AUTH LISTENER
       ======================================================== */

    db.auth.onAuthStateChange(
        async (
            event,
            session
        ) => {

            if (
                event ===
                "SIGNED_IN"
            ) {

                state.user =
                    session?.user ||
                    null;


                await loadProfile();


                subscribeToIncomingCalls();


                bindButtons();

            }


            if (
                event ===
                "SIGNED_OUT"
            ) {

                if (
                    state.currentRoom
                ) {

                    await leaveCall();

                }


                state.user =
                    null;

                state.profile =
                    null;

            }

        }
    );


    /* ========================================================
       COMMUNITY CHANGE EVENT
       ======================================================== */

    window.addEventListener(
        "mwaniki:communityChanged",
        () => {

            syncCommunity();

        }
    );


    /* ========================================================
       PUBLIC API
       ======================================================== */

    window.mwanikiCallEngine = {

        state,

        initialize,

        openPicker,

        closePicker,

        startGeneralCall,

        startCommunityCall,

        startDirectCall,

        leaveCall,

        toggleMute,

        toggleCamera,

        toggleScreenShare,

        stopScreenShare,

        loadOnlineUsers

    };


    window.startGeneralCall =
        startGeneralCall;


    window.startCommunityCall =
        startCommunityCall;


    window.startDirectCall =
        startDirectCall;


    window.leaveMwanikiCall =
        leaveCall;


    /* ========================================================
       START
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once:true
            }
        );

    } else {

        initialize();

    }

}
