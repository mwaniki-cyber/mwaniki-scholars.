/* =========================================================
   MWANIKI SCHOLARS COMMUNITY
   CLEAN COMMUNITY ENGINE
   ---------------------------------------------------------
   Requires:
   - supabase.js loaded before this file
   - call.js loaded separately
   - emoji-picker-element
   ========================================================= */

"use strict";

/* =========================================================
   SUPABASE
   ========================================================= */

const supabase =
    window.supabaseClient ||
    window.supabase ||
    window.sb ||
    window.mwanikiSupabase;

if (!supabase) {
    console.error("❌ Supabase client was not found.");
    throw new Error("Supabase client is required.");
}

console.log("🚀 Mwaniki Scholars Community engine loaded");


/* =========================================================
   CONFIGURATION
   ========================================================= */

const DEFAULT_DISCUSSION_ID =
    "9044c031-71da-496d-9166-ff19ed4fcb62";

const DEFAULT_DISCUSSION_NAME =
    "Mwaniki Scholars";

const STORAGE_BUCKET =
    "chat-attachments";

const RULES_VERSION =
    "mwaniki-community-rules-v3";

const MESSAGE_PAGE_SIZE = 50;

const MAX_FILE_SIZE =
    50 * 1024 * 1024;


/* =========================================================
   STATE
   ========================================================= */

const state = {

    user: null,
    profile: null,

    communities: [],
    selectedCommunity: null,

    channels: [],
    selectedChannel: null,

    messages: [],
    profiles: new Map(),
    reactions: new Map(),
    attachments: new Map(),

    messageSubscription: null,
    reactionSubscription: null,
    attachmentSubscription: null,

    loadingMessages: false,
    loadingCommunities: false,
    loadingChannels: false,

    rulesAccepted: false,

    mediaRecorder: null,
    recordingStream: null,
    recordingChunks: [],
    recordingTimer: null,
    recordingStartedAt: null,
    isRecording: false,

    pendingAttachments: [],

    generalCallMode: "voice"

};


/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(selector) {
    return document.querySelector(selector);
}

function $$(selector) {
    return Array.from(document.querySelectorAll(selector));
}


/* =========================================================
   HTML SAFETY
   ========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function safeUrl(url) {

    if (!url) return "#";

    try {

        const parsed = new URL(url, window.location.href);

        if (
            parsed.protocol === "http:" ||
            parsed.protocol === "https:"
        ) {
            return parsed.href;
        }

    } catch (error) {
        console.warn("Invalid URL:", url);
    }

    return "#";
}


/* =========================================================
   FORMATTING
   ========================================================= */

function formatFileSize(bytes) {

    if (!bytes) return "0 B";

    const units = [
        "B",
        "KB",
        "MB",
        "GB"
    ];

    let size = Number(bytes);
    let index = 0;

    while (size >= 1024 && index < units.length - 1) {
        size /= 1024;
        index++;
    }

    return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
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


function getInitials(name) {

    const value =
        String(name || "User")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part.charAt(0).toUpperCase())
            .join("");

    return value || "U";
}


/* =========================================================
   ICONS
   ========================================================= */

function getCommunityFallbackIcon(community) {

    const name =
        String(community?.name || "").toLowerCase();

    if (name.includes("gaming")) {
        return "🎮";
    }

    if (
        name.includes("meme") ||
        name.includes("fun")
    ) {
        return "😂";
    }

    if (
        name.includes("scholar") ||
        name.includes("medical")
    ) {
        return "🎓";
    }

    return "🌐";
}


function renderCommunityIcon(community) {

    if (community?.icon_url) {

        return `
            <img
                src="${safeUrl(community.icon_url)}"
                alt=""
                class="community-icon-image"
            >
        `;
    }

    return `
        <span class="community-icon-fallback">
            ${escapeHtml(getCommunityFallbackIcon(community))}
        </span>
    `;
}


/* =========================================================
   FILE TYPES
   ========================================================= */

function isImageFile(file) {

    return Boolean(
        file &&
        typeof file.type === "string" &&
        file.type.startsWith("image/")
    );
}


function isAudioFile(file) {

    return Boolean(
        file &&
        typeof file.type === "string" &&
        file.type.startsWith("audio/")
    );
}


function isDocumentFile(file) {

    if (!file) return false;

    const type = String(file.type || "").toLowerCase();

    return (
        type === "application/pdf" ||
        type === "text/plain" ||
        type === "text/csv" ||
        type === "application/msword" ||
        type.includes("wordprocessingml") ||
        type === "application/vnd.ms-powerpoint" ||
        type.includes("presentationml") ||
        type === "application/vnd.ms-excel" ||
        type.includes("spreadsheetml")
    );
}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(message, type = "info") {

    let toast = $("#communityToast");

    if (!toast) {

        toast = document.createElement("div");

        toast.id = "communityToast";

        toast.className = "community-toast";

        document.body.appendChild(toast);
    }

    toast.textContent = message;

    toast.dataset.type = type;

    toast.classList.add("show");

    clearTimeout(toast._timer);

    toast._timer = setTimeout(() => {

        toast.classList.remove("show");

    }, 3500);
}


/* =========================================================
   ACCESSIBILITY ANNOUNCER
   ========================================================= */

function announce(message) {

    const element =
        $("#communityLiveRegion");

    if (!element) return;

    element.textContent = "";

    setTimeout(() => {
        element.textContent = message;
    }, 20);
}


/* =========================================================
   RULES GATE
   ========================================================= */

function getRulesAccepted() {

    try {

        return (
            localStorage.getItem(RULES_VERSION) === "true"
        );

    } catch (error) {

        console.warn(
            "Could not read community rules:",
            error
        );

        return false;
    }
}


function setRulesAccepted() {

    try {

        localStorage.setItem(
            RULES_VERSION,
            "true"
        );

    } catch (error) {

        console.warn(
            "Could not save community rules:",
            error
        );
    }

    state.rulesAccepted = true;
}


function closeRulesGate() {

    const gate = $("#rulesGate");

    if (!gate) return;

    gate.classList.add("hidden");

    gate.style.display = "none";

    gate.setAttribute(
        "aria-hidden",
        "true"
    );

    announce(
        "Community rules accepted."
    );
}


