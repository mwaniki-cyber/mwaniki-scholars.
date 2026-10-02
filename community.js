/* ============================================================
   MWANIKI SCHOLARS COMMUNITY ENGINE
   ============================================================ */

"use strict";

console.log(
    "🚀 Mwaniki Scholars Community Engine loading..."
);


/* ============================================================
   SUPABASE
   ============================================================ */

const db =
    window.supabaseClient ||
    window.supabase;

if (!db) {
    console.error(
        "❌ Supabase client was not found."
    );
}


/* ============================================================
   STATE
   ============================================================ */

const state = {

    user: null,

    profile: null,

    communities: [],

    channels: [],

    currentSpace: {
        type: "home",
        id: null
    },

    currentChannel: null,

    messages: [],

    filteredCommunities: [],

    filteredChannels: [],

    replyTo: null,

    channelSubscription: null,

    messageSubscription: null,

    totalChannelCount: 0

};


/* ============================================================
   COMMUNITY ICONS
   IMPORTANT:
   These are text/emoji fallbacks.
   They are NEVER requested as image URLs.
   ============================================================ */

const COMMUNITY_ICONS = {

    home: "🏠",

    medical: "📚",

    medicalscholars: "📚",

    gaming: "🎮",

    games: "🎮",

    memes: "😂",

    meme: "😂",

    science: "🧪",

    technology: "💻",

    music: "🎵",

    sports: "⚽",

    research: "🧠",

    study: "📖",

    general: "🌐",

    calls: "📞",

    default: "🌐"

};


/* ============================================================
   CHANNEL ICONS
   ============================================================ */

const CHANNEL_ICONS = {

    general: "💬",

    announcement: "📢",

    announcements: "📢",

    introduction: "👋",

    introductions: "👋",

    discussion: "💭",

    discussions: "💭",

    study: "📖",

    studies: "📖",

    clinical: "🩺",

    laboratory: "🧪",

    lab: "🧪",

    microbiology: "🔬",

    hematology: "🩸",

    chemistry: "⚗️",

    pharmacology: "💊",

    games: "🎮",

    gaming: "🎮",

    memes: "😂",

    media: "🖼️",

    images: "🖼️",

    videos: "🎬",

    voice: "🔊",

    video: "🎥",

    calls: "📞",

    suggestions: "💡",

    help: "❓",

    resources: "📚",

    news: "📰",

    events: "📅",

    default: "💬"

};


/* ============================================================
   DOM
   ============================================================ */

const $ = id =>
    document.getElementById(id);


/* ============================================================
   START
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    initializeCommunity
);


async function initializeCommunity() {

    bindEvents();

    try {

        await authenticate();

        await loadProfile();

        await loadCommunities();

        await loadChannels();

        renderCommunities();

        renderCurrentSpace();

        await ensureGlobalGeneral();

        await selectInitialChannel();

        console.log(
            "✅ Mwaniki Community fully initialized."
        );

    } catch (error) {

        console.error(
            "❌ Community initialization failed:",
            error
        );

        showToast(
            "Community could not be initialized."
        );
    }
}


/* ============================================================
   AUTH
   ============================================================ */

async function authenticate() {

    if (!db) {
        throw new Error(
            "Supabase client unavailable."
        );
    }

    const {
        data,
        error
    } = await db.auth.getUser();

    if (error) {
        throw error;
    }

    if (!data || !data.user) {

        console.warn(
            "No authenticated user."
        );

        window.location.href =
            "./index.html";

        return;
    }

    state.user = data.user;

    console.log(
        "Authenticated user:",
        state.user.id
    );
}


/* ============================================================
   PROFILE
   ============================================================ */

async function loadProfile() {

    if (!state.user) return;

    const possibleTables = [
        "profiles",
        "student_profiles"
    ];

    for (
        const table of possibleTables
    ) {

        try {

            const {
                data,
                error
            } = await db
                .from(table)
                .select("*")
                .eq(
                    "id",
                    state.user.id
                )
                .maybeSingle();

            if (!error && data) {

                state.profile = data;

                break;
            }

        } catch (error) {

            console.warn(
                `Profile table ${table} unavailable.`
            );

        }
    }

    updateProfileUI();
}


function updateProfileUI() {

    const profile =
        state.profile || {};

    const metadata =
        state.user?.user_metadata || {};

    const name =
        profile.full_name ||
        profile.name ||
        metadata.full_name ||
        metadata.name ||
        state.user?.email?.split("@")[0] ||
        "Student";

    const email =
        state.user?.email ||
        profile.email ||
        "—";

    if ($("headerUserName")) {
        $("headerUserName").textContent =
            name;
    }

    if ($("profilePanelName")) {
        $("profilePanelName").textContent =
            name;
    }

    if ($("profilePanelEmail")) {
        $("profilePanelEmail").textContent =
            email;
    }

    const avatar =
        profile.avatar_url ||
        profile.profile_image ||
        profile.profile_photo ||
        metadata.avatar_url ||
        null;

    if (avatar) {

        const header =
            $("headerAvatar");

        const large =
            $("profileAvatarLarge");

        if (header) {

            header.innerHTML = `
                <img
                    src="${escapeAttribute(avatar)}"
                    alt=""
                >
            `;
        }

        if (large) {

            large.innerHTML = `
                <img
                    src="${escapeAttribute(avatar)}"
                    alt=""
                >
            `;
        }
    }
}


