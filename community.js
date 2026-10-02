
/* ============================================================
   MWANIKI SCHOLARS
   COMMUNITY.JS
   REAL CALLING ENGINE — PART 1
   ============================================================

   PART 1 FEATURES
   ------------------------------------------------------------
   ✓ Supabase connection
   ✓ Authentication detection
   ✓ General Calls
   ✓ Community Calls
   ✓ Independent call rooms
   ✓ Multiple simultaneous community calls
   ✓ Room creation
   ✓ Room joining
   ✓ Incoming call detection
   ✓ Participant registration
   ✓ WebRTC peer connection setup
   ✓ Supabase Realtime signaling
   ✓ Offer / Answer
   ✓ ICE candidates
   ✓ Join / Leave signaling
   ✓ Call state management

   DATABASE TABLES
   ------------------------------------------------------------
   chat_call_rooms
   chat_call_participants
   chat_call_signals

   IMPORTANT
   ------------------------------------------------------------
   community_id = UUID
   room_id      = UUID
   user_id      = UUID

   General Call:
       community_id = null

   Community Call:
       community_id = actual community UUID

   Part 2 will add:
       microphone
       camera
       screen sharing
       participant tiles
       mute/camera/screen buttons
       leave/end call
       cleanup
   ============================================================ */


/* ============================================================
   1. SUPABASE
   ============================================================ */

import { supabase } from "./supabase.js";


/* ============================================================
   2. GLOBAL CALL STATE
   ============================================================ */

const CallState = {

    initialized: false,

    currentUser: null,

    currentRoom: null,

    currentParticipant: null,

    currentCommunityId: null,

    currentCommunityName: null,

    currentCallScope: null,

    currentCallType: null,

    isCaller: false,

    isInCall: false,

    isEndingCall: false,

    localStream: null,

    peerConnections: new Map(),

    remoteStreams: new Map(),

    signalChannel: null,

    roomChannel: null,

    incomingCallSubscription: null,

    participantSubscription: null,

    signalSubscription: null,

    reconnectTimer: null,

    pendingOffers: new Map(),

    pendingIceCandidates: new Map(),

    initializedPeerUsers: new Set(),

    configuration: {

        iceServers: [

            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302"
                ]
            }

        ]

    }

};


/* ============================================================
   3. CONSTANTS
   ============================================================ */

const CALL_SCOPE = {

    GENERAL: "general",

    COMMUNITY: "community"

};


const CALL_TYPE = {

    VOICE: "voice",

    VIDEO: "video"

};


const CALL_STATUS = {

    WAITING: "waiting",

    ACTIVE: "active",

    ENDED: "ended"

};


const PARTICIPANT_STATUS = {

    INVITED: "invited",

    RINGING: "ringing",

    JOINED: "joined",

    LEFT: "left",

    DECLINED: "declined"

};


/* ============================================================
   4. BASIC LOGGING
   ============================================================ */

function callLog(...args) {

    console.log(
        "[Mwaniki Calls]",
        ...args
    );

}


function callWarn(...args) {

    console.warn(
        "[Mwaniki Calls]",
        ...args
    );

}


function callError(...args) {

    console.error(
        "[Mwaniki Calls]",
        ...args
    );

}


/* ============================================================
   5. GENERATE ROOM CODE
   ============================================================ */

function generateRoomCode() {

    const timestamp =
        Date.now().toString(36);

    const random =
        Math.random()
            .toString(36)
            .substring(2, 10);

    return (
        "mw-" +
        timestamp +
        "-" +
        random
    );

}


/* ============================================================
   6. GET CURRENT USER
   ============================================================ */

async function getCurrentUser() {

    try {

        const {
            data,
            error
        } = await supabase.auth.getUser();

        if (error) {

            callError(
                "Unable to get current user:",
                error
            );

            return null;

        }

        if (!data || !data.user) {

            callWarn(
                "No authenticated user."
            );

            return null;

        }

        CallState.currentUser =
            data.user;

        return data.user;

    }

    catch (error) {

        callError(
            "getCurrentUser failed:",
            error
        );

        return null;

    }

}


/* ============================================================
   7. INITIALIZE CALLING SYSTEM
   ============================================================ */

export async function initializeCallingSystem() {

    if (CallState.initialized) {

        callLog(
            "Calling system already initialized."
        );

        return true;

    }

    callLog(
        "Initializing real calling system..."
    );


    const user =
        await getCurrentUser();


    if (!user) {

        callWarn(
            "Calling system waiting for authentication."
        );

        return false;

    }


    CallState.initialized =
        true;


    await subscribeToIncomingCalls();


    callLog(
        "Real calling system initialized.",
        user.id
    );


    return true;

}


/* ============================================================
   8. AUTH STATE LISTENER
   ============================================================ */

supabase.auth.onAuthStateChange(
    async (
        event,
        session
    ) => {

        callLog(
            "Auth state:",
            event
        );


        if (
            session &&
            session.user
        ) {

            CallState.currentUser =
                session.user;


            if (
                !CallState.initialized
            ) {

                await initializeCallingSystem();

            }

        }

        else {

            await cleanupCallState();

        }

    }
);


/* ============================================================
   9. CREATE GENERAL CALL
   ============================================================ */

export async function startGeneralCall(
    callType = CALL_TYPE.VIDEO
) {

    return await createCallRoom({

        scope:
            CALL_SCOPE.GENERAL,

        communityId:
            null,

        callType

    });

}


/* ============================================================
   10. CREATE COMMUNITY CALL
   ============================================================ */

export async function startCommunityCall(
    communityId,
    communityName = "",
    callType = CALL_TYPE.VIDEO
) {

    if (!communityId) {

        callError(
            "Cannot start community call without community ID."
        );

        return null;

    }


    CallState.currentCommunityId =
        communityId;

    CallState.currentCommunityName =
        communityName;


    return await createCallRoom({

        scope:
            CALL_SCOPE.COMMUNITY,

        communityId,

        callType

    });

}


/* ============================================================
   11. CREATE CALL ROOM
   ============================================================ */

async function createCallRoom({
    scope,
    communityId,
    callType
}) {

    try {

        const user =
            CallState.currentUser ||
            await getCurrentUser();


        if (!user) {

            throw new Error(
                "You must be signed in before starting a call."
            );

        }


        if (
            scope === CALL_SCOPE.COMMUNITY &&
            !communityId
        ) {

            throw new Error(
                "Community call requires a community ID."
            );

        }


        const roomCode =
            generateRoomCode();


        const {
            data: room,
            error: roomError
        } = await supabase

            .from(
                "chat_call_rooms"
            )

            .insert({

                room_code:
                    roomCode,

                call_scope:
                    scope,

                call_type:
                    callType,

                community_id:
                    communityId,

                created_by:
                    user.id,

                status:
                    CALL_STATUS.WAITING

            })

            .select("*")

            .single();


        if (roomError) {

            throw roomError;

        }


        CallState.currentRoom =
            room;

        CallState.currentCallScope =
            scope;

        CallState.currentCallType =
            callType;

        CallState.isCaller =
            true;


        callLog(
            "Call room created:",
            room
        );


        await joinCallRoom(
            room.id
        );


        return room;

    }

    catch (error) {

        callError(
            "Unable to create call:",
            error
        );

        showCallError(
            error.message ||
            "Unable to start call."
        );

        return null;

    }

}


/* ============================================================
   12. JOIN CALL ROOM
   ============================================================ */

