/* ============================================================
   MWANIKI SCHOLARS COMMUNITY ENGINE
   community.js

   Works with the current community.html

   Features:
   - Supabase communities
   - Supabase channels
   - Mwaniki Scholars General
   - Community General channel
   - Community selector
   - Community/channel search
   - Message loading
   - Message sending
   - Student profile photos
   - Emoji community icons
   - Online presence
   - Keyboard accessibility
   - Modal accessibility
   - Realtime messages
   - Safe avatar rendering
   ============================================================ */

(() => {
    "use strict";

    /* ============================================================
       CONFIGURATION
       ============================================================ */

    const CONFIG = {
        dashboardUrl: "./dashboard.html",

        defaultAvatar:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">
                    <rect width="96" height="96" rx="48" fill="#dce9e7"/>
                    <circle cx="48" cy="37" r="17" fill="#087f73"/>
                    <path d="M20 82c4-18 15-27 28-27s24 9 28 27"
                          fill="#087f73"/>
                </svg>
            `),

        generalCommunityId: "mwaniki-global"
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

        selectedCommunity: null,
        selectedChannel: null,

        messages: [],

        communitySearch: "",
        channelSearch: "",

        loadingCommunities: false,
        loadingChannels: false,
        loadingMessages: false,

        realtimeChannel: null,
        presenceChannel: null,

        modalPreviouslyFocused: null,

        sendingMessage: false
    };

    /* ============================================================
       DOM HELPER
       ============================================================ */

    const $ = (id) => document.getElementById(id);

    const dom = {};

    function cacheDom() {

        [
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
            "communityChoiceList"
        ].forEach((id) => {
            dom[id] = $(id);
        });
    }

    /* ============================================================
       SUPABASE DETECTION
       ============================================================ */

    function getSupabaseClient() {

        if (window.supabaseClient) {
            return window.supabaseClient;
        }

        if (window.sb) {
            return window.sb;
        }

        if (window.supabase && typeof window.supabase.from === "function") {
            return window.supabase;
        }

        /*
         * Some projects expose the client using a custom variable.
         * Search common names safely.
         */
        const candidates = [
            "supabase",
            "supabaseClient",
            "client"
        ];

        for (const name of candidates) {

            try {

                if (
                    window[name] &&
                    typeof window[name].from === "function"
                ) {
                    return window[name];
                }

            } catch (_) {}
        }

        return null;
    }

    /* ============================================================
       INIT
       ============================================================ */

    async function init() {

        cacheDom();

        announce("Loading Mwaniki Scholars Community.");

        state.supabase = getSupabaseClient();

        if (!state.supabase) {

            console.error(
                "Mwaniki Community: Supabase client was not found."
            );

            showError(
                "Supabase connection was not found. Check supabase.js."
            );

            return;
        }

        bindEvents();

        await loadAuthenticatedUser();

        await loadProfile();

        await updatePresence();

        await loadCommunities();

        renderCommunityRail();

        renderCommunitySelector();

        renderCommunityModal();

        await selectInitialCommunity();

        setupRealtime();

        setupKeyboardAccessibility();

        announce(
            "Mwaniki Scholars Community is ready."
        );

        console.log(
            "Mwaniki Community fully initialized."
        );
    }

    /* ============================================================
       AUTH
       ============================================================ */

    async function loadAuthenticatedUser() {

        try {

            const {
                data,
                error
            } = await state.supabase.auth.getUser();

            if (error) {
                console.warn(
                    "Unable to retrieve authenticated user:",
                    error
                );
                return;
            }

            state.user = data?.user || null;

            if (!state.user) {

                console.warn(
                    "No authenticated user found."
                );

                announce(
                    "You are not currently signed in."
                );

                return;
            }

            console.log(
                "Authenticated user:",
                state.user.id
            );

        } catch (error) {

            console.error(
                "Authentication error:",
                error
            );
        }
    }

    /* ============================================================
       PROFILE
       ============================================================ */

    async function loadProfile() {

        if (!state.user) {

            setProfileFallback();

            return;
        }

        try {

            const {
                data,
                error
            } = await state.supabase
                .from("students")
                .select(`
                    id,
                    full_name,
                    name,
                    student_name,
                    photo_url
                `)
                .eq("id", state.user.id)
                .maybeSingle();

            if (error) {

                console.warn(
                    "Student profile query failed:",
                    error
                );

                setProfileFallback();

                return;
            }

            state.profile = data || null;

            updateProfileUI();

        } catch (error) {

            console.error(
                "Profile loading error:",
                error
            );

            setProfileFallback();
        }
    }

    function getProfileName(profile = state.profile) {

        if (!profile) {
            return (
                state.user?.email ||
                "Student"
            );
        }

        return (
            profile.full_name ||
            profile.name ||
            profile.student_name ||
            state.user?.email ||
            "Student"
        );
    }

    function getProfilePhoto(profile = state.profile) {

        return (
            profile?.photo_url ||
            CONFIG.defaultAvatar
        );
    }

    function updateProfileUI() {

        const name = getProfileName();
        const photo = getProfilePhoto();

        if (dom.sidebarProfileName) {
            dom.sidebarProfileName.textContent = name;
        }

        setImage(
            dom.sidebarProfileAvatar,
            photo,
            name
        );

        setImage(
            dom.railProfileAvatar,
            photo,
            name
        );
    }

    function setProfileFallback() {

        const name =
            state.user?.email ||
            "Student";

        if (dom.sidebarProfileName) {
            dom.sidebarProfileName.textContent = name;
        }

        setImage(
            dom.sidebarProfileAvatar,
            CONFIG.defaultAvatar,
            name
        );

        setImage(
            dom.railProfileAvatar,
            CONFIG.defaultAvatar,
            name
        );
    }

    /* ============================================================
       SAFE IMAGE HANDLING
       ============================================================ */

    function setImage(image, source, alt = "") {

        if (!image) {
            return;
        }

        image.onerror = () => {

            image.onerror = null;

            image.src = CONFIG.defaultAvatar;
        };

        image.src =
            source ||
            CONFIG.defaultAvatar;

        image.alt = alt || "User profile";
    }

    /* ============================================================
       COMMUNITY LOADING
       ============================================================ */

    async function loadCommunities() {

        if (state.loadingCommunities) {
            return;
        }

        state.loadingCommunities = true;

        try {

            const {
                data,
                error
            } = await state.supabase
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

                console.error(
                    "Community loading failed:",
                    error
                );

                showError(
                    "Unable to load communities."
                );

                state.communities = [];

                return;
            }

            state.communities = Array.isArray(data)
                ? data
                : [];

            console.log(
                `Communities loaded: ${state.communities.length}`
            );

        } catch (error) {

            console.error(
                "Community loading exception:",
                error
            );

            state.communities = [];

        } finally {

            state.loadingCommunities = false;
        }
    }

    /* ============================================================
       CHANNEL LOADING
       ============================================================ */

    async function loadChannels(communityId) {

        if (!communityId) {
            state.channels = [];
            return;
        }

        state.loadingChannels = true;

        renderChannelLoading();

        try {

            const {
                data,
                error
            } = await state.supabase
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

                console.error(
                    "Channel loading failed:",
                    error
                );

                state.channels = [];

                showChannelError();

                return;
            }

            state.channels = Array.isArray(data)
                ? data
                : [];

            /*
             * Always make sure General appears first.
             * We do not create a database row automatically here,
             * because channel creation requires the correct
             * Supabase permissions.
             */
            state.channels.sort(
                sortChannels
            );

            console.log(
                `Channels loaded: ${state.channels.length}`
            );

            renderChannels();

        } catch (error) {

            console.error(
                "Channel loading exception:",
                error
            );

            state.channels = [];

            showChannelError();

        } finally {

            state.loadingChannels = false;
        }
    }

    function sortChannels(a, b) {

        const aGeneral =
            isGeneralChannel(a);

        const bGeneral =
            isGeneralChannel(b);

        if (aGeneral && !bGeneral) {
            return -1;
        }

        if (!aGeneral && bGeneral) {
            return 1;
        }

        const aPosition =
            Number.isFinite(Number(a.position))
                ? Number(a.position)
                : 999999;

        const bPosition =
            Number.isFinite(Number(b.position))
                ? Number(b.position)
                : 999999;

        if (aPosition !== bPosition) {
            return aPosition - bPosition;
        }

        return String(a.name || "")
            .localeCompare(
                String(b.name || "")
            );
    }

    function isGeneralChannel(channel) {

        if (!channel) {
            return false;
        }

        const name =
            String(channel.name || "")
                .trim()
                .toLowerCase();

        const slug =
            String(channel.slug || "")
                .trim()
                .toLowerCase();

        return (
            name === "general" ||
            slug === "general" ||
            name === "# general" ||
            slug === "#-general"
        );
    }

    /* ============================================================
       INITIAL COMMUNITY
       ============================================================ */

    async function selectInitialCommunity() {

        /*
         * If there are no DB communities, still display
         * Mwaniki General.
         */
        if (!state.communities.length) {

            state.selectedCommunity = null;

            renderCommunitySelector();

            renderChannels();

            renderWelcomeState();

            return;
        }

        const storedCommunity =
            localStorage.getItem(
                "mwanikiSelectedCommunity"
            );

        let selected =
            state.communities.find(
                community =>
                    String(community.id) ===
                    String(storedCommunity)
            );

        if (!selected) {
            selected = state.communities[0];
        }

        await selectCommunity(
            selected,
            false
        );
    }

    /* ============================================================
       SELECT COMMUNITY
       ============================================================ */

    async function selectCommunity(
        community,
        announceSelection = true
    ) {

        if (!community) {
            return;
        }

        state.selectedCommunity =
            community;

        localStorage.setItem(
            "mwanikiSelectedCommunity",
            String(community.id)
        );

        state.selectedChannel = null;

        state.messages = [];

        renderCommunitySelector();

        renderCommunityRail();

        renderCommunityModal();

        await loadChannels(
            community.id
        );

        const generalChannel =
            state.channels.find(
                isGeneralChannel
            );

        const firstChannel =
            generalChannel ||
            state.channels[0];

        if (firstChannel) {

            await selectChannel(
                firstChannel,
                announceSelection
            );

        } else {

            updateMainChannelHeader(
                null
            );

            renderEmptyChannels();

            renderWelcomeState();

            if (announceSelection) {

                announce(
                    `${community.name} selected. No channels are available.`
                );
            }
        }

        closeCommunityModal();
    }

    /* ============================================================
       SELECT CHANNEL
       ============================================================ */

    async function selectChannel(
        channel,
        announceSelection = true
    ) {

        if (!channel) {
            return;
        }

        state.selectedChannel =
            channel;

        localStorage.setItem(
            "mwanikiSelectedChannel",
            String(channel.id)
        );

        updateMainChannelHeader(
            channel
        );

        renderChannels();

        await loadMessages(
            channel.id
        );

        if (announceSelection) {

            announce(
                `${getChannelLabel(channel)} selected.`
            );
        }

        scrollMessagesToBottom();
    }

    /* ============================================================
       COMMUNITY SELECTOR
       ============================================================ */

    function renderCommunitySelector() {

        const community =
            state.selectedCommunity;

        if (!community) {

            if (dom.selectedCommunityIcon) {
                dom.selectedCommunityIcon.textContent =
                    "MS";
            }

            if (dom.selectedCommunityName) {
                dom.selectedCommunityName.textContent =
                    "Mwaniki Scholars";
            }

            if (dom.selectedCommunityDescription) {
                dom.selectedCommunityDescription.textContent =
                    "Main community";
            }

            return;
        }

        renderIcon(
            dom.selectedCommunityIcon,
            community.icon_url,
            community.name
        );

        if (dom.selectedCommunityName) {

            dom.selectedCommunityName.textContent =
                community.name ||
                "Community";
        }

        if (dom.selectedCommunityDescription) {

            dom.selectedCommunityDescription.textContent =
                community.description ||
                "Community";
        }
    }

    /* ============================================================
       COMMUNITY RAIL
       ============================================================ */

    function renderCommunityRail() {

        const container =
            dom.communityRailList;

        if (!container) {
            return;
        }

        container.innerHTML = "";

        state.communities.forEach(
            (community) => {

                const button =
                    document.createElement(
                        "button"
                    );

                button.type = "button";

                button.className =
                    "rail-community-icon";

                button.dataset.communityId =
                    community.id;

                button.title =
                    community.name ||
                    "Community";

                button.setAttribute(
                    "aria-label",
                    `Open ${community.name || "community"}`
                );

                const active =
                    state.selectedCommunity &&
                    String(
                        state.selectedCommunity.id
                    ) === String(community.id);

                if (active) {

                    button.classList.add(
                        "active"
                    );

                    button.setAttribute(
                        "aria-current",
                        "page"
                    );
                }

                renderIconContent(
                    button,
                    community.icon_url,
                    community.name
                );

                button.addEventListener(
                    "click",
                    async () => {

                        await selectCommunity(
                            community
                        );
                    }
                );

                container.appendChild(
                    button
                );
            }
        );
    }

    /* ============================================================
       CHANNEL RENDERING
       ============================================================ */

    function renderChannels() {

        const container =
            dom.channelList;

        if (!container) {
            return;
        }

        container.innerHTML = "";

        const filtered =
            filterChannels(
                state.channels,
                state.channelSearch
            );

        if (!filtered.length) {

            renderEmptyChannels();

            return;
        }

        const grouped =
            groupChannels(filtered);

        Object.entries(grouped)
            .forEach(
                ([category, channels]) => {

                    const section =
                        document.createElement(
                            "section"
                        );

                    section.className =
                        "channel-section";

                    const heading =
                        document.createElement(
                            "div"
                        );

                    heading.className =
                        "channel-section-title";

                    heading.textContent =
                        category;

                    section.appendChild(
                        heading
                    );

                    channels.forEach(
                        channel => {

                            const button =
                                createChannelButton(
                                    channel
                                );

                            section.appendChild(
                                button
                            );
                        }
                    );

                    container.appendChild(
                        section
                    );
                }
            );
    }

    function filterChannels(
        channels,
        query
    ) {

        const clean =
            String(query || "")
                .trim()
                .toLowerCase();

        if (!clean) {
            return [...channels];
        }

        return channels.filter(
            channel => {

                const name =
                    String(channel.name || "")
                        .toLowerCase();

                const description =
                    String(
                        channel.description || ""
                    )
                    .toLowerCase();

                const category =
                    String(
                        channel.channel_type || ""
                    )
                    .toLowerCase();

                return (
                    name.includes(clean) ||
                    description.includes(clean) ||
                    category.includes(clean)
                );
            }
        );
    }

    function groupChannels(channels) {

        const groups = {};

        channels.forEach(
            channel => {

                let category =
                    channel.channel_type ||
                    "Channels";

                category =
                    String(category)
                        .trim();

                if (!category) {
                    category = "Channels";
                }

                /*
                 * Normalise common channel types.
                 */
                if (
                    category.toLowerCase() ===
                    "text"
                ) {
                    category = "Text Channels";
                }

                if (
                    category.toLowerCase() ===
                    "voice"
                ) {
                    category = "Voice";
                }

                if (!groups[category]) {
                    groups[category] = [];
                }

                groups[category].push(
                    channel
                );
            }
        );

        /*
         * General should always be shown first.
         */
        const result = {};

        Object.entries(groups)
            .forEach(
                ([category, channels]) => {

                    channels.sort(
                        sortChannels
                    );

                    result[category] =
                        channels;
                }
            );

        return result;
    }

    function createChannelButton(
        channel
    ) {

        const button =
            document.createElement(
                "button"
            );

        button.type = "button";

        button.className =
            "channel-item";

        button.dataset.channelId =
            channel.id;

        const selected =
            state.selectedChannel &&
            String(
                state.selectedChannel.id
            ) === String(channel.id);

        if (selected) {
            button.classList.add("active");

            button.setAttribute(
                "aria-current",
                "page"
            );
        }

        const icon =
            document.createElement("span");

        icon.className =
            "channel-icon";

        icon.textContent =
            getChannelIcon(channel);

        const name =
            document.createElement("span");

        name.className =
            "channel-name";

        name.textContent =
            channel.name ||
            "General";

        button.appendChild(icon);
        button.appendChild(name);

        button.setAttribute(
            "aria-label",
            `Open ${getChannelLabel(channel)}`
        );

        button.addEventListener(
            "click",
            async () => {

                await selectChannel(
                    channel
                );
            }
        );

        return button;
    }

    function getChannelIcon(channel) {

        if (isGeneralChannel(channel)) {
            return "💬";
        }

        const type =
            String(
                channel.channel_type || ""
            ).toLowerCase();

        if (
            type.includes("voice") ||
            type.includes("call")
        ) {
            return "🔊";
        }

        if (
            type.includes("announcement")
        ) {
            return "📢";
        }

        if (
            type.includes("study")
        ) {
            return "📚";
        }

        if (
            type.includes("course")
        ) {
            return "🎓";
        }

        return (
            channel.icon ||
            "#"
        );
    }

    function getChannelLabel(channel) {

        if (!channel) {
            return "channel";
        }

        return (
            "#" +
            String(
                channel.name ||
                "general"
            )
            .replace(/^#\s*/, "")
        );
    }

    /* ============================================================
       MAIN HEADER
       ============================================================ */

    function updateMainChannelHeader(
        channel
    ) {

        if (!channel) {

            if (dom.mainChannelTitle) {
                dom.mainChannelTitle.textContent =
                    "# General";
            }

            if (dom.mainChannelDescription) {
                dom.mainChannelDescription.textContent =
                    "Mwaniki Scholars general discussion";
            }

            return;
        }

        if (dom.mainChannelTitle) {

            dom.mainChannelTitle.textContent =
                getChannelLabel(channel);
        }

        if (dom.mainChannelDescription) {

            dom.mainChannelDescription.textContent =
                channel.description ||
                (
                    state.selectedCommunity
                        ? state.selectedCommunity.name
                        : "Mwaniki Scholars"
                );
        }
    }

    /* ============================================================
       MESSAGE LOADING
       ============================================================ */

    async function loadMessages(
        channelId
    ) {

        if (!channelId) {

            renderWelcomeState();

            return;
        }

        state.loadingMessages = true;

        renderMessageLoading();

        try {

            const {
                data,
                error
            } = await state.supabase
                .from("chat_messages")
                .select(`
                    id,
                    channel_id,
                    user_id,
                    content,
                    reply_to,
                    created_at
                `)
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
                .limit(500);

            if (error) {

                console.error(
                    "Message loading failed:",
                    error
                );

                state.messages = [];

                renderMessageError();

                return;
            }

            state.messages =
                Array.isArray(data)
                    ? data
                    : [];

            /*
             * Load profiles separately.
             * This avoids relying on an uncertain foreign-key
             * relationship between chat_messages and students.
             */
            await attachMessageProfiles();

            renderMessages();

        } catch (error) {

            console.error(
                "Message loading exception:",
                error
            );

            state.messages = [];

            renderMessageError();

        } finally {

            state.loadingMessages = false;
        }
    }

    /* ============================================================
       MESSAGE PROFILES
       ============================================================ */

    async function attachMessageProfiles() {

        if (!state.messages.length) {
            return;
        }

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

        try {

            const {
                data,
                error
            } = await state.supabase
                .from("students")
                .select(`
                    id,
                    full_name,
                    name,
                    student_name,
                    photo_url
                `)
                .in(
                    "id",
                    ids
                );

            if (error) {

                console.warn(
                    "Message profile query failed:",
                    error
                );

                return;
            }

            const profileMap =
                new Map();

            (data || []).forEach(
                profile => {

                    profileMap.set(
                        String(profile.id),
                        profile
                    );
                }
            );

            state.messages =
                state.messages.map(
                    message => {

                        const profile =
                            profileMap.get(
                                String(
                                    message.user_id
                                )
                            );

                        return {
                            ...message,
                            profile:
                                profile || null
                        };
                    }
                );

        } catch (error) {

            console.warn(
                "Could not attach profiles:",
                error
            );
        }
    }

    /* ============================================================
       MESSAGE RENDERING
       ============================================================ */

    function renderMessages() {

        const container =
            dom.messageList;

        if (!container) {
            return;
        }

        container.innerHTML = "";

        if (!state.messages.length) {

            renderWelcomeState();

            return;
        }

        state.messages.forEach(
            message => {

                const element =
                    createMessageElement(
                        message
                    );

                container.appendChild(
                    element
                );
            }
        );

        scrollMessagesToBottom();
    }

    function createMessageElement(
        message
    ) {

        const article =
            document.createElement(
                "article"
            );

        article.className =
            "message";

        article.dataset.messageId =
            message.id;

        const avatar =
            document.createElement(
                "img"
            );

        avatar.className =
            "message-avatar";

        const profile =
            message.profile;

        const author =
            getProfileName(
                profile
            );

        const photo =
            getProfilePhoto(
                profile
            );

        setImage(
            avatar,
            photo,
            `${author} profile photo`
        );

        const content =
            document.createElement(
                "div"
            );

        content.className =
            "message-content";

        const header =
            document.createElement(
                "div"
            );

        header.className =
            "message-header";

        const authorElement =
            document.createElement(
                "span"
            );

        authorElement.className =
            "message-author";

        authorElement.textContent =
            author;

        const time =
            document.createElement(
                "time"
            );

        time.className =
            "message-time";

        time.dateTime =
            message.created_at || "";

        time.textContent =
            formatMessageTime(
                message.created_at
            );

        header.appendChild(
            authorElement
        );

        header.appendChild(
            time
        );

        const text =
            document.createElement(
                "div"
            );

        text.className =
            "message-text";

        /*
         * textContent is intentional.
         * Never inject user messages with innerHTML.
         */
        text.textContent =
            message.content || "";

        content.appendChild(
            header
        );

        content.appendChild(
            text
        );

        article.appendChild(
            avatar
        );

        article.appendChild(
            content
        );

        return article;
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

        return date.toLocaleString(
            [],
            {
                hour: "numeric",
                minute: "2-digit",
                month: "short",
                day: "numeric"
            }
        );
    }

    /* ============================================================
       SEND MESSAGE
       ============================================================ */

    async function sendMessage() {

        if (state.sendingMessage) {
            return;
        }

        if (!state.user) {

            announce(
                "Please sign in before sending messages."
            );

            return;
        }

        if (!state.selectedChannel) {

            announce(
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
                input.value || ""
            ).trim();

        if (!content) {
            return;
        }

        state.sendingMessage = true;

        if (dom.sendMessageButton) {
            dom.sendMessageButton.disabled = true;
        }

        try {

            const payload = {
                channel_id:
                    state.selectedChannel.id,

                user_id:
                    state.user.id,

                content
            };

            const {
                data,
                error
            } = await state.supabase
                .from("chat_messages")
                .insert(payload)
                .select(`
                    id,
                    channel_id,
                    user_id,
                    content,
                    reply_to,
                    created_at
                `)
                .single();

            if (error) {

                console.error(
                    "Message sending failed:",
                    error
                );

                announce(
                    "Message could not be sent."
                );

                return;
            }

            input.value = "";

            autoResizeTextarea();

            /*
             * Realtime normally inserts this message.
             * If realtime is unavailable, render immediately.
             */
            if (data) {

                const alreadyExists =
                    state.messages.some(
                        message =>
                            String(message.id) ===
                            String(data.id)
                    );

                if (!alreadyExists) {

                    data.profile =
                        state.profile;

                    state.messages.push(
                        data
                    );

                    renderMessages();
                }
            }

            announce(
                "Message sent."
            );

        } catch (error) {

            console.error(
                "Message sending exception:",
                error
            );

            announce(
                "Message could not be sent."
            );

        } finally {

            state.sendingMessage = false;

            if (dom.sendMessageButton) {
                dom.sendMessageButton.disabled = false;
            }

            input.focus();
        }
    }

    /* ============================================================
       REALTIME
       ============================================================ */

    function setupRealtime() {

        if (!state.supabase) {
            return;
        }

        setupMessageRealtime();

        setupPresenceRealtime();
    }

    function setupMessageRealtime() {

        if (state.realtimeChannel) {

            try {
                state.supabase.removeChannel(
                    state.realtimeChannel
                );
            } catch (_) {}
        }

        state.realtimeChannel =
            state.supabase
                .channel(
                    "mwaniki-community-messages"
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "chat_messages"
                    },
                    async payload => {

                        const message =
                            payload.new;

                        if (!message) {
                            return;
                        }

                        if (
                            !state.selectedChannel ||
                            String(
                                message.channel_id
                            ) !==
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

                        if (exists) {
                            return;
                        }

                        await attachSingleMessageProfile(
                            message
                        );

                        state.messages.push(
                            message
                        );

                        renderMessages();

                        announce(
                            `New message from ${getProfileName(message.profile)}.`
                        );
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
    }

    async function attachSingleMessageProfile(
        message
    ) {

        if (!message?.user_id) {
            return;
        }

        if (
            state.user &&
            String(message.user_id) ===
            String(state.user.id)
        ) {
            message.profile =
                state.profile;

            return;
        }

        try {

            const {
                data
            } = await state.supabase
                .from("students")
                .select(`
                    id,
                    full_name,
                    name,
                    student_name,
                    photo_url
                `)
                .eq(
                    "id",
                    message.user_id
                )
                .maybeSingle();

            message.profile =
                data || null;

        } catch (_) {

            message.profile =
                null;
        }
    }

    /* ============================================================
       PRESENCE
       ============================================================ */

    async function updatePresence() {

        if (!state.user) {
            return;
        }

        try {

            const now =
                new Date().toISOString();

            const {
                error
            } = await state.supabase
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

                return;
            }

            console.log(
                "Presence updated: online"
            );

        } catch (error) {

            console.warn(
                "Presence exception:",
                error
            );
        }
    }

    function setupPresenceRealtime() {

        if (!state.user) {
            return;
        }

        if (state.presenceChannel) {

            try {
                state.supabase.removeChannel(
                    state.presenceChannel
                );
            } catch (_) {}
        }

        state.presenceChannel =
            state.supabase
                .channel(
                    "mwaniki-student-presence"
                )
                .on(
                    "presence",
                    {
                        event: "sync"
                    },
                    () => {

                        /*
                         * Presence is available here for future
                         * member-list functionality.
                         */
                    }
                )
                .subscribe(
                    async status => {

                        if (
                            status ===
                            "SUBSCRIBED"
                        ) {

                            try {

                                await state.presenceChannel
                                    .track({
                                        user_id:
                                            state.user.id,

                                        online_at:
                                            new Date().toISOString()
                                    });

                            } catch (error) {

                                console.warn(
                                    "Presence tracking failed:",
                                    error
                                );
                            }
                        }
                    }
                );
    }

    /* ============================================================
       COMMUNITY MODAL
       ============================================================ */

    function openCommunityModal() {

        if (!dom.communityModal) {
            return;
        }

        state.modalPreviouslyFocused =
            document.activeElement;

        renderCommunityModal();

        dom.communityModal.classList.add(
            "open"
        );

        dom.communityModal.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.classList.add(
            "modal-open"
        );

        const firstButton =
            dom.communityChoiceList?.querySelector(
                "button"
            );

        if (firstButton) {
            firstButton.focus();
        }

        announce(
            "Community chooser opened."
        );
    }

    function closeCommunityModal() {

        if (!dom.communityModal) {
            return;
        }

        dom.communityModal.classList.remove(
            "open"
        );

        dom.communityModal.setAttribute(
            "aria-hidden",
            "true"
        );

        document.body.classList.remove(
            "modal-open"
        );

        if (
            state.modalPreviouslyFocused &&
            typeof state.modalPreviouslyFocused.focus ===
            "function"
        ) {

            try {
                state.modalPreviouslyFocused.focus();
            } catch (_) {}
        }

        state.modalPreviouslyFocused =
            null;
    }

    function renderCommunityModal() {

        const container =
            dom.communityChoiceList;

        if (!container) {
            return;
        }

        container.innerHTML = "";

        const query =
            state.communitySearch
                .trim()
                .toLowerCase();

        const communities =
            state.communities.filter(
                community => {

                    if (!query) {
                        return true;
                    }

                    const name =
                        String(
                            community.name || ""
                        )
                        .toLowerCase();

                    const description =
                        String(
                            community.description || ""
                        )
                        .toLowerCase();

                    return (
                        name.includes(query) ||
                        description.includes(query)
                    );
                }
            );

        if (!communities.length) {

            const empty =
                document.createElement(
                    "div"
                );

            empty.className =
                "center-state";

            empty.textContent =
                "No communities found.";

            container.appendChild(
                empty
            );

            return;
        }

        communities.forEach(
            community => {

                const button =
                    document.createElement(
                        "button"
                    );

                button.type = "button";

                button.className =
                    "community-choice";

                button.dataset.communityId =
                    community.id;

                button.setAttribute(
                    "aria-label",
                    `Select ${community.name || "community"}`
                );

                const icon =
                    document.createElement(
                        "div"
                    );

                icon.className =
                    "community-choice-icon";

                renderIconContent(
                    icon,
                    community.icon_url,
                    community.name
                );

                const info =
                    document.createElement(
                        "div"
                    );

                info.className =
                    "community-choice-info";

                const name =
                    document.createElement(
                        "div"
                    );

                name.className =
                    "community-choice-name";

                name.textContent =
                    community.name ||
                    "Community";

                const description =
                    document.createElement(
                        "div"
                    );

                description.className =
                    "community-choice-description";

                description.textContent =
                    community.description ||
                    "Mwaniki Scholars community";

                info.appendChild(
                    name
                );

                info.appendChild(
                    description
                );

                button.appendChild(
                    icon
                );

                button.appendChild(
                    info
                );

                button.addEventListener(
                    "click",
                    async () => {

                        await selectCommunity(
                            community
                        );
                    }
                );

                container.appendChild(
                    button
                );
            }
        );
    }

    /* ============================================================
       ICON RENDERING
       ============================================================ */

    function renderIcon(
        container,
        iconValue,
        communityName
    ) {

        if (!container) {
            return;
        }

        container.innerHTML = "";

        renderIconContent(
            container,
            iconValue,
            communityName
        );
    }

    function renderIconContent(
        container,
        iconValue,
        name
    ) {

        if (!container) {
            return;
        }

        container.innerHTML = "";

        const value =
            String(iconValue || "")
                .trim();

        /*
         * IMPORTANT:
         * Emoji values such as 🎮 or 😂 must NOT be put
         * into <img src="">.
         *
         * This fixes the previous 404 errors.
         */
        if (
            value &&
            !looksLikeImageUrl(value)
        ) {

            const span =
                document.createElement(
                    "span"
                );

            span.textContent =
                value;

            span.setAttribute(
                "aria-hidden",
                "true"
            );

            container.appendChild(
                span
            );

            return;
        }

        if (value) {

            const image =
                document.createElement(
                    "img"
                );

            image.alt =
                `${name || "Community"} icon`;

            image.src =
                value;

            image.loading =
                "lazy";

            image.onerror = () => {

                image.remove();

                const fallback =
                    document.createElement(
                        "span"
                    );

                fallback.textContent =
                    getCommunityInitials(
                        name
                    );

                container.appendChild(
                    fallback
                );
            };

            container.appendChild(
                image
            );

            return;
        }

        const fallback =
            document.createElement(
                "span"
            );

        fallback.textContent =
            getCommunityInitials(
                name
            );

        container.appendChild(
            fallback
        );
    }

    function looksLikeImageUrl(
        value
    ) {

        return (
            /^https?:\/\//i.test(value) ||
            /^data:image\//i.test(value) ||
            /^blob:/i.test(value) ||
            value.startsWith("/") ||
            value.startsWith("./") ||
            value.startsWith("../")
        );
    }

    function getCommunityInitials(
        name
    ) {

        const text =
            String(
                name ||
                "MS"
            )
            .trim();

        if (!text) {
            return "MS";
        }

        const words =
            text
                .split(/\s+/)
                .filter(Boolean);

        if (words.length === 1) {

            return words[0]
                .slice(0, 2)
                .toUpperCase();
        }

        return (
            words[0][0] +
            words[1][0]
        ).toUpperCase();
    }

    /* ============================================================
       SEARCH
       ============================================================ */

    function handleChannelSearch() {

        state.channelSearch =
            dom.channelSearchInput?.value ||
            "";

        renderChannels();
    }

    /* ============================================================
       TEXTAREA
       ============================================================ */

    function autoResizeTextarea() {

        const textarea =
            dom.messageInput;

        if (!textarea) {
            return;
        }

        textarea.style.height =
            "auto";

        textarea.style.height =
            `${Math.min(
                textarea.scrollHeight,
                130
            )}px`;
    }

    function handleMessageKeydown(
        event
    ) {

        /*
         * Enter sends.
         * Shift + Enter creates a new line.
         */
        if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.isComposing
        ) {

            event.preventDefault();

            sendMessage();
        }
    }

    /* ============================================================
       EMOJI BUTTON
       ============================================================ */

    function insertEmoji() {

        const input =
            dom.messageInput;

        if (!input) {
            return;
        }

        const emoji =
            "🙂";

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
            start + emoji.length;

        input.setSelectionRange(
            position,
            position
        );

        autoResizeTextarea();
    }

    /* ============================================================
       ATTACHMENT BUTTON
       ============================================================ */

    function handleAttachment() {

        announce(
            "Attachment support can be connected to the chat attachments storage."
        );
    }

    /* ============================================================
       DASHBOARD NAVIGATION
       ============================================================ */

    function goToDashboard() {

        window.location.href =
            CONFIG.dashboardUrl;
    }

    /* ============================================================
       PROFILE NAVIGATION
       ============================================================ */

    function openProfile() {

        window.location.href =
            "./profile.html";
    }

    /* ============================================================
       EVENTS
       ============================================================ */

    function bindEvents() {

        /* Dashboard */
        dom.homeButton?.addEventListener(
            "click",
            goToDashboard
        );

        dom.dashboardButton?.addEventListener(
            "click",
            goToDashboard
        );

        dom.railHomeButton?.addEventListener(
            "click",
            goToDashboard
        );

        /* Profile */
        dom.railProfileButton?.addEventListener(
            "click",
            openProfile
        );

        /* Community selector */
        dom.openCommunityButton?.addEventListener(
            "click",
            openCommunityModal
        );

        dom.communitySelectorButton?.addEventListener(
            "click",
            openCommunityModal
        );

        dom.headerCommunityButton?.addEventListener(
            "click",
            openCommunityModal
        );

        /* General */
        dom.railGeneralButton?.addEventListener(
            "click",
            async () => {

                await showMwanikiGeneral();
            }
        );

        /* Modal */
        dom.closeCommunityModal?.addEventListener(
            "click",
            closeCommunityModal
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

        /* Search */
        dom.channelSearchInput?.addEventListener(
            "input",
            handleChannelSearch
        );

        /* Message */
        dom.sendMessageButton?.addEventListener(
            "click",
            sendMessage
        );

        dom.messageInput?.addEventListener(
            "keydown",
            handleMessageKeydown
        );

        dom.messageInput?.addEventListener(
            "input",
            autoResizeTextarea
        );

        /* Emoji */
        dom.emojiButton?.addEventListener(
            "click",
            insertEmoji
        );

        /* Attachment */
        dom.attachButton?.addEventListener(
            "click",
            handleAttachment
        );

        /* Start conversation */
        dom.startConversationButton?.addEventListener(
            "click",
            focusMessageInput
        );

        dom.welcomeStartButton?.addEventListener(
            "click",
            focusMessageInput
        );

        /* Global keyboard */
        document.addEventListener(
            "keydown",
            handleGlobalKeyboard
        );

        /* Window visibility */
        document.addEventListener(
            "visibilitychange",
            async () => {

                if (
                    !document.hidden
                ) {
                    await updatePresence();
                }
            }
        );

        /* Before leaving */
        window.addEventListener(
            "beforeunload",
            () => {

                setOfflinePresence();
            }
        );
    }

    /* ============================================================
       MWANIKI GLOBAL GENERAL
       ============================================================ */

    async function showMwanikiGeneral() {

        state.selectedCommunity =
            null;

        state.selectedChannel =
            null;

        state.messages = [];

        localStorage.removeItem(
            "mwanikiSelectedCommunity"
        );

        localStorage.removeItem(
            "mwanikiSelectedChannel"
        );

        renderCommunitySelector();

        renderCommunityRail();

        updateMainChannelHeader(
            null
        );

        renderGlobalGeneral();

        announce(
            "Mwaniki Scholars General opened."
        );
    }

    function renderGlobalGeneral() {

        const container =
            dom.messageList;

        if (!container) {
            return;
        }

        container.innerHTML = "";

        const card =
            document.createElement(
                "div"
            );

        card.className =
            "welcome-card";

        const icon =
            document.createElement(
                "div"
            );

        icon.className =
            "welcome-icon";

        icon.textContent =
            "💬";

        const title =
            document.createElement(
                "h2"
            );

        title.textContent =
            "Mwaniki Scholars General";

        const paragraph =
            document.createElement(
                "p"
            );

        paragraph.textContent =
            "Welcome to the main Mwaniki Scholars community space. Select a community to explore its channels.";

        const button =
            document.createElement(
                "button"
            );

        button.type =
            "button";

        button.className =
            "header-action primary";

        button.textContent =
            "Choose Community";

        button.addEventListener(
            "click",
            openCommunityModal
        );

        card.appendChild(
            icon
        );

        card.appendChild(
            title
        );

        card.appendChild(
            paragraph
        );

        card.appendChild(
            button
        );

        container.appendChild(
            card
        );

        renderEmptyChannels();
    }

    /* ============================================================
       WELCOME STATE
       ============================================================ */

    function renderWelcomeState() {

        const container =
            dom.messageList;

        if (!container) {
            return;
        }

        container.innerHTML = "";

        const card =
            document.createElement(
                "div"
            );

        card.className =
            "welcome-card";

        const icon =
            document.createElement(
                "div"
            );

        icon.className =
            "welcome-icon";

        icon.textContent =
            "💬";

        const title =
            document.createElement(
                "h2"
            );

        title.textContent =
            state.selectedChannel
                ? `Welcome to ${getChannelLabel(state.selectedChannel)}`
                : "Welcome to Mwaniki Scholars";

        const paragraph =
            document.createElement(
                "p"
            );

        paragraph.textContent =
            state.selectedChannel
                ? "This channel has no messages yet. Start the conversation."
                : "Select a community and channel to start learning and discussing together.";

        const button =
            document.createElement(
                "button"
            );

        button.type =
            "button";

        button.className =
            "header-action primary";

        button.textContent =
            "Start Conversation";

        button.addEventListener(
            "click",
            focusMessageInput
        );

        card.appendChild(
            icon
        );

        card.appendChild(
            title
        );

        card.appendChild(
            paragraph
        );

        card.appendChild(
            button
        );

        container.appendChild(
            card
        );
    }

    /* ============================================================
       LOADING STATES
       ============================================================ */

    function renderChannelLoading() {

        if (!dom.channelList) {
            return;
        }

        dom.channelList.innerHTML = `
            <div class="center-state">
                <div>
                    <div class="loader"></div>
                    Loading channels...
                </div>
            </div>
        `;
    }

    function renderMessageLoading() {

        if (!dom.messageList) {
            return;
        }

        dom.messageList.innerHTML = `
            <div class="center-state">
                <div>
                    <div class="loader"></div>
                    Loading messages...
                </div>
            </div>
        `;
    }

    function showChannelError() {

        if (!dom.channelList) {
            return;
        }

        dom.channelList.innerHTML = "";

        const stateElement =
            document.createElement(
                "div"
            );

        stateElement.className =
            "center-state";

        stateElement.textContent =
            "Unable to load channels.";

        dom.channelList.appendChild(
            stateElement
        );
    }

    function renderEmptyChannels() {

        if (!dom.channelList) {
            return;
        }

        dom.channelList.innerHTML = "";

        const stateElement =
            document.createElement(
                "div"
            );

        stateElement.className =
            "center-state";

        stateElement.textContent =
            "No channels found.";

        dom.channelList.appendChild(
            stateElement
        );
    }

    function renderMessageError() {

        if (!dom.messageList) {
            return;
        }

        dom.messageList.innerHTML = "";

        const stateElement =
            document.createElement(
                "div"
            );

        stateElement.className =
            "center-state";

        stateElement.textContent =
            "Unable to load messages.";

        dom.messageList.appendChild(
            stateElement
        );
    }

    function showError(
        message
    ) {

        console.error(
            "Mwaniki Community:",
            message
        );

        if (dom.messageList) {

            const error =
                document.createElement(
                    "div"
                );

            error.className =
                "center-state";

            error.textContent =
                message;

            dom.messageList.innerHTML = "";

            dom.messageList.appendChild(
                error
            );
        }

        announce(
            message
        );
    }

    /* ============================================================
       MESSAGE SCROLL
       ============================================================ */

    function scrollMessagesToBottom() {

        const container =
            dom.messageList;

        if (!container) {
            return;
        }

        requestAnimationFrame(
            () => {

                container.scrollTop =
                    container.scrollHeight;
            }
        );
    }

    function focusMessageInput() {

        if (!dom.messageInput) {
            return;
        }

        dom.messageInput.focus();

        announce(
            "Message input focused."
        );
    }

    /* ============================================================
       ACCESSIBILITY
       ============================================================ */

    function setupKeyboardAccessibility() {

        /*
         * Ensure important buttons have accessible labels.
         */
        addAria(
            dom.homeButton,
            "Back to Mwaniki Scholars dashboard"
        );

        addAria(
            dom.railHomeButton,
            "Home"
        );

        addAria(
            dom.railGeneralButton,
            "Mwaniki Scholars General"
        );

        addAria(
            dom.openCommunityButton,
            "Choose community"
        );

        addAria(
            dom.communitySelectorButton,
            "Choose community"
        );

        addAria(
            dom.headerCommunityButton,
            "Choose community"
        );

        addAria(
            dom.startConversationButton,
            "Start conversation"
        );

        addAria(
            dom.welcomeStartButton,
            "Start conversation"
        );

        addAria(
            dom.sendMessageButton,
            "Send message"
        );

        /*
         * Escape closes modal.
         */
        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Escape" &&
                    dom.communityModal?.classList.contains(
                        "open"
                    )
                ) {

                    event.preventDefault();

                    closeCommunityModal();
                }
            }
        );

        /*
         * Arrow navigation inside community rail.
         */
        if (dom.communityRailList) {

            dom.communityRailList.addEventListener(
                "keydown",
                handleRailKeyboard
            );
        }

        /*
         * Focus trap.
         */
        dom.communityModal?.addEventListener(
            "keydown",
            handleModalKeyboard
        );
    }

    function handleGlobalKeyboard(
        event
    ) {

        /*
         * Ctrl/Cmd + K opens community selector.
         */
        if (
            (event.ctrlKey ||
                event.metaKey) &&
            event.key.toLowerCase() === "k"
        ) {

            event.preventDefault();

            openCommunityModal();

            return;
        }

        /*
         * "/" focuses channel search unless already typing.
         */
        if (
            event.key === "/" &&
            !isTypingContext(
                event.target
            )
        ) {

            event.preventDefault();

            dom.channelSearchInput?.focus();
        }
    }

    function isTypingContext(
        target
    ) {

        if (!target) {
            return false;
        }

        const tag =
            target.tagName?.toLowerCase();

        return (
            tag === "input" ||
            tag === "textarea" ||
            target.isContentEditable
        );
    }

    function handleRailKeyboard(
        event
    ) {

        const buttons =
            [
                ...dom.communityRailList.querySelectorAll(
                    "button"
                )
            ];

        if (!buttons.length) {
            return;
        }

        const current =
            document.activeElement;

        const index =
            buttons.indexOf(
                current
            );

        if (index < 0) {
            return;
        }

        let nextIndex =
            index;

        if (
            event.key === "ArrowDown" ||
            event.key === "ArrowRight"
        ) {

            nextIndex =
                (index + 1) %
                buttons.length;

        } else if (
            event.key === "ArrowUp" ||
            event.key === "ArrowLeft"
        ) {

            nextIndex =
                (index - 1 + buttons.length) %
                buttons.length;

        } else {
            return;
        }

        event.preventDefault();

        buttons[nextIndex].focus();
    }

    function handleModalKeyboard(
        event
    ) {

        if (
            event.key !== "Tab"
        ) {
            return;
        }

        const focusable =
            [
                ...dom.communityModal.querySelectorAll(
                    "button, input, textarea, select, [tabindex]:not([tabindex='-1'])"
                )
            ]
            .filter(
                element =>
                    !element.disabled &&
                    element.offsetParent !== null
            );

        if (!focusable.length) {
            return;
        }

        const first =
            focusable[0];

        const last =
            focusable[
                focusable.length - 1
            ];

        if (
            event.shiftKey &&
            document.activeElement === first
        ) {

            event.preventDefault();

            last.focus();

        } else if (
            !event.shiftKey &&
            document.activeElement === last
        ) {

            event.preventDefault();

            first.focus();
        }
    }

    function addAria(
        element,
        label
    ) {

        if (!element) {
            return;
        }

        if (
            !element.getAttribute(
                "aria-label"
            )
        ) {

            element.setAttribute(
                "aria-label",
                label
            );
        }
    }

    /* ============================================================
       SCREEN READER ANNOUNCER
       ============================================================ */

    function announce(
        message
    ) {

        let announcer =
            document.getElementById(
                "mwanikiA11yAnnouncer"
            );

        if (!announcer) {

            announcer =
                document.createElement(
                    "div"
                );

            announcer.id =
                "mwanikiA11yAnnouncer";

            announcer.setAttribute(
                "aria-live",
                "polite"
            );

            announcer.setAttribute(
                "aria-atomic",
                "true"
            );

            announcer.style.position =
                "fixed";

            announcer.style.width =
                "1px";

            announcer.style.height =
                "1px";

            announcer.style.padding =
                "0";

            announcer.style.margin =
                "-1px";

            announer.style.overflow =
                "hidden";

            announcer.style.clip =
                "rect(0, 0, 0, 0)";

            announcer.style.whiteSpace =
                "nowrap";

            announcer.style.border =
                "0";

            document.body.appendChild(
                announcer
            );
        }

        announcer.textContent =
            String(message || "");
    }

    /* ============================================================
       OFFLINE PRESENCE
       ============================================================ */

    function setOfflinePresence() {

        if (!state.user) {
            return;
        }

        /*
         * beforeunload cannot reliably await Supabase.
         * Fire the request without blocking the page.
         */
        try {

            state.supabase
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

        } catch (_) {}
    }

    /* ============================================================
       PUBLIC DEBUG API
       ============================================================ */

    window.MwanikiCommunity = {

        state,

        refresh: async () => {

            await loadCommunities();

            renderCommunityRail();

            renderCommunityModal();

            if (
                state.selectedCommunity
            ) {

                await loadChannels(
                    state.selectedCommunity.id
                );
            }
        },

        refreshMessages: async () => {

            if (
                state.selectedChannel
            ) {

                await loadMessages(
                    state.selectedChannel.id
                );
            }
        },

        openCommunitySelector:
            openCommunityModal,

        closeCommunitySelector:
            closeCommunityModal,

        sendMessage
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
            {
                once: true
            }
        );

    } else {

        init();
    }

})();