/* ============================================================
   LOAD COMMUNITIES
   ============================================================ */

async function loadCommunities() {

    const {
        data,
        error
    } = await db
        .from("chat_communities")
        .select("*")
        .order(
            "created_at",
            {
                ascending: true
            }
        );

    if (error) {
        throw error;
    }

    state.communities =
        Array.isArray(data)
            ? data
            : [];

    state.filteredCommunities =
        [...state.communities];

    console.log(
        `Communities loaded: ${state.communities.length}`
    );
}


/* ============================================================
   LOAD ALL CHANNELS
   ============================================================ */

async function loadChannels() {

    const pageSize = 1000;

    let from = 0;

    let allChannels = [];

    while (true) {

        const to =
            from + pageSize - 1;

        const {
            data,
            error
        } = await db
            .from("chat_channels")
            .select("*")
            .range(
                from,
                to
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );

        if (error) {
            throw error;
        }

        const rows =
            Array.isArray(data)
                ? data
                : [];

        allChannels =
            allChannels.concat(rows);

        if (
            rows.length < pageSize
        ) {
            break;
        }

        from += pageSize;
    }

    state.channels =
        allChannels;

    state.totalChannelCount =
        allChannels.length;

    state.filteredChannels =
        [...allChannels];

    console.log(
        `Channels loaded: ${state.channels.length}`
    );

    validateChannelIntegrity();
}


/* ============================================================
   CHANNEL INTEGRITY
   ============================================================ */

function validateChannelIntegrity() {

    const communityIds =
        new Set(
            state.communities.map(
                community =>
                    String(community.id)
            )
        );

    const orphaned =
        state.channels.filter(
            channel =>
                channel.community_id !== null &&
                channel.community_id !== undefined &&
                !communityIds.has(
                    String(channel.community_id)
                )
        );

    if (orphaned.length) {

        console.warn(
            `⚠️ ${orphaned.length} channels have no matching community.`,
            orphaned
        );
    }

    console.log(
        `📊 Channel integrity: ${state.channels.length} channels loaded.`
    );

    console.log(
        `📊 Communities: ${state.communities.length}`
    );
}


/* ============================================================
   GLOBAL GENERAL
   ============================================================ */

async function ensureGlobalGeneral() {

    /*
     * We DO NOT create anything automatically here.
     *
     * The purpose is to identify the existing global
     * Mwaniki General channel without modifying data.
     */

    const globalCandidates =
        state.channels.filter(
            channel =>
                channel.community_id === null ||
                channel.community_id === undefined
        );

    const general =
        globalCandidates.find(
            channel =>
                normalize(
                    channel.name ||
                    channel.title ||
                    ""
                ) === "general"
        );

    if (general) {

        state.globalGeneral =
            general;

        console.log(
            "🌐 Global Mwaniki General found:",
            general.id
        );

    } else {

        console.log(
            "ℹ️ No global General channel detected."
        );
    }
}


/* ============================================================
   COMMUNITY ICON
   ============================================================ */

function getCommunityIcon(
    community
) {

    const name =
        normalize(
            community?.name ||
            community?.title ||
            ""
        );

    const slug =
        normalize(
            community?.slug ||
            ""
        );

    /*
     * If a real icon URL exists, use it.
     */

    const image =
        community?.icon_url ||
        community?.icon;

    if (
        image &&
        isValidImageUrl(image)
    ) {

        return `
            <img
                src="${escapeAttribute(image)}"
                alt=""
                class="real-community-icon"
            >
        `;
    }

    /*
     * Otherwise use safe emoji/text.
     */

    for (
        const key of Object.keys(
            COMMUNITY_ICONS
        )
    ) {

        if (
            name.includes(key) ||
            slug.includes(key)
        ) {

            return COMMUNITY_ICONS[key];
        }
    }

    return COMMUNITY_ICONS.default;
}


/* ============================================================
   CHANNEL ICON
   ============================================================ */

function getChannelIcon(
    channel
) {

    const raw =
        normalize(
            channel?.name ||
            channel?.title ||
            channel?.slug ||
            ""
        );

    for (
        const key of Object.keys(
            CHANNEL_ICONS
        )
    ) {

        if (raw.includes(key)) {
            return CHANNEL_ICONS[key];
        }
    }

    return CHANNEL_ICONS.default;
}


/* ============================================================
   RENDER COMMUNITIES
   ============================================================ */