function showRulesGate() {

    const gate = $("#rulesGate");

    if (!gate) {

        console.warn(
            "⚠️ #rulesGate was not found."
        );

        return;
    }

    gate.classList.remove("hidden");

    gate.style.display = "";

    gate.setAttribute(
        "aria-hidden",
        "false"
    );

    const selectors = [
        "#acceptRulesButton",
        "#agreeRulesButton",
        "#agreeAndContinueButton",
        "#continueRulesButton",
        "#rulesAgreeButton"
    ];

    let button = null;

    for (const selector of selectors) {

        const candidate = $(selector);

        if (candidate) {

            button = candidate;

            break;
        }
    }

    if (!button) {

        button =
            gate.querySelector(
                "button[type='button']"
            ) ||
            gate.querySelector("button");
    }

    if (!button) {

        console.error(
            "❌ Agree and Continue button was not found inside #rulesGate."
        );

        return;
    }

    /*
       Remove old listeners by replacing the button.
       This prevents duplicate handlers.
    */

    const cleanButton =
        button.cloneNode(true);

    button.replaceWith(cleanButton);

    cleanButton.disabled = false;

    cleanButton.removeAttribute("disabled");

    cleanButton.style.pointerEvents = "auto";

    cleanButton.style.cursor = "pointer";

    cleanButton.style.position = "relative";

    cleanButton.style.zIndex = "100001";

    cleanButton.addEventListener(
        "click",
        function(event) {

            event.preventDefault();

            event.stopPropagation();

            console.log(
                "✅ Community rules accepted."
            );

            setRulesAccepted();

            closeRulesGate();
        }
    );

    cleanButton.addEventListener(
        "keydown",
        function(event) {

            if (
                event.key === "Enter" ||
                event.key === " "
            ) {

                event.preventDefault();

                cleanButton.click();
            }
        }
    );

    console.log(
        "✅ Rules button connected:",
        cleanButton.id || cleanButton.textContent
    );
}


function initializeRules() {

    state.rulesAccepted =
        getRulesAccepted();

    if (state.rulesAccepted) {

        closeRulesGate();

        return;
    }

    showRulesGate();
}


/* =========================================================
   AUTHENTICATION
   ========================================================= */

async function loadCurrentUser() {

    const {
        data,
        error
    } = await supabase.auth.getUser();

    if (error) {

        console.error(
            "Authentication error:",
            error
        );

        return null;
    }

    state.user =
        data?.user || null;

    return state.user;
}


/* =========================================================
   PROFILE
   ========================================================= */

async function loadMyProfile() {

    if (!state.user) return null;

    const {
        data,
        error
    } = await supabase
        .from("students")
        .select(
            "id,full_name,course,level,photo_url"
        )
        .eq("id", state.user.id)
        .maybeSingle();

    if (error) {

        console.warn(
            "Could not load student profile:",
            error
        );

        return null;
    }

    state.profile = data || null;

    renderMyProfile();

    return state.profile;
}


function renderMyProfile() {

    const profile = state.profile;

    if (!profile) return;

    const name =
        profile.full_name ||
        state.user?.email ||
        "Student";

    const avatarUrl =
        profile.photo_url || "";

    const nameElements = [
        "#profileName",
        "#currentUserName",
        "#userName",
        "#composerUserName"
    ];

    nameElements.forEach(selector => {

        const element = $(selector);

        if (element) {
            element.textContent = name;
        }
    });

    const avatarElements = [
        "#profileAvatar",
        "#currentUserAvatar",
        "#composerAvatar"
    ];

    avatarElements.forEach(selector => {

        const element = $(selector);

        if (!element) return;

        if (avatarUrl) {

            element.innerHTML = `
                <img
                    src="${safeUrl(avatarUrl)}"
                    alt="${escapeHtml(name)}"
                >
            `;

        } else {

            element.textContent =
                getInitials(name);
        }
    });
}


/* =========================================================
   PUBLIC PROFILE LOOKUP
   ========================================================= */

async function loadProfilesForUsers(userIds) {

    const ids =
        [...new Set(
            userIds.filter(Boolean)
        )];

    if (!ids.length) return;

    const missingIds =
        ids.filter(
            id => !state.profiles.has(id)
        );

    if (!missingIds.length) return;

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

        console.warn(
            "Could not load public profiles:",
            error
        );

        return;
    }

    (data || []).forEach(profile => {

        state.profiles.set(
            profile.id,
            profile
        );
    });
}


function getProfile(userId) {

    return (
        state.profiles.get(userId) ||
        {
            id: userId,
            full_name: "Student",
            photo_url: null
        }
    );
}


/* =========================================================
   COMMUNITIES
   ========================================================= */

