/* ============================================================
   MWANIKI SCHOLARS COMMUNITY ENGINE
   ------------------------------------------------------------
   Complete community.js
   - Supabase community loading
   - Communities
   - Channels
   - Messages
   - Student names + profile photos
   - Community-member name fallback
   - Realtime messages
   - Presence
   - Search
   - Emoji picker
   - Accessibility
   - General chat
   - Community switching
   - Call UI compatibility
   ------------------------------------------------------------
   chat_messages:
       id
       channel_id
       user_id
       content
       created_at

   NO reply_to column is used.
   ============================================================ */

(() => {
    "use strict";

    /* ============================================================
       CONFIG
       ============================================================ */

    const CONFIG = {
        dashboardUrl: "./dashboard.html",
        profileUrl: "./profile.html",

        profileBucket: "student-profiles",

        defaultAvatar:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg"
                     width="128"
                     height="128"
                     viewBox="0 0 128 128">
                    <rect width="128" height="128" rx="64" fill="#123c3a"/>
                    <circle cx="64" cy="47" r="23" fill="#8db8b4"/>
                    <path d="M25 112c5-25 20-38 39-38s34 13 39 38"
                          fill="#8db8b4"/>
                </svg>
            `),

        messageLimit: 100,
        presenceHeartbeat: 30000
    };


    /* ============================================================
       STATE
       ============================================================ */

    const state = {
        supabase: null,

        user: null,
        profile: null,

        communities: [],
        channels: [],
        messages: [],

        selectedCommunity: null,
        selectedChannel: null,

        communitySearch: "",
        channelSearch: "",
        messageSearch: "",

        loadingCommunities: false,
        loadingChannels: false,
        loadingMessages: false,

        realtimeChannels: [],
        presenceChannel: null,
        presenceHeartbeat: null,

        communityModalOpen: false,

        emojiPickerOpen: false,
        emojiCategory: "smileys",
        recentEmojis: [],

        call: {
            active: false,
            roomId: null,
            roomCode: null,
            callType: null,
            callScope: null,
            communityId: null,
            muted: false,
            camera: false,
            screenSharing: false
        },

        initialized: false
    };


    /* ============================================================
       DOM
       ============================================================ */

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

            "generalCallButton",

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


    /* ============================================================
       SUPABASE
       ============================================================ */

    async function waitForSupabase() {

        const getClient = () =>
            window.supabaseClient ||
            window.sb ||
            window.mwanikiSupabase ||
            window.supabase;

        let client = getClient();

        if (client) {
            state.supabase = client;
            return client;
        }

        for (let i = 0; i < 150; i++) {

            await sleep(100);

            client = getClient();

            if (client) {
                state.supabase = client;
                return client;
            }
        }

        throw new Error(
            "Mwaniki Scholars Supabase client could not be found."
        );
    }


    /* ============================================================
       INITIALIZATION
       ============================================================ */

    async function init() {

        if (state.initialized) return;

        cacheDom();

        try {

            setStatus("Connecting...");

            await waitForSupabase();

            bindEvents();

            await loadAuthenticatedUser();

            if (!state.user) {

                setStatus("Please sign in to continue.");

                setProfileFallback();

                return;
            }

            await loadProfile();

            updateProfileUI();

            await updatePresence();

            await loadCommunities();

            renderCommunityRail();

            renderCommunitySelector();

            await selectInitialCommunity();

            setupRealtime();

            setupPresenceHeartbeat();

            setupEmojiPicker();

            setupAccessibility();

            state.initialized = true;

            setStatus("Ready");

        } catch (error) {

            console.error(
                "Mwaniki Community initialization error:",
                error
            );

            setStatus(
                error?.message ||
                "Community failed to initialize."
            );
        }
    }


    /* ============================================================
       AUTH
       ============================================================ */

    async function loadAuthenticatedUser() {

        if (!state.supabase?.auth) {
            throw new Error(
                "Supabase authentication is unavailable."
            );
        }

        const { data, error } =
            await state.supabase.auth.getUser();

        if (error) throw error;

        state.user = data?.user || null;

        console.log(
            "Community authenticated user:",
            state.user?.id || "none"
        );
    }


    /* ============================================================
       PROFILE
       ============================================================ */

    async function loadProfile() {

        if (!state.user?.id) {
            state.profile = null;
            return;
        }

        const profile =
            await fetchStudentProfile(state.user.id);

        state.profile =
            normalizeProfile(profile) || {
                id: state.user.id,
                display_name: "Student",
                photo_url: ""
            };

        console.log(
            "Community profile loaded:",
            getProfileName(state.profile)
        );
    }


    async function fetchStudentProfile(userId) {

        if (!state.supabase || !userId) {
            return null;
        }

        /*
         * PRIMARY PROFILE RELATIONSHIP
         * students.id = auth.users.id
         */

        try {

            const { data, error } =
                await state.supabase
                    .from("students")
                    .select("*")
                    .eq("id", userId)
                    .maybeSingle();

            if (!error && data) {
                return data;
            }

        } catch (error) {

            console.warn(
                "students.id profile lookup failed:",
                error
            );
        }


        /*
         * SECONDARY RELATIONSHIP
         * Only used if the table actually exposes user_id.
         */

        try {

            const { data, error } =
                await state.supabase
                    .from("students")
                    .select("*")
                    .eq("user_id", userId)
                    .maybeSingle();

            if (!error && data) {
                return data;
            }

        } catch (error) {

            console.warn(
                "students.user_id profile lookup failed:",
                error
            );
        }

        return null;
    }


    function normalizeProfile(profile) {

        if (!profile) return null;

        const name =
            profile.full_name ||
            profile.name ||
            profile.student_name ||
            profile.display_name ||
            profile.username ||
            "Student";

        const photo =
            profile.photo_url ||
            profile.avatar_url ||
            profile.profile_photo ||
            profile.profile_image ||
            profile.photo ||
            profile.avatar ||
            "";

        return {
            ...profile,

            display_name:
                String(name).trim() || "Student",

            photo_url:
                photo
                    ? String(photo).trim()
                    : ""
        };
    }


    function getProfileName(profile = state.profile) {

        const name =
            profile?.display_name ||
            profile?.full_name ||
            profile?.name ||
            profile?.student_name ||
            profile?.displayName ||
            profile?.username ||
            "";

        const clean =
            String(name).trim();

        /*
         * IMPORTANT:
         * Never use state.user.email here.
         */

        return clean || "Student";
    }


    function resolveProfilePhoto(profile) {

        if (!profile) {
            return CONFIG.defaultAvatar;
        }

        const photo =
            profile.photo_url ||
            profile.avatar_url ||
            profile.profile_photo ||
            profile.profile_image ||
            profile.photo ||
            profile.avatar ||
            "";

        return String(photo).trim() ||
            CONFIG.defaultAvatar;
    }


    function getProfilePhoto(profile = state.profile) {
        return resolveProfilePhoto(profile);
    }


    function updateProfileUI() {

        const name =
            getProfileName(state.profile);

        const photo =
            getProfilePhoto(state.profile);

        if (dom.sidebarProfileName) {
            dom.sidebarProfileName.textContent =
                name;
        }

        setImage(
            dom.sidebarProfileAvatar,
            photo,
            `${name} profile photo`
        );

        setImage(
            dom.railProfileAvatar,
            photo,
            `${name} profile photo`
        );
    }


    function setProfileFallback() {

        if (dom.sidebarProfileName) {
            dom.sidebarProfileName.textContent =
                "Student";
        }

        setImage(
            dom.sidebarProfileAvatar,
            CONFIG.defaultAvatar,
            "Student profile photo"
        );

        setImage(
            dom.railProfileAvatar,
            CONFIG.defaultAvatar,
            "Student profile photo"
        );
    }


    function setImage(element, src, alt = "") {

        if (!element) return;

        element.src =
            src || CONFIG.defaultAvatar;

        element.alt = alt;

        element.onerror = () => {

            element.onerror = null;

            element.src =
                CONFIG.defaultAvatar;
        };
    }


    /* ============================================================
       COMMUNITIES
       ============================================================ */

    async function loadCommunities() {

        state.loadingCommunities = true;

        try {

            const { data, error } =
                await state.supabase
                    .from("chat_communities")
                    .select("*")
                    .eq("is_active", true)
                    .order("created_at", {
                        ascending: true
                    });

            if (error) throw error;

            state.communities =
                Array.isArray(data)
                    ? data
                    : [];

            console.log(
                "Communities loaded:",
                state.communities.length
            );

        } finally {

            state.loadingCommunities = false;
        }
    }


    /* ============================================================
       CHANNELS
       ============================================================ */

    async function loadChannels(communityId) {

        if (!communityId) {
            state.channels = [];
            return;
        }

        state.loadingChannels = true;

        try {

            const { data, error } =
                await state.supabase
                    .from("chat_channels")
                    .select("*")
                    .eq("community_id", communityId)
                    .eq("is_active", true)
                    .order("position", {
                        ascending: true
                    })
                    .order("created_at", {
                        ascending: true
                    });

            if (error) throw error;

            state.channels =
                Array.isArray(data)
                    ? data
                    : [];

            console.log(
                "Channels loaded:",
                state.channels.length
            );

        } finally {

            state.loadingChannels = false;
        }
    }


    /* ============================================================
       COMMUNITY SELECTION
       ============================================================ */

    async function selectInitialCommunity() {

        if (!state.communities.length) {

            state.selectedCommunity = null;
            state.selectedChannel = null;

            renderChannels();
            renderMessages();

            return;
        }

        const stored =
            localStorage.getItem(
                "mwanikiSelectedCommunity"
            );

        const community =
            state.communities.find(
                item =>
                    String(item.id) ===
                    String(stored)
            ) ||
            state.communities[0];

        await selectCommunity(
            community,
            false
        );
    }


    async function selectCommunity(
        community,
        announce = true
    ) {

        if (!community) return;

        state.selectedCommunity =
            community;

        state.selectedChannel = null;
        state.messages = [];

        localStorage.setItem(
            "mwanikiSelectedCommunity",
            String(community.id)
        );

        updateSelectedCommunityUI();

        renderCommunityRail();

        renderCommunitySelector();

        await loadChannels(
            community.id
        );

        renderChannels();

        selectBestChannel();

        if (announce) {
            announceToScreenReader(
                `Opened ${community.name}`
            );
        }
    }


    function selectBestChannel() {

        if (!state.channels.length) {

            state.selectedChannel = null;

            updateSelectedChannelUI();

            renderMessages();

            return;
        }

        const stored =
            localStorage.getItem(
                "mwanikiSelectedChannel"
            );

        let channel =
            state.channels.find(
                item =>
                    String(item.id) ===
                    String(stored) &&
                    String(item.community_id) ===
                    String(
                        state.selectedCommunity?.id
                    )
            );

        if (!channel) {

            channel =
                state.channels.find(
                    item =>
                        String(item.name || "")
                            .trim()
                            .toLowerCase() ===
                        "general"
                );
        }

        channel =
            channel ||
            state.channels[0];

        selectChannel(
            channel,
            false
        );
    }


    async function selectChannel(
        channel,
        announce = true
    ) {

        if (!channel) return;

        state.selectedChannel =
            channel;

        localStorage.setItem(
            "mwanikiSelectedChannel",
            String(channel.id)
        );

        updateSelectedChannelUI();

        renderChannels();

        await loadMessages(
            channel.id
        );

        if (announce) {
            announceToScreenReader(
                `Opened channel ${channel.name}`
            );
        }
    }


    /* ============================================================
       COMMUNITY UI
       ============================================================ */

    function updateSelectedCommunityUI() {

        const community =
            state.selectedCommunity;

        if (!community) return;

        const icon =
            getCommunityIcon(community);

        [
            dom.selectedCommunityIcon,
            dom.activeCommunityIcon
        ].forEach(element => {

            if (element) {
                element.textContent = icon;
            }
        });

        if (dom.selectedCommunityName) {
            dom.selectedCommunityName.textContent =
                community.name || "Community";
        }

        if (dom.activeCommunityName) {
            dom.activeCommunityName.textContent =
                community.name || "Community";
        }

        if (dom.selectedCommunityDescription) {
            dom.selectedCommunityDescription.textContent =
                community.description || "";
        }

        if (dom.activeCommunityDescription) {
            dom.activeCommunityDescription.textContent =
                community.description || "";
        }

        if (dom.communityBrandTitle) {
            dom.communityBrandTitle.textContent =
                community.name ||
                "Mwaniki Community";
        }
    }


    function updateSelectedChannelUI() {

        const channel =
            state.selectedChannel;

        if (!channel) {

            if (dom.mainChannelTitle)
                dom.mainChannelTitle.textContent =
                    "Select a channel";

            if (dom.mainChannelDescription)
                dom.mainChannelDescription.textContent =
                    "";

            if (dom.activeChannelName)
                dom.activeChannelName.textContent =
                    "Select a channel";

            if (dom.activeChannelDescription)
                dom.activeChannelDescription.textContent =
                    "";

            return;
        }

        const name =
            channel.name || "general";

        if (dom.mainChannelTitle) {
            dom.mainChannelTitle.textContent =
                `# ${name}`;
        }

        if (dom.activeChannelName) {
            dom.activeChannelName.textContent =
                `# ${name}`;
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
                "Community";
        }
    }


    /* ============================================================
       COMMUNITY RAIL
       ============================================================ */

    function renderCommunityRail() {

        const container =
            dom.communityRailList ||
            dom.communityRail;

        if (!container) return;

        if (container === dom.communityRail) {

            const list =
                container.querySelector(
                    "#communityRailList"
                );

            if (list) {
                renderCommunityRailInto(list);
            }

            return;
        }

        renderCommunityRailInto(container);
    }


    function renderCommunityRailInto(container) {

        container.innerHTML = "";

        state.communities.forEach(
            community => {

                const button =
                    document.createElement("button");

                button.type = "button";
                button.className =
                    "community-rail-item";

                if (
                    String(
                        state.selectedCommunity?.id
                    ) ===
                    String(community.id)
                ) {
                    button.classList.add("active");
                }

                button.title =
                    community.name ||
                    "Community";

                button.setAttribute(
                    "aria-label",
                    `Open ${community.name || "community"}`
                );

                const icon =
                    document.createElement("span");

                icon.className =
                    "community-rail-icon";

                icon.textContent =
                    getCommunityIcon(
                        community
                    );

                button.appendChild(icon);

                button.addEventListener(
                    "click",
                    () =>
                        selectCommunity(community)
                );

                container.appendChild(button);
            }
        );
    }


    /* ============================================================
       COMMUNITY SELECTOR
       ============================================================ */

    function renderCommunitySelector() {

        if (!dom.communityChoiceList) return;

        renderCommunityChoices(
            state.communitySearch
        );
    }


    function renderCommunityChoices(search = "") {

        if (!dom.communityChoiceList) return;

        const term =
            String(search)
                .toLowerCase()
                .trim();

        dom.communityChoiceList.innerHTML = "";

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
                            community.description || ""
                        )
                            .toLowerCase()
                            .includes(term)
                    );
                }
            );

        if (!communities.length) {

            const empty =
                document.createElement("div");

            empty.className =
                "community-empty";

            empty.textContent =
                "No communities found.";

            dom.communityChoiceList.appendChild(
                empty
            );

            return;
        }

        communities.forEach(
            community => {

                const button =
                    document.createElement("button");

                button.type = "button";
                button.className =
                    "community-choice";

                const icon =
                    document.createElement("span");

                icon.className =
                    "community-choice-icon";

                icon.textContent =
                    getCommunityIcon(
                        community
                    );

                const text =
                    document.createElement("span");

                text.className =
                    "community-choice-text";

                const name =
                    document.createElement("strong");

                name.textContent =
                    community.name ||
                    "Community";

                const description =
                    document.createElement("small");

                description.textContent =
                    community.description ||
                    "";

                text.append(
                    name,
                    description
                );

                button.append(
                    icon,
                    text
                );

                button.addEventListener(
                    "click",
                    async () => {

                        closeCommunityModal();

                        await selectCommunity(
                            community
                        );
                    }
                );

                dom.communityChoiceList.appendChild(
                    button
                );
            }
        );
    }


    /* ============================================================
       COMMUNITY ICONS
       ============================================================ */

    function getCommunityIcon(community) {

        if (
            community?.icon &&
            String(community.icon).trim()
        ) {
            return String(community.icon);
        }

        const name =
            String(
                community?.name || ""
            ).toLowerCase();

        if (name.includes("gaming"))
            return "🎮";

        if (name.includes("meme"))
            return "😂";

        if (
            name.includes("home") ||
            name.includes("general")
        )
            return "🏠";

        if (
            name.includes("medical") ||
            name.includes("mwaniki")
        )
            return "🩺";

        return "💬";
    }


    /* ============================================================
       CHANNELS
       ============================================================ */

    function renderChannels() {

        if (!dom.channelList) return;

        const term =
            String(
                state.channelSearch || ""
            )
                .toLowerCase()
                .trim();

        dom.channelList.innerHTML = "";

        const filtered =
            state.channels.filter(
                channel => {

                    if (!term) return true;

                    return (
                        String(
                            channel.name || ""
                        )
                            .toLowerCase()
                            .includes(term) ||

                        String(
                            channel.description || ""
                        )
                            .toLowerCase()
                            .includes(term)
                    );
                }
            );

        if (!filtered.length) {

            const empty =
                document.createElement("div");

            empty.className =
                "channel-empty";

            empty.textContent =
                state.loadingChannels
                    ? "Loading channels..."
                    : "No channels found.";

            dom.channelList.appendChild(empty);

            return;
        }

        filtered.forEach(
            channel => {

                const button =
                    document.createElement("button");

                button.type = "button";
                button.className =
                    "channel-item";

                if (
                    String(
                        state.selectedChannel?.id
                    ) ===
                    String(channel.id)
                ) {
                    button.classList.add("active");
                }

                const icon =
                    document.createElement("span");

                icon.className =
                    "channel-icon";

                icon.textContent =
                    channel.icon ||
                    getChannelIcon(channel);

                const name =
                    document.createElement("span");

                name.className =
                    "channel-name";

                name.textContent =
                    channel.name ||
                    "general";

                button.append(
                    icon,
                    name
                );

                button.addEventListener(
                    "click",
                    () => selectChannel(channel)
                );

                dom.channelList.appendChild(button);
            }
        );
    }


    function getChannelIcon(channel) {

        const type =
            String(
                channel?.channel_type || ""
            ).toLowerCase();

        if (
            type === "voice" ||
            type === "audio"
        )
            return "🔊";

        if (
            type === "announcement" ||
            type === "announcements"
        )
            return "📢";

        if (
            type === "study" ||
            type === "education"
        )
            return "📚";

        return "#";
    }


    /* ============================================================
       LOAD MESSAGES
       ============================================================ */

    async function loadMessages(channelId) {

        if (!channelId) {

            state.messages = [];

            renderMessages();

            return;
        }

        state.loadingMessages = true;

        showChannelLoading(true);

        try {

            const { data, error } =
                await state.supabase
                    .from("chat_messages")
                    .select(
                        "id, channel_id, user_id, content, created_at"
                    )
                    .eq(
                        "channel_id",
                        channelId
                    )
                    .order(
                        "created_at",
                        {
                            ascending: true
                        }
                    )
                    .limit(
                        CONFIG.messageLimit
                    );

            if (error) throw error;

            state.messages =
                Array.isArray(data)
                    ? data
                    : [];

            await attachMessageProfiles(
                state.messages
            );

            renderMessages();

        } catch (error) {

            console.error(
                "Could not load messages:",
                error
            );

            state.messages = [];

            renderMessages(
                "Unable to load messages."
            );

        } finally {

            state.loadingMessages = false;

            showChannelLoading(false);
        }
    }


    /* ============================================================
       MESSAGE PROFILE RESOLUTION
       ============================================================
       THIS IS THE MAIN FIX.

       Priority:

       1. Current logged-in user's cached profile
       2. students.id
       3. students.user_id
       4. chat_community_members.nickname

       We NEVER use auth email.
       ============================================================ */

    async function attachMessageProfiles(messages) {

        if (
            !Array.isArray(messages) ||
            !messages.length
        ) {
            return;
        }

        const ids = [
            ...new Set(
                messages
                    .map(message => message.user_id)
                    .filter(Boolean)
                    .map(String)
            )
        ];

        if (!ids.length) return;

        const profileMap =
            new Map();

        /* --------------------------------------------------------
           CURRENT USER FIRST
           -------------------------------------------------------- */

        if (state.user?.id && state.profile) {

            profileMap.set(
                String(state.user.id),
                normalizeProfile(state.profile)
            );
        }


        /* --------------------------------------------------------
           LOOKUP 1: students.id
           -------------------------------------------------------- */

        try {

            const { data, error } =
                await state.supabase
                    .from("students")
                    .select("*")
                    .in("id", ids);

            if (!error && Array.isArray(data)) {

                data.forEach(profile => {

                    const normalized =
                        normalizeProfile(profile);

                    if (!normalized) return;

                    if (profile.id) {

                        profileMap.set(
                            String(profile.id),
                            normalized
                        );
                    }
                });
            }

        } catch (error) {

            console.warn(
                "students.id sender lookup failed:",
                error
            );
        }


        /* --------------------------------------------------------
           LOOKUP 2: students.user_id
           -------------------------------------------------------- */

        const missingIds =
            ids.filter(
                id =>
                    !profileMap.has(
                        String(id)
                    )
            );

        if (missingIds.length) {

            try {

                const { data, error } =
                    await state.supabase
                        .from("students")
                        .select("*")
                        .in(
                            "user_id",
                            missingIds
                        );

                if (!error && Array.isArray(data)) {

                    data.forEach(profile => {

                        const normalized =
                            normalizeProfile(profile);

                        if (!normalized) return;

                        if (profile.user_id) {

                            profileMap.set(
                                String(profile.user_id),
                                normalized
                            );
                        }

                        if (profile.id) {

                            profileMap.set(
                                String(profile.id),
                                normalized
                            );
                        }
                    });
                }

            } catch (error) {

                /*
                 * This is safe if students.user_id does
                 * not exist in your database.
                 */

                console.warn(
                    "students.user_id sender lookup skipped/failed:",
                    error
                );
            }
        }


        /* --------------------------------------------------------
           LOOKUP 3:
           chat_community_members

           This gives us the member nickname when the students
           table cannot be read because of RLS or because the
           relationship is different.

           IMPORTANT:
           We only request columns confirmed by your schema.
           -------------------------------------------------------- */

        const stillMissing =
            ids.filter(
                id =>
                    !profileMap.has(
                        String(id)
                    )
            );

        if (
            stillMissing.length &&
            state.selectedCommunity?.id
        ) {

            try {

                const { data, error } =
                    await state.supabase
                        .from("chat_community_members")
                        .select(
                            "user_id, nickname, role"
                        )
                        .eq(
                            "community_id",
                            state.selectedCommunity.id
                        )
                        .in(
                            "user_id",
                            stillMissing
                        );

                if (!error && Array.isArray(data)) {

                    data.forEach(member => {

                        if (!member.user_id) {
                            return;
                        }

                        const nickname =
                            String(
                                member.nickname || ""
                            ).trim();

                        if (!nickname) {
                            return;
                        }

                        profileMap.set(
                            String(member.user_id),
                            {
                                id: member.user_id,

                                display_name:
                                    nickname,

                                photo_url: "",

                                role:
                                    member.role || ""
                            }
                        );
                    });
                }

            } catch (error) {

                console.warn(
                    "Community member profile fallback failed:",
                    error
                );
            }
        }


        /* --------------------------------------------------------
           APPLY PROFILES
           -------------------------------------------------------- */

        messages.forEach(message => {

            const senderId =
                String(
                    message.user_id || ""
                );

            const profile =
                profileMap.get(senderId);

            message.profile =
                profile
                    ? normalizeProfile(profile)
                    : null;

            /*
             * Diagnostic logging.
             *
             * This will tell us exactly what the browser is
             * receiving for each sender.
             */

            console.log(
                "MESSAGE SENDER:",
                senderId,
                message.profile
                    ? {
                        name:
                            getProfileName(
                                message.profile
                            ),
                        photo:
                            getProfilePhoto(
                                message.profile
                            )
                    }
                    : "NO PROFILE FOUND"
            );
        });
    }


    /* ============================================================
       SINGLE MESSAGE PROFILE
       ============================================================ */

    async function attachSingleProfile(message) {

        if (!message?.user_id) {

            message.profile = null;

            return message;
        }

        const userId =
            String(message.user_id);


        /* Own profile */

        if (
            state.user?.id &&
            userId === String(state.user.id)
        ) {

            message.profile =
                state.profile;

            return message;
        }


        /* students.id */

        try {

            const { data, error } =
                await state.supabase
                    .from("students")
                    .select("*")
                    .eq(
                        "id",
                        message.user_id
                    )
                    .maybeSingle();

            if (!error && data) {

                message.profile =
                    normalizeProfile(data);

                return message;
            }

        } catch (error) {

            console.warn(
                "Realtime students.id lookup failed:",
                error
            );
        }


        /* students.user_id */

        try {

            const { data, error } =
                await state.supabase
                    .from("students")
                    .select("*")
                    .eq(
                        "user_id",
                        message.user_id
                    )
                    .maybeSingle();

            if (!error && data) {

                message.profile =
                    normalizeProfile(data);

                return message;
            }

        } catch (error) {

            console.warn(
                "Realtime students.user_id lookup failed:",
                error
            );
        }


        /* Community member nickname */

        if (state.selectedCommunity?.id) {

            try {

                const { data, error } =
                    await state.supabase
                        .from("chat_community_members")
                        .select(
                            "user_id, nickname, role"
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
                    data?.nickname
                ) {

                    message.profile = {
                        id: data.user_id,

                        display_name:
                            String(
                                data.nickname
                            ).trim(),

                        photo_url: "",

                        role:
                            data.role || ""
                    };

                    return message;
                }

            } catch (error) {

                console.warn(
                    "Realtime member lookup failed:",
                    error
                );
            }
        }


        message.profile = null;

        return message;
    }


    /* ============================================================
       RENDER MESSAGES
       ============================================================ */

    function renderMessages(emptyMessage = "") {

        if (!dom.messageList) return;

        dom.messageList.innerHTML = "";

        if (emptyMessage) {

            const empty =
                document.createElement("div");

            empty.className =
                "message-empty";

            empty.textContent =
                emptyMessage;

            dom.messageList.appendChild(empty);

            return;
        }

        if (!state.selectedChannel) {

            const welcome =
                document.createElement("div");

            welcome.className =
                "message-empty";

            welcome.textContent =
                "Select a channel to begin.";

            dom.messageList.appendChild(welcome);

            return;
        }

        if (!state.messages.length) {

            const empty =
                document.createElement("div");

            empty.className =
                "message-empty";

            empty.textContent =
                `Welcome to #${state.selectedChannel.name || "general"}. Start the conversation.`;

            dom.messageList.appendChild(empty);

            return;
        }

        state.messages.forEach(message => {

            const element =
                createMessageElement(message);

            if (element) {
                dom.messageList.appendChild(element);
            }
        });

        scrollMessagesToBottom();
    }


    /* ============================================================
       MESSAGE ELEMENT
       ============================================================ */

    function createMessageElement(message) {

        const article =
            document.createElement("article");

        article.className =
            "message";

        article.dataset.messageId =
            message.id || "";


        /* --------------------------------------------------------
           AVATAR
           -------------------------------------------------------- */

        const avatar =
            document.createElement("img");

        avatar.className =
            "message-avatar";

        const author =
            getProfileName(
                message.profile
            );

        const photo =
            getProfilePhoto(
                message.profile
            );

        setImage(
            avatar,
            photo,
            `${author} profile photo`
        );

        avatar.width = 42;
        avatar.height = 42;

        avatar.loading = "lazy";

        avatar.style.width = "42px";
        avatar.style.height = "42px";
        avatar.style.minWidth = "42px";
        avatar.style.minHeight = "42px";
        avatar.style.maxWidth = "42px";
        avatar.style.maxHeight = "42px";
        avatar.style.objectFit = "cover";
        avatar.style.borderRadius = "50%";


        /* --------------------------------------------------------
           MESSAGE BODY
           -------------------------------------------------------- */

        const body =
            document.createElement("div");

        body.className =
            "message-body";


        /* --------------------------------------------------------
           HEADER
           -------------------------------------------------------- */

        const header =
            document.createElement("div");

        header.className =
            "message-header";


        const authorElement =
            document.createElement("span");

        authorElement.className =
            "message-author";

        authorElement.textContent =
            author;


        const time =
            document.createElement("time");

        time.className =
            "message-time";

        time.dateTime =
            message.created_at || "";

        time.textContent =
            formatMessageTime(
                message.created_at
            );


        header.append(
            authorElement,
            time
        );


        /* --------------------------------------------------------
           CONTENT
           -------------------------------------------------------- */

        const content =
            document.createElement("div");

        content.className =
            "message-content";

        content.textContent =
            message.content || "";


        body.append(
            header,
            content
        );

        article.append(
            avatar,
            body
        );

        return article;
    }


    /* ============================================================
       SEND MESSAGE
       ============================================================ */

    async function sendMessage(event) {

        if (event) {
            event.preventDefault();
        }

        if (
            !state.user ||
            !state.selectedChannel ||
            !dom.messageInput
        ) {
            return;
        }

        const content =
            String(
                dom.messageInput.value || ""
            ).trim();

        if (!content) return;

        if (dom.sendMessageButton) {
            dom.sendMessageButton.disabled = true;
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
                    .select(
                        "id, channel_id, user_id, content, created_at"
                    )
                    .single();

            if (error) throw error;

            if (data) {

                data.profile =
                    state.profile;

                const exists =
                    state.messages.some(
                        message =>
                            String(message.id) ===
                            String(data.id)
                    );

                if (!exists) {

                    state.messages.push(data);

                    renderMessages();
                }
            }

            dom.messageInput.value = "";

            closeEmojiPicker();

        } catch (error) {

            console.error(
                "Send message failed:",
                error
            );

            setStatus(
                error?.message ||
                "Could not send message."
            );

        } finally {

            if (dom.sendMessageButton) {
                dom.sendMessageButton.disabled = false;
            }

            dom.messageInput?.focus();
        }
    }


    /* ============================================================
       REALTIME
       ============================================================ */

    function setupRealtime() {

        if (!state.supabase?.channel) {
            return;
        }

        cleanupRealtime();

        const channel =
            state.supabase.channel(
                "mwaniki-community-messages"
            );

        channel
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "chat_messages"
                },
                async payload => {

                    const message =
                        payload?.new;

                    if (!message) return;

                    if (
                        !state.selectedChannel ||
                        String(message.channel_id) !==
                        String(
                            state.selectedChannel.id
                        )
                    ) {
                        return;
                    }

                    const exists =
                        state.messages.some(
                            item =>
                                String(item.id) ===
                                String(message.id)
                        );

                    if (exists) return;

                    await attachSingleProfile(
                        message
                    );

                    state.messages.push(message);

                    renderMessages();
                }
            )
            .subscribe(status => {

                console.log(
                    "Community realtime:",
                    status
                );
            });

        state.realtimeChannels.push(channel);
    }


    function cleanupRealtime() {

        state.realtimeChannels.forEach(
            channel => {

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
        );

        state.realtimeChannels = [];
    }


    /* ============================================================
       PRESENCE
       ============================================================ */

    async function updatePresence() {

        if (
            !state.supabase ||
            !state.user?.id
        ) {
            return;
        }

        try {

            const now =
                new Date().toISOString();

            const { error } =
                await state.supabase
                    .from("chat_presence")
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

        } catch (error) {

            console.warn(
                "Presence error:",
                error
            );
        }
    }


    function setupPresenceHeartbeat() {

        if (state.presenceHeartbeat) {
            clearInterval(
                state.presenceHeartbeat
            );
        }

        state.presenceHeartbeat =
            setInterval(
                updatePresence,
                CONFIG.presenceHeartbeat
            );
    }


    async function markOffline() {

        if (
            !state.supabase ||
            !state.user?.id
        ) {
            return;
        }

        try {

            await state.supabase
                .from("chat_presence")
                .update({
                    status: "offline",

                    last_seen_at:
                        new Date().toISOString(),

                    updated_at:
                        new Date().toISOString()
                })
                .eq(
                    "user_id",
                    state.user.id
                );

        } catch (error) {

            console.warn(
                "Offline presence failed:",
                error
            );
        }
    }


    /* ============================================================
       COMMUNITY MODAL
       ============================================================ */

    function openCommunityModal() {

        if (!dom.communityModal) return;

        state.communityModalOpen = true;

        dom.communityModal.classList.add("open");

        dom.communityModal.setAttribute(
            "aria-hidden",
            "false"
        );

        state.communitySearch = "";

        if (dom.communityModalSearch) {

            dom.communityModalSearch.value = "";

            dom.communityModalSearch.focus();
        }

        renderCommunityChoices();
    }


    function closeCommunityModal() {

        if (!dom.communityModal) return;

        state.communityModalOpen = false;

        dom.communityModal.classList.remove("open");

        dom.communityModal.setAttribute(
            "aria-hidden",
            "true"
        );
    }


    /* ============================================================
       EMOJI
       ============================================================ */

    const EMOJI_CATEGORIES = {

        smileys: [
            "😀","😃","😄","😁","😆","😅","😂","🤣",
            "😊","😇","🙂","🙃","😉","😍","🥰","😘",
            "😋","😛","😝","😜","🤪","🤓","😎","🤩",
            "🥳","😏","😒","😞","😔","😟","😕","🙁",
            "😣","😖","😫","😩","🥺","😢","😭","😤",
            "😠","😡","🤬","🤯","😳","🥵","🥶","😱",
            "😨","😰","😥","😓","🤗","🤔","🤭","🤫",
            "😶","😐","😑","😬","🙄","😯","😮","😲",
            "🥱","😴","🤤","😪","😵","🤐","🥴","🤢",
            "🤮","🤧","😷","🤒","🤕","🤑","🤠","😈",
            "👿","🤡","💩","👻","💀","👽","👾","🤖"
        ],

        people: [
            "👋","🤚","🖐️","✋","🖖","👌","🤌","🤏",
            "✌️","🤞","🫰","🤟","🤘","🤙","👈","👉",
            "👆","👇","☝️","✍️","👏","🙌","👐","🤲",
            "🙏","💪","🫶","❤️","🧡","💛","💚","💙",
            "💜","🖤","🤍","🤎","💔","💕","💞","💓",
            "💗","💖","💘","💝","✨","⭐"
        ],

        animals: [
            "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼",
            "🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈",
            "🙉","🙊","🐔","🐧","🐦","🐤","🦆","🦅",
            "🦉","🐺","🐗","🐴","🦄","🐝","🦋","🐌",
            "🐞","🐜","🕷️","🐢","🐍","🦎","🦖","🐙",
            "🦑","🦀","🐠","🐟","🐡","🐬","🐳"
        ],

        food: [
            "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇",
            "🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥",
            "🥝","🍅","🥑","🍆","🥔","🥕","🌽","🌶️",
            "🥒","🥬","🥦","🧄","🧅","🍞","🥐","🥖",
            "🧀","🥚","🍳","🧇","🥞","🍗","🍔","🍟",
            "🍕","🌭","🌮","🌯","🥗","🍿","🍩","🍪",
            "🎂","🍰","🍫","🍭","☕","🧃","🥤"
        ],

        activities: [
            "⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉",
            "🎱","🏓","🏸","🥅","🏒","🏑","🥊","🥋",
            "🎮","🎲","🧩","♟️","🎯","🎨","🎬","🎤",
            "🎧","🎼","🎹","🥁","🎸","🎺","🎻","🏆",
            "🥇","🥈","🥉","🏅","🚀","✈️","🚗","🏎️"
        ],

        objects: [
            "📱","💻","🖥️","⌨️","🖱️","📷","📹","📺",
            "☎️","📞","🔋","💡","🔦","📚","📖","📝",
            "✏️","🖊️","📌","📍","📎","🔒","🔑","🔔",
            "🎁","🎈","🧸","💰","💎","⚕️","🩺","💊",
            "🧪","🔬","🧬","🧫","🧠","🏥","🚑"
        ],

        symbols: [
            "✅","❌","❗","❓","‼️","⁉️","⚠️","🚫",
            "⭕","✔️","☑️","🔴","🟠","🟡","🟢","🔵",
            "🟣","⚫","⚪","🔶","🔷","🔺","🔻","⭐",
            "🌟","💫","🔥","💯","🎉","🎊","💥","💤",
            "♻️","⚡","☀️","🌙","☁️","❄️","🌈","☮️"
        ]
    };


    function setupEmojiPicker() {

        if (!dom.emojiButton) return;

        renderEmojiPicker();
    }


    function renderEmojiPicker() {

        const existing =
            document.getElementById(
                "mwanikiEmojiPicker"
            );

        if (existing) existing.remove();

        if (!state.emojiPickerOpen) return;

        const picker =
            document.createElement("div");

        picker.id =
            "mwanikiEmojiPicker";

        picker.className =
            "mwaniki-emoji-picker";

        const categories =
            document.createElement("div");

        categories.className =
            "emoji-categories";

        Object.keys(
            EMOJI_CATEGORIES
        ).forEach(category => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "emoji-category-button";

            button.textContent =
                emojiCategoryIcon(category);

            button.setAttribute(
                "aria-label",
                category
            );

            if (
                category ===
                state.emojiCategory
            ) {
                button.classList.add("active");
            }

            button.addEventListener(
                "click",
                () => {

                    state.emojiCategory =
                        category;

                    renderEmojiPicker();
                }
            );

            categories.appendChild(button);
        });


        const grid =
            document.createElement("div");

        grid.className =
            "emoji-grid";

        (
            EMOJI_CATEGORIES[
                state.emojiCategory
            ] || []
        ).forEach(emoji => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "emoji-button";

            button.textContent =
                emoji;

            button.setAttribute(
                "aria-label",
                `Insert ${emoji}`
            );

            button.addEventListener(
                "click",
                () => insertEmoji(emoji)
            );

            grid.appendChild(button);
        });

        picker.append(
            categories,
            grid
        );

        document.body.appendChild(picker);

        positionEmojiPicker(picker);
    }


    function emojiCategoryIcon(category) {

        return {
            smileys: "😀",
            people: "👋",
            animals: "🐻",
            food: "🍕",
            activities: "⚽",
            objects: "💡",
            symbols: "❤️"
        }[category] || "😀";
    }


    function insertEmoji(emoji) {

        if (!dom.messageInput) return;

        const input =
            dom.messageInput;

        const start =
            input.selectionStart ??
            input.value.length;

        const end =
            input.selectionEnd ??
            input.value.length;

        input.value =
            input.value.slice(0, start) +
            emoji +
            input.value.slice(end);

        const position =
            start + emoji.length;

        input.focus();

        input.setSelectionRange(
            position,
            position
        );

        state.recentEmojis = [
            emoji,
            ...state.recentEmojis.filter(
                item => item !== emoji
            )
        ].slice(0, 20);
    }


    function positionEmojiPicker(picker) {

        if (!dom.emojiButton) return;

        const rect =
            dom.emojiButton.getBoundingClientRect();

        picker.style.position = "fixed";

        picker.style.left =
            `${Math.max(8, rect.left)}px`;

        picker.style.bottom =
            `${Math.max(
                8,
                window.innerHeight -
                rect.top +
                8
            )}px`;

        picker.style.zIndex = "9999";
    }


    function toggleEmojiPicker() {

        state.emojiPickerOpen =
            !state.emojiPickerOpen;

        renderEmojiPicker();
    }


    function closeEmojiPicker() {

        state.emojiPickerOpen = false;

        document
            .getElementById(
                "mwanikiEmojiPicker"
            )
            ?.remove();
    }


    /* ============================================================
       SEARCH
       ============================================================ */

    function filterChannels(value) {

        state.channelSearch =
            String(value || "");

        renderChannels();
    }


    function searchMessages() {

        const term =
            window.prompt(
                "Search messages"
            );

        if (
            term === null ||
            !String(term).trim()
        ) {
            return;
        }

        const search =
            String(term)
                .toLowerCase()
                .trim();

        const matches =
            state.messages.filter(
                message =>
                    String(
                        message.content || ""
                    )
                        .toLowerCase()
                        .includes(search)
            );

        if (!dom.messageList) return;

        dom.messageList.innerHTML = "";

        if (!matches.length) {

            const empty =
                document.createElement("div");

            empty.className =
                "message-empty";

            empty.textContent =
                "No matching messages found.";

            dom.messageList.appendChild(empty);

            return;
        }

        matches.forEach(message => {

            dom.messageList.appendChild(
                createMessageElement(message)
            );
        });
    }


    /* ============================================================
       EVENTS
       ============================================================ */

    function bindEvents() {

        [
            dom.homeButton,
            dom.railHomeButton,
            dom.dashboardButton
        ].forEach(button => {

            if (!button) return;

            button.addEventListener(
                "click",
                () => {
                    window.location.href =
                        CONFIG.dashboardUrl;
                }
            );
        });


        [
            dom.railProfileButton,
            dom.sidebarProfileButton
        ].forEach(button => {

            if (!button) return;

            button.addEventListener(
                "click",
                () => {
                    window.location.href =
                        CONFIG.profileUrl;
                }
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


        dom.closeCommunityModal?.addEventListener(
            "click",
            closeCommunityModal
        );


        dom.communityModalSearch?.addEventListener(
            "input",
            event => {

                state.communitySearch =
                    event.target.value;

                renderCommunityChoices(
                    state.communitySearch
                );
            }
        );


        dom.channelSearchInput?.addEventListener(
            "input",
            event =>
                filterChannels(
                    event.target.value
                )
        );


        dom.messageForm?.addEventListener(
            "submit",
            sendMessage
        );


        dom.sendMessageButton?.addEventListener(
            "click",
            sendMessage
        );


        dom.messageInput?.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();

                    sendMessage();
                }
            }
        );


        dom.emojiButton?.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                toggleEmojiPicker();
            }
        );


        dom.attachButton?.addEventListener(
            "click",
            () => {

                setStatus(
                    "Attachments are ready for the community storage integration."
                );
            }
        );


        [
            dom.startConversationButton,
            dom.welcomeStartButton
        ].forEach(button => {

            if (!button) return;

            button.addEventListener(
                "click",
                () => {
                    dom.messageInput?.focus();
                }
            );
        });


        dom.chatSearchButton?.addEventListener(
            "click",
            searchMessages
        );


        dom.channelToggleButton?.addEventListener(
            "click",
            () => {

                dom.channelSidebar
                    ?.classList.toggle(
                        "collapsed"
                    );
            }
        );


        dom.generalCallButton?.addEventListener(
            "click",
            openGeneralCallModal
        );


        dom.closeGeneralCallModalButton?.addEventListener(
            "click",
            closeGeneralCallModal
        );


        dom.cancelGeneralCallButton?.addEventListener(
            "click",
            closeGeneralCallModal
        );


        dom.voiceCallButton?.addEventListener(
            "click",
            () => startCommunityCall("audio")
        );


        dom.videoCallButton?.addEventListener(
            "click",
            () => startCommunityCall("video")
        );


        dom.toggleMicrophoneButton?.addEventListener(
            "click",
            toggleMicrophone
        );


        dom.toggleCameraButton?.addEventListener(
            "click",
            toggleCamera
        );


        dom.shareScreenButton?.addEventListener(
            "click",
            shareScreen
        );


        dom.leaveCallButton?.addEventListener(
            "click",
            leaveCall
        );


        dom.minimizeCallButton?.addEventListener(
            "click",
            minimizeCall
        );


        dom.generalVoiceCallButton?.addEventListener(
            "click",
            () => prepareGeneralCall("audio")
        );


        dom.generalVideoCallButton?.addEventListener(
            "click",
            () => prepareGeneralCall("video")
        );


        dom.communityModal?.addEventListener(
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


        dom.generalCallModal?.addEventListener(
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


        document.addEventListener(
            "keydown",
            event => {

                if (event.key === "Escape") {

                    closeCommunityModal();

                    closeGeneralCallModal();

                    closeEmojiPicker();
                }
            }
        );


        document.addEventListener(
            "click",
            event => {

                const picker =
                    document.getElementById(
                        "mwanikiEmojiPicker"
                    );

                if (!picker) return;

                if (
                    !picker.contains(event.target) &&
                    event.target !==
                        dom.emojiButton
                ) {

                    closeEmojiPicker();
                }
            }
        );


        window.addEventListener(
            "beforeunload",
            () => {
                markOffline();
            }
        );


        window.addEventListener(
            "resize",
            () => {

                const picker =
                    document.getElementById(
                        "mwanikiEmojiPicker"
                    );

                if (picker) {
                    positionEmojiPicker(picker);
                }
            }
        );
    }


    /* ============================================================
       CALL UI
       ============================================================ */

    function openGeneralCallModal() {

        if (!dom.generalCallModal) {

            startCommunityCall(
                "video",
                "general"
            );

            return;
        }

        dom.generalCallModal.classList.add("open");

        dom.generalCallModal.setAttribute(
            "aria-hidden",
            "false"
        );

        dom.generalCallUserInput?.focus();
    }


    function closeGeneralCallModal() {

        if (!dom.generalCallModal) return;

        dom.generalCallModal.classList.remove("open");

        dom.generalCallModal.setAttribute(
            "aria-hidden",
            "true"
        );
    }


    function prepareGeneralCall(callType) {

        closeGeneralCallModal();

        startCommunityCall(
            callType,
            "general"
        );
    }


    async function startCommunityCall(
        callType = "video",
        scope = "community"
    ) {

        if (!state.user) {

            setStatus(
                "Please sign in before starting a call."
            );

            return;
        }

        const communityId =
            scope === "general"
                ? null
                : state.selectedCommunity?.id || null;

        const roomCode =
            createRoomCode();

        try {

            const { data, error } =
                await state.supabase
                    .from("chat_call_rooms")
                    .insert({
                        community_id:
                            communityId,

                        room_code:
                            roomCode,

                        call_scope:
                            scope,

                        call_type:
                            callType,

                        status:
                            "waiting",

                        created_by:
                            state.user.id
                    })
                    .select("*")
                    .single();

            if (error) throw error;

            state.call.active = true;

            state.call.roomId =
                data?.id || null;

            state.call.roomCode =
                data?.room_code ||
                roomCode;

            state.call.callType =
                callType;

            state.call.callScope =
                scope;

            state.call.communityId =
                communityId;

            state.call.muted = false;

            state.call.camera =
                callType === "video";

            openCallOverlay(
                callType,
                scope
            );

            await addCallParticipant(
                state.call.roomId
            );

        } catch (error) {

            console.error(
                "Could not start call:",
                error
            );

            setStatus(
                error?.message ||
                "Could not start call."
            );
        }
    }


    async function addCallParticipant(roomId) {

        if (
            !roomId ||
            !state.user?.id
        ) {
            return;
        }

        try {

            const { error } =
                await state.supabase
                    .from("chat_call_participants")
                    .insert({
                        room_id:
                            roomId,

                        user_id:
                            state.user.id,

                        status:
                            "joined",

                        is_muted:
                            false,

                        is_camera_on:
                            state.call.callType ===
                            "video",

                        is_screen_sharing:
                            false,

                        joined_at:
                            new Date().toISOString()
                    });

            if (error) {

                console.warn(
                    "Could not add call participant:",
                    error
                );
            }

        } catch (error) {

            console.warn(
                "Call participant error:",
                error
            );
        }
    }


    function createRoomCode() {

        return (
            "MW-" +
            Date.now() +
            "-" +
            Math.random()
                .toString(36)
                .slice(2, 10)
                .toUpperCase()
        );
    }


    function openCallOverlay(
        callType,
        scope
    ) {

        if (!dom.callOverlay) return;

        dom.callOverlay.classList.add("open");

        dom.callOverlay.setAttribute(
            "aria-hidden",
            "false"
        );

        if (dom.callTypeIcon) {

            dom.callTypeIcon.textContent =
                callType === "video"
                    ? "📹"
                    : "📞";
        }

        if (dom.callTitle) {

            dom.callTitle.textContent =
                scope === "general"
                    ? "General Call"
                    : (
                        state.selectedCommunity?.name ||
                        "Community Call"
                    );
        }

        if (dom.callSubtitle) {

            dom.callSubtitle.textContent =
                callType === "video"
                    ? "Video call"
                    : "Voice call";
        }
    }


    function minimizeCall() {

        dom.callOverlay?.classList.toggle(
            "minimized"
        );
    }


    function toggleMicrophone() {

        state.call.muted =
            !state.call.muted;

        if (dom.toggleMicrophoneButton) {

            dom.toggleMicrophoneButton.textContent =
                state.call.muted
                    ? "🔇"
                    : "🎙️";

            dom.toggleMicrophoneButton.setAttribute(
                "aria-label",
                state.call.muted
                    ? "Unmute microphone"
                    : "Mute microphone"
            );
        }
    }


    function toggleCamera() {

        state.call.camera =
            !state.call.camera;

        if (dom.toggleCameraButton) {

            dom.toggleCameraButton.textContent =
                state.call.camera
                    ? "📹"
                    : "🚫";

            dom.toggleCameraButton.setAttribute(
                "aria-label",
                state.call.camera
                    ? "Turn camera off"
                    : "Turn camera on"
            );
        }
    }


    async function shareScreen() {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getDisplayMedia
        ) {

            setStatus(
                "Screen sharing is not supported by this browser."
            );

            return;
        }

        try {

            await navigator.mediaDevices.getDisplayMedia({
                video: true
            });

            state.call.screenSharing = true;

        } catch (error) {

            console.warn(
                "Screen sharing cancelled:",
                error
            );
        }
    }


    async function leaveCall() {

        if (
            state.call.roomId &&
            state.user?.id
        ) {

            try {

                await state.supabase
                    .from("chat_call_participants")
                    .update({
                        status: "left",

                        left_at:
                            new Date().toISOString()
                    })
                    .eq(
                        "room_id",
                        state.call.roomId
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

        state.call.active = false;

        state.call.roomId = null;
        state.call.roomCode = null;
        state.call.callType = null;
        state.call.callScope = null;
        state.call.communityId = null;

        state.call.muted = false;
        state.call.camera = false;
        state.call.screenSharing = false;

        if (dom.callOverlay) {

            dom.callOverlay.classList.remove(
                "open",
                "minimized"
            );

            dom.callOverlay.setAttribute(
                "aria-hidden",
                "true"
            );
        }
    }


    /* ============================================================
       LOADING
       ============================================================ */

    function showChannelLoading(loading) {

        if (!dom.channelLoadingState) return;

        dom.channelLoadingState.hidden =
            !loading;
    }


    /* ============================================================
       STATUS
       ============================================================ */

    function setStatus(message) {

        if (dom.communityStatus) {

            dom.communityStatus.textContent =
                String(message || "");
        }

        console.log(
            "Mwaniki Community:",
            message
        );
    }


    /* ============================================================
       ACCESSIBILITY
       ============================================================ */

    function setupAccessibility() {

        if (!dom.accessibilityAnnouncer) return;

        dom.accessibilityAnnouncer.setAttribute(
            "aria-live",
            "polite"
        );

        dom.accessibilityAnnouncer.setAttribute(
            "aria-atomic",
            "true"
        );
    }


    function announceToScreenReader(message) {

        if (!dom.accessibilityAnnouncer) return;

        dom.accessibilityAnnouncer.textContent = "";

        requestAnimationFrame(() => {

            dom.accessibilityAnnouncer.textContent =
                String(message || "");
        });
    }


    /* ============================================================
       HELPERS
       ============================================================ */

    function formatMessageTime(value) {

        if (!value) return "";

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
        }

        return new Intl.DateTimeFormat(
            undefined,
            {
                hour: "numeric",
                minute: "2-digit"
            }
        ).format(date);
    }


    function scrollMessagesToBottom() {

        if (!dom.messageList) return;

        requestAnimationFrame(() => {

            dom.messageList.scrollTop =
                dom.messageList.scrollHeight;
        });
    }


    function sleep(ms) {

        return new Promise(
            resolve =>
                setTimeout(resolve, ms)
        );
    }


    /* ============================================================
       PUBLIC API
       ============================================================ */

    window.MwanikiCommunity = {

        state,

        reloadCommunities:
            async () => {

                await loadCommunities();

                renderCommunityRail();

                renderCommunitySelector();

                await selectInitialCommunity();
            },

        reloadChannels:
            async () => {

                if (
                    state.selectedCommunity
                ) {

                    await loadChannels(
                        state.selectedCommunity.id
                    );

                    renderChannels();
                }
            },

        reloadMessages:
            async () => {

                if (
                    state.selectedChannel
                ) {

                    await loadMessages(
                        state.selectedChannel.id
                    );
                }
            },

        selectCommunity,

        selectChannel,

        openCommunityModal,

        closeCommunityModal,

        sendMessage,

        startCommunityCall,

        leaveCall,

        getProfileName,

        getProfilePhoto
    };


    /* ============================================================
       START
       ============================================================ */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init,
            { once: true }
        );

    } else {

        init();
    }

})();