export async function joinCallRoom(
    roomId
) {

    try {

        const user =
            CallState.currentUser ||
            await getCurrentUser();


        if (!user) {

            throw new Error(
                "You must be signed in to join a call."
            );

        }


        if (!roomId) {

            throw new Error(
                "Call room ID is missing."
            );

        }


        /*
         * Retrieve room.
         */

        const {
            data: room,
            error: roomError
        } = await supabase

            .from(
                "chat_call_rooms"
            )

            .select("*")

            .eq(
                "id",
                roomId
            )

            .maybeSingle();


        if (roomError) {

            throw roomError;

        }


        if (!room) {

            throw new Error(
                "Call room no longer exists."
            );

        }


        if (
            room.status ===
            CALL_STATUS.ENDED
        ) {

            throw new Error(
                "This call has already ended."
            );

        }


        CallState.currentRoom =
            room;

        CallState.currentCallScope =
            room.call_scope;

        CallState.currentCallType =
            room.call_type;

        CallState.currentCommunityId =
            room.community_id;


        /*
         * Check existing participant.
         */

        const {
            data: existingParticipant,
            error:
                participantLookupError
        } = await supabase

            .from(
                "chat_call_participants"
            )

            .select("*")

            .eq(
                "room_id",
                room.id
            )

            .eq(
                "user_id",
                user.id
            )

            .maybeSingle();


        if (participantLookupError) {

            throw participantLookupError;

        }


        let participant =
            existingParticipant;


        if (!participant) {

            const {
                data: newParticipant,
                error:
                    participantError
            } = await supabase

                .from(
                    "chat_call_participants"
                )

                .insert({

                    room_id:
                        room.id,

                    user_id:
                        user.id,

                    status:
                        PARTICIPANT_STATUS.JOINED,

                    joined_at:
                        new Date()
                            .toISOString()

                })

                .select("*")

                .single();


            if (participantError) {

                throw participantError;

            }


            participant =
                newParticipant;

        }

        else {

            const {
                data: updatedParticipant,
                error:
                    participantUpdateError
            } = await supabase

                .from(
                    "chat_call_participants"
                )

                .update({

                    status:
                        PARTICIPANT_STATUS.JOINED,

                    joined_at:
                        existingParticipant.joined_at ||
                        new Date().toISOString(),

                    left_at:
                        null

                })

                .eq(
                    "id",
                    existingParticipant.id
                )

                .select("*")

                .single();


            if (participantUpdateError) {

                throw participantUpdateError;

            }


            participant =
                updatedParticipant;

        }


        CallState.currentParticipant =
            participant;

        CallState.isInCall =
            true;

        CallState.isEndingCall =
            false;


        /*
         * Mark room active.
         */

        await supabase

            .from(
                "chat_call_rooms"
            )

            .update({

                status:
                    CALL_STATUS.ACTIVE,

                started_at:
                    room.started_at ||
                    new Date().toISOString()

            })

            .eq(
                "id",
                room.id
            );


        /*
         * Subscribe to room.
         */

        await subscribeToCallRoom(
            room.id
        );


        /*
         * Load existing participants.
         */

        await loadExistingParticipants(
            room.id
        );


        /*
         * Tell other participants that
         * we joined.
         */

        await sendSignal({

            roomId:
                room.id,

            receiverId:
                null,

            signalType:
                "join",

            payload: {

                userId:
                    user.id,

                timestamp:
                    Date.now()

            }

        });


        callLog(
            "Joined call room:",
            room.id
        );


        showCallPanel(
            room
        );


        return room;

    }

    catch (error) {

        callError(
            "Unable to join call:",
            error
        );

        showCallError(
            error.message ||
            "Unable to join call."
        );

        return null;

    }

}


/* ============================================================
   13. LOAD EXISTING PARTICIPANTS
   ============================================================ */

async function loadExistingParticipants(
    roomId
) {

    const user =
        CallState.currentUser ||
        await getCurrentUser();


    if (!user) {

        return;

    }


    const {
        data: participants,
        error
    } = await supabase

        .from(
            "chat_call_participants"
        )

        .select("*")

        .eq(
            "room_id",
            roomId
        )

        .eq(
            "status",
            PARTICIPANT_STATUS.JOINED
        );


    if (error) {

        callError(
            "Unable to load participants:",
            error
        );

        return;

    }


    for (
        const participant
        of participants || []
    ) {

        if (
            participant.user_id ===
            user.id
        ) {

            continue;

        }


        /*
         * Create a peer connection for
         * each existing participant.
         *
         * The existing caller creates
         * the offer.
         */

        await createPeerConnection(
            participant.user_id,
            true
        );

    }

}


/* ============================================================
   14. SUBSCRIBE TO A CALL ROOM
   ============================================================ */

async function subscribeToCallRoom(
    roomId
) {

    await removeCallRoomSubscription();


    const channelName =
        `mwaniki-call-${roomId}`;


    CallState.roomChannel =
        supabase.channel(
            channelName
        );


    /*
     * Participant changes.
     */

    CallState.roomChannel
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

                callLog(
                    "Participant event:",
                    payload
                );


                await handleParticipantChange(
                    payload
                );

            }
        );


    /*
     * WebRTC signals.
     */

    CallState.roomChannel
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

                await handleIncomingSignal(
                    payload.new
                );

            }
        );


    const status =
        await CallState.roomChannel.subscribe();


    callLog(
        "Call room subscription:",
        status
    );

}


/* ============================================================
   15. REMOVE CALL ROOM SUBSCRIPTION
   ============================================================ */

async function removeCallRoomSubscription() {

    if (
        !CallState.roomChannel
    ) {

        return;

    }


    try {

        await supabase.removeChannel(
            CallState.roomChannel
        );

    }

    catch (error) {

        callWarn(
            "Unable to remove room channel:",
            error
        );

    }


    CallState.roomChannel =
        null;

}


/* ============================================================
   16. INCOMING CALL SUBSCRIPTION
   ============================================================ */

async function subscribeToIncomingCalls() {

    const user =
        CallState.currentUser ||
        await getCurrentUser();


    if (!user) {

        return;

    }


    if (
        CallState.incomingCallSubscription
    ) {

        return;

    }


    /*
     * Watch participant invitations.
     *
     * This allows the UI to display an
     * incoming-call screen when another
     * user creates a participant row.
     */

    CallState.incomingCallSubscription =
        supabase

            .channel(
                `mwaniki-incoming-calls-${user.id}`
            )

            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table:
                        "chat_call_participants",
                    filter:
                        `user_id=eq.${user.id}`
                },
                async payload => {

                    await handleIncomingParticipant(
                        payload.new
                    );

                }
            )

            .subscribe(
                status => {

                    callLog(
                        "Incoming call subscription:",
                        status
                    );

                }
            );

}


/* ============================================================
   17. HANDLE INCOMING PARTICIPANT
   ============================================================ */

