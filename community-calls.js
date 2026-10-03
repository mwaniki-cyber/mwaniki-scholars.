/* =========================================================
   MWANIKI SCHOLARS CALL ENGINE
   INDEPENDENT FROM community.js
   ========================================================= */

"use strict";


const CallEngine = {

    supabase: null,

    user: null,

    profile: null,

    currentRoom: null,

    localStream: null,

    screenStream: null,

    peers: new Map(),

    signalChannel: null,

    roomChannel: null,

    microphoneEnabled: true,

    cameraEnabled: true,

    initialized: false

};


/* =========================================================
   START
   ========================================================= */

async function initializeCallEngine() {

    if (CallEngine.initialized) {
        return;
    }

    CallEngine.initialized = true;

    try {

        await waitForCallSupabase();

        CallEngine.supabase =
            window.supabase;

        const {
            data
        } =
            await CallEngine.supabase
                .auth
                .getSession();

        if (!data?.session?.user) {
            return;
        }

        CallEngine.user =
            data.session.user;

        setupCallEvents();

        console.log(
            "📞 Mwaniki Scholars Call Engine ready"
        );

    } catch (error) {

        console.error(
            "Call engine initialization failed:",
            error
        );
    }
}


/* =========================================================
   SUPABASE
   ========================================================= */

async function waitForCallSupabase(
    timeout = 10000
) {

    const started =
        Date.now();

    while (!window.supabase) {

        if (
            Date.now() -
            started >
            timeout
        ) {

            throw new Error(
                "Supabase unavailable."
            );
        }

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    100
                )
        );
    }
}


/* =========================================================
   EVENTS FROM community.js
   ========================================================= */

function setupCallEvents() {

    window.addEventListener(
        "mwaniki:person-call",
        event => {

            startPersonCall(
                event.detail
            );
        }
    );


    window.addEventListener(
        "mwaniki:community-call",
        event => {

            startCommunityCall(
                event.detail
            );
        }
    );


    $("#leaveCallButton")
        ?.addEventListener(
            "click",
            leaveCall
        );


    $("#leaveCallButtonBottom")
        ?.addEventListener(
            "click",
            leaveCall
        );


    $("#toggleMicrophoneButton")
        ?.addEventListener(
            "click",
            toggleMicrophone
        );


    $("#toggleCameraButton")
        ?.addEventListener(
            "click",
            toggleCamera
        );


    $("#shareScreenButton")
        ?.addEventListener(
            "click",
            toggleScreenShare
        );


    $("#acceptCallButton")
        ?.addEventListener(
            "click",
            acceptIncomingCall
        );


    $("#rejectCallButton")
        ?.addEventListener(
            "click",
            rejectIncomingCall
        );
}


/* =========================================================
   PERSON CALL
   ========================================================= */

async function startPersonCall(detail) {

    if (!detail?.targetUserId) {

        showCallToast(
            "No person was selected."
        );

        return;
    }

    try {

        await createRoom({

            call_scope:
                "direct",

            target_user_id:
                detail.targetUserId,

            mode:
                detail.mode ||
                "voice"

        });

    } catch (error) {

        console.error(
            error
        );

        showCallToast(
            "Unable to start the call."
        );
    }
}


/* =========================================================
   COMMUNITY CALL
   ========================================================= */

async function startCommunityCall(
    detail
) {

    if (!detail?.communityId) {

        showCallToast(
            "No community was selected."
        );

        return;
    }

    try {

        await createRoom({

            call_scope:
                "community",

            community_id:
                detail.communityId,

            mode:
                detail.mode ||
                "voice"

        });

    } catch (error) {

        console.error(
            error
        );

        showCallToast(
            "Unable to start community call."
        );
    }
}


/* =========================================================
   CREATE ROOM
   ========================================================= */

