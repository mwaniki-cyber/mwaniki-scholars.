/* =========================================================
   MWANIKI SCHOLARS COMMUNITY ENGINE
   CHAT / COMMUNITY / PRESENCE / FILES / REACTIONS
   ========================================================= */

"use strict";


/* =========================================================
   CONFIGURATION
   ========================================================= */

const STORAGE_BUCKET = "chat-attachments";

const MESSAGE_PAGE_SIZE = 50;

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const COMMUNITY_ICONS = {
    mwaniki: "🎓",
    gaming: "🎮",
    memes: "😂"
};

const QUICK_REACTIONS = [
    "👍",
    "❤️",
    "😂",
    "😮",
    "👏",
    "🎉"
];

const STICKERS = [
    "😂",
    "🤣",
    "😎",
    "🥳",
    "👏",
    "🙌",
    "❤️",
    "🔥",
    "🎉",
    "🏆",
    "💯",
    "🤝",
    "🙏",
    "😮",
    "😭",
    "🚀",
    "⭐",
    "💡"
];

const EMOJI_DATA = {
    "Smileys": [
        "😀","😃","😄","😁","😆","😅","😂","🤣",
        "😊","😇","🙂","🙃","😉","😌","😍","🥰",
        "😘","😗","😙","😚","😋","😛","😝","😜",
        "🤪","🤨","🧐","🤓","😎","🤩","🥳","😏",
        "😒","😞","😔","😟","😕","🙁","☹️","😣",
        "😖","😫","😩","🥺","😢","😭","😤","😠",
        "😡","🤬","🤯","😳","🥵","🥶","😱","😨",
        "😰","😥","😓","🤗","🤔","🫣","🤭","🫢",
        "🫡","🤫","🫠","🤥","😶","🫥","😐","🫤",
        "😑","😬","🙄","😯","😦","😧","😮","😲",
        "🥱","😴","🤤","😪","😵","🤐","🤢","🤮",
        "🤧","😷","🤒","🤕"
    ],

    "People": [
        "👋","🤚","🖐️","✋","🖖","👌","🤌","🤏",
        "✌️","🤞","🫰","🤟","🤘","🤙","👈","👉",
        "👆","👇","☝️","👍","👎","✊","👊","🤛",
        "🤜","👏","🙌","👐","🤲","🤝","🙏","💪",
        "👀","👁️","🧠","🫀","🫁","👶","🧒","👦",
        "👧","🧑","👨","👩","🧓","👴","👵"
    ],

    "Animals": [
        "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼",
        "🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈",
        "🙉","🙊","🐔","🐧","🐦","🐤","🦆","🦅",
        "🦉","🐺","🐗","🐴","🦄","🐝","🪲","🦋",
        "🐌","🐞","🐜","🕷️","🐢","🐍","🦎","🦖",
        "🦕","🐙","🦑","🦀","🐠","🐟","🐡","🦈",
        "🐊","🐘","🦏","🦒","🦓","🦍","🐪","🐫"
    ],

    "Food": [
        "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇",
        "🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥",
        "🥝","🍅","🥑","🍆","🥔","🥕","🌽","🌶️",
        "🥒","🥬","🥦","🧄","🧅","🍞","🥐","🥖",
        "🧀","🥚","🍳","🧈","🥞","🧇","🥓","🍗",
        "🍔","🍟","🍕","🌭","🌮","🌯","🥗","🍿",
        "🍩","🍪","🎂","🍰","🧁","🍫","🍭","🍬",
        "☕","🫖","🥤","🧃"
    ],

    "Activities": [
        "⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉",
        "🎱","🏓","🏸","🏒","🏑","🥊","🥋","🎽",
        "🎯","🎮","🎲","🎸","🎹","🥁","🎺","🎻",
        "🎨","🎭","🎬","🎤","🎧","🏆","🥇","🥈",
        "🥉","🏅","🎖️","🚴","🏊","🏃","🧗"
    ],

    "Objects": [
        "💡","📱","💻","⌨️","🖥️","🖨️","📷","📸",
        "🎥","📞","☎️","📺","📻","⏰","⌚","🔋",
        "💾","💿","📀","📚","📖","📝","✏️","🖊️",
        "📌","📍","📎","✂️","🔒","🔑","🔔","🎁",
        "🎈","🎀","🧸","🛒","💰","💳"
    ],

    "Symbols": [
        "❤️","🧡","💛","💚","💙","💜","🖤","🤍",
        "🤎","💔","❣️","💕","💞","💓","💗","💖",
        "💘","💝","💟","☮️","✝️","☪️","☯️","♻️",
        "✅","❌","⚠️","❗","❓","‼️","⁉️","⭕",
        "🚫","🔴","🟠","🟡","🟢","🔵","🟣"
    ],

    "Flags": [
        "🇰🇪","🇺🇬","🇹🇿","🇷🇼","🇧🇮","🇪🇹","🇳🇬",
        "🇬🇭","🇿🇦","🇿🇲","🇿🇼","🇧🇼","🇳🇦","🇲🇿",
        "🇲🇼","🇸🇸","🇸🇩","🇸🇴","🇬🇧","🇺🇸","🇨🇦",
        "🇦🇺","🇳🇿","🇮🇳","🇵🇰","🇧🇩","🇨🇳","🇯🇵",
        "🇰🇷","🇸🇬","🇦🇪","🇸🇦","🇹🇷","🇫🇷","🇩🇪",
        "🇮🇹","🇪🇸","🇵🇹","🇧🇷","🇲🇽","🇦🇷","🇪🇬"
    ]
};


/* =========================================================
   STATE
   ========================================================= */

const state = {

    supabase: null,

    user: null,

    profile: null,

    communities: [],

    currentCommunity: null,

    channels: [],

    currentChannel: null,

    messages: [],

    members: [],

    selectedFiles: [],

    selectedFriend: null,

    messageSubscription: null,

    reactionSubscription: null,

    presenceSubscription: null,

    initialized: false,

    emojiCategory: "Smileys",

    messagePage: 0,

    loadingMessages: false,

    hasMoreMessages: true

};


/* =========================================================
   DOM
   ========================================================= */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => [...document.querySelectorAll(selector)];


/* =========================================================
   SUPABASE
   ========================================================= */

