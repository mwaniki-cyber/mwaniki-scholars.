/* =========================================================
   MWANIKI SCHOLARS CALL ENGINE
   call.js
   ---------------------------------------------------------
   Separate WebRTC engine.

   Tables:
   - chat_call_rooms
   - chat_call_participants
   - chat_call_signals
   - chat_call_invites

   This file does NOT contain community/message logic.
   ========================================================= */

(() => {
    "use strict";

    /* =====================================================
       CONFIG
       ===================================================== */

    const CALL_TIMEOUT =
        30000;

    const ICE_SERVERS = [
        {
            urls:
                "stun:stun.l.google.com:19302"
        },
        {
            urls:
                "stun:stun1.l.google.com:19302"
        }
    ];

    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        user: null,

        supabase: null,

        room: null,

        roomId: null,

        mode: "audio",

        callScope: "general",

        targetUserId: null,

        peerConnections: new Map(),

        localStream: null,

        realtimeChannel: null,

        participantChannel: null,

        signalChannel: null,

        callTimer: null,

        incomingInvite: null,

        active: false,

        muted: false,

        camera: false,

        screenSharing: false,

        screenStream: null
    };

    /* =====================================================
       SUPABASE
       ===================================================== */

    function getSupabase() {

        return (
            window.supabaseClient ||
            window.supabase ||
            window.sb ||
            window.mwanikiSupabase ||
            null
        );
    }

    /* =====================================================
       DOM
       ===================================================== */

    function $(selector) {

        return document.querySelector(
            selector
        );
    }

    /* =====================================================
       UTILITIES
       ===================================================== */

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

    function randomRoomCode() {

        const chars =
            "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

        let result = "";

        for (
            let i = 0;
            i < 8;
            i++
        ) {

            result +=
                chars[
                    Math.floor(
                        Math.random() *
                        chars.length
                    )
                ];
        }

        return result;
    }

    function createPeerId() {

        return (
            state.user?.id ||
            crypto.randomUUID()
        );
    }

    /* =====================================================
       AUTH
       ===================================================== */

    async function getSession() {

        state.supabase =
            getSupabase();

        if (!state.supabase) {

            console.error(
                "Call engine: Supabase unavailable."
            );

            return null;
        }

        const {
            data,
            error
        } =
            await state.supabase
                .auth
                .getSession();

        if (error) {

            console.error(
                "Call session error:",
                error
            );

            return null;
        }

        state.user =
            data?.session?.user ||
            null;

        return state.user;
    }

    /* =====================================================
       CALL UI
       ===================================================== */

    function getCallOverlay() {

        return (
            $("#callOverlay") ||
            document.body
        );
    }

    function showCallOverlay() {

        const overlay =
            $("#callOverlay");

        if (!overlay) {
            return;
        }

        overlay.classList.remove(
            "hidden"
        );

        overlay.classList.add(
            "active"
        );

        overlay.style.display =
            "flex";
    }

    function hideCallOverlay() {

        const overlay =
            $("#callOverlay");

        if (!overlay) {
            return;
        }

        overlay.classList.remove(
            "active"
        );

        overlay.classList.add(
            "hidden"
        );

        overlay.style.display =
            "none";
    }

    function setCallStatus(
        message
    ) {

        const elements = [

            "#callStatus",

            "#callOverlayStatus",

            "#activeCallStatus"
        ];

        elements.forEach(
            selector => {

                const element =
                    $(selector);

                if (element) {

                    element.textContent =
                        message;
                }
            }
        );
    }

    function setCallTitle(
        title
    ) {

        const elements = [

            "#callTitle",

            "#callOverlayTitle",

            "#activeCallTitle"
        ];

        elements.forEach(
            selector => {

                const element =
                    $(selector);

                if (element) {

                    element.textContent =
                        title;
                }
            }
        );
    }

    function updateCallButtons() {

        const muteButtons = [

            "#muteCallButton",

            "#callMuteButton"
        ];

        muteButtons.forEach(
            selector => {

                const button =
                    $(selector);

                if (!button) {
                    return;
                }

                button.classList.toggle(
                    "active",
                    state.muted
                );

                button.textContent =
                    state.muted
                        ? "🔇"
                        : "🎙️";
            }
        );

        const cameraButtons = [

            "#toggleCameraButton",

            "#callCameraButton"
        ];

        cameraButtons.forEach(
            selector => {

                const button =
                    $(selector);

                if (!button) {
                    return;
                }

                button.classList.toggle(
                    "active",
                    state.camera
                );
            }
        );

        const screenButtons = [

            "#shareScreenButton",

            "#callScreenButton"
        ];

        screenButtons.forEach(
            selector => {

                const button =
                    $(selector);

                if (!button) {
                    return;
                }

                button.classList.toggle(
                    "active",
                    state.screenSharing
                );
            }
        );
    }

    /* =====================================================
       MEDIA
       ===================================================== */

    async function getLocalMedia(
        mode
    ) {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            throw new Error(
                "This browser does not support camera/microphone access."
            );
        }

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

        state.localStream
            .getAudioTracks()
            .forEach(
                track => {

                    track.enabled =
                        !state.muted;
                }
            );

        state.camera =
            mode === "video";

        state.localStream
            .getVideoTracks()
            .forEach(
                track => {

                    track.enabled =
                        state.camera;
                }
            );

        attachLocalVideo();

        updateCallButtons();
    }

    function attachLocalVideo() {

        const video =
            $("#localVideo");

        if (!video) {
            return;
        }

        if (!state.localStream) {
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

        video.play()
            .catch(
                () => {}
            );
    }

    function stopLocalMedia() {

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

        const video =
            $("#localVideo");

        if (video) {

            video.srcObject =
                null;
        }
    }

    /* =====================================================
       ROOM
       ===================================================== */

    async function createCallRoom(
        scope = "general",
        communityId = null
    ) {

        const roomCode =
            randomRoomCode();

        const insert = {

            room_code:
                roomCode,

            call_scope:
                scope,

            created_by:
                state.user.id,

            status:
                "active"
        };

        if (communityId) {
            insert.community_id =
                communityId;
        }

        const {
            data,
            error
        } =
            await state.supabase
                .from(
                    "chat_call_rooms"
                )
                .insert(
                    insert
                )
                .select()
                .single();

        if (error) {

            console.error(
                "Room creation error:",
                error
            );

            throw error;
        }

        state.room =
            data;

        state.roomId =
            data.id;

        return data;
    }

    async function joinRoom(
        roomId,
        mode
    ) {

        const {
            error
        } =
            await state.supabase
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
                        state.muted,

                    camera:
                        mode === "video",

                    screen_share:
                        false,

                    joined_at:
                        new Date().toISOString()
                });

        if (error) {

            console.error(
                "Join room error:",
                error
            );

            throw error;
        }
    }

    /* =====================================================
       PEER CONNECTION
       ===================================================== */

    function createPeerConnection(
        remoteUserId,
        initiator = false
    ) {

        if (
            state.peerConnections.has(
                remoteUserId
            )
        ) {

            return state.peerConnections.get(
                remoteUserId
            );
        }

        const pc =
            new RTCPeerConnection({
                iceServers:
                    ICE_SERVERS
            });

        state.peerConnections.set(
            remoteUserId,
            pc
        );

        if (state.localStream) {

            state.localStream
                .getTracks()
                .forEach(
                    track => {

                        pc.addTrack(
                            track,
                            state.localStream
                        );
                    }
                );
        }

        pc.onicecandidate =
            async event => {

                if (
                    !event.candidate
                ) {
                    return;
                }

                await sendSignal({

                    type:
                        "ice-candidate",

                    target_user_id:
                        remoteUserId,

                    sender_user_id:
                        state.user.id,

                    candidate:
                        event.candidate
                });
            };

        pc.ontrack =
            event => {

                attachRemoteStream(
                    remoteUserId,
                    event.streams[0]
                );
            };

        pc.onconnectionstatechange =
            () => {

                const status =
                    pc.connectionState;

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

        if (initiator) {

            makeOffer(
                remoteUserId,
                pc
            )
                .catch(
                    error =>
                        console.error(
                            "Offer error:",
                            error
                        )
                );
        }

        return pc;
    }

    async function makeOffer(
        remoteUserId,
        pc
    ) {

        const offer =
            await pc.createOffer();

        await pc.setLocalDescription(
            offer
        );

        await sendSignal({

            type:
                "offer",

            target_user_id:
                remoteUserId,

            sender_user_id:
                state.user.id,

            offer
        });
    }

    async function handleOffer(
        signal
    ) {

        const remoteUserId =
            signal.sender_user_id;

        const pc =
            createPeerConnection(
                remoteUserId,
                false
            );

        await pc.setRemoteDescription(
            new RTCSessionDescription(
                signal.offer
            )
        );

        const answer =
            await pc.createAnswer();

        await pc.setLocalDescription(
            answer
        );

        await sendSignal({

            type:
                "answer",

            target_user_id:
                remoteUserId,

            sender_user_id:
                state.user.id,

            answer
        });
    }

    async function handleAnswer(
        signal
    ) {

        const pc =
            state.peerConnections.get(
                signal.sender_user_id
            );

        if (!pc) {
            return;
        }

        await pc.setRemoteDescription(
            new RTCSessionDescription(
                signal.answer
            )
        );
    }

    async function handleIceCandidate(
        signal
    ) {

        const pc =
            state.peerConnections.get(
                signal.sender_user_id
            );

        if (!pc) {
            return;
        }

        try {

            await pc.addIceCandidate(
                new RTCIceCandidate(
                    signal.candidate
                )
            );

        } catch (error) {

            console.warn(
                "ICE candidate error:",
                error
            );
        }
    }

    function removePeer(
        userId
    ) {

        const pc =
            state.peerConnections.get(
                userId
            );

        if (!pc) {
            return;
        }

        try {
            pc.close();
        } catch {
            // Ignore.
        }

        state.peerConnections.delete(
            userId
        );

        const remote =
            document.querySelector(
                `[data-remote-user="${CSS.escape(
                    userId
                )}"]`
            );

        if (remote) {
            remote.remove();
        }
    }

    function closeAllPeers() {

        state.peerConnections
            .forEach(
                pc => {

                    try {
                        pc.close();
                    } catch {
                        // Ignore.
                    }
                }
            );

        state.peerConnections.clear();
    }

    /* =====================================================
       REMOTE VIDEO
       ===================================================== */

    function attachRemoteStream(
        userId,
        stream
    ) {

        let container =
            document.querySelector(
                `[data-remote-user="${CSS.escape(
                    userId
                )}"]`
            );

        if (!container) {

            container =
                document.createElement(
                    "div"
                );

            container.className =
                "remote-video-container";

            container.dataset.remoteUser =
                userId;

            const video =
                document.createElement(
                    "video"
                );

            video.autoplay =
                true;

            video.playsInline =
                true;

            video.dataset.remoteVideo =
                userId;

            container.appendChild(
                video
            );

            const grid =
                $("#remoteVideos") ||
                $("#callVideos") ||
                $("#remoteVideoGrid");

            if (grid) {
                grid.appendChild(
                    container
                );
            } else {

                getCallOverlay()
                    .appendChild(
                        container
                    );
            }
        }

        const video =
            container.querySelector(
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
    }

    /* =====================================================
       SIGNALING
       ===================================================== */

    async function sendSignal(
        payload
    ) {

        if (!state.roomId) {
            return;
        }

        const {
            error
        } =
            await state.supabase
                .from(
                    "chat_call_signals"
                )
                .insert({

                    room_id:
                        state.roomId,

                    sender_id:
                        state.user.id,

                    signal_type:
                        payload.type,

                    target_user_id:
                        payload.target_user_id ||
                        null,

                    payload:
                        payload
                });

        if (error) {

            console.error(
                "Call signal error:",
                error
            );
        }
    }

    async function processSignal(
        signal
    ) {

        if (!signal) {
            return;
        }

        const payload =
            signal.payload ||
            {};

        if (
            payload.target_user_id &&
            payload.target_user_id !==
                state.user.id
        ) {
            return;
        }

        switch (
            payload.type ||
            signal.signal_type
        ) {

            case "offer":

                await handleOffer(
                    payload
                );

                break;

            case "answer":

                await handleAnswer(
                    payload
                );

                break;

            case "ice-candidate":

                await handleIceCandidate(
                    payload
                );

                break;

            case "leave":

                if (
                    payload.sender_user_id
                ) {

                    removePeer(
                        payload.sender_user_id
                    );
                }

                break;
        }
    }

    function subscribeToCall() {

        if (
            state.realtimeChannel
        ) {

            try {

                state.supabase
                    .removeChannel(
                        state.realtimeChannel
                    );

            } catch {
                // Ignore.
            }
        }

        const roomId =
            state.roomId;

        state.realtimeChannel =
            state.supabase
                .channel(
                    `call-${roomId}-${Date.now()}`
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
                    async payload => {

                        await processSignal(
                            payload.new
                        );
                    }
                )

                .subscribe(
                    status => {

                        console.log(
                            "Call realtime:",
                            status
                        );
                    }
                );
    }

    /* =====================================================
       PARTICIPANTS
       ===================================================== */

    function subscribeToParticipants() {

        if (
            state.participantChannel
        ) {

            try {

                state.supabase
                    .removeChannel(
                        state.participantChannel
                    );

            } catch {
                // Ignore.
            }
        }

        const roomId =
            state.roomId;

        state.participantChannel =
            state.supabase
                .channel(
                    `call-participants-${roomId}`
                )

                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table:
                            "chat_call_participants",
                        filter:
                            `room_id=eq.${roomId}`
                    },
                    async payload => {

                        const participant =
                            payload.new;

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

                        createPeerConnection(
                            participant.user_id,
                            state.user.id <
                                participant.user_id
                        );
                    }
                )

                .on(
                    "postgres_changes",
                    {
                        event: "UPDATE",
                        schema: "public",
                        table:
                            "chat_call_participants",
                        filter:
                            `room_id=eq.${roomId}`
                    },
                    payload => {

                        if (
                            payload.new.status ===
                            "left"
                        ) {

                            removePeer(
                                payload.new.user_id
                            );
                        }
                    }
                )

                .subscribe();
    }

    async function connectExistingParticipants() {

        const {
            data,
            error
        } =
            await state.supabase
                .from(
                    "chat_call_participants"
                )
                .select("*")
                .eq(
                    "room_id",
                    state.roomId
                )
                .eq(
                    "status",
                    "joined"
                );

        if (error) {

            console.error(
                "Participant lookup error:",
                error
            );

            return;
        }

        (data || []).forEach(
            participant => {

                if (
                    participant.user_id ===
                    state.user.id
                ) {
                    return;
                }

                const shouldInitiate =
                    String(
                        state.user.id
                    ) <
                    String(
                        participant.user_id
                    );

                createPeerConnection(
                    participant.user_id,
                    shouldInitiate
                );
            }
        );
    }

    /* =====================================================
       START GENERAL CALL
       ===================================================== */

    async function startGeneralCall(
        targetUserId,
        mode = "audio"
    ) {

        if (!targetUserId) {

            throw new Error(
                "A target user is required."
            );
        }

        if (
            !state.user
        ) {

            await getSession();
        }

        if (!state.user) {

            throw new Error(
                "You must be signed in."
            );
        }

        await cleanupCall(
            false
        );

        state.mode =
            mode;

        state.callScope =
            "general";

        state.targetUserId =
            targetUserId;

        showCallOverlay();

        setCallTitle(
            mode === "video"
                ? "Video Call"
                : "Voice Call"
        );

        setCallStatus(
            "Starting call..."
        );

        await getLocalMedia(
            mode
        );

        await createCallRoom(
            "general",
            null
        );

        await joinRoom(
            state.roomId,
            mode
        );

        subscribeToCall();

        subscribeToParticipants();

        state.active =
            true;

        setCallStatus(
            "Calling..."
        );

        await sendCallInvite(
            targetUserId
        );

        createPeerConnection(
            targetUserId,
            true
        );

        startCallTimer();

    }

    /* =====================================================
       CALL INVITES
       ===================================================== */

    async function sendCallInvite(
        targetUserId
    ) {

        const {
            error
        } =
            await state.supabase
                .from(
                    "chat_call_invites"
                )
                .insert({

                    room_id:
                        state.roomId,

                    caller_id:
                        state.user.id,

                    target_user_id:
                        targetUserId,

                    call_type:
                        state.mode,

                    status:
                        "ringing"
                });

        if (error) {

            console.error(
                "Call invite error:",
                error
            );

            throw error;
        }
    }

    function subscribeToIncomingCalls() {

        if (!state.supabase) {
            return;
        }

        const channel =
            state.supabase
                .channel(
                    `incoming-calls-${state.user.id}`
                )

                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table:
                            "chat_call_invites",
                        filter:
                            `target_user_id=eq.${state.user.id}`
                    },
                    payload => {

                        handleIncomingInvite(
                            payload.new
                        );
                    }
                )

                .subscribe();

        state.signalChannel =
            channel;
    }

    function handleIncomingInvite(
        invite
    ) {

        if (
            !invite ||
            invite.status !==
                "ringing"
        ) {
            return;
        }

        state.incomingInvite =
            invite;

        const toast =
            $("#incomingCallToast");

        if (toast) {

            toast.classList.remove(
                "hidden"
            );

            toast.style.display =
                "flex";
        }

        const title =
            $("#incomingCallTitle");

        if (title) {

            title.textContent =
                invite.call_type ===
                "video"
                    ? "Incoming video call"
                    : "Incoming voice call";
        }

        const accept =
            $("#acceptIncomingCallButton");

        const decline =
            $("#declineIncomingCallButton");

        if (accept) {

            accept.onclick =
                () =>
                    acceptIncomingCall(
                        invite
                    );
        }

        if (decline) {

            decline.onclick =
                () =>
                    declineIncomingCall(
                        invite
                    );
        }
    }

    async function acceptIncomingCall(
        invite
    ) {

        hideIncomingCallToast();

        await cleanupCall(
            false
        );

        state.roomId =
            invite.room_id;

        state.mode =
            invite.call_type ||
            "audio";

        state.callScope =
            "general";

        state.targetUserId =
            invite.caller_id;

        showCallOverlay();

        setCallTitle(
            state.mode === "video"
                ? "Video Call"
                : "Voice Call"
        );

        setCallStatus(
            "Joining call..."
        );

        await getLocalMedia(
            state.mode
        );

        const {
            data: room,
            error
        } =
            await state.supabase
                .from(
                    "chat_call_rooms"
                )
                .select("*")
                .eq(
                    "id",
                    state.roomId
                )
                .maybeSingle();

        if (error) {
            throw error;
        }

        state.room =
            room;

        await joinRoom(
            state.roomId,
            state.mode
        );

        await state.supabase
            .from(
                "chat_call_invites"
            )
            .update({
                status:
                    "accepted"
            })
            .eq(
                "id",
                invite.id
            );

        subscribeToCall();

        subscribeToParticipants();

        state.active =
            true;

        setCallStatus(
            "Connected"
        );

        createPeerConnection(
            invite.caller_id,
            false
        );

        startCallTimer();
    }

    async function declineIncomingCall(
        invite
    ) {

        hideIncomingCallToast();

        await state.supabase
            .from(
                "chat_call_invites"
            )
            .update({
                status:
                    "declined"
            })
            .eq(
                "id",
                invite.id
            );

        state.incomingInvite =
            null;
    }

    function hideIncomingCallToast() {

        const toast =
            $("#incomingCallToast");

        if (!toast) {
            return;
        }

        toast.classList.add(
            "hidden"
        );

        toast.style.display =
            "none";
    }

    /* =====================================================
       CALL CONTROLS
       ===================================================== */

    function toggleMute() {

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

        updateCallButtons();
    }

    function toggleCamera() {

        if (!state.localStream) {
            return;
        }

        const tracks =
            state.localStream
                .getVideoTracks();

        if (!tracks.length) {
            return;
        }

        state.camera =
            !state.camera;

        tracks.forEach(
            track => {

                track.enabled =
                    state.camera;
            }
        );

        updateCallButtons();
    }

    async function toggleScreenShare() {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices
                .getDisplayMedia
        ) {

            toastCall(
                "Screen sharing is not supported here."
            );

            return;
        }

        if (state.screenSharing) {

            stopScreenShare();

            return;
        }

        try {

            const stream =
                await navigator.mediaDevices
                    .getDisplayMedia({
                        video: true
                    });

            state.screenStream =
                stream;

            const screenTrack =
                stream.getVideoTracks()[0];

            state.screenSharing =
                true;

            for (
                const pc
                of state.peerConnections
                    .values()
            ) {

                const sender =
                    pc.getSenders()
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
                }
            }

            screenTrack.onended =
                () =>
                    stopScreenShare();

            updateCallButtons();

        } catch (error) {

            console.error(
                "Screen share error:",
                error
            );
        }
    }

    async function stopScreenShare() {

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

            const cameraTrack =
                state.localStream
                    .getVideoTracks()[0];

            for (
                const pc
                of state.peerConnections
                    .values()
            ) {

                const sender =
                    pc.getSenders()
                        .find(
                            item =>
                                item.track &&
                                item.track.kind ===
                                "video"
                        );

                if (sender) {

                    await sender.replaceTrack(
                        cameraTrack ||
                        null
                    );
                }
            }
        }

        state.screenSharing =
            false;

        updateCallButtons();
    }

    /* =====================================================
       TIMER
       ===================================================== */

    function startCallTimer() {

        clearInterval(
            state.callTimer
        );

        const started =
            Date.now();

        state.callTimer =
            setInterval(
                () => {

                    const seconds =
                        Math.floor(
                            (
                                Date.now() -
                                started
                            ) / 1000
                        );

                    const minutes =
                        Math.floor(
                            seconds / 60
                        );

                    const remainder =
                        seconds % 60;

                    const text =
                        `${String(minutes).padStart(
                            2,
                            "0"
                        )}:${String(
                            remainder
                        ).padStart(
                            2,
                            "0"
                        )}`;

                    const timer =
                        $("#callTimer");

                    if (timer) {
                        timer.textContent =
                            text;
                    }

                },
                1000
            );
    }

    /* =====================================================
       END CALL
       ===================================================== */

    async function endCall() {

        await cleanupCall(
            true
        );
    }

    async function cleanupCall(
        notify = true
    ) {

        if (
            notify &&
            state.roomId
        ) {

            try {

                await sendSignal({
                    type:
                        "leave",

                    sender_user_id:
                        state.user.id
                });

            } catch {
                // Ignore signaling cleanup.
            }
        }

        if (
            state.roomId &&
            state.user &&
            state.supabase
        ) {

            try {

                await state.supabase
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
                        state.roomId
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    );

            } catch {
                // Ignore cleanup errors.
            }
        }

        if (
            state.realtimeChannel
        ) {

            try {

                await state.supabase
                    .removeChannel(
                        state.realtimeChannel
                    );

            } catch {
                // Ignore.
            }

            state.realtimeChannel =
                null;
        }

        if (
            state.participantChannel
        ) {

            try {

                await state.supabase
                    .removeChannel(
                        state.participantChannel
                    );

            } catch {
                // Ignore.
            }

            state.participantChannel =
                null;
        }

        closeAllPeers();

        stopLocalMedia();

        clearInterval(
            state.callTimer
        );

        state.callTimer =
            null;

        state.room =
            null;

        state.roomId =
            null;

        state.targetUserId =
            null;

        state.active =
            false;

        state.muted =
            false;

        state.camera =
            false;

        state.screenSharing =
            false;

        hideCallOverlay();

        clearRemoteVideos();

        updateCallButtons();
    }

    function clearRemoteVideos() {

        const grid =
            $("#remoteVideos") ||
            $("#callVideos") ||
            $("#remoteVideoGrid");

        if (!grid) {
            return;
        }

        grid
            .querySelectorAll(
                ".remote-video-container"
            )
            .forEach(
                element =>
                    element.remove()
            );
    }

    function toastCall(
        message
    ) {

        let element =
            $("#callToast");

        if (!element) {

            element =
                document.createElement(
                    "div"
                );

            element.id =
                "callToast";

            element.className =
                "community-toast";

            document.body.appendChild(
                element
            );
        }

        element.textContent =
            message;

        element.classList.add(
            "show"
        );

        setTimeout(
            () =>
                element.classList.remove(
                    "show"
                ),
            3000
        );
    }

    /* =====================================================
       EVENT CONNECTION
       ===================================================== */

    function setupCallEvents() {

        window.addEventListener(
            "mwaniki:general-call",
            async event => {

                const detail =
                    event.detail || {};

                if (
                    !detail.targetUserId
                ) {

                    toastCall(
                        "No call recipient selected."
                    );

                    return;
                }

                try {

                    await startGeneralCall(
                        detail.targetUserId,
                        detail.mode ||
                            "audio"
                    );

                } catch (error) {

                    console.error(
                        "Could not start call:",
                        error
                    );

                    toastCall(
                        error.message ||
                        "Could not start call."
                    );
                }
            }
        );

        const end =
            $("#endCallButton") ||
            $("#callEndButton");

        if (end) {
            end.onclick =
                endCall;
        }

        const mute =
            $("#muteCallButton") ||
            $("#callMuteButton");

        if (mute) {
            mute.onclick =
                toggleMute;
        }

        const camera =
            $("#toggleCameraButton") ||
            $("#callCameraButton");

        if (camera) {
            camera.onclick =
                toggleCamera;
        }

        const screen =
            $("#shareScreenButton") ||
            $("#callScreenButton");

        if (screen) {
            screen.onclick =
                toggleScreenShare;
        }
    }

    /* =====================================================
       START
       ===================================================== */

    async function initialize() {

        state.supabase =
            getSupabase();

        if (!state.supabase) {

            console.error(
                "Call engine: Supabase client not found."
            );

            return;
        }

        state.user =
            await getSession();

        if (!state.user) {

            console.warn(
                "Call engine: user is not signed in."
            );

            return;
        }

        setupCallEvents();

        subscribeToIncomingCalls();

        console.log(
            "✅ Mwaniki Scholars call engine loaded."
        );
    }

    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.MwanikiCalls = {

        state,

        startGeneralCall,

        endCall,

        toggleMute,

        toggleCamera,

        toggleScreenShare
    };

    /* =====================================================
       BOOT
       ===================================================== */

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
