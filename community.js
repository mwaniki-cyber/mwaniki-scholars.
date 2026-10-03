/* =========================================================
   MWANIKI SCHOLARS COMMUNITY
   community.js
   ========================================================= */

const RULES_VERSION = "mwaniki-community-rules-v1";
const RULES_STORAGE_KEY = "mwanikiCommunityRulesAccepted";

const supabase = window.supabase;

if (!supabase) {
    console.error("❌ Supabase client was not found.");
    throw new Error("Supabase client unavailable.");
}

console.log("🚀 Mwaniki Scholars community engine loaded");


/* =========================================================
   STATE
   ========================================================= */

const state = {
    user: null,
    profile: null,

    communities: [],
    selectedCommunity: null,
    selectedChannel: null,

    channels: [],
    messages: [],

    profiles: new Map(),
    reactions: new Map(),
    messageAttachments: new Map(),

    messagePageSize: 50,
    loadingMessages: false,
    loadingOlderMessages: false,
    hasOlderMessages: false,

    realtimeChannel: null,

    rulesAccepted: false,

    reactionPickerMessageId: null,
    reactionOutsideHandler: null,

    selectedGifUrl: "",
    selectedGifPreview: "",

    selectedCallMode: "voice"
};


/* =========================================================
   DOM HELPERS
   ========================================================= */

const $ = (id) => document.getElementById(id);

function showElement(element) {
    if (element) {
        element.classList.remove("hidden");
    }
}

function hideElement(element) {
    if (element) {
        element.classList.add("hidden");
    }
}

function setText(id, value) {
    const element = $(id);

    if (element) {
        element.textContent = value ?? "";
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
    return escapeHtml(value);
}

function announce(message) {
    const element = $("communityStatus");

    if (element) {
        element.textContent = message;
    }
}

function toast(message, type = "info") {
    const element = $("communityToast");

    if (!element) {
        console.log(message);
        return;
    }

    element.textContent = message;
    element.dataset.type = type;

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
        element.textContent = "";
        element.dataset.type = "";
    }, 3500);
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeCommunity
);

async function initializeCommunity() {
    try {
        wireInterface();

        state.rulesAccepted = readRulesAgreement();

        if (!state.rulesAccepted) {
            showRulesGate();
        } else {
            hideRulesGate();
        }

        const {
            data: { session },
            error
        } = await supabase.auth.getSession();

        if (error) {
            console.error("❌ Session error:", error);
        }

        state.user = session?.user || null;

        if (!state.user) {
            toast(
                "Please sign in to use the community.",
                "error"
            );
            return;
        }

        /*
         * Load current user's profile.
         */
        await loadOwnProfile();

        /*
         * Load communities immediately.
         */
        await loadCommunities();

        /*
         * IMPORTANT:
         * If rules have already been accepted,
         * enter the community automatically.
         *
         * The globe/community button is NOT required.
         */
        if (state.rulesAccepted) {
            await enterCommunity();
        }

        setupAuthListener();

        console.log("✅ Community initialized");

        console.log(
            "🌐 Current community:",
            state.selectedCommunity?.name || "None"
        );

        console.log(
            "📢 Current channels:",
            state.channels.length
        );

    } catch (error) {
        console.error(
            "❌ Community initialization failed:",
            error
        );

        toast(
            "The community could not be loaded.",
            "error"
        );
    }
}


/* =========================================================
   AUTH
   ========================================================= */

function setupAuthListener() {
    supabase.auth.onAuthStateChange(
        async (event, session) => {
            state.user = session?.user || null;

            if (event === "SIGNED_OUT") {
                state.profile = null;
                state.profiles.clear();

                if (state.realtimeChannel) {
                    await supabase.removeChannel(
                        state.realtimeChannel
                    );

                    state.realtimeChannel = null;
                }

                window.location.href =
                    "./index.html";

                return;
            }

            if (event === "SIGNED_IN") {
                await loadOwnProfile();

                if (state.rulesAccepted) {
                    await loadCommunities();
                    await enterCommunity();
                }
            }
        }
    );
}


/* =========================================================
   PROFILE SYSTEM
   ========================================================= */

async function loadOwnProfile() {
    if (!state.user) {
        return null;
    }

    const {
        data,
        error
    } = await supabase
        .from("students")
        .select(
            "id,full_name,email,course,level,photo_url"
        )
        .eq("id", state.user.id)
        .maybeSingle();

    if (error) {
        console.error(
            "❌ Could not load own student profile:",
            error
        );

        return null;
    }

    if (!data) {
        console.warn(
            "⚠️ No student profile found for current user."
        );

        return null;
    }

    state.profile = data;

    state.profiles.set(
        data.id,
        {
            id: data.id,
            full_name: data.full_name || "Student",
            photo_url: data.photo_url || ""
        }
    );

    updateProfileInterface();

    return data;
}


async function loadProfilesForUsers(userIds) {
    const ids = [
        ...new Set(
            (userIds || [])
                .filter(Boolean)
                .map(String)
        )
    ];

    if (!ids.length) {
        return;
    }

    const missingIds = ids.filter(
        id => !state.profiles.has(id)
    );

    if (!missingIds.length) {
        return;
    }

    /*
     * IMPORTANT:
     * Other users are loaded through the safe
     * chat_public_profiles view rather than exposing
     * students.email or students.phone.
     */
    const {
        data,
        error
    } = await supabase
        .from("chat_public_profiles")
        .select(
            "id,full_name,photo_url"
        )
        .in("id", missingIds);

    if (error) {
        console.error(
            "❌ Could not load community profiles:",
            error
        );

        for (const id of missingIds) {
            state.profiles.set(
                id,
                {
                    id,
                    full_name: "Student",
                    photo_url: ""
                }
            );
        }

        return;
    }

    for (const profile of data || []) {
        state.profiles.set(
            profile.id,
            {
                id: profile.id,
                full_name:
                    profile.full_name ||
                    "Student",
                photo_url:
                    profile.photo_url ||
                    ""
            }
        );
    }

    for (const id of missingIds) {
        if (!state.profiles.has(id)) {
            state.profiles.set(
                id,
                {
                    id,
                    full_name: "Student",
                    photo_url: ""
                }
            );
        }
    }
}


function getProfile(userId) {
    return (
        state.profiles.get(userId) ||
        {
            id: userId,
            full_name: "Student",
            photo_url: ""
        }
    );
}


function getInitials(name) {
    const clean = String(
        name || "Student"
    )
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!clean.length) {
        return "S";
    }

    if (clean.length === 1) {
        return clean[0]
            .substring(0, 2)
            .toUpperCase();
    }

    return (
        clean[0].charAt(0) +
        clean[clean.length - 1].charAt(0)
    ).toUpperCase();
}


function updateProfileInterface() {
    if (!state.profile) {
        return;
    }

    const name =
        state.profile.full_name ||
        "Student";

    const photo =
        state.profile.photo_url ||
        "";

    const imageIds = [
        "railProfileAvatar",
        "sidebarProfileAvatar"
    ];

    for (const id of imageIds) {
        const image = $(id);

        if (!image) {
            continue;
        }

        if (photo) {
            image.src = photo;
            image.alt = name;
        } else {
            image.removeAttribute("src");
            image.alt = getInitials(name);
        }
    }

    setText(
        "sidebarProfileName",
        name
    );
}


/* =========================================================
   COMMUNITY RULES
   ========================================================= */

function readRulesAgreement() {
    try {
        return (
            localStorage.getItem(
                RULES_STORAGE_KEY
            ) === RULES_VERSION
        );
    } catch {
        return false;
    }
}


function saveRulesAgreement() {
    try {
        localStorage.setItem(
            RULES_STORAGE_KEY,
            RULES_VERSION
        );
    } catch (error) {
        console.warn(
            "Could not save community rules:",
            error
        );
    }

    state.rulesAccepted = true;
}


