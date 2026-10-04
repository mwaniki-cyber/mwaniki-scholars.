import { supabase } from "./supabase.js";

(() => {

    "use strict";


    /* =====================================================
       WEBRTC CALL ENGINE
       ===================================================== */

    const state = {

        user: null,
        profile: null,

        active: false,

        roomId: null,
        inviteId: null,

        scope: "direct",

        mode: "audio",

        communityId: null,

        participants: new Map(),

        peers: new Map(),

        pendingCandidates: new Map(),

        localStream: null,

        screenTrack: null,

        roomChannel: null,

        incomingChannel: null,

        incomingCall: null,

        timer: null,

        startedAt: null,

        microphoneEnabled: true,

        cameraEnabled: true,

        screenSharing: false
    };


    const $ =
        id => document.getElementById(id);


    /* =====================================================
       HELPERS
       ===================================================== */

    function escapeHTML(value) {

        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    function showNotice(message) {

        const toast = $("toast");

        if (!toast) return;

        toast.textContent = message;

        toast.classList.remove("hidden");

        clearTimeout(showNotice.timer);

        showNotice.timer =
            setTimeout(
                () =>
                    toast.classList.add(
                        "hidden"
                    ),
                3500
            );
    }


    function avatarUrl(profile) {

        if (!profile?.avatar_url) {
            return "";
        }

        try {

            const url =
                new URL(
                    profile.avatar_url
                );

            return (
                url.protocol === "https:" ||
                url.protocol === "http:"
            )
                ? url.href
                : "";

        } catch {

            return "";
        }
    }


    async function getIdentity(userId) {

        const {
            data
        } = await supabase
            .from("chat_public_profiles")
            .select("*")
            .eq("id", userId)
            .maybeSingle();

        return data || {
            id: userId,
            display_name: "Member"
        };
    }


    /* =====================================================
       AUTH
       ===================================================== */

    async function loadUser() {

        const {
            data
        } = await supabase.auth.getSession();

        state.user =
            data.session?.user || null;

        if (!state.user) return false;

        state.profile =
            await getIdentity(
                state.user.id
            );

        return true;
    }


    /* =====================================================
       PERSONAL INCOMING CHANNEL
       ===================================================== */

    async function setupIncomingChannel() {

        if (!state.user) return;

        if (state.incomingChannel) {

            await supabase.removeChannel(
                state.incomingChannel
            );
        }


        state.incomingChannel =
            supabase.channel(
                `mwaniki-incoming-user-${state.user.id}`,
                {
                    config: {
                        broadcast: {
                            self: false
                        }
                    }
                }
            );


        state.incomingChannel
            .on(
                "broadcast",
                {
                    event: "incoming-call"
                },
                async ({ payload }) => {

                    console.log(
                        "Incoming call:",
                        payload
                    );

                    await receiveIncomingCall(
                        payload
                    );
                }
            )
            .on(
                "broadcast",
                {
                    event: "cancel-incoming-call"
                },
                ({ payload }) => {

                    if (
                        state.incomingCall
                        &&
                        state.incomingCall.roomId ===
                            payload.roomId
                    ) {

                        hideIncomingCall();
                    }
                }
            )
            .subscribe(
                status => {

                    console.log(
                        "Incoming call channel:",
                        status
                    );
                }
            );
    }


    async function sendIncomingRing(
        receiverId,
        payload
    ) {

        const channel =
            supabase.channel(
                `mwaniki-incoming-user-${receiverId}`,
                {
                    config: {
                        broadcast: {
                            self: false
                        }
                    }
                }
            );


        await new Promise(resolve => {

            let finished = false;

            const done = () => {

                if (finished) return;

                finished = true;

                resolve();
            };


            channel.subscribe(
                status => {

                    if (
                        status ===
                        "SUBSCRIBED"
                    ) {

                        done();
                    }
                }
            );

            setTimeout(
                done,
                3000
            );
        });


        try {

            await channel.send({
                type: "broadcast",
                event: "incoming-call",
                payload
            });

        } finally {

            setTimeout(
                () =>
                    supabase.removeChannel(
                        channel
                    ),
                1500
            );
        }
    }


    /* =====================================================
       CREATE ROOM
       ===================================================== */

    async function createRoom({
        userIds,
        mode,
        scope,
        communityId
    }) {

        if (!state.user) return;

        const uniqueUsers = [
            ...new Set(
                (userIds || [])
                    .filter(
                        id =>
                            id &&
                            id !==
                            state.user.id
                    )
            )
        ];

        if (!uniqueUsers.length) {

            showNotice(
                "No recipient selected."
            );

            return;
        }


        const {
            data: room,
            error
        } = await supabase
            .from("chat_call_rooms")
            .insert({
                community_id:
                    communityId || null,

                created_by:
                    state.user.id,

                target_user_id:
                    scope === "direct"
                        ? uniqueUsers[0]
                        : null,

                call_scope:
                    scope,

                room_status:
                    "ringing",

                max_participants:
                    Math.max(
                        uniqueUsers.length + 1,
                        2
                    )
            })
            .select()
            .single();


        if (error) {

            console.error(
                "Room creation:",
                error
            );

            showNotice(
                error.message ||
                "Could not create call room."
            );

            return;
        }


        state.roomId =
            room.id;

        state.scope =
            scope;

        state.mode =
            mode;

        state.communityId =
            communityId || null;

        state.active =
            true;


        /*
         * Caller joins first.
         */

        await insertParticipant(
            room.id,
            state.user.id,
            "joined"
        );


        await openRoomChannel();


        /*
         * Caller media.
         */

        await prepareLocalMedia(
            mode
        );


        /*
         * Invite recipients.
         */

        for (
            const receiverId
            of uniqueUsers
        ) {

            const {
                data: invite,
                error: inviteError
            } = await supabase
                .from("chat_call_invites")
                .insert({
                    room_id:
                        room.id,

                    sender_id:
                        state.user.id,

                    receiver_id:
                        receiverId,

                    status:
                        "ringing"
                })
                .select()
                .single();


            if (inviteError) {

                console.error(
                    "Invite:",
                    inviteError
                );

                continue;
            }


            await insertParticipant(
                room.id,
                receiverId,
                "invited"
            );


            const senderProfile =
                state.profile;


            await sendIncomingRing(
                receiverId,
                {
                    roomId:
                        room.id,

                    inviteId:
                        invite.id,

                    senderId:
                        state.user.id,

                    senderName:
                        senderProfile?.display_name ||
                        senderProfile?.full_name ||
                        "Member",

                    senderAvatar:
                        avatarUrl(
                            senderProfile
                        ),

                    callType:
                        mode,

                    scope,

                    communityId:
                        communityId || null,

                    room
                }
            );
        }


        showActiveCall(
            "Calling..."
        );

        startCallTimer();
    }


    /* =====================================================
       PARTICIPANTS
       ===================================================== */

    async function insertParticipant(
        roomId,
        userId,
        status
    ) {

        const {
            error
        } = await supabase
            .from("chat_call_participants")
            .insert({
                room_id:
                    roomId,

                user_id:
                    userId,

                status,

                is_muted:
                    false,

                camera:
                    state.mode === "video",

                screen_share:
                    false,

                joined_at:
                    status === "joined"
                        ? new Date().toISOString()
                        : null
            });


        if (
            error &&
            !String(error.message)
                .toLowerCase()
                .includes("duplicate")
        ) {

            console.warn(
                "Participant:",
                error
            );
        }
    }


    /* =====================================================
       ROOM BROADCAST
       ===================================================== */

    async function openRoomChannel() {

        if (state.roomChannel) {

            await supabase.removeChannel(
                state.roomChannel
            );
        }


        state.roomChannel =
            supabase.channel(
                `mwaniki-call-room-${state.roomId}`,
                {
                    config: {
                        broadcast: {
                            self: false
                        }
                    }
                }
            );


        state.roomChannel
            .on(
                "broadcast",
                {
                    event: "participant-joined"
                },
                async ({ payload }) => {

                    if (
                        !payload?.userId ||
                        payload.userId ===
                            state.user.id
                    ) {
                        return;
                    }

                    await handleRemoteJoined(
                        payload.userId
                    );
                }
            )
            .on(
                "broadcast",
                {
                    event: "signal"
                },
                async ({ payload }) => {

                    await handleSignal(
                        payload
                    );
                }
            )
            .on(
                "broadcast",
                {
                    event: "participant-left"
                },
                ({ payload }) => {

                    if (
                        payload?.userId
                    ) {

                        removePeer(
                            payload.userId
                        );
                    }
                }
            )
            .on(
                "broadcast",
                {
                    event: "call-ended"
                },
                ({ payload }) => {

                    if (
                        payload?.userId !==
                        state.user.id
                    ) {

                        finishCall(
                            false
                        );
                    }
                }
            )
            .subscribe(
                async status => {

                    console.log(
                        "Call room:",
                        status
                    );

                    if (
                        status ===
                        "SUBSCRIBED"
                    ) {

                        await broadcastRoomEvent(
                            "participant-joined",
                            {
                                userId:
                                    state.user.id,

                                mode:
                                    state.mode
                            }
                        );
                    }
                }
            );
    }


    async function broadcastRoomEvent(
        event,
        payload
    ) {

        if (!state.roomChannel) return;

        await state.roomChannel.send({
            type: "broadcast",
            event,
            payload
        });
    }


    /* =====================================================
       INCOMING CALL
       ===================================================== */

    async function receiveIncomingCall(
        payload
    ) {

        if (
            state.active ||
            state.incomingCall
        ) {
            return;
        }

        state.incomingCall =
            payload;

        $("incomingCallerName")
            .textContent =
            payload.senderName ||
            "Incoming call";

        $("incomingCallType")
            .textContent =
            payload.callType === "video"
                ? "Incoming video call"
                : "Incoming audio call";


        if (
            payload.senderAvatar
        ) {

            $("incomingCallAvatar")
                .innerHTML = `
                    <img
                        src="${escapeHTML(
                            payload.senderAvatar
                        )}"
                        alt=""
                        style="
                            width:100%;
                            height:100%;
                            object-fit:cover;
                        "
                    >
                `;
        } else {

            $("incomingCallAvatar")
                .textContent = "👤";
        }


        $("incomingCallToast")
            .classList
            .remove("hidden");
    }


    function hideIncomingCall() {

        $("incomingCallToast")
            .classList
            .add("hidden");

        state.incomingCall = null;
    }


    async function acceptIncomingCall() {

        const incoming =
            state.incomingCall;

        if (!incoming) return;

        hideIncomingCall();


        state.roomId =
            incoming.roomId;

        state.inviteId =
            incoming.inviteId;

        state.scope =
            incoming.scope ||
            "direct";

        state.mode =
            incoming.callType ||
            "audio";

        state.communityId =
            incoming.communityId ||
            null;

        state.active =
            true;


        /*
         * Update invite.
         */

        if (incoming.inviteId) {

            await supabase
                .from("chat_call_invites")
                .update({
                    status:
                        "accepted",

                    responded_at:
                        new Date().toISOString()
                })
                .eq(
                    "id",
                    incoming.inviteId
                );
        }


        /*
         * Recipient becomes a real participant.
         */

        await insertParticipant(
            state.roomId,
            state.user.id,
            "joined"
        );


        await prepareLocalMedia(
            state.mode
        );


        await openRoomChannel();


        showActiveCall(
            "Connecting..."
        );

        startCallTimer();
    }


    async function rejectIncomingCall() {

        const incoming =
            state.incomingCall;

        if (!incoming) return;

        hideIncomingCall();


        if (incoming.inviteId) {

            await supabase
                .from("chat_call_invites")
                .update({
                    status:
                        "rejected",

                    responded_at:
                        new Date().toISOString()
                })
                .eq(
                    "id",
                    incoming.inviteId
                );
        }


        const channel =
            supabase.channel(
                `mwaniki-call-room-${incoming.roomId}`
            );

        await new Promise(resolve => {

            let done = false;

            channel.subscribe(
                status => {

                    if (
                        status ===
                        "SUBSCRIBED" &&
                        !done
                    ) {

                        done = true;

                        channel.send({
                            type: "broadcast",
                            event: "participant-left",
                            payload: {
                                userId:
                                    state.user.id,

                                reason:
                                    "rejected"
                            }
                        });

                        setTimeout(
                            resolve,
                            100
                        );
                    }
                }
            );

            setTimeout(
                () => {

                    if (!done) {
                        done = true;
                        resolve();
                    }

                },
                1500
            );
        });

        await supabase.removeChannel(
            channel
        );
    }


    /* =====================================================
       LOCAL MEDIA
       ===================================================== */

    async function prepareLocalMedia(
        mode
    ) {

        try {

            const constraints =
                mode === "video"
                    ? {
                        audio: true,
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
                    }
                    : {
                        audio: true,
                        video: false
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
                mode === "video";


            createLocalTile();

        } catch (error) {

            console.error(
                "Local media:",
                error
            );

            showNotice(
                "Microphone/camera permission is required for the call."
            );

            throw error;
        }
    }


    function createLocalTile() {

        const grid =
            $("callParticipantGrid");

        let tile =
            document.querySelector(
                '[data-call-user="local"]'
            );

        if (!tile) {

            tile =
                document.createElement(
                    "div"
                );

            tile.className =
                "call-participant";

            tile.dataset.callUser =
                "local";

            grid.prepend(tile);
        }


        const hasVideo =
            state.localStream
                ?.getVideoTracks()
                .length > 0;


        if (hasVideo) {

            tile.classList
                .remove("audio-only");

            tile.innerHTML = `
                <video
                    autoplay
                    muted
                    playsinline
                ></video>

                <span class="call-participant-name">
                    You
                </span>
            `;

            tile.querySelector(
                "video"
            ).srcObject =
                state.localStream;

        } else {

            tile.classList
                .add("audio-only");

            tile.innerHTML = `
                <div class="call-participant-avatar">
                    👤
                </div>

                <span class="call-participant-name">
                    You
                </span>
            `;
        }
    }


    /* =====================================================
       PEER CONNECTION
       ===================================================== */

    async function handleRemoteJoined(
        remoteUserId
    ) {

        if (
            remoteUserId ===
            state.user.id
        ) {
            return;
        }


        /*
         * Deterministic offerer:
         * only the lexicographically smaller
         * user ID creates the offer.
         */

        if (
            state.user.id <
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

            await sendSignal(
                remoteUserId,
                {
                    type: "offer",
                    sdp: offer
                }
            );
        }
    }


    async function createPeer(
        remoteUserId
    ) {

        if (
            state.peers.has(
                remoteUserId
            )
        ) {

            return state.peers.get(
                remoteUserId
            );
        }


        const peer =
            new RTCPeerConnection({
                iceServers: [
                    {
                        urls: [
                            "stun:stun.l.google.com:19302",
                            "stun:stun1.l.google.com:19302",
                            "stun:stun2.l.google.com:19302"
                        ]
                    }
                ]
            });


        state.peers.set(
            remoteUserId,
            peer
        );


        if (state.localStream) {

            for (
                const track
                of state.localStream.getTracks()
            ) {

                peer.addTrack(
                    track,
                    state.localStream
                );
            }
        }


        peer.onicecandidate =
            async event => {

                if (
                    event.candidate
                ) {

                    await sendSignal(
                        remoteUserId,
                        {
                            type:
                                "ice",

                            candidate:
                                event.candidate
                        }
                    );
                }
            };


        peer.ontrack =
            event => {

                const stream =
                    event.streams[0];

                if (stream) {

                    renderRemoteStream(
                        remoteUserId,
                        stream
                    );
                }
            };


        peer.onconnectionstatechange =
            () => {

                console.log(
                    remoteUserId,
                    peer.connectionState
                );

                if (
                    peer.connectionState ===
                    "connected"
                ) {

                    $("activeCallStatus")
                        .textContent =
                        "Connected";
                }


                if (
                    [
                        "failed",
                        "closed",
                        "disconnected"
                    ].includes(
                        peer.connectionState
                    )
                ) {

                    removePeer(
                        remoteUserId
                    );
                }
            };


        return peer;
    }


    async function sendSignal(
        receiverId,
        signal
    ) {

        if (!state.roomChannel) return;

        await state.roomChannel.send({
            type: "broadcast",
            event: "signal",
            payload: {
                senderId:
                    state.user.id,

                receiverId,

                ...signal
            }
        });
    }


    /* =====================================================
       SIGNAL HANDLING
       ===================================================== */

    async function handleSignal(
        payload
    ) {

        if (!payload) return;

        if (
            payload.receiverId &&
            payload.receiverId !==
                state.user.id
        ) {
            return;
        }


        const senderId =
            payload.senderId;

        if (!senderId) return;


        const peer =
            await createPeer(
                senderId
            );


        if (
            payload.type ===
            "offer"
        ) {

            await peer.setRemoteDescription(
                new RTCSessionDescription(
                    payload.sdp
                )
            );


            const answer =
                await peer.createAnswer();

            await peer.setLocalDescription(
                answer
            );


            await sendSignal(
                senderId,
                {
                    type:
                        "answer",

                    sdp:
                        answer
                }
            );


            await flushCandidates(
                senderId
            );
        }


        else if (
            payload.type ===
            "answer"
        ) {

            await peer.setRemoteDescription(
                new RTCSessionDescription(
                    payload.sdp
                )
            );


            await flushCandidates(
                senderId
            );
        }


        else if (
            payload.type ===
            "ice"
        ) {

            if (
                peer.remoteDescription
            ) {

                try {

                    await peer.addIceCandidate(
                        new RTCIceCandidate(
                            payload.candidate
                        )
                    );

                } catch (error) {

                    console.warn(
                        "ICE candidate:",
                        error
                    );
                }

            } else {

                if (
                    !state.pendingCandidates
                        .has(senderId)
                ) {

                    state.pendingCandidates
                        .set(
                            senderId,
                            []
                        );
                }

                state.pendingCandidates
                    .get(senderId)
                    .push(
                        payload.candidate
                    );
            }
        }
    }


    async function flushCandidates(
        userId
    ) {

        const candidates =
            state.pendingCandidates
                .get(userId) || [];

        const peer =
            state.peers.get(userId);

        if (!peer) return;

        for (
            const candidate
            of candidates
        ) {

            try {

                await peer.addIceCandidate(
                    new RTCIceCandidate(
                        candidate
                    )
                );

            } catch {}
        }

        state.pendingCandidates
            .delete(userId);
    }


    /* =====================================================
       REMOTE VIDEO
       ===================================================== */

    function renderRemoteStream(
        userId,
        stream
    ) {

        const grid =
            $("callParticipantGrid");

        let tile =
            document.querySelector(
                `[data-call-user="${CSS.escape(
                    userId
                )}"]`
            );


        if (!tile) {

            tile =
                document.createElement(
                    "div"
                );

            tile.className =
                "call-participant";

            tile.dataset.callUser =
                userId;

            tile.innerHTML = `
                <video
                    autoplay
                    playsinline
                ></video>

                <span class="call-participant-name">
                    Member
                </span>
            `;

            grid.appendChild(tile);

            getIdentity(
                userId
            ).then(profile => {

                const name =
                    profile.display_name ||
                    profile.full_name ||
                    "Member";

                tile.querySelector(
                    ".call-participant-name"
                ).textContent =
                    name;
            });
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
            state.peers.get(
                userId
            );

        if (peer) {

            try {
                peer.close();
            } catch {}
        }

        state.peers.delete(
            userId
        );

        state.pendingCandidates
            .delete(
                userId
            );


        document
            .querySelector(
                `[data-call-user="${CSS.escape(
                    userId
                )}"]`
            )
            ?.remove();
    }


    /* =====================================================
       ACTIVE CALL UI
       ===================================================== */

    function showActiveCall(
        title
    ) {

        $("activeCallTitle")
            .textContent =
            title;

        $("activeCallStatus")
            .textContent =
            "Connecting...";

        $("activeCallOverlay")
            .classList
            .remove("hidden");
    }


    function startCallTimer() {

        clearInterval(
            state.timer
        );

        state.startedAt =
            Date.now();

        state.timer =
            setInterval(
                () => {

                    const seconds =
                        Math.floor(
                            (
                                Date.now() -
                                state.startedAt
                            ) / 1000
                        );

                    const minutes =
                        Math.floor(
                            seconds / 60
                        );

                    const remaining =
                        seconds % 60;

                    $("activeCallTimer")
                        .textContent =
                        `${String(
                            minutes
                        ).padStart(
                            2,
                            "0"
                        )}:${String(
                            remaining
                        ).padStart(
                            2,
                            "0"
                        )}`;

                },
                1000
            );
    }


    /* =====================================================
       MICROPHONE
       ===================================================== */

    function toggleMicrophone() {

        if (!state.localStream) return;

        const tracks =
            state.localStream
                .getAudioTracks();

        if (!tracks.length) return;

        state.microphoneEnabled =
            !state.microphoneEnabled;

        tracks.forEach(
            track =>
                track.enabled =
                    state.microphoneEnabled
        );

        $("toggleMicrophoneButton")
            .classList
            .toggle(
                "active",
                state.microphoneEnabled
            );
    }


    /* =====================================================
       CAMERA
       ===================================================== */

    function toggleCamera() {

        if (!state.localStream) return;

        let tracks =
            state.localStream
                .getVideoTracks();

        if (!tracks.length) return;

        state.cameraEnabled =
            !state.cameraEnabled;

        tracks.forEach(
            track =>
                track.enabled =
                    state.cameraEnabled
        );

        $("toggleCameraButton")
            .classList
            .toggle(
                "active",
                state.cameraEnabled
            );
    }


    /* =====================================================
       SCREEN SHARING
       ===================================================== */

    async function toggleScreenShare() {

        if (!state.localStream) return;

        if (state.screenSharing) {

            await stopScreenShare();

            return;
        }


        if (
            !navigator.mediaDevices
                ?.getDisplayMedia
        ) {

            showNotice(
                "Screen sharing is not supported by this browser."
            );

            return;
        }


        try {

            const screenStream =
                await navigator.mediaDevices
                    .getDisplayMedia({
                        video: true,
                        audio: false
                    });

            const screenTrack =
                screenStream.getVideoTracks()[0];

            if (!screenTrack) return;

            state.screenTrack =
                screenTrack;

            state.screenSharing =
                true;


            for (
                const peer
                of state.peers.values()
            ) {

                const sender =
                    peer
                        .getSenders()
                        .find(
                            item =>
                                item
                                    .track
                                    ?.kind ===
                                "video"
                        );

                if (sender) {

                    await sender.replaceTrack(
                        screenTrack
                    );

                } else {

                    peer.addTrack(
                        screenTrack,
                        screenStream
                    );
                }
            }


            const localVideo =
                document.querySelector(
                    '[data-call-user="local"] video'
                );

            if (localVideo) {

                localVideo.srcObject =
                    screenStream;
            }


            screenTrack.onended =
                () =>
                    stopScreenShare();


            $("shareScreenButton")
                .classList
                .add("active");


            showNotice(
                "Screen sharing started."
            );

        } catch (error) {

            console.error(
                "Screen share:",
                error
            );
        }
    }


    async function stopScreenShare() {

        if (!state.screenTrack) return;

        const screenTrack =
            state.screenTrack;

        screenTrack.stop();


        const cameraTrack =
            state.localStream
                ?.getVideoTracks()[0] ||
            null;


        for (
            const peer
            of state.peers.values()
        ) {

            const sender =
                peer
                    .getSenders()
                    .find(
                        item =>
                            item
                                .track
                                ?.kind ===
                            "video"
                    );

            if (sender) {

                await sender.replaceTrack(
                    cameraTrack
                );
            }
        }


        createLocalTile();


        state.screenTrack =
            null;

        state.screenSharing =
            false;

        $("shareScreenButton")
            .classList
            .remove("active");
    }


    /* =====================================================
       LEAVE
       ===================================================== */

    async function leaveCall() {

        if (!state.active) return;


        try {

            await broadcastRoomEvent(
                "call-ended",
                {
                    userId:
                        state.user.id
                }
            );

        } catch {}


        await finishCall(
            true
        );
    }


    async function finishCall(
        notify
    ) {

        clearInterval(
            state.timer
        );

        state.timer = null;


        if (state.screenTrack) {

            try {
                state.screenTrack.stop();
            } catch {}
        }


        state.localStream
            ?.getTracks()
            .forEach(
                track => track.stop()
            );


        for (
            const peer
            of state.peers.values()
        ) {

            try {
                peer.close();
            } catch {}
        }


        state.peers.clear();


        if (state.roomChannel) {

            try {

                await supabase.removeChannel(
                    state.roomChannel
                );

            } catch {}
        }


        if (
            state.roomId &&
            state.user
        ) {

            await supabase
                .from(
                    "chat_call_participants"
                )
                .update({
                    status:
                        "left",

                    left_at:
                        new Date().toISOString()
                })
                .eq(
                    "room_id",
                    state.roomId
                )
                .eq(
                    "user_id",
                    state.user.id
                );


            /*
             * Creator can close the room.
             */

            await supabase
                .from("chat_call_rooms")
                .update({
                    room_status:
                        "ended"
                })
                .eq(
                    "id",
                    state.roomId
                )
                .eq(
                    "created_by",
                    state.user.id
                );
        }


        $("activeCallOverlay")
            .classList
            .add("hidden");


        $("callParticipantGrid")
            .innerHTML = "";


        state.active = false;

        state.roomId = null;

        state.inviteId = null;

        state.localStream = null;

        state.screenTrack = null;

        state.screenSharing = false;

        state.pendingCandidates
            .clear();


        if (notify) {

            showNotice(
                "Call ended."
            );
        }
    }


    /* =====================================================
       EVENTS FROM COMMUNITY.JS
       ===================================================== */

    window.addEventListener(
        "mwaniki:call-user",
        async event => {

            const userId =
                event.detail?.userId;

            const mode =
                event.detail?.mode ||
                "audio";

            if (!userId) return;

            await createRoom({
                userIds: [userId],
                mode,
                scope: "direct",
                communityId:
                    window
                        .MwanikiCommunity
                        ?.getCurrentCommunityId()
            });
        }
    );


    window.addEventListener(
        "mwaniki:start-general-call",
        async event => {

            const userIds =
                event.detail?.userIds || [];

            const mode =
                event.detail?.mode ||
                "audio";

            if (!userIds.length) return;

            await createRoom({
                userIds,
                mode,
                scope: "general",
                communityId: null
            });
        }
    );


    window.addEventListener(
        "mwaniki:start-community-call",
        async event => {

            let userIds =
                event.detail?.userIds || [];

            const mode =
                event.detail?.mode ||
                "audio";

            const communityId =
                event.detail?.communityId ||
                null;


            /*
             * "Whole community" means all current
             * members except caller.
             */

            if (
                event.detail?.wholeCommunity
            ) {

                const {
                    data: members
                } = await supabase
                    .from(
                        "chat_community_members"
                    )
                    .select("user_id")
                    .eq(
                        "community_id",
                        communityId
                    );

                userIds =
                    (members || [])
                        .map(
                            member =>
                                member.user_id
                        )
                        .filter(
                            id =>
                                id !==
                                state.user.id
                        );
            }


            if (!userIds.length) {

                showNotice(
                    "No community members are available."
                );

                return;
            }


            await createRoom({
                userIds,
                mode,
                scope: "community",
                communityId
            });
        }
    );


    /* =====================================================
       BUTTONS
       ===================================================== */

    $("acceptCallButton")
        ?.addEventListener(
            "click",
            acceptIncomingCall
        );


    $("rejectCallButton")
        ?.addEventListener(
            "click",
            rejectIncomingCall
        );


    $("leaveCallButton")
        ?.addEventListener(
            "click",
            leaveCall
        );


    $("leaveCallButtonBottom")
        ?.addEventListener(
            "click",
            leaveCall
        );


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


    /* =====================================================
       START
       ===================================================== */

    async function init() {

        try {

            const ok =
                await loadUser();

            if (!ok) return;

            await setupIncomingChannel();

            console.log(
                "Mwaniki WebRTC call engine ready."
            );

        } catch (error) {

            console.error(
                "Call engine:",
                error
            );
        }
    }


    init();

})();