async function waitForSupabase(timeout = 10000) {

    const started = Date.now();

    while (!window.supabase) {

        if (Date.now() - started > timeout) {

            throw new Error(
                "Supabase client was not available after 10 seconds."
            );
        }

        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return window.supabase;
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initialize() {

    if (state.initialized) {
        return;
    }

    state.initialized = true;

    try {

        state.supabase = await waitForSupabase();

        setupStaticEvents();

        renderEmojiPicker();

        renderStickerPicker();

        await authenticate();

        await loadProfile();

        await loadCommunities();

        setupRealtime();

        startPresence();

        console.log(
            "✅ Mwaniki Scholars Community loaded"
        );

    } catch (error) {

        console.error(
            "Community initialization failed:",
            error
        );

        showToast(
            error.message || "Unable to load community."
        );
    }
}


/* =========================================================
   AUTHENTICATION
   ========================================================= */

async function authenticate() {

    const {
        data,
        error
    } = await state.supabase.auth.getSession();

    if (error) {
        throw error;
    }

    if (!data?.session?.user) {

        showToast(
            "Please sign in before entering the community."
        );

        setTimeout(() => {

            window.location.href =
                "./index.html";

        }, 1800);

        throw new Error("User is not authenticated.");
    }

    state.user = data.session.user;

    console.log(
        "🔐 Authenticated:",
        state.user.id
    );
}


/* =========================================================
   PROFILE
   ========================================================= */

async function loadProfile() {

    const possibleTables = [
        "profiles",
        "students"
    ];

    for (const table of possibleTables) {

        try {

            const {
                data,
                error
            } = await state.supabase
                .from(table)
                .select("*")
                .eq("id", state.user.id)
                .maybeSingle();

            if (!error && data) {

                state.profile = normalizeProfile(data);

                renderCurrentUser();

                return;
            }

        } catch (error) {

            console.warn(
                `Profile table ${table} unavailable`,
                error
            );
        }
    }

    state.profile = {

        id: state.user.id,

        name:
            state.user.user_metadata?.full_name ||
            state.user.user_metadata?.name ||
            state.user.email?.split("@")[0] ||
            "Member",

        avatar:
            state.user.user_metadata?.avatar_url ||
            state.user.user_metadata?.picture ||
            "",

        role: "Student",

        status: "online"

    };

    renderCurrentUser();
}


function normalizeProfile(row) {

    return {

        id:
            row.id ||
            row.user_id ||
            state.user.id,

        name:
            row.full_name ||
            row.name ||
            row.display_name ||
            row.username ||
            state.user.email?.split("@")[0] ||
            "Member",

        avatar:
            row.avatar_url ||
            row.photo_url ||
            row.avatar ||
            row.profile_photo ||
            "",

        role:
            row.role ||
            "Student",

        status:
            row.status ||
            "online"

    };
}


/* =========================================================
   CURRENT USER
   ========================================================= */

function renderCurrentUser() {

    const name =
        state.profile?.name ||
        "Member";

    const avatar =
        state.profile?.avatar || "";

    const headerName =
        $("#headerProfileName");

    if (headerName) {
        headerName.textContent = name;
    }

    const avatarElement =
        $("#headerProfileAvatar");

    if (avatarElement) {

        avatarElement.innerHTML =
            avatar
                ? `<img src="${escapeAttribute(avatar)}" alt="${escapeAttribute(name)}">`
                : escapeHtml(
                    getInitials(name)
                );
    }

    updatePresenceDot(
        $("#headerPresenceDot"),
        "online"
    );
}


/* =========================================================
   COMMUNITIES
   ========================================================= */

async function loadCommunities() {

    const {
        data,
        error
    } = await state.supabase
        .from("chat_communities")
        .select("*")
        .eq("is_active", true)
        .order("created_at", {
            ascending: true
        });

    if (error) {
        throw error;
    }

    state.communities = data || [];

    if (!state.communities.length) {

        showEmptyCommunities();

        return;
    }

    renderCommunityRail();

    const preferred =
        state.communities.find(
            community =>
                /mwaniki|scholar/i.test(
                    community.name || ""
                )
        ) ||
        state.communities[0];

    await selectCommunity(preferred.id);
}


function showEmptyCommunities() {

    $("#communityRailList").innerHTML = `
        <div class="empty-state">
            No communities
        </div>
    `;
}


function communityIcon(community) {

    const name =
        String(community?.name || "")
            .toLowerCase();

    if (name.includes("gaming")) {
        return COMMUNITY_ICONS.gaming;
    }

    if (
        name.includes("meme")
    ) {
        return COMMUNITY_ICONS.memes;
    }

    if (
        name.includes("mwaniki") ||
        name.includes("scholar") ||
        name.includes("academic")
    ) {
        return COMMUNITY_ICONS.mwaniki;
    }

    return "🌐";
}


function renderCommunityRail() {

    const container =
        $("#communityRailList");

    container.innerHTML = "";

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

            button.textContent =
                communityIcon(community);

            button.addEventListener(
                "click",
                () => selectCommunity(
                    community.id
                )
            );

            container.appendChild(button);
        }
    );

    updateCommunityRailSelection();
}


function updateCommunityRailSelection() {

    $$(".community-rail-item")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.communityId ===
                String(state.currentCommunity?.id)
            );
        });
}


/* =========================================================
   COMMUNITY SELECTION
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

    state.currentCommunity =
        community;

    updateCommunityRailSelection();

    $("#selectedCommunityIcon")
        .textContent =
        communityIcon(community);

    $("#selectedCommunityName")
        .textContent =
        community.name || "Community";

    $("#selectedCommunityDescription")
        .textContent =
        community.description ||
        "Community discussion";

    await loadChannels();

    await loadMembers();

    subscribeToCommunityRealtime();
}


/* =========================================================
   CHANNELS
   ========================================================= */

async function loadChannels() {

    const {
        data,
        error
    } = await state.supabase
        .from("chat_channels")
        .select("*")
        .eq(
            "community_id",
            state.currentCommunity.id
        )
        .eq("is_active", true)
        .eq("is_archived", false)
        .order("position", {
            ascending: true
        });

    if (error) {
        throw error;
    }

    state.channels = data || [];

    renderChannels();

    if (!state.channels.length) {

        clearMessages();

        return;
    }

    const current =
        state.channels.find(
            channel =>
                channel.id ===
                state.currentChannel?.id
        );

    await selectChannel(
        current?.id ||
        state.channels[0].id
    );
}


function renderChannels() {

    const groups = {

        information:
            $("#informationChannels"),

        course:
            $("#courseChannels"),

        community:
            $("#communityChannels")

    };

    Object.values(groups)
        .forEach(element => {
            element.innerHTML = "";
        });

    state.channels.forEach(
        channel => {

            const button =
                createChannelButton(channel);

            const target =
                channel.course_id
                    ? groups.course
                    : isInformationChannel(channel)
                        ? groups.information
                        : groups.community;

            target.appendChild(button);
        }
    );
}


function isInformationChannel(channel) {

    const name =
        String(channel.name || "")
            .toLowerCase();

    return [
        "general",
        "rules",
        "announcement",
        "announcements",
        "information"
    ].some(
        value => name.includes(value)
    );
}


function createChannelButton(channel) {

    const button =
        document.createElement("button");

    button.type = "button";

    button.className =
        "channel-button";

    button.dataset.channelId =
        channel.id;

    button.innerHTML = `
        <span>${escapeHtml(
            channel.icon || "#"
        )}</span>
        <span>${escapeHtml(
            channel.name || "channel"
        )}</span>
    `;

    button.addEventListener(
        "click",
        () => selectChannel(
            channel.id
        )
    );

    return button;
}


/* =========================================================
   CHANNEL SELECTION
   ========================================================= */

