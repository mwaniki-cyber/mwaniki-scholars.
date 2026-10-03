/* =========================================================
   MWANIKI SCHOLARS COMMUNITY ENGINE
   Complete replacement: community.js

   Includes:
   - Mwaniki Scholars as default discussion community
   - Automatic loading of ALL active discussion channels
   - Real Unicode emoji picker
   - Full emoji search/categories/skin tones
   - Country flag support on Chromium/Windows
   - Emoji insertion
   - GIF preview/send
   - File/image attachments
   - Voice-note recording
   - Audio playback
   - Message deletion
   - Reactions
   - Community switching
   - Channel search
   - Message realtime updates
   - General-call event bridge
   ========================================================= */

import "https://cdn.jsdelivr.net/npm/emoji-picker-element@1/index.js";
import { polyfillCountryFlagEmojis } from
    "https://cdn.skypack.dev/country-flag-emoji-polyfill";

polyfillCountryFlagEmojis();

const supabase =
    window.supabaseClient ||
    window.supabase ||
    window.sb ||
    window.mwanikiSupabase;

if (!supabase) {
    console.error("❌ Supabase client not available.");
    throw new Error("Supabase client not available.");
}

/* =========================================================
   CONSTANTS
   ========================================================= */

const DEFAULT_DISCUSSION_ID =
    "9044c031-71da-496d-9166-ff19ed4fcb62";

const DEFAULT_DISCUSSION_NAME =
    "Mwaniki Scholars";

const RULES_VERSION =
    "mwaniki-community-rules-v3";

const MESSAGE_PAGE_SIZE = 50;

const ATTACHMENT_BUCKET =
    "chat-attachments";

const MAX_ATTACHMENT_SIZE =
    25 * 1024 * 1024;

const MAX_VOICE_NOTE_SIZE =
    15 * 1024 * 1024;


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

    messageChannel: null,
    reactionChannel: null,
    presenceChannel: null,

    emojiPicker: null,

    recording: false,
    mediaRecorder: null,
    mediaStream: null,
    recordedChunks: [],

    generalCallMode: "voice",

    loadingMessages: false,
    sendingMessage: false
};


/* =========================================================
   DOM HELPER
   ========================================================= */

const $ = id => document.getElementById(id);


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function escapeHtml(value = "") {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function escapeAttribute(value = "") {
    return escapeHtml(value);
}


function getInitials(name = "Student") {
    const parts = String(name)
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!parts.length) return "S";

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
}


function formatFileSize(bytes = 0) {
    if (!bytes) return "0 B";

    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let index = 0;

    while (size >= 1024 && index < units.length - 1) {
        size /= 1024;
        index++;
    }

    return `${size.toFixed(index ? 1 : 0)} ${units[index]}`;
}


function formatMessageTime(date) {
    if (!date) return "";

    const d = new Date(date);

    return d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}


