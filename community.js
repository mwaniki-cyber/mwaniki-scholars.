/* =========================================================
   MWANIKI SCHOLARS COMMUNITY ENGINE
   community.js
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
    throw new Error("Supabase client unavailable.");
}

console.log("🚀 Mwaniki Scholars Community engine loaded");


/* =========================================================
   CONFIGURATION
   ========================================================= */

const DEFAULT_DISCUSSION_NAME = "Mwaniki Scholars";

const DEFAULT_DISCUSSION_ID =
    "9044c031-71da-496d-9166-ff19ed4fcb62";

const STORAGE_BUCKET = "chat-attachments";

const RULES_VERSION = "mwaniki-community-rules-v3";

const PAGE_SIZE = 50;


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
    hasMoreMessages: false,

    profiles: new Map(),
    reactions: new Map(),
    attachments: new Map(),

    communitySubscription: null,
    channelSubscription: null,
    attachmentSubscription: null,

    loading: false,

    rulesAccepted: false,

    reactionOpenFor: null,

    generalCallMode: "voice",

    mediaRecorder: null,
    recordingStream: null,
    recordingChunks: [],
    recordingStartedAt: null,
    recordingTimer: null,
    isRecording: false,

    pendingAttachments: []
};


/* =========================================================
   DOM
   ========================================================= */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => [
    ...document.querySelectorAll(selector)
];


/* =========================================================
   BASIC UTILITIES
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

    if (!value) return "";

    try {

        const url = new URL(value, window.location.href);

        if (
            url.protocol === "http:" ||
            url.protocol === "https:" ||
            url.protocol === "blob:"
        ) {
            return url.href;
        }

    } catch (error) {
        console.warn("Invalid URL:", value);
    }

    return "";
}


function formatFileSize(bytes) {

    if (!bytes || bytes <= 0) {
        return "0 B";
    }

    const units = [
        "B",
        "KB",
        "MB",
        "GB"
    ];

    const index = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        units.length - 1
    );

    return (
        bytes / Math.pow(1024, index)
    ).toFixed(index === 0 ? 0 : 1) +
        " " +
        units[index];
}


function formatTime(dateValue) {

    if (!dateValue) return "";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}


function formatDate(dateValue) {

    if (!dateValue) return "";

    const date = new Date(dateValue);

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

    const text = String(name || "Student").trim();

    if (!text) {
        return "S";
    }

    const parts = text.split(/\s+/);

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
}


function getCommunityFallbackIcon(community) {

    const name = String(
        community?.name || community?.slug || ""
    ).toLowerCase();

    if (
        name.includes("gaming") ||
        name.includes("game")
    ) {
        return "🎮";
    }

    if (
        name.includes("meme")
    ) {
        return "😂";
    }

    if (
        name.includes("general")
    ) {
        return "🌐";
    }

    if (
        name.includes("scholar")
    ) {
        return "🎓";
    }

    return "💬";
}


function renderIcon(item, className = "") {

    const iconUrl = safeUrl(item?.icon_url);

    if (iconUrl) {

        return `
            <img
                class="${className}"
                src="${escapeHtml(iconUrl)}"
                alt=""
                loading="lazy"
            >
        `;
    }

    return `
        <span class="${className}">
            ${escapeHtml(getCommunityFallbackIcon(item))}
        </span>
    `;
}


function isImageFile(file) {

    return Boolean(
        file &&
        file.type &&
        file.type.startsWith("image/")
    );
}


function isAudioFile(file) {

    return Boolean(
        file &&
        file.type &&
        file.type.startsWith("audio/")
    );
}


function isDocumentFile(file) {

    if (!file) return false;

    if (
        file.type &&
        (
            file.type === "application/pdf" ||
            file.type.startsWith("text/") ||
            file.type.includes("word") ||
            file.type.includes("excel") ||
            file.type.includes("spreadsheet") ||
            file.type.includes("powerpoint") ||
            file.type.includes("presentation")
        )
    ) {
        return true;
    }

    return /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|csv)$/i.test(
        file.name || ""
    );
}


function createSafeFileName(fileName) {

    const original = String(
        fileName || "file"
    );

    const extensionMatch =
        original.match(/(\.[^.]+)$/);

    const extension =
        extensionMatch
            ? extensionMatch[1].toLowerCase()
            : "";

    const base =
        original
            .replace(/\.[^.]+$/, "")
            .replace(/[^a-zA-Z0-9_-]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 100);

    return (
        base ||
        "file"
    ) + extension;
}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(message, type = "info") {

    const existing = $("#communityToast");

    if (existing) {
        existing.remove();
    }

    const toast = document.createElement("div");

    toast.id = "communityToast";

    toast.className =
        `community-toast community-toast-${type}`;

    toast.textContent = message;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    setTimeout(() => {

        toast.classList.remove("show");

        setTimeout(() => {
            toast.remove();
        }, 250);

    }, 3200);
}


/* =========================================================
   ACCESSIBILITY ANNOUNCER
   ========================================================= */

function announce(message) {

    const element =
        $("#communityLiveRegion") ||
        $("#communityAnnouncer");

    if (!element) return;

    element.textContent = "";

    setTimeout(() => {
        element.textContent = message;
    }, 20);
}


/* =========================================================
   COMMUNITY RULES
   ========================================================= */

function getRulesAccepted() {

    try {
        return localStorage.getItem(
            RULES_VERSION
        ) === "true";
    } catch (error) {
        console.warn(
            "Could not read rules state:",
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
            "Could not save rules state:",
            error
        );
    }

    state.rulesAccepted = true;
}


function closeRulesGate() {

    const gate =
        $("#rulesGate");

    if (!gate) {
        return;
    }

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

    const gate =
        $("#rulesGate");

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


    /*
     * Support the expected button ID first.
     */

    const possibleButtons = [
        "#acceptRulesButton",
        "#agreeRulesButton",
        "#agreeAndContinueButton",
        "#continueRulesButton",
        "#rulesAgreeButton"
    ];


    let button = null;

    for (const selector of possibleButtons) {

        const candidate =
            $(selector);

        if (candidate) {

            button = candidate;
            break;
        }
    }


    /*
     * If the ID isn't present, find the button
     * from inside the rules gate.
     */

    if (!button) {

        button =
            gate.querySelector(
                "button[type='button']"
            ) ||
            gate.querySelector(
                "button"
            );
    }


    if (!button) {

        console.error(
            "❌ No Agree and Continue button found inside #rulesGate."
        );

        return;
    }


    /*
     * Remove an old listener by replacing the
     * button with a clone.
     *
     * This prevents duplicate listeners.
     */

    const cleanButton =
        button.cloneNode(true);

    button.replaceWith(
        cleanButton
    );


    cleanButton.disabled = false;

    cleanButton.removeAttribute(
        "disabled"
    );

    cleanButton.style.pointerEvents =
        "auto";

    cleanButton.style.cursor =
        "pointer";


    cleanButton.addEventListener(
        "click",
        function handleRulesAccept(event) {

            event.preventDefault();
            event.stopPropagation();

            console.log(
                "✅ Community rules accepted."
            );

            setRulesAccepted();

            closeRulesGate();
        }
    );


    /*
     * Also support keyboard activation.
     */

    cleanButton.addEventListener(
        "keydown",
        function handleRulesKeyboard(event) {

            if (
                event.key === "Enter" ||
                event.key === " "
            ) {

                event.preventDefault();

                cleanButton.click();
            }
        }
    );
}