async function createRoom(options) {

    await prepareLocalMedia(
        options.mode
    );

    const {
        data: room,
        error
    } = await CallEngine.supabase
        .from("chat_call_rooms")
        .insert({

            community_id:
                options.community_id ||
                null,

            call_scope:
                options.call_scope,

            created_by:
                CallEngine.user.id,

            status:
                "ringing",

            mode:
                options.mode ||
                "voice"

        })
        .select()
        .single();

    if (error) {
        throw error;
    }

    CallEngine.currentRoom =
        room;

    const {
        error: participantError
    } =
        await CallEngine.supabase
            .from(
                "chat_call_participants"
            )
            .insert({

                room_id:
                    room.id,

                user_id:
                    CallEngine.user.id,

                status:
                    "joined",

                joined_at:
                    new Date().toISOString(),

                is_muted:
                    false,

                camera:
                    options.mode ===
                    "video"

            });

    if (participantError) {
        throw participantError;
    }


    if (
        options.target_user_id
    ) {

        await CallEngine.supabase
            .from(
                "chat_call_invites"
            )
            .insert({

                room_id:
                    room.id,

                inviter_id:
                    CallEngine.user.id,

                invitee_id:
                    options.target_user_id,

                status:
                    "pending"

            });
    }


    if (
        options.call_scope ===
        "community"
    ) {

        await inviteCommunityMembers(
            room.id,
            options.community_id
        );
    }


    openActiveCall(
        room,
        options.mode
    );

    subscribeToRoom(
        room.id
    );
}


/* =========================================================
   COMMUNITY INVITES
   ========================================================= */

async function inviteCommunityMembers(
    roomId,
    communityId
) {

    const {
        data,
        error
    } = await CallEngine.supabase
        .from("chat_community_members")
        .select("user_id")
        .eq(
            "community_id",
            communityId
        )
        .neq(
            "user_id",
            CallEngine.user.id
        );

    if (error) {
        throw error;
    }

    if (!data?.length) {
        return;
    }

    const invites =
        data.map(
            member => ({

                room_id:
                    roomId,

                inviter_id:
                    CallEngine.user.id,

                invitee_id:
                    member.user_id,

                status:
                    "pending"

            })
        );

    await CallEngine.supabase
        .from("chat_call_invites")
        .insert(
            invites
        );
}


/* =========================================================
   MEDIA
   ========================================================= */

async function prepareLocalMedia(
    mode
) {

    const wantsVideo =
        mode === "video";

    try {

        CallEngine.localStream =
            await navigator.mediaDevices
                .getUserMedia({

                    audio: true,

                    video:
                        wantsVideo

                });

        CallEngine.microphoneEnabled =
            true;

        CallEngine.cameraEnabled =
            wantsVideo;

    } catch (error) {

        throw new Error(
            "Microphone/camera permission was not granted."
        );
    }
}


/* =========================================================
   ACTIVE CALL
   ========================================================= */

function openActiveCall(
    room,
    mode
) {

    $("#activeCallOverlay")
        ?.classList
        .remove("hidden");

    $("#activeCallTitle")
        .textContent =
        mode === "video"
            ? "Video Call"
            : "Voice Call";

    $("#activeCallStatus")
        .textContent =
        "Connected";

    renderLocalParticipant();
}


function renderLocalParticipant() {

    const grid =
        $("#callParticipantGrid");

    if (!grid) {
        return;
    }

    grid.innerHTML = "";

    const card =
        document.createElement(
            "div"
        );

    card.className =
        "call-participant";

    if (
        CallEngine.localStream
    ) {

        const video =
            document.createElement(
                "video"
            );

        video.autoplay = true;

        video.muted = true;

        video.playsInline = true;

        video.srcObject =
            CallEngine.localStream;

        card.appendChild(
            video
        );
    }

    const name =
        document.createElement(
            "span"
        );

    name.className =
        "call-participant-name";

    name.textContent =
        "You";

    card.appendChild(
        name
    );

    grid.appendChild(
        card
    );
}


/* =========================================================
   SIGNALING
   ========================================================= */

function subscribeToRoom(roomId) {

    if (
        CallEngine.signalChannel
    ) {

        CallEngine.supabase
            .removeChannel(
                CallEngine.signalChannel
            );
    }

    CallEngine.signalChannel =
        CallEngine.supabase
            .channel(
                `call-signals-${roomId}`
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
                payload => {

                    handleSignal(
                        payload.new
                    );
                }
            )
            .subscribe();
}


/* =========================================================
   WEBRTC SIGNALING
   ========================================================= */

async function sendSignal(
    receiverId,
    type,
    payload
) {

    if (
        !CallEngine.currentRoom
    ) {
        return;
    }

    const {
        error
    } = await CallEngine.supabase
        .from(
            "chat_call_signals"
        )
        .insert({

            room_id:
                CallEngine.currentRoom.id,

            sender_id:
                CallEngine.user.id,

            receiver_id:
                receiverId,

            signal_type:
                type,

            payload

        });

    if (error) {
        console.error(
            "Signal failed:",
            error
        );
    }
}