function formatDateLabel(date) {
    const d = new Date(date);
    const today = new Date();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
        return "Today";
    }

    if (d.toDateString() === yesterday.toDateString()) {
        return "Yesterday";
    }

    return d.toLocaleDateString([], {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}


function safeHttpUrl(url) {
    try {
        const parsed = new URL(url);

        if (
            parsed.protocol !== "https:" &&
            parsed.protocol !== "http:"
        ) {
            return "";
        }

        return parsed.href;
    } catch {
        return "";
    }
}


function isImageFile(file) {
    return file?.type?.startsWith("image/");
}


function isAudioFile(file) {
    return file?.type?.startsWith("audio/");
}


function communityIcon(community) {
    const slug =
        String(community?.slug || "").toLowerCase();

    if (slug.includes("gaming")) return "🎮";
    if (slug.includes("meme")) return "😂";
    if (slug.includes("scholar")) return "🎓";

    return community?.icon_url || "🌐";
}


function channelIcon(channel) {
    if (channel?.icon) {
        return channel.icon;
    }

    return "#";
}


/* =========================================================
   STATUS / TOAST
   ========================================================= */

function announce(message) {
    const target = $("accessibilityAnnouncer");

    if (target) {
        target.textContent = message;
    }
}


function toast(message, type = "info") {
    const target = $("communityToast");

    if (!target) return;

    target.textContent = message;
    target.dataset.type = type;
    target.classList.add("show");

    clearTimeout(target._timer);

    target._timer = setTimeout(() => {
        target.classList.remove("show");
    }, 3500);

    announce(message);
}


/* =========================================================
   RULES
   ========================================================= */

function rulesStorageKey() {
    const userId = state.user?.id || "guest";

    return `${RULES_VERSION}_${userId}`;
}


function hasAcceptedRules() {
    return localStorage.getItem(
        rulesStorageKey()
    ) === "accepted";
}


function updateRulesGate() {
    const gate = $("communityRulesGate");
    const checkbox = $("communityRulesAgreement");
    const button = $("acceptCommunityRulesButton");

    const accepted = hasAcceptedRules();

    if (gate) {
        gate.classList.toggle("hidden", accepted);
    }

    if (checkbox) {
        checkbox.checked = accepted;
    }

    if (button) {
        button.disabled = !checkbox?.checked;
    }
}


function acceptRules() {
    if (!$("communityRulesAgreement")?.checked) {
        return;
    }

    localStorage.setItem(
        rulesStorageKey(),
        "accepted"
    );

    updateRulesGate();

    toast(
        "Welcome to Mwaniki Scholars Community.",
        "success"
    );
}


/* =========================================================
   PROFILE
   ========================================================= */

async function loadOwnProfile() {
    if (!state.user?.id) return;

    const { data, error } = await supabase
        .from("students")
        .select(
            "id,full_name,course,level,photo_url"
        )
        .eq("id", state.user.id)
        .maybeSingle();

    if (error) {
        console.warn(
            "⚠️ Could not load student profile:",
            error.message
        );

        return;
    }

    state.profile = data || {
        id: state.user.id,
        full_name: "Student"
    };

    updateProfileUI();
}


function updateProfileUI() {
    const name =
        state.profile?.full_name ||
        state.user?.email ||
        "Student";

    const avatar =
        state.profile?.photo_url || "";

    const nameTargets = [
        $("sidebarProfileName")
    ];

    nameTargets.forEach(element => {
        if (element) {
            element.textContent = name;
        }
    });

    const avatarTargets = [
        $("railProfileAvatar"),
        $("sidebarProfileAvatar")
    ];

    avatarTargets.forEach(img => {
        if (!img) return;

        if (avatar) {
            img.src = avatar;
            img.alt = name;
        } else {
            img.removeAttribute("src");
            img.alt = name;
        }
    });
}


/* =========================================================
   PUBLIC PROFILES
   ========================================================= */

async function loadPublicProfiles(userIds = []) {
    const ids = [
        ...new Set(
            userIds.filter(Boolean)
        )
    ];

    if (!ids.length) return;

    const missing = ids.filter(
        id => !state.profiles.has(id)
    );

    if (!missing.length) return;

    const { data, error } = await supabase
        .from("chat_public_profiles")
        .select("id,full_name,photo_url")
        .in("id", missing);

    if (error) {
        console.warn(
            "⚠️ Public profile lookup failed:",
            error.message
        );

        missing.forEach(id => {
            state.profiles.set(id, {
                id,
                full_name: "Student",
                photo_url: ""
            });
        });

        return;
    }

    (data || []).forEach(profile => {
        state.profiles.set(
            profile.id,
            profile
        );
    });

    missing.forEach(id => {
        if (!state.profiles.has(id)) {
            state.profiles.set(id, {
                id,
                full_name: "Student",
                photo_url: ""
            });
        }
    });
}


/* =========================================================
   COMMUNITY LOADING
   ========================================================= */

async function loadCommunities() {
    const { data, error } = await supabase
        .from("chat_communities")
        .select("*")
        .eq("is_active", true)
        .order("name", {
            ascending: true
        });

    if (error) {
        console.error(
            "❌ Community loading failed:",
            error
        );

        toast(
            "Could not load communities.",
            "error"
        );

        return;
    }

    state.communities = data || [];

    renderCommunityRail();
    renderCommunityChoices();

    /*
     * IMPORTANT:
     * Mwaniki Scholars is deliberately selected first.
     * Gaming must not become the automatic first community.
     */

    let preferred =
        state.communities.find(
            community =>
                community.id ===
                DEFAULT_DISCUSSION_ID
        );

    if (!preferred) {
        preferred =
            state.communities.find(
                community =>
                    String(community.name)
                        .trim()
                        .toLowerCase() ===
                    DEFAULT_DISCUSSION_NAME
                        .toLowerCase()
            );
    }

    if (!preferred) {
        preferred = state.communities[0];
    }

    if (preferred) {
        await selectCommunity(
            preferred,
            false
        );
    }

    console.log(
        "📚 Communities loaded:",
        state.communities.length
    );
}


function renderCommunityRail() {
    const rail = $("communityRailList");

    if (!rail) return;

    rail.innerHTML = "";

    state.communities.forEach(community => {
        const button =
            document.createElement("button");

        button.type = "button";
        button.className = "community-rail-community";

        if (
            state.selectedCommunity?.id ===
            community.id
        ) {
            button.classList.add("active");
        }

        button.title =
            community.name || "Community";

        const icon = communityIcon(community);

        if (
            typeof icon === "string" &&
            icon.startsWith("http")
        ) {
            button.innerHTML =
                `<img src="${escapeAttribute(icon)}"
                       alt="">`;
        } else {
            button.textContent = icon;
        }

        button.addEventListener(
            "click",
            () => selectCommunity(community)
        );

        rail.appendChild(button);
    });
}


function renderCommunityChoices() {
    const list =
        $("communityChoiceList");

    if (!list) return;

    list.innerHTML = "";

    state.communities.forEach(community => {
        const button =
            document.createElement("button");

        button.type = "button";
        button.className =
            "community-choice-item";

        const icon =
            communityIcon(community);

        const iconHtml =
            String(icon).startsWith("http")
                ? `<img src="${escapeAttribute(icon)}" alt="">`
                : `<span class="community-choice-icon">${escapeHtml(icon)}</span>`;

        button.innerHTML = `
            ${iconHtml}
            <span class="community-choice-copy">
                <strong>${escapeHtml(community.name || "Community")}</strong>
                <small>${escapeHtml(community.description || "")}</small>
            </span>
        `;

        button.addEventListener(
            "click",
            async () => {
                closeCommunityModal();
                await selectCommunity(community);
            }
        );

        list.appendChild(button);
    });
}


async function selectCommunity(
    community,
    announceChange = true
) {
    if (!community) return;

    state.selectedCommunity = community;

    renderCommunityRail();
    updateSelectedCommunityUI();

    state.channels = [];
    state.selectedChannel = null;
    state.messages = [];

    renderChannels([]);

    if (announceChange) {
        toast(
            `Entered ${community.name}.`,
            "success"
        );
    }

    console.log(
        "🌐 Current community:",
        community.name,
        community.id
    );

    await loadChannels(
        community.id
    );
}


function updateSelectedCommunityUI() {
    const community =
        state.selectedCommunity;

    if (!community) return;

    const name =
        $("selectedCommunityName");

    const description =
        $("selectedCommunityDescription");

    const icon =
        $("selectedCommunityIcon");

    const brandSubtitle =
        $("communityBrandSubtitle");

    if (name) {
        name.textContent =
            community.name || "Community";
    }

    if (description) {
        description.textContent =
            community.description ||
            "Academic Community";
    }

    if (brandSubtitle) {
        brandSubtitle.textContent =
            community.name ||
            "Academic Community";
    }

    if (icon) {
        const value =
            communityIcon(community);

        if (
            typeof value === "string" &&
            value.startsWith("http")
        ) {
            icon.innerHTML =
                `<img src="${escapeAttribute(value)}"
                       alt="">`;
        } else {
            icon.textContent = value;
        }
    }
}


/* =========================================================
   CHANNEL LOADING
   ========================================================= */

async function loadChannels(
    communityId
) {
    if (!communityId) return;

    const { data, error } = await supabase
        .from("chat_channels")
        .select("*")
        .eq("community_id", communityId)
        .eq("is_active", true)
        .eq("is_archived", false)
        .order("position", {
            ascending: true,
            nullsFirst: false
        })
        .order("name", {
            ascending: true
        });

    if (error) {
        console.error(
            "❌ Channel loading failed:",
            error
        );

        toast(
            "Could not load discussion channels.",
            "error"
        );

        return;
    }

    state.channels = data || [];

    /*
     * ALL channels are rendered.
     * We do not stop at the first channel.
     */

    renderChannels(
        state.channels
    );

    console.log(
        `📚 ${state.channels.length} channel(s) loaded automatically.`
    );

    if (!state.channels.length) {
        toast(
            `No active channels found in ${state.selectedCommunity?.name || "this community"}.`,
            "info"
        );

        return;
    }

    const existing =
        state.channels.find(
            channel =>
                channel.id ===
                state.selectedChannel?.id
        );

    const channel =
        existing ||
        state.channels[0];

    await selectChannel(
        channel,
        false
    );
}


function renderChannels(
    channels
) {
    const list =
        $("channelList");

    if (!list) return;

    list.innerHTML = "";

    if (!channels.length) {
        list.innerHTML = `
            <div class="channel-empty">
                No channels available
            </div>
        `;

        return;
    }

    channels.forEach(channel => {
        const button =
            document.createElement("button");

        button.type = "button";
        button.className = "channel-item";

        if (
            state.selectedChannel?.id ===
            channel.id
        ) {
            button.classList.add("active");
        }

        button.dataset.channelId =
            channel.id;

        button.innerHTML = `
            <span class="channel-item-icon">
                ${escapeHtml(channelIcon(channel))}
            </span>
            <span class="channel-item-copy">
                <strong>${escapeHtml(channel.name || "Channel")}</strong>
                ${
                    channel.description
                        ? `<small>${escapeHtml(channel.description)}</small>`
                        : ""
                }
            </span>
        `;

        button.addEventListener(
            "click",
            () => selectChannel(channel)
        );

        list.appendChild(button);
    });
}


async function selectChannel(
    channel,
    announceChange = true
) {
    if (!channel) return;

    state.selectedChannel =
        channel;

    renderChannels(
        filterChannels(
            $("channelSearchInput")?.value || ""
        )
    );

    updateChannelHeader();

    if (announceChange) {
        toast(
            `#${channel.name}`,
            "success"
        );
    }

    await subscribeToChannel();
    await loadMessages(true);
}


function filterChannels(search = "") {
    const value =
        String(search)
            .trim()
            .toLowerCase();

    if (!value) {
        return state.channels;
    }

    return state.channels.filter(
        channel =>
            String(channel.name || "")
                .toLowerCase()
                .includes(value) ||
            String(channel.description || "")
                .toLowerCase()
                .includes(value)
    );
}


function updateChannelHeader() {
    const channel =
        state.selectedChannel;

    if (!channel) return;

    const icon =
        $("mainChannelIcon");

    const title =
        $("mainChannelTitle");

    const description =
        $("mainChannelDescription");

    if (icon) {
        icon.textContent =
            channelIcon(channel);
    }

    if (title) {
        title.textContent =
            channel.name || "Channel";
    }

    if (description) {
        description.textContent =
            channel.description ||
            `Discussion in ${state.selectedCommunity?.name || "Mwaniki Scholars"}`;
    }
}


/* =========================================================
   MESSAGE LOADING
   ========================================================= */

async function loadMessages(
    reset = true
) {
    if (
        !state.selectedChannel?.id ||
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
                .order("created_at", {
                    ascending: false
                })
                .limit(MESSAGE_PAGE_SIZE);

        if (
            !reset &&
            state.messages.length
        ) {
            const oldest =
                state.messages[0];

            query = query.lt(
                "created_at",
                oldest.created_at
            );
        }

        const { data, error } =
            await query;

        if (error) {
            console.error(
                "❌ Message loading failed:",
                error
            );

            toast(
                "Could not load messages.",
                "error"
            );

            return;
        }

        const rows =
            (data || []).reverse();

        if (reset) {
            state.messages = rows;
        } else {
            state.messages = [
                ...rows,
                ...state.messages
            ];
        }

        state.hasMoreMessages =
            (data || []).length ===
            MESSAGE_PAGE_SIZE;

        const userIds =
            state.messages.map(
                message => message.user_id
            );

        await loadPublicProfiles(
            userIds
        );

        await loadAttachmentsForMessages(
            state.messages
        );

        await loadReactionsForMessages(
            state.messages
        );

        renderMessages(
            reset
        );

    } finally {
        state.loadingMessages = false;
    }
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

    const { data, error } =
        await supabase
            .from("chat_attachments")
            .select(`
                id,
                message_id,
                file_name,
                file_path,
                file_url,
                mime_type,
                file_size,
                created_at
            `)
            .in("message_id", ids);

    if (error) {
        console.warn(
            "⚠️ Attachment loading failed:",
            error.message
        );

        return;
    }

    this;

    state.attachments.clear();

    (data || []).forEach(file => {
        if (!state.attachments.has(file.message_id)) {
            state.attachments.set(
                file.message_id,
                []
            );
        }

        state.attachments
            .get(file.message_id)
            .push(file);
    });
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

    const { data, error } =
        await supabase
            .from("chat_message_reactions")
            .select(
                "id,message_id,user_id,reaction"
            )
            .in("message_id", ids);

    if (error) {
        console.warn(
            "⚠️ Reaction loading failed:",
            error.message
        );

        return;
    }

    state.reactions.clear();

    (data || []).forEach(reaction => {
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
            .get(reaction.message_id)
            .push(reaction);
    });
}


/* =========================================================
   MESSAGE RENDERING
   ========================================================= */

function renderMessages(
    preserveScroll = false
) {
    const list =
        $("messageList");

    const empty =
        $("messageEmptyState");

    if (!list) return;

    const area =
        $("messageArea");

    const previousHeight =
        area?.scrollHeight || 0;

    const previousTop =
        area?.scrollTop || 0;

    list.innerHTML = "";

    if (!state.messages.length) {
        if (empty) {
            empty.classList.remove("hidden");
        }

        updateOlderButton();
        return;
    }

    if (empty) {
        empty.classList.add("hidden");
    }

    let previousDate = "";

    state.messages.forEach(message => {
        const dateLabel =
            formatDateLabel(
                message.created_at
            );

        if (dateLabel !== previousDate) {
            const divider =
                document.createElement("div");

            divider.className =
                "message-date-divider";

            divider.innerHTML =
                `<span>${escapeHtml(dateLabel)}</span>`;

            list.appendChild(divider);

            previousDate = dateLabel;
        }

        list.appendChild(
            renderMessage(message)
        );
    });

    updateOlderButton();

    if (!area) return;

    if (preserveScroll) {
        area.scrollTop =
            area.scrollHeight -
            previousHeight +
            previousTop;
    } else {
        requestAnimationFrame(() => {
            area.scrollTop =
                area.scrollHeight;
        });
    }
}


function renderMessage(
    message
) {
    const wrapper =
        document.createElement("article");

    wrapper.className =
        "message-item";

    wrapper.dataset.messageId =
        message.id;

    const profile =
        state.profiles.get(
            message.user_id
        ) || {
            full_name:
                message.user_id === state.user?.id
                    ? state.profile?.full_name || "You"
                    : "Student",
            photo_url: ""
        };

    const name =
        message.user_id === state.user?.id
            ? state.profile?.full_name || "You"
            : profile.full_name || "Student";

    const photo =
        message.user_id === state.user?.id
            ? state.profile?.photo_url
            : profile.photo_url;

    const avatar =
        photo
            ? `<img src="${escapeAttribute(photo)}" alt="${escapeAttribute(name)}">`
            : `<span class="message-avatar-initials">${escapeHtml(getInitials(name))}</span>`;

    const own =
        message.user_id === state.user?.id;

    let body = "";

    if (message.is_deleted) {
        body = `
            <div class="message-deleted">
                This message was deleted.
            </div>
        `;
    } else if (
        message.message_type === "gif"
    ) {
        const url =
            safeHttpUrl(message.content);

        body = url
            ? `
                <div class="message-gif">
                    <img
                        src="${escapeAttribute(url)}"
                        alt="GIF"
                        loading="lazy"
                    >
                </div>
              `
            : "";
    } else if (
        message.message_type === "voice"
    ) {
        const url =
            safeHttpUrl(message.content);

        body = url
            ? `
                <div class="voice-message">
                    <span class="voice-icon">🎙️</span>
                    <audio
                        controls
                        preload="metadata"
                        src="${escapeAttribute(url)}"
                    ></audio>
                </div>
              `
            : "";
    } else {
        body = `
            <div class="message-content">
                ${escapeHtml(message.content || "")
                    .replaceAll("\n", "<br>")}
            </div>
        `;
    }

    body +=
        renderMessageAttachments(
            message.id
        );

    const reactions =
        renderReactions(message.id);

    wrapper.innerHTML = `
        <div class="message-avatar">
            ${avatar}
        </div>

        <div class="message-main">
            <div class="message-meta">
                <strong>${escapeHtml(name)}</strong>

                <time datetime="${escapeAttribute(message.created_at || "")}">
                    ${escapeHtml(formatMessageTime(message.created_at))}
                </time>

                ${
                    message.is_edited && !message.is_deleted
                        ? `<span class="message-edited">(edited)</span>`
                        : ""
                }
            </div>

            ${body}

            <div class="message-actions">
                <button
                    type="button"
                    class="message-reaction-button"
                    data-reaction-action="toggle"
                    data-message-id="${escapeAttribute(message.id)}"
                    title="React"
                >😊</button>

                ${
                    own && !message.is_deleted
                        ? `
                            <button
                                type="button"
                                class="message-delete-button"
                                data-message-action="delete"
                                data-message-id="${escapeAttribute(message.id)}"
                            >Delete</button>
                          `
                        : ""
                }
            </div>

            ${reactions}
        </div>
    `;

    return wrapper;
}


function renderMessageAttachments(
    messageId
) {
    const files =
        state.attachments.get(
            messageId
        ) || [];

    if (!files.length) return "";

    return `
        <div class="message-attachments">
            ${files.map(file => {
                const url =
                    safeHttpUrl(file.file_url);

                if (!url) return "";

                if (
                    file.mime_type?.startsWith("image/")
                ) {
                    return `
                        <a
                            href="${escapeAttribute(url)}"
                            target="_blank"
                            rel="noopener"
                            class="message-image-link"
                        >
                            <img
                                src="${escapeAttribute(url)}"
                                alt="${escapeAttribute(file.file_name || "Image")}"
                                loading="lazy"
                            >
                        </a>
                    `;
                }

                return `
                    <a
                        href="${escapeAttribute(url)}"
                        target="_blank"
                        rel="noopener"
                        class="message-file"
                    >
                        📎
                        <span>
                            ${escapeHtml(file.file_name || "Attachment")}
                        </span>
                        <small>
                            ${escapeHtml(formatFileSize(file.file_size))}
                        </small>
                    </a>
                `;
            }).join("")}
        </div>
    `;
}


function renderReactions(
    messageId
) {
    const reactions =
        state.reactions.get(
            messageId
        ) || [];

    if (!reactions.length) return "";

    const counts = new Map();

    reactions.forEach(item => {
        counts.set(
            item.reaction,
            (counts.get(item.reaction) || 0) + 1
        );
    });

    return `
        <div class="message-reactions">
            ${[...counts.entries()]
                .map(
                    ([emoji, count]) =>
                        `<button
                            type="button"
                            class="reaction-pill"
                            data-reaction="${escapeAttribute(emoji)}"
                            data-message-id="${escapeAttribute(messageId)}"
                        >
                            ${emoji} ${count}
                        </button>`
                )
                .join("")}
        </div>
    `;
}


function updateOlderButton() {
    const button =
        $("loadOlderMessagesButton");

    if (!button) return;

    button.classList.toggle(
        "hidden",
        !state.hasMoreMessages
    );
}


/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage(event) {
    event?.preventDefault();

    if (state.sendingMessage) return;

    if (!hasAcceptedRules()) {
        toast(
            "Please accept the community rules first.",
            "error"
        );

        updateRulesGate();
        return;
    }

    if (
        !state.selectedChannel?.id ||
        !state.user?.id
    ) {
        toast(
            "Please select a channel.",
            "error"
        );

        return;
    }

    const input =
        $("messageInput");

    const attachmentInput =
        $("attachmentInput");

    const text =
        input?.value?.trim() || "";

    const files =
        [...(attachmentInput?.files || [])];

    if (!text && !files.length) {
        return;
    }

    state.sendingMessage = true;

    try {
        const messageType =
            files.length && !text
                ? "file"
                : "text";

        const { data, error } =
            await supabase
                .from("chat_messages")
                .insert({
                    channel_id:
                        state.selectedChannel.id,
                    user_id:
                        state.user.id,
                    content:
                        text || "",
                    message_type:
                        messageType
                })
                .select()
                .single();

        if (error) {
            console.error(
                "❌ Message send failed:",
                error
            );

            toast(
                error.message ||
                "Could not send message.",
                "error"
            );

            return;
        }

        if (files.length) {
            await uploadAttachments(
                files,
                data.id
            );
        }

        if (input) {
            input.value = "";
        }

        if (attachmentInput) {
            attachmentInput.value = "";
        }

        await loadMessages(true);

    } finally {
        state.sendingMessage = false;
    }
}


/* =========================================================
   FILE UPLOADS
   ========================================================= */

async function uploadAttachments(
    files,
    messageId
) {
    for (const file of files) {
        if (
            file.size >
            MAX_ATTACHMENT_SIZE
        ) {
            toast(
                `${file.name} is larger than 25 MB.`,
                "error"
            );

            continue;
        }

        const safeName =
            file.name
                .replace(/[^a-zA-Z0-9._-]/g, "_");

        const path =
            `${state.user.id}/${messageId}/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } =
            await supabase.storage
                .from(ATTACHMENT_BUCKET)
                .upload(
                    path,
                    file,
                    {
                        cacheControl: "3600",
                        upsert: false
                    }
                );

        if (uploadError) {
            console.error(
                "❌ File upload failed:",
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
        } = supabase.storage
            .from(ATTACHMENT_BUCKET)
            .getPublicUrl(path);

        const fileUrl =
            publicData?.publicUrl || "";

        const { error: insertError } =
            await supabase
                .from("chat_attachments")
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

        if (insertError) {
            console.error(
                "❌ Attachment database insert failed:",
                insertError
            );
        }
    }
}


/* =========================================================
   DELETE MESSAGE
   ========================================================= */

async function deleteMessage(
    messageId
) {
    if (!messageId || !state.user?.id) {
        return;
    }

    const confirmed =
        window.confirm(
            "Delete this message?"
        );

    if (!confirmed) return;

    const { error } =
        await supabase
            .from("chat_messages")
            .update({
                is_deleted: true,
                deleted_at:
                    new Date().toISOString(),
                updated_at:
                    new Date().toISOString()
            })
            .eq("id", messageId)
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
            "Could not delete message.",
            "error"
        );

        return;
    }

    toast(
        "Message deleted.",
        "success"
    );

    await loadMessages(true);
}


/* =========================================================
   REACTIONS
   ========================================================= */

const QUICK_REACTIONS = [
    "👍",
    "❤️",
    "😂",
    "😮",
    "😢",
    "👏",
    "🔥",
    "🎉"
];


function openReactionMenu(
    messageId,
    anchor
) {
    closeReactionMenus();

    const menu =
        document.createElement("div");

    menu.className =
        "reaction-menu";

    menu.dataset.messageId =
        messageId;

    menu.innerHTML =
        QUICK_REACTIONS
            .map(
                emoji =>
                    `<button
                        type="button"
                        data-reaction="${escapeAttribute(emoji)}"
                    >${emoji}</button>`
            )
            .join("");

    document.body.appendChild(menu);

    const rect =
        anchor.getBoundingClientRect();

    menu.style.position = "fixed";
    menu.style.left =
        `${Math.max(8, rect.left)}px`;
    menu.style.top =
        `${Math.max(8, rect.bottom + 6)}px`;
    menu.style.zIndex = "9999";

    menu.addEventListener(
        "click",
        async event => {
            const button =
                event.target.closest(
                    "[data-reaction]"
                );

            if (!button) return;

            await toggleReaction(
                messageId,
                button.dataset.reaction
            );

            closeReactionMenus();
        }
    );
}


function closeReactionMenus() {
    document
        .querySelectorAll(".reaction-menu")
        .forEach(menu =>
            menu.remove()
        );
}


async function toggleReaction(
    messageId,
    reaction
) {
    if (
        !messageId ||
        !reaction ||
        !state.user?.id
    ) {
        return;
    }

    const { data: existing, error: lookupError } =
        await supabase
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
            "❌ Reaction lookup failed:",
            lookupError
        );

        return;
    }

    if (existing) {
        await supabase
            .from("chat_message_reactions")
            .delete()
            .eq(
                "id",
                existing.id
            );
    } else {
        await supabase
            .from("chat_message_reactions")
            .insert({
                message_id:
                    messageId,
                user_id:
                    state.user.id,
                reaction
            });
    }

    await loadMessages(true);
}


/* =========================================================
   REAL EMOJI PICKER
   ========================================================= */

function setupRealEmojiPicker() {
    const container =
        $("emojiPicker");

    if (!container) return;

    /*
     * Remove the old homemade emoji grid.
     */

    container.innerHTML = "";

    const picker =
        document.createElement(
            "emoji-picker"
        );

    picker.setAttribute(
        "locale",
        "en"
    );

    /*
     * Emoji 17.0 data.
     * The picker itself handles categories,
     * search, skin tones, sequences and flags.
     */

    picker.setAttribute(
        "emoji-version",
        "17.0"
    );

    /*
     * Make the actual picker compact and horizontal
     * in the surrounding chat UI.
     */

    picker.style.width =
        "min(420px, calc(100vw - 32px))";

    picker.style.height =
        "360px";

    picker.style.maxWidth =
        "100%";

    picker.style.display =
        "block";

    picker.style.setProperty(
        "--num-columns",
        "8"
    );

    picker.style.setProperty(
        "--emoji-size",
        "1.5rem"
    );

    picker.style.setProperty(
        "--emoji-padding",
        "0.35rem"
    );

    container.appendChild(
        picker
    );

    state.emojiPicker =
        picker;

    picker.addEventListener(
        "emoji-click",
        event => {
            const emoji =
                event.detail?.unicode;

            if (!emoji) return;

            insertEmoji(
                emoji
            );

            closeEmojiPicker();
        }
    );
}


function insertEmoji(
    emoji
) {
    const input =
        $("messageInput");

    if (!input) return;

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

    input.focus();

    input.setSelectionRange(
        cursor,
        cursor
    );

    input.dispatchEvent(
        new Event("input", {
            bubbles: true
        })
    );
}


function openEmojiPicker() {
    const container =
        $("emojiPicker");

    if (!container) return;

    container.classList.remove(
        "hidden"
    );

    $("emojiButton")?.setAttribute(
        "aria-expanded",
        "true"
    );
}


function closeEmojiPicker() {
    const container =
        $("emojiPicker");

    if (!container) return;

    container.classList.add(
        "hidden"
    );

    $("emojiButton")?.setAttribute(
        "aria-expanded",
        "false"
    );
}


/* =========================================================
   GIF
   ========================================================= */

function setupGif() {
    const input =
        $("gifUrlInput");

    const previewButton =
        $("previewGifButton");

    const sendButton =
        $("sendGifButton");

    const preview =
        $("gifPreview");

    if (!input || !previewButton) {
        return;
    }

    previewButton.addEventListener(
        "click",
        previewGif
    );

    input.addEventListener(
        "keydown",
        event => {
            if (
                event.key === "Enter"
            ) {
                event.preventDefault();
                previewGif();
            }
        }
    );

    sendButton?.addEventListener(
        "click",
        sendGif
    );

    function previewGif() {
        const url =
            safeHttpUrl(
                input.value.trim()
            );

        if (!url) {
            toast(
                "Enter a valid GIF URL.",
                "error"
            );

            return;
        }

        preview.innerHTML = `
            <img
                src="${escapeAttribute(url)}"
                alt="GIF preview"
            >
        `;

        if (sendButton) {
            sendButton.disabled = false;
        }
    }
}


async function sendGif() {
    const input =
        $("gifUrlInput");

    const url =
        safeHttpUrl(
            input?.value?.trim() || ""
        );

    if (!url) return;

    if (!state.selectedChannel?.id) {
        toast(
            "Select a channel first.",
            "error"
        );

        return;
    }

    const { error } =
        await supabase
            .from("chat_messages")
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
            "❌ GIF send failed:",
            error
        );

        toast(
            "Could not send GIF.",
            "error"
        );

        return;
    }

    closeGifPicker();

    if (input) {
        input.value = "";
    }

    $("gifPreview").innerHTML = "";

    if ($("sendGifButton")) {
        $("sendGifButton").disabled =
            true;
    }

    await loadMessages(true);
}


function openGifPicker() {
    $("gifPicker")?.classList.remove(
        "hidden"
    );
}


function closeGifPicker() {
    $("gifPicker")?.classList.add(
        "hidden"
    );
}


/* =========================================================
   VOICE NOTES
   ========================================================= */

function addVoiceNoteButton() {
    const tools =
        document.querySelector(
            ".composer-tools"
        );

    if (!tools) return;

    if ($("voiceNoteButton")) {
        return;
    }

    const button =
        document.createElement("button");

    button.id =
        "voiceNoteButton";

    button.type =
        "button";

    button.className =
        "composer-tool";

    button.title =
        "Record voice note";

    button.setAttribute(
        "aria-label",
        "Record voice note"
    );

    button.textContent =
        "🎙️";

    /*
     * Put voice before emoji.
     */

    const emojiButton =
        $("emojiButton");

    if (emojiButton) {
        tools.insertBefore(
            button,
            emojiButton
        );
    } else {
        tools.appendChild(
            button
        );
    }

    button.addEventListener(
        "click",
        toggleVoiceRecording
    );
}


async function toggleVoiceRecording() {
    if (state.recording) {
        stopVoiceRecording();
    } else {
        await startVoiceRecording();
    }
}


async function startVoiceRecording() {
    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {
        toast(
            "Voice recording is not supported by this browser.",
            "error"
        );

        return;
    }

    try {
        const stream =
            await navigator.mediaDevices.getUserMedia({
                audio: true
            });

        state.mediaStream =
            stream;

        const preferredTypes = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/ogg;codecs=opus"
        ];

        const mimeType =
            preferredTypes.find(
                type =>
                    window.MediaRecorder &&
                    MediaRecorder.isTypeSupported(
                        type
                    )
            ) || "";

        state.mediaRecorder =
            new MediaRecorder(
                stream,
                mimeType
                    ? { mimeType }
                    : undefined
            );

        state.recordedChunks = [];
        state.recording = true;

        state.mediaRecorder.addEventListener(
            "dataavailable",
            event => {
                if (
                    event.data &&
                    event.data.size
                ) {
                    state.recordedChunks.push(
                        event.data
                    );
                }
            }
        );

        state.mediaRecorder.addEventListener(
            "stop",
            finishVoiceRecording
        );

        state.mediaRecorder.start();

        updateVoiceButton();

        toast(
            "Recording voice note… click 🎙️ again to send.",
            "info"
        );

    } catch (error) {
        console.error(
            "❌ Microphone access failed:",
            error
        );

        toast(
            "Microphone permission was not granted.",
            "error"
        );
    }
}


function stopVoiceRecording() {
    if (
        state.mediaRecorder &&
        state.mediaRecorder.state !==
            "inactive"
    ) {
        state.mediaRecorder.stop();
    }
}


async function finishVoiceRecording() {
    const recorder =
        state.mediaRecorder;

    const mimeType =
        recorder?.mimeType ||
        "audio/webm";

    const blob =
        new Blob(
            state.recordedChunks,
            {
                type: mimeType
            }
        );

    cleanupVoiceStream();

    state.recording = false;
    state.mediaRecorder = null;

    updateVoiceButton();

    if (!blob.size) {
        toast(
            "No voice recording was captured.",
            "error"
        );

        return;
    }

    if (
        blob.size >
        MAX_VOICE_NOTE_SIZE
    ) {
        toast(
            "Voice note is too large.",
            "error"
        );

        return;
    }

    await uploadVoiceNote(
        blob,
        mimeType
    );
}


function cleanupVoiceStream() {
    if (state.mediaStream) {
        state.mediaStream
            .getTracks()
            .forEach(track =>
                track.stop()
            );
    }

    state.mediaStream = null;
}


function updateVoiceButton() {
    const button =
        $("voiceNoteButton");

    if (!button) return;

    if (state.recording) {
        button.textContent =
            "⏹️";

        button.title =
            "Stop and send voice note";

        button.classList.add(
            "recording"
        );
    } else {
        button.textContent =
            "🎙️";

        button.title =
            "Record voice note";

        button.classList.remove(
            "recording"
        );
    }
}


async function uploadVoiceNote(
    blob,
    mimeType
) {
    if (
        !state.user?.id ||
        !state.selectedChannel?.id
    ) {
        return;
    }

    const extension =
        mimeType.includes("ogg")
            ? "ogg"
            : "webm";

    const fileName =
        `voice-${Date.now()}.${extension}`;

    const path =
        `${state.user.id}/voice/${crypto.randomUUID()}-${fileName}`;

    const { error: uploadError } =
        await supabase.storage
            .from(ATTACHMENT_BUCKET)
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
            "❌ Voice note upload failed:",
            uploadError
        );

        toast(
            "Could not upload voice note.",
            "error"
        );

        return;
    }

    const {
        data: publicData
    } = supabase.storage
        .from(ATTACHMENT_BUCKET)
        .getPublicUrl(path);

    const url =
        publicData?.publicUrl || "";

    if (!url) {
        toast(
            "Voice note URL could not be created.",
            "error"
        );

        return;
    }

    const { data: message, error } =
        await supabase
            .from("chat_messages")
            .insert({
                channel_id:
                    state.selectedChannel.id,
                user_id:
                    state.user.id,
                content:
                    url,
                message_type:
                    "voice"
            })
            .select()
            .single();

    if (error) {
        console.error(
            "❌ Voice message insert failed:",
            error
        );

        toast(
            "Could not send voice note.",
            "error"
        );

        return;
    }

    await supabase
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
                url,
            mime_type:
                mimeType,
            file_size:
                blob.size
        });

    toast(
        "Voice note sent.",
        "success"
    );

    await loadMessages(true);
}


/* =========================================================
   GENERAL CALL BRIDGE
   ========================================================= */

function openGeneralCallModal() {
    $("generalCallModal")
        ?.classList.remove("hidden");
}


function closeGeneralCallModal() {
    $("generalCallModal")
        ?.classList.add("hidden");
}


function setGeneralCallMode(
    mode
) {
    state.generalCallMode =
        mode === "video"
            ? "video"
            : "voice";

    $("generalVoiceCallButton")
        ?.classList.toggle(
            "active",
            state.generalCallMode === "voice"
        );

    $("generalVideoCallButton")
        ?.classList.toggle(
            "active",
            state.generalCallMode === "video"
        );
}


async function startGeneralCall() {
    const target =
        $("generalCallUserInput")
            ?.value
            ?.trim();

    if (!target) {
        $("generalCallMessage").textContent =
            "Enter the user's UUID.";

        return;
    }

    const detail = {
        targetUserId: target,
        mode: state.generalCallMode,
        communityId: null,
        channelId: null,
        type: "general"
    };

    /*
     * call.js should listen for this event.
     * No WebRTC code is duplicated here.
     */

    window.dispatchEvent(
        new CustomEvent(
            "mwaniki:general-call",
            {
                detail
            }
        )
    );

    /*
     * Also support a globally exposed call starter
     * if call.js provides one.
     */

    if (
        typeof window.startMwanikiCall ===
        "function"
    ) {
        try {
            await window.startMwanikiCall(
                detail
            );
        } catch (error) {
            console.error(
                "❌ General call starter failed:",
                error
            );
        }
    }

    closeGeneralCallModal();
}


/* =========================================================
   REALTIME
   ========================================================= */

async function subscribeToChannel() {
    if (state.messageChannel) {
        await supabase.removeChannel(
            state.messageChannel
        );

        state.messageChannel = null;
    }

    if (state.reactionChannel) {
        await supabase.removeChannel(
            state.reactionChannel
        );

        state.reactionChannel = null;
    }

    const channelId =
        state.selectedChannel?.id;

    if (!channelId) return;

    state.messageChannel =
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
                async () => {
                    await loadMessages(true);
                }
            )
            .subscribe();

    state.reactionChannel =
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
                    await loadMessages(true);
                }
            )
            .subscribe();
}


/* =========================================================
   MODALS
   ========================================================= */

function openCommunityModal() {
    $("communityModal")
        ?.classList.remove("hidden");
}


function closeCommunityModal() {
    $("communityModal")
        ?.classList.add("hidden");
}


/* =========================================================
   GIF / EMOJI CLOSE HANDLING
   ========================================================= */

function closeComposerPickers() {
    closeEmojiPicker();
    closeGifPicker();
    closeReactionMenus();
}


/* =========================================================
   EVENT WIRING
   ========================================================= */

function wireEvents() {

    /* Rules */

    $("communityRulesAgreement")
        ?.addEventListener(
            "change",
            event => {
                const button =
                    $("acceptCommunityRulesButton");

                if (button) {
                    button.disabled =
                        !event.target.checked;
                }
            }
        );

    $("acceptCommunityRulesButton")
        ?.addEventListener(
            "click",
            acceptRules
        );


    /* Community */

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


    /* Channel search */

    $("channelSearchInput")
        ?.addEventListener(
            "input",
            event => {
                renderChannels(
                    filterChannels(
                        event.target.value
                    )
                );
            }
        );


    /* Message */

    $("messageForm")
        ?.addEventListener(
            "submit",
            sendMessage
        );


    $("messageInput")
        ?.addEventListener(
            "keydown",
            event => {
                if (
                    event.key === "Enter" &&
                    !event.shiftKey
                ) {
                    event.preventDefault();

                    $("messageForm")
                        ?.requestSubmit();
                }
            }
        );


    /* Attachments */

    $("attachButton")
        ?.addEventListener(
            "click",
            () => {
                $("attachmentInput")
                    ?.click();
            }
        );


    $("attachmentInput")
        ?.addEventListener(
            "change",
            event => {
                const files =
                    [...event.target.files];

                if (!files.length) return;

                toast(
                    `${files.length} file${files.length === 1 ? "" : "s"} selected.`,
                    "success"
                );
            }
        );


    /* Emoji */

    $("emojiButton")
        ?.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                const picker =
                    $("emojiPicker");

                if (
                    picker?.classList.contains(
                        "hidden"
                    )
                ) {
                    openEmojiPicker();
                    closeGifPicker();
                } else {
                    closeEmojiPicker();
                }
            }
        );


    $("closeEmojiButton")
        ?.addEventListener(
            "click",
            closeEmojiPicker
        );


    /* GIF */

    $("gifButton")
        ?.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                const picker =
                    $("gifPicker");

                if (
                    picker?.classList.contains(
                        "hidden"
                    )
                ) {
                    openGifPicker();
                    closeEmojiPicker();
                } else {
                    closeGifPicker();
                }
            }
        );


    $("closeGifButton")
        ?.addEventListener(
            "click",
            closeGifPicker
        );


    /* History */

    $("loadOlderMessagesButton")
        ?.addEventListener(
            "click",
            async () => {
                await loadMessages(false);
            }
        );


    /* Welcome */

    $("welcomeStartButton")
        ?.addEventListener(
            "click",
            () => {
                $("messageInput")
                    ?.focus();
            }
        );


    /* Dashboard */

    $("dashboardButton")
        ?.addEventListener(
            "click",
            () => {
                window.location.href =
                    "./dashboard.html";
            }
        );

    $("homeButton")
        ?.addEventListener(
            "click",
            () => {
                window.location.href =
                    "./dashboard.html";
            }
        );

    $("railHomeButton")
        ?.addEventListener(
            "click",
            () => {
                window.location.href =
                    "./dashboard.html";
            }
        );


    /* Profile */

    $("railProfileButton")
        ?.addEventListener(
            "click",
            () => {
                window.location.href =
                    "./dashboard.html#profile";
            }
        );

    $("sidebarProfileButton")
        ?.addEventListener(
            "click",
            () => {
                window.location.href =
                    "./dashboard.html#profile";
            }
        );


    /* General call */

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
            () => setGeneralCallMode("voice")
        );

    $("generalVideoCallButton")
        ?.addEventListener(
            "click",
            () => setGeneralCallMode("video")
        );

    $("startGeneralCallButton")
        ?.addEventListener(
            "click",
            startGeneralCall
        );


    /* Message actions */

    $("messageList")
        ?.addEventListener(
            "click",
            async event => {

                const deleteButton =
                    event.target.closest(
                        "[data-message-action='delete']"
                    );

                if (deleteButton) {
                    await deleteMessage(
                        deleteButton.dataset.messageId
                    );

                    return;
                }

                const reactionButton =
                    event.target.closest(
                        "[data-reaction-action='toggle']"
                    );

                if (reactionButton) {
                    openReactionMenu(
                        reactionButton.dataset.messageId,
                        reactionButton
                    );

                    return;
                }

                const reactionPill =
                    event.target.closest(
                        ".reaction-pill"
                    );

                if (reactionPill) {
                    await toggleReaction(
                        reactionPill.dataset.messageId,
                        reactionPill.dataset.reaction
                    );
                }
            }
        );


    /* Outside-click handling */

    document.addEventListener(
        "click",
        event => {

            if (
                $("emojiPicker") &&
                !$("emojiPicker").contains(
                    event.target
                ) &&
                event.target !==
                    $("emojiButton")
            ) {
                closeEmojiPicker();
            }

            if (
                $("gifPicker") &&
                !$("gifPicker").contains(
                    event.target
                ) &&
                event.target !==
                    $("gifButton")
            ) {
                closeGifPicker();
            }

            if (
                !event.target.closest(
                    ".reaction-menu"
                ) &&
                !event.target.closest(
                    "[data-reaction-action]"
                )
            ) {
                closeReactionMenus();
            }
        }
    );


    /* Escape closes overlays */

    document.addEventListener(
        "keydown",
        event => {
            if (event.key !== "Escape") {
                return;
            }

            closeEmojiPicker();
            closeGifPicker();
            closeReactionMenus();
            closeCommunityModal();
            closeGeneralCallModal();
        }
    );
}


/* =========================================================
   AUTH
   ========================================================= */

async function getCurrentUser() {
    const {
        data,
        error
    } = await supabase.auth.getUser();

    if (error) {
        console.error(
            "❌ Auth lookup failed:",
            error
        );

        return null;
    }

    return data?.user || null;
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeCommunity() {
    console.log(
        "🚀 Initializing Mwaniki Scholars Community..."
    );

    if (!state.user) {
        state.user =
            await getCurrentUser();
    }

    if (!state.user) {
        toast(
            "Please sign in to enter the community.",
            "error"
        );

        return;
    }

    console.log(
        "🔐 Community user:",
        state.user.id
    );

    await loadOwnProfile();

    updateRulesGate();

    setupRealEmojiPicker();

    addVoiceNoteButton();

    setupGif();

    wireEvents();

    await loadCommunities();

    console.log(
        "✅ Community initialization complete."
    );
}


/* =========================================================
   AUTH STATE CHANGES
   ========================================================= */

supabase.auth.onAuthStateChange(
    async (event, session) => {
        console.log(
            "🔐 Community auth:",
            event
        );

        if (
            event === "SIGNED_IN" &&
            session?.user
        ) {
            state.user =
                session.user;

            await loadOwnProfile();

            updateRulesGate();

            if (
                !state.selectedCommunity
            ) {
                await loadCommunities();
            }

            return;
        }

        if (
            event === "SIGNED_OUT"
        ) {
            state.user = null;
            state.profile = null;

            window.location.href =
                "./index.html";
        }
    }
);


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
        { once: true }
    );
} else {
    initializeCommunity();
}


/* =========================================================
   DEBUG ACCESS
   ========================================================= */

window.mwanikiCommunity =
    state;

console.log(
    "✅ Mwaniki Scholars community.js loaded."
);