function showRulesGate() {
    const gate =
        $("communityRulesGate");

    if (gate) {
        gate.classList.remove("hidden");
    }

    document.body.classList.add(
        "community-rules-open"
    );
}


function hideRulesGate() {
    const gate =
        $("communityRulesGate");

    if (gate) {
        gate.classList.add("hidden");
    }

    document.body.classList.remove(
        "community-rules-open"
    );
}


function handleRulesAgreement() {
    const checkbox =
        $("communityRulesAgreement");

    const button =
        $("acceptCommunityRulesButton");

    if (button) {
        button.disabled =
            !checkbox?.checked;
    }
}


async function acceptCommunityRules() {
    const checkbox =
        $("communityRulesAgreement");

    if (!checkbox?.checked) {
        return;
    }

    saveRulesAgreement();
    hideRulesGate();

    const message =
        $("rulesGateMessage");

    if (message) {
        message.textContent = "";
    }

    await enterCommunity();
}


/* =========================================================
   COMMUNITIES
   ========================================================= */

async function loadCommunities() {
    const {
        data,
        error
    } = await supabase
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
        .order("name", {
            ascending: true
        });

    if (error) {
        console.error(
            "❌ Failed to load communities:",
            error
        );

        toast(
            "Could not load communities.",
            "error"
        );

        return;
    }

    state.communities = data || [];

    /*
     * If there is no selected community,
     * automatically choose General Chat first.
     */
    if (!state.selectedCommunity) {
        state.selectedCommunity =
            state.communities.find(
                community =>
                    String(
                        community.slug || ""
                    ).toLowerCase() ===
                    "general-chat"
            ) ||
            state.communities.find(
                community =>
                    String(
                        community.name || ""
                    ).toLowerCase() ===
                    "general chat"
            ) ||
            state.communities[0] ||
            null;
    }

    renderCommunityRail();
    renderCommunityChoices();

    if (state.selectedCommunity) {
        updateSelectedCommunityInterface();
    }
}


function renderCommunityRail() {
    const container =
        $("communityRailList");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    for (const community of state.communities) {
        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            "rail-community-button";

        if (
            state.selectedCommunity &&
            community.id ===
                state.selectedCommunity.id
        ) {
            button.classList.add("active");
        }

        button.title =
            community.name;

        button.innerHTML =
            renderCommunityIcon(
                community.icon_url,
                community.name
            );

        button.addEventListener(
            "click",
            async () => {
                await selectCommunity(
                    community.id
                );
            }
        );

        container.appendChild(button);
    }
}


function renderCommunityChoices(filter = "") {
    const container =
        $("communityChoiceList");

    if (!container) {
        return;
    }

    const search =
        String(filter)
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

    container.innerHTML = "";

    if (!communities.length) {
        container.innerHTML = `
            <div class="empty-list">
                No communities found.
            </div>
        `;

        return;
    }

    for (const community of communities) {
        const button =
            document.createElement("button");

        button.type = "button";
        button.className =
            "community-choice";

        button.innerHTML = `
            <span class="community-choice-icon">
                ${renderCommunityIcon(
                    community.icon_url,
                    community.name
                )}
            </span>

            <span class="community-choice-info">
                <strong>
                    ${escapeHtml(
                        community.name
                    )}
                </strong>

                <small>
                    ${escapeHtml(
                        community.description ||
                        "Community"
                    )}
                </small>
            </span>
        `;

        button.addEventListener(
            "click",
            async () => {
                await selectCommunity(
                    community.id
                );

                closeCommunityModal();
            }
        );

        container.appendChild(button);
    }
}


function renderCommunityIcon(
    icon,
    name
) {
    if (
        icon &&
        (
            icon.startsWith("http://") ||
            icon.startsWith("https://") ||
            icon.startsWith("/")
        )
    ) {
        return `
            <img
                src="${escapeAttribute(icon)}"
                alt="${escapeAttribute(
                    name || "Community"
                )}"
                class="community-icon-image"
            >
        `;
    }

    return escapeHtml(
        icon || "🌐"
    );
}


async function selectCommunity(
    communityId
) {
    const community =
        state.communities.find(
            item =>
                item.id === communityId
        );

    if (!community) {
        return;
    }

    console.log(
        "🌐 Switching community:",
        community.name
    );

    state.selectedCommunity =
        community;

    state.selectedChannel = null;
    state.channels = [];
    state.messages = [];

    state.reactions.clear();
    state.messageAttachments.clear();

    renderCommunityRail();

    updateSelectedCommunityInterface();

    /*
     * Automatically load this community's
     * channels.
     */
    await loadChannels(
        community.id
    );
}


function updateSelectedCommunityInterface() {
    const community =
        state.selectedCommunity;

    if (!community) {
        return;
    }

    setText(
        "selectedCommunityName",
        community.name
    );

    setText(
        "selectedCommunityDescription",
        community.description ||
        "Community"
    );

    const icon =
        $("selectedCommunityIcon");

    if (icon) {
        icon.innerHTML =
            renderCommunityIcon(
                community.icon_url,
                community.name
            );
    }

    setText(
        "communityBrandTitle",
        "Mwaniki Scholars"
    );

    setText(
        "communityBrandSubtitle",
        community.name
    );
}


/* =========================================================
   CHANNELS
   ========================================================= */

async function loadChannels(
    communityId
) {
    if (!communityId) {
        console.warn(
            "⚠️ No community ID supplied."
        );

        state.channels = [];
        state.selectedChannel = null;

        renderChannels();
        clearChannelInterface();

        return;
    }

    console.log(
        "📡 Loading channels automatically for:",
        communityId
    );

    /*
     * Clear previous channel state.
     */
    state.channels = [];
    state.selectedChannel = null;

    renderChannels();

    const {
        data,
        error
    } = await supabase
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

    if (error) {
        console.error(
            "❌ Failed to load channels:",
            error
        );

        state.channels = [];

        renderChannels();

        clearChannelInterface();

        toast(
            "Could not load channels.",
            "error"
        );

        return;
    }

    state.channels = data || [];

    console.log(
        `✅ ${state.channels.length} channel(s) loaded automatically.`
    );

    /*
     * Render channels immediately.
     */
    renderChannels();

    /*
     * No channels available.
     */
    if (!state.channels.length) {
        state.selectedChannel = null;

        clearChannelInterface();

        return;
    }

    /*
     * Prefer #general.
     */
    const defaultChannel =
        state.channels.find(
            channel =>
                String(
                    channel.slug || ""
                ).toLowerCase() ===
                "general"
        ) ||
        state.channels.find(
            channel =>
                String(
                    channel.name || ""
                ).toLowerCase() ===
                "general"
        ) ||
        state.channels[0];

    console.log(
        "📌 Automatically selecting:",
        defaultChannel.name
    );

    await selectChannel(
        defaultChannel.id
    );
}


function renderChannels(filter = "") {
    const container =
        $("channelList");

    if (!container) {
        return;
    }

    const search =
        String(filter)
            .trim()
            .toLowerCase();

    /*
     * No channels loaded yet.
     */
    if (!state.channels.length) {
        container.innerHTML = `
            <div class="channel-empty">
                Loading channels...
            </div>
        `;

        return;
    }

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

    container.innerHTML = "";

    if (!channels.length) {
        container.innerHTML = `
            <div class="channel-empty">
                No matching channels found.
            </div>
        `;

        return;
    }

    for (const channel of channels) {
        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            "channel-button";

        if (
            state.selectedChannel &&
            channel.id ===
                state.selectedChannel.id
        ) {
            button.classList.add("active");
        }

        button.innerHTML = `
            <span class="channel-button-icon">
                ${escapeHtml(
                    channel.icon || "#"
                )}
            </span>

            <span class="channel-button-name">
                ${escapeHtml(
                    channel.name
                )}
            </span>
        `;

        button.addEventListener(
            "click",
            async () => {
                await selectChannel(
                    channel.id
                );
            }
        );

        container.appendChild(button);
    }
}