function initializeRules() {

    state.rulesAccepted =
        getRulesAccepted();

    if (state.rulesAccepted) {

        const gate =
            $("#rulesGate");

        if (gate) {

            gate.classList.add(
                "hidden"
            );

            gate.style.display =
                "none";

            gate.setAttribute(
                "aria-hidden",
                "true"
            );
        }

        return;
    }

    showRulesGate();
}

/* =========================================================
   PROFILE
   ========================================================= */

async function loadOwnProfile() {

    if (!state.user) return;

    try {

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
                "Profile lookup failed:",
                error.message
            );
            return;
        }

        state.profile = data || {
            id: state.user.id,
            full_name:
                state.user.email ||
                "Student"
        };

        renderOwnProfile();

    } catch (error) {

        console.error(
            "Profile error:",
            error
        );
    }
}


function renderOwnProfile() {

    const profile =
        state.profile || {};

    const name =
        profile.full_name ||
        state.user?.email ||
        "Student";

    const photo =
        safeUrl(profile.photo_url);

    const initials =
        getInitials(name);

    const avatarSelectors = [
        "#profileAvatar",
        "#headerProfileAvatar",
        "#profileLargeAvatar"
    ];

    avatarSelectors.forEach(selector => {

        const element = $(selector);

        if (!element) return;

        if (photo) {

            element.innerHTML = `
                <img
                    src="${escapeHtml(photo)}"
                    alt="${escapeHtml(name)}"
                >
            `;

        } else {

            element.textContent = initials;
        }
    });


    const nameSelectors = [
        "#profileName",
        "#headerProfileName",
        "#currentUserName"
    ];

    nameSelectors.forEach(selector => {

        const element = $(selector);

        if (element) {
            element.textContent = name;
        }
    });
}


/* =========================================================
   PUBLIC PROFILES
   ========================================================= */

async function loadPublicProfiles(userIds) {

    const ids = [
        ...new Set(
            userIds.filter(Boolean)
        )
    ];

    if (!ids.length) {
        return;
    }

    const missingIds =
        ids.filter(
            id => !state.profiles.has(id)
        );

    if (!missingIds.length) {
        return;
    }

    try {

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
                "Public profile lookup failed:",
                error.message
            );

            missingIds.forEach(id => {

                state.profiles.set(id, {
                    id,
                    full_name: "Student",
                    photo_url: null
                });

            });

            return;
        }

        const found =
            new Set(
                (data || []).map(row => row.id)
            );

        (data || []).forEach(profile => {

            state.profiles.set(
                profile.id,
                profile
            );
        });

        missingIds.forEach(id => {

            if (!found.has(id)) {

                state.profiles.set(id, {
                    id,
                    full_name: "Student",
                    photo_url: null
                });
            }
        });

    } catch (error) {

        console.error(
            "Public profiles error:",
            error
        );
    }
}


function getMessageAuthor(message) {

    if (
        message.user_id === state.user?.id &&
        state.profile
    ) {
        return state.profile;
    }

    return (
        state.profiles.get(message.user_id) || {
            id: message.user_id,
            full_name: "Student",
            photo_url: null
        }
    );
}


/* =========================================================
   COMMUNITIES
   ========================================================= */

async function loadCommunities() {

    console.log(
        "🌐 Loading Mwaniki Scholars communities..."
    );

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
            "❌ Failed to load communities:",
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

    console.log(
        `✅ ${state.communities.length} communities loaded.`
    );

    renderCommunityList();

    /*
     * IMPORTANT:
     * Mwaniki Scholars must always be the
     * default discussion community.
     */

    let defaultCommunity =
        state.communities.find(
            community =>
                community.id ===
                DEFAULT_DISCUSSION_ID
        );

    if (!defaultCommunity) {

        defaultCommunity =
            state.communities.find(
                community =>
                    String(
                        community.name || ""
                    ).toLowerCase() ===
                    DEFAULT_DISCUSSION_NAME.toLowerCase()
            );
    }

    if (!defaultCommunity) {

        defaultCommunity =
            state.communities[0] || null;
    }

    if (defaultCommunity) {

        await selectCommunity(
            defaultCommunity.id,
            false
        );
    }
}