async function loadCommunities() {

    if (state.loadingCommunities) {
        return;
    }

    state.loadingCommunities = true;

    try {

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
                created_at,
                updated_at
            `)
            .eq("is_active", true)
            .order("created_at", {
                ascending: true
            });

        if (error) {

            console.error(
                "Community loading error:",
                error
            );

            showToast(
                "Could not load communities.",
                "error"
            );

            return;
        }

        state.communities =
            data || [];

        renderCommunities();

        /*
           Always start in Mwaniki Scholars
           when it exists.
        */

        const defaultCommunity =
            state.communities.find(
                community =>
                    community.id ===
                    DEFAULT_DISCUSSION_ID
            ) ||
            state.communities.find(
                community =>
                    String(
                        community.name
                    ).toLowerCase() ===
                    DEFAULT_DISCUSSION_NAME.toLowerCase()
            );

        const savedCommunityId =
            localStorage.getItem(
                "mwanikiSelectedCommunity"
            );

        const savedCommunity =
            state.communities.find(
                community =>
                    community.id ===
                    savedCommunityId
            );

        const selected =
            defaultCommunity ||
            savedCommunity ||
            state.communities[0];

        if (selected) {

            await selectCommunity(
                selected.id
            );
        }

    } finally {

        state.loadingCommunities = false;
    }
}


/* =========================================================
   RENDER COMMUNITIES
   ========================================================= */

function renderCommunities() {

    const containers = [
        "#communityList",
        "#communitiesList",
        "#communityRail",
        "#communitySwitcherList"
    ];

    const container =
        containers
            .map(selector => $(selector))
            .find(Boolean);

    if (!container) return;

    container.innerHTML =
        state.communities
            .map(community => {

                const active =
                    state.selectedCommunity?.id ===
                    community.id;

                return `
                    <button
                        type="button"
                        class="community-item ${active ? "active" : ""}"
                        data-community-id="${escapeHtml(community.id)}"
                        title="${escapeHtml(community.name)}"
                    >

                        <span class="community-item-icon">
                            ${renderCommunityIcon(community)}
                        </span>

                        <span class="community-item-name">
                            ${escapeHtml(community.name)}
                        </span>

                    </button>
                `;

            })
            .join("");

    $$(".community-item").forEach(button => {

        button.addEventListener(
            "click",
            async () => {

                const id =
                    button.dataset.communityId;

                await selectCommunity(id);
            }
        );
    });
}


/* =========================================================
   SELECT COMMUNITY
   ========================================================= */

async function selectCommunity(communityId) {

    const community =
        state.communities.find(
            item => item.id === communityId
        );

    if (!community) return;

    state.selectedCommunity =
        community;

    localStorage.setItem(
        "mwanikiSelectedCommunity",
        community.id
    );

    renderCommunities();

    renderSelectedCommunity();

    await loadChannels(
        community.id
    );
}


/* =========================================================
   SELECTED COMMUNITY UI
   ========================================================= */

function renderSelectedCommunity() {

    const community =
        state.selectedCommunity;

    if (!community) return;

    const nameElements = [
        "#selectedCommunityName",
        "#currentCommunityName",
        "#communityTitle"
    ];

    nameElements.forEach(selector => {

        const element = $(selector);

        if (element) {
            element.textContent =
                community.name;
        }
    });

    const description =
        $("#selectedCommunityDescription");

    if (description) {

        description.textContent =
            community.description || "";
    }

    const icon =
        $("#selectedCommunityIcon");

    if (icon) {

        icon.innerHTML =
            renderCommunityIcon(
                community
            );
    }
}


/* =========================================================
   CHANNELS
   ========================================================= */

async function loadChannels(communityId) {

    if (state.loadingChannels) {
        return;
    }

    state.loadingChannels = true;

    try {

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
                    ascending: true,
                    nullsFirst: false
                }
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );

        if (error) {

            console.error(
                "Channel loading error:",
                error
            );

            state.channels = [];

            renderChannels();

            showToast(
                "Could not load channels.",
                "error"
            );

            return;
        }

        state.channels =
            data || [];

        console.log(
            `✅ ${state.channels.length} channel(s) loaded automatically.`
        );

        renderChannels();

        if (!state.channels.length) {

            state.selectedChannel = null;

            renderEmptyChannel();

            return;
        }

        const savedChannelId =
            localStorage.getItem(
                "mwanikiSelectedChannel"
            );

        const savedChannel =
            state.channels.find(
                channel =>
                    channel.id ===
                    savedChannelId
            );

        const selected =
            savedChannel ||
            state.channels[0];

        await selectChannel(
            selected.id
        );

    } finally {

        state.loadingChannels = false;
    }
}


/* =========================================================
   RENDER CHANNELS
   ========================================================= */

function renderChannels() {

    const containers = [
        "#channelList",
        "#channelsList"
    ];

    const container =
        containers
            .map(selector => $(selector))
            .find(Boolean);

    if (!container) return;

    if (!state.channels.length) {

        container.innerHTML = `
            <div class="empty-channels">
                No channels available.
            </div>
        `;

        return;
    }

    container.innerHTML =
        state.channels
            .map(channel => {

                const active =
                    state.selectedChannel?.id ===
                    channel.id;

                const icon =
                    channel.icon ||
                    (
                        channel.channel_type ===
                        "announcement"
                            ? "📢"
                            : "#"
                    );

                return `
                    <button
                        type="button"
                        class="channel-item ${active ? "active" : ""}"
                        data-channel-id="${escapeHtml(channel.id)}"
                    >

                        <span class="channel-icon">
                            ${escapeHtml(icon)}
                        </span>

                        <span class="channel-name">
                            ${escapeHtml(channel.name)}
                        </span>

                    </button>
                `;

            })
            .join("");

    $$(".channel-item").forEach(button => {

        button.addEventListener(
            "click",
            async () => {

                const channelId =
                    button.dataset.channelId;

                await selectChannel(
                    channelId
                );
            }
        );
    });
}


/* =========================================================
   SELECT CHANNEL
   ========================================================= */

async function selectChannel(channelId) {

    const channel =
        state.channels.find(
            item => item.id === channelId
        );

    if (!channel) return;

    state.selectedChannel =
        channel;

    localStorage.setItem(
        "mwanikiSelectedChannel",
        channel.id
    );

    renderChannels();

    renderSelectedChannel();

    await loadMessages(channel.id);

    subscribeToChannel(channel.id);
}


/* =========================================================
   SELECTED CHANNEL UI
   ========================================================= */

function renderSelectedChannel() {

    const channel =
        state.selectedChannel;

    if (!channel) return;

    const elements = [
        "#selectedChannelName",
        "#currentChannelName",
        "#channelTitle"
    ];

    elements.forEach(selector => {

        const element = $(selector);

        if (element) {

            element.textContent =
                channel.name;
        }
    });

    const description =
        $("#selectedChannelDescription");

    if (description) {

        description.textContent =
            channel.description || "";
    }
}


/* =========================================================
   EMPTY CHANNEL
   ========================================================= */

function renderEmptyChannel() {

    const container =
        $("#messageList") ||
        $("#messagesContainer") ||
        $("#messages");

    if (!container) return;

    container.innerHTML = `
        <div class="community-empty-state">
            <div class="empty-icon">💬</div>
            <h3>No channel selected</h3>
            <p>Select a channel to start chatting.</p>
        </div>
    `;
}


/* =========================================================
   MESSAGES
   ========================================================= */

async function loadMessages(channelId) {

    if (state.loadingMessages) {
        return;
    }

    state.loadingMessages = true;

    try {

        const {
            data,
            error
        } = await supabase
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
                channelId
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            )
            .limit(MESSAGE_PAGE_SIZE);

        if (error) {

            console.error(
                "Message loading error:",
                error
            );

            showToast(
                "Could not load messages.",
                "error"
            );

            return;
        }

        state.messages =
            (data || []).reverse();

        await loadProfilesForUsers(
            state.messages.map(
                message =>
                    message.user_id
            )
        );

        await loadAttachmentsForMessages(
            state.messages
        );

        await loadReactionsForMessages(
            state.messages
        );

        renderMessages();

    } finally {

        state.loadingMessages = false;
    }
}


/* =========================================================
   RENDER MESSAGES
   ========================================================= */

function renderMessages() {

    const container =
        $("#messageList") ||
        $("#messagesContainer") ||
        $("#messages");

    if (!container) return;

    if (!state.messages.length) {

        container.innerHTML = `
            <div class="community-empty-state">
                <div class="empty-icon">💬</div>
                <h3>Start the conversation</h3>
                <p>Be the first person to send a message.</p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        state.messages
            .map(message =>
                renderMessage(message)
            )
            .join("");

    attachMessageActions();

    requestAnimationFrame(() => {

        container.scrollTop =
            container.scrollHeight;
    });
}


/* =========================================================
   RENDER SINGLE MESSAGE
   ========================================================= */

function renderMessage(message) {

    const profile =
        getProfile(
            message.user_id
        );

    const name =
        profile.full_name ||
        "Student";

    const ownMessage =
        state.user?.id ===
        message.user_id;

    const avatar =
        profile.photo_url
            ? `
                <img
                    src="${safeUrl(profile.photo_url)}"
                    alt="${escapeHtml(name)}"
                >
              `
            : `
                <span>
                    ${escapeHtml(
                        getInitials(name)
                    )}
                </span>
              `;

    const deleted =
        Boolean(message.is_deleted);

    let body = "";

    if (deleted) {

        body = `
            <div class="message-deleted">
                This message was deleted.
            </div>
        `;

    } else if (
        message.message_type === "gif"
    ) {

        body = renderGifMessage(
            message
        );

    } else if (
        message.message_type === "voice"
    ) {

        body = renderVoiceMessage(
            message
        );

    } else {

        body = `
            <div class="message-content">
                ${escapeHtml(
                    message.content || ""
                ).replace(/\n/g, "<br>")}
            </div>
        `;
    }

    const attachments =
        renderMessageAttachments(
            message.id
        );

    const reactions =
        renderMessageReactions(
            message.id
        );

    return `
        <article
            class="chat-message ${ownMessage ? "own-message" : ""}"
            data-message-id="${escapeHtml(message.id)}"
        >

            <div class="message-avatar">
                ${avatar}
            </div>

            <div class="message-main">

                <div class="message-header">

                    <strong class="message-author">
                        ${escapeHtml(name)}
                    </strong>

                    <time
                        class="message-time"
                        datetime="${escapeHtml(message.created_at)}"
                    >
                        ${formatTime(message.created_at)}
                    </time>

                </div>

                <div class="message-bubble">

                    ${body}

                    ${attachments}

                </div>

                <div class="message-actions">

                    <button
                        type="button"
                        class="message-action"
                        data-action="react"
                        data-message-id="${escapeHtml(message.id)}"
                        title="React"
                    >
                        😊
                    </button>

                    ${
                        ownMessage && !deleted
                            ? `
                                <button
                                    type="button"
                                    class="message-action delete-message-button"
                                    data-action="delete"
                                    data-message-id="${escapeHtml(message.id)}"
                                    title="Delete message"
                                >
                                    🗑️
                                </button>
                              `
                            : ""
                    }

                </div>

                ${reactions}

            </div>

        </article>
    `;
}


/* =========================================================
   GIF MESSAGE
   ========================================================= */

function renderGifMessage(message) {

    const url =
        safeUrl(message.content);

    return `
        <div class="gif-message">

            <img
                src="${url}"
                alt="GIF"
                loading="lazy"
                onerror="this.style.display='none'"
            >

        </div>
    `;
}


/* =========================================================
   VOICE MESSAGE
   ========================================================= */

function renderVoiceMessage(message) {

    const attachment =
        [...state.attachments.values()]
            .find(
                item =>
                    item.message_id ===
                    message.id
            );

    if (!attachment) {

        return `
            <div class="voice-message">
                🎤 Voice note unavailable
            </div>
        `;
    }

    return `
        <div class="voice-message">

            <span class="voice-icon">
                🎤
            </span>

            <audio
                controls
                preload="metadata"
                src="${safeUrl(attachment.file_url)}"
            ></audio>

        </div>
    `;
}


/* =========================================================
   ATTACHMENTS
   ========================================================= */

async function loadAttachmentsForMessages(
    messages
) {

    const ids =
        messages.map(
            message => message.id
        );

    if (!ids.length) return;

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
        );

    if (error) {

        console.warn(
            "Attachment loading error:",
            error
        );

        return;
    }

    (data || []).forEach(attachment => {

        state.attachments.set(
            attachment.id,
            attachment
        );
    });
}


