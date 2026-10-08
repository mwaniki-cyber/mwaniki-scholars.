/* ============================================================
   MWANIKI SCHOLARS
   COMMUNITY ENGINE
   ============================================================ */

import { supabase } from "./supabase.js";


/* ============================================================
   STATE
   ============================================================ */

const state = {
    user: null,

    profile: null,

    communities: [],
    currentCommunity: null,

    channels: [],
    currentChannel: null,

    members: [],
    presence: new Map(),

    messages: [],

    subscriptions: [],

    selectedCallUsers: new Set(),

    callType: "video",

    replyTo: null,

    pendingFiles: [],

    typingTimer: null,

    typingUsers: new Map(),

    incomingCall: null,

    initialized: false
};


/* ============================================================
   DOM
   ============================================================ */

const $ = (id) =>
    document.getElementById(id);


/* ============================================================
   BASIC HELPERS
   ============================================================ */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function initials(name) {

    const text =
        String(name || "Mwaniki Scholar")
            .trim();

    const parts =
        text.split(/\s+/);

    if (parts.length === 1) {
        return parts[0]
            .slice(0, 2)
            .toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
}


function userName(user) {

    if (!user) {
        return "Mwaniki Scholar";
    }

    return (
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.user_metadata?.display_name ||
        user.email?.split("@")[0] ||
        "Mwaniki Scholar"
    );
}


function profileName(profile) {

    return (
        profile?.full_name ||
        profile?.name ||
        profile?.display_name ||
        "Mwaniki Scholar"
    );
}


function profileAvatar(profile) {

    return (
        profile?.avatar_url ||
        profile?.photo_url ||
        profile?.image_url ||
        ""
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
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


function showToast(message) {

    const toast =
        $("communityToast");

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
            3000
        );
}


function setText(id, value) {

    const element = $(id);

    if (element) {
        element.textContent =
            value ?? "";
    }
}


/* ============================================================
   AUTH
   ============================================================ */

async function loadCurrentUser() {

    const {
        data,
        error
    } = await supabase.auth.getUser();

    if (error) {
        throw error;
    }

    if (!data?.user) {
        throw new Error(
            "You must be signed in."
        );
    }

    state.user =
        data.user;
}


async function loadProfile() {

    const {
        data
    } = await supabase
        .from("student_profiles")
        .select("*")
        .eq(
            "id",
            state.user.id
        )
        .maybeSingle();

    state.profile =
        data || null;

    const name =
        profileName(state.profile) !==
        "Mwaniki Scholar"
            ? profileName(state.profile)
            : userName(state.user);

    const avatar =
        profileAvatar(
            state.profile
        );

    setText(
        "sidebarProfileName",
        name
    );

    setText(
        "headerProfileAvatar",
        initials(name)
    );

    setText(
        "sidebarProfileAvatar",
        initials(name)
    );

    if (avatar) {

        const header =
            $("headerProfileAvatar");

        const sidebar =
            $("sidebarProfileAvatar");

        if (header) {
            header.style.backgroundImage =
                `url("${avatar}")`;
            header.style.backgroundSize =
                "cover";
            header.style.backgroundPosition =
                "center";
            header.textContent = "";
        }

        if (sidebar) {
            sidebar.style.backgroundImage =
                `url("${avatar}")`;
            sidebar.style.backgroundSize =
                "cover";
            sidebar.style.backgroundPosition =
                "center";
            sidebar.textContent = "";
        }
    }
}


/* ============================================================
   COMMUNITIES
   ============================================================ */

async function loadCommunities() {

    const {
        data,
        error
    } = await supabase
        .from("chat_communities")
        .select("*")
        .order(
            "created_at",
            {
                ascending: true
            }
        );

    if (error) {
        console.error(
            "Communities:",
            error
        );

        state.communities = [];

        return;
    }

    state.communities =
        data || [];

    renderCommunityRail();
    renderCommunityModal();


    const main =
        state.communities.find(
            community =>
                String(
                    community.name ||
                    ""
                ).toLowerCase() ===
                "mwaniki scholars"
        );

    state.currentCommunity =
        main ||
        state.communities[0] ||
        null;
}


function renderCommunityRail() {

    const rail =
        $("communityRail");

    if (!rail) {
        return;
    }

    rail.innerHTML = "";

    state.communities
        .forEach(
            community => {

                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "community-icon";

                button.title =
                    community.name ||
                    "Community";

                button.textContent =
                    initials(
                        community.name
                    );

                if (
                    state.currentCommunity &&
                    community.id ===
                    state.currentCommunity.id
                ) {
                    button.classList.add(
                        "active"
                    );
                }

                button.addEventListener(
                    "click",
                    () => {

                        state.currentCommunity =
                            community;

                        renderCommunityRail();

                        loadChannels();
                    }
                );

                rail.appendChild(
                    button
                );
            }
        );
}


function renderCommunityModal() {

    const list =
        $("communityList");

    if (!list) {
        return;
    }

    list.innerHTML = "";

    state.communities
        .forEach(
            community => {

                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "community-modal-item";

                button.innerHTML = `
                    <div class="avatar avatar-medium">
                        ${escapeHTML(
                            initials(
                                community.name
                            )
                        )}
                    </div>

                    <div>
                        <strong>
                            ${escapeHTML(
                                community.name ||
                                "Community"
                            )}
                        </strong>

                        <span>
                            Community
                        </span>
                    </div>
                `;

                button.addEventListener(
                    "click",
                    () => {

                        state.currentCommunity =
                            community;

                        $("communityModal")
                            ?.classList.add(
                                "hidden"
                            );

                        renderCommunityRail();

                        loadChannels();
                    }
                );

                list.appendChild(
                    button
                );
            }
        );
}


/* ============================================================
   CHANNELS
   ============================================================ */

async function loadChannels() {

    if (!state.currentCommunity) {
        return;
    }

    setText(
        "sidebarCommunityName",
        state.currentCommunity.name
    );

    setText(
        "currentCommunityName",
        state.currentCommunity.name
    );

    const {
        data,
        error
    } = await supabase
        .from("chat_channels")
        .select("*")
        .eq(
            "community_id",
            state.currentCommunity.id
        )
        .order(
            "created_at",
            {
                ascending: true
            }
        );

    if (error) {

        console.error(
            "Channels:",
            error
        );

        showToast(
            "Unable to load community channels."
        );

        state.channels = [];

        renderChannels();

        return;
    }

    state.channels =
        data || [];

    renderChannels();

    if (!state.currentChannel) {

        const general =
            state.channels.find(
                channel =>
                    String(
                        channel.name ||
                        ""
                    ).toLowerCase()
                    === "general"
            );

        state.currentChannel =
            general ||
            state.channels[0] ||
            null;
    }

    if (state.currentChannel) {
        await selectChannel(
            state.currentChannel,
            false
        );
    }
}


function renderChannels() {

    const list =
        $("channelList");

    if (!list) {
        return;
    }

    list.innerHTML = "";

    if (!state.channels.length) {

        list.innerHTML = `
            <div
                style="
                    padding:12px 8px;
                    color:#87949a;
                    font-size:10px;
                "
            >
                No discussion channels found.
            </div>
        `;

        return;
    }

    state.channels.forEach(
        channel => {

            const button =
                document.createElement(
                    "button"
                );

            button.type =
                "button";

            button.className =
                "channel-button";

            if (
                state.currentChannel &&
                channel.id ===
                state.currentChannel.id
            ) {
                button.classList.add(
                    "active"
                );
            }

            button.dataset.channelId =
                channel.id;

            button.innerHTML = `
                <span class="channel-symbol">#</span>
                <span class="channel-name">
                    ${escapeHTML(
                        channel.name ||
                        channel.title ||
                        "Discussion"
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

            list.appendChild(
                button
            );
        }
    );
}


async function selectChannel(
    channel,
    scroll = true
) {

    if (!channel) {
        return;
    }

    state.currentChannel =
        channel;

    state.replyTo =
        null;

    state.messages = [];

    cancelReply();

    renderChannels();

    setText(
        "chatChannelTitle",
        channel.name ||
        channel.title ||
        "Discussion"
    );

    setText(
        "currentChannelName",
        channel.name ||
        channel.title ||
        "Discussion"
    );

    setText(
        "chatChannelDescription",
        channel.description ||
        "Academic discussion and collaboration"
    );

    const input =
        $("messageInput");

    if (input) {

        input.placeholder =
            `Message #${
                channel.name ||
                "discussion"
            }`;
    }

    await loadMembers();

    await loadMessages();

    subscribeCurrentChannel();

    if (scroll) {
        scrollMessagesToBottom();
    }
}


/* ============================================================
   MEMBERS
   ============================================================ */

async function loadMembers() {

    if (!state.currentCommunity) {
        return;
    }

    /*
     * We deliberately query community membership first.
     * This avoids depending on a particular profile foreign key.
     */

    const {
        data: memberships,
        error
    } = await supabase
        .from("chat_community_members")
        .select("*")
        .eq(
            "community_id",
            state.currentCommunity.id
        );

    if (error) {

        console.error(
            "Community members:",
            error
        );

        state.members = [];

        renderMembers();

        return;
    }

    const rows =
        memberships || [];

    const userIds =
        rows
            .map(
                row =>
                    row.user_id
            )
            .filter(Boolean);

    if (!userIds.length) {

        state.members = [];

        renderMembers();

        return;
    }

    const {
        data: profiles
    } = await supabase
        .from("student_profiles")
        .select("*")
        .in(
            "id",
            userIds
        );

    const profileMap =
        new Map(
            (profiles || [])
                .map(
                    profile => [
                        profile.id,
                        profile
                    ]
                )
        );

    state.members =
        rows.map(
            membership => {

                const profile =
                    profileMap.get(
                        membership.user_id
                    );

                return {
                    ...membership,
                    user_id:
                        membership.user_id,
                    profile
                };
            }
        );

    renderMembers();
}


function presenceFor(userId) {

    const presence =
        state.presence.get(
            userId
        );

    if (!presence) {
        return "offline";
    }

    if (
        presence.status ===
        "online"
    ) {
        return "online";
    }

    if (
        presence.status ===
        "away"
    ) {
        return "away";
    }

    return "offline";
}


function renderMembers() {

    const online =
        $("onlineMembers");

    const offline =
        $("offlineMembers");

    if (!online || !offline) {
        return;
    }

    online.innerHTML = "";
    offline.innerHTML = "";

    let onlineCount = 0;
    let offlineCount = 0;

    state.members
        .forEach(
            member => {

                const profile =
                    member.profile;

                const name =
                    profileName(
                        profile
                    );

                const status =
                    presenceFor(
                        member.user_id
                    );

                const row =
                    document.createElement(
                        "div"
                    );

                row.className =
                    "member-row";

                const avatar =
                    profileAvatar(
                        profile
                    );

                row.innerHTML = `
                    <div
                        class="avatar"
                        style="${
                            avatar
                                ? `
                                    background-image:url('${escapeHTML(avatar)}');
                                    background-size:cover;
                                    background-position:center;
                                `
                                : ""
                        }"
                    >
                        ${
                            avatar
                                ? ""
                                : escapeHTML(
                                    initials(name)
                                )
                        }
                    </div>

                    <div class="member-copy">
                        <strong>
                            ${escapeHTML(name)}
                        </strong>

                        <span>
                            ${
                                status === "online"
                                    ? "Online"
                                    : status === "away"
                                        ? "Away"
                                        : "Offline"
                            }
                        </span>
                    </div>

                    <span
                        class="member-presence ${status}"
                    ></span>
                `;

                row.addEventListener(
                    "dblclick",
                    () => {

                        if (
                            member.user_id !==
                            state.user.id
                        ) {
                            openCallPicker(
                                member.user_id
                            );
                        }
                    }
                );

                if (
                    status === "online" ||
                    status === "away"
                ) {

                    online.appendChild(
                        row
                    );

                    onlineCount++;

                } else {

                    offline.appendChild(
                        row
                    );

                    offlineCount++;
                }
            }
        );

    setText(
        "onlineCount",
        onlineCount
    );

    setText(
        "offlineCount",
        offlineCount
    );

    setText(
        "memberCount",
        `${state.members.length} members`
    );
}


/* ============================================================
   PRESENCE
   ============================================================ */

async function setMyPresence(
    status = "online"
) {

    if (!state.user) {
        return;
    }

    const row = {
        user_id:
            state.user.id,

        community_id:
            state.currentCommunity?.id ||
            null,

        status,

        last_seen:
            new Date().toISOString()
    };

    /*
     * chat_presence schemas differ between older deployments.
     * Try update first, then insert if no row exists.
     */

    const {
        data
    } = await supabase
        .from("chat_presence")
        .select("id")
        .eq(
            "user_id",
            state.user.id
        )
        .eq(
            "community_id",
            state.currentCommunity?.id
        )
        .maybeSingle();

    if (data?.id) {

        await supabase
            .from("chat_presence")
            .update(row)
            .eq(
                "id",
                data.id
            );

    } else {

        await supabase
            .from("chat_presence")
            .insert(row);
    }

    updateOwnPresenceUI(status);
}


function updateOwnPresenceUI(
    status
) {

    const dot =
        $("myPresenceDot");

    const text =
        $("myPresenceText");

    if (!dot || !text) {
        return;
    }

    dot.className =
        `presence-dot ${status}`;

    text.textContent =
        status === "online"
            ? "Online"
            : status === "away"
                ? "Away"
                : "Offline";
}


async function loadPresence() {

    if (!state.currentCommunity) {
        return;
    }

    const {
        data
    } = await supabase
        .from("chat_presence")
        .select("*")
        .eq(
            "community_id",
            state.currentCommunity.id
        );

    state.presence.clear();

    (data || [])
        .forEach(
            row => {

                state.presence.set(
                    row.user_id,
                    row
                );
            }
        );

    renderMembers();
}


function subscribePresence() {

    const channel =
        supabase
            .channel(
                `community-presence-${state.currentCommunity?.id || "main"}`
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_presence"
                },
                payload => {

                    const row =
                        payload.new ||
                        payload.old;

                    if (!row) {
                        return;
                    }

                    state.presence.set(
                        row.user_id,
                        row
                    );

                    renderMembers();
                }
            )
            .subscribe();

    state.subscriptions.push(
        channel
    );
}


/* ============================================================
   MESSAGES
   ============================================================ */

async function loadMessages() {

    if (!state.currentChannel) {
        return;
    }

    const list =
        $("messageList");

    if (list) {

        list.innerHTML = `
            <div class="message-loading">
                <div class="loading-spinner"></div>
                <span>Loading messages...</span>
            </div>
        `;
    }

    const {
        data,
        error
    } = await supabase
        .from("chat_messages")
        .select("*")
        .eq(
            "channel_id",
            state.currentChannel.id
        )
        .order(
            "created_at",
            {
                ascending: true
            }
        );

    if (error) {

        console.error(
            "Messages:",
            error
        );

        if (list) {
            list.innerHTML = `
                <div class="message-loading">
                    Unable to load messages.
                </div>
            `;
        }

        return;
    }

    state.messages =
        data || [];

    await enrichMessageUsers();

    renderMessages();
}


async function enrichMessageUsers() {

    const ids =
        [
            ...new Set(
                state.messages
                    .map(
                        message =>
                            message.user_id ||
                            message.sender_id
                    )
                    .filter(Boolean)
            )
        ];

    if (!ids.length) {
        return;
    }

    const {
        data
    } = await supabase
        .from("student_profiles")
        .select("*")
        .in(
            "id",
            ids
        );

    const map =
        new Map(
            (data || [])
                .map(
                    profile => [
                        profile.id,
                        profile
                    ]
                )
        );

    state.messages =
        state.messages.map(
            message => ({
                ...message,
                profile:
                    map.get(
                        message.user_id ||
                        message.sender_id
                    ) || null
            })
        );
}


function messageAuthor(
    message
) {

    if (
        message.user_id ===
        state.user.id
    ) {
        return userName(
            state.user
        );
    }

    return profileName(
        message.profile
    );
}


function messageText(
    message
) {

    return (
        message.content ||
        message.message ||
        message.text ||
        ""
    );
}


function renderMessages() {

    const list =
        $("messageList");

    if (!list) {
        return;
    }

    list.innerHTML = "";

    if (!state.messages.length) {

        list.innerHTML = `
            <div class="message-loading">
                <strong>No messages yet.</strong>
                <span>Start the discussion.</span>
            </div>
        `;

        return;
    }

    state.messages
        .forEach(
            message => {

                list.appendChild(
                    createMessageElement(
                        message
                    )
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

    const author =
        messageAuthor(
            message
        );

    const avatar =
        profileAvatar(
            message.profile
        );

    const text =
        messageText(
            message
        );

    const canDelete =
        message.user_id ===
        state.user.id;

    article.innerHTML = `
        <div
            class="message-avatar"
            ${
                avatar
                    ? `
                        style="
                            background-image:url('${escapeHTML(avatar)}');
                            background-size:cover;
                            background-position:center;
                        "
                    `
                    : ""
            }
        >
            ${
                avatar
                    ? ""
                    : escapeHTML(
                        initials(author)
                    )
            }
        </div>

        <div class="message-main">

            <div class="message-head">

                <span class="message-author">
                    ${escapeHTML(author)}
                </span>

                <span class="message-time">
                    ${escapeHTML(
                        formatTime(
                            message.created_at
                        )
                    )}
                </span>

            </div>

            ${
                message.reply_to
                    ? `
                        <div class="message-reply">
                            <strong>Reply</strong>
                            ${escapeHTML(
                                message.reply_preview ||
                                ""
                            )}
                        </div>
                    `
                    : ""
            }

            ${
                text
                    ? `
                        <div class="message-content">
                            ${escapeHTML(text)}
                        </div>
                    `
                    : ""
            }

            <div
                class="message-attachments"
                data-attachments-for="${escapeHTML(
                    message.id
                )}"
            ></div>

            <div class="message-reactions"></div>

        </div>

        <div class="message-actions">

            <button
                class="message-action reply-message"
                type="button"
                title="Reply"
            >
                ↩
            </button>

            <button
                class="message-action react-message"
                type="button"
                title="React"
            >
                😊
            </button>

            ${
                canDelete
                    ? `
                        <button
                            class="message-action delete delete-message"
                            type="button"
                            title="Delete"
                        >
                            🗑
                        </button>
                    `
                    : ""
            }

        </div>
    `;

    article
        .querySelector(
            ".reply-message"
        )
        ?.addEventListener(
            "click",
            () => {
                startReply(
                    message
                );
            }
        );

    article
        .querySelector(
            ".delete-message"
        )
        ?.addEventListener(
            "click",
            () => {
                deleteMessage(
                    message.id
                );
            }
        );

    article
        .querySelector(
            ".react-message"
        )
        ?.addEventListener(
            "click",
            () => {
                addReaction(
                    message.id
                );
            }
        );

    loadMessageAttachments(
        message.id,
        article
    );

    return article;
}


/* ============================================================
   ATTACHMENTS
   ============================================================ */

async function loadMessageAttachments(
    messageId,
    article
) {

    const container =
        article.querySelector(
            ".message-attachments"
        );

    if (!container) {
        return;
    }

    const {
        data
    } = await supabase
        .from("chat_attachments")
        .select("*")
        .eq(
            "message_id",
            messageId
        )
        .order(
            "created_at",
            {
                ascending: true
            }
        );

    if (!data?.length) {
        return;
    }

    data.forEach(
        attachment => {

            const url =
                attachment.file_url ||
                attachment.public_url ||
                attachment.url;

            if (!url) {
                return;
            }

            const name =
                attachment.file_name ||
                attachment.name ||
                "Attachment";

            const type =
                attachment.mime_type ||
                attachment.file_type ||
                "";

            if (
                type.startsWith(
                    "image/"
                )
            ) {

                const wrapper =
                    document.createElement(
                        "div"
                    );

                wrapper.className =
                    "message-attachment";

                wrapper.innerHTML = `
                    <a
                        href="${escapeHTML(url)}"
                        target="_blank"
                        rel="noopener"
                    >
                        <img
                            class="message-image"
                            src="${escapeHTML(url)}"
                            alt="${escapeHTML(name)}"
                            loading="lazy"
                        >
                    </a>
                `;

                container.appendChild(
                    wrapper
                );

            } else {

                const wrapper =
                    document.createElement(
                        "div"
                    );

                wrapper.className =
                    "message-attachment";

                wrapper.innerHTML = `
                    <a
                        class="message-file"
                        href="${escapeHTML(url)}"
                        target="_blank"
                        rel="noopener"
                    >
                        <span class="message-file-icon">
                            📎
                        </span>

                        <span class="message-file-copy">
                            <strong>
                                ${escapeHTML(name)}
                            </strong>

                            <span>
                                Open attachment
                            </span>
                        </span>
                    </a>
                `;

                container.appendChild(
                    wrapper
                );
            }
        }
    );
}


/* ============================================================
   SEND MESSAGE
   ============================================================ */

async function sendMessage(
    event
) {

    event?.preventDefault();

    const input =
        $("messageInput");

    if (!input ||
        !state.currentChannel) {
        return;
    }

    const content =
        input.value.trim();

    if (
        !content &&
        !state.pendingFiles.length
    ) {
        return;
    }

    const payload = {
        channel_id:
            state.currentChannel.id,

        user_id:
            state.user.id,

        content:
            content || null
    };

    /*
     * Only include reply_to if your table contains the column.
     * We first attempt the modern form and fall back to normal
     * message insertion if the deployment does not have it.
     */

    if (state.replyTo) {
        payload.reply_to =
            state.replyTo.id;
    }

    let {
        data,
        error
    } = await supabase
        .from("chat_messages")
        .insert(payload)
        .select()
        .single();

    if (
        error &&
        state.replyTo
    ) {

        delete payload.reply_to;

        const retry =
            await supabase
                .from("chat_messages")
                .insert(payload)
                .select()
                .single();

        data =
            retry.data;

        error =
            retry.error;
    }

    if (error) {

        console.error(
            "Send message:",
            error
        );

        showToast(
            "Unable to send message."
        );

        return;
    }

    input.value = "";

    resizeComposer();

    cancelReply();

    await uploadPendingFiles(
        data.id
    );

    clearPendingFiles();

    stopTyping();
}


async function uploadPendingFiles(
    messageId
) {

    if (!state.pendingFiles.length) {
        return;
    }

    for (
        const file of state.pendingFiles
    ) {

        try {

            const path =
                `community/${state.user.id}/${Date.now()}-${crypto.randomUUID()}-${file.name}`;

            const upload =
                await supabase
                    .storage
                    .from(
                        "chat-attachments"
                    )
                    .upload(
                        path,
                        file,
                        {
                            upsert: false
                        }
                    );

            if (upload.error) {
                throw upload.error;
            }

            const {
                data: publicData
            } =
                supabase
                    .storage
                    .from(
                        "chat-attachments"
                    )
                    .getPublicUrl(
                        path
                    );

            const fileUrl =
                publicData?.publicUrl;

            const {
                error
            } = await supabase
                .from("chat_attachments")
                .insert({
                    message_id:
                        messageId,

                    file_name:
                        file.name,

                    file_url:
                        fileUrl,

                    file_type:
                        file.type,

                    file_size:
                        file.size,

                    uploaded_by:
                        state.user.id
                });

            if (error) {
                throw error;
            }

        } catch (error) {

            console.error(
                "Attachment upload:",
                error
            );

            showToast(
                `Unable to upload ${file.name}`
            );
        }
    }
}


/* ============================================================
   DELETE MESSAGE
   ============================================================ */

async function deleteMessage(
    messageId
) {

    const message =
        state.messages.find(
            item =>
                item.id ===
                messageId
        );

    if (
        !message ||
        message.user_id !==
        state.user.id
    ) {
        return;
    }

    if (
        !window.confirm(
            "Delete this message?"
        )
    ) {
        return;
    }

    const {
        error
    } = await supabase
        .from("chat_messages")
        .delete()
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
            "Delete message:",
            error
        );

        showToast(
            "Unable to delete message."
        );

        return;
    }

    await loadMessages();
}


/* ============================================================
   REPLY
   ============================================================ */

function startReply(
    message
) {

    state.replyTo =
        message;

    $("replyBar")
        ?.classList.remove(
            "hidden"
        );

    setText(
        "replyPreview",
        messageText(
            message
        ) ||
        "Attachment"
    );

    $("messageInput")
        ?.focus();
}


function cancelReply() {

    state.replyTo =
        null;

    $("replyBar")
        ?.classList.add(
            "hidden"
        );

    setText(
        "replyPreview",
        ""
    );
}


/* ============================================================
   REACTIONS
   ============================================================ */

async function addReaction(
    messageId
) {

    const emoji =
        window.prompt(
            "Enter an emoji to react:"
        );

    if (!emoji) {
        return;
    }

    const {
        error
    } = await supabase
        .from("chat_message_reactions")
        .upsert(
            {
                message_id:
                    messageId,

                user_id:
                    state.user.id,

                reaction:
                    emoji
            },
            {
                onConflict:
                    "message_id,user_id,reaction"
            }
        );

    if (error) {

        console.error(
            "Reaction:",
            error
        );

        showToast(
            "Reaction could not be added."
        );
    }
}


/* ============================================================
   REALTIME MESSAGES
   ============================================================ */

function removeSubscriptions() {

    state.subscriptions
        .forEach(
            channel => {

                try {
                    supabase.removeChannel(
                        channel
                    );
                } catch {
                    /* ignore */
                }
            }
        );

    state.subscriptions = [];
}


function subscribeCurrentChannel() {

    removeSubscriptions();

    if (!state.currentChannel) {
        return;
    }

    const channel =
        supabase
            .channel(
                `community-chat-${state.currentChannel.id}`
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "chat_messages",
                    filter:
                        `channel_id=eq.${state.currentChannel.id}`
                },
                async payload => {

                    if (
                        !state.messages.some(
                            message =>
                                message.id ===
                                payload.new.id
                        )
                    ) {

                        state.messages.push(
                            payload.new
                        );

                        await enrichMessageUsers();

                        renderMessages();
                    }
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table: "chat_messages"
                },
                payload => {

                    const id =
                        payload.old?.id;

                    state.messages =
                        state.messages.filter(
                            message =>
                                message.id !==
                                id
                        );

                    renderMessages();
                }
            )
            .subscribe();

    state.subscriptions.push(
        channel
    );
}


/* ============================================================
   TYPING
   ============================================================ */

function handleTyping() {

    resizeComposer();

    if (!state.currentChannel) {
        return;
    }

    clearTimeout(
        state.typingTimer
    );

    /*
     * We use Broadcast rather than requiring another database
     * table for ephemeral typing state.
     */

    const channel =
        state.subscriptions.find(
            item =>
                item.topic?.includes(
                    `community-chat-${state.currentChannel.id}`
                )
        );

    if (channel) {

        channel.send({
            type: "broadcast",
            event: "typing",
            payload: {
                user_id:
                    state.user.id,

                name:
                    userName(
                        state.user
                    )
            }
        });
    }

    state.typingTimer =
        setTimeout(
            stopTyping,
            1200
        );
}


function stopTyping() {

    clearTimeout(
        state.typingTimer
    );

    const channel =
        state.subscriptions.find(
            item =>
                item.topic?.includes(
                    `community-chat-${state.currentChannel?.id}`
                )
        );

    if (channel) {

        channel.send({
            type: "broadcast",
            event: "typing-stop",
            payload: {
                user_id:
                    state.user.id
            }
        });
    }

    $("typingIndicator")
        ?.classList.add(
            "hidden"
        );
}


/* ============================================================
   FILE PICKER
   ============================================================ */

function handleFiles(
    files
) {

    state.pendingFiles =
        [
            ...state.pendingFiles,
            ...Array.from(files || [])
        ];

    renderAttachmentPreview();
}


function renderAttachmentPreview() {

    const container =
        $("attachmentPreview");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!state.pendingFiles.length) {

        container.classList.add(
            "hidden"
        );

        return;
    }

    container.classList.remove(
        "hidden"
    );

    state.pendingFiles
        .forEach(
            (file, index) => {

                const chip =
                    document.createElement(
                        "div"
                    );

                chip.className =
                    "attachment-chip";

                chip.innerHTML = `
                    <span>
                        📎
                        ${escapeHTML(file.name)}
                    </span>

                    <button
                        type="button"
                        data-index="${index}"
                    >
                        ×
                    </button>
                `;

                chip.querySelector(
                    "button"
                ).addEventListener(
                    "click",
                    () => {

                        state.pendingFiles
                            .splice(
                                index,
                                1
                            );

                        renderAttachmentPreview();
                    }
                );

                container.appendChild(
                    chip
                );
            }
        );
}


function clearPendingFiles() {

    state.pendingFiles =
        [];

    renderAttachmentPreview();

    const input =
        $("fileInput");

    if (input) {
        input.value = "";
    }
}


/* ============================================================
   VOICE NOTES
   ============================================================ */

let mediaRecorder = null;
let recordedChunks = [];


async function toggleVoiceRecording() {

    if (mediaRecorder) {

        mediaRecorder.stop();

        return;
    }

    if (
        !navigator.mediaDevices?.getUserMedia
    ) {

        showToast(
            "Voice recording is not supported by this browser."
        );

        return;
    }

    try {

        const stream =
            await navigator.mediaDevices
                .getUserMedia({
                    audio: true
                });

        recordedChunks = [];

        mediaRecorder =
            new MediaRecorder(
                stream
            );

        mediaRecorder.ondataavailable =
            event => {

                if (
                    event.data.size
                ) {
                    recordedChunks.push(
                        event.data
                    );
                }
            };

        mediaRecorder.onstop =
            async () => {

                stream
                    .getTracks()
                    .forEach(
                        track =>
                            track.stop()
                    );

                const blob =
                    new Blob(
                        recordedChunks,
                        {
                            type:
                                mediaRecorder.mimeType ||
                                "audio/webm"
                        }
                    );

                mediaRecorder = null;

                const file =
                    new File(
                        [
                            blob
                        ],
                        `voice-${Date.now()}.webm`,
                        {
                            type:
                                blob.type
                        }
                    );

                state.pendingFiles.push(
                    file
                );

                renderAttachmentPreview();

                showToast(
                    "Voice note ready. Send the message to upload it."
                );
            };

        mediaRecorder.start();

        showToast(
            "Recording voice note... click the microphone again to stop."
        );

    } catch (error) {

        console.error(
            "Voice recording:",
            error
        );

        showToast(
            "Microphone permission was not available."
        );
    }
}


/* ============================================================
   EMOJI
   ============================================================ */

const emojiCharacters = [
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
    "👋","🤚","🖐️","✋","🖖","👌","🤏","✌️",
    "🤞","🤟","🤘","🤙","👈","👉","👆","👇",
    "👍","👎","👏","🙌","👐","🤝","🙏","💪",
    "❤️","🧡","💛","💚","💙","💜","🖤","🤍",
    "💔","❣️","💕","💞","💓","💗","💖","💘",
    "🔥","⭐","🌟","✨","💯","🎉","🎊","✅",
    "❌","⚕️","🩺","💊","🧬","🔬","🧪","📚",
    "📖","📝","💡","🎓","🏥","🧠","🫀","🫁"
];


function renderEmojiPicker(
    filter = ""
) {

    const grid =
        $("emojiGrid");

    if (!grid) {
        return;
       const query =
        String(filter || "")
            .trim()
            .toLowerCase();

    grid.innerHTML = "";

    const emojis =
        query
            ? emojiCharacters.filter(
                emoji =>
                    emoji
                        .toLowerCase()
                        .includes(query)
            )
            : emojiCharacters;

    if (!emojis.length) {

        grid.innerHTML = `
            <div class="emoji-empty">
                No emoji found.
            </div>
        `;

        return;
    }

    emojis.forEach(
        emoji => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "emoji-item";

            button.textContent =
                emoji;

            button.title =
                `Use ${emoji}`;

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
}


/* ============================================================
   EMOJI INSERTION
   ============================================================ */

function insertEmoji(emoji) {

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
        input.value.slice(0, start) +
        emoji +
        input.value.slice(end);

    const cursor =
        start +
        emoji.length;

    input.focus();

    try {
        input.setSelectionRange(
            cursor,
            cursor
        );
    } catch {
        /* ignore */
    }

    resizeComposer();
}


/* ============================================================
   COMPOSER RESIZE
   ============================================================ */

function resizeComposer() {

    const input =
        $("messageInput");

    if (!input) {
        return;
    }

    input.style.height =
        "auto";

    input.style.height =
        Math.min(
            input.scrollHeight,
            150
        ) + "px";
}


/* ============================================================
   MESSAGE SEARCH
   ============================================================ */

function searchMessages() {

    const input =
        $("messageSearchInput");

    if (!input) {
        return;
    }

    const query =
        input.value
            .trim()
            .toLowerCase();

    const items =
        document.querySelectorAll(
            "#messageList .message"
        );

    items.forEach(
        item => {

            if (!query) {

                item.classList.remove(
                    "search-hidden"
                );

                return;
            }

            const text =
                item.textContent
                    .toLowerCase();

            item.classList.toggle(
                "search-hidden",
                !text.includes(query)
            );
        }
    );
}


/* ============================================================
   SCROLL
   ============================================================ */

function scrollMessagesToBottom() {

    const list =
        $("messageList");

    if (!list) {
        return;
    }

    requestAnimationFrame(
        () => {

            list.scrollTop =
                list.scrollHeight;
        }
    );
}


/* ============================================================
   CALL PICKER
   ============================================================ */

function openCallPicker(
    preselectedUserId = null
) {

    const modal =
        $("callPickerModal");

    const list =
        $("callMemberList");

    if (!modal || !list) {

        /*
         * If the current HTML does not contain the picker,
         * fall back to directly opening a one-to-one call.
         */
        if (preselectedUserId) {

            startCall([
                preselectedUserId
            ]);

        } else {

            showToast(
                "Call picker is unavailable."
            );
        }

        return;
    }

    state.selectedCallUsers =
        new Set();

    if (preselectedUserId) {
        state.selectedCallUsers.add(
            preselectedUserId
        );
    }

    list.innerHTML = "";

    const candidates =
        state.members.filter(
            member =>
                member.user_id &&
                member.user_id !==
                state.user.id &&
                presenceFor(
                    member.user_id
                ) === "online"
        );

    if (!candidates.length) {

        list.innerHTML = `
            <div class="call-empty">
                <strong>No online members</strong>
                <span>
                    There are currently no online members available for a call.
                </span>
            </div>
        `;

    } else {

        candidates.forEach(
            member => {

                const profile =
                    member.profile;

                const name =
                    profileName(
                        profile
                    );

                const avatar =
                    profileAvatar(
                        profile
                    );

                const row =
                    document.createElement(
                        "button"
                    );

                row.type = "button";

                row.className =
                    "call-member-option";

                row.dataset.userId =
                    member.user_id;

                row.innerHTML = `
                    <span
                        class="call-member-avatar"
                        ${
                            avatar
                                ? `
                                    style="
                                        background-image:url('${escapeHTML(avatar)}');
                                        background-size:cover;
                                        background-position:center;
                                    "
                                `
                                : ""
                        }
                    >
                        ${
                            avatar
                                ? ""
                                : escapeHTML(
                                    initials(name)
                                )
                        }
                    </span>

                    <span class="call-member-info">
                        <strong>
                            ${escapeHTML(name)}
                        </strong>

                        <small>
                            Online
                        </small>
                    </span>

                    <span class="call-member-check">
                        ✓
                    </span>
                `;

                if (
                    state.selectedCallUsers.has(
                        member.user_id
                    )
                ) {
                    row.classList.add(
                        "selected"
                    );
                }

                row.addEventListener(
                    "click",
                    () => {

                        toggleCallMember(
                            member.user_id,
                            row
                        );
                    }
                );

                list.appendChild(
                    row
                );
            }
        );
    }

    modal.classList.remove(
        "hidden"
    );
}


function toggleCallMember(
    userId,
    element
) {

    if (
        state.selectedCallUsers.has(
            userId
        )
    ) {

        state.selectedCallUsers.delete(
            userId
        );

        element?.classList.remove(
            "selected"
        );

    } else {

        state.selectedCallUsers.add(
            userId
        );

        element?.classList.add(
            "selected"
        );
    }

    setText(
        "selectedCallCount",
        state.selectedCallUsers.size
    );
}


function closeCallPicker() {

    $("callPickerModal")
        ?.classList.add(
            "hidden"
        );

    state.selectedCallUsers =
        new Set();
}


/* ============================================================
   START CALL
   ============================================================ */

function startCall(
    targetIds = null,
    type = null
) {

    const ids =
        targetIds ||
        [
            ...state.selectedCallUsers
        ];

    const uniqueIds =
        [
            ...new Set(
                ids.filter(
                    id =>
                        id &&
                        id !==
                        state.user?.id
                )
            )
        ];

    const callType =
        type ||
        state.callType ||
        "video";

    if (
        !uniqueIds.length
    ) {

        showToast(
            "Select at least one online member."
        );

        return;
    }

    const params =
        new URLSearchParams();

    params.set(
        "mode",
        uniqueIds.length === 1
            ? "direct"
            : "general"
    );

    params.set(
        "call_type",
        callType
    );

    params.set(
        "targets",
        uniqueIds.join(",")
    );

    if (
        state.currentCommunity?.id
    ) {

        params.set(
            "community_id",
            state.currentCommunity.id
        );

        params.set(
            "community_name",
            state.currentCommunity.name ||
            "Mwaniki Scholars"
        );
    }

    if (
        state.currentChannel?.id
    ) {

        params.set(
            "channel_id",
            state.currentChannel.id
        );

        params.set(
            "channel_name",
            state.currentChannel.name ||
            "Discussion"
        );
    }

    closeCallPicker();

    /*
     * IMPORTANT:
     *
     * This does NOT contain another WebRTC engine.
     * The only WebRTC engine remains community-call.js.
     */

    window.location.href =
        `./community-calls.html?${params.toString()}`;
}


/* ============================================================
   GENERAL CALL
   ============================================================ */

function startGeneralCall(
    type = "video"
) {

    const onlineUsers =
        state.members
            .filter(
                member =>
                    member.user_id &&
                    member.user_id !==
                    state.user?.id &&
                    presenceFor(
                        member.user_id
                    ) === "online"
            )
            .map(
                member =>
                    member.user_id
            );

    if (!onlineUsers.length) {

        showToast(
            "There are no online members available for a call."
        );

        return;
    }

    startCall(
        onlineUsers,
        type
    );
}


/* ============================================================
   CALL TYPE
   ============================================================ */

function setCallType(
    type
) {

    if (
        type !== "audio" &&
        type !== "video"
    ) {
        type = "video";
    }

    state.callType =
        type;

    document
        .querySelectorAll(
            "[data-call-type]"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.callType ===
                    type
                );
            }
        );
}


/* ============================================================
   INCOMING CALLS
   ============================================================ */

function subscribeIncomingCalls() {

    if (!state.user) {
        return;
    }

    const channel =
        supabase
            .channel(
                `incoming-calls-${state.user.id}`
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "chat_call_participants",
                    filter:
                        `user_id=eq.${state.user.id}`
                },
                async payload => {

                    const participant =
                        payload.new;

                    if (
                        !participant ||
                        participant.user_id !==
                        state.user.id ||
                        participant.status !==
                        "invited"
                    ) {
                        return;
                    }

                    await handleIncomingCall(
                        participant
                    );
                }
            )
            .subscribe();

    state.subscriptions.push(
        channel
    );
}


async function handleIncomingCall(
    participant
) {

    if (
        state.incomingCall
    ) {
        return;
    }

    const {
        data: room,
        error
    } = await supabase
        .from("chat_call_rooms")
        .select("*")
        .eq(
            "id",
            participant.room_id
        )
        .maybeSingle();

    if (error || !room) {
        return;
    }

    if (
        room.status === "ended" ||
        room.room_status === "ended"
    ) {
        return;
    }

    let caller = null;

    if (room.created_by) {

        const {
            data
        } = await supabase
            .from("student_profiles")
            .select("*")
            .eq(
                "id",
                room.created_by
            )
            .maybeSingle();

        caller = data;
    }

    const callerName =
        profileName(caller) !==
        "Mwaniki Scholar"
            ? profileName(caller)
            : "Mwaniki Scholar";

    const callerAvatar =
        profileAvatar(caller);

    state.incomingCall = {
        participant,
        room,
        caller,
        callerName
    };

    showIncomingCallUI(
        callerName,
        callerAvatar,
        room.call_type || "video"
    );
}


/* ============================================================
   INCOMING CALL UI
   ============================================================ */

function showIncomingCallUI(
    callerName,
    avatar,
    callType
) {

    const modal =
        $("incomingCallModal");

    if (!modal) {

        /*
         * If the modal is absent, do not silently join a call.
         * The user must explicitly accept.
         */
        showToast(
            `Incoming ${callType} call from ${callerName}`
        );

        return;
    }

    setText(
        "incomingCallerName",
        callerName
    );

    setText(
        "incomingCallType",
        callType === "audio"
            ? "Incoming voice call"
            : "Incoming video call"
    );

    const image =
        $("incomingCallerAvatar");

    if (image) {

        if (avatar) {

            image.style.backgroundImage =
                `url("${avatar}")`;

            image.style.backgroundSize =
                "cover";

            image.style.backgroundPosition =
                "center";

            image.textContent =
                "";

        } else {

            image.style.backgroundImage =
                "";

            image.textContent =
                initials(callerName);
        }
    }

    modal.classList.remove(
        "hidden"
    );
}


function hideIncomingCallUI() {

    $("incomingCallModal")
        ?.classList.add(
            "hidden"
        );
}


/* ============================================================
   ACCEPT CALL
   ============================================================ */

async function acceptIncomingCall() {

    const incoming =
        state.incomingCall;

    if (!incoming) {
        return;
    }

    const {
        participant,
        room
    } = incoming;

    const {
        error
    } = await supabase
        .from("chat_call_participants")
        .update({
            status: "joined",
            joined_at:
                new Date().toISOString(),
            left_at: null,
            updated_at:
                new Date().toISOString()
        })
        .eq(
            "id",
            participant.id
        )
        .eq(
            "user_id",
            state.user.id
        );

    if (error) {

        console.error(
            "Accept call:",
            error
        );

        showToast(
            "Unable to accept the call."
        );

        return;
    }

    hideIncomingCallUI();

    const params =
        new URLSearchParams();

    params.set(
        "mode",
        room.call_scope === "community"
            ? "community"
            : room.call_scope === "direct"
                ? "direct"
                : "general"
    );

    params.set(
        "call_type",
        room.call_type ||
        "video"
    );

    params.set(
        "room_id",
        room.id
    );

    if (room.community_id) {

        params.set(
            "community_id",
            room.community_id
        );
    }

    window.location.href =
        `./community-calls.html?${params.toString()}`;
}


/* ============================================================
   DECLINE CALL
   ============================================================ */

async function declineIncomingCall() {

    const incoming =
        state.incomingCall;

    if (!incoming) {
        return;
    }

    const participant =
        incoming.participant;

    const {
        error
    } = await supabase
        .from("chat_call_participants")
        .update({
            status: "declined",
            left_at:
                new Date().toISOString(),
            updated_at:
                new Date().toISOString()
        })
        .eq(
            "id",
            participant.id
        )
        .eq(
            "user_id",
            state.user.id
        );

    if (error) {

        console.error(
            "Decline call:",
            error
        );
    }

    hideIncomingCallUI();

    state.incomingCall =
        null;
}


/* ============================================================
   HOME BUTTON
   ============================================================ */

function goHome() {

    /*
     * Adjust this only if your actual dashboard filename
     * is different.
     */

    window.location.href =
        "./dashboard.html";
}


/* ============================================================
   COMMUNITY MODAL
   ============================================================ */

function openCommunityModal() {

    $("communityModal")
        ?.classList.remove(
            "hidden"
        );
}


function closeCommunityModal() {

    $("communityModal")
        ?.classList.add(
            "hidden"
        );
}


/* ============================================================
   MEMBER SIDEBAR
   ============================================================ */

function toggleMemberSidebar() {

    const sidebar =
        $("memberSidebar");

    if (!sidebar) {
        return;
    }

    sidebar.classList.toggle(
        "collapsed"
    );
}


/* ============================================================
   MOBILE CHANNEL SIDEBAR
   ============================================================ */

function toggleChannelSidebar() {

    const sidebar =
        $("channelSidebar");

    if (!sidebar) {
        return;
    }

    sidebar.classList.toggle(
        "mobile-open"
    );
}


/* ============================================================
   MESSAGE INPUT
   ============================================================ */

function handleMessageKeydown(
    event
) {

    if (
        event.key === "Enter" &&
        !event.shiftKey
    ) {

        event.preventDefault();

        sendMessage(event);

        return;
    }

    handleTyping();
}


/* ============================================================
   ESCAPE KEY
   ============================================================ */

function handleEscape(
    event
) {

    if (
        event.key !==
        "Escape"
    ) {
        return;
    }

    $("emojiPicker")
        ?.classList.add(
            "hidden"
        );

    $("callPickerModal")
        ?.classList.add(
            "hidden"
        );

    $("communityModal")
        ?.classList.add(
            "hidden"
        );

    $("incomingCallModal")
        ?.classList.add(
            "hidden"
        );
}


/* ============================================================
   UI EVENT BINDINGS
   ============================================================ */

function bindEvents() {

    /* --------------------------------------------------------
       MESSAGE FORM
       -------------------------------------------------------- */

    $("messageForm")
        ?.addEventListener(
            "submit",
            sendMessage
        );

    $("sendMessageButton")
        ?.addEventListener(
            "click",
            sendMessage
        );

    $("messageInput")
        ?.addEventListener(
            "keydown",
            handleMessageKeydown
        );

    $("messageInput")
        ?.addEventListener(
            "input",
            resizeComposer
        );


    /* --------------------------------------------------------
       REPLY
       -------------------------------------------------------- */

    $("cancelReplyButton")
        ?.addEventListener(
            "click",
            cancelReply
        );

    $("replyCancel")
        ?.addEventListener(
            "click",
            cancelReply
        );


    /* --------------------------------------------------------
       FILES
       -------------------------------------------------------- */

    $("fileButton")
        ?.addEventListener(
            "click",
            () => {
                $("fileInput")
                    ?.click();
            }
        );

    $("attachmentButton")
        ?.addEventListener(
            "click",
            () => {
                $("fileInput")
                    ?.click();
            }
        );

    $("fileInput")
        ?.addEventListener(
            "change",
            event => {

                handleFiles(
                    event.target.files
                );

                event.target.value =
                    "";
            }
        );


    /* --------------------------------------------------------
       VOICE
       -------------------------------------------------------- */

    $("voiceButton")
        ?.addEventListener(
            "click",
            toggleVoiceRecording
        );

    $("voiceRecordButton")
        ?.addEventListener(
            "click",
            toggleVoiceRecording
        );


    /* --------------------------------------------------------
       EMOJI
       -------------------------------------------------------- */

    $("emojiButton")
        ?.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                const picker =
                    $("emojiPicker");

                if (!picker) {
                    return;
                }

                picker.classList.toggle(
                    "hidden"
                );

                if (
                    !picker.classList.contains(
                        "hidden"
                    )
                ) {

                    renderEmojiPicker();

                    $("emojiSearch")
                        ?.focus();
                }
            }
        );

    $("emojiSearch")
        ?.addEventListener(
            "input",
            event => {

                renderEmojiPicker(
                    event.target.value
                );
            }
        );


    /* --------------------------------------------------------
       SEARCH
       -------------------------------------------------------- */

    $("messageSearchInput")
        ?.addEventListener(
            "input",
            searchMessages
        );


    /* --------------------------------------------------------
       COMMUNITY
       -------------------------------------------------------- */

    $("communityButton")
        ?.addEventListener(
            "click",
            openCommunityModal
        );

    $("communitySelector")
        ?.addEventListener(
            "click",
            openCommunityModal
        );

    $("closeCommunityModal")
        ?.addEventListener(
            "click",
            closeCommunityModal
        );

    $("communityModalClose")
        ?.addEventListener(
            "click",
            closeCommunityModal
        );


    /* --------------------------------------------------------
       HOME
       -------------------------------------------------------- */

    $("homeButton")
        ?.addEventListener(
            "click",
            goHome
        );


    /* --------------------------------------------------------
       MEMBER SIDEBAR
       -------------------------------------------------------- */

    $("memberButton")
        ?.addEventListener(
            "click",
            toggleMemberSidebar
        );

    $("membersButton")
        ?.addEventListener(
            "click",
            toggleMemberSidebar
        );


    /* --------------------------------------------------------
       CHANNEL SIDEBAR
       -------------------------------------------------------- */

    $("channelMenuButton")
        ?.addEventListener(
            "click",
            toggleChannelSidebar
        );


    /* --------------------------------------------------------
       GENERAL CALL
       -------------------------------------------------------- */

    $("generalCallButton")
        ?.addEventListener(
            "click",
            () => {

                openCallPicker();
            }
        );


    $("voiceCallButton")
        ?.addEventListener(
            "click",
            () => {

                state.callType =
                    "audio";

                openCallPicker();
            }
        );


    $("videoCallButton")
        ?.addEventListener(
            "click",
            () => {

                state.callType =
                    "video";

                openCallPicker();
            }
        );


    $("callPickerClose")
        ?.addEventListener(
            "click",
            closeCallPicker
        );

    $("closeCallPicker")
        ?.addEventListener(
            "click",
            closeCallPicker
        );


    $("startCallButton")
        ?.addEventListener(
            "click",
            () => {

                startCall(
                    [
                        ...state.selectedCallUsers
                    ],
                    state.callType
                );
            }
        );


    $("startVideoCallButton")
        ?.addEventListener(
            "click",
            () => {

                startCall(
                    [
                        ...state.selectedCallUsers
                    ],
                    "video"
                );
            }
        );


    $("startVoiceCallButton")
        ?.addEventListener(
            "click",
            () => {

                startCall(
                    [
                        ...state.selectedCallUsers
                    ],
                    "audio"
                );
            }
        );


    /* --------------------------------------------------------
       CALL TYPE BUTTONS
       -------------------------------------------------------- */

    document
        .querySelectorAll(
            "[data-call-type]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        setCallType(
                            button.dataset.callType
                        );
                    }
                );
            }
        );


    /* --------------------------------------------------------
       INCOMING CALL
       -------------------------------------------------------- */

    $("acceptIncomingCall")
        ?.addEventListener(
            "click",
            acceptIncomingCall
        );

    $("acceptCallButton")
        ?.addEventListener(
            "click",
            acceptIncomingCall
        );

    $("declineIncomingCall")
        ?.addEventListener(
            "click",
            declineIncomingCall
        );

    $("declineCallButton")
        ?.addEventListener(
            "click",
            declineIncomingCall
        );


    /* --------------------------------------------------------
       GLOBAL
       -------------------------------------------------------- */

    document.addEventListener(
        "keydown",
        handleEscape
    );


    document.addEventListener(
        "click",
        event => {

            const picker =
                $("emojiPicker");

            const button =
                $("emojiButton");

            if (
                picker &&
                !picker.classList.contains(
                    "hidden"
                ) &&
                !picker.contains(event.target) &&
                !button?.contains(event.target)
            ) {

                picker.classList.add(
                    "hidden"
                );
            }
        }
    );
}


/* ============================================================
   REALTIME TYPING
   ============================================================ */

function attachTypingRealtime(
    channel
) {

    if (!channel) {
        return;
    }

    channel.on(
        "broadcast",
        {
            event: "typing"
        },
        payload => {

            const userId =
                payload?.payload?.user_id;

            const name =
                payload?.payload?.name ||
                "Someone";

            if (
                !userId ||
                userId ===
                state.user.id
            ) {
                return;
            }

            state.typingUsers.set(
                userId,
                {
                    name,
                    expires:
                        Date.now() + 1800
                }
            );

            renderTypingUsers();
        }
    );

    channel.on(
        "broadcast",
        {
            event: "typing-stop"
        },
        payload => {

            const userId =
                payload?.payload?.user_id;

            if (!userId) {
                return;
            }

            state.typingUsers.delete(
                userId
            );

            renderTypingUsers();
        }
    );
}


function renderTypingUsers() {

    const indicator =
        $("typingIndicator");

    if (!indicator) {
        return;
    }

    const now =
        Date.now();

    for (
        const [
            userId,
            info
        ]
        of state.typingUsers
    ) {

        if (
            info.expires <=
            now
        ) {

            state.typingUsers.delete(
                userId
            );
        }
    }

    const names =
        [
            ...state.typingUsers.values()
        ]
            .map(
                item =>
                    item.name
            );

    if (!names.length) {

        indicator.classList.add(
            "hidden"
        );

        indicator.textContent =
            "";

        return;
    }

    let text =
        "";

    if (names.length === 1) {

        text =
            `${names[0]} is typing…`;

    } else if (
        names.length === 2
    ) {

        text =
            `${names[0]} and ${names[1]} are typing…`;

    } else {

        text =
            `${names.length} people are typing…`;
    }

    indicator.textContent =
        text;

    indicator.classList.remove(
        "hidden"
    );
}


/* ============================================================
   PRESENCE REALTIME FIX
   ============================================================ */

function subscribePresenceForCommunity() {

    if (
        !state.currentCommunity?.id
    ) {
        return;
    }

    const channel =
        supabase
            .channel(
                `presence-${state.currentCommunity.id}`
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "chat_presence",
                    filter:
                        `community_id=eq.${state.currentCommunity.id}`
                },
                payload => {

                    const row =
                        payload.new;

                    if (!row?.user_id) {
                        return;
                    }

                    state.presence.set(
                        row.user_id,
                        row
                    );

                    renderMembers();
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "chat_presence",
                    filter:
                        `community_id=eq.${state.currentCommunity.id}`
                },
                payload => {

                    const row =
                        payload.new;

                    if (!row?.user_id) {
                        return;
                    }

                    state.presence.set(
                        row.user_id,
                        row
                    );

                    renderMembers();
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table: "chat_presence",
                    filter:
                        `community_id=eq.${state.currentCommunity.id}`
                },
                payload => {

                    /*
                     * IMPORTANT:
                     *
                     * DELETE events contain the old row.
                     * The previous implementation used payload.new
                     * first, which could leave stale online users.
                     */

                    const row =
                        payload.old;

                    if (!row?.user_id) {
                        return;
                    }

                    state.presence.delete(
                        row.user_id
                    );

                    renderMembers();
                }
            )
            .subscribe();

    state.subscriptions.push(
        channel
    );
}


/* ============================================================
   CHANNEL REALTIME REPLACEMENT
   ============================================================ */

async function subscribeCurrentChannelFixed() {

    if (!state.currentChannel) {
        return;
    }

    /*
     * Remove only previous channel-related realtime
     * subscriptions while keeping incoming calls alive.
     */

    const old =
        state.subscriptions.filter(
            channel =>
                channel.topic?.includes(
                    "community-chat-"
                )
        );

    old.forEach(
        channel => {

            try {
                supabase.removeChannel(
                    channel
                );
            } catch {
                /* ignore */
            }

            state.subscriptions =
                state.subscriptions.filter(
                    item =>
                        item !==
                        channel
                );
        }
    );

    const channel =
        supabase
            .channel(
                `community-chat-${state.currentChannel.id}`
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "chat_messages",
                    filter:
                        `channel_id=eq.${state.currentChannel.id}`
                },
                async payload => {

                    if (
                        !payload.new ||
                        state.messages.some(
                            message =>
                                message.id ===
                                payload.new.id
                        )
                    ) {
                        return;
                    }

                    state.messages.push(
                        payload.new
                    );

                    await enrichMessageUsers();

                    renderMessages();
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "chat_messages",
                    filter:
                        `channel_id=eq.${state.currentChannel.id}`
                },
                async payload => {

                    const index =
                        state.messages.findIndex(
                            message =>
                                message.id ===
                                payload.new.id
                        );

                    if (
                        index !== -1
                    ) {

                        state.messages[index] =
                            payload.new;

                    } else {

                        state.messages.push(
                            payload.new
                        );
                    }

                    await enrichMessageUsers();

                    renderMessages();
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table: "chat_messages",
                    filter:
                        `channel_id=eq.${state.currentChannel.id}`
                },
                payload => {

                    const id =
                        payload.old?.id;

                    if (!id) {
                        return;
                    }

                    state.messages =
                        state.messages.filter(
                            message =>
                                message.id !==
                                id
                        );

                    renderMessages();
                }
            );

    attachTypingRealtime(
        channel
    );

    channel.subscribe();

    state.subscriptions.push(
        channel
    );
}


/* ============================================================
   CHANNEL CHANGE PATCH
   ============================================================ */

const originalSelectChannel =
    selectChannel;

selectChannel =
    async function (
        channel,
        scroll = true
    ) {

        await originalSelectChannel(
            channel,
            scroll
        );

        /*
         * The original function subscribes first.
         * Rebind the channel so typing broadcasts work.
         */
        await subscribeCurrentChannelFixed();
    };


/* ============================================================
   ATTACHMENT REALTIME
   ============================================================ */

function subscribeAttachments() {

    const channel =
        supabase
            .channel(
                `community-attachments-${state.user.id}`
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "chat_attachments"
                },
                payload => {

                    const attachment =
                        payload.new;

                    if (!attachment?.message_id) {
                        return;
                    }

                    const article =
                        document.querySelector(
                            `[data-message-id="${CSS.escape(
                                attachment.message_id
                            )}"]`
                        );

                    if (!article) {
                        return;
                    }

                    loadMessageAttachments(
                        attachment.message_id,
                        article
                    );
                }
            )
            .subscribe();

    state.subscriptions.push(
        channel
    );
}


