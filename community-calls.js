/* ============================================================
   MWANIKI SCHOLARS
   call.js
   SINGLE WEBRTC CALLING ENGINE

   Works with the current community.html:

   generalCallButton
   communityCallButton
   callModal
   callSpecificPersonButton
   callWholeCommunityButton

   activeCallOverlay
   activeCallTitle
   activeCallStatus
   callParticipantGrid
   toggleMicrophoneButton
   toggleCameraButton
   shareScreenButton
   leaveCallButton
   leaveCallButtonBottom

   incomingCallToast
   incomingCallerName
   incomingCallType
   acceptCallButton
   rejectCallButton

   IMPORTANT:
   - community.js does NOT contain WebRTC
   - this file is the ONLY calling engine
   - no UUID is entered by the student
   - users are selected visually by community.js
   ============================================================ */

(() => {
    "use strict";

    console.log("📞 Mwaniki Scholars call engine loading...");

    /* ============================================================
       CONFIG
       ============================================================ */

    const CONFIG = {
        iceServers: [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302"
                ]
            }
        ],

        callTimeout: 45000,

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

    /* ============================================================
       STATE
       ============================================================ */

    let db = null;
    let currentUser = null;

    let currentRoom = null;
    let currentMode = "audio";
    let currentScope = "general";

    let localStream = null;
    let screenStream = null;
    let screenTrack = null;

    let microphoneEnabled = true;
    let cameraEnabled = false;
    let screenSharing = false;

    let callTimeoutTimer = null;

    let incomingInvite = null;

    let incomingChannel = null;
    let signalChannel = null;
    let participantChannel = null;

    const peers = new Map();

    /*
     * queued ICE candidates:
     *
     * Sometimes an ICE candidate arrives before the
     * remote description has been installed.
     */
    const pendingCandidates = new Map();

    const elements = {};

    /* ============================================================
       DOM
       ============================================================ */

    function $(id) {
        return document.getElementById(id);
    }

    function cacheElements() {
        const ids = [
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
            "acceptCallButton",
            "rejectCallButton",

            "profileModalContent"
        ];

        ids.forEach(id => {
            elements[id] = $(id);
        });

        /*
         * The current HTML uses one button for accepting.
         * We keep the references simple and reliable.
         */
    }

    /* ============================================================
       SUPABASE
       ============================================================ */

    async function waitForSupabase(timeout = 15000) {
        const started = Date.now();

        while (Date.now() - started < timeout) {
            const client =
                window.supabaseClient ||
                window.mwanikiSupabase ||
                window.sb ||
                window.supabase;

            if (
                client &&
                typeof client.from === "function"
            ) {
                return client;
            }

            await sleep(100);
        }

        throw new Error(
            "Supabase client was not available."
        );
    }

    async function initializeSupabase() {
        try {
            db = await waitForSupabase();

            const {
                data,
                error
            } = await db.auth.getSession();

            if (error) {
                console.error(
                    "❌ Call authentication error:",
                    error
                );

                return false;
            }

            currentUser =
                data?.session?.user || null;

            if (!currentUser) {
                console.warn(
                    "⚠️ No signed-in user for call engine."
                );

                return false;
            }

            console.log(
                "📞 Call engine authenticated:",
                currentUser.id
            );

            return true;

        } catch (error) {
            console.error(
                "❌ Call engine Supabase initialization failed:",
                error
            );

            return false;
        }
    }

    /* ============================================================
       PROFILE HELPERS
       ============================================================ */

    async function getProfile(userId) {
        if (!userId || !db) {
            return null;
        }

        /*
         * chat_public_profiles is preferred because it is intended
         * for community-facing identity information.
         */

        try {
            const {
                data,
                error
            } = await db
                .from("chat_public_profiles")
                .select("*")
                .eq("id", userId)
                .maybeSingle();

            if (!error && data) {
                return data;
            }
        } catch (_) {}

        /*
         * Fallbacks for installations where the public profile
         * has not yet been populated.
         */

        for (
            const table of [
                "profiles",
                "user_profiles",
                "students"
            ]
        ) {
            try {
                const {
                    data,
                    error
                } = await db
                    .from(table)
                    .select("*")
                    .eq("id", userId)
                    .maybeSingle();

                if (!error && data) {
                    return data;
                }
            } catch (_) {}
        }

        return null;
    }

    function profileName(profile) {
        if (!profile) {
            return "Mwaniki Scholar";
        }

        return (
            profile.display_name ||
            profile.full_name ||
            profile.name ||
            profile.username ||
            "Mwaniki Scholar"
        );
    }

    function profileAvatar(profile) {
        if (!profile) {
            return "";
        }

        return (
            profile.avatar_url ||
            profile.photo_url ||
            profile.profile_image ||
            profile.image_url ||
            ""
        );
    }

    async function getUserIdentity(userId) {
        const profile =
            await getProfile(userId);

        return {
            id: userId,
            name: profileName(profile),
            avatar: profileAvatar(profile),
            profile
        };
    }

    /* ============================================================
       CALL MODAL
       ============================================================ */

    function openCallModal() {
        const modal =
            elements.callModal;

        if (!modal) {
            console.warn(
                "⚠️ #callModal not found."
            );

            return;
        }

        modal.classList.remove("hidden");

        modal.hidden = false;

        document.body.classList.add(
            "call-modal-open"
        );
    }

    function closeCallModal() {
        const modal =
            elements.callModal;

        if (!modal) {
            return;
        }

        modal.classList.add("hidden");

        modal.hidden = true;

        document.body.classList.remove(
            "call-modal-open"
        );
    }

    /* ============================================================
       GENERAL CALL
       ============================================================ */

    async function openGeneralCall() {
        /*
         * Community.js may use this event to display its own
         * user-selection interface.
         */

        window.dispatchEvent(
            new CustomEvent(
                "mwaniki:open-general-call-picker",
                {
                    detail: {
                        mode: "audio"
                    }
                }
            )
        );

        /*
         * If community.js does not provide a picker, show the
         * existing call choice modal as a safe fallback.
         */

        openCallModal();
    }

    /* ============================================================
       COMMUNITY CALL
       ============================================================ */

    async function openCommunityCall() {
        const communityId =
            getCurrentCommunityId();

        if (!communityId) {
            showNotice(
                "Select a community before starting a community call."
            );

            return;
        }

        closeCallModal();

        window.dispatchEvent(
            new CustomEvent(
                "mwaniki:community-call-request",
                {
                    detail: {
                        communityId,
                        mode: "audio"
                    }
                }
            )
        );

        /*
         * community.js normally handles the member selection.
         */

        window.dispatchEvent(
            new CustomEvent(
                "mwaniki:community-call",
                {
                    detail: {
                        communityId,
                        mode: "audio"
                    }
                }
            )
        );
    }

    /* ============================================================
       COMMUNITY ID
       ============================================================ */

    function getCurrentCommunityId() {
        /*
         * community.js exposes this when available.
         */

        if (
            window.MwanikiCommunity &&
            typeof
                window.MwanikiCommunity
                    .getCurrentCommunityId ===
                "function"
        ) {
            return (
                window.MwanikiCommunity
                    .getCurrentCommunityId()
            );
        }

        /*
         * Fallback to the storage value used by the community
         * engine.
         */

        return (
            localStorage.getItem(
                "mwanikiCommunityId"
            ) ||
            localStorage.getItem(
                "selectedCommunityId"
            ) ||
            null
        );
    }

    /* ============================================================
       CALL REQUEST EVENTS
       ============================================================ */

    function setupExternalCallEvents() {
        /*
         * Direct call from community.js.
         *
         * The UI selects the person.
         * The UUID is never entered manually.
         */

        window.addEventListener(
            "mwaniki:call-user",
            async event => {
                const detail =
                    event.detail || {};

                if (!detail.userId) {
                    showNotice(
                        "Please select a member to call."
                    );

                    return;
                }

                await startDirectCall(
                    detail.userId,
                    detail.mode ||
                        "audio"
                );
            }
        );

        /*
         * General call from community.js.
         */

        window.addEventListener(
            "mwaniki:start-general-call",
            async event => {
                const detail =
                    event.detail || {};

                const ids =
                    Array.isArray(
                        detail.userIds
                    )
                        ? detail.userIds
                        : [];

                await startGeneralCall(
                    ids,
                    detail.mode ||
                        "audio"
                );
            }
        );

        /*
         * Community call from community.js.
         */

        window.addEventListener(
            "mwaniki:start-community-call",
            async event => {
                const detail =
                    event.detail || {};

                const communityId =
                    detail.communityId ||
                    getCurrentCommunityId();

                const userIds =
                    Array.isArray(
                        detail.userIds
                    )
                        ? detail.userIds
                        : [];

                await startCommunityCall(
                    communityId,
                    userIds,
                    detail.mode ||
                        "audio"
                );
            }
        );

        /*
         * Backward-compatible event names.
         */

        window.addEventListener(
            "mwaniki:general-call",
            async event => {
                const detail =
                    event.detail || {};

                if (
                    Array.isArray(
                        detail.userIds
                    ) &&
                    detail.userIds.length
                ) {
                    await startGeneralCall(
                        detail.userIds,
                        detail.mode ||
                            "audio"
                    );
                }
            }
        );

        window.addEventListener(
            "mwaniki:community-call",
            async event => {
                const detail =
                    event.detail || {};

                const communityId =
                    detail.communityId ||
                    getCurrentCommunityId();

                if (!communityId) {
                    return;
                }

                if (
                    Array.isArray(
                        detail.userIds
                    ) &&
                    detail.userIds.length
                ) {
                    await startCommunityCall(
                        communityId,
                        detail.userIds,
                        detail.mode ||
                            "audio"
                    );
                }
            }
        );
    }

    /* ============================================================
       DIRECT CALL
       ============================================================ */

    async function startDirectCall(
        userId,
        mode = "audio"
    ) {
        if (!currentUser) {
            showNotice(
                "Please sign in before making a call."
            );

            return;
        }

        if (!userId) {
            showNotice(
                "Please select a member to call."
            );

            return;
        }

        if (
            String(userId) ===
            String(currentUser.id)
        ) {
            showNotice(
                "You cannot call yourself."
            );

            return;
        }

        await createCall({
            scope: "direct",
            communityId: null,
            userIds: [userId],
            mode
        });
    }

    /* ============================================================
       GENERAL CALL
       ============================================================ */

    async function startGeneralCall(
        userIds,
        mode = "audio"
    ) {
        if (!currentUser) {
            showNotice(
                "Please sign in before making a call."
            );

            return;
        }

        const recipients =
            normalizeUserIds(
                userIds
            );

        if (!recipients.length) {
            showNotice(
                "No members were selected for the call."
            );

            return;
        }

        await createCall({
            scope: "general",
            communityId: null,
            userIds: recipients,
            mode
        });
    }

    /* ============================================================
       COMMUNITY CALL
       ============================================================ */

    async function startCommunityCall(
        communityId,
        userIds,
        mode = "audio"
    ) {
        if (!currentUser) {
            showNotice(
                "Please sign in before making a call."
            );

            return;
        }

        if (!communityId) {
            showNotice(
                "No community was selected."
            );

            return;
        }

        const recipients =
            normalizeUserIds(
                userIds
            );

        if (!recipients.length) {
            /*
             * Let community.js resolve the community members if
             * it has not supplied the selection.
             */

            window.dispatchEvent(
                new CustomEvent(
                    "mwaniki:community-call-picker-needed",
                    {
                        detail: {
                            communityId,
                            mode
                        }
                    }
                )
            );

            return;
        }

        await createCall({
            scope: "community",
            communityId,
            userIds: recipients,
            mode
        });
    }

    /* ============================================================
       CREATE ROOM
       ============================================================ */

    async function createCall({
        scope,
        communityId = null,
        userIds = [],
        mode = "audio"
    }) {
        if (!db || !currentUser) {
            showNotice(
                "Call service is not ready."
            );

            return null;
        }

        const recipients =
            normalizeUserIds(
                userIds
            );

        if (!recipients.length) {
            showNotice(
                "No call recipients were selected."
            );

            return null;
        }

        if (
            recipients.some(
                id =>
                    String(id) ===
                    String(currentUser.id)
            )
        ) {
            /*
             * Remove self instead of failing the entire call.
             */

            for (
                let i = recipients.length - 1;
                i >= 0;
                i--
            ) {
                if (
                    String(
                        recipients[i]
                    ) ===
                    String(currentUser.id)
                ) {
                    recipients.splice(i, 1);
                }
            }
        }

        if (!recipients.length) {
            showNotice(
                "No other members were selected."
            );

            return null;
        }

        try {
            closeCallModal();

            const {
                data: room,
                error
            } = await db
                .from("chat_call_rooms")
                .insert({
                    community_id:
                        communityId,

                    created_by:
                        currentUser.id,

                    target_user_id:
                        scope === "direct"
                            ? recipients[0]
                            : null,

                    room_status:
                        "ringing",

                    call_scope:
                        scope,

                    max_participants:
                        Math.max(
                            2,
                            recipients.length + 1
                        )
                })
                .select("*")
                .single();

            if (error) {
                throw error;
            }

            currentRoom = room;

            currentMode = mode;

            currentScope = scope;

            /*
             * Caller joins.
             */

            await upsertParticipant(
                room.id,
                currentUser.id,
                "joined"
            );

            /*
             * Add recipients and send invitations.
             */

            for (
                const userId of recipients
            ) {
                await upsertParticipant(
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
                mode
            );

            await setupRoomRealtime(
                room.id
            );

            showCallOverlay(
                "Calling..."
            );

            updateCallStatus(
                "Calling..."
            );

            startCallTimeout();

            console.log(
                "📞 Call room created:",
                room.id
            );

            return room;

        } catch (error) {
            console.error(
                "❌ Could not create call:",
                error
            );

            stopLocalStream();

            showNotice(
                error?.message ||
                "Unable to start the call."
            );

            return null;
        }
    }

    /* ============================================================
       NORMALIZE IDS
       ============================================================ */

    function normalizeUserIds(
        ids
    ) {
        if (!Array.isArray(ids)) {
            return [];
        }

        return Array.from(
            new Set(
                ids
                    .map(id =>
                        String(
                            id || ""
                        ).trim()
                    )
                    .filter(Boolean)
            )
        );
    }

    /* ============================================================
       INVITES
       ============================================================ */

    async function createInvite(
        roomId,
        receiverId
    ) {
        try {
            const {
                error
            } = await db
                .from("chat_call_invites")
                .insert({
                    room_id: roomId,
                    sender_id:
                        currentUser.id,
                    receiver_id:
                        receiverId,
                    status: "pending"
                });

            if (error) {
                console.error(
                    "❌ Call invite failed:",
                    error
                );
            }

        } catch (error) {
            console.error(
                "❌ Call invite exception:",
                error
            );
        }
    }

    /* ============================================================
       PARTICIPANTS
       ============================================================ */

    async function upsertParticipant(
        roomId,
        userId,
        status
    ) {
        try {
            const payload = {
                room_id: roomId,
                user_id: userId,
                status
            };

            if (
                status ===
                "joined"
            ) {
                payload.joined_at =
                    new Date()
                        .toISOString();

                payload.left_at = null;
            }

            const {
                error
            } = await db
                .from(
                    "chat_call_participants"
                )
                .upsert(
                    payload,
                    {
                        onConflict:
                            "room_id,user_id"
                    }
                );

            if (error) {
                console.warn(
                    "⚠️ Participant update failed:",
                    error
                );
            }

        } catch (error) {
            console.warn(
                "⚠️ Participant update exception:",
                error
            );
        }
    }

    /* ============================================================
       LOCAL MEDIA
       ============================================================ */

    async function startLocalMedia(
        mode
    ) {
        stopLocalStream();

        const wantsVideo =
            mode === "video";

        try {
            localStream =
                await navigator
                    .mediaDevices
                    .getUserMedia({
                        audio:
                            CONFIG.audio,

                        video:
                            wantsVideo
                                ? CONFIG.video
                                : false
                    });

            microphoneEnabled = true;

            cameraEnabled =
                wantsVideo;

            attachLocalParticipant();

            updateControls();

        } catch (error) {
            console.error(
                "❌ Media permission failed:",
                error
            );

            if (
                mode === "video"
            ) {
                showNotice(
                    "Camera and microphone permission is required for a video call."
                );
            } else {
                showNotice(
                    "Microphone permission is required for an audio call."
                );
            }

            throw error;
        }
    }

    function stopLocalStream() {
        if (!localStream) {
            return;
        }

        localStream
            .getTracks()
            .forEach(track => {
                try {
                    track.stop();
                } catch (_) {}
            });

        localStream = null;
    }

    /* ============================================================
       CALL PARTICIPANT UI
       ============================================================ */

    function attachLocalParticipant() {
        const grid =
            elements.callParticipantGrid;

        if (!grid) {
            return;
        }

        let tile =
            grid.querySelector(
                '[data-call-local="true"]'
            );

        if (!tile) {
            tile =
                document.createElement(
                    "div"
                );

            tile.className =
                "call-participant-tile";

            tile.dataset.callLocal =
                "true";

            tile.innerHTML = `
                <div class="call-participant-media"></div>

                <div class="call-participant-label">
                    You
                </div>
            `;

            grid.prepend(tile);
        }

        const media =
            tile.querySelector(
                ".call-participant-media"
            );

        if (!media) {
            return;
        }

        media.innerHTML = "";

        if (
            localStream &&
            localStream.getVideoTracks().length
        ) {
            const video =
                document.createElement(
                    "video"
                );

            video.autoplay = true;
            video.muted = true;
            video.playsInline = true;

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
                        getInitials(
                            "You"
                        )
                    )}
                </div>
            `;
        }
    }

    async function attachRemoteParticipant(
        userId,
        stream
    ) {
        const grid =
            elements.callParticipantGrid;

        if (!grid) {
            return;
        }

        let tile =
            grid.querySelector(
                `[data-call-user="${cssEscape(
                    userId
                )}"]`
            );

        if (!tile) {
            tile =
                document.createElement(
                    "div"
                );

            tile.className =
                "call-participant-tile";

            tile.dataset.callUser =
                userId;

            const identity =
                await getUserIdentity(
                    userId
                );

            tile.innerHTML = `
                <div class="call-participant-media">
                    <div class="call-audio-avatar">
                        ${escapeHtml(
                            getInitials(
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

            grid.appendChild(tile);
        }

        const media =
            tile.querySelector(
                ".call-participant-media"
            );

        if (!media) {
            return;
        }

        let video =
            media.querySelector(
                "video"
            );

        if (!video) {
            video =
                document.createElement(
                    "video"
                );

            video.autoplay = true;
            video.playsInline = true;

            video.className =
                "call-participant-video";

            media.innerHTML = "";

            media.appendChild(
                video
            );
        }

        video.srcObject =
            stream;
    }

    function removeRemoteParticipant(
        userId
    ) {
        const tile =
            document.querySelector(
                `[data-call-user="${cssEscape(
                    userId
                )}"]`
            );

        if (tile) {
            tile.remove();
        }
    }

    /* ============================================================
       WEBRTC
       ============================================================ */

    function createPeer(
        remoteUserId
    ) {
        if (
            peers.has(
                remoteUserId
            )
        ) {
            return peers.get(
                remoteUserId
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
            remoteUserId,
            peer
        );

        if (localStream) {
            localStream
                .getTracks()
                .forEach(track => {
                    connection.addTrack(
                        track,
                        localStream
                    );
                });
        }

        connection.onicecandidate =
            event => {
                if (
                    !event.candidate
                ) {
                    return;
                }

                sendSignal({
                    receiverId:
                        remoteUserId,

                    signalType:
                        "ice-candidate",

                    payload: {
                        candidate:
                            event.candidate
                    }
                });
            };

        connection.ontrack =
            event => {
                const stream =
                    event.streams?.[0];

                if (!stream) {
                    return;
                }

                attachRemoteParticipant(
                    remoteUserId,
                    stream
                );
            };

        connection.onconnectionstatechange =
            () => {
                const state =
                    connection.connectionState;

                console.log(
                    `📞 Peer ${remoteUserId}: ${state}`
                );

                if (
                    state ===
                        "connected"
                ) {
                    clearCallTimeout();

                    updateCallStatus(
                        "Connected"
                    );
                }

                if (
                    state ===
                        "failed"
                ) {
                    removePeer(
                        remoteUserId
                    );
                }

                if (
                    state ===
                        "closed"
                ) {
                    removePeer(
                        remoteUserId
                    );
                }
            };

        connection.oniceconnectionstatechange =
            () => {
                if (
                    connection.iceConnectionState ===
                    "failed"
                ) {
                    console.warn(
                        "⚠️ ICE connection failed:",
                        remoteUserId
                    );
                }
            };

        return peer;
    }

    async function makeOffer(
        remoteUserId
    ) {
        const peer =
            createPeer(
                remoteUserId
            );

        const connection =
            peer.connection;

        try {
            const offer =
                await connection
                    .createOffer();

            await connection
                .setLocalDescription(
                    offer
                );

            await sendSignal({
                receiverId:
                    remoteUserId,

                signalType:
                    "offer",

                payload: {
                    offer:
                        connection
                            .localDescription
                }
            });

        } catch (error) {
            console.error(
                "❌ Offer failed:",
                error
            );
        }
    }

    async function receiveOffer(
        senderId,
        offer
    ) {
        const peer =
            createPeer(
                senderId
            );

        try {
            await peer.connection
                .setRemoteDescription(
                    new RTCSessionDescription(
                        offer
                    )
                );

            peer.remoteDescriptionSet =
                true;

            await flushPendingCandidates(
                senderId
            );

            const answer =
                await peer.connection
                    .createAnswer();

            await peer.connection
                .setLocalDescription(
                    answer
                );

            await sendSignal({
                receiverId:
                    senderId,

                signalType:
                    "answer",

                payload: {
                    answer:
                        peer.connection
                            .localDescription
                }
            });

        } catch (error) {
            console.error(
                "❌ Offer handling failed:",
                error
            );
        }
    }

    async function receiveAnswer(
        senderId,
        answer
    ) {
        const peer =
            peers.get(
                senderId
            );

        if (!peer) {
            return;
        }

        try {
            await peer.connection
                .setRemoteDescription(
                    new RTCSessionDescription(
                        answer
                    )
                );

            peer.remoteDescriptionSet =
                true;

            await flushPendingCandidates(
                senderId
            );

        } catch (error) {
            console.error(
                "❌ Answer handling failed:",
                error
            );
        }
    }

    async function receiveIceCandidate(
        senderId,
        candidate
    ) {
        const peer =
            peers.get(
                senderId
            );

        if (
            !peer ||
            !peer.remoteDescriptionSet
        ) {
            const list =
                pendingCandidates.get(
                    senderId
                ) || [];

            list.push(
                candidate
            );

            pendingCandidates.set(
                senderId,
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
                "⚠️ ICE candidate failed:",
                error
            );
        }
    }

    async function flushPendingCandidates(
        userId
    ) {
        const list =
            pendingCandidates.get(
                userId
            );

        if (!list?.length) {
            return;
        }

        const peer =
            peers.get(
                userId
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
            userId
        );
    }

    function removePeer(
        userId
    ) {
        const peer =
            peers.get(
                userId
            );

        if (peer) {
            try {
                peer.connection.close();
            } catch (_) {}
        }

        peers.delete(
            userId
        );

        pendingCandidates.delete(
            userId
        );

        removeRemoteParticipant(
            userId
        );
    }

    /* ============================================================
       SIGNALING
       ============================================================

       IMPORTANT:

       We use Supabase Realtime Broadcast for WebRTC signaling.

       This avoids depending on an unverified
       chat_call_signals table column layout.
    */

    async function setupRoomRealtime(
        roomId
    ) {
        await removeRoomRealtime();

        signalChannel =
            db.channel(
                `mwaniki-call-signal-${roomId}-${currentUser.id}`
            );

        signalChannel
            .on(
                "broadcast",
                {
                    event:
                        "signal"
                },
                async payload => {
                    const message =
                        payload.payload;

                    if (!message) {
                        return;
                    }

                    if (
                        message.senderId ===
                        currentUser.id
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

                    await handleSignal(
                        message
                    );
                }
            )
            .subscribe(
                status => {
                    console.log(
                        "📞 Call signal channel:",
                        status
                    );
                }
            );

        participantChannel =
            db.channel(
                `mwaniki-call-participants-${roomId}`
            );

        participantChannel
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
                async payload => {
                    await handleParticipantChange(
                        payload
                    );
                }
            )
            .subscribe(
                status => {
                    console.log(
                        "📞 Call participant channel:",
                        status
                    );
                }
            );
    }

    async function sendSignal({
        receiverId,
        signalType,
        payload
    }) {
        if (
            !signalChannel ||
            !currentRoom
        ) {
            return;
        }

        try {
            await signalChannel.send({
                type: "broadcast",
                event: "signal",
                payload: {
                    senderId:
                        currentUser.id,

                    receiverId,

                    roomId:
                        currentRoom.id,

                    signalType,

                    payload
                }
            });
        } catch (error) {
            console.error(
                "❌ WebRTC signal failed:",
                error
            );
        }
    }

    async function handleSignal(
        signal
    ) {
        if (
            !currentRoom ||
            String(
                signal.roomId
            ) !==
                String(
                    currentRoom.id
                )
        ) {
            return;
        }

        switch (
            signal.signalType
        ) {
            case "offer":
                await receiveOffer(
                    signal.senderId,
                    signal.payload?.offer
                );
                break;

            case "answer":
                await receiveAnswer(
                    signal.senderId,
                    signal.payload?.answer
                );
                break;

            case "ice-candidate":
                await receiveIceCandidate(
                    signal.senderId,
                    signal.payload?.candidate
                );
                break;

            case "hangup":
                removePeer(
                    signal.senderId
                );
                break;
        }
    }

    /* ============================================================
       PARTICIPANT EVENTS
       ============================================================ */

    async function handleParticipantChange(
        payload
    ) {
        const participant =
            payload.new ||
            payload.old;

        if (!participant) {
            return;
        }

        if (
            String(
                participant.user_id
            ) ===
            String(
                currentUser.id
            )
        ) {
            return;
        }

        if (
            participant.status ===
            "joined"
        ) {
            /*
             * Deterministic offerer:
             *
             * UUID comparison prevents both sides from creating
             * an offer simultaneously.
             */

            if (
                String(
                    currentUser.id
                ) <
                String(
                    participant.user_id
                )
            ) {
                await makeOffer(
                    participant.user_id
                );
            }

            clearCallTimeout();

            updateCallStatus(
                "Connected"
            );
        }

        if (
            participant.status ===
                "left" ||
            participant.status ===
                "rejected"
        ) {
            removePeer(
                participant.user_id
            );
        }
    }

    /* ============================================================
       INCOMING CALLS
       ============================================================ */

    function subscribeToIncomingCalls() {
        if (
            !db ||
            !currentUser
        ) {
            return;
        }

        if (incomingChannel) {
            try {
                db.removeChannel(
                    incomingChannel
                );
            } catch (_) {}

            incomingChannel =
                null;
        }

        incomingChannel =
            db.channel(
                `mwaniki-incoming-calls-${currentUser.id}`
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

                    /*
                     * If already inside another call, don't overwrite
                     * the active call.
                     */

                    if (currentRoom) {
                        return;
                    }

                    await displayIncomingCall(
                        invite
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

    async function displayIncomingCall(
        invite
    ) {
        incomingInvite =
            invite;

        const identity =
            await getUserIdentity(
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
                "Incoming call";
        }

        const toast =
            elements.incomingCallToast;

        if (!toast) {
            return;
        }

        toast.hidden = false;

        toast.classList.remove(
            "hidden"
        );

        toast.classList.add(
            "open"
        );
    }

    function hideIncomingCall() {
        const toast =
            elements.incomingCallToast;

        if (!toast) {
            return;
        }

        toast.classList.remove(
            "open"
        );

        toast.classList.add(
            "hidden"
        );

        toast.hidden = true;
    }

    /* ============================================================
       ACCEPT CALL
       ============================================================ */

    async function acceptIncomingCall(
        mode = "audio"
    ) {
        if (!incomingInvite) {
            return;
        }

        const invite =
            incomingInvite;

        incomingInvite =
            null;

        hideIncomingCall();

        try {
            const {
                data: room,
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
                showNotice(
                    "This call has already ended."
                );

                return;
            }

            currentRoom =
                room;

            currentMode =
                mode;

            currentScope =
                room.call_scope ||
                "general";

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

            await upsertParticipant(
                room.id,
                currentUser.id,
                "joined"
            );

            await startLocalMedia(
                mode
            );

            await setupRoomRealtime(
                room.id
            );

            showCallOverlay(
                "Connected"
            );

            updateCallStatus(
                "Connected"
            );

        } catch (error) {
            console.error(
                "❌ Unable to accept call:",
                error
            );

            showNotice(
                "Unable to join the call."
            );
        }
    }

    /* ============================================================
       REJECT CALL
       ============================================================ */

    async function rejectIncomingCall() {
        if (!incomingInvite) {
            return;
        }

        const invite =
            incomingInvite;

        incomingInvite =
            null;

        hideIncomingCall();

        try {
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
        } catch (error) {
            console.warn(
                "⚠️ Could not reject call:",
                error
            );
        }
    }

    /* ============================================================
       CALL OVERLAY
       ============================================================ */

    function showCallOverlay(
        status = "Connecting..."
    ) {
        const overlay =
            elements.activeCallOverlay;

        if (!overlay) {
            console.warn(
                "⚠️ #activeCallOverlay not found."
            );

            return;
        }

        overlay.hidden = false;

        overlay.classList.remove(
            "hidden"
        );

        overlay.classList.add(
            "open"
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

        updateCallStatus(
            status
        );
    }

    function hideCallOverlay() {
        const overlay =
            elements.activeCallOverlay;

        if (!overlay) {
            return;
        }

        overlay.classList.remove(
            "open"
        );

        overlay.classList.add(
            "hidden"
        );

        overlay.hidden = true;

        if (
            elements.callParticipantGrid
        ) {
            elements.callParticipantGrid
                .innerHTML = "";
        }
    }

    function updateCallStatus(
        status
    ) {
        if (
            elements.activeCallStatus
        ) {
            elements.activeCallStatus
                .textContent =
                status || "";
        }
    }

    /* ============================================================
       MICROPHONE
       ============================================================ */

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

    /* ============================================================
       CAMERA
       ============================================================ */

    function toggleCamera() {
        if (!localStream) {
            return;
        }

        const tracks =
            localStream
                .getVideoTracks();

        if (!tracks.length) {
            showNotice(
                "This is an audio-only call."
            );

            return;
        }

        cameraEnabled =
            !cameraEnabled;

        tracks.forEach(
            track => {
                track.enabled =
                    cameraEnabled;
            }
        );

        updateControls();
    }

    /* ============================================================
       SCREEN SHARING
       ============================================================ */

    async function toggleScreenShare() {
        if (!currentRoom) {
            return;
        }

        if (screenSharing) {
            await stopScreenShare();
            return;
        }

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices
                .getDisplayMedia
        ) {
            showNotice(
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
                const peer of peers.values()
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
                    await sender
                        .replaceTrack(
                            screenTrack
                        );
                }
            }

            screenSharing = true;

            updateControls();

            screenTrack.onended =
                async () => {
                    await stopScreenShare();
                };

        } catch (error) {
            console.warn(
                "Screen sharing cancelled:",
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
                ) || null;

        for (
            const peer of peers.values()
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
                    await sender
                        .replaceTrack(
                            cameraTrack
                        );
                } catch (_) {}
            }
        }

        if (screenTrack) {
            try {
                screenTrack.stop();
            } catch (_) {}

            screenTrack = null;
        }

        if (screenStream) {
            screenStream
                .getTracks()
                .forEach(
                    track => {
                        try {
                            track.stop();
                        } catch (_) {}
                    }
                );

            screenStream = null;
        }

        screenSharing = false;

        updateControls();
    }

    /* ============================================================
       CONTROLS UI
       ============================================================ */

    function updateControls() {
        if (
            elements.toggleMicrophoneButton
        ) {
            elements
                .toggleMicrophoneButton
                .textContent =
                microphoneEnabled
                    ? "🎙️"
                    : "🔇";

            elements
                .toggleMicrophoneButton
                .title =
                microphoneEnabled
                    ? "Mute microphone"
                    : "Unmute microphone";
        }

        if (
            elements.toggleCameraButton
        ) {
            elements
                .toggleCameraButton
                .textContent =
                cameraEnabled
                    ? "📹"
                    : "🚫";

            elements
                .toggleCameraButton
                .title =
                cameraEnabled
                    ? "Turn camera off"
                    : "Turn camera on";
        }

        if (
            elements.shareScreenButton
        ) {
            elements
                .shareScreenButton
                .textContent =
                screenSharing
                    ? "⛶"
                    : "🖥️";

            elements
                .shareScreenButton
                .title =
                screenSharing
                    ? "Stop screen sharing"
                    : "Share screen";
        }
    }

    /* ============================================================
       END CALL
       ============================================================ */

    async function endCall() {
        clearCallTimeout();

        const room =
            currentRoom;

        /*
         * Tell peers that we are leaving.
         */

        if (signalChannel) {
            for (
                const userId of peers.keys()
            ) {
                try {
                    await sendSignal({
                        receiverId:
                            userId,

                        signalType:
                            "hangup",

                        payload: {}
                    });
                } catch (_) {}
            }
        }

        if (
            room &&
            currentUser
        ) {
            try {
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
                        room.id
                    )
                    .eq(
                        "user_id",
                        currentUser.id
                    );
            } catch (error) {
                console.warn(
                    "⚠️ Could not update participant leave:",
                    error
                );
            }

            /*
             * Only the creator should end the room itself.
             */

            if (
                String(
                    room.created_by
                ) ===
                String(
                    currentUser.id
                )
            ) {
                try {
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
                        )
                        .eq(
                            "created_by",
                            currentUser.id
                        );
                } catch (_) {}
            }
        }

        for (
            const userId of peers.keys()
        ) {
            removePeer(
                userId
            );
        }

        peers.clear();

        pendingCandidates.clear();

        await stopScreenShare();

        stopLocalStream();

        await removeRoomRealtime();

        currentRoom = null;

        incomingInvite = null;

        microphoneEnabled = true;
        cameraEnabled = false;
        screenSharing = false;

        hideCallOverlay();

        updateControls();

        console.log(
            "📞 Call ended."
        );
    }

    /* ============================================================
       TIMEOUT
       ============================================================ */

    function startCallTimeout() {
        clearCallTimeout();

        callTimeoutTimer =
            setTimeout(
                async () => {
                    if (
                        currentRoom &&
                        peers.size === 0
                    ) {
                        showNotice(
                            "No one answered the call."
                        );

                        await endCall();
                    }
                },
                CONFIG.callTimeout
            );
    }

    function clearCallTimeout() {
        if (
            callTimeoutTimer
        ) {
            clearTimeout(
                callTimeoutTimer
            );

            callTimeoutTimer =
                null;
        }
    }

    /* ============================================================
       REALTIME CLEANUP
       ============================================================ */

    async function removeRoomRealtime() {
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

        if (
            participantChannel &&
            db
        ) {
            try {
                await db.removeChannel(
                    participantChannel
                );
            } catch (_) {}

            participantChannel =
                null;
        }
    }

    /* ============================================================
       EVENTS
       ============================================================ */

    function setupEvents() {
        /*
         * Header General Call button.
         */

        elements.generalCallButton
            ?.addEventListener(
                "click",
                openGeneralCall
            );

        /*
         * Community Call button.
         */

        elements.communityCallButton
            ?.addEventListener(
                "click",
                openCommunityCall
            );

        /*
         * Call modal:
         * Specific person
         */

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

        /*
         * Call modal:
         * Whole community
         */

        elements.callWholeCommunityButton
            ?.addEventListener(
                "click",
                () => {
                    closeCallModal();

                    const communityId =
                        getCurrentCommunityId();

                    if (!communityId) {
                        showNotice(
                            "Select a community first."
                        );

                        return;
                    }

                    window.dispatchEvent(
                        new CustomEvent(
                            "mwaniki:community-call-picker-needed",
                            {
                                detail: {
                                    communityId,
                                    mode: "audio"
                                }
                            }
                        )
                    );
                }
            );

        /*
         * Microphone.
         */

        elements
            .toggleMicrophoneButton
            ?.addEventListener(
                "click",
                toggleMicrophone
            );

        /*
         * Camera.
         */

        elements
            .toggleCameraButton
            ?.addEventListener(
                "click",
                toggleCamera
            );

        /*
         * Screen.
         */

        elements
            .shareScreenButton
            ?.addEventListener(
                "click",
                toggleScreenShare
            );

        /*
         * Both end-call buttons perform exactly the same action.
         */

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

        /*
         * Incoming call accept.
         */

        elements.acceptCallButton
            ?.addEventListener(
                "click",
                () =>
                    acceptIncomingCall(
                        "audio"
                    )
            );

        /*
         * Incoming call reject.
         */

        elements.rejectCallButton
            ?.addEventListener(
                "click",
                rejectIncomingCall
            );

        /*
         * Escape.
         */

        document.addEventListener(
            "keydown",
            event => {
                if (
                    event.key ===
                    "Escape"
                ) {
                    closeCallModal();
                }
            }
        );

        /*
         * Browser/tab closing.
         */

        window.addEventListener(
            "beforeunload",
            () => {
                if (localStream) {
                    localStream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );
                }

                if (screenStream) {
                    screenStream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );
                }
            }
        );
    }

    /* ============================================================
       NOTIFICATION
       ============================================================ */

    function showNotice(
        message
    ) {
        console.info(
            "📞",
            message
        );

        if (
            typeof window.showNotification ===
            "function"
        ) {
            try {
                window.showNotification(
                    message
                );

                return;
            } catch (_) {}
        }

        /*
         * Prefer the community toast if available.
         */

        const toast =
            document.getElementById(
                "toast"
            );

        if (toast) {
            toast.textContent =
                message;

            toast.classList.remove(
                "hidden"
            );

            clearTimeout(
                toast._mwanikiTimer
            );

            toast._mwanikiTimer =
                setTimeout(
                    () => {
                        toast.classList.add(
                            "hidden"
                        );
                    },
                    3500
                );

            return;
        }

        console.warn(
            message
        );
    }

    /* ============================================================
       UTILITIES
       ============================================================ */

    function sleep(
        milliseconds
    ) {
        return new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    milliseconds
                )
        );
    }

    function getInitials(
        name
    ) {
        const parts =
            String(
                name || ""
            )
                .trim()
                .split(/\s+/)
                .filter(Boolean);

        if (!parts.length) {
            return "MS";
        }

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

    function escapeHtml(
        value
    ) {
        return String(
            value ?? ""
        )
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

    function cssEscape(
        value
    ) {
        if (
            window.CSS &&
            typeof window.CSS.escape ===
                "function"
        ) {
            return window.CSS.escape(
                String(value)
            );
        }

        return String(value)
            .replace(
                /[^a-zA-Z0-9_-]/g,
                "\\$&"
            );
    }

    /* ============================================================
       PUBLIC API
       ============================================================ */

    window.MwanikiCalls = {
        openCallModal,

        closeCallModal,

        startDirectCall,

        startGeneralCall,

        startCommunityCall,

        acceptIncomingCall,

        rejectIncomingCall,

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

    /* ============================================================
       INITIALIZATION
       ============================================================ */

    async function initialize() {
        cacheElements();

        setupEvents();

        setupExternalCallEvents();

        const ready =
            await initializeSupabase();

        if (!ready) {
            return;
        }

        subscribeToIncomingCalls();

        updateControls();

        console.log(
            "✅ Mwaniki Scholars single call engine ready."
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