function renderMessageAttachments(
    messageId
) {

    const attachments =
        [...state.attachments.values()]
            .filter(
                attachment =>
                    attachment.message_id ===
                    messageId
            );

    if (!attachments.length) {
        return "";
    }

    return `
        <div class="message-attachments">

            ${
                attachments
                    .map(
                        attachment =>
                            renderAttachment(
                                attachment
                            )
                    )
                    .join("")
            }

        </div>
    `;
}


function renderAttachment(
    attachment
) {

    const url =
        safeUrl(
            attachment.file_url
        );

    const mime =
        String(
            attachment.mime_type || ""
        ).toLowerCase();

    if (mime.startsWith("image/")) {

        return `
            <a
                class="chat-image-attachment"
                href="${url}"
                target="_blank"
                rel="noopener noreferrer"
            >

                <img
                    src="${url}"
                    alt="${escapeHtml(attachment.file_name)}"
                    loading="lazy"
                >

            </a>
        `;
    }

    if (mime.startsWith("audio/")) {

        return `
            <div class="chat-audio-attachment">

                <audio
                    controls
                    preload="metadata"
                    src="${url}"
                ></audio>

            </div>
        `;
    }

    return `
        <div class="chat-document-attachment">

            <div class="document-icon">
                📄
            </div>

            <div class="document-info">

                <strong>
                    ${escapeHtml(
                        attachment.file_name
                    )}
                </strong>

                <small>
                    ${formatFileSize(
                        attachment.file_size
                    )}
                </small>

            </div>

            <a
                href="${url}"
                target="_blank"
                rel="noopener noreferrer"
                class="document-open-button"
            >
                Open
            </a>

        </div>
    `;
}


/* =========================================================
   REACTIONS
   ========================================================= */

async function loadReactionsForMessages(
    messages
) {

    const ids =
        messages.map(
            message => message.id
        );

    if (!ids.length) return;

    const {
        data,
        error
    } = await supabase
        .from("chat_message_reactions")
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

        console.warn(
            "Reaction loading error:",
            error
        );

        return;
    }

    state.reactions.clear();

    (data || []).forEach(reaction => {

        if (!state.reactions.has(
            reaction.message_id
        )) {

            state.reactions.set(
                reaction.message_id,
                []
            );
        }

        state.reactions
            .get(reaction.message_id)
            .push(reaction);
    });
}


function renderMessageReactions(
    messageId
) {

    const reactions =
        state.reactions.get(
            messageId
        ) || [];

    if (!reactions.length) {
        return "";
    }

    const counts = {};

    reactions.forEach(reaction => {

        counts[reaction.reaction] =
            (counts[reaction.reaction] || 0) + 1;
    });

    return `
        <div class="message-reactions">

            ${
                Object.entries(counts)
                    .map(
                        ([emoji, count]) => `
                            <button
                                type="button"
                                class="reaction-chip"
                                data-reaction="${escapeHtml(emoji)}"
                                data-message-id="${escapeHtml(messageId)}"
                            >
                                ${escapeHtml(emoji)}
                                ${count}
                            </button>
                        `
                    )
                    .join("")
            }

        </div>
    `;
}