/* ============================================================
   PRESENCE HEARTBEAT
   ============================================================ */

let presenceHeartbeat = null;


function startPresenceHeartbeat() {

    clearInterval(
        presenceHeartbeat
    );

    presenceHeartbeat =
        setInterval(
            async () => {

                if (
                    document.hidden
                ) {
                    return;
                }

                await setMyPresence(
                    "online"
                );

            },
            30000
        );
}


/* ============================================================
   WINDOW VISIBILITY
   ============================================================ */

function bindVisibilityEvents() {

    document.addEventListener(
        "visibilitychange",
        async () => {

            if (
                document.hidden
            ) {

                await setMyPresence(
                    "away"
                );

            } else {

                await setMyPresence(
                    "online"
                );
            }
        }
    );


    window.addEventListener(
        "focus",
        () => {

            setMyPresence(
                "online"
            );
        }
    );


    window.addEventListener(
        "blur",
        () => {

            setMyPresence(
                "away"
            );
        }
    );


    window.addEventListener(
        "beforeunload",
        () => {

            /*
             * Do not await here.
             * The request may be terminated by the browser.
             */
            try {

                supabase
                    .from("chat_presence")
                    .update({
                        status: "offline",
                        last_seen:
                            new Date().toISOString()
                    })
                    .eq(
                        "user_id",
                        state.user?.id
                    );

            } catch {
                /* ignore */
            }
        }
    );
}