function renderCommunities() {

    const container =
        $("communityList");

    if (!container) return;

    container.innerHTML = "";

    if (!state.communities.length) {

        container.innerHTML = `
            <div class="loading-space">
                No communities found.
            </div>
        `;

        return;
    }

    state.communities.forEach(
        community => {

            const channels =
                getChannelsForCommunity(
                    community.id
                );

            const button =
                document.createElement(
                    "button"
                );

            button.type = "button";

            button.className =
                "community-space-item";

            button.dataset.communityId =
                community.id;

            button.innerHTML = `

                <span class="community-icon">
                    ${getCommunityIcon(community)}
                </span>

                <span class="community-space-copy">

                    <strong>
                        ${escapeHtml(
                            community.name ||
                            community.title ||
                            "Community"
                        )}
                    </strong>

                    <small>
                        ${escapeHtml(
                            community.description ||
                            "Community space"
                        )}
                    </small>

                </span>

                <span class="community-channel-count">
                    ${channels.length}
                </span>

            `;

            button.addEventListener(
                "click",
                () => {
                    selectCommunity(
                        community.id
                    );
                }
            );

            container.appendChild(
                button
            );
        }
    );

    renderCommunityModal();
}


/* ============================================================
   CURRENT SPACE
   ============================================================ */

function renderCurrentSpace() {

    if (
        state.currentSpace.type ===
        "home"
    ) {

        setSelectedSpaceUI(
            null
        );

        renderChannelsForHome();

        return;
    }

    const community =
        state.communities.find(
            item =>
                String(item.id) ===
                String(
                    state.currentSpace.id
                )
        );

    if (!community) {

        state.currentSpace = {
            type: "home",
            id: null
        };

        renderChannelsForHome();

        return;
    }

    setSelectedSpaceUI(
        community
    );

    renderChannelsForCommunity(
        community
    );
}


/* ============================================================
   HOME CHANNELS
   ============================================================ */

function renderChannelsForHome() {

    const channels =
        state.channels.filter(
            channel =>
                channel.community_id === null ||
                channel.community_id === undefined
        );

    renderChannelGroups(
        channels,
        "home"
    );
}


/* ============================================================
   COMMUNITY CHANNELS
   ============================================================ */

function renderChannelsForCommunity(
    community
) {

    const channels =
        getChannelsForCommunity(
            community.id
        );

    renderChannelGroups(
        channels,
        "community"
    );
}


/* ============================================================
   GET CHANNELS FOR COMMUNITY
   ============================================================ */

function getChannelsForCommunity(
    communityId
) {

    return state.channels.filter(
        channel =>
            String(
                channel.community_id
            ) ===
            String(communityId)
    );
}


/* ============================================================
   RENDER CHANNEL GROUPS
   ============================================================ */

function renderChannelGroups(
    channels,
    type
) {

    const container =
        $("channelList");

    if (!container) return;

    container.innerHTML = "";

    /*
     * This is deliberately NOT:
     *
     * channels.slice(0, 10)
     *
     * or a hard-coded channel array.
     *
     * EVERY channel passed here is rendered.
     */

    if (!channels.length) {

        container.innerHTML = `
            <div class="empty-channel">
                No channels found in this space.
            </div>
        `;

        return;
    }

    const filtered =
        filterChannels(
            channels,
            $("channelSearch")?.value || ""
        );

    if (!filtered.length) {

        container.innerHTML = `
            <div class="empty-channel">
                No channel matches your search.
            </div>
        `;

        return;
    }

    const groups =
        groupChannels(filtered);

    Object.keys(groups)
        .forEach(
            categoryName => {

                const category =
                    document.createElement(
                        "div"
                    );

                category.className =
                    "channel-category";

                category.innerHTML = `

                    <div class="channel-category-heading">

                        <span>
                            ${getCategoryIcon(
                                categoryName
                            )}
                        </span>

                        <span>
                            ${escapeHtml(
                                categoryName
                            )}
                        </span>

                    </div>

                `;

                groups[
                    categoryName
                ].forEach(
                    channel => {

                        category.appendChild(
                            createChannelElement(
                                channel
                            )
                        );
                    }
                );

                container.appendChild(
                    category
                );
            }
        );
}


/* ============================================================
   GROUP CHANNELS
   ============================================================ */

function groupChannels(
    channels
) {

    const groups = {};

    channels.forEach(
        channel => {

            const category =
                channel.category_name ||
                channel.category ||
                channel.section ||
                inferCategory(
                    channel
                );

            if (!groups[category]) {
                groups[category] = [];
            }

            groups[category].push(
                channel
            );
        }
    );

    return groups;
}


/* ============================================================
   CATEGORY INFERENCE
   ============================================================ */

function inferCategory(
    channel
) {

    const name =
        normalize(
            channel.name ||
            channel.title ||
            ""
        );

    if (
        name.includes("general")
    ) {
        return "GENERAL";
    }

    if (
        name.includes("announcement")
    ) {
        return "ANNOUNCEMENTS";
    }

    if (
        name.includes("voice") ||
        name.includes("call") ||
        name.includes("lounge")
    ) {
        return "VOICE & CALLS";
    }

    if (
        name.includes("game") ||
        name.includes("gaming")
    ) {
        return "GAMING";
    }

    if (
        name.includes("meme")
    ) {
        return "MEMES";
    }

    if (
        name.includes("study") ||
        name.includes("revision")
    ) {
        return "STUDY";
    }

    if (
        name.includes("clinical") ||
        name.includes("case")
    ) {
        return "CLINICAL";
    }

    if (
        name.includes("lab") ||
        name.includes("micro") ||
        name.includes("hema") ||
        name.includes("chem")
    ) {
        return "LABORATORY";
    }

    return "CHANNELS";
}