function renderCommunityList() {

    const containers = [
        "#communityList",
        "#communitiesList",
        "#communityRailList"
    ];

    const container =
        containers
            .map(selector => $(selector))
            .find(Boolean);

    if (!container) {
        return;
    }

    container.innerHTML =
        state.communities
            .map(community => {

                const active =
                    state.selectedCommunity?.id ===
                    community.id;

                return `
                    <button
                        type="button"
                        class="community-item ${
                            active ? "active" : ""
                        }"
                        data-community-id="${
                            escapeHtml(community.id)
                        }"
                        title="${
                            escapeHtml(community.name)
                        }"
                    >
                        <span class="community-item-icon">
                            ${renderIcon(community)}
                        </span>

                        <span class="community-item-name">
                            ${escapeHtml(
                                community.name
                            )}
                        </span>
                    </button>
                `;
            })
            .join("");

    container
        .querySelectorAll(
            "[data-community-id]"
        )
        .forEach(button => {

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

async function selectCommunity(
    communityId,
    announceChange = true
) {

    const community =
        state.communities.find(
            item => item.id === communityId
        );

    if (!community) {
        return;
    }

    if (
        state.selectedCommunity?.id ===
        community.id &&
        state.channels.length
    ) {

        renderCommunityList();

        return;
    }

    state.selectedCommunity =
        community;

    state.selectedChannel = null;

    state.channels = [];

    state.messages = [];

    if (state.channelSubscription) {

        await supabase.removeChannel(
            state.channelSubscription
        );

        state.channelSubscription = null;
    }

    if (state.attachmentSubscription) {

        await supabase.removeChannel(
            state.attachmentSubscription
        );

        state.attachmentSubscription = null;
    }

    renderCommunityList();

    renderSelectedCommunity();

    console.log(
        "🌐 Automatically entering:",
        community.name
    );

    await loadChannels();

    if (announceChange) {

        announce(
            `Entered ${community.name} community.`
        );
    }
}


function renderSelectedCommunity() {

    const community =
        state.selectedCommunity;

    if (!community) return;

    const titleElements = [
        "#communityName",
        "#currentCommunityName",
        "#sidebarCommunityName",
        "#communityTitle"
    ];

    titleElements.forEach(selector => {

        const element = $(selector);

        if (element) {
            element.textContent =
                community.name;
        }
    });

    const description =
        $("#communityDescription");

    if (description) {

        description.textContent =
            community.description || "";
    }

    const icon =
        $("#communityHeaderIcon");

    if (icon) {

        icon.innerHTML =
            renderIcon(community);
    }
}


/* =========================================================
   CHANNELS
   ========================================================= */

async function loadChannels() {

    if (!state.selectedCommunity) {
        return;
    }

    const communityId =
        state.selectedCommunity.id;

    console.log(
        "📡 Loading channels automatically for:",
        communityId
    );

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
        .eq("community_id", communityId)
        .eq("is_active", true)
        .eq("is_archived", false)
        .order("position", {
            ascending: true,
            nullsFirst: false
        })
        .order("created_at", {
            ascending: true
        });

    if (error) {

        console.error(
            "❌ Channel loading failed:",
            error
        );

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

    /*
     * Automatically enter the first available
     * channel in the selected community.
     */

    const savedChannelId =
        getSavedChannelId(communityId);

    let channel =
        state.channels.find(
            item => item.id === savedChannelId
        );

    if (!channel) {
        channel =
            state.channels[0] || null;
    }

    if (channel) {

        await selectChannel(
            channel.id,
            false
        );
    }

    console.log(
        `📢 Automatic channel loading complete: ${state.channels.length}`
    );
}


function getSavedChannelId(communityId) {

    try {

        return localStorage.getItem(
            `mwanikiCommunityChannel_${communityId}`
        );

    } catch (error) {

        return null;
    }
}


function saveChannelId(
    communityId,
    channelId
) {

    try {

        localStorage.setItem(
            `mwanikiCommunityChannel_${communityId}`,
            channelId
        );

    } catch (error) {}
}


function renderChannels() {

    const container =
        $("#channelList") ||
        $("#channelsList");

    if (!container) {
        return;
    }

    if (!state.channels.length) {

        container.innerHTML = `
            <div class="channel-empty">
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
                    "#";

                return `
                    <button
                        type="button"
                        class="channel-item ${
                            active ? "active" : ""
                        }"
                        data-channel-id="${
                            escapeHtml(channel.id)
                        }"
                    >
                        <span class="channel-item-icon">
                            ${escapeHtml(icon)}
                        </span>

                        <span class="channel-item-name">
                            ${escapeHtml(channel.name)}
                        </span>

                        ${
                            channel.is_private
                                ? `<span class="channel-private">🔒</span>`
                                : ""
                        }
                    </button>
                `;
            })
            .join("");

    container
        .querySelectorAll(
            "[data-channel-id]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    await selectChannel(
                        button.dataset.channelId
                    );
                }
            );
        });
}


/* =========================================================
   SELECT CHANNEL
   ========================================================= */

async function selectChannel(
    channelId,
    announceChange = true
) {

    const channel =
        state.channels.find(
            item => item.id === channelId
        );

    if (!channel) {
        return;
    }

    state.selectedChannel =
        channel;

    saveChannelId(
        state.selectedCommunity.id,
        channel.id
    );

    state.messages = [];

    if (state.channelSubscription) {

        await supabase.removeChannel(
            state.channelSubscription
        );

        state.channelSubscription = null;
    }

    if (state.attachmentSubscription) {

        await supabase.removeChannel(
            state.attachmentSubscription
        );

        state.attachmentSubscription = null;
    }

    renderChannels();

    renderSelectedChannel();

    await loadMessages();

    subscribeToChannel();

    if (announceChange) {

        announce(
            `Opened ${channel.name} channel.`
        );
    }
}


function renderSelectedChannel() {

    const channel =
        state.selectedChannel;

    if (!channel) return;

    const titleElements = [
        "#channelName",
        "#currentChannelName",
        "#mainChannelName",
        "#activeChannelName"
    ];

    titleElements.forEach(selector => {

        const element = $(selector);

        if (element) {
            element.textContent =
                channel.name;
        }
    });

    const description =
        $("#channelDescription");

    if (description) {

        description.textContent =
            channel.description || "";
    }
}


/* =========================================================
   MESSAGE LOADING
   ========================================================= */

async function loadMessages() {

    if (!state.selectedChannel) {
        return;
    }

    const channelId =
        state.selectedChannel.id;

    state.loading = true;

    renderMessagesLoading();

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
            .eq("channel_id", channelId)
            .order("created_at", {
                ascending: false
            })
            .limit(PAGE_SIZE);

        if (error) {
            throw error;
        }

        state.messages =
            (data || []).reverse();

        state.hasMoreMessages =
            (data || []).length >= PAGE_SIZE;

        await loadMessageMetadata();

        renderMessages();

        scrollMessagesToBottom();

    } catch (error) {

        console.error(
            "❌ Message loading failed:",
            error
        );

        renderMessagesError();

    } finally {

        state.loading = false;
    }
}


async function loadMessageMetadata() {

    const messages =
        state.messages;

    if (!messages.length) {
        return;
    }

    const userIds =
        messages.map(
            message => message.user_id
        );

    await loadPublicProfiles(
        userIds
    );

    await loadAttachmentsForMessages(
        messages.map(
            message => message.id
        )
    );

    await loadReactionsForMessages(
        messages.map(
            message => message.id
        )
    );
}


/* =========================================================
   ATTACHMENTS
   ========================================================= */

async function loadAttachmentsForMessages(
    messageIds
) {

    const ids = [
        ...new Set(
            messageIds.filter(Boolean)
        )
    ];

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
        .in("message_id", ids)
        .order("created_at", {
            ascending: true
        });

    if (error) {

        console.warn(
            "Attachment loading failed:",
            error.message
        );

        return;
    }

    ids.forEach(id => {
        state.attachments.set(
            id,
            []
        );
    });

    (data || []).forEach(attachment => {

        const list =
            state.attachments.get(
                attachment.message_id
            ) || [];

        list.push(attachment);

        state.attachments.set(
            attachment.message_id,
            list
        );
    });
}


/* =========================================================
   REACTIONS
   ========================================================= */

async function loadReactionsForMessages(
    messageIds
) {

    const ids = [
        ...new Set(
            messageIds.filter(Boolean)
        )
    ];

    if (!ids.length) {
        return;
    }

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
        .in("message_id", ids);

    if (error) {

        console.warn(
            "Reaction loading failed:",
            error.message
        );

        return;
    }

    ids.forEach(id => {
        state.reactions.set(
            id,
            []
        );
    });

    (data || []).forEach(reaction => {

        const list =
            state.reactions.get(
                reaction.message_id
            ) || [];

        list.push(reaction);

        state.reactions.set(
            reaction.message_id,
            list
        );
    });
}


/* =========================================================
   MESSAGE RENDERING
   ========================================================= */

function renderMessagesLoading() {

    const container =
        $("#messages");

    if (!container) return;

    container.innerHTML = `
        <div class="messages-loading">
            Loading messages...
        </div>
    `;
}


function renderMessagesError() {

    const container =
        $("#messages");

    if (!container) return;

    container.innerHTML = `
        <div class="messages-error">
            Unable to load messages.
            <button
                type="button"
                id="retryMessagesButton"
            >
                Retry
            </button>
        </div>
    `;

    $("#retryMessagesButton")
        ?.addEventListener(
            "click",
            loadMessages
        );
}


function renderMessages() {

    const container =
        $("#messages");

    if (!container) {
        return;
    }

    if (!state.messages.length) {

        container.innerHTML = `
            <div class="messages-empty">
                <div class="messages-empty-icon">
                    💬
                </div>

                <h3>
                    No messages yet
                </h3>

                <p>
                    Start the conversation in this channel.
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        state.messages
            .map(renderMessage)
            .join("");

    bindMessageActions();
}


function renderMessage(message) {

    const author =
        getMessageAuthor(message);

    const own =
        message.user_id ===
        state.user?.id;

    const photo =
        safeUrl(author.photo_url);

    const attachments =
        state.attachments.get(
            message.id
        ) || [];

    const reactions =
        state.reactions.get(
            message.id
        ) || [];

    const deleted =
        Boolean(message.is_deleted);

    const content =
        deleted
            ? "This message was deleted."
            : message.content || "";

    const messageType =
        message.message_type || "text";

    return `
        <article
            class="chat-message ${
                own ? "own-message" : ""
            } ${
                deleted ? "deleted-message" : ""
            }"
            data-message-id="${
                escapeHtml(message.id)
            }"
        >

            <div class="message-avatar">

                ${
                    photo
                        ? `
                            <img
                                src="${escapeHtml(photo)}"
                                alt="${escapeHtml(
                                    author.full_name || "Student"
                                )}"
                                loading="lazy"
                            >
                        `
                        : `
                            <span>
                                ${escapeHtml(
                                    getInitials(
                                        author.full_name
                                    )
                                )}
                            </span>
                        `
                }

            </div>

            <div class="message-body">

                <div class="message-meta">

                    <strong>
                        ${escapeHtml(
                            author.full_name ||
                            "Student"
                        )}
                    </strong>

                    <time>
                        ${escapeHtml(
                            formatTime(
                                message.created_at
                            )
                        )}
                    </time>

                    ${
                        message.is_edited &&
                        !deleted
                            ? `<span class="message-edited">(edited)</span>`
                            : ""
                    }

                </div>

                <div class="message-content">

                    ${
                        deleted
                            ? `
                                <span class="deleted-message-text">
                                    ${escapeHtml(content)}
                                </span>
                            `
                            : renderMessageContent(
                                messageType,
                                content
                            )
                    }

                    ${
                        !deleted
                            ? renderAttachments(
                                attachments
                            )
                            : ""
                    }

                </div>

                ${
                    !deleted
                        ? renderReactions(
                            message.id,
                            reactions
                        )
                        : ""
                }

                ${
                    !deleted
                        ? `
                            <div class="message-actions">

                                <button
                                    type="button"
                                    class="message-reaction-button"
                                    data-action="reaction"
                                    data-message-id="${
                                        escapeHtml(message.id)
                                    }"
                                    title="React"
                                >
                                    😊
                                </button>

                                ${
                                    own
                                        ? `
                                            <button
                                                type="button"
                                                class="message-delete-button"
                                                data-action="delete"
                                                data-message-id="${
                                                    escapeHtml(
                                                        message.id
                                                    )
                                                }"
                                                title="Delete message"
                                            >
                                                🗑️
                                            </button>
                                        `
                                        : ""
                                }

                            </div>
                        `
                        : ""
                }

            </div>

        </article>
    `;
}


