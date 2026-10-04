/*
================================================================
 MWANIKI SCHOLARS REAL CALL ENGINE
================================================================

 THIS FILE OWNS CALLING.

 SUPPORTED:

 1. REAL ONE-TO-ONE CALLS
 2. REAL COMMUNITY CALLS
 3. GENERAL GROUP CALLS
 4. INCOMING CALLS
 5. ANSWER / DECLINE
 6. AUDIO
 7. VIDEO
 8. SCREEN SHARING
 9. MULTI-PARTICIPANT WEBRTC
10. CALL ENDING

 NO UUID INPUT IS USED.

 community.js does NOT perform WebRTC.
================================================================
*/

(() => {

    "use strict";


    const CONFIG = {

        callPage:
            "./community-calls.html",

        presenceWindow:
            120000,

        ringTimeout:
            45000,

        stunServers: [
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


    const state = {

        db: null,

        user: null,

        profile: null,

        pickerCommunityId: null,

        currentRoom: null,

        currentInvite: null,

        currentMode: "audio",

        currentRole: null,

        communityId: null,

        roomChannel: null,

        incomingChannel: null,

        peerConnections:
            new Map(),

        remoteStreams:
            new Map(),

        localStream: null,

        screenStream: null,

        microphoneEnabled: true,

        cameraEnabled: true,

        screenSharing: false,

        ringTimer: null,

        initialized: false,

        isCallPage:
            window.location.pathname
                .includes(
                    "community-calls.html"
                )

    };


    /* =========================================================
       SUPABASE
       ========================================================= */

    async function waitForSupabase() {

        for (
            let attempt = 0;
            attempt < 100;
            attempt++
        ) {

            if (
                window.supabaseClient
            ) {
                state.db =
                    window.supabaseClient;
                return state.db;
            }

            if (
                window.mwanikiSupabase
            ) {
                state.db =
                    window.mwanikiSupabase;
                return state.db;
            }

            if (window.sb) {
                state.db =
                    window.sb;
                return state.db;
            }

            if (window.supabase) {
                state.db =
                    window.supabase;
                return state.db;
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
            "Call engine: Supabase unavailable."
        );

        return null;
    }


    /* =========================================================
       DOM
       ========================================================= */

    const $ = id =>
        document.getElementById(id);


    /* =========================================================
       UTILITIES
       ========================================================= */

    function escapeHTML(value) {

        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    function safeURL(value) {

        try {

            const url =
                new URL(value);

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

        return String(
            name || "Student"
        )
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(
                part =>
                    part[0]
                        ?.toUpperCase() ||
                    ""
            )
            .join("") ||
            "S";
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

        element?.classList.remove(
            "hidden"
        );
    }


    function hide(element) {

        element?.classList.add(
            "hidden"
        );
    }


    /* =========================================================
       AUTH
       ========================================================= */

    async function loadIdentity() {

        const {
            data,
            error
        } = await state.db.auth.getUser();

        if (error) {

            console.error(
                error
            );

            return false;
        }

        state.user =
            data?.user || null;

        if (!state.user) {

            return false;
        }


        const student =
            await state.db
                .from("students")
                .select("*")
                .eq(
                    "id",
                    state.user.id
                )
                .maybeSingle();


        if (student.data) {

            state.profile =
                student.data;

        } else {

            const publicProfile =
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

            state.profile =
                publicProfile.data ||
                {
                    id:
                        state.user.id,
                    email:
                        state.user.email
                };
        }

        return true;
    }


    /* =========================================================
       ONLINE USERS
       ========================================================= */

    async function getOnlineUsers(
        communityId = null
    ) {

        let presence =
            await state.db
                .from("chat_presence")
                .select(
                    "user_id,status,last_seen_at"
                )
                .eq(
                    "status",
                    "online"
                );


        if (presence.error) {

            console.error(
                presence.error
            );

            return [];
        }


        const now =
            Date.now();


        let rows =
            (presence.data || [])
                .filter(row => {

                    if (
                        !row.last_seen_at
                    ) {
                        return true;
                    }

                    return (
                        now -
                        new Date(
                            row.last_seen_at
                        ).getTime()
                    ) <
                        CONFIG.presenceWindow;
                });


        if (communityId) {

            const members =
                await state.db
                    .from(
                        "chat_community_members"
                    )
                    .select("user_id")
                    .eq(
                        "community_id",
                        communityId
                    );


            const ids =
                new Set(
                    (members.data || [])
                        .map(
                            member =>
                                String(
                                    member.user_id
                                )
                        )
                );


            rows =
                rows.filter(
                    row =>
                        ids.has(
                            String(
                                row.user_id
                            )
                        )
                );
        }


        const ids =
            rows
                .map(
                    row =>
                        row.user_id
                )
                .filter(
                    id =>
                        String(id) !==
                        String(
                            state.user.id
                        )
                );


        if (!ids.length) {

            return [];
        }


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


        return rows
            .filter(
                row =>
                    String(
                        row.user_id
                    ) !==
                    String(
                        state.user.id
                    )
            )
            .map(
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
       CREATE CALL ROOM
       ========================================================= */

    async function createRoom({
        communityId = null,
        targetUserId = null,
        mode = "audio",
        scope = "direct",
        participantCount = 2
    }) {

        const payload = {

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
                participantCount

        };


        const {
            data,
            error
        } = await state.db
            .from("chat_call_rooms")
            .insert(payload)
            .select("*")
            .single();


        if (error) {

            console.error(
                "CALL ROOM CREATION FAILED:",
                error
            );

            throw error;
        }


        return data;
    }


    /* =========================================================
       INVITE
       ========================================================= */

    async function createInvite(
        roomId,
        receiverId,
        mode
    ) {

        const {
            data,
            error
        } = await state.db
            .from("chat_call_invites")
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


        if (error) {

            console.error(
                "INVITE CREATION FAILED:",
                error
            );

            throw error;
        }


        return data;
    }


    /* =========================================================
       USER SIGNAL CHANNEL
       ========================================================= */

    function userChannel(userId) {

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


        await new Promise(
            resolve => {

                let done = false;

                const finish = () => {

                    if (done) return;

                    done = true;

                    resolve();
                };


                channel.subscribe(
                    async status => {

                        if (
                            status ===
                            "SUBSCRIBED"
                        ) {

                            await channel.send({
                                type:
                                    "broadcast",

                                event:
                                    "incoming-call",

                                payload
                            });

                            finish();
                        }

                    }
                );


                setTimeout(
                    finish,
                    5000
                );
            }
        );


        setTimeout(
            () =>
                state.db.removeChannel(
                    channel
                ),
            7000
        );
    }


    /* =========================================================
       DIRECT CALL
       ========================================================= */

    async function startDirectCall(
        targetUserId,
        mode = "audio"
    ) {

        if (
            !state.user ||
            !targetUserId
        ) return;


        if (
            String(targetUserId) ===
            String(state.user.id)
        ) {

            alert(
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

            alert(
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


            const invite =
                await createInvite(
                    room.id,
                    targetUserId,
                    mode
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
                        room.community_id,

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

        } catch (error) {

            console.error(
                "Could not start call:",
                error
            );

            alert(
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

            alert(
                "No community selected."
            );

            return;
        }


        const online =
            await getOnlineUsers(
                communityId
            );


        if (!online.length) {

            alert(
                "There are no other online members in this community."
            );

            return;
        }


        try {

            const room =
                await createRoom({
                    communityId,

                    targetUserId:
                        null,

                    mode,

                    scope:
                        "community",

                    participantCount:
                        online.length + 1
                });


            state.currentRoom =
                room;

            state.currentMode =
                mode;

            state.currentRole =
                "caller";


            let invitations = 0;


            for (
                const member
                of online
            ) {

                try {

                    const invite =
                        await createInvite(
                            room.id,
                            member.user_id,
                            mode
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


                    invitations++;

                } catch (error) {

                    console.error(
                        "Member invitation failed:",
                        member.user_id,
                        error
                    );
                }
            }


            if (!invitations) {

                await endRoom(
                    room.id
                );

                alert(
                    "Nobody could be invited to the call."
                );

                return;
            }


            startRingTimer(
                room.id,
                null
            );


            openCallPage({
                roomId:
                    room.id,

                role:
                    "caller",

                mode
            });

        } catch (error) {

            console.error(
                "Community call failed:",
                error
            );

            alert(
                error.message ||
                "Community call could not start."
            );
        }
    }


    /* =========================================================
       GENERAL MULTI-USER CALL
       ========================================================= */

    async function startGeneralCall(
        selectedUserIds,
        mode = "audio"
    ) {

        const ids =
            [
                ...new Set(
                    selectedUserIds
                        .filter(
                            id =>
                                String(id) !==
                                String(
                                    state.user.id
                                )
                        )
                )
            ];


        if (!ids.length) {

            alert(
                "Select at least one online member."
            );

            return;
        }


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


        state.currentRoom =
            room;

        state.currentMode =
            mode;

        state.currentRole =
            "caller";


        let invited = 0;


        for (
            const userId
            of ids
        ) {

            try {

                const invite =
                    await createInvite(
                        room.id,
                        userId,
                        mode
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
                    error
                );
            }
        }


        if (!invited) {

            await endRoom(
                room.id
            );

            return;
        }


        startRingTimer(
            room.id,
            null
        );


        openCallPage({
            roomId:
                room.id,

            role:
                "caller",

            mode
        });
    }


    /* =========================================================
       INCOMING CALL LISTENER
       ========================================================= */

    async function setupIncomingCalls() {

        if (!state.user) return;

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
                        payload.payload;

                    showIncomingCall(
                        call
                    );
                }
            )
            .subscribe();
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


        const senderAvatar =
            safeURL(
                call.senderAvatar
            );


        modal.innerHTML = `

            <div class="incoming-call-card">

                <div class="incoming-call-ring">
                    📞
                </div>

                ${
                    senderAvatar
                        ? `
                            <img
                                class="incoming-call-avatar"
                                src="${escapeHTML(
                                    senderAvatar
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
                            : call.scope ===
                              "general"
                                ? "Incoming group call"
                                : "Incoming call"
                    }
                </span>

                <small>
                    ${
                        call.mode === "video"
                            ? "📹 Video"
                            : "🎙️ Audio"
                    }
                </small>

                <div class="incoming-call-actions">

                    <button
                        id="declineIncomingCall"
                        class="decline-call-button"
                        type="button"
                    >
                        Decline
                    </button>

                    <button
                        id="answerIncomingCall"
                        class="answer-call-button"
                        type="button"
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
                () => {

                    declineCall(
                        call
                    );

                    hide(modal);
                }
            );


        $("answerIncomingCall")
            ?.addEventListener(
                "click",
                () => {

                    hide(modal);

                    acceptCall(
                        call
                    );
                }
            );


        /*
         * Automatically remove after
         * ringing timeout.
         */
        clearTimeout(
            modal._timer
        );

        modal._timer =
            setTimeout(
                () => {

                    hide(modal);

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

            if (call.inviteId) {

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


            state.currentRoom =
                {
                    id:
                        call.roomId
                };

            state.currentInvite =
                {
                    id:
                        call.inviteId
                };

            state.currentMode =
                call.mode ||
                "audio";

            state.currentRole =
                "callee";

            state.communityId =
                call.communityId ||
                null;


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
                error
            );

            alert(
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
    }


    /* =========================================================
       CALL PAGE
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


    /* =========================================================
       CALL PAGE PARAMETERS
       ========================================================= */

    function getCallParameters() {

        const params =
            new URLSearchParams(
                window.location.search
            );

        return {

            roomId:
                params.get("room"),

            role:
                params.get("role") ||
                "callee",

            mode:
                params.get("mode") ||
                "audio",

            inviteId:
                params.get("invite") ||
                ""

        };
    }


    /* =========================================================
       LOCAL MEDIA
       ========================================================= */

    async function prepareLocalMedia(
        mode
    ) {

        const constraints = {

            audio: true,

            video:
                mode === "video"

        };


        state.localStream =
            await navigator.mediaDevices
                .getUserMedia(
                    constraints
                );


        state.microphoneEnabled =
            true;

        state.cameraEnabled =
            mode === "video";


        renderLocalStream();
    }


    function renderLocalStream() {

        const grid =
            $("callParticipantGrid");

        if (!grid) return;


        let tile =
            document.querySelector(
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


        const container =
            tile.querySelector(
                ".call-local-media"
            );


        container.innerHTML = "";


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
                state.localStream;

            container.appendChild(
                video
            );

        } else {

            container.innerHTML = `
                <div class="call-avatar-large">
                    🎙️
                </div>
            `;
        }
    }


    /* =========================================================
       ROOM JOIN
       ========================================================= */

    async function joinRoom() {

        const params =
            getCallParameters();


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


        await prepareLocalMedia(
            state.currentMode
        );


        /*
         * Mark participant as joined.
         */
        const participant =
            await state.db
                .from(
                    "chat_call_participants"
                )
                .insert({
                    room_id:
                        params.roomId,

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
                })
                .select("*")
                .maybeSingle();


        if (participant.error) {

            console.error(
                "Participant join failed:",
                participant.error
            );

            /*
             * We still continue because
             * the WebRTC room can operate
             * through broadcast.
             */
        }


        setupRoomChannel(
            params.roomId
        );


        updateCallHeader();

        await announceJoined();
    }


    /* =========================================================
       ROOM SIGNALING
       ========================================================= */

    function setupRoomChannel(
        roomId
    ) {

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
                        payload.payload
                            ?.userId;

                    if (!userId) return;

                    if (
                        String(userId) ===
                        String(
                            state.user.id
                        )
                    ) {
                        return;
                    }

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
                        payload.payload
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
                        payload.payload
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
                        payload.payload
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
                        payload.payload
                            ?.userId;

                    removePeer(
                        userId
                    );
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

                    if (
                        status ===
                        "SUBSCRIBED"
                    ) {

                        console.log(
                            "Call signaling connected."
                        );
                    }
                }
            );
    }


    async function announceJoined() {

        if (
            !state.roomChannel
        ) return;

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
       PEER CONNECTION
       ========================================================= */

    async function ensurePeerConnection(
        remoteUserId,
        shouldOffer = false
    ) {

        if (
            state.peerConnections.has(
                String(remoteUserId)
            )
        ) {

            return state.peerConnections.get(
                String(remoteUserId)
            );
        }


        const connection =
            new RTCPeerConnection({
                iceServers:
                    CONFIG.stunServers
            });


        state.peerConnections.set(
            String(remoteUserId),
            connection
        );


        if (state.localStream) {

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
                    !event.candidate
                ) return;

                await state.roomChannel.send({

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

                if (!stream) return;

                state.remoteStreams.set(
                    String(remoteUserId),
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
                    "Peer",
                    remoteUserId,
                    status
                );

                if (
                    status ===
                    "failed" ||
                    status ===
                    "closed"
                ) {

                    removePeer(
                        remoteUserId
                    );
                }
            };


        if (shouldOffer) {

            /*
             * Deterministic offer side.
             *
             * Prevents both peers from
             * endlessly creating offers.
             */
            const local =
                String(
                    state.user.id
                );

            const remote =
                String(
                    remoteUserId
                );

            if (local < remote) {

                const offer =
                    await connection
                        .createOffer();

                await connection
                    .setLocalDescription(
                        offer
                    );


                await state.roomChannel.send({

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
                            connection
                                .localDescription
                    }
                });
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

        if (
            String(payload?.to) !==
            String(state.user.id)
        ) {
            return;
        }


        const connection =
            await ensurePeerConnection(
                payload.from,
                false
            );


        await connection
            .setRemoteDescription(
                new RTCSessionDescription(
                    payload.description
                )
            );


        const answer =
            await connection
                .createAnswer();


        await connection
            .setLocalDescription(
                answer
            );


        await state.roomChannel.send({

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
                    connection
                        .localDescription
            }
        });
    }


    /* =========================================================
       ANSWER
       ========================================================= */

    async function handleAnswer(
        payload
    ) {

        if (
            String(payload?.to) !==
            String(state.user.id)
        ) {
            return;
        }


        const connection =
            state.peerConnections.get(
                String(
                    payload.from
                )
            );


        if (!connection) return;


        await connection
            .setRemoteDescription(
                new RTCSessionDescription(
                    payload.description
                )
            );
    }


    /* =========================================================
       ICE
       ========================================================= */

    async function handleCandidate(
        payload
    ) {

        if (
            String(payload?.to) !==
            String(state.user.id)
        ) {
            return;
        }


        const connection =
            await ensurePeerConnection(
                payload.from,
                false
            );


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


    /* =========================================================
       REMOTE PARTICIPANTS
       ========================================================= */

    async function renderRemoteParticipant(
        userId,
        stream
    ) {

        const grid =
            $("callParticipantGrid");

        if (!grid) return;


        let tile =
            document.querySelector(
                `[data-call-user="${CSS.escape(
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

            tile.dataset.callUser =
                userId;

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


        let video =
            media.querySelector(
                "video"
            );


        if (
            state.currentMode ===
            "video"
        ) {

            if (!video) {

                media.innerHTML = "";

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

            const audio =
                media.querySelector(
                    "audio"
                );

            if (audio) {

                audio.srcObject =
                    stream;
            }
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


        const name =
            displayName(
                result.data
            );


        const label =
            tile.querySelector(
                ".call-video-name"
            );


        if (label) {

            label.textContent =
                name;
        }
    }


    /* =========================================================
       REMOVE PEER
       ========================================================= */

    function removePeer(
        userId
    ) {

        const key =
            String(userId);

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

        const roomTitle =
            $("callRoomTitle");

        const roomSubtitle =
            $("callRoomSubtitle");

        const roomStatus =
            $("callRoomStatus");


        let title =
            "Mwaniki Scholars Call";


        if (
            state.currentRoom?.id
        ) {

            const result =
                await state.db
                    .from(
                        "chat_call_rooms"
                    )
                    .select(
                        "community_id,call_scope"
                    )
                    .eq(
                        "id",
                        state.currentRoom.id
                    )
                    .maybeSingle();


            if (
                result.data?.call_scope ===
                "community"
            ) {

                title =
                    "Community Call";

            } else if (
                result.data?.call_scope ===
                "general"
            ) {

                title =
                    "General Call";

            } else {

                title =
                    "Private Call";
            }
        }


        if (roomTitle) {

            roomTitle.textContent =
                title;
        }

        if (roomSubtitle) {

            roomSubtitle.textContent =
                state.currentMode ===
                "video"
                    ? "Video call"
                    : "Voice call";
        }

        if (roomStatus) {

            roomStatus.textContent =
                "Connected";
        }
    }


    /* =========================================================
       MICROPHONE
       ========================================================= */

    function toggleMicrophone() {

        if (!state.localStream)
            return;


        state.microphoneEnabled =
            !state.microphoneEnabled;


        state.localStream
            .getAudioTracks()
            .forEach(
                track =>
                    track.enabled =
                        state.microphoneEnabled
            );


        const button =
            $("toggleMicrophoneButton");


        if (button) {

            button.textContent =
                state.microphoneEnabled
                    ? "🎙️"
                    : "🔇";
        }
    }


    /* =========================================================
       CAMERA
       ========================================================= */

    function toggleCamera() {

        if (!state.localStream)
            return;


        state.cameraEnabled =
            !state.cameraEnabled;


        state.localStream
            .getVideoTracks()
            .forEach(
                track =>
                    track.enabled =
                        state.cameraEnabled
            );


        const button =
            $("toggleCameraButton");


        if (button) {

            button.textContent =
                state.cameraEnabled
                    ? "📹"
                    : "🚫";
        }
    }


    /* =========================================================
       SCREEN SHARE
       ========================================================= */

    async function toggleScreenShare() {

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
                        video: true
                    });


            const screenTrack =
                state.screenStream
                    .getVideoTracks()[0];


            for (
                const connection
                of state.peerConnections
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


            screenTrack.onended =
                () =>
                    stopScreenShare();

        } catch (
            error
        ) {

            console.error(
                "Screen share failed:",
                error
            );
        }
    }


    async function stopScreenShare() {

        if (
            !state.screenStream
        ) return;


        const cameraTrack =
            state.localStream
                ?.getVideoTracks()[0];


        for (
            const connection
            of state.peerConnections
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


        $("shareScreenButton")
            ?.classList.remove(
                "active"
            );
    }


    /* =========================================================
       END CALL
       ========================================================= */

    async function leaveCall() {

        if (
            state.roomChannel
        ) {

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


        await finishCall(
            true
        );
    }


    async function finishCall(
        redirect = true
    ) {

        clearTimeout(
            state.ringTimer
        );


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


        for (
            const connection
            of state.peerConnections
                .values()
        ) {

            try {
                connection.close();
            } catch {}
        }


        state.peerConnections.clear();

        state.remoteStreams.clear();


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


        if (
            state.currentRoom?.id
        ) {

            await endRoom(
                state.currentRoom.id
            );
        }


        if (redirect) {

            window.location.href =
                "./community.html";
        }
    }


    async function endRoom(
        roomId
    ) {

        if (!roomId) return;


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
    }


    /* =========================================================
       PARTICIPANT LEFT
       ========================================================= */

    async function leaveParticipant() {

        if (
            !state.currentRoom?.id ||
            !state.user
        ) return;


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


                    await endRoom(
                        roomId
                    );

                },
                CONFIG.ringTimeout
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

            alert(
                error.message ||
                "Could not join the call."
            );

            window.location.href =
                "./community.html";
        }
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
                        class="call-mode active"
                        data-call-mode="audio"
                        type="button"
                    >
                        🎙️ Audio
                    </button>

                    <button
                        class="call-mode"
                        data-call-mode="video"
                        type="button"
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


        show(picker);


        let mode =
            "audio";

        let selected =
            new Set();


        const users =
            await getOnlineUsers(
                communityId
            );


        const usersContainer =
            $("callPickerUsers");


        if (!users.length) {

            usersContainer.innerHTML = `
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

            usersContainer.innerHTML = "";


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

                        <span class="call-picker-check">
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
                                    <span class="fallback-avatar">
                                        ${escapeHTML(
                                            initials(
                                                name
                                            )
                                        )}
                                    </span>
                                `
                        }

                        <span class="call-picker-user-info">

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


                    row.onclick =
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


                            updateSelectionUI();
                        };


                    usersContainer
                        .appendChild(
                            row
                        );
                }
            );
        }


        function updateSelectionUI() {

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
                    selected.size === 0;
            }
        }


        document
            .querySelectorAll(
                "[data-call-mode]"
            )
            .forEach(
                button => {

                    button.onclick =
                        () => {

                            mode =
                                button.dataset.callMode;

                            document
                                .querySelectorAll(
                                    "[data-call-mode]"
                                )
                                .forEach(
                                    item =>
                                        item.classList
                                            .toggle(
                                                "active",
                                                item ===
                                                button
                                            )
                                );
                        };
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

                        document
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

                        document
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

                    updateSelectionUI();
                }
            );


        $("startSelectedCall")
            ?.addEventListener(
                "click",
                async () => {

                    hide(picker);

                    await startGeneralCall(
                        [
                            ...selected
                        ],
                        mode
                    );
                }
            );


        $("closeCallPicker")
            ?.addEventListener(
                "click",
                () =>
                    hide(picker)
            );
    }


    async function getCommunityName(
        id
    ) {

        const result =
            await state.db
                .from("chat_communities")
                .select("name")
                .eq("id", id)
                .maybeSingle();


        return (
            result.data?.name ||
            "Community"
        );
    }


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
       BUTTON BINDINGS
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

                    await leaveParticipant();

                    await leaveCall();
                }
            );
    }


    /* =========================================================
       PAGE START
       ========================================================= */

    async function initialize() {

        if (state.initialized)
            return;

        state.initialized =
            true;


        const db =
            await waitForSupabase();

        if (!db) return;


        const authenticated =
            await loadIdentity();


        if (!authenticated) {

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
       START
       ========================================================= */

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