async function handleIncomingParticipant(
    participant
) {

    if (!participant) {

        return;

    }


    if (
        participant.user_id !==
        CallState.currentUser?.id
    ) {

        return;

    }


    if (
        participant.status ===
        PARTICIPANT_STATUS.LEFT
    ) {

        return;

    }


    /*
     * Do not interrupt an existing call.
     */

    if (
        CallState.isInCall &&
        CallState.currentRoom &&
        CallState.currentRoom.id !==
            participant.room_id
    ) {

        callWarn(
            "Incoming call while already in another call."
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
            participant.room_id
        )

        .maybeSingle();


    if (error || !room) {

        callWarn(
            "Incoming call room unavailable."
        );

        return;

    }


    if (
        room.status ===
        CALL_STATUS.ENDED
    ) {

        return;

    }


    showIncomingCall(
        room,
        participant
    );

}


/* ============================================================
   18. ACCEPT INCOMING CALL
   ============================================================ */

export async function acceptIncomingCall(
    roomId
) {

    hideIncomingCall();


    CallState.isCaller =
        false;


    return await joinCallRoom(
        roomId
    );

}


/* ============================================================
   19. DECLINE INCOMING CALL
   ============================================================ */

export async function declineIncomingCall(
    participantId
) {

    if (!participantId) {

        hideIncomingCall();

        return;

    }


    const {
        error
    } = await supabase

        .from(
            "chat_call_participants"
        )

        .update({

            status:
                PARTICIPANT_STATUS.DECLINED,

            left_at:
                new Date()
                    .toISOString()

        })

        .eq(
            "id",
            participantId
        );


    if (error) {

        callError(
            "Unable to decline call:",
            error
        );

    }


    hideIncomingCall();

}


/* ============================================================
   20. CREATE PEER CONNECTION
   ============================================================ */

async function createPeerConnection(
    remoteUserId,
    createOffer = false
) {

    if (!remoteUserId) {

        return null;

    }


    if (
        remoteUserId ===
        CallState.currentUser?.id
    ) {

        return null;

    }


    /*
     * Reuse existing peer.
     */

    if (
        CallState.peerConnections.has(
            remoteUserId
        )
    ) {

        return (
            CallState.peerConnections.get(
                remoteUserId
            )
        );

    }


    const peerConnection =
        new RTCPeerConnection(
            CallState.configuration
        );


    CallState.peerConnections.set(
        remoteUserId,
        peerConnection
    );


    /*
     * Local media will be added by Part 2.
     *
     * If localStream already exists,
     * add its tracks now.
     */

    if (
        CallState.localStream
    ) {

        for (
            const track
            of CallState.localStream.getTracks()
        ) {

            peerConnection.addTrack(
                track,
                CallState.localStream
            );

        }

    }


    /*
     * Remote track.
     */

    peerConnection.ontrack =
        event => {

            callLog(
                "Remote track received:",
                remoteUserId
            );


            const [
                remoteStream
            ] = event.streams;


            if (!remoteStream) {

                return;

            }


            CallState.remoteStreams.set(
                remoteUserId,
                remoteStream
            );


            handleRemoteStream(
                remoteUserId,
                remoteStream
            );

        };


    /*
     * ICE candidate.
     */

    peerConnection.onicecandidate =
        async event => {

            if (
                !event.candidate
            ) {

                return;

            }


            await sendSignal({

                roomId:
                    CallState.currentRoom?.id,

                receiverId:
                    remoteUserId,

                signalType:
                    "ice-candidate",

                payload:
                    event.candidate.toJSON()

            });

        };


    /*
     * Connection state.
     */

    peerConnection.onconnectionstatechange =
        () => {

            callLog(
                "Peer connection:",
                remoteUserId,
                peerConnection.connectionState
            );


            if (
                peerConnection.connectionState ===
                    "failed"
            ) {

                callWarn(
                    "Peer connection failed:",
                    remoteUserId
                );

            }


            if (
                peerConnection.connectionState ===
                    "disconnected"
            ) {

                callWarn(
                    "Peer disconnected:",
                    remoteUserId
                );

            }


            if (
                peerConnection.connectionState ===
                    "closed"
            ) {

                removePeerConnection(
                    remoteUserId
                );

            }

        };


    /*
     * Signaling state.
     */

    peerConnection.onsignalingstatechange =
        () => {

            callLog(
                "Signaling state:",
                remoteUserId,
                peerConnection.signalingState
            );

        };


    /*
     * Caller creates offer.
     */

    if (createOffer) {

        try {

            const offer =
                await peerConnection.createOffer({

                    offerToReceiveAudio:
                        true,

                    offerToReceiveVideo:
                        true

                });


            await peerConnection.setLocalDescription(
                offer
            );


            await sendSignal({

                roomId:
                    CallState.currentRoom?.id,

                receiverId:
                    remoteUserId,

                signalType:
                    "offer",

                payload:
                    offer

            });

        }

        catch (error) {

            callError(
                "Unable to create WebRTC offer:",
                error
            );

        }

    }


    return peerConnection;

}


/* ============================================================
   21. HANDLE INCOMING WEBRTC SIGNAL
   ============================================================ */

async function handleIncomingSignal(
    signal
) {

    if (!signal) {

        return;

    }


    const currentUserId =
        CallState.currentUser?.id;


    if (!currentUserId) {

        return;

    }


    /*
     * Ignore our own signals.
     */

    if (
        signal.sender_id ===
        currentUserId
    ) {

        return;

    }


    /*
     * Ignore signals intended for
     * somebody else.
     */

    if (
        signal.receiver_id &&
        signal.receiver_id !==
            currentUserId
    ) {

        return;

    }


    if (
        !CallState.currentRoom ||
        signal.room_id !==
            CallState.currentRoom.id
    ) {

        return;

    }


    const remoteUserId =
        signal.sender_id;


    try {

        switch (
            signal.signal_type
        ) {

            case "join":

                await handleRemoteJoin(
                    remoteUserId
                );

                break;


            case "offer":

                await handleOffer(
                    remoteUserId,
                    signal.payload
                );

                break;


            case "answer":

                await handleAnswer(
                    remoteUserId,
                    signal.payload
                );

                break;


            case "ice-candidate":

                await handleIceCandidate(
                    remoteUserId,
                    signal.payload
                );

                break;


            case "leave":

                await handleRemoteLeave(
                    remoteUserId
                );

                break;


            case "renegotiate":

                await handleRenegotiation(
                    remoteUserId,
                    signal.payload
                );

                break;


            default:

                callWarn(
                    "Unknown call signal:",
                    signal.signal_type
                );

        }

    }

    catch (error) {

        callError(
            "Signal handling error:",
            error
        );

    }

}


/* ============================================================
   22. REMOTE USER JOINED
   ============================================================ */

async function handleRemoteJoin(
    remoteUserId
) {

    if (!remoteUserId) {

        return;

    }


    /*
     * Existing participants create offers.
     */

    if (
        CallState.initializedPeerUsers.has(
            remoteUserId
        )
    ) {

        return;

    }


    CallState.initializedPeerUsers.add(
        remoteUserId
    );


    await createPeerConnection(
        remoteUserId,
        true
    );

}


/* ============================================================
   23. HANDLE OFFER
   ============================================================ */

async function handleOffer(
    remoteUserId,
    offer
) {

    if (
        !remoteUserId ||
        !offer
    ) {

        return;

    }


    const peerConnection =
        await createPeerConnection(
            remoteUserId,
            false
        );


    if (!peerConnection) {

        return;

    }


    try {

        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(
                offer
            )
        );


        await flushPendingIceCandidates(
            remoteUserId
        );


        const answer =
            await peerConnection.createAnswer();


        await peerConnection.setLocalDescription(
            answer
        );


        await sendSignal({

            roomId:
                CallState.currentRoom?.id,

            receiverId:
                remoteUserId,

            signalType:
                "answer",

            payload:
                answer

        });

    }

    catch (error) {

        callError(
            "Offer handling failed:",
            error
        );

    }

}


/* ============================================================
   24. HANDLE ANSWER
   ============================================================ */

async function handleAnswer(
    remoteUserId,
    answer
) {

    const peerConnection =
        CallState.peerConnections.get(
            remoteUserId
        );


    if (!peerConnection) {

        callWarn(
            "No peer connection for answer:",
            remoteUserId
        );

        return;

    }


    try {

        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(
                answer
            )
        );


        await flushPendingIceCandidates(
            remoteUserId
        );

    }

    catch (error) {

        callError(
            "Answer handling failed:",
            error
        );

    }

}


/* ============================================================
   25. HANDLE ICE CANDIDATE
   ============================================================ */

async function handleIceCandidate(
    remoteUserId,
    candidate
) {

    if (
        !remoteUserId ||
        !candidate
    ) {

        return;

    }


    const peerConnection =
        CallState.peerConnections.get(
            remoteUserId
        );


    if (
        !peerConnection ||
        !peerConnection.remoteDescription
    ) {

        if (
            !CallState.pendingIceCandidates.has(
                remoteUserId
            )
        ) {

            CallState.pendingIceCandidates.set(
                remoteUserId,
                []
            );

        }


        CallState.pendingIceCandidates
            .get(remoteUserId)
            .push(candidate);


        return;

    }


    try {

        await peerConnection.addIceCandidate(
            new RTCIceCandidate(
                candidate
            )
        );

    }

    catch (error) {

        callError(
            "Unable to add ICE candidate:",
            error
        );

    }

}


/* ============================================================
   26. FLUSH PENDING ICE
   ============================================================ */

async function flushPendingIceCandidates(
    remoteUserId
) {

    const candidates =
        CallState.pendingIceCandidates.get(
            remoteUserId
        );


    if (!candidates) {

        return;

    }


    const peerConnection =
        CallState.peerConnections.get(
            remoteUserId
        );


    if (!peerConnection) {

        return;

    }


    for (
        const candidate
        of candidates
    ) {

        try {

            await peerConnection.addIceCandidate(
                new RTCIceCandidate(
                    candidate
                )
            );

        }

        catch (error) {

            callWarn(
                "Pending ICE candidate failed:",
                error
            );

        }

    }


    CallState.pendingIceCandidates.delete(
        remoteUserId
    );

}


/* ============================================================
   27. REMOTE LEAVE
   ============================================================ */

async function handleRemoteLeave(
    remoteUserId
) {

    callLog(
        "Remote user left:",
        remoteUserId
    );


    removePeerConnection(
        remoteUserId
    );


    CallState.remoteStreams.delete(
        remoteUserId
    );


    handleRemoteStreamRemoved(
        remoteUserId
    );

}


/* ============================================================
   28. PARTICIPANT CHANGE
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
        participant.user_id ===
        CallState.currentUser?.id
    ) {

        return;

    }


    if (
        participant.status ===
        PARTICIPANT_STATUS.LEFT ||
        participant.status ===
        PARTICIPANT_STATUS.DECLINED
    ) {

        await handleRemoteLeave(
            participant.user_id
        );

    }

}


/* ============================================================
   29. SEND SIGNAL
   ============================================================ */

async function sendSignal({
    roomId,
    receiverId,
    signalType,
    payload
}) {

    const user =
        CallState.currentUser ||
        await getCurrentUser();


    if (!user) {

        return null;

    }


    if (!roomId) {

        callWarn(
            "Cannot send signal without room ID."
        );

        return null;

    }


    const {
        data,
        error
    } = await supabase

        .from(
            "chat_call_signals"
        )

        .insert({

            room_id:
                roomId,

            sender_id:
                user.id,

            receiver_id:
                receiverId,

            signal_type:
                signalType,

            payload:
                payload || {}

        })

        .select("*")

        .single();


    if (error) {

        callError(
            "Unable to send call signal:",
            error
        );

        return null;

    }


    return data;

}


/* ============================================================
   30. REMOVE PEER CONNECTION
   ============================================================ */