async function selectChannel(
    channelId
) {
    const channel =
        state.channels.find(
            item =>
                item.id === channelId
        );

    if (!channel) {
        return;
    }

    console.log(
        "📢 Selecting channel:",
        channel.name
    );

    state.selectedChannel =
        channel;

    state.messages = [];

    state.reactions.clear();
    state.messageAttachments.clear();

    renderChannels();

    updateSelectedChannelInterface();

    await loadMessages(true);

    await subscribeToChannel(
        channel.id
    );
}


function updateSelectedChannelInterface() {
    const channel =
        state.selectedChannel;

    if (!channel) {
        return;
    }

    setText(
        "mainChannelTitle",
        channel.name
    );

    setText(
        "mainChannelDescription",
        channel.description ||
        "Community discussion"
    );

    setText(
        "mainChannelIcon",
        channel.icon || "#"
    );

    const input =
        $("messageInput");

    if (input) {
        input.placeholder =
            `Message #${channel.name}`;
    }
}


function clearChannelInterface() {
    setText(
        "mainChannelTitle",
        "No channels"
    );

    setText(
        "mainChannelDescription",
        "This community has no available channels."
    );

    setText(
        "mainChannelIcon",
        "#"
    );

    const messageList =
        $("messageList");

    if (messageList) {
        messageList.innerHTML = "";
    }

    showElement(
        $("messageEmptyState")
    );
}


/* =========================================================
   MESSAGES
   ========================================================= */

async function loadMessages(
    reset = true
) {
    if (
        !state.selectedChannel ||
        state.loadingMessages
    ) {
        return;
    }

    state.loadingMessages = true;

    try {
        let query =
            supabase
                .from("chat_messages")
                .select(`
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
                `)
                .eq(
                    "channel_id",
                    state.selectedChannel.id
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                )
                .limit(
                    state.messagePageSize + 1
                );

        if (
            !reset &&
            state.messages.length
        ) {
            const oldest =
                state.messages[0];

            query =
                query.lt(
                    "created_at",
                    oldest.created_at
                );
        }

        const {
            data,
            error
        } = await query;

        if (error) {
            console.error(
                "❌ Failed to load messages:",
                error
            );

            toast(
                "Could not load messages.",
                "error"
            );

            return;
        }

        const rows = data || [];

        state.hasOlderMessages =
            rows.length >
            state.messagePageSize;

        const page =
            rows
                .slice(
                    0,
                    state.messagePageSize
                )
                .reverse();

        if (reset) {
            state.messages = page;
        } else {
            state.messages = [
                ...page,
                ...state.messages
            ];
        }

        /*
         * Load profiles.
         */
        await loadProfilesForUsers(
            state.messages.map(
                message =>
                    message.user_id
            )
        );

        /*
         * Load reactions.
         */
        await loadReactionsForMessages(
            state.messages.map(
                message =>
                    message.id
            )
        );

        /*
         * Load attachments.
         */
        await loadAttachmentsForMessages(
            state.messages
        );

        renderMessages();

    } finally {
        state.loadingMessages = false;
    }
}


async function loadOlderMessages() {
    if (
        state.loadingOlderMessages ||
        !state.hasOlderMessages
    ) {
        return;
    }

    state.loadingOlderMessages = true;

    const messageList =
        $("messageList");

    const previousHeight =
        messageList?.scrollHeight || 0;

    const previousTop =
        messageList?.scrollTop || 0;

    try {
        await loadMessages(false);

        if (messageList) {
            const newHeight =
                messageList.scrollHeight;

            messageList.scrollTop =
                newHeight -
                previousHeight +
                previousTop;
        }

    } finally {
        state.loadingOlderMessages = false;
    }
}


/* =========================================================
   MESSAGE RENDERING
   ========================================================= */

function renderMessages() {
    const container =
        $("messageList");

    const emptyState =
        $("messageEmptyState");

    if (!container) {
        return;
    }

    if (!state.messages.length) {
        container.innerHTML = "";

        if (emptyState) {
            showElement(emptyState);
        }

        updateOlderMessagesButton();

        return;
    }

    if (emptyState) {
        hideElement(emptyState);
    }

    const shouldStick =
        isNearBottom(container);

    container.innerHTML =
        state.messages
            .map(renderMessage)
            .join("");

    bindMessageActions();

    updateOlderMessagesButton();

    if (shouldStick) {
        requestAnimationFrame(
            scrollToBottom
        );
    }
}


function renderMessage(message) {
    const profile =
        getProfile(
            message.user_id
        );

    const name =
        profile.full_name ||
        "Student";

    const ownMessage =
        state.user &&
        message.user_id ===
            state.user.id;

    const deleted =
        Boolean(
            message.is_deleted
        );

    const timestamp =
        formatMessageTime(
            message.created_at
        );

    const avatar =
        renderAvatar(
            profile,
            name
        );

    const content =
        deleted
            ? `
                <div class="message-deleted">
                    This message was deleted.
                </div>
            `
            : renderMessageContent(
                message
            );

    const edited =
        message.is_edited &&
        !deleted
            ? `
                <span class="message-edited">
                    (edited)
                </span>
            `
            : "";

    return `
        <article
            class="message-row ${
                ownMessage
                    ? "own-message"
                    : ""
            }"
            data-message-id="${escapeAttribute(
                message.id
            )}"
        >

            <div class="message-avatar">
                ${avatar}
            </div>

            <div class="message-body">

                <div class="message-meta">

                    <strong class="message-author">
                        ${escapeHtml(name)}
                    </strong>

                    <span class="message-time">
                        ${escapeHtml(
                            timestamp
                        )}
                    </span>

                    ${edited}

                </div>

                <div class="message-content">
                    ${content}
                </div>

                ${renderMessageAttachments(
                    message.id
                )}

                ${renderReactions(
                    message.id
                )}

                <div class="message-actions">

                    <button
                        type="button"
                        class="message-action-button"
                        data-action="reply"
                        data-message-id="${escapeAttribute(
                            message.id
                        )}"
                    >
                        Reply
                    </button>

                    <button
                        type="button"
                        class="message-action-button"
                        data-action="react"
                        data-message-id="${escapeAttribute(
                            message.id
                        )}"
                    >
                        React
                    </button>

                    ${
                        ownMessage &&
                        !deleted
                            ? `
                                <button
                                    type="button"
                                    class="message-action-button danger"
                                    data-action="delete"
                                    data-message-id="${escapeAttribute(
                                        message.id
                                    )}"
                                >
                                    Delete
                                </button>
                            `
                            : ""
                    }

                </div>

                <div
                    class="reaction-picker hidden"
                    data-reaction-picker="${escapeAttribute(
                        message.id
                    )}"
                >
                    ${renderReactionButtons(
                        message.id
                    )}
                </div>

            </div>
        </article>
    `;
}


function renderAvatar(
    profile,
    name
) {
    if (profile.photo_url) {
        return `
            <img
                src="${escapeAttribute(
                    profile.photo_url
                )}"
                alt="${escapeAttribute(
                    name
                )}"
                loading="lazy"
                onerror="
                    this.style.display='none';
                    this.nextElementSibling?.classList.remove('hidden');
                "
            >

            <span class="avatar-initials hidden">
                ${escapeHtml(
                    getInitials(name)
                )}
            </span>
        `;
    }

    return `
        <span class="avatar-initials">
            ${escapeHtml(
                getInitials(name)
            )}
        </span>
    `;
}