/* =========================================================
   MESSAGE ACTIONS
   ========================================================= */

function attachMessageActions() {

    $$(".message-action").forEach(button => {

        button.addEventListener(
            "click",
            async event => {

                const messageId =
                    button.dataset.messageId;

                const action =
                    button.dataset.action;

                if (action === "delete") {

                    await deleteMessage(
                        messageId
                    );

                    return;
                }

                if (action === "react") {

                    await toggleReaction(
                        messageId,
                        "👍"
                    );
                }
            }
        );
    });


    $$(".reaction-chip").forEach(button => {

        button.addEventListener(
            "click",
            async () => {

                await toggleReaction(
                    button.dataset.messageId,
                    button.dataset.reaction
                );
            }
        );
    });
}


/* =========================================================
   DELETE MESSAGE
   ========================================================= */

async function deleteMessage(messageId) {

    if (!state.user) {

        showToast(
            "Please sign in first.",
            "error"
        );

        return;
    }

    const message =
        state.messages.find(
            item =>
                item.id === messageId
        );

    if (!message) return;

    if (
        message.user_id !==
        state.user.id
    ) {

        showToast(
            "You can only delete your own messages.",
            "error"
        );

        return;
    }

    const confirmed =
        window.confirm(
            "Delete this message?"
        );

    if (!confirmed) return;

    const {
        error
    } = await supabase
        .from("chat_messages")
        .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            content: "This message was deleted.",
            updated_at: new Date().toISOString()
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
            "Delete message error:",
            error
        );

        showToast(
            "Could not delete message.",
            "error"
        );

        return;
    }

    message.is_deleted = true;

    message.deleted_at =
        new Date().toISOString();

    message.content =
        "This message was deleted.";

    renderMessages();

    showToast(
        "Message deleted.",
        "success"
    );
}


/* =========================================================
   REACTION TOGGLE
   ========================================================= */

async function toggleReaction(
    messageId,
    reaction
) {

    if (!state.user) return;

    const {
        data: existing,
        error: lookupError
    } = await supabase
        .from("chat_message_reactions")
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
            "Reaction lookup error:",
            lookupError
        );

        return;
    }

    if (existing) {

        const {
            error
        } = await supabase
            .from("chat_message_reactions")
            .delete()
            .eq(
                "id",
                existing.id
            );

        if (error) {

            console.error(
                "Reaction removal error:",
                error
            );

            return;
        }

    } else {

        const {
            error
        } = await supabase
            .from("chat_message_reactions")
            .insert({
                message_id: messageId,
                user_id: state.user.id,
                reaction
            });

        if (error) {

            console.error(
                "Reaction insert error:",
                error
            );

            return;
        }
    }

    if (state.selectedChannel) {

        await loadMessages(
            state.selectedChannel.id
        );
    }
}


/* =========================================================
   SEND TEXT MESSAGE
   ========================================================= */

async function sendTextMessage() {

    if (!state.user) {

        showToast(
            "Please sign in first.",
            "error"
        );

        return;
    }

    if (!state.selectedChannel) {

        showToast(
            "Select a channel first.",
            "error"
        );

        return;
    }

    const input =
        $("#messageInput");

    if (!input) return;

    const content =
        input.value.trim();

    if (!content) return;

    const button =
        $("#sendMessageButton");

    if (button) {
        button.disabled = true;
    }

    const {
        error
    } = await supabase
        .from("chat_messages")
        .insert({
            channel_id:
                state.selectedChannel.id,

            user_id:
                state.user.id,

            content,

            message_type:
                "text"
        });

    if (error) {

        console.error(
            "Message send error:",
            error
        );

        showToast(
            "Could not send message.",
            "error"
        );

        if (button) {
            button.disabled = false;
        }

        return;
    }

    input.value = "";

    if (button) {
        button.disabled = false;
    }
}


/* =========================================================
   ATTACHMENT INPUT
   ========================================================= */

function initializeAttachmentUpload() {

    const button =
        $("#attachButton");

    const input =
        $("#attachmentInput");

    if (!button || !input) {

        console.warn(
            "Attachment controls not found."
        );

        return;
    }

    button.addEventListener(
        "click",
        () => {

            input.click();
        }
    );

    input.addEventListener(
        "change",
        async () => {

            const files =
                Array.from(
                    input.files || []
                );

            input.value = "";

            if (!files.length) return;

            for (const file of files) {

                await uploadAttachment(
                    file
                );
            }
        }
    );
}


/* =========================================================
   UPLOAD IMAGE / DOCUMENT
   ========================================================= */

async function uploadAttachment(file) {

    if (!state.user) {

        showToast(
            "Please sign in first.",
            "error"
        );

        return;
    }

    if (!state.selectedChannel) {

        showToast(
            "Select a channel first.",
            "error"
        );

        return;
    }

    if (file.size > MAX_FILE_SIZE) {

        showToast(
            `${file.name} is larger than 50 MB.`,
            "error"
        );

        return;
    }

    if (
        !isImageFile(file) &&
        !isDocumentFile(file)
    ) {

        showToast(
            "Only images and documents are supported here.",
            "error"
        );

        return;
    }

    showToast(
        `Uploading ${file.name}...`,
        "info"
    );

    const safeName =
        createSafeFileName(
            file.name
        );

    const folder =
        isImageFile(file)
            ? "images"
            : "documents";

    const path =
        `${state.user.id}/${folder}/${Date.now()}-${safeName}`;

    const {
        error: uploadError
    } = await supabase
        .storage
        .from(STORAGE_BUCKET)
        .upload(
            path,
            file,
            {
                cacheControl: "3600",
                contentType:
                    file.type ||
                    "application/octet-stream",
                upsert: false
            }
        );

    if (uploadError) {

        console.error(
            "Storage upload error:",
            uploadError
        );

        showToast(
            "File upload failed.",
            "error"
        );

        return;
    }

    const {
        data: publicData
    } = supabase
        .storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);

    const fileUrl =
        publicData?.publicUrl;

    if (!fileUrl) {

        showToast(
            "Could not create file URL.",
            "error"
        );

        return;
    }

    const {
        data: message,
        error: messageError
    } = await supabase
        .from("chat_messages")
        .insert({
            channel_id:
                state.selectedChannel.id,

            user_id:
                state.user.id,

            content:
                file.name,

            message_type:
                isImageFile(file)
                    ? "image"
                    : "file"
        })
        .select()
        .single();

    if (messageError) {

        console.error(
            "Message creation error:",
            messageError
        );

        showToast(
            "File message could not be created.",
            "error"
        );

        return;
    }

    const {
        error: attachmentError
    } = await supabase
        .from("chat_attachments")
        .insert({
            message_id:
                message.id,

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
            "Attachment record error:",
            attachmentError
        );

        showToast(
            "File uploaded, but attachment record failed.",
            "error"
        );

        return;
    }

    showToast(
        "File uploaded successfully.",
        "success"
    );

    await loadMessages(
        state.selectedChannel.id
    );
}