function removePeerConnection(
    remoteUserId
) {

    const peerConnection =
        CallState.peerConnections.get(
            remoteUserId
        );


    if (peerConnection) {

        try {

            peerConnection.close();

        }

        catch (error) {

            callWarn(
                "Peer close error:",
                error
            );

        }

    }


    CallState.peerConnections.delete(
        remoteUserId
    );


    CallState.initializedPeerUsers.delete(
        remoteUserId
    );


    CallState.remoteStreams.delete(
        remoteUserId
    );


    CallState.pendingIceCandidates.delete(
        remoteUserId
    );


    handleRemoteStreamRemoved(
        remoteUserId
    );

}


/* ============================================================
   31. REMOTE STREAM CALLBACK
   ============================================================ */

function handleRemoteStream(
    remoteUserId,
    remoteStream
) {

    callLog(
        "Remote stream ready:",
        remoteUserId
    );


    /*
     * Part 2 will connect this to
     * participant video tiles.
     */

    window.dispatchEvent(
        new CustomEvent(
            "mwaniki:remote-stream",
            {
                detail: {

                    userId:
                        remoteUserId,

                    stream:
                        remoteStream

                }

            }
        )
    );

}


/* ============================================================
   32. REMOTE STREAM REMOVED
   ============================================================ */

function handleRemoteStreamRemoved(
    remoteUserId
) {

    window.dispatchEvent(
        new CustomEvent(
            "mwaniki:remote-stream-removed",
            {
                detail: {

                    userId:
                        remoteUserId

                }

            }
        )
    );

}


/* ============================================================
   33. ACCEPTED ROOM / UI HOOK
   ============================================================ */

function showCallPanel(
    room
) {

    window.dispatchEvent(
        new CustomEvent(
            "mwaniki:call-started",
            {
                detail: {
                    room
                }
            }
        )
    );


    /*
     * If Part 2 UI exists already,
     * activate it.
     */

    const panel =
        document.querySelector(
            "#callPanel"
        );


    if (panel) {

        panel.classList.add(
            "active"
        );

        panel.removeAttribute(
            "hidden"
        );

    }

}


/* ============================================================
   34. INCOMING CALL UI HOOK
   ============================================================ */

function showIncomingCall(
    room,
    participant
) {

    window.dispatchEvent(
        new CustomEvent(
            "mwaniki:incoming-call",
            {
                detail: {

                    room,

                    participant

                }

            }
        )
    );


    const incoming =
        document.querySelector(
            "#incomingCallPanel"
        );


    if (incoming) {

        incoming.dataset.roomId =
            room.id;

        incoming.dataset.participantId =
            participant.id;

        incoming.classList.add(
            "active"
        );

        incoming.removeAttribute(
            "hidden"
        );

    }


    callLog(
        "Incoming call:",
        room.id
    );

}


/* ============================================================
   35. HIDE INCOMING CALL
   ============================================================ */

function hideIncomingCall() {

    const incoming =
        document.querySelector(
            "#incomingCallPanel"
        );


    if (!incoming) {

        return;

    }


    incoming.classList.remove(
        "active"
    );

    incoming.setAttribute(
        "hidden",
        "hidden"
    );

}


/* ============================================================
   36. CALL ERROR
   ============================================================ */

function showCallError(
    message
) {

    window.dispatchEvent(
        new CustomEvent(
            "mwaniki:call-error",
            {
                detail: {
                    message
                }
            }
        )
    );


    const errorElement =
        document.querySelector(
            "#callError"
        );


    if (errorElement) {

        errorElement.textContent =
            message;

        errorElement.classList.add(
            "active"
        );

    }

}


/* ============================================================
   37. HANDLE RENEGOTIATION
   ============================================================ */

async function handleRenegotiation(
    remoteUserId,
    payload
) {

    if (!payload) {

        return;

    }


    const peerConnection =
        CallState.peerConnections.get(
            remoteUserId
        );


    if (!peerConnection) {

        return;

    }


    if (
        payload.type === "offer"
    ) {

        await handleOffer(
            remoteUserId,
            payload
        );

    }

}


/* ============================================================
   38. LEAVE CURRENT CALL
   ============================================================ */

export async function leaveCurrentCall() {

    if (
        !CallState.currentRoom
    ) {

        return;

    }


    if (
        CallState.isEndingCall
    ) {

        return;

    }


    CallState.isEndingCall =
        true;


    const roomId =
        CallState.currentRoom.id;


    const userId =
        CallState.currentUser?.id;


    try {

        /*
         * Tell peers.
         */

        await sendSignal({

            roomId,

            receiverId:
                null,

            signalType:
                "leave",

            payload: {

                userId,

                timestamp:
                    Date.now()

            }

        });


        /*
         * Mark ourselves as left.
         */

        if (userId) {

            await supabase

                .from(
                    "chat_call_participants"
                )

                .update({

                    status:
                        PARTICIPANT_STATUS.LEFT,

                    left_at:
                        new Date()
                            .toISOString()

                })

                .eq(
                    "room_id",
                    roomId
                )

                .eq(
                    "user_id",
                    userId
                );

        }


        /*
         * Close peer connections.
         */

        for (
            const remoteUserId
            of CallState.peerConnections.keys()
        ) {

            removePeerConnection(
                remoteUserId
            );

        }


        /*
         * Remove room subscription.
         */

        await removeCallRoomSubscription();


        CallState.isInCall =
            false;


        window.dispatchEvent(
            new CustomEvent(
                "mwaniki:call-left",
                {
                    detail: {
                        roomId
                    }
                }
            )
        );


    }

    catch (error) {

        callError(
            "Error leaving call:",
            error
        );

    }

    finally {

        CallState.currentRoom =
            null;

        CallState.currentParticipant =
            null;

        CallState.currentCommunityId =
            null;

        CallState.currentCallScope =
            null;

        CallState.currentCallType =
            null;

        CallState.isCaller =
            false;

        CallState.isInCall =
            false;

        CallState.isEndingCall =
            false;

    }

}


/* ============================================================
   39. END CALL
   ============================================================ */

export async function endCurrentCall() {

    const room =
        CallState.currentRoom;


    if (!room) {

        return;

    }


    try {

        await leaveCurrentCall();


        await supabase

            .from(
                "chat_call_rooms"
            )

            .update({

                status:
                    CALL_STATUS.ENDED,

                ended_at:
                    new Date()
                        .toISOString()

            })

            .eq(
                "id",
                room.id
            );


    }

    catch (error) {

        callError(
            "Unable to end call:",
            error
        );

    }

}


/* ============================================================
   40. CLEANUP CALL STATE
   ============================================================ */

async function cleanupCallState() {

    try {

        await removeCallRoomSubscription();


        if (
            CallState.incomingCallSubscription
        ) {

            await supabase.removeChannel(
                CallState.incomingCallSubscription
            );

        }

    }

    catch (error) {

        callWarn(
            "Call cleanup subscription error:",
            error
        );

    }


    CallState.incomingCallSubscription =
        null;


    for (
        const remoteUserId
        of CallState.peerConnections.keys()
    ) {

        removePeerConnection(
            remoteUserId
        );

    }


    if (
        CallState.localStream
    ) {

        for (
            const track
            of CallState.localStream.getTracks()
        ) {

            track.stop();

        }

    }


    CallState.localStream =
        null;

    CallState.currentRoom =
        null;

    CallState.currentParticipant =
        null;

    CallState.isInCall =
        false;

    CallState.initializedPeerUsers.clear();

    CallState.pendingIceCandidates.clear();

}


/* ============================================================
   41. PUBLIC API
   ============================================================ */

window.MwanikiCalls = {

    startGeneralCall,

    startCommunityCall,

    joinCallRoom,

    acceptIncomingCall,

    declineIncomingCall,

    leaveCurrentCall,

    endCurrentCall,

    initializeCallingSystem,

    getState: () => CallState

};


/* ============================================================
   42. AUTO INITIALIZATION
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        callLog(
            "Community calling module loaded."
        );


        /*
         * Wait briefly for Supabase/auth
         * initialization from the main app.
         */

        setTimeout(
            async () => {

                await initializeCallingSystem();

            },
            300
        );

    }
);


/* ============================================================
   END PART 1
   ============================================================ */

/* ============================================================
   MWANIKI SCHOLARS
   COMMUNITY.JS
   REAL CALLING ENGINE — PART 2
   ============================================================

   PART 2 COMPLETES:

   ✓ Microphone
   ✓ Camera
   ✓ Screen sharing
   ✓ Local video
   ✓ Remote participant tiles
   ✓ Remote audio
   ✓ Mute
   ✓ Camera toggle
   ✓ Screen-share toggle
   ✓ Call controls
   ✓ Incoming-call controls
   ✓ General Call button
   ✓ Community Voice button
   ✓ Community Video button
   ✓ Participant status
   ✓ Peer renegotiation
   ✓ Call cleanup
   ✓ Room cleanup
   ✓ Browser unload cleanup

   REQUIRES PART 1 ABOVE THIS CODE.
   ============================================================ */


