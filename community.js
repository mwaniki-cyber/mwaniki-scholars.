/*
====================================================================
 MWANIKI SCHOLARS — REAL CALL ENGINE
====================================================================

 FILE:
     community-calls.js

 RESPONSIBILITIES:
     - Direct one-to-one calls
     - General calls
     - Community calls
     - Online-user picker
     - Incoming call notifications
     - WebRTC audio/video
     - Microphone control
     - Camera control
     - Screen sharing
     - Participant management
     - Call room creation
     - Call invitations
     - Call cleanup

 IMPORTANT:
     - community.js does NOT contain WebRTC.
     - This file is the ONLY calling engine.
     - No user UUID is manually entered anywhere.
     - chat_call_rooms.room_code is ALWAYS supplied.

====================================================================
*/

(function () {

    "use strict";

    /* ================================================================
       CONFIGURATION
       ================================================================ */

    const CALL_PAGE = "./community-calls.html";

    const ROOM_PREFIX = "mwaniki-call-";

    const INCOMING_PREFIX = "mwaniki-incoming-";

    const MISSED_CALL_KEY = "mwaniki-missed-calls";

    const RING_TIMEOUT = 45000;

    const PRESENCE_TIMEOUT = 120000;

    const RTC_CONFIGURATION = {

        iceServers: [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302"
                ]
            }
        ],

        iceCandidatePoolSize: 10

    };


    /* ================================================================
       SUPABASE
       ================================================================ */

    let db = null;

    function getSupabase() {

        if (window.supabaseClient) {
            return window.supabaseClient;
        }

        if (window.mwanikiSupabase) {
            return window.mwanikiSupabase;
        }

        if (window.supabase) {
            if (
                typeof window.supabase.from === "function"
            ) {
                return window.supabase;
            }

            if (
                window.supabase.supabase &&
                typeof window.supabase.supabase.from === "function"
            ) {
                return window.supabase.supabase;
            }
        }

        return null;
    }


    function waitForSupabase() {

        return new Promise(function (resolve, reject) {

            const started = Date.now();

            const timer = setInterval(function () {

                db = getSupabase();

                if (db) {

                    clearInterval(timer);

                    resolve(db);

                    return;
                }

                if (Date.now() - started > 10000) {

                    clearInterval(timer);

                    reject(
                        new Error(
                            "Supabase client was not found."
                        )
                    );

                }

            }, 100);

        });

    }


    /* ================================================================
       STATE
       ================================================================ */

    const state = {

        user: null,

        profile: null,

        currentRoom: null,

        currentInvite: null,

        currentMode: "audio",

        currentRole: null,

        currentCommunityId: null,

        currentRoomChannel: null,

        incomingChannel: null,

        presenceTimer: null,

        ringTimer: null,

        peerConnections: new Map(),

        remoteStreams: new Map(),

        localStream: null,

        screenStream: null,

        microphoneEnabled: true,

        cameraEnabled: false,

        screenSharing: false,

        callStarted: false,

        endingCall: false,

        incomingCallVisible: false,

        selectedUsers: [],

        pickerCommunityId: null,

        initialized: false

    };


    /* ================================================================
       BASIC UTILITIES
       ================================================================ */

    function $(id) {

        return document.getElementById(id);

    }


    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    function displayName(profile, fallbackId = "") {

        if (!profile) {
            return fallbackId
                ? `User ${String(fallbackId).slice(0, 6)}`
                : "User";
        }

        return (
            profile.full_name ||
            profile.name ||
            profile.display_name ||
            profile.username ||
            profile.email ||
            `User ${String(profile.id || fallbackId).slice(0, 6)}`
        );
    }


    function avatarURL(profile) {

        if (!profile) {
            return "";
        }

        return (
            profile.avatar_url ||
            profile.avatar ||
            profile.photo_url ||
            profile.profile_photo ||
            ""
        );
    }


    function initials(name) {

        const parts = String(name || "User")
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        if (!parts.length) {
            return "U";
        }

        if (parts.length === 1) {
            return parts[0].slice(0, 2).toUpperCase();
        }

        return (
            parts[0][0] +
            parts[parts.length - 1][0]
        ).toUpperCase();
    }


    function randomId(length = 12) {

        const chars =
            "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

        let result = "";

        for (let i = 0; i < length; i++) {

            result += chars[
                Math.floor(
                    Math.random() * chars.length
                )
            ];

        }

        return result;
    }


    /*
     * REQUIRED BY chat_call_rooms
     *
     * room_code MUST NOT be null.
     */
    function generateRoomCode() {

        if (
            window.crypto &&
            typeof window.crypto.randomUUID === "function"
        ) {

            return (
                "mw-" +
                window.crypto
                    .randomUUID()
                    .replace(/-/g, "")
                    .slice(0, 20)
            );

        }

        return (
            "mw-" +
            Date.now().toString(36) +
            "-" +
            randomId(10)
        );

    }


    function toast(message, type = "info") {

        let element = $("toast");

        if (!element) {

            element = document.createElement("div");

            element.id = "mwanikiCallToast";

            element.style.cssText = `
                position:fixed;
                right:20px;
                bottom:20px;
                z-index:999999;
                max-width:380px;
                padding:14px 18px;
                border-radius:12px;
                background:#111827;
                color:#fff;
                font:500 14px/1.4 Arial,sans-serif;
                box-shadow:0 10px 30px rgba(0,0,0,.25);
            `;

            document.body.appendChild(element);

        }

        element.textContent = message;

        element.style.display = "block";

        if (type === "error") {
            element.style.background = "#b91c1c";
        } else if (type === "success") {
            element.style.background = "#047857";
        } else {
            element.style.background = "#111827";
        }

        clearTimeout(element.__timer);

        element.__timer = setTimeout(function () {

            element.style.display = "none";

        }, 3500);

    }


    function closeWindow() {

        try {
            window.close();
        } catch (error) {
            // Browser may block window.close().
        }

    }


    /* ================================================================
       AUTHENTICATION
       ================================================================ */

    async function loadCurrentUser() {

        if (!db) {
            throw new Error("Supabase is not ready.");
        }

        const result = await db.auth.getUser();

        if (result.error) {
            throw result.error;
        }

        state.user = result.data?.user || null;

        if (!state.user) {
            throw new Error("You must be signed in.");
        }

        return state.user;

    }


    /* ================================================================
       PROFILE
       ================================================================ */

    async function loadProfile(userId) {

        if (!userId) {
            return null;
        }

        let profile = null;

        try {

            const result = await db
                .from("chat_public_profiles")
                .select("*")
                .eq("id", userId)
                .maybeSingle();

            if (!result.error) {
                profile = result.data || null;
            }

        } catch (error) {

            console.warn(
                "Could not load chat profile:",
                error
            );

        }

        if (!profile) {

            try {

                const result = await db
                    .from("students")
                    .select("*")
                    .eq("id", userId)
                    .maybeSingle();

                if (!result.error) {
                    profile = result.data || null;
                }

            } catch (error) {

                console.warn(
                    "Could not load student profile:",
                    error
                );

            }

        }

        return profile;

    }


    /* ================================================================
       PROFILE CACHE
       ================================================================ */

    const profileCache = new Map();


    async function getProfile(userId) {

        if (!userId) {
            return null;
        }

        if (profileCache.has(userId)) {
            return profileCache.get(userId);
        }

        const profile = await loadProfile(userId);

        if (profile) {
            profileCache.set(userId, profile);
        }

        return profile;

    }


    /* ================================================================
       ONLINE USERS
       ================================================================ */

    async function getOnlineUsers(communityId = null) {

        if (!state.user) {
            await loadCurrentUser();
        }

        let presenceRows = [];

        try {

            const result = await db
                .from("chat_presence")
                .select("*")
                .eq("status", "online");

            if (result.error) {
                throw result.error;
            }

            presenceRows = result.data || [];

        } catch (error) {

            console.error(
                "Could not load online users:",
                error
            );

            return [];

        }


        const now = Date.now();

        presenceRows = presenceRows.filter(function (row) {

            if (!row.user_id) {
                return false;
            }

            if (
                row.user_id === state.user.id
            ) {
                return false;
            }

            if (!row.last_seen_at) {
                return true;
            }

            const lastSeen =
                new Date(row.last_seen_at).getTime();

            return (
                now - lastSeen <= PRESENCE_TIMEOUT
            );

        });


        if (communityId) {

            try {

                const membersResult = await db
                    .from("chat_community_members")
                    .select("user_id")
                    .eq("community_id", communityId);

                if (
                    !membersResult.error &&
                    membersResult.data
                ) {

                    const allowed = new Set(
                        membersResult.data
                            .map(row => row.user_id)
                            .filter(Boolean)
                    );

                    presenceRows =
                        presenceRows.filter(
                            row =>
                                allowed.has(
                                    row.user_id
                                )
                        );

                }

            } catch (error) {

                console.warn(
                    "Could not filter community members:",
                    error
                );

            }

        }


        const users = [];

        for (const row of presenceRows) {

            const profile =
                await getProfile(row.user_id);

            users.push({

                id: row.user_id,

                profile: profile || {
                    id: row.user_id
                },

                status: row.status,

                last_seen_at: row.last_seen_at

            });

        }

        return users;

    }


    /* ================================================================
       COMMUNITY MEMBERS
       ================================================================ */

    async function getCommunityMembers(communityId) {

        if (!communityId) {
            return [];
        }

        const result = await db
            .from("chat_community_members")
            .select("*")
            .eq("community_id", communityId);

        if (result.error) {
            throw result.error;
        }

        const rows = result.data || [];

        const members = [];

        for (const row of rows) {

            const userId =
                row.user_id ||
                row.profile_id;

            if (!userId) {
                continue;
            }

            const profile =
                await getProfile(userId);

            members.push({

                id: userId,

                profile: profile || {
                    id: userId
                },

                role:
                    row.role ||
                    "Student"

            });

        }

        return members;

    }


    /* ================================================================
       CALL ROOM
       ================================================================ */

    async function createCallRoom({
        communityId = null,
        targetUserId = null,
        scope = "direct",
        mode = "audio"
    } = {}) {

        if (!state.user) {
            await loadCurrentUser();
        }

        /*
         * THIS IS THE IMPORTANT FIX.
         *
         * chat_call_rooms.room_code is NOT NULL.
         */
        const roomCode = generateRoomCode();

        const payload = {

            room_code: roomCode,

            community_id:
                communityId || null,

            created_by:
                state.user.id,

            target_user_id:
                targetUserId || null,

            room_status:
                "ringing",

            call_scope:
                scope,

            max_participants:
                scope === "community"
                    ? 100
                    : 2

        };

        console.log(
            "📞 Creating call room:",
            payload
        );


        const result = await db
            .from("chat_call_rooms")
            .insert(payload)
            .select("*")
            .single();


        if (result.error) {

            console.error(
                "CALL ROOM CREATION FAILED:",
                result.error
            );

            throw result.error;

        }


        if (!result.data) {

            throw new Error(
                "Supabase returned no call room."
            );

        }


        console.log(
            "✅ Call room created:",
            result.data
        );


        return result.data;

    }


    /* ================================================================
       CREATE INVITE
       ================================================================ */

    async function createInvite(
        roomId,
        receiverId
    ) {

        if (
            !roomId ||
            !receiverId ||
            !state.user
        ) {

            throw new Error(
                "Missing call invitation information."
            );

        }


        const payload = {

            room_id:
                roomId,

            sender_id:
                state.user.id,

            receiver_id:
                receiverId,

            status:
                "ringing"

        };


        const result = await db
            .from("chat_call_invites")
            .insert(payload)
            .select("*")
            .single();


        if (result.error) {

            console.error(
                "CALL INVITE CREATION FAILED:",
                result.error
            );

            throw result.error;

        }


        return result.data;

    }


    /* ================================================================
       PARTICIPANTS
       ================================================================ */

    async function addParticipant(
        roomId,
        userId,
        status = "invited"
    ) {

        if (!roomId || !userId) {
            return;
        }

        const payload = {

            room_id:
                roomId,

            user_id:
                userId,

            status:
                status,

            is_muted:
                false,

            camera:
                false,

            screen_share:
                false

        };


        const result = await db
            .from("chat_call_participants")
            .insert(payload)
            .select("*")
            .maybeSingle();


        if (result.error) {

            /*
             * A participant may already exist.
             * Do not crash the whole call because of that.
             */
            const message =
                String(
                    result.error.message ||
                    ""
                ).toLowerCase();

            if (
                !message.includes("duplicate") &&
                !message.includes("unique")
            ) {

                console.warn(
                    "Participant insert warning:",
                    result.error
                );

            }

        }

        return result.data || null;

    }


    async function updateParticipant(
        roomId,
        userId,
        values
    ) {

        if (!roomId || !userId) {
            return;
        }

        const result = await db
            .from("chat_call_participants")
            .update(values)
            .eq("room_id", roomId)
            .eq("user_id", userId);

        if (result.error) {

            console.warn(
                "Participant update warning:",
                result.error
            );

        }

    }


    /* ================================================================
       CALL URL
       ================================================================ */

    function buildCallURL(
        roomId,
        roomCode,
        role,
        mode
    ) {

        const url =
            new URL(
                CALL_PAGE,
                window.location.href
            );

        url.searchParams.set(
            "room",
            roomId
        );

        url.searchParams.set(
            "room_code",
            roomCode
        );

        url.searchParams.set(
            "role",
            role
        );

        url.searchParams.set(
            "mode",
            mode
        );

        return url.toString();

    }


    function openCallPage(
        room,
        role,
        mode
    ) {

        const url =
            buildCallURL(
                room.id,
                room.room_code,
                role,
                mode
            );

        window.location.href = url;

    }


    /* ================================================================
       INCOMING CALL CHANNEL
       ================================================================ */

    async function subscribeIncomingCalls() {

        if (
            !state.user ||
            !db
        ) {
            return;
        }


        if (state.incomingChannel) {

            try {
                await db.removeChannel(
                    state.incomingChannel
                );
            } catch (error) {
                // Ignore cleanup errors.
            }

            state.incomingChannel = null;

        }


        const channelName =
            INCOMING_PREFIX +
            state.user.id;


        state.incomingChannel =
            db.channel(channelName);


        state.incomingChannel
            .on(
                "broadcast",
                {
                    event: "incoming-call"
                },
                function (payload) {

                    const data =
                        payload?.payload ||
                        payload ||
                        {};

                    handleIncomingCall(data);

                }
            )
            .subscribe(function (status) {

                console.log(
                    "📞 Incoming call listener:",
                    status
                );

            });

    }


    /* ================================================================
       NOTIFY USER
       ================================================================ */

    async function notifyUserOfCall(
        receiverId,
        room,
        callerProfile,
        mode,
        scope
    ) {

        if (!receiverId) {
            return;
        }


        const channel =
            db.channel(
                INCOMING_PREFIX +
                receiverId
            );


        const callerName =
            displayName(
                callerProfile,
                state.user.id
            );


        const callerAvatar =
            avatarURL(
                callerProfile
            );


        try {

            await channel.subscribe();

        } catch (error) {

            console.warn(
                "Call notification subscription warning:",
                error
            );

        }


        try {

            await channel.send({

                type: "broadcast",

                event: "incoming-call",

                payload: {

                    room_id:
                        room.id,

                    room_code:
                        room.room_code,

                    caller_id:
                        state.user.id,

                    caller_name:
                        callerName,

                    caller_avatar:
                        callerAvatar,

                    mode:
                        mode || "audio",

                    scope:
                        scope || "direct",

                    community_id:
                        room.community_id || null,

                    timestamp:
                        Date.now()

                }

            });

            console.log(
                "📲 Incoming call notification sent to:",
                receiverId
            );

        } catch (error) {

            console.error(
                "Could not send incoming call notification:",
                error
            );

        }


        /*
         * Do not remove this channel immediately.
         * Supabase needs the subscribed channel to broadcast.
         */
        setTimeout(function () {

            try {
                db.removeChannel(channel);
            } catch (error) {
                // Ignore cleanup errors.
            }

        }, 5000);

    }


    /* ================================================================
       DIRECT CALL
       ================================================================ */

    async function startDirectCall(
        targetUserId,
        mode = "audio"
    ) {

        try {

            if (!state.user) {
                await loadCurrentUser();
            }


            if (!targetUserId) {

                toast(
                    "Please select a member to call.",
                    "error"
                );

                return;

            }


            if (
                targetUserId ===
                state.user.id
            ) {

                toast(
                    "You cannot call yourself.",
                    "error"
                );

                return;

            }


            const onlineUsers =
                await getOnlineUsers();


            const target =
                onlineUsers.find(
                    user =>
                        user.id === targetUserId
                );


            if (!target) {

                toast(
                    "That user is not currently online.",
                    "error"
                );

                return;

            }


            const callerProfile =
                state.profile ||
                await getProfile(
                    state.user.id
                );


            const room =
                await createCallRoom({

                    communityId:
                        null,

                    targetUserId:
                        targetUserId,

                    scope:
                        "direct",

                    mode:
                        mode

                });


            await addParticipant(
                room.id,
                state.user.id,
                "ringing"
            );


            await addParticipant(
                room.id,
                targetUserId,
                "invited"
            );


            await createInvite(
                room.id,
                targetUserId
            );


            await notifyUserOfCall(
                targetUserId,
                room,
                callerProfile,
                mode,
                "direct"
            );


            state.currentRoom =
                room;

            state.currentRole =
                "caller";

            state.currentMode =
                mode;


            localStorage.setItem(
                ROOM_PREFIX + room.id,
                JSON.stringify({
                    roomId: room.id,
                    roomCode: room.room_code,
                    role: "caller",
                    mode: mode
                })
            );


            openCallPage(
                room,
                "caller",
                mode
            );


        } catch (error) {

            console.error(
                "Could not start call:",
                error
            );

            toast(
                error?.message ||
                "Could not start the call.",
                "error"
            );

        }

    }


    /* ================================================================
       COMMUNITY CALL
       ================================================================ */

    async function startCommunityCall(
        communityId,
        mode = "audio"
    ) {

        try {

            if (!state.user) {
                await loadCurrentUser();
            }


            if (!communityId) {

                toast(
                    "No community was selected.",
                    "error"
                );

                return;

            }


            const members =
                await getCommunityMembers(
                    communityId
                );


            const recipients =
                members.filter(function (member) {

                    return (
                        member.id &&
                        member.id !==
                            state.user.id
                    );

                });


            if (!recipients.length) {

                toast(
                    "There are no other members in this community.",
                    "error"
                );

                return;

            }


            const room =
                await createCallRoom({

                    communityId:
                        communityId,

                    targetUserId:
                        null,

                    scope:
                        "community",

                    mode:
                        mode

                });


            await addParticipant(
                room.id,
                state.user.id,
                "joined"
            );


            const callerProfile =
                state.profile ||
                await getProfile(
                    state.user.id
                );


            for (
                const member
                of recipients
            ) {

                await addParticipant(
                    room.id,
                    member.id,
                    "invited"
                );

                try {

                    await createInvite(
                        room.id,
                        member.id
                    );

                } catch (error) {

                    console.warn(
                        "Could not create invite for:",
                        member.id,
                        error
                    );

                }

                try {

                    await notifyUserOfCall(
                        member.id,
                        room,
                        callerProfile,
                        mode,
                        "community"
                    );

                } catch (error) {

                    console.warn(
                        "Could not notify member:",
                        member.id,
                        error
                    );

                }

            }


            state.currentRoom =
                room;

            state.currentRole =
                "caller";

            state.currentMode =
                mode;

            state.currentCommunityId =
                communityId;


            openCallPage(
                room,
                "caller",
                mode
            );


        } catch (error) {

            console.error(
                "Could not start community call:",
                error
            );

            toast(
                error?.message ||
                "Could not start community call.",
                "error"
            );

        }

    }


    /* ================================================================
       GENERAL CALL PICKER
       ================================================================ */

    async function openCallPicker(
        communityId = null
    ) {

        try {

            if (!state.user) {
                await loadCurrentUser();
            }


            const users =
                await getOnlineUsers(
                    communityId
                );


            if (!users.length) {

                toast(
                    "No other users are currently online.",
                    "error"
                );

                return;

            }


            state.selectedUsers = [];

            state.pickerCommunityId =
                communityId || null;


            renderCallPicker(
                users,
                communityId
            );


        } catch (error) {

            console.error(
                "Could not open call picker:",
                error
            );

            toast(
                "Could not load online users.",
                "error"
            );

        }

    }


    function removeCallPicker() {

        const existing =
            $("mwanikiCallPicker");

        if (existing) {
            existing.remove();
        }

    }


    function renderCallPicker(
        users,
        communityId
    ) {

        removeCallPicker();


        const overlay =
            document.createElement("div");

        overlay.id =
            "mwanikiCallPicker";


        overlay.innerHTML = `

            <div class="mwaniki-call-picker-backdrop">

                <div class="mwaniki-call-picker">

                    <div class="mwaniki-call-picker-header">

                        <div>
                            <h2>Start a call</h2>
                            <p>
                                Select one or more online users.
                            </p>
                        </div>

                        <button
                            type="button"
                            data-close-call-picker
                        >
                            ×
                        </button>

                    </div>


                    <div class="mwaniki-call-picker-actions">

                        <button
                            type="button"
                            id="mwanikiSelectEveryone"
                        >
                            Select everyone
                        </button>

                        <button
                            type="button"
                            id="mwanikiClearEveryone"
                        >
                            Clear
                        </button>

                    </div>


                    <div
                        id="mwanikiCallUserList"
                        class="mwaniki-call-user-list"
                    ></div>


                    <div class="mwaniki-call-picker-footer">

                        <button
                            type="button"
                            data-close-call-picker
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            id="mwanikiStartSelectedCall"
                        >
                            Start call
                        </button>

                    </div>

                </div>

            </div>

        `;


        document.body.appendChild(
            overlay
        );


        const list =
            $("mwanikiCallUserList");


        users.forEach(function (user) {

            const profile =
                user.profile || {};

            const name =
                displayName(
                    profile,
                    user.id
                );

            const avatar =
                avatarURL(
                    profile
                );


            const item =
                document.createElement("button");

            item.type =
                "button";

            item.className =
                "mwaniki-call-user";

            item.dataset.userId =
                user.id;


            item.innerHTML = `

                <span class="mwaniki-call-check">
                    ✓
                </span>

                ${
                    avatar
                    ? `
                        <img
                            src="${escapeHTML(avatar)}"
                            alt=""
                        >
                    `
                    : `
                        <span class="mwaniki-call-avatar-fallback">
                            ${escapeHTML(initials(name))}
                        </span>
                    `
                }

                <span class="mwaniki-call-user-details">

                    <strong>
                        ${escapeHTML(name)}
                    </strong>

                    <small>
                        ● Online
                    </small>

                </span>

            `;


            item.addEventListener(
                "click",
                function () {

                    const index =
                        state.selectedUsers.indexOf(
                            user.id
                        );


                    if (index >= 0) {

                        state.selectedUsers.splice(
                            index,
                            1
                        );

                        item.classList.remove(
                            "selected"
                        );

                    } else {

                        state.selectedUsers.push(
                            user.id
                        );

                        item.classList.add(
                            "selected"
                        );

                    }

                }
            );


            list.appendChild(
                item
            );

        });


        overlay
            .querySelectorAll(
                "[data-close-call-picker]"
            )
            .forEach(function (button) {

                button.addEventListener(
                    "click",
                    removeCallPicker
                );

            });


        $("mwanikiSelectEveryone")
            .addEventListener(
                "click",
                function () {

                    state.selectedUsers =
                        users.map(
                            user =>
                                user.id
                        );


                    list
                        .querySelectorAll(
                            ".mwaniki-call-user"
                        )
                        .forEach(
                            item =>
                                item.classList.add(
                                    "selected"
                                )
                        );

                }
            );


        $("mwanikiClearEveryone")
            .addEventListener(
                "click",
                function () {

                    state.selectedUsers = [];


                    list
                        .querySelectorAll(
                            ".mwaniki-call-user"
                        )
                        .forEach(
                            item =>
                                item.classList.remove(
                                    "selected"
                                )
                        );

                }
            );


        $("mwanikiStartSelectedCall")
            .addEventListener(
                "click",
                async function () {

                    if (
                        !state.selectedUsers.length
                    ) {

                        toast(
                            "Select at least one online user.",
                            "error"
                        );

                        return;

                    }


                    const selected =
                        [...state.selectedUsers];


                    removeCallPicker();


                    await startGeneralCall(
                        selected,
                        "audio"
                    );

                }
            );

    }


    /* ================================================================
       GENERAL CALL
       ================================================================ */

    async function startGeneralCall(
        userIds,
        mode = "audio"
    ) {

        try {

            if (!state.user) {
                await loadCurrentUser();
            }


            const recipients =
                [...new Set(
                    (userIds || [])
                        .filter(
                            id =>
                                id &&
                                id !== state.user.id
                        )
                )];


            if (!recipients.length) {

                toast(
                    "Select at least one online user.",
                    "error"
                );

                return;

            }


            const room =
                await createCallRoom({

                    communityId:
                        null,

                    targetUserId:
                        null,

                    scope:
                        "general",

                    mode:
                        mode

                });


            await addParticipant(
                room.id,
                state.user.id,
                "joined"
            );


            const callerProfile =
                state.profile ||
                await getProfile(
                    state.user.id
                );


            for (
                const userId
                of recipients
            ) {

                await addParticipant(
                    room.id,
                    userId,
                    "invited"
                );


                try {

                    await createInvite(
                        room.id,
                        userId
                    );

                } catch (error) {

                    console.warn(
                        "Invite creation failed:",
                        error
                    );

                }


                try {

                    await notifyUserOfCall(
                        userId,
                        room,
                        callerProfile,
                        mode,
                        "general"
                    );

                } catch (error) {

                    console.warn(
                        "Notification failed:",
                        error
                    );

                }

            }


            state.currentRoom =
                room;

            state.currentRole =
                "caller";

            state.currentMode =
                mode;


            openCallPage(
                room,
                "caller",
                mode
            );


        } catch (error) {

            console.error(
                "Could not start general call:",
                error
            );

            toast(
                error?.message ||
                "Could not start the call.",
                "error"
            );

        }

    }


    /* ================================================================
       INCOMING CALL UI
       ================================================================ */

    function handleIncomingCall(data) {

        if (!data) {
            return;
        }


        if (!data.room_id) {
            return;
        }


        if (
            state.currentRoom &&
            state.currentRoom.id === data.room_id
        ) {
            return;
        }


        if (
            data.caller_id ===
            state.user?.id
        ) {
            return;
        }


        showIncomingCall(data);

    }


    function removeIncomingCallUI() {

        const element =
            $("mwanikiIncomingCall");

        if (element) {
            element.remove();
        }

        state.incomingCallVisible =
            false;

    }


    function showIncomingCall(data) {

        removeIncomingCallUI();


        state.incomingCallVisible =
            true;


        const overlay =
            document.createElement("div");

        overlay.id =
            "mwanikiIncomingCall";


        const callerName =
            escapeHTML(
                data.caller_name ||
                "Mwaniki Scholar"
            );


        const callerAvatar =
            data.caller_avatar || "";


        overlay.innerHTML = `

            <div class="mwaniki-incoming-call">

                <div class="mwaniki-incoming-call-avatar">

                    ${
                        callerAvatar
                        ? `
                            <img
                                src="${escapeHTML(callerAvatar)}"
                                alt=""
                            >
                        `
                        : `
                            ${escapeHTML(
                                initials(
                                    data.caller_name ||
                                    "User"
                                )
                            )}
                        `
                    }

                </div>

                <div class="mwaniki-incoming-call-info">

                    <strong>
                        ${callerName}
                    </strong>

                    <span>
                        ${
                            data.mode === "video"
                            ? "Incoming video call"
                            : "Incoming audio call"
                        }
                    </span>

                </div>

                <div class="mwaniki-incoming-call-actions">

                    <button
                        type="button"
                        id="mwanikiDeclineCall"
                        class="decline"
                    >
                        Decline
                    </button>

                    <button
                        type="button"
                        id="mwanikiAcceptCall"
                        class="accept"
                    >
                        Accept
                    </button>

                </div>

            </div>

        `;


        document.body.appendChild(
            overlay
        );


        $("mwanikiDeclineCall")
            .addEventListener(
                "click",
                function () {

                    declineIncomingCall(
                        data
                    );

                }
            );


        $("mwanikiAcceptCall")
            .addEventListener(
                "click",
                function () {

                    acceptIncomingCall(
                        data
                    );

                }
            );


        setTimeout(
            function () {

                if (
                    state.incomingCallVisible
                ) {

                    declineIncomingCall(
                        data,
                        true
                    );

                }

            },
            RING_TIMEOUT
        );

    }


    /* ================================================================
       ACCEPT CALL
       ================================================================ */

    async function acceptIncomingCall(
        data
    ) {

        try {

            removeIncomingCallUI();


            const room =
                await getRoom(
                    data.room_id
                );


            if (!room) {

                throw new Error(
                    "The call room no longer exists."
                );

            }


            state.currentRoom =
                room;

            state.currentRole =
                "callee";

            state.currentMode =
                data.mode || "audio";

            state.currentCommunityId =
                room.community_id || null;


            await addParticipant(
                room.id,
                state.user.id,
                "joined"
            );


            await updateInviteStatus(
                room.id,
                state.user.id,
                "accepted"
            );


            try {

                await db
                    .from("chat_call_rooms")
                    .update({
                        room_status: "active"
                    })
                    .eq(
                        "id",
                        room.id
                    );

            } catch (error) {

                console.warn(
                    "Could not activate room:",
                    error
                );

            }


            openCallPage(
                room,
                "callee",
                data.mode || "audio"
            );


        } catch (error) {

            console.error(
                "Could not accept call:",
                error
            );

            toast(
                error?.message ||
                "Could not accept the call.",
                "error"
            );

        }

    }


    /* ================================================================
       DECLINE CALL
       ================================================================ */

    async function declineIncomingCall(
        data,
        timedOut = false
    ) {

        removeIncomingCallUI();


        if (!data?.room_id) {
            return;
        }


        try {

            await updateInviteStatus(
                data.room_id,
                state.user.id,
                timedOut
                    ? "expired"
                    : "declined"
            );

        } catch (error) {

            console.warn(
                "Could not update declined invite:",
                error
            );

        }


        try {

            const channel =
                db.channel(
                    ROOM_PREFIX +
                    data.room_id
                );


            await channel.subscribe();


            await channel.send({

                type: "broadcast",

                event: "call-declined",

                payload: {

                    room_id:
                        data.room_id,

                    user_id:
                        state.user.id,

                    status:
                        timedOut
                            ? "expired"
                            : "declined"

                }

            });


            setTimeout(
                function () {

                    try {
                        db.removeChannel(
                            channel
                        );
                    } catch (error) {
                        // Ignore.
                    }

                },
                2000
            );

        } catch (error) {

            console.warn(
                "Could not notify caller of decline:",
                error
            );

        }

    }


    /* ================================================================
       ROOM
       ================================================================ */

    async function getRoom(roomId) {

        if (!roomId) {
            return null;
        }

        const result =
            await db
                .from("chat_call_rooms")
                .select("*")
                .eq("id", roomId)
                .maybeSingle();


        if (result.error) {
            throw result.error;
        }


        return result.data || null;

    }


    /* ================================================================
       INVITE STATUS
       ================================================================ */

    async function updateInviteStatus(
        roomId,
        receiverId,
        status
    ) {

        if (!roomId || !receiverId) {
            return;
        }


        const result =
            await db
                .from("chat_call_invites")
                .update({
                    status: status
                })
                .eq(
                    "room_id",
                    roomId
                )
                .eq(
                    "receiver_id",
                    receiverId
                );


        if (result.error) {

            console.warn(
                "Invite status update warning:",
                result.error
            );

        }

    }


    /* ================================================================
       CALL PAGE
       ================================================================ */

    function ensureCallPageUI() {

        if (
            $("mwanikiCallApp")
        ) {
            return;
        }


        document.body.innerHTML = `

            <div
                id="mwanikiCallApp"
                class="mwaniki-call-app"
            >

                <header
                    class="mwaniki-call-header"
                >

                    <div>

                        <h1 id="callTitle">
                            Mwaniki Call
                        </h1>

                        <p id="callSubtitle">
                            Connecting...
                        </p>

                    </div>

                    <div
                        id="callStatus"
                    >
                        Connecting
                    </div>

                </header>


                <main
                    class="mwaniki-call-stage"
                >

                    <div
                        id="remoteVideos"
                        class="mwaniki-remote-videos"
                    ></div>


                    <div
                        class="mwaniki-local-video-wrap"
                    >

                        <video
                            id="localVideo"
                            autoplay
                            muted
                            playsinline
                        ></video>

                        <div
                            id="localAudioOnly"
                            class="mwaniki-audio-avatar"
                        >
                            You
                        </div>

                    </div>

                </main>


                <footer
                    class="mwaniki-call-controls"
                >

                    <button
                        type="button"
                        id="micButton"
                    >
                        🎙
                        <span>Mute</span>
                    </button>


                    <button
                        type="button"
                        id="cameraButton"
                    >
                        📷
                        <span>Camera</span>
                    </button>


                    <button
                        type="button"
                        id="screenButton"
                    >
                        🖥
                        <span>Share</span>
                    </button>


                    <button
                        type="button"
                        id="leaveButton"
                        class="danger"
                    >
                        ☎
                        <span>Leave</span>
                    </button>

                </footer>

            </div>

        `;


        installCallPageStyles();

    }


    function installCallPageStyles() {

        if (
            $("mwanikiCallStyles")
        ) {
            return;
        }


        const style =
            document.createElement("style");

        style.id =
            "mwanikiCallStyles";


        style.textContent = `

            * {
                box-sizing:border-box;
            }

            html,
            body {
                margin:0;
                width:100%;
                min-height:100%;
                background:#071b1b;
                color:#fff;
                font-family:Arial, sans-serif;
            }

            body {
                min-height:100vh;
            }

            .mwaniki-call-app {
                min-height:100vh;
                display:flex;
                flex-direction:column;
            }

            .mwaniki-call-header {
                min-height:78px;
                padding:16px 24px;
                display:flex;
                align-items:center;
                justify-content:space-between;
                background:#0a2928;
                border-bottom:1px solid rgba(255,255,255,.1);
            }

            .mwaniki-call-header h1 {
                margin:0 0 4px;
                font-size:20px;
            }

            .mwaniki-call-header p {
                margin:0;
                color:#a9c9c7;
                font-size:13px;
            }

            #callStatus {
                padding:8px 12px;
                border-radius:999px;
                background:#14532d;
                font-size:12px;
            }

            .mwaniki-call-stage {
                position:relative;
                flex:1;
                min-height:0;
                padding:20px;
                display:flex;
                align-items:center;
                justify-content:center;
                overflow:hidden;
            }

            .mwaniki-remote-videos {
                width:100%;
                height:100%;
                display:grid;
                grid-template-columns:
                    repeat(
                        auto-fit,
                        minmax(260px,1fr)
                    );
                gap:14px;
            }

            .mwaniki-remote-tile {
                position:relative;
                min-height:240px;
                background:#102c2c;
                border-radius:18px;
                overflow:hidden;
                display:flex;
                align-items:center;
                justify-content:center;
            }

            .mwaniki-remote-tile video {
                width:100%;
                height:100%;
                object-fit:cover;
            }

            .mwaniki-remote-label {
                position:absolute;
                left:12px;
                bottom:12px;
                padding:6px 9px;
                border-radius:8px;
                background:rgba(0,0,0,.65);
                font-size:12px;
            }

            .mwaniki-local-video-wrap {
                position:absolute;
                right:28px;
                bottom:28px;
                width:220px;
                height:150px;
                border-radius:14px;
                overflow:hidden;
                background:#102c2c;
                border:2px solid rgba(255,255,255,.15);
                z-index:5;
            }

            #localVideo {
                width:100%;
                height:100%;
                object-fit:cover;
            }

            .mwaniki-audio-avatar {
                width:100%;
                height:100%;
                display:flex;
                align-items:center;
                justify-content:center;
                font-weight:700;
            }

            .mwaniki-call-controls {
                min-height:92px;
                display:flex;
                align-items:center;
                justify-content:center;
                gap:12px;
                padding:18px;
                background:#0a2928;
                border-top:1px solid rgba(255,255,255,.1);
            }

            .mwaniki-call-controls button {
                min-width:86px;
                min-height:56px;
                border:0;
                border-radius:14px;
                background:#153b3a;
                color:#fff;
                cursor:pointer;
                display:flex;
                flex-direction:column;
                align-items:center;
                justify-content:center;
                gap:4px;
            }

            .mwaniki-call-controls button:hover {
                background:#1e514f;
            }

            .mwaniki-call-controls button.danger {
                background:#b91c1c;
            }

            .mwaniki-call-controls span {
                font-size:11px;
            }

            .mwaniki-call-picker-backdrop,
            .mwaniki-incoming-call {
                position:fixed;
                inset:0;
                z-index:999999;
            }

            .mwaniki-call-picker-backdrop {
                display:flex;
                align-items:center;
                justify-content:center;
                padding:20px;
                background:rgba(0,0,0,.65);
            }

            .mwaniki-call-picker {
                width:min(520px,100%);
                max-height:90vh;
                overflow:auto;
                background:#fff;
                color:#122;
                border-radius:18px;
                box-shadow:0 20px 60px rgba(0,0,0,.4);
            }

            .mwaniki-call-picker-header {
                display:flex;
                align-items:center;
                justify-content:space-between;
                padding:20px;
                border-bottom:1px solid #e5e7eb;
            }

            .mwaniki-call-picker-header h2 {
                margin:0 0 4px;
            }

            .mwaniki-call-picker-header p {
                margin:0;
                color:#64748b;
                font-size:13px;
            }

            .mwaniki-call-picker-header button {
                border:0;
                background:none;
                font-size:28px;
                cursor:pointer;
            }

            .mwaniki-call-picker-actions,
            .mwaniki-call-picker-footer {
                display:flex;
                gap:10px;
                padding:14px 20px;
            }

            .mwaniki-call-picker-actions button,
            .mwaniki-call-picker-footer button {
                border:0;
                border-radius:10px;
                padding:10px 14px;
                cursor:pointer;
            }

            .mwaniki-call-picker-actions button {
                background:#e6f4f2;
                color:#075e54;
            }

            .mwaniki-call-picker-footer {
                justify-content:flex-end;
                border-top:1px solid #e5e7eb;
            }

            #mwanikiStartSelectedCall {
                background:#087f73;
                color:#fff;
            }

            .mwaniki-call-user-list {
                padding:8px 20px 14px;
            }

            .mwaniki-call-user {
                width:100%;
                display:flex;
                align-items:center;
                gap:12px;
                padding:11px;
                margin:4px 0;
                border:2px solid transparent;
                border-radius:12px;
                background:#f8fafc;
                cursor:pointer;
                text-align:left;
            }

            .mwaniki-call-user.selected {
                border-color:#087f73;
                background:#e6f4f2;
            }

            .mwaniki-call-user img,
            .mwaniki-call-avatar-fallback {
                width:44px;
                height:44px;
                border-radius:50%;
                object-fit:cover;
                display:flex;
                align-items:center;
                justify-content:center;
                background:#087f73;
                color:#fff;
                font-weight:700;
            }

            .mwaniki-call-user-details {
                display:flex;
                flex-direction:column;
                gap:4px;
            }

            .mwaniki-call-user-details small {
                color:#15803d;
            }

            .mwaniki-call-check {
                opacity:0;
            }

            .mwaniki-call-user.selected
            .mwaniki-call-check {
                opacity:1;
                color:#087f73;
                font-weight:700;
            }

            #mwanikiIncomingCall {
                pointer-events:none;
            }

            .mwaniki-incoming-call {
                inset:auto 24px 24px auto;
                width:min(420px,calc(100% - 48px));
                min-height:130px;
                padding:18px;
                display:flex;
                align-items:center;
                gap:14px;
                border-radius:18px;
                background:#fff;
                color:#102020;
                box-shadow:0 20px 60px rgba(0,0,0,.35);
                pointer-events:auto;
            }

            .mwaniki-incoming-call-avatar {
                width:58px;
                height:58px;
                flex:none;
                border-radius:50%;
                overflow:hidden;
                background:#087f73;
                color:#fff;
                display:flex;
                align-items:center;
                justify-content:center;
                font-weight:700;
            }

            .mwaniki-incoming-call-avatar img {
                width:100%;
                height:100%;
                object-fit:cover;
            }

            .mwaniki-incoming-call-info {
                flex:1;
                display:flex;
                flex-direction:column;
                gap:5px;
            }

            .mwaniki-incoming-call-info span {
                font-size:12px;
                color:#64748b;
            }

            .mwaniki-incoming-call-actions {
                display:flex;
                gap:7px;
            }

            .mwaniki-incoming-call-actions button {
                border:0;
                border-radius:10px;
                padding:9px 11px;
                cursor:pointer;
                color:#fff;
            }

            .mwaniki-incoming-call-actions .decline {
                background:#b91c1c;
            }

            .mwaniki-incoming-call-actions .accept {
                background:#047857;
            }

            @media(max-width:700px) {

                .mwaniki-local-video-wrap {
                    width:140px;
                    height:100px;
                    right:12px;
                    bottom:15px;
                }

                .mwaniki-call-controls {
                    gap:6px;
                }

                .mwaniki-call-controls button {
                    min-width:70px;
                }

                .mwaniki-incoming-call {
                    inset:12px;
                    bottom:auto;
                    width:auto;
                }

            }

        `;


        document.head.appendChild(
            style
        );

    }


    /* ================================================================
       MEDIA
       ================================================================ */

    async function startLocalMedia() {

        if (
            state.localStream
        ) {
            return state.localStream;
        }


        const wantsVideo =
            state.currentMode === "video";


        const constraints = {

            audio: true,

            video: wantsVideo
                ? {
                    width: {
                        ideal: 1280
                    },
                    height: {
                        ideal: 720
                    },
                    facingMode: "user"
                }
                : false

        };


        try {

            state.localStream =
                await navigator.mediaDevices
                    .getUserMedia(
                        constraints
                    );


        } catch (error) {

            console.error(
                "Media permission error:",
                error
            );


            /*
             * If video was requested but unavailable,
             * fall back to audio instead of destroying
             * the whole call.
             */
            if (wantsVideo) {

                try {

                    state.currentMode =
                        "audio";

                    state.localStream =
                        await navigator
                            .mediaDevices
                            .getUserMedia({
                                audio: true,
                                video: false
                            });

                    toast(
                        "Camera unavailable. Continuing with audio.",
                        "info"
                    );

                } catch (audioError) {

                    throw audioError;

                }

            } else {

                throw error;

            }

        }


        state.microphoneEnabled =
            state.localStream
                .getAudioTracks()
                .some(
                    track =>
                        track.enabled
                );


        state.cameraEnabled =
            state.localStream
                .getVideoTracks()
                .some(
                    track =>
                        track.enabled
                );


        attachLocalStream();


        return state.localStream;

    }


    function attachLocalStream() {

        const video =
            $("localVideo");

        if (!video) {
            return;
        }


        video.srcObject =
            state.localStream || null;


        const hasVideo =
            !!state.localStream &&
            state.localStream
                .getVideoTracks()
                .length > 0;


        video.style.display =
            hasVideo
                ? "block"
                : "none";


        const avatar =
            $("localAudioOnly");

        if (avatar) {

            avatar.style.display =
                hasVideo
                    ? "none"
                    : "flex";

        }

    }


    /* ================================================================
       ROOM CHANNEL
       ================================================================ */

    async function subscribeRoomChannel() {

        if (!state.currentRoom) {
            throw new Error(
                "No current call room."
            );
        }


        if (state.currentRoomChannel) {

            try {

                await db.removeChannel(
                    state.currentRoomChannel
                );

            } catch (error) {
                // Ignore.
            }

        }


        state.currentRoomChannel =
            db.channel(
                ROOM_PREFIX +
                state.currentRoom.id
            );


        const channel =
            state.currentRoomChannel;


        channel.on(
            "broadcast",
            {
                event: "webrtc-offer"
            },
            async function (message) {

                await handleOffer(
                    message.payload
                );

            }
        );


        channel.on(
            "broadcast",
            {
                event: "webrtc-answer"
            },
            async function (message) {

                await handleAnswer(
                    message.payload
                );

            }
        );


        channel.on(
            "broadcast",
            {
                event: "webrtc-ice"
            },
            async function (message) {

                await handleIceCandidate(
                    message.payload
                );

            }
        );


        channel.on(
            "broadcast",
            {
                event: "peer-joined"
            },
            async function (message) {

                const peerId =
                    message?.payload?.user_id;

                if (
                    peerId &&
                    peerId !== state.user.id
                ) {

                    await maybeCreateOffer(
                        peerId
                    );

                }

            }
        );


        channel.on(
            "broadcast",
            {
                event: "call-ended"
            },
            async function (message) {

                const userId =
                    message?.payload?.user_id;

                if (
                    userId !==
                    state.user?.id
                ) {

                    toast(
                        "The call has ended.",
                        "info"
                    );

                    await leaveCall(
                        false
                    );

                }

            }
        );


        channel.on(
            "broadcast",
            {
                event: "call-declined"
            },
            async function (message) {

                const userId =
                    message?.payload?.user_id;

                if (
                    userId &&
                    userId !== state.user.id
                ) {

                    toast(
                        "A participant declined the call.",
                        "info"
                    );

                }

            }
        );


        channel.on(
            "broadcast",
            {
                event: "peer-left"
            },
            function (message) {

                const userId =
                    message?.payload?.user_id;

                if (userId) {
                    removePeer(
                        userId
                    );
                }

            }
        );


        await new Promise(
            function (resolve) {

                let finished = false;


                const timeout =
                    setTimeout(
                        function () {

                            if (!finished) {

                                finished = true;

                                resolve();

                            }

                        },
                        8000
                    );


                channel.subscribe(
                    function (status) {

                        console.log(
                            "📡 Call room channel:",
                            status
                        );


                        if (
                            status ===
                            "SUBSCRIBED"
                        ) {

                            if (!finished) {

                                finished = true;

                                clearTimeout(
                                    timeout
                                );

                                resolve();

                            }

                        }

                    }
                );

            }
        );


        try {

            await channel.send({

                type: "broadcast",

                event: "peer-joined",

                payload: {

                    user_id:
                        state.user.id

                }

            });

        } catch (error) {

            console.warn(
                "Could not announce peer:",
                error
            );

        }

    }


    /* ================================================================
       PEER CONNECTION
       ================================================================ */

    async function getPeerConnection(
        peerId
    ) {

        if (
            state.peerConnections.has(
                peerId
            )
        ) {

            return state.peerConnections.get(
                peerId
            );

        }


        const peer =
            new RTCPeerConnection(
                RTC_CONFIGURATION
            );


        if (state.localStream) {

            state.localStream
                .getTracks()
                .forEach(
                    function (track) {

                        peer.addTrack(
                            track,
                            state.localStream
                        );

                    }
                );

        }


        peer.onicecandidate =
            async function (event) {

                if (!event.candidate) {
                    return;
                }


                try {

                    await state
                        .currentRoomChannel
                        .send({

                            type:
                                "broadcast",

                            event:
                                "webrtc-ice",

                            payload: {

                                sender_id:
                                    state.user.id,

                                receiver_id:
                                    peerId,

                                candidate:
                                    event.candidate

                            }

                        });

                } catch (error) {

                    console.warn(
                        "ICE send failed:",
                        error
                    );

                }

            };


        peer.ontrack =
            function (event) {

                const stream =
                    event.streams &&
                    event.streams[0]
                        ? event.streams[0]
                        : null;


                if (!stream) {
                    return;
                }


                state.remoteStreams.set(
                    peerId,
                    stream
                );


                renderRemoteStream(
                    peerId,
                    stream
                );

            };


        peer.onconnectionstatechange =
            function () {

                const status =
                    peer.connectionState;


                console.log(
                    "Peer",
                    peerId,
                    "state:",
                    status
                );


                if (
                    status ===
                        "failed" ||
                    status ===
                        "closed"
                ) {

                    removePeer(
                        peerId
                    );

                }

            };


        peer.oniceconnectionstatechange =
            function () {

                if (
                    peer.iceConnectionState ===
                        "failed"
                ) {

                    try {
                        peer.restartIce();
                    } catch (error) {
                        // Ignore.
                    }

                }

            };


        state.peerConnections.set(
            peerId,
            peer
        );


        return peer;

    }


    /* ================================================================
       OFFER
       ================================================================ */

    async function maybeCreateOffer(
        peerId
    ) {

        if (
            !peerId ||
            peerId === state.user.id
        ) {
            return;
        }


        /*
         * Deterministic offerer.
         * Only one side creates the initial offer.
         */
        if (
            String(state.user.id) >
            String(peerId)
        ) {

            return;

        }


        const peer =
            await getPeerConnection(
                peerId
            );


        if (
            peer.signalingState !==
            "stable"
        ) {

            return;

        }


        try {

            const offer =
                await peer.createOffer();


            await peer.setLocalDescription(
                offer
            );


            await state
                .currentRoomChannel
                .send({

                    type:
                        "broadcast",

                    event:
                        "webrtc-offer",

                    payload: {

                        sender_id:
                            state.user.id,

                        receiver_id:
                            peerId,

                        description:
                            peer.localDescription

                    }

                });

        } catch (error) {

            console.error(
                "Could not create offer:",
                error
            );

        }

    }


    /* ================================================================
       OFFER HANDLER
       ================================================================ */

    async function handleOffer(
        payload
    ) {

        if (!payload) {
            return;
        }


        if (
            payload.receiver_id !==
            state.user.id
        ) {
            return;
        }


        if (!payload.sender_id) {
            return;
        }


        const peer =
            await getPeerConnection(
                payload.sender_id
            );


        try {

            await peer.setRemoteDescription(
                new RTCSessionDescription(
                    payload.description
                )
            );


            const answer =
                await peer.createAnswer();


            await peer.setLocalDescription(
                answer
            );


            await state
                .currentRoomChannel
                .send({

                    type:
                        "broadcast",

                    event:
                        "webrtc-answer",

                    payload: {

                        sender_id:
                            state.user.id,

                        receiver_id:
                            payload.sender_id,

                        description:
                            peer.localDescription

                    }

                });

        } catch (error) {

            console.error(
                "Could not handle WebRTC offer:",
                error
            );

        }

    }


    /* ================================================================
       ANSWER
       ================================================================ */

    async function handleAnswer(
        payload
    ) {

        if (!payload) {
            return;
        }


        if (
            payload.receiver_id !==
            state.user.id
        ) {
            return;
        }


        const peer =
            state.peerConnections.get(
                payload.sender_id
            );


        if (!peer) {
            return;
        }


        try {

            await peer.setRemoteDescription(
                new RTCSessionDescription(
                    payload.description
                )
            );

        } catch (error) {

            console.error(
                "Could not handle WebRTC answer:",
                error
            );

        }

    }


    /* ================================================================
       ICE
       ================================================================ */

    async function handleIceCandidate(
        payload
    ) {

        if (!payload) {
            return;
        }


        if (
            payload.receiver_id !==
            state.user.id
        ) {
            return;
        }


        const peer =
            state.peerConnections.get(
                payload.sender_id
            );


        if (!peer) {

            /*
             * Create peer first so the candidate
             * has somewhere to go.
             */
            await getPeerConnection(
                payload.sender_id
            );

        }


        const connection =
            state.peerConnections.get(
                payload.sender_id
            );


        if (!connection) {
            return;
        }


        try {

            if (
                connection.remoteDescription
            ) {

                await connection.addIceCandidate(
                    payload.candidate
                );

            }

        } catch (error) {

            console.warn(
                "Could not add ICE candidate:",
                error
            );

        }

    }


    /* ================================================================
       REMOTE VIDEO
       ================================================================ */

    function renderRemoteStream(
        peerId,
        stream
    ) {

        const container =
            $("remoteVideos");

        if (!container) {
            return;
        }


        let tile =
            document.querySelector(
                `[data-peer-tile="${CSS.escape(peerId)}"]`
            );


        if (!tile) {

            tile =
                document.createElement("div");

            tile.className =
                "mwaniki-remote-tile";

            tile.dataset.peerTile =
                peerId;


            const video =
                document.createElement("video");

            video.autoplay =
                true;

            video.playsInline =
                true;

            video.dataset.peerVideo =
                peerId;


            const label =
                document.createElement("div");

            label.className =
                "mwaniki-remote-label";

            label.textContent =
                "Connecting...";


            tile.appendChild(
                video
            );

            tile.appendChild(
                label
            );

            container.appendChild(
                tile
            );


            getProfile(peerId)
                .then(
                    function (profile) {

                        label.textContent =
                            displayName(
                                profile,
                                peerId
                            );

                    }
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
                    function () {
                        // Browser may require user interaction.
                    }
                );

        }

    }


    /* ================================================================
       REMOVE PEER
       ================================================================ */

    function removePeer(
        peerId
    ) {

        const peer =
            state.peerConnections.get(
                peerId
            );


        if (peer) {

            try {
                peer.close();
            } catch (error) {
                // Ignore.
            }

        }


        state.peerConnections.delete(
            peerId
        );

        state.remoteStreams.delete(
            peerId
        );


        const tile =
            document.querySelector(
                `[data-peer-tile="${CSS.escape(peerId)}"]`
            );


        if (tile) {
            tile.remove();
        }

    }


    /* ================================================================
       START CALL PAGE
       ================================================================ */

    async function initializeCallPage() {

        const params =
            new URLSearchParams(
                window.location.search
            );


        const roomId =
            params.get("room");


        const roomCode =
            params.get("room_code");


        const role =
            params.get("role") ||
            "callee";


        const mode =
            params.get("mode") ||
            "audio";


        if (!roomId) {
            return;
        }


        try {

            await loadCurrentUser();


            state.profile =
                await getProfile(
                    state.user.id
                );


            const room =
                await getRoom(
                    roomId
                );


            if (!room) {

                throw new Error(
                    "Call room was not found."
                );

            }


            if (
                roomCode &&
                room.room_code &&
                room.room_code !== roomCode
            ) {

                throw new Error(
                    "Invalid call room."
                );

            }


            state.currentRoom =
                room;

            state.currentRole =
                role;

            state.currentMode =
                mode;


            ensureCallPageUI();


            const title =
                $("callTitle");

            const subtitle =
                $("callSubtitle");

            const status =
                $("callStatus");


            if (title) {

                title.textContent =
                    room.call_scope === "community"
                        ? "Community Call"
                        : room.call_scope === "general"
                            ? "General Call"
                            : "Mwaniki Call";

            }


            if (subtitle) {

                subtitle.textContent =
                    mode === "video"
                        ? "Video call"
                        : "Audio call";

            }


            if (status) {
                status.textContent =
                    "Connecting...";
            }


            await startLocalMedia();


            await addParticipant(
                room.id,
                state.user.id,
                "joined"
            );


            await subscribeRoomChannel();


            bindCallControls();


            state.callStarted =
                true;


            if (role === "caller") {

                try {

                    await db
                        .from("chat_call_rooms")
                        .update({
                            room_status: "active"
                        })
                        .eq(
                            "id",
                            room.id
                        );

                } catch (error) {

                    console.warn(
                        "Could not mark room active:",
                        error
                    );

                }

            }


            if (status) {
                status.textContent =
                    "Connected";
            }


            await discoverExistingParticipants();


            if (state.ringTimer) {

                clearTimeout(
                    state.ringTimer
                );

                state.ringTimer =
                    null;

            }


            console.log(
                "📞 Call page ready:",
                room.id
            );


        } catch (error) {

            console.error(
                "CALL PAGE INITIALIZATION FAILED:",
                error
            );

            toast(
                error?.message ||
                "Could not start the call.",
                "error"
            );

        }

    }


    /* ================================================================
       EXISTING PARTICIPANTS
       ================================================================ */

    async function discoverExistingParticipants() {

        if (!state.currentRoom) {
            return;
        }


        const result =
            await db
                .from("chat_call_participants")
                .select("*")
                .eq(
                    "room_id",
                    state.currentRoom.id
                );


        if (result.error) {

            console.warn(
                "Could not load call participants:",
                result.error
            );

            return;

        }


        const participants =
            result.data || [];


        for (
            const participant
            of participants
        ) {

            const peerId =
                participant.user_id;


            if (
                !peerId ||
                peerId === state.user.id
            ) {
                continue;
            }


            /*
             * Give the caller/lexically-smaller ID
             * responsibility for creating the offer.
             */
            await maybeCreateOffer(
                peerId
            );

        }

    }


    /* ================================================================
       CALL CONTROLS
       ================================================================ */

    function bindCallControls() {

        const mic =
            $("micButton");

        const camera =
            $("cameraButton");

        const screen =
            $("screenButton");

        const leave =
            $("leaveButton");


        if (mic) {

            mic.onclick =
                toggleMicrophone;

        }


        if (camera) {

            camera.onclick =
                toggleCamera;

        }


        if (screen) {

            screen.onclick =
                toggleScreenShare;

        }


        if (leave) {

            leave.onclick =
                function () {

                    leaveCall(
                        true
                    );

                };

        }

    }


    /* ================================================================
       MICROPHONE
       ================================================================ */

    function toggleMicrophone() {

        if (!state.localStream) {
            return;
        }


        const tracks =
            state.localStream
                .getAudioTracks();


        if (!tracks.length) {

            toast(
                "No microphone track is available.",
                "error"
            );

            return;

        }


        state.microphoneEnabled =
            !state.microphoneEnabled;


        tracks.forEach(
            function (track) {

                track.enabled =
                    state.microphoneEnabled;

            }
        );


        const button =
            $("micButton");


        if (button) {

            button.querySelector(
                "span"
            ).textContent =
                state.microphoneEnabled
                    ? "Mute"
                    : "Unmute";

        }


        if (state.currentRoom) {

            updateParticipant(
                state.currentRoom.id,
                state.user.id,
                {
                    is_muted:
                        !state.microphoneEnabled
                }
            );

        }

    }


    /* ================================================================
       CAMERA
       ================================================================ */

    function toggleCamera() {

        if (!state.localStream) {
            return;
        }


        const tracks =
            state.localStream
                .getVideoTracks();


        if (!tracks.length) {

            toast(
                "Camera is not active for this call.",
                "info"
            );

            return;

        }


        state.cameraEnabled =
            !state.cameraEnabled;


        tracks.forEach(
            function (track) {

                track.enabled =
                    state.cameraEnabled;

            }
        );


        const button =
            $("cameraButton");


        if (button) {

            button.querySelector(
                "span"
            ).textContent =
                state.cameraEnabled
                    ? "Camera off"
                    : "Camera";

        }


        if (state.currentRoom) {

            updateParticipant(
                state.currentRoom.id,
                state.user.id,
                {
                    camera:
                        state.cameraEnabled
                }
            );

        }

    }


    /* ================================================================
       SCREEN SHARE
       ================================================================ */

    async function toggleScreenShare() {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getDisplayMedia
        ) {

            toast(
                "Screen sharing is not supported by this browser.",
                "error"
            );

            return;

        }


        if (
            state.screenSharing
        ) {

            stopScreenShare();

            return;

        }


        try {

            state.screenStream =
                await navigator
                    .mediaDevices
                    .getDisplayMedia({
                        video: true,
                        audio: false
                    });


            const screenTrack =
                state.screenStream
                    .getVideoTracks()[0];


            if (!screenTrack) {
                throw new Error(
                    "No screen track was returned."
                );
            }


            for (
                const peer
                of state.peerConnections.values()
            ) {

                const sender =
                    peer
                        .getSenders()
                        .find(
                            function (item) {

                                return (
                                    item.track &&
                                    item.track.kind ===
                                        "video"
                                );

                            }
                        );


                if (sender) {

                    await sender.replaceTrack(
                        screenTrack
                    );

                }

            }


            state.screenSharing =
                true;


            screenTrack.onended =
                function () {

                    stopScreenShare();

                };


            const button =
                $("screenButton");


            if (button) {

                button.querySelector(
                    "span"
                ).textContent =
                    "Stop share";

            }


            if (state.currentRoom) {

                updateParticipant(
                    state.currentRoom.id,
                    state.user.id,
                    {
                        screen_share:
                            true
                    }
                );

            }


        } catch (error) {

            console.error(
                "Screen sharing failed:",
                error
            );

            toast(
                "Screen sharing was cancelled or unavailable.",
                "error"
            );

        }

    }


    async function stopScreenShare() {

        if (!state.screenSharing) {
            return;
        }


        if (state.screenStream) {

            state.screenStream
                .getTracks()
                .forEach(
                    function (track) {

                        track.stop();

                    }
                );

        }


        state.screenStream =
            null;


        const cameraTrack =
            state.localStream
                ? state.localStream
                    .getVideoTracks()[0]
                : null;


        for (
            const peer
            of state.peerConnections.values()
        ) {

            const sender =
                peer
                    .getSenders()
                    .find(
                        function (item) {

                            return (
                                item.track &&
                                item.track.kind ===
                                    "video"
                            );

                        }
                    );


            if (sender) {

                try {

                    await sender.replaceTrack(
                        cameraTrack || null
                    );

                } catch (error) {

                    console.warn(
                        "Could not restore camera:",
                        error
                    );

                }

            }

        }


        state.screenSharing =
            false;


        const button =
            $("screenButton");


        if (button) {

            button.querySelector(
                "span"
            ).textContent =
                "Share";

        }


        if (state.currentRoom) {

            updateParticipant(
                state.currentRoom.id,
                state.user.id,
                {
                    screen_share:
                        false
                }
            );

        }

    }


    /* ================================================================
       LEAVE CALL
       ================================================================ */

    async function leaveCall(
        notifyOthers = true
    ) {

        if (
            state.endingCall
        ) {
            return;
        }


        state.endingCall =
            true;


        try {

            if (
                state.currentRoom &&
                notifyOthers &&
                state.currentRoomChannel
            ) {

                try {

                    await state
                        .currentRoomChannel
                        .send({

                            type:
                                "broadcast",

                            event:
                                "call-ended",

                            payload: {

                                room_id:
                                    state.currentRoom.id,

                                user_id:
                                    state.user.id

                            }

                        });

                } catch (error) {

                    console.warn(
                        "Could not notify call end:",
                        error
                    );

                }

            }


            if (state.currentRoom) {

                await updateParticipant(
                    state.currentRoom.id,
                    state.user.id,
                    {
                        status:
                            "left",

                        left_at:
                            new Date().toISOString()
                    }
                );


                try {

                    await db
                        .from("chat_call_invites")
                        .update({
                            status:
                                "ended"
                        })
                        .eq(
                            "room_id",
                            state.currentRoom.id
                        )
                        .eq(
                            "receiver_id",
                            state.user.id
                        );

                } catch (error) {

                    console.warn(
                        "Invite cleanup warning:",
                        error
                    );

                }


                /*
                 * The room remains in the database for history.
                 * Mark it ended instead of deleting it.
                 */
                try {

                    await db
                        .from("chat_call_rooms")
                        .update({
                            room_status:
                                "ended"
                        })
                        .eq(
                            "id",
                            state.currentRoom.id
                        );

                } catch (error) {

                    console.warn(
                        "Could not close call room:",
                        error
                    );

                }

            }


        } catch (error) {

            console.warn(
                "Call cleanup warning:",
                error
            );

        } finally {

            stopAllMedia();

            closeAllPeerConnections();

            await removeRoomChannel();


            state.currentRoom =
                null;

            state.currentInvite =
                null;

            state.callStarted =
                false;

            state.endingCall =
                false;


            /*
             * Return to Community instead of leaving
             * the user on a dead call page.
             */
            if (
                window.location.pathname
                    .toLowerCase()
                    .includes(
                        "community-calls"
                    )
            ) {

                window.location.href =
                    "./community.html";

            }

        }

    }


    /* ================================================================
       MEDIA CLEANUP
       ================================================================ */

    function stopAllMedia() {

        if (state.screenStream) {

            state.screenStream
                .getTracks()
                .forEach(
                    function (track) {

                        track.stop();

                    }
                );

        }


        if (state.localStream) {

            state.localStream
                .getTracks()
                .forEach(
                    function (track) {

                        track.stop();

                    }
                );

        }


        state.screenStream =
            null;

        state.localStream =
            null;

        state.screenSharing =
            false;

    }


    function closeAllPeerConnections() {

        for (
            const peer
            of state.peerConnections.values()
        ) {

            try {
                peer.close();
            } catch (error) {
                // Ignore.
            }

        }


        state.peerConnections.clear();

        state.remoteStreams.clear();


        const container =
            $("remoteVideos");


        if (container) {
            container.innerHTML = "";
        }

    }


    async function removeRoomChannel() {

        if (
            !state.currentRoomChannel ||
            !db
        ) {
            return;
        }


        try {

            await db.removeChannel(
                state.currentRoomChannel
            );

        } catch (error) {

            console.warn(
                "Could not remove call channel:",
                error
            );

        }


        state.currentRoomChannel =
            null;

    }


    /* ================================================================
       MISSED CALLS
       ================================================================ */

    function saveMissedCall(data) {

        try {

            const existing =
                JSON.parse(
                    localStorage.getItem(
                        MISSED_CALL_KEY
                    ) || "[]"
                );


            existing.unshift({

                room_id:
                    data.room_id,

                caller_id:
                    data.caller_id,

                caller_name:
                    data.caller_name,

                caller_avatar:
                    data.caller_avatar,

                mode:
                    data.mode,

                timestamp:
                    Date.now()

            });


            localStorage.setItem(
                MISSED_CALL_KEY,
                JSON.stringify(
                    existing.slice(0, 50)
                )
            );

        } catch (error) {

            console.warn(
                "Could not save missed call:",
                error
            );

        }

    }


    function refreshMissedCallNotifications() {

        try {

            const existing =
                JSON.parse(
                    localStorage.getItem(
                        MISSED_CALL_KEY
                    ) || "[]"
                );


            return existing;

        } catch (error) {

            return [];

        }

    }


    /* ================================================================
       PUBLIC API
       ================================================================ */

    window.MwanikiCalls = {

        callUser:
            startDirectCall,

        callCommunity:
            startCommunityCall,

        openPicker:
            openCallPicker,

        generalCall:
            startGeneralCall,

        leave:
            leaveCall,

        refreshMissedCalls:
            refreshMissedCallNotifications,

        getOnlineUsers:
            getOnlineUsers

    };


    /* ================================================================
       INITIALIZATION
       ================================================================ */

    async function initialize() {

        if (
            state.initialized
        ) {
            return;
        }


        state.initialized =
            true;


        try {

            await waitForSupabase();

            await loadCurrentUser();

            state.profile =
                await getProfile(
                    state.user.id
                );


            /*
             * Only subscribe to incoming calls while
             * the user is NOT already inside a call page.
             */
            const isCallPage =
                window.location.pathname
                    .toLowerCase()
                    .includes(
                        "community-calls"
                    );


            if (!isCallPage) {

                await subscribeIncomingCalls();

            } else {

                await initializeCallPage();

            }


            console.log(
                "📞 Mwaniki real call engine ready."
            );


        } catch (error) {

            console.error(
                "Mwaniki call engine initialization failed:",
                error
            );

        }

    }


    /* ================================================================
       PAGE LIFECYCLE
       ================================================================ */

    window.addEventListener(
        "beforeunload",
        function () {

            if (
                state.localStream
            ) {

                state.localStream
                    .getTracks()
                    .forEach(
                        function (track) {

                            track.stop();

                        }
                    );

            }

        }
    );


    window.addEventListener(
        "pagehide",
        function () {

            if (
                state.localStream
            ) {

                state.localStream
                    .getTracks()
                    .forEach(
                        function (track) {

                            track.stop();

                        }
                    );

            }

        }
    );


    /*
     * Start after DOM is available.
     */
    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize
        );

    } else {

        initialize();

    }


})();