/* ============================================================
   CATEGORY ICON
   ============================================================ */

function getCategoryIcon(
    category
) {

    const key =
        normalize(category);

    if (
        key.includes("general")
    ) return "💬";

    if (
        key.includes("announcement")
    ) return "📢";

    if (
        key.includes("voice") ||
        key.includes("call")
    ) return "🔊";

    if (
        key.includes("gaming")
    ) return "🎮";

    if (
        key.includes("meme")
    ) return "😂";

    if (
        key.includes("study")
    ) return "📖";

    if (
        key.includes("clinical")
    ) return "🩺";

    if (
        key.includes("laboratory")
    ) return "🧪";

    return "▾";
}


/* ============================================================
   CREATE CHANNEL ELEMENT
   ============================================================ */

function createChannelElement(
    channel
) {

    const button =
        document.createElement(
            "button"
        );

    button.type = "button";

    button.className =
        "channel-row";

    button.dataset.channelId =
        channel.id;

    if (
        state.currentChannel &&
        String(
            state.currentChannel.id
        ) ===
        String(channel.id)
    ) {

        button.classList.add(
            "active"
        );
    }

    button.innerHTML = `

        <span class="channel-row-icon">
            ${getChannelIcon(channel)}
        </span>

        <span class="channel-row-name">
            ${escapeHtml(
                channel.name ||
                channel.title ||
                `Channel ${channel.id}`
            )}
        </span>

    `;

    button.addEventListener(
        "click",
        () => {

            selectChannel(
                channel
            );

        }
    );

    return button;
}


/* ============================================================
   SELECT COMMUNITY
   ============================================================ */

function selectCommunity(
    communityId
) {

    state.currentSpace = {
        type: "community",
        id: communityId
    };

    state.currentChannel =
        null;

    renderCommunities();

    renderCurrentSpace();

    const channels =
        getChannelsForCommunity(
            communityId
        );

    /*
     * Prefer that community's own General.
     */

    const general =
        channels.find(
            channel =>
                normalize(
                    channel.name ||
                    channel.title ||
                    ""
                ) === "general"
        );

    if (general) {

        selectChannel(
            general
        );

    } else if (channels.length) {

        selectChannel(
            channels[0]
        );
    }

    closeMobilePanels();
}


/* ============================================================
   HOME
   ============================================================ */

function selectHome() {

    state.currentSpace = {
        type: "home",
        id: null
    };

    state.currentChannel =
        null;

    renderCommunities();

    renderCurrentSpace();

    const general =
        state.channels.find(
            channel =>
                (
                    channel.community_id === null ||
                    channel.community_id === undefined
                ) &&
                normalize(
                    channel.name ||
                    channel.title ||
                    ""
                ) === "general"
        );

    if (general) {

        selectChannel(
            general
        );

    } else {

        clearChat();

        setChatHeader(
            null
        );
    }

    closeMobilePanels();
}


/* ============================================================
   SELECT CHANNEL
   ============================================================ */

async function selectChannel(
    channel
) {

    if (!channel) return;

    state.currentChannel =
        channel;

    renderCurrentSpace();

    updateChannelActiveState();

    setChatHeader(
        channel
    );

    await loadMessages(
        channel.id
    );

    subscribeToMessages(
        channel.id
    );

    closeMobilePanels();
}


/* ============================================================
   CHAT HEADER
   ============================================================ */

function setChatHeader(
    channel
) {

    if (!channel) {

        $("chatCommunityName")
            .textContent =
            "Mwaniki Scholars";

        $("chatChannelName")
            .textContent =
            "General";

        $("chatChannelIcon")
            .textContent =
            "💬";

        return;
    }

    const community =
        state.communities.find(
            item =>
                String(item.id) ===
                String(channel.community_id)
        );

    const communityName =
        community?.name ||
        (
            channel.community_id === null ||
            channel.community_id === undefined
                ? "Mwaniki Scholars"
                : "Community"
        );

    $("chatCommunityName")
        .textContent =
        communityName;

    $("chatChannelName")
        .textContent =
        channel.name ||
        channel.title ||
        `Channel ${channel.id}`;

    $("chatChannelIcon")
        .textContent =
        getChannelIcon(channel);

    $("chatChannelDescription")
        .textContent =
        channel.description ||
        `Conversation in ${channel.name || "this channel"}.`;

    $("messageInput")
        .placeholder =
        `Message #${channel.name || "channel"}`;
}


/* ============================================================
   ACTIVE CHANNEL
   ============================================================ */

function updateChannelActiveState() {

    document
        .querySelectorAll(
            ".channel-row"
        )
        .forEach(
            element => {

                element.classList.toggle(
                    "active",
                    String(
                        element.dataset.channelId
                    ) ===
                    String(
                        state.currentChannel?.id
                    )
                );
            }
        );
}


/* ============================================================
   LOAD MESSAGES
   ============================================================ */