/* ============================================================
   43. CALL UI STATE
   ============================================================ */

const CallUIState = {

    root: null,

    incomingPanel: null,

    activePanel: null,

    stage: null,

    localTile: null,

    participantsContainer: null,

    statusElement: null,

    titleElement: null,

    timerElement: null,

    muteButton: null,

    cameraButton: null,

    screenButton: null,

    leaveButton: null,

    endButton: null,

    generalButton: null,

    voiceButton: null,

    videoButton: null,

    incomingAcceptButton: null,

    incomingDeclineButton: null,

    timerInterval: null,

    callStartedAt: null

};


/* ============================================================
   44. CREATE CALL INTERFACE
   ============================================================ */

function ensureCallInterface() {

    /*
     * If the page already has the interface,
     * use it.
     */

    let root =
        document.querySelector(
            "#mwanikiCallInterface"
        );


    if (!root) {

        root =
            document.createElement(
                "div"
            );

        root.id =
            "mwanikiCallInterface";

        root.innerHTML = `
            <div
                id="mwanikiCallBackdrop"
                class="mwaniki-call-backdrop"
                hidden
            ></div>

            <section
                id="incomingCallPanel"
                class="mwaniki-incoming-call"
                hidden
                aria-live="polite"
            >

                <div class="mwaniki-incoming-icon">
                    📞
                </div>

                <div class="mwaniki-incoming-content">

                    <strong
                        id="incomingCallTitle"
                    >
                        Incoming call
                    </strong>

                    <span
                        id="incomingCallSubtitle"
                    >
                        Someone is calling you
                    </span>

                </div>

                <div class="mwaniki-incoming-actions">

                    <button
                        id="acceptIncomingCallButton"
                        type="button"
                    >
                        Accept
                    </button>

                    <button
                        id="declineIncomingCallButton"
                        type="button"
                    >
                        Decline
                    </button>

                </div>

            </section>


            <section
                id="callPanel"
                class="mwaniki-call-panel"
                hidden
                aria-label="Active call"
            >

                <header
                    class="mwaniki-call-header"
                >

                    <div>

                        <strong
                            id="callTitle"
                        >
                            Mwaniki Call
                        </strong>

                        <span
                            id="callStatus"
                        >
                            Connecting...
                        </span>

                    </div>

                    <div
                        id="callTimer"
                    >
                        00:00
                    </div>

                </header>


                <main
                    id="callStage"
                    class="mwaniki-call-stage"
                >

                    <div
                        id="callParticipants"
                        class="mwaniki-call-participants"
                    ></div>

                </main>


                <footer
                    class="mwaniki-call-controls"
                >

                    <button
                        id="callMuteButton"
                        type="button"
                        title="Mute microphone"
                    >
                        🎤
                        <span>Mute</span>
                    </button>

                    <button
                        id="callCameraButton"
                        type="button"
                        title="Turn camera on"
                    >
                        📹
                        <span>Camera</span>
                    </button>

                    <button
                        id="callScreenButton"
                        type="button"
                        title="Share screen"
                    >
                        🖥️
                        <span>Share</span>
                    </button>

                    <button
                        id="callLeaveButton"
                        type="button"
                        title="Leave call"
                    >
                        🚪
                        <span>Leave</span>
                    </button>

                    <button
                        id="callEndButton"
                        type="button"
                        title="End call"
                    >
                        ☎️
                        <span>End</span>
                    </button>

                </footer>

            </section>


            <button
                id="generalCallButton"
                class="mwaniki-general-call-button"
                type="button"
                title="Start General Call"
            >
                📞
                <span>General Call</span>
            </button>

        `;

        document.body.appendChild(
            root
        );

    }


    CallUIState.root =
        root;


    CallUIState.incomingPanel =
        root.querySelector(
            "#incomingCallPanel"
        );


    CallUIState.activePanel =
        root.querySelector(
            "#callPanel"
        );


    CallUIState.stage =
        root.querySelector(
            "#callStage"
        );


    CallUIState.participantsContainer =
        root.querySelector(
            "#callParticipants"
        );


    CallUIState.statusElement =
        root.querySelector(
            "#callStatus"
        );


    CallUIState.titleElement =
        root.querySelector(
            "#callTitle"
        );


    CallUIState.timerElement =
        root.querySelector(
            "#callTimer"
        );


    CallUIState.muteButton =
        root.querySelector(
            "#callMuteButton"
        );


    CallUIState.cameraButton =
        root.querySelector(
            "#callCameraButton"
        );


    CallUIState.screenButton =
        root.querySelector(
            "#callScreenButton"
        );


    CallUIState.leaveButton =
        root.querySelector(
            "#callLeaveButton"
        );


    CallUIState.endButton =
        root.querySelector(
            "#callEndButton"
        );


    CallUIState.generalButton =
        root.querySelector(
            "#generalCallButton"
        );


    CallUIState.incomingAcceptButton =
        root.querySelector(
            "#acceptIncomingCallButton"
        );


    CallUIState.incomingDeclineButton =
        root.querySelector(
            "#declineIncomingCallButton"
        );


    bindCallUIEvents();

}


/* ============================================================
   45. BIND CALL UI EVENTS
   ============================================================ */

function bindCallUIEvents() {

    if (
        CallUIState.muteButton
    ) {

        CallUIState.muteButton.onclick =
            toggleCallMute;

    }


    if (
        CallUIState.cameraButton
    ) {

        CallUIState.cameraButton.onclick =
            toggleCallCamera;

    }


    if (
        CallUIState.screenButton
    ) {

        CallUIState.screenButton.onclick =
            toggleCallScreen;

    }


    if (
        CallUIState.leaveButton
    ) {

        CallUIState.leaveButton.onclick =
            async () => {

                await leaveCallAndCloseUI();

            };

    }


    if (
        CallUIState.endButton
    ) {

        CallUIState.endButton.onclick =
            async () => {

                await endCallAndCloseUI();

            };

    }


    if (
        CallUIState.generalButton
    ) {

        CallUIState.generalButton.onclick =
            async () => {

                await startGeneralCall(
                    CALL_TYPE.VIDEO
                );

            };

    }


    if (
        CallUIState.incomingAcceptButton
    ) {

        CallUIState.incomingAcceptButton.onclick =
            async () => {

                const roomId =
                    CallUIState.incomingPanel
                        ?.dataset
                        ?.roomId;


                if (!roomId) {

                    return;

                }


                await acceptIncomingCall(
                    roomId
                );

            };

    }


    if (
        CallUIState.incomingDeclineButton
    ) {

        CallUIState.incomingDeclineButton.onclick =
            async () => {

                const participantId =
                    CallUIState.incomingPanel
                        ?.dataset
                        ?.participantId;


                await declineIncomingCall(
                    participantId
                );

            };

    }


    /*
     * Existing community buttons.
     */

    const voiceButtons =
        document.querySelectorAll(
            "#voiceCallButton, [data-call-type='voice']"
        );


    voiceButtons.forEach(
        button => {

            if (
                button.dataset
                    .mwanikiCallBound
            ) {

                return;

            }


            button.dataset
                .mwanikiCallBound =
                "true";


            button.addEventListener(
                "click",
                async event => {

                    event.preventDefault();


                    const communityId =
                        getCurrentCommunityIdFromPage();


                    if (!communityId) {

                        showCallError(
                            "Select a community before starting a community call."
                        );

                        return;

                    }


                    await startCommunityCall(
                        communityId,
                        getCurrentCommunityNameFromPage(),
                        CALL_TYPE.VOICE
                    );

                }
            );

        }
    );


    const videoButtons =
        document.querySelectorAll(
            "#videoCallButton, [data-call-type='video']"
        );


    videoButtons.forEach(
        button => {

            if (
                button.dataset
                    .mwanikiCallBound
            ) {

                return;

            }


            button.dataset
                .mwanikiCallBound =
                "true";


            button.addEventListener(
                "click",
                async event => {

                    event.preventDefault();


                    const communityId =
                        getCurrentCommunityIdFromPage();


                    if (!communityId) {

                        showCallError(
                            "Select a community before starting a community call."
                        );

                        return;

                    }


                    await startCommunityCall(
                        communityId,
                        getCurrentCommunityNameFromPage(),
                        CALL_TYPE.VIDEO
                    );

                }
            );

        }
    );

}


/* ============================================================
   46. FIND CURRENT COMMUNITY
   ============================================================ */