async function selectChannel(channelId) {

    const channel =
        state.channels.find(
            item =>
                String(item.id) ===
                String(channelId)
        );

    if (!channel) {
        return;
    }

    state.currentChannel =
        channel;

    state.messagePage = 0;

    state.hasMoreMessages = true;

    $$(".channel-button")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.channelId ===
                String(channel.id)
            );
        });

    $("#currentChannelIcon")
        .textContent =
        channel.icon || "#";

    $("#currentChannelName")
        .textContent =
        channel.name || "channel";

    $("#currentChannelDescription")
        .textContent =
        channel.description ||
        "Community discussion";

    await loadMessages();
}


/* =========================================================
   MESSAGES
   ========================================================= */

async function loadMessages() {

    if (!state.currentChannel) {
        return;
    }

    state.loadingMessages = true;

    $("#messageList").innerHTML = `
        <div class="message-loading">
            Loading messages...
        </div>
    `;

    try {

        const {
            data,
            error
        } = await state.supabase
            .from("chat_messages")
            .select(`
                *,
                chat_attachments(*)
            `)
            .eq(
                "channel_id",
                state.currentChannel.id
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            )
            .range(
                0,
                MESSAGE_PAGE_SIZE - 1
            );

        if (error) {
            throw error;
        }

        state.messages =
            (data || []).reverse();

        state.hasMoreMessages =
            (data || []).length ===
            MESSAGE_PAGE_SIZE;

        renderMessages();

    } catch (error) {

        console.error(
            "Message loading error:",
            error
        );

        $("#messageList").innerHTML = `
            <div class="empty-state">
                Unable to load messages.
            </div>
        `;

    } finally {

        state.loadingMessages = false;
    }
}


function clearMessages() {

    $("#messageList").innerHTML = `
        <div class="empty-state">
            Select a channel.
        </div>
    `;
}


function renderMessages() {

    const container =
        $("#messageList");

    container.innerHTML = "";

    if (!state.messages.length) {

        container.innerHTML = `
            <div class="empty-state">
                No messages yet.<br>
                Start the conversation.
            </div>
        `;

        return;
    }

    state.messages.forEach(
        message => {

            container.appendChild(
                createMessageElement(
                    message
                )
            );
        }
    );

    scrollMessagesToBottom();
}


/* =========================================================
   MESSAGE ELEMENT
   ========================================================= */

function createMessageElement(message) {

    const article =
        document.createElement("article");

    article.className =
        "message";

    article.dataset.messageId =
        message.id;

    const isOwn =
        String(message.user_id) ===
        String(state.user.id);

    const deleted =
        message.is_deleted;

    const profile =
        getMessageProfile(message);

    const avatar =
        profile.avatar;

    const name =
        profile.name ||
        "Member";

    const badge =
        getMemberBadge(profile);

    const status =
        profile.status ||
        "offline";

    article.innerHTML = `

        <div class="member-avatar-wrap">

            <div class="avatar message-avatar">

                ${
                    avatar
                        ? `<img
                            src="${escapeAttribute(avatar)}"
                            alt="${escapeAttribute(name)}"
                        >`
                        : escapeHtml(
                            getInitials(name)
                        )
                }

            </div>

            <span
                class="member-status ${statusClass(status)}"
            ></span>

        </div>


        <div class="message-body">

            <div class="message-author-row">

                <span class="message-author">
                    ${escapeHtml(name)}
                </span>

                ${
                    badge
                        ? `<span class="member-badge">
                            ${escapeHtml(badge)}
                           </span>`
                        : ""
                }

                <span class="message-role">
                    ${escapeHtml(
                        profile.role || "Student"
                    )}
                </span>

                <span class="message-time">
                    ${formatTime(message.created_at)}
                </span>

            </div>


            <div class="message-content">

                ${
                    deleted
                        ? `<span class="deleted-message">
                            This message was deleted.
                           </span>`
                        : renderMessageContent(
                            message
                        )
                }

            </div>


            ${
                !deleted
                    ? renderAttachments(
                        message
                    )
                    : ""
            }


            ${
                !deleted
                    ? `
                    <div class="reactions">

                        ${QUICK_REACTIONS.map(
                            reaction => `
                                <button
                                    type="button"
                                    class="reaction quick-reaction"
                                    data-message-id="${escapeAttribute(message.id)}"
                                    data-reaction="${escapeAttribute(reaction)}"
                                >
                                    ${reaction}
                                </button>
                            `
                        ).join("")}

                    </div>
                    `
                    : ""
            }


            ${
                !deleted
                    ? `
                    <div class="message-actions">

                        <button
                            type="button"
                            class="message-action"
                            data-message-action="reply"
                        >
                            Reply
                        </button>

                        <button
                            type="button"
                            class="message-action"
                            data-message-action="react"
                        >
                            React
                        </button>

                        ${
                            isOwn
                                ? `
                                <button
                                    type="button"
                                    class="message-action"
                                    data-message-action="edit"
                                >
                                    Edit
                                </button>

                                <button
                                    type="button"
                                    class="message-action"
                                    data-message-action="delete"
                                >
                                    Delete
                                </button>
                                `
                                : ""
                        }

                    </div>
                    `
                    : ""
            }

        </div>
    `;

    return article;
}


/* =========================================================
   PROFILE FOR MESSAGE
   ========================================================= */

function getMessageProfile(message) {

    if (
        message.user_id ===
        state.user?.id
    ) {
        return state.profile;
    }

    const member =
        state.members.find(
            item =>
                String(
                    item.user_id
                ) ===
                String(
                    message.user_id
                )
        );

    if (member?.profile) {
        return normalizeProfile(
            member.profile
        );
    }

    return {

        name:
            message.user_name ||
            message.username ||
            "Member",

        avatar:
            message.user_avatar ||
            "",

        role:
            message.user_role ||
            "Student",

        status:
            message.user_status ||
            "offline"

    };
}


/* =========================================================
   BADGES
   ========================================================= */

function getMemberBadge(profile) {

    if (
        profile?.is_new_member === true ||
        profile?.membership_status === "new"
    ) {
        return "🆕 New Member";
    }

    if (
        profile?.badge
    ) {
        return profile.badge;
    }

    return "";
}


/* =========================================================
   MESSAGE CONTENT
   ========================================================= */

function renderMessageContent(message) {

    const type =
        message.message_type ||
        "text";

    if (type === "gif") {

        return `
            <div class="attachment-card">
                🎞️ GIF
                <a
                    href="${escapeAttribute(message.content || "#")}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    View GIF
                </a>
            </div>
        `;
    }

    if (type === "sticker") {

        return `
            <div style="font-size:55px">
                ${escapeHtml(
                    message.content || "🏷️"
                )}
            </div>
        `;
    }

    if (type === "voice") {

        return `
            <audio
                controls
                preload="metadata"
            >
                <source
                    src="${escapeAttribute(
                        message.content || ""
                    )}"
                >
            </audio>
        `;
    }

    return escapeHtml(
        message.content || ""
    );
}


/* =========================================================
   ATTACHMENTS
   ========================================================= */