async function handleSignal(signal) {

    if (
        String(
            signal.receiver_id
        ) !==
        String(
            CallEngine.user.id
        )
    ) {
        return;
    }

    const sender =
        signal.sender_id;

    let peer =
        CallEngine.peers.get(
            sender
        );

    if (!peer) {

        peer =
            await createPeerConnection(
                sender,
                false
            );
    }

    const payload =
        signal.payload;

    try {

        if (
            signal.signal_type ===
            "offer"
        ) {

            await peer.setRemoteDescription(
                new RTCSessionDescription(
                    payload
                )
            );

            const answer =
                await peer.createAnswer();

            await peer.setLocalDescription(
                answer
            );

            await sendSignal(
                sender,
                "answer",
                answer
            );

        } else if (
            signal.signal_type ===
            "answer"
        ) {

            await peer.setRemoteDescription(
                new RTCSessionDescription(
                    payload
                )
            );

        } else if (
            signal.signal_type ===
            "ice"
        ) {

            await peer.addIceCandidate(
                new RTCIceCandidate(
                    payload
                )
            );
        }

    } catch (error) {

        console.error(
            "WebRTC signal handling failed:",
            error
        );
    }
}


/* =========================================================
   PEER CONNECTION
   ========================================================= */

async function createPeerConnection(
    remoteUserId,
    initiator
) {

    const peer =
        new RTCPeerConnection({

            iceServers: [
                {
                    urls:
                        "stun:stun.l.google.com:19302"
                }
            ]

        });

    CallEngine.peers.set(
        remoteUserId,
        peer
    );

    if (
        CallEngine.localStream
    ) {

        CallEngine.localStream
            .getTracks()
            .forEach(
                track =>
                    peer.addTrack(
                        track,
                        CallEngine.localStream
                    )
            );
    }

    peer.onicecandidate =
        async event => {

            if (
                event.candidate
            ) {

                await sendSignal(
                    remoteUserId,
                    "ice",
                    event.candidate
                );
            }
        };


    peer.ontrack =
        event => {

            addRemoteStream(
                remoteUserId,
                event.streams[0]
            );
        };


    if (initiator) {

        const offer =
            await peer.createOffer();

        await peer.setLocalDescription(
            offer
        );

        await sendSignal(
            remoteUserId,
            "offer",
            offer
        );
    }

    return peer;
}


/* =========================================================
   REMOTE STREAM
   ========================================================= */

function addRemoteStream(
    userId,
    stream
) {

    const grid =
        $("#callParticipantGrid");

    if (!grid) {
        return;
    }

    let card =
        document.querySelector(
            `[data-call-user="${CSS.escape(String(userId))}"]`
        );

    if (!card) {

        card =
            document.createElement(
                "div"
            );

        card.className =
            "call-participant";

        card.dataset.callUser =
            userId;

        grid.appendChild(
            card
        );
    }

    let video =
        card.querySelector(
            "video"
        );

    if (!video) {

        video =
            document.createElement(
                "video"
            );

        video.autoplay = true;

        video.playsInline = true;

        card.appendChild(
            video
        );
    }

    video.srcObject =
        stream;
}


/* =========================================================
   MICROPHONE
   ========================================================= */

function toggleMicrophone() {

    if (
        !CallEngine.localStream
    ) {
        return;
    }

    CallEngine.microphoneEnabled =
        !CallEngine.microphoneEnabled;

    CallEngine.localStream
        .getAudioTracks()
        .forEach(
            track =>
                track.enabled =
                    CallEngine.microphoneEnabled
        );

    const button =
        $("#toggleMicrophoneButton");

    if (button) {

        button.textContent =
            CallEngine.microphoneEnabled
                ? "🎙️"
                : "🔇";
    }
}


/* =========================================================
   CAMERA
   ========================================================= */