/* =========================================================
   SAFE FILE NAME
   ========================================================= */

function createSafeFileName(
    fileName
) {

    return String(fileName || "file")
        .replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
        )
        .slice(
            0,
            180
        );
}


/* =========================================================
   EMOJI PICKER
   ========================================================= */

function initializeEmojiPicker() {

    const button =
        $("#emojiButton");

    const wrapper =
        $("#emojiPicker");

    if (!button || !wrapper) {

        return;
    }

    button.addEventListener(
        "click",
        event => {

            event.preventDefault();

            event.stopPropagation();

            wrapper.classList.toggle(
                "show"
            );

            wrapper.style.display =
                wrapper.classList.contains("show")
                    ? "block"
                    : "none";
        }
    );

    const picker =
        wrapper.querySelector(
            "emoji-picker"
        );

    if (picker) {

        picker.addEventListener(
            "emoji-click",
            event => {

                const emoji =
                    event.detail?.unicode;

                if (!emoji) return;

                const input =
                    $("#messageInput");

                if (!input) return;

                insertAtCursor(
                    input,
                    emoji
                );

                closeEmojiPicker();
            }
        );
    }

    document.addEventListener(
        "click",
        event => {

            if (
                !wrapper.contains(event.target) &&
                !button.contains(event.target)
            ) {

                closeEmojiPicker();
            }
        }
    );
}


function closeEmojiPicker() {

    const wrapper =
        $("#emojiPicker");

    if (!wrapper) return;

    wrapper.classList.remove(
        "show"
    );

    wrapper.style.display = "none";
}


function insertAtCursor(
    input,
    text
) {

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
        text +
        input.value.slice(
            end
        );

    const cursor =
        start + text.length;

    input.focus();

    input.setSelectionRange(
        cursor,
        cursor
    );
}


/* =========================================================
   GIF
   ========================================================= */

function initializeGif() {

    const button =
        $("#gifButton");

    const picker =
        $("#gifPicker");

    if (!button || !picker) {
        return;
    }

    button.addEventListener(
        "click",
        event => {

            event.preventDefault();

            event.stopPropagation();

            picker.classList.toggle(
                "show"
            );

            picker.style.display =
                picker.classList.contains("show")
                    ? "block"
                    : "none";
        }
    );

    const previewButton =
        $("#previewGifButton");

    const sendButton =
        $("#sendGifButton");

    const input =
        $("#gifUrlInput");

    const preview =
        $("#gifPreview");

    if (previewButton) {

        previewButton.addEventListener(
            "click",
            () => {

                const url =
                    input?.value.trim();

                if (!url) return;

                preview.innerHTML = `
                    <img
                        src="${safeUrl(url)}"
                        alt="GIF preview"
                    >
                `;
            }
        );
    }

    if (sendButton) {

        sendButton.addEventListener(
            "click",
            async () => {

                const url =
                    input?.value.trim();

                if (!url) {

                    showToast(
                        "Enter a GIF URL first.",
                        "error"
                    );

                    return;
                }

                await sendGif(url);

                if (input) {
                    input.value = "";
                }

                if (preview) {
                    preview.innerHTML = "";
                }

                closeGifPicker();
            }
        );
    }

    document.addEventListener(
        "click",
        event => {

            if (
                !picker.contains(event.target) &&
                !button.contains(event.target)
            ) {

                closeGifPicker();
            }
        }
    );
}


function closeGifPicker() {

    const picker =
        $("#gifPicker");

    if (!picker) return;

    picker.classList.remove(
        "show"
    );

    picker.style.display = "none";
}


async function sendGif(url) {

    if (!state.user) return;

    if (!state.selectedChannel) {

        showToast(
            "Select a channel first.",
            "error"
        );

        return;
    }

    const validUrl =
        safeUrl(url);

    if (validUrl === "#") {

        showToast(
            "Invalid GIF URL.",
            "error"
        );

        return;
    }

    const {
        error
    } = await supabase
        .from("chat_messages")
        .insert({
            channel_id:
                state.selectedChannel.id,

            user_id:
                state.user.id,

            content:
                validUrl,

            message_type:
                "gif"
        });

    if (error) {

        console.error(
            "GIF send error:",
            error
        );

        showToast(
            "Could not send GIF.",
            "error"
        );

        return;
    }

    showToast(
        "GIF sent.",
        "success"
    );
}


/* =========================================================
   VOICE NOTES
   ========================================================= */

function initializeVoiceNotes() {

    const button =
        $("#voiceNoteButton");

    if (!button) return;

    button.addEventListener(
        "click",
        async () => {

            if (state.isRecording) {

                await stopVoiceRecording();

            } else {

                await startVoiceRecording();
            }
        }
    );

    const cancelButton =
        $("#cancelVoiceNoteButton");

    if (cancelButton) {

        cancelButton.addEventListener(
            "click",
            () => {

                cancelVoiceRecording();
            }
        );
    }

    const stopButton =
        $("#stopVoiceNoteButton");

    if (stopButton) {

        stopButton.addEventListener(
            "click",
            async () => {

                await stopVoiceRecording();
            }
        );
    }
}