function renderMessageContent(
    messageType,
    content
) {

    if (!content) {
        return "";
    }

    if (messageType === "gif") {

        const url =
            safeUrl(content);

        if (!url) {
            return "";
        }

        return `
            <div class="message-gif">
                <img
                    src="${escapeHtml(url)}"
                    alt="GIF"
                    loading="lazy"
                >
            </div>
        `;
    }

    return `
        <div class="message-text">
            ${escapeHtml(content)
                .replace(/\n/g, "<br>")}
        </div>
    `;
}


function renderAttachments(
    attachments
) {

    if (!attachments.length) {
        return "";
    }

    return `
        <div class="message-attachments">

            ${attachments
                .map(renderAttachment)
                .join("")}

        </div>
    `;
}


function renderAttachment(
    attachment
) {

    const url =
        safeUrl(attachment.file_url);

    if (!url) {
        return "";
    }

    const mime =
        String(
            attachment.mime_type || ""
        ).toLowerCase();

    const name =
        attachment.file_name ||
        "Attachment";

    if (mime.startsWith("image/")) {

        return `
            <div class="chat-image-attachment">

                <a
                    href="${escapeHtml(url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <img
                        src="${escapeHtml(url)}"
                        alt="${escapeHtml(name)}"
                        loading="lazy"
                    >
                </a>

                <div class="attachment-caption">
                    ${escapeHtml(name)}
                </div>

            </div>
        `;
    }


    if (mime.startsWith("audio/")) {

        return `
            <div class="chat-audio-attachment">

                <audio
                    controls
                    preload="metadata"
                    src="${escapeHtml(url)}"
                ></audio>

                <div class="attachment-caption">
                    ${escapeHtml(name)}
                </div>

            </div>
        `;
    }


    return `
        <div class="chat-file-attachment">

            <div class="chat-file-icon">
                📄
            </div>

            <div class="chat-file-info">

                <strong>
                    ${escapeHtml(name)}
                </strong>

                <span>
                    ${escapeHtml(
                        formatFileSize(
                            attachment.file_size
                        )
                    )}
                </span>

            </div>

            <a
                href="${escapeHtml(url)}"
                target="_blank"
                rel="noopener noreferrer"
                download
                class="chat-file-download"
            >
                Open
            </a>

        </div>
    `;
}


function renderReactions(
    messageId,
    reactions
) {

    if (!reactions.length) {
        return "";
    }

    const counts = new Map();

    reactions.forEach(reaction => {

        const key =
            reaction.reaction;

        counts.set(
            key,
            (counts.get(key) || 0) + 1
        );
    });

    return `
        <div class="message-reactions">

            ${[
                ...counts.entries()
            ]
                .map(
                    ([emoji, count]) => `
                        <button
                            type="button"
                            class="reaction-chip"
                            data-action="reaction-toggle"
                            data-message-id="${
                                escapeHtml(messageId)
                            }"
                            data-reaction="${
                                escapeHtml(emoji)
                            }"
                        >
                            ${escapeHtml(emoji)}
                            <span>${count}</span>
                        </button>
                    `
                )
                .join("")}

        </div>
    `;
}


/* =========================================================
   MESSAGE ACTIONS
   ========================================================= */

