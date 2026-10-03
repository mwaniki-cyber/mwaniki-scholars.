/* ============================================================
   MWANIKI SCHOLARS COMMUNITY
   CLEAN COMMUNITY ENGINE
   ============================================================ */

(() => {
    "use strict";

    console.log("🚀 Mwaniki Scholars Community starting...");

    /* =========================================================
       CONFIG
       ========================================================= */

    const CONFIG = {
        dashboardUrl: "./dashboard.html",

        attachmentBucket: "chat-attachments",

        maxFileSize: 25 * 1024 * 1024,

        realtimeDebounce: 150,

        defaultCommunityName: "Mwaniki Scholars",

        emojis: [
            "😀", "😂", "🤣", "😊", "😍", "🥰",
            "😎", "🤔", "😮", "😢", "😡", "😭",
            "👍", "👎", "👏", "🙏", "❤️", "🔥",
            "🎉", "💯", "✅", "❌", "⭐", "💡",
            "📚", "🧠", "🩺", "💊", "🔬", "🧬"
        ]
    };


    /* =========================================================
       STATE
       ========================================================= */

    const state = {
        supabase: null,

        user: null,

        currentCommunity: null,
        currentChannel: null,

        communities: [],
        channels: [],
        messages: [],

        communitySubscription: null,
        channelSubscription: null,
        callSubscription: null,
        signalSubscription: null,

        currentCallRoom: null,
        currentCallParticipant: null,

        localStream: null,
        screenStream: null,

        peerConnections: new Map(),

        callStartedAt: null,
        callTimer: null,

        microphoneEnabled: true,
        cameraEnabled: true,
        screenSharing: false,

        selectedCallUsers: new Set(),

        incomingCall: null,

        emojiPicker: null,

        isSending: false,
        isLoadingMessages: false,
        isLoadingChannels: false,

        initialized: false
    };


    /* =========================================================
       DOM HELPERS
       ========================================================= */

    const $ = (id) => document.getElementById(id);

    const qs = (selector, parent = document) =>
        parent.querySelector(selector);

    const qsa = (selector, parent = document) =>
        [...parent.querySelectorAll(selector)];


    /* =========================================================
       SAFE TEXT
       ========================================================= */

    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* =========================================================
       STATUS
       ========================================================= */

    function announce(message) {

        const el = $("accessibilityAnnouncer");

        if (el) {
            el.textContent = message;
        }

        const status = $("communityStatus");

        if (status) {
            status.textContent = message;
        }
    }


    function notify(message) {

        console.log("Community:", message);

        announce(message);
    }


    /* =========================================================
       WAIT FOR SUPABASE
       ========================================================= */

    async function waitForSupabase(timeout = 10000) {

        const start = Date.now();

        while (!window.supabase && Date.now() - start < timeout) {

            await new Promise(resolve =>
                setTimeout(resolve, 100)
            );
        }

        if (!window.supabase) {
            throw new Error(
                "Supabase client was not found. Check supabase.js."
            );
        }

        state.supabase = window.supabase;

        console.log("✅ Supabase client ready");

        return state.supabase;
    }


    /* =========================================================
       AUTH
       ========================================================= */

    async function loadCurrentUser() {

        const {
            data,
            error
        } = await state.supabase.auth.getUser();

        if (error) {
            throw error;
        }

        if (!data?.user) {

            console.warn("No authenticated user.");

            window.location.href = "./index.html";

            return null;
        }

        state.user = data.user;

        console.log(
            "✅ Authenticated as:",
            state.user.id
        );

        updateUserUI();

        return state.user;
    }


    /* =========================================================
       USER UI
       No student_profiles dependency.
       ========================================================= */

    function getUserName() {

        const metadata = state.user?.user_metadata || {};

        return (
            metadata.full_name ||
            metadata.fullName ||
            metadata.name ||
            metadata.username ||
            metadata.display_name ||
            metadata.displayName ||
            state.user?.email?.split("@")[0] ||
            "Student"
        );
    }


    function getUserAvatar() {

        const metadata = state.user?.user_metadata || {};

        return (
            metadata.avatar_url ||
            metadata.avatarUrl ||
            metadata.picture ||
            ""
        );
    }


    function updateUserUI() {

        const name = getUserName();
        const avatar = getUserAvatar();

        const nameElements = [
            $("sidebarProfileName")
        ];

        nameElements.forEach(el => {

            if (el) {
                el.textContent = name;
            }
        });


        const avatars = [
            $("sidebarProfileAvatar"),
            $("railProfileAvatar")
        ];

        avatars.forEach(img => {

            if (!img) return;

            if (avatar) {

                img.src = avatar;
                img.style.display = "block";

            } else {

                img.removeAttribute("src");
                img.style.display = "none";

                const parent = img.parentElement;

                if (parent) {
                    parent.dataset.initials =
                        getInitials(name);
                }
            }
        });
    }


    function getInitials(name) {

        const parts = String(name)
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        if (!parts.length) return "MS";

        return parts
            .slice(0, 2)
            .map(x => x[0])
            .join("")
            .toUpperCase();
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
                "Community loading error:",
                error
            );

            renderCommunityError(error.message);

            return [];
        }

        state.communities = data || [];

        renderCommunityRail();
        renderCommunityChoices();

        if (!state.currentCommunity) {

            let selected =
                state.communities.find(
                    community =>
                        community.slug === "mwaniki-scholars"
                );

            if (!selected) {

                selected =
                    state.communities[0];
            }

            if (selected) {

                await selectCommunity(
                    selected.id
                );
            }
        }

        return state.communities;
    }


    /* =========================================================
       COMMUNITY RAIL
       ========================================================= */

    function renderCommunityRail() {

        const container =
            $("communityRailList");

        if (!container) return;

        container.innerHTML = "";

        state.communities.forEach(community => {

            const button =
                document.createElement("button");

            button.type = "button";
            button.className = "rail-community-icon";

            if (
                state.currentCommunity &&
                state.currentCommunity.id === community.id
            ) {
                button.classList.add("active");
            }

            button.title = community.name;
            button.setAttribute(
                "aria-label",
                `Open ${community.name}`
            );

            /*
             * IMPORTANT:
             * icon_url is only treated as an actual URL
             * when it looks like one.
             *
             * Otherwise use initials/text.
             */

            if (
                community.icon_url &&
                isImageURL(community.icon_url)
            ) {

                const img =
                    document.createElement("img");

                img.src = community.icon_url;
                img.alt = "";
                img.loading = "lazy";

                button.appendChild(img);

            } else {

                button.textContent =
                    getCommunityIcon(community);
            }

            button.addEventListener(
                "click",
                () => selectCommunity(community.id)
            );

            container.appendChild(button);
        });
    }


    function isImageURL(value) {

        return /^https?:\/\//i.test(value) ||
               /^\/|^\.\//.test(value) ||
               /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(value);
    }


    function getCommunityIcon(community) {

        const name =
            String(community?.name || "");

        const lower =
            name.toLowerCase();

        /*
         * Emoji here are TEXT, never image URLs.
         */

        if (lower.includes("gaming")) return "🎮";
        if (lower.includes("meme")) return "😂";
        if (lower.includes("general")) return "💬";

        return getInitials(name);
    }


    /* =========================================================
       COMMUNITY CHOICE MODAL
       ========================================================= */

    function renderCommunityChoices() {

        const container =
            $("communityChoiceList");

        if (!container) return;

        const search =
            ($("communityModalSearch")?.value || "")
                .trim()
                .toLowerCase();

        container.innerHTML = "";

        const filtered =
            state.communities.filter(community => {

                if (!search) return true;

                return (
                    community.name
                        ?.toLowerCase()
                        .includes(search) ||

                    community.description
                        ?.toLowerCase()
                        .includes(search)
                );
            });


        if (!filtered.length) {

            container.innerHTML = `
                <div class="center-state">
                    No communities found.
                </div>
            `;

            return;
        }


        filtered.forEach(community => {

            const item =
                document.createElement("button");

            item.type = "button";

            item.className =
                "community-choice";

            if (
                state.currentCommunity &&
                state.currentCommunity.id === community.id
            ) {
                item.classList.add("active");
            }

            const icon =
                document.createElement("span");

            icon.className =
                "community-choice-icon";

            if (
                community.icon_url &&
                isImageURL(community.icon_url)
            ) {

                const img =
                    document.createElement("img");

                img.src = community.icon_url;
                img.alt = "";

                icon.appendChild(img);

            } else {

                icon.textContent =
                    getCommunityIcon(community);
            }


            const text =
                document.createElement("span");

            text.className =
                "community-choice-text";

            text.innerHTML = `
                <strong>
                    ${escapeHTML(community.name)}
                </strong>

                <small>
                    ${escapeHTML(
                        community.description || ""
                    )}
                </small>
            `;


            item.appendChild(icon);
            item.appendChild(text);


            item.addEventListener(
                "click",
                async () => {

                    await selectCommunity(
                        community.id
                    );

                    closeModal(
                        $("communityModal")
                    );
                }
            );


            container.appendChild(item);
        });
    }


    /* =========================================================
       SELECT COMMUNITY
       ========================================================= */

    async function selectCommunity(
        communityId
    ) {

        const community =
            state.communities.find(
                item => item.id === communityId
            );

        if (!community) return;

        state.currentCommunity =
            community;

        state.currentChannel = null;
        state.messages = [];

        updateCommunityUI();

        renderCommunityRail();

        renderCommunityChoices();

        unsubscribeChannelRealtime();

        await loadChannels(community.id);

        await subscribeCommunityRealtime(
            community.id
        );
    }


    function updateCommunityUI() {

        const community =
            state.currentCommunity;

        if (!community) return;


        const name =
            $("selectedCommunityName");

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


        const icon =
            $("selectedCommunityIcon");

        if (icon) {

            if (
                community.icon_url &&
                isImageURL(community.icon_url)
            ) {

                icon.innerHTML = "";

                const img =
                    document.createElement("img");

                img.src =
                    community.icon_url;

                img.alt = "";

                icon.appendChild(img);

            } else {

                icon.textContent =
                    getCommunityIcon(
                        community
                    );
            }
        }


        const title =
            $("communityBrandTitle");

        if (title) {
            title.textContent =
                community.name;
        }


        const subtitle =
            $("communityBrandSubtitle");

        if (subtitle) {
            subtitle.textContent =
                community.description ||
                "Learn • Discuss • Connect";
        }
    }


    /* =========================================================
       CHANNELS
       ========================================================= */

    async function loadChannels(
        communityId
    ) {

        state.isLoadingChannels = true;

        renderChannelLoading();

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


        state.isLoadingChannels = false;


        if (error) {

            console.error(
                "Channel loading error:",
                error
            );

            renderChannelError(
                error.message
            );

            return [];
        }


        state.channels =
            data || [];

        renderChannels();


        if (!state.currentChannel) {

            const first =
                state.channels[0];

            if (first) {

                await selectChannel(
                    first.id
                );
            } else {

                renderEmptyChannel();
            }
        }

        return state.channels;
    }


    function renderChannelLoading() {

        const container =
            $("channelList");

        if (!container) return;

        container.innerHTML = `
            <div class="center-state" role="status">
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


    function renderChannelError(message) {

        const container =
            $("channelList");

        if (!container) return;

        container.innerHTML = `
            <div class="center-state">
                <strong>Could not load channels.</strong>
                <small>
                    ${escapeHTML(message)}
                </small>
            </div>
        `;
    }


    function renderEmptyChannel() {

        const container =
            $("channelList");

        if (!container) return;

        container.innerHTML = `
            <div class="center-state">
                No channels are available.
            </div>
        `;
    }


    function renderChannels() {

        const container =
            $("channelList");

        if (!container) return;

        const search =
            ($("channelSearchInput")?.value || "")
                .trim()
                .toLowerCase();


        container.innerHTML = "";


        const filtered =
            state.channels.filter(channel => {

                if (!search) return true;

                return (
                    channel.name
                        ?.toLowerCase()
                        .includes(search) ||

                    channel.description
                        ?.toLowerCase()
                        .includes(search)
                );
            });


        if (!filtered.length) {

            container.innerHTML = `
                <div class="center-state">
                    No matching channels.
                </div>
            `;

            return;
        }


        filtered.forEach(channel => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "channel-button";

            if (
                state.currentChannel &&
                state.currentChannel.id === channel.id
            ) {
                button.classList.add("active");
            }


            const icon =
                channel.icon ||
                (
                    channel.channel_type === "voice"
                        ? "🔊"
                        : "#"
                );


            button.innerHTML = `
                <span
                    class="channel-icon"
                    aria-hidden="true"
                >${escapeHTML(icon)}</span>

                <span class="channel-name">
                    ${escapeHTML(channel.name)}
                </span>
            `;


            button.title =
                channel.description ||
                channel.name;


            button.addEventListener(
                "click",
                () => selectChannel(channel.id)
            );


            container.appendChild(button);
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

        state.currentChannel =
            channel;

        updateChannelUI();

        renderChannels();

        closeEmojiPicker();

        await loadMessages(channel.id);

        await subscribeChannelRealtime(
            channel.id
        );

        await markChannelRead(
            channel.id
        );
    }


    function updateChannelUI() {

        const channel =
            state.currentChannel;

        if (!channel) return;


        const title =
            $("mainChannelTitle");

        if (title) {

            title.textContent =
                `# ${channel.name}`;
        }


        const description =
            $("mainChannelDescription");

        if (description) {

            description.textContent =
                channel.description ||
                "Channel discussion";
        }


        const input =
            $("messageInput");

        if (input) {

            input.placeholder =
                `Message #${channel.name}...`;

            input.disabled = false;
        }


        const send =
            $("sendMessageButton");

        if (send) {

            send.disabled = false;
        }
    }


    /* =========================================================
       MESSAGES
       ========================================================= */

    async function loadMessages(
        channelId
    ) {

        state.isLoadingMessages = true;

        renderMessageLoading();


        const {
            data,
            error
        } = await state.supabase
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
                ascending: true
            })
            .limit(200);


        state.isLoadingMessages = false;


        if (error) {

            console.error(
                "Message loading error:",
                error
            );

            renderMessageError(
                error.message
            );

            return;
        }


        state.messages =
            data || [];

        renderMessages();
    }


    function renderMessageLoading() {

        const container =
            $("messageList");

        if (!container) return;

        container.innerHTML = `
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
    }


    function renderMessageError(message) {

        const container =
            $("messageList");

        if (!container) return;

        container.innerHTML = `
            <div class="center-state">
                Could not load messages.
                <small>
                    ${escapeHTML(message)}
                </small>
            </div>
        `;
    }


    function renderMessages() {

        const container =
            $("messageList");

        if (!container) return;


        if (!state.messages.length) {

            container.innerHTML = `
                <div class="welcome-card">

                    <div
                        class="welcome-icon"
                        aria-hidden="true"
                    >
                        💬
                    </div>

                    <h2>
                        Welcome to #${escapeHTML(
                            state.currentChannel?.name ||
                            "this channel"
                        )}
                    </h2>

                    <p>
                        Start the conversation.
                    </p>

                    <button
                        type="button"
                        class="header-action primary"
                        id="emptyChannelStartButton"
                    >
                        Start Conversation
                    </button>

                </div>
            `;

            $("emptyChannelStartButton")
                ?.addEventListener(
                    "click",
                    focusComposer
                );

            return;
        }


        container.innerHTML = "";


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


    function createMessageElement(
        message
    ) {

        const article =
            document.createElement("article");

        article.className =
            "message";

        article.dataset.messageId =
            message.id;


        const isOwn =
            message.user_id === state.user?.id;


        if (isOwn) {
            article.classList.add("own-message");
        }


        const deleted =
            message.is_deleted;


        const name =
            isOwn
                ? getUserName()
                : `Student ${String(
                    message.user_id || ""
                ).slice(0, 6)}`;


        const time =
            formatMessageTime(
                message.created_at
            );


        let content = "";


        if (deleted) {

            content = `
                <div class="message-deleted">
                    This message was deleted.
                </div>
            `;

        } else {

            content = `
                <div class="message-content">
                    ${formatMessageContent(
                        message.content || ""
                    )}
                </div>
            `;
        }


        article.innerHTML = `
            <div class="message-avatar">
                ${escapeHTML(
                    getInitials(name)
                )}
            </div>

            <div class="message-body">

                <div class="message-meta">

                    <strong>
                        ${escapeHTML(name)}
                    </strong>

                    <time datetime="${
                        escapeHTML(
                            message.created_at
                        )
                    }">
                        ${escapeHTML(time)}
                    </time>

                    ${
                        message.is_edited
                            ? `<span>(edited)</span>`
                            : ""
                    }

                </div>

                ${content}

                <div class="message-attachments"
                     data-attachments-for="${
                         message.id
                     }">
                </div>

            </div>

            ${
                !deleted && isOwn
                    ? `
                        <div class="message-actions">

                            <button
                                type="button"
                                class="message-action delete-message-button"
                                title="Delete message"
                                aria-label="Delete message"
                            >
                                🗑️
                            </button>

                        </div>
                    `
                    : ""
            }
        `;


        const deleteButton =
            qs(
                ".delete-message-button",
                article
            );


        if (deleteButton) {

            deleteButton.addEventListener(
                "click",
                () => deleteMessage(
                    message.id
                )
            );
        }


        loadMessageAttachments(
            message.id,
            article
        );


        return article;
    }


    function formatMessageContent(
        text
    ) {

        return escapeHTML(text)
            .replace(/\n/g, "<br>");
    }


    function formatMessageTime(
        value
    ) {

        if (!value) return "";

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
            undefined,
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }


    function scrollMessagesToBottom() {

        const container =
            $("messageList");

        if (!container) return;

        requestAnimationFrame(() => {

            container.scrollTop =
                container.scrollHeight;
        });
    }


    function focusComposer() {

        const input =
            $("messageInput");

        if (!input) return;

        input.focus();
    }


    /* =========================================================
       SEND MESSAGE
       ========================================================= */

    async function handleMessageSubmit(
        event
    ) {

        event.preventDefault();

        if (state.isSending) return;

        const input =
            $("messageInput");

        if (!input) return;

        const content =
            input.value.trim();


        if (!content) return;

        if (!state.user) {

            notify(
                "You must be signed in."
            );

            return;
        }


        if (!state.currentChannel) {

            notify(
                "Choose a channel first."
            );

            return;
        }


        state.isSending = true;

        const sendButton =
            $("sendMessageButton");

        if (sendButton) {
            sendButton.disabled = true;
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

                message_type: "text"
            })
            .select()
            .single();


        state.isSending = false;


        if (sendButton) {
            sendButton.disabled = false;
        }


        if (error) {

            console.error(
                "Send message error:",
                error
            );

            notify(
                `Could not send message: ${
                    error.message
                }`
            );

            return;
        }


        input.value = "";

        autoResizeTextarea(input);

        input.focus();


        /*
         * Realtime normally adds the message.
         * This fallback makes the UI immediate.
         */

        if (
            data &&
            !state.messages.some(
                item => item.id === data.id
            )
        ) {

            state.messages.push(data);

            renderMessages();
        }
    }


    /* =========================================================
       DELETE MESSAGE
       ========================================================= */

    async function deleteMessage(
        messageId
    ) {

        const message =
            state.messages.find(
                item => item.id === messageId
            );


        if (!message) return;


        if (
            message.user_id !==
            state.user?.id
        ) {

            notify(
                "You can only delete your own messages."
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
        } = await state.supabase
            .from("chat_messages")
            .update({
                is_deleted: true,
                deleted_at: new Date().toISOString(),
                content: null,
                updated_at: new Date().toISOString()
            })
            .eq("id", messageId)
            .eq("user_id", state.user.id);


        if (error) {

            console.error(
                "Delete message error:",
                error
            );

            notify(
                `Could not delete message: ${
                    error.message
                }`
            );

            return;
        }


        message.is_deleted = true;
        message.content = null;

        renderMessages();

        notify("Message deleted.");
    }


    /* =========================================================
       ATTACHMENTS
       ========================================================= */

    function createFileInput() {

        const input =
            document.createElement("input");

        input.type = "file";

        input.multiple = true;

        input.accept =
            "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip";

        input.style.display = "none";

        document.body.appendChild(input);

        input.addEventListener(
            "change",
            async () => {

                const files =
                    [...input.files];

                input.value = "";

                for (const file of files) {

                    await uploadAttachment(
                        file
                    );
                }
            }
        );

        return input;
    }


    async function uploadAttachment(
        file
    ) {

        if (!state.user) {

            notify(
                "You must be signed in."
            );

            return;
        }


        if (!state.currentChannel) {

            notify(
                "Choose a channel first."
            );

            return;
        }


        if (
            file.size >
            CONFIG.maxFileSize
        ) {

            notify(
                "File is larger than 25 MB."
            );

            return;
        }


        notify(
            `Uploading ${file.name}...`
        );


        const safeName =
            sanitizeFileName(
                file.name
            );


        const path =
            `${state.user.id}/${
                Date.now()
            }_${safeName}`;


        const {
            error: uploadError
        } = await state.supabase
            .storage
            .from(CONFIG.attachmentBucket)
            .upload(
                path,
                file,
                {
                    cacheControl: "3600",
                    upsert: false,
                    contentType:
                        file.type ||
                        "application/octet-stream"
                }
            );


        if (uploadError) {

            console.error(
                "Attachment upload error:",
                uploadError
            );

            notify(
                `Upload failed: ${
                    uploadError.message
                }`
            );

            return;
        }


        const {
            data: publicData
        } = state.supabase
            .storage
            .from(CONFIG.attachmentBucket)
            .getPublicUrl(path);


        const fileUrl =
            publicData?.publicUrl || null;


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
                    isImageFile(file)
                        ? "image"
                        : "file"
            })
            .select()
            .single();


        if (messageError) {

            console.error(
                "Attachment message error:",
                messageError
            );

            notify(
                `Could not create attachment message: ${
                    messageError.message
                }`
            );

            return;
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
                    file.type || null,

                file_size:
                    file.size
            });


        if (attachmentError) {

            console.error(
                "Attachment record error:",
                attachmentError
            );

            notify(
                `Attachment record failed: ${
                    attachmentError.message
                }`
            );

            return;
        }


        notify(
            "File uploaded."
        );


        await loadMessages(
            state.currentChannel.id
        );
    }


    function sanitizeFileName(
        name
    ) {

        return String(name)
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .slice(0, 150);
    }


    function isImageFile(file) {

        return /^image\//i.test(
            file.type || ""
        );
    }


    async function loadMessageAttachments(
        messageId,
        article
    ) {

        const {
            data,
            error
        } = await state.supabase
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
            .eq(
                "message_id",
                messageId
            )
            .order("created_at", {
                ascending: true
            });


        if (error) {

            console.warn(
                "Attachment lookup:",
                error.message
            );

            return;
        }


        const container =
            qs(
                ".message-attachments",
                article
            );

        if (!container) return;


        data?.forEach(file => {

            const item =
                document.createElement("div");

            item.className =
                "message-attachment";


            if (
                /^image\//i.test(
                    file.mime_type || ""
                ) &&
                file.file_url
            ) {

                const img =
                    document.createElement("img");

                img.src =
                    file.file_url;

                img.alt =
                    file.file_name;

                img.loading = "lazy";

                item.appendChild(img);

            } else {

                const link =
                    document.createElement("a");

                link.href =
                    file.file_url ||
                    "#";

                link.target =
                    "_blank";

                link.rel =
                    "noopener noreferrer";

                link.textContent =
                    `📎 ${file.file_name}`;

                item.appendChild(link);
            }


            container.appendChild(item);
        });
    }


    /* =========================================================
       EMOJI
       ========================================================= */

    function createEmojiPicker() {

        closeEmojiPicker();


        const picker =
            document.createElement("div");

        picker.id =
            "communityEmojiPicker";

        picker.className =
            "community-emoji-picker";


        CONFIG.emojis.forEach(emoji => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.textContent =
                emoji;

            button.setAttribute(
                "aria-label",
                `Insert ${emoji}`
            );

            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    insertEmoji(
                        emoji
                    );
                }
            );

            picker.appendChild(button);
        });


        document.body.appendChild(
            picker
        );

        state.emojiPicker =
            picker;


        positionEmojiPicker();


        document.addEventListener(
            "click",
            handleOutsideEmojiClick,
            true
        );
    }


    function positionEmojiPicker() {

        const picker =
            state.emojiPicker;

        const button =
            $("emojiButton");

        if (!picker || !button) return;


        const rect =
            button.getBoundingClientRect();


        picker.style.position =
            "fixed";

        picker.style.left =
            `${Math.max(
                8,
                rect.left
            )}px`;

        picker.style.bottom =
            `${Math.max(
                8,
                window.innerHeight -
                rect.top +
                8
            )}px`;

        picker.style.zIndex =
            "99999";
    }


    function handleOutsideEmojiClick(
        event
    ) {

        const picker =
            state.emojiPicker;

        const button =
            $("emojiButton");


        if (!picker) return;


        if (
            picker.contains(event.target) ||
            button?.contains(event.target)
        ) {
            return;
        }


        closeEmojiPicker();
    }


    function closeEmojiPicker() {

        if (
            state.emojiPicker &&
            state.emojiPicker.parentNode
        ) {

            state.emojiPicker
                .parentNode
                .removeChild(
                    state.emojiPicker
                );
        }


        state.emojiPicker = null;

        document.removeEventListener(
            "click",
            handleOutsideEmojiClick,
            true
        );


        const button =
            $("emojiButton");

        if (button) {

            button.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    }


    function toggleEmojiPicker() {

        if (state.emojiPicker) {

            closeEmojiPicker();

            return;
        }


        createEmojiPicker();


        const button =
            $("emojiButton");

        if (button) {

            button.setAttribute(
                "aria-expanded",
                "true"
            );
        }
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


        input.focus();


        const cursor =
            start + emoji.length;

        input.setSelectionRange(
            cursor,
            cursor
        );


        autoResizeTextarea(
            input
        );
    }


    /* =========================================================
       MODALS
       ========================================================= */

    function openModal(
        modal
    ) {

        if (!modal) return;


        modal.classList.add("open");

        modal.setAttribute(
            "aria-hidden",
            "false"
        );


        const closeButton =
            qs(
                ".modal-close",
                modal
            );


        setTimeout(() => {

            (
                closeButton ||
                qs(
                    "button,input",
                    modal
                )
            )?.focus();

        }, 0);
    }


    function closeModal(
        modal
    ) {

        if (!modal) return;


        /*
         * IMPORTANT:
         * Remove focus BEFORE aria-hidden.
         * This fixes the exact browser warning
         * shown in your console.
         */

        if (
            modal.contains(
                document.activeElement
            )
        ) {

            document.activeElement.blur();
        }


        modal.classList.remove("open");

        modal.setAttribute(
            "aria-hidden",
            "true"
        );
    }


    /* =========================================================
       COMMUNITY REALTIME
       ========================================================= */

    async function subscribeCommunityRealtime(
        communityId
    ) {

        unsubscribeCommunityRealtime();


        const channelName =
            `community-${communityId}`;


        state.communitySubscription =
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
                        table: "chat_communities",
                        filter:
                            `id=eq.${communityId}`
                    },
                    async () => {

                        await loadCommunities();
                    }
                )
                .subscribe(status => {

                    console.log(
                        "Community realtime:",
                        status
                    );
                });
    }


    function unsubscribeCommunityRealtime() {

        if (
            state.communitySubscription
        ) {

            state.supabase.removeChannel(
                state.communitySubscription
            );

            state.communitySubscription =
                null;
        }
    }


    /* =========================================================
       MESSAGE REALTIME
       ========================================================= */

    async function subscribeChannelRealtime(
        channelId
    ) {

        unsubscribeChannelRealtime();


        const channelName =
            `messages-${channelId}`;


        state.channelSubscription =
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
                    payload => {

                        addRealtimeMessage(
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
                    payload => {

                        updateRealtimeMessage(
                            payload.new
                        );
                    }
                )
                .subscribe(status => {

                    console.log(
                        "Message realtime:",
                        status
                    );
                });
    }


    function unsubscribeChannelRealtime() {

        if (
            state.channelSubscription
        ) {

            state.supabase.removeChannel(
                state.channelSubscription
            );

            state.channelSubscription =
                null;
        }
    }


    function addRealtimeMessage(
        message
    ) {

        if (
            !message ||
            state.messages.some(
                item => item.id === message.id
            )
        ) {
            return;
        }


        if (
            message.channel_id !==
            state.currentChannel?.id
        ) {
            return;
        }


        state.messages.push(
            message
        );

        state.messages.sort(
            (a, b) =>
                new Date(a.created_at) -
                new Date(b.created_at)
        );


        renderMessages();

        markChannelRead(
            state.currentChannel.id
        );
    }


    function updateRealtimeMessage(
        message
    ) {

        const index =
            state.messages.findIndex(
                item =>
                    item.id === message.id
            );


        if (index === -1) return;


        state.messages[index] =
            message;

        renderMessages();
    }


    /* =========================================================
       READ STATUS
       ========================================================= */

    async function markChannelRead(
        channelId
    ) {

        if (!state.user) return;

        const last =
            state.messages[
                state.messages.length - 1
            ];


        const values = {
            channel_id: channelId,
            user_id: state.user.id,
            last_read_message_id:
                last?.id || null,
            last_read_at:
                new Date().toISOString()
        };


        const {
            error
        } = await state.supabase
            .from("chat_read_status")
            .upsert(
                values,
                {
                    onConflict:
                        "channel_id,user_id"
                }
            );


        if (error) {

            /*
             * Don't break the community if the
             * database has not created the expected
             * unique constraint yet.
             */

            console.debug(
                "Read status:",
                error.message
            );
        }
    }


    /* =========================================================
       GENERAL CALL MODAL
       ========================================================= */

    async function openGeneralCallModal() {

        const modal =
            $("generalCallModal");

        if (!modal) return;


        state.selectedCallUsers.clear();

        updateCallSelectionCount();

        openModal(modal);

        await loadCallUsers();
    }


    async function loadCallUsers() {

        const list =
            $("generalCallUserList");

        const status =
            $("generalCallUserStatus");


        if (!list) return;


        list.innerHTML = `
            <div class="center-state">
                Loading students...
            </div>
        `;


        /*
         * We deliberately do not use student_profiles.
         *
         * Supabase Auth users are not readable from the
         * browser with the anon key.
         *
         * Instead, discover community members from the
         * current community membership table.
         */

        if (!state.currentCommunity) {

            list.innerHTML = `
                <div class="center-state">
                    Choose a community first.
                </div>
            `;

            return;
        }


        const {
            data,
            error
        } = await state.supabase
            .from("chat_community_members")
            .select(`
                user_id,
                nickname,
                role,
                is_muted,
                is_banned,
                last_seen_at
            `)
            .eq(
                "community_id",
                state.currentCommunity.id
            )
            .eq("is_banned", false)
            .neq(
                "user_id",
                state.user.id
            )
            .order(
                "last_seen_at",
                {
                    ascending: false,
                    nullsFirst: false
                }
            );


        if (error) {

            console.error(
                "Call users:",
                error
            );

            list.innerHTML = `
                <div class="center-state">
                    Could not load call users.
                    <small>
                        ${escapeHTML(
                            error.message
                        )}
                    </small>
                </div>
            `;

            if (status) {
                status.textContent =
                    "Could not load students.";
            }

            return;
        }


        if (!data?.length) {

            list.innerHTML = `
                <div class="center-state">
                    No other community members found.
                </div>
            `;

            if (status) {
                status.textContent =
                    "No students available.";
            }

            return;
        }


        list.innerHTML = "";


        data.forEach(member => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "call-user-item";


            const name =
                member.nickname ||
                `Student ${String(
                    member.user_id
                ).slice(0, 6)}`;


            const online =
                member.last_seen_at &&
                Date.now() -
                new Date(
                    member.last_seen_at
                ).getTime()
                < 5 * 60 * 1000;


            button.innerHTML = `
                <span class="call-user-avatar">
                    ${escapeHTML(
                        getInitials(name)
                    )}
                </span>

                <span class="call-user-info">
                    <strong>
                        ${escapeHTML(name)}
                    </strong>

                    <small>
                        ${online
                            ? "Online"
                            : "Recently active"}
                    </small>
                </span>

                <span
                    class="call-user-check"
                    aria-hidden="true"
                >
                    ○
                </span>
            `;


            button.addEventListener(
                "click",
                () => {

                    toggleCallUser(
                        member.user_id,
                        button
                    );
                }
            );


            list.appendChild(button);
        });


        if (status) {

            status.textContent =
                `${data.length} community member${
                    data.length === 1
                        ? ""
                        : "s"
                } available.`;
        }
    }


    function toggleCallUser(
        userId,
        button
    ) {

        if (
            state.selectedCallUsers.has(
                userId
            )
        ) {

            state.selectedCallUsers.delete(
                userId
            );

            button.classList.remove(
                "selected"
            );

        } else {

            state.selectedCallUsers.add(
                userId
            );

            button.classList.add(
                "selected"
            );
        }


        updateCallSelectionCount();
    }


    function updateCallSelectionCount() {

        const element =
            $("generalCallSelectionCount");

        if (!element) return;


        const count =
            state.selectedCallUsers.size;


        element.textContent =
            `${count} selected`;
    }


    /* =========================================================
       START GENERAL CALL
       ========================================================= */

    async function startGeneralCall() {

        const selected =
            [...state.selectedCallUsers];


        if (!selected.length) {

            showCallMessage(
                "Select at least one person."
            );

            return;
        }


        if (!state.user) {

            showCallMessage(
                "You must be signed in."
            );

            return;
        }


        const button =
            $("startGeneralCallButton");

        if (button) {
            button.disabled = true;
        }


        const roomCode =
            generateRoomCode();


        const {
            data: room,
            error
        } = await state.supabase
            .from("chat_call_rooms")
            .insert({
                community_id:
                    state.currentCommunity?.id ||
                    null,

                room_code:
                    roomCode,

                call_scope:
                    "general",

                call_type:
                    "video",

                status:
                    "waiting",

                created_by:
                    state.user.id
            })
            .select()
            .single();


        if (button) {
            button.disabled = false;
        }


        if (error) {

            console.error(
                "Create call room:",
                error
            );

            showCallMessage(
                `Could not start call: ${
                    error.message
                }`
            );

            return;
        }


        state.currentCallRoom =
            room;


        /*
         * Add caller.
         */

        await state.supabase
            .from("chat_call_participants")
            .upsert({
                room_id: room.id,
                user_id: state.user.id,
                status: "joined",
                is_muted: false,
                is_camera_on: true,
                joined_at:
                    new Date().toISOString()
            });


        /*
         * Add invitees.
         */

        const participants =
            selected.map(userId => ({
                room_id: room.id,
                user_id: userId,
                status: "invited"
            }));


        if (participants.length) {

            const {
                error:
                    participantError
            } = await state.supabase
                .from(
                    "chat_call_participants"
                )
                .insert(
                    participants
                );


            if (participantError) {

                console.error(
                    "Participants:",
                    participantError
                );
            }
        }


        closeModal(
            $("generalCallModal")
        );


        await openCallOverlay(
            room,
            true
        );
    }


    function generateRoomCode() {

        return (
            "MS-" +
            cryptoRandomString(8)
        );
    }


    function cryptoRandomString(
        length
    ) {

        const chars =
            "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

        const values =
            new Uint32Array(length);

        crypto.getRandomValues(values);

        return [...values]
            .map(
                value =>
                    chars[
                        value % chars.length
                    ]
            )
            .join("");
    }


    function showCallMessage(
        message
    ) {

        const element =
            $("generalCallMessage");

        if (!element) return;

        element.textContent =
            message;
    }


    /* =========================================================
       CALL OVERLAY
       ========================================================= */

    async function openCallOverlay(
        room,
        isCaller = false
    ) {

        const overlay =
            $("callOverlay");

        if (!overlay) return;


        state.currentCallRoom =
            room;


        overlay.classList.add(
            "open"
        );

        overlay.setAttribute(
            "aria-hidden",
            "false"
        );


        const title =
            $("callTitle");

        if (title) {

            title.textContent =
                isCaller
                    ? "Mwaniki Call"
                    : "Incoming Call";
        }


        const subtitle =
            $("callSubtitle");

        if (subtitle) {

            subtitle.textContent =
                "Connecting...";
        }


        await startLocalMedia();


        await markCallStarted();


        startCallTimer();


        await subscribeCallSignals(
            room.id
        );
    }


    async function startLocalMedia() {

        stopLocalMedia();


        try {

            state.localStream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: true,
                        video: true
                    });


            const video =
                $("localVideo");

            if (video) {

                video.srcObject =
                    state.localStream;
            }


            state.microphoneEnabled =
                true;

            state.cameraEnabled =
                true;


            updateCallControls();


        } catch (error) {

            console.error(
                "Camera/microphone:",
                error
            );


            /*
             * Fall back to audio.
             */

            try {

                state.localStream =
                    await navigator.mediaDevices
                        .getUserMedia({
                            audio: true,
                            video: false
                        });


                const video =
                    $("localVideo");

                if (video) {
                    video.srcObject =
                        state.localStream;
                }

                state.cameraEnabled =
                    false;

                updateCallControls();


            } catch (audioError) {

                console.error(
                    "Microphone:",
                    audioError
                );

                notify(
                    "Camera and microphone access was not granted."
                );
            }
        }
    }


    function stopLocalMedia() {

        if (state.localStream) {

            state.localStream
                .getTracks()
                .forEach(track =>
                    track.stop()
                );

            state.localStream =
                null;
        }


        if (state.screenStream) {

            state.screenStream
                .getTracks()
                .forEach(track =>
                    track.stop()
                );

            state.screenStream =
                null;
        }


        const video =
            $("localVideo");

        if (video) {
            video.srcObject = null;
        }
    }


    async function markCallStarted() {

        if (!state.currentCallRoom) {
            return;
        }


        await state.supabase
            .from("chat_call_rooms")
            .update({
                status: "active",
                started_at:
                    new Date().toISOString(),
                updated_at:
                    new Date().toISOString()
            })
            .eq(
                "id",
                state.currentCallRoom.id
            )
            .eq(
                "created_by",
                state.user.id
            );


        await state.supabase
            .from("chat_call_participants")
            .update({
                status: "joined",
                joined_at:
                    new Date().toISOString(),
                is_camera_on:
                    state.cameraEnabled,
                is_muted:
                    !state.microphoneEnabled,
                updated_at:
                    new Date().toISOString()
            })
            .eq(
                "room_id",
                state.currentCallRoom.id
            )
            .eq(
                "user_id",
                state.user.id
            );
    }


    /* =========================================================
       CALL TIMER
       ========================================================= */

    function startCallTimer() {

        stopCallTimer();

        state.callStartedAt =
            Date.now();


        updateCallDuration();


        state.callTimer =
            setInterval(
                updateCallDuration,
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
    }


    function updateCallDuration() {

        const element =
            $("callDuration");

        if (!element ||
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


        const hours =
            Math.floor(
                seconds / 3600
            );

        const minutes =
            Math.floor(
                (seconds % 3600) / 60
            );

        const secs =
            seconds % 60;


        element.textContent =
            [
                hours,
                minutes,
                secs
            ]
                .map(
                    value =>
                        String(value)
                            .padStart(2, "0")
                )
                .join(":");
    }


    /* =========================================================
       MICROPHONE
       ========================================================= */

    async function toggleMicrophone() {

        if (!state.localStream) return;


        const tracks =
            state.localStream
                .getAudioTracks();


        if (!tracks.length) return;


        state.microphoneEnabled =
            !state.microphoneEnabled;


        tracks.forEach(
            track =>
                track.enabled =
                    state.microphoneEnabled
        );


        await updateParticipantCallState();


        updateCallControls();
    }


    /* =========================================================
       CAMERA
       ========================================================= */

    async function toggleCamera() {

        if (!state.localStream) return;


        const tracks =
            state.localStream
                .getVideoTracks();


        if (!tracks.length) {

            try {

                const stream =
                    await navigator.mediaDevices
                        .getUserMedia({
                            video: true
                        });


                stream
                    .getVideoTracks()
                    .forEach(track => {

                        state.localStream
                            ?.addTrack(track);
                    });


                const video =
                    $("localVideo");

                if (video) {

                    video.srcObject =
                        state.localStream;
                }


                state.cameraEnabled =
                    true;


            } catch (error) {

                console.error(
                    "Enable camera:",
                    error
                );

                notify(
                    "Could not enable the camera."
                );

                return;
            }

        } else {

            state.cameraEnabled =
                !state.cameraEnabled;


            tracks.forEach(
                track =>
                    track.enabled =
                        state.cameraEnabled
            );
        }


        await updateParticipantCallState();

        updateCallControls();
    }


    /* =========================================================
       SCREEN SHARE
       ========================================================= */

    async function toggleScreenShare() {

        if (!state.localStream) {

            notify(
                "Join a call first."
            );

            return;
        }


        if (state.screenSharing) {

            stopScreenShare();

            return;
        }


        if (
            !navigator.mediaDevices
                .getDisplayMedia
        ) {

            notify(
                "Screen sharing is not supported by this browser."
            );

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


            if (!screenTrack) return;


            state.screenSharing =
                true;


            const video =
                $("localVideo");

            if (video) {

                const combined =
                    new MediaStream([
                        screenTrack,

                        ...state.localStream
                            .getAudioTracks()
                    ]);

                video.srcObject =
                    combined;
            }


            screenTrack.addEventListener(
                "ended",
                () => {

                    stopScreenShare();
                }
            );


            for (
                const pc
                of state.peerConnections.values()
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


            await updateParticipantCallState();

            updateCallControls();


        } catch (error) {

            console.error(
                "Screen sharing:",
                error
            );
        }
    }


    function stopScreenShare() {

        if (!state.screenSharing) {
            return;
        }


        state.screenSharing =
            false;


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


        const cameraTrack =
            state.localStream
                ?.getVideoTracks()[0];


        if (cameraTrack) {

            for (
                const pc
                of state.peerConnections.values()
            ) {

                const sender =
                    pc.getSenders()
                        .find(
                            item =>
                                item.track?.kind ===
                                "video"
                        );


                if (sender) {

                    sender.replaceTrack(
                        cameraTrack
                    );
                }
            }
        }


        const video =
            $("localVideo");

        if (video) {

            video.srcObject =
                state.localStream;
        }


        updateParticipantCallState();

        updateCallControls();
    }


    /* =========================================================
       CALL CONTROL UI
       ========================================================= */

    function updateCallControls() {

        const mic =
            $("toggleMicrophoneButton");

        if (mic) {

            mic.textContent =
                state.microphoneEnabled
                    ? "🎙️"
                    : "🔇";

            mic.title =
                state.microphoneEnabled
                    ? "Mute microphone"
                    : "Unmute microphone";

            mic.setAttribute(
                "aria-label",
                mic.title
            );
        }


        const camera =
            $("toggleCameraButton");

        if (camera) {

            camera.textContent =
                state.cameraEnabled
                    ? "📹"
                    : "🚫";

            camera.title =
                state.cameraEnabled
                    ? "Turn camera off"
                    : "Turn camera on";

            camera.setAttribute(
                "aria-label",
                camera.title
            );
        }


        const screen =
            $("shareScreenButton");

        if (screen) {

            screen.classList.toggle(
                "active",
                state.screenSharing
            );
        }
    }


    /* =========================================================
       UPDATE CALL PARTICIPANT
       ========================================================= */

    async function updateParticipantCallState() {

        if (
            !state.currentCallRoom ||
            !state.user
        ) {
            return;
        }


        const {
            error
        } = await state.supabase
            .from(
                "chat_call_participants"
            )
            .update({
                is_muted:
                    !state.microphoneEnabled,

                is_camera_on:
                    state.cameraEnabled,

                is_screen_sharing:
                    state.screenSharing,

                updated_at:
                    new Date().toISOString()
            })
            .eq(
                "room_id",
                state.currentCallRoom.id
            )
            .eq(
                "user_id",
                state.user.id
            );


        if (error) {

            console.debug(
                "Participant state:",
                error.message
            );
        }
    }


    /* =========================================================
       WEBRTC
       ========================================================= */

    function createPeerConnection(
        remoteUserId
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
                iceServers: [
                    {
                        urls:
                            "stun:stun.l.google.com:19302"
                    }
                ]
            });


        if (state.localStream) {

            state.localStream
                .getTracks()
                .forEach(track => {

                    pc.addTrack(
                        track,
                        state.localStream
                    );
                });
        }


        pc.onicecandidate =
            async event => {

                if (
                    !event.candidate ||
                    !state.currentCallRoom
                ) {
                    return;
                }


                await sendCallSignal(
                    remoteUserId,
                    "ice-candidate",
                    event.candidate.toJSON()
                );
            };


        pc.ontrack =
            event => {

                attachRemoteStream(
                    remoteUserId,
                    event.streams[0]
                );
            };


        pc.onconnectionstatechange =
            () => {

                console.log(
                    "WebRTC",
                    remoteUserId,
                    pc.connectionState
                );


                if (
                    [
                        "failed",
                        "closed",
                        "disconnected"
                    ].includes(
                        pc.connectionState
                    )
                ) {

                    removePeerConnection(
                        remoteUserId
                    );
                }
            };


        state.peerConnections.set(
            remoteUserId,
            pc
        );


        return pc;
    }


    async function createOffer(
        remoteUserId
    ) {

        const pc =
            createPeerConnection(
                remoteUserId
            );


        const offer =
            await pc.createOffer();


        await pc.setLocalDescription(
            offer
        );


        await sendCallSignal(
            remoteUserId,
            "offer",
            offer
        );
    }


    async function handleOffer(
        senderId,
        offer
    ) {

        const pc =
            createPeerConnection(
                senderId
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
            senderId,
            "answer",
            answer
        );
    }


    async function handleAnswer(
        senderId,
        answer
    ) {

        const pc =
            createPeerConnection(
                senderId
            );


        await pc.setRemoteDescription(
            new RTCSessionDescription(
                answer
            )
        );
    }


    async function handleIceCandidate(
        senderId,
        candidate
    ) {

        const pc =
            createPeerConnection(
                senderId
            );


        try {

            await pc.addIceCandidate(
                new RTCIceCandidate(
                    candidate
                )
            );

        } catch (error) {

            console.warn(
                "ICE candidate:",
                error
            );
        }
    }


    async function sendCallSignal(
        receiverId,
        signalType,
        payload
    ) {

        if (
            !state.currentCallRoom ||
            !state.user
        ) {
            return;
        }


        const {
            error
        } = await state.supabase
            .from(
                "chat_call_signals"
            )
            .insert({
                room_id:
                    state.currentCallRoom.id,

                sender_id:
                    state.user.id,

                receiver_id:
                    receiverId,

                signal_type:
                    signalType,

                payload
            });


        if (error) {

            console.error(
                "Call signal:",
                error
            );
        }
    }


    /* =========================================================
       CALL SIGNAL REALTIME
       ========================================================= */

    async function subscribeCallSignals(
        roomId
    ) {

        unsubscribeSignalRealtime();


        state.signalSubscription =
            state.supabase
                .channel(
                    `call-signals-${roomId}`
                )
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

                        await handleCallSignal(
                            payload.new
                        );
                    }
                )
                .subscribe(status => {

                    console.log(
                        "Call signals:",
                        status
                    );
                });


        /*
         * Watch participants.
         */

        state.callSubscription =
            state.supabase
                .channel(
                    `call-participants-${roomId}`
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
                    async payload => {

                        await handleParticipantChange(
                            payload
                        );
                    }
                )
                .subscribe(status => {

                    console.log(
                        "Call participants:",
                        status
                    );
                });
    }


    async function handleCallSignal(
        signal
    ) {

        if (
            !signal ||
            signal.receiver_id !==
            state.user?.id
        ) {
            return;
        }


        const sender =
            signal.sender_id;


        try {

            switch (
                signal.signal_type
            ) {

                case "offer":

                    await handleOffer(
                        sender,
                        signal.payload
                    );

                    break;


                case "answer":

                    await handleAnswer(
                        sender,
                        signal.payload
                    );

                    break;


                case "ice-candidate":

                    await handleIceCandidate(
                        sender,
                        signal.payload
                    );

                    break;


                default:

                    break;
            }

        } catch (error) {

            console.error(
                "Handle call signal:",
                error
            );
        }
    }


    async function handleParticipantChange(
        payload
    ) {

        const participant =
            payload.new;

        if (!participant) return;


        if (
            participant.user_id ===
            state.user?.id
        ) {
            return;
        }


        if (
            participant.status ===
            "joined"
        ) {

            /*
             * The participant who was already
             * in the room creates the offer.
             *
             * Using user IDs gives us a deterministic
             * initiator and avoids offer collisions.
             */

            if (
                String(state.user.id) <
                String(participant.user_id)
            ) {

                await createOffer(
                    participant.user_id
                );
            }
        }


        renderCallParticipants();
    }


    function unsubscribeSignalRealtime() {

        if (
            state.signalSubscription
        ) {

            state.supabase.removeChannel(
                state.signalSubscription
            );

            state.signalSubscription =
                null;
        }


        if (
            state.callSubscription
        ) {

            state.supabase.removeChannel(
                state.callSubscription
            );

            state.callSubscription =
                null;
        }
    }


    /* =========================================================
       REMOTE VIDEO
       ========================================================= */

    function attachRemoteStream(
        userId,
        stream
    ) {

        const grid =
            $("callVideoGrid");

        if (!grid) return;


        let tile =
            document.querySelector(
                `[data-remote-user="${CSS.escape(
                    userId
                )}"]`
            );


        if (!tile) {

            tile =
                document.createElement("div");

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
                    Participant
                </span>
            `;


            grid.appendChild(
                tile
            );
        }


        const video =
            qs(
                "video",
                tile
            );


        if (video) {

            video.srcObject =
                stream;
        }
    }


    function removePeerConnection(
        userId
    ) {

        const pc =
            state.peerConnections.get(
                userId
            );


        if (pc) {

            pc.close();

            state.peerConnections.delete(
                userId
            );
        }


        const tile =
            document.querySelector(
                `[data-remote-user="${CSS.escape(
                    userId
                )}"]`
            );


        tile?.remove();
    }


    function renderCallParticipants() {

        /*
         * Participant realtime is enough for the
         * actual WebRTC state. This area is kept
         * intentionally simple.
         */

        const container =
            $("callParticipants");

        if (!container) return;


        if (!state.currentCallRoom) {

            container.innerHTML = "";

            return;
        }


        loadCallParticipantsUI();
    }


    async function loadCallParticipantsUI() {

        const container =
            $("callParticipants");

        if (!container) return;


        const {
            data,
            error
        } = await state.supabase
            .from(
                "chat_call_participants"
            )
            .select(`
                user_id,
                status,
                is_muted,
                is_camera_on,
                is_screen_sharing
            `)
            .eq(
                "room_id",
                state.currentCallRoom.id
            );


        if (error) return;


        container.innerHTML =
            (data || [])
                .map(
                    participant => `
                        <span
                            class="call-participant"
                        >
                            ${
                                participant.user_id ===
                                state.user.id
                                    ? "You"
                                    : `User ${
                                        String(
                                            participant.user_id
                                        ).slice(0, 6)
                                    }`
                            }

                            ${
                                participant.is_muted
                                    ? " 🔇"
                                    : ""
                            }

                            ${
                                participant.is_camera_on
                                    ? " 📹"
                                    : ""
                            }
                        </span>
                    `
                )
                .join("");
    }


    /* =========================================================
       INCOMING CALLS
       ========================================================= */

    async function subscribeIncomingCalls() {

        if (
            state.callSubscription &&
            state.currentCallRoom
        ) {
            return;
        }


        const channelName =
            `incoming-calls-${state.user.id}`;


        state.callSubscription =
            state.supabase
                .channel(channelName)
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

                        await handleIncomingParticipant(
                            payload.new
                        );
                    }
                )
                .subscribe(status => {

                    console.log(
                        "Incoming calls:",
                        status
                    );
                });
    }


    async function handleIncomingParticipant(
        participant
    ) {

        if (!participant) return;


        if (
            participant.status !==
            "invited"
        ) {
            return;
        }


        if (
            participant.user_id !==
            state.user?.id
        ) {
            return;
        }


        const {
            data: room,
            error
        } = await state.supabase
            .from("chat_call_rooms")
            .select("*")
            .eq(
                "id",
                participant.room_id
            )
            .maybeSingle();


        if (error || !room) return;


        if (
            room.status ===
            "ended"
        ) {
            return;
        }


        /*
         * Don't show our own call as incoming.
         */

        if (
            room.created_by ===
            state.user.id
        ) {
            return;
        }


        showIncomingCall(
            room
        );
    }


    function showIncomingCall(
        room
    ) {

        state.incomingCall =
            room;


        const toast =
            $("incomingCallToast");

        if (!toast) return;


        const title =
            $("incomingCallTitle");

        if (title) {

            title.textContent =
                "Incoming call";
        }


        const text =
            $("incomingCallText");

        if (text) {

            text.textContent =
                `Someone is calling you.`;
        }


        toast.classList.add(
            "open"
        );

        toast.setAttribute(
            "aria-hidden",
            "false"
        );
    }


    function hideIncomingCall() {

        const toast =
            $("incomingCallToast");

        if (!toast) return;


        if (
            toast.contains(
                document.activeElement
            )
        ) {

            document.activeElement.blur();
        }


        toast.classList.remove(
            "open"
        );

        toast.setAttribute(
            "aria-hidden",
            "true"
        );
    }


    /* =========================================================
       ACCEPT CALL
       ========================================================= */

    async function acceptIncomingCall() {

        const room =
            state.incomingCall;

        if (!room) return;


        hideIncomingCall();


        const {
            error
        } = await state.supabase
            .from(
                "chat_call_participants"
            )
            .update({
                status: "joined",
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


        if (error) {

            notify(
                `Could not join call: ${
                    error.message
                }`
            );

            return;
        }


        state.currentCallRoom =
            room;


        await openCallOverlay(
            room,
            false
        );
    }


    /* =========================================================
       DECLINE CALL
       ========================================================= */

    async function declineIncomingCall() {

        const room =
            state.incomingCall;

        hideIncomingCall();


        if (!room) return;


        await state.supabase
            .from(
                "chat_call_participants"
            )
            .update({
                status: "declined",
                left_at:
                    new Date().toISOString(),
                updated_at:
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


        state.incomingCall =
            null;
    }


    /* =========================================================
       LEAVE CALL
       ========================================================= */

    async function leaveCall() {

        const room =
            state.currentCallRoom;


        if (!room) {

            closeCallOverlay();

            return;
        }


        await state.supabase
            .from(
                "chat_call_participants"
            )
            .update({
                status: "left",
                left_at:
                    new Date().toISOString(),
                updated_at:
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


        /*
         * Only the creator ends the room.
         * Other participants simply leave.
         */

        if (
            room.created_by ===
            state.user.id
        ) {

            await state.supabase
                .from(
                    "chat_call_rooms"
                )
                .update({
                    status: "ended",
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


        closeCallOverlay();
    }


    function closeCallOverlay() {

        const overlay =
            $("callOverlay");


        if (overlay) {

            if (
                overlay.contains(
                    document.activeElement
                )
            ) {

                document.activeElement.blur();
            }


            overlay.classList.remove(
                "open"
            );

            overlay.setAttribute(
                "aria-hidden",
                "true"
            );
        }


        stopCallTimer();

        stopLocalMedia();

        unsubscribeSignalRealtime();


        state.peerConnections
            .forEach(
                pc => pc.close()
            );


        state.peerConnections.clear();


        state.currentCallRoom =
            null;

        state.currentCallParticipant =
            null;

        state.incomingCall =
            null;
    }


    /* =========================================================
       MINIMIZE CALL
       ========================================================= */

    function minimizeCall() {

        const overlay =
            $("callOverlay");

        if (!overlay) return;


        overlay.classList.toggle(
            "minimized"
        );
    }


    /* =========================================================
       PRESENCE
       ========================================================= */

    let presenceInterval =
        null;


    async function updatePresence(
        status = "online"
    ) {

        if (!state.user) return;


        const {
            error
        } = await state.supabase
            .from("chat_presence")
            .upsert({
                user_id:
                    state.user.id,

                status,

                last_seen_at:
                    new Date().toISOString(),

                updated_at:
                    new Date().toISOString()
            });


        if (error) {

            console.debug(
                "Presence:",
                error.message
            );
        }


        if (
            state.currentCommunity
        ) {

            await state.supabase
                .from(
                    "chat_community_members"
                )
                .update({
                    last_seen_at:
                        new Date().toISOString()
                })
                .eq(
                    "community_id",
                    state.currentCommunity.id
                )
                .eq(
                    "user_id",
                    state.user.id
                );
        }
    }


    function startPresence() {

        updatePresence(
            "online"
        );


        if (presenceInterval) {

            clearInterval(
                presenceInterval
            );
        }


        presenceInterval =
            setInterval(
                () =>
                    updatePresence(
                        "online"
                    ),
                60000
            );


        window.addEventListener(
            "beforeunload",
            () => {

                updatePresence(
                    "offline"
                );
            }
        );


        document.addEventListener(
            "visibilitychange",
            () => {

                updatePresence(
                    document.hidden
                        ? "away"
                        : "online"
                );
            }
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
                180
            )}px`;
    }


    /* =========================================================
       EVENT BINDING
       ========================================================= */

    function bindEvents() {

        /*
         * Home buttons.
         */

        $("homeButton")
            ?.addEventListener(
                "click",
                goDashboard
            );


        $("dashboardButton")
            ?.addEventListener(
                "click",
                goDashboard
            );


        $("railHomeButton")
            ?.addEventListener(
                "click",
                () => {

                    if (
                        state.communities[0]
                    ) {

                        selectCommunity(
                            state.communities[0].id
                        );
                    }
                }
            );


        /*
         * Community modal.
         */

        [
            $("openCommunityButton"),
            $("communitySelectorButton"),
            $("headerCommunityButton")
        ]
            .filter(Boolean)
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        renderCommunityChoices();

                        openModal(
                            $("communityModal")
                        );
                    }
                );
            });


        $("closeCommunityModal")
            ?.addEventListener(
                "click",
                () =>
                    closeModal(
                        $("communityModal")
                    )
            );


        $("communityModalSearch")
            ?.addEventListener(
                "input",
                renderCommunityChoices
            );


        /*
         * General call.
         */

        $("generalCallButton")
            ?.addEventListener(
                "click",
                openGeneralCallModal
            );


        $("closeGeneralCallModalButton")
            ?.addEventListener(
                "click",
                () =>
                    closeModal(
                        $("generalCallModal")
                    )
            );


        $("cancelGeneralCallButton")
            ?.addEventListener(
                "click",
                () =>
                    closeModal(
                        $("generalCallModal")
                    )
            );


        $("startGeneralCallButton")
            ?.addEventListener(
                "click",
                startGeneralCall
            );


        /*
         * Conversation.
         */

        $("startConversationButton")
            ?.addEventListener(
                "click",
                focusComposer
            );


        $("welcomeStartButton")
            ?.addEventListener(
                "click",
                focusComposer
            );


        $("messageForm")
            ?.addEventListener(
                "submit",
                handleMessageSubmit
            );


        $("messageInput")
            ?.addEventListener(
                "input",
                event =>
                    autoResizeTextarea(
                        event.target
                    )
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


        /*
         * Attachments.
         */

        const fileInput =
            createFileInput();


        $("attachButton")
            ?.addEventListener(
                "click",
                () =>
                    fileInput.click()
            );


        /*
         * Emoji.
         */

        $("emojiButton")
            ?.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    toggleEmojiPicker();
                }
            );


        /*
         * Channel search.
         */

        $("channelSearchInput")
            ?.addEventListener(
                "input",
                renderChannels
            );


        /*
         * Call controls.
         */

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


        $("minimizeCallButton")
            ?.addEventListener(
                "click",
                minimizeCall
            );


        $("leaveCallButton")
            ?.addEventListener(
                "click",
                leaveCall
            );


        /*
         * Incoming call.
         */

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


        /*
         * Profile.
         */

        $("sidebarProfileButton")
            ?.addEventListener(
                "click",
                () =>
                    goDashboard()
            );


        $("railProfileButton")
            ?.addEventListener(
                "click",
                () =>
                    goDashboard()
            );


        /*
         * Escape closes UI.
         */

        document.addEventListener(
            "keydown",
            event => {

                if (event.key !== "Escape") {
                    return;
                }


                closeEmojiPicker();


                qsa(".modal.open")
                    .forEach(
                        modal =>
                            closeModal(modal)
                    );


                if (
                    $("incomingCallToast")
                        ?.classList
                        .contains("open")
                ) {

                    hideIncomingCall();
                }
            }
        );


        /*
         * "/" focuses channel search.
         */

        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "/" &&
                    !isTypingTarget(
                        event.target
                    )
                ) {

                    event.preventDefault();

                    $("channelSearchInput")
                        ?.focus();
                }
            }
        );


        /*
         * Click outside modal.
         */

        qsa(".modal")
            .forEach(modal => {

                modal.addEventListener(
                    "click",
                    event => {

                        if (
                            event.target ===
                            modal
                        ) {

                            closeModal(
                                modal
                            );
                        }
                    }
                );
            });
    }


    function isTypingTarget(
        element
    ) {

        if (!element) return false;

        const tag =
            element.tagName
                ?.toLowerCase();

        return (
            tag === "input" ||
            tag === "textarea" ||
            element.isContentEditable
        );
    }


    function goDashboard() {

        window.location.href =
            CONFIG.dashboardUrl;
    }


    /* =========================================================
       KEYBOARD MODAL HANDLING
       ========================================================= */

    function setupModalAccessibility() {

        qsa(".modal")
            .forEach(modal => {

                modal.setAttribute(
                    "aria-hidden",
                    "true"
                );
            });


        const callOverlay =
            $("callOverlay");

        if (callOverlay) {

            callOverlay.setAttribute(
                "aria-hidden",
                "true"
            );
        }


        const toast =
            $("incomingCallToast");

        if (toast) {

            toast.setAttribute(
                "aria-hidden",
                "true"
            );
        }
    }


    /* =========================================================
       ERROR STATES
       ========================================================= */

    function renderCommunityError(
        message
    ) {

        const list =
            $("communityChoiceList");

        if (!list) return;


        list.innerHTML = `
            <div class="center-state">
                <strong>
                    Could not load communities.
                </strong>

                <small>
                    ${escapeHTML(message)}
                </small>
            </div>
        `;
    }


    /* =========================================================
       AUTH STATE
       ========================================================= */

    function setupAuthListener() {

        state.supabase.auth.onAuthStateChange(
            async (event, session) => {

                console.log(
                    "Community auth:",
                    event
                );


                if (
                    event ===
                    "SIGNED_OUT"
                ) {

                    window.location.href =
                        "./index.html";

                    return;
                }


                if (
                    session?.user &&
                    !state.user
                ) {

                    state.user =
                        session.user;

                    updateUserUI();

                    await startApplicationAfterAuth();
                }
            }
        );
    }


    /* =========================================================
       START APPLICATION
       ========================================================= */

    async function startApplicationAfterAuth() {

        if (state.initialized) {
            return;
        }


        state.initialized = true;


        setupModalAccessibility();

        bindEvents();

        await loadCommunities();

        await subscribeIncomingCalls();

        startPresence();

        console.log(
            "✅ Mwaniki Scholars Community loaded"
        );

        notify(
            "Community loaded."
        );
    }


    /* =========================================================
       INITIALIZATION
       ========================================================= */

    async function init() {

        try {

            await waitForSupabase();

            const user =
                await loadCurrentUser();


            if (!user) {
                return;
            }


            setupAuthListener();

            await startApplicationAfterAuth();


        } catch (error) {

            console.error(
                "❌ Community initialization failed:",
                error
            );


            notify(
                `Community failed to start: ${
                    error.message
                }`
            );
        }
    }


    /* =========================================================
       CLEANUP
       ========================================================= */

    window.addEventListener(
        "beforeunload",
        () => {

            unsubscribeCommunityRealtime();

            unsubscribeChannelRealtime();

            unsubscribeSignalRealtime();

            stopCallTimer();

            stopLocalMedia();
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
            init,
            {
                once: true
            }
        );

    } else {

        init();
    }

})();