function renderAttachments(message) {

    const attachments =
        message.chat_attachments ||
        [];

    if (!attachments.length) {
        return "";
    }

    return attachments.map(
        attachment => {

            const isImage =
                String(
                    attachment.mime_type || ""
                ).startsWith("image/");

            if (isImage) {

                return `
                    <div class="attachment-card">
                        <a
                            href="${escapeAttribute(
                                attachment.file_url
                            )}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <img
                                class="attachment-image"
                                src="${escapeAttribute(
                                    attachment.file_url
                                )}"
                                alt="${escapeAttribute(
                                    attachment.file_name
                                )}"
                            >
                        </a>
                    </div>
                `;
            }

            return `
                <a
                    class="attachment-card"
                    href="${escapeAttribute(
                        attachment.file_url
                    )}"
                    target="_blank"
                    rel="noopener noreferrer"
                >

                    <span class="attachment-icon">
                        📄
                    </span>

                    <span>

                        <span class="attachment-name">
                            ${escapeHtml(
                                attachment.file_name
                            )}
                        </span>

                        <br>

                        <span class="attachment-size">
                            ${formatBytes(
                                attachment.file_size
                            )}
                        </span>

                    </span>

                </a>
            `;

        }
    ).join("");
}


/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage() {

    const input =
        $("#messageInput");

    const content =
        input.value.trim();

    if (!content) {
        return;
    }

    if (!state.currentChannel) {

        showToast(
            "Select a channel first."
        );

        return;
    }

    const button =
        $("#sendMessageButton");

    button.disabled = true;

    try {

        /*
         * The moderation engine will eventually inspect
         * messages server-side before final publication.
         */

        const moderation =
            await requestModerationCheck(
                content
            );

        if (
            moderation?.blocked
        ) {

            showToast(
                moderation.reason ||
                "This message cannot be posted."
            );

            return;
        }

        const {
            data,
            error
        } = await state.supabase
            .from("chat_messages")
            .insert({

                channel_id:
                    state.currentChannel.id,

                user_id:
                    state.user.id,

                content,

                message_type:
                    "text"

            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        input.value = "";

        autoResizeTextarea(input);

        /*
         * Realtime normally renders the message.
         * If realtime is delayed, insert locally.
         */

        if (
            data &&
            !state.messages.some(
                message =>
                    message.id === data.id
            )
        ) {

            state.messages.push(data);

            renderMessages();
        }

    } catch (error) {

        console.error(
            "Send message failed:",
            error
        );

        showToast(
            "Unable to send message."
        );

    } finally {

        button.disabled = false;

        input.focus();
    }
}


/* =========================================================
   MODERATION HOOK
   ========================================================= */

async function requestModerationCheck(content) {

    /*
     * IMPORTANT:
     *
     * Real automated moderation must happen server-side.
     * This client-side hook intentionally does not pretend
     * that a browser is a secure moderation authority.
     *
     * The future Supabase Edge Function can be connected here.
     */

    const text =
        String(content || "")
            .toLowerCase();

    const obviousPromotionPatterns = [
        "buy my",
        "subscribe to my",
        "follow my page",
        "join my channel",
        "dm me for customers",
        "advertise my",
        "promote my business"
    ];

    const looksLikePromotion =
        obviousPromotionPatterns.some(
            phrase =>
                text.includes(phrase)
        );

    if (looksLikePromotion) {

        return {

            blocked: true,

            reason:
                "This message appears to contain unsolicited self-promotion. Please use the appropriate approved channel if advertising is permitted."

        };
    }

    return {
        blocked: false
    };
}


/* =========================================================
   DELETE MESSAGE
   ========================================================= */

async function deleteMessage(messageId) {

    const message =
        state.messages.find(
            item =>
                item.id === messageId
        );

    if (!message) {
        return;
    }

    if (
        String(message.user_id) !==
        String(state.user.id)
    ) {

        showToast(
            "You can only delete your own messages."
        );

        return;
    }

    if (
        !confirm(
            "Delete this message?"
        )
    ) {
        return;
    }

    try {

        const {
            error
        } = await state.supabase
            .from("chat_messages")
            .update({

                is_deleted: true,

                deleted_at:
                    new Date().toISOString(),

                updated_at:
                    new Date().toISOString()

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
            throw error;
        }

        const local =
            state.messages.find(
                item =>
                    item.id === messageId
            );

        if (local) {
            local.is_deleted = true;
        }

        renderMessages();

    } catch (error) {

        console.error(
            "Delete failed:",
            error
        );

        showToast(
            "Unable to delete message."
        );
    }
}


/* =========================================================
   EDIT MESSAGE
   ========================================================= */

async function editMessage(messageId) {

    const message =
        state.messages.find(
            item =>
                item.id === messageId
        );

    if (!message) {
        return;
    }

    const updated =
        prompt(
            "Edit your message:",
            message.content || ""
        );

    if (
        updated === null ||
        !updated.trim()
    ) {
        return;
    }

    try {

        const {
            error
        } = await state.supabase
            .from("chat_messages")
            .update({

                content:
                    updated.trim(),

                is_edited: true,

                edited_at:
                    new Date().toISOString(),

                updated_at:
                    new Date().toISOString()

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
            throw error;
        }

        message.content =
            updated.trim();

        message.is_edited = true;

        renderMessages();

    } catch (error) {

        console.error(
            "Edit failed:",
            error
        );

        showToast(
            "Unable to edit message."
        );
    }
}


/* =========================================================
   REACTIONS
   ========================================================= */

async function reactToMessage(
    messageId,
    reaction
) {

    try {

        const {
            data: existing,
            error: findError
        } = await state.supabase
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

        if (findError) {
            throw findError;
        }

        if (existing) {

            const {
                error
            } = await state.supabase
                .from("chat_message_reactions")
                .delete()
                .eq(
                    "id",
                    existing.id
                );

            if (error) {
                throw error;
            }

        } else {

            const {
                error
            } = await state.supabase
                .from("chat_message_reactions")
                .insert({

                    message_id:
                        messageId,

                    user_id:
                        state.user.id,

                    reaction

                });

            if (error) {
                throw error;
            }
        }

        showToast(
            "Reaction updated."
        );

    } catch (error) {

        console.error(
            "Reaction error:",
            error
        );

        showToast(
            "Unable to update reaction."
        );
    }
}


/* =========================================================
   FILE UPLOAD
   ========================================================= */

async function uploadSelectedFiles() {

    if (
        !state.selectedFiles.length ||
        !state.currentChannel
    ) {
        return;
    }

    const files =
        [...state.selectedFiles];

    state.selectedFiles = [];

    $("#attachmentPreview")
        .classList.add("hidden");

    for (const file of files) {

        try {

            await uploadFile(file);

        } catch (error) {

            console.error(
                "Upload failed:",
                error
            );

            showToast(
                `Unable to upload ${file.name}`
            );
        }
    }
}


async function uploadFile(file) {

    if (
        file.size >
        MAX_FILE_SIZE
    ) {

        throw new Error(
            "File exceeds the 50 MB limit."
        );
    }

    const safeName =
        file.name.replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
        );

    const path =
        `${state.user.id}/${Date.now()}_${crypto.randomUUID()}_${safeName}`;

    const {
        error: uploadError
    } = await state.supabase
        .storage
        .from(STORAGE_BUCKET)
        .upload(
            path,
            file,
            {
                upsert: false
            }
        );

    if (uploadError) {
        throw uploadError;
    }

    const {
        data: publicData
    } = state.supabase
        .storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);

    const fileUrl =
        publicData.publicUrl;

    const {
        data: message,
        error: messageError
    } = await state.supabase
        .from("chat_messages")
        .insert({

            channel_id:
                state.currentChannel.id,

            user_id:
                state.user.id,

            content:
                file.name,

            message_type:
                "attachment"

        })
        .select()
        .single();

    if (messageError) {
        throw messageError;
    }

    const {
        error: attachmentError
    } = await state.supabase
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
                file.type || "application/octet-stream",

            file_size:
                file.size

        });

    if (attachmentError) {
        throw attachmentError;
    }

    showToast(
        `${file.name} uploaded.`
    );
}