function renderMessageContent(
    message
) {
    const content =
        String(
            message.content || ""
        );

    if (
        message.message_type ===
            "gif" &&
        isSafeImageUrl(content)
    ) {
        return `
            <div class="message-gif">
                <img
                    src="${escapeAttribute(
                        content
                    )}"
                    alt="GIF"
                    loading="lazy"
                >
            </div>
        `;
    }

    return `
        <div class="message-text">
            ${formatMessageText(
                content
            )}
        </div>
    `;
}


function formatMessageText(text) {
    const escaped =
        escapeHtml(text);

    return escaped
        .replace(
            /\n/g,
            "<br>"
        )
        .replace(
            /(https?:\/\/[^\s<]+)/g,
            `<a
                href="$1"
                target="_blank"
                rel="noopener noreferrer"
            >$1</a>`
        );
}


function isSafeImageUrl(url) {
    try {
        const parsed =
            new URL(url);

        return (
            parsed.protocol ===
                "https:" ||
            parsed.protocol ===
                "http:"
        );
    } catch {
        return false;
    }
}


/* =========================================================
   ATTACHMENTS
   ========================================================= */

function renderMessageAttachments(
    messageId
) {
    const attachments =
        state.messageAttachments.get(
            messageId
        ) || [];

    if (!attachments.length) {
        return "";
    }

    return `
        <div class="message-attachments">

            ${attachments
                .map(attachment => {
                    const image =
                        attachment
                            .mime_type
                            ?.startsWith(
                                "image/"
                            );

                    if (
                        image &&
                        attachment.file_url
                    ) {
                        return `
                            <a
                                class="attachment-image"
                                href="${escapeAttribute(
                                    attachment.file_url
                                )}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <img
                                    src="${escapeAttribute(
                                        attachment.file_url
                                    )}"
                                    alt="${escapeAttribute(
                                        attachment.file_name
                                    )}"
                                    loading="lazy"
                                >
                            </a>
                        `;
                    }

                    return `
                        <a
                            class="attachment-file"
                            href="${escapeAttribute(
                                attachment.file_url ||
                                "#"
                            )}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            📎

                            <span>
                                ${escapeHtml(
                                    attachment.file_name ||
                                    "Attachment"
                                )}
                            </span>
                        </a>
                    `;
                })
                .join("")}

        </div>
    `;
}


async function loadAttachmentsForMessages(
    messages
) {
    const ids =
        (messages || [])
            .map(
                message =>
                    message.id
            )
            .filter(Boolean);

    state.messageAttachments.clear();

    if (!ids.length) {
        return;
    }

    const {
        data,
        error
    } = await supabase
        .from("chat_attachments")
        .select(`
            id,
            message_id,
            uploaded_by,
            file_name,
            file_path,
            file_url,
            mime_type,
            file_size,
            created_at
        `)
        .in(
            "message_id",
            ids
        )
        .order(
            "created_at",
            {
                ascending: true
            }
        );

    if (error) {
        console.error(
            "❌ Could not load message attachments:",
            error
        );

        return;
    }

    for (const attachment of data || []) {
        if (
            !state.messageAttachments.has(
                attachment.message_id
            )
        ) {
            state.messageAttachments.set(
                attachment.message_id,
                []
            );
        }

        state.messageAttachments
            .get(
                attachment.message_id
            )
            .push(attachment);
    }
}


/* =========================================================
   REACTIONS
   ========================================================= */

async function loadReactionsForMessages(
    messageIds
) {
    state.reactions.clear();

    const ids = [
        ...new Set(
            messageIds || []
        )
    ];

    if (!ids.length) {
        return;
    }

    const {
        data,
        error
    } = await supabase
        .from(
            "chat_message_reactions"
        )
        .select(`
            id,
            message_id,
            user_id,
            reaction,
            created_at
        `)
        .in(
            "message_id",
            ids
        );

    if (error) {
        console.error(
            "❌ Failed to load reactions:",
            error
        );

        return;
    }

    for (const reaction of data || []) {
        if (
            !state.reactions.has(
                reaction.message_id
            )
        ) {
            state.reactions.set(
                reaction.message_id,
                []
            );
        }

        state.reactions
            .get(
                reaction.message_id
            )
            .push(reaction);
    }
}


function renderReactions(
    messageId
) {
    const reactions =
        state.reactions.get(
            messageId
        ) || [];

    if (!reactions.length) {
        return "";
    }

    const grouped =
        new Map();

    for (const reaction of reactions) {
        if (
            !grouped.has(
                reaction.reaction
            )
        ) {
            grouped.set(
                reaction.reaction,
                []
            );
        }

        grouped
            .get(
                reaction.reaction
            )
            .push(
                reaction.user_id
            );
    }

    return `
        <div class="message-reactions">

            ${[
                ...grouped.entries()
            ]
                .map(
                    ([emoji, users]) => `
                        <button
                            type="button"
                            class="reaction-chip ${
                                users.includes(
                                    state.user?.id
                                )
                                    ? "selected"
                                    : ""
                            }"
                            data-reaction="${escapeAttribute(
                                emoji
                            )}"
                            data-message-id="${escapeAttribute(
                                messageId
                            )}"
                        >
                            ${escapeHtml(
                                emoji
                            )}

                            <span>
                                ${users.length}
                            </span>
                        </button>
                    `
                )
                .join("")}

        </div>
    `;
}


function renderReactionButtons(
    messageId
) {
    const emojis = [
        "👍",
        "❤️",
        "😂",
        "🎉",
        "👏",
        "🔥",
        "💯",
        "🙏",
        "😍",
        "🥰",
        "😎",
        "🤔",
        "😢",
        "😡",
        "🤯",
        "🙌",
        "💪",
        "✨",
        "✅"
    ];

    return emojis
        .map(
            emoji => `
                <button
                    type="button"
                    class="reaction-choice"
                    data-reaction="${escapeAttribute(
                        emoji
                    )}"
                    data-message-id="${escapeAttribute(
                        messageId
                    )}"
                >
                    ${emoji}
                </button>
            `
        )
        .join("");
}


function openReactionPicker(
    messageId
) {
    closeReactionPicker();

    const selector =
        `[data-reaction-picker="${CSS.escape(
            messageId
        )}"]`;

    const picker =
        document.querySelector(
            selector
        );

    if (!picker) {
        return;
    }

    picker.classList.remove(
        "hidden"
    );

    state.reactionPickerMessageId =
        messageId;

    state.reactionOutsideHandler =
        event => {
            const target =
                event.target;

            if (
                picker.contains(target)
            ) {
                return;
            }

            const reactButton =
                target.closest?.(
                    `[data-action="react"][data-message-id="${CSS.escape(
                        messageId
                    )}"]`
                );

            if (reactButton) {
                return;
            }

            closeReactionPicker();
        };

    setTimeout(() => {
        document.addEventListener(
            "click",
            state.reactionOutsideHandler
        );
    }, 0);
}


function closeReactionPicker() {
    document
        .querySelectorAll(
            ".reaction-picker"
        )
        .forEach(element => {
            element.classList.add(
                "hidden"
            );
        });

    if (
        state.reactionOutsideHandler
    ) {
        document.removeEventListener(
            "click",
            state.reactionOutsideHandler
        );
    }

    state.reactionOutsideHandler =
        null;

    state.reactionPickerMessageId =
        null;
}


