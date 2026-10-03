/* ============================================================
   MWANIKI SCHOLARS
   call.js

   SINGLE REAL WEBRTC ENGINE

   community.js = community/chat
   call.js      = WebRTC only

   Supports:
   - direct calls
   - general calls
   - community calls
   - audio
   - video
   - microphone
   - camera
   - screen sharing
   - incoming calls
   - multiple peers
   - independent rooms

   Supabase Broadcast is used for WebRTC signaling.
   Every participant in a room joins the SAME room channel.
   ============================================================ */

(() => {
    "use strict";

    console.log(
        "📞 Mwaniki Scholars call engine loading..."
    );


    /* =========================================================
       CONFIG
       ========================================================= */

    const CONFIG = {
        iceServers: [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302"
                ]
            }
        ],

        ringTimeout: 45000,

        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        },

        video: {
            width: {
                ideal: 1280
            },

            height: {
                ideal: 720
            },

            frameRate: {
                ideal: 30,
                max: 30
            }
        }
    };


    /* =========================================================
       STATE
       ========================================================= */

    let db = null;
    let currentUser = null;

    let currentRoom = null;

    let currentScope =
        "general";

    let currentMode =
        "audio";

    let localStream = null;

    let screenStream = null;
    let screenTrack = null;

    let microphoneEnabled = true;
    let cameraEnabled = false;
    let screenSharing = false;

    let signalChannel = null;
    let incomingChannel = null;

    let ringTimer = null;

    let incomingInvite = null;

    const peers =
        new Map();

    const pendingCandidates =
        new Map();

    const elements = {};


    /* =========================================================
       DOM
       ========================================================= */

    const $ =
        id =>
            document.getElementById(id);


    function cacheElements() {
        [
            "generalCallButton",
            "communityCallButton",

            "callModal",
            "callSpecificPersonButton",
            "callWholeCommunityButton",

            "activeCallOverlay",
            "activeCallTitle",
            "activeCallStatus",
            "callParticipantGrid",

            "toggleMicrophoneButton",
            "toggleCameraButton",
            "shareScreenButton",

            "leaveCallButton",
            "leaveCallButtonBottom",

            "incomingCallToast",
            "incomingCallerName",
            "incomingCallType",
            "incomingCallAvatar",

            "acceptCallButton",
            "rejectCallButton"
        ].forEach(
            id => {
                elements[id] =
                    $(id);
            }
        );
    }


    /* =========================================================
       SUPABASE
       ========================================================= */

    async function waitForSupabase() {
        const started =
            Date.now();

        while (
            Date.now() -
            started <
            15000
        ) {
            const client =
                window.supabaseClient ||
                window.mwanikiSupabase ||
                window.sb ||
                window.supabase;

            if (
                client &&
                typeof client.from ===
                    "function"
            ) {
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

        return null;
    }


    async function initializeSupabase() {
        db =
            await waitForSupabase();

        if (!db) {
            console.error(
                "❌ Supabase unavailable for calls."
            );

            return false;
        }

        const {
            data,
            error
        } =
            await db.auth.getSession();

        if (error) {
            console.error(
                error
            );

            return false;
        }

        currentUser =
            data?.session?.user ||
            null;

        if (!currentUser) {
            console.warn(
                "⚠️ No authenticated user."
            );

            return false;
        }

        console.log(
            "📞 Call authenticated:",
            currentUser.id
        );

        return true;
    }


    /* =========================================================
       HELPERS
       ========================================================= */

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    }


    function initials(name) {
        const parts =
            String(
                name ||
                "Mwaniki Scholar"
            )
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
            parts[
                parts.length - 1
            ][0]
        ).toUpperCase();
    }


    function notice(message) {
        const toast =
            $("toast");

        if (!toast) {
            console.info(
                "📞",
                message
            );

            return;
        }

        toast.textContent =
            message;

        toast.classList.remove(
            "hidden"
        );

        clearTimeout(
            toast._callTimer
        );

        toast._callTimer =
            setTimeout(
                () => {
                    toast.classList.add(
                        "hidden"
                    );
                },
                3500
            );
    }


    async function getIdentity(
        userId
    ) {
        try {
            const {
                data
            } = await db
                .from(
                    "chat_public_profiles"
                )
                .select("*")
                .eq(
                    "id",
                    userId
                )
                .maybeSingle();

            if (data) {
                return {
                    name:
                        data.display_name ||
                        data.full_name ||
                        data.name ||
                        data.username ||
                        "Mwaniki Scholar",

                    avatar:
                        data.avatar_url ||
                        data.photo_url ||
                        data.profile_image ||
                        ""
                };
            }
        } catch (_) {}

        return {
            name:
                "Mwaniki Scholar",
            avatar: ""
        };
    }


    /* =========================================================
       COMMUNITY
       ========================================================= */

    function getCommunityId() {
        if (
            window.MwanikiCommunity &&
            typeof
                window.MwanikiCommunity
                    .getCurrentCommunityId ===
                "function"
        ) {
            return window
                .MwanikiCommunity
                .getCurrentCommunityId();
        }

        return (
            localStorage.getItem(
                "mwanikiCommunityId"
            ) ||
            null
        );
    }


    /* =========================================================
       MODAL
       ========================================================= */

    function openCallModal() {
        elements.callModal
            ?.classList.remove(
                "hidden"
            );
    }


    function closeCallModal() {
        elements.callModal
            ?.classList.add(
                "hidden"
            );
    }


    /* =========================================================
       ROOM CREATION
       ========================================================= */

    async function createRoom({
        scope,
        communityId,
        userIds,
        mode
    }) {
        if (
            !currentUser ||
            !db
        ) {
            notice(
                "Please sign in before making a call."
            );

            return;
        }

        const recipients =
            Array.from(
                new Set(
                    (
                        userIds ||
                        []
                    )
                        .map(
                            id =>
                                String(
                                    id
                                )
                        )
                        .filter(
                            id =>
                                id &&
                                id !==
                                    String(
                                        currentUser.id
                                    )
                        )
                )
            );

        if (!recipients.length) {
            notice(
                "Select at least one other member."
            );

            return;
        }

        try {
            closeCallModal();

            const {
                data:
                    room,
                error
            } = await db
                .from(
                    "chat_call_rooms"
                )
                .insert({
                    community_id:
                        communityId ||
                        null,

                    created_by:
                        currentUser.id,

                    target_user_id:
                        scope ===
                        "direct"
                            ? recipients[0]
                            : null,

                    room_status:
                        "ringing",

                    call_scope:
                        scope,

                    max_participants:
                        Math.max(
                            2,
                            recipients.length +
                                1
                        )
                })
                .select("*")
                .single();

            if (error) {
                throw error;
            }

            currentRoom =
                room;

            currentScope =
                scope;

            currentMode =
                mode ||
                "audio";

            await joinParticipant(
                room.id,
                currentUser.id,
                "joined"
            );

            for (
                const userId of
                recipients
            ) {
                await joinParticipant(
                    room.id,
                    userId,
                    "invited"
                );

                await createInvite(
                    room.id,
                    userId
                );
            }

            await startLocalMedia(
                currentMode
            );

            await joinSignalRoom(
                room.id
            );

            showCallOverlay(
                "Calling..."
            );

            startRingTimer();

            /*
             * Give the signaling subscription a moment
             * before offers can be generated.
             */

            setTimeout(
                async () => {
                    await announcePresence();
                },
                500
            );

            console.log(
                "📞 Room created:",
                room.id
            );

        } catch (error) {
            console.error(
                "❌ Call creation failed:",
                error
            );

            await cleanupCall(
                false
            );

            notice(
                error?.message ||
                "Unable to start call."
            );
        }
    }


    /* =========================================================
       PARTICIPANTS
       ========================================================= */

    async function joinParticipant(
        roomId,
        userId,
        status
    ) {
        /*
         * Do not rely on an upsert constraint existing.
         */

        const {
            data:
                existing
        } = await db
            .from(
                "chat_call_participants"
            )
            .select("id")
            .eq(
                "room_id",
                roomId
            )
            .eq(
                "user_id",
                userId
            )
            .maybeSingle();

        if (existing) {
            await db
                .from(
                    "chat_call_participants"
                )
                .update({
                    status,

                    joined_at:
                        status ===
                        "joined"
                            ? new Date()
                                .toISOString()
                            : undefined,

                    left_at:
                        status ===
                        "joined"
                            ? null
                            : undefined
                })
                .eq(
                    "id",
                    existing.id
                );

            return;
        }

        await db
            .from(
                "chat_call_participants"
            )
            .insert({
                room_id:
                    roomId,

                user_id:
                    userId,

                status,

                joined_at:
                    status ===
                    "joined"
                        ? new Date()
                            .toISOString()
                        : null
            });
    }


    async function leaveParticipant() {
        if (
            !currentRoom ||
            !currentUser
        ) {
            return;
        }

        await db
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
                currentRoom.id
            )
            .eq(
                "user_id",
                currentUser.id
            );
    }


    /* =========================================================
       INVITES
       ========================================================= */

    async function createInvite(
        roomId,
        receiverId
    ) {
        const {
            error
        } = await db
            .from(
                "chat_call_invites"
            )
            .insert({
                room_id:
                    roomId,

                sender_id:
                    currentUser.id,

                receiver_id:
                    receiverId,

                status:
                    "pending"
            });

        if (error) {
            console.warn(
                "Invite error:",
                error
            );
        }
    }


    /* =========================================================
       INCOMING CALLS
       ========================================================= */

    async function subscribeIncoming() {
        if (
            incomingChannel
        ) {
            await db.removeChannel(
                incomingChannel
            );
        }

        incomingChannel =
            db.channel(
                `mwaniki-incoming-${currentUser.id}`
            );

        incomingChannel
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table:
                        "chat_call_invites",
                    filter:
                        `receiver_id=eq.${currentUser.id}`
                },
                async payload => {
                    const invite =
                        payload.new;

                    if (
                        invite.status !==
                        "pending"
                    ) {
                        return;
                    }

                    if (
                        currentRoom
                    ) {
                        return;
                    }

                    await showIncoming(
                        invite
                    );
                }
            )
            .subscribe(
                status => {
                    console.log(
                        "📞 Incoming calls:",
                        status
                    );
                }
            );
    }


    async function showIncoming(
        invite
    ) {
        incomingInvite =
            invite;

        const identity =
            await getIdentity(
                invite.sender_id
            );

        if (
            elements.incomingCallerName
        ) {
            elements.incomingCallerName
                .textContent =
                identity.name;
        }

        if (
            elements.incomingCallType
        ) {
            elements.incomingCallType
                .textContent =
                "Incoming voice call";
        }

        if (
            elements.incomingCallAvatar
        ) {
            elements.incomingCallAvatar
                .innerHTML =
                identity.avatar
                    ? `
                        <img
                            src="${escapeHtml(
                                identity.avatar
                            )}"
                            alt=""
                            style="
                                width:100%;
                                height:100%;
                                object-fit:cover;
                                border-radius:50%;
                            "
                        >
                    `
                    : escapeHtml(
                        initials(
                            identity.name
                        )
                    );
        }

        elements.incomingCallToast
            ?.classList.remove(
                "hidden"
            );
    }


    function hideIncoming() {
        elements.incomingCallToast
            ?.classList.add(
                "hidden"
            );

        incomingInvite =
            null;
    }


    async function acceptIncoming() {
        const invite =
            incomingInvite;

        if (!invite) return;

        hideIncoming();

        try {
            const {
                data:
                    room,
                error
            } = await db
                .from(
                    "chat_call_rooms"
                )
                .select("*")
                .eq(
                    "id",
                    invite.room_id
                )
                .single();

            if (error) {
                throw error;
            }

            if (
                room.room_status ===
                "ended"
            ) {
                notice(
                    "This call has already ended."
                );

                return;
            }

            currentRoom =
                room;

            currentScope =
                room.call_scope ||
                "general";

            currentMode =
                "audio";

            await db
                .from(
                    "chat_call_invites"
                )
                .update({
                    status:
                        "accepted",

                    responded_at:
                        new Date()
                            .toISOString()
                })
                .eq(
                    "id",
                    invite.id
                );

            await joinParticipant(
                room.id,
                currentUser.id,
                "joined"
            );

            await startLocalMedia(
                "audio"
            );

            await joinSignalRoom(
                room.id
            );

            showCallOverlay(
                "Connected"
            );

            await announcePresence();

        } catch (error) {
            console.error(
                error
            );

            notice(
                "Unable to join the call."
            );
        }
    }


    async function rejectIncoming() {
        const invite =
            incomingInvite;

        if (!invite) return;

        hideIncoming();

        await db
            .from(
                "chat_call_invites"
            )
            .update({
                status:
                    "rejected",

                responded_at:
                    new Date()
                        .toISOString()
            })
            .eq(
                "id",
                invite.id
            );
    }


    /* =========================================================
       LOCAL MEDIA
       ========================================================= */

    async function startLocalMedia(
        mode
    ) {
        stopLocalMedia();

        const video =
            mode === "video";

        try {
            localStream =
                await navigator
                    .mediaDevices
                    .getUserMedia({
                        audio:
                            CONFIG.audio,

                        video:
                            video
                                ? CONFIG.video
                                : false
                    });

            microphoneEnabled =
                true;

            cameraEnabled =
                video;

            renderLocalTile();

            updateControls();

        } catch (error) {
            console.error(
                "Media permission error:",
                error
            );

            throw new Error(
                video
                    ? "Camera and microphone permission was denied."
                    : "Microphone permission was denied."
            );
        }
    }


    function stopLocalMedia() {
        if (!localStream) {
            return;
        }

        localStream
            .getTracks()
            .forEach(
                track => {
                    try {
                        track.stop();
                    } catch (_) {}
                }
            );

        localStream =
            null;
    }


    /* =========================================================
       CALL UI
       ========================================================= */

    function showCallOverlay(
        status
    ) {
        const overlay =
            elements.activeCallOverlay;

        if (!overlay) return;

        overlay.classList.remove(
            "hidden"
        );

        if (
            elements.activeCallTitle
        ) {
            elements.activeCallTitle
                .textContent =
                currentScope ===
                    "community"
                    ? "Community Call"
                    : currentScope ===
                        "direct"
                    ? "Private Call"
                    : "General Call";
        }

        updateStatus(
            status
        );
    }


    function hideCallOverlay() {
        elements.activeCallOverlay
            ?.classList.add(
                "hidden"
            );

        if (
            elements.callParticipantGrid
        ) {
            elements.callParticipantGrid
                .innerHTML = "";
        }
    }


    function updateStatus(
        text
    ) {
        if (
            elements.activeCallStatus
        ) {
            elements.activeCallStatus
                .textContent =
                text;
        }
    }


    function renderLocalTile() {
        const grid =
            elements.callParticipantGrid;

        if (!grid) return;

        let tile =
            grid.querySelector(
                '[data-local-call-tile="true"]'
            );

        if (!tile) {
            tile =
                document.createElement(
                    "div"
                );

            tile.className =
                "call-participant-tile";

            tile.dataset.localCallTile =
                "true";

            tile.innerHTML = `
                <div class="call-participant-media"></div>

                <div class="call-participant-label">
                    You
                </div>
            `;

            grid.prepend(
                tile
            );
        }

        const media =
            tile.querySelector(
                ".call-participant-media"
            );

        media.innerHTML = "";

        if (
            localStream &&
            localStream.getVideoTracks()
                .length
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
                localStream;

            video.className =
                "call-participant-video";

            media.appendChild(
                video
            );

        } else {
            media.innerHTML = `
                <div class="call-audio-avatar">
                    ${escapeHtml(
                        initials(
                            "You"
                        )
                    )}
                </div>
            `;
        }
    }


    async function renderRemoteTile(
        userId,
        stream
    ) {
        const grid =
            elements.callParticipantGrid;

        if (!grid) return;

        let tile =
            grid.querySelector(
                `[data-remote-user="${CSS.escape(
                    String(
                        userId
                    )
                )}"]`
            );

        if (!tile) {
            const identity =
                await getIdentity(
                    userId
                );

            tile =
                document.createElement(
                    "div"
                );

            tile.className =
                "call-participant-tile";

            tile.dataset.remoteUser =
                userId;

            tile.innerHTML = `
                <div class="call-participant-media">
                    <div class="call-audio-avatar">
                        ${escapeHtml(
                            initials(
                                identity.name
                            )
                        )}
                    </div>
                </div>

                <div class="call-participant-label">
                    ${escapeHtml(
                        identity.name
                    )}
                </div>
            `;

            grid.appendChild(
                tile
            );
        }

        const media =
            tile.querySelector(
                ".call-participant-media"
            );

        let video =
            media.querySelector(
                "video"
            );

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

            video.className =
                "call-participant-video";

            media.appendChild(
                video
            );
        }

        video.srcObject =
            stream;
    }


    function removeRemoteTile(
        userId
    ) {
        const tile =
            document.querySelector(
                `[data-remote-user="${CSS.escape(
                    String(
                        userId
                    )
                )}"]`
            );

        tile?.remove();
    }


    /* =========================================================
       WEBRTC PEER
       ========================================================= */

    function getPeer(
        userId
    ) {
        if (
            peers.has(
                String(userId)
            )
        ) {
            return peers.get(
                String(userId)
            );
        }

        const connection =
            new RTCPeerConnection({
                iceServers:
                    CONFIG.iceServers
            });

        const peer = {
            connection,
            remoteDescriptionSet:
                false
        };

        peers.set(
            String(userId),
            peer
        );

        if (localStream) {
            localStream
                .getTracks()
                .forEach(
                    track => {
                        connection.addTrack(
                            track,
                            localStream
                        );
                    }
                );
        }

        connection.onicecandidate =
            event => {
                if (
                    !event.candidate
                ) {
                    return;
                }

                sendSignal(
                    userId,
                    "ice",
                    {
                        candidate:
                            event.candidate
                    }
                );
            };

        connection.ontrack =
            event => {
                const stream =
                    event.streams?.[0];

                if (stream) {
                    renderRemoteTile(
                        userId,
                        stream
                    );
                }
            };

        connection.onconnectionstatechange =
            () => {
                const status =
                    connection.connectionState;

                console.log(
                    `📞 ${userId}: ${status}`
                );

                if (
                    status ===
                    "connected"
                ) {
                    clearRingTimer();

                    updateStatus(
                        "Connected"
                    );
                }

                if (
                    status ===
                        "failed" ||
                    status ===
                        "closed"
                ) {
                    removePeer(
                        userId
                    );
                }
            };

        return peer;
    }


    async function createOffer(
        userId
    ) {
        const peer =
            getPeer(
                userId
            );

        if (
            peer.connection.signalingState !==
            "stable"
        ) {
            return;
        }

        const offer =
            await peer.connection
                .createOffer();

        await peer.connection
            .setLocalDescription(
                offer
            );

        await sendSignal(
            userId,
            "offer",
            {
                offer:
                    peer.connection
                        .localDescription
            }
        );
    }


    async function handleOffer(
        senderId,
        offer
    ) {
        const peer =
            getPeer(
                senderId
            );

        await peer.connection
            .setRemoteDescription(
                new RTCSessionDescription(
                    offer
                )
            );

        peer.remoteDescriptionSet =
            true;

        await flushCandidates(
            senderId
        );

        const answer =
            await peer.connection
                .createAnswer();

        await peer.connection
            .setLocalDescription(
                answer
            );

        await sendSignal(
            senderId,
            "answer",
            {
                answer:
                    peer.connection
                        .localDescription
            }
        );
    }


    async function handleAnswer(
        senderId,
        answer
    ) {
        const peer =
            peers.get(
                String(
                    senderId
                )
            );

        if (!peer) {
            return;
        }

        await peer.connection
            .setRemoteDescription(
                new RTCSessionDescription(
                    answer
                )
            );

        peer.remoteDescriptionSet =
            true;

        await flushCandidates(
            senderId
        );
    }


    async function handleIce(
        senderId,
        candidate
    ) {
        const peer =
            peers.get(
                String(
                    senderId
                )
            );

        if (
            !peer ||
            !peer.remoteDescriptionSet
        ) {
            const list =
                pendingCandidates.get(
                    String(
                        senderId
                    )
                ) || [];

            list.push(
                candidate
            );

            pendingCandidates.set(
                String(
                    senderId
                ),
                list
            );

            return;
        }

        try {
            await peer.connection
                .addIceCandidate(
                    new RTCIceCandidate(
                        candidate
                    )
                );
        } catch (error) {
            console.warn(
                "ICE error:",
                error
            );
        }
    }


    async function flushCandidates(
        userId
    ) {
        const key =
            String(
                userId
            );

        const list =
            pendingCandidates.get(
                key
            );

        if (!list?.length) {
            return;
        }

        const peer =
            peers.get(
                key
            );

        if (!peer) {
            return;
        }

        for (
            const candidate of list
        ) {
            try {
                await peer.connection
                    .addIceCandidate(
                        new RTCIceCandidate(
                            candidate
                        )
                    );
            } catch (_) {}
        }

        pendingCandidates.delete(
            key
        );
    }


    function removePeer(
        userId
    ) {
        const key =
            String(
                userId
            );

        const peer =
            peers.get(
                key
            );

        if (peer) {
            try {
                peer.connection.close();
            } catch (_) {}
        }

        peers.delete(
            key
        );

        pendingCandidates.delete(
            key
        );

        removeRemoteTile(
            key
        );
    }


    /* =========================================================
       SIGNALING
       ========================================================= */

    async function joinSignalRoom(
        roomId
    ) {
        if (
            signalChannel
        ) {
            await db.removeChannel(
                signalChannel
            );
        }

        /*
         * CRITICAL:
         *
         * Do NOT put user ID in the channel name.
         *
         * Every participant must join exactly:
         *
         * mwaniki-call-room-{roomId}
         */

        signalChannel =
            db.channel(
                `mwaniki-call-room-${roomId}`
            );

        signalChannel
            .on(
                "broadcast",
                {
                    event:
                        "webrtc"
                },
                async event => {
                    const message =
                        event.payload;

                    if (!message) {
                        return;
                    }

                    if (
                        String(
                            message.senderId
                        ) ===
                        String(
                            currentUser.id
                        )
                    ) {
                        return;
                    }

                    if (
                        message.receiverId &&
                        String(
                            message.receiverId
                        ) !==
                        String(
                            currentUser.id
                        )
                    ) {
                        return;
                    }

                    if (
                        String(
                            message.roomId
                        ) !==
                        String(
                            currentRoom?.id
                        )
                    ) {
                        return;
                    }

                    try {
                        switch (
                            message.type
                        ) {
                            case "presence":
                                await handlePresence(
                                    message.senderId
                                );
                                break;

                            case "offer":
                                await handleOffer(
                                    message.senderId,
                                    message.data
                                        ?.offer
                                );
                                break;

                            case "answer":
                                await handleAnswer(
                                    message.senderId,
                                    message.data
                                        ?.answer
                                );
                                break;

                            case "ice":
                                await handleIce(
                                    message.senderId,
                                    message.data
                                        ?.candidate
                                );
                                break;

                            case "hangup":
                                removePeer(
                                    message.senderId
                                );
                                break;
                        }
                    } catch (error) {
                        console.error(
                            "Signal handling error:",
                            error
                        );
                    }
                }
            )
            .subscribe(
                status => {
                    console.log(
                        "📞 WebRTC signaling:",
                        status
                    );
                }
            );

        /*
         * Wait until the channel is subscribed.
         */

        await waitForChannelSubscribed();
    }


    function waitForChannelSubscribed() {
        return new Promise(
            resolve => {
                let done = false;

                const timer =
                    setTimeout(
                        () => {
                            if (!done) {
                                done = true;
                                resolve();
                            }
                        },
                        5000
                    );

                if (
                    signalChannel
                ) {
                    signalChannel.on(
                        "system",
                        {},
                        payload => {
                            if (
                                payload?.status ===
                                "ok" &&
                                !done
                            ) {
                                done = true;

                                clearTimeout(
                                    timer
                                );

                                resolve();
                            }
                        }
                    );
                } else {
                    clearTimeout(
                        timer
                    );

                    resolve();
                }
            }
        );
    }


    async function sendSignal(
        receiverId,
        type,
        data
    ) {
        if (
            !signalChannel ||
            !currentRoom
        ) {
            return;
        }

        await signalChannel.send({
            type:
                "broadcast",

            event:
                "webrtc",

            payload: {
                roomId:
                    currentRoom.id,

                senderId:
                    currentUser.id,

                receiverId:
                    receiverId ||
                    null,

                type,

                data:
                    data || {}
            }
        });
    }


    async function announcePresence() {
        if (
            !currentRoom ||
            !signalChannel
        ) {
            return;
        }

        await sendSignal(
            null,
            "presence",
            {}
        );
    }


    async function handlePresence(
        remoteUserId
    ) {
        /*
         * Deterministic offerer:
         *
         * Smaller UUID creates the offer.
         * This prevents both sides from creating
         * competing offers.
         */

        if (
            String(
                currentUser.id
            ) <
            String(
                remoteUserId
            )
        ) {
            await createOffer(
                remoteUserId
            );
        }
    }


    /* =========================================================
       MICROPHONE
       ========================================================= */

    function toggleMicrophone() {
        if (!localStream) {
            return;
        }

        const tracks =
            localStream
                .getAudioTracks();

        if (!tracks.length) {
            return;
        }

        microphoneEnabled =
            !microphoneEnabled;

        tracks.forEach(
            track => {
                track.enabled =
                    microphoneEnabled;
            }
        );

        updateControls();
    }


    /* =========================================================
       CAMERA
       ========================================================= */

    async function toggleCamera() {
        if (!currentRoom) {
            return;
        }

        if (!localStream) {
            return;
        }

        let videoTracks =
            localStream
                .getVideoTracks();

        if (!videoTracks.length) {
            try {
                const stream =
                    await navigator
                        .mediaDevices
                        .getUserMedia({
                            audio: false,
                            video:
                                CONFIG.video
                        });

                const track =
                    stream.getVideoTracks()[0];

                if (!track) {
                    return;
                }

                localStream.addTrack(
                    track
                );

                cameraEnabled =
                    true;

                for (
                    const peer of
                    peers.values()
                ) {
                    const sender =
                        peer.connection
                            .getSenders()
                            .find(
                                item =>
                                    item.track &&
                                    item.track.kind ===
                                        "video"
                            );

                    if (sender) {
                        await sender.replaceTrack(
                            track
                        );
                    } else {
                        peer.connection.addTrack(
                            track,
                            localStream
                        );
                    }
                }

                renderLocalTile();

                updateControls();

                return;

            } catch (error) {
                notice(
                    "Camera permission was denied."
                );

                return;
            }
        }

        cameraEnabled =
            !cameraEnabled;

        videoTracks.forEach(
            track => {
                track.enabled =
                    cameraEnabled;
            }
        );

        updateControls();
    }


    /* =========================================================
       SCREEN SHARE
       ========================================================= */

    async function toggleScreenShare() {
        if (!currentRoom) {
            return;
        }

        if (
            screenSharing
        ) {
            await stopScreenShare();

            return;
        }

        if (
            !navigator
                .mediaDevices
                ?.getDisplayMedia
        ) {
            notice(
                "Screen sharing is not supported by this browser."
            );

            return;
        }

        try {
            screenStream =
                await navigator
                    .mediaDevices
                    .getDisplayMedia({
                        video: true,
                        audio: false
                    });

            screenTrack =
                screenStream
                    .getVideoTracks()[0];

            if (!screenTrack) {
                return;
            }

            for (
                const peer of
                peers.values()
            ) {
                const sender =
                    peer.connection
                        .getSenders()
                        .find(
                            item =>
                                item.track &&
                                item.track.kind ===
                                    "video"
                        );

                if (sender) {
                    await sender.replaceTrack(
                        screenTrack
                    );
                } else {
                    peer.connection.addTrack(
                        screenTrack,
                        screenStream
                    );
                }
            }

            screenSharing =
                true;

            updateControls();

            screenTrack.onended =
                () => {
                    stopScreenShare();
                };

        } catch (error) {
            console.warn(
                "Screen share cancelled:",
                error
            );
        }
    }


    async function stopScreenShare() {
        if (!screenSharing) {
            return;
        }

        const cameraTrack =
            localStream
                ?.getVideoTracks()
                ?.find(
                    track =>
                        track.kind ===
                        "video"
                ) ||
            null;

        for (
            const peer of
            peers.values()
        ) {
            const sender =
                peer.connection
                    .getSenders()
                    .find(
                        item =>
                            item.track &&
                            item.track.kind ===
                                "video"
                    );

            if (sender) {
                try {
                    await sender.replaceTrack(
                        cameraTrack
                    );
                } catch (_) {}
            }
        }

        screenStream
            ?.getTracks()
            .forEach(
                track => {
                    try {
                        track.stop();
                    } catch (_) {}
                }
            );

        screenStream =
            null;

        screenTrack =
            null;

        screenSharing =
            false;

        updateControls();
    }


    /* =========================================================
       CONTROLS
       ========================================================= */

    function updateControls() {
        const mic =
            elements.toggleMicrophoneButton;

        const camera =
            elements.toggleCameraButton;

        const screen =
            elements.shareScreenButton;

        if (mic) {
            mic.textContent =
                microphoneEnabled
                    ? "🎙️"
                    : "🔇";

            mic.title =
                microphoneEnabled
                    ? "Mute microphone"
                    : "Unmute microphone";
        }

        if (camera) {
            camera.textContent =
                cameraEnabled
                    ? "📹"
                    : "🚫";

            camera.title =
                cameraEnabled
                    ? "Turn camera off"
                    : "Turn camera on";
        }

        if (screen) {
            screen.textContent =
                screenSharing
                    ? "⛶"
                    : "🖥️";

            screen.title =
                screenSharing
                    ? "Stop screen sharing"
                    : "Share screen";
        }
    }


    /* =========================================================
       TIMER
       ========================================================= */

    function startRingTimer() {
        clearRingTimer();

        ringTimer =
            setTimeout(
                async () => {
                    if (
                        currentRoom &&
                        peers.size ===
                            0
                    ) {
                        notice(
                            "No one answered the call."
                        );

                        await endCall();
                    }
                },
                CONFIG.ringTimeout
            );
    }


    function clearRingTimer() {
        if (ringTimer) {
            clearTimeout(
                ringTimer
            );

            ringTimer =
                null;
        }
    }


    /* =========================================================
       END CALL
       ========================================================= */

    async function endCall() {
        if (!currentRoom) {
            hideCallOverlay();

            return;
        }

        clearRingTimer();

        const room =
            currentRoom;

        /*
         * Notify peers.
         */

        for (
            const userId of
            peers.keys()
        ) {
            try {
                await sendSignal(
                    userId,
                    "hangup",
                    {}
                );
            } catch (_) {}
        }

        await leaveParticipant();

        /*
         * Creator ends room.
         */

        if (
            String(
                room.created_by
            ) ===
            String(
                currentUser.id
            )
        ) {
            await db
                .from(
                    "chat_call_rooms"
                )
                .update({
                    room_status:
                        "ended"
                })
                .eq(
                    "id",
                    room.id
                );
        }

        await cleanupCall(
            true
        );

        notice(
            "Call ended."
        );
    }


    async function cleanupCall(
        hide = true
    ) {
        clearRingTimer();

        for (
            const userId of
            peers.keys()
        ) {
            removePeer(
                userId
            );
        }

        peers.clear();

        pendingCandidates.clear();

        await stopScreenShare();

        stopLocalMedia();

        if (
            signalChannel &&
            db
        ) {
            try {
                await db.removeChannel(
                    signalChannel
                );
            } catch (_) {}

            signalChannel =
                null;
        }

        currentRoom =
            null;

        currentScope =
            "general";

        currentMode =
            "audio";

        microphoneEnabled =
            true;

        cameraEnabled =
            false;

        screenSharing =
            false;

        if (hide) {
            hideCallOverlay();
        }

        updateControls();
    }


    /* =========================================================
       EVENTS
       ========================================================= */

    function setupEvents() {

        elements.generalCallButton
            ?.addEventListener(
                "click",
                () => {
                    window.dispatchEvent(
                        new CustomEvent(
                            "mwaniki:open-general-call-picker"
                        )
                    );
                }
            );


        elements.communityCallButton
            ?.addEventListener(
                "click",
                () => {
                    const communityId =
                        getCommunityId();

                    window.dispatchEvent(
                        new CustomEvent(
                            "mwaniki:community-call-picker-needed",
                            {
                                detail: {
                                    communityId
                                }
                            }
                        )
                    );
                }
            );


        elements.callSpecificPersonButton
            ?.addEventListener(
                "click",
                () => {
                    closeCallModal();

                    window.dispatchEvent(
                        new CustomEvent(
                            "mwaniki:call-person-picker"
                        )
                    );
                }
            );


        elements.callWholeCommunityButton
            ?.addEventListener(
                "click",
                () => {
                    closeCallModal();

                    window.dispatchEvent(
                        new CustomEvent(
                            "mwaniki:community-call-picker-needed",
                            {
                                detail: {
                                    communityId:
                                        getCommunityId()
                                }
                            }
                        )
                    );
                }
            );


        elements.toggleMicrophoneButton
            ?.addEventListener(
                "click",
                toggleMicrophone
            );


        elements.toggleCameraButton
            ?.addEventListener(
                "click",
                toggleCamera
            );


        elements.shareScreenButton
            ?.addEventListener(
                "click",
                toggleScreenShare
            );


        elements.leaveCallButton
            ?.addEventListener(
                "click",
                endCall
            );


        elements.leaveCallButtonBottom
            ?.addEventListener(
                "click",
                endCall
            );


        elements.acceptCallButton
            ?.addEventListener(
                "click",
                acceptIncoming
            );


        elements.rejectCallButton
            ?.addEventListener(
                "click",
                rejectIncoming
            );


        window.addEventListener(
            "mwaniki:call-user",
            event => {
                const detail =
                    event.detail ||
                    {};

                if (
                    detail.userId
                ) {
                    createRoom({
                        scope:
                            "direct",

                        communityId:
                            null,

                        userIds: [
                            detail.userId
                        ],

                        mode:
                            detail.mode ||
                            "audio"
                    });
                }
            }
        );


        window.addEventListener(
            "mwaniki:start-general-call",
            event => {
                const detail =
                    event.detail ||
                    {};

                createRoom({
                    scope:
                        "general",

                    communityId:
                        null,

                    userIds:
                        detail.userIds ||
                        [],

                    mode:
                        detail.mode ||
                        "audio"
                });
            }
        );


        window.addEventListener(
            "mwaniki:start-community-call",
            event => {
                const detail =
                    event.detail ||
                    {};

                createRoom({
                    scope:
                        "community",

                    communityId:
                        detail.communityId ||
                        getCommunityId(),

                    userIds:
                        detail.userIds ||
                        [],

                    mode:
                        detail.mode ||
                        "audio"
                });
            }
        );


        window.addEventListener(
            "beforeunload",
            () => {
                stopScreenShare();
                stopLocalMedia();
            }
        );
    }


    /* =========================================================
       PUBLIC API
       ========================================================= */

    window.MwanikiCalls = {

        openCallModal,

        closeCallModal,

        startDirectCall(
            userId,
            mode = "audio"
        ) {
            return createRoom({
                scope:
                    "direct",

                communityId:
                    null,

                userIds: [
                    userId
                ],

                mode
            });
        },

        startGeneralCall(
            userIds,
            mode = "audio"
        ) {
            return createRoom({
                scope:
                    "general",

                communityId:
                    null,

                userIds,

                mode
            });
        },

        startCommunityCall(
            communityId,
            userIds,
            mode = "audio"
        ) {
            return createRoom({
                scope:
                    "community",

                communityId,

                userIds,

                mode
            });
        },

        acceptIncomingCall:
            acceptIncoming,

        rejectIncomingCall:
            rejectIncoming,

        endCall,

        toggleMicrophone,

        toggleCamera,

        toggleScreenShare,

        getCurrentRoom() {
            return currentRoom;
        },

        isInCall() {
            return Boolean(
                currentRoom
            );
        }
    };


    /* =========================================================
       INIT
       ========================================================= */

    async function initialize() {
        cacheElements();

        setupEvents();

        const ready =
            await initializeSupabase();

        if (!ready) {
            return;
        }

        await subscribeIncoming();

        updateControls();

        console.log(
            "✅ Mwaniki Scholars single WebRTC engine ready."
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
                once: true
            }
        );
    } else {
        initialize();
    }

})();