async function loadMessages(
    channelId
) {

    const container =
        $("messageList");

    const welcome =
        $("welcomeChannel");

    if (!container) return;

    container.innerHTML = "";

    try {

        const {
            data,
            error
        } = await db
            .from("chat_messages")
            .select("*")
            .eq(
                "channel_id",
                channelId
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );

        if (error) {
            throw error;
        }

        state.messages =
            Array.isArray(data)
                ? data
                : [];

        renderMessages();

    } catch (error) {

        console.error(
            "❌ Message loading failed:",
            error
        );

        container.innerHTML = `
            <div class="channel-error">
                Unable to load messages.
            </div>
        `;

        if (welcome) {
            welcome.classList.add(
                "hidden"
            );
        }
    }
}


/* ============================================================
   RENDER MESSAGES
   ============================================================ */

function renderMessages() {

    const list =
        $("messageList");

    const welcome =
        $("welcomeChannel");

    if (!list) return;

    list.innerHTML = "";

    if (!state.messages.length) {

        if (welcome) {

            welcome.classList.remove(
                "hidden"
            );
        }

        return;
    }

    if (welcome) {

        welcome.classList.add(
            "hidden"
        );
    }

    state.messages.forEach(
        message => {

            list.appendChild(
                createMessageElement(
                    message
                )
            );
        }
    );

    const container =
        $("messagesContainer");

    if (container) {

        requestAnimationFrame(
            () => {

                container.scrollTop =
                    container.scrollHeight;
            }
        );
    }
}


/* ============================================================
   MESSAGE ELEMENT
   ============================================================ */

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

    const author =
        getMessageAuthor(
            message
        );

    const created =
        formatTime(
            message.created_at
        );

    const avatar =
        getMessageAvatar(
            message
        );

    const content =
        message.content ||
        message.message ||
        "";

    article.innerHTML = `

        <div class="message-avatar">
            ${avatar}
        </div>

        <div class="message-body">

            <div class="message-meta">

                <strong class="message-author">
                    ${escapeHtml(author)}
                </strong>

                <span class="message-time">
                    ${created}
                </span>

            </div>

            ${
                message.reply_to
                    ? `
                    <div class="message-reply-reference">
                        Replying to another message
                    </div>
                    `
                    : ""
            }

            <div class="message-content">
                ${escapeHtml(content)}
            </div>

            <div class="message-actions">

                <button
                    class="message-action reply-message"
                    type="button"
                >
                    ↩ Reply
                </button>

                <button
                    class="message-action react-message"
                    type="button"
                >
                    ❤️ React
                </button>

                <button
                    class="message-action more-message"
                    type="button"
                >
                    ⋯
                </button>

            </div>

        </div>

    `;

    article
        .querySelector(
            ".reply-message"
        )
        ?.addEventListener(
            "click",
            () => {
                startReply(message);
            }
        );

    article
        .querySelector(
            ".react-message"
        )
        ?.addEventListener(
            "click",
            () => {
                reactToMessage(
                    message
                );
            }
        );

    return article;
}


/* ============================================================
   MESSAGE AUTHOR
   ============================================================ */

function getMessageAuthor(
    message
) {

    return (
        message.author_name ||
        message.sender_name ||
        message.user_name ||
        message.full_name ||
        message.username ||
        (
            message.user_id ===
            state.user?.id
                ? "You"
                : "Community member"
        )
    );
}


/* ============================================================
   MESSAGE AVATAR
   ============================================================ */

function getMessageAvatar(
    message
) {

    const url =
        message.author_avatar ||
        message.avatar_url ||
        message.profile_image ||
        message.user_avatar;

    if (
        url &&
        isValidImageUrl(url)
    ) {

        return `
            <img
                src="${escapeAttribute(url)}"
                alt=""
            >
        `;
    }

    return "👤";
}


/* ============================================================
   SEND MESSAGE
   ============================================================ */

async function sendMessage() {

    if (!state.user) return;

    if (!state.currentChannel) {

        showToast(
            "Select a channel first."
        );

        return;
    }

    const input =
        $("messageInput");

    const content =
        input?.value.trim();

    if (!content) return;

    const payload = {

        channel_id:
            state.currentChannel.id,

        user_id:
            state.user.id,

        content

    };

    if (state.replyTo) {

        payload.reply_to =
            state.replyTo.id;
    }

    try {

        const {
            data,
            error
        } = await db
            .from("chat_messages")
            .insert(
                payload
            )
            .select()
            .single();

        if (error) {
            throw error;
        }

        input.value = "";

        resetReply();

        /*
         * If realtime is active the message will
         * arrive automatically.
         *
         * We also add it locally if it isn't there.
         */

        if (
            data &&
            !state.messages.some(
                item =>
                    String(item.id) ===
                    String(data.id)
            )
        ) {

            state.messages.push(
                data
            );

            renderMessages();
        }

    } catch (error) {

        console.error(
            "❌ Message send failed:",
            error
        );

        showToast(
            "Message could not be sent."
        );
    }
}


/* ============================================================
   REPLY
   ============================================================ */

function startReply(
    message
) {

    state.replyTo =
        message;

    const preview =
        $("replyPreview");

    if (!preview) return;

    preview.classList.remove(
        "hidden"
    );

    $("replyAuthor")
        .textContent =
        getMessageAuthor(
            message
        );

    $("replyText")
        .textContent =
        message.content ||
        message.message ||
        "";

    $("messageInput")
        ?.focus();
}


