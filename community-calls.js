/* ============================================================
   MWANIKI SCHOLARS
   REAL COMMUNITY CALL ENGINE
   File: community-calls.js

   IMPORTANT:
   - Plain JavaScript file.
   - NO import statement.
   - Uses the global Supabase client created by supabase.js.
   - Real WebRTC.
   - One-to-one calls.
   - Community calls.
   - Offline/missed calls.
   - Incoming call ringing.
   - Audio/video.
   - Screen sharing.
   ============================================================ */

(() => {

    "use strict";

    console.log("📞 Mwaniki Scholars Call Engine loading...");


    /* ============================================================
       CONFIGURATION
       ============================================================ */

    const CONFIG = {

        presenceWindowMs:
            90 * 1000,

        ringTimeoutMs:
            45 * 1000,

        callPage:
            "./community-calls.html",

        storageMissedCalls:
            "mwanikiMissedCallIds",

        roomPrefix:
            "mwaniki-call-room-",

        userPrefix:
            "mwaniki-call-user-",

        iceServers: [

            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302"
                ]
            }

        ]

    };


    /* ============================================================
       STATE
       ============================================================ */

    const state = {

        db: null,

        user: null,

        profile: null,

        currentRoom: null,

        currentInvite: null,

        currentMode: "audio",

        currentRole: null,

        communityId: null,

        peerConnections: new Map(),

        remoteStreams: new Map(),

        localStream: null,

        screenStream: null,

        roomChannel: null,

        incomingChannel: null,

        presenceTimer: null,

        ringTimer: null,

        microphoneEnabled: true,

        cameraEnabled: true,

        screenSharing: false,

        initialized: false,

        isCallPage:
            window.location.pathname
                .toLowerCase()
                .includes("community-calls.html")

    };


    /* ============================================================
       BASIC HELPERS
       ============================================================ */

    function byId(id) {

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


    function safeURL(value) {

        const url =
            String(value || "").trim();

        if (
            url.startsWith("https://") ||
            url.startsWith("http://") ||
            url.startsWith("data:image/")
        ) {

            return url;

        }

        return "";

    }


    function initials(name) {

        const text =
            String(name || "Student")
                .trim();

        if (!text) {
            return "S";
        }

        const parts =
            text.split(/\s+/)
                .filter(Boolean);

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


    function getDisplayName(profile, fallback = "Student") {

        return (
            profile?.full_name ||
            profile?.display_name ||
            profile?.name ||
            fallback
        );

    }


    function showToast(message, type = "info") {

        let toast =
            byId("toast") ||
            byId("communityToast");

        if (!toast) {

            toast =
                document.createElement("div");

            toast.id =
                "mwanikiCallToast";

            toast.className =
                "mwaniki-call-toast";

            document.body.appendChild(toast);

        }

        toast.textContent =
            String(message || "");

        toast.dataset.type =
            type;

        toast.classList.add("visible");

        clearTimeout(
            toast.__hideTimer
        );

        toast.__hideTimer =
            setTimeout(() => {

                toast.classList.remove(
                    "visible"
                );

            }, 4000);

    }


    /* ============================================================
       WAIT FOR SUPABASE
       ============================================================ */

    async function waitForSupabase(
        timeout = 15000
    ) {

        const started =
            Date.now();

        while (
            Date.now() - started <
            timeout
        ) {

            const client =
                window.supabase ||
                window.supabaseClient ||
                window.sb ||
                window.mwanikiSupabase;

            if (
                client &&
                typeof client.from ===
                    "function"
            ) {

                state.db =
                    client;

                return client;

            }

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        100
                    )
            );

        }

        throw new Error(
            "Supabase client was not found."
        );

    }


    /* ============================================================
       CURRENT USER
       ============================================================ */

    async function loadCurrentUser() {

        const {
            data,
            error
        } =
            await state.db.auth.getUser();

        if (error) {
            throw error;
        }

        state.user =
            data?.user || null;

        if (!state.user) {

            throw new Error(
                "You must be signed in."
            );

        }

        return state.user;

    }


    /* ============================================================
       PROFILE
       ============================================================ */

    async function loadProfile(userId) {

        if (!userId) {
            return null;
        }

        let profile = null;


        /*
         * First try students because that is the profile
         * source already used by the community engine.
         */

        try {

            const {
                data
            } =
                await state.db
                    .from("students")
                    .select(
                        "id, full_name, photo_url"
                    )
                    .eq(
                        "id",
                        userId
                    )
                    .maybeSingle();

            if (data) {

                profile = {

                    id:
                        data.id,

                    full_name:
                        data.full_name,

                    display_name:
                        data.full_name,

                    avatar_url:
                        data.photo_url

                };

            }

        } catch (_) {
            /* fallback below */
        }


        /*
         * Fallback to chat_public_profiles.
         */

        if (!profile) {

            try {

                const {
                    data
                } =
                    await state.db
                        .from(
                            "chat_public_profiles"
                        )
                        .select(
                            "id, display_name, full_name, avatar_url"
                        )
                        .eq(
                            "id",
                            userId
                        )
                        .maybeSingle();

                if (data) {

                    profile =
                        data;

                }

            } catch (_) {}

        }


        return profile;

    }


    /* ============================================================
       PRESENCE
       ============================================================ */

    function isPresenceOnline(row) {

        if (!row) {
            return false;
        }

        if (
            String(row.status || "")
                .toLowerCase() !==
            "online"
        ) {

            return false;

        }

        const lastSeen =
            new Date(
                row.last_seen_at ||
                row.updated_at ||
                0
            ).getTime();

        if (!lastSeen) {
            return false;
        }

        return (
            Date.now() -
                lastSeen <=
            CONFIG.presenceWindowMs
        );

    }


    async function isUserOnline(userId) {

        if (!userId) {
            return false;
        }

        const {
            data,
            error
        } =
            await state.db
                .from("chat_presence")
                .select(
                    "user_id, status, last_seen_at, updated_at"
                )
                .eq(
                    "user_id",
                    userId
                )
                .maybeSingle();

        if (error) {

            console.warn(
                "Presence check failed:",
                error
            );

            return false;

        }

        return isPresenceOnline(data);

    }


    async function getCommunityMembers(
        communityId
    ) {

        if (!communityId) {
            return [];
        }

        const {
            data,
            error
        } =
            await state.db
                .from(
                    "chat_community_members"
                )
                .select(
                    "user_id"
                )
                .eq(
                    "community_id",
                    communityId
                );

        if (error) {
            throw error;
        }

        return (
            data || []
        )
            .map(row =>
                row.user_id
            )
            .filter(
                id =>
                    id &&
                    String(id) !==
                    String(
                        state.user.id
                    )
            );

    }


    async function getOnlineUsers(
        communityId = null
    ) {

        let userIds = [];


        if (communityId) {

            userIds =
                await getCommunityMembers(
                    communityId
                );

        } else {

            const {
                data,
                error
            } =
                await state.db
                    .from("chat_presence")
                    .select(
                        "user_id, status, last_seen_at, updated_at"
                    );

            if (error) {
                throw error;
            }

            userIds =
                (data || [])
                    .filter(
                        row =>
                            String(
                                row.user_id
                            ) !==
                            String(
                                state.user.id
                            ) &&
                            isPresenceOnline(
                                row
                            )
                    )
                    .map(
                        row =>
                            row.user_id
                    );

        }


        const uniqueIds =
            [
                ...new Set(
                    userIds.map(
                        id =>
                            String(id)
                    )
                )
            ];


        const users = [];

        for (
            const userId of
            uniqueIds
        ) {

            const online =
                await isUserOnline(
                    userId
                );

            if (!online) {
                continue;
            }

            const profile =
                await loadProfile(
                    userId
                );

            users.push({

                id:
                    userId,

                name:
                    getDisplayName(
                        profile,
                        "Student"
                    ),

                avatar:
                    safeURL(
                        profile?.avatar_url ||
                        profile?.photo_url
                    )

            });

        }

        return users;

    }


    /* ============================================================
       CALL URL
       ============================================================ */

    function buildCallURL(
        roomId,
        mode,
        role,
        inviteId = ""
    ) {

        const params =
            new URLSearchParams();

        params.set(
            "room",
            String(roomId)
        );

        params.set(
            "mode",
            mode || "audio"
        );

        params.set(
            "role",
            role || "caller"
        );

        if (inviteId) {

            params.set(
                "invite",
                String(inviteId)
            );

        }

        return (
            CONFIG.callPage +
            "?" +
            params.toString()
        );

    }


    function openCallPage(
        roomId,
        mode,
        role,
        inviteId = ""
    ) {

        window.location.href =
            buildCallURL(
                roomId,
                mode,
                role,
                inviteId
            );

    }


    /* ============================================================
       CALL ROOM CREATION
       ============================================================ */

    async function createCallRoom({
        communityId = null,
        targetUserId = null,
        mode = "audio",
        scope = "direct"
    }) {

        const {
            data,
            error
        } =
            await state.db
                .from(
                    "chat_call_rooms"
                )
                .insert({

                    community_id:
                        communityId,

                    created_by:
                        state.user.id,

                    target_user_id:
                        targetUserId,

                    room_status:
                        "ringing",

                    call_scope:
                        scope,

                    max_participants:
                        scope ===
                        "community"
                            ? 100
                            : 2

                })
                .select(
                    "id, community_id, created_by, target_user_id, room_status, call_scope, max_participants"
                )
                .single();

        if (error) {
            throw error;
        }

        return data;

    }


    /* ============================================================
       INVITE
       ============================================================ */

    async function createInvite({
        roomId,
        receiverId,
        mode
    }) {

        const {
            data,
            error
        } =
            await state.db
                .from(
                    "chat_call_invites"
                )
                .insert({

                    room_id:
                        roomId,

                    sender_id:
                        state.user.id,

                    receiver_id:
                        receiverId,

                    status:
                        "ringing"

                })
                .select()
                .single();

        if (error) {
            throw error;
        }

        return data;

    }


    async function updateInvite(
        inviteId,
        status
    ) {

        if (!inviteId) {
            return;
        }

        try {

            const {
                error
            } =
                await state.db
                    .from(
                        "chat_call_invites"
                    )
                    .update({

                        status,

                        responded_at:
                            new Date()
                                .toISOString()

                    })
                    .eq(
                        "id",
                        inviteId
                    );

            if (error) {

                console.warn(
                    "Invite update failed:",
                    error
                );

            }

        } catch (error) {

            console.warn(
                "Invite update exception:",
                error
            );

        }

    }


    /* ============================================================
       INCOMING USER CHANNEL
       ============================================================ */

    async function setupIncomingChannel() {

        if (
            !state.db ||
            !state.user?.id
        ) {
            return;
        }


        if (
            state.incomingChannel
        ) {

            try {

                await state.db
                    .removeChannel(
                        state.incomingChannel
                    );

            } catch (_) {}

        }


        state.incomingChannel =
            state.db.channel(
                CONFIG.userPrefix +
                state.user.id
            );


        state.incomingChannel
            .on(
                "broadcast",
                {
                    event:
                        "incoming-call"
                },
                async payload => {

                    console.log(
                        "📞 Incoming call:",
                        payload
                    );

                    await showIncomingCall(
                        payload?.payload ||
                        payload
                    );

                }
            )
            .subscribe(
                status => {

                    console.log(
                        "📞 Incoming call channel:",
                        status
                    );

                }
            );

    }


    /* ============================================================
       BROADCAST TO USER
       ============================================================ */

    async function notifyUserOfCall({
        userId,
        roomId,
        inviteId,
        mode,
        communityId,
        caller
    }) {

        const channel =
            state.db.channel(
                CONFIG.userPrefix +
                userId
            );


        await channel.subscribe();


        await channel.send({

            type:
                "broadcast",

            event:
                "incoming-call",

            payload: {

                roomId,

                inviteId,

                mode,

                communityId,

                caller: {

                    id:
                        caller.id,

                    name:
                        caller.name,

                    avatar:
                        caller.avatar

                },

                createdAt:
                    new Date()
                        .toISOString()

            }

        });


        setTimeout(
            () => {

                try {

                    state.db
                        .removeChannel(
                            channel
                        );

                } catch (_) {}

            },
            5000
        );

    }


    /* ============================================================
       CURRENT CALLER PROFILE
       ============================================================ */

    async function getCallerProfile() {

        const profile =
            state.profile ||
            await loadProfile(
                state.user.id
            );

        return {

            id:
                state.user.id,

            name:
                getDisplayName(
                    profile,
                    state.user.email ||
                    "Student"
                ),

            avatar:
                safeURL(
                    profile?.avatar_url ||
                    profile?.photo_url
                )

        };

    }


    /* ============================================================
       START DIRECT CALL
       ============================================================ */

    async function startDirectCall(
        targetUserId,
        mode = "audio"
    ) {

        if (!targetUserId) {

            showToast(
                "Select a person to call.",
                "error"
            );

            return;

        }


        if (
            String(targetUserId) ===
            String(state.user.id)
        ) {

            showToast(
                "You cannot call yourself.",
                "error"
            );

            return;

        }


        try {

            showToast(
                "Checking whether the person is online..."
            );


            const online =
                await isUserOnline(
                    targetUserId
                );


            const caller =
                await getCallerProfile();


            const targetProfile =
                await loadProfile(
                    targetUserId
                );


            const room =
                await createCallRoom({

                    communityId:
                        null,

                    targetUserId,

                    mode,

                    scope:
                        "direct"

                });


            const invite =
                await createInvite({

                    roomId:
                        room.id,

                    receiverId:
                        targetUserId,

                    mode

                });


            /*
             * OFFLINE:
             *
             * No ringing is attempted.
             * The database permanently records
             * the missed call.
             */

            if (!online) {

                await updateInvite(
                    invite.id,
                    "missed"
                );


                try {

                    await state.db
                        .from(
                            "chat_call_rooms"
                        )
                        .update({

                            room_status:
                                "missed"

                        })
                        .eq(
                            "id",
                            room.id
                        );

                } catch (_) {}


                showToast(
                    `${
                        getDisplayName(
                            targetProfile,
                            "Student"
                        )
                    } is offline. A missed-call notification has been left.`,
                    "info"
                );


                /*
                 * We don't enter a dead call room.
                 */

                return;

            }


            /*
             * ONLINE:
             *
             * Send the real-time ringing signal.
             */

            await notifyUserOfCall({

                userId:
                    targetUserId,

                roomId:
                    room.id,

                inviteId:
                    invite.id,

                mode,

                communityId:
                    null,

                caller

            });


            showToast(
                "Calling..."
            );


            openCallPage(
                room.id,
                mode,
                "caller",
                invite.id
            );

        } catch (error) {

            console.error(
                "❌ Direct call failed:",
                error
            );

            showToast(
                error.message ||
                "Unable to start the call.",
                "error"
            );

        }

    }


    /* ============================================================
       START COMMUNITY CALL
       ============================================================ */

    async function startCommunityCall(
        communityId,
        mode = "audio"
    ) {

        if (!communityId) {

            showToast(
                "Select a community first.",
                "error"
            );

            return;

        }


        try {

            showToast(
                "Preparing the community call..."
            );


            const room =
                await createCallRoom({

                    communityId,

                    targetUserId:
                        null,

                    mode,

                    scope:
                        "community"

                });


            const members =
                await getCommunityMembers(
                    communityId
                );


            if (!members.length) {

                showToast(
                    "There are no other members in this community.",
                    "info"
                );

                return;

            }


            const caller =
                await getCallerProfile();


            let onlineCount = 0;

            let offlineCount = 0;


            for (
                const userId of
                members
            ) {

                try {

                    const online =
                        await isUserOnline(
                            userId
                        );


                    const invite =
                        await createInvite({

                            roomId:
                                room.id,

                            receiverId:
                                userId,

                            mode

                        });


                    if (online) {

                        onlineCount++;


                        await notifyUserOfCall({

                            userId,

                            roomId:
                                room.id,

                            inviteId:
                                invite.id,

                            mode,

                            communityId,

                            caller

                        });

                    } else {

                        offlineCount++;


                        /*
                         * Persistent missed call.
                         */

                        await updateInvite(
                            invite.id,
                            "missed"
                        );

                    }

                } catch (memberError) {

                    console.warn(
                        "Could not invite member:",
                        userId,
                        memberError
                    );

                }

            }


            if (
                onlineCount === 0
            ) {

                await state.db
                    .from(
                        "chat_call_rooms"
                    )
                    .update({

                        room_status:
                            "missed"

                    })
                    .eq(
                        "id",
                        room.id
                    );


                showToast(
                    "Everyone in the community is offline. Missed-call notifications have been recorded.",
                    "info"
                );


                return;

            }


            showToast(
                `Calling ${onlineCount} online member${
                    onlineCount === 1
                        ? ""
                        : "s"
                }${
                    offlineCount
                        ? ` • ${offlineCount} offline`
                        : ""
                }...`
            );


            openCallPage(
                room.id,
                mode,
                "caller"
            );

        } catch (error) {

            console.error(
                "❌ Community call failed:",
                error
            );

            showToast(
                error.message ||
                "Unable to start the community call.",
                "error"
            );

        }

    }


    /* ============================================================
       INCOMING CALL UI
       ============================================================ */

    async function showIncomingCall(
        call
    ) {

        if (!call?.roomId) {
            return;
        }


        state.currentRoom =
            call.roomId;

        state.currentInvite =
            call.inviteId;

        state.currentMode =
            call.mode ||
            "audio";


        const toast =
            byId(
                "incomingCallToast"
            );


        const nameElement =
            byId(
                "incomingCallerName"
            ) ||
            byId(
                "incomingCallTitle"
            );


        const typeElement =
            byId(
                "incomingCallType"
            ) ||
            byId(
                "incomingCallText"
            );


        const avatarElement =
            byId(
                "incomingCallerAvatar"
            ) ||
            byId(
                "incomingCallAvatar"
            );


        if (nameElement) {

            nameElement.textContent =
                call.caller?.name ||
                "Mwaniki Scholar";

        }


        if (typeElement) {

            typeElement.textContent =
                call.mode === "video"
                    ? "Incoming video call"
                    : "Incoming voice call";

        }


        if (avatarElement) {

            const avatar =
                safeURL(
                    call.caller?.avatar
                );


            if (
                avatar &&
                avatarElement
                    .tagName ===
                    "IMG"
            ) {

                avatarElement.src =
                    avatar;

                avatarElement.alt =
                    call.caller?.name ||
                    "Caller";

            } else if (
                avatarElement
            ) {

                avatarElement.textContent =
                    initials(
                        call.caller?.name
                    );

            }

        }


        if (toast) {

            toast.hidden =
                false;

            toast.classList.add(
                "visible"
            );

        } else {

            createFallbackIncomingCall(
                call
            );

        }


        bindIncomingButtons(
            call
        );

    }


    function bindIncomingButtons(
        call
    ) {

        const accept =
            byId(
                "acceptCallButton"
            );


        const reject =
            byId(
                "rejectCallButton"
            ) ||
            byId(
                "declineCallButton"
            );


        if (accept) {

            accept.onclick =
                async () => {

                    await acceptIncomingCall(
                        call
                    );

                };

        }


        if (reject) {

            reject.onclick =
                async () => {

                    await rejectIncomingCall(
                        call
                    );

                };

        }

    }


    function createFallbackIncomingCall(
        call
    ) {

        let panel =
            byId(
                "mwanikiIncomingCallFallback"
            );


        if (!panel) {

            panel =
                document.createElement(
                    "div"
                );

            panel.id =
                "mwanikiIncomingCallFallback";

            panel.className =
                "mwaniki-incoming-call-fallback";

            panel.innerHTML = `

                <div class="incoming-call-avatar"
                     id="fallbackIncomingAvatar">
                </div>

                <div class="incoming-call-copy">

                    <strong id="fallbackIncomingName">
                        Incoming call
                    </strong>

                    <span id="fallbackIncomingType">
                        Incoming voice call
                    </span>

                </div>

                <div class="incoming-call-actions">

                    <button
                        type="button"
                        id="fallbackAcceptCall"
                        class="call-accept-button"
                    >
                        Accept
                    </button>

                    <button
                        type="button"
                        id="fallbackRejectCall"
                        class="call-reject-button"
                    >
                        Decline
                    </button>

                </div>

            `;

            document.body.appendChild(
                panel
            );

        }


        const avatar =
            byId(
                "fallbackIncomingAvatar"
            );

        const name =
            byId(
                "fallbackIncomingName"
            );

        const type =
            byId(
                "fallbackIncomingType"
            );


        if (avatar) {

            avatar.textContent =
                initials(
                    call.caller?.name
                );

        }


        if (name) {

            name.textContent =
                call.caller?.name ||
                "Mwaniki Scholar";

        }


        if (type) {

            type.textContent =
                call.mode === "video"
                    ? "Incoming video call"
                    : "Incoming voice call";

        }


        panel.classList.add(
            "visible"
        );


        byId(
            "fallbackAcceptCall"
        ).onclick =
            () =>
                acceptIncomingCall(
                    call
                );


        byId(
            "fallbackRejectCall"
        ).onclick =
            () =>
                rejectIncomingCall(
                    call
                );

    }


    /* ============================================================
       ACCEPT
       ============================================================ */

    async function acceptIncomingCall(
        call
    ) {

        try {

            await updateInvite(
                call.inviteId,
                "accepted"
            );


            openCallPage(
                call.roomId,
                call.mode ||
                "audio",
                "callee",
                call.inviteId
            );

        } catch (error) {

            console.error(
                "Accept call failed:",
                error
            );

            showToast(
                "Unable to accept the call.",
                "error"
            );

        }

    }


    /* ============================================================
       REJECT
       ============================================================ */

    async function rejectIncomingCall(
        call
    ) {

        await updateInvite(
            call.inviteId,
            "rejected"
        );


        hideIncomingCall();


        showToast(
            "Call declined."
        );

    }


    function hideIncomingCall() {

        const ids = [

            "incomingCallToast",
            "mwanikiIncomingCallFallback"

        ];


        ids.forEach(id => {

            const element =
                byId(id);

            if (!element) {
                return;
            }

            element.hidden =
                true;

            element.classList.remove(
                "visible"
            );

        });

    }


    /* ============================================================
       MISSED CALL NOTIFICATIONS
       ============================================================ */

    function getSeenMissedCalls() {

        try {

            const raw =
                localStorage.getItem(
                    CONFIG.storageMissedCalls
                );

            const parsed =
                JSON.parse(
                    raw || "[]"
                );

            return new Set(
                Array.isArray(parsed)
                    ? parsed.map(
                        String
                    )
                    : []
            );

        } catch (_) {

            return new Set();

        }

    }


    function saveSeenMissedCalls(
        set
    ) {

        try {

            localStorage.setItem(
                CONFIG.storageMissedCalls,
                JSON.stringify(
                    [
                        ...set
                    ].slice(-200)
                )
            );

        } catch (_) {}

    }


    async function refreshMissedCallNotifications() {

        if (
            !state.user?.id ||
            !state.db
        ) {
            return;
        }


        try {

            const {
                data,
                error
            } =
                await state.db
                    .from(
                        "chat_call_invites"
                    )
                    .select(
                        "id, room_id, sender_id, receiver_id, status, created_at"
                    )
                    .eq(
                        "receiver_id",
                        state.user.id
                    )
                    .eq(
                        "status",
                        "missed"
                    )
                    .order(
                        "created_at",
                        {
                            ascending:
                                false
                        }
                    )
                    .limit(30);


            if (error) {
                throw error;
            }


            const missed =
                data || [];


            const seen =
                getSeenMissedCalls();


            const newCalls =
                missed.filter(
                    call =>
                        !seen.has(
                            String(
                                call.id
                            )
                        )
                );


            /*
             * Only notify about calls that we haven't
             * already shown on this browser.
             */

            for (
                const call of
                newCalls.slice(0, 5)
            ) {

                const caller =
                    await loadProfile(
                        call.sender_id
                    );


                showMissedCallNotification({

                    id:
                        call.id,

                    name:
                        getDisplayName(
                            caller,
                            "Mwaniki Scholar"
                        ),

                    avatar:
                        safeURL(
                            caller?.avatar_url ||
                            caller?.photo_url
                        ),

                    createdAt:
                        call.created_at

                });


                seen.add(
                    String(
                        call.id
                    )
                );

            }


            if (newCalls.length) {

                saveSeenMissedCalls(
                    seen
                );

            }


            updateMissedCallBadge(
                missed.length
            );

        } catch (error) {

            console.warn(
                "Missed-call notification check failed:",
                error
            );

        }

    }


    function updateMissedCallBadge(
        count
    ) {

        const badge =
            byId(
                "notificationBadge"
            );


        if (!badge) {
            return;
        }


        if (count > 0) {

            badge.textContent =
                String(count);

            badge.hidden =
                false;

        } else {

            badge.hidden =
                true;

        }

    }


    function showMissedCallNotification(
        call
    ) {

        let panel =
            byId(
                "mwanikiMissedCallNotice"
            );


        if (!panel) {

            panel =
                document.createElement(
                    "div"
                );

            panel.id =
                "mwanikiMissedCallNotice";

            panel.className =
                "mwaniki-missed-call-notice";

            document.body.appendChild(
                panel
            );

        }


        panel.innerHTML = `

            <div class="missed-call-icon">
                📞
            </div>

            <div class="missed-call-copy">

                <strong>
                    Missed call
                </strong>

                <span>
                    ${escapeHTML(
                        call.name
                    )} tried to call you.
                </span>

            </div>

            <button
                type="button"
                class="missed-call-close"
                aria-label="Close"
            >
                ×
            </button>

        `;


        panel.classList.add(
            "visible"
        );


        const close =
            panel.querySelector(
                ".missed-call-close"
            );


        if (close) {

            close.onclick =
                () => {

                    panel.classList.remove(
                        "visible"
                    );

                };

        }


        clearTimeout(
            panel.__hideTimer
        );


        panel.__hideTimer =
            setTimeout(
                () => {

                    panel.classList.remove(
                        "visible"
                    );

                },
                7000
            );

    }


    /* ============================================================
       CALL PAGE
       ============================================================ */

    function getCallParameters() {

        const params =
            new URLSearchParams(
                window.location.search
            );


        return {

            room:
                params.get("room"),

            mode:
                params.get("mode") ||
                "audio",

            role:
                params.get("role") ||
                "caller",

            invite:
                params.get("invite")

        };

    }


    async function startCallPage() {

        const params =
            getCallParameters();


        if (!params.room) {

            renderCallPageError(
                "No call room was supplied."
            );

            return;

        }


        state.currentRoom =
            params.room;

        state.currentMode =
            params.mode;

        state.currentRole =
            params.role;

        state.currentInvite =
            params.invite;


        renderCallPageTitle();


        try {

            await prepareLocalMedia();

            await joinRoom(
                params.room
            );

        } catch (error) {

            console.error(
                "Call startup failed:",
                error
            );

            renderCallPageError(
                error.message ||
                "Unable to start the call."
            );

        }

    }


    /* ============================================================
       LOCAL MEDIA
       ============================================================ */

    async function prepareLocalMedia() {

        const wantsVideo =
            state.currentMode ===
            "video";


        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices
                .getUserMedia
        ) {

            throw new Error(
                "Your browser does not support microphone/camera access."
            );

        }


        state.localStream =
            await navigator.mediaDevices
                .getUserMedia({

                    audio: true,

                    video:
                        wantsVideo

                });


        state.microphoneEnabled =
            true;

        state.cameraEnabled =
            wantsVideo;


        attachLocalVideo();

    }


    function attachLocalVideo() {

        const video =
            byId(
                "localVideo"
            );


        if (!video) {
            return;
        }


        video.srcObject =
            state.localStream;

        video.muted =
            true;

        video.autoplay =
            true;

        video.playsInline =
            true;

    }


    /* ============================================================
       JOIN ROOM
       ============================================================ */

    async function joinRoom(
        roomId
    ) {

        /*
         * Insert our participant record.
         */

        try {

            const {
                error
            } =
                await state.db
                    .from(
                        "chat_call_participants"
                    )
                    .insert({

                        room_id:
                            roomId,

                        user_id:
                            state.user.id,

                        status:
                            "joined",

                        is_muted:
                            false,

                        camera:
                            state.currentMode ===
                            "video",

                        screen_share:
                            false,

                        joined_at:
                            new Date()
                                .toISOString()

                    });


            if (error) {

                /*
                 * A duplicate participant is harmless.
                 */

                console.warn(
                    "Participant insert:",
                    error
                );

            }

        } catch (error) {

            console.warn(
                "Participant registration failed:",
                error
            );

        }


        await setupRoomChannel(
            roomId
        );


        /*
         * Tell everyone already in the room
         * that we have joined.
         */

        await sendRoomSignal(
            "peer-joined",
            {

                userId:
                    state.user.id,

                name:
                    getDisplayName(
                        state.profile,
                        state.user.email
                    )

            }
        );


        /*
         * Load participants already inside.
         */

        const {
            data: participants,
            error
        } =
            await state.db
                .from(
                    "chat_call_participants"
                )
                .select(
                    "user_id, status"
                )
                .eq(
                    "room_id",
                    roomId
                )
                .eq(
                    "status",
                    "joined"
                );


        if (error) {
            console.warn(
                "Could not load participants:",
                error
            );
        }


        for (
            const participant of
            participants || []
        ) {

            if (
                String(
                    participant.user_id
                ) ===
                String(
                    state.user.id
                )
            ) {
                continue;
            }


            await ensurePeerConnection(
                participant.user_id
            );

        }


        updateCallStatus(
            "Connected to call"
        );

    }


    /* ============================================================
       ROOM REALTIME
       ============================================================ */

    async function setupRoomChannel(
        roomId
    ) {

        state.roomChannel =
            state.db.channel(
                CONFIG.roomPrefix +
                roomId
            );


        state.roomChannel
            .on(
                "broadcast",
                {
                    event:
                        "peer-joined"
                },
                async payload => {

                    const data =
                        payload?.payload ||
                        payload;


                    if (
                        !data?.userId ||
                        String(
                            data.userId
                        ) ===
                        String(
                            state.user.id
                        )
                    ) {
                        return;
                    }


                    await ensurePeerConnection(
                        data.userId
                    );

                }
            )
            .on(
                "broadcast",
                {
                    event:
                        "signal"
                },
                async payload => {

                    const data =
                        payload?.payload ||
                        payload;


                    if (
                        !data?.from ||
                        String(
                            data.from
                        ) ===
                        String(
                            state.user.id
                        )
                    ) {
                        return;
                    }


                    await handleWebRTCSignal(
                        data
                    );

                }
            )
            .on(
                "broadcast",
                {
                    event:
                        "peer-left"
                },
                payload => {

                    const data =
                        payload?.payload ||
                        payload;


                    if (
                        data?.userId
                    ) {

                        removePeer(
                            data.userId
                        );

                    }

                }
            )
            .on(
                "broadcast",
                {
                    event:
                        "call-ended"
                },
                () => {

                    leaveCall(
                        false
                    );

                }
            )
            .subscribe(
                status => {

                    console.log(
                        "📞 Room channel:",
                        status
                    );

                }
            );

    }


    async function sendRoomSignal(
        event,
        payload
    ) {

        if (
            !state.roomChannel
        ) {
            return;
        }


        try {

            await state.roomChannel
                .send({

                    type:
                        "broadcast",

                    event,

                    payload

                });

        } catch (error) {

            console.warn(
                "Room broadcast failed:",
                error
            );

        }

    }


    /* ============================================================
       WEBRTC PEERS
       ============================================================ */

    function shouldCreateOffer(
        remoteUserId
    ) {

        /*
         * Deterministic rule:
         * the lexicographically smaller UUID
         * creates the offer.
         */

        return (
            String(
                state.user.id
            ) <
            String(
                remoteUserId
            )
        );

    }


    async function ensurePeerConnection(
        remoteUserId
    ) {

        if (!remoteUserId) {
            return null;
        }


        if (
            String(remoteUserId) ===
            String(state.user.id)
        ) {
            return null;
        }


        if (
            state.peerConnections.has(
                remoteUserId
            )
        ) {

            return state.peerConnections.get(
                remoteUserId
            );

        }


        const peer =
            new RTCPeerConnection({

                iceServers:
                    CONFIG.iceServers

            });


        state.peerConnections.set(
            remoteUserId,
            peer
        );


        /*
         * Add local media.
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
         * ICE candidates.
         */

        peer.onicecandidate =
            async event => {

                if (
                    !event.candidate
                ) {
                    return;
                }


                await sendRoomSignal(
                    "signal",
                    {

                        from:
                            state.user.id,

                        to:
                            remoteUserId,

                        signal: {

                            type:
                                "candidate",

                            candidate:
                                event.candidate

                        }

                    }
                );

            };


        /*
         * Remote stream.
         */

        peer.ontrack =
            event => {

                const stream =
                    event.streams?.[0];


                if (!stream) {
                    return;
                }


                state.remoteStreams.set(
                    remoteUserId,
                    stream
                );


                renderRemoteParticipant(
                    remoteUserId,
                    stream
                );

            };


        peer.onconnectionstatechange =
            () => {

                const status =
                    peer.connectionState;


                console.log(
                    "Peer connection:",
                    remoteUserId,
                    status
                );


                if (
                    status ===
                        "failed" ||
                    status ===
                        "closed" ||
                    status ===
                        "disconnected"
                ) {

                    removePeer(
                        remoteUserId
                    );

                }

            };


        /*
         * Only one side sends the offer.
         */

        if (
            shouldCreateOffer(
                remoteUserId
            )
        ) {

            try {

                const offer =
                    await peer
                        .createOffer();


                await peer
                    .setLocalDescription(
                        offer
                    );


                await sendRoomSignal(
                    "signal",
                    {

                        from:
                            state.user.id,

                        to:
                            remoteUserId,

                        signal: {

                            type:
                                "offer",

                            sdp:
                                peer.localDescription

                        }

                    }
                );

            } catch (error) {

                console.error(
                    "Offer creation failed:",
                    error
                );

            }

        }


        return peer;

    }


    /* ============================================================
       WEBRTC SIGNAL HANDLING
       ============================================================ */

    async function handleWebRTCSignal(
        data
    ) {

        if (
            data.to &&
            String(data.to) !==
            String(state.user.id)
        ) {

            return;

        }


        const remoteUserId =
            data.from;


        if (!remoteUserId) {
            return;
        }


        const peer =
            await ensurePeerConnection(
                remoteUserId
            );


        const signal =
            data.signal;


        if (!signal) {
            return;
        }


        try {

            if (
                signal.type ===
                "offer"
            ) {

                await peer
                    .setRemoteDescription(
                        new RTCSessionDescription(
                            signal.sdp
                        )
                    );


                const answer =
                    await peer
                        .createAnswer();


                await peer
                    .setLocalDescription(
                        answer
                    );


                await sendRoomSignal(
                    "signal",
                    {

                        from:
                            state.user.id,

                        to:
                            remoteUserId,

                        signal: {

                            type:
                                "answer",

                            sdp:
                                peer.localDescription

                        }

                    }
                );

            }


            else if (
                signal.type ===
                "answer"
            ) {

                await peer
                    .setRemoteDescription(
                        new RTCSessionDescription(
                            signal.sdp
                        )
                    );

            }


            else if (
                signal.type ===
                "candidate"
            ) {

                if (
                    signal.candidate
                ) {

                    await peer
                        .addIceCandidate(
                            new RTCIceCandidate(
                                signal.candidate
                            )
                        );

                }

            }

        } catch (error) {

            console.error(
                "WebRTC signal error:",
                error
            );

        }

    }


    /* ============================================================
       REMOTE VIDEO
       ============================================================ */

    async function renderRemoteParticipant(
        userId,
        stream
    ) {

        let grid =
            byId(
                "callVideoGrid"
            ) ||
            byId(
                "callParticipantGrid"
            );


        if (!grid) {

            grid =
                document.createElement(
                    "div"
                );

            grid.id =
                "callVideoGrid";

            grid.className =
                "call-video-grid";

            document.body.appendChild(
                grid
            );

        }


        let tile =
            grid.querySelector(
                `[data-user-id="${CSS.escape(
                    String(userId)
                )}"]`
            );


        if (!tile) {

            tile =
                document.createElement(
                    "div"
                );

            tile.className =
                "call-video-tile";

            tile.dataset.userId =
                String(userId);


            const video =
                document.createElement(
                    "video"
                );

            video.autoplay =
                true;

            video.playsInline =
                true;

            video.dataset.remoteVideo =
                "true";


            const label =
                document.createElement(
                    "div"
                );

            label.className =
                "call-video-label";


            const profile =
                await loadProfile(
                    userId
                );


            label.textContent =
                getDisplayName(
                    profile,
                    "Mwaniki Scholar"
                );


            tile.appendChild(
                video
            );

            tile.appendChild(
                label
            );

            grid.appendChild(
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

    }


    function removePeer(
        userId
    ) {

        const peer =
            state.peerConnections.get(
                userId
            );


        if (peer) {

            try {
                peer.close();
            } catch (_) {}

        }


        state.peerConnections.delete(
            userId
        );

        state.remoteStreams.delete(
            userId
        );


        const tile =
            document.querySelector(
                `.call-video-tile[data-user-id="${CSS.escape(
                    String(userId)
                )}"]`
            );


        if (tile) {

            tile.remove();

        }

    }


    /* ============================================================
       CALL PAGE UI
       ============================================================ */

    function renderCallPageTitle() {

        const title =
            byId(
                "callTitle"
            );


        const subtitle =
            byId(
                "callSubtitle"
            );


        if (title) {

            title.textContent =
                state.currentMode ===
                "video"
                    ? "Video Call"
                    : "Voice Call";

        }


        if (subtitle) {

            subtitle.textContent =
                "Mwaniki Scholars";

        }

    }


    function updateCallStatus(
        text
    ) {

        const status =
            byId(
                "callStatus"
            ) ||
            byId(
                "activeCallStatus"
            );


        if (status) {

            status.textContent =
                String(text || "");

        }

    }


    function renderCallPageError(
        message
    ) {

        updateCallStatus(
            message
        );


        showToast(
            message,
            "error"
        );

    }


    /* ============================================================
       MICROPHONE
       ============================================================ */

    function toggleMicrophone() {

        if (!state.localStream) {
            return;
        }


        const tracks =
            state.localStream
                .getAudioTracks();


        state.microphoneEnabled =
            !state.microphoneEnabled;


        tracks.forEach(
            track => {

                track.enabled =
                    state.microphoneEnabled;

            }
        );


        const button =
            byId(
                "toggleMicrophoneButton"
            );


        if (button) {

            button.textContent =
                state.microphoneEnabled
                    ? "🎙️ Mute"
                    : "🔇 Unmute";

        }

    }


    /* ============================================================
       CAMERA
       ============================================================ */

    function toggleCamera() {

        if (!state.localStream) {
            return;
        }


        const tracks =
            state.localStream
                .getVideoTracks();


        if (!tracks.length) {

            showToast(
                "This is an audio-only call."
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
                "toggleCameraButton"
            );


        if (button) {

            button.textContent =
                state.cameraEnabled
                    ? "📹 Camera Off"
                    : "📷 Camera On";

        }

    }


    /* ============================================================
       SCREEN SHARE
       ============================================================ */

    async function toggleScreenShare() {

        if (
            !navigator.mediaDevices
                ?.getDisplayMedia
        ) {

            showToast(
                "Screen sharing is not supported by this browser.",
                "error"
            );

            return;

        }


        if (
            state.screenSharing
        ) {

            await stopScreenShare();

            return;

        }


        try {

            state.screenStream =
                await navigator.mediaDevices
                    .getDisplayMedia({

                        video: true,

                        audio: false

                    });


            const screenTrack =
                state.screenStream
                    .getVideoTracks()[0];


            for (
                const peer of
                state.peerConnections.values()
            ) {

                const sender =
                    peer.getSenders()
                        .find(
                            item =>
                                item.track &&
                                item.track.kind ===
                                "video"
                        );


                if (sender) {

                    await sender
                        .replaceTrack(
                            screenTrack
                        );

                }

            }


            state.screenSharing =
                true;


            const button =
                byId(
                    "shareScreenButton"
                );


            if (button) {

                button.textContent =
                    "🛑 Stop Share";

            }


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


    async function stopScreenShare() {

        if (
            !state.screenStream
        ) {
            return;

        }


        const cameraTrack =
            state.localStream
                ?.getVideoTracks()[0];


        for (
            const peer of
            state.peerConnections.values()
        ) {

            const sender =
                peer.getSenders()
                    .find(
                        item =>
                            item.track &&
                            item.track.kind ===
                            "video"
                    );


            if (
                sender &&
                cameraTrack
            ) {

                await sender
                    .replaceTrack(
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


        const button =
            byId(
                "shareScreenButton"
            );


        if (button) {

            button.textContent =
                "🖥️ Share Screen";

        }

    }


    /* ============================================================
       LEAVE CALL
       ============================================================ */

    async function leaveCall(
        notify = true
    ) {

        if (
            notify &&
            state.roomChannel
        ) {

            await sendRoomSignal(
                "peer-left",
                {

                    userId:
                        state.user.id

                }
            );

        }


        if (state.roomChannel) {

            try {

                await state.db
                    .removeChannel(
                        state.roomChannel
                    );

            } catch (_) {}

            state.roomChannel =
                null;

        }


        for (
            const peer of
            state.peerConnections.values()
        ) {

            try {
                peer.close();
            } catch (_) {}

        }


        state.peerConnections.clear();


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


        if (
            state.currentRoom &&
            state.user?.id
        ) {

            try {

                await state.db
                    .from(
                        "chat_call_participants"
                    )
                    .update({

                        status:
                            "left",

                        left_at:
                            new Date()
                                .toISOString()

                    })
                    .eq(
                        "room_id",
                        state.currentRoom
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    );

            } catch (_) {}

        }


        if (
            state.currentRole ===
            "caller" &&
            state.currentRoom
        ) {

            try {

                await state.db
                    .from(
                        "chat_call_rooms"
                    )
                    .update({

                        room_status:
                            "ended"

                    })
                    .eq(
                        "id",
                        state.currentRoom
                    );

            } catch (_) {}

        }


        if (state.isCallPage) {

            window.location.href =
                "./community.html";

        }

    }


    /* ============================================================
       BUTTON BINDINGS
       ============================================================ */

    function bindCallControls() {

        const microphone =
            byId(
                "toggleMicrophoneButton"
            );


        const camera =
            byId(
                "toggleCameraButton"
            );


        const screen =
            byId(
                "shareScreenButton"
            );


        const leave =
            byId(
                "leaveCallButton"
            );


        const leaveBottom =
            byId(
                "leaveCallButtonBottom"
            );


        if (microphone) {

            microphone.onclick =
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
                () =>
                    leaveCall(true);

        }


        if (leaveBottom) {

            leaveBottom.onclick =
                () =>
                    leaveCall(true);

        }

    }


    /* ============================================================
       CALL PICKER
       ============================================================ */

    function createCallPicker() {

        let modal =
            byId(
                "mwanikiCallPicker"
            );


        if (modal) {
            return modal;
        }


        modal =
            document.createElement(
                "div"
            );

        modal.id =
            "mwanikiCallPicker";

        modal.className =
            "mwaniki-call-picker";


        modal.innerHTML = `

            <div class="call-picker-backdrop"></div>

            <section
                class="call-picker-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="callPickerTitle"
            >

                <header class="call-picker-header">

                    <div>

                        <span class="call-picker-kicker">
                            Mwaniki Scholars
                        </span>

                        <h2 id="callPickerTitle">
                            Start a Call
                        </h2>

                    </div>

                    <button
                        type="button"
                        id="closeMwanikiCallPicker"
                        class="call-picker-close"
                    >
                        ×
                    </button>

                </header>


                <div class="call-picker-controls">

                    <button
                        type="button"
                        class="call-mode-button active"
                        data-call-mode="audio"
                    >
                        🎙️ Voice
                    </button>

                    <button
                        type="button"
                        class="call-mode-button"
                        data-call-mode="video"
                    >
                        📹 Video
                    </button>

                </div>


                <div
                    id="callPickerStatus"
                    class="call-picker-status"
                >
                    Loading online users...
                </div>


                <div
                    id="callPickerUsers"
                    class="call-picker-users"
                ></div>


                <footer class="call-picker-footer">

                    <button
                        type="button"
                        id="callSelectedUserButton"
                        class="call-primary-button"
                        disabled
                    >
                        Call Selected Person
                    </button>

                </footer>

            </section>

        `;


        document.body.appendChild(
            modal
        );


        byId(
            "closeMwanikiCallPicker"
        ).onclick =
            closeCallPicker;


        modal.querySelector(
            ".call-picker-backdrop"
        ).onclick =
            closeCallPicker;


        modal.querySelectorAll(
            ".call-mode-button"
        ).forEach(
            button => {

                button.onclick =
                    () => {

                        modal
                            .querySelectorAll(
                                ".call-mode-button"
                            )
                            .forEach(
                                item =>
                                    item.classList
                                        .remove(
                                            "active"
                                        )
                            );


                        button.classList.add(
                            "active"
                        );

                    };

            }
        );


        return modal;

    }


    let selectedCallUser =
        null;


    let selectedCallMode =
        "audio";


    async function openCallPicker(
        communityId = null
    ) {

        const modal =
            createCallPicker();


        selectedCallUser =
            null;


        selectedCallMode =
            "audio";


        modal.classList.add(
            "visible"
        );


        const status =
            byId(
                "callPickerStatus"
            );


        const usersArea =
            byId(
                "callPickerUsers"
            );


        const callButton =
            byId(
                "callSelectedUserButton"
            );


        if (callButton) {

            callButton.disabled =
                true;

        }


        if (status) {

            status.textContent =
                "Loading online users...";

        }


        if (usersArea) {

            usersArea.innerHTML =
                "<div class=\"call-picker-loading\">Checking online users...</div>";

        }


        try {

            const users =
                await getOnlineUsers(
                    communityId
                );


            if (status) {

                status.textContent =
                    users.length
                        ? `${users.length} online user${
                            users.length === 1
                                ? ""
                                : "s"
                          }`
                        : "No other users are online.";

            }


            if (!usersArea) {
                return;
            }


            usersArea.innerHTML =
                "";


            users.forEach(
                user => {

                    const button =
                        document.createElement(
                            "button"
                        );


                    button.type =
                        "button";

                    button.className =
                        "call-picker-user";


                    button.dataset.userId =
                        user.id;


                    button.innerHTML = `

                        <span class="call-picker-avatar">

                            ${
                                user.avatar
                                    ? `<img
                                        src="${escapeHTML(
                                            user.avatar
                                        )}"
                                        alt=""
                                      >`
                                    : escapeHTML(
                                        initials(
                                            user.name
                                        )
                                    )
                            }

                            <span class="online-dot"></span>

                        </span>

                        <span class="call-picker-user-copy">

                            <strong>
                                ${escapeHTML(
                                    user.name
                                )}
                            </strong>

                            <small>
                                Online
                            </small>

                        </span>

                    `;


                    button.onclick =
                        () => {

                            usersArea
                                .querySelectorAll(
                                    ".call-picker-user"
                                )
                                .forEach(
                                    item =>
                                        item.classList
                                            .remove(
                                                "selected"
                                            )
                                );


                            button.classList.add(
                                "selected"
                            );


                            selectedCallUser =
                                user.id;


                            const activeMode =
                                modal.querySelector(
                                    ".call-mode-button.active"
                                );


                            selectedCallMode =
                                activeMode?.dataset
                                    .callMode ||
                                "audio";


                            if (callButton) {

                                callButton.disabled =
                                    false;

                            }

                        };


                    usersArea.appendChild(
                        button
                    );

                }
            );


            if (!users.length) {

                usersArea.innerHTML = `

                    <div class="call-picker-empty">

                        <div>
                            💤
                        </div>

                        <strong>
                            Nobody else is online
                        </strong>

                        <span>
                            You can leave a missed-call notification by trying again later.
                        </span>

                    </div>

                `;

            }

        } catch (error) {

            console.error(
                "Call picker failed:",
                error
            );


            if (status) {

                status.textContent =
                    "Unable to load online users.";

            }


            if (usersArea) {

                usersArea.innerHTML = `

                    <div class="call-picker-empty">

                        Unable to load online users.

                    </div>

                `;

            }

        }

    }


    function closeCallPicker() {

        const modal =
            byId(
                "mwanikiCallPicker"
            );


        if (modal) {

            modal.classList.remove(
                "visible"
            );

        }

    }


    /* ============================================================
       COMMUNITY BUTTONS
       ============================================================ */

    function bindCommunityCallButtons() {

        /*
         * General call:
         * opens online user picker.
         */

        const general =
            byId(
                "generalCallButton"
            );


        if (general) {

            general.addEventListener(
                "click",
                () => {

                    openCallPicker(
                        null
                    );

                }
            );

        }


        /*
         * Existing call-specific-person button.
         */

        const specific =
            byId(
                "callSpecificPersonButton"
            );


        if (specific) {

            specific.addEventListener(
                "click",
                () => {

                    closeExistingCallModal();

                    openCallPicker(
                        null
                    );

                }
            );

        }


        /*
         * Existing whole-community button.
         */

        const whole =
            byId(
                "callWholeCommunityButton"
            );


        if (whole) {

            whole.addEventListener(
                "click",
                async () => {

                    closeExistingCallModal();

                    const communityId =
                        getCurrentCommunityId();


                    if (!communityId) {

                        showToast(
                            "Select a community first.",
                            "error"
                        );

                        return;

                    }


                    const mode =
                        getExistingCallMode();


                    await startCommunityCall(
                        communityId,
                        mode
                    );

                }
            );

        }


        /*
         * Existing community call button.
         */

        const community =
            byId(
                "communityCallButton"
            );


        if (community) {

            community.addEventListener(
                "click",
                async () => {

                    const communityId =
                        getCurrentCommunityId();


                    if (!communityId) {

                        showToast(
                            "Select a community first.",
                            "error"
                        );

                        return;

                    }


                    const mode =
                        getExistingCallMode();


                    await startCommunityCall(
                        communityId,
                        mode
                    );

                }
            );

        }


        /*
         * Picker call button.
         */

        document.addEventListener(
            "click",
            async event => {

                if (
                    event.target?.id !==
                    "callSelectedUserButton"
                ) {
                    return;
                }


                const activeMode =
                    document.querySelector(
                        ".call-mode-button.active"
                    );


                selectedCallMode =
                    activeMode?.dataset
                        .callMode ||
                    "audio";


                if (
                    !selectedCallUser
                ) {
                    return;
                }


                closeCallPicker();


                await startDirectCall(
                    selectedCallUser,
                    selectedCallMode
                );

            }
        );


        /*
         * Custom events allow community.js
         * to request a call without knowing
         * anything about WebRTC.
         */

        window.addEventListener(
            "mwaniki:call-user",
            event => {

                const detail =
                    event.detail ||
                    {};


                openCallPicker(
                    detail.communityId ||
                    null
                );

            }
        );


        window.addEventListener(
            "mwaniki:start-general-call",
            async event => {

                const detail =
                    event.detail ||
                    {};


                if (
                    detail.userIds?.length
                ) {

                    for (
                        const userId of
                        detail.userIds
                    ) {

                        await startDirectCall(
                            userId,
                            detail.mode ||
                            "audio"
                        );

                    }

                }

            }
        );


        window.addEventListener(
            "mwaniki:start-community-call",
            async event => {

                const detail =
                    event.detail ||
                    {};


                await startCommunityCall(
                    detail.communityId ||
                    getCurrentCommunityId(),
                    detail.mode ||
                    "audio"
                );

            }
        );

    }


    function getCurrentCommunityId() {

        /*
         * Try community.js state exposed through
         * its public global first.
         */

        if (
            window.MwanikiCommunity
                ?.getCurrentCommunityId
        ) {

            return window.MwanikiCommunity
                .getCurrentCommunityId();

        }


        /*
         * Existing selected community
         * data attributes.
         */

        const active =
            document.querySelector(
                "[data-community-id].active"
            );


        if (
            active?.dataset
                .communityId
        ) {

            return active.dataset
                .communityId;

        }


        /*
         * localStorage fallback.
         */

        return (
            localStorage.getItem(
                "mwanikiCommunityId"
            ) ||
            localStorage.getItem(
                "selectedCommunityId"
            )
        );

    }


    function getExistingCallMode() {

        const selected =
            document.querySelector(
                "[data-call-mode].active"
            );


        return (
            selected?.dataset
                .callMode ||
            "audio"
        );

    }


    function closeExistingCallModal() {

        const modal =
            byId(
                "callModal"
            );


        if (!modal) {
            return;
        }


        modal.hidden =
            true;


        modal.classList.remove(
            "visible"
        );

    }


    /* ============================================================
       INITIALIZATION
       ============================================================ */

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
                await loadProfile(
                    state.user.id
                );


            if (
                state.isCallPage
            ) {

                bindCallControls();

                await startCallPage();

                return;

            }


            /*
             * Community page.
             */

            await setupIncomingChannel();

            bindCommunityCallButtons();

            await refreshMissedCallNotifications();


            /*
             * Refresh missed calls periodically.
             */

            state.presenceTimer =
                setInterval(
                    refreshMissedCallNotifications,
                    30000
                );


            console.log(
                "✅ Mwaniki real call engine ready."
            );

        } catch (error) {

            console.error(
                "❌ Mwaniki call engine initialization failed:",
                error
            );

        }

    }


    /* ============================================================
       CLEANUP
       ============================================================ */

    window.addEventListener(
        "beforeunload",
        () => {

            if (
                state.localStream
            ) {

                state.localStream
                    .getTracks()
                    .forEach(
                        track =>
                            track.stop()
                    );

            }

        }
    );


    document.addEventListener(
        "visibilitychange",
        () => {

            /*
             * Do not terminate calls merely because
             * the browser tab becomes hidden.
             */

        }
    );


    /* ============================================================
       PUBLIC API
       ============================================================ */

    window.MwanikiCalls = {

        callUser:
            startDirectCall,

        callCommunity:
            startCommunityCall,

        openPicker:
            openCallPicker,

        refreshMissedCalls:
            refreshMissedCallNotifications,

        leave:
            leaveCall

    };


    /* ============================================================
       START
       ============================================================ */

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

})();