/* =========================================================
   MEMBERS
   ========================================================= */

async function loadMembers() {

    const {
        data,
        error
    } = await state.supabase
        .from("chat_community_members")
        .select(`
            *,
            profile:user_id(*)
        `)
        .eq(
            "community_id",
            state.currentCommunity.id
        );

    if (error) {

        console.warn(
            "Member profile join unavailable:",
            error
        );

        await loadMembersFallback();

        return;
    }

    state.members =
        data || [];

    renderMembers();
}


async function loadMembersFallback() {

    const {
        data,
        error
    } = await state.supabase
        .from("chat_community_members")
        .select("*")
        .eq(
            "community_id",
            state.currentCommunity.id
        );

    if (error) {

        console.error(
            "Members failed:",
            error
        );

        return;
    }

    state.members =
        data || [];

    renderMembers();
}


function renderMembers() {

    const container =
        $("#memberList");

    container.innerHTML = "";

    $("#memberCount")
        .textContent =
        state.members.length;

    state.members.forEach(
        member => {

            const profile =
                member.profile
                    ? normalizeProfile(
                        member.profile
                    )
                    : {

                        id:
                            member.user_id,

                        name:
                            member.nickname ||
                            "Member",

                        avatar:
                            "",

                        role:
                            member.role ||
                            "Student",

                        status:
                            member.status ||
                            "offline"

                    };

            const row =
                document.createElement("button");

            row.type = "button";

            row.className =
                "member-item";

            row.innerHTML = `

                <span class="member-avatar-wrap">

                    <span class="avatar avatar-small">

                        ${
                            profile.avatar
                                ? `<img
                                    src="${escapeAttribute(profile.avatar)}"
                                    alt="${escapeAttribute(profile.name)}"
                                >`
                                : escapeHtml(
                                    getInitials(
                                        profile.name
                                    )
                                )
                        }

                    </span>

                    <span
                        class="member-status ${statusClass(profile.status)}"
                    ></span>

                </span>


                <span class="member-details">

                    <span class="member-name">

                        ${
                            getMemberBadge(
                                member
                            )
                                ? `${escapeHtml(
                                    getMemberBadge(
                                        member
                                    )
                                )} `
                                : ""
                        }

                        ${escapeHtml(
                            profile.name
                        )}

                    </span>

                    <span class="member-status-text">

                        ${escapeHtml(
                            statusLabel(
                                profile.status
                            )
                        )}

                    </span>

                </span>

            `;

            row.addEventListener(
                "click",
                () => openMemberProfile(
                    profile,
                    member
                )
            );

            container.appendChild(row);
        }
    );
}


/* =========================================================
   PRESENCE
   ========================================================= */

function startPresence() {

    if (!state.supabase || !state.user) {
        return;
    }

    updateOwnPresence(
        "online"
    );

    const channel =
        state.supabase.channel(
            `presence:${state.user.id}`
        );

    channel
        .on(
            "presence",
            {
                event: "sync"
            },
            () => {}
        )
        .subscribe(
            async status => {

                if (
                    status === "SUBSCRIBED"
                ) {

                    await channel.track({

                        user_id:
                            state.user.id,

                        status:
                            "online",

                        last_seen:
                            new Date().toISOString()

                    });
                }
            }
        );

    state.presenceSubscription =
        channel;

    let idleTimer;

    const markActive =
        () => {

            clearTimeout(
                idleTimer
            );

            updateOwnPresence(
                "online"
            );

            idleTimer =
                setTimeout(
                    () => {

                        updateOwnPresence(
                            "idle"
                        );

                    },
                    5 * 60 * 1000
                );
        };

    [
        "mousemove",
        "keydown",
        "click",
        "scroll",
        "touchstart"
    ].forEach(
        event =>
            window.addEventListener(
                event,
                markActive,
                {
                    passive: true
                }
            )
    );

    window.addEventListener(
        "beforeunload",
        () => {

            updateOwnPresence(
                "offline"
            );
        }
    );

    markActive();
}


async function updateOwnPresence(status) {

    if (!state.user) {
        return;
    }

    try {

        await state.supabase
            .from("chat_presence")
            .upsert({

                user_id:
                    state.user.id,

                status,

                last_seen:
                    new Date().toISOString()

            }, {
                onConflict:
                    "user_id"
            });

        updatePresenceDot(
            $("#headerPresenceDot"),
            status
        );

    } catch (error) {

        console.warn(
            "Presence update failed:",
            error
        );
    }
}


function statusClass(status) {

    const value =
        String(status || "")
            .toLowerCase();

    if (
        value === "online"
    ) {
        return "online";
    }

    if (
        value === "idle" ||
        value === "away"
    ) {
        return "idle";
    }

    return "offline";
}


function statusLabel(status) {

    const value =
        statusClass(status);

    if (value === "online") {
        return "Online";
    }

    if (value === "idle") {
        return "Idle";
    }

    return "Offline";
}


function updatePresenceDot(
    element,
    status
) {

    if (!element) {
        return;
    }

    element.classList.remove(
        "online",
        "idle",
        "offline"
    );

    element.classList.add(
        statusClass(status)
    );
}


/* =========================================================
   REALTIME
   ========================================================= */

function setupRealtime() {

    console.log(
        "📡 Community realtime ready"
    );
}


function subscribeToCommunityRealtime() {

    if (
        state.messageSubscription
    ) {

        state.supabase.removeChannel(
            state.messageSubscription
        );
    }

    if (
        state.reactionSubscription
    ) {

        state.supabase.removeChannel(
            state.reactionSubscription
        );
    }

    if (!state.currentCommunity) {
        return;
    }

    state.messageSubscription =
        state.supabase
            .channel(
                `community-messages-${state.currentCommunity.id}`
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_messages"
                },
                payload => {

                    handleMessageRealtime(
                        payload
                    );
                }
            )
            .subscribe();

    state.reactionSubscription =
        state.supabase
            .channel(
                `community-reactions-${state.currentCommunity.id}`
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table:
                        "chat_message_reactions"
                },
                () => {

                    if (
                        state.currentChannel
                    ) {

                        loadMessages();
                    }
                }
            )
            .subscribe();
}


