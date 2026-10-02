/* =========================================================
   MWANIKI SCHOLARS COMMUNITY
   COMPLETE CLEAN COMMUNITY ENGINE

   FIXED:
   1. Frozen voice/video call button
   2. WebRTC signaling race
   3. ICE candidate race
   4. Emoji picker closes by:
        - emoji button
        - X button
        - clicking outside
        - Escape
   5. Photo uploads
   6. Document uploads
   7. Gaming community icon
   8. Memes community icon
   9. Own-message deletion
   10. Realtime message updates
   11. Realtime call invitations
   12. Independent community calls
   13. Independent general calls
   14. Screen sharing
   15. Microphone/camera controls
   16. Message search
   17. Reply support
   18. Presence heartbeat
   19. Community switching
   20. Channel switching

   DATABASE RELATIONSHIPS:

   chat_messages.user_id
          ↓
   students.id

   chat_presence.user_id
          ↓
   students.id

   IMPORTANT:
   Do NOT use students.user_id.
   ========================================================= */

(() => {
    "use strict";

    /* =========================================================
       CONFIGURATION
       ========================================================= */

     CONFIG = {

        dashboardUrl:
            "./dashboard.html",

        profileUrl:
            "./profile.html",

        messageLimit:
            500,

        presenceHeartbeat:
            30000,

        onlineWindowMs:
            90000,

        attachmentBucket:
            "community-attachments",

        maxAttachmentBytes:
            25 * 1024 * 1024,

        rtcConfiguration: {

            iceServers: [

                {
                    urls: [
                        "stun:stun.l.google.com:19302",
                        "stun:stun1.l.google.com:19302"
                    ]
                }

            ]
        },

        defaultAvatar:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(`
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="96"
                    height="96"
                    viewBox="0 0 96 96"
                >
                    <rect
                        width="96"
                        height="96"
                        rx="48"
                        fill="#087f73"
                    />

                    <circle
                        cx="48"
                        cy="35"
                        r="17"
                        fill="#ffffff"
                    />

                    <path
                        d="M18 82c4-18 16-27 30-27s26 9 30 27"
                        fill="#ffffff"
                    />
                </svg>
            `)
    };


    /* =========================================================
       APPLICATION STATE
       ========================================================= */

    const state = {

        supabase:
            null,

        user:
            null,

        profile:
            null,

        communities:
            [],

        channels:
            [],

        messages:
            [],

        selectedCommunity:
            null,

        selectedChannel:
            null,

        searchTerm:
            "",

        initialized:
            false,

        messageSending:
            false,

        communityModalOpen:
            false,

        emojiPickerOpen:
            false,

        presenceTimer:
            null,

        realtimeChannels:
            [],

        pendingGeneralCallType:
            "video",

        incomingCall:
            null,

        replyMessage:
            null,

        call: {

            active:
                false,

            connecting:
                false,

            roomId:
                null,

            roomCode:
                null,

            callType:
                null,

            scope:
                null,

            communityId:
                null,

            startedAt:
                null,

            timer:
                null,

            localStream:
                null,

            screenStream:
                null,

            microphoneEnabled:
                true,

            cameraEnabled:
                true,

            screenSharing:
                false,

            peerConnections:
                new Map(),

            pendingIce:
                new Map(),

            remoteStreams:
                new Map(),

            roomChannel:
                null,

            participantChannel:
                null
        }
    };


    /* =========================================================
       DOM
       ========================================================= */

    const dom = {};

    const IDS = [

        "communityApp",

        "homeButton",
        "railHomeButton",
        "railGeneralButton",

        "communityRailList",
        "communityRail",

        "railProfileButton",
        "railProfileAvatar",

        "openCommunityButton",

        "channelSearchInput",
        "channelList",

        "communitySelectorButton",

        "selectedCommunityIcon",
        "selectedCommunityName",
        "selectedCommunityDescription",

        "sidebarProfileAvatar",
        "sidebarProfileName",

        "dashboardButton",
        "headerCommunityButton",

        "mainChannelTitle",
        "mainChannelDescription",

        "messageList",
        "messageInput",
        "sendMessageButton",

        "attachButton",
        "emojiButton",
        "attachmentInput",

        "startConversationButton",
        "welcomeStartButton",

        "communityModal",
        "closeCommunityModal",
        "communityChoiceList",
        "communityModalSearch",

        "accessibilityAnnouncer",
        "communityStatus",

        "messageForm",
        "channelLoadingState",

        "sidebarProfileButton",

        "communityBrandTitle",
        "communityBrandSubtitle",

        "generalCallButton",

        "createCommunityButton",

        "channelSidebar",

        "activeCommunityIcon",
        "activeCommunityName",
        "activeCommunityDescription",

        "communityCourseBanner",
        "communityCourseName",
        "communityCourseLabel",

        "createChannelButton",

        "communityMain",

        "channelToggleButton",

        "activeChannelName",
        "activeRoleBadge",
        "activeChannelDescription",

        "voiceCallButton",
        "videoCallButton",

        "chatSearchButton",
        "memberToggleButton",

        "callOverlay",
        "callTypeIcon",
        "callTitle",
        "callSubtitle",
        "callDuration",

        "minimizeCallButton",

        "callVideoGrid",
        "localVideoTile",
        "localVideo",

        "callParticipants",

        "toggleMicrophoneButton",
        "toggleCameraButton",
        "shareScreenButton",
        "leaveCallButton",

        "generalCallModal",
        "closeGeneralCallModalButton",

        "generalVoiceCallButton",
        "generalVideoCallButton",

        "generalCallMessage",

        "cancelGeneralCallButton",
        "startGeneralCallButton",

        "generalCallUserList",
        "generalCallUserStatus",
        "generalCallSelectionCount",

        "incomingCallToast",
        "incomingCallTitle",
        "incomingCallText",

        "acceptCallButton",
        "declineCallButton",

        "replyPreview",
        "replyPreviewText",
        "cancelReplyButton",

        "communityToast",

        "messageSearchPanel",
        "messageSearchInput",
        "closeMessageSearchButton",

        "memberSidebar",
        "communityDrawerOverlay",

        "memberSearchInput",
        "memberList"
    ];


    IDS.forEach(
        id => {
            dom[id] =
                document.getElementById(
                    id
                );
        }
    );


    /* =========================================================
       UTILITIES
       ========================================================= */

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


    function safeUrl(
        value
    ) {

        const url =
            String(
                value || ""
            ).trim();

        if (
            /^(https?:\/\/|data:image\/)/i
                .test(url)
        ) {
            return url;
        }

        return CONFIG.defaultAvatar;
    }


    function initials(
        name
    ) {

        const parts =
            String(
                name ||
                "Student"
            )
                .trim()
                .split(
                    /\s+/
                )
                .filter(
                    Boolean
                );

        if (
            !parts.length
        ) {
            return "MS";
        }

        if (
            parts.length === 1
        ) {
            return parts[0]
                .slice(
                    0,
                    2
                )
                .toUpperCase();
        }

        return (
            parts[0][0] +
            parts[
                parts.length - 1
            ][0]
        ).toUpperCase();
    }


    function formatTime(
        value
    ) {

        if (!value) {
            return "";
        }

        const date =
            new Date(
                value
            );

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
        }

        return date.toLocaleTimeString(
            [],
            {
                hour:
                    "2-digit",

                minute:
                    "2-digit"
            }
        );
    }


    function formatDate(
        value
    ) {

        if (!value) {
            return "";
        }

        const date =
            new Date(
                value
            );

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
        }

        return date.toLocaleDateString(
            [],
            {
                day:
                    "numeric",

                month:
                    "short",

                year:
                    "numeric"
            }
        );
    }


    function storageGet(
        key
    ) {

        try {

            return localStorage.getItem(
                key
            );

        } catch {

            return null;
        }
    }


    function storageSet(
        key,
        value
    ) {

        try {

            localStorage.setItem(
                key,
                String(
                    value
                )
            );

        } catch {}
    }


    function normalizeProfile(
        profile
    ) {

        if (!profile) {
            return null;
        }

        return {

            id:
                profile.id ||
                null,

            full_name:
                profile.full_name ||
                "Student",

            photo_url:
                profile.photo_url ||
                ""
        };
    }


    function setAvatar(
        image,
        url,
        name
    ) {

        if (!image) {
            return;
        }

        image.src =
            safeUrl(
                url
            );

        image.alt =
            `${name || "Student"} profile photo`;

        image.onerror =
            () => {

                image.onerror =
                    null;

                image.src =
                    CONFIG.defaultAvatar;
            };
    }


    function announce(
        message
    ) {

        if (
            !dom.accessibilityAnnouncer
        ) {
            return;
        }

        dom.accessibilityAnnouncer.textContent =
            "";

        setTimeout(
            () => {

                if (
                    dom.accessibilityAnnouncer
                ) {

                    dom.accessibilityAnnouncer.textContent =
                        message ||
                        "";
                }

            },
            10
        );
    }


    function setStatus(
        message
    ) {

        if (
            dom.communityStatus
        ) {

            dom.communityStatus.textContent =
                message ||
                "";
        }

        announce(
            message
        );
    }


    let toastTimer =
        null;


    function toast(
        message,
        type = "normal"
    ) {

        const element =
            dom.communityToast;

        if (!element) {

            console.log(
                `[Community ${type}]`,
                message
            );

            return;
        }

        element.textContent =
            message ||
            "";

        element.classList.add(
            "show",
            "visible",
            "active"
        );

        clearTimeout(
            toastTimer
        );

        toastTimer =
            setTimeout(
                () => {

                    element.classList.remove(
                        "show",
                        "visible",
                        "active"
                    );

                },
                3200
            );
    }


    /* =========================================================
       SUPABASE
       ========================================================= */

    async function waitForSupabase(
        timeout = 15000
    ) {

        const started =
            Date.now();

        while (
            Date.now() -
                started <
            timeout
        ) {

            const client =
                window.supabaseClient ||
                window.mwanikiSupabase ||
                window.sb ||
                window.supabase;

            if (
                client &&
                typeof client.from ===
                    "function" &&
                client.auth
            ) {

                state.supabase =
                    client;

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

        throw new Error(
            "Supabase client was not found. Check supabase.js before community.js."
        );
    }


    /* =========================================================
       AUTHENTICATION
       ========================================================= */

    async function loadAuthenticatedUser() {

        const {
            data,
            error
        } =
            await state.supabase
                .auth
                .getUser();

        if (error) {
            throw error;
        }

        if (
            !data ||
            !data.user
        ) {

            throw new Error(
                "No authenticated student was found."
            );
        }

        state.user =
            data.user;
    }


    /* =========================================================
       PROFILE
       ========================================================= */

    async function loadProfile() {

        const {
            data,
            error
        } =
            await state.supabase
                .from(
                    "students"
                )
                .select(
                    "id, full_name, photo_url"
                )
                .eq(
                    "id",
                    state.user.id
                )
                .maybeSingle();

        if (error) {

            console.warn(
                "Profile lookup failed:",
                error
            );
        }

        state.profile =
            normalizeProfile(
                data
            ) || {

                id:
                    state.user.id,

                full_name:
                    "Student",

                photo_url:
                    ""
            };


        [
            dom.sidebarProfileAvatar,
            dom.railProfileAvatar
        ].forEach(
            image => {

                setAvatar(
                    image,
                    state.profile.photo_url,
                    getProfileName()
                );
            }
        );


        if (
            dom.sidebarProfileName
        ) {

            dom.sidebarProfileName.textContent =
                getProfileName();
        }
    }


    function getProfileName() {

        return (
            state.profile?.full_name ||
            state.user?.user_metadata?.full_name ||
            "Student"
        );
    }


    function getProfilePhoto() {

        return safeUrl(
            state.profile?.photo_url
        );
    }


    /* =========================================================
       COMMUNITY ICONS
       ========================================================= */

    function communityIcon(
        community
    ) {

        const text =
            `${community?.name || ""} ${community?.slug || ""}`
                .toLowerCase();

        /*
         * IMPORTANT:
         * Gaming and Memes NEVER use icon_url.
         * This fixes them displaying student/avatar images.
         */

        if (
            text.includes(
                "gaming"
            ) ||
            text.includes(
                "game"
            )
        ) {

            return "🎮";
        }


        if (
            text.includes(
                "meme"
            )
        ) {

            return "😂";
        }


        if (
            text.includes(
                "general"
            )
        ) {

            return "💬";
        }


        if (
            text.includes(
                "mwaniki"
            ) ||
            text.includes(
                "medical"
            )
        ) {

            return "🎓";
        }


        return "🏫";
    }


    function iconMarkup(
        community
    ) {

        const text =
            `${community?.name || ""} ${community?.slug || ""}`
                .toLowerCase();

        const special =
            text.includes(
                "gaming"
            ) ||
            text.includes(
                "game"
            ) ||
            text.includes(
                "meme"
            );


        if (
            special ||
            !community?.icon_url
        ) {

            return `
                <span
                    class="community-symbol"
                    aria-hidden="true"
                >
                    ${escapeHtml(
                        communityIcon(
                            community
                        )
                    )}
                </span>
            `;
        }


        return `
            <img
                src="${safeUrl(
                    community.icon_url
                )}"
                alt=""
                aria-hidden="true"
                class="community-icon-image"
            >
        `;
    }


    /* =========================================================
       COMMUNITIES
       ========================================================= */

    async function loadCommunities() {

        const {
            data,
            error
        } =
            await state.supabase
                .from(
                    "chat_communities"
                )
                .select(
                    `
                    id,
                    name,
                    slug,
                    description,
                    icon_url,
                    banner_url,
                    is_public,
                    is_active,
                    created_by,
                    created_at,
                    updated_at
                    `
                )
                .eq(
                    "is_active",
                    true
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            true
                    }
                );

        if (error) {
            throw error;
        }

        state.communities =
            data || [];

        renderCommunityRail();
    }


    function renderCommunityRail() {

        const container =
            dom.communityRailList ||
            dom.communityRail;

        if (!container) {
            return;
        }

        container.innerHTML =
            "";

        state.communities.forEach(
            community => {

                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "community-rail-item";

                if (
                    state.selectedCommunity &&
                    String(
                        state.selectedCommunity.id
                    ) ===
                        String(
                            community.id
                        )
                ) {

                    button.classList.add(
                        "active"
                    );
                }

                button.dataset.communityId =
                    community.id;

                button.title =
                    community.name ||
                    "Community";

                button.setAttribute(
                    "aria-label",
                    community.name ||
                        "Community"
                );

                button.innerHTML =
                    iconMarkup(
                        community
                    );

                button.addEventListener(
                    "click",
                    () =>
                        selectCommunity(
                            community.id
                        )
                );

                container.appendChild(
                    button
                );
            }
        );
    }


    async function selectCommunity(
        communityId
    ) {

        const community =
            state.communities.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        communityId
                    )
            );

        if (!community) {
            return;
        }

        state.selectedCommunity =
            community;

        state.selectedChannel =
            null;

        state.messages =
            [];

        storageSet(
            "mwanikiCommunityId",
            community.id
        );

        renderCommunityRail();

        renderSelectedCommunity();

        await loadChannels(
            community.id
        );


        const general =
            state.channels.find(
                channel =>
                    String(
                        channel.name ||
                            ""
                    )
                        .trim()
                        .toLowerCase() ===
                    "general"
            );


        if (general) {

            await selectChannel(
                general.id
            );

        } else if (
            state.channels.length
        ) {

            await selectChannel(
                state.channels[0].id
            );

        } else {

            renderMessageArea();
        }


        resetCommunityRealtime();
    }


    function renderSelectedCommunity() {

        const community =
            state.selectedCommunity;

        if (!community) {
            return;
        }

        const name =
            community.name ||
            "Community";


        if (
            dom.selectedCommunityName
        ) {

            dom.selectedCommunityName.textContent =
                name;
        }


        if (
            dom.activeCommunityName
        ) {

            dom.activeCommunityName.textContent =
                name;
        }


        if (
            dom.communityBrandTitle
        ) {

            dom.communityBrandTitle.textContent =
                name;
        }


        if (
            dom.selectedCommunityDescription
        ) {

            dom.selectedCommunityDescription.textContent =
                community.description ||
                "";
        }


        if (
            dom.activeCommunityDescription
        ) {

            dom.activeCommunityDescription.textContent =
                community.description ||
                "";
        }


        [
            dom.selectedCommunityIcon,
            dom.activeCommunityIcon
        ].forEach(
            element => {

                if (!element) {
                    return;
                }

                const text =
                    `${community.name || ""} ${community.slug || ""}`
                        .toLowerCase();

                const special =
                    text.includes(
                        "gaming"
                    ) ||
                    text.includes(
                        "game"
                    ) ||
                    text.includes(
                        "meme"
                    );


                if (
                    special
                ) {

                    element.hidden =
                        true;

                    element.removeAttribute(
                        "src"
                    );

                } else if (
                    community.icon_url
                ) {

                    element.hidden =
                        false;

                    element.src =
                        safeUrl(
                            community.icon_url
                        );

                } else {

                    element.hidden =
                        true;

                    element.removeAttribute(
                        "src"
                    );
                }
            }
        );
    }


    /* =========================================================
       CHANNELS
       ========================================================= */

    async function loadChannels(
        communityId
    ) {

        if (!communityId) {

            state.channels =
                [];

            renderChannels();

            return;
        }


        const {
            data,
            error
        } =
            await state.supabase
                .from(
                    "chat_channels"
                )
                .select(
                    `
                    id,
                    community_id,
                    name,
                    slug,
                    description,
                    channel_type,
                    icon,
                    position,
                    is_private,
                    is_archived,
                    is_active,
                    course_id,
                    unit_id,
                    created_by,
                    created_at,
                    updated_at
                    `
                )
                .eq(
                    "community_id",
                    communityId
                )
                .eq(
                    "is_active",
                    true
                )
                .eq(
                    "is_archived",
                    false
                )
                .order(
                    "position",
                    {
                        ascending:
                            true
                    }
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            true
                    }
                );

        if (error) {
            throw error;
        }

        state.channels =
            data || [];

        renderChannels();
    }


    function renderChannels() {

        const list =
            dom.channelList;

        if (!list) {
            return;
        }

        list.innerHTML =
            "";

        const term =
            String(
                state.searchTerm ||
                    ""
            )
                .toLowerCase()
                .trim();


        const channels =
            state.channels.filter(
                channel => {

                    if (!term) {
                        return true;
                    }

                    return (
                        String(
                            channel.name ||
                                ""
                        )
                            .toLowerCase()
                            .includes(
                                term
                            ) ||
                        String(
                            channel.description ||
                                ""
                        )
                            .toLowerCase()
                            .includes(
                                term
                            )
                    );
                }
            );


        if (!channels.length) {

            list.innerHTML = `
                <div class="community-empty-state">
                    No channels found.
                </div>
            `;

            return;
        }


        channels.forEach(
            channel => {

                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "channel-item";


                if (
                    state.selectedChannel &&
                    String(
                        state.selectedChannel.id
                    ) ===
                        String(
                            channel.id
                        )
                ) {

                    button.classList.add(
                        "active"
                    );
                }


                button.dataset.channelId =
                    channel.id;


                const icon =
                    channel.icon ||
                    (
                        channel.channel_type ===
                        "voice"
                            ? "🔊"
                            : "#"
                    );


                button.innerHTML = `
                    <span
                        class="channel-item-icon"
                    >
                        ${escapeHtml(
                            icon
                        )}
                    </span>

                    <span
                        class="channel-item-text"
                    >
                        ${escapeHtml(
                            channel.name ||
                                "channel"
                        )}
                    </span>
                `;


                button.addEventListener(
                    "click",
                    () =>
                        selectChannel(
                            channel.id
                        )
                );


                list.appendChild(
                    button
                );
            }
        );
    }


    async function selectChannel(
        channelId
    ) {

        const channel =
            state.channels.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        channelId
                    )
            );

        if (!channel) {
            return;
        }

        state.selectedChannel =
            channel;

        state.messages =
            [];

        renderChannels();


        if (
            dom.mainChannelTitle
        ) {

            dom.mainChannelTitle.textContent =
                channel.name ||
                "Channel";
        }


        if (
            dom.activeChannelName
        ) {

            dom.activeChannelName.textContent =
                channel.name ||
                "Channel";
        }


        if (
            dom.mainChannelDescription
        ) {

            dom.mainChannelDescription.textContent =
                channel.description ||
                "";
        }


        if (
            dom.activeChannelDescription
        ) {

            dom.activeChannelDescription.textContent =
                channel.description ||
                "";
        }


        if (
            dom.activeRoleBadge
        ) {

            dom.activeRoleBadge.textContent =
                "Student";
        }


        if (
            dom.messageInput
        ) {

            dom.messageInput.placeholder =
                `Message #${
                    channel.name ||
                    "channel"
                }`;
        }


        await loadMessages(
            channel.id
        );

        subscribeToMessageRealtime(
            channel.id
        );

        markChannelRead(
            channel.id
        );
    }


    /* =========================================================
       MESSAGE PROFILES
       ========================================================= */

    async function attachProfiles(
        messages
    ) {

        const ids = [
            ...new Set(
                messages
                    .map(
                        message =>
                            message.user_id
                    )
                    .filter(
                        Boolean
                    )
            )
        ];


        const profileMap =
            new Map();


        if (
            state.user &&
            state.profile
        ) {

            profileMap.set(
                state.user.id,
                normalizeProfile(
                    state.profile
                )
            );
        }


        const missing =
            ids.filter(
                id =>
                    !profileMap.has(
                        id
                    )
            );


        if (
            missing.length
        ) {

            const {
                data
            } =
                await state.supabase
                    .from(
                        "students"
                    )
                    .select(
                        "id, full_name, photo_url"
                    )
                    .in(
                        "id",
                        missing
                    );


            (
                data ||
                []
            ).forEach(
                profile => {

                    profileMap.set(
                        profile.id,
                        normalizeProfile(
                            profile
                        )
                    );
                }
            );
        }


        return messages.map(
            message => ({

                ...message,

                profile:
                    profileMap.get(
                        message.user_id
                    ) ||
                    null
            })
        );
    }


    /* =========================================================
       MESSAGE LOADING
       ========================================================= */

    async function loadMessages(
        channelId
    ) {

        if (
            !channelId ||
            !dom.messageList
        ) {
            return;
        }


        if (
            dom.channelLoadingState
        ) {

            dom.channelLoadingState.hidden =
                false;
        }


        try {

            const {
                data,
                error
            } =
                await state.supabase
                    .from(
                        "chat_messages"
                    )
                    .select(
                        `
                        id,
                        channel_id,
                        user_id,
                        parent_message_id,
                        content,
                        message_type,
                        is_edited,
                        is_deleted,
                        is_pinned,
                        edited_at,
                        deleted_at,
                        created_at,
                        updated_at
                        `
                    )
                    .eq(
                        "channel_id",
                        channelId
                    )
                    .order(
                        "created_at",
                        {
                            ascending:
                                true
                        }
                    )
                    .limit(
                        CONFIG.messageLimit
                    );


            if (error) {
                throw error;
            }


            state.messages =
                await attachProfiles(
                    data ||
                        []
                );


            await loadAttachmentsForMessages();

            renderMessages();

        } catch (error) {

            console.error(
                "Message load failed:",
                error
            );

            state.messages =
                [];

            renderMessageArea();

            setStatus(
                "Messages could not be loaded."
            );

        } finally {

            if (
                dom.channelLoadingState
            ) {

                dom.channelLoadingState.hidden =
                    true;
            }
        }
    }


    /* =========================================================
       ATTACHMENT LOADING
       ========================================================= */

    async function loadAttachmentsForMessages() {

        const ids =
            state.messages
                .map(
                    message =>
                        message.id
                )
                .filter(
                    Boolean
                );


        if (!ids.length) {
            return;
        }


        const {
            data,
            error
        } =
            await state.supabase
                .from(
                    "chat_attachments"
                )
                .select(
                    "*"
                )
                .in(
                    "message_id",
                    ids
                );


        if (error) {

            console.warn(
                "Attachment lookup failed:",
                error
            );

            return;
        }


        const attachmentMap =
            new Map();


        (
            data ||
            []
        ).forEach(
            attachment => {

                const key =
                    String(
                        attachment.message_id
                    );

                if (
                    !attachmentMap.has(
                        key
                    )
                ) {

                    attachmentMap.set(
                        key,
                        []
                    );
                }

                attachmentMap
                    .get(
                        key
                    )
                    .push(
                        attachment
                    );
            }
        );


        state.messages =
            state.messages.map(
                message => ({

                    ...message,

                    attachments:
                        attachmentMap.get(
                            String(
                                message.id
                            )
                        ) ||
                        []
                })
            );
    }


    /* =========================================================
       MESSAGE RENDERING
       ========================================================= */

    function renderMessageArea() {

        if (
            dom.messageList
        ) {

            renderMessages();
        }
    }


    function formatContent(
        text
    ) {

        return escapeHtml(
            text ||
                ""
        )
            .replace(
                /\n/g,
                "<br>"
            )
            .replace(
                /(^|[\s])@([a-zA-Z0-9._-]+)/g,
                '$1<span class="mention">@$2</span>'
            );
    }


    function attachmentMarkup(
        attachments = []
    ) {

        return attachments
            .map(
                attachment => {

                    const url =
                        attachment.file_url ||
                        attachment.public_url ||
                        attachment.url ||
                        "";

                    const name =
                        attachment.file_name ||
                        attachment.name ||
                        "Attachment";

                    const type =
                        attachment.mime_type ||
                        attachment.file_type ||
                        "";


                    if (!url) {
                        return "";
                    }


                    if (
                        type.startsWith(
                            "image/"
                        )
                    ) {

                        return `
                            <a
                                class="message-attachment image-attachment"
                                href="${escapeHtml(
                                    url
                                )}"
                                target="_blank"
                                rel="noopener"
                            >
                                <img
                                    src="${escapeHtml(
                                        url
                                    )}"
                                    alt="${escapeHtml(
                                        name
                                    )}"
                                    loading="lazy"
                                >
                            </a>
                        `;
                    }


                    return `
                        <a
                            class="message-attachment file-attachment"
                            href="${escapeHtml(
                                url
                            )}"
                            target="_blank"
                            rel="noopener"
                        >
                            <span>
                                📎
                            </span>

                            <span>
                                <strong>
                                    ${escapeHtml(
                                        name
                                    )}
                                </strong>

                                <small>
                                    ${escapeHtml(
                                        type ||
                                            "File"
                                    )}
                                </small>
                            </span>
                        </a>
                    `;
                }
            )
            .join("");
    }


    function canDelete(
        message
    ) {

        return Boolean(
            state.user &&
            String(
                message.user_id
            ) ===
                String(
                    state.user.id
                )
        );
    }


    function canPin() {

        return [
            "moderator",
            "admin",
            "super_admin",
            "tutor"
        ].includes(
            String(
                state.currentRole ||
                    "student"
            ).toLowerCase()
        );
    }


    function createMessageElement(
        message
    ) {

        const article =
            document.createElement(
                "article"
            );

        article.className =
            "community-message";


        if (
            canDelete(
                message
            )
        ) {

            article.classList.add(
                "own-message"
            );
        }


        article.dataset.messageId =
            message.id;


        const profile =
            message.profile ||
            {};


        const senderName =
            profile.full_name ||
            "Unknown member";


        const senderAvatar =
            safeUrl(
                profile.photo_url
            );


        const deleted =
            Boolean(
                message.is_deleted
            );


        let actions =
            "";


        if (!deleted) {

            actions = `

                <div
                    class="message-actions"
                >

                    <button
                        type="button"
                        data-message-action="reply"
                        data-message-id="${escapeHtml(
                            message.id
                        )}"
                        title="Reply"
                    >
                        ↩
                    </button>

                    ${
                        canPin()
                            ? `
                                <button
                                    type="button"
                                    data-message-action="pin"
                                    data-message-id="${escapeHtml(
                                        message.id
                                    )}"
                                    title="${
                                        message.is_pinned
                                            ? "Unpin"
                                            : "Pin"
                                    }"
                                >
                                    ${
                                        message.is_pinned
                                            ? "📌"
                                            : "📍"
                                    }
                                </button>
                            `
                            : ""
                    }

                    ${
                        canDelete(
                            message
                        )
                            ? `
                                <button
                                    type="button"
                                    data-message-action="delete"
                                    data-message-id="${escapeHtml(
                                        message.id
                                    )}"
                                    title="Delete"
                                >
                                    🗑
                                </button>
                            `
                            : ""
                    }

                </div>
            `;
        }


        article.innerHTML = `

            <img
                class="message-avatar"
                src="${senderAvatar}"
                alt="${escapeHtml(
                    senderName
                )} profile photo"
            >

            <div
                class="message-body"
            >

                <div
                    class="message-header"
                >

                    <strong
                        class="message-author"
                    >
                        ${escapeHtml(
                            senderName
                        )}
                    </strong>

                    <time
                        class="message-time"
                    >
                        ${escapeHtml(
                            formatTime(
                                message.created_at
                            )
                        )}
                    </time>

                    ${
                        message.is_pinned
                            ? `
                                <span
                                    class="message-pin"
                                >
                                    📌
                                </span>
                            `
                            : ""
                    }

                </div>


                ${
                    deleted
                        ? `
                            <div
                                class="message-content deleted-message"
                            >
                                This message was deleted.
                            </div>
                        `
                        : `
                            <div
                                class="message-content"
                            >
                                ${formatContent(
                                    message.content
                                )}
                            </div>

                            ${attachmentMarkup(
                                message.attachments
                            )}
                        `
                }


                ${actions}

            </div>
        `;


        const image =
            article.querySelector(
                ".message-avatar"
            );


        if (image) {

            image.onerror =
                () => {

                    image.onerror =
                        null;

                    image.src =
                        CONFIG.defaultAvatar;
                };
        }


        return article;
    }


    function renderMessages() {

        if (
            !dom.messageList
        ) {
            return;
        }


        const searchTerm =
            String(
                dom.messageSearchInput?.value ||
                    ""
            )
                .trim()
                .toLowerCase();


        const messages =
            searchTerm
                ? state.messages.filter(
                    message =>
                        String(
                            message.content ||
                                ""
                        )
                            .toLowerCase()
                            .includes(
                                searchTerm
                            )
                )
                : state.messages;


        dom.messageList.innerHTML =
            "";


        if (
            !state.selectedChannel
        ) {

            dom.messageList.innerHTML = `

                <div
                    class="community-welcome"
                >

                    <div
                        class="welcome-icon"
                    >
                        🎓
                    </div>

                    <h2>
                        Welcome to Mwaniki Community
                    </h2>

                    <p>
                        Select a channel to start
                        learning, discussing and
                        collaborating.
                    </p>

                </div>
            `;

            return;
        }


        if (!messages.length) {

            dom.messageList.innerHTML = `

                <div
                    class="community-empty-messages"
                >

                    <div
                        class="empty-message-icon"
                    >
                        💬
                    </div>

                    <h3>
                        No messages yet
                    </h3>

                    <p>
                        Be the first to post
                        in this channel.
                    </p>

                </div>
            `;

            return;
        }


        let previousDate =
            "";


        messages.forEach(
            message => {

                const messageDate =
                    formatDate(
                        message.created_at
                    );


                if (
                    messageDate &&
                    messageDate !==
                        previousDate
                ) {

                    const divider =
                        document.createElement(
                            "div"
                        );

                    divider.className =
                        "message-date-divider";

                    divider.innerHTML = `
                        <span>
                            ${escapeHtml(
                                messageDate
                            )}
                        </span>
                    `;

                    dom.messageList.appendChild(
                        divider
                    );

                    previousDate =
                        messageDate;
                }


                dom.messageList.appendChild(
                    createMessageElement(
                        message
                    )
                );
            }
        );


        requestAnimationFrame(
            () => {

                dom.messageList.scrollTop =
                    dom.messageList.scrollHeight;
            }
        );
    }


    /* =========================================================
       SEND MESSAGE
       ========================================================= */

    async function sendMessage(
        event
    ) {

        if (event) {
            event.preventDefault();
        }


        if (
            state.messageSending
        ) {
            return;
        }


        if (!state.user) {

            setStatus(
                "Please sign in before sending a message."
            );

            return;
        }


        if (
            !state.selectedChannel
        ) {

            setStatus(
                "Select a channel first."
            );

            return;
        }


        const input =
            dom.messageInput;


        if (!input) {
            return;
        }


        const content =
            String(
                input.value ||
                    ""
            ).trim();


        if (!content) {
            return;
        }


        if (
            content.length >
            5000
        ) {

            toast(
                "Message is too long.",
                "error"
            );

            return;
        }


        state.messageSending =
            true;


        if (
            dom.sendMessageButton
        ) {

            dom.sendMessageButton.disabled =
                true;
        }


        try {

            const payload = {

                channel_id:
                    state.selectedChannel.id,

                user_id:
                    state.user.id,

                content,

                message_type:
                    "text"
            };


            if (
                state.replyMessage?.id
            ) {

                payload.parent_message_id =
                    state.replyMessage.id;
            }


            const {
                data,
                error
            } =
                await state.supabase
                    .from(
                        "chat_messages"
                    )
                    .insert(
                        payload
                    )
                    .select(
                        "*"
                    )
                    .single();


            if (error) {
                throw error;
            }


            input.value =
                "";

            cancelReply();


            if (
                !state.messages.some(
                    message =>
                        String(
                            message.id
                        ) ===
                        String(
                            data.id
                        )
                )
            ) {

                state.messages.push({

                    ...data,

                    profile:
                        normalizeProfile(
                            state.profile
                        ),

                    attachments:
                        []
                });

                renderMessages();
            }

        } catch (error) {

            console.error(
                "Send message failed:",
                error
            );

            toast(
                error.message ||
                    "Message could not be sent.",
                "error"
            );

        } finally {

            state.messageSending =
                false;

            if (
                dom.sendMessageButton
            ) {

                dom.sendMessageButton.disabled =
                    false;
            }
        }
    }


    /* =========================================================
       DELETE MESSAGE
       ========================================================= */

    async function deleteMessage(
        message
    ) {

        if (
            !message?.id ||
            !state.user
        ) {
            return;
        }


        /*
         * Students can delete their own messages.
         */

        if (
            String(
                message.user_id
            ) !==
            String(
                state.user.id
            )
        ) {

            toast(
                "You can only delete your own messages.",
                "error"
            );

            return;
        }


        const confirmed =
            window.confirm(
                "Delete this message?"
            );


        if (!confirmed) {
            return;
        }


        const now =
            new Date()
                .toISOString();


        /*
         * First try soft delete.
         */

        let result =
            await state.supabase
                .from(
                    "chat_messages"
                )
                .update({

                    is_deleted:
                        true,

                    deleted_at:
                        now,

                    updated_at:
                        now

                })
                .eq(
                    "id",
                    message.id
                )
                .eq(
                    "user_id",
                    state.user.id
                );


        /*
         * If soft delete is blocked,
         * try actual DELETE.
         */

        if (
            result.error
        ) {

            console.warn(
                "Soft delete failed. Trying hard delete:",
                result.error
            );


            result =
                await state.supabase
                    .from(
                        "chat_messages"
                    )
                    .delete()
                    .eq(
                        "id",
                        message.id
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    );
        }


        if (
            result.error
        ) {

            console.error(
                "Message deletion failed:",
                result.error
            );

            toast(
                "Unable to delete. Check the chat_messages RLS policy.",
                "error"
            );

            return;
        }


        state.messages =
            state.messages.filter(
                item =>
                    String(
                        item.id
                    ) !==
                    String(
                        message.id
                    )
            );


        renderMessages();


        toast(
            "Message deleted.",
            "success"
        );
    }


    /* =========================================================
       PIN MESSAGE
       ========================================================= */

    async function togglePin(
        message
    ) {

        if (!canPin()) {

            toast(
                "Only moderators, tutors and administrators can pin messages.",
                "error"
            );

            return;
        }


        const {
            error
        } =
            await state.supabase
                .from(
                    "chat_messages"
                )
                .update({

                    is_pinned:
                        !message.is_pinned,

                    updated_at:
                        new Date()
                            .toISOString()

                })
                .eq(
                    "id",
                    message.id
                );


        if (error) {

            toast(
                "Unable to update pinned status.",
                "error"
            );

            return;
        }


        message.is_pinned =
            !message.is_pinned;


        renderMessages();
    }


    /* =========================================================
       REPLY
       ========================================================= */

    function startReply(
        message
    ) {

        state.replyMessage =
            message;


        if (
            dom.replyPreview
        ) {

            dom.replyPreview.classList.remove(
                "hidden"
            );
        }


        if (
            dom.replyPreviewText
        ) {

            dom.replyPreviewText.textContent =
                String(
                    message.content ||
                        ""
                ).slice(
                    0,
                    160
                );
        }


        dom.messageInput?.focus();
    }


    function cancelReply() {

        state.replyMessage =
            null;


        if (
            dom.replyPreview
        ) {

            dom.replyPreview.classList.add(
                "hidden"
            );
        }
    }


    /* =========================================================
       MESSAGE ACTIONS
       ========================================================= */

    function bindMessageActionEvents() {

        if (
            !dom.messageList
        ) {
            return;
        }


        dom.messageList.addEventListener(
            "click",
            async event => {

                const button =
                    event.target.closest(
                        "[data-message-action]"
                    );


                if (!button) {
                    return;
                }


                const message =
                    state.messages.find(
                        item =>
                            String(
                                item.id
                            ) ===
                            String(
                                button.dataset.messageId
                            )
                    );


                if (!message) {
                    return;
                }


                event.preventDefault();

                event.stopPropagation();


                const action =
                    button.dataset.messageAction;


                if (
                    action ===
                    "delete"
                ) {

                    await deleteMessage(
                        message
                    );

                    return;
                }


                if (
                    action ===
                    "pin"
                ) {

                    await togglePin(
                        message
                    );

                    return;
                }


                if (
                    action ===
                    "reply"
                ) {

                    startReply(
                        message
                    );
                }
            }
        );
    }


    /* =========================================================
       ATTACHMENT INPUT
       ========================================================= */

    function ensureAttachmentInput() {

        if (
            dom.attachmentInput
        ) {

            return dom.attachmentInput;
        }


        const input =
            document.createElement(
                "input"
            );


        input.type =
            "file";


        input.id =
            "attachmentInput";


        input.hidden =
            true;


        input.multiple =
            true;


        input.accept =
            [
                "image/*",
                ".pdf",
                ".doc",
                ".docx",
                ".xls",
                ".xlsx",
                ".ppt",
                ".pptx",
                ".txt",
                ".csv",
                ".zip"
            ].join(",");


        document.body.appendChild(
            input
        );


        dom.attachmentInput =
            input;


        input.addEventListener(
            "change",
            () =>
                handleAttachmentFiles(
                    [
                        ...input.files
                    ]
                )
        );


        return input;
    }


    /* =========================================================
       ATTACHMENT UPLOAD
       ========================================================= */

    async function handleAttachmentFiles(
        files
    ) {

        if (!files.length) {
            return;
        }


        if (
            !state.user ||
            !state.selectedChannel
        ) {

            toast(
                "Select a channel first.",
                "error"
            );

            return;
        }


        for (
            const file of files
        ) {

            if (
                file.size >
                CONFIG.maxAttachmentBytes
            ) {

                toast(
                    `${file.name} is larger than 25 MB.`,
                    "error"
                );

                continue;
            }


            try {

                toast(
                    `Uploading ${file.name}...`
                );


                const safeName =
                    file.name.replace(
                        /[^a-zA-Z0-9._-]/g,
                        "_"
                    );


                const randomId =
                    crypto.randomUUID
                        ? crypto.randomUUID()
                        : Math.random()
                            .toString(
                                36
                            )
                            .slice(
                                2
                            );


                const path =
                    `${state.user.id}/${state.selectedChannel.id}/${Date.now()}-${randomId}-${safeName}`;


                /*
                 * Upload to Supabase Storage.
                 */

                const upload =
                    await state.supabase
                        .storage
                        .from(
                            CONFIG.attachmentBucket
                        )
                        .upload(
                            path,
                            file,
                            {

                                upsert:
                                    false,

                                contentType:
                                    file.type ||
                                    "application/octet-stream"
                            }
                        );


                if (
                    upload.error
                ) {

                    throw upload.error;
                }


                const {
                    data:
                        publicData
                } =
                    state.supabase
                        .storage
                        .from(
                            CONFIG.attachmentBucket
                        )
                        .getPublicUrl(
                            path
                        );


                const fileUrl =
                    publicData?.publicUrl;


                /*
                 * Create a chat message
                 * representing the attachment.
                 */

                const {
                    data:
                        message,
                    error:
                        messageError
                } =
                    await state.supabase
                        .from(
                            "chat_messages"
                        )
                        .insert({

                            channel_id:
                                state.selectedChannel.id,

                            user_id:
                                state.user.id,

                            content:
                                file.name,

                            message_type:
                                "file"

                        })
                        .select(
                            "*"
                        )
                        .single();


                if (
                    messageError
                ) {

                    throw messageError;
                }


                /*
                 * Different versions of the
                 * community schema may use
                 * uploaded_by or user_id.
                 *
                 * Try the known variants.
                 */

                const attachmentPayloads = [

                    {
                        message_id:
                            message.id,

                        uploaded_by:
                            state.user.id,

                        file_name:
                            file.name,

                        file_url:
                            fileUrl,

                        mime_type:
                            file.type ||
                            "application/octet-stream",

                        file_size:
                            file.size,

                        storage_path:
                            path
                    },

                    {
                        message_id:
                            message.id,

                        user_id:
                            state.user.id,

                        file_name:
                            file.name,

                        file_url:
                            fileUrl,

                        mime_type:
                            file.type ||
                            "application/octet-stream",

                        file_size:
                            file.size,

                        storage_path:
                            path
                    },

                    {
                        message_id:
                            message.id,

                        uploaded_by:
                            state.user.id,

                        file_name:
                            file.name,

                        file_url:
                            fileUrl,

                        file_type:
                            file.type ||
                            "application/octet-stream",

                        file_size:
                            file.size
                    }
                ];


                let attachmentError =
                    null;


                for (
                    const payload of
                        attachmentPayloads
                ) {

                    const result =
                        await state.supabase
                            .from(
                                "chat_attachments"
                            )
                            .insert(
                                payload
                            );


                    if (
                        !result.error
                    ) {

                        attachmentError =
                            null;

                        break;
                    }


                    attachmentError =
                        result.error;
                }


                if (
                    attachmentError
                ) {

                    throw attachmentError;
                }


                state.messages.push({

                    ...message,

                    profile:
                        normalizeProfile(
                            state.profile
                        ),

                    attachments: [

                        {

                            file_name:
                                file.name,

                            file_url:
                                fileUrl,

                            mime_type:
                                file.type,

                            file_size:
                                file.size
                        }
                    ]
                });


                renderMessages();


                toast(
                    `${file.name} uploaded.`,
                    "success"
                );

            } catch (error) {

                console.error(
                    "Attachment upload failed:",
                    error
                );

                toast(
                    `Could not upload ${file.name}. Check the Storage bucket and RLS policies.`,
                    "error"
                );
            }
        }


        ensureAttachmentInput().value =
            "";
    }


    /* =========================================================
       EMOJI PICKER
       ========================================================= */

    const EMOJIS = [

        "😀",
        "😂",
        "🤣",
        "😊",
        "😍",
        "🥰",
        "😉",
        "😎",
        "🤩",
        "🥳",

        "😢",
        "😭",
        "😡",
        "🤯",
        "😱",
        "🤔",
        "🙄",
        "😴",

        "❤️",
        "🔥",
        "👍",
        "👎",
        "👏",
        "🙏",
        "🎉",
        "💯",
        "✨",

        "🧠",
        "🫀",
        "🫁",
        "🩸",
        "🦠",
        "🧬",
        "🔬",
        "🧪",
        "💊",
        "💉",
        "🩺",

        "📚",
        "🎓",
        "🎮",
        "😂"
    ];


    function createEmojiPicker() {

        if (
            !dom.emojiButton
        ) {
            return;
        }


        if (
            document.getElementById(
                "mwanikiEmojiPicker"
            )
        ) {

            return;
        }


        const picker =
            document.createElement(
                "div"
            );


        picker.id =
            "mwanikiEmojiPicker";


        picker.className =
            "mwaniki-emoji-picker";


        picker.hidden =
            true;


        picker.innerHTML = `

            <div
                class="emoji-picker-header"
            >

                <strong>
                    Emoji
                </strong>

                <button
                    type="button"
                    id="closeEmojiPicker"
                    aria-label="Close emoji picker"
                >
                    ×
                </button>

            </div>


            <div
                class="mwaniki-emoji-grid"
            ></div>
        `;


        picker.querySelector(
            ".mwaniki-emoji-grid"
        ).innerHTML =
            EMOJIS
                .map(
                    emoji => `
                        <button
                            type="button"
                            class="mwaniki-emoji-button"
                            aria-label="Insert ${emoji}"
                        >
                            ${emoji}
                        </button>
                    `
                )
                .join("");


        picker
            .querySelectorAll(
                ".mwaniki-emoji-button"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () =>
                            insertEmoji(
                                button.textContent
                            )
                    );
                }
            );


        picker
            .querySelector(
                "#closeEmojiPicker"
            )
            .addEventListener(
                "click",
                closeEmojiPicker
            );


        const parent =
            dom.emojiButton
                .parentElement ||
            document.body;


        if (
            getComputedStyle(
                parent
            ).position ===
            "static"
        ) {

            parent.style.position =
                "relative";
        }


        parent.appendChild(
            picker
        );
    }


    function insertEmoji(
        emoji
    ) {

        const input =
            dom.messageInput;

        if (!input) {
            return;
        }


        const start =
            input.selectionStart ??
            input.value.length;


        const end =
            input.selectionEnd ??
            input.value.length;


        input.value =
            input.value.slice(
                0,
                start
            ) +
            emoji +
            input.value.slice(
                end
            );


        const position =
            start +
            emoji.length;


        input.focus();


        input.setSelectionRange(
            position,
            position
        );
    }


    function closeEmojiPicker() {

        const picker =
            document.getElementById(
                "mwanikiEmojiPicker"
            );


        if (picker) {

            picker.hidden =
                true;
        }


        state.emojiPickerOpen =
            false;
    }


    function toggleEmojiPicker(
        event
    ) {

        if (event) {

            event.stopPropagation();
        }


        createEmojiPicker();


        const picker =
            document.getElementById(
                "mwanikiEmojiPicker"
            );


        if (!picker) {
            return;
        }


        state.emojiPickerOpen =
            !state.emojiPickerOpen;


        picker.hidden =
            !state.emojiPickerOpen;


        if (
            state.emojiPickerOpen
        ) {

            dom.messageInput?.focus();
        }
    }


    /* =========================================================
       REALTIME HELPERS
       ========================================================= */

    function removeRealtimeChannel(
        channel
    ) {

        if (
            !channel ||
            !state.supabase
        ) {
            return;
        }


        try {

            state.supabase.removeChannel(
                channel
            );

        } catch {}
    }


    function resetCommunityRealtime() {

        state.realtimeChannels =
            state.realtimeChannels.filter(
                channel => {

                    if (
                        channel.__messageChannel ||
                        channel.__communityChannel
                    ) {

                        removeRealtimeChannel(
                            channel
                        );

                        return false;
                    }

                    return true;
                }
            );


        if (
            !state.selectedCommunity
        ) {

            return;
        }


        const communityId =
            state.selectedCommunity.id;


        const channel =
            state.supabase
                .channel(
                    `community:${communityId}`
                )
                .on(
                    "postgres_changes",
                    {

                        event:
                            "*",

                        schema:
                            "public",

                        table:
                            "chat_channels",

                        filter:
                            `community_id=eq.${communityId}`

                    },
                    () =>
                        loadChannels(
                            communityId
                        )
                )
                .subscribe();


        channel.__communityChannel =
            true;


        state.realtimeChannels.push(
            channel
        );
    }


    function subscribeToMessageRealtime(
        channelId
    ) {

        state.realtimeChannels =
            state.realtimeChannels.filter(
                channel => {

                    if (
                        channel.__messageChannel
                    ) {

                        removeRealtimeChannel(
                            channel
                        );

                        return false;
                    }

                    return true;
                }
            );


        const channel =
            state.supabase
                .channel(
                    `messages:${channelId}`
                )


                .on(
                    "postgres_changes",
                    {

                        event:
                            "INSERT",

                        schema:
                            "public",

                        table:
                            "chat_messages",

                        filter:
                            `channel_id=eq.${channelId}`

                    },
                    async payload => {

                        if (
                            state.messages.some(
                                message =>
                                    String(
                                        message.id
                                    ) ===
                                    String(
                                        payload.new.id
                                    )
                            )
                        ) {

                            return;
                        }


                        const enriched =
                            await attachProfiles(
                                [
                                    payload.new
                                ]
                            );


                        state.messages.push({

                            ...(enriched[0] ||
                                payload.new),

                            attachments:
                                []
                        });


                        await loadAttachmentsForMessages();

                        renderMessages();
                    }
                )


                .on(
                    "postgres_changes",
                    {

                        event:
                            "UPDATE",

                        schema:
                            "public",

                        table:
                            "chat_messages",

                        filter:
                            `channel_id=eq.${channelId}`

                    },
                    async payload => {

                        const index =
                            state.messages.findIndex(
                                message =>
                                    String(
                                        message.id
                                    ) ===
                                    String(
                                        payload.new.id
                                    )
                            );


                        if (
                            index >=
                            0
                        ) {

                            state.messages[
                                index
                            ] = {

                                ...state.messages[
                                    index
                                ],

                                ...payload.new
                            };

                        } else {

                            const enriched =
                                await attachProfiles(
                                    [
                                        payload.new
                                    ]
                                );

                            state.messages.push(
                                enriched[0]
                            );
                        }


                        await loadAttachmentsForMessages();

                        renderMessages();
                    }
                )


                .on(
                    "postgres_changes",
                    {

                        event:
                            "DELETE",

                        schema:
                            "public",

                        table:
                            "chat_messages",

                        filter:
                            `channel_id=eq.${channelId}`

                    },
                    payload => {

                        state.messages =
                            state.messages.filter(
                                message =>
                                    String(
                                        message.id
                                    ) !==
                                    String(
                                        payload.old?.id
                                    )
                            );


                        renderMessages();
                    }
                )


                .subscribe();


        channel.__messageChannel =
            true;


        state.realtimeChannels.push(
            channel
        );
    }


    /* =========================================================
       PRESENCE
       ========================================================= */

    async function updatePresence() {

        if (!state.user) {
            return;
        }


        const now =
            new Date()
                .toISOString();


        const {
            error
        } =
            await state.supabase
                .from(
                    "chat_presence"
                )
                .upsert(
                    {

                        user_id:
                            state.user.id,

                        status:
                            "online",

                        last_seen_at:
                            now,

                        updated_at:
                            now

                    },
                    {

                        onConflict:
                            "user_id"
                    }
                );


        if (error) {

            console.warn(
                "Presence update failed:",
                error
            );
        }
    }


    function startPresenceHeartbeat() {

        if (
            state.presenceTimer
        ) {

            clearInterval(
                state.presenceTimer
            );
        }


        updatePresence();


        state.presenceTimer =
            setInterval(
                updatePresence,
                CONFIG.presenceHeartbeat
            );
    }


    /* =========================================================
       COMMUNITY MODAL
       ========================================================= */

    function openCommunityModal() {

        if (
            !dom.communityModal
        ) {
            return;
        }


        state.communityModalOpen =
            true;


        dom.communityModal.hidden =
            false;


        renderCommunityChoices();


        if (
            dom.communityModalSearch
        ) {

            dom.communityModalSearch.value =
                "";

            dom.communityModalSearch.focus();
        }
    }


    function closeCommunityModal() {

        if (
            dom.communityModal
        ) {

            dom.communityModal.hidden =
                true;
        }


        state.communityModalOpen =
            false;
    }


    function renderCommunityChoices(
        search = ""
    ) {

        if (
            !dom.communityChoiceList
        ) {
            return;
        }


        const term =
            String(
                search ||
                    ""
            )
                .toLowerCase()
                .trim();


        const communities =
            state.communities.filter(
                community => {

                    if (!term) {
                        return true;
                    }


                    return (
                        String(
                            community.name ||
                                ""
                        )
                            .toLowerCase()
                            .includes(
                                term
                            ) ||

                        String(
                            community.description ||
                                ""
                        )
                            .toLowerCase()
                            .includes(
                                term
                            )
                    );
                }
            );


        dom.communityChoiceList.innerHTML =
            communities
                .map(
                    community => `

                        <button
                            type="button"
                            class="community-choice"
                            data-community-id="${escapeHtml(
                                community.id
                            )}"
                        >

                            <span
                                class="community-choice-icon"
                            >
                                ${iconMarkup(
                                    community
                                )}
                            </span>


                            <span
                                class="community-choice-content"
                            >

                                <strong>
                                    ${escapeHtml(
                                        community.name
                                    )}
                                </strong>

                                <small>
                                    ${escapeHtml(
                                        community.description ||
                                            ""
                                    )}
                                </small>

                            </span>

                        </button>
                    `
                )
                .join("");


        if (
            !communities.length
        ) {

            dom.communityChoiceList.innerHTML = `

                <div
                    class="community-empty-state"
                >
                    No communities found.
                </div>
            `;
        }


        dom.communityChoiceList
            .querySelectorAll(
                "[data-community-id]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        async () => {

                            closeCommunityModal();

                            await selectCommunity(
                                button.dataset.communityId
                            );
                        }
                    );
                }
            );
    }


    /* =========================================================
       MESSAGE SEARCH
       ========================================================= */

    function searchMessages() {

        if (
            dom.messageSearchPanel
        ) {

            dom.messageSearchPanel.classList.remove(
                "hidden"
            );
        }


        dom.messageSearchInput?.focus();
    }


    function closeMessageSearch() {

        if (
            dom.messageSearchPanel
        ) {

            dom.messageSearchPanel.classList.add(
                "hidden"
            );
        }


        if (
            dom.messageSearchInput
        ) {

            dom.messageSearchInput.value =
                "";
        }


        renderMessages();
    }


    /* =========================================================
       GENERAL CALL USERS
       ========================================================= */

    function isRecentlyOnline(
        lastSeenAt
    ) {

        const time =
            new Date(
                lastSeenAt ||
                    0
            ).getTime();


        return (
            Number.isFinite(
                time
            ) &&
            Date.now() -
                time <=
                CONFIG.onlineWindowMs
        );
    }


    async function loadOnlineUsers() {

        if (
            !dom.generalCallUserList
        ) {

            return [];
        }


        dom.generalCallUserList.innerHTML = `

            <div
                class="call-user-loading"
            >
                Loading students...
            </div>
        `;


        await updatePresence();


        const {
            data:
                rows,
            error
        } =
            await state.supabase
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


        if (error) {

            dom.generalCallUserList.innerHTML = `

                <div
                    class="call-user-error"
                >
                    Unable to load online students.
                </div>
            `;

            return [];
        }


        const ids = [
            ...new Set(
                (
                    rows ||
                    []
                )
                    .filter(
                        row =>
                            row.user_id &&
                            row.user_id !==
                                state.user.id &&
                            isRecentlyOnline(
                                row.last_seen_at
                            )
                    )
                    .map(
                        row =>
                            row.user_id
                    )
            )
        ];


        if (!ids.length) {

            dom.generalCallUserList.innerHTML = `

                <div
                    class="call-user-empty"
                >
                    No other students are currently online.
                </div>
            `;

            updateGeneralCallSelectionCount();

            return [];
        }


        const {
            data:
                students
        } =
            await state.supabase
                .from(
                    "students"
                )
                .select(
                    "id,full_name,photo_url"
                )
                .in(
                    "id",
                    ids
                );


        dom.generalCallUserList.innerHTML =
            "";


        (
            students ||
            []
        ).forEach(
            student => {

                const label =
                    document.createElement(
                        "label"
                    );

                label.className =
                    "general-call-user";


                label.innerHTML = `

                    <input
                        type="checkbox"
                        class="general-call-user-checkbox"
                        value="${escapeHtml(
                            student.id
                        )}"
                    >

                    <img
                        class="general-call-user-avatar"
                        src="${safeUrl(
                            student.photo_url
                        )}"
                        alt=""
                    >

                    <span
                        class="general-call-user-name"
                    >
                        ${escapeHtml(
                            student.full_name ||
                                "Student"
                        )}
                    </span>
                `;


                label
                    .querySelector(
                        "input"
                    )
                    ?.addEventListener(
                        "change",
                        updateGeneralCallSelectionCount
                    );


                dom.generalCallUserList.appendChild(
                    label
                );
            }
        );


        if (
            dom.generalCallUserStatus
        ) {

            const count =
                students?.length ||
                0;

            dom.generalCallUserStatus.textContent =
                `${count} online student${
                    count === 1
                        ? ""
                        : "s"
                } available.`;
        }


        updateGeneralCallSelectionCount();


        return (
            students ||
            []
        );
    }


    function updateGeneralCallSelectionCount() {

        const count =
            dom.generalCallUserList
                ?.querySelectorAll(
                    ".general-call-user-checkbox:checked"
                )
                .length ||
            0;


        if (
            dom.generalCallSelectionCount
        ) {

            dom.generalCallSelectionCount.textContent =
                String(
                    count
                );
        }


        if (
            dom.startGeneralCallButton
        ) {

            dom.startGeneralCallButton.disabled =
                count === 0;
        }
    }


    function openGeneralCallModal() {

        if (
            !dom.generalCallModal
        ) {

            return;
        }


        dom.generalCallModal.hidden =
            false;


        state.pendingGeneralCallType =
            "video";


        loadOnlineUsers();
    }


    function closeGeneralCallModal() {

        if (
            dom.generalCallModal
        ) {

            dom.generalCallModal.hidden =
                true;
        }
    }


    /* =========================================================
       CALL ROOM CREATION
       ========================================================= */

    function generateRoomCode() {

        return (
            `mwaniki-${Date.now()}-` +
            Math.random()
                .toString(36)
                .slice(2, 9)
        );
    }


    async function createCallRoom(
        communityId,
        scope,
        type
    ) {

        const {
            data,
            error
        } =
            await state.supabase
                .from(
                    "chat_call_rooms"
                )
                .insert({

                    community_id:
                        communityId ||
                        null,

                    room_code:
                        generateRoomCode(),

                    call_scope:
                        scope,

                    call_type:
                        type,

                    status:
                        "waiting",

                    created_by:
                        state.user.id

                })
                .select(
                    "*"
                )
                .single();


        if (error) {
            throw error;
        }


        return data;
    }


    async function addCallParticipant(
        roomId,
        userId,
        status =
            "invited"
    ) {

        const {
            error
        } =
            await state.supabase
                .from(
                    "chat_call_participants"
                )
                .upsert(
                    {

                        room_id:
                            roomId,

                        user_id:
                            userId,

                        status

                    },
                    {

                        onConflict:
                            "room_id,user_id"
                    }
                );


        if (error) {

            throw error;
        }
    }


    async function loadCommunityCallUsers(
        communityId
    ) {

        const {
            data,
            error
        } =
            await state.supabase
                .from(
                    "chat_community_members"
                )
                .select(
                    "user_id,is_banned"
                )
                .eq(
                    "community_id",
                    communityId
                )
                .eq(
                    "is_banned",
                    false
                );


        if (error) {
            throw error;
        }


        return (
            data ||
            []
        )
            .map(
                member =>
                    member.user_id
            )
            .filter(
                id =>
                    id &&
                    id !==
                        state.user.id
            );
    }


    /* =========================================================
       START COMMUNITY CALL
       ========================================================= */

    async function startCommunityCall(
        type
    ) {

        if (
            !state.selectedCommunity
        ) {

            setStatus(
                "Select a community first."
            );

            return;
        }


        if (
            !state.user
        ) {
            return;
        }


        if (
            state.call.active ||
            state.call.connecting
        ) {

            toast(
                "You are already in a call.",
                "error"
            );

            return;
        }


        state.call.connecting =
            true;


        try {

            const room =
                await createCallRoom(
                    state.selectedCommunity.id,
                    "community",
                    type
                );


            await addCallParticipant(
                room.id,
                state.user.id,
                "joined"
            );


            const members =
                await loadCommunityCallUsers(
                    state.selectedCommunity.id
                );


            for (
                const userId of
                    members
            ) {

                await addCallParticipant(
                    room.id,
                    userId,
                    "invited"
                );
            }


            await startCallInterface({

                room,

                callType:
                    type,

                scope:
                    "community",

                communityId:
                    state.selectedCommunity.id
            });

        } catch (error) {

            console.error(
                "Community call failed:",
                error
            );

            toast(
                error.message ||
                    "Unable to start community call.",
                "error"
            );

        } finally {

            state.call.connecting =
                false;
        }
    }


    /* =========================================================
       START GENERAL CALL
       ========================================================= */

    async function startGeneralCall() {

        const selected =
            [
                ...(
                    dom.generalCallUserList
                        ?.querySelectorAll(
                            ".general-call-user-checkbox:checked"
                        ) ||
                    []
                )
            ]
                .map(
                    checkbox =>
                        checkbox.value
                );


        if (
            !selected.length
        ) {

            toast(
                "Select at least one student.",
                "error"
            );

            return;
        }


        if (
            state.call.active ||
            state.call.connecting
        ) {

            toast(
                "You are already in a call.",
                "error"
            );

            return;
        }


        state.call.connecting =
            true;


        try {

            const type =
                state.pendingGeneralCallType ||
                "video";


            const room =
                await createCallRoom(
                    null,
                    "general",
                    type
                );


            await addCallParticipant(
                room.id,
                state.user.id,
                "joined"
            );


            for (
                const userId of
                    selected
            ) {

                await addCallParticipant(
                    room.id,
                    userId,
                    "invited"
                );
            }


            closeGeneralCallModal();


            await startCallInterface({

                room,

                callType:
                    type,

                scope:
                    "general",

                communityId:
                    null
            });

        } catch (error) {

            console.error(
                "General call failed:",
                error
            );

            toast(
                error.message ||
                    "Unable to start general call.",
                "error"
            );

        } finally {

            state.call.connecting =
                false;
        }
    }


    /* =========================================================
       CALL OVERLAY
       ========================================================= */

    function showCallOverlay(
        room,
        type,
        scope
    ) {

        if (
            dom.callOverlay
        ) {

            dom.callOverlay.hidden =
                false;
        }


        if (
            dom.callTypeIcon
        ) {

            dom.callTypeIcon.textContent =
                type ===
                    "video"
                    ? "📹"
                    : "📞";
        }


        if (
            dom.callTitle
        ) {

            dom.callTitle.textContent =
                scope ===
                    "community"
                    ? (
                        state.selectedCommunity
                            ?.name ||
                        "Community Call"
                    )
                    : "Mwaniki General Call";
        }


        if (
            dom.callSubtitle
        ) {

            dom.callSubtitle.textContent =
                type ===
                    "video"
                    ? "Video call"
                    : "Voice call";
        }


        if (
            dom.callDuration
        ) {

            dom.callDuration.textContent =
                "00:00";
        }
    }


    /* =========================================================
       LOCAL MEDIA
       ========================================================= */

    async function acquireLocalMedia(
        type
    ) {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices
                .getUserMedia
        ) {

            throw new Error(
                "Your browser does not support calls."
            );
        }


        try {

            const stream =
                await navigator.mediaDevices
                    .getUserMedia({

                        audio:
                            true,

                        video:
                            type ===
                            "video"
                    });


            state.call.localStream =
                stream;


            state.call.microphoneEnabled =
                true;


            state.call.cameraEnabled =
                type ===
                "video";


            if (
                dom.localVideo
            ) {

                dom.localVideo.srcObject =
                    type ===
                        "video"
                        ? stream
                        : null;

                dom.localVideo.muted =
                    true;

                dom.localVideo.autoplay =
                    true;

                dom.localVideo.playsInline =
                    true;
            }

        } catch (error) {

            console.error(
                "Local media error:",
                error
            );

            throw new Error(
                "Camera or microphone permission was not granted."
            );
        }
    }


    /* =========================================================
       REALTIME SUBSCRIPTION HELPER
       ========================================================= */

    async function subscribeRealtimeChannel(
        build,
        assign
    ) {

        return new Promise(
            (
                resolve,
                reject
            ) => {

                let settled =
                    false;

                let channel;


                const timer =
                    setTimeout(
                        () => {

                            if (
                                settled
                            ) {

                                return;
                            }

                            settled =
                                true;

                            reject(
                                new Error(
                                    "Call realtime subscription timed out. Enable Realtime for the call tables in Supabase."
                                )
                            );

                        },
                        10000
                    );


                channel =
                    build(
                        status => {

                            if (
                                status ===
                                "SUBSCRIBED" &&
                                !settled
                            ) {

                                settled =
                                    true;

                                clearTimeout(
                                    timer
                                );

                                resolve(
                                    channel
                                );
                            }


                            if (
                                (
                                    status ===
                                        "CHANNEL_ERROR" ||
                                    status ===
                                        "TIMED_OUT"
                                ) &&
                                !settled
                            ) {

                                settled =
                                    true;

                                clearTimeout(
                                    timer
                                );

                                reject(
                                    new Error(
                                        `Call realtime status: ${status}`
                                    )
                                );
                            }
                        }
                    );


                assign(
                    channel
                );
            }
        );
    }


    /* =========================================================
       CALL REALTIME
       ========================================================= */

    async function subscribeToCallRoom(
        roomId
    ) {

        if (
            state.call.roomChannel
        ) {

            removeRealtimeChannel(
                state.call.roomChannel
            );
        }


        if (
            state.call.participantChannel
        ) {

            removeRealtimeChannel(
                state.call.participantChannel
            );
        }


        /*
         * SIGNALING CHANNEL
         *
         * We WAIT for SUBSCRIBED.
         *
         * This is one of the major fixes
         * for the frozen call problem.
         */

        await subscribeRealtimeChannel(

            onStatus =>
                state.supabase
                    .channel(
                        `call-room:${roomId}`
                    )
                    .on(
                        "postgres_changes",
                        {

                            event:
                                "INSERT",

                            schema:
                                "public",

                            table:
                                "chat_call_signals",

                            filter:
                                `room_id=eq.${roomId}`

                        },
                        payload =>
                            handleCallSignal(
                                payload.new
                            )
                    )
                    .subscribe(
                        onStatus
                    ),

            channel => {

                state.call.roomChannel =
                    channel;
            }
        );


        /*
         * PARTICIPANT CHANNEL
         *
         * When an invited student accepts,
         * the caller creates a peer connection.
         */

        try {

            await subscribeRealtimeChannel(

                onStatus =>
                    state.supabase
                        .channel(
                            `call-participants:${roomId}`
                        )
                        .on(
                            "postgres_changes",
                            {

                                event:
                                    "UPDATE",

                                schema:
                                    "public",

                                table:
                                    "chat_call_participants",

                                filter:
                                    `room_id=eq.${roomId}`

                            },
                            payload => {

                                const participant =
                                    payload.new;


                                if (
                                    participant.status ===
                                        "joined" &&
                                    participant.user_id &&
                                    participant.user_id !==
                                        state.user.id &&
                                    state.call.active
                                ) {

                                    createPeerConnection(
                                        participant.user_id,
                                        true
                                    )
                                        .catch(
                                            console.error
                                        );
                                }
                            }
                        )
                        .subscribe(
                            onStatus
                        ),

                channel => {

                    state.call.participantChannel =
                        channel;
                }
            );

        } catch (error) {

            /*
             * Signaling can still work even if
             * participant realtime is unavailable.
             */

            console.warn(
                error.message
            );
        }


        /*
         * IMPORTANT:
         *
         * If the caller sent an offer before the
         * invited user finished subscribing,
         * retrieve the existing offer now.
         */

        await loadExistingCallSignals(
            roomId
        );
    }


    async function loadExistingCallSignals(
        roomId
    ) {

        const {
            data,
            error
        } =
            await state.supabase
                .from(
                    "chat_call_signals"
                )
                .select(
                    "*"
                )
                .eq(
                    "room_id",
                    roomId
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            true
                    }
                );


        if (error) {

            console.warn(
                "Could not load existing call signals:",
                error
            );

            return;
        }


        for (
            const signal of
                data ||
                []
        ) {

            if (
                signal.sender_id ===
                state.user.id
            ) {

                continue;
            }


            if (
                signal.receiver_id &&
                signal.receiver_id !==
                    state.user.id
            ) {

                continue;
            }


            await handleCallSignal(
                signal
            );
        }
    }


    /* =========================================================
       CALL SIGNALING
       ========================================================= */

    async function sendCallSignal({

        roomId,

        receiverId,

        type,

        payload

    }) {

        const {
            error
        } =
            await state.supabase
                .from(
                    "chat_call_signals"
                )
                .insert({

                    room_id:
                        roomId,

                    sender_id:
                        state.user.id,

                    receiver_id:
                        receiverId,

                    signal_type:
                        type,

                    payload
                });


        if (error) {

            throw error;
        }
    }


    /* =========================================================
       PEER CONNECTION
       ========================================================= */

    async function createPeerConnection(
        remoteUserId,
        offerer =
            false
    ) {

        if (
            !remoteUserId ||
            remoteUserId ===
                state.user.id ||
            !state.call.active
        ) {

            return null;
        }


        let peer =
            state.call.peerConnections.get(
                remoteUserId
            );


        if (peer) {

            if (
                offerer &&
                peer.signalingState ===
                    "stable"
            ) {

                await makeOffer(
                    peer,
                    remoteUserId
                );
            }

            return peer;
        }


        peer =
            new RTCPeerConnection(
                CONFIG.rtcConfiguration
            );


        state.call.peerConnections.set(
            remoteUserId,
            peer
        );


        state.call.pendingIce.set(
            remoteUserId,
            state.call.pendingIce.get(
                remoteUserId
            ) || []
        );


        if (
            state.call.localStream
        ) {

            state.call.localStream
                .getTracks()
                .forEach(
                    track => {

                        peer.addTrack(
                            track,
                            state.call.localStream
                        );
                    }
                );
        }


        peer.onicecandidate =
            event => {

                if (
                    !event.candidate
                ) {

                    return;
                }


                sendCallSignal({

                    roomId:
                        state.call.roomId,

                    receiverId:
                        remoteUserId,

                    type:
                        "ice-candidate",

                    payload:
                        event.candidate.toJSON
                            ? event.candidate.toJSON()
                            : event.candidate

                })
                    .catch(
                        console.error
                    );
            };


        peer.ontrack =
            event => {

                const stream =
                    event.streams &&
                    event.streams[0];


                if (
                    stream
                ) {

                    renderRemoteVideo(
                        remoteUserId,
                        stream
                    );
                }
            };


        peer.onconnectionstatechange =
            () => {

                if (
                    peer.connectionState ===
                        "failed" ||
                    peer.connectionState ===
                        "closed"
                ) {

                    removePeer(
                        remoteUserId
                    );
                }
            };


        if (
            offerer
        ) {

            await makeOffer(
                peer,
                remoteUserId
            );
        }


        return peer;
    }


    async function makeOffer(
        peer,
        remoteUserId
    ) {

        if (
            peer.signalingState !==
            "stable"
        ) {

            return;
        }


        const offer =
            await peer.createOffer();


        await peer.setLocalDescription(
            offer
        );


        await sendCallSignal({

            roomId:
                state.call.roomId,

            receiverId:
                remoteUserId,

            type:
                "offer",

            payload:
                peer.localDescription
        });
    }


    /* =========================================================
       CALL SIGNAL HANDLER
       ========================================================= */

    async function handleCallSignal(
        signal
    ) {

        if (
            !signal ||
            !state.call.active
        ) {

            return;
        }


        if (
            signal.sender_id ===
            state.user.id
        ) {

            return;
        }


        if (
            signal.receiver_id &&
            signal.receiver_id !==
                state.user.id
        ) {

            return;
        }


        const remoteUserId =
            signal.sender_id;


        /*
         * OFFER
         */

        if (
            signal.signal_type ===
            "offer"
        ) {

            const peer =
                await createPeerConnection(
                    remoteUserId,
                    false
                );


            if (!peer) {
                return;
            }


            try {

                await peer.setRemoteDescription(
                    new RTCSessionDescription(
                        signal.payload
                    )
                );


                const answer =
                    await peer.createAnswer();


                await peer.setLocalDescription(
                    answer
                );


                await sendCallSignal({

                    roomId:
                        state.call.roomId,

                    receiverId:
                        remoteUserId,

                    type:
                        "answer",

                    payload:
                        peer.localDescription
                });


                await flushIce(
                    remoteUserId
                );

            } catch (error) {

                console.error(
                    "Offer handling failed:",
                    error
                );
            }


            return;
        }


        /*
         * ANSWER
         */

        if (
            signal.signal_type ===
            "answer"
        ) {

            const peer =
                state.call.peerConnections.get(
                    remoteUserId
                );


            if (!peer) {
                return;
            }


            try {

                if (
                    peer.signalingState ===
                    "have-local-offer"
                ) {

                    await peer.setRemoteDescription(
                        new RTCSessionDescription(
                            signal.payload
                        )
                    );
                }


                await flushIce(
                    remoteUserId
                );

            } catch (error) {

                console.error(
                    "Answer handling failed:",
                    error
                );
            }


            return;
        }


        /*
         * ICE CANDIDATE
         */

        if (
            signal.signal_type ===
            "ice-candidate"
        ) {

            const peer =
                state.call.peerConnections.get(
                    remoteUserId
                );


            /*
             * ICE can arrive before
             * remote description.
             *
             * Queue it.
             */

            if (
                !peer ||
                !peer.remoteDescription
            ) {

                const list =
                    state.call.pendingIce.get(
                        remoteUserId
                    ) ||
                    [];


                list.push(
                    signal.payload
                );


                state.call.pendingIce.set(
                    remoteUserId,
                    list
                );


                return;
            }


            try {

                await peer.addIceCandidate(
                    new RTCIceCandidate(
                        signal.payload
                    )
                );

            } catch (error) {

                console.warn(
                    "ICE candidate failed:",
                    error
                );
            }
        }
    }


    async function flushIce(
        remoteUserId
    ) {

        const peer =
            state.call.peerConnections.get(
                remoteUserId
            );


        if (
            !peer ||
            !peer.remoteDescription
        ) {

            return;
        }


        const candidates =
            state.call.pendingIce.get(
                remoteUserId
            ) ||
            [];


        state.call.pendingIce.set(
            remoteUserId,
            []
        );


        for (
            const candidate of
                candidates
        ) {

            try {

                await peer.addIceCandidate(
                    new RTCIceCandidate(
                        candidate
                    )
                );

            } catch {}
        }
    }


    /* =========================================================
       REMOTE VIDEO
       ========================================================= */

    function renderRemoteVideo(
        userId,
        stream
    ) {

        if (
            !dom.callVideoGrid ||
            !userId ||
            !stream
        ) {

            return;
        }


        let tile =
            dom.callVideoGrid.querySelector(
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
                "call-video-tile";

            tile.dataset.callUser =
                userId;


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


            tile.appendChild(
                video
            );


            dom.callVideoGrid.appendChild(
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


    function removePeer(
        userId
    ) {

        const peer =
            state.call.peerConnections.get(
                userId
            );


        try {

            peer?.close();

        } catch {}


        state.call.peerConnections.delete(
            userId
        );


        state.call.pendingIce.delete(
            userId
        );


        if (
            dom.callVideoGrid &&
            typeof CSS !==
                "undefined" &&
            CSS.escape
        ) {

            const tile =
                dom.callVideoGrid.querySelector(
                    `[data-call-user="${CSS.escape(
                        userId
                    )}"]`
                );


            if (tile) {
                tile.remove();
            }
        }
    }


    /* =========================================================
       START CALL INTERFACE
       ========================================================= */

    async function startCallInterface({

        room,

        callType,

        scope,

        communityId

    }) {

        state.call.active =
            true;


        state.call.roomId =
            room.id;


        state.call.roomCode =
            room.room_code;


        state.call.callType =
            callType;


        state.call.scope =
            scope;


        state.call.communityId =
            communityId;


        state.call.startedAt =
            Date.now();


        showCallOverlay(
            room,
            callType,
            scope
        );


        startCallTimer();


        try {

            /*
             * Ask for media first.
             */

            await acquireLocalMedia(
                callType
            );


            /*
             * Then subscribe to Realtime.
             *
             * This order is important.
             */

            await subscribeToCallRoom(
                room.id
            );


            /*
             * Mark room active.
             */

            await state.supabase
                .from(
                    "chat_call_rooms"
                )
                .update({

                    status:
                        "active",

                    started_at:
                        new Date()
                            .toISOString(),

                    updated_at:
                        new Date()
                            .toISOString()

                })
                .eq(
                    "id",
                    room.id
                );


            /*
             * Connect to everyone already
             * inside the room.
             */

            const {
                data:
                    joined
            } =
                await state.supabase
                    .from(
                        "chat_call_participants"
                    )
                    .select(
                        "user_id"
                    )
                    .eq(
                        "room_id",
                        room.id
                    )
                    .eq(
                        "status",
                        "joined"
                    );


            for (
                const participant of
                    joined ||
                    []
            ) {

                if (
                    participant.user_id !==
                    state.user.id
                ) {

                    await createPeerConnection(
                        participant.user_id,
                        true
                    );
                }
            }

        } catch (error) {

            console.error(
                "Call startup failed:",
                error
            );


            await leaveCall(
                false
            );


            throw error;
        }
    }


    /* =========================================================
       CALL TIMER
       ========================================================= */

    function startCallTimer() {

        stopCallTimer();


        state.call.timer =
            setInterval(
                () => {

                    if (
                        !state.call.startedAt ||
                        !dom.callDuration
                    ) {

                        return;
                    }


                    const seconds =
                        Math.floor(
                            (
                                Date.now() -
                                state.call.startedAt
                            ) /
                            1000
                        );


                    const minutes =
                        Math.floor(
                            seconds /
                            60
                        );


                    const remaining =
                        seconds %
                        60;


                    dom.callDuration.textContent =
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


    function stopCallTimer() {

        if (
            state.call.timer
        ) {

            clearInterval(
                state.call.timer
            );
        }


        state.call.timer =
            null;
    }


    /* =========================================================
       CALL CONTROLS
       ========================================================= */

    function toggleMicrophone() {

        const tracks =
            state.call.localStream
                ?.getAudioTracks() ||
            [];


        if (!tracks.length) {
            return;
        }


        state.call.microphoneEnabled =
            !state.call.microphoneEnabled;


        tracks.forEach(
            track => {

                track.enabled =
                    state.call.microphoneEnabled;
            }
        );


        if (
            dom.toggleMicrophoneButton
        ) {

            dom.toggleMicrophoneButton.textContent =
                state.call.microphoneEnabled
                    ? "🎙️"
                    : "🔇";
        }
    }


    function toggleCamera() {

        const tracks =
            state.call.localStream
                ?.getVideoTracks() ||
            [];


        if (!tracks.length) {
            return;
        }


        state.call.cameraEnabled =
            !state.call.cameraEnabled;


        tracks.forEach(
            track => {

                track.enabled =
                    state.call.cameraEnabled;
            }
        );


        if (
            dom.toggleCameraButton
        ) {

            dom.toggleCameraButton.textContent =
                state.call.cameraEnabled
                    ? "📹"
                    : "🚫";
        }
    }


    async function toggleScreenShare() {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices
                .getDisplayMedia
        ) {

            toast(
                "Screen sharing is not supported by this browser.",
                "error"
            );

            return;
        }


        if (
            state.call.screenSharing
        ) {

            stopScreenShare();

            return;
        }


        try {

            const stream =
                await navigator.mediaDevices
                    .getDisplayMedia({

                        video:
                            true
                    });


            const track =
                stream.getVideoTracks()[0];


            if (!track) {
                return;
            }


            state.call.screenStream =
                stream;


            state.call.screenSharing =
                true;


            state.call.peerConnections
                .forEach(
                    peer => {

                        const sender =
                            peer
                                .getSenders()
                                .find(
                                    item =>
                                        item.track &&
                                        item.track.kind ===
                                            "video"
                                );


                        if (sender) {

                            sender.replaceTrack(
                                track
                            );
                        }
                    }
                );


            if (
                dom.localVideo
            ) {

                dom.localVideo.srcObject =
                    stream;
            }


            track.onended =
                () =>
                    stopScreenShare();

        } catch {}
    }


    function stopScreenShare() {

        if (
            state.call.screenStream
        ) {

            state.call.screenStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );


            state.call.screenStream =
                null;
        }


        state.call.screenSharing =
            false;


        const camera =
            state.call.localStream
                ?.getVideoTracks()[0];


        if (camera) {

            state.call.peerConnections
                .forEach(
                    peer => {

                        const sender =
                            peer
                                .getSenders()
                                .find(
                                    item =>
                                        item.track &&
                                        item.track.kind ===
                                            "video"
                                );


                        if (sender) {

                            sender.replaceTrack(
                                camera
                            );
                        }
                    }
                );


            if (
                dom.localVideo
            ) {

                dom.localVideo.srcObject =
                    state.call.localStream;
            }
        }
    }


    /* =========================================================
       LEAVE CALL
       ========================================================= */

    async function leaveCall(
        updateServer =
            true
    ) {

        const roomId =
            state.call.roomId;


        if (
            updateServer &&
            roomId &&
            state.user
        ) {

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
                    roomId
                )
                .eq(
                    "user_id",
                    state.user.id
                );
        }


        /*
         * Only creator ends the room.
         */

        if (
            roomId &&
            state.call.scope &&
            state.user
        ) {

            await state.supabase
                .from(
                    "chat_call_rooms"
                )
                .update({

                    status:
                        "ended",

                    ended_at:
                        new Date()
                            .toISOString(),

                    updated_at:
                        new Date()
                            .toISOString()

                })
                .eq(
                    "id",
                    roomId
                )
                .eq(
                    "created_by",
                    state.user.id
                );
        }


        stopScreenShare();


        state.call.peerConnections
            .forEach(
                peer => {

                    try {
                        peer.close();
                    } catch {}
                }
            );


        state.call.peerConnections.clear();


        state.call.pendingIce.clear();


        if (
            state.call.localStream
        ) {

            state.call.localStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );
        }


        state.call.localStream =
            null;


        removeRealtimeChannel(
            state.call.roomChannel
        );


        removeRealtimeChannel(
            state.call.participantChannel
        );


        state.call.roomChannel =
            null;


        state.call.participantChannel =
            null;


        stopCallTimer();


        state.call.active =
            false;

        state.call.connecting =
            false;

        state.call.roomId =
            null;

        state.call.roomCode =
            null;

        state.call.callType =
            null;

        state.call.scope =
            null;

        state.call.communityId =
            null;

        state.call.startedAt =
            null;

        state.call.screenSharing =
            false;


        if (
            dom.callOverlay
        ) {

            dom.callOverlay.hidden =
                true;
        }


        if (
            dom.localVideo
        ) {

            dom.localVideo.srcObject =
                null;
        }


        if (
            dom.callVideoGrid
        ) {

            dom.callVideoGrid
                .querySelectorAll(
                    ".call-video-tile"
                )
                .forEach(
                    tile =>
                        tile.remove()
                );
        }


        announce(
            "Call ended."
        );
    }


    /* =========================================================
       INCOMING CALL
       ========================================================= */

    async function showIncomingCall(
        roomId
    ) {

        const {
            data:
                room,
            error
        } =
            await state.supabase
                .from(
                    "chat_call_rooms"
                )
                .select(
                    "*"
                )
                .eq(
                    "id",
                    roomId
                )
                .maybeSingle();


        if (
            error ||
            !room
        ) {

            return;
        }


        if (
            room.status ===
            "ended"
        ) {

            return;
        }


        state.incomingCall =
            room;


        if (
            dom.incomingCallTitle
        ) {

            dom.incomingCallTitle.textContent =
                room.call_type ===
                    "video"
                    ? "Incoming video call"
                    : "Incoming voice call";
        }


        if (
            dom.incomingCallText
        ) {

            dom.incomingCallText.textContent =
                room.call_scope ===
                    "community"
                    ? "You have been invited to a community call."
                    : "You have been invited to a general call.";
        }


        if (
            dom.incomingCallToast
        ) {

            dom.incomingCallToast.hidden =
                false;
        }
    }


    function setupIncomingCallListener() {

        if (!state.user) {
            return;
        }


        const channel =
            state.supabase
                .channel(
                    `incoming-calls:${state.user.id}`
                )
                .on(
                    "postgres_changes",
                    {

                        event:
                            "INSERT",

                        schema:
                            "public",

                        table:
                            "chat_call_participants",

                        filter:
                            `user_id=eq.${state.user.id}`

                    },
                    payload => {

                        const participant =
                            payload.new;


                        if (
                            participant?.status !==
                            "invited"
                        ) {

                            return;
                        }


                        if (
                            state.call.active &&
                            state.call.roomId ===
                                participant.room_id
                        ) {

                            return;
                        }


                        showIncomingCall(
                            participant.room_id
                        );
                    }
                )
                .subscribe();


        state.realtimeChannels.push(
            channel
        );
    }


    async function acceptIncomingCall() {

        const room =
            state.incomingCall;


        if (!room) {
            return;
        }


        state.incomingCall =
            null;


        if (
            dom.incomingCallToast
        ) {

            dom.incomingCallToast.hidden =
                true;
        }


        try {

            const {
                error
            } =
                await state.supabase
                    .from(
                        "chat_call_participants"
                    )
                    .update({

                        status:
                            "joined",

                        joined_at:
                            new Date()
                                .toISOString()

                    })
                    .eq(
                        "room_id",
                        room.id
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    );


            if (error) {
                throw error;
            }


            await startCallInterface({

                room,

                callType:
                    room.call_type,

                scope:
                    room.call_scope,

                communityId:
                    room.community_id
            });

        } catch (error) {

            console.error(
                "Could not accept call:",
                error
            );

            toast(
                error.message ||
                    "Could not join the call.",
                "error"
            );
        }
    }


    async function declineIncomingCall() {

        const room =
            state.incomingCall;


        if (!room) {
            return;
        }


        state.incomingCall =
            null;


        if (
            dom.incomingCallToast
        ) {

            dom.incomingCallToast.hidden =
                true;
        }


        await state.supabase
            .from(
                "chat_call_participants"
            )
            .update({

                status:
                    "declined",

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
                state.user.id
            );
    }


    /* =========================================================
       EVENTS
       ========================================================= */

    function bindEvents() {

        [
            dom.homeButton,
            dom.railHomeButton,
            dom.dashboardButton
        ].forEach(
            button => {

                button?.addEventListener(
                    "click",
                    () =>
                        location.href =
                            CONFIG.dashboardUrl
                );
            }
        );


        [
            dom.railProfileButton,
            dom.sidebarProfileButton
        ].forEach(
            button => {

                button?.addEventListener(
                    "click",
                    () =>
                        location.href =
                            CONFIG.profileUrl
                );
            }
        );


        [
            dom.openCommunityButton,
            dom.communitySelectorButton,
            dom.headerCommunityButton
        ].forEach(
            button => {

                button?.addEventListener(
                    "click",
                    openCommunityModal
                );
            }
        );


        dom.closeCommunityModal
            ?.addEventListener(
                "click",
                closeCommunityModal
            );


        dom.communityModal
            ?.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        dom.communityModal
                    ) {

                        closeCommunityModal();
                    }
                }
            );


        dom.communityModalSearch
            ?.addEventListener(
                "input",
                event =>
                    renderCommunityChoices(
                        event.target.value
                    )
            );


        dom.messageForm
            ?.addEventListener(
                "submit",
                sendMessage
            );


        if (
            dom.sendMessageButton &&
            !dom.messageForm
        ) {

            dom.sendMessageButton
                .addEventListener(
                    "click",
                    sendMessage
                );
        }


        dom.messageInput
            ?.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key ===
                            "Enter" &&
                        !event.shiftKey
                    ) {

                        event.preventDefault();

                        sendMessage(
                            event
                        );
                    }
                }
            );


        dom.channelSearchInput
            ?.addEventListener(
                "input",
                event => {

                    state.searchTerm =
                        event.target.value;

                    renderChannels();
                }
            );


        dom.emojiButton
            ?.addEventListener(
                "click",
                toggleEmojiPicker
            );


        dom.attachButton
            ?.addEventListener(
                "click",
                () =>
                    ensureAttachmentInput()
                        .click()
            );


        dom.chatSearchButton
            ?.addEventListener(
                "click",
                searchMessages
            );


        dom.closeMessageSearchButton
            ?.addEventListener(
                "click",
                closeMessageSearch
            );


        dom.cancelReplyButton
            ?.addEventListener(
                "click",
                cancelReply
            );


        /*
         * General call.
         */

        dom.generalCallButton
            ?.addEventListener(
                "click",
                openGeneralCallModal
            );


        dom.closeGeneralCallModalButton
            ?.addEventListener(
                "click",
                closeGeneralCallModal
            );


        dom.cancelGeneralCallButton
            ?.addEventListener(
                "click",
                closeGeneralCallModal
            );


        dom.generalVoiceCallButton
            ?.addEventListener(
                "click",
                () => {

                    state.pendingGeneralCallType =
                        "voice";
                }
            );


        dom.generalVideoCallButton
            ?.addEventListener(
                "click",
                () => {

                    state.pendingGeneralCallType =
                        "video";
                }
            );


        dom.startGeneralCallButton
            ?.addEventListener(
                "click",
                startGeneralCall
            );


        /*
         * Community calls.
         */

        dom.voiceCallButton
            ?.addEventListener(
                "click",
                () =>
                    startCommunityCall(
                        "voice"
                    )
            );


        dom.videoCallButton
            ?.addEventListener(
                "click",
                () =>
                    startCommunityCall(
                        "video"
                    )
            );


        /*
         * Call controls.
         */

        dom.toggleMicrophoneButton
            ?.addEventListener(
                "click",
                toggleMicrophone
            );


        dom.toggleCameraButton
            ?.addEventListener(
                "click",
                toggleCamera
            );


        dom.shareScreenButton
            ?.addEventListener(
                "click",
                toggleScreenShare
            );


        dom.leaveCallButton
            ?.addEventListener(
                "click",
                () =>
                    leaveCall(
                        true
                    )
            );


        /*
         * Incoming call.
         */

        dom.acceptCallButton
            ?.addEventListener(
                "click",
                acceptIncomingCall
            );


        dom.declineCallButton
            ?.addEventListener(
                "click",
                declineIncomingCall
            );


        /*
         * Close general call modal by clicking backdrop.
         */

        dom.generalCallModal
            ?.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        dom.generalCallModal
                    ) {

                        closeGeneralCallModal();
                    }
                }
            );


        /*
         * Close emoji picker when clicking anywhere else.
         */

        document.addEventListener(
            "pointerdown",
            event => {

                const picker =
                    document.getElementById(
                        "mwanikiEmojiPicker"
                    );


                if (
                    state.emojiPickerOpen &&
                    picker &&
                    !picker.contains(
                        event.target
                    ) &&
                    event.target !==
                        dom.emojiButton
                ) {

                    closeEmojiPicker();
                }


                /*
                 * Close old community menu too.
                 */

                const menu =
                    document.getElementById(
                        "communityMenu"
                    );


                const menuButton =
                    document.getElementById(
                        "communityMenuButton"
                    );


                if (
                    menu &&
                    !menu.contains(
                        event.target
                    ) &&
                    event.target !==
                        menuButton
                ) {

                    menu.classList.add(
                        "hidden"
                    );
                }
            }
        );


        /*
         * Escape closes every floating UI.
         */

        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key !==
                    "Escape"
                ) {

                    return;
                }


                closeEmojiPicker();


                if (
                    state.communityModalOpen
                ) {

                    closeCommunityModal();
                }


                if (
                    dom.generalCallModal &&
                    !dom.generalCallModal.hidden
                ) {

                    closeGeneralCallModal();
                }


                if (
                    dom.incomingCallToast &&
                    !dom.incomingCallToast.hidden
                ) {

                    dom.incomingCallToast.hidden =
                        true;
                }


                if (
                    dom.messageSearchPanel &&
                    !dom.messageSearchPanel
                        .classList
                        .contains(
                            "hidden"
                        )
                ) {

                    closeMessageSearch();
                }
            }
        );


        bindMessageActionEvents();
    }


    /* =========================================================
       READ STATUS
       ========================================================= */

    async function markChannelRead(
        channelId
    ) {

        if (
            !state.user ||
            !channelId
        ) {

            return;
        }


        const lastMessage =
            state.messages[
                state.messages.length - 1
            ];


        const payload = {

            channel_id:
                channelId,

            user_id:
                state.user.id,

            last_read_message_id:
                lastMessage?.id ||
                null,

            last_read_at:
                new Date()
                    .toISOString()
        };


        const {
            data
        } =
            await state.supabase
                .from(
                    "chat_read_status"
                )
                .select(
                    "id"
                )
                .eq(
                    "channel_id",
                    channelId
                )
                .eq(
                    "user_id",
                    state.user.id
                )
                .maybeSingle();


        if (
            data?.id
        ) {

            await state.supabase
                .from(
                    "chat_read_status"
                )
                .update(
                    payload
                )
                .eq(
                    "id",
                    data.id
                );

        } else {

            await state.supabase
                .from(
                    "chat_read_status"
                )
                .insert(
                    payload
                );
        }
    }


    /* =========================================================
       INITIALIZATION
       ========================================================= */

    async function init() {

        if (
            state.initialized
        ) {

            return;
        }


        state.initialized =
            true;


        console.log(
            "Mwaniki Community: Connecting..."
        );


        try {

            await waitForSupabase();

            await loadAuthenticatedUser();

            await loadProfile();

            await loadCommunities();


            /*
             * Create UI controls dynamically.
             */

            createEmojiPicker();

            ensureAttachmentInput();


            /*
             * Bind everything once.
             */

            bindEvents();


            /*
             * Incoming call listener.
             */

            setupIncomingCallListener();


            /*
             * Presence.
             */

            startPresenceHeartbeat();


            /*
             * Restore previous community.
             */

            const savedCommunity =
                storageGet(
                    "mwanikiCommunityId"
                );


            const firstCommunity =
                state.communities.find(
                    community =>
                        String(
                            community.id
                        ) ===
                        String(
                            savedCommunity
                        )
                ) ||
                state.communities[0];


            if (
                firstCommunity
            ) {

                await selectCommunity(
                    firstCommunity.id
                );

            } else {

                renderMessageArea();
            }


            console.log(
                "Mwaniki Community fully initialized."
            );

        } catch (error) {

            console.error(
                "Mwaniki Community initialization failed:",
                error
            );


            state.initialized =
                false;


            setStatus(
                error.message ||
                    "Community failed to initialize."
            );
        }
    }


    /* =========================================================
       PUBLIC API
       ========================================================= */

    window.MwanikiCommunity = {

        state,

        init,

        selectCommunity,

        selectChannel,

        loadCommunities,

        loadChannels,

        loadMessages,

        sendMessage,

        deleteMessage,

        startCommunityCall,

        startGeneralCall,

        leaveCall,

        openGeneralCallModal,

        closeGeneralCallModal,

        acceptIncomingCall,

        declineIncomingCall,

        openCommunityModal,

        closeCommunityModal,

        loadOnlineUsers,

        getProfileName,

        getProfilePhoto
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
            init,
            {
                once:
                    true
            }
        );

    } else {

        init();
    }

})();