function getCurrentCommunityIdFromPage() {

    /*
     * First use calling state.
     */

    if (
        CallState.currentCommunityId
    ) {

        return CallState.currentCommunityId;

    }


    /*
     * Try common DOM locations.
     */

    const elements = [

        "#communityId",

        "#currentCommunityId",

        "[data-community-id]",

        "[data-current-community-id]"

    ];


    for (
        const selector
        of elements
    ) {

        const element =
            document.querySelector(
                selector
            );


        if (!element) {

            continue;

        }


        const value =
            element.dataset.communityId ||
            element.dataset.currentCommunityId ||
            element.value ||
            element.textContent?.trim();


        if (value) {

            return value;

        }

    }


    /*
     * Try existing global community state.
     */

    if (
        window.mwanikiCommunity?.state
            ?.currentCommunity?.id
    ) {

        return (
            window.mwanikiCommunity
                .state
                .currentCommunity
                .id
        );

    }


    return null;

}


/* ============================================================
   47. FIND CURRENT COMMUNITY NAME
   ============================================================ */

function getCurrentCommunityNameFromPage() {

    if (
        CallState.currentCommunityName
    ) {

        return CallState.currentCommunityName;

    }


    if (
        window.mwanikiCommunity?.state
            ?.currentCommunity?.name
    ) {

        return (
            window.mwanikiCommunity
                .state
                .currentCommunity
                .name
        );

    }


    const element =
        document.querySelector(
            "#communityName, [data-community-name]"
        );


    if (element) {

        return (
            element.dataset.communityName ||
            element.textContent?.trim() ||
            ""
        );

    }


    return "Mwaniki Scholars Community";

}


/* ============================================================
   48. REQUEST LOCAL MEDIA
   ============================================================ */

async function requestLocalMedia(
    callType
) {

    /*
     * Reuse existing stream.
     */

    if (
        CallState.localStream
    ) {

        return CallState.localStream;

    }


    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        throw new Error(
            "Your browser does not support microphone/camera access."
        );

    }


    let stream;


    if (
        callType ===
        CALL_TYPE.VOICE
    ) {

        stream =
            await navigator.mediaDevices
                .getUserMedia({

                    audio: true,

                    video: false

                });

    }

    else {

        stream =
            await navigator.mediaDevices
                .getUserMedia({

                    audio: true,

                    video: true

                });

    }


    CallState.localStream =
        stream;


    /*
     * Update participant status.
     */

    if (
        CallState.currentParticipant
    ) {

        await updateOwnParticipant({

            isMuted:
                false,

            isCameraOn:
                stream
                    .getVideoTracks()
                    .some(
                        track =>
                            track.enabled
                    )

        });

    }


    /*
     * Add tracks to all current peers.
     */

    await addLocalTracksToPeers();


    return stream;

}


/* ============================================================
   49. ADD LOCAL TRACKS TO PEERS
   ============================================================ */

async function addLocalTracksToPeers() {

    if (
        !CallState.localStream
    ) {

        return;

    }


    for (
        const [
            remoteUserId,
            peerConnection
        ]
        of CallState.peerConnections
    ) {

        const senders =
            peerConnection.getSenders();


        for (
            const track
            of CallState.localStream.getTracks()
        ) {

            const existingSender =
                senders.find(
                    sender =>
                        sender.track?.kind ===
                        track.kind
                );


            if (
                existingSender
            ) {

                try {

                    await existingSender.replaceTrack(
                        track
                    );

                }

                catch (error) {

                    callWarn(
                        "Unable to replace track:",
                        error
                    );

                }

            }

            else {

                peerConnection.addTrack(
                    track,
                    CallState.localStream
                );

            }

        }


        /*
         * Renegotiate after adding tracks.
         */

        await renegotiatePeer(
            remoteUserId
        );

    }

}


/* ============================================================
   50. START MEDIA FOR CURRENT CALL
   ============================================================ */

async function startCallMedia() {

    if (
        !CallState.currentRoom
    ) {

        return;

    }


    try {

        await requestLocalMedia(
            CallState.currentRoom.call_type
        );


        attachLocalVideo();


        updateCallStatus(
            "Connected"
        );

    }

    catch (error) {

        callError(
            "Media access failed:",
            error
        );


        /*
         * A voice call may continue if
         * camera access was denied.
         */

        if (
            CallState.currentRoom.call_type ===
            CALL_TYPE.VOICE
        ) {

            try {

                CallState.localStream =
                    await navigator.mediaDevices
                        .getUserMedia({

                            audio: true,

                            video: false

                        });


                await addLocalTracksToPeers();


                updateCallStatus(
                    "Connected — audio only"
                );

            }

            catch (voiceError) {

                showCallError(
                    "Microphone access was denied."
                );

            }

        }

        else {

            showCallError(
                "Camera or microphone access was denied."
            );

        }

    }

}


/* ============================================================
   51. ATTACH LOCAL VIDEO
   ============================================================ */

function attachLocalVideo() {

    if (
        !CallUIState.participantsContainer
    ) {

        return;

    }


    let tile =
        document.querySelector(
            "#mwanikiLocalParticipant"
        );


    if (!tile) {

        tile =
            createParticipantTile(
                "local",
                "You"
            );

        tile.id =
            "mwanikiLocalParticipant";


        CallUIState.participantsContainer
            .prepend(tile);

    }


    let video =
        tile.querySelector(
            "video"
        );


    if (!video) {

        video =
            document.createElement(
                "video"
            );

        video.autoplay =
            true;

        video.playsInline =
            true;

        video.muted =
            true;

        tile.appendChild(
            video
        );

    }


    video.srcObject =
        CallState.localStream;


    /*
     * Voice-only call does not need
     * a visible black video tile.
     */

    const hasVideo =
        CallState.localStream
            ?.getVideoTracks()
            ?.length > 0;


    tile.classList.toggle(
        "voice-only",
        !hasVideo
    );

}


/* ============================================================
   52. CREATE PARTICIPANT TILE
   ============================================================ */

function createParticipantTile(
    userId,
    displayName
) {

    const tile =
        document.createElement(
            "article"
        );


    tile.className =
        "mwaniki-participant-tile";


    tile.dataset.userId =
        userId;


    tile.innerHTML = `

        <div
            class="mwaniki-participant-media"
        >

            <video
                autoplay
                playsinline
            ></video>

            <div
                class="mwaniki-participant-avatar"
            >
                ${escapeCallHTML(
                    getInitials(displayName)
                )}
            </div>

        </div>


        <div
            class="mwaniki-participant-footer"
        >

            <span
                class="mwaniki-participant-name"
            >
                ${escapeCallHTML(displayName)}
            </span>

            <span
                class="mwaniki-participant-state"
            >
                Connected
            </span>

        </div>

    `;


    return tile;

}


/* ============================================================
   53. REMOTE STREAM UI
   ============================================================ */

function updateRemoteParticipantTile(
    userId,
    stream,
    displayName = "Participant"
) {

    if (
        !CallUIState.participantsContainer
    ) {

        return;

    }


    let tile =
        CallUIState.participantsContainer
            .querySelector(
                `[data-user-id="${CSS.escape(userId)}"]`
            );


    if (!tile) {

        tile =
            createParticipantTile(
                userId,
                displayName
            );


        CallUIState.participantsContainer
            .appendChild(
                tile
            );

    }


    const video =
        tile.querySelector(
            "video"
        );


    if (video) {

        if (
            video.srcObject !== stream
        ) {

            video.srcObject =
                stream;

        }


        /*
         * Video element can also play
         * remote audio.
         */

        video.muted =
            false;

    }


    const hasVideo =
        stream
            ?.getVideoTracks()
            ?.some(
                track =>
                    track.enabled
            );


    tile.classList.toggle(
        "voice-only",
        !hasVideo
    );


    const avatar =
        tile.querySelector(
            ".mwaniki-participant-avatar"
        );


    if (avatar) {

        avatar.style.display =
            hasVideo
                ? "none"
                : "flex";

    }

}


/* ============================================================
   54. OVERRIDE REMOTE STREAM HANDLER
   ============================================================ */

window.addEventListener(
    "mwaniki:remote-stream",
    event => {

        const detail =
            event.detail || {};


        if (
            !detail.userId ||
            !detail.stream
        ) {

            return;

        }


        updateRemoteParticipantTile(
            detail.userId,
            detail.stream
        );

    }
);


/* ============================================================
   55. REMOTE STREAM REMOVAL
   ============================================================ */

window.addEventListener(
    "mwaniki:remote-stream-removed",
    event => {

        const userId =
            event.detail?.userId;


        if (!userId) {

            return;

        }


        const tile =
            CallUIState
                .participantsContainer
                ?.querySelector(
                    `[data-user-id="${CSS.escape(userId)}"]`
                );


        if (tile) {

            tile.remove();

        }

    }
);