function resetReply() {

    state.replyTo =
        null;

    $("replyPreview")
        ?.classList.add(
            "hidden"
        );
}


/* ============================================================
   REACTIONS
   ============================================================ */

async function reactToMessage(
    message
) {

    if (!state.user) return;

    /*
     * We deliberately check whether the reactions table exists
     * before attempting to use it.
     */

    try {

        const {
            error
        } = await db
            .from("chat_message_reactions")
            .upsert(
                {
                    message_id:
                        message.id,

                    user_id:
                        state.user.id,

                    reaction:
                        "❤️"
                },
                {
                    onConflict:
                        "message_id,user_id,reaction"
                }
            );

        if (error) {
            throw error;
        }

        showToast(
            "Reaction added ❤️"
        );

    } catch (error) {

        console.error(
            "Reaction failed:",
            error
        );

        showToast(
            "Reaction could not be added."
        );
    }
}


/* ============================================================
   REALTIME
   ============================================================ */

function subscribeToMessages(
    channelId
) {

    if (
        state.messageSubscription
    ) {

        try {
            db.removeChannel(
                state.messageSubscription
            );
        } catch (_) {}
    }

    state.messageSubscription =
        db
            .channel(
                `community-messages-${channelId}`
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_messages",
                    filter:
                        `channel_id=eq.${channelId}`
                },
                payload => {

                    handleRealtimeMessage(
                        payload
                    );
                }
            )
            .subscribe(
                status => {

                    console.log(
                        `📡 Message realtime: ${status}`
                    );
                }
            );
}


/* ============================================================
   REALTIME MESSAGE
   ============================================================ */

function handleRealtimeMessage(
    payload
) {

    const message =
        payload.new;

    if (!message) return;

    if (
        payload.eventType ===
        "INSERT"
    ) {

        const exists =
            state.messages.some(
                item =>
                    String(item.id) ===
                    String(message.id)
            );

        if (!exists) {

            state.messages.push(
                message
            );

            renderMessages();
        }
    }

    if (
        payload.eventType ===
        "DELETE"
    ) {

        state.messages =
            state.messages.filter(
                item =>
                    String(item.id) !==
                    String(payload.old?.id)
            );

        renderMessages();
    }
}


/* ============================================================
   SEARCH CHANNELS
   ============================================================ */

function filterChannels(
    channels,
    query
) {

    const q =
        normalize(query);

    if (!q) {
        return channels;
    }

    return channels.filter(
        channel => {

            const name =
                normalize(
                    channel.name ||
                    channel.title ||
                    ""
                );

            const description =
                normalize(
                    channel.description ||
                    ""
                );

            return (
                name.includes(q) ||
                description.includes(q)
            );
        }
    );
}


/* ============================================================
   GLOBAL SEARCH
   ============================================================ */

function performGlobalSearch(
    query
) {

    const q =
        normalize(query);

    if (!q) {

        renderCommunities();

        renderCurrentSpace();

        return;
    }

    const communities =
        state.communities.filter(
            community => {

                const name =
                    normalize(
                        community.name ||
                        community.title ||
                        ""
                    );

                const description =
                    normalize(
                        community.description ||
                        ""
                    );

                return (
                    name.includes(q) ||
                    description.includes(q)
                );
            }
        );

    state.filteredCommunities =
        communities;

    renderCommunitySearchResults(
        communities
    );
}


/* ============================================================
   COMMUNITY MODAL
   ============================================================ */

function renderCommunityModal() {

    const container =
        $("communityModalList");

    if (!container) return;

    container.innerHTML = "";

    state.communities.forEach(
        community => {

            const channels =
                getChannelsForCommunity(
                    community.id
                );

            const button =
                document.createElement(
                    "button"
                );

            button.type = "button";

            button.className =
                "modal-community-item";

            button.innerHTML = `

                <span class="modal-community-icon">
                    ${getCommunityIcon(community)}
                </span>

                <span class="modal-community-info">

                    <strong>
                        ${escapeHtml(
                            community.name ||
                            community.title ||
                            "Community"
                        )}
                    </strong>

                    <span>
                        ${escapeHtml(
                            community.description ||
                            "Community space"
                        )}
                    </span>

                </span>

                <span class="modal-channel-count">
                    ${channels.length} channels
                </span>

            `;

            button.addEventListener(
                "click",
                () => {

                    selectCommunity(
                        community.id
                    );

                    closeCommunityModal();
                }
            );

            container.appendChild(
                button
            );
        }
    );
}


function renderCommunitySearchResults(
    communities
) {

    const container =
        $("communityModalList");

    if (!container) return;

    container.innerHTML = "";

    communities.forEach(
        community => {

            const channels =
                getChannelsForCommunity(
                    community.id
                );

            const button =
                document.createElement(
                    "button"
                );

            button.type = "button";

            button.className =
                "modal-community-item";

            button.innerHTML = `

                <span class="modal-community-icon">
                    ${getCommunityIcon(community)}
                </span>

                <span class="modal-community-info">

                    <strong>
                        ${escapeHtml(
                            community.name ||
                            community.title ||
                            "Community"
                        )}
                    </strong>

                    <span>
                        ${escapeHtml(
                            community.description ||
                            ""
                        )}
                    </span>

                </span>

                <span class="modal-channel-count">
                    ${channels.length} channels
                </span>

            `;

            button.addEventListener(
                "click",
                () => {

                    selectCommunity(
                        community.id
                    );

                    closeCommunityModal();
                }
            );

            container.appendChild(
                button
            );
        }
    );
}


