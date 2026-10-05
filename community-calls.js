/* ============================================================
   MWANIKI SCHOLARS
   REAL CALL ENGINE
   ============================================================

   THIS FILE OWNS CALLING.

   SUPPORTED:

   • One-to-one audio calls
   • One-to-one video calls
   • Community calls
   • General group calls
   • Incoming calls
   • Accept / decline
   • Microphone control
   • Camera control
   • Screen sharing
   • Multi-user WebRTC
   • Call ending
   • Visual online-user picker

   IMPORTANT:

   community.js MUST NOT implement WebRTC.

   community.js should only call:

       window.MwanikiCalls.callUser(...)
       window.MwanikiCalls.callCommunity(...)
       window.MwanikiCalls.openPicker(...)

   NO UUID INPUT IS REQUIRED FROM USERS.
   ============================================================ */

(function () {

    "use strict";


    /* =========================================================
       CONFIG
       ========================================================= */

    const CONFIG = {

        callPage:
            "./community-calls.html",

        ringTimeout:
            45000,

        presenceWindow:
            120000,

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


    /* =========================================================
       STATE
       ========================================================= */

    const state = {

        db: null,

        user: null,

        profile: null,

        initialized: false,

        isCallPage:
            window.location.pathname
                .toLowerCase()
                .includes(
                    "community-calls.html"
                ),

        currentRoom: null,

        currentInvite: null,

        currentMode:
            "audio",

        currentRole:
            null,

        peerConnections:
            new Map(),

        remoteStreams:
            new Map(),

        pendingCandidates:
            new Map(),

        localStream:
            null,

        screenStream:
            null,

        screenSharing:
            false,

        microphoneEnabled:
            true,

        cameraEnabled:
            true,

        roomChannel:
            null,

        incomingChannel:
            null,

        pickerCommunityId:
            null,

        ringTimer:
            null,

        ending:
            false

    };


    /* =========================================================
       DOM
       ========================================================= */

    const $ = id =>
        document.getElementById(id);


    /* =========================================================
       SUPABASE
       ========================================================= */

    async function waitForSupabase() {

        for (
            let i = 0;
            i < 100;
            i++
        ) {

            const db =
                window.supabaseClient ||
                window.mwanikiSupabase ||
                window.sb;

            if (
                db &&
                typeof db.from === "function" &&
                typeof db.channel === "function"
            ) {

                state.db =
                    db;

                console.log(
                    "📞 Call engine: Supabase ready."
                );

                return db;
            }

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        100
                    )
            );
        }

        console.error(
            "❌ Call engine: Supabase unavailable."
        );

        return null;
    }


    /* =========================================================
       UTILITIES
       ========================================================= */

    function escapeHTML(value) {

        return String(
            value ?? ""
        )
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                '"',
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );
    }


    function safeURL(value) {

        if (!value)
            return "";

        try {

            const url =
                new URL(
                    value,
                    window.location.href
                );

            if (
                url.protocol ===
                    "http:" ||
                url.protocol ===
                    "https:"
            ) {

                return url.href;
            }

        } catch {}

        return "";
    }


    function initials(name) {

        const parts =
            String(
                name ||
                "Student"
            )
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2);

        return (
            parts
                .map(
                    part =>
                        part
                            .charAt(0)
                            .toUpperCase()
                )
                .join("") ||
            "S"
        );
    }


    function displayName(profile) {

        return (
            profile?.full_name ||
            profile?.name ||
            profile?.display_name ||
            profile?.username ||
            profile?.email ||
            "Student"
        );
    }


    function avatar(profile) {

        return safeURL(
            profile?.avatar_url ||
            profile?.profile_photo ||
            profile?.photo_url ||
            profile?.image ||
            ""
        );
    }


    function show(element) {

        element?.classList
            .remove(
                "hidden"
            );

        if (element) {

            element.style.display =
                "";
        }
    }


    function hide(element) {

        element?.classList
            .add(
                "hidden"
            );

        if (element) {

            element.style.display =
                "none";
        }
    }


    function toast(message) {

        if (
            typeof window.showToast ===
            "function"
        ) {

            window.showToast(
                message
            );

            return;
        }

        console.log(
            "📞",
            message
        );
    }


    /* =========================================================
       AUTH / PROFILE
       ========================================================= */

    async function loadIdentity() {

        if (!state.db)
            return false;

        const result =
            await state.db.auth
                .getUser();

        if (result.error) {

            console.error(
                "Call authentication error:",
                result.error
            );

            return false;
        }

        state.user =
            result.data?.user ||
            null;

        if (!state.user)
            return false;


        let profileResult =
            await state.db
                .from(
                    "chat_public_profiles"
                )
                .select("*")
                .eq(
                    "id",
                    state.user.id
                )
                .maybeSingle();


        if (
            profileResult.data
        ) {

            state.profile =
                profileResult.data;

            return true;
        }


        profileResult =
            await state.db
                .from(
                    "students"
                )
                .select("*")
                .eq(
                    "id",
                    state.user.id
                )
                .maybeSingle();


        state.profile =
            profileResult.data ||
            {
                id:
                    state.user.id,

                email:
                    state.user.email
            };


        return true;
    }


    /* =========================================================
       ONLINE USERS
       ========================================================= */

    async function getOnlineUsers(
        communityId = null
    ) {

        if (!state.db)
            return [];


        const presence =
            await state.db
                .from(
                    "chat_presence"
                )
                .select(
                    "user_id,status,last_seen_at"
                )
                .eq(
                    "status",
                    "online"
                );


        if (presence.error) {

            console.error(
                "Presence error:",
                presence.error
            );

            return [];
        }


        const now =
            Date.now();


        let rows =
            (presence.data || [])
                .filter(
                    row => {

                        if (
                            !row.last_seen_at
                        ) {

                            return true;
                        }

                        const age =
                            now -
                            new Date(
                                row.last_seen_at
                            ).getTime();

                        return (
                            age <=
                            CONFIG.presenceWindow
                        );
                    }
                );


        if (communityId) {

            const members =
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


            const memberIds =
                new Set(
                    (members.data || [])
                        .map(
                            row =>
                                String(
                                    row.user_id
                                )
                        )
                );


            rows =
                rows.filter(
                    row =>
                        memberIds.has(
                            String(
                                row.user_id
                            )
                        )
                );
        }


        rows =
            rows.filter(
                row =>
                    String(
                        row.user_id
                    ) !==
                    String(
                        state.user.id
                    )
            );


        if (!rows.length)
            return [];


        const ids =
            rows.map(
                row =>
                    row.user_id
            );


        const profiles =
            await state.db
                .from(
                    "chat_public_profiles"
                )
                .select("*")
                .in(
                    "id",
                    ids
                );


        const profileMap =
            new Map(
                (profiles.data || [])
                    .map(
                        profile => [
                            String(
                                profile.id
                            ),
                            profile
                        ]
                    )
            );


        return rows.map(
            row => ({

                ...row,

                profile:
                    profileMap.get(
                        String(
                            row.user_id
                        )
                    ) || {

                        id:
                            row.user_id

                    }

            })
        );
    }


    /* =========================================================
       CURRENT COMMUNITY
       ========================================================= */

    function getCurrentCommunityId() {

        return (
            window
                .MwanikiCommunity
                ?.getCurrentCommunityId?.() ||

            localStorage.getItem(
                "mwanikiCommunityId"
            ) ||

            null
        );
    }


    /* =========================================================
       ROOM CREATION
       ========================================================= */

    async function createRoom({

        communityId = null,

        targetUserId = null,

        mode = "audio",

        scope = "direct",

        participantCount = 2

    }) {

        const payload = {

            created_by:
                state.user.id,

            room_status:
                "ringing",

            call_scope:
                scope,

            max_participants:
                participantCount

        };


        /*
         * Only add nullable columns when they
         * actually have values.
         */

        if (communityId) {

            payload.community_id =
                communityId;
        }


        if (targetUserId) {

            payload.target_user_id =
                targetUserId;
        }


        const result =
            await state.db
                .from(
                    "chat_call_rooms"
                )
                .insert(
                    payload
                )
                .select("*")
                .single();


        if (result.error) {

            console.error(
                "CALL ROOM CREATION FAILED:",
                result.error
            );

            throw result.error;
        }


        return result.data;
    }


    /* =========================================================
       PARTICIPANT
       ========================================================= */

    async function upsertParticipant(
        roomId,
        userId,
        status = "joined"
    ) {

        if (!roomId || !userId)
            return;


        const existing =
            await state.db
                .from(
                    "chat_call_participants"
                )
                .select(
                    "id"
                )
                .eq(
                    "room_id",
                    roomId
                )
                .eq(
                    "user_id",
                    userId
                )
                .maybeSingle();


        if (
            existing.data?.id
        ) {

            const changes = {

                status,

                is_muted:
                    false,

                camera:
                    state.currentMode ===
                    "video",

                screen_share:
                    false

            };


            if (
                status ===
                "joined"
            ) {

                changes.joined_at =
                    new Date()
                        .toISOString();
            }


            await state.db
                .from(
                    "chat_call_participants"
                )
                .update(
                    changes
                )
                .eq(
                    "id",
                    existing.data.id
                );

            return;
        }


        const result =
            await state.db
                .from(
                    "chat_call_participants"
                )
                .insert({

                    room_id:
                        roomId,

                    user_id:
                        userId,

                    status,

                    is_muted:
                        false,

                    camera:
                        state.currentMode ===
                        "video",

                    screen_share:
                        false,

                    joined_at:
                        status ===
                        "joined"
                            ? new Date()
                                .toISOString()
                            : null

                });


        if (result.error) {

            console.error(
                "Participant creation error:",
                result.error
            );
        }
    }


    /* =========================================================
       INVITES
       ========================================================= */

    async function createInvite(
        roomId,
        receiverId
    ) {

        const result =
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
                .select("*")
                .single();


        if (result.error) {

            console.error(
                "INVITE CREATION FAILED:",
                result.error
            );

            throw result.error;
        }


        return result.data;
    }


    /* =========================================================
       USER SIGNAL CHANNEL
       ========================================================= */

    function userChannel(
        userId
    ) {

        return state.db.channel(
            `mwaniki-call-user-${userId}`
        );
    }


    async function notifyUser(
        userId,
        payload
    ) {

        const channel =
            userChannel(
                userId
            );


        return new Promise(
            resolve => {

                let finished =
                    false;


                const finish = () => {

                    if (
                        finished
                    )
                        return;

                    finished =
                        true;

                    resolve();
                };


                channel
                    .on(
                        "system",
                        {},
                        () => {}
                    )
                    .subscribe(
                        async status => {

                            if (
                                status ===
                                "SUBSCRIBED"
                            ) {

                                try {

                                    await channel
                                        .send({

                                            type:
                                                "broadcast",

                                            event:
                                                "incoming-call",

                                            payload

                                        });

                                } catch (
                                    error
                                ) {

                                    console.error(
                                        "Call notification failed:",
                                        error
                                    );
                                }

                                finish();
                            }


                            if (
                                status ===
                                "CHANNEL_ERROR" ||
                                status ===
                                "TIMED_OUT"
                            ) {

                                finish();
                            }

                        }
                    );


                setTimeout(
                    finish,
                    5000
                );


                setTimeout(
                    () => {

                        try {

                            state.db
                                .removeChannel(
                                    channel
                                );

                        } catch {}

                    },
                    7000
                );
            }
        );
    }


    /* =========================================================
       START DIRECT CALL
       ========================================================= */

    async function startDirectCall(
        targetUserId,
        mode = "audio"
    ) {

        if (!state.user)
            return;


        if (
            String(targetUserId) ===
            String(state.user.id)
        ) {

            toast(
                "You cannot call yourself."
            );

            return;
        }


        const online =
            await getOnlineUsers();


        const recipient =
            online.find(
                row =>
                    String(
                        row.user_id
                    ) ===
                    String(
                        targetUserId
                    )
            );


        if (!recipient) {

            toast(
                "This member is not currently online."
            );

            return;
        }


        try {

            const room =
                await createRoom({

                    communityId:
                        getCurrentCommunityId(),

                    targetUserId,

                    mode,

                    scope:
                        "direct",

                    participantCount:
                        2

                });


            await upsertParticipant(
                room.id,
                state.user.id,
                "joined"
            );


            const invite =
                await createInvite(
                    room.id,
                    targetUserId
                );


            state.currentRoom =
                room;

            state.currentInvite =
                invite;

            state.currentMode =
                mode;

            state.currentRole =
                "caller";


            await notifyUser(
                targetUserId,
                {

                    roomId:
                        room.id,

                    inviteId:
                        invite.id,

                    senderId:
                        state.user.id,

                    senderName:
                        displayName(
                            state.profile
                        ),

                    senderAvatar:
                        avatar(
                            state.profile
                        ),

                    mode,

                    scope:
                        "direct",

                    communityId:
                        room.community_id ||
                        null,

                    timestamp:
                        Date.now()

                }
            );


            startRingTimer(
                room.id,
                invite.id
            );


            openCallPage({

                roomId:
                    room.id,

                role:
                    "caller",

                mode,

                inviteId:
                    invite.id

            });

        } catch (
            error
        ) {

            console.error(
                "Could not start direct call:",
                error
            );

            toast(
                error.message ||
                "The call could not be started."
            );
        }
    }


    /* =========================================================
       COMMUNITY CALL
       ========================================================= */

    async function startCommunityCall(
        communityId,
        mode = "audio"
    ) {

        if (!communityId) {

            toast(
                "No community selected."
            );

            return;
        }


        const online =
            await getOnlineUsers(
                communityId
            );


        if (!online.length) {

            toast(
                "There are no other online members in this community."
            );

            return;
        }


        try {

            const room =
                await createRoom({

                    communityId,

                    mode,

                    scope:
                        "community",

                    participantCount:
                        online.length + 1

                });


            await upsertParticipant(
                room.id,
                state.user.id,
                "joined"
            );


            state.currentRoom =
                room;

            state.currentMode =
                mode;

            state.currentRole =
                "caller";


            let invited =
                0;


            for (
                const member of online
            ) {

                try {

                    const invite =
                        await createInvite(
                            room.id,
                            member.user_id
                        );


                    await notifyUser(
                        member.user_id,
                        {

                            roomId:
                                room.id,

                            inviteId:
                                invite.id,

                            senderId:
                                state.user.id,

                            senderName:
                                displayName(
                                    state.profile
                                ),

                            senderAvatar:
                                avatar(
                                    state.profile
                                ),

                            mode,

                            scope:
                                "community",

                            communityId,

                            timestamp:
                                Date.now()

                        }
                    );


                    invited++;

                } catch (
                    error
                ) {

                    console.error(
                        "Community invitation failed:",
                        error
                    );
                }
            }


            if (!invited) {

                await endRoom(
                    room.id
                );

                toast(
                    "Nobody could be invited to the call."
                );

                return;
            }


            openCallPage({

                roomId:
                    room.id,

                role:
                    "caller",

                mode

            });

        } catch (
            error
        ) {

            console.error(
                "Community call failed:",
                error
            );

            toast(
                error.message ||
                "Community call could not start."
            );
        }
    }


    /* =========================================================
       GENERAL CALL
       ========================================================= */

    async function startGeneralCall(
        selectedUserIds,
        mode = "audio"
    ) {

        if (!Array.isArray(
            selectedUserIds
        )) {

            selectedUserIds =
                [];
        }


        const ids =
            [
                ...new Set(
                    selectedUserIds
                        .map(
                            id =>
                                String(id)
                        )
                        .filter(
                            id =>
                                id !==
                                String(
                                    state.user.id
                                )
                        )
                )
            ];


        if (!ids.length) {

            toast(
                "Select at least one online member."
            );

            return;
        }


        try {

            const room =
                await createRoom({

                    communityId:
                        null,

                    targetUserId:
                        null,

                    mode,

                    scope:
                        "general",

                    participantCount:
                        ids.length + 1

                });


            await upsertParticipant(
                room.id,
                state.user.id,
                "joined"
            );


            state.currentRoom =
                room;

            state.currentMode =
                mode;

            state.currentRole =
                "caller";


            let invited =
                0;


            for (
                const userId of ids
            ) {

                try {

                    const invite =
                        await createInvite(
                            room.id,
                            userId
                        );


                    await notifyUser(
                        userId,
                        {

                            roomId:
                                room.id,

                            inviteId:
                                invite.id,

                            senderId:
                                state.user.id,

                            senderName:
                                displayName(
                                    state.profile
                                ),

                            senderAvatar:
                                avatar(
                                    state.profile
                                ),

                            mode,

                            scope:
                                "general",

                            timestamp:
                                Date.now()

                        }
                    );


                    invited++;

                } catch (
                    error
                ) {

                    console.error(
                        "General call invitation failed:",
                        error
                    );
                }
            }


            if (!invited) {

                await endRoom(
                    room.id
                );

                toast(
                    "Nobody could be invited."
                );

                return;
            }


            openCallPage({

                roomId:
                    room.id,

                role:
                    "caller",

                mode

            });

        } catch (
            error
        ) {

            console.error(
                "General call failed:",
                error
            );

            toast(
                error.message ||
                "The group call could not be started."
            );
        }
    }


    /* =========================================================
       INCOMING CALL LISTENER
       ========================================================= */

    async function setupIncomingCalls() {

        if (
            !state.user ||
            !state.db
        )
            return;


        state.incomingChannel =
            userChannel(
                state.user.id
            );


        state.incomingChannel
            .on(
                "broadcast",
                {
                    event:
                        "incoming-call"
                },
                payload => {

                    const call =
                        payload?.payload;

                    if (!call?.roomId)
                        return;


                    showIncomingCall(
                        call
                    );
                }
            )
            .subscribe(
                status => {

                    if (
                        status ===
                        "SUBSCRIBED"
                    ) {

                        console.log(
                            "📞 Incoming call listener ready."
                        );
                    }

                }
            );
    }


    /* =========================================================
       INCOMING CALL UI
       ========================================================= */

    function showIncomingCall(
        call
    ) {

        let modal =
            $("incomingCallModal");


        if (!modal) {

            modal =
                document.createElement(
                    "div"
                );

            modal.id =
                "incomingCallModal";

            modal.className =
                "incoming-call-modal";

            document.body.appendChild(
                modal
            );
        }


        const image =
            safeURL(
                call.senderAvatar
            );


        modal.innerHTML = `

            <div class="incoming-call-card">

                <div class="incoming-call-ring">
                    📞
                </div>

                ${
                    image
                        ? `
                            <img
                                class="incoming-call-avatar"
                                src="${escapeHTML(
                                    image
                                )}"
                                alt=""
                            >
                        `
                        : `
                            <div class="incoming-call-avatar fallback-avatar">
                                ${escapeHTML(
                                    initials(
                                        call.senderName
                                    )
                                )}
                            </div>
                        `
                }

                <strong>
                    ${escapeHTML(
                        call.senderName ||
                        "Someone"
                    )}
                </strong>

                <span>
                    ${
                        call.scope ===
                        "community"
                            ? "Incoming community call"
                            :
                        call.scope ===
                        "general"
                            ? "Incoming group call"
                            :
                            "Incoming private call"
                    }
                </span>

                <small>
                    ${
                        call.mode ===
                        "video"
                            ? "📹 Video call"
                            : "🎙️ Audio call"
                    }
                </small>

                <div class="incoming-call-actions">

                    <button
                        id="declineIncomingCall"
                        type="button"
                        class="decline-call-button"
                    >
                        Decline
                    </button>

                    <button
                        id="answerIncomingCall"
                        type="button"
                        class="answer-call-button"
                    >
                        Answer
                    </button>

                </div>

            </div>

        `;


        show(modal);


        $("declineIncomingCall")
            ?.addEventListener(
                "click",
                async () => {

                    await declineCall(
                        call
                    );

                    hide(
                        modal
                    );
                }
            );


        $("answerIncomingCall")
            ?.addEventListener(
                "click",
                async () => {

                    hide(
                        modal
                    );

                    await acceptCall(
                        call
                    );
                }
            );


        clearTimeout(
            modal._timer
        );


        modal._timer =
            setTimeout(
                async () => {

                    await declineCall(
                        call
                    );

                    hide(
                        modal
                    );

                },
                CONFIG.ringTimeout
            );
    }


    /* =========================================================
       ACCEPT
       ========================================================= */

    async function acceptCall(
        call
    ) {

        try {

            if (
                call.inviteId
            ) {

                await state.db
                    .from(
                        "chat_call_invites"
                    )
                    .update({

                        status:
                            "accepted"

                    })
                    .eq(
                        "id",
                        call.inviteId
                    );
            }


            state.currentRoom = {

                id:
                    call.roomId

            };


            state.currentInvite = {

                id:
                    call.inviteId

            };


            state.currentMode =
                call.mode ||
                "audio";


            state.currentRole =
                "callee";


            openCallPage({

                roomId:
                    call.roomId,

                role:
                    "callee",

                mode:
                    call.mode ||
                    "audio",

                inviteId:
                    call.inviteId ||
                    ""

            });

        } catch (
            error
        ) {

            console.error(
                "Accept call failed:",
                error
            );

            toast(
                "Could not answer the call."
            );
        }
    }


    /* =========================================================
       DECLINE
       ========================================================= */

    async function declineCall(
        call
    ) {

        try {

            if (
                call.inviteId
            ) {

                await state.db
                    .from(
                        "chat_call_invites"
                    )
                    .update({

                        status:
                            "declined"

                    })
                    .eq(
                        "id",
                        call.inviteId
                    );
            }

        } catch (
            error
        ) {

            console.error(
                "Decline call failed:",
                error
            );
        }
    }


    /* =========================================================
       CALL PAGE URL
       ========================================================= */

    function openCallPage({

        roomId,

        role,

        mode,

        inviteId = ""

    }) {

        const params =
            new URLSearchParams();


        params.set(
            "room",
            roomId
        );


        params.set(
            "role",
            role
        );


        params.set(
            "mode",
            mode
        );


        if (inviteId) {

            params.set(
                "invite",
                inviteId
            );
        }


        window.location.href =
            `${CONFIG.callPage}?${params.toString()}`;
    }


    function getCallParameters() {

        const params =
            new URLSearchParams(
                window.location.search
            );


        return {

            roomId:
                params.get(
                    "room"
                ),

            role:
                params.get(
                    "role"
                ) ||
                "callee",

            mode:
                params.get(
                    "mode"
                ) ||
                "audio",

            inviteId:
                params.get(
                    "invite"
                ) ||
                ""

        };
    }


    /* =========================================================
       LOCAL MEDIA
       ========================================================= */

    async function prepareLocalMedia(
        mode
    ) {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            throw new Error(
                "Your browser does not support microphone or camera access."
            );
        }


        const constraints = {

            audio: true,

            video:
                mode ===
                "video"

        };


        state.localStream =
            await navigator
                .mediaDevices
                .getUserMedia(
                    constraints
                );


        state.microphoneEnabled =
            true;


        state.cameraEnabled =
            mode ===
            "video";


        renderLocalStream();
    }


    function renderLocalStream() {

        const grid =
            $("callParticipantGrid");


        if (!grid)
            return;


        let tile =
            grid.querySelector(
                "[data-local-call-tile]"
            );


        if (!tile) {

            tile =
                document.createElement(
                    "div"
                );

            tile.className =
                "call-video-tile local-call-tile";

            tile.dataset.localCallTile =
                "true";


            tile.innerHTML = `

                <div class="call-local-media"></div>

                <div class="call-video-name">
                    You
                </div>

            `;


            grid.prepend(
                tile
            );
        }


        const media =
            tile.querySelector(
                ".call-local-media"
            );


        if (!media)
            return;


        media.innerHTML =
            "";


        if (
            state.currentMode ===
            "video"
        ) {

            const video =
                document.createElement(
                    "video"
                );


            video.autoplay =
                true;

            video.muted =
                true;

            video.playsInline =
                true;

            video.srcObject =
                state.screenSharing
                    ? state.screenStream
                    : state.localStream;


            media.appendChild(
                video
            );

        } else {

            media.innerHTML = `

                <div class="call-avatar-large">
                    🎙️
                </div>

            `;
        }
    }


    /* =========================================================
       JOIN ROOM
       ========================================================= */

    async function joinRoom() {

        const params =
            getCallParameters();


        if (!params.roomId) {

            throw new Error(
                "No call room was provided."
            );
        }


        state.currentRoom =
            {
                id:
                    params.roomId
            };


        state.currentRole =
            params.role;


        state.currentMode =
            params.mode;


        if (
            params.inviteId
        ) {

            state.currentInvite =
                {
                    id:
                        params.inviteId
                };
        }


        const room =
            await state.db
                .from(
                    "chat_call_rooms"
                )
                .select("*")
                .eq(
                    "id",
                    params.roomId
                )
                .maybeSingle();


        if (room.error)
            throw room.error;


        if (!room.data) {

            throw new Error(
                "This call room no longer exists."
            );
        }


        if (
            room.data.room_status ===
            "ended"
        ) {

            throw new Error(
                "This call has already ended."
            );
        }


        state.currentRoom =
            room.data;


        await prepareLocalMedia(
            state.currentMode
        );


        await upsertParticipant(
            params.roomId,
            state.user.id,
            "joined"
        );


        /*
         * A joined participant changes the room
         * from ringing to active.
         */
        await state.db
            .from(
                "chat_call_rooms"
            )
            .update({

                room_status:
                    "active"

            })
            .eq(
                "id",
                params.roomId
            );


        await setupRoomChannel(
            params.roomId
        );


        updateCallHeader();


        await announceJoined();


        /*
         * Existing participants need to discover
         * this participant.
         */
        await discoverExistingParticipants(
            params.roomId
        );
    }


    /* =========================================================
       DISCOVER EXISTING PARTICIPANTS
       ========================================================= */

    async function discoverExistingParticipants(
        roomId
    ) {

        const result =
            await state.db
                .from(
                    "chat_call_participants"
                )
                .select(
                    "user_id,status"
                )
                .eq(
                    "room_id",
                    roomId
                )
                .eq(
                    "status",
                    "joined"
                );


        if (result.error) {

            console.error(
                "Participant discovery failed:",
                result.error
            );

            return;
        }


        for (
            const participant
            of
            result.data || []
        ) {

            const remoteId =
                String(
                    participant.user_id
                );


            if (
                remoteId ===
                String(
                    state.user.id
                )
            )
                continue;


            await ensurePeerConnection(
                remoteId,
                true
            );
        }
    }


    /* =========================================================
       ROOM SIGNALING
       ========================================================= */

    async function setupRoomChannel(
        roomId
    ) {

        if (
            state.roomChannel
        ) {

            try {

                await state.db
                    .removeChannel(
                        state.roomChannel
                    );

            } catch {}

            state.roomChannel =
                null;
        }


        state.roomChannel =
            state.db.channel(
                `mwaniki-call-room-${roomId}`
            );


        state.roomChannel

            .on(
                "broadcast",
                {
                    event:
                        "peer-joined"
                },
                async payload => {

                    const userId =
                        payload
                            ?.payload
                            ?.userId;


                    if (!userId)
                        return;


                    if (
                        String(
                            userId
                        ) ===
                        String(
                            state.user.id
                        )
                    )
                        return;


                    await ensurePeerConnection(
                        userId,
                        true
                    );
                }
            )


            .on(
                "broadcast",
                {
                    event:
                        "offer"
                },
                async payload => {

                    await handleOffer(
                        payload?.payload
                    );
                }
            )


            .on(
                "broadcast",
                {
                    event:
                        "answer"
                },
                async payload => {

                    await handleAnswer(
                        payload?.payload
                    );
                }
            )


            .on(
                "broadcast",
                {
                    event:
                        "ice-candidate"
                },
                async payload => {

                    await handleCandidate(
                        payload?.payload
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

                    const userId =
                        payload
                            ?.payload
                            ?.userId;


                    if (userId) {

                        removePeer(
                            userId
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

                    finishCall(
                        false
                    );
                }
            )


            .subscribe(
                status => {

                    console.log(
                        "📞 Call signaling:",
                        status
                    );

                }
            );
    }


    async function announceJoined() {

        if (
            !state.roomChannel
        )
            return;


        await state.roomChannel.send({

            type:
                "broadcast",

            event:
                "peer-joined",

            payload: {

                userId:
                    state.user.id

            }

        });
    }


    /* =========================================================
       WEBRTC PEER
       ========================================================= */

    async function ensurePeerConnection(
        remoteUserId,
        shouldOffer = false
    ) {

        const key =
            String(
                remoteUserId
            );


        if (
            key ===
            String(
                state.user.id
            )
        )
            return null;


        if (
            state.peerConnections.has(
                key
            )
        ) {

            return state.peerConnections.get(
                key
            );
        }


        const connection =
            new RTCPeerConnection({

                iceServers:
                    CONFIG.iceServers

            });


        state.peerConnections.set(
            key,
            connection
        );


        /*
         * Add microphone and camera tracks.
         */
        if (
            state.localStream
        ) {

            state.localStream
                .getTracks()
                .forEach(
                    track => {

                        connection.addTrack(
                            track,
                            state.localStream
                        );

                    }
                );
        }


        connection.onicecandidate =
            async event => {

                if (
                    !event.candidate ||
                    !state.roomChannel
                )
                    return;


                await state.roomChannel
                    .send({

                        type:
                            "broadcast",

                        event:
                            "ice-candidate",

                        payload: {

                            from:
                                state.user.id,

                            to:
                                remoteUserId,

                            candidate:
                                event.candidate

                        }

                    });
            };


        connection.ontrack =
            event => {

                const stream =
                    event.streams?.[0];


                if (!stream)
                    return;


                state.remoteStreams.set(
                    key,
                    stream
                );


                renderRemoteParticipant(
                    remoteUserId,
                    stream
                );
            };


        connection.onconnectionstatechange =
            () => {

                const status =
                    connection.connectionState;


                console.log(
                    `📞 Peer ${key}:`,
                    status
                );


                if (
                    status ===
                    "failed" ||
                    status ===
                    "closed"
                ) {

                    removePeer(
                        key
                    );
                }
            };


        /*
         * Only one side creates an offer.
         * This prevents offer collisions.
         */
        if (
            shouldOffer &&
            String(
                state.user.id
            ) < key
        ) {

            try {

                const offer =
                    await connection
                        .createOffer();


                await connection
                    .setLocalDescription(
                        offer
                    );


                await state.roomChannel
                    .send({

                        type:
                            "broadcast",

                        event:
                            "offer",

                        payload: {

                            from:
                                state.user.id,

                            to:
                                remoteUserId,

                            description:
                                connection.localDescription

                        }

                    });

            } catch (
                error
            ) {

                console.error(
                    "Offer creation failed:",
                    error
                );
            }
        }


        return connection;
    }


    /* =========================================================
       OFFER
       ========================================================= */

    async function handleOffer(
        payload
    ) {

        if (!payload)
            return;


        if (
            String(
                payload.to
            ) !==
            String(
                state.user.id
            )
        )
            return;


        const connection =
            await ensurePeerConnection(
                payload.from,
                false
            );


        if (!connection)
            return;


        try {

            await connection
                .setRemoteDescription(
                    new RTCSessionDescription(
                        payload.description
                    )
                );


            await flushPendingCandidates(
                payload.from,
                connection
            );


            const answer =
                await connection
                    .createAnswer();


            await connection
                .setLocalDescription(
                    answer
                );


            await state.roomChannel
                .send({

                    type:
                        "broadcast",

                    event:
                        "answer",

                    payload: {

                        from:
                            state.user.id,

                        to:
                            payload.from,

                        description:
                            connection.localDescription

                    }

                });

        } catch (
            error
        ) {

            console.error(
                "Offer handling failed:",
                error
            );
        }
    }


    /* =========================================================
       ANSWER
       ========================================================= */

    async function handleAnswer(
        payload
    ) {

        if (!payload)
            return;


        if (
            String(
                payload.to
            ) !==
            String(
                state.user.id
            )
        )
            return;


        const connection =
            state.peerConnections.get(
                String(
                    payload.from
                )
            );


        if (!connection)
            return;


        try {

            await connection
                .setRemoteDescription(
                    new RTCSessionDescription(
                        payload.description
                    )
                );


            await flushPendingCandidates(
                payload.from,
                connection
            );

        } catch (
            error
        ) {

            console.error(
                "Answer handling failed:",
                error
            );
        }
    }


    /* =========================================================
       ICE
       ========================================================= */

    async function handleCandidate(
        payload
    ) {

        if (!payload)
            return;


        if (
            String(
                payload.to
            ) !==
            String(
                state.user.id
            )
        )
            return;


        const key =
            String(
                payload.from
            );


        const connection =
            await ensurePeerConnection(
                key,
                false
            );


        if (!connection)
            return;


        /*
         * ICE can arrive before the SDP.
         * Queue it until remoteDescription exists.
         */
        if (
            !connection.remoteDescription
        ) {

            if (
                !state.pendingCandidates.has(
                    key
                )
            ) {

                state.pendingCandidates.set(
                    key,
                    []
                );
            }


            state.pendingCandidates
                .get(key)
                .push(
                    payload.candidate
                );


            return;
        }


        try {

            await connection
                .addIceCandidate(
                    new RTCIceCandidate(
                        payload.candidate
                    )
                );

        } catch (
            error
        ) {

            console.warn(
                "ICE candidate failed:",
                error
            );
        }
    }


    async function flushPendingCandidates(
        userId,
        connection
    ) {

        const key =
            String(
                userId
            );


        const queue =
            state.pendingCandidates.get(
                key
            );


        if (!queue?.length)
            return;


        for (
            const candidate
            of queue
        ) {

            try {

                await connection
                    .addIceCandidate(
                        new RTCIceCandidate(
                            candidate
                        )
                    );

            } catch (
                error
            ) {

                console.warn(
                    "Queued ICE candidate failed:",
                    error
                );
            }
        }


        state.pendingCandidates.delete(
            key
        );
    }


    /* =========================================================
       REMOTE PARTICIPANT UI
       ========================================================= */

    async function renderRemoteParticipant(
        userId,
        stream
    ) {

        const grid =
            $("callParticipantGrid");


        if (!grid)
            return;


        const key =
            String(
                userId
            );


        let tile =
            grid.querySelector(
                `[data-call-user="${CSS.escape(
                    key
                )}"]`
            );


        if (!tile) {

            tile =
                document.createElement(
                    "div"
                );

            tile.className =
                "call-video-tile";

            tile.dataset.callUser =
                key;


            tile.innerHTML = `

                <div class="call-remote-media">

                    <audio
                        autoplay
                        playsinline
                    ></audio>

                </div>

                <div class="call-video-name">
                    Connecting...
                </div>

            `;


            grid.appendChild(
                tile
            );


            loadRemoteProfile(
                userId,
                tile
            );
        }


        const media =
            tile.querySelector(
                ".call-remote-media"
            );


        if (!media)
            return;


        if (
            state.currentMode ===
            "video"
        ) {

            let video =
                media.querySelector(
                    "video"
                );


            if (!video) {

                media.innerHTML =
                    "";


                video =
                    document.createElement(
                        "video"
                    );


                video.autoplay =
                    true;

                video.playsInline =
                    true;


                media.appendChild(
                    video
                );
            }


            video.srcObject =
                stream;


        } else {

            let audio =
                media.querySelector(
                    "audio"
                );


            if (!audio) {

                media.innerHTML =
                    "";


                audio =
                    document.createElement(
                        "audio"
                    );


                audio.autoplay =
                    true;

                audio.playsInline =
                    true;


                media.appendChild(
                    audio
                );
            }


            audio.srcObject =
                stream;


            try {

                await audio.play();

            } catch {}
        }
    }


    async function loadRemoteProfile(
        userId,
        tile
    ) {

        const result =
            await state.db
                .from(
                    "chat_public_profiles"
                )
                .select("*")
                .eq(
                    "id",
                    userId
                )
                .maybeSingle();


        const label =
            tile.querySelector(
                ".call-video-name"
            );


        if (label) {

            label.textContent =
                displayName(
                    result.data
                );
        }
    }


    /* =========================================================
       REMOVE PEER
       ========================================================= */

    function removePeer(
        userId
    ) {

        const key =
            String(
                userId
            );


        const connection =
            state.peerConnections.get(
                key
            );


        if (connection) {

            try {

                connection.close();

            } catch {}


            state.peerConnections.delete(
                key
            );
        }


        state.remoteStreams.delete(
            key
        );


        state.pendingCandidates.delete(
            key
        );


        document
            .querySelector(
                `[data-call-user="${CSS.escape(
                    key
                )}"]`
            )
            ?.remove();
    }


    /* =========================================================
       CALL HEADER
       ========================================================= */

    async function updateCallHeader() {

        const title =
            $("callRoomTitle");

        const subtitle =
            $("callRoomSubtitle");

        const status =
            $("callRoomStatus");


        let roomTitle =
            "Mwaniki Scholars Call";


        const scope =
            state.currentRoom
                ?.call_scope;


        if (
            scope ===
            "community"
        ) {

            roomTitle =
                "Community Call";

        } else if (
            scope ===
            "general"
        ) {

            roomTitle =
                "General Call";

        } else if (
            scope ===
            "direct"
        ) {

            roomTitle =
                "Private Call";
        }


        if (title) {

            title.textContent =
                roomTitle;
        }


        if (subtitle) {

            subtitle.textContent =
                state.currentMode ===
                "video"
                    ? "Video call"
                    : "Voice call";
        }


        if (status) {

            status.textContent =
                "Connected";
        }
    }


    /* =========================================================
       MICROPHONE
       ========================================================= */

    function toggleMicrophone() {

        if (
            !state.localStream
        )
            return;


        state.microphoneEnabled =
            !state.microphoneEnabled;


        state.localStream
            .getAudioTracks()
            .forEach(
                track => {

                    track.enabled =
                        state.microphoneEnabled;

                }
            );


        const button =
            $("toggleMicrophoneButton");


        if (button) {

            button.textContent =
                state.microphoneEnabled
                    ? "🎙️"
                    : "🔇";


            button.classList.toggle(
                "active",
                state.microphoneEnabled
            );
        }
    }


    /* =========================================================
       CAMERA
       ========================================================= */

    function toggleCamera() {

        if (
            !state.localStream
        )
            return;


        const tracks =
            state.localStream
                .getVideoTracks();


        if (!tracks.length)
            return;


        state.cameraEnabled =
            !state.cameraEnabled;


        tracks.forEach(
            track => {

                track.enabled =
                    state.cameraEnabled;

            }
        );


        const button =
            $("toggleCameraButton");


        if (button) {

            button.textContent =
                state.cameraEnabled
                    ? "📹"
                    : "🚫";


            button.classList.toggle(
                "active",
                state.cameraEnabled
            );
        }
    }


    /* =========================================================
       SCREEN SHARING
       ========================================================= */

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
                "Screen sharing is not supported by this browser."
            );

            return;
        }


        try {

            state.screenStream =
                await navigator
                    .mediaDevices
                    .getDisplayMedia({

                        video:
                            true,

                        audio:
                            false

                    });


            const screenTrack =
                state.screenStream
                    .getVideoTracks()[0];


            if (!screenTrack)
                return;


            for (
                const connection
                of
                state.peerConnections
                    .values()
            ) {

                const sender =
                    connection
                        .getSenders()
                        .find(
                            item =>
                                item.track
                                    ?.kind ===
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


            $("shareScreenButton")
                ?.classList.add(
                    "active"
                );


            renderLocalStream();


            screenTrack.onended =
                () => {

                    stopScreenShare();

                };

        } catch (
            error
        ) {

            console.error(
                "Screen share failed:",
                error
            );

            state.screenStream =
                null;
        }
    }


    async function stopScreenShare() {

        if (
            !state.screenStream
        )
            return;


        const cameraTrack =
            state.localStream
                ?.getVideoTracks()[0];


        for (
            const connection
            of
            state.peerConnections
                .values()
        ) {

            const sender =
                connection
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

                try {

                    await sender
                        .replaceTrack(
                            cameraTrack
                        );

                } catch {}
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


        $("shareScreenButton")
            ?.classList.remove(
                "active"
            );


        renderLocalStream();
    }


    /* =========================================================
       LEAVE PARTICIPANT
       ========================================================= */

    async function leaveParticipant() {

        if (
            !state.currentRoom?.id ||
            !state.user
        )
            return;


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
                    state.currentRoom.id
                )
                .eq(
                    "user_id",
                    state.user.id
                );

        } catch (
            error
        ) {

            console.warn(
                "Participant leave update failed:",
                error
            );
        }
    }


    /* =========================================================
       END ROOM
       ========================================================= */

    async function endRoom(
        roomId
    ) {

        if (!roomId)
            return;


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
                    roomId
                );

        } catch (
            error
        ) {

            console.warn(
                "Room ending failed:",
                error
            );
        }
    }


    /* =========================================================
       LEAVE CALL
       ========================================================= */

    async function leaveCall() {

        if (
            state.ending
        )
            return;


        state.ending =
            true;


        try {

            if (
                state.roomChannel
            ) {

                try {

                    await state.roomChannel
                        .send({

                            type:
                                "broadcast",

                            event:
                                "peer-left",

                            payload: {

                                userId:
                                    state.user.id

                            }

                        });

                } catch {}


                try {

                    await state.roomChannel
                        .send({

                            type:
                                "broadcast",

                            event:
                                "call-ended",

                            payload: {

                                userId:
                                    state.user.id

                            }

                        });

                } catch {}
            }


            await leaveParticipant();


            /*
             * For now the caller ending the call ends
             * the room. Other participants will receive
             * the call-ended signal.
             */
            if (
                state.currentRole ===
                "caller"
            ) {

                await endRoom(
                    state.currentRoom?.id
                );
            }


        } finally {

            await finishCall(
                true
            );
        }
    }


    /* =========================================================
       FINISH LOCAL CALL
       ========================================================= */

    async function finishCall(
        redirect = true
    ) {

        if (
            state.ending &&
            !redirect
        ) {
            return;
        }


        clearTimeout(
            state.ringTimer
        );


        state.ringTimer =
            null;


        if (
            state.screenStream
        ) {

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
            state.localStream
        ) {

            state.localStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

            state.localStream =
                null;
        }


        for (
            const connection
            of
            state.peerConnections
                .values()
        ) {

            try {

                connection.close();

            } catch {}
        }


        state.peerConnections.clear();


        state.remoteStreams.clear();


        state.pendingCandidates.clear();


        if (
            state.roomChannel
        ) {

            try {

                await state.db
                    .removeChannel(
                        state.roomChannel
                    );

            } catch {}


            state.roomChannel =
                null;
        }


        if (redirect) {

            window.location.href =
                "./community.html";
        }
    }


    /* =========================================================
       RING TIMER
       ========================================================= */

    function startRingTimer(
        roomId,
        inviteId
    ) {

        clearTimeout(
            state.ringTimer
        );


        state.ringTimer =
            setTimeout(
                async () => {

                    if (
                        inviteId
                    ) {

                        await state.db
                            .from(
                                "chat_call_invites"
                            )
                            .update({

                                status:
                                    "missed"

                            })
                            .eq(
                                "id",
                                inviteId
                            );
                    }


                    if (
                        state.currentRole ===
                        "caller"
                    ) {

                        await endRoom(
                            roomId
                        );
                    }

                },
                CONFIG.ringTimeout
            );
    }


    /* =========================================================
       CALL PICKER
       ========================================================= */

    async function openCallPicker(
        communityId = null
    ) {

        state.pickerCommunityId =
            communityId;


        let picker =
            $("mwanikiCallPicker");


        if (!picker) {

            picker =
                document.createElement(
                    "div"
                );

            picker.id =
                "mwanikiCallPicker";

            picker.className =
                "call-picker-overlay";

            document.body.appendChild(
                picker
            );
        }


        const communityName =
            communityId
                ? await getCommunityName(
                    communityId
                )
                : "Online members";


        picker.innerHTML = `

            <div class="call-picker-card">

                <div class="call-picker-header">

                    <div>

                        <strong>
                            Start a call
                        </strong>

                        <span>
                            ${escapeHTML(
                                communityName
                            )}
                        </span>

                    </div>

                    <button
                        id="closeCallPicker"
                        type="button"
                    >
                        ✕
                    </button>

                </div>


                <div class="call-picker-modes">

                    <button
                        type="button"
                        class="call-mode active"
                        data-call-mode="audio"
                    >
                        🎙️ Audio
                    </button>

                    <button
                        type="button"
                        class="call-mode"
                        data-call-mode="video"
                    >
                        📹 Video
                    </button>

                </div>


                <div class="call-picker-toolbar">

                    <button
                        id="selectAllCallUsers"
                        type="button"
                    >
                        Select all online
                    </button>

                </div>


                <div
                    id="callPickerUsers"
                    class="call-picker-users"
                >
                    Loading online members...
                </div>


                <div class="call-picker-footer">

                    <span id="callSelectionStatus">
                        0 selected
                    </span>

                    <button
                        id="startSelectedCall"
                        class="start-call-button"
                        type="button"
                        disabled
                    >
                        Start Call
                    </button>

                </div>

            </div>

        `;


        show(
            picker
        );


        let mode =
            "audio";


        const selected =
            new Set();


        const users =
            await getOnlineUsers(
                communityId
            );


        const container =
            $("callPickerUsers");


        if (!users.length) {

            container.innerHTML = `

                <div class="empty-state">

                    <strong>
                        Nobody else is online
                    </strong>

                    <span>
                        A member must be online
                        before you can call them.
                    </span>

                </div>

            `;

        } else {

            container.innerHTML =
                "";


            users.forEach(
                member => {

                    const profile =
                        member.profile;


                    const name =
                        displayName(
                            profile
                        );


                    const image =
                        avatar(
                            profile
                        );


                    const row =
                        document.createElement(
                            "button"
                        );


                    row.type =
                        "button";

                    row.className =
                        "call-picker-user";

                    row.dataset.userId =
                        member.user_id;


                    row.innerHTML = `

                        <span
                            class="call-picker-check"
                        >
                            ✓
                        </span>

                        ${
                            image
                                ? `

                                    <img
                                        src="${escapeHTML(
                                            image
                                        )}"
                                        alt=""
                                    >

                                `
                                : `

                                    <span
                                        class="fallback-avatar"
                                    >
                                        ${escapeHTML(
                                            initials(
                                                name
                                            )
                                        )}
                                    </span>

                                `
                        }

                        <span
                            class="call-picker-user-info"
                        >

                            <strong>
                                ${escapeHTML(
                                    name
                                )}
                            </strong>

                            <small>
                                ● Online
                            </small>

                        </span>

                    `;


                    row.addEventListener(
                        "click",
                        () => {

                            const id =
                                String(
                                    member.user_id
                                );


                            if (
                                selected.has(
                                    id
                                )
                            ) {

                                selected.delete(
                                    id
                                );

                                row.classList
                                    .remove(
                                        "selected"
                                    );

                            } else {

                                selected.add(
                                    id
                                );

                                row.classList
                                    .add(
                                        "selected"
                                    );
                            }


                            updatePickerSelection();
                        }
                    );


                    container.appendChild(
                        row
                    );
                }
            );
        }


        function updatePickerSelection() {

            const status =
                $("callSelectionStatus");


            const start =
                $("startSelectedCall");


            if (status) {

                status.textContent =
                    `${selected.size} selected`;
            }


            if (start) {

                start.disabled =
                    selected.size ===
                    0;
            }
        }


        picker
            .querySelectorAll(
                "[data-call-mode]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            mode =
                                button.dataset.callMode;


                            picker
                                .querySelectorAll(
                                    "[data-call-mode]"
                                )
                                .forEach(
                                    item => {

                                        item.classList
                                            .toggle(
                                                "active",
                                                item ===
                                                button
                                            );

                                    }
                                );
                        }
                    );
                }
            );


        $("selectAllCallUsers")
            ?.addEventListener(
                "click",
                () => {

                    if (
                        selected.size ===
                        users.length
                    ) {

                        selected.clear();

                        picker
                            .querySelectorAll(
                                ".call-picker-user"
                            )
                            .forEach(
                                row =>
                                    row.classList
                                        .remove(
                                            "selected"
                                        )
                            );

                    } else {

                        users.forEach(
                            member =>
                                selected.add(
                                    String(
                                        member.user_id
                                    )
                                )
                        );


                        picker
                            .querySelectorAll(
                                ".call-picker-user"
                            )
                            .forEach(
                                row =>
                                    row.classList
                                        .add(
                                            "selected"
                                        )
                            );
                    }


                    updatePickerSelection();
                }
            );


        $("startSelectedCall")
            ?.addEventListener(
                "click",
                async () => {

                    const ids =
                        [
                            ...selected
                        ];


                    hide(
                        picker
                    );


                    await startGeneralCall(
                        ids,
                        mode
                    );
                }
            );


        $("closeCallPicker")
            ?.addEventListener(
                "click",
                () =>
                    hide(
                        picker
                    )
            );


        /*
         * Clicking the dark background closes
         * the picker.
         */
        picker.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    picker
                ) {

                    hide(
                        picker
                    );
                }
            }
        );
    }


    async function getCommunityName(
        id
    ) {

        const result =
            await state.db
                .from(
                    "chat_communities"
                )
                .select(
                    "name"
                )
                .eq(
                    "id",
                    id
                )
                .maybeSingle();


        return (
            result.data?.name ||
            "Community"
        );
    }


    /* =========================================================
       CALL PAGE CONTROLS
       ========================================================= */

    function setupCallControls() {

        $("toggleMicrophoneButton")
            ?.addEventListener(
                "click",
                toggleMicrophone
            );


        $("toggleCameraButton")
            ?.addEventListener(
                "click",
                toggleCamera
            );


        $("shareScreenButton")
            ?.addEventListener(
                "click",
                toggleScreenShare
            );


        $("leaveCallButton")
            ?.addEventListener(
                "click",
                async () => {

                    await leaveCall();

                }
            );
    }


    /* =========================================================
       CALL PAGE INITIALIZATION
       ========================================================= */

    async function startCallPage() {

        const params =
            getCallParameters();


        if (!params.roomId) {

            window.location.href =
                "./community.html";

            return;
        }


        try {

            await joinRoom();

        } catch (
            error
        ) {

            console.error(
                "Could not join call:",
                error
            );


            toast(
                error.message ||
                "Could not join the call."
            );


            await finishCall(
                false
            );


            window.location.href =
                "./community.html";
        }
    }


    /* =========================================================
       CLEANUP
       ========================================================= */

    window.addEventListener(
        "beforeunload",
        () => {

            try {

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


                if (
                    state.screenStream
                ) {

                    state.screenStream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );
                }


                for (
                    const connection
                    of
                    state.peerConnections
                        .values()
                ) {

                    try {

                        connection.close();

                    } catch {}
                }

            } catch {}
        }
    );


    /* =========================================================
       PUBLIC API
       ========================================================= */

    window.MwanikiCalls = {

        callUser:
            startDirectCall,

        callCommunity:
            startCommunityCall,

        openPicker:
            openCallPicker,

        startGeneralCall:
            startGeneralCall,

        leave:
            leaveCall

    };


    /* =========================================================
       INITIALIZATION
       ========================================================= */

    async function initialize() {

        if (
            state.initialized
        )
            return;


        state.initialized =
            true;


        const db =
            await waitForSupabase();


        if (!db)
            return;


        const authenticated =
            await loadIdentity();


        if (!authenticated) {

            console.warn(
                "📞 No authenticated Supabase user."
            );


            if (
                state.isCallPage
            ) {

                window.location.href =
                    "./index.html";
            }


            return;
        }


        await setupIncomingCalls();


        if (
            state.isCallPage
        ) {

            setupCallControls();

            await startCallPage();

        }


        console.log(
            "📞 Mwaniki real call engine ready."
        );
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once:
                    true
            }
        );

    } else {

        initialize();

    }

})();
