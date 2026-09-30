/* =========================================================
   MWANIKI SCHOLARS
   UNIVERSAL WEBRTC CALL ENGINE

   Supports:

   - General calls
   - Community calls
   - Voice
   - Video
   - Microphone
   - Camera
   - Screen sharing
   - Multiple independent rooms
   - Supabase Realtime signaling
   ========================================================= */

import { supabase } from "./supabase.js";


(() => {

    "use strict";


    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        user: null,

        callId: null,

        callRoom: null,

        callType: "voice",

        callScope: "general",

        communityId: null,

        channelId: null,

        localStream: null,

        screenStream: null,

        peers: new Map(),

        participantMap: new Map(),

        signalChannel: null,

        participantChannel: null,

        inviteChannel: null,

        durationTimer: null,

        callStartedAt: null,

        generalMode: "voice",

        microphoneEnabled: true,

        cameraEnabled: false,

        screenSharing: false,

        minimized: false

    };


    /* =====================================================
       DOM
       ===================================================== */

    const $ = id =>
        document.getElementById(id);


    const callOverlay =
        $("callOverlay");

    const localVideo =
        $("localVideo");

    const callVideoGrid =
        $("callVideoGrid");

    const callParticipants =
        $("callParticipants");

    const callTitle =
        $("callTitle");

    const callSubtitle =
        $("callSubtitle");

    const callTypeIcon =
        $("callTypeIcon");

    const callDuration =
        $("callDuration");

    const generalCallModal =
        $("generalCallModal");

    const incomingCallToast =
        $("incomingCallToast");


    /* =====================================================
       AUTH
       ===================================================== */

    async function getUser() {

        const {
            data,
            error
        } = await supabase.auth.getUser();

        if (error) {

            console.error(
                "Call auth error:",
                error
            );

            return null;
        }

        state.user =
            data?.user || null;

        return state.user;
    }


    /* =====================================================
       TOAST
       ===================================================== */

    function toast(message) {

        const toastElement =
            document.getElementById(
                "communityToast"
            );

        if (!toastElement) {

            console.log(
                "[Call]",
                message
            );

            return;
        }

        toastElement.textContent =
            message;

        toastElement.classList.add(
            "show"
        );

        setTimeout(() => {

            toastElement.classList.remove(
                "show"
            );

        }, 3000);

    }


    /* =====================================================
       MEDIA
       ===================================================== */

    async function getMedia(type) {

        const wantsVideo =
            type === "video";

        try {

            const stream =
                await navigator.mediaDevices
                    .getUserMedia({

                        audio: true,

                        video:
                            wantsVideo
                                ? {
                                    width: {
                                        ideal: 1280
                                    },
                                    height: {
                                        ideal: 720
                                    },
                                    facingMode:
                                        "user"
                                }
                                : false

                    });

            return stream;

        } catch (error) {

            console.error(
                "Media error:",
                error
            );

            if (
                error.name ===
                "NotAllowedError"
            ) {

                toast(
                    "Microphone or camera permission was denied."
                );

            } else {

                toast(
                    "Unable to access microphone or camera."
                );

            }

            throw error;
        }

    }


    /* =====================================================
       WEBRTC CONFIG
       ===================================================== */

    const rtcConfig = {

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


    /* =====================================================
       CREATE PEER
       ===================================================== */

    async function createPeer(
        remoteUserId,
        createOffer = false
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
            new RTCPeerConnection(
                rtcConfig
            );


        state.peers.set(
            remoteUserId,
            peer
        );


        /* -----------------------------------------------
           LOCAL TRACKS
           ----------------------------------------------- */

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


        /* -----------------------------------------------
           REMOTE TRACK
           ----------------------------------------------- */

        peer.ontrack = event => {

            const stream =
                event.streams[0];

            if (!stream) return;

            attachRemoteStream(
                remoteUserId,
                stream
            );

        };


        /* -----------------------------------------------
           ICE
           ----------------------------------------------- */

        peer.onicecandidate =
            async event => {

                if (
                    !event.candidate ||
                    !state.callId
                ) {
                    return;
                }

                await sendSignal(
                    remoteUserId,
                    "ice",
                    {
                        candidate:
                            event.candidate
                    }
                );

            };


        /* -----------------------------------------------
           CONNECTION STATE
           ----------------------------------------------- */

        peer.onconnectionstatechange =
            () => {

                const connectionState =
                    peer.connectionState;

                if (
                    connectionState ===
                    "failed"
                ) {

                    peer.restartIce();

                }

                if (
                    connectionState ===
                    "closed" ||
                    connectionState ===
                    "disconnected"
                ) {

                    removeRemotePeer(
                        remoteUserId
                    );

                }

            };


        /* -----------------------------------------------
           CREATE OFFER
           ----------------------------------------------- */

        if (createOffer) {

            const offer =
                await peer.createOffer();

            await peer.setLocalDescription(
                offer
            );

            await sendSignal(
                remoteUserId,
                "offer",
                {
                    sdp:
                        peer.localDescription
                }
            );

        }


        return peer;

    }


    /* =====================================================
       SIGNAL
       ===================================================== */

    async function sendSignal(
        receiverId,
        signalType,
        payload
    ) {

        if (
            !state.callId ||
            !state.user
        ) {

            return;

        }


        const {
            error
        } = await supabase
            .from(
                "chat_call_signals"
            )
            .insert({

                call_id:
                    state.callId,

                sender_id:
                    state.user.id,

                receiver_id:
                    receiverId,

                signal_type:
                    signalType,

                payload

            });


        if (error) {

            console.error(
                "Signal error:",
                error
            );

        }

    }


    /* =====================================================
       HANDLE SIGNAL
       ===================================================== */

    async function handleSignal(
        signal
    ) {

        if (
            !signal ||
            signal.receiver_id !==
                state.user?.id
        ) {

            return;
        }


        const remoteUser =
            signal.sender_id;


        const peer =
            await createPeer(
                remoteUser,
                false
            );


        try {

            if (
                signal.signal_type ===
                "offer"
            ) {

                await peer.setRemoteDescription(
                    signal.payload.sdp
                );


                const answer =
                    await peer.createAnswer();


                await peer.setLocalDescription(
                    answer
                );


                await sendSignal(
                    remoteUser,
                    "answer",
                    {
                        sdp:
                            peer.localDescription
                    }
                );

            }


            else if (
                signal.signal_type ===
                "answer"
            ) {

                await peer.setRemoteDescription(
                    signal.payload.sdp
                );

            }


            else if (
                signal.signal_type ===
                "ice"
            ) {

                if (
                    signal.payload
                        ?.candidate
                ) {

                    await peer.addIceCandidate(
                        signal.payload.candidate
                    );

                }

            }


            else if (
                signal.signal_type ===
                "hangup"
            ) {

                removeRemotePeer(
                    remoteUser
                );

            }

        } catch (error) {

            console.error(
                "WebRTC signal handling error:",
                error
            );

        }

    }


    /* =====================================================
       REALTIME SIGNALING
       ===================================================== */

    function subscribeToSignals() {

        if (state.signalChannel) {

            supabase.removeChannel(
                state.signalChannel
            );

        }


        state.signalChannel =
            supabase
                .channel(
                    `call-signals-${state.callId}-${state.user.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table:
                            "chat_call_signals",
                        filter:
                            `call_id=eq.${state.callId}`
                    },
                    payload => {

                        handleSignal(
                            payload.new
                        );

                    }
                )
                .subscribe();

    }


    /* =====================================================
       PARTICIPANT SUBSCRIPTION
       ===================================================== */

    function subscribeToParticipants() {

        if (state.participantChannel) {

            supabase.removeChannel(
                state.participantChannel
            );

        }


        state.participantChannel =
            supabase
                .channel(
                    `call-participants-${state.callId}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table:
                            "chat_call_participants",
                        filter:
                            `call_id=eq.${state.callId}`
                    },
                    () => {

                        loadParticipants();

                    }
                )
                .subscribe();

    }


    /* =====================================================
       LOAD PARTICIPANTS
       ===================================================== */

    async function loadParticipants() {

        if (!state.callId) return;


        const {
            data,
            error
        } = await supabase
            .from(
                "chat_call_participants"
            )
            .select("*")
            .eq(
                "call_id",
                state.callId
            )
            .is(
                "left_at",
                null
            );


        if (error) {

            console.error(
                "Participant error:",
                error
            );

            return;
        }


        callParticipants.innerHTML =
            "";


        state.participantMap.clear();


        for (
            const participant of
            data || []
        ) {

            state.participantMap.set(
                participant.user_id,
                participant
            );


            const element =
                document.createElement(
                    "div"
                );

            element.className =
                "call-participant";


            const dot =
                document.createElement(
                    "span"
                );

            dot.className =
                "call-participant-dot";


            const name =
                document.createElement(
                    "span"
                );

            name.textContent =
                participant.user_id ===
                state.user.id
                    ? "You"
                    : participant.user_id
                        .slice(0, 8);


            element.appendChild(dot);
            element.appendChild(name);

            callParticipants.appendChild(
                element
            );


            if (
                participant.user_id !==
                state.user.id
            ) {

                if (
                    !state.peers.has(
                        participant.user_id
                    )
                ) {

                    await createPeer(
                        participant.user_id,
                        true
                    );

                }

            }

        }

    }


    /* =====================================================
       CREATE CALL ROOM
       ===================================================== */

    async function createCall({

        scope = "general",

        callType = "voice",

        communityId = null,

        channelId = null

    } = {}) {

        if (!state.user) {

            await getUser();

        }


        if (!state.user) {

            toast(
                "Please sign in before starting a call."
            );

            return null;

        }


        const {
            data,
            error
        } = await supabase
            .from(
                "chat_call_rooms"
            )
            .insert({

                scope,

                community_id:
                    communityId,

                channel_id:
                    channelId,

                call_type:
                    callType,

                created_by:
                    state.user.id,

                status:
                    "active"

            })
            .select()
            .single();


        if (error) {

            console.error(
                "Create call error:",
                error
            );

            toast(
                "Unable to create call."
            );

            return null;
        }


        state.callId =
            data.id;

        state.callRoom =
            data;

        state.callType =
            callType;

        state.callScope =
            scope;

        state.communityId =
            communityId;

        state.channelId =
            channelId;


        return data;

    }


    /* =====================================================
       JOIN CALL
       ===================================================== */

    async function joinCall(
        callId
    ) {

        if (!state.user) {

            await getUser();

        }


        if (!state.user) {

            toast(
                "You must be signed in."
            );

            return;

        }


        const {
            data: room,
            error
        } = await supabase
            .from(
                "chat_call_rooms"
            )
            .select("*")
            .eq(
                "id",
                callId
            )
            .eq(
                "status",
                "active"
            )
            .single();


        if (error || !room) {

            toast(
                "This call is no longer available."
            );

            return;

        }


        state.callId =
            room.id;

        state.callRoom =
            room;

        state.callType =
            room.call_type;

        state.callScope =
            room.scope;

        state.communityId =
            room.community_id;

        state.channelId =
            room.channel_id;


        await startLocalMedia(
            room.call_type
        );


        const {
            error: participantError
        } = await supabase
            .from(
                "chat_call_participants"
            )
            .upsert({

                call_id:
                    room.id,

                user_id:
                    state.user.id,

                joined_at:
                    new Date().toISOString(),

                left_at:
                    null,

                microphone_enabled:
                    true,

                camera_enabled:
                    room.call_type ===
                    "video"

            }, {

                onConflict:
                    "call_id,user_id"

            });


        if (participantError) {

            console.error(
                participantError
            );

        }


        openCallWindow();

        subscribeToSignals();

        subscribeToParticipants();

        await loadParticipants();

        startCallTimer();

    }


    /* =====================================================
       LOCAL MEDIA
       ===================================================== */

    async function startLocalMedia(
        type
    ) {

        if (state.localStream) {

            stopLocalMedia();

        }


        state.localStream =
            await getMedia(type);


        localVideo.srcObject =
            state.localStream;


        state.microphoneEnabled =
            true;

        state.cameraEnabled =
            type === "video";


        updateControlButtons();

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

        }


        state.localStream =
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

        }


        state.screenStream =
            null;

    }


    /* =====================================================
       OPEN CALL
       ===================================================== */

    function openCallWindow() {

        callOverlay.classList.remove(
            "hidden"
        );


        callTypeIcon.textContent =
            state.callType ===
            "video"
                ? "🎥"
                : "📞";


        callTitle.textContent =
            state.callScope ===
            "community"
                ? "Community Call"
                : "General Call";


        callSubtitle.textContent =
            state.callType ===
            "video"
                ? "Video call"
                : "Voice call";

    }


    /* =====================================================
       TIMER
       ===================================================== */

    function startCallTimer() {

        clearInterval(
            state.durationTimer
        );


        state.callStartedAt =
            Date.now();


        state.durationTimer =
            setInterval(() => {

                const seconds =
                    Math.floor(
                        (
                            Date.now() -
                            state.callStartedAt
                        ) / 1000
                    );


                const minutes =
                    Math.floor(
                        seconds / 60
                    );


                const remainder =
                    seconds % 60;


                callDuration.textContent =
                    String(minutes)
                        .padStart(2, "0")
                    + ":" +
                    String(remainder)
                        .padStart(2, "0");

            }, 1000);

    }


    /* =====================================================
       MUTE
       ===================================================== */

    function toggleMicrophone() {

        if (
            !state.localStream
        ) return;


        const audioTracks =
            state.localStream
                .getAudioTracks();


        state.microphoneEnabled =
            !state.microphoneEnabled;


        audioTracks.forEach(
            track => {

                track.enabled =
                    state.microphoneEnabled;

            }
        );


        updateControlButtons();

    }


    /* =====================================================
       CAMERA
       ===================================================== */

    async function toggleCamera() {

        if (
            state.callType !==
            "video"
        ) {

            return;

        }


        if (
            !state.localStream
        ) return;


        const videoTracks =
            state.localStream
                .getVideoTracks();


        if (!videoTracks.length) {

            return;

        }


        state.cameraEnabled =
            !state.cameraEnabled;


        videoTracks.forEach(
            track => {

                track.enabled =
                    state.cameraEnabled;

            }
        );


        updateControlButtons();

    }


    /* =====================================================
       SCREEN SHARE
       ===================================================== */

    async function toggleScreenShare() {

        if (!state.localStream) {

            return;
        }


        if (
            state.screenSharing
        ) {

            stopScreenShare();

            return;

        }


        try {

            const screenStream =
                await navigator.mediaDevices
                    .getDisplayMedia({

                        video: true

                    });


            state.screenStream =
                screenStream;


            const screenTrack =
                screenStream
                    .getVideoTracks()[0];


            for (
                const peer
                of state.peers.values()
            ) {

                const sender =
                    peer
                        .getSenders()
                        .find(
                            s =>
                                s.track &&
                                s.track.kind ===
                                "video"
                        );


                if (sender) {

                    await sender.replaceTrack(
                        screenTrack
                    );

                }

            }


            localVideo.srcObject =
                screenStream;


            state.screenSharing =
                true;


            screenTrack.onended =
                () => {

                    stopScreenShare();

                };


            updateControlButtons();

        } catch (error) {

            console.log(
                "Screen sharing cancelled:",
                error
            );

        }

    }


    /* =====================================================
       STOP SCREEN
       ===================================================== */

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
            const peer
            of state.peers.values()
        ) {

            const sender =
                peer
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


        localVideo.srcObject =
            state.localStream;


        updateControlButtons();

    }


    /* =====================================================
       UPDATE BUTTONS
       ===================================================== */

    function updateControlButtons() {

        const micButton =
            $("toggleMicrophoneButton");

        const cameraButton =
            $("toggleCameraButton");

        const screenButton =
            $("shareScreenButton");


        if (micButton) {

            micButton.classList.toggle(
                "active",
                state.microphoneEnabled
            );

            micButton.textContent =
                state.microphoneEnabled
                    ? "🎙️"
                    : "🔇";

        }


        if (cameraButton) {

            cameraButton.classList.toggle(
                "active",
                state.cameraEnabled
            );

            cameraButton.textContent =
                state.cameraEnabled
                    ? "📹"
                    : "🚫";

        }


        if (screenButton) {

            screenButton.classList.toggle(
                "active",
                state.screenSharing
            );

        }

    }


    /* =====================================================
       REMOTE VIDEO
       ===================================================== */

    function attachRemoteStream(
        userId,
        stream
    ) {

        let tile =
            document.getElementById(
                `remote-video-${userId}`
            );


        if (!tile) {

            tile =
                document.createElement(
                    "div"
                );

            tile.className =
                "video-tile";


            tile.id =
                `remote-video-${userId}`;


            const video =
                document.createElement(
                    "video"
                );

            video.autoplay =
                true;

            video.playsInline =
                true;

            video.srcObject =
                stream;


            const name =
                document.createElement(
                    "div"
                );

            name.className =
                "video-name";

            name.textContent =
                userId.slice(0, 8);


            tile.appendChild(video);

            tile.appendChild(name);

            callVideoGrid.appendChild(
                tile
            );

        } else {

            const video =
                tile.querySelector(
                    "video"
                );

            if (video) {

                video.srcObject =
                    stream;

            }

        }

    }


    /* =====================================================
       REMOVE REMOTE PEER
       ===================================================== */

    function removeRemotePeer(
        userId
    ) {

        const peer =
            state.peers.get(
                userId
            );


        if (peer) {

            peer.close();

        }


        state.peers.delete(
            userId
        );


        const tile =
            document.getElementById(
                `remote-video-${userId}`
            );


        if (tile) {

            tile.remove();

        }

    }


    /* =====================================================
       LEAVE CALL
       ===================================================== */

    async function leaveCall() {

        if (!state.callId) {

            return;

        }


        for (
            const peer
            of state.peers.values()
        ) {

            peer.close();

        }


        state.peers.clear();


        await supabase
            .from(
                "chat_call_participants"
            )
            .update({

                left_at:
                    new Date().toISOString()

            })
            .eq(
                "call_id",
                state.callId
            )
            .eq(
                "user_id",
                state.user.id
            );


        if (
            state.callRoom?.created_by ===
            state.user.id
        ) {

            await supabase
                .from(
                    "chat_call_rooms"
                )
                .update({

                    status:
                        "ended",

                    ended_at:
                        new Date().toISOString()

                })
                .eq(
                    "id",
                    state.callId
                );

        }


        cleanupCall();

    }


    /* =====================================================
       CLEANUP
       ===================================================== */

    function cleanupCall() {

        clearInterval(
            state.durationTimer
        );


        stopLocalMedia();


        if (
            state.signalChannel
        ) {

            supabase.removeChannel(
                state.signalChannel
            );

        }


        if (
            state.participantChannel
        ) {

            supabase.removeChannel(
                state.participantChannel
            );

        }


        state.signalChannel =
            null;

        state.participantChannel =
            null;

        state.callId =
            null;

        state.callRoom =
            null;

        state.communityId =
            null;

        state.channelId =
            null;


        callVideoGrid
            .querySelectorAll(
                ".video-tile:not(#localVideoTile)"
            )
            .forEach(
                element =>
                    element.remove()
            );


        callParticipants.innerHTML =
            "";


        callOverlay.classList.add(
            "hidden"
        );


        callDuration.textContent =
            "00:00";

    }


    /* =====================================================
       START GENERAL CALL
       ===================================================== */

    async function startGeneralCall() {

        const input =
            $("generalCallUserInput");


        const receiverId =
            input?.value.trim();


        if (!receiverId) {

            showGeneralMessage(
                "Enter the user UUID you want to call."
            );

            return;

        }


        const call =
            await createCall({

                scope:
                    "general",

                callType:
                    state.generalMode

            });


        if (!call) return;


        await supabase
            .from(
                "chat_call_invites"
            )
            .insert({

                call_id:
                    call.id,

                caller_id:
                    state.user.id,

                receiver_id:
                    receiverId,

                status:
                    "ringing"

            });


        await joinCall(
            call.id
        );


        generalCallModal
            .classList.add(
                "hidden"
            );

    }


    /* =====================================================
       COMMUNITY CALL
       ===================================================== */

    async function startCommunityCall(
        communityId,
        channelId,
        type = "voice"
    ) {

        const call =
            await createCall({

                scope:
                    "community",

                callType:
                    type,

                communityId,

                channelId

            });


        if (!call) return;


        await joinCall(
            call.id
        );

    }


    /* =====================================================
       GENERAL CALL UI
       ===================================================== */

    function openGeneralCall() {

        generalCallModal
            .classList.remove(
                "hidden"
            );

    }


    function closeGeneralCall() {

        generalCallModal
            .classList.add(
                "hidden"
            );

    }


    function showGeneralMessage(
        message
    ) {

        const element =
            $("generalCallMessage");

        if (!element) return;

        element.textContent =
            message;

    }


    /* =====================================================
       INCOMING CALLS
       ===================================================== */

    function subscribeToIncomingCalls() {

        if (!state.user) return;


        if (
            state.inviteChannel
        ) {

            supabase.removeChannel(
                state.inviteChannel
            );

        }


        state.inviteChannel =
            supabase
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
                            `receiver_id=eq.${state.user.id}`
                    },
                    payload => {

                        handleIncomingCall(
                            payload.new
                        );

                    }
                )
                .subscribe();

    }


    async function handleIncomingCall(
        invite
    ) {

        if (
            invite.status !==
            "ringing"
        ) {

            return;

        }


        incomingCallToast
            .classList.remove(
                "hidden"
            );


        const title =
            $("incomingCallTitle");

        const text =
            $("incomingCallText");


        if (title) {

            title.textContent =
                invite.call_id
                    ? "Incoming Call"
                    : "Call";

        }


        if (text) {

            text.textContent =
                "Someone is calling you";

        }


        const accept =
            $("acceptCallButton");

        const decline =
            $("declineCallButton");


        if (accept) {

            accept.onclick =
                async () => {

                    await acceptCall(
                        invite
                    );

                };

        }


        if (decline) {

            decline.onclick =
                async () => {

                    await declineCall(
                        invite
                    );

                };

        }

    }


    /* =====================================================
       ACCEPT
       ===================================================== */

    async function acceptCall(
        invite
    ) {

        await supabase
            .from(
                "chat_call_invites"
            )
            .update({

                status:
                    "accepted",

                responded_at:
                    new Date().toISOString()

            })
            .eq(
                "id",
                invite.id
            );


        incomingCallToast
            .classList.add(
                "hidden"
            );


        await joinCall(
            invite.call_id
        );

    }


    /* =====================================================
       DECLINE
       ===================================================== */

    async function declineCall(
        invite
    ) {

        await supabase
            .from(
                "chat_call_invites"
            )
            .update({

                status:
                    "declined",

                responded_at:
                    new Date().toISOString()

            })
            .eq(
                "id",
                invite.id
            );


        incomingCallToast
            .classList.add(
                "hidden"
            );

    }


    /* =====================================================
       GENERAL CALL MODE
       ===================================================== */

    function setupGeneralMode() {

        const voice =
            $("generalVoiceCallButton");

        const video =
            $("generalVideoCallButton");


        voice?.addEventListener(
            "click",
            () => {

                state.generalMode =
                    "voice";

                voice.classList.add(
                    "active"
                );

                video?.classList.remove(
                    "active"
                );

            }
        );


        video?.addEventListener(
            "click",
            () => {

                state.generalMode =
                    "video";

                video.classList.add(
                    "active"
                );

                voice?.classList.remove(
                    "active"
                );

            }
        );

    }


    /* =====================================================
       EVENTS
       ===================================================== */

    function setupEvents() {

        $("generalCallButton")
            ?.addEventListener(
                "click",
                openGeneralCall
            );


        $("closeGeneralCallModalButton")
            ?.addEventListener(
                "click",
                closeGeneralCall
            );


        $("cancelGeneralCallButton")
            ?.addEventListener(
                "click",
                closeGeneralCall
            );


        $("startGeneralCallButton")
            ?.addEventListener(
                "click",
                startGeneralCall
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


        $("leaveCallButton")
            ?.addEventListener(
                "click",
                leaveCall
            );


        $("minimizeCallButton")
            ?.addEventListener(
                "click",
                () => {

                    state.minimized =
                        !state.minimized;

                    callOverlay.classList.toggle(
                        "minimized",
                        state.minimized
                    );

                }
            );


        setupGeneralMode();

    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.MwanikiCalls = {

        startGeneralCall,

        startCommunityCall,

        joinCall,

        leaveCall,

        getState: () =>
            state

    };


    /* =====================================================
       INITIALIZE
       ===================================================== */

    async function initialize() {

        console.log(
            "📞 Mwaniki Universal Call Engine loading..."
        );


        await getUser();


        if (!state.user) {

            console.warn(
                "📞 No authenticated user."
            );

            return;

        }


        setupEvents();

        subscribeToIncomingCalls();


        console.log(
            "✅ Mwaniki Universal Call Engine ready"
        );

    }


    initialize();

})();