function bindMessageActions() {

    $$(".message-reaction-button")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const messageId =
                        button.dataset.messageId;

                    openReactionPicker(
                        messageId,
                        button
                    );
                }
            );
        });


    $$(".message-delete-button")
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    await deleteMessage(
                        button.dataset.messageId
                    );
                }
            );
        });


    $$(".reaction-chip")
        .forEach(button => {

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
   REACTION PICKER
   ========================================================= */

function openReactionPicker(
    messageId,
    button
) {

    closeReactionPicker();

    const picker =
        document.createElement("div");

    picker.className =
        "message-reaction-picker";

    picker.dataset.messageId =
        messageId;

    const reactions = [
        "👍",
        "❤️",
        "😂",
        "👏",
        "🔥",
        "🎉",
        "😮",
        "😢",
        "🙏",
        "💯"
    ];

    picker.innerHTML =
        reactions
            .map(
                emoji => `
                    <button
                        type="button"
                        data-reaction="${
                            escapeHtml(emoji)
                        }"
                    >
                        ${emoji}
                    </button>
                `
            )
            .join("");

    document.body.appendChild(
        picker
    );

    const rect =
        button.getBoundingClientRect();

    picker.style.position =
        "fixed";

    picker.style.left =
        `${Math.min(
            rect.left,
            window.innerWidth - 260
        )}px`;

    picker.style.top =
        `${Math.min(
            rect.bottom + 8,
            window.innerHeight - 70
        )}px`;

    picker
        .querySelectorAll("button")
        .forEach(reactionButton => {

            reactionButton.addEventListener(
                "click",
                async () => {

                    await toggleReaction(
                        messageId,
                        reactionButton.dataset.reaction
                    );

                    closeReactionPicker();
                }
            );
        });

    setTimeout(() => {

        document.addEventListener(
            "click",
            closeReactionPickerOutside,
            {
                once: true
            }
        );

    }, 0);

    state.reactionOpenFor =
        messageId;
}


function closeReactionPickerOutside(
    event
) {

    const picker =
        $(".message-reaction-picker");

    if (!picker) return;

    if (
        !picker.contains(event.target)
    ) {
        closeReactionPicker();
    }
}


function closeReactionPicker() {

    const picker =
        $(".message-reaction-picker");

    if (picker) {
        picker.remove();
    }

    state.reactionOpenFor = null;
}


async function toggleReaction(
    messageId,
    reaction
) {

    if (!state.user) {
        showToast(
            "Please sign in first.",
            "error"
        );
        return;
    }

    const existing =
        (
            state.reactions.get(messageId) ||
            []
        ).find(
            item =>
                item.user_id === state.user.id &&
                item.reaction === reaction
        );

    try {

        if (existing) {

            const {
                error
            } = await supabase
                .from("chat_message_reactions")
                .delete()
                .eq("id", existing.id);

            if (error) {
                throw error;
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
                throw error;
            }
        }

        await loadMessages();

    } catch (error) {

        console.error(
            "Reaction error:",
            error
        );

        showToast(
            "Could not update reaction.",
            "error"
        );
    }
}


/* =========================================================
   DELETE MESSAGE
   ========================================================= */

async function deleteMessage(
    messageId
) {

    if (!messageId) return;

    const message =
        state.messages.find(
            item => item.id === messageId
        );

    if (!message) return;

    if (
        message.user_id !==
        state.user?.id
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

    if (!confirmed) {
        return;
    }

    try {

        const {
            error
        } = await supabase
            .from("chat_messages")
            .update({
                is_deleted: true,
                deleted_at:
                    new Date().toISOString(),
                content:
                    "This message was deleted."
            })
            .eq("id", messageId)
            .eq(
                "user_id",
                state.user.id
            );

        if (error) {
            throw error;
        }

        showToast(
            "Message deleted.",
            "success"
        );

        await loadMessages();

    } catch (error) {

        console.error(
            "Delete message error:",
            error
        );

        showToast(
            "Could not delete message.",
            "error"
        );
    }
}


/* =========================================================
   SEND TEXT MESSAGE
   ========================================================= */

async function sendTextMessage() {

    const input =
        $("#messageInput");

    if (!input) return;

    const content =
        input.value.trim();

    if (!content) {
        return;
    }

    if (!state.selectedChannel) {

        showToast(
            "Select a channel first.",
            "error"
        );

        return;
    }

    input.value = "";

    try {

        await insertMessage({
            channel_id:
                state.selectedChannel.id,
            user_id:
                state.user.id,
            content,
            message_type: "text"
        });

        await loadMessages();

        scrollMessagesToBottom();

    } catch (error) {

        console.error(
            "Send message error:",
            error
        );

        input.value = content;

        showToast(
            "Message could not be sent.",
            "error"
        );
    }
}


/* =========================================================
   INSERT MESSAGE
   ========================================================= */

async function insertMessage(
    payload
) {

    const {
        data,
        error
    } = await supabase
        .from("chat_messages")
        .insert(payload)
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
        throw error;
    }

    return data;
}


/* =========================================================
   REAL SUPABASE STORAGE UPLOAD
   ========================================================= */

async function uploadToSupabase(
    file,
    folder
) {

    if (!file) {
        throw new Error(
            "No file selected."
        );
    }

    if (!state.user) {
        throw new Error(
            "You must be signed in."
        );
    }

    const safeName =
        createSafeFileName(
            file.name
        );

    const uniqueName =
        `${Date.now()}-${cryptoRandomPart()}-${safeName}`;

    const filePath =
        `${state.user.id}/${folder}/${uniqueName}`;

    console.log(
        "☁️ Uploading to Supabase:",
        filePath
    );

    const {
        error
    } = await supabase
        .storage
        .from(STORAGE_BUCKET)
        .upload(
            filePath,
            file,
            {
                cacheControl: "3600",
                contentType:
                    file.type ||
                    "application/octet-stream",
                upsert: false
            }
        );

    if (error) {
        throw error;
    }

    const {
        data
    } = supabase
        .storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(
            filePath
        );

    const publicUrl =
        data?.publicUrl;

    if (!publicUrl) {

        throw new Error(
            "Supabase did not return a public file URL."
        );
    }

    console.log(
        "✅ Supabase upload complete:",
        publicUrl
    );

    return {
        path: filePath,
        url: publicUrl
    };
}


function cryptoRandomPart() {

    if (
        window.crypto &&
        typeof window.crypto.randomUUID ===
            "function"
    ) {
        return window.crypto
            .randomUUID()
            .slice(0, 8);
    }

    return Math.random()
        .toString(36)
        .slice(2, 10);
}


/* =========================================================
   IMAGE / DOCUMENT UPLOAD
   ========================================================= */

async function handleFileSelection(
    event
) {

    const files = [
        ...(
            event.target.files || []
        )
    ];

    event.target.value = "";

    if (!files.length) {
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

    for (const file of files) {

        await sendUploadedFile(
            file
        );
    }
}


async function sendUploadedFile(
    file
) {

    if (!file) return;

    const valid =
        isImageFile(file) ||
        isDocumentFile(file);

    if (!valid) {

        showToast(
            `${file.name} is not a supported image or document.`,
            "error"
        );

        return;
    }

    if (file.size > 50 * 1024 * 1024) {

        showToast(
            `${file.name} is larger than 50 MB.`,
            "error"
        );

        return;
    }

    const status =
        $("#uploadStatus");

    if (status) {
        status.textContent =
            `Uploading ${file.name}...`;
    }

    try {

        const type =
            isImageFile(file)
                ? "image"
                : "file";

        const folder =
            isImageFile(file)
                ? "images"
                : "documents";

        /*
         * Upload the actual File object to
         * Supabase Storage.
         */

        const uploaded =
            await uploadToSupabase(
                file,
                folder
            );

        /*
         * Create the chat message only after
         * Storage upload succeeds.
         */

        const message =
            await insertMessage({
                channel_id:
                    state.selectedChannel.id,
                user_id:
                    state.user.id,
                content:
                    file.name,
                message_type:
                    type
            });

        try {

            await insertAttachment(
                message.id,
                file,
                uploaded
            );

        } catch (attachmentError) {

            /*
             * If attachment row insertion fails,
             * remove the uploaded object so we
             * don't leave an unnecessary file.
             */

            await removeStorageFile(
                uploaded.path
            );

            await supabase
                .from("chat_messages")
                .delete()
                .eq(
                    "id",
                    message.id
                );

            throw attachmentError;
        }

        showToast(
            `${file.name} uploaded successfully.`,
            "success"
        );

        if (status) {
            status.textContent =
                `${file.name} uploaded`;
        }

        await loadMessages();

        scrollMessagesToBottom();

    } catch (error) {

        console.error(
            "❌ File upload failed:",
            error
        );

        if (status) {
            status.textContent =
                "Upload failed";
        }

        showToast(
            `Could not upload ${file.name}. ${
                error.message || ""
            }`,
            "error"
        );
    }
}


async function insertAttachment(
    messageId,
    file,
    uploaded
) {

    const {
        error
    } = await supabase
        .from("chat_attachments")
        .insert({
            message_id: messageId,
            uploaded_by: state.user.id,
            file_name: file.name,
            file_path: uploaded.path,
            file_url: uploaded.url,
            mime_type:
                file.type ||
                "application/octet-stream",
            file_size: file.size
        });

    if (error) {
        throw error;
    }
}


async function removeStorageFile(
    filePath
) {

    if (!filePath) return;

    try {

        const {
            error
        } = await supabase
            .storage
            .from(STORAGE_BUCKET)
            .remove([
                filePath
            ]);

        if (error) {

            console.warn(
                "Storage cleanup failed:",
                error.message
            );
        }

    } catch (error) {

        console.warn(
            "Storage cleanup error:",
            error
        );
    }
}


/* =========================================================
   EMOJI PICKER
   ========================================================= */

function openEmojiPicker() {

    const wrapper =
        $("#emojiPicker");

    if (!wrapper) return;

    wrapper.classList.remove(
        "hidden"
    );

    wrapper.classList.add(
        "open"
    );

    const picker =
        wrapper.querySelector(
            "emoji-picker"
        );

    if (picker) {

        picker.focus();
    }
}


function closeEmojiPicker() {

    const wrapper =
        $("#emojiPicker");

    if (!wrapper) return;

    wrapper.classList.add(
        "hidden"
    );

    wrapper.classList.remove(
        "open"
    );
}


function insertAtCursor(
    textarea,
    text
) {

    if (!textarea) return;

    const start =
        textarea.selectionStart ??
        textarea.value.length;

    const end =
        textarea.selectionEnd ??
        textarea.value.length;

    textarea.value =
        textarea.value.slice(
            0,
            start
        ) +
        text +
        textarea.value.slice(
            end
        );

    const cursor =
        start + text.length;

    textarea.selectionStart =
        cursor;

    textarea.selectionEnd =
        cursor;

    textarea.focus();

    textarea.dispatchEvent(
        new Event("input", {
            bubbles: true
        })
    );
}


function initializeEmojiPicker() {

    const picker =
        document.querySelector(
            "#emojiPicker emoji-picker"
        );

    if (picker) {

        picker.addEventListener(
            "emoji-click",
            event => {

                const emoji =
                    event.detail?.unicode;

                if (!emoji) return;

                insertAtCursor(
                    $("#messageInput"),
                    emoji
                );

                closeEmojiPicker();
            }
        );
    }

    $("#emojiButton")
        ?.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                const wrapper =
                    $("#emojiPicker");

                if (
                    wrapper &&
                    !wrapper.classList.contains(
                        "hidden"
                    )
                ) {
                    closeEmojiPicker();

                } else {

                    openEmojiPicker();
                }
            }
        );


    $("#closeEmojiButton")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                closeEmojiPicker();
            }
        );


    document.addEventListener(
        "click",
        event => {

            const wrapper =
                $("#emojiPicker");

            const button =
                $("#emojiButton");

            if (!wrapper) return;

            if (
                wrapper.contains(
                    event.target
                ) ||
                button?.contains(
                    event.target
                )
            ) {
                return;
            }

            closeEmojiPicker();
        }
    );
}