/* ============================================================
   COMMUNITY SWITCH PATCH
   ============================================================ */

async function switchCommunity(
    community
) {

    if (!community) {
        return;
    }

    state.currentCommunity =
        community;

    state.currentChannel =
        null;

    state.presence.clear();

    state.typingUsers.clear();

    renderCommunityRail();

    setText(
        "sidebarCommunityName",
        community.name
    );

    setText(
        "currentCommunityName",
        community.name
    );

    await loadChannels();

    await loadPresence();

    /*
     * Presence channel is recreated for the new community.
     */

    const presenceChannels =
        state.subscriptions.filter(
            channel =>
                channel.topic?.includes(
                    "community-presence-"
                ) ||
                channel.topic?.includes(
                    "presence-"
                )
        );

    presenceChannels.forEach(
        channel => {

            try {
                supabase.removeChannel(
                    channel
                );
            } catch {
                /* ignore */
            }

            state.subscriptions =
                state.subscriptions.filter(
                    item =>
                        item !==
                        channel
                );
        }
    );

    subscribePresenceForCommunity();

    await setMyPresence(
        "online"
    );
}


/* ============================================================
   PATCH COMMUNITY BUTTONS
   ============================================================ */

function bindCommunitySwitches() {

    document
        .querySelectorAll(
            "[data-community-id]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const community =
                            state.communities.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        button.dataset.communityId
                                    )
                            );

                        if (community) {

                            closeCommunityModal();

                            await switchCommunity(
                                community
                            );
                        }
                    }
                );
            }
        );
}