/* ============================================================
   56. TOGGLE MUTE
   ============================================================ */

async function toggleCallMute() {

    if (
        !CallState.localStream
    ) {

        return;

    }


    const audioTracks =
        CallState.localStream
            .getAudioTracks();


    if (!audioTracks.length) {

        return;

    }


    const currentlyEnabled =
        audioTracks.some(
            track =>
                track.enabled
        );


    const newEnabled =
        !currentlyEnabled;


    audioTracks.forEach(
        track => {

            track.enabled =
                newEnabled;

        }
    );


    const muted =
        !newEnabled;


    await updateOwnParticipant({

        isMuted:
            muted

    });


    updateMuteButton(
        muted
    );


    updateCallStatus(
        muted
            ? "Microphone muted"
            : "Microphone active"
    );

}


/* ============================================================
   57. TOGGLE CAMERA
   ============================================================ */

async function toggleCallCamera() {

    if (
        !CallState.localStream
    ) {

        /*
         * If the current call is voice-only,
         * request camera dynamically.
         */

        try {

            CallState.localStream =
                await navigator.mediaDevices
                    .getUserMedia({

                        audio: true,

                        video: true

                    });


            await addLocalTracksToPeers();

            attachLocalVideo();

        }

        catch (error) {

            showCallError(
                "Unable to access the camera."
            );

            return;

        }

    }


    const videoTracks =
        CallState.localStream
            .getVideoTracks();


    if (!videoTracks.length) {

        try {

            const cameraStream =
                await navigator.mediaDevices
                    .getUserMedia({

                        video: true

                    });


            const cameraTrack =
                cameraStream
                    .getVideoTracks()[0];


            if (!cameraTrack) {

                return;

            }


            const existingVideoSender =
                findVideoSenders();


            if (
                existingVideoSender.length
            ) {

                for (
                    const sender
                    of existingVideoSender
                ) {

                    await sender.replaceTrack(
                        cameraTrack
                    );

                }

            }

            else {

                for (
                    const [
                        remoteUserId,
                        peerConnection
                    ]
                    of CallState.peerConnections
                ) {

                    peerConnection.addTrack(
                        cameraTrack,
                        CallState.localStream
                    );


                    await renegotiatePeer(
                        remoteUserId
                    );

                }

            }


            CallState.localStream.addTrack(
                cameraTrack
            );


            attachLocalVideo();


            await updateOwnParticipant({

                isCameraOn:
                    true

            });


            updateCameraButton(
                true
            );


            return;

        }

        catch (error) {

            showCallError(
                "Camera access was denied."
            );

            return;

        }

    }


    const currentlyEnabled =
        videoTracks.some(
            track =>
                track.enabled
        );


    const newEnabled =
        !currentlyEnabled;


    videoTracks.forEach(
        track => {

            track.enabled =
                newEnabled;

        }
    );


    await updateOwnParticipant({

        isCameraOn:
            newEnabled

    });


    updateCameraButton(
        newEnabled
    );


    attachLocalVideo();

}


/* ============================================================
   58. FIND VIDEO SENDERS
   ============================================================ */

function findVideoSenders() {

    const senders = [];


    for (
        const peerConnection
        of CallState.peerConnections.values()
    ) {

        const videoSenders =
            peerConnection
                .getSenders()
                .filter(
                    sender =>
                        sender.track?.kind ===
                        "video"
                );


        senders.push(
            ...videoSenders
        );

    }


    return senders;

}


/* ============================================================
   59. TOGGLE SCREEN SHARING
   ============================================================ */

async function toggleCallScreen() {

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices
            .getDisplayMedia
    ) {

        showCallError(
            "Screen sharing is not supported by this browser."
        );

        return;

    }


    /*
     * Stop screen sharing if already active.
     */

    if (
        CallState.screenStream
    ) {

        await stopScreenSharing();

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
            screenStream
                .getVideoTracks()[0];


        if (!screenTrack) {

            return;

        }


        CallState.screenStream =
            screenStream;


        const videoSenders =
            findVideoSenders();


        /*
         * Replace existing camera track.
         */

        for (
            const sender
            of videoSenders
        ) {

            await sender.replaceTrack(
                screenTrack
            );

        }


        /*
         * If no video sender exists,
         * add screen to every peer.
         */

        if (
            videoSenders.length === 0
        ) {

            for (
                const [
                    remoteUserId,
                    peerConnection
                ]
                of CallState.peerConnections
            ) {

                peerConnection.addTrack(
                    screenTrack,
                    screenStream
                );


                await renegotiatePeer(
                    remoteUserId
                );

            }

        }


        /*
         * Display our screen locally.
         */

        const localVideo =
            document.querySelector(
                "#mwanikiLocalParticipant video"
            );


        if (localVideo) {

            localVideo.srcObject =
                screenStream;

        }


        await updateOwnParticipant({

            isScreenSharing:
                true

        });


        updateScreenButton(
            true
        );


        /*
         * Browser fires this when user clicks
         * "Stop sharing" from the browser UI.
         */

        screenTrack.onended =
            async () => {

                await stopScreenSharing();

            };


        updateCallStatus(
            "You are sharing your screen"
        );

    }

    catch (error) {

        callWarn(
            "Screen sharing cancelled or failed:",
            error
        );

    }

}


/* ============================================================
   60. STOP SCREEN SHARING
   ============================================================ */

async function stopScreenSharing() {

    if (
        !CallState.screenStream
    ) {

        return;

    }


    for (
        const track
        of CallState.screenStream.getTracks()
    ) {

        track.stop();

    }


    CallState.screenStream =
        null;


    /*
     * Restore camera if available.
     */

    const cameraTrack =
        CallState.localStream
            ?.getVideoTracks()
            ?.find(
                track =>
                    track.readyState ===
                    "live"
            );


    const videoSenders =
        findVideoSenders();


    for (
        const sender
        of videoSenders
    ) {

        try {

            await sender.replaceTrack(
                cameraTrack || null
            );

        }

        catch (error) {

            callWarn(
                "Unable to restore camera:",
                error
            );

        }

    }


    const localVideo =
        document.querySelector(
            "#mwanikiLocalParticipant video"
        );


    if (
        localVideo &&
        CallState.localStream
    ) {

        localVideo.srcObject =
            CallState.localStream;

    }


    await updateOwnParticipant({

        isScreenSharing:
            false

    });


    updateScreenButton(
        false
    );


    updateCallStatus(
        "Screen sharing stopped"
    );

}


/* ============================================================
   61. UPDATE OWN PARTICIPANT
   ============================================================ */

async function updateOwnParticipant(
    values
) {

    if (
        !CallState.currentParticipant ||
        !CallState.currentUser
    ) {

        return;

    }


    const {
        error
    } = await supabase

        .from(
            "chat_call_participants"
        )

        .update(
            values
        )

        .eq(
            "id",
            CallState.currentParticipant.id
        );


    if (error) {

        callWarn(
            "Unable to update participant:",
            error
        );

        return;

    }


    CallState.currentParticipant = {

        ...CallState.currentParticipant,

        ...values

    };

}


/* ============================================================
   62. RENEGOTIATE PEER
   ============================================================ */

async function renegotiatePeer(
    remoteUserId
) {

    const peerConnection =
        CallState.peerConnections.get(
            remoteUserId
        );


    if (!peerConnection) {

        return;

    }


    /*
     * Avoid creating offers while another
     * offer is being negotiated.
     */

    if (
        peerConnection.signalingState !==
        "stable"
    ) {

        return;

    }


    try {

        const offer =
            await peerConnection.createOffer({

                offerToReceiveAudio:
                    true,

                offerToReceiveVideo:
                    true

            });


        await peerConnection.setLocalDescription(
            offer
        );


        await sendSignal({

            roomId:
                CallState.currentRoom?.id,

            receiverId:
                remoteUserId,

            signalType:
                "renegotiate",

            payload:
                offer

        });

    }

    catch (error) {

        callWarn(
            "Peer renegotiation failed:",
            error
        );

    }

}


/* ============================================================
   63. UPDATE MUTE BUTTON
   ============================================================ */

function updateMuteButton(
    muted
) {

    const button =
        CallUIState.muteButton;


    if (!button) {

        return;

    }


    button.classList.toggle(
        "active",
        muted
    );


    button.innerHTML =
        muted
            ? "🔇 <span>Unmute</span>"
            : "🎤 <span>Mute</span>";


    button.setAttribute(
        "aria-label",
        muted
            ? "Unmute microphone"
            : "Mute microphone"
    );

}


/* ============================================================
   64. UPDATE CAMERA BUTTON
   ============================================================ */