/* =========================================================
   GIFS
   ========================================================= */

function initializeGifPicker() {

    $("#gifButton")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                const picker =
                    $("#gifPicker");

                if (!picker) return;

                picker.classList.toggle(
                    "hidden"
                );
            }
        );


    $("#previewGifButton")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                previewGif();
            }
        );


    $("#sendGifButton")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                sendGif();
            }
        );
}


function previewGif() {

    const input =
        $("#gifUrlInput");

    const preview =
        $("#gifPreview");

    if (!input || !preview) {
        return;
    }

    const url =
        safeUrl(
            input.value.trim()
        );

    if (!url) {

        preview.innerHTML = `
            <div class="gif-error">
                Enter a valid GIF URL.
            </div>
        `;

        return;
    }

    preview.innerHTML = `
        <img
            src="${escapeHtml(url)}"
            alt="GIF preview"
        >
    `;
}


async function sendGif() {

    const input =
        $("#gifUrlInput");

    if (!input) return;

    const url =
        safeUrl(
            input.value.trim()
        );

    if (!url) {

        showToast(
            "Enter a valid GIF URL first.",
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

        await insertMessage({
            channel_id:
                state.selectedChannel.id,
            user_id:
                state.user.id,
            content: url,
            message_type: "gif"
        });

        input.value = "";

        const preview =
            $("#gifPreview");

        if (preview) {
            preview.innerHTML = "";
        }

        $("#gifPicker")
            ?.classList.add("hidden");

        await loadMessages();

        scrollMessagesToBottom();

    } catch (error) {

        console.error(
            "GIF send failed:",
            error
        );

        showToast(
            "Could not send GIF.",
            "error"
        );
    }
}


/* =========================================================
   VOICE NOTES
   ========================================================= */

function getSupportedAudioMimeType() {

    const types = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
        "audio/mp4",
        "audio/mpeg"
    ];

    for (const type of types) {

        if (
            window.MediaRecorder &&
            MediaRecorder.isTypeSupported(type)
        ) {
            return type;
        }
    }

    return "";
}


async function startVoiceRecording() {

    if (state.isRecording) {
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

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        showToast(
            "Your browser does not support microphone recording.",
            "error"
        );

        return;
    }

    if (!window.MediaRecorder) {

        showToast(
            "Voice recording is not supported by this browser.",
            "error"
        );

        return;
    }

    try {

        console.log(
            "🎙️ Requesting microphone..."
        );

        const stream =
            await navigator.mediaDevices
                .getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });

        state.recordingStream =
            stream;

        state.recordingChunks = [];

        const mimeType =
            getSupportedAudioMimeType();

        const recorder =
            mimeType
                ? new MediaRecorder(
                    stream,
                    {
                        mimeType
                    }
                )
                : new MediaRecorder(
                    stream
                );

        state.mediaRecorder =
            recorder;

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
            handleVoiceRecordingStop
        );

        recorder.addEventListener(
            "error",
            event => {

                console.error(
                    "MediaRecorder error:",
                    event.error
                );

                cleanupVoiceRecording();

                showToast(
                    "Voice recording failed.",
                    "error"
                );
            }
        );

        state.recordingStartedAt =
            Date.now();

        state.isRecording = true;

        recorder.start(
            250
        );

        showVoiceRecorder();

        startVoiceTimer();

        console.log(
            "🎙️ Voice recording started."
        );

    } catch (error) {

        console.error(
            "Microphone error:",
            error
        );

        cleanupVoiceRecording();

        if (
            error.name ===
            "NotAllowedError"
        ) {

            showToast(
                "Microphone permission was denied. Allow microphone access in your browser.",
                "error"
            );

        } else {

            showToast(
                "Could not access your microphone.",
                "error"
            );
        }
    }
}