function openCommunityModal() {

    $("communityOverlay")
        ?.classList.remove(
            "hidden"
        );

    $("communitySearch")
        ?.focus();

    renderCommunityModal();
}


function closeCommunityModal() {

    $("communityOverlay")
        ?.classList.add(
            "hidden"
        );
}


/* ============================================================
   SPACE UI
   ============================================================ */

function setSelectedSpaceUI(
    community
) {

    if (!community) {

        $("selectedSpaceIcon")
            .textContent =
            "🏠";

        $("selectedSpaceName")
            .textContent =
            "Mwaniki Scholars";

        $("selectedSpaceDescription")
            .textContent =
            "Main community";

        return;
    }

    $("selectedSpaceIcon")
        .innerHTML =
        getCommunityIcon(
            community
        );

    $("selectedSpaceName")
        .textContent =
        community.name ||
        community.title ||
        "Community";

    $("selectedSpaceDescription")
        .textContent =
        community.description ||
        "Community space";
}


/* ============================================================
   MOBILE
   ============================================================ */

function openMobileSpaces() {

    $("spacesPanel")
        ?.classList.add(
            "open"
        );
}


function closeMobilePanels() {

    $("spacesPanel")
        ?.classList.remove(
            "open"
        );

    $("channelsPanel")
        ?.classList.remove(
            "open"
        );
}


/* ============================================================
   CLEAR CHAT
   ============================================================ */

function clearChat() {

    state.messages =
        [];

    $("messageList")
        .innerHTML = "";

    $("welcomeChannel")
        ?.classList.remove(
            "hidden"
        );
}


/* ============================================================
   EVENT BINDINGS
   ============================================================ */

function bindEvents() {

    $("homeSpaceButton")
        ?.addEventListener(
            "click",
            selectHome
        );

    $("allCommunitiesButton")
        ?.addEventListener(
            "click",
            openCommunityModal
        );

    $("createCommunityButton")
        ?.addEventListener(
            "click",
            () => {
                showToast(
                    "Community creation can be connected to your existing permissions system."
                );
            }
        );

    $("createChannelButton")
        ?.addEventListener(
            "click",
            () => {
                showToast(
                    "Channel creation can be connected to your existing permissions system."
                );
            }
        );

    $("mobileMenuButton")
        ?.addEventListener(
            "click",
            openMobileSpaces
        );

    $("channelPanelClose")
        ?.addEventListener(
            "click",
            closeMobilePanels
        );

    $("startConversationButton")
        ?.addEventListener(
            "click",
            () => {
                $("messageInput")
                    ?.focus();
            }
        );

    $("sendMessageButton")
        ?.addEventListener(
            "click",
            sendMessage
        );

    $("messageInput")
        ?.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();

                    sendMessage();
                }
            }
        );

    $("messageInput")
        ?.addEventListener(
            "input",
            autoResizeTextarea
        );

    $("cancelReplyButton")
        ?.addEventListener(
            "click",
            resetReply
        );

    $("channelSearch")
        ?.addEventListener(
            "input",
            () => {

                renderCurrentSpace();
            }
        );

    $("globalSearch")
        ?.addEventListener(
            "input",
            event => {

                const value =
                    event.target.value.trim();

                if (!value) {

                    closeCommunityModal();

                    renderCommunities();

                    renderCurrentSpace();

                    return;
                }

                openCommunityModal();

                $("communitySearch")
                    .value =
                    value;

                performCommunityModalSearch(
                    value
                );
            }
        );

    $("communitySearch")
        ?.addEventListener(
            "input",
            event => {

                performCommunityModalSearch(
                    event.target.value
                );
            }
        );

    $("closeCommunityModal")
        ?.addEventListener(
            "click",
            closeCommunityModal
        );

    $("communityOverlay")
        ?.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    $("communityOverlay")
                ) {

                    closeCommunityModal();
                }
            }
        );

    $("notificationButton")
        ?.addEventListener(
            "click",
            toggleNotifications
        );

    $("closeNotificationPanel")
        ?.addEventListener(
            "click",
            () => {

                $("notificationPanel")
                    ?.classList.add(
                        "hidden"
                    );
            }
        );

    $("profileButton")
        ?.addEventListener(
            "click",
            () => {

                $("profilePanel")
                    ?.classList.toggle(
                        "hidden"
                    );
            }
        );

    $("logoutButton")
        ?.addEventListener(
            "click",
            logout
        );

    $("chatSearchButton")
        ?.addEventListener(
            "click",
            toggleMessageSearch
        );

    $("closeMessageSearch")
        ?.addEventListener(
            "click",
            () => {

                $("messageSearchBar")
                    ?.classList.add(
                        "hidden"
                    );
            }
        );

    $("messageSearchInput")
        ?.addEventListener(
            "input",
            filterMessages
        );

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "/" &&
                document.activeElement?.tagName !==
                    "INPUT" &&
                document.activeElement?.tagName !==
                    "TEXTAREA"
            ) {

                event.preventDefault();

                $("globalSearch")
                    ?.focus();
            }

            if (
                event.key === "Escape"
            ) {

                closeCommunityModal();

                closeMobilePanels();

                $("profilePanel")
                    ?.classList.add(
                        "hidden"
                    );

                $("notificationPanel")
                    ?.classList.add(
                        "hidden"
                    );
            }
        }
    );
}