function updateCameraButton(
    enabled
) {

    const button =
        CallUIState.cameraButton;


    if (!button) {

        return;

    }


    button.classList.toggle(
        "active",
        enabled
    );


    button.innerHTML =
        enabled
            ? "📹 <span>Camera On</span>"
            : "📷 <span>Camera Off</span>";

}


/* ============================================================
   65. UPDATE SCREEN BUTTON
   ============================================================ */

function updateScreenButton(
    sharing
) {

    const button =
        CallUIState.screenButton;


    if (!button) {

        return;

    }


    button.classList.toggle(
        "active",
        sharing
    );


    button.innerHTML =
        sharing
            ? "⏹️ <span>Stop Share</span>"
            : "🖥️ <span>Share</span>";

}


/* ============================================================
   66. CALL STATUS
   ============================================================ */

function updateCallStatus(
    status
) {

    if (
        CallUIState.statusElement
    ) {

        CallUIState.statusElement
            .textContent =
            status;

    }

}


/* ============================================================
   67. START CALL TIMER
   ============================================================ */

function startCallTimer() {

    stopCallTimer();


    CallUIState.callStartedAt =
        Date.now();


    CallUIState.timerInterval =
        setInterval(
            () => {

                const elapsed =
                    Math.floor(
                        (
                            Date.now() -
                            CallUIState.callStartedAt
                        ) / 1000
                    );


                const minutes =
                    Math.floor(
                        elapsed / 60
                    )
                        .toString()
                        .padStart(
                            2,
                            "0"
                        );


                const seconds =
                    (
                        elapsed % 60
                    )
                        .toString()
                        .padStart(
                            2,
                            "0"
                        );


                if (
                    CallUIState.timerElement
                ) {

                    CallUIState.timerElement
                        .textContent =
                        `${minutes}:${seconds}`;

                }

            },
            1000
        );

}


/* ============================================================
   68. STOP CALL TIMER
   ============================================================ */

function stopCallTimer() {

    if (
        CallUIState.timerInterval
    ) {

        clearInterval(
            CallUIState.timerInterval
        );

    }


    CallUIState.timerInterval =
        null;

    CallUIState.callStartedAt =
        null;


    if (
        CallUIState.timerElement
    ) {

        CallUIState.timerElement
            .textContent =
            "00:00";

    }

}


/* ============================================================
   69. ACTIVE CALL UI
   ============================================================ */

function activateCallUI(
    room
) {

    ensureCallInterface();


    const panel =
        CallUIState.activePanel;


    if (!panel) {

        return;

    }


    panel.removeAttribute(
        "hidden"
    );


    panel.classList.add(
        "active"
    );


    const title =
        room.call_scope ===
            CALL_SCOPE.GENERAL

            ? "Mwaniki General Call"

            : (
                CallState.currentCommunityName ||
                "Community Call"
            );


    if (
        CallUIState.titleElement
    ) {

        CallUIState.titleElement
            .textContent =
            title;

    }


    updateCallStatus(
        "Connecting..."
    );


    startCallTimer();


    document.body.classList.add(
        "mwaniki-call-active"
    );


    startCallMedia();

}


/* ============================================================
   70. INCOMING CALL UI
   ============================================================ */

function activateIncomingCallUI(
    room,
    participant
) {

    ensureCallInterface();


    const panel =
        CallUIState.incomingPanel;


    if (!panel) {

        return;

    }


    panel.dataset.roomId =
        room.id;


    panel.dataset.participantId =
        participant.id;


    const title =
        room.call_scope ===
            CALL_SCOPE.GENERAL

            ? "Incoming General Call"

            : "Incoming Community Call";


    const titleElement =
        panel.querySelector(
            "#incomingCallTitle"
        );


    const subtitleElement =
        panel.querySelector(
            "#incomingCallSubtitle"
        );


    if (titleElement) {

        titleElement.textContent =
            title;

    }


    if (subtitleElement) {

        subtitleElement.textContent =
            room.call_type ===
                CALL_TYPE.VOICE

                ? "Incoming voice call"

                : "Incoming video call";

    }


    panel.removeAttribute(
        "hidden"
    );


    panel.classList.add(
        "active"
    );

}


/* ============================================================
   71. REPLACE INCOMING UI FUNCTION
   ============================================================ */

window.addEventListener(
    "mwaniki:incoming-call",
    event => {

        const {
            room,
            participant
        } =
            event.detail || {};


        if (
            room &&
            participant
        ) {

            activateIncomingCallUI(
                room,
                participant
            );

        }

    }
);


/* ============================================================
   72. REPLACE CALL START UI
   ============================================================ */

window.addEventListener(
    "mwaniki:call-started",
    event => {

        const room =
            event.detail?.room ||
            CallState.currentRoom;


        if (room) {

            activateCallUI(
                room
            );

        }

    }
);


/* ============================================================
   73. CALL LEFT UI
   ============================================================ */

window.addEventListener(
    "mwaniki:call-left",
    () => {

        closeCallInterface();

    }
);


/* ============================================================
   74. CLOSE CALL INTERFACE
   ============================================================ */

function closeCallInterface() {

    stopCallTimer();


    if (
        CallState.localStream
    ) {

        for (
            const track
            of CallState.localStream.getTracks()
        ) {

            track.stop();

        }

    }


    if (
        CallState.screenStream
    ) {

        for (
            const track
            of CallState.screenStream.getTracks()
        ) {

            track.stop();

        }

    }


    CallState.localStream =
        null;

    CallState.screenStream =
        null;


    if (
        CallUIState.participantsContainer
    ) {

        CallUIState.participantsContainer
            .innerHTML =
            "";

    }


    if (
        CallUIState.activePanel
    ) {

        CallUIState.activePanel
            .classList.remove(
                "active"
            );

        CallUIState.activePanel
            .setAttribute(
                "hidden",
                "hidden"
            );

    }


    hideIncomingCall();


    document.body.classList.remove(
        "mwaniki-call-active"
    );

}


/* ============================================================
   75. LEAVE CALL AND CLOSE UI
   ============================================================ */

async function leaveCallAndCloseUI() {

    await leaveCurrentCall();

    closeCallInterface();

}


/* ============================================================
   76. END CALL AND CLOSE UI
   ============================================================ */

async function endCallAndCloseUI() {

    await endCurrentCall();

    closeCallInterface();

}


/* ============================================================
   77. ESCAPE HTML
   ============================================================ */

function escapeCallHTML(
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


/* ============================================================
   78. INITIALS
   ============================================================ */

function getInitials(
    name
) {

    const cleaned =
        String(
            name || "Participant"
        )
            .trim();


    const parts =
        cleaned.split(
            /\s+/
        );


    if (
        parts.length === 1
    ) {

        return parts[0]
            .substring(
                0,
                2
            )
            .toUpperCase();

    }


    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    )
        .toUpperCase();

}


/* ============================================================
   79. BROWSER UNLOAD CLEANUP
   ============================================================ */

window.addEventListener(
    "beforeunload",
    () => {

        /*
         * Stop local media immediately.
         */

        if (
            CallState.localStream
        ) {

            CallState.localStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

        }


        if (
            CallState.screenStream
        ) {

            CallState.screenStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

        }

    }
);


/* ============================================================
   80. INITIALIZE CALL UI
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        ensureCallInterface();


        /*
         * Existing page controls may already
         * exist before this module initializes.
         */

        setTimeout(
            () => {

                bindCallUIEvents();

            },
            500
        );

    }
);


/* ============================================================
   81. PUBLIC CALL CONTROLS
   ============================================================ */

window.MwanikiCalls = {

    ...(window.MwanikiCalls || {}),

    startGeneralCall,

    startCommunityCall,

    joinCallRoom,

    acceptIncomingCall,

    declineIncomingCall,

    leaveCurrentCall,

    endCurrentCall,

    toggleMute:
        toggleCallMute,

    toggleCamera:
        toggleCallCamera,

    toggleScreenShare:
        toggleCallScreen,

    getState:
        () => CallState

};


/* ============================================================
   82. FINAL CALL INITIALIZATION
   ============================================================ */

setTimeout(
    () => {

        try {

            ensureCallInterface();

            bindCallUIEvents();

            callLog(
                "======================================"
            );

            callLog(
                "REAL CALLING UI READY"
            );

            callLog(
                "General Call: READY"
            );

            callLog(
                "Community Calls: READY"
            );

            callLog(
                "Voice: READY"
            );

            callLog(
                "Video: READY"
            );

            callLog(
                "Screen Share: READY"
            );

            callLog(
                "WebRTC: READY"
            );

            callLog(
                "Supabase Signaling: READY"
            );

            callLog(
                "======================================"
            );

        }

        catch (error) {

            callError(
                "Calling UI initialization failed:",
                error
            );

        }

    },
    800
);


/* ============================================================
   END CALLING ENGINE — PART 2
   ============================================================ */


