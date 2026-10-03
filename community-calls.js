/* ============================================================
   MWANIKI SCHOLARS
   call.js
   SINGLE CALLING ENGINE
   ============================================================ */

(() => {
    "use strict";

    console.log("📞 Mwaniki Scholars call engine loading...");

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

        audioConstraints: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        },

        videoConstraints: {
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

    let supabase = null;
    let currentUser = null;

    let currentRoom = null;
    let currentCallMode = "audio";

    let localStream = null;

    const peers = new Map();

    let signalChannel = null;
    let participantChannel = null;

    let callTimer = null;

    let incomingCall = null;

    let microphoneEnabled = true;
    let cameraEnabled = false;
    let screenSharing = false;

    let currentScreenTrack = null;

    const elements = {};

    /* ========================================================
       ELEMENT HELPERS
       ======================================================== */

    function $(id) {
        return document.getElementById(id);
    }

    function cacheElements() {
        const ids = [
            "generalCallButton",
            "generalCallModal",
            "generalCallUserList",
            "generalCallUserInput",
            "generalCallEveryoneButton",
            "generalCallStartButton",
            "generalCallCancelButton",
            "generalCallCloseButton",
            "generalCallAudioButton",
            "generalCallVideoButton",

            "callOverlay",
            "callTitle",
            "callStatus",
            "callParticipants",
            "callLocalVideo",
            "callRemoteVideos",
            "callMuteButton",
            "callCameraButton",
            "callScreenButton",
            "callEndButton",

            "incomingCallToast",
            "incomingCallName",
            "incomingCallAvatar",
            "incomingCallAudioButton",
            "incomingCallVideoButton",
            "incomingCallAcceptButton",
            "incomingCallRejectButton"
        ];

        ids.forEach(id => {
            elements[id] = $(id);
        });
    }

    /* ========================================================
       SUPABASE
       ======================================================== */

    async function waitForSupabase(timeout = 10000) {
        const started = Date.now();

        while (!window.supabase) {
            if (Date.now() - started > timeout) {
                throw new Error(
                    "Supabase client was not available after 10 seconds."
                );
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return window.supabase;
    }

    async function initializeSupabase() {
        supabase = await waitForSupabase();

        const {
            data,
            error
        } = await supabase.auth.getSession();

        if (error) {
            console.error(
                "❌ Unable to retrieve authentication session:",
                error
            );
            return false;
        }

        if (!data?.session?.user) {
            console.warn("⚠️ No authenticated user for call engine.");
            return false;
        }

        currentUser = data.session.user;

        console.log(
            "📞 Call engine authenticated:",
            currentUser.id
        );

        return true;
    }

    /* ========================================================
       PROFILE
       ======================================================== */

    async function getProfile(userId) {
        if (!userId) return null;

        const tables = [
            "chat_public_profiles",
            "profiles",
            "user_profiles"
        ];

        for (const table of tables) {
            try {
                const {
                    data,
                    error
                } = await supabase
                    .from(table)
                    .select("*")
                    .eq("id", userId)
                    .maybeSingle();

                if (!error && data) {
                    return data;
                }
            } catch (_) {
                // Continue to next profile source.
            }
        }

        return null;
    }

    function getProfileName(profile, fallback = "Mwaniki Scholar") {
        if (!profile) return fallback;

        return (
            profile.display_name ||
            profile.full_name ||
            profile.name ||
            profile.username ||
            fallback
        );
    }

    function getProfileAvatar(profile) {
        if (!profile) return "";

        return (
            profile.avatar_url ||
            profile.photo_url ||
            profile.profile_image ||
            profile.image_url ||
            ""
        );
    }

    /* ========================================================
       ONLINE / MEMBER PICKER
       ======================================================== */

    async function getOnlineUsers() {
        if (!supabase || !currentUser) {
            return [];
        }

        /*
         * First use chat_presence because it is the canonical
         * online-status table.
         */

        let presenceRows = [];

        try {
            const {
                data,
                error
            } = await supabase
                .from("chat_presence")
                .select("*")
                .neq("user_id", currentUser.id);

            if (!error && data) {
                presenceRows = data;
            }
        } catch (error) {
            console.warn(
                "⚠️ Presence lookup failed:",
                error
            );
        }

        const users = [];

        for (const presence of presenceRows) {
            const status = String(
                presence.status || "offline"
            ).toLowerCase();

            if (
                status !== "online" &&
                status !== "idle"
            ) {
                continue;
            }

            const profile = await getProfile(
                presence.user_id
            );

            users.push({
                id: presence.user_id,
                name: getProfileName(profile),
                avatar: getProfileAvatar(profile),
                status,
                profile
            });
        }

        /*
         * Remove duplicates.
         */

        const unique = new Map();

        users.forEach(user => {
            unique.set(user.id, user);
        });

        return Array.from(unique.values());
    }

    async function getCommunityUsers(communityId) {
        if (!communityId) return [];

        try {
            const {
                data,
                error
            } = await supabase
                .from("chat_community_members")
                .select(`
                    user_id,
                    nickname,
                    display_name,
                    avatar_url,
                    status,
                    is_muted,
                    is_banned
                `)
                .eq("community_id", communityId)
                .eq("is_banned", false);

            if (error) {
                console.error(
                    "❌ Community member lookup failed:",
                    error
                );
                return [];
            }

            const result = [];

            for (const member of data || []) {
                if (member.user_id === currentUser.id) {
                    continue;
                }

                const profile = await getProfile(
                    member.user_id
                );

                result.push({
                    id: member.user_id,

                    name:
                        member.display_name ||
                        member.nickname ||
                        getProfileName(profile),

                    avatar:
                        member.avatar_url ||
                        getProfileAvatar(profile),

                    status:
                        member.status ||
                        "offline",

                    profile
                });
            }

            return result;
        } catch (error) {
            console.error(
                "❌ Failed loading community users:",
                error
            );

            return [];
        }
    }

    /* ========================================================
       USER PICKER
       ======================================================== */

    function userAvatar(user) {
        if (user.avatar) {
            return `
                <img
                    src="${escapeAttribute(user.avatar)}"
                    alt="${escapeAttribute(user.name)}"
                    class="call-user-avatar"
                >
            `;
        }

        return `
            <div class="call-user-avatar call-user-avatar-fallback">
                ${escapeHtml(
                    getInitials(user.name)
                )}
            </div>
        `;
    }

    function renderUserPicker(users, container) {
        if (!container) return;

        container.innerHTML = "";

        if (!users.length) {
            container.innerHTML = `
                <div class="call-empty-users">
                    <div class="call-empty-icon">👥</div>
                    <strong>No online users</strong>
                    <span>
                        There are currently no other online members available.
                    </span>
                </div>
            `;

            return;
        }

        users.forEach(user => {
            const item = document.createElement("button");

            item.type = "button";
            item.className = "call-user-option";
            item.dataset.userId = user.id;

            item.innerHTML = `
                ${userAvatar(user)}

                <span class="call-user-information">
                    <strong>
                        ${escapeHtml(user.name)}
                    </strong>

                    <small>
                        <span class="call-status-dot ${escapeAttribute(
                            user.status
                        )}"></span>
                        ${capitalize(user.status)}
                    </small>
                </span>

                <span class="call-user-check">
                    ✓
                </span>
            `;

            item.addEventListener(
                "click",
                () => {
                    item.classList.toggle(
                        "selected"
                    );
                }
            );

            container.appendChild(item);
        });
    }

    function getSelectedUserIds(container) {
        if (!container) return [];

        return Array.from(
            container.querySelectorAll(
                ".call-user-option.selected"
            )
        )
            .map(item => item.dataset.userId)
            .filter(Boolean);
    }

    /* ========================================================
       GENERAL CALL
       ======================================================== */

    async function openGeneralCallPicker() {
        const modal =
            elements.generalCallModal;

        const list =
            elements.generalCallUserList;

        if (!modal || !list) {
            console.warn(
                "⚠️ General call UI not found."
            );

            return;
        }

        modal.classList.add("open");
        modal.hidden = false;

        list.innerHTML = `
            <div class="call-loading-users">
                Loading online members...
            </div>
        `;

        const users = await getOnlineUsers();

        renderUserPicker(
            users,
            list
        );
    }

    function closeGeneralCallPicker() {
        const modal =
            elements.generalCallModal;

        if (!modal) return;

        modal.classList.remove("open");

        setTimeout(() => {
            modal.hidden = true;
        }, 200);
    }

    async function startGeneralCall() {
        const list =
            elements.generalCallUserList;

        const selected =
            getSelectedUserIds(list);

        /*
         * If the user has selected nobody, automatically use
         * everyone online.
         */

        let recipients = selected;

        if (!recipients.length) {
            const users = await getOnlineUsers();

            recipients = users.map(
                user => user.id
            );
        }

        if (!recipients.length) {
            showCallNotice(
                "No other online users are available."
            );

            return;
        }

        const mode =
            currentCallMode || "audio";

        closeGeneralCallPicker();

        await createCallRoom({
            type: "general",
            targetUserIds: recipients,
            mode
        });
    }

    /* ========================================================
       DIRECT CALL
       ======================================================== */

    async function callUser(userId, mode = "audio") {
        /*
         * IMPORTANT:
         * This function accepts a selected user ID internally,
         * but the UI NEVER asks the user to type a UUID.
         */

        if (!userId) {
            showCallNotice(
                "Please select a member to call."
            );

            return;
        }

        if (userId === currentUser.id) {
            showCallNotice(
                "You cannot call yourself."
            );

            return;
        }

        await createCallRoom({
            type: "direct",
            targetUserIds: [userId],
            mode
        });
    }

    /* ========================================================
       COMMUNITY CALL
       ======================================================== */

    async function startCommunityCall(
        communityId,
        mode = "audio"
    ) {
        if (!communityId) {
            showCallNotice(
                "No community was selected."
            );

            return;
        }

        const members =
            await getCommunityUsers(
                communityId
            );

        const onlineMembers =
            members.filter(member => {
                const status =
                    String(
                        member.status || ""
                    ).toLowerCase();

                return (
                    status === "online" ||
                    status === "idle"
                );
            });

        const recipientIds =
            onlineMembers.map(
                member => member.id
            );

        if (!recipientIds.length) {
            showCallNotice(
                "No other online members are available in this community."
            );

            return;
        }

        await createCallRoom({
            type: "community",
            communityId,
            targetUserIds: recipientIds,
            mode
        });
    }

    /* ========================================================
       CREATE CALL ROOM
       ======================================================== */

    async function createCallRoom({
        type,
        communityId = null,
        targetUserIds = [],
        mode = "audio"
    }) {
        if (!currentUser) {
            showCallNotice(
                "Please sign in before making a call."
            );

            return;
        }

        if (!targetUserIds.length) {
            showCallNotice(
                "No call recipients were selected."
            );

            return;
        }

        try {
            const {
                data: room,
                error: roomError
            } = await supabase
                .from("chat_call_rooms")
                .insert({
                    community_id:
                        communityId,

                    created_by:
                        currentUser.id,

                    target_user_id:
                        type === "direct"
                            ? targetUserIds[0]
                            : null,

                    room_status:
                        "ringing",

                    call_scope:
                        type,

                    max_participants:
                        Math.max(
                            2,
                            targetUserIds.length + 1
                        )
                })
                .select("*")
                .single();

            if (roomError) {
                throw roomError;
            }

            currentRoom = room;
            currentCallMode = mode;

            /*
             * Creator joins as participant.
             */

            await addParticipant(
                room.id,
                currentUser.id,
                "joined"
            );

            /*
             * Target users become invited participants.
             */

            for (const userId of targetUserIds) {
                if (userId === currentUser.id) {
                    continue;
                }

                await addParticipant(
                    room.id,
                    userId,
                    "invited"
                );

                await createCallInvite(
                    room.id,
                    userId
                );
            }

            await startLocalMedia(mode);

            await setupRoomChannels(
                room.id
            );

            showCallOverlay(
                "Calling..."
            );

            updateCallStatus(
                "Calling selected members..."
            );

            startCallTimeout();

        } catch (error) {
            console.error(
                "❌ Failed to create call:",
                error
            );

            showCallNotice(
                error.message ||
                "Unable to start the call."
            );
        }
    }

    /* ========================================================
       INVITATIONS
       ======================================================== */

    async function createCallInvite(
        roomId,
        receiverId
    ) {
        const {
            error
        } = await supabase
            .from("chat_call_invites")
            .insert({
                room_id: roomId,
                sender_id: currentUser.id,
                receiver_id: receiverId,
                status: "pending"
            });

        if (error) {
            console.error(
                "❌ Call invitation failed:",
                error
            );
        }
    }

    /* ========================================================
       PARTICIPANTS
       ======================================================== */

    async function addParticipant(
        roomId,
        userId,
        status = "invited"
    ) {
        const {
            error
        } = await supabase
            .from("chat_call_participants")
            .upsert(
                {
                    room_id: roomId,
                    user_id: userId,
                    status,
                    joined_at:
                        status === "joined"
                            ? new Date().toISOString()
                            : null
                },
                {
                    onConflict:
                        "room_id,user_id"
                }
            );

        if (error) {
            console.error(
                "❌ Participant update failed:",
                error
            );
        }
    }

    /* ========================================================
       LOCAL MEDIA
       ======================================================== */

    async function startLocalMedia(
        mode
    ) {
        stopLocalStream();

        const wantVideo =
            mode === "video";

        try {
            localStream =
                await navigator.mediaDevices.getUserMedia({
                    audio:
                        CONFIG.audioConstraints,

                    video:
                        wantVideo
                            ? CONFIG.videoConstraints
                            : false
                });

            microphoneEnabled = true;
            cameraEnabled = wantVideo;

            attachLocalVideo();

        } catch (error) {
            console.error(
                "❌ Could not access microphone/camera:",
                error
            );

            /*
             * For audio calls, microphone is required.
             */

            if (mode === "audio") {
                showCallNotice(
                    "Microphone permission is required for an audio call."
                );
            } else {
                showCallNotice(
                    "Camera or microphone permission was not granted."
                );
            }

            throw error;
        }
    }

    function stopLocalStream() {
        if (!localStream) return;

        localStream
            .getTracks()
            .forEach(track => {
                try {
                    track.stop();
                } catch (_) {}
            });

        localStream = null;
    }

    function attachLocalVideo() {
        const video =
            elements.callLocalVideo;

        if (!video || !localStream) return;

        video.srcObject =
            localStream;

        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;
    }

    /* ========================================================
       WEBRTC
       ======================================================== */

    function createPeerConnection(
        remoteUserId
    ) {
        if (peers.has(remoteUserId)) {
            return peers.get(remoteUserId)
                .connection;
        }

        const connection =
            new RTCPeerConnection(
                CONFIG
                    .iceServers
                    .length
                    ? {
                        iceServers:
                            CONFIG.iceServers
                    }
                    : {}
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
                if (!event.candidate) {
                    return;
                }

                sendSignal({
                    type: "ice-candidate",
                    targetUserId:
                        remoteUserId,
                    candidate:
                        event.candidate
                });
            };

        connection.ontrack =
            event => {
                attachRemoteStream(
                    remoteUserId,
                    event.streams[0]
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
                    state === "failed" ||
                    state === "closed"
                ) {
                    removePeer(
                        remoteUserId
                    );
                }
            };

        peers.set(
            remoteUserId,
            {
                connection,
                makingOffer: false
            }
        );

        return connection;
    }

    async function createOffer(
        remoteUserId
    ) {
        const connection =
            createPeerConnection(
                remoteUserId
            );

        try {
            const offer =
                await connection.createOffer();

            await connection.setLocalDescription(
                offer
            );

            await sendSignal({
                type: "offer",
                targetUserId:
                    remoteUserId,
                offer:
                    connection.localDescription
            });
        } catch (error) {
            console.error(
                "❌ Offer creation failed:",
                error
            );
        }
    }

    async function handleOffer(
        senderId,
        offer
    ) {
        const connection =
            createPeerConnection(
                senderId
            );

        try {
            await connection.setRemoteDescription(
                new RTCSessionDescription(
                    offer
                )
            );

            const answer =
                await connection.createAnswer();

            await connection.setLocalDescription(
                answer
            );

            await sendSignal({
                type: "answer",
                targetUserId:
                    senderId,
                answer:
                    connection.localDescription
            });
        } catch (error) {
            console.error(
                "❌ Offer handling failed:",
                error
            );
        }
    }

    async function handleAnswer(
        senderId,
        answer
    ) {
        const peer =
            peers.get(senderId);

        if (!peer) return;

        try {
            await peer.connection.setRemoteDescription(
                new RTCSessionDescription(
                    answer
                )
            );
        } catch (error) {
            console.error(
                "❌ Answer handling failed:",
                error
            );
        }
    }

    async function handleIceCandidate(
        senderId,
        candidate
    ) {
        const peer =
            peers.get(senderId);

        if (!peer) return;

        try {
            await peer.connection.addIceCandidate(
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

    function removePeer(
        remoteUserId
    ) {
        const peer =
            peers.get(remoteUserId);

        if (!peer) return;

        try {
            peer.connection.close();
        } catch (_) {}

        peers.delete(
            remoteUserId
        );

        const remoteVideo =
            document.querySelector(
                `[data-remote-user="${CSS.escape(
                    remoteUserId
                )}"]`
            );

        if (remoteVideo) {
            remoteVideo.remove();
        }
    }

    /* ========================================================
       REMOTE VIDEO
       ======================================================== */

    function attachRemoteStream(
        userId,
        stream
    ) {
        const container =
            elements.callRemoteVideos;

        if (!container) return;

        let video =
            container.querySelector(
                `[data-remote-user="${CSS.escape(
                    userId
                )}"]`
            );

        if (!video) {
            video =
                document.createElement(
                    "video"
                );

            video.dataset.remoteUser =
                userId;

            video.autoplay = true;
            video.playsInline = true;

            video.className =
                "call-remote-video";

            container.appendChild(
                video
            );
        }

        video.srcObject = stream;
    }

    /* ========================================================
       REALTIME SIGNALING
       ======================================================== */

    async function setupRoomChannels(
        roomId
    ) {
        if (!supabase) return;

        await removeRoomChannels();

        signalChannel =
            supabase.channel(
                `call-signals-${roomId}-${currentUser.id}`
            );

        signalChannel
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "chat_call_signals",
                    filter:
                        `room_id=eq.${roomId}`
                },
                async payload => {
                    const signal =
                        payload.new;

                    if (
                        signal.sender_id ===
                        currentUser.id
                    ) {
                        return;
                    }

                    await handleSignal(
                        signal
                    );
                }
            )
            .subscribe();

        participantChannel =
            supabase.channel(
                `call-participants-${roomId}`
            );

        participantChannel
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_call_participants",
                    filter:
                        `room_id=eq.${roomId}`
                },
                async payload => {
                    await handleParticipantEvent(
                        payload
                    );
                }
            )
            .subscribe();
    }

    async function removeRoomChannels() {
        if (signalChannel) {
            try {
                await supabase.removeChannel(
                    signalChannel
                );
            } catch (_) {}

            signalChannel = null;
        }

        if (participantChannel) {
            try {
                await supabase.removeChannel(
                    participantChannel
                );
            } catch (_) {}

            participantChannel = null;
        }
    }

    async function sendSignal({
        type,
        targetUserId,
        offer = null,
        answer = null,
        candidate = null
    }) {
        if (!currentRoom) return;

        const payload = {
            room_id:
                currentRoom.id,

            sender_id:
                currentUser.id,

            receiver_id:
                targetUserId,

            signal_type:
                type,

            payload: {
                offer,
                answer,
                candidate
            }
        };

        const {
            error
        } = await supabase
            .from("chat_call_signals")
            .insert(payload);

        if (error) {
            console.error(
                "❌ Signal insert failed:",
                error
            );
        }
    }

    async function handleSignal(
        signal
    ) {
        const senderId =
            signal.sender_id;

        const payload =
            signal.payload || {};

        switch (signal.signal_type) {
            case "offer":
                await handleOffer(
                    senderId,
                    payload.offer
                );
                break;

            case "answer":
                await handleAnswer(
                    senderId,
                    payload.answer
                );
                break;

            case "ice-candidate":
                await handleIceCandidate(
                    senderId,
                    payload.candidate
                );
                break;
        }
    }

    async function handleParticipantEvent(
        payload
    ) {
        const participant =
            payload.new ||
            payload.old;

        if (!participant) {
            return;
        }

        if (
            participant.user_id ===
            currentUser.id
        ) {
            return;
        }

        if (
            participant.status ===
            "joined"
        ) {
            if (
                currentUser.id <
                participant.user_id
            ) {
                await createOffer(
                    participant.user_id
                );
            }
        }

        if (
            participant.status ===
            "left"
        ) {
            removePeer(
                participant.user_id
            );
        }
    }

    /* ========================================================
       ACCEPT INCOMING CALL
       ======================================================== */

    async function acceptIncomingCall(
        mode = "audio"
    ) {
        if (!incomingCall) {
            return;
        }

        const invite =
            incomingCall;

        incomingCall = null;

        hideIncomingCall();

        try {
            const {
                data: room,
                error
            } = await supabase
                .from("chat_call_rooms")
                .select("*")
                .eq("id", invite.room_id)
                .single();

            if (error) {
                throw error;
            }

            currentRoom = room;
            currentCallMode = mode;

            await supabase
                .from("chat_call_invites")
                .update({
                    status: "accepted",
                    responded_at:
                        new Date().toISOString()
                })
                .eq("id", invite.id);

            await addParticipant(
                room.id,
                currentUser.id,
                "joined"
            );

            await startLocalMedia(
                mode
            );

            await setupRoomChannels(
                room.id
            );

            showCallOverlay(
                "Connected"
            );

            updateCallStatus(
                "You joined the call."
            );

        } catch (error) {
            console.error(
                "❌ Unable to accept call:",
                error
            );

            showCallNotice(
                "Unable to join the call."
            );
        }
    }

    async function rejectIncomingCall() {
        if (!incomingCall) {
            return;
        }

        const invite =
            incomingCall;

        incomingCall = null;

        hideIncomingCall();

        await supabase
            .from("chat_call_invites")
            .update({
                status: "rejected",
                responded_at:
                    new Date().toISOString()
            })
            .eq("id", invite.id);
    }

    /* ========================================================
       INCOMING INVITATIONS
       ======================================================== */

    function subscribeToIncomingCalls() {
        if (!supabase || !currentUser) {
            return;
        }

        const channel =
            supabase.channel(
                `incoming-calls-${currentUser.id}`
            );

        channel
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "chat_call_invites",
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

                    await showIncomingCall(
                        invite
                    );
                }
            )
            .subscribe();
    }

    async function showIncomingCall(
        invite
    ) {
        const profile =
            await getProfile(
                invite.sender_id
            );

        incomingCall =
            invite;

        if (
            elements.incomingCallName
        ) {
            elements.incomingCallName.textContent =
                getProfileName(
                    profile
                );
        }

        if (
            elements.incomingCallAvatar
        ) {
            const avatar =
                getProfileAvatar(
                    profile
                );

            elements.incomingCallAvatar.src =
                avatar || "";

            elements.incomingCallAvatar.hidden =
                !avatar;
        }

        if (
            elements.incomingCallToast
        ) {
            elements.incomingCallToast.hidden =
                false;

            elements.incomingCallToast.classList.add(
                "open"
            );
        }
    }

    function hideIncomingCall() {
        if (
            elements.incomingCallToast
        ) {
            elements.incomingCallToast.classList.remove(
                "open"
            );

            setTimeout(() => {
                elements.incomingCallToast.hidden =
                    true;
            }, 200);
        }
    }

    /* ========================================================
       CALL CONTROLS
       ======================================================== */

    function toggleMicrophone() {
        if (!localStream) return;

        const tracks =
            localStream.getAudioTracks();

        if (!tracks.length) return;

        microphoneEnabled =
            !microphoneEnabled;

        tracks.forEach(track => {
            track.enabled =
                microphoneEnabled;
        });

        updateControlButton(
            elements.callMuteButton,
            microphoneEnabled
                ? "🎙️"
                : "🔇"
        );
    }

    function toggleCamera() {
        if (!localStream) return;

        const tracks =
            localStream.getVideoTracks();

        if (!tracks.length) {
            showCallNotice(
                "This is an audio-only call."
            );

            return;
        }

        cameraEnabled =
            !cameraEnabled;

        tracks.forEach(track => {
            track.enabled =
                cameraEnabled;
        });

        updateControlButton(
            elements.callCameraButton,
            cameraEnabled
                ? "📹"
                : "🚫"
        );
    }

    async function toggleScreenShare() {
        if (!currentRoom) {
            return;
        }

        if (screenSharing) {
            await stopScreenShare();
            return;
        }

        try {
            const screenStream =
                await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: false
                });

            currentScreenTrack =
                screenStream.getVideoTracks()[0];

            for (const peer of peers.values()) {
                const sender =
                    peer.connection
                        .getSenders()
                        .find(
                            s =>
                                s.track &&
                                s.track.kind ===
                                    "video"
                        );

                if (sender) {
                    await sender.replaceTrack(
                        currentScreenTrack
                    );
                }
            }

            screenSharing = true;

            updateControlButton(
                elements.callScreenButton,
                "⛶"
            );

            currentScreenTrack.onended =
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
        if (!screenSharing) {
            return;
        }

        const cameraTrack =
            localStream
                ?.getVideoTracks()
                .find(
                    track =>
                        track.kind ===
                        "video"
                );

        for (const peer of peers.values()) {
            const sender =
                peer.connection
                    .getSenders()
                    .find(
                        s =>
                            s.track &&
                            s.track.kind ===
                                "video"
                    );

            if (sender) {
                await sender.replaceTrack(
                    cameraTrack || null
                );
            }
        }

        if (currentScreenTrack) {
            currentScreenTrack.stop();
            currentScreenTrack = null;
        }

        screenSharing = false;

        updateControlButton(
            elements.callScreenButton,
            "🖥️"
        );
    }

    /* ========================================================
       END CALL
       ======================================================== */

    async function endCall() {
        clearCallTimeout();

        if (currentRoom) {
            try {
                await supabase
                    .from("chat_call_participants")
                    .update({
                        status: "left",
                        left_at:
                            new Date().toISOString()
                    })
                    .eq(
                        "room_id",
                        currentRoom.id
                    )
                    .eq(
                        "user_id",
                        currentUser.id
                    );
            } catch (error) {
                console.warn(
                    "Participant leave update failed:",
                    error
                );
            }

            try {
                await supabase
                    .from("chat_call_rooms")
                    .update({
                        room_status:
                            "ended"
                    })
                    .eq(
                        "id",
                        currentRoom.id
                    )
                    .eq(
                        "created_by",
                        currentUser.id
                    );
            } catch (_) {}
        }

        for (const [
            userId
        ] of peers) {
            removePeer(userId);
        }

        await stopScreenShare();

        stopLocalStream();

        await removeRoomChannels();

        currentRoom = null;

        incomingCall = null;

        microphoneEnabled = true;
        cameraEnabled = false;
        screenSharing = false;

        hideCallOverlay();

        console.log(
            "📞 Call ended."
        );
    }

    /* ========================================================
       TIMEOUT
       ======================================================== */

    function startCallTimeout() {
        clearCallTimeout();

        callTimer =
            setTimeout(() => {
                if (
                    currentRoom &&
                    !hasActiveRemotePeer()
                ) {
                    showCallNotice(
                        "No one answered the call."
                    );

                    endCall();
                }
            }, CONFIG.callTimeout);
    }

    function clearCallTimeout() {
        if (!callTimer) return;

        clearTimeout(callTimer);

        callTimer = null;
    }

    function hasActiveRemotePeer() {
        return peers.size > 0;
    }

    /* ========================================================
       UI
       ======================================================== */

    function showCallOverlay(
        status = "Connecting..."
    ) {
        const overlay =
            elements.callOverlay;

        if (!overlay) return;

        overlay.hidden = false;

        overlay.classList.add(
            "open"
        );

        updateCallStatus(
            status
        );
    }

    function hideCallOverlay() {
        const overlay =
            elements.callOverlay;

        if (!overlay) return;

        overlay.classList.remove(
            "open"
        );

        setTimeout(() => {
            overlay.hidden = true;
        }, 200);

        if (
            elements.callRemoteVideos
        ) {
            elements.callRemoteVideos.innerHTML =
                "";
        }
    }

    function updateCallStatus(
        text
    ) {
        if (
            elements.callStatus
        ) {
            elements.callStatus.textContent =
                text;
        }
    }

    function updateControlButton(
        button,
        text
    ) {
        if (!button) return;

        button.textContent = text;
    }

    function showCallNotice(
        message
    ) {
        console.info(
            "📞",
            message
        );

        /*
         * Use the existing application
         * notification system if available.
         */

        if (
            typeof window.showNotification ===
            "function"
        ) {
            window.showNotification(
                message
            );

            return;
        }

        alert(message);
    }

    /* ========================================================
       EVENT LISTENERS
       ======================================================== */

    function setupEvents() {
        elements.generalCallButton
            ?.addEventListener(
                "click",
                openGeneralCallPicker
            );

        elements.generalCallCancelButton
            ?.addEventListener(
                "click",
                closeGeneralCallPicker
            );

        elements.generalCallCloseButton
            ?.addEventListener(
                "click",
                closeGeneralCallPicker
            );

        elements.generalCallStartButton
            ?.addEventListener(
                "click",
                startGeneralCall
            );

        elements.generalCallAudioButton
            ?.addEventListener(
                "click",
                () => {
                    currentCallMode =
                        "audio";

                    elements.generalCallAudioButton
                        ?.classList.add(
                            "active"
                        );

                    elements.generalCallVideoButton
                        ?.classList.remove(
                            "active"
                        );
                }
            );

        elements.generalCallVideoButton
            ?.addEventListener(
                "click",
                () => {
                    currentCallMode =
                        "video";

                    elements.generalCallVideoButton
                        ?.classList.add(
                            "active"
                        );

                    elements.generalCallAudioButton
                        ?.classList.remove(
                            "active"
                        );
                }
            );

        elements.callMuteButton
            ?.addEventListener(
                "click",
                toggleMicrophone
            );

        elements.callCameraButton
            ?.addEventListener(
                "click",
                toggleCamera
            );

        elements.callScreenButton
            ?.addEventListener(
                "click",
                toggleScreenShare
            );

        elements.callEndButton
            ?.addEventListener(
                "click",
                endCall
            );

        elements.incomingCallAcceptButton
            ?.addEventListener(
                "click",
                () => {
                    acceptIncomingCall(
                        "audio"
                    );
                }
            );

        elements.incomingCallVideoButton
            ?.addEventListener(
                "click",
                () => {
                    acceptIncomingCall(
                        "video"
                    );
                }
            );

        elements.incomingCallRejectButton
            ?.addEventListener(
                "click",
                rejectIncomingCall
            );

        /*
         * Community.js can dispatch a call request.
         */

        window.addEventListener(
            "mwaniki:general-call",
            async event => {
                const detail =
                    event.detail || {};

                const mode =
                    detail.mode ||
                    "audio";

                await openGeneralCallPicker();

                currentCallMode =
                    mode;
            }
        );

        /*
         * Direct member call.
         */

        window.addEventListener(
            "mwaniki:call-user",
            async event => {
                const detail =
                    event.detail || {};

                if (!detail.userId) {
                    return;
                }

                await callUser(
                    detail.userId,
                    detail.mode ||
                        "audio"
                );
            }
        );

        /*
         * Community-wide call.
         */

        window.addEventListener(
            "mwaniki:community-call",
            async event => {
                const detail =
                    event.detail || {};

                if (!detail.communityId) {
                    return;
                }

                await startCommunityCall(
                    detail.communityId,
                    detail.mode ||
                        "audio"
                );
            }
        );

        /*
         * Escape closes call picker.
         */

        document.addEventListener(
            "keydown",
            event => {
                if (
                    event.key ===
                    "Escape"
                ) {
                    closeGeneralCallPicker();
                }
            }
        );
    }

    /* ========================================================
       UTILITIES
       ======================================================== */

    function getInitials(
        name
    ) {
        const parts =
            String(name || "")
                .trim()
                .split(/\s+/)
                .filter(Boolean);

        if (!parts.length) {
            return "MS";
        }

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

    function capitalize(
        value
    ) {
        const text =
            String(value || "");

        return text
            .charAt(0)
            .toUpperCase() +
            text.slice(1);
    }

    function escapeHtml(
        value
    ) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function escapeAttribute(
        value
    ) {
        return escapeHtml(value);
    }

    /* ========================================================
       PUBLIC API
       ======================================================== */

    window.MwanikiCalls = {
        callUser,
        startCommunityCall,
        openGeneralCallPicker,
        closeGeneralCallPicker,
        startGeneralCall,
        endCall,
        getOnlineUsers,
        getCommunityUsers
    };

    /* ========================================================
       INITIALIZATION
       ======================================================== */

    async function initialize() {
        cacheElements();

        setupEvents();

        const ready =
            await initializeSupabase();

        if (!ready) {
            return;
        }

        subscribeToIncomingCalls();

        console.log(
            "✅ Mwaniki Scholars call engine ready."
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