function handleMessageRealtime(payload) {

    const message =
        payload.new ||
        payload.old;

    if (!message) {
        return;
    }

    if (
        state.currentChannel &&
        String(message.channel_id) ===
        String(
            state.currentChannel.id
        )
    ) {

        if (
            payload.eventType ===
            "INSERT"
        ) {

            if (
                !state.messages.some(
                    item =>
                        item.id ===
                        message.id
                )
            ) {

                state.messages.push(
                    message
                );

                renderMessages();
            }

        } else if (
            payload.eventType ===
            "UPDATE"
        ) {

            const index =
                state.messages.findIndex(
                    item =>
                        item.id ===
                        message.id
                );

            if (index >= 0) {

                state.messages[index] =
                    {
                        ...state.messages[index],
                        ...message
                    };

                renderMessages();
            }

        }
    }
}


/* =========================================================
   EMOJI
   ========================================================= */

function renderEmojiPicker() {

    const categories =
        $("#emojiCategories");

    const grid =
        $("#emojiGrid");

    if (!categories || !grid) {
        return;
    }

    categories.innerHTML = "";

    Object.keys(
        EMOJI_DATA
    ).forEach(
        category => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "emoji-category";

            button.textContent =
                category === "Smileys"
                    ? "😀"
                    : category === "People"
                        ? "👋"
                        : category === "Animals"
                            ? "🐶"
                            : category === "Food"
                                ? "🍔"
                                : category === "Activities"
                                    ? "⚽"
                                    : category === "Objects"
                                        ? "💡"
                                        : category === "Symbols"
                                            ? "❤️"
                                            : "🇰🇪";

            button.title =
                category;

            button.addEventListener(
                "click",
                () => {

                    state.emojiCategory =
                        category;

                    renderEmojiGrid();
                }
            );

            categories.appendChild(
                button
            );
        }
    );

    renderEmojiGrid();
}


function renderEmojiGrid(
    filter = ""
) {

    const grid =
        $("#emojiGrid");

    if (!grid) {
        return;
    }

    const emojis =
        EMOJI_DATA[
            state.emojiCategory
        ] || [];

    const filtered =
        emojis.filter(
            emoji =>
                !filter ||
                emoji.includes(filter)
        );

    grid.innerHTML = "";

    filtered.forEach(
        emoji => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "emoji-item";

            button.textContent =
                emoji;

            button.addEventListener(
                "click",
                () => {

                    insertTextAtCursor(
                        $("#messageInput"),
                        emoji
                    );

                    closePicker(
                        "emojiPanel"
                    );
                }
            );

            grid.appendChild(
                button
            );
        }
    );
}


/* =========================================================
   STICKERS
   ========================================================= */

function renderStickerPicker() {

    const grid =
        $("#stickerGrid");

    if (!grid) {
        return;
    }

    grid.innerHTML = "";

    STICKERS.forEach(
        sticker => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "sticker-item";

            button.textContent =
                sticker;

            button.addEventListener(
                "click",
                async () => {

                    await sendSpecialMessage(
                        "sticker",
                        sticker
                    );

                    closePicker(
                        "stickerPanel"
                    );
                }
            );

            grid.appendChild(
                button
            );
        }
    );
}


async function sendSpecialMessage(
    type,
    content
) {

    if (!state.currentChannel) {
        return;
    }

    const {
        error
    } = await state.supabase
        .from("chat_messages")
        .insert({

            channel_id:
                state.currentChannel.id,

            user_id:
                state.user.id,

            content,

            message_type:
                type

        });

    if (error) {

        console.error(
            "Special message failed:",
            error
        );

        showToast(
            "Unable to send."
        );
    }
}


/* =========================================================
   FILE PREVIEW
   ========================================================= */

function showFilePreview(files) {

    state.selectedFiles =
        [...files];

    const container =
        $("#attachmentPreview");

    container.innerHTML =
        state.selectedFiles
            .map(
                file => `
                    <div>
                        📎 ${escapeHtml(
                            file.name
                        )}
                    </div>
                `
            )
            .join("");

    container.classList.remove(
        "hidden"
    );

    $("#filePreviewContent")
        .innerHTML =
        state.selectedFiles
            .map(
                file => `
                    <p>
                        <strong>
                            ${escapeHtml(
                                file.name
                            )}
                        </strong>
                        <br>
                        ${formatBytes(
                            file.size
                        )}
                    </p>
                `
            )
            .join("");

    openModal(
        "filePreviewModal"
    );
}


/* =========================================================
   PROFILE
   ========================================================= */

function openMemberProfile(
    profile,
    member
) {

    const modal =
        $("#profileModalContent");

    modal.innerHTML = `

        <div class="avatar" style="
            width:90px;
            height:90px;
            margin:20px auto 12px;
            font-size:28px;
        ">

            ${
                profile.avatar
                    ? `<img
                        src="${escapeAttribute(profile.avatar)}"
                        alt="${escapeAttribute(profile.name)}"
                    >`
                    : escapeHtml(
                        getInitials(
                            profile.name
                        )
                    )
            }

        </div>

        <div style="
            text-align:center;
            padding:0 20px 20px;
        ">

            <h2 style="margin:0">
                ${escapeHtml(
                    profile.name
                )}
            </h2>

            <p style="
                color:var(--muted);
                margin:5px 0;
            ">
                ${escapeHtml(
                    profile.role ||
                    "Student"
                )}
            </p>

            <p>
                <span class="member-badge">
                    ${escapeHtml(
                        getMemberBadge(
                            member
                        ) ||
                        "Member"
                    )}
                </span>
            </p>

            <p style="
                color:var(--muted);
                font-size:12px;
            ">
                ${escapeHtml(
                    statusLabel(
                        profile.status
                    )
                )}
            </p>

            ${
                String(profile.id) !==
                String(state.user.id)
                    ? `
                    <div style="
                        display:flex;
                        justify-content:center;
                        gap:7px;
                        flex-wrap:wrap;
                        margin-top:15px;
                    ">

                        <button
                            class="primary-button"
                            type="button"
                            id="profileAddFriendButton"
                        >
                            👥 Add Friend
                        </button>

                        <button
                            class="secondary-button"
                            type="button"
                            id="profileMessageButton"
                        >
                            💬 Message
                        </button>

                        <button
                            class="secondary-button"
                            type="button"
                            id="profileCallButton"
                        >
                            📞 Call
                        </button>

                    </div>
                    `
                    : ""
            }

        </div>
    `;

    openModal(
        "profileModal"
    );

    $("#profileAddFriendButton")
        ?.addEventListener(
            "click",
            () => {

                sendFriendRequest(
                    profile.id
                );
            }
        );

    $("#profileMessageButton")
        ?.addEventListener(
            "click",
            () => {

                showToast(
                    "Private messaging module is ready for the friend system."
                );
            }
        );

    $("#profileCallButton")
        ?.addEventListener(
            "click",
            () => {

                window.dispatchEvent(
                    new CustomEvent(
                        "mwaniki:person-call",
                        {
                            detail: {
                                targetUserId:
                                    profile.id,

                                targetName:
                                    profile.name,

                                mode:
                                    "voice"
                            }
                        }
                    )
                );

                closeModal(
                    "profileModal"
                );
            }
        );
}


/* =========================================================
   FRIEND REQUESTS
   ========================================================= */

