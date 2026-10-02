/* ============================================================
   MWANIKI SCHOLARS
   UNIVERSAL CALL ENGINE
   community-calls.js
   ============================================================

   ONE CALL ENGINE ONLY.

   Supports:
   - General calls
   - Community calls
   - Direct calls
   - Audio calls
   - Video calls
   - Multiple simultaneous communities
   - Multiple independent call rooms
   - Online user selection
   - Real student names
   - Real student profile photos
   - WebRTC
   - Supabase signaling
   - Microphone
   - Camera
   - Screen sharing
   - Incoming calls

   DATABASE TABLES:

   chat_call_rooms
   chat_call_participants
   chat_call_signals
   chat_presence
   students

   ============================================================ */

import { supabase } from "./supabase.js";


/* ============================================================
   ENGINE GUARD
   ============================================================ */

if (!window.__MWANIKI_UNIVERSAL_CALL_ENGINE__) {

    window.__MWANIKI_UNIVERSAL_CALL_ENGINE__ = true;


    /* ========================================================
       DATABASE
       ======================================================== */

    const db = supabase;


    /* ========================================================
       CONSTANTS
       ======================================================== */

    const CALL_SCOPE = {
        GENERAL: "general",
        COMMUNITY: "community",
        DIRECT: "direct"
    };

    const CALL_TYPE = {
        AUDIO: "audio",
        VIDEO: "video"
    };

    const ROOM_STATUS = {
        WAITING: "waiting",
        ACTIVE: "active",
        ENDED: "ended"
    };

    const PARTICIPANT_STATUS = {
        INVITED: "invited",
        JOINED: "joined",
        LEFT: "left",
        DECLINED: "declined"
    };


    const RTC_CONFIGURATION = {

        iceServers: [

            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302"
                ]
            }

        ]

    };


    /* ========================================================
       ENGINE STATE
       ======================================================== */

    const state = {

        initialized: false,

        user: null,

        profile: null,

        currentCommunity: null,

        currentCommunityId: null,

        currentRoom: null,

        currentCallType: null,

        currentCallScope: null,

        currentCallMode: null,

        localStream: null,

        screenStream: null,

        peerConnections: new Map(),

        remoteStreams: new Map(),

        onlineUsers: [],

        selectedUsers: new Set(),

        participants: [],

        realtimeChannels: [],

        pickerOpen: false,

        pickerMode: null,

        pickerSingle: false,

        endingCall: false,

        profileCache: new Map(),

        incomingCalls: new Map(),

        audioMuted: false,

        cameraEnabled: true,

        screenSharing: false

    };


    /* ========================================================
       BASIC DOM HELPERS
       ======================================================== */

    function byId(id) {

        return document.getElementById(id);

    }


    function query(selector) {

        return document.querySelector(selector);

    }


    function queryAll(selector) {

        return [
            ...document.querySelectorAll(selector)
        ];

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


    /* ========================================================
       TOAST
       ======================================================== */

    function toast(message, type = "info") {

        if (typeof window.toast === "function") {

            window.toast(
                message,
                type
            );

            return;

        }


        let element =
            byId("mwanikiCallToast");


        if (!element) {

            element =
                document.createElement("div");

            element.id =
                "mwanikiCallToast";

            element.className =
                "mwaniki-call-toast";

            document.body.appendChild(
                element
            );

        }


        element.textContent =
            message;

        element.dataset.type =
            type;

        element.classList.add(
            "visible"
        );


        clearTimeout(
            element.__timer
        );


        element.__timer =
            setTimeout(() => {

                element.classList.remove(
                    "visible"
                );

            }, 3500);

    }


    /* ========================================================
       PROFILE HELPERS
       ======================================================== */

    function getDisplayName(profile) {

        if (!profile) {

            return "Mwaniki Scholar";

        }


        return (

            profile.full_name ||

            profile.name ||

            profile.student_name ||

            profile.display_name ||

            profile.username ||

            profile.email?.split("@")[0] ||

            "Mwaniki Scholar"

        );

    }


    function getPhoto(profile) {

        if (!profile) {

            return "";

        }


        return (

            profile.photo_url ||

            profile.avatar_url ||

            profile.profile_photo ||

            profile.profile_image ||

            profile.image_url ||

            profile.photo ||

            ""

        );

    }


    function getInitials(name) {

        const clean =
            String(
                name ||
                "Mwaniki Scholar"
            )
                .trim();


        if (!clean) {

            return "MS";

        }


        const parts =
            clean
                .split(/\s+/)
                .filter(Boolean);


        if (parts.length === 1) {

            return parts[0]
                .substring(0, 2)
                .toUpperCase();

        }


        return (

            parts[0][0] +

            parts[
                parts.length - 1
            ][0]

        ).toUpperCase();

    }


    /* ========================================================
       AUTHENTICATION
       ======================================================== */

    async function loadUser() {

        const {
            data,
            error
        } =
            await db.auth.getUser();


        if (error) {

            console.error(
                "❌ Call authentication error:",
                error
            );

            state.user =
                null;

            return null;

        }


        state.user =
            data?.user ||
            null;


        return state.user;

    }


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
                .eq(
                    "id",
                    state.user.id
                )
                .maybeSingle();


        if (error) {

            console.warn(
                "⚠️ Could not load call profile:",
                error
            );

            return null;

        }


        state.profile =
            data ||
            null;


        if (data) {

            state.profileCache.set(
                String(data.id),
                data
            );

        }


        return data;

    }


    /* ========================================================
       COMMUNITY STATE
       ======================================================== */

    function syncCommunity() {

        const community =
            window
                .mwanikiCommunity
                ?.state;


        if (!community) {

            return;

        }


        state.currentCommunity =
            community.currentCommunity ||
            null;


        state.currentCommunityId =
            community
                .currentCommunity
                ?.id ||
            null;

    }


    function getCommunityId() {

        syncCommunity();

        return (
            state.currentCommunityId ||
            null
        );

    }


    /* ========================================================
       PROFILE CACHE
       ======================================================== */

    async function loadProfiles(userIds) {

        const ids =
            [
                ...new Set(
                    (userIds || [])
                        .filter(Boolean)
                        .map(
                            id =>
                                String(id)
                        )
                )
            ];


        if (!ids.length) {

            return new Map();

        }


        const missing =
            ids.filter(
                id =>
                    !state.profileCache.has(id)
            );


        if (missing.length) {

            const {
                data,
                error
            } =
                await db
                    .from("students")
                    .select("*")
                    .in(
                        "id",
                        missing
                    );


            if (error) {

                console.warn(
                    "⚠️ Student profile lookup failed:",
                    error
                );

            } else {

                (data || [])
                    .forEach(profile => {

                        state.profileCache.set(
                            String(profile.id),
                            profile
                        );

                    });

            }

        }


        const result =
            new Map();


        ids.forEach(id => {

            result.set(
                id,
                state.profileCache.get(id) ||
                null
            );

        });


        return result;

    }


    /* ========================================================
       ONLINE USERS
       ======================================================== */

    async function loadOnlineUsers(options = {}) {

        if (!state.user) {

            await loadUser();

        }


        if (!state.user?.id) {

            throw new Error(
                "You must be signed in."
            );

        }


        const communityOnly =
            options.communityOnly === true;


        const communityId =
            options.communityId ||
            null;


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
                );


        if (error) {

            console.error(
                "❌ chat_presence error:",
                error
            );

            throw error;

        }


        const now =
            Date.now();


        const fiveMinutes =
            5 * 60 * 1000;


        let online =
            (presence || [])
                .filter(row => {

                    if (
                        String(row.user_id) ===
                        String(state.user.id)
                    ) {

                        return false;

                    }


                    const lastSeen =
                        new Date(
                            row.last_seen_at ||
                            row.updated_at ||
                            0
                        )
                            .getTime();


                    return (
                        now - lastSeen <=
                        fiveMinutes
                    );

                });


        if (
            communityOnly &&
            communityId
        ) {

            const {
                data: members,
                error: memberError
            } =
                await db
                    .from(
                        "chat_community_members"
                    )
                    .select("user_id")
                    .eq(
                        "community_id",
                        communityId
                    )
                    .eq(
                        "is_banned",
                        false
                    );


            if (memberError) {

                throw memberError;

            }


            const memberIds =
                new Set(
                    (members || [])
                        .map(
                            row =>
                                String(
                                    row.user_id
                                )
                        )
                );


            online =
                online.filter(
                    row =>
                        memberIds.has(
                            String(
                                row.user_id
                            )
                        )
                );

        }


        const ids =
            online.map(
                row =>
                    row.user_id
            );


        const profiles =
            await loadProfiles(
                ids
            );


        state.onlineUsers =
            online.map(row => {

                const profile =
                    profiles.get(
                        String(
                            row.user_id
                        )
                    );


                return {

                    user_id:
                        row.user_id,

                    status:
                        row.status,

                    last_seen_at:
                        row.last_seen_at,

                    updated_at:
                        row.updated_at,

                    profile,

                    display_name:
                        getDisplayName(
                            profile
                        ),

                    photo_url:
                        getPhoto(
                            profile
                        )

                };

            });


        state.onlineUsers.sort(
            (a, b) =>
                a.display_name.localeCompare(
                    b.display_name
                )
        );


        return state.onlineUsers;

    }


    /* ========================================================
       USER PICKER HTML
       ======================================================== */

    function ensurePicker() {

        if (
            byId(
                "mwanikiCallUserPicker"
            )
        ) {

            return;

        }


        const picker =
            document.createElement("div");


        picker.id =
            "mwanikiCallUserPicker";


        picker.className =
            "mwaniki-call-picker hidden";


        picker.innerHTML = `

            <div
                class="mwaniki-call-picker-backdrop"
                data-call-picker-close
            ></div>

            <section
                class="mwaniki-call-picker-panel"
            >

                <header
                    class="mwaniki-call-picker-header"
                >

                    <div>

                        <h2
                            id="mwanikiCallPickerTitle"
                        >
                            Start a Call
                        </h2>

                        <p
                            id="mwanikiCallPickerSubtitle"
                        >
                            Select online users.
                        </p>

                    </div>

                    <button
                        type="button"
                        id="mwanikiCallPickerClose"
                        aria-label="Close"
                    >
                        ×
                    </button>

                </header>


                <div
                    class="mwaniki-call-picker-toolbar"
                >

                    <span
                        id="mwanikiCallSelectedCount"
                    >
                        0 selected
                    </span>

                </div>


                <div
                    id="mwanikiCallOnlineList"
                    class="mwaniki-call-online-list"
                ></div>


                <footer
                    class="mwaniki-call-picker-footer"
                >

                    <button
                        type="button"
                        id="mwanikiCallStartButton"
                        disabled
                    >
                        Start Call
                    </button>

                </footer>

            </section>

        `;


        document.body.appendChild(
            picker
        );


        byId(
            "mwanikiCallPickerClose"
        )
            ?.addEventListener(
                "click",
                closePicker
            );


        query(
            "[data-call-picker-close]"
        )
            ?.addEventListener(
                "click",
                closePicker
            );


        byId(
            "mwanikiCallStartButton"
        )
            ?.addEventListener(
                "click",
                startPickerCall
            );

    }


    /* ========================================================
       OPEN PICKER
       ======================================================== */

    async function openPicker(options = {}) {

        ensurePicker();


        const mode =
            options.mode ||
            CALL_SCOPE.GENERAL;


        const callType =
            options.callType ||
            CALL_TYPE.VIDEO;


        const communityOnly =
            options.communityOnly === true;


        state.pickerMode =
            mode;


        state.pickerSingle =
            options.single === true;


        state.currentCallType =
            callType;


        state.selectedUsers =
            new Set();


        const picker =
            byId(
                "mwanikiCallUserPicker"
            );


        const title =
            byId(
                "mwanikiCallPickerTitle"
            );


        const subtitle =
            byId(
                "mwanikiCallPickerSubtitle"
            );


        const list =
            byId(
                "mwanikiCallOnlineList"
            );


        if (title) {

            if (
                mode === CALL_SCOPE.DIRECT
            ) {

                title.textContent =
                    "Call a Mwaniki Scholar";

            } else if (
                mode === CALL_SCOPE.COMMUNITY
            ) {

                title.textContent =
                    "Community Call";

            } else {

                title.textContent =
                    "General Call";

            }

        }


        if (subtitle) {

            if (
                mode === CALL_SCOPE.DIRECT
            ) {

                subtitle.textContent =
                    "Select one online person.";

            } else if (
                mode === CALL_SCOPE.COMMUNITY
            ) {

                subtitle.textContent =
                    "Select online members of this community.";

            } else {

                subtitle.textContent =
                    "Select the online people you want to call.";

            }

        }


        list.innerHTML = `

            <div
                class="mwaniki-call-loading"
            >
                Loading online users...
            </div>

        `;


        updateSelectedCount();


        picker.classList.remove(
            "hidden"
        );


        state.pickerOpen =
            true;


        try {

            const users =
                await loadOnlineUsers({

                    communityOnly,

                    communityId:
                        communityOnly
                            ? getCommunityId()
                            : null

                });


            renderOnlineUsers(
                users
            );

        } catch (error) {

            console.error(
                "❌ Could not load online users:",
                error
            );


            list.innerHTML = `

                <div
                    class="mwaniki-call-error"
                >
                    Unable to load online users.
                </div>

            `;


            toast(
                error.message ||
                "Could not load online users.",
                "error"
            );

        }

    }


    /* ========================================================
       CLOSE PICKER
       ======================================================== */

    function closePicker() {

        byId(
            "mwanikiCallUserPicker"
        )
            ?.classList.add(
                "hidden"
            );


        state.pickerOpen =
            false;


        state.selectedUsers =
            new Set();


        updateSelectedCount();

    }


    /* ========================================================
       RENDER ONLINE USERS
       ======================================================== */

    function renderOnlineUsers(users) {

        const list =
            byId(
                "mwanikiCallOnlineList"
            );


        if (!list) {

            return;

        }


        list.innerHTML =
            "";


        if (!users.length) {

            list.innerHTML = `

                <div
                    class="mwaniki-call-empty"
                >

                    <strong>
                        No other users are online
                    </strong>

                    <span>
                        Online users will appear here.
                    </span>

                </div>

            `;


            updateSelectedCount();

            return;

        }


        users.forEach(user => {

            const row =
                document.createElement(
                    "button"
                );


            row.type =
                "button";


            row.className =
                "mwaniki-call-user-row";


            row.dataset.userId =
                String(
                    user.user_id
                );


            const photo =
                user.photo_url;


            const avatar =
                photo

                    ? `

                        <img
                            src="${escapeAttribute(
                                photo
                            )}"
                            alt="${escapeAttribute(
                                user.display_name
                            )}"
                        >

                    `

                    : `

                        <span>
                            ${escapeHTML(
                                getInitials(
                                    user.display_name
                                )
                            )}
                        </span>

                    `;


            row.innerHTML = `

                <span
                    class="mwaniki-call-avatar"
                >
                    ${avatar}
                </span>

                <span
                    class="mwaniki-call-user-details"
                >

                    <strong>
                        ${escapeHTML(
                            user.display_name
                        )}
                    </strong>

                    <small>
                        ● Online
                    </small>

                </span>

                <span
                    class="mwaniki-call-check"
                >
                    ✓
                </span>

            `;


            row.addEventListener(
                "click",
                () =>
                    toggleUser(
                        user.user_id
                    )
            );


            list.appendChild(
                row
            );

        });


        updateSelectedCount();

    }


    /* ========================================================
       TOGGLE USER
       ======================================================== */

    function toggleUser(userId) {

        const id =
            String(userId);


        if (state.pickerSingle) {

            state.selectedUsers =
                new Set([id]);

        } else {

            if (
                state.selectedUsers.has(id)
            ) {

                state.selectedUsers.delete(id);

            } else {

                state.selectedUsers.add(id);

            }

        }


        queryAll(
            ".mwaniki-call-user-row"
        )
            .forEach(row => {

                const selected =
                    state.selectedUsers.has(
                        String(
                            row.dataset.userId
                        )
                    );


                row.classList.toggle(
                    "selected",
                    selected
                );


                row.setAttribute(
                    "aria-pressed",
                    selected
                        ? "true"
                        : "false"
                );

            });


        updateSelectedCount();

    }


    /* ========================================================
       SELECTED COUNT
       ======================================================== */

    function updateSelectedCount() {

        const count =
            state.selectedUsers.size;


        const label =
            byId(
                "mwanikiCallSelectedCount"
            );


        if (label) {

            label.textContent =
                `${count} ${
                    count === 1
                        ? "person"
                        : "people"
                } selected`;

        }


        const button =
            byId(
                "mwanikiCallStartButton"
            );


        if (button) {

            button.disabled =
                count === 0;

        }

    }


    /* ========================================================
       START PICKER CALL
       ======================================================== */

    async function startPickerCall() {

        const userIds =
            [
                ...state.selectedUsers
            ];


        if (!userIds.length) {

            toast(
                "Select at least one online user.",
                "error"
            );


            return;

        }


        const callType =
            state.currentCallType ||
            CALL_TYPE.VIDEO;


        const mode =
            state.pickerMode;


        closePicker();


        await startCall({

            userIds,

            callType,

            callScope:
                mode,

            communityId:
                mode === CALL_SCOPE.GENERAL
                    ? null
                    : getCommunityId()

        });

    }


    /* ========================================================
       ROOM CODE
       ======================================================== */

    function generateRoomCode() {

        const random =
            Math.random()
                .toString(36)
                .substring(2, 10);


        return (
            "MS-" +
            Date.now()
                .toString(36)
                .toUpperCase() +
            "-" +
            random.toUpperCase()
        );

    }


    /* ========================================================
       CREATE CALL ROOM
       ======================================================== */

    async function createCallRoom({
        communityId = null,
        callScope,
        callType
    }) {

        if (!state.user?.id) {

            await loadUser();

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
                generateRoomCode(),

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


        state.currentRoom =
            data;


        state.currentCallScope =
            callScope;


        state.currentCallType =
            callType;


        return data;

    }


    /* ========================================================
       ADD PARTICIPANTS
       ======================================================== */

    async function addParticipants(
        roomId,
        userIds
    ) {

        if (!roomId) {

            throw new Error(
                "Missing call room."
            );

        }


        const ids =
            [
                ...new Set(
                    (userIds || [])
                        .filter(Boolean)
                        .map(
                            id =>
                                String(id)
                        )
                )
            ];


        if (!state.user?.id) {

            throw new Error(
                "You must be signed in."
            );

        }


        if (
            !ids.includes(
                String(
                    state.user.id
                )
            )
        ) {

            ids.push(
                String(
                    state.user.id
                )
            );

        }


        const rows =
            ids.map(userId => ({

                room_id:
                    roomId,

                user_id:
                    userId,

                status:
                    String(
                        userId
                    ) ===
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

            }));


        const {
            error
        } =
            await db
                .from(
                    "chat_call_participants"
                )
                .upsert(
                    rows,
                    {
                        onConflict:
                            "room_id,user_id"
                    }
                );


        if (error) {

            console.error(
                "❌ Participant creation failed:",
                error
            );


            throw error;

        }


        return rows;

    }


    /* ========================================================
       UPDATE ROOM ACTIVE
       ======================================================== */

    async function activateRoom(
        roomId
    ) {

        const {
            error
        } =
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
                    roomId
                );


        if (error) {

            console.warn(
                "⚠️ Could not activate call room:",
                error
            );

        }

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
                );


        if (error) {

            console.error(
                "❌ Participant loading failed:",
                error
            );


            throw error;

        }


        const ids =
            (data || [])
                .map(
                    row =>
                        row.user_id
                );


        const profiles =
            await loadProfiles(
                ids
            );


        state.participants =
            (data || [])
                .map(row => {

                    const profile =
                        profiles.get(
                            String(
                                row.user_id
                            )
                        );


                    return {

                        ...row,

                        profile,

                        display_name:
                            getDisplayName(
                                profile
                            ),

                        photo_url:
                            getPhoto(
                                profile
                            )

                    };

                });


        return state.participants;

    }


    /* ========================================================
       SIGNAL SEND
       ======================================================== */

    async function sendSignal({

        roomId,

        receiverId = null,

        signalType,

        payload

    }) {

        if (!roomId) {

            return;

        }


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
                        receiverId ||
                        null,

                    signal_type:
                        signalType,

                    payload:
                        payload || {}

                });


        if (error) {

            console.error(
                "❌ Call signal failed:",
                error
            );

        }

    }


    /* ========================================================
       REALTIME SIGNALING
       ======================================================== */

    function subscribeToRoom(
        roomId
    ) {

        if (!roomId) {

            return;

        }


        cleanupRoomSubscriptions();


        const signalChannel =
            db
                .channel(
                    `mwaniki-call-signals-${roomId}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",

                        schema: "public",

                        table:
                            "chat_call_signals",

                        filter:
                            `room_id=eq.${roomId}`

                    },
                    payload => {

                        handleIncomingSignal(
                            payload.new
                        );

                    }
                )
                .subscribe();


        const participantChannel =
            db
                .channel(
                    `mwaniki-call-participants-${roomId}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",

                        schema: "public",

                        table:
                            "chat_call_participants",

                        filter:
                            `room_id=eq.${roomId}`

                    },
                    () => {

                        loadRoomParticipants(
                            roomId
                        )
                            .then(
                                renderCallParticipants
                            )
                            .catch(
                                console.error
                            );

                    }
                )
                .subscribe();


        state.realtimeChannels.push(
            signalChannel,
            participantChannel
        );

    }


    /* ========================================================
       CLEAN ROOM SUBSCRIPTIONS
       ======================================================== */

    function cleanupRoomSubscriptions() {

        state.realtimeChannels
            .forEach(channel => {

                try {

                    db.removeChannel(
                        channel
                    );

                } catch (error) {

                    console.warn(
                        "Call channel cleanup warning:",
                        error
                    );

                }

            });


        state.realtimeChannels =
            [];

    }


    /* ========================================================
       WEBRTC PEER
       ======================================================== */

    function createPeerConnection(
        remoteUserId
    ) {

        const remoteId =
            String(
                remoteUserId
            );


        if (
            state.peerConnections.has(
                remoteId
            )
        ) {

            return state.peerConnections.get(
                remoteId
            );

        }


        const peer =
            new RTCPeerConnection(
                RTC_CONFIGURATION
            );


        state.peerConnections.set(
            remoteId,
            peer
        );


        if (state.localStream) {

            state.localStream
                .getTracks()
                .forEach(track => {

                    peer.addTrack(
                        track,
                        state.localStream
                    );

                });

        }


        peer.onicecandidate =
            event => {

                if (
                    !event.candidate
                ) {

                    return;

                }


                sendSignal({

                    roomId:
                        state.currentRoom?.id,

                    receiverId:
                        remoteId,

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
                    remoteId,
                    stream
                );


                renderRemoteStream(
                    remoteId,
                    stream
                );

            };


        peer.onconnectionstatechange =
            () => {

                const connectionState =
                    peer.connectionState;


                if (
                    connectionState ===
                    "failed" ||
                    connectionState ===
                    "closed"
                ) {

                    cleanupPeer(
                        remoteId
                    );

                }

            };


        return peer;

    }


    /* ========================================================
       PEER CLEANUP
       ======================================================== */

    function cleanupPeer(
        remoteUserId
    ) {

        const id =
            String(
                remoteUserId
            );


        const peer =
            state.peerConnections.get(
                id
            );


        if (peer) {

            try {

                peer.close();

            } catch (error) {

                console.warn(
                    error
                );

            }

        }


        state.peerConnections.delete(
            id
        );


        state.remoteStreams.delete(
            id
        );


        const tile =
            document.querySelector(
                `[data-call-remote-id="${CSS.escape(id)}"]`
            );


        tile?.remove();

    }


    /* ========================================================
       INITIATE PEER
       ======================================================== */

    async function initiatePeer(
        remoteUserId
    ) {

        const remoteId =
            String(
                remoteUserId
            );


        if (
            !state.currentRoom ||
            !state.localStream
        ) {

            return;

        }


        const peer =
            createPeerConnection(
                remoteId
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
                remoteId,

            signalType:
                "offer",

            payload:
                peer.localDescription

        });

    }


    /* ========================================================
       HANDLE INCOMING SIGNAL
       ======================================================== */

    async function handleIncomingSignal(
        signal
    ) {

        if (!signal) {

            return;

        }


        if (!state.user?.id) {

            return;

        }


        const receiver =
            signal.receiver_id;


        if (
            receiver &&
            String(receiver) !==
            String(state.user.id)
        ) {

            return;

        }


        if (
            String(
                signal.sender_id
            ) ===
            String(
                state.user.id
            )
        ) {

            return;

        }


        const remoteId =
            String(
                signal.sender_id
            );


        if (
            signal.signal_type ===
            "offer"
        ) {

            await handleOffer(
                remoteId,
                signal.payload
            );


        } else if (
            signal.signal_type ===
            "answer"
        ) {

            await handleAnswer(
                remoteId,
                signal.payload
            );


        } else if (
            signal.signal_type ===
            "ice-candidate"
        ) {

            await handleIceCandidate(
                remoteId,
                signal.payload
            );


        } else if (
            signal.signal_type ===
            "leave"
        ) {

            cleanupPeer(
                remoteId
            );

        }

    }


    /* ========================================================
       OFFER
       ======================================================== */

    async function handleOffer(
        remoteUserId,
        offer
    ) {

        if (!offer) {

            return;

        }


        if (!state.localStream) {

            return;

        }


        const peer =
            createPeerConnection(
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
                remoteUserId,

            signalType:
                "answer",

            payload:
                peer.localDescription

        });

    }


    /* ========================================================
       ANSWER
       ======================================================== */

    async function handleAnswer(
        remoteUserId,
        answer
    ) {

        const peer =
            state.peerConnections.get(
                String(remoteUserId)
            );


        if (!peer || !answer) {

            return;

        }


        try {

            await peer.setRemoteDescription(
                new RTCSessionDescription(
                    answer
                )
            );

        } catch (error) {

            console.error(
                "❌ Could not apply WebRTC answer:",
                error
            );

        }

    }


    /* ========================================================
       ICE
       ======================================================== */

    async function handleIceCandidate(
        remoteUserId,
        candidate
    ) {

        const peer =
            state.peerConnections.get(
                String(remoteUserId)
            );


        if (!peer || !candidate) {

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
                "⚠️ ICE candidate error:",
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
       CREATE LOCAL MEDIA
       ======================================================== */

    async function createLocalStream(
        callType
    ) {

        if (
            state.localStream
        ) {

            return state.localStream;

        }


        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            throw new Error(
                "Your browser does not support microphone/camera access."
            );

        }


        const video =
            callType ===
            CALL_TYPE.VIDEO;


        state.localStream =
            await navigator
                .mediaDevices
                .getUserMedia({

                    audio: true,

                    video

                });


        state.audioMuted =
            false;


        state.cameraEnabled =
            video;


        return state.localStream;

    }


    /* ========================================================
       START CALL
       ======================================================== */

    async function startCall({

        userIds,

        callType,

        callScope,

        communityId

    }) {

        if (!state.user) {

            await loadUser();

        }


        if (!state.user?.id) {

            throw new Error(
                "You must be signed in."
            );

        }


        const selected =
            [
                ...new Set(
                    (userIds || [])
                        .filter(Boolean)
                        .map(
                            id =>
                                String(id)
                        )
                )
            ];


        if (!selected.length) {

            throw new Error(
                "Select at least one online user."
            );

        }


        state.currentCallType =
            callType;


        state.currentCallScope =
            callScope;


        state.currentCallMode =
            callScope;


        const room =
            await createCallRoom({

                communityId:
                    communityId ||
                    null,

                callScope,

                callType

            });


        await addParticipants(
            room.id,
            selected
        );


        await activateRoom(
            room.id
        );


        await loadRoomParticipants(
            room.id
        );


        await createLocalStream(
            callType
        );


        openCallWindow();


        subscribeToRoom(
            room.id
        );


        renderCallParticipants(
            state.participants
        );


        showLocalStream();


        /*
         * Give the database/realtime layer
         * a moment to register the participants.
         */

        setTimeout(
            async () => {

                for (
                    const remoteUserId
                    of selected
                ) {

                    if (
                        shouldInitiate(
                            remoteUserId
                        )
                    ) {

                        try {

                            await initiatePeer(
                                remoteUserId
                            );

                        } catch (error) {

                            console.error(
                                "❌ Peer initiation failed:",
                                error
                            );

                        }

                    }

                }

            },
            700
        );


        toast(
            "Call started.",
            "success"
        );


        return room;

    }


    /* ========================================================
       PUBLIC CALL FUNCTIONS
       ======================================================== */

    async function startGeneralCall(
        callType = CALL_TYPE.VIDEO
    ) {

        await openPicker({

            mode:
                CALL_SCOPE.GENERAL,

            callType,

            communityOnly:
                false,

            single:
                false

        });

    }


    async function startCommunityCall(
        callType = CALL_TYPE.VIDEO
    ) {

        const communityId =
            getCommunityId();


        if (!communityId) {

            toast(
                "Select a community first.",
                "error"
            );


            return;

        }


        await openPicker({

            mode:
                CALL_SCOPE.COMMUNITY,

            callType,

            communityOnly:
                true,

            single:
                false

        });

    }


    async function startDirectCall(
        callType = CALL_TYPE.VIDEO
    ) {

        await openPicker({

            mode:
                CALL_SCOPE.DIRECT,

            callType,

            communityOnly:
                false,

            single:
                true

        });

    }


    /* ========================================================
       END OF PART 1
       ======================================================== */
    /* ========================================================
       CALL WINDOW
       ======================================================== */

    function ensureCallWindow() {

        if (byId("mwanikiCallWindow")) {
            return;
        }

        const windowElement =
            document.createElement("section");

        windowElement.id =
            "mwanikiCallWindow";

        windowElement.className =
            "mwaniki-call-window hidden";

        windowElement.innerHTML = `

            <div class="mwaniki-call-header">

                <div>
                    <strong id="mwanikiCallTitle">
                        Mwaniki Call
                    </strong>

                    <span id="mwanikiCallStatus">
                        Connecting...
                    </span>
                </div>

                <button
                    type="button"
                    id="mwanikiCallCloseTop"
                    aria-label="Close call"
                >
                    ×
                </button>

            </div>


            <div
                id="mwanikiCallStage"
                class="mwaniki-call-stage"
            >

                <div
                    id="mwanikiLocalTile"
                    class="mwaniki-call-tile local"
                >

                    <video
                        id="mwanikiLocalVideo"
                        autoplay
                        playsinline
                        muted
                    ></video>

                    <div class="mwaniki-call-tile-name">
                        You
                    </div>

                </div>


                <div
                    id="mwanikiRemoteTiles"
                    class="mwaniki-call-remote-tiles"
                ></div>

            </div>


            <div class="mwaniki-call-controls">

                <button
                    type="button"
                    id="mwanikiCallMute"
                    title="Mute microphone"
                >
                    🎙️
                </button>

                <button
                    type="button"
                    id="mwanikiCallCamera"
                    title="Toggle camera"
                >
                    📷
                </button>

                <button
                    type="button"
                    id="mwanikiCallScreen"
                    title="Share screen"
                >
                    🖥️
                </button>

                <button
                    type="button"
                    id="mwanikiCallLeave"
                    class="danger"
                    title="Leave call"
                >
                    ☎
                </button>

            </div>

        `;

        document.body.appendChild(
            windowElement
        );


        byId(
            "mwanikiCallCloseTop"
        )?.addEventListener(
            "click",
            leaveCall
        );


        byId(
            "mwanikiCallMute"
        )?.addEventListener(
            "click",
            toggleMute
        );


        byId(
            "mwanikiCallCamera"
        )?.addEventListener(
            "click",
            toggleCamera
        );


        byId(
            "mwanikiCallScreen"
        )?.addEventListener(
            "click",
            toggleScreenShare
        );


        byId(
            "mwanikiCallLeave"
        )?.addEventListener(
            "click",
            leaveCall
        );

    }


    /* ========================================================
       OPEN CALL WINDOW
       ======================================================== */

    function openCallWindow() {

        ensureCallWindow();

        const element =
            byId(
                "mwanikiCallWindow"
            );

        element?.classList.remove(
            "hidden"
        );

        updateCallTitle();

    }


    /* ========================================================
       UPDATE CALL TITLE
       ======================================================== */

    function updateCallTitle() {

        const title =
            byId(
                "mwanikiCallTitle"
            );

        const status =
            byId(
                "mwanikiCallStatus"
            );


        if (title) {

            if (
                state.currentCallScope ===
                CALL_SCOPE.GENERAL
            ) {

                title.textContent =
                    "General Call";

            } else if (
                state.currentCallScope ===
                CALL_SCOPE.COMMUNITY
            ) {

                title.textContent =
                    state.currentCommunity?.name ||
                    "Community Call";

            } else {

                title.textContent =
                    "Direct Call";

            }

        }


        if (status) {

            status.textContent =
                state.currentCallType ===
                CALL_TYPE.AUDIO
                    ? "Voice call"
                    : "Video call";

        }

    }


    /* ========================================================
       SHOW LOCAL STREAM
       ======================================================== */

    function showLocalStream() {

        const video =
            byId(
                "mwanikiLocalVideo"
            );

        if (!video) {
            return;
        }


        if (state.localStream) {

            video.srcObject =
                state.localStream;

            video.play().catch(
                () => {}
            );

        }

    }


    /* ========================================================
       RENDER REMOTE STREAM
       ======================================================== */

    function renderRemoteStream(
        remoteUserId,
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
            String(
                remoteUserId
            );


        let tile =
            document.querySelector(
                `[data-call-remote-id="${CSS.escape(id)}"]`
            );


        if (!tile) {

            tile =
                document.createElement(
                    "div"
                );

            tile.className =
                "mwaniki-call-tile remote";

            tile.dataset.callRemoteId =
                id;


            const video =
                document.createElement(
                    "video"
                );

            video.autoplay =
                true;

            video.playsInline =
                true;

            video.dataset.remoteVideo =
                id;


            tile.appendChild(
                video
            );


            const label =
                document.createElement(
                    "div"
                );

            label.className =
                "mwaniki-call-tile-name";

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

            video.play().catch(
                () => {}
            );

        }


        loadProfiles(
            [id]
        )
        .then(
            profiles => {

                const profile =
                    profiles.get(id);

                const label =
                    tile.querySelector(
                        ".mwaniki-call-tile-name"
                    );

                if (label) {

                    label.textContent =
                        getDisplayName(
                            profile
                        );

                }

            }
        )
        .catch(
            console.error
        );

    }


    /* ========================================================
       RENDER PARTICIPANTS
       ======================================================== */

    function renderCallParticipants(
        participants
    ) {

        if (!participants) {
            return;
        }


        const currentIds =
            new Set(
                participants.map(
                    participant =>
                        String(
                            participant.user_id
                        )
                )
            );


        queryAll(
            "[data-call-remote-id]"
        )
        .forEach(
            tile => {

                const id =
                    String(
                        tile.dataset.callRemoteId
                    );


                if (
                    !currentIds.has(id) &&
                    id !==
                    String(
                        state.user?.id
                    )
                ) {

                    tile.remove();

                }

            }
        );

    }


    /* ========================================================
       MUTE MICROPHONE
       ======================================================== */

    async function toggleMute() {

        if (!state.localStream) {
            return;
        }


        const tracks =
            state.localStream
                .getAudioTracks();


        if (!tracks.length) {
            return;
        }


        state.audioMuted =
            !state.audioMuted;


        tracks.forEach(
            track => {

                track.enabled =
                    !state.audioMuted;

            }
        );


        const button =
            byId(
                "mwanikiCallMute"
            );


        if (button) {

            button.textContent =
                state.audioMuted
                    ? "🔇"
                    : "🎙️";

        }


        await updateMyParticipant({

            is_muted:
                state.audioMuted

        });

    }


    /* ========================================================
       TOGGLE CAMERA
       ======================================================== */

    async function toggleCamera() {

        if (!state.localStream) {
            return;
        }


        const tracks =
            state.localStream
                .getVideoTracks();


        if (!tracks.length) {
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
                "mwanikiCallCamera"
            );


        if (button) {

            button.textContent =
                state.cameraEnabled
                    ? "📷"
                    : "🚫";

        }


        await updateMyParticipant({

            is_camera_on:
                state.cameraEnabled

        });

    }


    /* ========================================================
       SCREEN SHARING
       ======================================================== */

    async function toggleScreenShare() {

        if (
            !navigator.mediaDevices?.getDisplayMedia
        ) {

            toast(
                "Screen sharing is not supported by this browser.",
                "error"
            );

            return;

        }


        if (state.screenSharing) {

            await stopScreenShare();

            return;

        }


        try {

            state.screenStream =
                await navigator
                    .mediaDevices
                    .getDisplayMedia({
                        video: true
                    });


            const screenTrack =
                state.screenStream
                    .getVideoTracks()[0];


            if (!screenTrack) {
                return;
            }


            for (
                const peer
                of state.peerConnections.values()
            ) {

                const sender =
                    peer
                        .getSenders()
                        .find(
                            item =>
                                item.track?.kind ===
                                "video"
                        );


                if (sender) {

                    await sender.replaceTrack(
                        screenTrack
                    );

                }

            }


            const localVideo =
                byId(
                    "mwanikiLocalVideo"
                );


            if (localVideo) {

                localVideo.srcObject =
                    state.screenStream;

            }


            state.screenSharing =
                true;


            await updateMyParticipant({

                is_screen_sharing:
                    true

            });


            screenTrack.onended =
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
       STOP SCREEN SHARING
       ======================================================== */

    async function stopScreenShare() {

        if (!state.screenStream) {
            return;
        }


        const cameraTrack =
            state.localStream
                ?.getVideoTracks()[0] ||
            null;


        for (
            const peer
            of state.peerConnections.values()
        ) {

            const sender =
                peer
                    .getSenders()
                    .find(
                        item =>
                            item.track?.kind ===
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
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );


        state.screenStream =
            null;


        state.screenSharing =
            false;


        showLocalStream();


        await updateMyParticipant({

            is_screen_sharing:
                false

        });

    }


    /* ========================================================
       UPDATE MY PARTICIPANT
       ======================================================== */

    async function updateMyParticipant(
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
                .update({

                    ...values,

                    updated_at:
                        new Date()
                            .toISOString()

                })
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
                "⚠️ Participant update failed:",
                error
            );

        }

    }


    /* ========================================================
       LEAVE CALL
       ======================================================== */

    async function leaveCall() {

        if (state.endingCall) {
            return;
        }


        state.endingCall =
            true;


        const roomId =
            state.currentRoom?.id ||
            null;


        try {

            if (roomId) {

                await updateMyParticipant({

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


                await sendSignal({

                    roomId,

                    receiverId:
                        null,

                    signalType:
                        "leave",

                    payload: {}

                });

            }


            if (state.localStream) {

                state.localStream
                    .getTracks()
                    .forEach(
                        track =>
                            track.stop()
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


            state.peerConnections
                .forEach(
                    peer => {

                        try {

                            peer.close();

                        } catch (error) {

                            console.warn(
                                error
                            );

                        }

                    }
                );


            state.peerConnections.clear();


            state.remoteStreams.clear();


            cleanupRoomSubscriptions();


            /*
             * Only the room creator ends the room.
             * This prevents one participant from
             * killing another community's call.
             */

            if (
                roomId &&
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
                                .toISOString(),

                        updated_at:
                            new Date()
                                .toISOString()

                    })
                    .eq(
                        "id",
                        roomId
                    )
                    .eq(
                        "created_by",
                        state.user.id
                    );

            }

        } catch (error) {

            console.error(
                "❌ Error leaving call:",
                error
            );

        }


        state.localStream =
            null;

        state.screenStream =
            null;

        state.currentRoom =
            null;

        state.currentCallType =
            null;

        state.currentCallScope =
            null;

        state.currentCallMode =
            null;

        state.participants =
            [];

        state.audioMuted =
            false;

        state.cameraEnabled =
            true;

        state.screenSharing =
            false;


        const callWindow =
            byId(
                "mwanikiCallWindow"
            );


        callWindow?.classList.add(
            "hidden"
        );


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
       INCOMING CALL SUBSCRIPTION
       ======================================================== */

    function subscribeToIncomingCalls() {

        if (!state.user?.id) {
            return;
        }


        const existing =
            state.realtimeChannels
                .find(
                    channel =>
                        channel
                            .__mwanikiIncomingCall ===
                        true
                );


        if (existing) {
            return;
        }


        const channel =
            db
                .channel(
                    `mwaniki-incoming-calls-${state.user.id}`
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

                        handleIncomingParticipant(
                            payload.new
                        );

                    }
                )
                .subscribe();


        channel.__mwanikiIncomingCall =
            true;


        state.realtimeChannels.push(
            channel
        );

    }


    /* ========================================================
       HANDLE INCOMING PARTICIPANT
       ======================================================== */

    async function handleIncomingParticipant(
        participant
    ) {

        if (!participant) {
            return;
        }


        if (
            String(
                participant.user_id
            ) !==
            String(
                state.user?.id
            )
        ) {

            return;

        }


        if (
            participant.status !==
            PARTICIPANT_STATUS.INVITED
        ) {

            return;

        }


        if (
            state.currentRoom?.id ===
            participant.room_id
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
            !room
        ) {

            return;

        }


        if (
            room.status ===
            ROOM_STATUS.ENDED
        ) {

            return;

        }


        const callerId =
            room.created_by;


        const profiles =
            await loadProfiles(
                [callerId]
            );


        const callerProfile =
            profiles.get(
                String(callerId)
            );


        showIncomingCallUI({

            room,

            participant,

            callerName:
                getDisplayName(
                    callerProfile
                ),

            callerPhoto:
                getPhoto(
                    callerProfile
                )

        });

    }


    /* ========================================================
       INCOMING CALL UI
       ======================================================== */

    function showIncomingCallUI({
        room,
        participant,
        callerName,
        callerPhoto
    }) {

        const old =
            byId(
                "mwanikiIncomingCall"
            );


        if (old) {
            old.remove();
        }


        const element =
            document.createElement(
                "div"
            );


        element.id =
            "mwanikiIncomingCall";


        element.className =
            "mwaniki-incoming-call";


        const avatar =
            callerPhoto

                ? `
                    <img
                        src="${escapeAttribute(
                            callerPhoto
                        )}"
                        alt="${escapeAttribute(
                            callerName
                        )}"
                    >
                  `

                : `
                    <span>
                        ${escapeHTML(
                            getInitials(
                                callerName
                            )
                        )}
                    </span>
                  `;


        element.innerHTML = `

            <div
                class="mwaniki-incoming-call-avatar"
            >
                ${avatar}
            </div>

            <div
                class="mwaniki-incoming-call-info"
            >

                <strong>
                    ${escapeHTML(
                        callerName
                    )}
                </strong>

                <span>
                    Incoming ${
                        room.call_type ===
                        CALL_TYPE.AUDIO
                            ? "voice"
                            : "video"
                    } call
                </span>

            </div>

            <div
                class="mwaniki-incoming-call-actions"
            >

                <button
                    type="button"
                    data-answer-call
                >
                    Answer
                </button>

                <button
                    type="button"
                    data-decline-call
                >
                    Decline
                </button>

            </div>

        `;


        document.body.appendChild(
            element
        );


        element
            .querySelector(
                "[data-answer-call]"
            )
            ?.addEventListener(
                "click",
                async () => {

                    element.remove();

                    await answerIncomingCall(
                        room,
                        participant
                    );

                }
            );


        element
            .querySelector(
                "[data-decline-call]"
            )
            ?.addEventListener(
                "click",
                async () => {

                    element.remove();

                    await declineIncomingCall(
                        participant
                    );

                }
            );

    }


    /* ========================================================
       ANSWER INCOMING CALL
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

            state.currentCallMode =
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
                            .toISOString(),

                    is_muted:
                        false,

                    is_camera_on:
                        room.call_type ===
                        CALL_TYPE.VIDEO

                })
                .eq(
                    "id",
                    participant.id
                );


            await loadRoomParticipants(
                room.id
            );


            openCallWindow();


            subscribeToRoom(
                room.id
            );


            showLocalStream();


            renderCallParticipants(
                state.participants
            );


            const callerId =
                room.created_by;


            if (
                callerId &&
                shouldInitiate(
                    callerId
                )
            ) {

                await initiatePeer(
                    callerId
                );

            }


            toast(
                "Call connected.",
                "success"
            );

        } catch (error) {

            console.error(
                "❌ Could not answer call:",
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
       DECLINE CALL
       ======================================================== */

    async function declineIncomingCall(
        participant
    ) {

        if (!participant?.id) {
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
                    participant.id
                );


        if (error) {

            console.error(
                "❌ Could not decline call:",
                error
            );

        }

    }


    /* ========================================================
       BUTTON BINDING
       ======================================================== */

    function bindCallButton(
        selector,
        handler
    ) {

        queryAll(selector)
            .forEach(
                button => {

                    if (
                        button.dataset
                            .mwanikiCallBound ===
                        "true"
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

                            event.stopPropagation();

                            handler();

                        }
                    );

                }
            );

    }


    /* ========================================================
       GENERAL CALL BUTTON
       ======================================================== */

    function ensureGeneralCallButton() {

        if (
            byId(
                "mwanikiGeneralCallButton"
            )
        ) {

            return;

        }


        const button =
            document.createElement(
                "button"
            );


        button.id =
            "mwanikiGeneralCallButton";


        button.type =
            "button";


        button.title =
            "Start a general call";


        button.innerHTML =
            "📞 General Call";


        button.addEventListener(
            "click",
            () =>
                startGeneralCall(
                    CALL_TYPE.VIDEO
                )
        );


        document.body.appendChild(
            button
        );

    }


    /* ========================================================
       BIND EXISTING CALL BUTTONS
       ======================================================== */

    function bindButtons() {

        bindCallButton(
            "#generalCallButton",
            () =>
                startGeneralCall(
                    CALL_TYPE.VIDEO
                )
        );


        bindCallButton(
            "[data-general-call]",
            () =>
                startGeneralCall(
                    CALL_TYPE.VIDEO
                )
        );


        bindCallButton(
            "#generalVoiceCallButton",
            () =>
                startGeneralCall(
                    CALL_TYPE.AUDIO
                )
        );


        bindCallButton(
            "#videoCallButton",
            () =>
                startCommunityCall(
                    CALL_TYPE.VIDEO
                )
        );


        bindCallButton(
            ".video-call-button",
            () =>
                startCommunityCall(
                    CALL_TYPE.VIDEO
                )
        );


        bindCallButton(
            '[data-call-type="video"]',
            () =>
                startCommunityCall(
                    CALL_TYPE.VIDEO
                )
        );


        bindCallButton(
            "#voiceCallButton",
            () =>
                startCommunityCall(
                    CALL_TYPE.AUDIO
                )
        );


        bindCallButton(
            ".voice-call-button",
            () =>
                startCommunityCall(
                    CALL_TYPE.AUDIO
                )
        );


        bindCallButton(
            '[data-call-type="voice"]',
            () =>
                startCommunityCall(
                    CALL_TYPE.AUDIO
                )
        );


        bindCallButton(
            "#directCallButton",
            () =>
                startDirectCall(
                    CALL_TYPE.VIDEO
                )
        );


        bindCallButton(
            "[data-direct-call]",
            () =>
                startDirectCall(
                    CALL_TYPE.VIDEO
                )
        );


        bindCallButton(
            "#mwanikiGeneralCallButton",
            () =>
                startGeneralCall(
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
            state.booting
        ) {

            return;

        }


        state.booting =
            true;


        console.log(
            "📞 Mwaniki Universal Call Engine loading..."
        );


        try {

            await loadUser();


            if (state.user) {

                await loadProfile();

                subscribeToIncomingCalls();

            } else {

                console.warn(
                    "⚠️ No signed-in user. Call engine is waiting for authentication."
                );

            }


            syncCommunity();


            ensurePicker();

            ensureCallWindow();

            bindButtons();

            ensureGeneralCallButton();


            state.initialized =
                true;


            console.log(
                "✅ Mwaniki Universal Call Engine ready"
            );

        } catch (error) {

            console.error(
                "❌ Mwaniki Call Engine initialization failed:",
                error
            );

        } finally {

            state.booting =
                false;

        }

    }


    /* ========================================================
       AUTH STATE
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
       COMMUNITY CHANGE
       ======================================================== */

    window.addEventListener(
        "mwaniki:communityChanged",
        () => {

            syncCommunity();

            bindButtons();

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

        startCall,

        leaveCall,

        toggleMute,

        toggleCamera,

        toggleScreenShare,

        stopScreenShare,

        loadOnlineUsers,

        loadRoomParticipants

    };


    /* ========================================================
       GLOBAL COMPATIBILITY
       ======================================================== */

    window.startGeneralCall =
        startGeneralCall;

    window.startCommunityCall =
        startCommunityCall;

    window.startDirectCall =
        startDirectCall;

    window.leaveMwanikiCall =
        leaveCall;


    /* ========================================================
       START ENGINE
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true
            }
        );

    } else {

        initialize();

    }


    /* ========================================================
       END OF PART 2
       ======================================================== */

}
