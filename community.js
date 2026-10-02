/* ============================================================
   MWANIKI SCHOLARS COMMUNITY
   community.js
   ============================================================

   IMPORTANT DATABASE RELATIONSHIP

   chat_messages.user_id
           ↓
   students.id
           ↓
   students.full_name
   students.photo_url

   There is NO students.user_id column.

   This file intentionally does not use:
       students.user_id
       students.name
       students.student_name

   ============================================================ */

(() => {
    "use strict";

    /* =========================================================
       CONFIG
       ========================================================= */

    const CONFIG = {
        dashboardUrl: "./dashboard.html",
        profileUrl: "./profile.html",
        profileBucket: "student-profiles",

        defaultAvatar:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
                    <rect width="96" height="96" rx="48" fill="#087f73"/>
                    <circle cx="48" cy="35" r="17" fill="#ffffff"/>
                    <path d="M18 82c4-18 16-27 30-27s26 9 30 27" fill="#ffffff"/>
                </svg>
            `),

        messageLimit: 100,
        presenceHeartbeat: 30000,
        realtimeRetryDelay: 3000,

        rtcConfiguration: {
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


    /* =========================================================
       STATE
       ========================================================= */

    const state = {
        supabase: null,
        user: null,
        profile: null,

        communities: [],
        channels: [],
        messages: [],

        selectedCommunity: null,
        selectedChannel: null,

        searchTerm: "",

        loading: false,
        initialized: false,

        realtimeChannels: [],

        presenceTimer: null,

        communityModalOpen: false,

        emojiPickerOpen: false,

        messageSending: false,

        initializedCommunityRealtime: false,

        call: {
            active: false,
            roomId: null,
            roomCode: null,
            callType: null,
            scope: null,
            communityId: null,
            channelId: null,

            peerConnections: new Map(),
            participants: new Map(),

            localStream: null,
            screenStream: null,

            microphoneEnabled: true,
            cameraEnabled: true,
            screenSharing: false,

            startedAt: null,
            timer: null,

            signalingChannel: null,
            roomChannel: null,

            incoming: null
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
            dom[id] = document.getElementById(id);
        });
    }


    /* =========================================================
       SUPABASE
       ========================================================= */

    async function waitForSupabase(timeout = 15000) {
        const started = Date.now();

        while (Date.now() - started < timeout) {
            const client =
                window.supabaseClient ||
                window.sb ||
                window.mwanikiSupabase ||
                window.supabase;

            if (client && typeof client.from === "function") {
                state.supabase = client;
                return client;
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        throw new Error(
            "Mwaniki Community could not find the existing Supabase client."
        );
    }


    /* =========================================================
       UTILITIES
       ========================================================= */

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function safeUrl(value) {
        if (!value) return CONFIG.defaultAvatar;

        const url = String(value).trim();

        if (
            url.startsWith("https://") ||
            url.startsWith("http://") ||
            url.startsWith("data:image/")
        ) {
            return url;
        }

        return CONFIG.defaultAvatar;
    }


    function initials(name) {
        const clean = String(name || "Student").trim();

        if (!clean) return "S";

        const parts = clean.split(/\s+/).filter(Boolean);

        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }

        return (
            parts[0][0] +
            parts[parts.length - 1][0]
        ).toUpperCase();
    }


    function formatTime(value) {
        if (!value) return "";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
    }


    function formatDate(value) {
        if (!value) return "";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleDateString([], {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }


    function setStatus(message) {
        if (dom.communityStatus) {
            dom.communityStatus.textContent = message || "";
        }

        announce(message);
    }


    function announce(message) {
        if (!dom.accessibilityAnnouncer) return;

        dom.accessibilityAnnouncer.textContent = "";

        setTimeout(() => {
            dom.accessibilityAnnouncer.textContent =
                message || "";
        }, 20);
    }


    function getProfileName() {
        if (!state.profile) {
            return "Student";
        }

        return (
            state.profile.full_name ||
            state.profile.display_name ||
            "Student"
        );
    }


    function getProfilePhoto() {
        if (!state.profile) {
            return CONFIG.defaultAvatar;
        }

        return safeUrl(state.profile.photo_url);
    }


    function normalizeProfile(profile) {
        if (!profile) return null;

        return {
            id: profile.id || null,

            full_name:
                profile.full_name ||
                profile.display_name ||
                "Student",

            photo_url:
                profile.photo_url ||
                ""
        };
    }


    /* =========================================================
       AUTHENTICATION
       ========================================================= */

    async function loadAuthenticatedUser() {
        const { data, error } =
            await state.supabase.auth.getUser();

        if (error) {
            throw error;
        }

        if (!data || !data.user) {
            throw new Error(
                "No authenticated student was found."
            );
        }

        state.user = data.user;

        console.log(
            "Community authenticated user:",
            state.user.id
        );
    }


    /* =========================================================
       STUDENT PROFILE
       ========================================================= */

    async function fetchStudentProfile(userId) {
        if (!userId) return null;

        /*
         * CORRECT RELATIONSHIP:
         *
         * students.id = authenticated/user UUID
         *
         * There is NO students.user_id.
         */

        const { data, error } =
            await state.supabase
                .from("students")
                .select("id, full_name, email, phone, course, level, photo_url, created_at")
                .eq("id", userId)
                .maybeSingle();

        if (error) {
            console.warn(
                "Student profile lookup failed:",
                error
            );

            return null;
        }

        return normalizeProfile(data);
    }


    async function loadProfile() {
        state.profile =
            await fetchStudentProfile(state.user.id);

        if (!state.profile) {
            state.profile = {
                id: state.user.id,
                full_name: "Student",
                photo_url: ""
            };
        }

        console.log(
            "Community profile loaded:",
            getProfileName()
        );

        renderProfileUI();
    }


    function renderProfileUI() {
        const name = getProfileName();
        const photo = getProfilePhoto();

        const avatars = [
            dom.sidebarProfileAvatar,
            dom.railProfileAvatar
        ];

        avatars.forEach(avatar => {
            if (!avatar) return;

            avatar.src = photo;
            avatar.alt = `${name} profile photo`;

            avatar.onerror = () => {
                avatar.onerror = null;
                avatar.src = CONFIG.defaultAvatar;
            };
        });

        if (dom.sidebarProfileName) {
            dom.sidebarProfileName.textContent = name;
        }
    }


    /* =========================================================
       COMMUNITIES
       ========================================================= */

    async function loadCommunities() {
        const { data, error } =
            await state.supabase
                .from("chat_communities")
                .select(`
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
                `)
                .eq("is_active", true)
                .order("created_at", {
                    ascending: true
                });

        if (error) {
            throw error;
        }

        state.communities = data || [];

        console.log(
            "Communities loaded:",
            state.communities.length
        );

        renderCommunityRail();
    }


    /* =========================================================
       CHANNELS
       ========================================================= */

    async function loadChannels(communityId) {
        if (!communityId) {
            state.channels = [];
            renderChannels();
            return;
        }

        const { data, error } =
            await state.supabase
                .from("chat_channels")
                .select(`
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
                `)
                .eq("community_id", communityId)
                .eq("is_active", true)
                .eq("is_archived", false)
                .order("position", {
                    ascending: true
                })
                .order("created_at", {
                    ascending: true
                });

        if (error) {
            throw error;
        }

        state.channels = data || [];

        console.log(
            "Channels loaded:",
            state.channels.length
        );

        renderChannels();
    }


    /* =========================================================
       COMMUNITY RAIL
       ========================================================= */

    function renderCommunityRail() {
        const container =
            dom.communityRailList;

        if (!container) return;

        container.innerHTML = "";

        state.communities.forEach(community => {
            const button =
                document.createElement("button");

            button.type = "button";
            button.className =
                "community-rail-item";

            if (
                state.selectedCommunity &&
                String(state.selectedCommunity.id) ===
                String(community.id)
            ) {
                button.classList.add("active");
            }

            button.dataset.communityId =
                community.id;

            const icon =
                community.icon_url ||
                "";

            button.innerHTML = `
                <span class="community-rail-icon">
                    ${
                        icon
                            ? `<img src="${safeUrl(icon)}"
                                    alt=""
                                    aria-hidden="true">`
                            : escapeHtml(
                                initials(community.name)
                            )
                    }
                </span>
                <span class="sr-only">
                    ${escapeHtml(community.name)}
                </span>
            `;

            button.addEventListener(
                "click",
                () => {
                    selectCommunity(community.id);
                }
            );

            container.appendChild(button);
        });
    }


    /* =========================================================
       SELECT COMMUNITY
       ========================================================= */

    async function selectCommunity(communityId) {
        const community =
            state.communities.find(
                item =>
                    String(item.id) ===
                    String(communityId)
            );

        if (!community) {
            return;
        }

        state.selectedCommunity =
            community;

        state.selectedChannel = null;
        state.messages = [];

        renderCommunityRail();
        renderSelectedCommunity();
        renderMessageArea();

        await loadChannels(community.id);

        if (state.channels.length) {
            const general =
                state.channels.find(channel =>
                    String(channel.name)
                        .toLowerCase() === "general"
                );

            await selectChannel(
                (general || state.channels[0]).id
            );
        } else {
            renderMessageArea();
        }

        subscribeToCommunityRealtime();

        announce(
            `Community selected: ${community.name}`
        );
    }


    function renderSelectedCommunity() {
        const community =
            state.selectedCommunity;

        if (!community) return;

        const name =
            community.name || "Community";

        const description =
            community.description || "";

        const icon =
            community.icon_url || "";

        if (dom.selectedCommunityName) {
            dom.selectedCommunityName.textContent =
                name;
        }

        if (dom.activeCommunityName) {
            dom.activeCommunityName.textContent =
                name;
        }

        if (dom.selectedCommunityDescription) {
            dom.selectedCommunityDescription.textContent =
                description;
        }

        if (dom.activeCommunityDescription) {
            dom.activeCommunityDescription.textContent =
                description;
        }

        if (dom.communityBrandTitle) {
            dom.communityBrandTitle.textContent =
                name;
        }

        if (dom.communityBrandSubtitle) {
            dom.communityBrandSubtitle.textContent =
                description;
        }

        [
            dom.selectedCommunityIcon,
            dom.activeCommunityIcon
        ].forEach(element => {
            if (!element) return;

            if (icon) {
                element.src = safeUrl(icon);
                element.alt =
                    `${name} icon`;
            } else {
                element.removeAttribute("src");
                element.alt = "";
            }
        });

        if (
            dom.communityCourseBanner
        ) {
            dom.communityCourseBanner.hidden =
                true;
        }
    }


    /* =========================================================
       CHANNEL RENDERING
       ========================================================= */

    function renderChannels() {
        const container =
            dom.channelList;

        if (!container) return;

        container.innerHTML = "";

        const search =
            String(state.searchTerm || "")
                .trim()
                .toLowerCase();

        const filtered =
            state.channels.filter(channel => {
                if (!search) return true;

                return (
                    String(channel.name || "")
                        .toLowerCase()
                        .includes(search) ||
                    String(channel.description || "")
                        .toLowerCase()
                        .includes(search)
                );
            });

        if (!filtered.length) {
            container.innerHTML = `
                <div class="community-empty-state">
                    No channels found.
                </div>
            `;

            return;
        }

        filtered.forEach(channel => {
            const button =
                document.createElement("button");

            button.type = "button";
            button.className = "channel-item";

            if (
                state.selectedChannel &&
                String(state.selectedChannel.id) ===
                String(channel.id)
            ) {
                button.classList.add("active");
            }

            button.dataset.channelId =
                channel.id;

            const channelIcon =
                channel.icon ||
                (
                    channel.channel_type === "voice"
                        ? "🔊"
                        : "#"
                );

            button.innerHTML = `
                <span class="channel-item-icon">
                    ${escapeHtml(channelIcon)}
                </span>

                <span class="channel-item-text">
                    ${escapeHtml(channel.name)}
                </span>
            `;

            button.addEventListener(
                "click",
                () => {
                    selectChannel(channel.id);
                }
            );

            container.appendChild(button);
        });
    }


    /* =========================================================
       SELECT CHANNEL
       ========================================================= */

    async function selectChannel(channelId) {
        const channel =
            state.channels.find(
                item =>
                    String(item.id) ===
                    String(channelId)
            );

        if (!channel) return;

        state.selectedChannel =
            channel;

        state.messages = [];

        renderChannels();
        renderSelectedChannel();

        await loadMessages(channel.id);

        subscribeToChannelRealtime();

        announce(
            `Channel selected: ${channel.name}`
        );
    }


    function renderSelectedChannel() {
        const channel =
            state.selectedChannel;

        if (!channel) return;

        if (dom.mainChannelTitle) {
            dom.mainChannelTitle.textContent =
                channel.name;
        }

        if (dom.activeChannelName) {
            dom.activeChannelName.textContent =
                channel.name;
        }

        if (dom.mainChannelDescription) {
            dom.mainChannelDescription.textContent =
                channel.description || "";
        }

        if (dom.activeChannelDescription) {
            dom.activeChannelDescription.textContent =
                channel.description || "";
        }

        if (dom.activeRoleBadge) {
            dom.activeRoleBadge.textContent =
                "Student";
        }
    }


    /* =========================================================
       MESSAGES
       ========================================================= */

    async function loadMessages(channelId) {
        if (!channelId) {
            state.messages = [];
            renderMessageArea();
            return;
        }

        if (dom.channelLoadingState) {
            dom.channelLoadingState.hidden = false;
        }

        const { data, error } =
            await state.supabase
                .from("chat_messages")
                .select(`
                    id,
                    channel_id,
                    user_id,
                    content,
                    created_at
                `)
                .eq("channel_id", channelId)
                .order("created_at", {
                    ascending: true
                })
                .limit(CONFIG.messageLimit);

        if (dom.channelLoadingState) {
            dom.channelLoadingState.hidden = true;
        }

        if (error) {
            console.error(
                "Unable to load messages:",
                error
            );

            state.messages = [];
            renderMessageArea();

            return;
        }

        state.messages =
            await attachMessageProfiles(
                data || []
            );

        renderMessages();
    }


    /* =========================================================
       MESSAGE PROFILE ENRICHMENT
       =========================================================

       THIS IS THE IMPORTANT FIX.

       We ONLY query:

           students.id

       because the real schema is:

           id
           full_name
           photo_url

       We NEVER query:

           students.user_id

       ========================================================= */

    async function attachMessageProfiles(messages) {
        if (!messages.length) {
            return [];
        }

        const userIds = [
            ...new Set(
                messages
                    .map(message => message.user_id)
                    .filter(Boolean)
            )
        ];

        const profileMap = new Map();

        /*
         * Always use the already loaded profile
         * for the current authenticated user.
         */
        if (state.user && state.profile) {
            profileMap.set(
                state.user.id,
                normalizeProfile(state.profile)
            );
        }

        const idsToLoad =
            userIds.filter(
                id => !profileMap.has(id)
            );

        if (idsToLoad.length) {
            /*
             * CORRECT QUERY:
             *
             * students.id IN (...)
             */

            const { data, error } =
                await state.supabase
                    .from("students")
                    .select(
                        "id, full_name, photo_url"
                    )
                    .in("id", idsToLoad);

            if (error) {
                console.error(
                    "Could not load message sender profiles:",
                    error
                );
            } else {
                (data || []).forEach(student => {
                    const profile =
                        normalizeProfile(student);

                    if (profile && profile.id) {
                        profileMap.set(
                            profile.id,
                            profile
                        );
                    }
                });
            }
        }

        /*
         * If a sender does not have a row in students,
         * use their community nickname if available.
         *
         * chat_community_members does NOT contain
         * photo_url in the known schema, so it can only
         * provide a name fallback.
         */

        const unresolvedIds =
            userIds.filter(
                id => !profileMap.has(id)
            );

        if (
            unresolvedIds.length &&
            state.selectedCommunity
        ) {
            try {
                const { data: members, error } =
                    await state.supabase
                        .from("chat_community_members")
                        .select(
                            "user_id, nickname"
                        )
                        .eq(
                            "community_id",
                            state.selectedCommunity.id
                        )
                        .in(
                            "user_id",
                            unresolvedIds
                        );

                if (!error) {
                    (members || []).forEach(member => {
                        if (
                            member.user_id &&
                            member.nickname
                        ) {
                            profileMap.set(
                                member.user_id,
                                {
                                    id: member.user_id,
                                    full_name:
                                        member.nickname,
                                    photo_url: ""
                                }
                            );
                        }
                    });
                }
            } catch (error) {
                console.warn(
                    "Community member profile fallback failed:",
                    error
                );
            }
        }

        return messages.map(message => {
            const profile =
                message.user_id
                    ? profileMap.get(
                        message.user_id
                    ) || null
                    : null;

            if (!profile) {
                console.warn(
                    "MESSAGE SENDER:",
                    message.user_id || "",
                    "NO PROFILE FOUND"
                );
            } else {
                console.log(
                    "MESSAGE SENDER:",
                    message.user_id,
                    profile
                );
            }

            return {
                ...message,
                profile
            };
        });
    }


    /* =========================================================
       SINGLE MESSAGE PROFILE
       ========================================================= */

    async function attachSingleProfile(message) {
        if (!message) {
            return message;
        }

        if (!message.user_id) {
            return {
                ...message,
                profile: null
            };
        }

        /*
         * Current user.
         */
        if (
            state.user &&
            message.user_id === state.user.id &&
            state.profile
        ) {
            return {
                ...message,
                profile:
                    normalizeProfile(
                        state.profile
                    )
            };
        }

        /*
         * Correct lookup:
         *
         * students.id = message.user_id
         */

        try {
            const { data, error } =
                await state.supabase
                    .from("students")
                    .select(
                        "id, full_name, photo_url"
                    )
                    .eq(
                        "id",
                        message.user_id
                    )
                    .maybeSingle();

            if (!error && data) {
                return {
                    ...message,
                    profile:
                        normalizeProfile(data)
                };
            }
        } catch (error) {
            console.warn(
                "Single sender lookup failed:",
                error
            );
        }

        /*
         * Community nickname fallback.
         */

        if (state.selectedCommunity) {
            try {
                const { data, error } =
                    await state.supabase
                        .from("chat_community_members")
                        .select(
                            "user_id, nickname"
                        )
                        .eq(
                            "community_id",
                            state.selectedCommunity.id
                        )
                        .eq(
                            "user_id",
                            message.user_id
                        )
                        .maybeSingle();

                if (
                    !error &&
                    data &&
                    data.nickname
                ) {
                    return {
                        ...message,
                        profile: {
                            id:
                                message.user_id,
                            full_name:
                                data.nickname,
                            photo_url: ""
                        }
                    };
                }
            } catch (error) {
                console.warn(
                    "Community member fallback failed:",
                    error
                );
            }
        }

        console.warn(
            "MESSAGE SENDER:",
            message.user_id,
            "NO PROFILE FOUND"
        );

        return {
            ...message,
            profile: null
        };
    }


    /* =========================================================
       MESSAGE AREA
       ========================================================= */

    function renderMessageArea() {
        if (!dom.messageList) return;

        if (!state.selectedChannel) {
            dom.messageList.innerHTML = `
                <div class="community-welcome">
                    <h2>Welcome to Mwaniki Community</h2>
                    <p>
                        Select a channel to start learning,
                        discussing and collaborating.
                    </p>
                </div>
            `;

            return;
        }

        renderMessages();
    }


    function renderMessages() {
        if (!dom.messageList) return;

        dom.messageList.innerHTML = "";

        if (!state.messages.length) {
            dom.messageList.innerHTML = `
                <div class="community-empty-messages">
                    <div class="empty-message-icon">💬</div>
                    <h3>No messages yet</h3>
                    <p>
                        Be the first person to start
                        the conversation in this channel.
                    </p>
                </div>
            `;

            return;
        }

        let previousDate = null;

        state.messages.forEach(message => {
            const messageDate =
                formatDate(message.created_at);

            if (
                messageDate &&
                messageDate !== previousDate
            ) {
                const divider =
                    document.createElement("div");

                divider.className =
                    "message-date-divider";

                divider.innerHTML = `
                    <span>
                        ${escapeHtml(messageDate)}
                    </span>
                `;

                dom.messageList.appendChild(
                    divider
                );

                previousDate =
                    messageDate;
            }

            dom.messageList.appendChild(
                createMessageElement(message)
            );
        });

        requestAnimationFrame(() => {
            dom.messageList.scrollTop =
                dom.messageList.scrollHeight;
        });
    }


    /* =========================================================
       MESSAGE ELEMENT
       ========================================================= */

    function createMessageElement(message) {
        const wrapper =
            document.createElement("article");

        wrapper.className =
            "community-message";

        wrapper.dataset.messageId =
            message.id || "";

        const profile =
            message.profile || null;

        /*
         * IMPORTANT:
         *
         * Never use email as the displayed sender.
         */

        const senderName =
            profile &&
            profile.full_name
                ? profile.full_name
                : "Unknown member";

        const senderPhoto =
            profile &&
            profile.photo_url
                ? safeUrl(
                    profile.photo_url
                )
                : CONFIG.defaultAvatar;

        const ownMessage =
            state.user &&
            message.user_id ===
                state.user.id;

        if (ownMessage) {
            wrapper.classList.add("own-message");
        }

        const avatar =
            document.createElement("img");

        avatar.className =
            "message-avatar";

        avatar.src =
            senderPhoto;

        avatar.alt =
            `${senderName} profile photo`;

        avatar.loading = "lazy";

        avatar.onerror = () => {
            avatar.onerror = null;
            avatar.src =
                CONFIG.defaultAvatar;
        };

        const body =
            document.createElement("div");

        body.className =
            "message-body";

        const header =
            document.createElement("div");

        header.className =
            "message-header";

        const author =
            document.createElement("span");

        author.className =
            "message-author";

        author.textContent =
            senderName;

        const time =
            document.createElement("time");

        time.className =
            "message-time";

        time.dateTime =
            message.created_at || "";

        time.textContent =
            formatTime(
                message.created_at
            );

        header.appendChild(author);
        header.appendChild(time);

        const content =
            document.createElement("div");

        content.className =
            "message-content";

        content.textContent =
            message.content || "";

        body.appendChild(header);
        body.appendChild(content);

        wrapper.appendChild(avatar);
        wrapper.appendChild(body);

        /*
         * Debug information.
         *
         * This lets us immediately see whether the
         * sender profile has actually been resolved.
         */

        console.log(
            "MESSAGE SENDER:",
            message.user_id || "",
            profile || "NO PROFILE FOUND"
        );

        return wrapper;
    }


    /* =========================================================
       SEND MESSAGE
       ========================================================= */

    async function sendMessage(event) {
        if (event) {
            event.preventDefault();
        }

        if (state.messageSending) {
            return;
        }

        if (!state.user) {
            setStatus(
                "Please sign in before sending a message."
            );
            return;
        }

        if (!state.selectedChannel) {
            setStatus(
                "Please select a channel first."
            );
            return;
        }

        const input =
            dom.messageInput;

        if (!input) return;

        const content =
            input.value.trim();

        if (!content) return;

        state.messageSending = true;

        if (dom.sendMessageButton) {
            dom.sendMessageButton.disabled =
                true;
        }

        try {
            const { data, error } =
                await state.supabase
                    .from("chat_messages")
                    .insert({
                        channel_id:
                            state.selectedChannel.id,

                        user_id:
                            state.user.id,

                        content
                    })
                    .select(`
                        id,
                        channel_id,
                        user_id,
                        content,
                        created_at
                    `)
                    .single();

            if (error) {
                throw error;
            }

            input.value = "";

            const message = {
                ...data,

                profile:
                    normalizeProfile(
                        state.profile
                    )
            };

            /*
             * Realtime normally delivers the same
             * message. We therefore only add it here
             * if it is not already present.
             */

            const exists =
                state.messages.some(
                    item =>
                        String(item.id) ===
                        String(message.id)
                );

            if (!exists) {
                state.messages.push(message);
                renderMessages();
            }
        } catch (error) {
            console.error(
                "Send message failed:",
                error
            );

            setStatus(
                "Message could not be sent."
            );
        } finally {
            state.messageSending = false;

            if (dom.sendMessageButton) {
                dom.sendMessageButton.disabled =
                    false;
            }
        }
    }


    /* =========================================================
       REALTIME
       ========================================================= */

    function removeRealtimeChannel(channel) {
        if (!channel || !state.supabase) {
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
    }


    function clearRealtimeChannels() {
        state.realtimeChannels.forEach(
            channel => {
                removeRealtimeChannel(
                    channel
                );
            }
        );

        state.realtimeChannels = [];
    }


    function subscribeToCommunityRealtime() {
        if (!state.selectedCommunity) {
            return;
        }

        const communityId =
            state.selectedCommunity.id;

        const channelName =
            `community:${communityId}`;

        const existing =
            state.realtimeChannels.find(
                channel =>
                    channel.topic ===
                    `realtime:${channelName}`
            );

        if (existing) {
            return;
        }

        const channel =
            state.supabase
                .channel(channelName)
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_channels",
                        filter:
                            `community_id=eq.${communityId}`
                    },
                    async () => {
                        await loadChannels(
                            communityId
                        );
                    }
                )
                .subscribe(status => {
                    console.log(
                        "Community realtime:",
                        status
                    );
                });

        state.realtimeChannels.push(
            channel
        );
    }


    function subscribeToChannelRealtime() {
        if (!state.selectedChannel) {
            return;
        }

        /*
         * Remove previous message realtime
         * subscription while preserving
         * community-level subscriptions.
         */

        state.realtimeChannels =
            state.realtimeChannels.filter(
                channel => {
                    if (
                        channel.__mwanikiMessageChannel
                    ) {
                        removeRealtimeChannel(
                            channel
                        );

                        return false;
                    }

                    return true;
                }
            );

        const channelId =
            state.selectedChannel.id;

        const realtimeChannel =
            state.supabase
                .channel(
                    `messages:${channelId}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "chat_messages",
                        filter:
                            `channel_id=eq.${channelId}`
                    },
                    async payload => {
                        const incoming =
                            await attachSingleProfile(
                                payload.new
                            );

                        const exists =
                            state.messages.some(
                                message =>
                                    String(
                                        message.id
                                    ) ===
                                    String(
                                        incoming.id
                                    )
                            );

                        if (!exists) {
                            state.messages.push(
                                incoming
                            );

                            renderMessages();
                        }
                    }
                )
                .subscribe(status => {
                    console.log(
                        "Community message realtime:",
                        status
                    );
                });

        realtimeChannel.__mwanikiMessageChannel =
            true;

        state.realtimeChannels.push(
            realtimeChannel
        );
    }


    /* =========================================================
       PRESENCE
       ========================================================= */

    async function updatePresence() {
        if (!state.user) return;

        const now =
            new Date().toISOString();

        try {
            const { error } =
                await state.supabase
                    .from("chat_presence")
                    .upsert(
                        {
                            user_id:
                                state.user.id,

                            status: "online",

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
        } catch (error) {
            console.warn(
                "Presence heartbeat failed:",
                error
            );
        }
    }


    function startPresenceHeartbeat() {
        if (state.presenceTimer) {
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
        if (!dom.communityModal) return;

        state.communityModalOpen = true;

        dom.communityModal.hidden = false;

        renderCommunityChoices();

        if (dom.communityModalSearch) {
            dom.communityModalSearch.value = "";

            setTimeout(() => {
                dom.communityModalSearch.focus();
            }, 50);
        }
    }


    function closeCommunityModal() {
        if (!dom.communityModal) return;

        state.communityModalOpen = false;

        dom.communityModal.hidden = true;
    }


    function renderCommunityChoices(search = "") {
        const container =
            dom.communityChoiceList;

        if (!container) return;

        container.innerHTML = "";

        const term =
            String(search || "")
                .trim()
                .toLowerCase();

        const communities =
            state.communities.filter(
                community => {
                    if (!term) return true;

                    return (
                        String(
                            community.name || ""
                        )
                            .toLowerCase()
                            .includes(term) ||

                        String(
                            community.description ||
                            ""
                        )
                            .toLowerCase()
                            .includes(term)
                    );
                }
            );

        communities.forEach(community => {
            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "community-choice";

            button.innerHTML = `
                <span class="community-choice-icon">
                    ${
                        community.icon_url
                            ? `<img src="${safeUrl(
                                community.icon_url
                            )}" alt="">`
                            : escapeHtml(
                                initials(
                                    community.name
                                )
                            )
                    }
                </span>

                <span class="community-choice-content">
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

            container.appendChild(button);
        });

        if (!communities.length) {
            container.innerHTML = `
                <div class="community-empty-state">
                    No communities found.
                </div>
            `;
        }
    }


    /* =========================================================
       CHANNEL SEARCH
       ========================================================= */

    function handleChannelSearch() {
        state.searchTerm =
            dom.channelSearchInput
                ? dom.channelSearchInput.value
                : "";

        renderChannels();
    }


    /* =========================================================
       EMOJI PICKER
       ========================================================= */

    const EMOJIS = [
        "😀","😃","😄","😁","😆","😅","😂","🤣",
        "😊","😇","🙂","🙃","😉","😌","😍","🥰",
        "😘","😗","😙","😚","😋","😛","😝","😜",
        "🤪","🤨","🧐","🤓","😎","🤩","🥳","😏",
        "😒","😞","😔","😟","😕","🙁","☹️","😣",
        "😖","😫","😩","🥺","😢","😭","😤","😠",
        "😡","🤬","🤯","😳","🥵","🥶","😱","😨",
        "😰","😥","😓","🤗","🤔","🫡","🤭","🤫",
        "🤥","😶","😐","😑","😬","🙄","😯","😦",
        "😧","😮","😲","🥱","😴","🤤","😪","😵",
        "🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕",

        "❤️","🧡","💛","💚","💙","💜","🖤","🤍",
        "🤎","💔","❣️","💕","💞","💓","💗","💖",
        "💘","💝","💟","✨","⭐","🌟","💫","🔥",

        "👍","👎","👌","✌️","🤞","🤟","🤘","🤙",
        "👏","🙌","👐","🤲","🙏","💪","👀","👋",
        "🤝","✍️","💯","🎉","🎊","🥳","❤️‍🔥",

        "🧠","🫀","🫁","🩸","🦠","🧬","🔬","🧪",
        "💊","💉","🩺","📚","📖","📝","🎓","🏥",

        "😂","🤣","😭","😅","😎","🤩","🥳","😴",
        "🤔","🙃","😬","😱","🤯","🥺","❤️","🔥",
        "👍","👎","👏","🙏","🎉","💯","✨"
    ];


    function createEmojiPicker() {
        if (!dom.emojiButton) {
            return;
        }

        let picker =
            document.getElementById(
                "mwanikiEmojiPicker"
            );

        if (picker) return;

        picker =
            document.createElement("div");

        picker.id =
            "mwanikiEmojiPicker";

        picker.className =
            "mwaniki-emoji-picker";

        picker.hidden = true;

        picker.setAttribute(
            "role",
            "dialog"
        );

        picker.setAttribute(
            "aria-label",
            "Emoji picker"
        );

        const grid =
            document.createElement("div");

        grid.className =
            "mwaniki-emoji-grid";

        EMOJIS.forEach(emoji => {
            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "mwaniki-emoji-button";

            button.textContent =
                emoji;

            button.setAttribute(
                "aria-label",
                `Insert ${emoji}`
            );

            button.addEventListener(
                "click",
                () => {
                    insertEmoji(emoji);
                }
            );

            grid.appendChild(button);
        });

        picker.appendChild(grid);

        const parent =
            dom.emojiButton.parentElement;

        if (parent) {
            parent.style.position =
                parent.style.position ||
                "relative";

            parent.appendChild(
                picker
            );
        }
    }


    function insertEmoji(emoji) {
        if (!dom.messageInput) {
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
            input.value.substring(
                0,
                start
            ) +
            emoji +
            input.value.substring(
                end
            );

        const position =
            start + emoji.length;

        input.focus();

        input.setSelectionRange(
            position,
            position
        );
    }


    function toggleEmojiPicker() {
        const picker =
            document.getElementById(
                "mwanikiEmojiPicker"
            );

        if (!picker) return;

        state.emojiPickerOpen =
            !state.emojiPickerOpen;

        picker.hidden =
            !state.emojiPickerOpen;
    }


    /* =========================================================
       MESSAGE SEARCH
       ========================================================= */

    function searchMessages() {
        if (!dom.messageList) return;

        const query =
            prompt(
                "Search messages in this channel:"
            );

        if (query === null) {
            return;
        }

        const term =
            query.trim().toLowerCase();

        if (!term) {
            renderMessages();
            return;
        }

        const matches =
            state.messages.filter(
                message =>
                    String(
                        message.content || ""
                    )
                        .toLowerCase()
                        .includes(term)
            );

        dom.messageList.innerHTML = "";

        if (!matches.length) {
            dom.messageList.innerHTML = `
                <div class="community-empty-messages">
                    No matching messages found.
                </div>
            `;

            return;
        }

        matches.forEach(message => {
            dom.messageList.appendChild(
                createMessageElement(message)
            );
        });
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
        ].forEach(button => {
            if (!button) return;

            button.addEventListener(
                "click",
                goDashboard
            );
        });

        [
            dom.railProfileButton,
            dom.sidebarProfileButton
        ].forEach(button => {
            if (!button) return;

            button.addEventListener(
                "click",
                goProfile
            );
        });

        [
            dom.openCommunityButton,
            dom.communitySelectorButton,
            dom.headerCommunityButton
        ].forEach(button => {
            if (!button) return;

            button.addEventListener(
                "click",
                openCommunityModal
            );
        });

        if (dom.closeCommunityModal) {
            dom.closeCommunityModal.addEventListener(
                "click",
                closeCommunityModal
            );
        }

        if (dom.communityModal) {
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

        if (dom.communityModalSearch) {
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
       MESSAGE EVENTS
       ========================================================= */

    function bindMessageEvents() {
        if (dom.messageForm) {
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

        if (dom.messageInput) {
            dom.messageInput.addEventListener(
                "keydown",
                event => {
                    if (
                        event.key === "Enter" &&
                        !event.shiftKey
                    ) {
                        event.preventDefault();

                        sendMessage(event);
                    }
                }
            );
        }

        if (dom.channelSearchInput) {
            dom.channelSearchInput.addEventListener(
                "input",
                handleChannelSearch
            );
        }

        if (dom.emojiButton) {
            dom.emojiButton.addEventListener(
                "click",
                toggleEmojiPicker
            );
        }

        if (dom.chatSearchButton) {
            dom.chatSearchButton.addEventListener(
                "click",
                searchMessages
            );
        }
    }


    /* =========================================================
       KEYBOARD ACCESSIBILITY
       ========================================================= */

    function bindAccessibility() {
        document.addEventListener(
            "keydown",
            event => {
                if (event.key === "Escape") {
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
                        picker.hidden = true;
                        state.emojiPickerOpen =
                            false;
                    }
                }
            }
        );
    }


    /* =========================================================
       GENERAL CALL USERS
       ========================================================= */

    async function loadOnlineUsers() {
        if (!dom.generalCallUserList) {
            return [];
        }

        dom.generalCallUserList.innerHTML = `
            <div class="call-user-loading">
                Loading students...
            </div>
        `;

        try {
            /*
             * Get presence first.
             */
            const {
                data: presenceRows,
                error: presenceError
            } =
                await state.supabase
                    .from("chat_presence")
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
                    (presenceRows || [])
                        .map(row => row.user_id)
                        .filter(
                            id =>
                                id &&
                                id !==
                                    state.user.id
                        )
                )
            ];

            if (!ids.length) {
                dom.generalCallUserList.innerHTML = `
                    <div class="call-user-empty">
                        No other students are currently online.
                    </div>
                `;

                updateGeneralCallSelectionCount();

                return [];
            }

            /*
             * CORRECT STUDENT LOOKUP:
             *
             * students.id
             */

            const {
                data: students,
                error: studentsError
            } =
                await state.supabase
                    .from("students")
                    .select(
                        "id, full_name, photo_url"
                    )
                    .in("id", ids);

            if (studentsError) {
                throw studentsError;
            }

            const studentMap =
                new Map(
                    (students || []).map(
                        student => [
                            student.id,
                            normalizeProfile(
                                student
                            )
                        ]
                    )
                );

            dom.generalCallUserList.innerHTML = "";

            ids.forEach(userId => {
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

                    <span>
                        ${escapeHtml(
                            profile.full_name
                        )}
                    </span>
                `;

                const checkbox =
                    row.querySelector(
                        "input"
                    );

                checkbox.addEventListener(
                    "change",
                    updateGeneralCallSelectionCount
                );

                dom.generalCallUserList.appendChild(
                    row
                );
            });

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

            return [];
        }
    }


    function updateGeneralCallSelectionCount() {
        if (!dom.generalCallUserList) {
            return;
        }

        const selected =
            dom.generalCallUserList.querySelectorAll(
                ".general-call-user-checkbox:checked"
            ).length;

        if (dom.generalCallSelectionCount) {
            dom.generalCallSelectionCount.textContent =
                String(selected);
        }

        if (dom.startGeneralCallButton) {
            dom.startGeneralCallButton.disabled =
                selected === 0;
        }
    }


    function openGeneralCallModal() {
        if (!dom.generalCallModal) {
            return;
        }

        dom.generalCallModal.hidden =
            false;

        if (dom.generalCallMessage) {
            dom.generalCallMessage.textContent =
                "";
        }

        loadOnlineUsers();
    }


    function closeGeneralCallModal() {
        if (!dom.generalCallModal) {
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
            `mwaniki-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 9)}`;

        /*
         * chat_call_rooms.community_id is UUID.
         *
         * DO NOT pass a bigint course/community ID
         * from another table here.
         */

        const payload = {
            community_id:
                communityId || null,

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
                .from("chat_call_rooms")
                .insert(payload)
                .select("*")
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
        if (!roomId || !userId) {
            return;
        }

        const {
            error
        } =
            await state.supabase
                .from("chat_call_participants")
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
            console.warn(
                "Could not add call participant:",
                error
            );
        }
    }


    /* =========================================================
       START GENERAL CALL
       ========================================================= */

    async function startGeneralCall() {
        if (!state.user) {
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
            if (dom.generalCallMessage) {
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
                    communityId: null,
                    callScope:
                        "general",
                    callType
                });

            await addCallParticipant(
                room.id,
                state.user.id,
                "joined"
            );

            for (const userId of selected) {
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
                scope: "general",
                communityId: null
            });
        } catch (error) {
            console.error(
                "General call could not start:",
                error
            );

            if (dom.generalCallMessage) {
                dom.generalCallMessage.textContent =
                    error.message ||
                    "Unable to start call.";
            }
        }
    }


    /* =========================================================
       COMMUNITY CALL
       ========================================================= */

    async function startCommunityCall(
        callType
    ) {
        if (!state.selectedCommunity) {
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

            /*
             * Community calls are isolated by room ID.
             *
             * This means Community A can have a call
             * while Community B has a completely separate
             * call.
             */

            await startCallInterface({
                room,
                callType,
                scope: "community",
                communityId:
                    state.selectedCommunity.id
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
        communityId
    }) {
        state.call.active = true;
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

        if (dom.callOverlay) {
            dom.callOverlay.hidden =
                false;
        }

        if (dom.callTypeIcon) {
            dom.callTypeIcon.textContent =
                callType === "video"
                    ? "📹"
                    : "📞";
        }

        if (dom.callTitle) {
            dom.callTitle.textContent =
                scope === "community" &&
                state.selectedCommunity
                    ? state.selectedCommunity.name
                    : "Mwaniki General Call";
        }

        if (dom.callSubtitle) {
            dom.callSubtitle.textContent =
                callType === "video"
                    ? "Video call"
                    : "Voice call";
        }

        startCallTimer();

        await acquireLocalMedia(
            callType
        );

        await subscribeToCallRoom(
            room.id
        );

        await markCallRoomStarted(
            room.id
        );
    }


    async function acquireLocalMedia(
        callType
    ) {
        if (!navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia) {
            throw new Error(
                "Your browser does not support calls."
            );
        }

        const constraints =
            callType === "video"
                ? {
                    audio: true,
                    video: true
                }
                : {
                    audio: true,
                    video: false
                };

        try {
            const stream =
                await navigator.mediaDevices
                    .getUserMedia(
                        constraints
                    );

            state.call.localStream =
                stream;

            if (dom.localVideo) {
                dom.localVideo.srcObject =
                    stream;

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

            throw new Error(
                "Camera or microphone permission was not granted."
            );
        }
    }


    /* =========================================================
       CALL TIMER
       ========================================================= */

    function startCallTimer() {
        stopCallTimer();

        state.call.timer =
            setInterval(() => {
                if (!state.call.startedAt) {
                    return;
                }

                const seconds =
                    Math.floor(
                        (
                            Date.now() -
                            state.call.startedAt
                        ) / 1000
                    );

                const minutes =
                    Math.floor(
                        seconds / 60
                    );

                const remaining =
                    seconds % 60;

                const text =
                    `${String(minutes)
                        .padStart(2, "0")}:${String(
                        remaining
                    ).padStart(2, "0")}`;

                if (dom.callDuration) {
                    dom.callDuration.textContent =
                        text;
                }
            }, 1000);
    }


    function stopCallTimer() {
        if (state.call.timer) {
            clearInterval(
                state.call.timer
            );

            state.call.timer =
                null;
        }
    }


    /* =========================================================
       CALL ROOM REALTIME / WEBRTC
       ========================================================= */

    async function subscribeToCallRoom(
        roomId
    ) {
        if (!roomId) return;

        if (state.call.roomChannel) {
            removeRealtimeChannel(
                state.call.roomChannel
            );
        }

        const channel =
            state.supabase
                .channel(
                    `call-room:${roomId}`
                )
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
                .subscribe(status => {
                    console.log(
                        "Call realtime:",
                        status
                    );
                });

        state.call.roomChannel =
            channel;
    }


    async function sendCallSignal({
        roomId,
        receiverId = null,
        signalType,
        payload
    }) {
        if (!roomId) return;

        const {
            error
        } =
            await state.supabase
                .from("chat_call_signals")
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


    async function createPeerConnection(
        remoteUserId,
        offerer = false
    ) {
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

        if (state.call.localStream) {
            state.call.localStream
                .getTracks()
                .forEach(track => {
                    pc.addTrack(
                        track,
                        state.call.localStream
                    );
                });
        }

        pc.onicecandidate =
            async event => {
                if (!event.candidate) {
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
                        event.candidate
                });
            };

        pc.ontrack =
            event => {
                const stream =
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
                        "closed" ||
                    connectionState ===
                        "disconnected"
                ) {
                    removePeer(
                        remoteUserId
                    );
                }
            };

        if (offerer) {
            const offer =
                await pc.createOffer();

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
                    offer
            });
        }

        return pc;
    }


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

            await pc.setRemoteDescription(
                new RTCSessionDescription(
                    signal.payload
                )
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
                    answer
            });

            return;
        }

        if (
            signal.signal_type ===
            "answer"
        ) {
            if (!pc) {
                return;
            }

            await pc.setRemoteDescription(
                new RTCSessionDescription(
                    signal.payload
                )
            );

            return;
        }

        if (
            signal.signal_type ===
            "ice-candidate"
        ) {
            if (!pc) {
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


    function renderRemoteVideo(
        userId,
        stream
    ) {
        if (!dom.callVideoGrid) {
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

            video.autoplay = true;
            video.playsInline = true;

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


    function removePeer(userId) {
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


    /* =========================================================
       CALL CONTROLS
       ========================================================= */

    function toggleMicrophone() {
        const stream =
            state.call.localStream;

        if (!stream) return;

        const audioTracks =
            stream.getAudioTracks();

        state.call.microphoneEnabled =
            !state.call.microphoneEnabled;

        audioTracks.forEach(track => {
            track.enabled =
                state.call.microphoneEnabled;
        });

        if (dom.toggleMicrophoneButton) {
            dom.toggleMicrophoneButton
                .setAttribute(
                    "aria-pressed",
                    String(
                        state.call.microphoneEnabled
                    )
                );

            dom.toggleMicrophoneButton
                .textContent =
                    state.call.microphoneEnabled
                        ? "🎙️"
                        : "🔇";
        }
    }


    function toggleCamera() {
        const stream =
            state.call.localStream;

        if (!stream) return;

        const videoTracks =
            stream.getVideoTracks();

        state.call.cameraEnabled =
            !state.call.cameraEnabled;

        videoTracks.forEach(track => {
            track.enabled =
                state.call.cameraEnabled;
        });

        if (dom.toggleCameraButton) {
            dom.toggleCameraButton
                .setAttribute(
                    "aria-pressed",
                    String(
                        state.call.cameraEnabled
                    )
                );

            dom.toggleCameraButton
                .textContent =
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
            return;
        }

        if (state.call.screenSharing) {
            stopScreenShare();
            return;
        }

        try {
            const stream =
                await navigator.mediaDevices
                    .getDisplayMedia({
                        video: true
                    });

            const screenTrack =
                stream.getVideoTracks()[0];

            state.call.screenStream =
                stream;

            state.call.screenSharing =
                true;

            state.call.peerConnections
                .forEach(pc => {
                    const sender =
                        pc.getSenders().find(
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
                });

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
        if (state.call.screenStream) {
            state.call.screenStream
                .getTracks()
                .forEach(track =>
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
                .forEach(pc => {
                    const sender =
                        pc.getSenders().find(
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
                });
        }
    }


    /* =========================================================
       END CALL
       ========================================================= */

    async function leaveCall() {
        const roomId =
            state.call.roomId;

        if (roomId && state.user) {
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

        state.call.peerConnections
            .forEach(pc => {
                try {
                    pc.close();
                } catch (_) {}
            });

        state.call.peerConnections.clear();

        if (state.call.localStream) {
            state.call.localStream
                .getTracks()
                .forEach(track =>
                    track.stop()
                );
        }

        state.call.localStream =
            null;

        stopScreenShare();

        if (state.call.roomChannel) {
            removeRealtimeChannel(
                state.call.roomChannel
            );

            state.call.roomChannel =
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

        state.call.startedAt =
            null;

        if (dom.callOverlay) {
            dom.callOverlay.hidden =
                true;
        }

        if (dom.localVideo) {
            dom.localVideo.srcObject =
                null;
        }

        if (dom.callVideoGrid) {
            dom.callVideoGrid
                .querySelectorAll(
                    ".call-video-tile"
                )
                .forEach(tile =>
                    tile.remove()
                );
        }

        announce("Call ended.");
    }


    async function markCallRoomStarted(
        roomId
    ) {
        try {
            await state.supabase
                .from("chat_call_rooms")
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
                    roomId
                );
        } catch (error) {
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

        const channel =
            state.supabase
                .channel(
                    `incoming-calls:${state.user.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table:
                            "chat_call_participants",
                        filter:
                            `user_id=eq.${state.user.id}`
                    },
                    async payload => {
                        const participant =
                            payload.new;

                        if (
                            participant.status !==
                            "invited"
                        ) {
                            return;
                        }

                        await showIncomingCall(
                            participant.room_id
                        );
                    }
                )
                .subscribe(status => {
                    console.log(
                        "Incoming call listener:",
                        status
                    );
                });

        state.realtimeChannels.push(
            channel
        );
    }


    async function showIncomingCall(
        roomId
    ) {
        if (!dom.incomingCallToast) {
            return;
        }

        const {
            data: room
        } =
            await state.supabase
                .from("chat_call_rooms")
                .select("*")
                .eq("id", roomId)
                .maybeSingle();

        if (!room) {
            return;
        }

        state.call.incoming = room;

        if (dom.incomingCallTitle) {
            dom.incomingCallTitle.textContent =
                room.call_type ===
                "video"
                    ? "Incoming video call"
                    : "Incoming voice call";
        }

        if (dom.incomingCallText) {
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

        if (dom.incomingCallToast) {
            dom.incomingCallToast.hidden =
                true;
        }

        try {
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

        if (dom.incomingCallToast) {
            dom.incomingCallToast.hidden =
                true;
        }

        try {
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
        if (dom.generalCallButton) {
            dom.generalCallButton.addEventListener(
                "click",
                openGeneralCallModal
            );
        }

        if (
            dom.closeGeneralCallModalButton
        ) {
            dom.closeGeneralCallModalButton
                .addEventListener(
                    "click",
                    closeGeneralCallModal
                );
        }

        if (
            dom.cancelGeneralCallButton
        ) {
            dom.cancelGeneralCallButton
                .addEventListener(
                    "click",
                    closeGeneralCallModal
                );
        }

        if (
            dom.generalVoiceCallButton
        ) {
            dom.generalVoiceCallButton
                .addEventListener(
                    "click",
                    () => {
                        state.pendingGeneralCallType =
                            "voice";

                        if (
                            dom.generalCallMessage
                        ) {
                            dom.generalCallMessage
                                .textContent =
                                "Voice call selected. Choose students below.";
                        }
                    }
                );
        }

        if (
            dom.generalVideoCallButton
        ) {
            dom.generalVideoCallButton
                .addEventListener(
                    "click",
                    () => {
                        state.pendingGeneralCallType =
                            "video";

                        if (
                            dom.generalCallMessage
                        ) {
                            dom.generalCallMessage
                                .textContent =
                                "Video call selected. Choose students below.";
                        }
                    }
                );
        }

        if (
            dom.startGeneralCallButton
        ) {
            dom.startGeneralCallButton
                .addEventListener(
                    "click",
                    startGeneralCall
                );
        }

        if (dom.voiceCallButton) {
            dom.voiceCallButton.addEventListener(
                "click",
                () => {
                    startCommunityCall(
                        "voice"
                    );
                }
            );
        }

        if (dom.videoCallButton) {
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
            dom.toggleMicrophoneButton
                .addEventListener(
                    "click",
                    toggleMicrophone
                );
        }

        if (dom.toggleCameraButton) {
            dom.toggleCameraButton
                .addEventListener(
                    "click",
                    toggleCamera
                );
        }

        if (dom.shareScreenButton) {
            dom.shareScreenButton
                .addEventListener(
                    "click",
                    toggleScreenShare
                );
        }

        if (dom.leaveCallButton) {
            dom.leaveCallButton
                .addEventListener(
                    "click",
                    leaveCall
                );
        }

        if (
            dom.acceptCallButton
        ) {
            dom.acceptCallButton
                .addEventListener(
                    "click",
                    acceptIncomingCall
                );
        }

        if (
            dom.declineCallButton
        ) {
            dom.declineCallButton
                .addEventListener(
                    "click",
                    declineIncomingCall
                );
        }

        if (
            dom.closeGeneralCallModalButton
        ) {
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
        }
    }


    /* =========================================================
       INITIALIZATION
       ========================================================= */

    async function init() {
        if (state.initialized) {
            return;
        }

        state.initialized =
            true;

        console.log(
            "Mwaniki Community: Connecting..."
        );

        cacheDom();

        try {
            await waitForSupabase();

            await loadAuthenticatedUser();

            await loadProfile();

            await loadCommunities();

            console.log(
                "Mwaniki Community: Ready"
            );

            if (state.communities.length) {
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

            startPresenceHeartbeat();

            setupIncomingCallListener();

            /*
             * Community realtime is intentionally
             * initialized after authentication.
             */
            subscribeToCommunityRealtime();

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

        openCommunityModal,
        closeCommunityModal,

        openGeneralCallModal,
        closeGeneralCallModal,

        startCommunityCall,
        startGeneralCall,

        leaveCall,

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
                once: true
            }
        );
    } else {
        init();
    }

})();