function showVoiceRecorder() {

    const bar =
        $("#voiceRecorderBar");

    if (bar) {

        bar.classList.remove(
            "hidden"
        );
    }

    const indicator =
        $("#voiceRecorderIndicator");

    if (indicator) {

        indicator.textContent =
            "Recording...";
    }

    const status =
        $("#voiceUploadStatus");

    if (status) {

        status.textContent =
            "Recording voice note...";
    }
}


function hideVoiceRecorder() {

    const bar =
        $("#voiceRecorderBar");

    if (bar) {

        bar.classList.add(
            "hidden"
        );
    }
}


function startVoiceTimer() {

    stopVoiceTimer();

    updateVoiceTimer();

    state.recordingTimer =
        setInterval(
            updateVoiceTimer,
            250
        );
}


function updateVoiceTimer() {

    const timer =
        $("#voiceRecorderTimer");

    if (!timer) {
        return;
    }

    if (!state.recordingStartedAt) {

        timer.textContent =
            "00:00";

        return;
    }

    const seconds =
        Math.floor(
            (
                Date.now() -
                state.recordingStartedAt
            ) / 1000
        );

    const minutes =
        Math.floor(
            seconds / 60
        );

    const remaining =
        seconds % 60;

    timer.textContent =
        `${String(minutes).padStart(2, "0")}:${String(
            remaining
        ).padStart(2, "0")}`;
}


function stopVoiceTimer() {

    if (
        state.recordingTimer
    ) {

        clearInterval(
            state.recordingTimer
        );

        state.recordingTimer =
            null;
    }
}


function stopVoiceRecording() {

    if (
        !state.mediaRecorder ||
        !state.isRecording
    ) {
        return;
    }

    const recorder =
        state.mediaRecorder;

    state.isRecording =
        false;

    stopVoiceTimer();

    const indicator =
        $("#voiceRecorderIndicator");

    if (indicator) {

        indicator.textContent =
            "Preparing voice note...";
    }

    const status =
        $("#voiceUploadStatus");

    if (status) {

        status.textContent =
            "Preparing upload...";
    }

    try {

        if (
            recorder.state !==
            "inactive"
        ) {
            recorder.stop();
        }

    } catch (error) {

        console.error(
            "Could not stop recorder:",
            error
        );

        cleanupVoiceRecording();

        hideVoiceRecorder();
    }
}


async function handleVoiceRecordingStop() {

    const recorder =
        state.mediaRecorder;

    const chunks =
        state.recordingChunks.slice();

    const mimeType =
        recorder?.mimeType ||
        "audio/webm";

    const stream =
        state.recordingStream;

    if (stream) {

        stream
            .getTracks()
            .forEach(track => {
                track.stop();
            });
    }

    state.recordingStream =
        null;

    state.mediaRecorder =
        null;

    state.recordingChunks =
        [];

    state.recordingStartedAt =
        null;

    if (!chunks.length) {

        hideVoiceRecorder();

        showToast(
            "No voice recording was captured.",
            "error"
        );

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


async function uploadVoiceNote(
    blob,
    mimeType
) {

    const status =
        $("#voiceUploadStatus");

    if (status) {

        status.textContent =
            "Uploading voice note to Supabase...";
    }

    try {

        const extension =
            getAudioExtension(
                mimeType
            );

        const file =
            new File(
                [
                    blob
                ],
                `voice-note-${Date.now()}.${extension}`,
                {
                    type: mimeType
                }
            );

        const uploaded =
            await uploadToSupabase(
                file,
                "voice-notes"
            );

        if (status) {

            status.textContent =
                "Saving voice note...";
        }

        const message =
            await insertMessage({
                channel_id:
                    state.selectedChannel.id,
                user_id:
                    state.user.id,
                content:
                    "Voice note",
                message_type:
                    "voice"
            });

        try {

            await insertAttachment(
                message.id,
                file,
                uploaded
            );

        } catch (attachmentError) {

            await removeStorageFile(
                uploaded.path
            );

            await supabase
                .from("chat_messages")
                .delete()
                .eq(
                    "id",
                    message.id
                );

            throw attachmentError;
        }

        if (status) {

            status.textContent =
                "Voice note sent.";
        }

        showToast(
            "Voice note sent.",
            "success"
        );

        await loadMessages();

        scrollMessagesToBottom();

    } catch (error) {

        console.error(
            "Voice note upload failed:",
            error
        );

        if (status) {

            status.textContent =
                "Voice note upload failed.";
        }

        showToast(
            `Voice note could not be uploaded. ${
                error.message || ""
            }`,
            "error"
        );

    } finally {

        setTimeout(
            () => {

                hideVoiceRecorder();

            },
            1200
        );
    }
}


function getAudioExtension(
    mimeType
) {

    const type =
        String(
            mimeType || ""
        ).toLowerCase();

    if (
        type.includes("ogg")
    ) {
        return "ogg";
    }

    if (
        type.includes("mp4")
    ) {
        return "m4a";
    }

    if (
        type.includes("mpeg")
    ) {
        return "mp3";
    }

    if (
        type.includes("wav")
    ) {
        return "wav";
    }

    return "webm";
}


function cancelVoiceRecording() {

    const recorder =
        state.mediaRecorder;

    if (recorder) {

        try {

            recorder.ondataavailable =
                null;

            recorder.onstop =
                null;

            if (
                recorder.state !==
                "inactive"
            ) {
                recorder.stop();
            }

        } catch (error) {}
    }

    cleanupVoiceRecording();

    hideVoiceRecorder();

    const status =
        $("#voiceUploadStatus");

    if (status) {

        status.textContent = "";
    }

    showToast(
        "Voice recording cancelled.",
        "info"
    );
}


function cleanupVoiceRecording() {

    stopVoiceTimer();

    if (
        state.recordingStream
    ) {

        state.recordingStream
            .getTracks()
            .forEach(track => {

                try {
                    track.stop();
                } catch (error) {}

            });
    }

    state.recordingStream =
        null;

    state.mediaRecorder =
        null;

    state.recordingChunks =
        [];

    state.recordingStartedAt =
        null;

    state.isRecording =
        false;
}


function initializeVoiceRecorder() {

    const voiceButton =
        $("#voiceNoteButton");

    if (voiceButton) {

        voiceButton.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                event.stopPropagation();

                if (state.isRecording) {

                    stopVoiceRecording();

                } else {

                    await startVoiceRecording();
                }
            }
        );
    }


    $("#stopVoiceNoteButton")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                stopVoiceRecording();
            }
        );


    $("#cancelVoiceNoteButton")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                cancelVoiceRecording();
            }
        );
}


/* =========================================================
   ATTACHMENT INPUT
   ========================================================= */

function initializeAttachmentUpload() {

    const input =
        $("#attachmentInput");

    const button =
        $("#attachButton");

    if (button && input) {

        button.addEventListener(
            "click",
            event => {

                event.preventDefault();

                input.click();
            }
        );
    }

    if (input) {

        input.addEventListener(
            "change",
            handleFileSelection
        );
    }
}


/* =========================================================
   COMPOSER
   ========================================================= */

