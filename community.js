/* ============================================================
   MWANIKI SCHOLARS COMMUNITY
   community.js
   Complete Community + Messaging + Presence + Calling Engine
   ============================================================ */

(() => {
    "use strict";

    /* =========================================================
       CONFIGURATION
       ========================================================= */

    const CONFIG = {
        dashboardUrl: "./dashboard.html",
        profileUrl: "./studentProfile.html",

        defaultAvatar:
            "https://ui-avatars.com/api/?name=Student&background=087f73&color=ffffff",

        presenceInterval: 30000,
        onlineWindow: 90000,

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

        messagePageSize: 100,
        channelPageSize: 200
    };


    /* =========================================================
       STATE
       ========================================================= */

    const state = {
        initialized: false,

        supabase: null,

        user: null,
        profile: null,

        communities: [],
        channels: [],
        messages: [],

        selectedCommunity: null,
        selectedChannel: null,

        communityModalOpen: false,
        emojiPickerOpen: false,

        pendingGeneralCallType: "video",

        presenceTimer: null,

        realtimeChannels: [],

        communityRealtimeChannel: null,

        call: {
            active: false,

            incoming: null,

            roomId: null,
            roomCode: null,

            callType: null,
            scope: null,
            communityId: null,
            channelId: null,

            startedAt: null,
            timer: null,

            localStream: null,
            screenStream: null,

            microphoneEnabled: true,
            cameraEnabled: true,
            screenSharing: false,

            peerConnections: new Map(),

            pendingIceCandidates: new Map(),

            roomChannel: null,
            participantChannel: null
        }
    };


    /* =========================================================
       DOM
       ========================================================= */

    const dom = {};


    function cacheDom() {
        const ids = [
            "communityApp",

            "homeButton",
            "railHomeButton",
            "railGeneralButton",
            "communityRailList",
            "railProfileButton",

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

            "communityRail",
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
            "generalCallUserInput",
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
            "declineCallButton"
        ];

        ids.forEach(id => {
            dom[id] =
                document.getElementById(id);
        });
    }


    /* =========================================================
       SUPABASE
       ========================================================= */

    function getExistingSupabaseClient() {
        return (
            window.supabaseClient ||
            window.sb ||
            window.mwanikiSupabase ||
            window.supabase ||
            null
        );
    }


    async function waitForSupabase(
        timeout = 10000
    ) {
        const started =
            Date.now();

        while (
            Date.now() -
                started <
            timeout
        ) {
            const client =
                getExistingSupabaseClient();

            if (client) {
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
            "Supabase client could not be found. Make sure supabase.js loads before community.js."
        );
    }


    /* =========================================================
       UTILITIES
       ========================================================= */

    function escapeHtml(value) {
        return String(
            value ?? ""
        )
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                '"',
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );
    }


    function safeUrl(url) {
        if (
            typeof url !==
            "string"
        ) {
            return CONFIG.defaultAvatar;
        }

        const value =
            url.trim();

        if (
            !value
        ) {
            return CONFIG.defaultAvatar;
        }

        if (
            value.startsWith(
                "https://"
            ) ||
            value.startsWith(
                "http://"
            )
        ) {
            return value;
        }

        return CONFIG.defaultAvatar;
    }


    function formatMessageTime(
        value
    ) {
        if (!value) {
            return "";
        }

        const date =
            new Date(value);

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
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }


    function formatDateTime(
        value
    ) {
        if (!value) {
            return "";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
        }

        return date.toLocaleString();
    }


    function generateRoomCode() {
        const timestamp =
            Date.now().toString(36);

        const random =
            Math.random()
                .toString(36)
                .slice(2, 9);

        return (
            "MW-" +
            timestamp +
            "-" +
            random
        ).toUpperCase();
    }


    function isRecentlyOnline(
        timestamp
    ) {
        if (!timestamp) {
            return true;
        }

        const time =
            new Date(
                timestamp
            ).getTime();

        if (
            Number.isNaN(time)
        ) {
            return false;
        }

        return (
            Date.now() -
                time <=
            CONFIG.onlineWindow
        );
    }


    function announce(
        message
    ) {
        if (
            dom.accessibilityAnnouncer
        ) {
            dom.accessibilityAnnouncer.textContent =
                message;
        }
    }


    function setStatus(
        message
    ) {
        if (
            dom.communityStatus
        ) {
            dom.communityStatus.textContent =
                message;
            dom.communityStatus.hidden =
                false;

            clearTimeout(
                dom.communityStatus
                    ._hideTimer
            );

            dom.communityStatus._hideTimer =
                setTimeout(
                    () => {
                        if (
                            dom.communityStatus
                        ) {
                            dom.communityStatus.hidden =
                                true;
                        }
                    },
                    4500
                );
        }

        console.log(
            "Mwaniki Community:",
            message
        );
    }


    function getCommunityIcon(
        community
    ) {
        if (
            community?.icon_url
        ) {
            return community.icon_url;
        }

        const name =
            String(
                community?.name ||
                    ""
            ).toLowerCase();

        if (
            name.includes(
                "gaming"
            ) ||
            name.includes(
                "game"
            )
        ) {
            return "🎮";
        }

        if (
            name.includes(
                "meme"
            )
        ) {
            return "😂";
        }

        if (
            name.includes(
                "general"
            )
        ) {
            return "💬";
        }

        if (
            name.includes(
                "mwaniki"
            )
        ) {
            return "🎓";
        }

        return "🏫";
    }


    function normalizeProfile(
        profile
    ) {
        return {
            id:
                profile?.id ||
                null,

            full_name:
                profile?.full_name ||
                "Student",

            photo_url:
                profile?.photo_url ||
                CONFIG.defaultAvatar,

            email:
                profile?.email ||
                "",

            course:
                profile?.course ||
                "",

            level:
                profile?.level ||
                ""
        };
    }


    function getProfileName() {
        return (
            state.profile?.full_name ||
            state.user?.email?.split(
                "@"
            )[0] ||
            "Student"
        );
    }


    function getProfilePhoto() {
        return safeUrl(
            state.profile?.photo_url
        );
    }


    function removeRealtimeChannel(
        channel
    ) {
        if (!channel) {
            return;
        }

        try {
            state.supabase.removeChannel(
                channel
            );
        } catch (error) {
            console.warn(
                "Could not remove realtime channel:",
                error
            );
        }

        const index =
            state.realtimeChannels.indexOf(
                channel
            );

        if (index !== -1) {
            state.realtimeChannels.splice(
                index,
                1
            );
        }
    }


    /* =========================================================
       AUTHENTICATED USER
       ========================================================= */

    async function loadAuthenticatedUser() {
        const {
            data,
            error
        } =
            await state.supabase.auth.getUser();

        if (error) {
            throw error;
        }

        if (!data?.user) {
            throw new Error(
                "Please log in before opening the community."
            );
        }

        state.user =
            data.user;

        console.log(
            "Community user:",
            state.user.id
        );
    }


    /* =========================================================
       PROFILE
       ========================================================= */

    async function loadProfile() {
        if (!state.user) {
            return;
        }

        const {
            data,
            error
        } =
            await state.supabase
                .from(
                    "students"
                )
                .select(
                    "id, full_name, email, phone, course, level, photo_url, created_at"
                )
                .eq(
                    "id",
                    state.user.id
                )
                .maybeSingle();

        if (error) {
            console.warn(
                "Student profile query failed:",
                error
            );
        }

        state.profile =
            normalizeProfile(
                data || {
                    id:
                        state.user.id,

                    full_name:
                        state.user.user_metadata
                            ?.full_name ||
                        state.user.email?.split(
                            "@"
                        )[0] ||
                        "Student",

                    photo_url:
                        state.user.user_metadata
                            ?.photo_url ||
                        CONFIG.defaultAvatar
                }
            );

        renderProfile();
    }


    function renderProfile() {
        const name =
            getProfileName();

        const photo =
            getProfilePhoto();

        [
            dom.sidebarProfileAvatar,
            dom.railProfileAvatar
        ].forEach(
            avatar => {
                if (!avatar) {
                    return;
                }

                avatar.src =
                    photo;

                avatar.alt =
                    name;

                avatar.onerror =
                    () => {
                        avatar.onerror =
                            null;

                        avatar.src =
                            CONFIG.defaultAvatar;
                    };
            }
        );

        if (
            dom.sidebarProfileName
        ) {
            dom.sidebarProfileName.textContent =
                name;
        }
    }


    /* =========================================================
       PRESENCE
       ========================================================= */

    async function updatePresence() {
        if (
            !state.user ||
            !state.supabase
        ) {
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
                CONFIG.presenceInterval
            );
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
                    "*"
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

        ensureRequiredCommunityIcons();

        renderCommunityRail();

        console.log(
            "Communities loaded:",
            state.communities.length
        );
    }


    function ensureRequiredCommunityIcons() {
        /*
         * Icons are generated from names when icon_url
         * isn't provided. This ensures Gaming, Memes,
         * Mwaniki and General remain visually distinct.
         */
    }


    function renderCommunityRail() {
        if (
            !dom.communityRailList
        ) {
            return;
        }

        dom.communityRailList.innerHTML =
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
                    "community-rail-community";

                if (
                    state.selectedCommunity
                        ?.id ===
                    community.id
                ) {
                    button.classList.add(
                        "active"
                    );
                }

                button.dataset.communityId =
                    community.id;

                button.title =
                    community.name;

                button.setAttribute(
                    "aria-label",
                    `Open ${community.name}`
                );

                const icon =
                    getCommunityIcon(
                        community
                    );

                if (
                    icon.startsWith(
                        "http://"
                    ) ||
                    icon.startsWith(
                        "https://"
                    )
                ) {
                    const image =
                        document.createElement(
                            "img"
                        );

                    image.src =
                        icon;

                    image.alt =
                        "";

                    image.style.width =
                        "26px";

                    image.style.height =
                        "26px";

                    image.style.objectFit =
                        "cover";

                    image.style.borderRadius =
                        "7px";

                    button.appendChild(
                        image
                    );
                } else {
                    button.textContent =
                        icon;
                }

                button.addEventListener(
                    "click",
                    () => {
                        selectCommunity(
                            community.id
                        );
                    }
                );

                dom.communityRailList.appendChild(
                    button
                );
            }
        );
    }


    function renderCommunityHeader() {
        const community =
            state.selectedCommunity;

        if (!community) {
            return;
        }

        const icon =
            getCommunityIcon(
                community
            );

        if (
            dom.selectedCommunityIcon
        ) {
            dom.selectedCommunityIcon.textContent =
                icon.startsWith(
                    "http"
                )
                    ? "🏫"
                    : icon;
        }

        if (
            dom.selectedCommunityName
        ) {
            dom.selectedCommunityName.textContent =
                community.name;
        }

        if (
            dom.selectedCommunityDescription
        ) {
            dom.selectedCommunityDescription.textContent =
                community.description ||
                "Community discussion";
        }

        if (
            dom.activeCommunityIcon
        ) {
            dom.activeCommunityIcon.textContent =
                icon.startsWith(
                    "http"
                )
                    ? "🏫"
                    : icon;
        }

        if (
            dom.activeCommunityName
        ) {
            dom.activeCommunityName.textContent =
                community.name;
        }

        if (
            dom.activeCommunityDescription
        ) {
            dom.activeCommunityDescription.textContent =
                community.description ||
                "Community discussion";
        }

        renderCourseBanner(
            community
        );
    }


    function renderCourseBanner(
        community
    ) {
        if (
            !dom.communityCourseBanner
        ) {
            return;
        }

        if (
            community.course_id
        ) {
            dom.communityCourseBanner.hidden =
                false;

            if (
                dom.communityCourseLabel
            ) {
                dom.communityCourseLabel.textContent =
                    "Course Community";
            }

            if (
                dom.communityCourseName
            ) {
                dom.communityCourseName.textContent =
                    `Course #${community.course_id}`;
            }
        } else {
            dom.communityCourseBanner.hidden =
                true;
        }
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

        renderCommunityRail();

        renderCommunityHeader();

        await loadChannels(
            community.id
        );

        if (
            state.channels.length
        ) {
            await selectChannel(
                state.channels[0].id
            );
        } else {
            state.selectedChannel =
                null;

            state.messages =
                [];

            renderChannelList();

            renderMessageArea();
        }

        announce(
            `Opened ${community.name}`
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

        if (
            dom.communityModalSearch
        ) {
            dom.communityModalSearch.value =
                "";

            dom.communityModalSearch.focus();
        }

        renderCommunityChoices();
    }


    function closeCommunityModal() {
        if (
            !dom.communityModal
        ) {
            return;
        }

        state.communityModalOpen =
            false;

        dom.communityModal.hidden =
            true;
    }


    function renderCommunityChoices(
        searchTerm = ""
    ) {
        if (
            !dom.communityChoiceList
        ) {
            return;
        }

        const term =
            String(
                searchTerm ||
                    ""
            )
                .trim()
                .toLowerCase();

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
            "";

        if (!communities.length) {
            dom.communityChoiceList.innerHTML = `
                <div class="community-empty-messages">
                    No communities found.
                </div>
            `;

            return;
        }

        communities.forEach(
            community => {
                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "community-choice";

                const icon =
                    getCommunityIcon(
                        community
                    );

                button.innerHTML = `
                    <span class="community-choice-icon">
                        ${escapeHtml(
                            icon.startsWith(
                                "http"
                            )
                                ? "🏫"
                                : icon
                        )}
                    </span>

                    <span>
                        <span class="community-choice-name">
                            ${escapeHtml(
                                community.name
                            )}
                        </span>

                        <span class="community-choice-description">
                            ${escapeHtml(
                                community.description ||
                                    "Community"
                            )}
                        </span>
                    </span>
                `;

                button.addEventListener(
                    "click",
                    async () => {
                        closeCommunityModal();

                        await selectCommunity(
                            community.id
                        );
                    }
                );

                dom.communityChoiceList.appendChild(
                    button
                );
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

            renderChannelList();

            return [];
        }

        if (
            dom.channelLoadingState
        ) {
            dom.channelLoadingState.hidden =
                false;
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
                    "*"
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
                );

        if (
            dom.channelLoadingState
        ) {
            dom.channelLoadingState.hidden =
                true;
        }

        if (error) {
            console.error(
                "Channels could not load:",
                error
            );

            throw error;
        }

        state.channels =
            data || [];

        renderChannelList();

        console.log(
            "Channels loaded:",
            state.channels.length
        );

        return state.channels;
    }


    function renderChannelList(
        filter = ""
    ) {
        if (
            !dom.channelList
        ) {
            return;
        }

        const term =
            String(
                filter ||
                    ""
            )
                .trim()
                .toLowerCase();

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

        dom.channelList.innerHTML =
            "";

        let currentCategory =
            null;

        channels.forEach(
            channel => {
                const category =
                    channel.category ||
                    channel.channel_category ||
                    (
                        channel.channel_type ===
                        "voice"
                            ? "Voice"
                            : "Channels"
                    );

                if (
                    category !==
                    currentCategory
                ) {
                    currentCategory =
                        category;

                    const heading =
                        document.createElement(
                            "div"
                        );

                    heading.className =
                        "channel-category";

                    heading.textContent =
                        category;

                    dom.channelList.appendChild(
                        heading
                    );
                }

                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "channel-item";

                if (
                    state.selectedChannel
                        ?.id ===
                    channel.id
                ) {
                    button.classList.add(
                        "active"
                    );
                }

                const icon =
                    channel.icon ||
                    (
                        channel.channel_type ===
                        "voice"
                            ? "🔊"
                            : "💬"
                    );

                button.innerHTML = `
                    <span class="channel-icon">
                        ${escapeHtml(
                            icon
                        )}
                    </span>

                    <span class="channel-name">
                        ${escapeHtml(
                            channel.name ||
                                "Channel"
                        )}
                    </span>

                    ${
                        channel.is_private
                            ? `
                                <span class="channel-lock">
                                    🔒
                                </span>
                            `
                            : ""
                    }
                `;

                button.addEventListener(
                    "click",
                    () => {
                        selectChannel(
                            channel.id
                        );
                    }
                );

                dom.channelList.appendChild(
                    button
                );
            }
        );

        if (!channels.length) {
            dom.channelList.innerHTML = `
                <div class="community-empty-messages">
                    No channels found.
                </div>
            `;
        }
    }


    function handleChannelSearch(
        event
    ) {
        renderChannelList(
            event.target.value
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

        renderChannelList(
            dom.channelSearchInput
                ?.value ||
                ""
        );

        renderActiveChannel();

        await loadMessages(
            channel.id
        );

        announce(
            `Opened channel ${channel.name}`
        );
    }


    function renderActiveChannel() {
        const channel =
            state.selectedChannel;

        if (!channel) {
            return;
        }

        const title =
            channel.name ||
            "Channel";

        if (
            dom.activeChannelName
        ) {
            dom.activeChannelName.textContent =
                title;
        }

        if (
            dom.mainChannelTitle
        ) {
            dom.mainChannelTitle.textContent =
                title;
        }

        if (
            dom.activeChannelDescription
        ) {
            dom.activeChannelDescription.textContent =
                channel.description ||
                "";
        }

        if (
            dom.mainChannelDescription
        ) {
            dom.mainChannelDescription.textContent =
                channel.description ||
                "";
        }

        if (
            dom.activeRoleBadge
        ) {
            dom.activeRoleBadge.textContent =
                "Student";
        }
    }


    /* =========================================================
       MESSAGES
       ========================================================= */

    async function loadMessages(
        channelId
    ) {
        if (!channelId) {
            state.messages =
                [];

            renderMessages();

            return [];
        }

        renderLoadingMessages();

        const {
            data,
            error
        } =
            await state.supabase
                .from(
                    "chat_messages"
                )
                .select(
                    "*"
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
                    CONFIG.messagePageSize
                );

        if (error) {
            console.error(
                "Messages could not load:",
                error
            );

            state.messages =
                [];

            renderMessageError(
                error
            );

            return [];
        }

        state.messages =
            data || [];

        await hydrateMessageProfiles();

        renderMessages();

        return state.messages;
    }


    async function hydrateMessageProfiles() {
        const ids = [
            ...new Set(
                state.messages
                    .map(
                        message =>
                            message.user_id
                    )
                    .filter(Boolean)
            )
        ];

        if (!ids.length) {
            return;
        }

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
                .in(
                    "id",
                    ids
                );

        if (error) {
            console.warn(
                "Message profiles could not load:",
                error
            );

            return;
        }

        const profiles =
            new Map(
                (
                    data ||
                    []
                ).map(
                    student => [
                        student.id,
                        normalizeProfile(
                            student
                        )
                    ]
                )
            );

        state.messages =
            state.messages.map(
                message => ({
                    ...message,

                    _profile:
                        profiles.get(
                            message.user_id
                        ) ||
                        null
                })
            );
    }


    function renderLoadingMessages() {
        if (
            !dom.messageList
        ) {
            return;
        }

        dom.messageList.innerHTML = `
            <div class="community-loading-messages">
                Loading messages...
            </div>
        `;
    }


    function renderMessageError(
        error
    ) {
        if (
            !dom.messageList
        ) {
            return;
        }

        dom.messageList.innerHTML = `
            <div class="community-empty-messages">
                Unable to load messages.
            </div>
        `;

        setStatus(
            error?.message ||
                "Messages could not be loaded."
        );
    }


    function renderMessages() {
        if (
            !dom.messageList
        ) {
            return;
        }

        dom.messageList.innerHTML =
            "";

        if (!state.messages.length) {
            dom.messageList.innerHTML = `
                <div class="community-empty-messages">
                    No messages yet. Start the discussion.
                </div>
            `;

            return;
        }

        state.messages.forEach(
            message => {
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


    function createMessageElement(
        message
    ) {
        const profile =
            message._profile;

        const name =
            profile?.full_name ||
            (
                message.user_id ===
                state.user?.id
                    ? getProfileName()
                    : "Student"
            );

        const photo =
            safeUrl(
                profile?.photo_url ||
                    (
                        message.user_id ===
                        state.user?.id
                            ? getProfilePhoto()
                            : CONFIG.defaultAvatar
                    )
            );

        const article =
            document.createElement(
                "article"
            );

        article.className =
            "community-message";

        article.dataset.messageId =
            message.id || "";

        article.innerHTML = `
            <img
                class="community-message-avatar"
                src="${photo}"
                alt="${escapeHtml(
                    name
                )}"
            >

            <div class="community-message-body">

                <div class="community-message-meta">

                    <span class="community-message-author">
                        ${escapeHtml(
                            name
                        )}
                    </span>

                    <time
                        class="community-message-time"
                        datetime="${escapeHtml(
                            message.created_at ||
                                ""
                        )}"
                    >
                        ${escapeHtml(
                            formatMessageTime(
                                message.created_at
                            )
                        )}
                    </time>

                </div>

                <div class="community-message-content">
                    ${escapeHtml(
                        message.content ||
                            ""
                    )}
                </div>

            </div>
        `;

        const avatar =
            article.querySelector(
                ".community-message-avatar"
            );

        if (avatar) {
            avatar.onerror =
                () => {
                    avatar.onerror =
                        null;

                    avatar.src =
                        CONFIG.defaultAvatar;
                };
        }

        return article;
    }


    async function sendMessage(
        event
    ) {
        if (event) {
            event.preventDefault();
        }

        if (
            !state.user ||
            !state.selectedChannel
        ) {
            return;
        }

        const content =
            String(
                dom.messageInput
                    ?.value ||
                    ""
            ).trim();

        if (!content) {
            return;
        }

        if (
            dom.sendMessageButton
        ) {
            dom.sendMessageButton.disabled =
                true;
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
                    .insert({
                        channel_id:
                            state.selectedChannel.id,

                        user_id:
                            state.user.id,

                        content
                    })
                    .select(
                        "*"
                    )
                    .single();

            if (error) {
                throw error;
            }

            if (
                dom.messageInput
            ) {
                dom.messageInput.value =
                    "";
            }

            if (data) {
                data._profile =
                    state.profile;

                state.messages.push(
                    data
                );

                renderMessages();
            }
        } catch (error) {
            console.error(
                "Message send failed:",
                error
            );

            setStatus(
                error.message ||
                    "Message could not be sent."
            );
        } finally {
            if (
                dom.sendMessageButton
            ) {
                dom.sendMessageButton.disabled =
                    false;
            }
        }
    }


    /* =========================================================
       MESSAGE SEARCH
       ========================================================= */

    function searchMessages() {
        if (
            !dom.messageList
        ) {
            return;
        }

        const query =
            prompt(
                "Search messages in this channel:"
            );

        if (query === null) {
            return;
        }

        const term =
            query
                .trim()
                .toLowerCase();

        if (!term) {
            renderMessages();
            return;
        }

        const matches =
            state.messages.filter(
                message =>
                    String(
                        message.content ||
                            ""
                    )
                        .toLowerCase()
                        .includes(
                            term
                        )
            );

        dom.messageList.innerHTML =
            "";

        if (!matches.length) {
            dom.messageList.innerHTML = `
                <div class="community-empty-messages">
                    No matching messages found.
                </div>
            `;

            return;
        }

        matches.forEach(
            message => {
                dom.messageList.appendChild(
                    createMessageElement(
                        message
                    )
                );
            }
        );
    }


    /* =========================================================
       MESSAGE AREA
       ========================================================= */

    function renderMessageArea() {
        if (
            !dom.messageList
        ) {
            return;
        }

        if (
            !state.selectedChannel
        ) {
            dom.messageList.innerHTML = `
                <div class="community-empty-messages">
                    Select a channel to begin.
                </div>
            `;

            return;
        }

        renderMessages();
    }


    /* =========================================================
       EMOJI PICKER
       ========================================================= */

    function createEmojiPicker() {
        let picker =
            document.getElementById(
                "mwanikiEmojiPicker"
            );

        if (!picker) {
            picker =
                document.createElement(
                    "div"
                );

            picker.id =
                "mwanikiEmojiPicker";

            picker.hidden =
                true;

            document.body.appendChild(
                picker
            );
        }

        const emojis = [
            "😀",
            "😂",
            "🤣",
            "😊",
            "😍",
            "😎",
            "🤔",
            "😮",
            "😢",
            "😡",
            "👍",
            "👎",
            "👏",
            "🙌",
            "🙏",
            "❤️",
            "🔥",
            "🎓",
            "📚",
            "🧪",
            "🩺",
            "💊",
            "🧬",
            "🔬",
            "🎮",
            "😂",
            "💡",
            "✅",
            "❌",
            "⭐",
            "🚀",
            "💯"
        ];

        picker.innerHTML =
            "";

        emojis.forEach(
            emoji => {
                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.textContent =
                    emoji;

                button.setAttribute(
                    "aria-label",
                    `Insert ${emoji}`
                );

                button.addEventListener(
                    "click",
                    () => {
                        insertEmoji(
                            emoji
                        );
                    }
                );

                picker.appendChild(
                    button
                );
            }
        );
    }


    function insertEmoji(
        emoji
    ) {
        if (
            !dom.messageInput
        ) {
            return;
        }

        const input =
            dom.messageInput;

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

        input.focus();

        const position =
            start +
            emoji.length;

        input.setSelectionRange(
            position,
            position
        );

        state.emojiPickerOpen =
            false;

        const picker =
            document.getElementById(
                "mwanikiEmojiPicker"
            );

        if (picker) {
            picker.hidden =
                true;
        }
    }


    function toggleEmojiPicker() {
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
    }


    /* =========================================================
       NAVIGATION
       ========================================================= */

    function goDashboard() {
        window.location.href =
            CONFIG.dashboardUrl;
    }


    function goProfile() {
        window.location.href =
            CONFIG.profileUrl;
    }


    function bindNavigation() {
        [
            dom.homeButton,
            dom.railHomeButton,
            dom.dashboardButton
        ].forEach(
            button => {
                if (!button) {
                    return;
                }

                button.addEventListener(
                    "click",
                    goDashboard
                );
            }
        );

        [
            dom.railProfileButton,
            dom.sidebarProfileButton
        ].forEach(
            button => {
                if (!button) {
                    return;
                }

                button.addEventListener(
                    "click",
                    goProfile
                );
            }
        );

        [
            dom.openCommunityButton,
            dom.communitySelectorButton,
            dom.headerCommunityButton
        ].forEach(
            button => {
                if (!button) {
                    return;
                }

                button.addEventListener(
                    "click",
                    openCommunityModal
                );
            }
        );

        if (
            dom.closeCommunityModal
        ) {
            dom.closeCommunityModal.addEventListener(
                "click",
                closeCommunityModal
            );
        }

        if (
            dom.communityModal
        ) {
            dom.communityModal.addEventListener(
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
        }

        if (
            dom.communityModalSearch
        ) {
            dom.communityModalSearch.addEventListener(
                "input",
                event => {
                    renderCommunityChoices(
                        event.target.value
                    );
                }
            );
        }
    }


    /* =========================================================
       REMOVE START CONVERSATION
       ========================================================= */

    function disableStartConversationUI() {
        [
            dom.startConversationButton,
            dom.welcomeStartButton
        ].forEach(
            button => {
                if (!button) {
                    return;
                }

                button.hidden =
                    true;

                button.disabled =
                    true;

                button.setAttribute(
                    "aria-hidden",
                    "true"
                );
            }
        );
    }


    /* =========================================================
       MESSAGE EVENTS
       ========================================================= */

    function bindMessageEvents() {
        if (
            dom.messageForm
        ) {
            dom.messageForm.addEventListener(
                "submit",
                sendMessage
            );
        }

        if (
            dom.sendMessageButton &&
            !dom.messageForm
        ) {
            dom.sendMessageButton.addEventListener(
                "click",
                sendMessage
            );
        }

        if (
            dom.messageInput
        ) {
            dom.messageInput.addEventListener(
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
        }

        if (
            dom.channelSearchInput
        ) {
            dom.channelSearchInput.addEventListener(
                "input",
                handleChannelSearch
            );
        }

        if (
            dom.emojiButton
        ) {
            dom.emojiButton.addEventListener(
                "click",
                toggleEmojiPicker
            );
        }

        if (
            dom.chatSearchButton
        ) {
            dom.chatSearchButton.addEventListener(
                "click",
                searchMessages
            );
        }
    }


    /* =========================================================
       ACCESSIBILITY
       ========================================================= */

    function bindAccessibility() {
        document.addEventListener(
            "keydown",
            event => {
                if (
                    event.key !==
                    "Escape"
                ) {
                    return;
                }

                if (
                    state.communityModalOpen
                ) {
                    closeCommunityModal();
                }

                const picker =
                    document.getElementById(
                        "mwanikiEmojiPicker"
                    );

                if (picker) {
                    picker.hidden =
                        true;

                    state.emojiPickerOpen =
                        false;
                }

                if (
                    dom.generalCallModal &&
                    !dom.generalCallModal.hidden
                ) {
                    closeGeneralCallModal();
                }
            }
        );
    }


    /* =========================================================
       GENERAL CALL USERS
       ========================================================= */

    async function loadOnlineUsers() {
        if (
            !dom.generalCallUserList
        ) {
            return [];
        }

        dom.generalCallUserList.innerHTML = `
            <div class="call-user-loading">
                Loading students...
            </div>
        `;

        if (
            dom.generalCallUserStatus
        ) {
            dom.generalCallUserStatus.textContent =
                "Checking who is online...";
        }

        try {
            await updatePresence();

            const {
                data: presenceRows,
                error: presenceError
            } =
                await state.supabase
                    .from(
                        "chat_presence"
                    )
                    .select(
                        "user_id, status, custom_status, last_seen_at"
                    )
                    .eq(
                        "status",
                        "online"
                    );

            if (presenceError) {
                throw presenceError;
            }

            const ids = [
                ...new Set(
                    (
                        presenceRows ||
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
                    <div class="call-user-empty">
                        No other students are currently online.
                    </div>
                `;

                if (
                    dom.generalCallUserStatus
                ) {
                    dom.generalCallUserStatus.textContent =
                        "No other students are currently online.";
                }

                updateGeneralCallSelectionCount();

                return [];
            }

            const {
                data: students,
                error: studentsError
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
                        ids
                    );

            if (studentsError) {
                throw studentsError;
            }

            const studentMap =
                new Map(
                    (
                        students ||
                        []
                    ).map(
                        student => [
                            student.id,
                            normalizeProfile(
                                student
                            )
                        ]
                    )
                );

            dom.generalCallUserList.innerHTML =
                "";

            let rendered =
                0;

            ids.forEach(
                userId => {
                    const profile =
                        studentMap.get(
                            userId
                        );

                    if (!profile) {
                        return;
                    }

                    const row =
                        document.createElement(
                            "label"
                        );

                    row.className =
                        "general-call-user";

                    row.innerHTML = `
                        <input
                            type="checkbox"
                            class="general-call-user-checkbox"
                            value="${escapeHtml(
                                userId
                            )}"
                        >

                        <img
                            src="${safeUrl(
                                profile.photo_url
                            )}"
                            alt=""
                            class="general-call-user-avatar"
                        >

                        <span class="general-call-user-name">
                            ${escapeHtml(
                                profile.full_name
                            )}
                        </span>
                    `;

                    const checkbox =
                        row.querySelector(
                            "input"
                        );

                    if (checkbox) {
                        checkbox.addEventListener(
                            "change",
                            updateGeneralCallSelectionCount
                        );
                    }

                    const avatar =
                        row.querySelector(
                            ".general-call-user-avatar"
                        );

                    if (avatar) {
                        avatar.onerror =
                            () => {
                                avatar.onerror =
                                    null;

                                avatar.src =
                                    CONFIG.defaultAvatar;
                            };
                    }

                    dom.generalCallUserList.appendChild(
                        row
                    );

                    rendered++;
                }
            );

            if (!rendered) {
                dom.generalCallUserList.innerHTML = `
                    <div class="call-user-empty">
                        Online students were found, but their student profiles could not be loaded.
                    </div>
                `;
            }

            if (
                dom.generalCallUserStatus
            ) {
                dom.generalCallUserStatus.textContent =
                    `${rendered} online student${
                        rendered === 1
                            ? ""
                            : "s"
                    } available.`;
            }

            updateGeneralCallSelectionCount();

            return students || [];
        } catch (error) {
            console.error(
                "Could not load online users:",
                error
            );

            dom.generalCallUserList.innerHTML = `
                <div class="call-user-error">
                    Unable to load online students.
                </div>
            `;

            if (
                dom.generalCallUserStatus
            ) {
                dom.generalCallUserStatus.textContent =
                    error?.message ||
                    "Online student list could not be loaded.";
            }

            return [];
        }
    }


    function updateGeneralCallSelectionCount() {
        if (
            !dom.generalCallUserList
        ) {
            return;
        }

        const selected =
            dom.generalCallUserList.querySelectorAll(
                ".general-call-user-checkbox:checked"
            ).length;

        if (
            dom.generalCallSelectionCount
        ) {
            dom.generalCallSelectionCount.textContent =
                String(selected);
        }

        if (
            dom.startGeneralCallButton
        ) {
            dom.startGeneralCallButton.disabled =
                selected === 0;
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

        if (
            dom.generalCallMessage
        ) {
            dom.generalCallMessage.textContent =
                "Choose students and select voice or video.";
        }

        loadOnlineUsers();
    }


    function closeGeneralCallModal() {
        if (
            !dom.generalCallModal
        ) {
            return;
        }

        dom.generalCallModal.hidden =
            true;
    }


    /* =========================================================
       CALL ROOM CREATION
       ========================================================= */

    async function createCallRoom({
        communityId = null,
        callScope = "general",
        callType = "video"
    } = {}) {
        if (!state.user) {
            throw new Error(
                "You must be logged in to make a call."
            );
        }

        const roomCode =
            generateRoomCode();

        const payload = {
            community_id:
                communityId ||
                null,

            room_code:
                roomCode,

            call_scope:
                callScope,

            call_type:
                callType,

            status:
                "waiting",

            created_by:
                state.user.id
        };

        const {
            data,
            error
        } =
            await state.supabase
                .from(
                    "chat_call_rooms"
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

        return data;
    }


    /* =========================================================
       CALL PARTICIPANTS
       ========================================================= */

    async function addCallParticipant(
        roomId,
        userId,
        status = "invited"
    ) {
        if (
            !roomId ||
            !userId
        ) {
            return;
        }

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
        if (!communityId) {
            return [];
        }

        try {
            const {
                data,
                error
            } =
                await state.supabase
                    .from(
                        "chat_community_members"
                    )
                    .select(
                        "user_id, nickname, is_banned"
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
                data || []
            )
                .map(
                    member =>
                        member.user_id
                )
                .filter(
                    userId =>
                        userId &&
                        userId !==
                            state.user.id
                );
        } catch (error) {
            console.error(
                "Could not load community call users:",
                error
            );

            throw new Error(
                "The community members could not be loaded for this call."
            );
        }
    }


    async function loadRoomParticipants(
        roomId
    ) {
        const {
            data,
            error
        } =
            await state.supabase
                .from(
                    "chat_call_participants"
                )
                .select(
                    "user_id, status"
                )
                .eq(
                    "room_id",
                    roomId
                );

        if (error) {
            throw error;
        }

        return data || [];
    }


    /* =========================================================
       START GENERAL CALL
       ========================================================= */

    async function startGeneralCall() {
        if (!state.user) {
            return;
        }

        if (
            state.call.active
        ) {
            setStatus(
                "You are already in a call."
            );

            return;
        }

        const selected =
            dom.generalCallUserList
                ? [
                    ...dom.generalCallUserList
                        .querySelectorAll(
                            ".general-call-user-checkbox:checked"
                        )
                ].map(
                    checkbox =>
                        checkbox.value
                )
                : [];

        if (!selected.length) {
            if (
                dom.generalCallMessage
            ) {
                dom.generalCallMessage.textContent =
                    "Select at least one student.";
            }

            return;
        }

        const callType =
            state.pendingGeneralCallType ||
            "video";

        try {
            const room =
                await createCallRoom({
                    communityId:
                        null,

                    callScope:
                        "general",

                    callType
                });

            await addCallParticipant(
                room.id,
                state.user.id,
                "joined"
            );

            for (
                const userId of selected
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

                callType,

                scope:
                    "general",

                communityId:
                    null,

                participantIds:
                    selected
            });
        } catch (error) {
            console.error(
                "General call could not start:",
                error
            );

            if (
                dom.generalCallMessage
            ) {
                dom.generalCallMessage.textContent =
                    error.message ||
                    "Unable to start call.";
            }
        }
    }


    /* =========================================================
       START COMMUNITY CALL
       ========================================================= */

    async function startCommunityCall(
        callType
    ) {
        if (
            !state.selectedCommunity
        ) {
            setStatus(
                "Select a community first."
            );

            return;
        }

        if (!state.user) {
            return;
        }

        if (
            state.call.active
        ) {
            setStatus(
                "You are already in a call."
            );

            return;
        }

        try {
            const room =
                await createCallRoom({
                    communityId:
                        state.selectedCommunity.id,

                    callScope:
                        "community",

                    callType
                });

            await addCallParticipant(
                room.id,
                state.user.id,
                "joined"
            );

            const memberIds =
                await loadCommunityCallUsers(
                    state.selectedCommunity.id
                );

            for (
                const userId of memberIds
            ) {
                await addCallParticipant(
                    room.id,
                    userId,
                    "invited"
                );
            }

            await startCallInterface({
                room,

                callType,

                scope:
                    "community",

                communityId:
                    state.selectedCommunity.id,

                participantIds:
                    memberIds
            });
        } catch (error) {
            console.error(
                "Community call could not start:",
                error
            );

            setStatus(
                error.message ||
                    "Unable to start community call."
            );
        }
    }


    /* =========================================================
       CALL INTERFACE
       ========================================================= */

    async function startCallInterface({
        room,
        callType,
        scope,
        communityId,
        participantIds = []
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

        state.call.microphoneEnabled =
            true;

        state.call.cameraEnabled =
            callType === "video";

        state.call.screenSharing =
            false;

        state.call.pendingIceCandidates.clear();

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
                callType ===
                "video"
                    ? "📹"
                    : "📞";
        }

        if (
            dom.callTitle
        ) {
            dom.callTitle.textContent =
                scope ===
                    "community" &&
                state.selectedCommunity
                    ? state.selectedCommunity.name
                    : "Mwaniki General Call";
        }

        if (
            dom.callSubtitle
        ) {
            dom.callSubtitle.textContent =
                callType ===
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

        startCallTimer();

        try {
            await acquireLocalMedia(
                callType
            );

            await subscribeToCallRoom(
                room.id
            );

            await subscribeToCallParticipants(
                room.id
            );

            await markCallRoomStarted(
                room.id
            );

            if (
                participantIds &&
                participantIds.length
            ) {
                await initiateOutgoingConnections(
                    participantIds
                );
            }
        } catch (error) {
            console.error(
                "Call interface initialization failed:",
                error
            );

            await leaveCall(
                true
            );

            throw error;
        }
    }


    /* =========================================================
       LOCAL MEDIA
       ========================================================= */

    async function acquireLocalMedia(
        callType
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

        const constraints =
            callType === "video"
                ? {
                    audio:
                        true,

                    video:
                        true
                }
                : {
                    audio:
                        true,

                    video:
                        false
                };

        try {
            const stream =
                await navigator.mediaDevices
                    .getUserMedia(
                        constraints
                    );

            state.call.localStream =
                stream;

            if (
                dom.localVideo
            ) {
                dom.localVideo.srcObject =
                    callType === "video"
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
                "Could not access microphone/camera:",
                error
            );

            if (
                error?.name ===
                "NotAllowedError"
            ) {
                throw new Error(
                    "Camera or microphone permission was not granted."
                );
            }

            if (
                error?.name ===
                "NotFoundError"
            ) {
                throw new Error(
                    "No suitable camera or microphone was found."
                );
            }

            throw new Error(
                "Could not access your camera or microphone."
            );
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
                        !state.call.startedAt
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
                            seconds / 60
                        );

                    const remaining =
                        seconds % 60;

                    if (
                        dom.callDuration
                    ) {
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
                    }
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

            state.call.timer =
                null;
        }
    }


    /* =========================================================
       CALL ROOM REALTIME
       ========================================================= */

    async function subscribeToCallRoom(
        roomId
    ) {
        if (!roomId) {
            return;
        }

        if (
            state.call.roomChannel
        ) {
            removeRealtimeChannel(
                state.call.roomChannel
            );

            state.call.roomChannel =
                null;
        }

        const channel =
            state.supabase
                .channel(
                    `call-room:${roomId}:${state.user.id}`
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
                    async payload => {
                        const signal =
                            payload.new;

                        if (
                            !signal
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

                        await handleCallSignal(
                            signal
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

        channel.__mwanikiCallRoom =
            true;

        state.call.roomChannel =
            channel;

        state.realtimeChannels.push(
            channel
        );
    }


    async function subscribeToCallParticipants(
        roomId
    ) {
        if (!roomId) {
            return;
        }

        if (
            state.call.participantChannel
        ) {
            removeRealtimeChannel(
                state.call.participantChannel
            );

            state.call.participantChannel =
                null;
        }

        const channel =
            state.supabase
                .channel(
                    `call-participants:${roomId}:${state.user.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event:
                            "*",

                        schema:
                            "public",

                        table:
                            "chat_call_participants",

                        filter:
                            `room_id=eq.${roomId}`
                    },
                    async payload => {
                        const participant =
                            payload.new;

                        if (
                            !participant ||
                            participant.user_id ===
                                state.user.id
                        ) {
                            return;
                        }

                        /*
                         * When an invited participant becomes
                         * joined, the caller establishes a
                         * fresh offer if needed.
                         */
                        if (
                            participant.status ===
                            "joined"
                        ) {
                            if (
                                !state.call.peerConnections.has(
                                    participant.user_id
                                )
                            ) {
                                try {
                                    await createPeerConnection(
                                        participant.user_id,
                                        true
                                    );
                                } catch (error) {
                                    console.error(
                                        "Could not connect newly joined participant:",
                                        error
                                    );
                                }
                            }
                        }
                    }
                )
                .subscribe(
                    status => {
                        console.log(
                            "Call participant realtime:",
                            status
                        );
                    }
                );

        channel.__mwanikiCallParticipants =
            true;

        state.call.participantChannel =
            channel;

        state.realtimeChannels.push(
            channel
        );
    }


    /* =========================================================
       CALL SIGNALING
       ========================================================= */

    async function sendCallSignal({
        roomId,
        receiverId = null,
        signalType,
        payload
    }) {
        if (
            !roomId ||
            !state.user
        ) {
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
                        roomId,

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
                "Call signal failed:",
                error
            );
        }
    }


    /* =========================================================
       WEBRTC PEER CONNECTION
       ========================================================= */

    async function createPeerConnection(
        remoteUserId,
        offerer = false
    ) {
        if (
            !remoteUserId ||
            remoteUserId ===
                state.user.id
        ) {
            return null;
        }

        if (
            state.call.peerConnections.has(
                remoteUserId
            )
        ) {
            return state.call.peerConnections.get(
                remoteUserId
            );
        }

        const pc =
            new RTCPeerConnection(
                CONFIG.rtcConfiguration
            );

        state.call.peerConnections.set(
            remoteUserId,
            pc
        );

        if (
            state.call.localStream
        ) {
            state.call.localStream
                .getTracks()
                .forEach(
                    track => {
                        pc.addTrack(
                            track,
                            state.call.localStream
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

                await sendCallSignal({
                    roomId:
                        state.call.roomId,

                    receiverId:
                        remoteUserId,

                    signalType:
                        "ice-candidate",

                    payload:
                        event.candidate.toJSON
                            ? event.candidate.toJSON()
                            : event.candidate
                });
            };

        pc.ontrack =
            event => {
                const stream =
                    event.streams &&
                    event.streams[0];

                if (stream) {
                    renderRemoteVideo(
                        remoteUserId,
                        stream
                    );
                }
            };

        pc.onconnectionstatechange =
            () => {
                const connectionState =
                    pc.connectionState;

                if (
                    connectionState ===
                        "failed" ||
                    connectionState ===
                        "closed"
                ) {
                    removePeer(
                        remoteUserId
                    );
                }
            };

        pc.oniceconnectionstatechange =
            () => {
                if (
                    pc.iceConnectionState ===
                        "failed" ||
                    pc.iceConnectionState ===
                        "closed"
                ) {
                    removePeer(
                        remoteUserId
                    );
                }
            };

        if (offerer) {
            const offer =
                await pc.createOffer({
                    offerToReceiveAudio:
                        true,

                    offerToReceiveVideo:
                        state.call.callType ===
                        "video"
                });

            await pc.setLocalDescription(
                offer
            );

            await sendCallSignal({
                roomId:
                    state.call.roomId,

                receiverId:
                    remoteUserId,

                signalType:
                    "offer",

                payload:
                    pc.localDescription
            });
        }

        return pc;
    }


    async function initiateOutgoingConnections(
        participantIds
    ) {
        if (
            !participantIds ||
            !participantIds.length
        ) {
            return;
        }

        for (
            const userId of participantIds
        ) {
            if (
                !userId ||
                userId ===
                    state.user.id
            ) {
                continue;
            }

            try {
                await createPeerConnection(
                    userId,
                    true
                );
            } catch (error) {
                console.error(
                    "Could not create outgoing peer connection:",
                    userId,
                    error
                );
            }
        }
    }


    /* =========================================================
       ICE QUEUE
       ========================================================= */

    function queueIceCandidate(
        userId,
        candidate
    ) {
        if (
            !state.call.pendingIceCandidates.has(
                userId
            )
        ) {
            state.call.pendingIceCandidates.set(
                userId,
                []
            );
        }

        state.call.pendingIceCandidates
            .get(userId)
            .push(candidate);
    }


    async function drainIceCandidates(
        userId,
        pc
    ) {
        const queue =
            state.call.pendingIceCandidates.get(
                userId
            );

        if (
            !queue ||
            !queue.length
        ) {
            return;
        }

        state.call.pendingIceCandidates.delete(
            userId
        );

        for (
            const candidate of queue
        ) {
            try {
                await pc.addIceCandidate(
                    new RTCIceCandidate(
                        candidate
                    )
                );
            } catch (error) {
                console.warn(
                    "Queued ICE candidate failed:",
                    error
                );
            }
        }
    }


    /* =========================================================
       SIGNAL HANDLER
       ========================================================= */

    async function handleCallSignal(
        signal
    ) {
        const remoteUserId =
            signal.sender_id;

        if (!remoteUserId) {
            return;
        }

        let pc =
            state.call.peerConnections.get(
                remoteUserId
            );

        if (
            signal.signal_type ===
            "offer"
        ) {
            pc =
                await createPeerConnection(
                    remoteUserId,
                    false
                );

            if (!pc) {
                return;
            }

            try {
                await pc.setRemoteDescription(
                    new RTCSessionDescription(
                        signal.payload
                    )
                );

                await drainIceCandidates(
                    remoteUserId,
                    pc
                );

                const answer =
                    await pc.createAnswer();

                await pc.setLocalDescription(
                    answer
                );

                await sendCallSignal({
                    roomId:
                        state.call.roomId,

                    receiverId:
                        remoteUserId,

                    signalType:
                        "answer",

                    payload:
                        pc.localDescription
                });
            } catch (error) {
                console.error(
                    "Offer handling failed:",
                    error
                );
            }

            return;
        }

        if (
            signal.signal_type ===
            "answer"
        ) {
            if (!pc) {
                return;
            }

            try {
                await pc.setRemoteDescription(
                    new RTCSessionDescription(
                        signal.payload
                    )
                );

                await drainIceCandidates(
                    remoteUserId,
                    pc
                );
            } catch (error) {
                console.error(
                    "Answer handling failed:",
                    error
                );
            }

            return;
        }

        if (
            signal.signal_type ===
            "ice-candidate"
        ) {
            if (!pc) {
                queueIceCandidate(
                    remoteUserId,
                    signal.payload
                );

                return;
            }

            if (
                !pc.remoteDescription ||
                !pc.remoteDescription.type
            ) {
                queueIceCandidate(
                    remoteUserId,
                    signal.payload
                );

                return;
            }

            try {
                await pc.addIceCandidate(
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

            video.controls =
                false;

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
        const pc =
            state.call.peerConnections.get(
                userId
            );

        if (pc) {
            try {
                pc.close();
            } catch (_) {}

            state.call.peerConnections.delete(
                userId
            );
        }

        state.call.pendingIceCandidates.delete(
            userId
        );

        if (
            typeof CSS !==
                "undefined" &&
            CSS.escape
        ) {
            const tile =
                document.querySelector(
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
       CALL CONTROLS
       ========================================================= */

    function toggleMicrophone() {
        const stream =
            state.call.localStream;

        if (!stream) {
            return;
        }

        const audioTracks =
            stream.getAudioTracks();

        if (!audioTracks.length) {
            return;
        }

        state.call.microphoneEnabled =
            !state.call.microphoneEnabled;

        audioTracks.forEach(
            track => {
                track.enabled =
                    state.call.microphoneEnabled;
            }
        );

        if (
            dom.toggleMicrophoneButton
        ) {
            dom.toggleMicrophoneButton
                .setAttribute(
                    "aria-pressed",
                    String(
                        state.call.microphoneEnabled
                    )
                );

            dom.toggleMicrophoneButton.textContent =
                state.call.microphoneEnabled
                    ? "🎙️"
                    : "🔇";
        }
    }


    function toggleCamera() {
        const stream =
            state.call.localStream;

        if (!stream) {
            return;
        }

        const videoTracks =
            stream.getVideoTracks();

        if (!videoTracks.length) {
            return;
        }

        state.call.cameraEnabled =
            !state.call.cameraEnabled;

        videoTracks.forEach(
            track => {
                track.enabled =
                    state.call.cameraEnabled;
            }
        );

        if (
            dom.toggleCameraButton
        ) {
            dom.toggleCameraButton
                .setAttribute(
                    "aria-pressed",
                    String(
                        state.call.cameraEnabled
                    )
                );

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
            setStatus(
                "Screen sharing is not supported by this browser."
            );

            return;
        }

        if (
            state.call.screenSharing
        ) {
            stopScreenShare();

            return;
        }

        if (
            state.call.callType !==
            "video"
        ) {
            setStatus(
                "Screen sharing is available during video calls."
            );

            return;
        }

        try {
            const stream =
                await navigator.mediaDevices
                    .getDisplayMedia({
                        video:
                            true
                    });

            const screenTrack =
                stream.getVideoTracks()[0];

            if (!screenTrack) {
                return;
            }

            state.call.screenStream =
                stream;

            state.call.screenSharing =
                true;

            state.call.peerConnections
                .forEach(
                    pc => {
                        const sender =
                            pc.getSenders()
                                .find(
                                    item =>
                                        item.track &&
                                        item.track.kind ===
                                            "video"
                                );

                        if (sender) {
                            sender.replaceTrack(
                                screenTrack
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

            screenTrack.onended =
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

        const cameraTrack =
            state.call.localStream
                ?.getVideoTracks()[0];

        if (cameraTrack) {
            state.call.peerConnections
                .forEach(
                    pc => {
                        const sender =
                            pc.getSenders()
                                .find(
                                    item =>
                                        item.track &&
                                        item.track.kind ===
                                            "video"
                                );

                        if (sender) {
                            sender.replaceTrack(
                                cameraTrack
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
       END CALL
       ========================================================= */

    async function leaveCall(
        silent = false
    ) {
        const roomId =
            state.call.roomId;

        if (
            roomId &&
            state.user
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
                        roomId
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    );
            } catch (error) {
                console.warn(
                    "Could not update call participant:",
                    error
                );
            }
        }

        stopScreenShare();

        state.call.peerConnections
            .forEach(
                pc => {
                    try {
                        pc.close();
                    } catch (_) {}
                }
            );

        state.call.peerConnections.clear();

        state.call.pendingIceCandidates.clear();

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

        if (
            state.call.roomChannel
        ) {
            removeRealtimeChannel(
                state.call.roomChannel
            );

            state.call.roomChannel =
                null;
        }

        if (
            state.call.participantChannel
        ) {
            removeRealtimeChannel(
                state.call.participantChannel
            );

            state.call.participantChannel =
                null;
        }

        stopCallTimer();

        state.call.active =
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

        state.call.channelId =
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

        if (!silent) {
            announce(
                "Call ended."
            );
        }
    }


    async function markCallRoomStarted(
        roomId
    ) {
        if (!roomId) {
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
                    "chat_call_rooms"
                )
                .update({
                    status:
                        "active",

                    started_at:
                        now,

                    updated_at:
                        now
                })
                .eq(
                    "id",
                    roomId
                );

        if (error) {
            console.warn(
                "Could not mark call active:",
                error
            );
        }
    }


    /* =========================================================
       INCOMING CALL LISTENER
       ========================================================= */

    function setupIncomingCallListener() {
        if (!state.user) {
            return;
        }

        const existing =
            state.realtimeChannels.find(
                channel =>
                    channel.__mwanikiIncomingCall
            );

        if (existing) {
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
                    async payload => {
                        const participant =
                            payload.new;

                        if (
                            !participant ||
                            participant.status !==
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

                        await showIncomingCall(
                            participant.room_id
                        );
                    }
                )
                .subscribe(
                    status => {
                        console.log(
                            "Incoming call listener:",
                            status
                        );
                    }
                );

        channel.__mwanikiIncomingCall =
            true;

        state.realtimeChannels.push(
            channel
        );
    }


    async function showIncomingCall(
        roomId
    ) {
        if (
            !dom.incomingCallToast ||
            !roomId
        ) {
            return;
        }

        const {
            data: room,
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

        if (error) {
            console.warn(
                "Could not load incoming call room:",
                error
            );

            return;
        }

        if (!room) {
            return;
        }

        if (
            room.status ===
                "ended"
        ) {
            return;
        }

        state.call.incoming =
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

        dom.incomingCallToast.hidden =
            false;
    }


    async function acceptIncomingCall() {
        const room =
            state.call.incoming;

        if (!room) {
            return;
        }

        state.call.incoming =
            null;

        if (
            dom.incomingCallToast
        ) {
            dom.incomingCallToast.hidden =
                true;
        }

        try {
            /*
             * Start the call interface first so that the
             * signaling subscription exists before the
             * caller sends/re-sends the offer.
             */
            await startCallInterface({
                room,

                callType:
                    room.call_type,

                scope:
                    room.call_scope,

                communityId:
                    room.community_id,

                participantIds:
                    []
            });

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

            /*
             * Fetch current room participants. This catches
             * callers who created an offer before our listener
             * became ready.
             */
            const participants =
                await loadRoomParticipants(
                    room.id
                );

            for (
                const participant of participants
            ) {
                if (
                    participant.user_id &&
                    participant.user_id !==
                        state.user.id &&
                    participant.status ===
                        "joined"
                ) {
                    /*
                     * The caller may already have a peer
                     * connection. We only create one when
                     * needed.
                     */
                    if (
                        !state.call.peerConnections.has(
                            participant.user_id
                        )
                    ) {
                        await createPeerConnection(
                            participant.user_id,
                            false
                        );
                    }
                }
            }
        } catch (error) {
            console.error(
                "Could not accept call:",
                error
            );

            await leaveCall(
                true
            );

            setStatus(
                error.message ||
                    "Could not join the call."
            );
        }
    }


    async function declineIncomingCall() {
        const room =
            state.call.incoming;

        if (!room) {
            return;
        }

        state.call.incoming =
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

            if (error) {
                console.warn(
                    "Could not decline call:",
                    error
                );
            }
        } catch (error) {
            console.warn(
                "Could not decline call:",
                error
            );
        }
    }


    /* =========================================================
       CALL EVENTS
       ========================================================= */

    function bindCallEvents() {
        if (
            dom.generalCallButton
        ) {
            dom.generalCallButton.addEventListener(
                "click",
                openGeneralCallModal
            );
        }

        if (
            dom.closeGeneralCallModalButton
        ) {
            dom.closeGeneralCallModalButton.addEventListener(
                "click",
                closeGeneralCallModal
            );
        }

        if (
            dom.cancelGeneralCallButton
        ) {
            dom.cancelGeneralCallButton.addEventListener(
                "click",
                closeGeneralCallModal
            );
        }

        if (
            dom.generalVoiceCallButton
        ) {
            dom.generalVoiceCallButton.addEventListener(
                "click",
                () => {
                    state.pendingGeneralCallType =
                        "voice";

                    if (
                        dom.generalCallMessage
                    ) {
                        dom.generalCallMessage.textContent =
                            "Voice call selected. Choose students below.";
                    }
                }
            );
        }

        if (
            dom.generalVideoCallButton
        ) {
            dom.generalVideoCallButton.addEventListener(
                "click",
                () => {
                    state.pendingGeneralCallType =
                        "video";

                    if (
                        dom.generalCallMessage
                    ) {
                        dom.generalCallMessage.textContent =
                            "Video call selected. Choose students below.";
                    }
                }
            );
        }

        if (
            dom.startGeneralCallButton
        ) {
            dom.startGeneralCallButton.addEventListener(
                "click",
                startGeneralCall
            );
        }

        if (
            dom.voiceCallButton
        ) {
            dom.voiceCallButton.addEventListener(
                "click",
                () => {
                    startCommunityCall(
                        "voice"
                    );
                }
            );
        }

        if (
            dom.videoCallButton
        ) {
            dom.videoCallButton.addEventListener(
                "click",
                () => {
                    startCommunityCall(
                        "video"
                    );
                }
            );
        }

        if (
            dom.toggleMicrophoneButton
        ) {
            dom.toggleMicrophoneButton.addEventListener(
                "click",
                toggleMicrophone
            );
        }

        if (
            dom.toggleCameraButton
        ) {
            dom.toggleCameraButton.addEventListener(
                "click",
                toggleCamera
            );
        }

        if (
            dom.shareScreenButton
        ) {
            dom.shareScreenButton.addEventListener(
                "click",
                toggleScreenShare
            );
        }

        if (
            dom.leaveCallButton
        ) {
            dom.leaveCallButton.addEventListener(
                "click",
                () => leaveCall()
            );
        }

        if (
            dom.acceptCallButton
        ) {
            dom.acceptCallButton.addEventListener(
                "click",
                acceptIncomingCall
            );
        }

        if (
            dom.declineCallButton
        ) {
            dom.declineCallButton.addEventListener(
                "click",
                declineIncomingCall
            );
        }

        if (
            dom.generalCallModal
        ) {
            dom.generalCallModal.addEventListener(
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
        }

        if (
            dom.minimizeCallButton
        ) {
            dom.minimizeCallButton.addEventListener(
                "click",
                () => {
                    if (
                        dom.callOverlay
                    ) {
                        dom.callOverlay.classList.toggle(
                            "call-minimized"
                        );
                    }
                }
            );
        }
    }


    /* =========================================================
       COMMUNITY REALTIME
       ========================================================= */

    function subscribeToCommunityRealtime() {
        if (
            state.communityRealtimeChannel
        ) {
            removeRealtimeChannel(
                state.communityRealtimeChannel
            );

            state.communityRealtimeChannel =
                null;
        }

        const channel =
            state.supabase
                .channel(
                    `community-messages:${state.user.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event:
                            "INSERT",

                        schema:
                            "public",

                        table:
                            "chat_messages"
                    },
                    async payload => {
                        const message =
                            payload.new;

                        if (
                            !message
                        ) {
                            return;
                        }

                        if (
                            message.channel_id !==
                            state.selectedChannel?.id
                        ) {
                            return;
                        }

                        /*
                         * Avoid duplicating messages that
                         * this browser already appended.
                         */
                        if (
                            state.messages.some(
                                item =>
                                    item.id ===
                                    message.id
                            )
                        ) {
                            return;
                        }

                        const {
                            data: student
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
                                    message.user_id
                                )
                                .maybeSingle();

                        message._profile =
                            student
                                ? normalizeProfile(
                                    student
                                )
                                : null;

                        state.messages.push(
                            message
                        );

                        renderMessages();
                    }
                )
                .subscribe(
                    status => {
                        console.log(
                            "Community realtime:",
                            status
                        );
                    }
                );

        channel.__mwanikiCommunity =
            true;

        state.communityRealtimeChannel =
            channel;

        state.realtimeChannels.push(
            channel
        );
    }


    /* =========================================================
       MOBILE SIDEBAR
       ========================================================= */

    function toggleMobileSidebar() {
        if (
            dom.channelSidebar
        ) {
            dom.channelSidebar.classList.toggle(
                "mobile-open"
            );
        }
    }


    /* =========================================================
       GENERAL SEARCH / PROFILE EVENTS
       ========================================================= */

    function bindAdditionalUI() {
        if (
            dom.channelToggleButton
        ) {
            dom.channelToggleButton.addEventListener(
                "click",
                toggleMobileSidebar
            );
        }

        if (
            dom.generalCallUserInput
        ) {
            dom.generalCallUserInput.addEventListener(
                "input",
                filterGeneralCallUsers
            );
        }

        if (
            dom.generalCallUserList
        ) {
            dom.generalCallUserList.addEventListener(
                "change",
                updateGeneralCallSelectionCount
            );
        }
    }


    function filterGeneralCallUsers(
        event
    ) {
        const term =
            String(
                event.target.value ||
                    ""
            )
                .trim()
                .toLowerCase();

        if (
            !dom.generalCallUserList
        ) {
            return;
        }

        dom.generalCallUserList
            .querySelectorAll(
                ".general-call-user"
            )
            .forEach(
                row => {
                    const name =
                        row.querySelector(
                            ".general-call-user-name"
                        )
                            ?.textContent ||
                        "";

                    row.hidden =
                        term.length > 0 &&
                        !name
                            .toLowerCase()
                            .includes(
                                term
                            );
                }
            );
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

        cacheDom();

        disableStartConversationUI();

        try {
            await waitForSupabase();

            await loadAuthenticatedUser();

            await loadProfile();

            await loadCommunities();

            console.log(
                "Mwaniki Community: Ready"
            );

            if (
                state.communities.length
            ) {
                await selectCommunity(
                    state.communities[0].id
                );
            } else {
                renderMessageArea();
            }

            createEmojiPicker();

            bindNavigation();

            bindMessageEvents();

            bindAccessibility();

            bindCallEvents();

            bindAdditionalUI();

            startPresenceHeartbeat();

            setupIncomingCallListener();

            subscribeToCommunityRealtime();

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
       CLEANUP
       ========================================================= */

    window.addEventListener(
        "beforeunload",
        () => {
            if (
                state.presenceTimer
            ) {
                clearInterval(
                    state.presenceTimer
                );
            }

            if (
                state.call.active
            ) {
                state.call.peerConnections
                    .forEach(
                        pc => {
                            try {
                                pc.close();
                            } catch (_) {}
                        }
                    );
            }
        }
    );


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

        openCommunityModal,

        closeCommunityModal,

        openGeneralCallModal,

        closeGeneralCallModal,

        startCommunityCall,

        startGeneralCall,

        leaveCall,

        loadOnlineUsers,

        getProfileName,

        getProfilePhoto,

        updatePresence
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