/* ============================================================
   INITIALIZATION
   ============================================================ */

async function initializeCommunity() {

    if (state.initialized) {
        return;
    }

    state.initialized =
        true;

    try {

        await loadCurrentUser();

        await loadProfile();

        bindEvents();

        bindVisibilityEvents();

        /*
         * Load communities first.
         * loadCommunities deliberately selects
         * Mwaniki Scholars as the default community.
         */

        await loadCommunities();

        if (
            !state.currentCommunity
        ) {

            showToast(
                "No communities are available."
            );

            return;
        }

        renderCommunityRail();

        await loadChannels();

        await loadPresence();

        subscribePresenceForCommunity();

        subscribeIncomingCalls();

        subscribeAttachments();

        await setMyPresence(
            "online"
        );

        startPresenceHeartbeat();

        bindCommunitySwitches();

        renderEmojiPicker();

        resizeComposer();

        setText(
            "connectionStatus",
            "Connected"
        );

        document.body.classList.add(
            "community-ready"
        );

        console.log(
            "[Mwaniki Scholars] Community initialized."
        );

    } catch (error) {

        console.error(
            "[Mwaniki Scholars] Initialization failed:",
            error
        );

        setText(
            "connectionStatus",
            "Connection error"
        );

        showToast(
            error.message ||
            "Unable to initialize the community."
        );
    }
}


/* ============================================================
   CLEANUP
   ============================================================ */

async function cleanupCommunity() {

    clearInterval(
        presenceHeartbeat
    );

    clearTimeout(
        state.typingTimer
    );

    if (
        mediaRecorder &&
        mediaRecorder.state !==
        "inactive"
    ) {

        try {
            mediaRecorder.stop();
        } catch {
            /* ignore */
        }
    }

    await setMyPresence(
        "offline"
    );

    removeSubscriptions();

    state.presence.clear();

    state.typingUsers.clear();
}


/* ============================================================
   GLOBAL CLEANUP
   ============================================================ */

window.addEventListener(
    "pagehide",
    () => {

        cleanupCommunity()
            .catch(
                error =>
                    console.warn(
                        "Community cleanup:",
                        error
                    )
            );
    }
);


/* ============================================================
   START
   ============================================================ */

initializeCommunity();