function initializeComposer() {

    const sendButton =
        $("#sendMessageButton");

    const input =
        $("#messageInput");

    if (sendButton) {

        sendButton.addEventListener(
            "click",
            async event => {

                event.preventDefault();

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
   GENERAL CALL
   ========================================================= */

function initializeGeneralCall() {

    const openButton =
        $("#generalCallButton");

    const modal =
        $("#generalCallModal");

    const closeButton =
        $("#closeGeneralCallButton");

    const startButton =
        $("#startGeneralCallButton");

    const targetInput =
        $("#generalCallTargetUserId");

    const voiceButton =
        $("#generalVoiceCallButton");

    const videoButton =
        $("#generalVideoCallButton");


    openButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            modal?.classList.remove(
                "hidden"
            );
        }
    );


    closeButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            modal?.classList.add(
                "hidden"
            );
        }
    );


    voiceButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            state.generalCallMode =
                "voice";

            voiceButton.classList.add(
                "active"
            );

            videoButton?.classList.remove(
                "active"
            );
        }
    );


    videoButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            state.generalCallMode =
                "video";

            videoButton.classList.add(
                "active"
            );

            voiceButton?.classList.remove(
                "active"
            );
        }
    );


    startButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            const targetUserId =
                targetInput?.value.trim();

            if (!targetUserId) {

                showToast(
                    "Enter the user ID to call.",
                    "error"
                );

                return;
            }

            /*
             * The actual WebRTC call engine remains
             * in call.js. This file only dispatches
             * the call request.
             */

            window.dispatchEvent(
                new CustomEvent(
                    "mwaniki:general-call",
                    {
                        detail: {
                            targetUserId,
                            mode:
                                state.generalCallMode
                        }
                    }
                )
            );

            modal?.classList.add(
                "hidden"
            );

            showToast(
                "Call request sent to the call engine.",
                "success"
            );
        }
    );
}


/* =========================================================
   REALTIME
   ========================================================= */

function subscribeToChannel() {

    if (!state.selectedChannel) {
        return;
    }

    const channelId =
        state.selectedChannel.id;

    const realtimeName =
        `mwaniki-chat-${channelId}`;

    state.channelSubscription =
        supabase
            .channel(realtimeName)
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
                        "📡 Message realtime:",
                        payload.eventType
                    );

                    await loadMessages();

                    scrollMessagesToBottom();
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_message_reactions"
                },
                async payload => {

                    console.log(
                        "📡 Reaction realtime:",
                        payload.eventType
                    );

                    await loadMessages();
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_attachments"
                },
                async payload => {

                    console.log(
                        "📡 Attachment realtime:",
                        payload.eventType
                    );

                    await loadMessages();
                }
            )
            .subscribe(
                status => {

                    console.log(
                        `📡 Channel realtime status: ${status}`
                    );
                }
            );
}


/* =========================================================
   SCROLLING
   ========================================================= */

function scrollMessagesToBottom() {

    const container =
        $("#messages");

    if (!container) return;

    requestAnimationFrame(() => {

        container.scrollTop =
            container.scrollHeight;
    });
}


/* =========================================================
   CHANNEL SEARCH
   ========================================================= */

function initializeChannelSearch() {

    const input =
        $("#channelSearch");

    if (!input) {
        return;
    }

    input.addEventListener(
        "input",
        () => {

            const query =
                input.value
                    .trim()
                    .toLowerCase();

            const container =
                $("#channelList") ||
                $("#channelsList");

            if (!container) {
                return;
            }

            container
                .querySelectorAll(
                    "[data-channel-id]"
                )
                .forEach(button => {

                    const name =
                        button
                            .querySelector(
                                ".channel-item-name"
                            )
                            ?.textContent
                            ?.toLowerCase() || "";

                    button.style.display =
                        !query ||
                        name.includes(query)
                            ? ""
                            : "none";
                });
        }
    );
}


/* =========================================================
   COMMUNITY SEARCH
   ========================================================= */

function initializeCommunitySearch() {

    const input =
        $("#communitySearch");

    if (!input) {
        return;
    }

    input.addEventListener(
        "input",
        () => {

            const query =
                input.value
                    .trim()
                    .toLowerCase();

            const container =
                $("#communityList") ||
                $("#communitiesList") ||
                $("#communityRailList");

            if (!container) {
                return;
            }

            container
                .querySelectorAll(
                    "[data-community-id]"
                )
                .forEach(button => {

                    const name =
                        button
                            .querySelector(
                                ".community-item-name"
                            )
                            ?.textContent
                            ?.toLowerCase() || "";

                    button.style.display =
                        !query ||
                        name.includes(query)
                            ? ""
                            : "none";
                });
        }
    );
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function initializeNavigation() {

    $("[data-action='dashboard']")
        ?.addEventListener(
            "click",
            () => {

                window.location.href =
                    "./dashboard.html";
            }
        );


    $("[data-action='home']")
        ?.addEventListener(
            "click",
            () => {

                window.location.href =
                    "./dashboard.html";
            }
        );


    $("[data-action='community']")
        ?.addEventListener(
            "click",
            () => {

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            }
        );


    $("#profileButton")
        ?.addEventListener(
            "click",
            () => {

                const panel =
                    $("#profilePanel");

                panel?.classList.toggle(
                    "hidden"
                );
            }
        );


    $("#notificationButton")
        ?.addEventListener(
            "click",
            () => {

                const panel =
                    $("#notificationPanel");

                panel?.classList.toggle(
                    "hidden"
                );
            }
        );
}


/* =========================================================
   AUTH
   ========================================================= */

async function initializeAuth() {

    const {
        data,
        error
    } = await supabase.auth.getUser();

    if (error) {

        console.warn(
            "Auth lookup:",
            error.message
        );
    }

    state.user =
        data?.user || null;

    if (!state.user) {

        console.warn(
            "⚠️ No authenticated user."
        );

        showToast(
            "Please sign in to use the community.",
            "error"
        );

        return false;
    }

    console.log(
        "🔐 Community user:",
        state.user.id
    );

    await loadOwnProfile();

    return true;
}


function initializeAuthListener() {

    supabase.auth.onAuthStateChange(
        async (event, session) => {

            console.log(
                "🔐 Auth state:",
                event
            );

            if (
                event === "SIGNED_OUT"
            ) {

                state.user = null;
                state.profile = null;

                return;
            }

            if (
                event === "SIGNED_IN" ||
                event === "TOKEN_REFRESHED"
            ) {

                state.user =
                    session?.user || null;

                if (state.user) {

                    await loadOwnProfile();
                }
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

        cleanupVoiceRecording();

        if (
            state.channelSubscription
        ) {

            supabase.removeChannel(
                state.channelSubscription
            );
        }

        if (
            state.attachmentSubscription
        ) {

            supabase.removeChannel(
                state.attachmentSubscription
            );
        }
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

    initializeVoiceRecorder();

    initializeEmojiPicker();

    initializeGifPicker();

    initializeGeneralCall();

    initializeChannelSearch();

    initializeCommunitySearch();

    initializeNavigation();

    const authenticated =
        await initializeAuth();

    if (!authenticated) {
        return;
    }

    initializeAuthListener();

    await loadCommunities();

    console.log(
        "✅ Mwaniki Scholars Community initialized successfully."
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