async function toggleReaction(
    messageId,
    reaction
) {
    if (!state.user) {
        return;
    }

    const {
        data: existing,
        error: lookupError
    } = await supabase
        .from(
            "chat_message_reactions"
        )
        .select("id")
        .eq(
            "message_id",
            messageId
        )
        .eq(
            "user_id",
            state.user.id
        )
        .eq(
            "reaction",
            reaction
        )
        .maybeSingle();

    if (lookupError) {
        console.error(
            "Reaction lookup failed:",
            lookupError
        );

        return;
    }

    if (existing) {
        const {
            error
        } = await supabase
            .from(
                "chat_message_reactions"
            )
            .delete()
            .eq(
                "id",
                existing.id
            );

        if (error) {
            console.error(
                "Reaction removal failed:",
                error
            );

            return;
        }

    } else {
        const {
            error
        } = await supabase
            .from(
                "chat_message_reactions"
            )
            .insert({
                message_id:
                    messageId,
                user_id:
                    state.user.id,
                reaction
            });

        if (error) {
            console.error(
                "Reaction insertion failed:",
                error
            );

            return;
        }
    }

    await loadReactionsForMessages(
        state.messages.map(
            message =>
                message.id
        )
    );

    renderMessages();
}


/* =========================================================
   MESSAGE ACTIONS
   ========================================================= */

function bindMessageActions() {
    document
        .querySelectorAll(
            "[data-action]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                handleMessageAction
            );
        });

    document
        .querySelectorAll(
            ".reaction-choice"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                async event => {
                    event.stopPropagation();

                    const messageId =
                        button.dataset
                            .messageId;

                    const reaction =
                        button.dataset
                            .reaction;

                    closeReactionPicker();

                    await toggleReaction(
                        messageId,
                        reaction
                    );
                }
            );
        });

    document
        .querySelectorAll(
            ".reaction-chip"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                async () => {
                    await toggleReaction(
                        button.dataset
                            .messageId,
                        button.dataset
                            .reaction
                    );
                }
            );
        });
}


async function handleMessageAction(
    event
) {
    const button =
        event.currentTarget;

    const action =
        button.dataset.action;

    const messageId =
        button.dataset.messageId;

    if (!messageId) {
        return;
    }

    if (action === "react") {
        event.stopPropagation();

        openReactionPicker(
            messageId
        );

        return;
    }

    if (action === "reply") {
        beginReply(messageId);
        return;
    }

    if (action === "delete") {
        await deleteMessage(
            messageId
        );
    }
}


function beginReply(messageId) {
    const message =
        state.messages.find(
            item =>
                item.id === messageId
        );

    if (!message) {
        return;
    }

    const input =
        $("messageInput");

    if (!input) {
        return;
    }

    input.dataset.replyTo =
        messageId;

    const profile =
        getProfile(
            message.user_id
        );

    input.placeholder =
        `Reply to ${
            profile.full_name ||
            "Student"
        }...`;

    input.focus();

    toast(
        "Reply mode enabled."
    );
}


/* =========================================================
   DELETE MESSAGE
   ========================================================= */

async function deleteMessage(
    messageId
) {
    const message =
        state.messages.find(
            item =>
                item.id === messageId
        );

    if (
        !message ||
        !state.user
    ) {
        return;
    }

    if (
        message.user_id !==
        state.user.id
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

    const {
        error
    } = await supabase
        .from(
            "chat_messages"
        )
        .update({
            is_deleted: true,
            deleted_at:
                new Date()
                    .toISOString(),
            updated_at:
                new Date()
                    .toISOString()
        })
        .eq(
            "id",
            messageId
        )
        .eq(
            "user_id",
            state.user.id
        );

    if (error) {
        console.error(
            "❌ Message deletion failed:",
            error
        );

        toast(
            "The message could not be deleted.",
            "error"
        );

        return;
    }

    /*
     * Update locally immediately.
     */
    const localMessage =
        state.messages.find(
            item =>
                item.id === messageId
        );

    if (localMessage) {
        localMessage.is_deleted =
            true;

        localMessage.deleted_at =
            new Date()
                .toISOString();
    }

    renderMessages();

    toast(
        "Message deleted."
    );
}


/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage(
    event
) {
    event?.preventDefault();

    if (!state.rulesAccepted) {
        showRulesGate();
        return;
    }

    if (!state.selectedChannel) {
        toast(
            "Select a channel first.",
            "error"
        );

        return;
    }

    if (!state.user) {
        toast(
            "You must be signed in.",
            "error"
        );

        return;
    }

    const input =
        $("messageInput");

    if (!input) {
        return;
    }

    const content =
        input.value.trim();

    const files = [
        ...(
            $("attachmentInput")
                ?.files || []
        )
    ];

    if (
        !content &&
        !files.length
    ) {
        return;
    }

    const sendButton =
        $("sendMessageButton");

    if (sendButton) {
        sendButton.disabled =
            true;
    }

    try {
        const replyTo =
            input.dataset.replyTo ||
            null;

        const {
            data: message,
            error
        } = await supabase
            .from(
                "chat_messages"
            )
            .insert({
                channel_id:
                    state.selectedChannel.id,

                user_id:
                    state.user.id,

                parent_message_id:
                    replyTo,

                content:
                    content || null,

                message_type:
                    files.length
                        ? "file"
                        : "text"
            })
            .select(`
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
            `)
            .single();

        if (error) {
            console.error(
                "❌ Message send failed:",
                error
            );

            toast(
                "Message could not be sent.",
                "error"
            );

            return;
        }

        if (files.length) {
            await uploadAttachments(
                message.id,
                files
            );
        }

        input.value = "";

        delete input.dataset.replyTo;

        input.placeholder =
            `Message #${
                state.selectedChannel.name
            }`;

        const attachmentInput =
            $("attachmentInput");

        if (attachmentInput) {
            attachmentInput.value = "";
        }

        await loadMessages(true);

        scrollToBottom();

    } finally {
        if (sendButton) {
            sendButton.disabled =
                false;
        }
    }
}


/* =========================================================
   ATTACHMENT UPLOAD
   ========================================================= */

async function uploadAttachments(
    messageId,
    files
) {
    for (const file of files) {
        try {
            const safeName =
                sanitizeFileName(
                    file.name
                );

            const path =
                `chat/${state.selectedChannel.id}/${messageId}/${Date.now()}-${safeName}`;

            const {
                error: uploadError
            } = await supabase.storage
                .from(
                    "chat-attachments"
                )
                .upload(
                    path,
                    file,
                    {
                        cacheControl:
                            "3600",
                        upsert:
                            false
                    }
                );

            if (uploadError) {
                console.error(
                    "Attachment upload failed:",
                    uploadError
                );

                toast(
                    `Could not upload ${file.name}.`,
                    "error"
                );

                continue;
            }

            const {
                data: publicData
            } =
                supabase.storage
                    .from(
                        "chat-attachments"
                    )
                    .getPublicUrl(
                        path
                    );

            const fileUrl =
                publicData?.publicUrl ||
                "";

            const {
                error:
                    attachmentError
            } = await supabase
                .from(
                    "chat_attachments"
                )
                .insert({
                    message_id:
                        messageId,

                    uploaded_by:
                        state.user.id,

                    file_name:
                        file.name,

                    file_path:
                        path,

                    file_url:
                        fileUrl,

                    mime_type:
                        file.type ||
                        "application/octet-stream",

                    file_size:
                        file.size
                });

            if (attachmentError) {
                console.error(
                    "Attachment database record failed:",
                    attachmentError
                );
            }

        } catch (error) {
            console.error(
                "Attachment error:",
                error
            );
        }
    }
}


function sanitizeFileName(
    name
) {
    return String(
        name || "file"
    )
        .replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
        )
        .substring(
            0,
            180
        );
}


/* =========================================================
   GIF
   ========================================================= */

function previewGif() {
    const input =
        $("gifUrlInput");

    const preview =
        $("gifPreview");

    const sendButton =
        $("sendGifButton");

    const url =
        input?.value.trim() ||
        "";

    state.selectedGifUrl =
        "";

    state.selectedGifPreview =
        "";

    if (
        !url ||
        !isSafeImageUrl(url)
    ) {
        if (preview) {
            preview.innerHTML =
                "<p>Enter a valid image/GIF URL.</p>";
        }

        if (sendButton) {
            sendButton.disabled =
                true;
        }

        return;
    }

    state.selectedGifUrl =
        url;

    state.selectedGifPreview =
        url;

    if (preview) {
        preview.innerHTML = `
            <img
                src="${escapeAttribute(
                    url
                )}"
                alt="GIF preview"
            >
        `;
    }

    if (sendButton) {
        sendButton.disabled =
            false;
    }
}