function toggleCamera() {

    if (
        !CallEngine.localStream
    ) {
        return;
    }

    CallEngine.cameraEnabled =
        !CallEngine.cameraEnabled;

    CallEngine.localStream
        .getVideoTracks()
        .forEach(
            track =>
                track.enabled =
                    CallEngine.cameraEnabled
        );

    const button =
        $("#toggleCameraButton");

    if (button) {

        button.textContent =
            CallEngine.cameraEnabled
                ? "📹"
                : "🚫";
    }
}


/* =========================================================
   SCREEN SHARE
   ========================================================= */

async function toggleScreenShare() {

    try {

        if (
            CallEngine.screenStream
        ) {

            CallEngine.screenStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

            CallEngine.screenStream =
                null;

            showCallToast(
                "Screen sharing stopped."
            );

            return;
        }

        CallEngine.screenStream =
            await navigator.mediaDevices
                .getDisplayMedia({
                    video: true
                });

        const screenTrack =
            CallEngine.screenStream
                .getVideoTracks()[0];

        for (
            const peer
            of CallEngine.peers.values()
        ) {

            const sender =
                peer
                    .getSenders()
                    .find(
                        item =>
                            item.track?.kind ===
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
                toggleScreenShare();

    } catch (error) {

        console.error(
            "Screen share failed:",
            error
        );
    }
}


/* =========================================================
   LEAVE
   ========================================================= */

async function leaveCall() {

    if (
        CallEngine.localStream
    ) {

        CallEngine.localStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        CallEngine.localStream =
            null;
    }

    if (
        CallEngine.screenStream
    ) {

        CallEngine.screenStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        CallEngine.screenStream =
            null;
    }

    for (
        const peer
        of CallEngine.peers.values()
    ) {

        peer.close();
    }

    CallEngine.peers.clear();

    if (
        CallEngine.signalChannel
    ) {

        await CallEngine.supabase
            .removeChannel(
                CallEngine.signalChannel
            );

        CallEngine.signalChannel =
            null;
    }

    if (
        CallEngine.currentRoom
    ) {

        await CallEngine.supabase
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
                CallEngine.currentRoom.id
            )
            .eq(
                "user_id",
                CallEngine.user.id
            );
    }

    CallEngine.currentRoom =
        null;

    $("#activeCallOverlay")
        ?.classList
        .add("hidden");
}


/* =========================================================
   INCOMING CALL
   ========================================================= */

function showIncomingCall(
    callerName,
    roomId,
    mode
) {

    $("#incomingCallerName")
        .textContent =
        callerName ||
        "Incoming call";

    $("#incomingCallType")
        .textContent =
        mode === "video"
            ? "Video call"
            : "Voice call";

    $("#incomingCallToast")
        ?.classList
        .remove("hidden");

    CallEngine.pendingIncomingRoom =
        roomId;
}


async function acceptIncomingCall() {

    const roomId =
        CallEngine.pendingIncomingRoom;

    $("#incomingCallToast")
        ?.classList
        .add("hidden");

    if (!roomId) {
        return;
    }

    const {
        data: room,
        error
    } =
        await CallEngine.supabase
            .from(
                "chat_call_rooms"
            )
            .select("*")
            .eq(
                "id",
                roomId
            )
            .single();

    if (error) {

        showCallToast(
            "Unable to join call."
        );

        return;
    }

    await prepareLocalMedia(
        room.mode ||
        "voice"
    );

    CallEngine.currentRoom =
        room;

    await CallEngine.supabase
        .from(
            "chat_call_participants"
        )
        .upsert({

            room_id:
                room.id,

            user_id:
                CallEngine.user.id,

            status:
                "joined",

            joined_at:
                new Date().toISOString()

        }, {
            onConflict:
                "room_id,user_id"
        });

    openActiveCall(
        room,
        room.mode
    );

    subscribeToRoom(
        room.id
    );
}


function rejectIncomingCall() {

    $("#incomingCallToast")
        ?.classList
        .add("hidden");

    CallEngine.pendingIncomingRoom =
        null;
}


/* =========================================================
   TOAST
   ========================================================= */

function showCallToast(
    message
) {

    const toast =
        $("#toast");

    if (!toast) {
        return;
    }

    toast.textContent =
        message;

    toast.classList.remove(
        "hidden"
    );

    setTimeout(
        () =>
            toast.classList.add(
                "hidden"
            ),
        3500
    );
}


/* =========================================================
   START
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeCallEngine,
        {
            once: true
        }
    );

} else {

    initializeCallEngine();
}
