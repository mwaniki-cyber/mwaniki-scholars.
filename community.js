/* ============================================================
   MWANIKI SCHOLARS COMMUNITY
   BRAND NEW COMMUNITY ENGINE
   ============================================================

   Works with:
   - community.html
   - supabase.js
   - chat_communities
   - chat_community_members
   - chat_channels
   - chat_channel_members
   - chat_messages
   - chat_message_reactions
   - chat_attachments
   - chat_presence
   - chat_read_status
   - chat_notifications
   - chat_call_rooms
   - chat_call_participants
   - chat_call_signals

   ============================================================ */

(() => {
    "use strict";

    /* ========================================================
       CONFIGURATION
       ======================================================== */

    const CONFIG = {
        messageLimit: 100,
        callSignalPollMs: 1200,
        presenceIntervalMs: 30000,

        /*
         * Change this ONLY if your Supabase Storage bucket
         * has another name.
         */
        attachmentBucket: "chat-attachments",

        maxFileSize: 25 * 1024 * 1024,

        allowedFileTypes: [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "application/pdf",
            "text/plain",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        ],

        rtcConfiguration: {
            iceServers: [
                {
                    urls: "stun:stun.l.google.com:19302"
                },
                {
                    urls: "stun:stun1.l.google.com:19302"
                }
            ]
        }
    };


    /* ========================================================
       STATE
       ======================================================== */

    const state = {
        supabase: null,
        user: null,

        profile: {
            name: "Student",
            avatar: ""
        },

        communities: [],
        selectedCommunity: null,

        channels: [],
        selectedChannel: null,

        messages: [],
        messageUsers: new Map(),

        realtimeChannels: [],

        editingMessageId: null,
        replyingToMessageId: null,

        attachment: null,

        emojiOpen: false,

        presenceTimer: null,

        call: {
            active: false,
            room: null,
            participantId: null,

            localStream: null,
            screenStream: null,

            peers: new Map(),

            signalSubscription: null,
            signalPollTimer: null,
            processedSignals: new Set(),

            muted: false,
            cameraOn: false,
            screenSharing: false,

            startedAt: null,
            durationTimer: null,

            minimized: false
        }
    };


    /* ========================================================
       DOM HELPER
       ======================================================== */

    const $ = (id) => document.getElementById(id);


    /* ========================================================
       IMPORTANT:
       supabase.js is loaded as a module while this file is
       currently loaded as a normal script.

       Therefore we wait until window.supabase exists.
       ======================================================== */

    function waitForSupabase() {
        return new Promise((resolve, reject) => {

            if (window.supabase) {
                resolve(window.supabase);
                return;
            }

            let attempts = 0;

            const timer = setInterval(() => {

                attempts++;

                if (window.supabase) {
                    clearInterval(timer);
                    resolve(window.supabase);
                    return;
                }

                if (attempts >= 100) {
                    clearInterval(timer);
                    reject(
                        new Error(
                            "Supabase client was not available."
                        )
                    );
                }

            }, 100);
        });
    }


    /* ========================================================
       STATUS / ACCESSIBILITY
       ======================================================== */

    function announce(message) {

        const announcer = $("accessibilityAnnouncer");

        if (announcer) {
            announcer.textContent = "";
            setTimeout(() => {
                announcer.textContent = message;
            }, 20);
        }

        const status = $("communityStatus");

        if (status) {
            status.textContent = message;
        }
    }


    function showMessage(message, type = "info") {

        const element = $("communityStatus");

        if (element) {
            element.dataset.type = type;
            element.textContent = message;
        }

        announce(message);
    }


    function escapeHTML(value) {

        if (value === null || value === undefined) {
            return "";
        }

        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    function escapeAttribute(value) {
        return escapeHTML(value);
    }


    function initials(name) {

        const text = String(name || "Student").trim();

        if (!text) {
            return "S";
        }

        const parts = text.split(/\s+/);

        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }

        return (
            parts[0][0] +
            parts[parts.length - 1][0]
        ).toUpperCase();
    }


    function formatTime(dateString) {

        if (!dateString) {
            return "";
        }

        const date = new Date(dateString);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
    }


    function formatDate(dateString) {

        if (!dateString) {
            return "";
        }

        const date = new Date(dateString);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleDateString([], {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }


    /* ========================================================
       AUTHENTICATION
       ======================================================== */

    async function loadUser() {

        const {
            data,
            error
        } = await state.supabase.auth.getUser();

        if (error) {
            throw error;
        }

        if (!data || !data.user) {

            showMessage(
                "Please sign in to use the community.",
                "error"
            );

            setTimeout(() => {
                window.location.href = "./index.html";
            }, 1000);

            throw new Error("No authenticated user.");
        }

        state.user = data.user;

        state.profile.name =
            data.user.user_metadata?.full_name ||
            data.user.user_metadata?.name ||
            data.user.email?.split("@")[0] ||
            "Student";

        state.profile.avatar =
            data.user.user_metadata?.avatar_url ||
            data.user.user_metadata?.picture ||
            "";

        updateProfileUI();
    }


    function updateProfileUI() {

        const name = state.profile.name;
        const avatar = state.profile.avatar;

        const nameElements = [
            $("sidebarProfileName")
        ];

        nameElements.forEach(element => {

            if (element) {
                element.textContent = name;
            }
        });

        const avatars = [
            $("railProfileAvatar"),
            $("sidebarProfileAvatar")
        ];

        avatars.forEach(img => {

            if (!img) {
                return;
            }

            if (avatar) {
                img.src = avatar;
                img.alt = `${name} profile photo`;
            } else {
                img.removeAttribute("src");
                img.alt = `${name} profile`;
            }
        });
    }


    /* ========================================================
       NAVIGATION
       ======================================================== */

    function goHome() {
        window.location.href = "./dashboard.html";
    }


    function setupNavigation() {

        [
            $("homeButton"),
            $("railHomeButton"),
            $("dashboardButton")
        ].forEach(button => {

            if (button) {
                button.addEventListener("click", goHome);
            }

        });


        [
            $("railProfileButton"),
            $("sidebarProfileButton")
        ].forEach(button => {

            if (button) {

                button.addEventListener("click", () => {

                    /*
                     * Use the dashboard profile if available.
                     */
                    window.location.href =
                        "./dashboard.html#profile";
                });

            }

        });


        const startButtons = [
            $("startConversationButton"),
            $("welcomeStartButton")
        ];

        startButtons.forEach(button => {

            if (button) {

                button.addEventListener("click", () => {

                    const input = $("messageInput");

                    if (input) {
                        input.focus();
                    }

                });

            }

        });
    }


    /* ========================================================
       COMMUNITIES
       ======================================================== */

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

        renderCommunityRail();
        renderCommunityModal();

        if (!state.communities.length) {

            showMessage(
                "No active communities were found.",
                "error"
            );

            return;
        }

        const savedId =
            localStorage.getItem(
                "mwanikiSelectedCommunity"
            );

        let community =
            state.communities.find(
                item => item.id === savedId
            );

        if (!community) {

            community =
                state.communities.find(
                    item =>
                        item.slug === "general" ||
                        item.slug === "mwaniki-scholars"
                );
        }

        if (!community) {
            community = state.communities[0];
        }

        await selectCommunity(community);
    }


    function renderCommunityRail() {

        const rail = $("communityRailList");

        if (!rail) {
            return;
        }

        rail.innerHTML = "";

        state.communities.forEach(community => {

            const button =
                document.createElement("button");

            button.type = "button";
            button.className = "rail-button community-rail-community";

            button.dataset.communityId =
                community.id;

            button.title =
                community.name;

            button.setAttribute(
                "aria-label",
                community.name
            );

            const icon =
                community.icon_url
                    ? `<img src="${escapeAttribute(
                        community.icon_url
                    )}" alt="">`
                    : escapeHTML(
                        initials(community.name)
                    );

            button.innerHTML = `
                <span class="community-rail-avatar">
                    ${icon}
                </span>
            `;

            button.addEventListener(
                "click",
                () => selectCommunity(community)
            );

            rail.appendChild(button);
        });
    }


    function renderCommunityModal(search = "") {

        const list = $("communityChoiceList");

        if (!list) {
            return;
        }

        const query =
            String(search || "")
                .trim()
                .toLowerCase();

        const communities =
            state.communities.filter(community => {

                if (!query) {
                    return true;
                }

                return (
                    String(community.name || "")
                        .toLowerCase()
                        .includes(query) ||
                    String(community.description || "")
                        .toLowerCase()
                        .includes(query)
                );
            });

        if (!communities.length) {

            list.innerHTML = `
                <div class="center-state">
                    No communities found.
                </div>
            `;

            return;
        }

        list.innerHTML = "";

        communities.forEach(community => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "community-choice";

            button.setAttribute(
                "role",
                "option"
            );

            button.dataset.communityId =
                community.id;

            const icon =
                community.icon_url
                    ? `<img src="${escapeAttribute(
                        community.icon_url
                    )}" alt="">`
                    : `<span>${escapeHTML(
                        initials(community.name)
                    )}</span>`;

            button.innerHTML = `
                <div class="community-choice-icon">
                    ${icon}
                </div>

                <div class="community-choice-text">
                    <strong>
                        ${escapeHTML(community.name)}
                    </strong>

                    <span>
                        ${escapeHTML(
                            community.description || ""
                        )}
                    </span>
                </div>
            `;

            button.addEventListener(
                "click",
                async () => {

                    await selectCommunity(community);
                    closeCommunityModal();

                }
            );

            list.appendChild(button);
        });
    }


    async function selectCommunity(community) {

        if (!community) {
            return;
        }

        state.selectedCommunity = community;

        localStorage.setItem(
            "mwanikiSelectedCommunity",
            community.id
        );

        updateSelectedCommunityUI();

        renderCommunityRail();

        await ensureCommunityMembership();

        await loadChannels();

        await setupCommunityRealtime();

        announce(
            `Opened ${community.name}`
        );
    }


    function updateSelectedCommunityUI() {

        const community =
            state.selectedCommunity;

        if (!community) {
            return;
        }

        const name = $("selectedCommunityName");

        if (name) {
            name.textContent =
                community.name;
        }

        const description =
            $("selectedCommunityDescription");

        if (description) {
            description.textContent =
                community.description ||
                "Community";
        }

        const brand =
            $("communityBrandTitle");

        if (brand) {
            brand.textContent =
                community.name;
        }

        const subtitle =
            $("communityBrandSubtitle");

        if (subtitle) {
            subtitle.textContent =
                community.description ||
                "Learn • Discuss • Connect";
        }

        const icon =
            $("selectedCommunityIcon");

        if (icon) {

            if (community.icon_url) {

                icon.innerHTML = `
                    <img
                        src="${escapeAttribute(
                            community.icon_url
                        )}"
                        alt=""
                    >
                `;

            } else {

                icon.textContent =
                    initials(community.name);
            }
        }

        document
            .querySelectorAll(
                ".community-rail-community"
            )
            .forEach(button => {

                button.classList.toggle(
                    "active",
                    button.dataset.communityId ===
                    community.id
                );

            });
    }


    async function ensureCommunityMembership() {

        if (!state.user ||
            !state.selectedCommunity) {
            return;
        }

        const communityId =
            state.selectedCommunity.id;

        const {
            data,
            error
        } = await state.supabase
            .from("chat_community_members")
            .select("id")
            .eq(
                "community_id",
                communityId
            )
            .eq(
                "user_id",
                state.user.id
            )
            .maybeSingle();

        if (error) {
            console.warn(
                "Membership lookup:",
                error
            );
            return;
        }

        if (data) {
            return;
        }

        /*
         * Public communities can be joined automatically.
         */
        if (
            state.selectedCommunity.is_public === true
        ) {

            const {
                error: insertError
            } = await state.supabase
                .from("chat_community_members")
                .insert({
                    community_id:
                        communityId,

                    user_id:
                        state.user.id,

                    role:
                        "student"
                });

            if (insertError) {

                console.warn(
                    "Could not create membership:",
                    insertError
                );
            }
        }
    }


    /* ========================================================
       CHANNELS
       ======================================================== */

    async function loadChannels() {

        const list = $("channelList");

        if (list) {

            list.innerHTML = `
                <div class="center-state">
                    <div>
                        <div
                            class="loader"
                            aria-hidden="true"
                        ></div>

                        Loading channels...
                    </div>
                </div>
            `;
        }

        if (!state.selectedCommunity) {
            return;
        }

        const {
            data,
            error
        } = await state.supabase
            .from("chat_channels")
            .select("*")
            .eq(
                "community_id",
                state.selectedCommunity.id
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
                "created_at",
                {
                    ascending: true
                }
            );

        if (error) {
            throw error;
        }

        state.channels = data || [];

        renderChannels();

        const savedChannel =
            localStorage.getItem(
                "mwanikiSelectedChannel"
            );

        let channel =
            state.channels.find(
                item => item.id === savedChannel
            );

        if (!channel) {

            channel =
                state.channels.find(
                    item =>
                        item.slug === "general"
                );
        }

        if (!channel) {
            channel = state.channels[0];
        }

        if (channel) {
            await selectChannel(channel);
        }
    }


    function renderChannels(search = "") {

        const list = $("channelList");

        if (!list) {
            return;
        }

        const query =
            String(search || "")
                .trim()
                .toLowerCase();

        const filtered =
            state.channels.filter(channel => {

                if (!query) {
                    return true;
                }

                return (
                    String(channel.name || "")
                        .toLowerCase()
                        .includes(query) ||
                    String(channel.description || "")
                        .toLowerCase()
                        .includes(query)
                );
            });

        if (!filtered.length) {

            list.innerHTML = `
                <div class="center-state">
                    No channels found.
                </div>
            `;

            return;
        }

        list.innerHTML = "";

        filtered.forEach(channel => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "channel-button";

            button.dataset.channelId =
                channel.id;

            const icon =
                channel.icon ||
                (
                    channel.channel_type === "voice"
                        ? "🔊"
                        : "#"
                );

            button.innerHTML = `
                <span class="channel-icon">
                    ${escapeHTML(icon)}
                </span>

                <span class="channel-name">
                    ${escapeHTML(channel.name)}
                </span>
            `;

            button.addEventListener(
                "click",
                () => selectChannel(channel)
            );

            list.appendChild(button);
        });

        updateChannelSelection();
    }


    function updateChannelSelection() {

        document
            .querySelectorAll(
                ".channel-button"
            )
            .forEach(button => {

                button.classList.toggle(
                    "active",
                    state.selectedChannel &&
                    button.dataset.channelId ===
                    state.selectedChannel.id
                );

            });
    }


    async function selectChannel(channel) {

        if (!channel) {
            return;
        }

        state.selectedChannel = channel;

        localStorage.setItem(
            "mwanikiSelectedChannel",
            channel.id
        );

        updateChannelSelection();

        const title =
            $("mainChannelTitle");

        if (title) {
            title.textContent =
                `${channel.icon || "#"} ${channel.name}`;
        }

        const description =
            $("mainChannelDescription");

        if (description) {
            description.textContent =
                channel.description ||
                `${channel.name} discussion`;
        }

        const input =
            $("messageInput");

        if (input) {

            input.placeholder =
                `Message #${channel.name}...`;
        }

        await loadMessages();

        await markChannelRead();

        announce(
            `Opened channel ${channel.name}`
        );
    }


    /* ========================================================
       MESSAGES
       ======================================================== */

    async function loadMessages() {

        const list = $("messageList");

        if (!list) {
            return;
        }

        if (!state.selectedChannel) {

            renderWelcome();

            return;
        }

        list.innerHTML = `
            <div class="center-state">
                <div>
                    <div
                        class="loader"
                        aria-hidden="true"
                    ></div>

                    Loading messages...
                </div>
            </div>
        `;

        const {
            data,
            error
        } = await state.supabase
            .from("chat_messages")
            .select("*")
            .eq(
                "channel_id",
                state.selectedChannel.id
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

        if (error) {
            throw error;
        }

        state.messages = data || [];

        await loadMessageUsers();

        await loadReactions();

        renderMessages();
    }


    async function loadMessageUsers() {

        state.messageUsers.clear();

        const ids = [
            ...new Set(
                state.messages
                    .map(message => message.user_id)
                    .filter(Boolean)
            )
        ];

        if (!ids.length) {
            return;
        }

        /*
         * There is no user/profile table in the supplied
         * schema. We therefore use community membership
         * nickname where available.
         */
        const {
            data,
            error
        } = await state.supabase
            .from("chat_community_members")
            .select(
                "user_id,nickname,role"
            )
            .eq(
                "community_id",
                state.selectedCommunity.id
            )
            .in(
                "user_id",
                ids
            );

        if (error) {
            console.warn(
                "Could not load message users:",
                error
            );
            return;
        }

        (data || []).forEach(member => {

            state.messageUsers.set(
                member.user_id,
                {
                    name:
                        member.nickname ||
                        "Student",

                    role:
                        member.role ||
                        "student"
                }
            );

        });
    }


    const reactionsByMessage =
        new Map();


    async function loadReactions() {

        reactionsByMessage.clear();

        const ids =
            state.messages.map(
                message => message.id
            );

        if (!ids.length) {
            return;
        }

        const {
            data,
            error
        } = await state.supabase
            .from("chat_message_reactions")
            .select("*")
            .in(
                "message_id",
                ids
            );

        if (error) {
            console.warn(
                "Could not load reactions:",
                error
            );
            return;
        }

        (data || []).forEach(reaction => {

            if (
                !reactionsByMessage.has(
                    reaction.message_id
                )
            ) {

                reactionsByMessage.set(
                    reaction.message_id,
                    []
                );
            }

            reactionsByMessage
                .get(reaction.message_id)
                .push(reaction);
        });
    }


    function renderWelcome() {

        const list = $("messageList");

        if (!list) {
            return;
        }

        list.innerHTML = `
            <div class="welcome-card">

                <div
                    class="welcome-icon"
                    aria-hidden="true"
                >
                    💬
                </div>

                <h2>
                    Welcome to Mwaniki Scholars
                </h2>

                <p>
                    Choose a community and channel,
                    then start learning and discussing
                    with other students.
                </p>

            </div>
        `;
    }


    function renderMessages() {

        const list = $("messageList");

        if (!list) {
            return;
        }

        if (!state.messages.length) {

            list.innerHTML = `
                <div class="welcome-card">

                    <div
                        class="welcome-icon"
                        aria-hidden="true"
                    >
                        💬
                    </div>

                    <h2>
                        Start the conversation
                    </h2>

                    <p>
                        Be the first to send a message
                        in this channel.
                    </p>

                </div>
            `;

            return;
        }

        list.innerHTML = "";

        state.messages.forEach(message => {

            list.appendChild(
                createMessageElement(message)
            );

        });

        scrollMessagesToBottom();
    }


    function createMessageElement(message) {

        const wrapper =
            document.createElement("article");

        wrapper.className =
            "chat-message";

        wrapper.dataset.messageId =
            message.id;

        const isOwn =
            message.user_id ===
            state.user?.id;

        const user =
            state.messageUsers.get(
                message.user_id
            ) || {};

        const name =
            isOwn
                ? state.profile.name
                : user.name || "Student";

        const role =
            user.role || "student";

        const reactions =
            reactionsByMessage.get(
                message.id
            ) || [];

        if (message.is_deleted) {

            wrapper.innerHTML = `
                <div class="message-avatar">
                    ${escapeHTML(initials(name))}
                </div>

                <div class="message-content">
                    <div class="message-meta">
                        <strong>
                            ${escapeHTML(name)}
                        </strong>
                    </div>

                    <div class="deleted-message">
                        This message was deleted.
                    </div>
                </div>
            `;

            return wrapper;
        }

        const attachment =
            getAttachmentForMessage(
                message.id
            );

        wrapper.innerHTML = `
            <div class="message-avatar">
                ${state.profile.avatar && isOwn
                    ? `
                        <img
                            src="${escapeAttribute(
                                state.profile.avatar
                            )}"
                            alt=""
                        >
                    `
                    : escapeHTML(
                        initials(name)
                    )
                }
            </div>

            <div class="message-content">

                <div class="message-meta">

                    <strong>
                        ${escapeHTML(name)}
                    </strong>

                    ${
                        role !== "student"
                            ? `
                                <span class="message-role">
                                    ${escapeHTML(role)}
                                </span>
                            `
                            : ""
                    }

                    <time>
                        ${formatTime(
                            message.created_at
                        )}
                    </time>

                    ${
                        message.is_edited
                            ? `
                                <span>
                                    (edited)
                                </span>
                            `
                            : ""
                    }

                </div>

                ${
                    message.parent_message_id
                        ? `
                            <div class="reply-reference">
                                ↪ Reply
                            </div>
                        `
                        : ""
                }

                <div class="message-body">
                    ${formatMessageContent(
                        message.content
                    )}
                </div>

                ${
                    attachment
                        ? renderAttachment(
                            attachment
                        )
                        : ""
                }

                <div class="message-actions">

                    <button
                        type="button"
                        data-action="react"
                        data-message-id="${message.id}"
                        title="React"
                    >
                        😊
                    </button>

                    <button
                        type="button"
                        data-action="reply"
                        data-message-id="${message.id}"
                        title="Reply"
                    >
                        ↩
                    </button>

                    ${
                        isOwn
                            ? `
                                <button
                                    type="button"
                                    data-action="edit"
                                    data-message-id="${message.id}"
                                    title="Edit"
                                >
                                    ✎
                                </button>

                                <button
                                    type="button"
                                    data-action="delete"
                                    data-message-id="${message.id}"
                                    title="Delete"
                                >
                                    🗑
                                </button>
                            `
                            : ""
                    }

                </div>

                ${
                    renderReactions(
                        reactions,
                        message.id
                    )
                }

            </div>
        `;

        attachMessageActionListeners(
            wrapper
        );

        return wrapper;
    }


    function formatMessageContent(content) {

        if (!content) {
            return "";
        }

        return escapeHTML(content)
            .replace(/\n/g, "<br>");
    }


    function renderAttachment(attachment) {

        const url =
            attachment.file_url ||
            "";

        if (!url) {
            return "";
        }

        const mime =
            attachment.mime_type || "";

        const name =
            attachment.file_name ||
            "Attachment";

        if (
            mime.startsWith("image/")
        ) {

            return `
                <div class="message-attachment image-attachment">

                    <a
                        href="${escapeAttribute(url)}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <img
                            src="${escapeAttribute(url)}"
                            alt="${escapeAttribute(name)}"
                        >
                    </a>

                </div>
            `;
        }

        return `
            <div class="message-attachment file-attachment">

                <a
                    href="${escapeAttribute(url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                >

                    <span
                        class="attachment-icon"
                        aria-hidden="true"
                    >
                        📄
                    </span>

                    <span>
                        ${escapeHTML(name)}
                    </span>

                </a>

            </div>
        `;
    }


    let attachmentsByMessage =
        new Map();


    async function loadAttachments() {

        attachmentsByMessage.clear();

        const ids =
            state.messages.map(
                message => message.id
            );

        if (!ids.length) {
            return;
        }

        const {
            data,
            error
        } = await state.supabase
            .from("chat_attachments")
            .select("*")
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
            console.warn(
                "Attachment loading:",
                error
            );
            return;
        }

        (data || []).forEach(attachment => {

            if (
                !attachmentsByMessage.has(
                    attachment.message_id
                )
            ) {

                attachmentsByMessage.set(
                    attachment.message_id,
                    []
                );
            }

            attachmentsByMessage
                .get(attachment.message_id)
                .push(attachment);
        });
    }


    function getAttachmentForMessage(messageId) {

        const list =
            attachmentsByMessage.get(
                messageId
            );

        return list?.[0] || null;
    }


    function renderReactions(
        reactions,
        messageId
    ) {

        if (!reactions.length) {
            return "";
        }

        const counts = new Map();

        reactions.forEach(reaction => {

            counts.set(
                reaction.reaction,
                (counts.get(
                    reaction.reaction
                ) || 0) + 1
            );

        });

        return `
            <div class="message-reactions">

                ${[...counts.entries()]
                    .map(
                        ([emoji, count]) => `
                            <button
                                type="button"
                                class="reaction-chip"
                                data-action="react"
                                data-message-id="${messageId}"
                                data-reaction="${escapeAttribute(
                                    emoji
                                )}"
                            >
                                ${escapeHTML(emoji)}
                                ${count}
                            </button>
                        `
                    )
                    .join("")
                }

            </div>
        `;
    }


    function attachMessageActionListeners(
        wrapper
    ) {

        wrapper
            .querySelectorAll(
                "[data-action]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async event => {

                        const action =
                            event.currentTarget
                                .dataset.action;

                        const messageId =
                            event.currentTarget
                                .dataset.messageId;

                        if (
                            action === "delete"
                        ) {

                            await deleteMessage(
                                messageId
                            );

                        } else if (
                            action === "edit"
                        ) {

                            startEditingMessage(
                                messageId
                            );

                        } else if (
                            action === "reply"
                        ) {

                            startReply(
                                messageId
                            );

                        } else if (
                            action === "react"
                        ) {

                            const emoji =
                                event.currentTarget
                                    .dataset.reaction ||
                                "👍";

                            await toggleReaction(
                                messageId,
                                emoji
                            );

                        }

                    }
                );

            });
    }


    /* ========================================================
       SEND MESSAGE
       ======================================================== */

    async function sendMessage() {

        if (!state.user) {
            return;
        }

        if (!state.selectedChannel) {

            showMessage(
                "Choose a channel first.",
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

        if (
            !content &&
            !state.attachment
        ) {

            return;
        }

        const button =
            $("sendMessageButton");

        if (button) {
            button.disabled = true;
        }

        try {

            const payload = {
                channel_id:
                    state.selectedChannel.id,

                user_id:
                    state.user.id,

                content:
                    content || null,

                message_type:
                    state.attachment
                        ? "file"
                        : "text"
            };

            if (state.replyingToMessageId) {

                payload.parent_message_id =
                    state.replyingToMessageId;
            }

            const {
                data,
                error
            } = await state.supabase
                .from("chat_messages")
                .insert(payload)
                .select()
                .single();

            if (error) {
                throw error;
            }

            if (
                state.attachment &&
                data
            ) {

                await uploadAttachment(
                    data.id,
                    state.attachment
                );
            }

            input.value = "";

            resetComposerState();

            await loadMessages();

            showMessage(
                "Message sent.",
                "success"
            );

        } catch (error) {

            console.error(
                "Send message failed:",
                error
            );

            showMessage(
                error.message ||
                "Could not send message.",
                "error"
            );

        } finally {

            if (button) {
                button.disabled = false;
            }
        }
    }


    /* ========================================================
       EDIT MESSAGE
       ======================================================== */

    function startEditingMessage(
        messageId
    ) {

        const message =
            state.messages.find(
                item => item.id === messageId
            );

        if (!message) {
            return;
        }

        if (
            message.user_id !==
            state.user?.id
        ) {

            return;
        }

        state.editingMessageId =
            messageId;

        state.replyingToMessageId =
            null;

        const input =
            $("messageInput");

        if (!input) {
            return;
        }

        input.value =
            message.content || "";

        input.focus();

        input.setSelectionRange(
            input.value.length,
            input.value.length
        );

        showComposerEditingState();
    }


    async function saveEditedMessage() {

        if (!state.editingMessageId) {
            return;
        }

        const input =
            $("messageInput");

        if (!input) {
            return;
        }

        const content =
            input.value.trim();

        if (!content) {
            return;
        }

        const {
            error
        } = await state.supabase
            .from("chat_messages")
            .update({
                content,
                is_edited: true,
                edited_at: new Date().toISOString()
            })
            .eq(
                "id",
                state.editingMessageId
            )
            .eq(
                "user_id",
                state.user.id
            );

        if (error) {
            throw error;
        }

        resetComposerState();

        await loadMessages();

        showMessage(
            "Message updated.",
            "success"
        );
    }


    function showComposerEditingState() {

        const button =
            $("sendMessageButton");

        if (button) {
            button.textContent = "✓";
            button.title = "Save edit";
        }
    }


    /* ========================================================
       DELETE MESSAGE
       ======================================================== */

    async function deleteMessage(
        messageId
    ) {

        const message =
            state.messages.find(
                item => item.id === messageId
            );

        if (!message) {
            return;
        }

        if (
            message.user_id !==
            state.user?.id
        ) {

            showMessage(
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
        } = await state.supabase
            .from("chat_messages")
            .update({
                is_deleted: true,
                deleted_at:
                    new Date().toISOString(),
                content: null
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
                "Delete failed:",
                error
            );

            showMessage(
                error.message ||
                "Could not delete message.",
                "error"
            );

            return;
        }

        await loadMessages();

        showMessage(
            "Message deleted.",
            "success"
        );
    }


    /* ========================================================
       REPLY
       ======================================================== */

    function startReply(messageId) {

        const message =
            state.messages.find(
                item => item.id === messageId
            );

        if (!message) {
            return;
        }

        state.replyingToMessageId =
            messageId;

        state.editingMessageId =
            null;

        const input =
            $("messageInput");

        if (input) {
            input.focus();
        }

        showMessage(
            "Replying to message.",
            "info"
        );
    }


    /* ========================================================
       REACTIONS
       ======================================================== */

    async function toggleReaction(
        messageId,
        emoji
    ) {

        if (!state.user) {
            return;
        }

        const {
            data,
            error
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
                emoji
            )
            .maybeSingle();

        if (error) {
            console.error(
                "Reaction lookup:",
                error
            );
            return;
        }

        if (data) {

            const {
                error: deleteError
            } = await state.supabase
                .from("chat_message_reactions")
                .delete()
                .eq(
                    "id",
                    data.id
                );

            if (deleteError) {
                console.error(
                    deleteError
                );
                return;
            }

        } else {

            const {
                error: insertError
            } = await state.supabase
                .from("chat_message_reactions")
                .insert({
                    message_id:
                        messageId,

                    user_id:
                        state.user.id,

                    reaction:
                        emoji
                });

            if (insertError) {
                console.error(
                    insertError
                );
                return;
            }
        }

        await loadMessages();
    }


    /* ========================================================
       COMPOSER
       ======================================================== */

    function resetComposerState() {

        state.editingMessageId = null;
        state.replyingToMessageId = null;
        state.attachment = null;

        const input =
            $("messageInput");

        if (input) {
            input.value = "";
        }

        const button =
            $("sendMessageButton");

        if (button) {
            button.textContent = "➤";
            button.title = "Send message";
        }

        removeAttachmentPreview();
    }


    function setupComposer() {

        const form =
            $("messageForm");

        if (form) {

            form.addEventListener(
                "submit",
                async event => {

                    event.preventDefault();

                    if (
                        state.editingMessageId
                    ) {

                        try {
                            await saveEditedMessage();
                        } catch (error) {

                            console.error(error);

                            showMessage(
                                error.message ||
                                "Could not edit message.",
                                "error"
                            );
                        }

                        return;
                    }

                    await sendMessage();
                }
            );
        }


        const input =
            $("messageInput");

        if (input) {

            input.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key === "Enter" &&
                        !event.shiftKey
                    ) {

                        event.preventDefault();

                        const form =
                            $("messageForm");

                        form?.requestSubmit();
                    }

                }
            );

            input.addEventListener(
                "input",
                autoResizeTextarea
            );
        }
    }


    function autoResizeTextarea() {

        const input =
            $("messageInput");

        if (!input) {
            return;
        }

        input.style.height = "auto";

        input.style.height =
            Math.min(
                input.scrollHeight,
                180
            ) + "px";
    }


    /* ========================================================
       ATTACHMENTS
       ======================================================== */

    function setupAttachments() {

        const button =
            $("attachButton");

        if (!button) {
            return;
        }

        const fileInput =
            document.createElement("input");

        fileInput.type = "file";
        fileInput.hidden = true;

        fileInput.accept =
            CONFIG.allowedFileTypes.join(",");

        document.body.appendChild(
            fileInput
        );

        button.addEventListener(
            "click",
            () => fileInput.click()
        );

        fileInput.addEventListener(
            "change",
            () => {

                const file =
                    fileInput.files?.[0];

                if (!file) {
                    return;
                }

                if (
                    file.size >
                    CONFIG.maxFileSize
                ) {

                    showMessage(
                        "File is larger than 25 MB.",
                        "error"
                    );

                    fileInput.value = "";
                    return;
                }

                if (
                    !CONFIG.allowedFileTypes
                        .includes(file.type)
                ) {

                    showMessage(
                        "This file type is not supported.",
                        "error"
                    );

                    fileInput.value = "";
                    return;
                }

                state.attachment =
                    file;

                showAttachmentPreview(
                    file
                );

                fileInput.value = "";
            }
        );
    }


    function showAttachmentPreview(file) {

        removeAttachmentPreview();

        const composer =
            document.querySelector(
                ".composer-box"
            );

        if (!composer) {
            return;
        }

        const preview =
            document.createElement("div");

        preview.id =
            "attachmentPreview";

        preview.className =
            "attachment-preview";

        preview.innerHTML = `
            <span>
                ${
                    file.type.startsWith("image/")
                        ? "📷"
                        : "📄"
                }
            </span>

            <span>
                ${escapeHTML(file.name)}
            </span>

            <button
                type="button"
                id="removeAttachmentButton"
                title="Remove attachment"
                aria-label="Remove attachment"
            >
                ×
            </button>
        `;

        composer.prepend(preview);

        $("removeAttachmentButton")
            ?.addEventListener(
                "click",
                () => {

                    state.attachment = null;

                    removeAttachmentPreview();
                }
            );
    }


    function removeAttachmentPreview() {

        $("attachmentPreview")?.remove();
    }


    async function uploadAttachment(
        messageId,
        file
    ) {

        const safeName =
            file.name
                .replace(
                    /[^a-zA-Z0-9._-]/g,
                    "_"
                );

        const path =
            `${state.user.id}/` +
            `${messageId}/` +
            `${Date.now()}-${safeName}`;

        const {
            error: uploadError
        } = await state.supabase
            .storage
            .from(
                CONFIG.attachmentBucket
            )
            .upload(
                path,
                file,
                {
                    cacheControl: "3600",
                    upsert: false
                }
            );

        if (uploadError) {
            throw uploadError;
        }

        const {
            data: urlData
        } = state.supabase
            .storage
            .from(
                CONFIG.attachmentBucket
            )
            .getPublicUrl(path);

        const publicUrl =
            urlData?.publicUrl || null;

        const {
            error: attachmentError
        } = await state.supabase
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
                    publicUrl,

                mime_type:
                    file.type,

                file_size:
                    file.size
            });

        if (attachmentError) {
            throw attachmentError;
        }
    }


    /* ========================================================
       EMOJI PICKER
       ======================================================== */

    function setupEmojiPicker() {

        const button =
            $("emojiButton");

        if (!button) {
            return;
        }

        createEmojiPicker();

        button.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                toggleEmojiPicker();
            }
        );

        document.addEventListener(
            "click",
            event => {

                const picker =
                    $("mwanikiEmojiPicker");

                if (!picker) {
                    return;
                }

                if (
                    !picker.contains(
                        event.target
                    ) &&
                    event.target !== button
                ) {

                    closeEmojiPicker();
                }
            }
        );

        document.addEventListener(
            "keydown",
            event => {

                if (event.key === "Escape") {
                    closeEmojiPicker();
                    closeCommunityModal();
                    closeGeneralCallModal();
                }

            }
        );
    }


    function createEmojiPicker() {

        if ($("mwanikiEmojiPicker")) {
            return;
        }

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

        const emojis = [
            "😀",
            "😂",
            "🤣",
            "😊",
            "😍",
            "🥰",
            "😎",
            "🤔",
            "😮",
            "😢",
            "😡",
            "👍",
            "👎",
            "👏",
            "🙌",
            "🙏",
            "❤️",
            "🔥",
            "🎉",
            "💯",
            "✅",
            "❌",
            "💡",
            "📚",
            "🧪",
            "🩺",
            "💊",
            "🧠",
            "🔬",
            "😂"
        ];

        picker.innerHTML = `
            <div class="emoji-picker-grid">
                ${emojis.map(
                    emoji => `
                        <button
                            type="button"
                            class="emoji-item"
                            data-emoji="${emoji}"
                            aria-label="Insert ${emoji}"
                        >
                            ${emoji}
                        </button>
                    `
                ).join("")}
            </div>
        `;

        document.body.appendChild(
            picker
        );

        picker
            .querySelectorAll(
                ".emoji-item"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        insertEmoji(
                            button.dataset.emoji
                        );

                    }
                );

            });
    }


    function toggleEmojiPicker() {

        const picker =
            $("mwanikiEmojiPicker");

        const button =
            $("emojiButton");

        if (!picker) {
            return;
        }

        if (state.emojiOpen) {
            closeEmojiPicker();
            return;
        }

        positionEmojiPicker();

        picker.classList.add("open");

        state.emojiOpen = true;

        button?.setAttribute(
            "aria-expanded",
            "true"
        );
    }


    function closeEmojiPicker() {

        const picker =
            $("mwanikiEmojiPicker");

        const button =
            $("emojiButton");

        picker?.classList.remove(
            "open"
        );

        state.emojiOpen = false;

        button?.setAttribute(
            "aria-expanded",
            "false"
        );
    }


    function positionEmojiPicker() {

        const picker =
            $("mwanikiEmojiPicker");

        const button =
            $("emojiButton");

        if (!picker || !button) {
            return;
        }

        const rect =
            button.getBoundingClientRect();

        picker.style.position =
            "fixed";

        picker.style.left =
            `${Math.max(
                10,
                rect.left
            )}px`;

        picker.style.bottom =
            `${Math.max(
                10,
                window.innerHeight -
                rect.top +
                8
            )}px`;
    }


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
            input.value.substring(
                0,
                start
            ) +
            emoji +
            input.value.substring(
                end
            );

        input.focus();

        const cursor =
            start +
            emoji.length;

        input.setSelectionRange(
            cursor,
            cursor
        );

        autoResizeTextarea();

        closeEmojiPicker();
    }


    /* ========================================================
       COMMUNITY MODAL
       ======================================================== */

    function setupCommunityModal() {

        const openButtons = [
            $("openCommunityButton"),
            $("communitySelectorButton"),
            $("headerCommunityButton"),
            $("railGeneralButton")
        ];

        openButtons.forEach(button => {

            if (!button) {
                return;
            }

            button.addEventListener(
                "click",
                () => {

                    /*
                     * railGeneralButton opens the General
                     * community if one exists.
                     */
                    if (
                        button.id ===
                        "railGeneralButton"
                    ) {

                        const general =
                            state.communities.find(
                                community =>
                                    community.slug ===
                                    "general"
                            );

                        if (general) {
                            selectCommunity(
                                general
                            );
                            return;
                        }
                    }

                    openCommunityModal();
                }
            );
        });


        $("closeCommunityModal")
            ?.addEventListener(
                "click",
                closeCommunityModal
            );


        const search =
            $("communityModalSearch");

        search?.addEventListener(
            "input",
            () => {

                renderCommunityModal(
                    search.value
                );

            }
        );


        $("communityModal")
            ?.addEventListener(
                "click",
                event => {

                    if (
                        event.target.id ===
                        "communityModal"
                    ) {

                        closeCommunityModal();
                    }

                }
            );
    }


    function openCommunityModal() {

        const modal =
            $("communityModal");

        if (!modal) {
            return;
        }

        modal.classList.add("open");

        modal.setAttribute(
            "aria-hidden",
            "false"
        );

        $("openCommunityButton")
            ?.setAttribute(
                "aria-expanded",
                "true"
            );

        $("communitySelectorButton")
            ?.setAttribute(
                "aria-expanded",
                "true"
            );

        $("headerCommunityButton")
            ?.setAttribute(
                "aria-expanded",
                "true"
            );

        $("communityModalSearch")
            ?.focus();
    }


    function closeCommunityModal() {

        const modal =
            $("communityModal");

        if (!modal) {
            return;
        }

        modal.classList.remove(
            "open"
        );

        modal.setAttribute(
            "aria-hidden",
            "true"
        );

        [
            $("openCommunityButton"),
            $("communitySelectorButton"),
            $("headerCommunityButton")
        ].forEach(button => {

            button?.setAttribute(
                "aria-expanded",
                "false"
            );

        });
    }


    /* ========================================================
       CHANNEL SEARCH
       ======================================================== */

    function setupChannelSearch() {

        const input =
            $("channelSearchInput");

        if (!input) {
            return;
        }

        input.addEventListener(
            "input",
            () => {

                renderChannels(
                    input.value
                );

            }
        );


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "/" &&
                    document.activeElement !== input &&
                    document.activeElement !==
                        $("messageInput")
                ) {

                    event.preventDefault();

                    input.focus();
                }

            }
        );
    }


    /* ========================================================
       REALTIME
       ======================================================== */

    async function setupCommunityRealtime() {

        cleanupRealtime();

        if (!state.selectedCommunity) {
            return;
        }

        const channelName =
            `community-${state.selectedCommunity.id}`;

        const channel =
            state.supabase
                .channel(channelName)
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_messages"
                    },
                    payload => {

                        const message =
                            payload.new ||
                            payload.old;

                        if (
                            message?.channel_id ===
                            state.selectedChannel?.id
                        ) {

                            loadMessages()
                                .catch(console.error);
                        }

                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_message_reactions"
                    },
                    () => {

                        loadMessages()
                            .catch(console.error);

                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_attachments"
                    },
                    payload => {

                        if (
                            payload.new?.message_id
                        ) {

                            loadMessages()
                                .catch(console.error);
                        }

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

        state.realtimeChannels.push(
            channel
        );
    }


    function cleanupRealtime() {

        state.realtimeChannels
            .forEach(channel => {

                try {
                    state.supabase
                        .removeChannel(
                            channel
                        );
                } catch (error) {
                    console.warn(error);
                }

            });

        state.realtimeChannels = [];
    }


    /* ========================================================
       PRESENCE
       ======================================================== */

    async function updatePresence(
        status = "online"
    ) {

        if (!state.user) {
            return;
        }

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

                    status,

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
                "Presence:",
                error
            );
        }
    }


    function setupPresence() {

        updatePresence(
            "online"
        ).catch(console.warn);

        state.presenceTimer =
            setInterval(
                () => {

                    updatePresence(
                        "online"
                    ).catch(console.warn);

                },
                CONFIG.presenceIntervalMs
            );

        window.addEventListener(
            "beforeunload",
            () => {

                /*
                 * Best effort only.
                 */
                updatePresence(
                    "offline"
                ).catch(() => {});

            }
        );
    }


    /* ========================================================
       READ STATUS
       ======================================================== */

    async function markChannelRead() {

        if (
            !state.user ||
            !state.selectedChannel
        ) {
            return;
        }

        const lastMessage =
            state.messages[
                state.messages.length - 1
            ];

        const payload = {
            channel_id:
                state.selectedChannel.id,

            user_id:
                state.user.id,

            last_read_message_id:
                lastMessage?.id || null,

            last_read_at:
                new Date().toISOString()
        };

        const {
            data
        } = await state.supabase
            .from("chat_read_status")
            .select("id")
            .eq(
                "channel_id",
                state.selectedChannel.id
            )
            .eq(
                "user_id",
                state.user.id
            )
            .maybeSingle();

        if (data) {

            await state.supabase
                .from("chat_read_status")
                .update(payload)
                .eq(
                    "id",
                    data.id
                );

        } else {

            await state.supabase
                .from("chat_read_status")
                .insert(payload);
        }
    }


    /* ========================================================
       NOTIFICATIONS
       ======================================================== */

    async function createNotification({
        userId,
        communityId = null,
        channelId = null,
        messageId = null,
        type,
        title,
        body = null
    }) {

        if (!userId) {
            return;
        }

        const {
            error
        } = await state.supabase
            .from("chat_notifications")
            .insert({
                user_id:
                    userId,

                community_id:
                    communityId,

                channel_id:
                    channelId,

                message_id:
                    messageId,

                notification_type:
                    type,

                title,

                body
            });

        if (error) {
            console.warn(
                "Notification:",
                error
            );
        }
    }


    /* ========================================================
       DYNAMIC COMMUNITY CALL BUTTON
       ======================================================== */

    function createCommunityCallButton() {

        const actions =
            document.querySelector(
                ".main-actions"
            );

        if (!actions) {
            return;
        }

        if (
            $("communityCallButton")
        ) {
            return;
        }

        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            "header-action call-action";

        button.id =
            "communityCallButton";

        button.title =
            "Start a call in this community";

        button.setAttribute(
            "aria-label",
            "Start a community call"
        );

        button.innerHTML = `
            <span aria-hidden="true">
                📞
            </span>

            <span>
                Community Call
            </span>
        `;

        const general =
            $("generalCallButton");

        if (general) {
            general.after(button);
        } else {
            actions.appendChild(button);
        }

        button.addEventListener(
            "click",
            () => {

                openCallStart(
                    "community"
                );

            }
        );
    }


    /* ========================================================
       GENERAL CALL
       ======================================================== */

    function setupGeneralCall() {

        $("generalCallButton")
            ?.addEventListener(
                "click",
                () => {

                    openCallStart(
                        "general"
                    );

                }
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


        $("startGeneralCallButton")
            ?.addEventListener(
                "click",
                async () => {

                    await createCallRoom(
                        "general"
                    );

                }
            );
    }


    function openCallStart(
        scope
    ) {

        const modal =
            $("generalCallModal");

        if (!modal) {
            return;
        }

        modal.dataset.callScope =
            scope;

        const title =
            $("generalCallTitle");

        if (title) {

            title.textContent =
                scope === "general"
                    ? "General Call"
                    : `${state.selectedCommunity?.name || "Community"} Call`;
        }

        const description =
            modal.querySelector(
                ".modal-description"
            );

        if (description) {

            description.textContent =
                scope === "general"
                    ? "Choose who you want to call."
                    : "Choose participants for this community call.";
        }

        loadCallUsers(scope)
            .catch(error => {

                console.error(error);

                setCallMessage(
                    error.message ||
                    "Could not load call participants."
                );

            });

        modal.classList.add("open");

        modal.setAttribute(
            "aria-hidden",
            "false"
        );
    }


    function closeGeneralCallModal() {

        const modal =
            $("generalCallModal");

        if (!modal) {
            return;
        }

        modal.classList.remove(
            "open"
        );

        modal.setAttribute(
            "aria-hidden",
            "true"
        );
    }


    async function loadCallUsers(
        scope
    ) {

        const list =
            $("generalCallUserList");

        if (!list) {
            return;
        }

        list.innerHTML = `
            <div class="center-state">
                Loading students...
            </div>
        `;

        let query =
            state.supabase
                .from("chat_community_members")
                .select(
                    "user_id,nickname,role,community_id"
                );

        if (
            scope === "community" &&
            state.selectedCommunity
        ) {

            query =
                query.eq(
                    "community_id",
                    state.selectedCommunity.id
                );
        }

        const {
            data,
            error
        } = await query;

        if (error) {
            throw error;
        }

        const users =
            new Map();

        (data || []).forEach(member => {

            if (
                member.user_id ===
                state.user.id
            ) {
                return;
            }

            if (!users.has(member.user_id)) {

                users.set(
                    member.user_id,
                    member
                );
            }

        });

        list.innerHTML = "";

        if (!users.size) {

            list.innerHTML = `
                <div class="center-state">
                    No other students are available.
                </div>
            `;

            return;
        }

        users.forEach(member => {

            const label =
                member.nickname ||
                `Student ${member.user_id.slice(
                    0,
                    6
                )}`;

            const row =
                document.createElement("label");

            row.className =
                "call-user-row";

            row.innerHTML = `
                <input
                    type="checkbox"
                    class="call-user-checkbox"
                    value="${escapeAttribute(
                        member.user_id
                    )}"
                >

                <span class="call-user-avatar">
                    ${escapeHTML(
                        initials(label)
                    )}
                </span>

                <span class="call-user-details">

                    <strong>
                        ${escapeHTML(label)}
                    </strong>

                    <small>
                        ${escapeHTML(
                            member.role ||
                            "student"
                        )}
                    </small>

                </span>
            `;

            list.appendChild(row);
        });

        list
            .querySelectorAll(
                ".call-user-checkbox"
            )
            .forEach(input => {

                input.addEventListener(
                    "change",
                    updateCallSelectionCount
                );

            });

        updateCallSelectionCount();
    }


    function updateCallSelectionCount() {

        const selected =
            document.querySelectorAll(
                ".call-user-checkbox:checked"
            ).length;

        const count =
            $("generalCallSelectionCount");

        if (count) {

            count.textContent =
                `${selected} selected`;
        }
    }


    function getSelectedCallUsers() {

        return [
            ...document.querySelectorAll(
                ".call-user-checkbox:checked"
            )
        ].map(
            input => input.value
        );
    }


    function setCallMessage(
        message
    ) {

        const element =
            $("generalCallMessage");

        if (element) {
            element.textContent =
                message;
        }
    }


    /* ========================================================
       CALL ROOM CREATION
       ======================================================== */

    async function createCallRoom(
        requestedScope
    ) {

        const modal =
            $("generalCallModal");

        const scope =
            requestedScope ||
            modal?.dataset.callScope ||
            "general";

        const communityId =
            scope === "community"
                ? state.selectedCommunity?.id
                : null;

        if (
            scope === "community" &&
            !communityId
        ) {

            setCallMessage(
                "Choose a community first."
            );

            return;
        }

        const selectedUsers =
            getSelectedCallUsers();

        if (!selectedUsers.length) {

            setCallMessage(
                "Select at least one student."
            );

            return;
        }

        const startButton =
            $("startGeneralCallButton");

        if (startButton) {
            startButton.disabled = true;
        }

        try {

            const roomCode =
                createRoomCode();

            const {
                data: room,
                error
            } = await state.supabase
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

            if (error) {
                throw error;
            }

            const participants = [
                state.user.id,
                ...selectedUsers
            ];

            const rows =
                participants.map(
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
                            false,

                        is_screen_sharing:
                            false,

                        joined_at:
                            userId ===
                            state.user.id
                                ? new Date()
                                    .toISOString()
                                : null
                    })
                );

            const {
                error:
                    participantError
            } = await state.supabase
                .from(
                    "chat_call_participants"
                )
                .insert(rows);

            if (participantError) {
                throw participantError;
            }

            /*
             * Create call notifications for invitees.
             */
            for (
                const userId
                of selectedUsers
            ) {

                await createNotification({
                    userId,

                    communityId,

                    type:
                        "call",

                    title:
                        scope === "community"
                            ? "Community call"
                            : "General call",

                    body:
                        `${state.profile.name} invited you to a call.`
                });
            }

            closeGeneralCallModal();

            await joinCall(
                room
            );

        } catch (error) {

            console.error(
                "Create call failed:",
                error
            );

            setCallMessage(
                error.message ||
                "Could not start the call."
            );

        } finally {

            if (startButton) {
                startButton.disabled = false;
            }
        }
    }


    function createRoomCode() {

        const random =
            crypto.randomUUID()
                .replaceAll("-", "")
                .slice(0, 12)
                .toUpperCase();

        return `MS-${random}`;
    }


    /* ========================================================
       JOIN CALL
       ======================================================== */

    async function joinCall(
        room
    ) {

        if (!room) {
            return;
        }

        if (state.call.active) {

            showMessage(
                "You are already in a call.",
                "error"
            );

            return;
        }

        state.call.active = true;
        state.call.room = room;
        state.call.startedAt =
            Date.now();

        showCallOverlay();

        updateCallHeader(
            room
        );

        try {

            await startLocalMedia();

            await updateParticipant(
                room.id,
                {
                    status:
                        "joined",

                    joined_at:
                        new Date()
                            .toISOString(),

                    is_camera_on:
                        state.call.cameraOn,

                    is_muted:
                        state.call.muted
                }
            );

            await updateRoomStatus(
                room.id,
                "active"
            );

            await setupCallSignaling();

            startCallDuration();

            showCallStatus(
                "Connected"
            );

        } catch (error) {

            console.error(
                "Call setup failed:",
                error
            );

            showCallStatus(
                "Could not access camera/microphone."
            );

            /*
             * Keep the overlay open so the user can
             * still leave the room cleanly.
             */
        }
    }


    /* ========================================================
       LOCAL MEDIA
       ======================================================== */

    async function startLocalMedia() {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            throw new Error(
                "Camera and microphone are not available in this browser."
            );
        }

        const stream =
            await navigator.mediaDevices
                .getUserMedia({
                    audio: true,
                    video: true
                });

        state.call.localStream =
            stream;

        state.call.cameraOn =
            stream
                .getVideoTracks()
                .some(
                    track => track.enabled
                );

        state.call.muted = false;

        const video =
            $("localVideo");

        if (video) {

            video.srcObject =
                stream;

            video.muted = true;

            await video.play()
                .catch(() => {});
        }

        updateCallControls();
    }


    /* ========================================================
       CALL SIGNALING
       ======================================================== */

    async function setupCallSignaling() {

        const room =
            state.call.room;

        if (!room) {
            return;
        }

        /*
         * Realtime signal subscription.
         */
        const channel =
            state.supabase
                .channel(
                    `call-signals-${room.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "chat_call_signals",
                        filter:
                            `room_id=eq.${room.id}`
                    },
                    payload => {

                        handleIncomingSignal(
                            payload.new
                        ).catch(console.error);

                    }
                )
                .subscribe(
                    status => {

                        console.log(
                            "Call signaling:",
                            status
                        );

                    }
                );

        state.call.signalSubscription =
            channel;


        /*
         * Polling fallback.

         * This makes the system less dependent on
         * realtime configuration.
         */
        state.call.signalPollTimer =
            setInterval(
                () => {

                    pollCallSignals()
                        .catch(console.error);

                },
                CONFIG.callSignalPollMs
            );

        await createOffersForExistingParticipants();
    }


    async function pollCallSignals() {

        if (
            !state.call.active ||
            !state.call.room
        ) {
            return;
        }

        const {
            data,
            error
        } = await state.supabase
            .from("chat_call_signals")
            .select("*")
            .eq(
                "room_id",
                state.call.room.id
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            )
            .limit(200);

        if (error) {
            return;
        }

        for (
            const signal
            of data || []
        ) {

            if (
                state.call.processedSignals
                    .has(signal.id)
            ) {
                continue;
            }

            state.call.processedSignals
                .add(signal.id);

            if (
                signal.sender_id ===
                state.user.id
            ) {
                continue;
            }

            if (
                signal.receiver_id &&
                signal.receiver_id !==
                state.user.id
            ) {
                continue;
            }

            await handleIncomingSignal(
                signal
            );
        }
    }


    async function createOffersForExistingParticipants() {

        if (
            !state.call.room ||
            !state.user
        ) {
            return;
        }

        const {
            data,
            error
        } = await state.supabase
            .from(
                "chat_call_participants"
            )
            .select(
                "user_id,status"
            )
            .eq(
                "room_id",
                state.call.room.id
            );

        if (error) {
            console.error(error);
            return;
        }

        for (
            const participant
            of data || []
        ) {

            if (
                participant.user_id ===
                state.user.id
            ) {
                continue;
            }

            /*
             * The lower UUID string acts as a deterministic
             * initiator to reduce offer collisions.
             */
            if (
                String(state.user.id) <
                String(participant.user_id)
            ) {

                await createPeerConnection(
                    participant.user_id,
                    true
                );
            }
        }
    }


    async function createPeerConnection(
        remoteUserId,
        createOffer = false
    ) {

        if (!remoteUserId) {
            return null;
        }

        if (
            state.call.peers.has(
                remoteUserId
            )
        ) {

            return state.call.peers.get(
                remoteUserId
            );
        }

        const pc =
            new RTCPeerConnection(
                CONFIG.rtcConfiguration
            );

        state.call.peers.set(
            remoteUserId,
            pc
        );


        /*
         * Add local media.
         */
        if (state.call.localStream) {

            state.call.localStream
                .getTracks()
                .forEach(track => {

                    pc.addTrack(
                        track,
                        state.call.localStream
                    );

                });
        }


        /*
         * Remote stream.
         */
        pc.addEventListener(
            "track",
            event => {

                const stream =
                    event.streams?.[0];

                if (!stream) {
                    return;
                }

                createRemoteVideoTile(
                    remoteUserId,
                    stream
                );
            }
        );


        /*
         * ICE candidates.
         */
        pc.addEventListener(
            "icecandidate",
            event => {

                if (
                    event.candidate
                ) {

                    sendCallSignal(
                        remoteUserId,
                        "ice-candidate",
                        event.candidate
                    ).catch(
                        console.error
                    );
                }

            }
        );


        pc.addEventListener(
            "connectionstatechange",
            () => {

                const status =
                    pc.connectionState;

                console.log(
                    `Call peer ${remoteUserId}:`,
                    status
                );

                if (
                    status ===
                        "failed" ||
                    status ===
                        "closed"
                ) {

                    removeRemoteVideoTile(
                        remoteUserId
                    );

                }

            }
        );


        if (createOffer) {

            const offer =
                await pc.createOffer();

            await pc.setLocalDescription(
                offer
            );

            await sendCallSignal(
                remoteUserId,
                "offer",
                pc.localDescription
            );
        }

        return pc;
    }


    async function handleIncomingSignal(
        signal
    ) {

        if (!signal) {
            return;
        }

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

        const senderId =
            signal.sender_id;

        const payload =
            signal.payload;

        if (!senderId || !payload) {
            return;
        }

        if (
            signal.signal_type ===
            "offer"
        ) {

            const pc =
                await createPeerConnection(
                    senderId,
                    false
                );

            await pc.setRemoteDescription(
                payload
            );

            const answer =
                await pc.createAnswer();

            await pc.setLocalDescription(
                answer
            );

            await sendCallSignal(
                senderId,
                "answer",
                pc.localDescription
            );

        } else if (
            signal.signal_type ===
            "answer"
        ) {

            const pc =
                state.call.peers.get(
                    senderId
                );

            if (!pc) {
                return;
            }

            await pc.setRemoteDescription(
                payload
            );

        } else if (
            signal.signal_type ===
            "ice-candidate"
        ) {

            const pc =
                state.call.peers.get(
                    senderId
                );

            if (!pc) {
                return;
            }

            try {

                await pc.addIceCandidate(
                    payload
                );

            } catch (error) {

                console.warn(
                    "ICE candidate:",
                    error
                );
            }

        } else if (
            signal.signal_type ===
            "leave"
        ) {

            removePeer(
                senderId
            );

        } else if (
            signal.signal_type ===
            "media-state"
        ) {

            updateRemoteParticipantState(
                senderId,
                payload
            );
        }
    }


    async function sendCallSignal(
        receiverId,
        signalType,
        payload
    ) {

        if (
            !state.call.room ||
            !state.user
        ) {
            return;
        }

        const {
            error
        } = await state.supabase
            .from("chat_call_signals")
            .insert({
                room_id:
                    state.call.room.id,

                sender_id:
                    state.user.id,

                receiver_id:
                    receiverId,

                signal_type:
                    signalType,

                payload
            });

        if (error) {
            throw error;
        }
    }


    /* ========================================================
       REMOTE VIDEO
       ======================================================== */

    function createRemoteVideoTile(
        userId,
        stream
    ) {

        const grid =
            $("callVideoGrid");

        if (!grid) {
            return;
        }

        let tile =
            document.querySelector(
                `[data-remote-user="${CSS.escape(
                    userId
                )}"]`
            );

        if (!tile) {

            tile =
                document.createElement(
                    "div"
                );

            tile.className =
                "remote-video-tile";

            tile.dataset.remoteUser =
                userId;

            tile.innerHTML = `
                <video
                    autoplay
                    playsinline
                ></video>

                <span>
                    ${escapeHTML(
                        `Student ${userId.slice(
                            0,
                            6
                        )}`
                    )}
                </span>
            `;

            grid.appendChild(
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

            video.play()
                .catch(() => {});
        }
    }


    function removeRemoteVideoTile(
        userId
    ) {

        document
            .querySelector(
                `[data-remote-user="${CSS.escape(
                    userId
                )}"]`
            )
            ?.remove();
    }


    function updateRemoteParticipantState(
        userId,
        stateData
    ) {

        const tile =
            document.querySelector(
                `[data-remote-user="${CSS.escape(
                    userId
                )}"]`
            );

        if (!tile) {
            return;
        }

        tile.dataset.muted =
            stateData.muted
                ? "true"
                : "false";

        tile.dataset.camera =
            stateData.cameraOn
                ? "on"
                : "off";
    }


    /* ========================================================
       CALL PARTICIPANT DATABASE STATE
       ======================================================== */

    async function updateParticipant(
        roomId,
        updates
    ) {

        if (!state.user) {
            return;
        }

        const {
            error
        } = await state.supabase
            .from(
                "chat_call_participants"
            )
            .update({
                ...updates,
                updated_at:
                    new Date().toISOString()
            })
            .eq(
                "room_id",
                roomId
            )
            .eq(
                "user_id",
                state.user.id
            );

        if (error) {
            console.warn(
                "Participant update:",
                error
            );
        }
    }


    async function updateRoomStatus(
        roomId,
        status
    ) {

        const updates = {
            status
        };

        if (status === "active") {

            updates.started_at =
                new Date()
                    .toISOString();
        }

        if (status === "ended") {

            updates.ended_at =
                new Date()
                    .toISOString();
        }

        const {
            error
        } = await state.supabase
            .from("chat_call_rooms")
            .update(updates)
            .eq(
                "id",
                roomId
            );

        if (error) {
            console.warn(
                "Room status:",
                error
            );
        }
    }


    /* ========================================================
       CALL UI
       ======================================================== */

    function showCallOverlay() {

        const overlay =
            $("callOverlay");

        if (!overlay) {
            return;
        }

        overlay.classList.add(
            "open"
        );

        overlay.setAttribute(
            "aria-hidden",
            "false"
        );
    }


    function hideCallOverlay() {

        const overlay =
            $("callOverlay");

        if (!overlay) {
            return;
        }

        overlay.classList.remove(
            "open"
        );

        overlay.setAttribute(
            "aria-hidden",
            "true"
        );
    }


    function updateCallHeader(room) {

        const title =
            $("callTitle");

        const subtitle =
            $("callSubtitle");

        if (title) {

            title.textContent =
                room.call_scope === "community"
                    ? `${state.selectedCommunity?.name || "Community"} Call`
                    : "Mwaniki General Call";
        }

        if (subtitle) {

            subtitle.textContent =
                `Room ${room.room_code}`;
        }
    }


    function showCallStatus(
        message
    ) {

        const subtitle =
            $("callSubtitle");

        if (subtitle) {
            subtitle.textContent =
                message;
        }
    }


    function startCallDuration() {

        stopCallDuration();

        state.call.startedAt =
            Date.now();

        const update = () => {

            const elapsed =
                Math.floor(
                    (
                        Date.now() -
                        state.call.startedAt
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

            const duration =
                $("callDuration");

            if (duration) {

                duration.textContent =
                    `${minutes}:${seconds}`;
            }
        };

        update();

        state.call.durationTimer =
            setInterval(
                update,
                1000
            );
    }


    function stopCallDuration() {

        if (
            state.call.durationTimer
        ) {

            clearInterval(
                state.call.durationTimer
            );

            state.call.durationTimer =
                null;
        }
    }


    function updateCallControls() {

        const mic =
            $("toggleMicrophoneButton");

        const camera =
            $("toggleCameraButton");

        const screen =
            $("shareScreenButton");

        if (mic) {

            mic.textContent =
                state.call.muted
                    ? "🔇"
                    : "🎙️";

            mic.setAttribute(
                "aria-label",
                state.call.muted
                    ? "Unmute microphone"
                    : "Mute microphone"
            );
        }

        if (camera) {

            camera.textContent =
                state.call.cameraOn
                    ? "📹"
                    : "🚫";

            camera.setAttribute(
                "aria-label",
                state.call.cameraOn
                    ? "Turn camera off"
                    : "Turn camera on"
            );
        }

        if (screen) {

            screen.classList.toggle(
                "active",
                state.call.screenSharing
            );
        }
    }


    /* ========================================================
       CALL CONTROLS
       ======================================================== */

    function setupCallControls() {

        $("toggleMicrophoneButton")
            ?.addEventListener(
                "click",
                toggleMicrophone
            );

        $("toggleCameraButton")
            ?.addEventListener(
                "click",
                toggleCamera
            );

        $("shareScreenButton")
            ?.addEventListener(
                "click",
                toggleScreenShare
            );

        $("leaveCallButton")
            ?.addEventListener(
                "click",
                leaveCall
            );

        $("minimizeCallButton")
            ?.addEventListener(
                "click",
                toggleMinimizeCall
            );

        $("acceptCallButton")
            ?.addEventListener(
                "click",
                acceptIncomingCall
            );

        $("declineCallButton")
            ?.addEventListener(
                "click",
                declineIncomingCall
            );
    }


    function toggleMicrophone() {

        const stream =
            state.call.localStream;

        if (!stream) {
            return;
        }

        const tracks =
            stream.getAudioTracks();

        if (!tracks.length) {
            return;
        }

        state.call.muted =
            !state.call.muted;

        tracks.forEach(
            track => {
                track.enabled =
                    !state.call.muted;
            }
        );

        updateCallControls();

        broadcastMediaState();
    }


    function toggleCamera() {

        const stream =
            state.call.localStream;

        if (!stream) {
            return;
        }

        const tracks =
            stream.getVideoTracks();

        if (!tracks.length) {
            return;
        }

        state.call.cameraOn =
            !state.call.cameraOn;

        tracks.forEach(
            track => {
                track.enabled =
                    state.call.cameraOn;
            }
        );

        updateCallControls();

        broadcastMediaState();
    }


    async function broadcastMediaState() {

        for (
            const userId
            of state.call.peers.keys()
        ) {

            try {

                await sendCallSignal(
                    userId,
                    "media-state",
                    {
                        muted:
                            state.call.muted,

                        cameraOn:
                            state.call.cameraOn,

                        screenSharing:
                            state.call.screenSharing
                    }
                );

            } catch (error) {
                console.warn(error);
            }
        }

        if (state.call.room) {

            await updateParticipant(
                state.call.room.id,
                {
                    is_muted:
                        state.call.muted,

                    is_camera_on:
                        state.call.cameraOn,

                    is_screen_sharing:
                        state.call.screenSharing
                }
            );
        }
    }


    async function toggleScreenShare() {

        if (
            !navigator.mediaDevices
                ?.getDisplayMedia
        ) {

            showCallStatus(
                "Screen sharing is not supported here."
            );

            return;
        }

        if (
            state.call.screenSharing
        ) {

            stopScreenShare();

            return;
        }

        try {

            const screenStream =
                await navigator.mediaDevices
                    .getDisplayMedia({
                        video: true
                    });

            state.call.screenStream =
                screenStream;

            const screenTrack =
                screenStream.getVideoTracks()[0];

            for (
                const pc
                of state.call.peers.values()
            ) {

                const sender =
                    pc.getSenders()
                        .find(
                            item =>
                                item.track?.kind ===
                                "video"
                        );

                if (sender) {

                    await sender.replaceTrack(
                        screenTrack
                    );
                }
            }

            state.call.screenSharing =
                true;

            screenTrack.addEventListener(
                "ended",
                () => {
                    stopScreenShare();
                }
            );

            updateCallControls();

            await broadcastMediaState();

        } catch (error) {

            console.warn(
                "Screen sharing:",
                error
            );
        }
    }


    async function stopScreenShare() {

        if (
            state.call.screenStream
        ) {

            state.call.screenStream
                .getTracks()
                .forEach(
                    track => track.stop()
                );
        }

        const cameraTrack =
            state.call.localStream
                ?.getVideoTracks()
                ?.[0];

        for (
            const pc
            of state.call.peers.values()
        ) {

            const sender =
                pc.getSenders()
                    .find(
                        item =>
                            item.track?.kind ===
                            "video"
                    );

            if (sender) {

                await sender.replaceTrack(
                    cameraTrack || null
                );
            }
        }

        state.call.screenStream =
            null;

        state.call.screenSharing =
            false;

        updateCallControls();

        await broadcastMediaState();
    }


    function toggleMinimizeCall() {

        const overlay =
            $("callOverlay");

        if (!overlay) {
            return;
        }

        state.call.minimized =
            !state.call.minimized;

        overlay.classList.toggle(
            "minimized",
            state.call.minimized
        );
    }


    /* ========================================================
       LEAVE CALL
       ======================================================== */

    async function leaveCall() {

        if (!state.call.active) {
            return;
        }

        const room =
            state.call.room;

        try {

            /*
             * Tell peers we are leaving.
             */
            for (
                const userId
                of state.call.peers.keys()
            ) {

                try {

                    await sendCallSignal(
                        userId,
                        "leave",
                        {
                            userId:
                                state.user.id
                        }
                    );

                } catch (error) {
                    console.warn(error);
                }
            }


            if (room) {

                await updateParticipant(
                    room.id,
                    {
                        status:
                            "left",

                        left_at:
                            new Date()
                                .toISOString()
                    }
                );

            }

        } finally {

            cleanupCall();

            hideCallOverlay();

            showMessage(
                "You left the call.",
                "info"
            );
        }
    }


    function cleanupCall() {

        stopCallDuration();

        if (
            state.call.signalSubscription
        ) {

            try {

                state.supabase
                    .removeChannel(
                        state.call
                            .signalSubscription
                    );

            } catch (error) {
                console.warn(error);
            }
        }

        state.call.signalSubscription =
            null;

        if (
            state.call.signalPollTimer
        ) {

            clearInterval(
                state.call.signalPollTimer
            );

            state.call.signalPollTimer =
                null;
        }

        state.call.peers
            .forEach(
                pc => {
                    try {
                        pc.close();
                    } catch {}
                }
            );

        state.call.peers.clear();

        if (
            state.call.localStream
        ) {

            state.call.localStream
                .getTracks()
                .forEach(
                    track => track.stop()
                );
        }

        if (
            state.call.screenStream
        ) {

            state.call.screenStream
                .getTracks()
                .forEach(
                    track => track.stop()
                );
        }

        state.call.localStream =
            null;

        state.call.screenStream =
            null;

        state.call.processedSignals
            .clear();

        state.call.active =
            false;

        state.call.room =
            null;

        state.call.participantId =
            null;

        state.call.muted =
            false;

        state.call.cameraOn =
            false;

        state.call.screenSharing =
            false;

        state.call.minimized =
            false;

        const video =
            $("localVideo");

        if (video) {
            video.srcObject = null;
        }

        document
            .querySelectorAll(
                ".remote-video-tile"
            )
            .forEach(
                tile => tile.remove()
            );
    }


    function removePeer(
        userId
    ) {

        const pc =
            state.call.peers.get(
                userId
            );

        if (pc) {

            try {
                pc.close();
            } catch {}
        }

        state.call.peers.delete(
            userId
        );

        removeRemoteVideoTile(
            userId
        );
    }


    /* ========================================================
       INCOMING CALLS
       ======================================================== */

    let incomingCall = null;


    async function checkIncomingCalls() {

        if (!state.user) {
            return;
        }

        const {
            data,
            error
        } = await state.supabase
            .from(
                "chat_call_participants"
            )
            .select(
                "id,room_id,status"
            )
            .eq(
                "user_id",
                state.user.id
            )
            .eq(
                "status",
                "invited"
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            )
            .limit(1);

        if (error || !data?.length) {
            return;
        }

        const participant =
            data[0];

        const {
            data: room,
            error: roomError
        } = await state.supabase
            .from("chat_call_rooms")
            .select("*")
            .eq(
                "id",
                participant.room_id
            )
            .in(
                "status",
                ["waiting", "active"]
            )
            .maybeSingle();

        if (
            roomError ||
            !room
        ) {
            return;
        }

        if (
            incomingCall?.room.id ===
            room.id
        ) {
            return;
        }

        incomingCall = {
            room,
            participant
        };

        showIncomingCall(
            room
        );
    }


    function showIncomingCall(
        room
    ) {

        const toast =
            $("incomingCallToast");

        if (!toast) {
            return;
        }

        const title =
            $("incomingCallTitle");

        const text =
            $("incomingCallText");

        if (title) {

            title.textContent =
                room.call_scope ===
                    "community"
                    ? "Community call"
                    : "General call";
        }

        if (text) {

            text.textContent =
                `${state.profile.name === ""
                    ? "Someone"
                    : "You have"
                } an incoming call.`;
        }

        toast.classList.add(
            "open"
        );

        toast.setAttribute(
            "aria-hidden",
            "false"
        );
    }


    async function acceptIncomingCall() {

        if (!incomingCall) {
            return;
        }

        const room =
            incomingCall.room;

        const participant =
            incomingCall.participant;

        incomingCall = null;

        hideIncomingCall();

        const {
            error
        } = await state.supabase
            .from(
                "chat_call_participants"
            )
            .update({
                status:
                    "joined",

                joined_at:
                    new Date()
                        .toISOString()
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

            showMessage(
                error.message ||
                "Could not accept the call.",
                "error"
            );

            return;
        }

        await joinCall(
            room
        );
    }


    async function declineIncomingCall() {

        if (!incomingCall) {
            return;
        }

        const participant =
            incomingCall.participant;

        incomingCall = null;

        hideIncomingCall();

        await state.supabase
            .from(
                "chat_call_participants"
            )
            .update({
                status:
                    "declined",

                left_at:
                    new Date()
                        .toISOString()
            })
            .eq(
                "id",
                participant.id
            )
            .eq(
                "user_id",
                state.user.id
            );
    }


    function hideIncomingCall() {

        const toast =
            $("incomingCallToast");

        if (!toast) {
            return;
        }

        toast.classList.remove(
            "open"
        );

        toast.setAttribute(
            "aria-hidden",
            "true"
        );
    }


    function setupIncomingCallPolling() {

        checkIncomingCalls()
            .catch(console.warn);

        setInterval(
            () => {

                if (
                    !state.call.active
                ) {

                    checkIncomingCalls()
                        .catch(console.warn);
                }

            },
            2500
        );
    }


    /* ========================================================
       ATTACHMENT LOAD FIX
       ======================================================== */

    async function reloadMessagesWithAttachments() {

        await loadMessages();

        await loadAttachments();

        renderMessages();
    }


    /*
     * Replace the normal loadMessages function behavior
     * for attachment support.
     */
    const originalLoadMessages =
        loadMessages;

    /*
     * We cannot reassign a function declaration cleanly
     * in all browsers here, so realtime/message loading
     * explicitly calls the attachment-aware version below.
     */


    /* ========================================================
       CLEANUP / PAGE VISIBILITY
       ======================================================== */

    function setupVisibilityHandling() {

        document.addEventListener(
            "visibilitychange",
            () => {

                if (
                    document.visibilityState ===
                    "visible"
                ) {

                    updatePresence(
                        "online"
                    ).catch(() => {});

                    if (
                        state.selectedChannel
                    ) {

                        loadMessages()
                            .then(
                                () =>
                                    loadAttachments()
                            )
                            .then(
                                renderMessages
                            )
                            .catch(
                                console.error
                            );
                    }

                }

            }
        );
    }


    /* ========================================================
       DATABASE HELPERS
       ======================================================== */

    async function safeLoadMessages() {

        const list =
            $("messageList");

        if (!state.selectedChannel) {

            renderWelcome();
            return;
        }

        const {
            data,
            error
        } = await state.supabase
            .from("chat_messages")
            .select("*")
            .eq(
                "channel_id",
                state.selectedChannel.id
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

        if (error) {
            throw error;
        }

        state.messages =
            data || [];

        await loadMessageUsers();
        await loadAttachments();
        await loadReactions();

        renderMessages();

        if (list) {
            scrollMessagesToBottom();
        }
    }


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


    /* ========================================================
       PATCH REALTIME LOADER
       ======================================================== */

    async function refreshCurrentMessages() {

        try {

            await safeLoadMessages();

        } catch (error) {

            console.error(
                "Message refresh:",
                error
            );
        }
    }


    /* ========================================================
       CHANNEL REALTIME OVERRIDE HELPER
       ======================================================== */

    async function setupMessageRealtime() {

        /*
         * A separate channel makes it easier to clean up
         * without affecting call signaling.
         */

        if (!state.selectedChannel) {
            return;
        }

        const channel =
            state.supabase
                .channel(
                    `messages-${state.selectedChannel.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_messages",
                        filter:
                            `channel_id=eq.${state.selectedChannel.id}`
                    },
                    () => {
                        refreshCurrentMessages();
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
                    () => {
                        refreshCurrentMessages();
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
                    () => {
                        refreshCurrentMessages();
                    }
                )
                .subscribe();

        state.realtimeChannels.push(
            channel
        );
    }


    /* ========================================================
       REINITIALIZE MESSAGE REALTIME WHEN CHANNEL CHANGES
       ======================================================== */

    async function refreshRealtimeForChannel() {

        /*
         * Keep community realtime simple and use polling/
         * channel-specific realtime.
         */

        const channelRealtime =
            state.realtimeChannels.filter(
                item =>
                    item.__mwanikiMessageChannel
            );

        for (
            const channel
            of channelRealtime
        ) {

            try {
                await state.supabase
                    .removeChannel(
                        channel
                    );
            } catch {}
        }

        state.realtimeChannels =
            state.realtimeChannels.filter(
                item =>
                    !item.__mwanikiMessageChannel
            );

        if (!state.selectedChannel) {
            return;
        }

        const channel =
            state.supabase
                .channel(
                    `message-channel-${state.selectedChannel.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table:
                            "chat_messages",
                        filter:
                            `channel_id=eq.${state.selectedChannel.id}`
                    },
                    refreshCurrentMessages
                )
                .subscribe();

        channel.__mwanikiMessageChannel =
            true;

        state.realtimeChannels.push(
            channel
        );
    }


    /* ========================================================
       OVERRIDE SELECT CHANNEL WITH REALTIME REFRESH
       ======================================================== */

    async function finalizeChannelRealtime() {

        try {
            await refreshRealtimeForChannel();
        } catch (error) {
            console.warn(error);
        }
    }


    /* ========================================================
       GENERAL CALL MODAL BACKDROP
       ======================================================== */

    function setupGeneralCallModalBackdrop() {

        const modal =
            $("generalCallModal");

        modal?.addEventListener(
            "click",
            event => {

                if (
                    event.target === modal
                ) {

                    closeGeneralCallModal();
                }

            }
        );
    }


    /* ========================================================
       HANDLE WINDOW UNLOAD
       ======================================================== */

    window.addEventListener(
        "beforeunload",
        () => {

            if (
                state.call.active &&
                state.call.room
            ) {

                updateParticipant(
                    state.call.room.id,
                    {
                        status:
                            "left",

                        left_at:
                            new Date()
                                .toISOString()
                    }
                ).catch(() => {});
            }

        }
    );


    /* ========================================================
       MAIN INITIALIZATION
       ======================================================== */

    async function init() {

        console.log(
            "🚀 Mwaniki Scholars Community starting..."
        );

        try {

            state.supabase =
                await waitForSupabase();

            console.log(
                "✅ Supabase client ready"
            );


            await loadUser();

            console.log(
                "✅ Authenticated as:",
                state.user.id
            );


            setupNavigation();

            setupComposer();

            setupAttachments();

            setupEmojiPicker();

            setupCommunityModal();

            setupChannelSearch();

            setupGeneralCall();

            setupGeneralCallModalBackdrop();

            setupCallControls();

            setupPresence();

            setupVisibilityHandling();

            createCommunityCallButton();

            setupIncomingCallPolling();


            /*
             * Load communities after all UI handlers
             * are ready.
             */
            await loadCommunities();


            /*
             * Ensure attachments are displayed on the
             * initially selected channel.
             */
            if (state.selectedChannel) {

                await loadAttachments();

                renderMessages();

                await finalizeChannelRealtime();
            }


            console.log(
                "✅ Mwaniki Scholars Community loaded"
            );

            announce(
                "Community loaded successfully."
            );

        } catch (error) {

            console.error(
                "❌ Community initialization failed:",
                error
            );

            showMessage(
                error.message ||
                "Community failed to load.",
                "error"
            );
        }
    }


    /* ========================================================
       EXPOSE DEBUG API
       ======================================================== */

    window.MwanikiCommunity = {
        state,

        reload: init,

        loadCommunities,

        loadChannels,

        loadMessages:
            safeLoadMessages,

        selectCommunity,

        selectChannel,

        sendMessage,

        deleteMessage,

        openCommunityModal,

        closeCommunityModal,

        openCallStart,

        joinCall,

        leaveCall
    };


    /* ========================================================
       START
       ======================================================== */

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