async function sendGif() {
    if (!state.rulesAccepted) {
        showRulesGate();
        return;
    }

    if (
        !state.selectedChannel ||
        !state.user
    ) {
        return;
    }

    const url =
        state.selectedGifUrl ||
        $("gifUrlInput")
            ?.value
            .trim();

    if (
        !url ||
        !isSafeImageUrl(url)
    ) {
        toast(
            "Enter a valid GIF URL.",
            "error"
        );

        return;
    }

    const {
        error
    } = await supabase
        .from(
            "chat_messages"
        )
        .insert({
            channel_id:
                state.selectedChannel.id,

            user_id:
                state.user.id,

            content:
                url,

            message_type:
                "gif"
        });

    if (error) {
        console.error(
            "GIF send failed:",
            error
        );

        toast(
            "Could not send GIF.",
            "error"
        );

        return;
    }

    closeGifPicker();

    await loadMessages(true);

    scrollToBottom();
}


/* =========================================================
   MASSIVE EMOJI SYSTEM
   ========================================================= */

/*
 * Instead of maintaining a tiny manually-written list,
 * build the emoji catalogue from Unicode supported by
 * the browser.
 *
 * This means newly supported Unicode emoji can appear
 * without us having to manually add every character.
 */

let emojiCatalogue = null;


function buildEmojiCatalogue() {
    if (emojiCatalogue) {
        return emojiCatalogue;
    }

    const set = new Set();

    /*
     * Main emoji blocks.
     */
    const ranges = [
        [0x1F000, 0x1FAFF],
        [0x1FC00, 0x1FFFF],
        [0x2300, 0x23FF],
        [0x2600, 0x27BF],
        [0x2B00, 0x2BFF],
        [0x2934, 0x2935],
        [0x25AA, 0x25FF],
        [0x203C, 0x3299]
    ];

    /*
     * Unicode property support.
     */
    let emojiRegex = null;

    try {
        emojiRegex =
            new RegExp(
                "\\p{Emoji_Presentation}|\\p{Emoji}",
                "u"
            );
    } catch {
        emojiRegex = null;
    }

    for (const [start, end] of ranges) {
        for (
            let codePoint = start;
            codePoint <= end;
            codePoint++
        ) {
            const character =
                String.fromCodePoint(
                    codePoint
                );

            /*
             * Avoid adding ordinary numbers,
             * letters and unrelated symbols.
             */
            if (
                emojiRegex &&
                emojiRegex.test(character)
            ) {
                set.add(character);
            }
        }
    }

    /*
     * Explicit commonly-supported symbols.
     */
    const extraSymbols = [
        "©",
        "®",
        "™",
        "‼",
        "⁉",
        "ℹ️",
        "↔️",
        "↕️",
        "↖️",
        "↗️",
        "↘️",
        "↙️",
        "↩️",
        "↪️",
        "⌚",
        "⌛",
        "⏩",
        "⏪",
        "⏫",
        "⏬",
        "⏰",
        "⏳",
        "◼️",
        "◻️",
        "◾",
        "◽",
        "▪️",
        "▫️",
        "▶️",
        "◀️",
        "🔼",
        "🔽",
        "⭕",
        "❗",
        "❓",
        "❕",
        "❔",
        "❌",
        "⭕",
        "➕",
        "➖",
        "➗",
        "✖️",
        "✔️",
        "☑️",
        "⭐",
        "🌟",
        "✨",
        "⚡",
        "☀️",
        "☁️",
        "☔",
        "❄️",
        "☃️",
        "♻️",
        "⚠️",
        "🚸",
        "🔱",
        "⚜️",
        "♠️",
        "♥️",
        "♦️",
        "♣️",
        "🎵",
        "🎶"
    ];

    for (
        const emoji of extraSymbols
    ) {
        set.add(emoji);
    }

    /*
     * Skin-tone modifiers.
     */
    const skinTones = [
        "🏻",
        "🏼",
        "🏽",
        "🏾",
        "🏿"
    ];

    /*
     * Regional indicators create flags.
     */
    const regionalIndicators = [];

    for (
        let codePoint = 0x1F1E6;
        codePoint <= 0x1F1FF;
        codePoint++
    ) {
        regionalIndicators.push(
            String.fromCodePoint(
                codePoint
            )
        );
    }

    /*
     * Common flag combinations.
     */
    for (
        let first = 0;
        first <
            regionalIndicators.length;
        first++
    ) {
        for (
            let second = 0;
            second <
                regionalIndicators.length;
            second++
        ) {
            set.add(
                regionalIndicators[first] +
                regionalIndicators[second]
            );
        }
    }

    /*
     * Skin-tone variants for many
     * emoji that accept modifiers.
     */
    const baseEmoji =
        [...set].filter(
            emoji =>
                emoji.length <= 4
        );

    for (
        const emoji of baseEmoji
    ) {
        for (
            const tone of skinTones
        ) {
            set.add(
                emoji + tone
            );
        }
    }

    /*
     * Important common ZWJ sequences.
     */
    const zwjSequences = [
        "👨‍⚕️",
        "👩‍⚕️",
        "🧑‍⚕️",
        "👨‍🎓",
        "👩‍🎓",
        "🧑‍🎓",
        "👨‍🏫",
        "👩‍🏫",
        "🧑‍🏫",
        "👨‍💻",
        "👩‍💻",
        "🧑‍💻",
        "👨‍🔬",
        "👩‍🔬",
        "🧑‍🔬",
        "👨‍🚀",
        "👩‍🚀",
        "🧑‍🚀",
        "👨‍🍳",
        "👩‍🍳",
        "🧑‍🍳",
        "👨‍⚖️",
        "👩‍⚖️",
        "🧑‍⚖️",
        "👨‍🌾",
        "👩‍🌾",
        "🧑‍🌾",
        "👨‍🎨",
        "👩‍🎨",
        "🧑‍🎨",
        "👨‍🚒",
        "👩‍🚒",
        "🧑‍🚒",
        "👨‍✈️",
        "👩‍✈️",
        "🧑‍✈️",
        "👨‍🔧",
        "👩‍🔧",
        "🧑‍🔧",
        "👨‍⚕️",
        "👩‍⚕️",
        "🧑‍⚕️",
        "🏳️‍🌈",
        "🏳️‍⚧️",
        "🏴‍☠️",
        "❤️‍🔥",
        "❤️‍🩹",
        "🧑‍🤝‍🧑",
        "👩‍❤️‍👨",
        "👨‍❤️‍👨",
        "👩‍❤️‍👩",
        "💁‍♂️",
        "💁‍♀️",
        "🙋‍♂️",
        "🙋‍♀️",
        "🙆‍♂️",
        "🙆‍♀️",
        "🙅‍♂️",
        "🙅‍♀️",
        "🤷‍♂️",
        "🤷‍♀️",
        "🤦‍♂️",
        "🤦‍♀️",
        "💇‍♂️",
        "💇‍♀️",
        "💆‍♂️",
        "💆‍♀️",
        "🧘‍♂️",
        "🧘‍♀️",
        "🚶‍♂️",
        "🚶‍♀️",
        "🏃‍♂️",
        "🏃‍♀️",
        "🕺",
        "💃",
        "👯‍♂️",
        "👯‍♀️"
    ];

    for (
        const emoji of zwjSequences
    ) {
        set.add(emoji);
    }

    emojiCatalogue = [
        ...set
    ];

    return emojiCatalogue;
}


/*
 * Generate a large searchable emoji picker.
 */