/* ============================================================
   COMMUNITY MODAL SEARCH
   ============================================================ */

function performCommunityModalSearch(
    query
) {

    const q =
        normalize(query);

    if (!q) {

        renderCommunityModal();

        return;
    }

    const matches =
        state.communities.filter(
            community => {

                const name =
                    normalize(
                        community.name ||
                        community.title ||
                        ""
                    );

                const slug =
                    normalize(
                        community.slug ||
                        ""
                    );

                const description =
                    normalize(
                        community.description ||
                        ""
                    );

                return (
                    name.includes(q) ||
                    slug.includes(q) ||
                    description.includes(q)
                );
            }
        );

    renderCommunitySearchResults(
        matches
    );
}


/* ============================================================
   MESSAGE SEARCH
   ============================================================ */

function toggleMessageSearch() {

    const bar =
        $("messageSearchBar");

    if (!bar) return;

    bar.classList.toggle(
        "hidden"
    );

    if (
        !bar.classList.contains(
            "hidden"
        )
    ) {

        $("messageSearchInput")
            ?.focus();
    }
}


function filterMessages() {

    const query =
        normalize(
            $("messageSearchInput")
                ?.value || ""
        );

    document
        .querySelectorAll(
            ".message"
        )
        .forEach(
            messageElement => {

                const text =
                    normalize(
                        messageElement
                            .textContent
                    );

                messageElement.style.display =
                    !query ||
                    text.includes(query)
                        ? ""
                        : "none";
            }
        );
}


/* ============================================================
   NOTIFICATIONS
   ============================================================ */

function toggleNotifications() {

    $("notificationPanel")
        ?.classList.toggle(
            "hidden"
        );
}


/* ============================================================
   LOGOUT
   ============================================================ */

async function logout() {

    try {

        await db.auth.signOut();

        window.location.href =
            "./index.html";

    } catch (error) {

        console.error(
            "Logout failed:",
            error
        );
    }
}


/* ============================================================
   TEXTAREA
   ============================================================ */

function autoResizeTextarea(
    event
) {

    const textarea =
        event.target;

    textarea.style.height =
        "auto";

    textarea.style.height =
        Math.min(
            textarea.scrollHeight,
            130
        ) + "px";
}


/* ============================================================
   UTILITIES
   ============================================================ */

function normalize(
    value
) {

    return String(
        value || ""
    )
        .trim()
        .toLowerCase();
}


function escapeHtml(
    value
) {

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


function escapeAttribute(
    value
) {

    return escapeHtml(
        value
    );
}


function isValidImageUrl(
    value
) {

    if (!value) return false;

    try {

        const url =
            new URL(
                value,
                window.location.origin
            );

        return (
            url.protocol ===
                "http:" ||
            url.protocol ===
                "https:" ||
            url.protocol ===
                "data:"
        );

    } catch (_) {

        return false;
    }
}


function formatTime(
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


function showToast(
    message
) {

    const container =
        $("toastContainer");

    if (!container) return;

    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        "toast";

    toast.textContent =
        message;

    container.appendChild(
        toast
    );

    setTimeout(
        () => {

            toast.remove();

        },
        3500
    );
}


/* ============================================================
   INITIAL CHANNEL
   ============================================================ */

async function selectInitialChannel() {

    /*
     * Always start with Mwaniki's GLOBAL General
     * when it exists.
     */

    const globalGeneral =
        state.channels.find(
            channel =>
                (
                    channel.community_id === null ||
                    channel.community_id === undefined
                ) &&
                normalize(
                    channel.name ||
                    channel.title ||
                    ""
                ) === "general"
        );

    if (globalGeneral) {

        await selectChannel(
            globalGeneral
        );

        return;
    }

    /*
     * Otherwise use the first global channel.
     */

    const globalChannels =
        state.channels.filter(
            channel =>
                channel.community_id === null ||
                channel.community_id === undefined
        );

    if (globalChannels.length) {

        await selectChannel(
            globalChannels[0]
        );

        return;
    }

    /*
     * Finally use the first available channel
     * without deleting or ignoring anything.
     */

    if (state.channels.length) {

        await selectChannel(
            state.channels[0]
        );
    }
}


/* ============================================================
   EXPOSE STATE FOR DEBUGGING
   ============================================================ */

window.MwanikiCommunity = {

    state,

    selectHome,

    selectCommunity,

    selectChannel,

    loadCommunities,

    loadChannels,

    renderCommunities,

    renderCurrentSpace

};


console.log(
    "📞 Mwaniki Universal Call Engine remains available separately."
);