async function sendFriendRequest(
    targetUserId
) {

    if (
        !targetUserId ||
        String(targetUserId) ===
        String(state.user.id)
    ) {
        return;
    }

    /*
     * This table will be added in the
     * matching Supabase migration.
     */

    try {

        const {
            error
        } = await state.supabase
            .from("friend_requests")
            .insert({

                sender_id:
                    state.user.id,

                receiver_id:
                    targetUserId,

                status:
                    "pending"

            });

        if (error) {
            throw error;
        }

        showToast(
            "Friend request sent."
        );

    } catch (error) {

        console.error(
            "Friend request failed:",
            error
        );

        showToast(
            "Unable to send friend request."
        );
    }
}


/* =========================================================
   TICKETS
   ========================================================= */

async function submitTicket(
    event
) {

    event.preventDefault();

    const type =
        $("#ticketType").value;

    const subject =
        $("#ticketSubject").value.trim();

    const description =
        $("#ticketDescription")
            .value.trim();

    if (
        !type ||
        !subject ||
        !description
    ) {
        return;
    }

    try {

        const {
            error
        } = await state.supabase
            .from("community_tickets")
            .insert({

                user_id:
                    state.user.id,

                community_id:
                    state.currentCommunity?.id ||
                    null,

                type,

                subject,

                description,

                status:
                    "open"

            });

        if (error) {
            throw error;
        }

        $("#ticketForm").reset();

        closeModal(
            "ticketModal"
        );

        showToast(
            "Your ticket has been submitted."
        );

    } catch (error) {

        console.error(
            "Ticket error:",
            error
        );

        showToast(
            "Unable to submit ticket."
        );
    }
}


/* =========================================================
   EVENTS
   ========================================================= */

function setupStaticEvents() {

    $("#sendMessageButton")
        .addEventListener(
            "click",
            sendMessage
        );

    $("#messageInput")
        .addEventListener(
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

    $("#messageInput")
        .addEventListener(
            "input",
            event =>
                autoResizeTextarea(
                    event.target
                )
        );


    $("#attachButton")
        .addEventListener(
            "click",
            () =>
                $("#attachmentInput")
                    .click()
        );


    $("#attachmentInput")
        .addEventListener(
            "change",
            event => {

                if (
                    event.target.files?.length
                ) {

                    showFilePreview(
                        event.target.files
                    );
                }

                event.target.value = "";
            }
        );


    $("#confirmAttachmentButton")
        .addEventListener(
            "click",
            async () => {

                closeModal(
                    "filePreviewModal"
                );

                await uploadSelectedFiles();
            }
        );


    $("#emojiButton")
        .addEventListener(
            "click",
            () =>
                togglePicker(
                    "emojiPanel"
                )
        );


    $("#stickerButton")
        .addEventListener(
            "click",
            () =>
                togglePicker(
                    "stickerPanel"
                )
        );


    $("#gifButton")
        .addEventListener(
            "click",
            () =>
                togglePicker(
                    "gifPanel"
                )
        );


    $("#emojiSearch")
        .addEventListener(
            "input",
            event =>
                renderEmojiGrid(
                    event.target.value
                )
        );


    $("#voiceNoteButton")
        .addEventListener(
            "click",
            startVoiceNote
        );


    $("#ticketButton")
        .addEventListener(
            "click",
            () =>
                openModal(
                    "ticketModal"
                )
        );


    $("#communityRulesButton")
        .addEventListener(
            "click",
            () =>
                openModal(
                    "rulesModal"
                )
        );


    $("#friendsButton")
        .addEventListener(
            "click",
            openFriends
        );


    $("#profileButton")
        .addEventListener(
            "click",
            () =>
                openMemberProfile(
                    state.profile,
                    {}
                )
        );


    $("#generalCallButton")
        .addEventListener(
            "click",
            () =>
                openModal(
                    "callModal"
                )
        );


    $("#communityCallButton")
        .addEventListener(
            "click",
            () => {

                window.dispatchEvent(
                    new CustomEvent(
                        "mwaniki:community-call",
                        {
                            detail: {
                                communityId:
                                    state.currentCommunity?.id,

                                communityName:
                                    state.currentCommunity?.name,

                                mode:
                                    "voice"
                            }
                        }
                    )
                );
            }
        );


    $("#callSpecificPersonButton")
        .addEventListener(
            "click",
            () => {

                closeModal(
                    "callModal"
                );

                showToast(
                    "Select a member from the member list to start a person-to-person call."
                );
            }
        );


    $("#callWholeCommunityButton")
        .addEventListener(
            "click",
            () => {

                closeModal(
                    "callModal"
                );

                $("#communityCallButton")
                    .click();
            }
        );


    $("#ticketForm")
        .addEventListener(
            "submit",
            submitTicket
        );


    document.addEventListener(
        "click",
        handleDocumentClick
    );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                closeAllPickers();

                $$(".modal:not(.hidden)")
                    .forEach(
                        modal =>
                            closeModal(
                                modal.id
                            )
                    );
            }
        }
    );


    $("#mobileSidebarButton")
        ?.addEventListener(
            "click",
            () =>
                $("#channelSidebar")
                    .classList.toggle(
                        "open"
                    )
        );


    $$(".modal")
        .forEach(
            modal => {

                modal.addEventListener(
                    "click",
                    event => {

                        if (
                            event.target ===
                            modal
                        ) {

                            closeModal(
                                modal.id
                            );
                        }
                    }
                );
            }
        );


    window.addEventListener(
        "mwaniki:open-ticket",
        () =>
            openModal(
                "ticketModal"
            )
    );
}


/* =========================================================
   DOCUMENT CLICK
   ========================================================= */

function handleDocumentClick(event) {

    const messageAction =
        event.target.closest(
            "[data-message-action]"
        );

    if (messageAction) {

        const message =
            messageAction.closest(
                ".message"
            );

        if (!message) {
            return;
        }

        const messageId =
            message.dataset.messageId;

        const action =
            messageAction.dataset
                .messageAction;

        if (action === "delete") {

            deleteMessage(
                messageId
            );

        } else if (
            action === "edit"
        ) {

            editMessage(
                messageId
            );

        } else if (
            action === "react"
        ) {

            togglePicker(
                "emojiPanel"
            );
        }

        return;
    }


    const reaction =
        event.target.closest(
            ".quick-reaction"
        );

    if (reaction) {

        reactToMessage(
            reaction.dataset.messageId,
            reaction.dataset.reaction
        );

        return;
    }


    const closePickerButton =
        event.target.closest(
            "[data-close-picker]"
        );

    if (closePickerButton) {

        closePicker(
            closePickerButton
                .dataset
                .closePicker
        );

        return;
    }


    const closeModalButton =
        event.target.closest(
            "[data-close-modal]"
        );

    if (closeModalButton) {

        closeModal(
            closeModalButton
                .dataset
                .closeModal
        );
    }
}


/* =========================================================
   VOICE NOTES
   ========================================================= */