function populateEmojiPicker() {
    const grid =
        $("emojiGrid");

    if (!grid) {
        return;
    }

    const emojis =
        buildEmojiCatalogue();

    if (
        grid.dataset.loaded === "true"
    ) {
        return;
    }

    grid.innerHTML = "";

    const fragment =
        document.createDocumentFragment();

    for (
        const emoji of emojis
    ) {
        const button =
            document.createElement(
                "button"
            );

        button.type = "button";

        button.className =
            "emoji-choice";

        button.dataset.emoji =
            emoji;

        button.textContent =
            emoji;

        button.title =
            emoji;

        button.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                insertEmoji(
                    emoji
                );
            }
        );

        fragment.appendChild(
            button
        );
    }

    grid.appendChild(
        fragment
    );

    grid.dataset.loaded =
        "true";

    console.log(
        `😀 Emoji picker loaded ${emojis.length} Unicode emoji/variants.`
    );
}


function insertEmoji(
    emoji
) {
    const input =
        $("messageInput");

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
        input.value.substring(
            0,
            start
        ) +
        emoji +
        input.value.substring(
            end
        );

    const position =
        start +
        emoji.length;

    input.selectionStart =
        position;

    input.selectionEnd =
        position;

    input.focus();

    resizeMessageInput();
}


function toggleEmojiPicker() {
    const picker =
        $("emojiPicker");

    const button =
        $("emojiButton");

    if (!picker) {
        return;
    }

    const isOpen =
        !picker.classList.contains(
            "hidden"
        );

    closeGifPicker();

    if (isOpen) {
        closeEmojiPicker();
        return;
    }

    populateEmojiPicker();

    picker.classList.remove(
        "hidden"
    );

    if (button) {
        button.setAttribute(
            "aria-expanded",
            "true"
        );
    }
}


function closeEmojiPicker() {
    const picker =
        $("emojiPicker");

    const button =
        $("emojiButton");

    if (picker) {
        picker.classList.add(
            "hidden"
        );
    }

    if (button) {
        button.setAttribute(
            "aria-expanded",
            "false"
        );
    }
}


/* =========================================================
   GIF UI
   ========================================================= */

function toggleGifPicker() {
    const picker =
        $("gifPicker");

    if (!picker) {
        return;
    }

    const open =
        !picker.classList.contains(
            "hidden"
        );

    closeEmojiPicker();

    if (open) {
        closeGifPicker();
        return;
    }

    picker.classList.remove(
        "hidden"
    );
}


function closeGifPicker() {
    const picker =
        $("gifPicker");

    if (picker) {
        picker.classList.add(
            "hidden"
        );
    }
}


/* =========================================================
   ATTACHMENT UI
   ========================================================= */

function openAttachmentPicker() {
    const input =
        $("attachmentInput");

    if (input) {
        input.click();
    }
}


function handleAttachmentSelection() {
    const input =
        $("attachmentInput");

    if (
        !input?.files?.length
    ) {
        return;
    }

    const count =
        input.files.length;

    toast(
        `${count} file${
            count === 1
                ? ""
                : "s"
        } ready to send.`
    );
}


/* =========================================================
   REALTIME
   ========================================================= */

async function subscribeToChannel(
    channelId
) {
    if (state.realtimeChannel) {
        await supabase.removeChannel(
            state.realtimeChannel
        );

        state.realtimeChannel =
            null;
    }

    const realtimeName =
        `community-messages-${channelId}-${Date.now()}`;

    state.realtimeChannel =
        supabase
            .channel(
                realtimeName
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
                async payload => {
                    console.log(
                        "💬 Message realtime:",
                        payload.eventType
                    );

                    await loadMessages(
                        true
                    );
                }
            )

            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table:
                        "chat_message_reactions"
                },
                async () => {
                    await loadReactionsForMessages(
                        state.messages.map(
                            message =>
                                message.id
                        )
                    );

                    renderMessages();
                }
            )

            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table:
                        "chat_attachments"
                },
                async () => {
                    await loadAttachmentsForMessages(
                        state.messages
                    );

                    renderMessages();
                }
            )

            .subscribe(
                status => {
                    console.log(
                        `📡 Community realtime: ${status}`
                    );
                }
            );
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function goToDashboard() {
    window.location.href =
        "./dashboard.html";
}


function goToProfile() {
    window.location.href =
        "./studentProfile.html";
}


function goHome() {
    window.location.href =
        "./dashboard.html";
}


/* =========================================================
   COMMUNITY MODAL
   ========================================================= */

function openCommunityModal() {
    const modal =
        $("communityModal");

    if (!modal) {
        return;
    }

    renderCommunityChoices();

    modal.classList.remove(
        "hidden"
    );

    $("communityModalSearch")
        ?.focus();
}


function closeCommunityModal() {
    const modal =
        $("communityModal");

    if (modal) {
        modal.classList.add(
            "hidden"
        );
    }
}


/* =========================================================
   GENERAL CALL
   Call engine remains in call.js.
   ========================================================= */

function openGeneralCallModal() {
    const modal =
        $("generalCallModal");

    if (modal) {
        modal.classList.remove(
            "hidden"
        );
    }
}


function closeGeneralCallModal() {
    const modal =
        $("generalCallModal");

    if (modal) {
        modal.classList.add(
            "hidden"
        );
    }

    setText(
        "generalCallMessage",
        ""
    );
}


function setGeneralCallMode(
    mode
) {
    state.selectedCallMode =
        mode;

    const voice =
        $("generalVoiceCallButton");

    const video =
        $("generalVideoCallButton");

    voice?.classList.toggle(
        "active",
        mode === "voice"
    );

    video?.classList.toggle(
        "active",
        mode === "video"
    );
}


function startGeneralCall() {
    const input =
        $("generalCallUserInput");

    const targetUserId =
        input?.value.trim();

    if (!targetUserId) {
        setText(
            "generalCallMessage",
            "Enter the user UUID."
        );

        return;
    }

    /*
     * call.js owns actual WebRTC.
     */
    window.dispatchEvent(
        new CustomEvent(
            "mwaniki:start-general-call",
            {
                detail: {
                    targetUserId,
                    mode:
                        state.selectedCallMode
                }
            }
        )
    );

    closeGeneralCallModal();
}


/* =========================================================
   MESSAGE LIST HELPERS
   ========================================================= */

function scrollToBottom() {
    const container =
        $("messageList");

    if (!container) {
        return;
    }

    container.scrollTop =
        container.scrollHeight;
}


function isNearBottom(
    container
) {
    if (!container) {
        return true;
    }

    return (
        container.scrollHeight -
        container.scrollTop -
        container.clientHeight
    ) < 180;
}


function updateOlderMessagesButton() {
    const button =
        $("loadOlderMessagesButton");

    if (!button) {
        return;
    }

    button.classList.toggle(
        "hidden",
        !state.hasOlderMessages
    );
}