async function startVoiceRecording() {

    if (!navigator.mediaDevices?.getUserMedia) {

        showToast(
            "Voice recording is not supported by this browser.",
            "error"
        );

        return;
    }

    if (!state.user) {

        showToast(
            "Please sign in first.",
            "error"
        );

        return;
    }

    if (!state.selectedChannel) {

        showToast(
            "Select a channel first.",
            "error"
        );

        return;
    }

    try {

        const stream =
            await navigator.mediaDevices.getUserMedia({
                audio: true
            });

        const mimeTypes = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/ogg;codecs=opus",
            "audio/ogg",
            "audio/mp4",
            "audio/mpeg"
        ];

        let selectedMime = "";

        for (const mimeType of mimeTypes) {

            if (
                MediaRecorder.isTypeSupported(
                    mimeType
                )
            ) {

                selectedMime =
                    mimeType;

                break;
            }
        }

        const recorder =
            selectedMime
                ? new MediaRecorder(
                    stream,
                    {
                        mimeType:
                            selectedMime
                    }
                )
                : new MediaRecorder(
                    stream
                );

        state.mediaRecorder =
            recorder;

        state.recordingStream =
            stream;

        state.recordingChunks = [];

        state.recordingStartedAt =
            Date.now();

        state.isRecording =
            true;

        recorder.addEventListener(
            "dataavailable",
            event => {

                if (
                    event.data &&
                    event.data.size > 0
                ) {

                    state.recordingChunks.push(
                        event.data
                    );
                }
            }
        );

        recorder.addEventListener(
            "stop",
            async () => {

                const chunks =
                    state.recordingChunks;

                const mimeType =
                    recorder.mimeType ||
                    "audio/webm";

                state.recordingChunks =
                    [];

                if (!chunks.length) {
                    return;
                }

                const blob =
                    new Blob(
                        chunks,
                        {
                            type: mimeType
                        }
                    );

                await uploadVoiceNote(
                    blob,
                    mimeType
                );
            }
        );

        recorder.start();

        showVoiceRecorder();

        startVoiceTimer();

    } catch (error) {

        console.error(
            "Microphone error:",
            error
        );

        showToast(
            "Microphone access was denied or unavailable.",
            "error"
        );
    }
}


async function stopVoiceRecording() {

    if (
        !state.mediaRecorder ||
        !state.isRecording
    ) {
        return;
    }

    state.mediaRecorder.stop();

    state.recordingStream
        ?.getTracks()
        .forEach(
            track =>
                track.stop()
        );

    state.recordingStream = null;

    state.isRecording = false;

    stopVoiceTimer();

    hideVoiceRecorder();
}


function cancelVoiceRecording() {

    if (state.mediaRecorder) {

        try {

            state.mediaRecorder.ondataavailable =
                null;

            state.mediaRecorder.onstop =
                null;

            if (
                state.mediaRecorder.state !==
                "inactive"
            ) {

                state.mediaRecorder.stop();
            }

        } catch (error) {

            console.warn(
                "Could not cancel recorder:",
                error
            );
        }
    }

    state.recordingStream
        ?.getTracks()
        .forEach(
            track =>
                track.stop()
        );

    state.mediaRecorder = null;

    state.recordingStream = null;

    state.recordingChunks = [];

    state.isRecording = false;

    stopVoiceTimer();

    hideVoiceRecorder();

    showToast(
        "Voice recording cancelled.",
        "info"
    );
}


function showVoiceRecorder() {

    const bar =
        $("#voiceRecorderBar");

    if (bar) {

        bar.classList.add("show");

        bar.style.display = "";
    }

    const indicator =
        $("#voiceRecorderIndicator");

    if (indicator) {

        indicator.textContent =
            "Recording...";
    }
}


function hideVoiceRecorder() {

    const bar =
        $("#voiceRecorderBar");

    if (!bar) return;

    bar.classList.remove("show");

    bar.style.display = "none";
}


function startVoiceTimer() {

    stopVoiceTimer();

    state.recordingTimer =
        setInterval(
            () => {

                const timer =
                    $("#voiceRecorderTimer");

                if (!timer) return;

                const elapsed =
                    Math.floor(
                        (
                            Date.now() -
                            state.recordingStartedAt
                        ) / 1000
                    );

                const minutes =
                    String(
                        Math.floor(
                            elapsed / 60
                        )
                    ).padStart(2, "0");

                const seconds =
                    String(
                        elapsed % 60
                    ).padStart(2, "0");

                timer.textContent =
                    `${minutes}:${seconds}`;

            },
            1000
        );
}


function stopVoiceTimer() {

    if (state.recordingTimer) {

        clearInterval(
            state.recordingTimer
        );

        state.recordingTimer = null;
    }
}


/* =========================================================
   UPLOAD VOICE NOTE
   ========================================================= */

async function uploadVoiceNote(
    blob,
    mimeType
) {

    if (!state.user) return;

    if (!state.selectedChannel) return;

    const extension =
        mimeType.includes("ogg")
            ? "ogg"
            : mimeType.includes("mp4")
                ? "m4a"
                : mimeType.includes("mpeg")
                    ? "mp3"
                    : "webm";

    const fileName =
        `voice-${Date.now()}.${extension}`;

    const path =
        `${state.user.id}/voice-notes/${fileName}`;

    const {
        error: uploadError
    } = await supabase
        .storage
        .from(STORAGE_BUCKET)
        .upload(
            path,
            blob,
            {
                cacheControl: "3600",
                contentType: mimeType,
                upsert: false
            }
        );

    if (uploadError) {

        console.error(
            "Voice upload error:",
            uploadError
        );

        showToast(
            "Voice note upload failed.",
            "error"
        );

        return;
    }

    const {
        data: publicData
    } = supabase
        .storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);

    const fileUrl =
        publicData?.publicUrl;

    if (!fileUrl) return;

    const {
        data: message,
        error: messageError
    } = await supabase
        .from("chat_messages")
        .insert({
            channel_id:
                state.selectedChannel.id,

            user_id:
                state.user.id,

            content:
                "Voice note",

            message_type:
                "voice"
        })
        .select()
        .single();

    if (messageError) {

        console.error(
            "Voice message error:",
            messageError
        );

        return;
    }

    const {
        error: attachmentError
    } = await supabase
        .from("chat_attachments")
        .insert({
            message_id:
                message.id,

            uploaded_by:
                state.user.id,

            file_name:
                fileName,

            file_path:
                path,

            file_url:
                fileUrl,

            mime_type:
                mimeType,

            file_size:
                blob.size
        });

    if (attachmentError) {

        console.error(
            "Voice attachment error:",
            attachmentError
        );

        return;
    }

    showToast(
        "Voice note sent.",
        "success"
    );

    await loadMessages(
        state.selectedChannel.id
    );
}


/* =========================================================
   GENERAL CALL
   ---------------------------------------------------------
   call.js owns the real call engine.
   ========================================================= */