async function startVoiceNote() {

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        showToast(
            "Voice recording is not supported by this browser."
        );

        return;
    }

    let stream;

    try {

        stream =
            await navigator.mediaDevices
                .getUserMedia({
                    audio: true
                });

    } catch (error) {

        showToast(
            "Microphone permission was not granted."
        );

        return;
    }

    const recorder =
        new MediaRecorder(
            stream
        );

    const chunks = [];

    recorder.ondataavailable =
        event => {

            if (
                event.data.size
            ) {

                chunks.push(
                    event.data
                );
            }
        };

    recorder.onstop =
        async () => {

            stream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

            const blob =
                new Blob(
                    chunks,
                    {
                        type:
                            recorder.mimeType ||
                            "audio/webm"
                    }
                );

            const file =
                new File(
                    [
                        blob
                    ],
                    `voice_${Date.now()}.webm`,
                    {
                        type:
                            blob.type
                    }
                );

            try {

                await uploadVoiceNote(
                    file
                );

            } catch (error) {

                console.error(
                    error
                );

                showToast(
                    "Unable to send voice note."
                );
            }
        };

    recorder.start();

    showToast(
        "Recording... click Voice again to stop."
    );

    const button =
        $("#voiceNoteButton");

    const original =
        button.textContent;

    button.textContent =
        "⏹️";

    const stopHandler =
        () => {

            if (
                recorder.state !==
                "inactive"
            ) {

                recorder.stop();
            }

            button.textContent =
                original;

            button.removeEventListener(
                "click",
                stopHandler
            );
        };

    button.removeEventListener(
        "click",
        startVoiceNote
    );

    button.addEventListener(
        "click",
        stopHandler,
        {
            once: true
        }
    );
}


async function uploadVoiceNote(file) {

    if (!state.currentChannel) {
        return;
    }

    const path =
        `${state.user.id}/voice_${Date.now()}_${crypto.randomUUID()}.webm`;

    const {
        error
    } = await state.supabase
        .storage
        .from(STORAGE_BUCKET)
        .upload(
            path,
            file,
            {
                contentType:
                    "audio/webm"
            }
        );

    if (error) {
        throw error;
    }

    const {
        data
    } = state.supabase
        .storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);

    const {
        error: messageError
    } = await state.supabase
        .from("chat_messages")
        .insert({

            channel_id:
                state.currentChannel.id,

            user_id:
                state.user.id,

            content:
                data.publicUrl,

            message_type:
                "voice"

        });

    if (messageError) {
        throw messageError;
    }

    showToast(
        "Voice note sent."
    );
}


/* =========================================================
   FRIEND UI
   ========================================================= */

async function openFriends() {

    openModal(
        "friendsModal"
    );

    await loadFriends();
}


async function loadFriends() {

    const container =
        $("#friendsContent");

    container.innerHTML = `
        <div class="empty-state">
            Loading friends...
        </div>
    `;

    try {

        const {
            data,
            error
        } = await state.supabase
            .from("friend_requests")
            .select("*")
            .or(
                `sender_id.eq.${state.user.id},receiver_id.eq.${state.user.id}`
            )
            .eq(
                "status",
                "accepted"
            );

        if (error) {
            throw error;
        }

        if (!data?.length) {

            container.innerHTML = `
                <div class="empty-state">
                    You do not have any friends yet.
                </div>
            `;

            return;
        }

        container.innerHTML =
            data.map(
                item => {

                    const friendId =
                        String(
                            item.sender_id
                        ) ===
                        String(
                            state.user.id
                        )
                            ? item.receiver_id
                            : item.sender_id;

                    return `
                        <div class="friend-row">

                            <div class="avatar avatar-small">
                                👤
                            </div>

                            <div class="friend-row-info">

                                <div class="friend-row-name">
                                    Friend
                                </div>

                            </div>

                            <div class="friend-row-actions">

                                <button
                                    class="small-button"
                                    type="button"
                                    data-friend-message="${escapeAttribute(friendId)}"
                                >
                                    💬
                                </button>

                                <button
                                    class="small-button"
                                    type="button"
                                    data-friend-call="${escapeAttribute(friendId)}"
                                >
                                    📞
                                </button>

                            </div>

                        </div>
                    `;
                }
            ).join("");

    } catch (error) {

        console.error(
            error
        );

        container.innerHTML = `
            <div class="empty-state">
                Friend system is not configured yet.
            </div>
        `;
    }
}


/* =========================================================
   MODALS / PICKERS
   ========================================================= */

function openModal(id) {

    const modal =
        document.getElementById(id);

    if (modal) {
        modal.classList.remove(
            "hidden"
        );
    }
}


function closeModal(id) {

    const modal =
        document.getElementById(id);

    if (modal) {
        modal.classList.add(
            "hidden"
        );
    }
}


function togglePicker(id) {

    const picker =
        document.getElementById(id);

    if (!picker) {
        return;
    }

    const wasHidden =
        picker.classList.contains(
            "hidden"
        );

    closeAllPickers();

    if (wasHidden) {
        picker.classList.remove(
            "hidden"
        );
    }
}


function closePicker(id) {

    document
        .getElementById(id)
        ?.classList
        .add("hidden");
}


function closeAllPickers() {

    [
        "emojiPanel",
        "stickerPanel",
        "gifPanel"
    ].forEach(
        closePicker
    );
}


/* =========================================================
   TEXTAREA
   ========================================================= */

function autoResizeTextarea(
    textarea
) {

    textarea.style.height =
        "auto";

    textarea.style.height =
        `${Math.min(
            textarea.scrollHeight,
            130
        )}px`;
}


function insertTextAtCursor(
    textarea,
    text
) {

    const start =
        textarea.selectionStart;

    const end =
        textarea.selectionEnd;

    textarea.value =
        textarea.value.slice(
            0,
            start
        ) +
        text +
        textarea.value.slice(
            end
        );

    textarea.focus();

    textarea.selectionStart =
        textarea.selectionEnd =
            start + text.length;

    autoResizeTextarea(
        textarea
    );
}


/* =========================================================
   UTILITIES
   ========================================================= */

function scrollMessagesToBottom() {

    const container =
        $("#messageList");

    requestAnimationFrame(
        () => {

            container.scrollTop =
                container.scrollHeight;
        }
    );
}


function formatTime(value) {

    if (!value) {
        return "";
    }

    const date =
        new Date(value);

    return date.toLocaleTimeString(
        [],
        {
            hour: "numeric",
            minute: "2-digit"
        }
    );
}


function formatBytes(bytes) {

    if (!bytes) {
        return "0 B";
    }

    const units =
        [
            "B",
            "KB",
            "MB",
            "GB"
        ];

    const index =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );

    return `${(
        bytes /
        Math.pow(
            1024,
            index
        )
    ).toFixed(1)} ${units[index]}`;
}


function getInitials(name) {

    return String(name || "M")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(
            word =>
                word
                    .charAt(0)
                    .toUpperCase()
        )
        .join("") ||
        "M";
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


function showToast(message) {

    const toast =
        $("#toast");

    if (!toast) {
        return;
    }

    toast.textContent =
        message;

    toast.classList.remove(
        "hidden"
    );

    clearTimeout(
        showToast.timer
    );

    showToast.timer =
        setTimeout(
            () => {

                toast.classList.add(
                    "hidden"
                );

            },
            3500
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
        initialize,
        {
            once: true
        }
    );

} else {

    initialize();
}