function formatMessageTime(
    dateValue
) {
    if (!dateValue) {
        return "";
    }

    const date =
        new Date(dateValue);

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


/* =========================================================
   ENTER COMMUNITY
   ========================================================= */

async function enterCommunity() {
    if (!state.user) {
        return;
    }

    /*
     * Ensure communities exist.
     */
    if (!state.communities.length) {
        await loadCommunities();
    }

    if (!state.communities.length) {
        toast(
            "No active communities are available.",
            "error"
        );

        renderChannels();

        clearChannelInterface();

        return;
    }

    /*
     * Automatically choose General Chat.
     */
    if (!state.selectedCommunity) {
        state.selectedCommunity =
            state.communities.find(
                community =>
                    String(
                        community.slug ||
                        ""
                    ).toLowerCase() ===
                    "general-chat"
            ) ||
            state.communities.find(
                community =>
                    String(
                        community.name ||
                        ""
                    ).toLowerCase() ===
                    "general chat"
            ) ||
            state.communities[0];
    }

    if (!state.selectedCommunity) {
        return;
    }

    console.log(
        "🌐 Automatically entering:",
        state.selectedCommunity.name
    );

    updateSelectedCommunityInterface();

    renderCommunityRail();

    /*
     * AUTOMATIC CHANNEL LOADING.
     */
    await loadChannels(
        state.selectedCommunity.id
    );

    console.log(
        "📢 Automatic channel loading complete:",
        state.channels.length
    );
}


/* =========================================================
   INPUT BEHAVIOR
   ========================================================= */

function resizeMessageInput() {
    const input =
        $("messageInput");

    if (!input) {
        return;
    }

    input.style.height =
        "auto";

    input.style.height =
        `${Math.min(
            input.scrollHeight,
            160
        )}px`;
}


function handleMessageKeydown(
    event
) {
    if (
        event.key === "Enter" &&
        !event.shiftKey
    ) {
        event.preventDefault();

        $("messageForm")
            ?.requestSubmit();
    }
}


/* =========================================================
   GLOBAL ESCAPE
   ========================================================= */

function handleEscapeKey(
    event
) {
    if (
        event.key !== "Escape"
    ) {
        return;
    }

    closeEmojiPicker();
    closeGifPicker();
    closeReactionPicker();
    closeCommunityModal();
    closeGeneralCallModal();
}


/* =========================================================
   INTERFACE WIRING
   ========================================================= */

function wireInterface() {

    /* ---------------------------------------------
       Rules
       --------------------------------------------- */

    $("communityRulesAgreement")
        ?.addEventListener(
            "change",
            handleRulesAgreement
        );

    $("acceptCommunityRulesButton")
        ?.addEventListener(
            "click",
            acceptCommunityRules
        );


    /* ---------------------------------------------
       Message
       --------------------------------------------- */

    $("messageForm")
        ?.addEventListener(
            "submit",
            sendMessage
        );

    $("messageInput")
        ?.addEventListener(
            "input",
            resizeMessageInput
        );

    $("messageInput")
        ?.addEventListener(
            "keydown",
            handleMessageKeydown
        );


    /* ---------------------------------------------
       Attachments
       --------------------------------------------- */

    $("attachButton")
        ?.addEventListener(
            "click",
            openAttachmentPicker
        );

    $("attachmentInput")
        ?.addEventListener(
            "change",
            handleAttachmentSelection
        );


    /* ---------------------------------------------
       Emoji
       --------------------------------------------- */

    $("emojiButton")
        ?.addEventListener(
            "click",
            event => {
                event.stopPropagation();
                toggleEmojiPicker();
            }
        );

    $("closeEmojiButton")
        ?.addEventListener(
            "click",
            event => {
                event.stopPropagation();
                closeEmojiPicker();
            }
        );


    /* ---------------------------------------------
       GIF
       --------------------------------------------- */

    $("gifButton")
        ?.addEventListener(
            "click",
            event => {
                event.stopPropagation();
                toggleGifPicker();
            }
        );

    $("closeGifButton")
        ?.addEventListener(
            "click",
            event => {
                event.stopPropagation();
                closeGifPicker();
            }
        );

    $("previewGifButton")
        ?.addEventListener(
            "click",
            previewGif
        );

    $("sendGifButton")
        ?.addEventListener(
            "click",
            sendGif
        );


    /* ---------------------------------------------
       Older messages
       --------------------------------------------- */

    $("loadOlderMessagesButton")
        ?.addEventListener(
            "click",
            loadOlderMessages
        );


    /* ---------------------------------------------
       Communities
       --------------------------------------------- */

    $("openCommunityButton")
        ?.addEventListener(
            "click",
            openCommunityModal
        );

    $("headerCommunityButton")
        ?.addEventListener(
            "click",
            openCommunityModal
        );

    $("closeCommunityModal")
        ?.addEventListener(
            "click",
            closeCommunityModal
        );

    $("communityModalSearch")
        ?.addEventListener(
            "input",
            event => {
                renderCommunityChoices(
                    event.target.value
                );
            }
        );


    /* ---------------------------------------------
       Navigation
       --------------------------------------------- */

    $("homeButton")
        ?.addEventListener(
            "click",
            goHome
        );

    $("railHomeButton")
        ?.addEventListener(
            "click",
            goToDashboard
        );

    $("dashboardButton")
        ?.addEventListener(
            "click",
            goToDashboard
        );

    $("railProfileButton")
        ?.addEventListener(
            "click",
            goToProfile
        );

    $("sidebarProfileButton")
        ?.addEventListener(
            "click",
            goToProfile
        );


    /* ---------------------------------------------
       Channel search
       --------------------------------------------- */

    $("channelSearchInput")
        ?.addEventListener(
            "input",
            event => {
                renderChannels(
                    event.target.value
                );
            }
        );


    /* ---------------------------------------------
       Welcome button
       --------------------------------------------- */

    $("welcomeStartButton")
        ?.addEventListener(
            "click",
            () => {
                $("messageInput")
                    ?.focus();
            }
        );


    /* ---------------------------------------------
       General Call
       --------------------------------------------- */

    $("generalCallButton")
        ?.addEventListener(
            "click",
            openGeneralCallModal
        );

    $("closeGeneralCallModalButton")
        ?.addEventListener(
            "click",
            closeGeneralCallModal
        );

    $("cancelGeneralCallButton")
        ?.addEventListener(
            "click",
            closeGeneralCallModal
        );

    $("generalVoiceCallButton")
        ?.addEventListener(
            "click",
            () => {
                setGeneralCallMode(
                    "voice"
                );
            }
        );

    $("generalVideoCallButton")
        ?.addEventListener(
            "click",
            () => {
                setGeneralCallMode(
                    "video"
                );
            }
        );

    $("startGeneralCallButton")
        ?.addEventListener(
            "click",
            startGeneralCall
        );


    /* ---------------------------------------------
       Escape
       --------------------------------------------- */

    document.addEventListener(
        "keydown",
        handleEscapeKey
    );


    /* ---------------------------------------------
       Close emoji/GIF when clicking outside
       --------------------------------------------- */

    document.addEventListener(
        "click",
        event => {
            const emojiPicker =
                $("emojiPicker");

            const emojiButton =
                $("emojiButton");

            const gifPicker =
                $("gifPicker");

            const gifButton =
                $("gifButton");

            if (
                emojiPicker &&
                !emojiPicker.contains(
                    event.target
                ) &&
                !emojiButton?.contains(
                    event.target
                )
            ) {
                closeEmojiPicker();
            }

            if (
                gifPicker &&
                !gifPicker.contains(
                    event.target
                ) &&
                !gifButton?.contains(
                    event.target
                )
            ) {
                closeGifPicker();
            }
        }
    );
}


/* =========================================================
   CLEANUP
   ========================================================= */

window.addEventListener(
    "beforeunload",
    () => {
        if (
            state.realtimeChannel
        ) {
            supabase.removeChannel(
                state.realtimeChannel
            );
        }
    }
);


/* =========================================================
   DEBUG ACCESS
   ========================================================= */

window.mwanikiCommunity = {
    state,

    reload: async () => {
        await loadCommunities();

        if (
            state.selectedCommunity
        ) {
            await loadChannels(
                state.selectedCommunity.id
            );
        }
    },

    reloadChannels: async () => {
        if (
            state.selectedCommunity
        ) {
            await loadChannels(
                state.selectedCommunity.id
            );
        }
    },

    reloadMessages: async () => {
        await loadMessages(true);
    },

    openEmojiPicker:
        () => {
            populateEmojiPicker();
            $("emojiPicker")
                ?.classList
                .remove("hidden");
        }
};


console.log(
    "✅ Mwaniki Scholars community.js loaded successfully"
);