function initializeGeneralCall() {

    const button =
        $("#generalCallButton");

    if (!button) return;

    button.addEventListener(
        "click",
        () => {

            openGeneralCallModal();
        }
    );

    const cancel =
        $("#cancelGeneralCallButton");

    if (cancel) {

        cancel.addEventListener(
            "click",
            closeGeneralCallModal
        );
    }

    const start =
        $("#startGeneralCallButton");

    if (start) {

        start.addEventListener(
            "click",
            () => {

                const targetInput =
                    $("#generalCallUserId");

                const targetUserId =
                    targetInput?.value.trim() ||
                    null;

                const mode =
                    state.generalCallMode ||
                    "voice";

                window.dispatchEvent(
                    new CustomEvent(
                        "mwaniki:general-call",
                        {
                            detail: {
                                targetUserId,
                                mode
                            }
                        }
                    )
                );

                closeGeneralCallModal();
            }
        );
    }

    $$(".general-call-mode").forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    state.generalCallMode =
                        button.dataset.mode ||
                        "voice";

                    $$(".general-call-mode")
                        .forEach(
                            item =>
                                item.classList.remove(
                                    "active"
                                )
                        );

                    button.classList.add(
                        "active"
                    );
                }
            );
        }
    );
}


function openGeneralCallModal() {

    const modal =
        $("#generalCallModal");

    if (!modal) {

        showToast(
            "General call panel is unavailable.",
            "error"
        );

        return;
    }

    modal.classList.add("show");

    modal.style.display = "";
}


function closeGeneralCallModal() {

    const modal =
        $("#generalCallModal");

    if (!modal) return;

    modal.classList.remove(
        "show"
    );

    modal.style.display = "none";
}


/* =========================================================
   MESSAGE COMPOSER
   ========================================================= */

function initializeComposer() {

    const input =
        $("#messageInput");

    const button =
        $("#sendMessageButton");

    if (button) {

        button.addEventListener(
            "click",
            async () => {

                await sendTextMessage();
            }
        );
    }

    if (input) {

        input.addEventListener(
            "keydown",
            async event => {

                if (
                    event.key === "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();

                    await sendTextMessage();
                }
            }
        );
    }
}


/* =========================================================
   COMMUNITY / CHANNEL SEARCH
   ========================================================= */

function initializeSearch() {

    const channelSearch =
        $("#channelSearch");

    if (channelSearch) {

        channelSearch.addEventListener(
            "input",
            () => {

                const query =
                    channelSearch.value
                        .trim()
                        .toLowerCase();

                $$(".channel-item")
                    .forEach(button => {

                        const name =
                            button
                                .querySelector(
                                    ".channel-name"
                                )
                                ?.textContent
                                .toLowerCase() || "";

                        button.style.display =
                            !query ||
                            name.includes(query)
                                ? ""
                                : "none";
                    });
            }
        );
    }


    const communitySearch =
        $("#communitySearch");

    if (communitySearch) {

        communitySearch.addEventListener(
            "input",
            () => {

                const query =
                    communitySearch.value
                        .trim()
                        .toLowerCase();

                $$(".community-item")
                    .forEach(button => {

                        const name =
                            button
                                .querySelector(
                                    ".community-item-name"
                                )
                                ?.textContent
                                .toLowerCase() || "";

                        button.style.display =
                            !query ||
                            name.includes(query)
                                ? ""
                                : "none";
                    });
            }
        );
    }
}


/* =========================================================
   REALTIME
   ========================================================= */

function unsubscribeRealtime() {

    if (
        state.messageSubscription
    ) {

        supabase.removeChannel(
            state.messageSubscription
        );

        state.messageSubscription =
            null;
    }

    if (
        state.reactionSubscription
    ) {

        supabase.removeChannel(
            state.reactionSubscription
        );

        state.reactionSubscription =
            null;
    }

    if (
        state.attachmentSubscription
    ) {

        supabase.removeChannel(
            state.attachmentSubscription
        );

        state.attachmentSubscription =
            null;
    }
}


function subscribeToChannel(channelId) {

    unsubscribeRealtime();

    if (!channelId) return;

    state.messageSubscription =
        supabase
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
                async payload => {

                    console.log(
                        "📨 Message realtime:",
                        payload.eventType
                    );

                    await loadMessages(
                        channelId
                    );
                }
            )
            .subscribe();


    state.reactionSubscription =
        supabase
            .channel(
                `community-reactions-${channelId}`
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_message_reactions"
                },
                async () => {

                    await loadMessages(
                        channelId
                    );
                }
            )
            .subscribe();


    state.attachmentSubscription =
        supabase
            .channel(
                `community-attachments-${channelId}`
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_attachments"
                },
                async () => {

                    await loadMessages(
                        channelId
                    );
                }
            )
            .subscribe();
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function initializeNavigation() {

    const dashboardButtons = [
        "#dashboardButton",
        "#homeButton"
    ];

    dashboardButtons.forEach(selector => {

        const button = $(selector);

        if (!button) return;

        button.addEventListener(
            "click",
            () => {

                window.location.href =
                    "./dashboard.html";
            }
        );
    });


    const profileButton =
        $("#profileButton");

    if (profileButton) {

        profileButton.addEventListener(
            "click",
            () => {

                window.location.href =
                    "./dashboard.html";
            }
        );
    }
}


/* =========================================================
   MODALS
   ========================================================= */

function initializeModals() {

    $$("[data-close-modal]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const selector =
                        button.dataset.closeModal;

                    const modal =
                        $(selector);

                    if (!modal) return;

                    modal.classList.remove(
                        "show"
                    );

                    modal.style.display =
                        "none";
                }
            );
        });


    $$(".modal")
        .forEach(modal => {

            modal.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        modal
                    ) {

                        modal.classList.remove(
                            "show"
                        );

                        modal.style.display =
                            "none";
                    }
                }
            );
        });
}


/* =========================================================
   AUTH STATE
   ========================================================= */

function initializeAuthListener() {

    supabase.auth.onAuthStateChange(
        async (event, session) => {

            console.log(
                "🔐 Community auth:",
                event
            );

            state.user =
                session?.user || null;

            if (!state.user) {

                return;
            }

            await loadMyProfile();
        }
    );
}


/* =========================================================
   CLEANUP
   ========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        unsubscribeRealtime();

        if (
            state.recordingStream
        ) {

            state.recordingStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );
        }

        stopVoiceTimer();
    }
);


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeCommunity() {

    console.log(
        "🚀 Initializing Mwaniki Scholars Community..."
    );

    initializeRules();

    initializeComposer();

    initializeAttachmentUpload();

    initializeEmojiPicker();

    initializeGif();

    initializeVoiceNotes();

    initializeGeneralCall();

    initializeSearch();

    initializeNavigation();

    initializeModals();

    initializeAuthListener();

    await loadCurrentUser();

    if (!state.user) {

        showToast(
            "Please sign in to use the community.",
            "error"
        );

        return;
    }

    await loadMyProfile();

    await loadCommunities();

    console.log(
        "✅ Mwaniki Scholars Community initialized."
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
        initializeCommunity,
        {
            once: true
        }
    );

} else {

    initializeCommunity();
}
