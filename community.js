/* ============================================================
   MWANIKI SCHOLARS COMMUNITY
   CLEAN COMMUNITY.JS
   ============================================================

   Matches:
   - community.html
   - supabase.js
   - chat_communities
   - chat_community_members
   - chat_channels
   - chat_channel_members
   - chat_messages
   - chat_attachments
   - chat_message_reactions
   - chat_notifications
   - chat_presence
   - chat_read_status
   - chat_call_rooms
   - chat_call_participants
   - chat_call_signals

   Features:
   - Communities
   - Channels
   - Messages
   - Realtime messages
   - Message deletion
   - Attachments
   - Images/documents
   - Large Unicode emoji picker
   - Community search
   - Channel search
   - General calls
   - Community calls
   - Incoming calls
   - WebRTC audio/video
   - Microphone
   - Camera
   - Screen sharing
   ============================================================ */

(() => {
    "use strict";

    console.log("🚀 Mwaniki Scholars Community starting...");

    /* =========================================================
       CONFIG
       ========================================================= */

    const CONFIG = {
        ATTACHMENT_BUCKET: "chat-attachments",

        MESSAGE_LIMIT: 100,

        STUN_SERVERS: [
            {
                urls: "stun:stun.l.google.com:19302"
            },
            {
                urls: "stun:stun1.l.google.com:19302"
            }
        ],

        MAX_FILE_SIZE: 25 * 1024 * 1024,

        STORAGE_KEYS: {
            COMMUNITY: "mwanikiCommunityId",
            CHANNEL: "mwanikiChannelId"
        }
    };

    /* =========================================================
       STATE
       ========================================================= */

    const state = {
        supabase: null,
        user: null,

        communities: [],
        channels: [],
        members: [],

        currentCommunity: null,
        currentChannel: null,

        messages: [],
        attachments: new Map(),

        communitySearch: "",
        channelSearch: "",

        messageRealtime: null,
        communityRealtime: null,
        attachmentRealtime: null,
        incomingCallRealtime: null,

        pendingFile: null,

        selectedCallUsers: new Set(),

        currentCall: null,

        localStream: null,
        screenStream: null,

        peerConnections: new Map(),

        callRealtime: null,
        callParticipantRealtime: null,

        incomingCall: null,

        callStartedAt: null,
        callTimer: null,

        emojiPicker: null,

        initialized: false
    };

    /* =========================================================
       DOM HELPER
       ========================================================= */

    const $ = (id) => document.getElementById(id);

    const dom = {};

    function cacheDOM() {

        const ids = [
            "communityApp",
            "accessibilityAnnouncer",
            "communityStatus",

            "homeButton",
            "railHomeButton",
            "railGeneralButton",
            "communityRailList",
            "railProfileButton",
            "railProfileAvatar",

            "communityBrandTitle",
            "communityBrandSubtitle",
            "openCommunityButton",
            "channelSearchInput",
            "communitySelectorButton",

            "selectedCommunityIcon",
            "selectedCommunityName",
            "selectedCommunityDescription",

            "channelList",

            "sidebarProfileButton",
            "sidebarProfileAvatar",
            "sidebarProfileName",

            "communityMain",

            "mainChannelTitle",
            "mainChannelDescription",

            "dashboardButton",
            "headerCommunityButton",
            "generalCallButton",
            "startConversationButton",

            "messageList",
            "messageForm",
            "attachButton",
            "emojiButton",
            "messageInput",
            "sendMessageButton",
            "welcomeStartButton",

            "communityModal",
            "closeCommunityModal",
            "communityModalSearch",
            "communityChoiceList",

            "generalCallModal",
            "closeGeneralCallModalButton",
            "generalCallUserList",
            "generalCallUserStatus",
            "generalCallSelectionCount",
            "generalCallMessage",
            "cancelGeneralCallButton",
            "startGeneralCallButton",

            "callOverlay",
            "callTitle",
            "callSubtitle",
            "callDuration",
            "callVideoGrid",
            "localVideoTile",
            "localVideo",
            "callParticipants",

            "toggleMicrophoneButton",
            "toggleCameraButton",
            "shareScreenButton",
            "minimizeCallButton",
            "leaveCallButton",

            "incomingCallToast",
            "incomingCallTitle",
            "incomingCallText",
            "acceptCallButton",
            "declineCallButton"
        ];

        ids.forEach((id) => {
            dom[id] = $(id);
        });
    }

    /* =========================================================
       GENERAL HELPERS
       ========================================================= */

    function announce(message) {

        if (dom.accessibilityAnnouncer) {
            dom.accessibilityAnnouncer.textContent = message;
        }

        if (dom.communityStatus) {
            dom.communityStatus.textContent = message;
        }
    }

    function escapeHTML(value) {

        const div = document.createElement("div");

        div.textContent = value ?? "";

        return div.innerHTML;
    }

    function shortId(id) {

        if (!id) {
            return "Unknown";
        }

        return `${id.slice(0, 6)}…${id.slice(-4)}`;
    }

    function currentUserName() {

        const metadata = state.user?.user_metadata || {};

        return (
            metadata.full_name ||
            metadata.name ||
            metadata.username ||
            state.user?.email?.split("@")[0] ||
            "You"
        );
    }

    function isURL(value) {

        if (!value) {
            return false;
        }

        return /^https?:\/\//i.test(value);
    }

    function safeFileName(name) {

        return String(name || "file")
            .replace(/[^\w.\-() ]+/g, "_")
            .replace(/\s+/g, "_")
            .slice(0, 180);
    }

    function formatDate(dateValue) {

        if (!dateValue) {
            return "";
        }

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short"
        });
    }

    function formatDuration(seconds) {

        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;

        return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    function getCommunityIcon(community) {

        const name = `${community?.name || ""} ${community?.slug || ""}`.toLowerCase();

        if (name.includes("gaming") || name.includes("game")) {
            return "🎮";
        }

        if (
            name.includes("meme") ||
            name.includes("fun") ||
            name.includes("joke")
        ) {
            return "😂";
        }

        if (
            name.includes("medical") ||
            name.includes("medicine")
        ) {
            return "🩺";
        }

        if (
            name.includes("pharmac")
        ) {
            return "💊";
        }

        if (
            name.includes("laboratory") ||
            name.includes("lab")
        ) {
            return "🧪";
        }

        if (
            name.includes("study") ||
            name.includes("academic")
        ) {
            return "📚";
        }

        if (
            name.includes("general")
        ) {
            return "💬";
        }

        return "🌐";
    }

    function getInitials(name) {

        const words = String(name || "User")
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        if (!words.length) {
            return "U";
        }

        if (words.length === 1) {
            return words[0].slice(0, 2).toUpperCase();
        }

        return (
            words[0][0] +
            words[words.length - 1][0]
        ).toUpperCase();
    }

    function avatarDataURL(name) {

        const initials = getInitials(name);

        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg"
                 width="120"
                 height="120"
                 viewBox="0 0 120 120">

                <rect width="120"
                      height="120"
                      rx="60"
                      fill="#087f73"/>

                <text
                    x="60"
                    y="68"
                    text-anchor="middle"
                    font-size="42"
                    font-family="Arial"
                    fill="white">
                    ${initials}
                </text>

            </svg>
        `;

        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    function setAvatar(imageElement, userName, imageURL) {

        if (!imageElement) {
            return;
        }

        if (imageURL && isURL(imageURL)) {

            imageElement.src = imageURL;

            imageElement.onerror = () => {
                imageElement.src = avatarDataURL(userName);
            };

            return;
        }

        imageElement.src = avatarDataURL(userName);
    }

    /* =========================================================
       SUPABASE WAIT
       ========================================================= */

    async function waitForSupabase(timeout = 15000) {

        const started = Date.now();

        while (!window.supabase) {

            if (Date.now() - started > timeout) {
                throw new Error(
                    "Supabase client was not available."
                );
            }

            await new Promise((resolve) =>
                setTimeout(resolve, 100)
            );
        }

        state.supabase = window.supabase;

        console.log("✅ Supabase client ready");
    }

    /* =========================================================
       AUTH
       ========================================================= */

    async function loadAuthenticatedUser() {

        const {
            data,
            error
        } = await state.supabase.auth.getUser();

        if (error) {
            throw error;
        }

        if (!data?.user) {

            announce(
                "You must sign in before using the community."
            );

            return false;
        }

        state.user = data.user;

        console.log(
            "✅ Authenticated as:",
            state.user.id
        );

        return true;
    }

    function setupAuthListener() {

        state.supabase.auth.onAuthStateChange(
            (event, session) => {

                console.log(
                    "Community auth:",
                    event
                );

                if (
                    event === "SIGNED_OUT" ||
                    !session?.user
                ) {
                    state.user = null;
                }

            }
        );
    }

    /* =========================================================
       PROFILE
       ========================================================= */

    function setupProfileUI() {

        const name = currentUserName();

        const imageURL =
            state.user?.user_metadata?.avatar_url ||
            state.user?.user_metadata?.picture ||
            "";

        setAvatar(
            dom.sidebarProfileAvatar,
            name,
            imageURL
        );

        setAvatar(
            dom.railProfileAvatar,
            name,
            imageURL
        );

        if (dom.sidebarProfileName) {
            dom.sidebarProfileName.textContent = name;
        }
    }

    /* =========================================================
       COMMUNITY LOADING
       ========================================================= */

    async function loadCommunities() {

        const publicResult =
            await state.supabase
                .from("chat_communities")
                .select("*")
                .eq("is_active", true)
                .order("name", {
                    ascending: true
                });

        if (publicResult.error) {
            throw publicResult.error;
        }

        let communities = publicResult.data || [];

        /*
         * Also try to include communities where
         * the current user is a member.
         */

        const memberResult =
            await state.supabase
                .from("chat_community_members")
                .select("community_id")
                .eq("user_id", state.user.id);

        if (!memberResult.error && memberResult.data?.length) {

            const ids = [
                ...new Set(
                    memberResult.data.map(
                        row => row.community_id
                    )
                )
            ];

            const existing = new Set(
                communities.map(
                    community => community.id
                )
            );

            const missingIds = ids.filter(
                id => !existing.has(id)
            );

            if (missingIds.length) {

                const privateResult =
                    await state.supabase
                        .from("chat_communities")
                        .select("*")
                        .in("id", missingIds)
                        .eq("is_active", true);

                if (!privateResult.error) {

                    communities = [
                        ...communities,
                        ...(privateResult.data || [])
                    ];
                }
            }
        }

        state.communities = communities;

        renderCommunityRail();
        renderCommunityModal();

        if (!communities.length) {

            announce(
                "No active communities were found."
            );

            return;
        }

        const savedId =
            localStorage.getItem(
                CONFIG.STORAGE_KEYS.COMMUNITY
            );

        const savedCommunity =
            communities.find(
                community => community.id === savedId
            );

        await selectCommunity(
            savedCommunity || communities[0]
        );
    }

    /* =========================================================
       COMMUNITY RAIL
       ========================================================= */

    function createCommunityIconElement(community) {

        const wrapper =
            document.createElement("span");

        wrapper.className =
            "community-rail-icon";

        const iconURL = community.icon_url;

        if (isURL(iconURL)) {

            const img =
                document.createElement("img");

            img.src = iconURL;
            img.alt = community.name || "Community";

            img.onerror = () => {
                img.remove();
                wrapper.textContent =
                    getCommunityIcon(community);
            };

            wrapper.appendChild(img);

        } else {

            wrapper.textContent =
                iconURL ||
                getCommunityIcon(community);
        }

        return wrapper;
    }

    function renderCommunityRail() {

        if (!dom.communityRailList) {
            return;
        }

        dom.communityRailList.innerHTML = "";

        state.communities.forEach(
            community => {

                const button =
                    document.createElement("button");

                button.type = "button";

                button.className =
                    "community-rail-item";

                button.dataset.communityId =
                    community.id;

                button.title =
                    community.name;

                button.appendChild(
                    createCommunityIconElement(
                        community
                    )
                );

                button.addEventListener(
                    "click",
                    () => selectCommunity(community)
                );

                dom.communityRailList.appendChild(
                    button
                );
            }
        );

        updateActiveCommunityRail();
    }

    function updateActiveCommunityRail() {

        document
            .querySelectorAll(
                ".community-rail-item"
            )
            .forEach(button => {

                button.classList.toggle(
                    "active",
                    button.dataset.communityId ===
                    state.currentCommunity?.id
                );
            });
    }

    /* =========================================================
       COMMUNITY MODAL
       ========================================================= */

    function openCommunityModal() {

        if (!dom.communityModal) {
            return;
        }

        dom.communityModal.removeAttribute(
            "aria-hidden"
        );

        dom.communityModal.classList.add("open");

        if (dom.communityModalSearch) {
            dom.communityModalSearch.focus();
        }

        renderCommunityModal();
    }

    function closeCommunityModal() {

        if (!dom.communityModal) {
            return;
        }

        const active =
            document.activeElement;

        if (
            active &&
            dom.communityModal.contains(active)
        ) {
            active.blur();
        }

        dom.communityModal.classList.remove("open");

        dom.communityModal.setAttribute(
            "aria-hidden",
            "true"
        );
    }

    function renderCommunityModal() {

        if (!dom.communityChoiceList) {
            return;
        }

        dom.communityChoiceList.innerHTML = "";

        const search =
            state.communitySearch
                .trim()
                .toLowerCase();

        const communities =
            state.communities.filter(
                community => {

                    if (!search) {
                        return true;
                    }

                    return (
                        community.name
                            ?.toLowerCase()
                            .includes(search) ||

                        community.description
                            ?.toLowerCase()
                            .includes(search)
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

                if (
                    state.currentCommunity?.id ===
                    community.id
                ) {
                    button.classList.add("active");
                }

                const icon =
                    document.createElement("span");

                icon.className =
                    "community-choice-icon";

                icon.textContent =
                    getCommunityIcon(community);

                const text =
                    document.createElement("span");

                text.className =
                    "community-choice-text";

                const title =
                    document.createElement("strong");

                title.textContent =
                    community.name;

                const description =
                    document.createElement("small");

                description.textContent =
                    community.description ||
                    "Mwaniki Scholars community";

                text.append(
                    title,
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

    /* =========================================================
       SELECT COMMUNITY
       ========================================================= */

    async function selectCommunity(community) {

        if (!community) {
            return;
        }

        state.currentCommunity =
            community;

        localStorage.setItem(
            CONFIG.STORAGE_KEYS.COMMUNITY,
            community.id
        );

        updateCommunityHeader();
        updateActiveCommunityRail();

        await loadCommunityMembers(
            community.id
        );

        await loadChannels(
            community.id
        );

        subscribeCommunityRealtime(
            community.id
        );

        announce(
            `Community loaded: ${community.name}`
        );
    }

    function updateCommunityHeader() {

        const community =
            state.currentCommunity;

        if (!community) {
            return;
        }

        if (dom.selectedCommunityName) {
            dom.selectedCommunityName.textContent =
                community.name;
        }

        if (dom.selectedCommunityDescription) {
            dom.selectedCommunityDescription.textContent =
                community.description ||
                "Mwaniki Scholars Community";
        }

        if (dom.selectedCommunityIcon) {

            dom.selectedCommunityIcon.innerHTML = "";

            if (
                community.icon_url &&
                isURL(community.icon_url)
            ) {

                const img =
                    document.createElement("img");

                img.src =
                    community.icon_url;

                img.alt =
                    community.name;

                img.onerror = () => {

                    img.remove();

                    dom.selectedCommunityIcon
                        .textContent =
                        getCommunityIcon(
                            community
                        );
                };

                dom.selectedCommunityIcon
                    .appendChild(img);

            } else {

                dom.selectedCommunityIcon
                    .textContent =
                    getCommunityIcon(
                        community
                    );
            }
        }
    }

    /* =========================================================
       COMMUNITY MEMBERS
       ========================================================= */

    async function loadCommunityMembers(
        communityId
    ) {

        const { data, error } =
            await state.supabase
                .from("chat_community_members")
                .select(
                    "id,user_id,role,nickname,is_muted,is_banned"
                )
                .eq(
                    "community_id",
                    communityId
                );

        if (error) {

            console.warn(
                "Could not load community members:",
                error.message
            );

            state.members = [];

            return;
        }

        state.members = data || [];
    }

    function getMemberName(userId) {

        if (userId === state.user?.id) {
            return currentUserName();
        }

        const member =
            state.members.find(
                row => row.user_id === userId
            );

        return (
            member?.nickname ||
            `Student ${shortId(userId)}`
        );
    }

    /* =========================================================
       CHANNELS
       ========================================================= */

    async function loadChannels(
        communityId
    ) {

        const result =
            await state.supabase
                .from("chat_channels")
                .select("*")
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
                        ascending: true
                    }
                )
                .order(
                    "name",
                    {
                        ascending: true
                    }
                );

        if (result.error) {
            throw result.error;
        }

        let channels =
            result.data || [];

        /*
         * Private channels:
         * try to determine whether the user belongs.
         */

        const privateChannels =
            channels.filter(
                channel =>
                    channel.is_private
            );

        if (privateChannels.length) {

            const ids =
                privateChannels.map(
                    channel => channel.id
                );

            const memberships =
                await state.supabase
                    .from("chat_channel_members")
                    .select("channel_id")
                    .eq(
                        "user_id",
                        state.user.id
                    )
                    .in(
                        "channel_id",
                        ids
                    );

            if (!memberships.error) {

                const allowed =
                    new Set(
                        memberships.data.map(
                            row => row.channel_id
                        )
                    );

                channels =
                    channels.filter(
                        channel =>
                            !channel.is_private ||
                            allowed.has(channel.id)
                    );
            }
        }

        state.channels = channels;

        renderChannels();

        if (!channels.length) {

            state.currentChannel = null;

            localStorage.removeItem(
                CONFIG.STORAGE_KEYS.CHANNEL
            );

            renderMessages();

            return;
        }

        const savedChannelId =
            localStorage.getItem(
                CONFIG.STORAGE_KEYS.CHANNEL
            );

        const savedChannel =
            channels.find(
                channel =>
                    channel.id ===
                    savedChannelId
            );

        await selectChannel(
            savedChannel || channels[0]
        );
    }

    function channelIcon(channel) {

        if (channel.icon) {
            return channel.icon;
        }

        if (
            channel.channel_type ===
            "voice"
        ) {
            return "🔊";
        }

        if (
            channel.channel_type ===
            "announcement"
        ) {
            return "📢";
        }

        return "#";
    }

    function renderChannels() {

        if (!dom.channelList) {
            return;
        }

        dom.channelList.innerHTML = "";

        const search =
            state.channelSearch
                .trim()
                .toLowerCase();

        const channels =
            state.channels.filter(
                channel => {

                    if (!search) {
                        return true;
                    }

                    return (
                        channel.name
                            ?.toLowerCase()
                            .includes(search) ||

                        channel.description
                            ?.toLowerCase()
                            .includes(search)
                    );
                }
            );

        if (!channels.length) {

            const empty =
                document.createElement("div");

            empty.className =
                "channel-empty";

            empty.textContent =
                "No channels found.";

            dom.channelList.appendChild(
                empty
            );

            return;
        }

        channels.forEach(
            channel => {

                const button =
                    document.createElement("button");

                button.type = "button";

                button.className =
                    "channel-item";

                button.dataset.channelId =
                    channel.id;

                if (
                    state.currentChannel?.id ===
                    channel.id
                ) {
                    button.classList.add(
                        "active"
                    );
                }

                const icon =
                    document.createElement("span");

                icon.className =
                    "channel-icon";

                icon.textContent =
                    channelIcon(channel);

                const name =
                    document.createElement("span");

                name.className =
                    "channel-name";

                name.textContent =
                    channel.name;

                button.append(
                    icon,
                    name
                );

                button.addEventListener(
                    "click",
                    () => selectChannel(channel)
                );

                dom.channelList.appendChild(
                    button
                );
            }
        );
    }

    /* =========================================================
       SELECT CHANNEL
       ========================================================= */

    async function selectChannel(channel) {

        if (!channel) {
            return;
        }

        if (
            state.currentChannel?.id ===
            channel.id
        ) {
            return;
        }

        unsubscribeMessageRealtime();

        state.currentChannel =
            channel;

        localStorage.setItem(
            CONFIG.STORAGE_KEYS.CHANNEL,
            channel.id
        );

        if (dom.mainChannelTitle) {
            dom.mainChannelTitle.textContent =
                `# ${channel.name}`;
        }

        if (dom.mainChannelDescription) {
            dom.mainChannelDescription.textContent =
                channel.description ||
                "Community discussion channel";
        }

        renderChannels();

        await loadMessages(
            channel.id
        );

        subscribeMessageRealtime(
            channel.id
        );

        markChannelRead();

        announce(
            `Channel selected: ${channel.name}`
        );
    }

    /* =========================================================
       LOAD MESSAGES
       ========================================================= */

    async function loadMessages(channelId) {

        const result =
            await state.supabase
                .from("chat_messages")
                .select("*")
                .eq(
                    "channel_id",
                    channelId
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                )
                .limit(
                    CONFIG.MESSAGE_LIMIT
                );

        if (result.error) {
            throw result.error;
        }

        state.messages =
            (result.data || [])
                .reverse();

        await loadAttachmentsForMessages();

        renderMessages();
    }

    async function loadAttachmentsForMessages() {

        state.attachments.clear();

        const messageIds =
            state.messages.map(
                message => message.id
            );

        if (!messageIds.length) {
            return;
        }

        const result =
            await state.supabase
                .from("chat_attachments")
                .select("*")
                .in(
                    "message_id",
                    messageIds
                );

        if (result.error) {

            console.warn(
                "Attachment loading failed:",
                result.error.message
            );

            return;
        }

        (result.data || []).forEach(
            attachment => {

                if (
                    !state.attachments.has(
                        attachment.message_id
                    )
                ) {
                    state.attachments.set(
                        attachment.message_id,
                        []
                    );
                }

                state.attachments
                    .get(attachment.message_id)
                    .push(attachment);
            }
        );
    }

    /* =========================================================
       MESSAGE RENDERING
       ========================================================= */

    function renderMessages() {

        if (!dom.messageList) {
            return;
        }

        dom.messageList.innerHTML = "";

        if (!state.currentChannel) {

            const empty =
                document.createElement("div");

            empty.className =
                "message-empty";

            empty.textContent =
                "Select a channel to start chatting.";

            dom.messageList.appendChild(
                empty
            );

            return;
        }

        if (!state.messages.length) {

            const empty =
                document.createElement("div");

            empty.className =
                "message-empty";

            empty.textContent =
                `No messages yet in #${state.currentChannel.name}. Start the conversation.`;

            dom.messageList.appendChild(
                empty
            );

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

        requestAnimationFrame(() => {

            dom.messageList.scrollTop =
                dom.messageList.scrollHeight;

        });
    }

    function createMessageElement(message) {

        const article =
            document.createElement("article");

        article.className =
            "message-item";

        article.dataset.messageId =
            message.id;

        if (
            message.user_id ===
            state.user?.id
        ) {
            article.classList.add(
                "own-message"
            );
        }

        const header =
            document.createElement("div");

        header.className =
            "message-header";

        const avatar =
            document.createElement("img");

        avatar.className =
            "message-avatar";

        const senderName =
            getMemberName(
                message.user_id
            );

        setAvatar(
            avatar,
            senderName,
            ""
        );

        const meta =
            document.createElement("div");

        meta.className =
            "message-meta";

        const sender =
            document.createElement("strong");

        sender.textContent =
            senderName;

        const time =
            document.createElement("time");

        time.dateTime =
            message.created_at;

        time.textContent =
            formatDate(
                message.created_at
            );

        meta.append(
            sender,
            time
        );

        header.append(
            avatar,
            meta
        );

        article.appendChild(
            header
        );

        const body =
            document.createElement("div");

        body.className =
            "message-body";

        if (message.is_deleted) {

            const deleted =
                document.createElement("em");

            deleted.textContent =
                "This message was deleted.";

            body.appendChild(
                deleted
            );

        } else {

            if (message.content) {

                const content =
                    document.createElement("div");

                content.className =
                    "message-text";

                content.textContent =
                    message.content;

                body.appendChild(
                    content
                );
            }

            renderAttachments(
                message,
                body
            );

            if (message.is_edited) {

                const edited =
                    document.createElement("small");

                edited.className =
                    "message-edited";

                edited.textContent =
                    "edited";

                body.appendChild(
                    edited
                );
            }
        }

        article.appendChild(
            body
        );

        if (
            !message.is_deleted &&
            message.user_id ===
            state.user?.id
        ) {

            const actions =
                document.createElement("div");

            actions.className =
                "message-actions";

            const deleteButton =
                document.createElement("button");

            deleteButton.type = "button";

            deleteButton.className =
                "message-delete-button";

            deleteButton.textContent =
                "Delete";

            deleteButton.title =
                "Delete this message";

            deleteButton.addEventListener(
                "click",
                () =>
                    deleteMessage(
                        message
                    )
            );

            actions.appendChild(
                deleteButton
            );

            article.appendChild(
                actions
            );
        }

        return article;
    }

    /* =========================================================
       ATTACHMENT RENDERING
       ========================================================= */

    function renderAttachments(
        message,
        container
    ) {

        const files =
            state.attachments.get(
                message.id
            ) || [];

        files.forEach(
            attachment => {

                const wrapper =
                    document.createElement("div");

                wrapper.className =
                    "message-attachment";

                if (
                    attachment.mime_type &&
                    attachment.mime_type
                        .startsWith("image/")
                ) {

                    const image =
                        document.createElement("img");

                    image.src =
                        attachment.file_url;

                    image.alt =
                        attachment.file_name;

                    image.loading =
                        "lazy";

                    image.className =
                        "message-image";

                    wrapper.appendChild(
                        image
                    );

                } else {

                    const link =
                        document.createElement("a");

                    link.href =
                        attachment.file_url;

                    link.target =
                        "_blank";

                    link.rel =
                        "noopener noreferrer";

                    link.textContent =
                        `📎 ${attachment.file_name}`;

                    wrapper.appendChild(
                        link
                    );
                }

                container.appendChild(
                    wrapper
                );
            }
        );
    }

    /* =========================================================
       DELETE MESSAGE
       ========================================================= */

    async function deleteMessage(message) {

        if (
            !message ||
            message.user_id !==
            state.user?.id
        ) {
            return;
        }

        const confirmed =
            window.confirm(
                "Delete this message?"
            );

        if (!confirmed) {
            return;
        }

        const result =
            await state.supabase
                .from("chat_messages")
                .update({
                    is_deleted: true,
                    deleted_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq(
                    "id",
                    message.id
                )
                .eq(
                    "user_id",
                    state.user.id
                );

        if (result.error) {

            console.error(
                "Message deletion failed:",
                result.error
            );

            announce(
                "Could not delete the message."
            );

            return;
        }

        announce(
            "Message deleted."
        );
    }

    /* =========================================================
       SEND MESSAGE
       ========================================================= */

    async function sendMessage() {

        if (!state.currentChannel) {
            return;
        }

        const content =
            dom.messageInput?.value.trim() ||
            "";

        const file =
            state.pendingFile;

        if (!content && !file) {
            return;
        }

        if (dom.sendMessageButton) {
            dom.sendMessageButton.disabled =
                true;
        }

        try {

            let uploadedAttachment =
                null;

            let messageType =
                "text";

            if (file) {

                uploadedAttachment =
                    await uploadAttachment(
                        file
                    );

                messageType =
                    file.type?.startsWith(
                        "image/"
                    )
                        ? "image"
                        : "file";
            }

            const messageResult =
                await state.supabase
                    .from("chat_messages")
                    .insert({
                        channel_id:
                            state.currentChannel.id,

                        user_id:
                            state.user.id,

                        content:
                            content ||
                            file?.name ||
                            "",

                        message_type:
                            messageType
                    })
                    .select()
                    .single();

            if (messageResult.error) {

                if (
                    uploadedAttachment?.path
                ) {
                    await removeUploadedFile(
                        uploadedAttachment.path
                    );
                }

                throw messageResult.error;
            }

            if (uploadedAttachment) {

                const attachmentResult =
                    await state.supabase
                        .from("chat_attachments")
                        .insert({
                            message_id:
                                messageResult.data.id,

                            uploaded_by:
                                state.user.id,

                            file_name:
                                uploadedAttachment.fileName,

                            file_path:
                                uploadedAttachment.path,

                            file_url:
                                uploadedAttachment.url,

                            mime_type:
                                uploadedAttachment.mimeType,

                            file_size:
                                uploadedAttachment.size
                        });

                if (attachmentResult.error) {

                    console.error(
                        "Attachment record failed:",
                        attachmentResult.error
                    );
                }
            }

            if (dom.messageInput) {
                dom.messageInput.value = "";
            }

            clearPendingFile();

            await loadMessages(
                state.currentChannel.id
            );

        } catch (error) {

            console.error(
                "Message send failed:",
                error
            );

            announce(
                error.message ||
                "Could not send message."
            );

        } finally {

            if (dom.sendMessageButton) {
                dom.sendMessageButton.disabled =
                    false;
            }

            dom.messageInput?.focus();
        }
    }

    /* =========================================================
       FILE UPLOAD
       ========================================================= */

    function createFileInput() {

        const input =
            document.createElement("input");

        input.type = "file";

        input.accept =
            [
                "image/*",
                ".pdf",
                ".doc",
                ".docx",
                ".ppt",
                ".pptx",
                ".xls",
                ".xlsx",
                ".txt",
                ".csv",
                ".zip"
            ].join(",");

        input.style.display =
            "none";

        input.addEventListener(
            "change",
            () => {

                const file =
                    input.files?.[0];

                if (file) {
                    selectFile(file);
                }

                input.value = "";
            }
        );

        document.body.appendChild(
            input
        );

        return input;
    }

    let fileInput = null;

    function selectFile(file) {

        if (
            file.size >
            CONFIG.MAX_FILE_SIZE
        ) {

            announce(
                "Maximum file size is 25 MB."
            );

            return;
        }

        state.pendingFile = file;

        renderPendingFile();

        announce(
            `Selected ${file.name}`
        );
    }

    function renderPendingFile() {

        let preview =
            document.getElementById(
                "communityPendingFile"
            );

        if (!state.pendingFile) {

            preview?.remove();

            return;
        }

        if (!preview) {

            preview =
                document.createElement("div");

            preview.id =
                "communityPendingFile";

            preview.className =
                "pending-file";

            if (dom.messageForm) {
                dom.messageForm
                    .prepend(preview);
            }
        }

        preview.innerHTML = "";

        const name =
            document.createElement("span");

        name.textContent =
            `📎 ${state.pendingFile.name}`;

        const remove =
            document.createElement("button");

        remove.type = "button";

        remove.textContent =
            "×";

        remove.title =
            "Remove attachment";

        remove.addEventListener(
            "click",
            clearPendingFile
        );

        preview.append(
            name,
            remove
        );
    }

    function clearPendingFile() {

        state.pendingFile = null;

        const preview =
            document.getElementById(
                "communityPendingFile"
            );

        preview?.remove();
    }

    async function uploadAttachment(file) {

        const safeName =
            safeFileName(
                file.name
            );

        const path =
            `${state.user.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

        const result =
            await state.supabase.storage
                .from(
                    CONFIG.ATTACHMENT_BUCKET
                )
                .upload(
                    path,
                    file,
                    {
                        upsert: false,
                        contentType:
                            file.type ||
                            "application/octet-stream"
                    }
                );

        if (result.error) {
            throw result.error;
        }

        const publicResult =
            state.supabase.storage
                .from(
                    CONFIG.ATTACHMENT_BUCKET
                )
                .getPublicUrl(path);

        return {
            path,
            url:
                publicResult.data.publicUrl,
            fileName:
                file.name,
            mimeType:
                file.type ||
                "application/octet-stream",
            size:
                file.size
        };
    }

    async function removeUploadedFile(path) {

        try {

            await state.supabase.storage
                .from(
                    CONFIG.ATTACHMENT_BUCKET
                )
                .remove([path]);

        } catch (error) {

            console.warn(
                "Could not remove uploaded file:",
                error
            );
        }
    }

    /* =========================================================
       LARGE EMOJI KEYBOARD
       ========================================================= */

    const EMOJI_GROUPS = {

        "😀 Smileys": [
            "😀","😃","😄","😁","😆","😅","😂","🤣",
            "😊","😇","🙂","🙃","😉","😌","😍","🥰",
            "😘","😗","😙","😚","😋","😛","😝","😜",
            "🤪","🤨","🧐","🤓","😎","🤩","🥳","😏",
            "😒","😞","😔","😟","😕","🙁","☹️","😣",
            "😖","😫","😩","🥺","😢","😭","😤","😠",
            "😡","🤬","🤯","😳","🥵","🥶","😱","😨",
            "😰","😥","😓","🤗","🤔","🫣","🤭","🤫",
            "🤥","😶","😐","😑","😬","🙄","😯","😦",
            "😧","😮","😲","🥱","😴","🤤","😪","😵",
            "🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕",
            "🤑","🤠","😈","👿","👹","👺","🤡","💩",
            "👻","💀","☠️","👽","👾","🤖","🎃","😺",
            "😸","😹","😻","😼","😽","🙀","😿","😾"
        ],

        "👋 People": [
            "👋","🤚","🖐️","✋","🖖","👌","🤏","✌️",
            "🤞","🤟","🤘","🤙","👈","👉","👆","👇",
            "☝️","👍","👎","✊","👊","🤛","🤜","👏",
            "🙌","👐","🤲","🤝","🙏","✍️","💅","🤳",
            "💪","🦾","🦿","🦵","🦶","👂","👃","🧠",
            "🫀","🫁","🦷","🦴","👀","👁️","👅","👄",
            "💋","👶","🧒","👦","👧","🧑","👱","👨",
            "👩","🧔","👴","👵","🧓","👮","👷","💂",
            "🕵️","👩‍⚕️","👨‍⚕️","👩‍🎓","👨‍🎓","👩‍🏫","👨‍🏫",
            "👩‍💻","👨‍💻","👩‍🔬","👨‍🔬","🧑‍⚕️","🧑‍🎓",
            "🧑‍🏫","🧑‍💻","🧑‍🔬"
        ],

        "🐶 Animals": [
            "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼",
            "🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈",
            "🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣",
            "🐥","🦆","🦅","🦉","🦇","🐺","🐗","🐴",
            "🦄","🐝","🪲","🐛","🦋","🐌","🐞","🐜",
            "🪰","🪱","🦂","🐢","🐍","🦎","🦖","🦕",
            "🐙","🦑","🦀","🐠","🐟","🐡","🦈","🐳",
            "🐋","🐊","🐘","🦏","🦛","🐪","🐫","🦒",
            "🦘","🦬","🐃","🐂","🐄","🐎","🐖","🐏",
            "🐑","🦙","🐐","🦌","🐕","🐈","🐓","🦃"
        ],

        "🍎 Food": [
            "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇",
            "🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥",
            "🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️",
            "🫑","🌽","🥕","🧄","🧅","🥔","🍠","🥐",
            "🥯","🍞","🥖","🥨","🧀","🥚","🍳","🧈",
            "🥞","🧇","🥓","🥩","🍗","🍖","🌭","🍔",
            "🍟","🍕","🥪","🥙","🧆","🌮","🌯","🥗",
            "🍝","🍜","🍲","🍛","🍣","🍤","🍚","🍙",
            "🍘","🍥","🥟","🥠","🍡","🍧","🍨","🍦",
            "🥧","🧁","🍰","🎂","🍪","🍩","🍫","🍿",
            "☕","🍵","🧃","🥤","🧋","🍺","🍻","🍷"
        ],

        "⚽ Activities": [
            "⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉",
            "🥏","🎱","🪀","🏓","🏸","🏒","🏑","🥍",
            "🏏","⛳","🏹","🎣","🤿","🥊","🥋","🎽",
            "🛹","🛷","⛸️","🥌","🎿","⛷️","🏂","🏋️",
            "🤼","🤸","⛹️","🤺","🤾","🏌️","🏇","🧘",
            "🏄","🏊","🤽","🚣","🧗","🚵","🚴","🎮",
            "🕹️","🎲","♟️","🎯","🎳","🎮","🎸","🎹",
            "🥁","🎷","🎺","🎻","🎤","🎧","🎼","🎵",
            "🎶","🎨","🎭","🎬","🎪","🎟️","🎫"
        ],

        "🌍 Travel": [
            "🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑",
            "🚒","🚐","🛻","🚚","🚛","🚜","🛵","🏍️",
            "🚲","🛴","🚨","🚔","🚍","🚘","🚖","✈️",
            "🛫","🛬","🛩️","🚁","🚀","🛸","🚢","⛵",
            "🚤","🛥️","🚂","🚆","🚇","🚊","🚉","🚝",
            "🚞","🚋","🏠","🏡","🏢","🏥","🏦","🏨",
            "🏫","🏪","🏬","🏭","🏛️","⛪","🕌","🛕",
            "🗽","🗿","🗼","🏰","🏯","🌋","🏕️","🏖️",
            "🏝️","🏜️","🌄","🌅","🌆","🌃","🌉","🌌"
        ],

        "🌦️ Nature": [
            "🌞","🌝","🌛","🌜","🌚","🌕","🌖","🌗",
            "🌘","🌑","🌒","🌓","🌔","🌙","⭐","🌟",
            "✨","⚡","☀️","🌤️","⛅","🌥️","🌦️","🌧️",
            "⛈️","🌩️","🌨️","❄️","☃️","⛄","🌬️","💨",
            "🌪️","🌫️","🌈","🔥","💧","🌊","🌱","🌲",
            "🌳","🌴","🌵","🌷","🌹","🌺","🌸","🌼",
            "🌻","🌿","☘️","🍀","🍁","🍂","🍃","🍄"
        ],

        "💡 Objects": [
            "⌚","📱","💻","⌨️","🖥️","🖨️","🖱️","💽",
            "💾","💿","📀","📷","📸","📹","🎥","📺",
            "📻","☎️","📞","🔋","🔌","💡","🔦","🕯️",
            "📚","📖","📕","📗","📘","📙","📓","📒",
            "📔","📝","✏️","✒️","🖊️","🖋️","📌","📍",
            "📎","🔗","🔒","🔓","🔑","🔨","🔧","⚙️",
            "🧪","🧬","🔬","🔭","💊","💉","🩺","🩹",
            "🚪","🪑","🛏️","🛋️","🚿","🧻","🧴","🧼",
            "🎁","🎈","🎉","🎊","🎀","🏆","🥇","🥈",
            "🥉","⚔️","🛡️","💎","💰","💳","📦","✉️"
        ],

        "❤️ Symbols": [
            "❤️","🧡","💛","💚","💙","💜","🖤","🤍",
            "🤎","💔","❣️","💕","💞","💓","💗","💖",
            "💘","💝","💟","☮️","✝️","☪️","🕉️","☸️",
            "✡️","🔯","🕎","☯️","☦️","🛐","♾️","💯",
            "💢","💥","💫","💦","💨","🕳️","💬","👁️‍🗨️",
            "🗨️","🗯️","💭","✔️","☑️","✅","❌","❎",
            "➕","➖","➗","✖️","‼️","⁉️","❓","❔",
            "❕","❗","⚠️","🚫","🔴","🟠","🟡","🟢",
            "🔵","🟣","⚫","⚪","🟤","🔔","🔕","🔊",
            "🔇","📣","📢","♻️","🔱","⚜️"
        ],

        "🇰🇪 Flags": [
            "🇰🇪","🇺🇬","🇹🇿","🇷🇼","🇧🇮","🇪🇹","🇸🇸",
            "🇿🇦","🇳🇬","🇬🇭","🇬🇧","🇺🇸","🇨🇦","🇦🇺",
            "🇳🇿","🇮🇳","🇨🇳","🇯🇵","🇰🇷","🇩🇪","🇫🇷",
            "🇮🇹","🇪🇸","🇧🇷","🇦🇷","🇲🇽","🇪🇬","🇸🇦",
            "🇦🇪","🇹🇷","🇵🇰","🇧🇩","🇿🇲","🇿🇼","🇿🇦"
        ]
    };

    function setupEmojiPicker() {

        if (!dom.emojiButton) {
            return;
        }

        dom.emojiButton.setAttribute(
            "aria-expanded",
            "false"
        );

        dom.emojiButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                if (state.emojiPicker) {
                    closeEmojiPicker();
                } else {
                    openEmojiPicker();
                }
            }
        );

        document.addEventListener(
            "click",
            event => {

                if (!state.emojiPicker) {
                    return;
                }

                if (
                    state.emojiPicker.contains(
                        event.target
                    ) ||
                    dom.emojiButton.contains(
                        event.target
                    )
                ) {
                    return;
                }

                closeEmojiPicker();
            }
        );

        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Escape" &&
                    state.emojiPicker
                ) {
                    closeEmojiPicker();
                }
            }
        );
    }

    function openEmojiPicker() {

        closeEmojiPicker();

        const picker =
            document.createElement("div");

        picker.id =
            "mwanikiEmojiPicker";

        picker.className =
            "emoji-picker";

        picker.setAttribute(
            "role",
            "dialog"
        );

        picker.setAttribute(
            "aria-label",
            "Emoji keyboard"
        );

        const header =
            document.createElement("div");

        header.className =
            "emoji-picker-header";

        const title =
            document.createElement("strong");

        title.textContent =
            "Emoji";

        const close =
            document.createElement("button");

        close.type = "button";

        close.textContent = "×";

        close.title =
            "Close emoji keyboard";

        close.addEventListener(
            "click",
            closeEmojiPicker
        );

        header.append(
            title,
            close
        );

        picker.appendChild(
            header
        );

        const search =
            document.createElement("input");

        search.type = "search";

        search.placeholder =
            "Search emojis...";

        search.className =
            "emoji-search";

        picker.appendChild(
            search
        );

        const content =
            document.createElement("div");

        content.className =
            "emoji-picker-content";

        picker.appendChild(
            content
        );

        function renderEmojiGroups(
            query = ""
        ) {

            content.innerHTML = "";

            const normalized =
                query.toLowerCase();

            Object.entries(
                EMOJI_GROUPS
            ).forEach(
                ([group, emojis]) => {

                    const section =
                        document.createElement(
                            "section"
                        );

                    const heading =
                        document.createElement(
                            "h4"
                        );

                    heading.textContent =
                        group;

                    section.appendChild(
                        heading
                    );

                    const grid =
                        document.createElement(
                            "div"
                        );

                    grid.className =
                        "emoji-grid";

                    emojis.forEach(
                        emoji => {

                            /*
                             * Important:
                             * emoji is inserted as
                             * text, NEVER as src.
                             *
                             * This prevents:
                             * %F0%9F%8E%AE
                             * %F0%9F%98%82
                             * 404 errors.
                             */

                            const button =
                                document.createElement(
                                    "button"
                                );

                            button.type =
                                "button";

                            button.className =
                                "emoji-item";

                            button.textContent =
                                emoji;

                            button.title =
                                emoji;

                            button.addEventListener(
                                "click",
                                () => {

                                    insertEmoji(
                                        emoji
                                    );
                                }
                            );

                            grid.appendChild(
                                button
                            );
                        }
                    );

                    section.appendChild(
                        grid
                    );

                    content.appendChild(
                        section
                    );
                }
            );
        }

        renderEmojiGroups();

        search.addEventListener(
            "input",
            () => {

                /*
                 * Emoji Unicode names are not
                 * available in the browser,
                 * so search is mainly useful
                 * for keeping the keyboard
                 * organized.
                 */

                renderEmojiGroups(
                    search.value
                );
            }
        );

        document.body.appendChild(
            picker
        );

        state.emojiPicker =
            picker;

        positionEmojiPicker();

        dom.emojiButton.setAttribute(
            "aria-expanded",
            "true"
        );

        search.focus();
    }

    function positionEmojiPicker() {

        if (
            !state.emojiPicker ||
            !dom.emojiButton
        ) {
            return;
        }

        const rect =
            dom.emojiButton
                .getBoundingClientRect();

        const picker =
            state.emojiPicker;

        picker.style.position =
            "fixed";

        picker.style.left =
            `${Math.max(
                10,
                Math.min(
                    rect.left,
                    window.innerWidth - 370
                )
            )}px`;

        picker.style.bottom =
            `${Math.max(
                10,
                window.innerHeight - rect.top + 8
            )}px`;

        picker.style.zIndex =
            "99999";
    }

    function closeEmojiPicker() {

        if (state.emojiPicker) {

            state.emojiPicker.remove();

            state.emojiPicker =
                null;
        }

        dom.emojiButton?.setAttribute(
            "aria-expanded",
            "false"
        );
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
            input.value.slice(0, start) +
            emoji +
            input.value.slice(end);

        const cursor =
            start + emoji.length;

        input.setSelectionRange(
            cursor,
            cursor
        );

        input.focus();
    }

    /* =========================================================
       REALTIME COMMUNITY
       ========================================================= */

    function subscribeCommunityRealtime(
        communityId
    ) {

        if (state.communityRealtime) {

            state.supabase.removeChannel(
                state.communityRealtime
            );

            state.communityRealtime =
                null;
        }

        const channelName =
            `community-${communityId}-${Date.now()}`;

        state.communityRealtime =
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

                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_community_members",
                        filter:
                            `community_id=eq.${communityId}`
                    },
                    async () => {

                        await loadCommunityMembers(
                            communityId
                        );

                        renderChannels();
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

    /* =========================================================
       REALTIME MESSAGES
       ========================================================= */

    function subscribeMessageRealtime(
        channelId
    ) {

        unsubscribeMessageRealtime();

        const channelName =
            `messages-${channelId}-${Date.now()}`;

        state.messageRealtime =
            state.supabase
                .channel(channelName)

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

                        await handleRealtimeMessage(
                            payload.new
                        );
                    }
                )

                .on(
                    "postgres_changes",
                    {
                        event: "UPDATE",
                        schema: "public",
                        table: "chat_messages",
                        filter:
                            `channel_id=eq.${channelId}`
                    },
                    async payload => {

                        await handleRealtimeMessage(
                            payload.new
                        );
                    }
                )

                .on(
                    "postgres_changes",
                    {
                        event: "DELETE",
                        schema: "public",
                        table: "chat_messages",
                        filter:
                            `channel_id=eq.${channelId}`
                    },
                    async () => {

                        await loadMessages(
                            channelId
                        );
                    }
                )

                .subscribe(
                    status => {

                        console.log(
                            "Message realtime:",
                            status
                        );
                    }
                );
    }

    async function handleRealtimeMessage(
        message
    ) {

        const existingIndex =
            state.messages.findIndex(
                row => row.id === message.id
            );

        if (existingIndex >= 0) {

            state.messages[
                existingIndex
            ] = message;

        } else {

            state.messages.push(
                message
            );

            state.messages =
                state.messages.slice(
                    -CONFIG.MESSAGE_LIMIT
                );
        }

        await loadAttachmentsForMessages();

        renderMessages();

        if (
            message.user_id !==
            state.user?.id
        ) {
            announce(
                `New message from ${getMemberName(message.user_id)}`
            );
        }
    }

    function unsubscribeMessageRealtime() {

        if (state.messageRealtime) {

            state.supabase.removeChannel(
                state.messageRealtime
            );

            state.messageRealtime =
                null;
        }
    }

    /* =========================================================
       ATTACHMENT REALTIME
       ========================================================= */

    function subscribeAttachmentRealtime() {

        if (state.attachmentRealtime) {

            state.supabase.removeChannel(
                state.attachmentRealtime
            );
        }

        state.attachmentRealtime =
            state.supabase
                .channel(
                    `attachments-${state.user.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "chat_attachments"
                    },
                    async payload => {

                        const messageExists =
                            state.messages.some(
                                message =>
                                    message.id ===
                                    payload.new.message_id
                            );

                        if (messageExists) {

                            await loadAttachmentsForMessages();

                            renderMessages();
                        }
                    }
                )
                .subscribe();
    }

    /* =========================================================
       READ STATUS
       ========================================================= */

    async function markChannelRead() {

        if (
            !state.currentChannel ||
            !state.messages.length
        ) {
            return;
        }

        const lastMessage =
            state.messages[
                state.messages.length - 1
            ];

        const result =
            await state.supabase
                .from("chat_read_status")
                .upsert(
                    {
                        channel_id:
                            state.currentChannel.id,

                        user_id:
                            state.user.id,

                        last_read_message_id:
                            lastMessage.id,

                        last_read_at:
                            new Date().toISOString()
                    },
                    {
                        onConflict:
                            "channel_id,user_id"
                    }
                );

        if (result.error) {

            console.warn(
                "Read status update failed:",
                result.error.message
            );
        }
    }

    /* =========================================================
       GENERAL CALL MODAL
       ========================================================= */

    function openGeneralCallModal() {

        if (!dom.generalCallModal) {
            return;
        }

        state.selectedCallUsers.clear();

        dom.generalCallModal.classList.add(
            "open"
        );

        dom.generalCallModal.removeAttribute(
            "aria-hidden"
        );

        loadGeneralCallUsers();
    }

    function closeGeneralCallModal() {

        const active =
            document.activeElement;

        if (
            active &&
            dom.generalCallModal?.contains(
                active
            )
        ) {
            active.blur();
        }

        dom.generalCallModal?.classList.remove(
            "open"
        );

        dom.generalCallModal?.setAttribute(
            "aria-hidden",
            "true"
        );
    }

    async function loadGeneralCallUsers() {

        if (!dom.generalCallUserList) {
            return;
        }

        dom.generalCallUserList.innerHTML = "";

        if (dom.generalCallUserStatus) {
            dom.generalCallUserStatus.textContent =
                "Loading users...";
        }

        const presenceResult =
            await state.supabase
                .from("chat_presence")
                .select(
                    "user_id,status,last_seen_at"
                )
                .neq(
                    "user_id",
                    state.user.id
                )
                .order(
                    "last_seen_at",
                    {
                        ascending: false
                    }
                );

        let users =
            presenceResult.error
                ? []
                : presenceResult.data || [];

        /*
         * If presence is empty, use community
         * members as fallback.
         */

        if (
            !users.length &&
            state.members.length
        ) {

            users =
                state.members
                    .filter(
                        member =>
                            member.user_id !==
                            state.user.id
                    )
                    .map(
                        member => ({
                            user_id:
                                member.user_id,

                            status:
                                "unknown"
                        })
                    );
        }

        if (!users.length) {

            const empty =
                document.createElement("div");

            empty.className =
                "call-empty";

            empty.textContent =
                "No other users are currently available.";

            dom.generalCallUserList.appendChild(
                empty
            );

            updateCallSelectionUI();

            return;
        }

        users.forEach(
            user => {

                const button =
                    document.createElement(
                        "button"
                    );

                button.type = "button";

                button.className =
                    "call-user-item";

                button.dataset.userId =
                    user.user_id;

                const selected =
                    state.selectedCallUsers.has(
                        user.user_id
                    );

                if (selected) {
                    button.classList.add(
                        "selected"
                    );
                }

                const name =
                    getMemberName(
                        user.user_id
                    );

                const avatar =
                    document.createElement(
                        "img"
                    );

                avatar.src =
                    avatarDataURL(name);

                avatar.alt =
                    name;

                const text =
                    document.createElement(
                        "span"
                    );

                text.textContent =
                    name;

                const status =
                    document.createElement(
                        "small"
                    );

                status.textContent =
                    user.status ||
                    "unknown";

                button.append(
                    avatar,
                    text,
                    status
                );

                button.addEventListener(
                    "click",
                    () => {

                        toggleCallUser(
                            user.user_id
                        );

                        button.classList.toggle(
                            "selected",
                            state.selectedCallUsers.has(
                                user.user_id
                            )
                        );
                    }
                );

                dom.generalCallUserList
                    .appendChild(
                        button
                    );
            }
        );

        updateCallSelectionUI();
    }

    function toggleCallUser(userId) {

        if (
            state.selectedCallUsers.has(
                userId
            )
        ) {

            state.selectedCallUsers.delete(
                userId
            );

        } else {

            state.selectedCallUsers.add(
                userId
            );
        }

        updateCallSelectionUI();
    }

    function updateCallSelectionUI() {

        const count =
            state.selectedCallUsers.size;

        if (dom.generalCallSelectionCount) {

            dom.generalCallSelectionCount
                .textContent =
                String(count);
        }

        if (dom.generalCallUserStatus) {

            dom.generalCallUserStatus
                .textContent =
                count
                    ? `${count} user${count === 1 ? "" : "s"} selected`
                    : "Select people to call.";
        }

        if (dom.startGeneralCallButton) {

            dom.startGeneralCallButton.disabled =
                count === 0;
        }
    }

    /* =========================================================
       CALL ROOM CREATION
       ========================================================= */

    async function createCallRoom({
        communityId = null,
        scope = "general",
        userIds = []
    }) {

        const roomCode =
            crypto.randomUUID()
                .replaceAll("-", "")
                .slice(0, 16);

        const roomResult =
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
                        "video",

                    status:
                        "waiting",

                    created_by:
                        state.user.id
                })
                .select()
                .single();

        if (roomResult.error) {
            throw roomResult.error;
        }

        const room =
            roomResult.data;

        const participantIds =
            [
                state.user.id,
                ...userIds.filter(
                    id =>
                        id !==
                        state.user.id
                )
            ];

        const participantRows =
            participantIds.map(
                userId => ({
                    room_id:
                        room.id,

                    user_id:
                        userId,

                    status:
                        userId ===
                        state.user.id
                            ? "joined"
                            : "invited",

                    is_muted:
                        false,

                    is_camera_on:
                        userId ===
                        state.user.id
                })
            );

        const participantResult =
            await state.supabase
                .from(
                    "chat_call_participants"
                )
                .insert(
                    participantRows
                );

        if (participantResult.error) {

            console.error(
                "Call participant creation failed:",
                participantResult.error
            );

            await state.supabase
                .from("chat_call_rooms")
                .update({
                    status: "ended",
                    ended_at:
                        new Date().toISOString()
                })
                .eq(
                    "id",
                    room.id
                );

            throw participantResult.error;
        }

        return room;
    }

    /* =========================================================
       START GENERAL CALL
       ========================================================= */

    async function startGeneralCall() {

        const userIds =
            Array.from(
                state.selectedCallUsers
            );

        if (!userIds.length) {
            return;
        }

        if (dom.startGeneralCallButton) {
            dom.startGeneralCallButton.disabled =
                true;
        }

        try {

            closeGeneralCallModal();

            const room =
                await createCallRoom({
                    communityId: null,
                    scope: "general",
                    userIds
                });

            await startCallSession(
                room,
                true
            );

        } catch (error) {

            console.error(
                "General call failed:",
                error
            );

            announce(
                error.message ||
                "Could not start general call."
            );

        } finally {

            if (dom.startGeneralCallButton) {
                dom.startGeneralCallButton.disabled =
                    false;
            }
        }
    }

    /* =========================================================
       COMMUNITY CALL BUTTON
       ========================================================= */

    function createCommunityCallButton() {

        if (
            !dom.headerCommunityButton ||
            document.getElementById(
                "communityCallButton"
            )
        ) {
            return;
        }

        const button =
            document.createElement("button");

        button.id =
            "communityCallButton";

        button.type =
            "button";

        button.className =
            "community-call-button";

        button.textContent =
            "📹 Community Call";

        button.title =
            "Start a call with this community";

        button.addEventListener(
            "click",
            startCommunityCall
        );

        dom.headerCommunityButton
            .parentElement
            ?.appendChild(
                button
            );
    }

    async function startCommunityCall() {

        if (!state.currentCommunity) {

            announce(
                "Select a community first."
            );

            return;
        }

        const members =
            state.members
                .filter(
                    member =>
                        member.user_id !==
                        state.user.id &&
                        !member.is_banned
                );

        if (!members.length) {

            announce(
                "There are no other community members to call."
            );

            return;
        }

        try {

            const room =
                await createCallRoom({
                    communityId:
                        state.currentCommunity.id,

                    scope:
                        "community",

                    userIds:
                        members.map(
                            member =>
                                member.user_id
                        )
                });

            await startCallSession(
                room,
                true
            );

        } catch (error) {

            console.error(
                "Community call failed:",
                error
            );

            announce(
                error.message ||
                "Could not start community call."
            );
        }
    }

    /* =========================================================
       CALL MEDIA
       ========================================================= */

    async function getLocalMedia() {

        if (state.localStream) {
            return state.localStream;
        }

        try {

            state.localStream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: true,
                        video: true
                    });

        } catch (videoError) {

            console.warn(
                "Camera unavailable. Trying audio only.",
                videoError
            );

            try {

                state.localStream =
                    await navigator.mediaDevices
                        .getUserMedia({
                            audio: true,
                            video: false
                        });

            } catch (audioError) {

                throw new Error(
                    "Microphone and camera permission was denied."
                );
            }
        }

        if (dom.localVideo) {

            dom.localVideo.srcObject =
                state.localStream;

            dom.localVideo.muted =
                true;

            dom.localVideo.autoplay =
                true;

            dom.localVideo.playsInline =
                true;
        }

        return state.localStream;
    }

    /* =========================================================
       START CALL SESSION
       ========================================================= */

    async function startCallSession(
        room,
        isCreator
    ) {

        state.currentCall = {
            room,
            isCreator
        };

        await getLocalMedia();

        showCallOverlay(
            room
        );

        subscribeCallRealtime(
            room.id
        );

        startCallTimer();

        announce(
            "Call connected."
        );
    }

    /* =========================================================
       CALL OVERLAY
       ========================================================= */

    function showCallOverlay(room) {

        if (!dom.callOverlay) {
            return;
        }

        dom.callOverlay.classList.add(
            "open"
        );

        dom.callOverlay.removeAttribute(
            "aria-hidden"
        );

        if (dom.callTitle) {

            dom.callTitle.textContent =
                room.community_id
                    ? (
                        state.currentCommunity?.name ||
                        "Community Call"
                    )
                    : "General Call";
        }

        if (dom.callSubtitle) {

            dom.callSubtitle.textContent =
                "Mwaniki Scholars video call";
        }

        if (dom.localVideoTile) {
            dom.localVideoTile.classList.add(
                "active"
            );
        }

        renderCallParticipantLabels();
    }

    function hideCallOverlay() {

        if (!dom.callOverlay) {
            return;
        }

        const active =
            document.activeElement;

        if (
            active &&
            dom.callOverlay.contains(active)
        ) {
            active.blur();
        }

        dom.callOverlay.classList.remove(
            "open"
        );

        dom.callOverlay.setAttribute(
            "aria-hidden",
            "true"
        );
    }

    /* =========================================================
       CALL TIMER
       ========================================================= */

    function startCallTimer() {

        stopCallTimer();

        state.callStartedAt =
            Date.now();

        state.callTimer =
            setInterval(
                () => {

                    if (
                        !dom.callDuration ||
                        !state.callStartedAt
                    ) {
                        return;
                    }

                    const seconds =
                        Math.floor(
                            (
                                Date.now() -
                                state.callStartedAt
                            ) / 1000
                        );

                    dom.callDuration
                        .textContent =
                        formatDuration(
                            seconds
                        );
                },
                1000
            );
    }

    function stopCallTimer() {

        if (state.callTimer) {

            clearInterval(
                state.callTimer
            );

            state.callTimer =
                null;
        }

        state.callStartedAt =
            null;
    }

    /* =========================================================
       WEBRTC PEERS
       ========================================================= */

    function createPeerConnection(
        remoteUserId,
        initiator
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
                    CONFIG.STUN_SERVERS
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

                if (!event.candidate) {
                    return;
                }

                await sendCallSignal(
                    "ice",
                    remoteUserId,
                    event.candidate
                );
            };

        pc.ontrack =
            event => {

                attachRemoteVideo(
                    remoteUserId,
                    event.streams[0]
                );
            };

        pc.onconnectionstatechange =
            () => {

                if (
                    ["failed", "closed"]
                        .includes(
                            pc.connectionState
                        )
                ) {

                    closePeer(
                        remoteUserId
                    );
                }
            };

        if (initiator) {

            createOffer(
                remoteUserId,
                pc
            );
        }

        return pc;
    }

    async function createOffer(
        remoteUserId,
        pc
    ) {

        try {

            const offer =
                await pc.createOffer();

            await pc.setLocalDescription(
                offer
            );

            await sendCallSignal(
                "offer",
                remoteUserId,
                offer
            );

        } catch (error) {

            console.error(
                "Offer creation failed:",
                error
            );
        }
    }

    async function handleOffer(
        senderId,
        offer
    ) {

        const pc =
            createPeerConnection(
                senderId,
                false
            );

        await pc.setRemoteDescription(
            new RTCSessionDescription(
                offer
            )
        );

        const answer =
            await pc.createAnswer();

        await pc.setLocalDescription(
            answer
        );

        await sendCallSignal(
            "answer",
            senderId,
            answer
        );
    }

    async function handleAnswer(
        senderId,
        answer
    ) {

        const pc =
            state.peerConnections.get(
                senderId
            );

        if (!pc) {
            return;
        }

        await pc.setRemoteDescription(
            new RTCSessionDescription(
                answer
            )
        );
    }

    async function handleIce(
        senderId,
        candidate
    ) {

        const pc =
            state.peerConnections.get(
                senderId
            );

        if (!pc || !candidate) {
            return;
        }

        try {

            await pc.addIceCandidate(
                new RTCIceCandidate(
                    candidate
                )
            );

        } catch (error) {

            console.warn(
                "ICE candidate failed:",
                error
            );
        }
    }

    /* =========================================================
       CALL SIGNALING
       ========================================================= */

    async function sendCallSignal(
        type,
        receiverId,
        payload
    ) {

        if (!state.currentCall) {
            return;
        }

        const result =
            await state.supabase
                .from(
                    "chat_call_signals"
                )
                .insert({
                    room_id:
                        state.currentCall.room.id,

                    sender_id:
                        state.user.id,

                    receiver_id:
                        receiverId,

                    signal_type:
                        type,

                    payload
                });

        if (result.error) {

            console.error(
                "Call signal failed:",
                result.error
            );
        }
    }

    function subscribeCallRealtime(
        roomId
    ) {

        if (state.callRealtime) {

            state.supabase.removeChannel(
                state.callRealtime
            );
        }

        const channelName =
            `call-${roomId}-${state.user.id}`;

        state.callRealtime =
            state.supabase
                .channel(channelName)

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
                    async () => {

                        renderCallParticipantLabels();
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

    async function handleCallSignal(
        signal
    ) {

        const senderId =
            signal.sender_id;

        switch (
            signal.signal_type
        ) {

            case "ready":

                if (
                    state.currentCall
                        ?.isCreator
                ) {

                    const pc =
                        createPeerConnection(
                            senderId,
                            false
                        );

                    await createOffer(
                        senderId,
                        pc
                    );
                }

                break;

            case "offer":

                await handleOffer(
                    senderId,
                    signal.payload
                );

                break;

            case "answer":

                await handleAnswer(
                    senderId,
                    signal.payload
                );

                break;

            case "ice":

                await handleIce(
                    senderId,
                    signal.payload
                );

                break;

            case "leave":

                closePeer(
                    senderId
                );

                break;

            default:

                console.log(
                    "Unknown call signal:",
                    signal.signal_type
                );
        }
    }

    /* =========================================================
       REMOTE VIDEO
       ========================================================= */

    function attachRemoteVideo(
        userId,
        stream
    ) {

        if (!dom.callVideoGrid) {
            return;
        }

        let tile =
            document.getElementById(
                `remoteTile-${userId}`
            );

        if (!tile) {

            tile =
                document.createElement(
                    "div"
                );

            tile.id =
                `remoteTile-${userId}`;

            tile.className =
                "remote-video-tile";

            const video =
                document.createElement(
                    "video"
                );

            video.autoplay =
                true;

            video.playsInline =
                true;

            video.dataset.userId =
                userId;

            const label =
                document.createElement(
                    "span"
                );

            label.className =
                "remote-video-name";

            label.textContent =
                getMemberName(userId);

            tile.append(
                video,
                label
            );

            dom.callVideoGrid
                .appendChild(
                    tile
                );
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

    async function renderCallParticipantLabels() {

        if (!state.currentCall) {
            return;
        }

        const result =
            await state.supabase
                .from(
                    "chat_call_participants"
                )
                .select(
                    "user_id,status,is_muted,is_camera_on"
                )
                .eq(
                    "room_id",
                    state.currentCall.room.id
                );

        if (result.error) {
            return;
        }

        if (dom.callParticipants) {

            dom.callParticipants
                .textContent =
                `${result.data.length} participant${result.data.length === 1 ? "" : "s"}`;
        }
    }

    function closePeer(userId) {

        const pc =
            state.peerConnections.get(
                userId
            );

        if (pc) {

            try {
                pc.close();
            } catch {}
        }

        state.peerConnections.delete(
            userId
        );

        document
            .getElementById(
                `remoteTile-${userId}`
            )
            ?.remove();
    }

    /* =========================================================
       INCOMING CALLS
       ========================================================= */

    function subscribeIncomingCalls() {

        if (state.incomingCallRealtime) {

            state.supabase.removeChannel(
                state.incomingCallRealtime
            );
        }

        state.incomingCallRealtime =
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
                            "chat_call_participants",
                        filter:
                            `user_id=eq.${state.user.id}`
                    },
                    async payload => {

                        if (
                            payload.new.status ===
                            "invited"
                        ) {

                            await showIncomingCall(
                                payload.new.room_id
                            );
                        }
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
                            `user_id=eq.${state.user.id}`
                    },
                    async payload => {

                        if (
                            payload.new.status ===
                            "invited"
                        ) {

                            await showIncomingCall(
                                payload.new.room_id
                            );
                        }
                    }
                )

                .subscribe(
                    status => {

                        console.log(
                            "Incoming calls:",
                            status
                        );
                    }
                );
    }

    async function showIncomingCall(
        roomId
    ) {

        const result =
            await state.supabase
                .from("chat_call_rooms")
                .select("*")
                .eq("id", roomId)
                .maybeSingle();

        if (result.error || !result.data) {
            return;
        }

        const room =
            result.data;

        if (
            room.status === "ended"
        ) {
            return;
        }

        state.incomingCall =
            room;

        if (dom.incomingCallTitle) {

            dom.incomingCallTitle
                .textContent =
                room.call_scope ===
                "community"
                    ? "Community Call"
                    : "Incoming General Call";
        }

        if (dom.incomingCallText) {

            dom.incomingCallText
                .textContent =
                "Someone is calling you on Mwaniki Scholars.";
        }

        dom.incomingCallToast
            ?.classList.add("open");
    }

    async function acceptIncomingCall() {

        const room =
            state.incomingCall;

        if (!room) {
            return;
        }

        dom.incomingCallToast
            ?.classList.remove("open");

        try {

            const result =
                await state.supabase
                    .from(
                        "chat_call_participants"
                    )
                    .update({
                        status:
                            "joined",

                        joined_at:
                            new Date().toISOString()
                    })
                    .eq(
                        "room_id",
                        room.id
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    );

            if (result.error) {
                throw result.error;
            }

            await startCallSession(
                room,
                false
            );

            await sendCallSignal(
                "ready",
                room.created_by,
                {
                    ready: true
                }
            );

            state.incomingCall =
                null;

        } catch (error) {

            console.error(
                "Accept call failed:",
                error
            );

            announce(
                "Could not join the call."
            );
        }
    }

    async function declineIncomingCall() {

        const room =
            state.incomingCall;

        dom.incomingCallToast
            ?.classList.remove("open");

        if (!room) {
            return;
        }

        await state.supabase
            .from(
                "chat_call_participants"
            )
            .update({
                status:
                    "declined"
            })
            .eq(
                "room_id",
                room.id
            )
            .eq(
                "user_id",
                state.user.id
            );

        state.incomingCall =
            null;
    }

    /* =========================================================
       MICROPHONE
       ========================================================= */

    async function toggleMicrophone() {

        if (!state.localStream) {
            return;
        }

        const tracks =
            state.localStream
                .getAudioTracks();

        if (!tracks.length) {
            return;
        }

        const enabled =
            !tracks[0].enabled;

        tracks.forEach(
            track => {
                track.enabled =
                    enabled;
            }
        );

        if (
            dom.toggleMicrophoneButton
        ) {

            dom.toggleMicrophoneButton
                .textContent =
                enabled
                    ? "🎙️ Mute"
                    : "🔇 Unmute";
        }

        await updateOwnCallParticipant({
            is_muted:
                !enabled
        });
    }

    /* =========================================================
       CAMERA
       ========================================================= */

    async function toggleCamera() {

        if (!state.localStream) {
            return;
        }

        const tracks =
            state.localStream
                .getVideoTracks();

        if (!tracks.length) {
            return;
        }

        const enabled =
            !tracks[0].enabled;

        tracks.forEach(
            track => {
                track.enabled =
                    enabled;
            }
        );

        if (
            dom.toggleCameraButton
        ) {

            dom.toggleCameraButton
                .textContent =
                enabled
                    ? "📷 Camera"
                    : "🚫 Camera";
        }

        await updateOwnCallParticipant({
            is_camera_on:
                enabled
        });
    }

    /* =========================================================
       SCREEN SHARING
       ========================================================= */

    async function toggleScreenShare() {

        if (!state.currentCall) {
            return;
        }

        if (state.screenStream) {

            stopScreenShare();

            return;
        }

        try {

            state.screenStream =
                await navigator.mediaDevices
                    .getDisplayMedia({
                        video: true,
                        audio: false
                    });

            const screenTrack =
                state.screenStream
                    .getVideoTracks()[0];

            for (
                const pc of
                state.peerConnections.values()
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

            if (dom.localVideo) {

                dom.localVideo.srcObject =
                    state.screenStream;
            }

            screenTrack.addEventListener(
                "ended",
                stopScreenShare
            );

            if (
                dom.shareScreenButton
            ) {

                dom.shareScreenButton
                    .textContent =
                    "🛑 Stop sharing";
            }

            await updateOwnCallParticipant({
                is_screen_sharing:
                    true
            });

        } catch (error) {

            console.warn(
                "Screen sharing cancelled:",
                error
            );
        }
    }

    async function stopScreenShare() {

        if (!state.screenStream) {
            return;
        }

        state.screenStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        state.screenStream =
            null;

        const cameraTrack =
            state.localStream
                ?.getVideoTracks()[0];

        if (cameraTrack) {

            for (
                const pc of
                state.peerConnections.values()
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
                        cameraTrack
                    );
                }
            }

            if (dom.localVideo) {

                dom.localVideo.srcObject =
                    state.localStream;
            }
        }

        if (
            dom.shareScreenButton
        ) {

            dom.shareScreenButton
                .textContent =
                "🖥️ Share screen";
        }

        await updateOwnCallParticipant({
            is_screen_sharing:
                false
        });
    }

    /* =========================================================
       CALL PARTICIPANT UPDATE
       ========================================================= */

    async function updateOwnCallParticipant(
        values
    ) {

        if (!state.currentCall) {
            return;
        }

        await state.supabase
            .from(
                "chat_call_participants"
            )
            .update(values)
            .eq(
                "room_id",
                state.currentCall.room.id
            )
            .eq(
                "user_id",
                state.user.id
            );
    }

    /* =========================================================
       LEAVE CALL
       ========================================================= */

    async function leaveCall() {

        if (!state.currentCall) {
            return;
        }

        const room =
            state.currentCall.room;

        try {

            await state.supabase
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
                    room.id
                )
                .eq(
                    "user_id",
                    state.user.id
                );

            if (
                state.currentCall.isCreator
            ) {

                await state.supabase
                    .from(
                        "chat_call_rooms"
                    )
                    .update({
                        status:
                            "ended",

                        ended_at:
                            new Date().toISOString(),

                        updated_at:
                            new Date().toISOString()
                    })
                    .eq(
                        "id",
                        room.id
                    );
            }

        } catch (error) {

            console.error(
                "Leave call database update failed:",
                error
            );
        }

        await cleanupCall();
    }

    async function cleanupCall() {

        if (state.callRealtime) {

            state.supabase.removeChannel(
                state.callRealtime
            );

            state.callRealtime =
                null;
        }

        state.peerConnections.forEach(
            pc => {

                try {
                    pc.close();
                } catch {}
            }
        );

        state.peerConnections.clear();

        if (state.screenStream) {

            state.screenStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

            state.screenStream =
                null;
        }

        if (state.localStream) {

            state.localStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

            state.localStream =
                null;
        }

        document
            .querySelectorAll(
                ".remote-video-tile"
            )
            .forEach(
                element =>
                    element.remove()
            );

        if (dom.localVideo) {
            dom.localVideo.srcObject =
                null;
        }

        stopCallTimer();

        hideCallOverlay();

        state.currentCall =
            null;

        announce(
            "Call ended."
        );
    }

    /* =========================================================
       MINIMIZE CALL
       ========================================================= */

    function minimizeCall() {

        dom.callOverlay?.classList.toggle(
            "minimized"
        );
    }

    /* =========================================================
       NAVIGATION
       ========================================================= */

    function setupNavigation() {

        const goDashboard =
            () => {
                window.location.href =
                    "./dashboard.html";
            };

        dom.homeButton?.addEventListener(
            "click",
            goDashboard
        );

        dom.railHomeButton?.addEventListener(
            "click",
            goDashboard
        );

        dom.dashboardButton?.addEventListener(
            "click",
            goDashboard
        );

        dom.railProfileButton?.addEventListener(
            "click",
            () => {
                window.location.href =
                    "./dashboard.html#profile";
            }
        );

        dom.sidebarProfileButton
            ?.addEventListener(
                "click",
                () => {
                    window.location.href =
                        "./dashboard.html#profile";
                }
            );

        dom.headerCommunityButton
            ?.addEventListener(
                "click",
                openCommunityModal
            );

        dom.openCommunityButton
            ?.addEventListener(
                "click",
                openCommunityModal
            );

        dom.communitySelectorButton
            ?.addEventListener(
                "click",
                openCommunityModal
            );

        dom.railGeneralButton
            ?.addEventListener(
                "click",
                openGeneralCallModal
            );

        dom.generalCallButton
            ?.addEventListener(
                "click",
                openGeneralCallModal
            );

        dom.startConversationButton
            ?.addEventListener(
                "click",
                () => {
                    dom.messageInput?.focus();
                }
            );

        dom.welcomeStartButton
            ?.addEventListener(
                "click",
                () => {
                    dom.messageInput?.focus();
                }
            );
    }

    /* =========================================================
       SEARCH
       ========================================================= */

    function setupSearch() {

        dom.channelSearchInput
            ?.addEventListener(
                "input",
                event => {

                    state.channelSearch =
                        event.target.value;

                    renderChannels();
                }
            );

        dom.communityModalSearch
            ?.addEventListener(
                "input",
                event => {

                    state.communitySearch =
                        event.target.value;

                    renderCommunityModal();
                }
            );
    }

    /* =========================================================
       MESSAGE COMPOSER
       ========================================================= */

    function setupComposer() {

        dom.messageForm
            ?.addEventListener(
                "submit",
                event => {

                    event.preventDefault();

                    sendMessage();
                }
            );

        dom.sendMessageButton
            ?.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    sendMessage();
                }
            );

        dom.messageInput
            ?.addEventListener(
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

        dom.attachButton
            ?.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    if (!fileInput) {
                        fileInput =
                            createFileInput();
                    }

                    fileInput.click();
                }
            );
    }

    /* =========================================================
       MODALS / CALL EVENTS
       ========================================================= */

    function setupModalEvents() {

        dom.closeCommunityModal
            ?.addEventListener(
                "click",
                closeCommunityModal
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

        dom.startGeneralCallButton
            ?.addEventListener(
                "click",
                startGeneralCall
            );

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

        dom.minimizeCallButton
            ?.addEventListener(
                "click",
                minimizeCall
            );

        dom.leaveCallButton
            ?.addEventListener(
                "click",
                leaveCall
            );

        /*
         * Close modals by clicking outside.
         */

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
         * Escape key.
         */

        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key !== "Escape"
                ) {
                    return;
                }

                closeCommunityModal();
                closeGeneralCallModal();

                if (
                    state.emojiPicker
                ) {
                    closeEmojiPicker();
                }
            }
        );
    }

    /* =========================================================
       WINDOW RESIZE
       ========================================================= */

    function setupWindowEvents() {

        window.addEventListener(
            "resize",
            () => {

                if (
                    state.emojiPicker
                ) {
                    positionEmojiPicker();
                }
            }
        );
    }

    /* =========================================================
       INITIALIZATION
       ========================================================= */

    async function initialize() {

        cacheDOM();

        try {

            await waitForSupabase();

            const authenticated =
                await loadAuthenticatedUser();

            if (!authenticated) {
                return;
            }

            setupAuthListener();
            setupProfileUI();

            setupNavigation();
            setupSearch();
            setupComposer();
            setupEmojiPicker();
            setupModalEvents();
            setupWindowEvents();

            fileInput =
                createFileInput();

            await loadCommunities();

            subscribeAttachmentRealtime();
            subscribeIncomingCalls();

            createCommunityCallButton();

            state.initialized =
                true;

            console.log(
                "✅ Mwaniki Scholars Community loaded"
            );

            announce(
                "Community loaded."
            );

        } catch (error) {

            console.error(
                "❌ Community initialization failed:",
                error
            );

            announce(
                error.message ||
                "Community failed to initialize."
            );
        }
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
            initialize,
            {
                once: true
            }
        );

    } else {

        initialize();
    }

})();
