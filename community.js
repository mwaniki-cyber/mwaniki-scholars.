/* =========================================================
   MWANIKI SCHOLARS COMMUNITY
   CLEAN COMMUNITY ENGINE
   ========================================================= */

(() => {
    "use strict";

    console.log("🚀 Mwaniki Scholars Community starting...");

    /* =====================================================
       CONFIG
       ===================================================== */

    const CONFIG = {
        homeUrl: "./dashboard.html",

        attachmentBucket: "chat-attachments",

        maxFileSize: 20 * 1024 * 1024,

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


    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        supabase: null,

        user: null,

        profile: null,

        communities: [],

        channels: [],

        currentCommunity: null,

        currentChannel: null,

        messages: [],

        selectedCallUsers: new Set(),

        currentCall: {
            roomId: null,
            roomCode: null,
            communityId: null,
            scope: null,
            type: "video",

            localStream: null,

            peers: new Map(),

            screenStream: null,

            startedAt: null,

            durationTimer: null,

            signalChannel: null,

            participantsChannel: null
        },

        realtimeChannels: [],

        emojiPanel: null,

        attachmentInput: null,

        sendingMessage: false,

        loadingMessages: false
    };


    /* =====================================================
       DOM HELPER
       ===================================================== */

    const $ = (id) => document.getElementById(id);


    /* =====================================================
       ELEMENTS
       ===================================================== */

    const DOM = {};


    function cacheDOM() {

        const ids = [

            "communityApp",

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

            "dashboardButton",
            "headerCommunityButton",

            "generalCallButton",

            "startConversationButton",
            "welcomeStartButton",

            "mainChannelTitle",
            "mainChannelDescription",

            "messageList",
            "messageForm",
            "messageInput",
            "sendMessageButton",

            "attachButton",
            "emojiButton",

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
            "declineCallButton",

            "communityStatus",
            "accessibilityAnnouncer"
        ];

        ids.forEach(id => {
            DOM[id] = $(id);
        });
    }


    /* =====================================================
       SAFE TEXT
       ===================================================== */

    function escapeHTML(value) {

        if (value === null || value === undefined) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* =====================================================
       STATUS
       ===================================================== */

    function announce(message) {

        if (DOM.accessibilityAnnouncer) {
            DOM.accessibilityAnnouncer.textContent = message;
        }

        if (DOM.communityStatus) {
            DOM.communityStatus.textContent = message;
        }
    }


    function setCallMessage(message) {

        if (DOM.generalCallMessage) {
            DOM.generalCallMessage.textContent = message || "";
        }
    }


    /* =====================================================
       WAIT FOR SUPABASE
       ===================================================== */

    async function waitForSupabase() {

        for (let i = 0; i < 100; i++) {

            if (window.supabase) {

                state.supabase = window.supabase;

                console.log("✅ Supabase client ready");

                return state.supabase;
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        throw new Error(
            "Supabase client was not found. Check supabase.js."
        );
    }


    /* =====================================================
       AUTH
       ===================================================== */

    async function loadCurrentUser() {

        const {
            data,
            error
        } = await state.supabase.auth.getUser();

        if (error) {
            throw error;
        }

        if (!data?.user) {

            console.warn("⚠️ No authenticated user");

            window.location.href = "./studentLogin.html";

            return null;
        }

        state.user = data.user;

        console.log(
            "✅ Authenticated as:",
            state.user.id
        );

        return state.user;
    }


    /* =====================================================
       PROFILE
       ===================================================== */

    async function loadProfile() {

        const user = state.user;

        if (!user) {
            return;
        }

        const metadata = user.user_metadata || {};

        state.profile = {

            name:
                metadata.full_name ||
                metadata.name ||
                metadata.display_name ||
                metadata.username ||
                user.email?.split("@")[0] ||
                "Student",

            avatar:
                metadata.avatar_url ||
                metadata.picture ||
                ""
        };


        /*
         * Try common Mwaniki profile table.
         * Failure is intentionally ignored because
         * authentication metadata is sufficient.
         */

        const possibleTables = [
            "profiles",
            "student_profiles"
        ];


        for (const table of possibleTables) {

            try {

                const result =
                    await state.supabase
                        .from(table)
                        .select("*")
                        .eq("id", user.id)
                        .maybeSingle();


                if (!result.error && result.data) {

                    const p = result.data;

                    state.profile.name =
                        p.full_name ||
                        p.name ||
                        p.display_name ||
                        p.username ||
                        state.profile.name;

                    state.profile.avatar =
                        p.avatar_url ||
                        p.profile_image ||
                        p.photo_url ||
                        p.avatar ||
                        state.profile.avatar;

                    break;
                }

            } catch (_) {}
        }


        updateProfileUI();
    }


    function updateProfileUI() {

        const name = state.profile?.name || "Student";

        const avatar = state.profile?.avatar || "";


        if (DOM.sidebarProfileName) {
            DOM.sidebarProfileName.textContent = name;
        }


        [
            DOM.railProfileAvatar,
            DOM.sidebarProfileAvatar
        ].forEach(img => {

            if (!img) {
                return;
            }

            if (avatar) {
                img.src = avatar;
                img.style.display = "";
            } else {
                img.removeAttribute("src");
                img.style.display = "none";
            }
        });
    }


    /* =====================================================
       LOAD COMMUNITIES
       ===================================================== */

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
            console.error(
                "❌ Failed loading communities:",
                error
            );

            throw error;
        }


        state.communities = data || [];

        renderCommunityRail();

        renderCommunityModal();


        /*
         * Restore previous community.
         */

        const savedId =
            localStorage.getItem(
                "mwanikiSelectedCommunity"
            );


        let selected =
            state.communities.find(
                community =>
                    community.id === savedId
            );


        if (!selected) {
            selected = state.communities[0];
        }


        if (selected) {
            await selectCommunity(selected);
        }
    }


    /* =====================================================
       COMMUNITY RAIL
       ===================================================== */

    function renderCommunityRail() {

        if (!DOM.communityRailList) {
            return;
        }

        DOM.communityRailList.innerHTML = "";


        state.communities.forEach(community => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "rail-community-icon";

            button.dataset.communityId =
                community.id;

            button.title =
                community.name;

            button.setAttribute(
                "aria-label",
                community.name
            );


            if (community.icon_url) {

                const img =
                    document.createElement("img");

                img.src = community.icon_url;

                img.alt = "";

                button.appendChild(img);

            } else {

                const span =
                    document.createElement("span");

                span.textContent =
                    getCommunityInitials(
                        community.name
                    );

                button.appendChild(span);
            }


            button.addEventListener(
                "click",
                () => selectCommunity(community)
            );


            DOM.communityRailList.appendChild(button);
        });


        updateActiveCommunityRail();
    }


    function updateActiveCommunityRail() {

        document
            .querySelectorAll(
                ".rail-community-icon"
            )
            .forEach(button => {

                button.classList.toggle(
                    "active",
                    button.dataset.communityId ===
                    state.currentCommunity?.id
                );
            });
    }


    function getCommunityInitials(name) {

        return String(name || "MS")
            .split(/\s+/)
            .slice(0, 2)
            .map(word => word[0])
            .join("")
            .toUpperCase();
    }


    /* =====================================================
       SELECT COMMUNITY
       ===================================================== */

    async function selectCommunity(community) {

        if (!community) {
            return;
        }


        state.currentCommunity = community;


        localStorage.setItem(
            "mwanikiSelectedCommunity",
            community.id
        );


        updateCommunityUI();

        updateActiveCommunityRail();

        closeCommunityModal();


        await loadChannels();
    }


    function updateCommunityUI() {

        const community =
            state.currentCommunity;

        if (!community) {
            return;
        }


        if (DOM.communityBrandTitle) {
            DOM.communityBrandTitle.textContent =
                community.name;
        }


        if (DOM.communityBrandSubtitle) {

            DOM.communityBrandSubtitle.textContent =
                community.description ||
                "Learn • Discuss • Connect";
        }


        if (DOM.selectedCommunityName) {
            DOM.selectedCommunityName.textContent =
                community.name;
        }


        if (DOM.selectedCommunityDescription) {

            DOM.selectedCommunityDescription.textContent =
                community.description ||
                "Community";
        }


        if (DOM.selectedCommunityIcon) {

            if (community.icon_url) {

                DOM.selectedCommunityIcon.innerHTML =
                    `<img src="${escapeHTML(
                        community.icon_url
                    )}" alt="">`;

            } else {

                DOM.selectedCommunityIcon.textContent =
                    getCommunityInitials(
                        community.name
                    );
            }
        }
    }


    /* =====================================================
       LOAD CHANNELS
       ===================================================== */

    async function loadChannels() {

        if (!state.currentCommunity) {
            return;
        }


        if (DOM.channelList) {

            DOM.channelList.innerHTML = `
                <div class="center-state">
                    <div>
                        <div class="loader"></div>
                        Loading channels...
                    </div>
                </div>
            `;
        }


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

            console.error(
                "❌ Channel loading failed:",
                error
            );

            renderChannelError(error.message);

            return;
        }


        state.channels = data || [];

        renderChannels();


        const savedChannelId =
            localStorage.getItem(
                `mwanikiChannel_${state.currentCommunity.id}`
            );


        let channel =
            state.channels.find(
                item =>
                    item.id === savedChannelId
            );


        if (!channel) {
            channel = state.channels[0];
        }


        if (channel) {
            await selectChannel(channel);
        } else {

            clearCurrentChannel();

            renderEmptyChannelState();
        }
    }


    /* =====================================================
       RENDER CHANNELS
       ===================================================== */

    function renderChannels() {

        if (!DOM.channelList) {
            return;
        }


        if (!state.channels.length) {

            DOM.channelList.innerHTML = `
                <div class="center-state">
                    <div>
                        No channels available.
                    </div>
                </div>
            `;

            return;
        }


        DOM.channelList.innerHTML = "";


        const groups = {};


        state.channels.forEach(channel => {

            const category =
                channel.channel_type === "voice"
                    ? "Voice"
                    : "Channels";


            if (!groups[category]) {
                groups[category] = [];
            }

            groups[category].push(channel);
        });


        Object.entries(groups)
            .forEach(([category, channels]) => {

                const heading =
                    document.createElement("div");

                heading.className =
                    "channel-category";

                heading.textContent =
                    category;

                DOM.channelList.appendChild(
                    heading
                );


                channels.forEach(channel => {

                    const button =
                        document.createElement("button");

                    button.type = "button";

                    button.className =
                        "channel-item";

                    button.dataset.channelId =
                        channel.id;

                    button.dataset.searchName =
                        channel.name.toLowerCase();


                    button.innerHTML = `
                        <span class="channel-item-icon">
                            ${escapeHTML(
                                channel.icon ||
                                "#"
                            )}
                        </span>

                        <span class="channel-item-name">
                            ${escapeHTML(
                                channel.name
                            )}
                        </span>
                    `;


                    button.addEventListener(
                        "click",
                        () => selectChannel(channel)
                    );


                    DOM.channelList.appendChild(
                        button
                    );
                });
            });


        updateActiveChannel();
    }


    /* =====================================================
       CHANNEL SEARCH
       ===================================================== */

    function setupChannelSearch() {

        if (!DOM.channelSearchInput) {
            return;
        }


        DOM.channelSearchInput
            .addEventListener(
                "input",
                () => {

                    const query =
                        DOM.channelSearchInput.value
                            .trim()
                            .toLowerCase();


                    document
                        .querySelectorAll(
                            ".channel-item"
                        )
                        .forEach(item => {

                            const name =
                                item.dataset.searchName ||
                                "";

                            item.style.display =
                                !query ||
                                name.includes(query)
                                    ? ""
                                    : "none";
                        });
                }
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

                    DOM.channelSearchInput.focus();
                }
            }
        );
    }


    /* =====================================================
       SELECT CHANNEL
       ===================================================== */

    async function selectChannel(channel) {

        if (!channel) {
            return;
        }


        state.currentChannel = channel;


        localStorage.setItem(
            `mwanikiChannel_${state.currentCommunity.id}`,
            channel.id
        );


        updateChannelUI();

        updateActiveChannel();

        await loadMessages();

        subscribeToCurrentChannel();

        markChannelRead();
    }


    function updateChannelUI() {

        const channel =
            state.currentChannel;

        if (!channel) {
            return;
        }


        if (DOM.mainChannelTitle) {

            DOM.mainChannelTitle.textContent =
                `# ${channel.name}`;
        }


        if (DOM.mainChannelDescription) {

            DOM.mainChannelDescription.textContent =
                channel.description ||
                "Channel discussion";
        }


        if (DOM.messageInput) {

            DOM.messageInput.placeholder =
                `Message #${channel.name}...`;
        }
    }


    function updateActiveChannel() {

        document
            .querySelectorAll(
                ".channel-item"
            )
            .forEach(button => {

                button.classList.toggle(
                    "active",
                    button.dataset.channelId ===
                    state.currentChannel?.id
                );
            });
    }


    function clearCurrentChannel() {

        state.currentChannel = null;

        if (DOM.mainChannelTitle) {
            DOM.mainChannelTitle.textContent =
                "# General";
        }
    }


    /* =====================================================
       LOAD MESSAGES
       ===================================================== */

    async function loadMessages() {

        if (!state.currentChannel) {
            return;
        }


        state.loadingMessages = true;


        DOM.messageList.innerHTML = `
            <div class="center-state">
                <div>
                    <div class="loader"></div>
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
                state.currentChannel.id
            )
            .order("created_at", {
                ascending: true
            })
            .limit(500);


        state.loadingMessages = false;


        if (error) {

            console.error(
                "❌ Message loading failed:",
                error
            );

            DOM.messageList.innerHTML = `
                <div class="center-state">
                    Unable to load messages.
                </div>
            `;

            return;
        }


        state.messages = data || [];

        renderMessages();
    }


    /* =====================================================
       RENDER MESSAGES
       ===================================================== */

    function renderMessages() {

        if (!DOM.messageList) {
            return;
        }


        if (!state.messages.length) {

            renderEmptyChannelState();

            return;
        }


        DOM.messageList.innerHTML = "";


        state.messages.forEach(
            message => {

                DOM.messageList.appendChild(
                    createMessageElement(
                        message
                    )
                );
            }
        );


        scrollMessagesToBottom();
    }


    function renderEmptyChannelState() {

        DOM.messageList.innerHTML = `
            <div class="welcome-card">

                <div class="welcome-icon">
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
                    id="dynamicStartConversation"
                >
                    Start Conversation
                </button>

            </div>
        `;


        const button =
            document.getElementById(
                "dynamicStartConversation"
            );


        if (button) {

            button.addEventListener(
                "click",
                () => {

                    DOM.messageInput?.focus();
                }
            );
        }
    }


    function createMessageElement(message) {

        const wrapper =
            document.createElement("article");


        wrapper.className =
            "chat-message";


        wrapper.dataset.messageId =
            message.id;


        const own =
            message.user_id === state.user.id;


        const displayName =
            own
                ? state.profile.name
                : "Student";


        const content =
            message.is_deleted
                ? "Message deleted"
                : message.content || "";


        wrapper.innerHTML = `

            <div class="message-avatar">
                ${escapeHTML(
                    getInitial(
                        displayName
                    )
                )}
            </div>

            <div class="message-body">

                <div class="message-meta">

                    <strong>
                        ${escapeHTML(
                            displayName
                        )}
                    </strong>

                    <time>
                        ${formatMessageTime(
                            message.created_at
                        )}
                    </time>

                </div>

                <div class="message-content ${
                    message.is_deleted
                        ? "deleted"
                        : ""
                }">
                    ${escapeHTML(content)}
                </div>

                <div class="message-actions">

                    <button
                        type="button"
                        class="message-reaction-button"
                        data-message-id="${message.id}"
                        title="React"
                    >
                        😊
                    </button>

                    ${
                        own &&
                        !message.is_deleted
                            ? `
                                <button
                                    type="button"
                                    class="message-delete-button"
                                    data-message-id="${message.id}"
                                    title="Delete message"
                                >
                                    Delete
                                </button>
                            `
                            : ""
                    }

                </div>

            </div>
        `;


        const deleteButton =
            wrapper.querySelector(
                ".message-delete-button"
            );


        if (deleteButton) {

            deleteButton.addEventListener(
                "click",
                () =>
                    deleteMessage(
                        message.id
                    )
            );
        }


        const reactionButton =
            wrapper.querySelector(
                ".message-reaction-button"
            );


        if (reactionButton) {

            reactionButton.addEventListener(
                "click",
                event =>
                    openMessageReactionPicker(
                        event,
                        message.id
                    )
            );
        }


        return wrapper;
    }


    function getInitial(name) {

        return String(name || "S")
            .trim()
            .charAt(0)
            .toUpperCase();
    }


    function formatMessageTime(date) {

        if (!date) {
            return "";
        }

        return new Date(date)
            .toLocaleTimeString(
                [],
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );
    }


    function scrollMessagesToBottom() {

        requestAnimationFrame(() => {

            DOM.messageList.scrollTop =
                DOM.messageList.scrollHeight;
        });
    }


    /* =====================================================
       SEND MESSAGE
       ===================================================== */

    async function sendMessage() {

        if (state.sendingMessage) {
            return;
        }


        if (!state.currentChannel) {

            announce(
                "Select a channel first."
            );

            return;
        }


        const content =
            DOM.messageInput.value.trim();


        if (!content) {
            return;
        }


        state.sendingMessage = true;


        DOM.sendMessageButton.disabled = true;


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


        state.sendingMessage = false;


        DOM.sendMessageButton.disabled = false;


        if (error) {

            console.error(
                "❌ Send message failed:",
                error
            );

            announce(
                "Unable to send message."
            );

            return;
        }


        DOM.messageInput.value = "";

        autoResizeTextarea();


        /*
         * Realtime normally inserts this.
         * Add immediately if it has not appeared.
         */

        if (
            !state.messages.some(
                item => item.id === data.id
            )
        ) {

            state.messages.push(data);

            renderMessages();
        }
    }


    /* =====================================================
       DELETE MESSAGE
       ===================================================== */

    async function deleteMessage(messageId) {

        const message =
            state.messages.find(
                item => item.id === messageId
            );


        if (!message) {
            return;
        }


        if (
            message.user_id !==
            state.user.id
        ) {

            announce(
                "You can only delete your own messages."
            );

            return;
        }


        const {
            error
        } = await state.supabase
            .from("chat_messages")
            .update({
                is_deleted: true,
                deleted_at: new Date().toISOString(),
                content: "Message deleted"
            })
            .eq("id", messageId)
            .eq("user_id", state.user.id);


        if (error) {

            console.error(
                "❌ Delete failed:",
                error
            );

            announce(
                "Unable to delete message."
            );

            return;
        }


        const index =
            state.messages.findIndex(
                item =>
                    item.id === messageId
            );


        if (index !== -1) {

            state.messages[index] = {
                ...state.messages[index],
                is_deleted: true,
                deleted_at:
                    new Date().toISOString(),
                content: "Message deleted"
            };
        }


        renderMessages();

        announce("Message deleted.");
    }


    /* =====================================================
       REALTIME MESSAGES
       ===================================================== */

    function subscribeToCurrentChannel() {

        if (!state.currentChannel) {
            return;
        }


        cleanupMessageRealtime();


        const channelName =
            `community-messages-${state.currentChannel.id}`;


        const realtime =
            state.supabase
                .channel(channelName)
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_messages",
                        filter:
                            `channel_id=eq.${state.currentChannel.id}`
                    },
                    payload =>
                        handleMessageRealtime(
                            payload
                        )
                )
                .subscribe(
                    status => {

                        if (status === "SUBSCRIBED") {

                            console.log(
                                "Community realtime: SUBSCRIBED"
                            );
                        }
                    }
                );


        state.realtimeChannels.push(
            realtime
        );
    }


    function handleMessageRealtime(payload) {

        if (payload.eventType === "INSERT") {

            if (
                !state.messages.some(
                    item =>
                        item.id ===
                        payload.new.id
                )
            ) {

                state.messages.push(
                    payload.new
                );

                renderMessages();
            }

            return;
        }


        if (payload.eventType === "UPDATE") {

            const index =
                state.messages.findIndex(
                    item =>
                        item.id ===
                        payload.new.id
                );


            if (index !== -1) {

                state.messages[index] =
                    payload.new;

                renderMessages();
            }
        }


        if (payload.eventType === "DELETE") {

            state.messages =
                state.messages.filter(
                    item =>
                        item.id !==
                        payload.old.id
                );

            renderMessages();
        }
    }


    function cleanupMessageRealtime() {

        state.realtimeChannels
            .forEach(channel => {

                try {
                    state.supabase.removeChannel(
                        channel
                    );
                } catch (_) {}
            });


        state.realtimeChannels = [];
    }


    /* =====================================================
       MARK READ
       ===================================================== */

    async function markChannelRead() {

        if (
            !state.currentChannel ||
            !state.user
        ) {
            return;
        }


        const last =
            state.messages[
                state.messages.length - 1
            ];


        const payload = {

            channel_id:
                state.currentChannel.id,

            user_id:
                state.user.id,

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
                payload,
                {
                    onConflict:
                        "channel_id,user_id"
                }
            );


        if (error) {
            console.debug(
                "Read status:",
                error.message
            );
        }
    }


    /* =====================================================
       EMOJI
       ===================================================== */

    function setupEmojiButton() {

        if (!DOM.emojiButton) {
            return;
        }


        DOM.emojiButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                toggleEmojiPicker(
                    DOM.emojiButton
                );
            }
        );


        document.addEventListener(
            "click",
            event => {

                if (
                    state.emojiPanel &&
                    !state.emojiPanel.contains(
                        event.target
                    ) &&
                    event.target !==
                    DOM.emojiButton
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
                }
            }
        );
    }


    function toggleEmojiPicker(anchor) {

        if (state.emojiPanel) {

            closeEmojiPicker();

            return;
        }


        const panel =
            document.createElement("div");


        panel.className =
            "mwaniki-emoji-panel";


        panel.innerHTML = `

            <div class="emoji-grid">

                ${[
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
                    "😭",
                    "😡",
                    "👍",
                    "👎",
                    "👏",
                    "🙌",
                    "❤️",
                    "🔥",
                    "🎉",
                    "💯",
                    "📚",
                    "🧠",
                    "🩺",
                    "💊",
                    "🔬",
                    "🧪",
                    "🦠",
                    "🩸",
                    "😂",
                    "🙏"
                ]
                    .map(
                        emoji =>
                            `<button type="button">${emoji}</button>`
                    )
                    .join("")}

            </div>
        `;


        document.body.appendChild(panel);


        const rect =
            anchor.getBoundingClientRect();


        panel.style.position =
            "fixed";

        panel.style.left =
            `${Math.max(
                10,
                rect.left
            )}px`;

        panel.style.bottom =
            `${window.innerHeight - rect.top + 8}px`;

        panel.style.zIndex =
            "99999";


        panel.querySelectorAll(
            "button"
        ).forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    DOM.messageInput.value +=
                        button.textContent;

                    DOM.messageInput.focus();

                    autoResizeTextarea();

                    closeEmojiPicker();
                }
            );
        });


        state.emojiPanel = panel;

        DOM.emojiButton.setAttribute(
            "aria-expanded",
            "true"
        );
    }


    function closeEmojiPicker() {

        if (state.emojiPanel) {

            state.emojiPanel.remove();

            state.emojiPanel = null;
        }


        if (DOM.emojiButton) {

            DOM.emojiButton.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    }


    /* =====================================================
       MESSAGE REACTION PICKER
       ===================================================== */

    function openMessageReactionPicker(
        event,
        messageId
    ) {

        const old =
            document.querySelector(
                ".message-reaction-picker"
            );


        if (old) {
            old.remove();
        }


        const picker =
            document.createElement("div");


        picker.className =
            "message-reaction-picker";


        picker.innerHTML = [
            "👍",
            "❤️",
            "😂",
            "🔥",
            "👏",
            "🎉",
            "🧠"
        ]
            .map(
                emoji =>
                    `<button type="button">${emoji}</button>`
            )
            .join("");


        document.body.appendChild(picker);


        const rect =
            event.currentTarget
                .getBoundingClientRect();


        picker.style.position = "fixed";

        picker.style.left =
            `${rect.left}px`;

        picker.style.top =
            `${rect.bottom + 5}px`;

        picker.style.zIndex =
            "99999";


        picker.querySelectorAll(
            "button"
        ).forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    await toggleReaction(
                        messageId,
                        button.textContent
                    );

                    picker.remove();
                }
            );
        });


        setTimeout(() => {

            document.addEventListener(
                "click",
                function close(event) {

                    if (
                        !picker.contains(
                            event.target
                        )
                    ) {

                        picker.remove();

                        document.removeEventListener(
                            "click",
                            close
                        );
                    }
                }
            );

        }, 0);
    }


    async function toggleReaction(
        messageId,
        reaction
    ) {

        const {
            data: existing
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


        if (existing) {

            await state.supabase
                .from(
                    "chat_message_reactions"
                )
                .delete()
                .eq(
                    "id",
                    existing.id
                );

        } else {

            await state.supabase
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
        }
    }


    /* =====================================================
       TEXTAREA
       ===================================================== */

    function setupMessageComposer() {

        DOM.messageForm?.addEventListener(
            "submit",
            event => {

                event.preventDefault();

                sendMessage();
            }
        );


        DOM.messageInput?.addEventListener(
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


        DOM.messageInput?.addEventListener(
            "input",
            autoResizeTextarea
        );
    }


    function autoResizeTextarea() {

        if (!DOM.messageInput) {
            return;
        }


        DOM.messageInput.style.height =
            "auto";


        DOM.messageInput.style.height =
            `${Math.min(
                DOM.messageInput.scrollHeight,
                160
            )}px`;
    }


    /* =====================================================
       ATTACHMENTS
       ===================================================== */

    function setupAttachments() {

        if (!DOM.attachButton) {
            return;
        }


        DOM.attachButton.addEventListener(
            "click",
            () => {

                if (!state.currentChannel) {

                    announce(
                        "Select a channel first."
                    );

                    return;
                }


                if (!state.attachmentInput) {

                    state.attachmentInput =
                        document.createElement(
                            "input"
                        );

                    state.attachmentInput.type =
                        "file";

                    state.attachmentInput.multiple =
                        true;

                    state.attachmentInput.accept =
                        "image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip";
                }


                state.attachmentInput.value = "";

                state.attachmentInput.click();
            }
        );


        document.addEventListener(
            "change",
            event => {

                if (
                    event.target !==
                    state.attachmentInput
                ) {
                    return;
                }


                const files =
                    Array.from(
                        event.target.files || []
                    );


                uploadAttachments(files);
            }
        );
    }


    async function uploadAttachments(files) {

        if (!files.length) {
            return;
        }


        for (const file of files) {

            if (
                file.size >
                CONFIG.maxFileSize
            ) {

                announce(
                    `${file.name} is larger than 20 MB.`
                );

                continue;
            }


            try {

                announce(
                    `Uploading ${file.name}...`
                );


                const safeName =
                    file.name
                        .replace(
                            /[^a-zA-Z0-9._-]/g,
                            "_"
                        );


                const path =
                    `${state.user.id}/${Date.now()}_${safeName}`;


                const {
                    error:
                    uploadError
                } = await state.supabase
                    .storage
                    .from(
                        CONFIG.attachmentBucket
                    )
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
                    data:
                    publicData
                } = state.supabase
                    .storage
                    .from(
                        CONFIG.attachmentBucket
                    )
                    .getPublicUrl(path);


                const fileUrl =
                    publicData?.publicUrl ||
                    null;


                const {
                    data: message,
                    error:
                    messageError
                } = await state.supabase
                    .from("chat_messages")
                    .insert({
                        channel_id:
                            state.currentChannel.id,

                        user_id:
                            state.user.id,

                        content:
                            `📎 ${file.name}`,

                        message_type:
                            "file"
                    })
                    .select()
                    .single();


                if (messageError) {
                    throw messageError;
                }


                const {
                    error:
                    attachmentError
                } = await state.supabase
                    .from(
                        "chat_attachments"
                    )
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
                }


                announce(
                    `${file.name} uploaded.`
                );

            } catch (error) {

                console.error(
                    "❌ Upload failed:",
                    error
                );

                announce(
                    `Unable to upload ${file.name}.`
                );
            }
        }
    }


    /* =====================================================
       COMMUNITY MODAL
       ===================================================== */

    function setupCommunityModal() {

        [
            DOM.openCommunityButton,
            DOM.communitySelectorButton,
            DOM.headerCommunityButton
        ].forEach(button => {

            button?.addEventListener(
                "click",
                openCommunityModal
            );
        });


        DOM.closeCommunityModal?.addEventListener(
            "click",
            closeCommunityModal
        );


        DOM.communityModal?.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    DOM.communityModal
                ) {

                    closeCommunityModal();
                }
            }
        );


        DOM.communityModalSearch
            ?.addEventListener(
                "input",
                renderCommunityModal
            );


        document.addEventListener(
            "keydown",
            event => {

                if (event.key === "Escape") {

                    closeCommunityModal();
                }
            }
        );
    }


    function openCommunityModal() {

        if (!DOM.communityModal) {
            return;
        }


        renderCommunityModal();


        DOM.communityModal.classList.add(
            "open"
        );


        DOM.communityModal.setAttribute(
            "aria-hidden",
            "false"
        );


        [
            DOM.openCommunityButton,
            DOM.communitySelectorButton,
            DOM.headerCommunityButton
        ].forEach(button => {

            button?.setAttribute(
                "aria-expanded",
                "true"
            );
        });


        DOM.communityModalSearch?.focus();
    }


    function closeCommunityModal() {

        if (!DOM.communityModal) {
            return;
        }


        DOM.communityModal.classList.remove(
            "open"
        );


        DOM.communityModal.setAttribute(
            "aria-hidden",
            "true"
        );


        [
            DOM.openCommunityButton,
            DOM.communitySelectorButton,
            DOM.headerCommunityButton
        ].forEach(button => {

            button?.setAttribute(
                "aria-expanded",
                "false"
            );
        });
    }


    function renderCommunityModal() {

        if (!DOM.communityChoiceList) {
            return;
        }


        const query =
            (
                DOM.communityModalSearch
                    ?.value ||
                ""
            )
                .trim()
                .toLowerCase();


        const filtered =
            state.communities.filter(
                community => {

                    return (
                        !query ||
                        community.name
                            .toLowerCase()
                            .includes(query) ||
                        (
                            community.description ||
                            ""
                        )
                            .toLowerCase()
                            .includes(query)
                    );
                }
            );


        DOM.communityChoiceList.innerHTML =
            filtered.length
                ? ""
                : `
                    <div class="center-state">
                        No communities found.
                    </div>
                `;


        filtered.forEach(
            community => {

                const button =
                    document.createElement(
                        "button"
                    );


                button.type = "button";

                button.className =
                    "community-choice";


                button.setAttribute(
                    "role",
                    "option"
                );


                button.innerHTML = `

                    <div class="community-choice-icon">

                        ${
                            community.icon_url
                                ? `
                                    <img
                                        src="${escapeHTML(
                                            community.icon_url
                                        )}"
                                        alt=""
                                    >
                                `
                                : escapeHTML(
                                    getCommunityInitials(
                                        community.name
                                    )
                                )
                        }

                    </div>

                    <div>

                        <strong>
                            ${escapeHTML(
                                community.name
                            )}
                        </strong>

                        <small>
                            ${escapeHTML(
                                community.description ||
                                "Community"
                            )}
                        </small>

                    </div>
                `;


                if (
                    community.id ===
                    state.currentCommunity?.id
                ) {

                    button.classList.add(
                        "selected"
                    );
                }


                button.addEventListener(
                    "click",
                    () =>
                        selectCommunity(
                            community
                        )
                );


                DOM.communityChoiceList
                    .appendChild(button);
            }
        );
    }


    /* =====================================================
       GENERAL CALL MODAL
       ===================================================== */

    function setupCallButtons() {

        DOM.generalCallButton?.addEventListener(
            "click",
            openGeneralCallModal
        );


        DOM.closeGeneralCallModalButton
            ?.addEventListener(
                "click",
                closeGeneralCallModal
            );


        DOM.cancelGeneralCallButton
            ?.addEventListener(
                "click",
                closeGeneralCallModal
            );


        DOM.startGeneralCallButton
            ?.addEventListener(
                "click",
                startGeneralCall
            );


        DOM.acceptCallButton
            ?.addEventListener(
                "click",
                acceptIncomingCall
            );


        DOM.declineCallButton
            ?.addEventListener(
                "click",
                declineIncomingCall
            );


        DOM.leaveCallButton
            ?.addEventListener(
                "click",
                leaveCall
            );


        DOM.toggleMicrophoneButton
            ?.addEventListener(
                "click",
                toggleMicrophone
            );


        DOM.toggleCameraButton
            ?.addEventListener(
                "click",
                toggleCamera
            );


        DOM.shareScreenButton
            ?.addEventListener(
                "click",
                shareScreen
            );


        DOM.minimizeCallButton
            ?.addEventListener(
                "click",
                minimizeCall
            );
    }


    /* =====================================================
       OPEN GENERAL CALL
       ===================================================== */

    async function openGeneralCallModal() {

        if (!state.user) {
            return;
        }


        DOM.generalCallModal?.classList.add(
            "open"
        );


        DOM.generalCallModal?.setAttribute(
            "aria-hidden",
            "false"
        );


        state.selectedCallUsers.clear();

        updateCallSelectionCount();


        await loadCallUsers();
    }


    function closeGeneralCallModal() {

        DOM.generalCallModal?.classList.remove(
            "open"
        );


        DOM.generalCallModal?.setAttribute(
            "aria-hidden",
            "true"
        );


        setCallMessage("");
    }


    /* =====================================================
       LOAD CALL USERS
       ===================================================== */

    async function loadCallUsers() {

        DOM.generalCallUserList.innerHTML = `
            <div class="center-state">
                Loading online students...
            </div>
        `;


        /*
         * Community members are used as the source
         * of callable users.
         */

        const {
            data,
            error
        } = await state.supabase
            .from("chat_community_members")
            .select(
                "user_id, nickname, role, is_banned"
            )
            .eq(
                "community_id",
                state.currentCommunity?.id
            )
            .eq(
                "is_banned",
                false
            );


        if (error) {

            console.error(
                "❌ Call users:",
                error
            );

            DOM.generalCallUserList.innerHTML = `
                <div class="center-state">
                    Unable to load students.
                </div>
            `;

            return;
        }


        const users =
            (data || [])
                .filter(
                    member =>
                        member.user_id !==
                        state.user.id
                );


        DOM.generalCallUserStatus.textContent =
            `${users.length} students available`;


        DOM.generalCallUserList.innerHTML = "";


        if (!users.length) {

            DOM.generalCallUserList.innerHTML = `
                <div class="center-state">
                    No other students available.
                </div>
            `;

            return;
        }


        users.forEach(member => {

            const button =
                document.createElement(
                    "button"
                );


            button.type = "button";

            button.className =
                "call-user-option";


            button.dataset.userId =
                member.user_id;


            button.innerHTML = `

                <span class="call-user-avatar">
                    ${escapeHTML(
                        getInitial(
                            member.nickname ||
                            "Student"
                        )
                    )}
                </span>

                <span class="call-user-name">
                    ${escapeHTML(
                        member.nickname ||
                        "Student"
                    )}
                </span>

                <span class="call-user-check">
                    ✓
                </span>
            `;


            button.addEventListener(
                "click",
                () => {

                    if (
                        state.selectedCallUsers
                            .has(
                                member.user_id
                            )
                    ) {

                        state.selectedCallUsers
                            .delete(
                                member.user_id
                            );

                        button.classList.remove(
                            "selected"
                        );

                    } else {

                        state.selectedCallUsers
                            .add(
                                member.user_id
                            );

                        button.classList.add(
                            "selected"
                        );
                    }


                    updateCallSelectionCount();
                }
            );


            DOM.generalCallUserList
                .appendChild(button);
        });
    }


    function updateCallSelectionCount() {

        const count =
            state.selectedCallUsers.size;


        if (DOM.generalCallSelectionCount) {

            DOM.generalCallSelectionCount.textContent =
                `${count} selected`;
        }


        if (DOM.startGeneralCallButton) {

            DOM.startGeneralCallButton.disabled =
                count === 0;
        }
    }


    /* =====================================================
       START GENERAL CALL
       ===================================================== */

    async function startGeneralCall() {

        if (
            state.selectedCallUsers.size === 0
        ) {

            setCallMessage(
                "Select at least one student."
            );

            return;
        }


        setCallMessage(
            "Creating call..."
        );


        const room =
            await createCallRoom(
                null,
                "general"
            );


        if (!room) {
            return;
        }


        const users =
            Array.from(
                state.selectedCallUsers
            );


        await createCallParticipants(
            room.id,
            users
        );


        closeGeneralCallModal();


        await enterCall(
            room,
            true
        );
    }


    /* =====================================================
       CREATE COMMUNITY CALL
       ===================================================== */

    async function startCommunityCall() {

        if (!state.currentCommunity) {
            return;
        }


        const room =
            await createCallRoom(
                state.currentCommunity.id,
                "community"
            );


        if (!room) {
            return;
        }


        const members =
            await getCommunityMembers();


        const otherUsers =
            members.filter(
                id =>
                    id !== state.user.id
            );


        await createCallParticipants(
            room.id,
            otherUsers
        );


        await enterCall(
            room,
            true
        );
    }


    /* =====================================================
       CREATE CALL ROOM
       ===================================================== */

    async function createCallRoom(
        communityId,
        scope
    ) {

        const roomCode =
            createRoomCode();


        const {
            data,
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

            console.error(
                "❌ Call room creation failed:",
                error
            );

            announce(
                "Unable to create call."
            );

            return null;
        }


        return data;
    }


    function createRoomCode() {

        return (
            "MS-" +
            Math.random()
                .toString(36)
                .substring(2, 10)
                .toUpperCase()
        );
    }


    /* =====================================================
       CALL PARTICIPANTS
       ===================================================== */

    async function createCallParticipants(
        roomId,
        userIds
    ) {

        const rows = [
            state.user.id,
            ...userIds
        ]
            .filter(
                (id, index, array) =>
                    array.indexOf(id) ===
                    index
            )
            .map(userId => ({

                room_id:
                    roomId,

                user_id:
                    userId,

                status:
                    userId ===
                    state.user.id
                        ? "joined"
                        : "invited",

                joined_at:
                    userId ===
                    state.user.id
                        ? new Date().toISOString()
                        : null
            }));


        const {
            error
        } = await state.supabase
            .from(
                "chat_call_participants"
            )
            .insert(rows);


        if (error) {

            console.error(
                "❌ Call participants:",
                error
            );
        }
    }


    async function getCommunityMembers() {

        if (!state.currentCommunity) {
            return [];
        }


        const {
            data
        } = await state.supabase
            .from(
                "chat_community_members"
            )
            .select("user_id")
            .eq(
                "community_id",
                state.currentCommunity.id
            )
            .eq(
                "is_banned",
                false
            );


        return (data || [])
            .map(item => item.user_id);
    }


    /* =====================================================
       ENTER CALL
       ===================================================== */

    async function enterCall(
        room,
        isCaller
    ) {

        state.currentCall.roomId =
            room.id;

        state.currentCall.roomCode =
            room.room_code;

        state.currentCall.communityId =
            room.community_id;

        state.currentCall.scope =
            room.call_scope;

        state.currentCall.startedAt =
            Date.now();


        showCallOverlay();


        try {

            await acquireLocalMedia();

        } catch (error) {

            console.error(
                "❌ Media error:",
                error
            );

            updateCallSubtitle(
                "Camera/microphone unavailable"
            );
        }


        await state.supabase
            .from("chat_call_rooms")
            .update({
                status: "active",
                started_at:
                    new Date().toISOString()
            })
            .eq(
                "id",
                room.id
            );


        await updateOwnCallParticipant(
            "joined"
        );


        subscribeToCall(room.id);


        startCallTimer();


        /*
         * If caller, look for invited participants
         * and initiate WebRTC offers.
         */

        if (isCaller) {

            setTimeout(
                () =>
                    initiateExistingParticipants(),
                1000
            );
        }
    }


    /* =====================================================
       LOCAL MEDIA
       ===================================================== */

    async function acquireLocalMedia() {

        if (!navigator.mediaDevices) {

            throw new Error(
                "Media devices are unavailable."
            );
        }


        const stream =
            await navigator.mediaDevices
                .getUserMedia({
                    audio: true,
                    video: true
                });


        state.currentCall.localStream =
            stream;


        if (DOM.localVideo) {

            DOM.localVideo.srcObject =
                stream;
        }
    }


    /* =====================================================
       CALL OVERLAY
       ===================================================== */

    function showCallOverlay() {

        DOM.callOverlay?.classList.add(
            "open"
        );


        DOM.callOverlay?.setAttribute(
            "aria-hidden",
            "false"
        );


        if (DOM.callTitle) {

            DOM.callTitle.textContent =
                state.currentCall.scope ===
                "general"
                    ? "Mwaniki General Call"
                    : "Community Call";
        }


        updateCallSubtitle(
            "Connected"
        );
    }


    function hideCallOverlay() {

        DOM.callOverlay?.classList.remove(
            "open"
        );


        DOM.callOverlay?.setAttribute(
            "aria-hidden",
            "true"
        );
    }


    function updateCallSubtitle(text) {

        if (DOM.callSubtitle) {
            DOM.callSubtitle.textContent =
                text;
        }
    }


    /* =====================================================
       CALL TIMER
       ===================================================== */

    function startCallTimer() {

        clearInterval(
            state.currentCall.durationTimer
        );


        state.currentCall.durationTimer =
            setInterval(() => {

                const elapsed =
                    Math.floor(
                        (
                            Date.now() -
                            state.currentCall.startedAt
                        ) / 1000
                    );


                const minutes =
                    String(
                        Math.floor(
                            elapsed / 60
                        )
                    ).padStart(
                        2,
                        "0"
                    );


                const seconds =
                    String(
                        elapsed % 60
                    ).padStart(
                        2,
                        "0"
                    );


                if (DOM.callDuration) {

                    DOM.callDuration.textContent =
                        `${minutes}:${seconds}`;
                }

            }, 1000);
    }


    /* =====================================================
       CALL REALTIME
       ===================================================== */

    function subscribeToCall(roomId) {

        if (
            state.currentCall.signalChannel
        ) {

            try {

                state.supabase.removeChannel(
                    state.currentCall
                        .signalChannel
                );

            } catch (_) {}
        }


        const channel =
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
                    payload =>
                        handleCallSignal(
                            payload.new
                        )
                )
                .subscribe(
                    status => {

                        console.log(
                            "Call realtime:",
                            status
                        );
                    }
                );


        state.currentCall.signalChannel =
            channel;
    }


    /* =====================================================
       INITIATE EXISTING PARTICIPANTS
       ===================================================== */

    async function initiateExistingParticipants() {

        const {
            data,
            error
        } = await state.supabase
            .from(
                "chat_call_participants"
            )
            .select("user_id,status")
            .eq(
                "room_id",
                state.currentCall.roomId
            );


        if (error) {
            return;
        }


        for (const participant of data || []) {

            if (
                participant.user_id ===
                state.user.id
            ) {
                continue;
            }


            if (
                participant.status ===
                "invited"
            ) {

                await createPeerConnection(
                    participant.user_id,
                    true
                );
            }
        }
    }


    /* =====================================================
       PEER CONNECTION
       ===================================================== */

    async function createPeerConnection(
        remoteUserId,
        createOffer
    ) {

        if (
            state.currentCall.peers
                .has(remoteUserId)
        ) {

            return state.currentCall.peers
                .get(remoteUserId);
        }


        const pc =
            new RTCPeerConnection(
                CONFIG.rtcConfiguration
            );


        state.currentCall.peers.set(
            remoteUserId,
            pc
        );


        /*
         * Local tracks
         */

        if (
            state.currentCall.localStream
        ) {

            state.currentCall
                .localStream
                .getTracks()
                .forEach(track => {

                    pc.addTrack(
                        track,
                        state.currentCall
                            .localStream
                    );
                });
        }


        /*
         * Remote stream
         */

        pc.ontrack = event => {

            const stream =
                event.streams[0];


            if (!stream) {
                return;
            }


            addRemoteVideo(
                remoteUserId,
                stream
            );
        };


        /*
         * ICE candidates
         */

        pc.onicecandidate =
            async event => {

                if (!event.candidate) {
                    return;
                }


                await sendSignal(
                    remoteUserId,
                    "ice-candidate",
                    event.candidate
                );
            };


        pc.onconnectionstatechange =
            () => {

                const status =
                    pc.connectionState;


                if (
                    status ===
                    "failed" ||
                    status ===
                    "disconnected" ||
                    status ===
                    "closed"
                ) {

                    removePeer(
                        remoteUserId
                    );
                }
            };


        if (createOffer) {

            const offer =
                await pc.createOffer();


            await pc.setLocalDescription(
                offer
            );


            await sendSignal(
                remoteUserId,
                "offer",
                offer
            );
        }


        return pc;
    }


    /* =====================================================
       SEND CALL SIGNAL
       ===================================================== */

    async function sendSignal(
        receiverId,
        signalType,
        payload
    ) {

        const {
            error
        } = await state.supabase
            .from(
                "chat_call_signals"
            )
            .insert({

                room_id:
                    state.currentCall.roomId,

                sender_id:
                    state.user.id,

                receiver_id:
                    receiverId,

                signal_type:
                    signalType,

                payload:
                    payload
            });


        if (error) {

            console.error(
                "Signal error:",
                error
            );
        }
    }


    /* =====================================================
       HANDLE SIGNAL
       ===================================================== */

    async function handleCallSignal(
        signal
    ) {

        if (
            signal.receiver_id &&
            signal.receiver_id !==
            state.user.id
        ) {
            return;
        }


        if (
            signal.sender_id ===
            state.user.id
        ) {
            return;
        }


        const senderId =
            signal.sender_id;


        const pc =
            await createPeerConnection(
                senderId,
                false
            );


        try {

            if (
                signal.signal_type ===
                "offer"
            ) {

                await pc.setRemoteDescription(
                    new RTCSessionDescription(
                        signal.payload
                    )
                );


                const answer =
                    await pc.createAnswer();


                await pc.setLocalDescription(
                    answer
                );


                await sendSignal(
                    senderId,
                    "answer",
                    answer
                );


                return;
            }


            if (
                signal.signal_type ===
                "answer"
            ) {

                await pc.setRemoteDescription(
                    new RTCSessionDescription(
                        signal.payload
                    )
                );


                return;
            }


            if (
                signal.signal_type ===
                "ice-candidate"
            ) {

                await pc.addIceCandidate(
                    new RTCIceCandidate(
                        signal.payload
                    )
                );
            }

        } catch (error) {

            console.error(
                "WebRTC signal error:",
                error
            );
        }
    }


    /* =====================================================
       REMOTE VIDEO
       ===================================================== */

    function addRemoteVideo(
        userId,
        stream
    ) {

        const id =
            `remote-video-${userId}`;


        let tile =
            document.getElementById(id);


        if (!tile) {

            tile =
                document.createElement(
                    "div"
                );


            tile.className =
                "remote-video-tile";


            tile.id = id;


            tile.innerHTML = `

                <video
                    autoplay
                    playsinline
                ></video>

                <span>
                    Participant
                </span>
            `;


            DOM.callVideoGrid
                ?.appendChild(tile);
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


    function removePeer(userId) {

        const peer =
            state.currentCall.peers
                .get(userId);


        if (peer) {

            try {
                peer.close();
            } catch (_) {}
        }


        state.currentCall.peers.delete(
            userId
        );


        document
            .getElementById(
                `remote-video-${userId}`
            )
            ?.remove();
    }


    /* =====================================================
       MICROPHONE
       ===================================================== */

    async function toggleMicrophone() {

        const stream =
            state.currentCall.localStream;


        if (!stream) {
            return;
        }


        const track =
            stream.getAudioTracks()[0];


        if (!track) {
            return;
        }


        track.enabled =
            !track.enabled;


        if (DOM.toggleMicrophoneButton) {

            DOM.toggleMicrophoneButton.textContent =
                track.enabled
                    ? "🎙️"
                    : "🔇";

            DOM.toggleMicrophoneButton
                .setAttribute(
                    "aria-label",
                    track.enabled
                        ? "Mute microphone"
                        : "Unmute microphone"
                );
        }


        await updateCallParticipantState();
    }


    /* =====================================================
       CAMERA
       ===================================================== */

    async function toggleCamera() {

        const stream =
            state.currentCall.localStream;


        if (!stream) {
            return;
        }


        const track =
            stream.getVideoTracks()[0];


        if (!track) {
            return;
        }


        track.enabled =
            !track.enabled;


        if (DOM.toggleCameraButton) {

            DOM.toggleCameraButton.textContent =
                track.enabled
                    ? "📹"
                    : "🚫";

            DOM.toggleCameraButton
                .setAttribute(
                    "aria-label",
                    track.enabled
                        ? "Turn camera off"
                        : "Turn camera on"
                );
        }


        await updateCallParticipantState();
    }


    /* =====================================================
       SCREEN SHARE
       ===================================================== */

    async function shareScreen() {

        if (
            !navigator.mediaDevices
                ?.getDisplayMedia
        ) {

            announce(
                "Screen sharing is not supported."
            );

            return;
        }


        try {

            const screenStream =
                await navigator.mediaDevices
                    .getDisplayMedia({
                        video: true
                    });


            state.currentCall.screenStream =
                screenStream;


            const screenTrack =
                screenStream.getVideoTracks()[0];


            for (
                const pc
                of state.currentCall.peers.values()
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


            if (DOM.localVideo) {

                DOM.localVideo.srcObject =
                    screenStream;
            }


            screenTrack.onended =
                () =>
                    stopScreenShare();


            await updateCallParticipantState();

        } catch (error) {

            console.error(
                "Screen share:",
                error
            );
        }
    }


    async function stopScreenShare() {

        const stream =
            state.currentCall.localStream;


        const cameraTrack =
            stream?.getVideoTracks()[0];


        if (cameraTrack) {

            for (
                const pc
                of state.currentCall.peers.values()
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
                        cameraTrack
                    );
                }
            }
        }


        state.currentCall
            .screenStream
            ?.getTracks()
            .forEach(
                track =>
                    track.stop()
            );


        state.currentCall.screenStream =
            null;


        if (DOM.localVideo) {

            DOM.localVideo.srcObject =
                state.currentCall.localStream;
        }
    }


    /* =====================================================
       CALL PARTICIPANT STATE
       ===================================================== */

    async function updateCallParticipantState() {

        const stream =
            state.currentCall.localStream;


        const micOn =
            !!stream
                ?.getAudioTracks()
                .some(
                    track => track.enabled
                );


        const cameraOn =
            !!stream
                ?.getVideoTracks()
                .some(
                    track => track.enabled
                );


        const screenOn =
            !!state.currentCall.screenStream;


        await state.supabase
            .from(
                "chat_call_participants"
            )
            .update({

                is_muted:
                    !micOn,

                is_camera_on:
                    cameraOn,

                is_screen_sharing:
                    screenOn,

                updated_at:
                    new Date().toISOString()
            })
            .eq(
                "room_id",
                state.currentCall.roomId
            )
            .eq(
                "user_id",
                state.user.id
            );
    }


    async function updateOwnCallParticipant(
        status
    ) {

        await state.supabase
            .from(
                "chat_call_participants"
            )
            .update({

                status,

                joined_at:
                    status === "joined"
                        ? new Date().toISOString()
                        : undefined,

                updated_at:
                    new Date().toISOString()
            })
            .eq(
                "room_id",
                state.currentCall.roomId
            )
            .eq(
                "user_id",
                state.user.id
            );
    }


    /* =====================================================
       LEAVE CALL
       ===================================================== */

    async function leaveCall() {

        const roomId =
            state.currentCall.roomId;


        if (!roomId) {
            hideCallOverlay();
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
                roomId
            )
            .eq(
                "user_id",
                state.user.id
            );


        /*
         * Stop local media.
         */

        state.currentCall
            .localStream
            ?.getTracks()
            .forEach(
                track =>
                    track.stop()
            );


        state.currentCall
            .screenStream
            ?.getTracks()
            .forEach(
                track =>
                    track.stop()
            );


        /*
         * Close peers.
         */

        state.currentCall.peers
            .forEach(
                peer => {

                    try {
                        peer.close();
                    } catch (_) {}
                }
            );


        state.currentCall.peers.clear();


        /*
         * Stop timer.
         */

        clearInterval(
            state.currentCall.durationTimer
        );


        /*
         * Remove realtime channel.
         */

        if (
            state.currentCall.signalChannel
        ) {

            try {

                state.supabase.removeChannel(
                    state.currentCall
                        .signalChannel
                );

            } catch (_) {}
        }


        /*
         * End room only if nobody remains.
         */

        const {
            data: activeParticipants
        } = await state.supabase
            .from(
                "chat_call_participants"
            )
            .select("user_id")
            .eq(
                "room_id",
                roomId
            )
            .eq(
                "status",
                "joined"
            );


        if (
            !activeParticipants?.length
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
                    roomId
                );
        }


        resetCallState();

        hideCallOverlay();
    }


    function resetCallState() {

        state.currentCall = {

            roomId: null,

            roomCode: null,

            communityId: null,

            scope: null,

            type: "video",

            localStream: null,

            peers: new Map(),

            screenStream: null,

            startedAt: null,

            durationTimer: null,

            signalChannel: null,

            participantsChannel: null
        };
    }


    /* =====================================================
       MINIMIZE CALL
       ===================================================== */

    function minimizeCall() {

        DOM.callOverlay
            ?.classList.toggle(
                "minimized"
            );
    }


    /* =====================================================
       INCOMING CALLS
       ===================================================== */

    function subscribeToIncomingCalls() {

        const channel =
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
                    payload =>
                        handleIncomingCall(
                            payload.new
                        )
                )
                .subscribe(
                    status => {

                        console.log(
                            "Incoming calls:",
                            status
                        );
                    }
                );


        state.realtimeChannels.push(
            channel
        );
    }


    async function handleIncomingCall(
        participant
    ) {

        if (
            participant.user_id !==
            state.user.id
        ) {
            return;
        }


        if (
            participant.status !==
            "invited"
        ) {
            return;
        }


        const {
            data: room
        } = await state.supabase
            .from(
                "chat_call_rooms"
            )
            .select("*")
            .eq(
                "id",
                participant.room_id
            )
            .maybeSingle();


        if (!room) {
            return;
        }


        if (state.currentCall.roomId) {
            return;
        }


        showIncomingCall(room);
    }


    function showIncomingCall(room) {

        DOM.incomingCallToast
            ?.classList.add(
                "open"
            );


        DOM.incomingCallToast
            ?.setAttribute(
                "aria-hidden",
                "false"
            );


        DOM.incomingCallTitle.textContent =
            room.call_scope ===
            "general"
                ? "Incoming General Call"
                : "Incoming Community Call";


        DOM.incomingCallText.textContent =
            "Someone is inviting you to join a call.";


        DOM.incomingCallToast.dataset.roomId =
            room.id;
    }


    async function acceptIncomingCall() {

        const roomId =
            DOM.incomingCallToast
                ?.dataset
                .roomId;


        if (!roomId) {
            return;
        }


        const {
            data: room
        } = await state.supabase
            .from(
                "chat_call_rooms"
            )
            .select("*")
            .eq(
                "id",
                roomId
            )
            .single();


        if (!room) {
            return;
        }


        await state.supabase
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


        hideIncomingCall();


        await enterCall(
            room,
            false
        );
    }


    async function declineIncomingCall() {

        const roomId =
            DOM.incomingCallToast
                ?.dataset
                .roomId;


        if (roomId) {

            await state.supabase
                .from(
                    "chat_call_participants"
                )
                .update({
                    status: "declined"
                })
                .eq(
                    "room_id",
                    roomId
                )
                .eq(
                    "user_id",
                    state.user.id
                );
        }


        hideIncomingCall();
    }


    function hideIncomingCall() {

        DOM.incomingCallToast
            ?.classList.remove(
                "open"
            );


        DOM.incomingCallToast
            ?.setAttribute(
                "aria-hidden",
                "true"
            );
    }


    /* =====================================================
       NAVIGATION
       ===================================================== */

    function setupNavigation() {

        [
            DOM.homeButton,
            DOM.railHomeButton,
            DOM.dashboardButton
        ].forEach(button => {

            button?.addEventListener(
                "click",
                () => {

                    window.location.href =
                        CONFIG.homeUrl;
                }
            );
        });


        DOM.railGeneralButton
            ?.addEventListener(
                "click",
                () => {

                    const general =
                        state.communities.find(
                            community =>
                                (
                                    community.slug ||
                                    ""
                                ).toLowerCase() ===
                                "general"
                        );


                    if (general) {
                        selectCommunity(
                            general
                        );
                    } else if (
                        state.communities[0]
                    ) {

                        selectCommunity(
                            state.communities[0]
                        );
                    }
                }
            );


        [
            DOM.sidebarProfileButton,
            DOM.railProfileButton
        ].forEach(button => {

            button?.addEventListener(
                "click",
                () => {

                    window.location.href =
                        "./profile.html";
                }
            );
        });


        [
            DOM.startConversationButton,
            DOM.welcomeStartButton
        ].forEach(button => {

            button?.addEventListener(
                "click",
                () => {

                    DOM.messageInput?.focus();
                }
            );
        });
    }


    /* =====================================================
       COMMUNITY CALL FROM HEADER
       ===================================================== */

    function setupCommunityCallShortcut() {

        /*
         * Double-clicking the community header call
         * is NOT used.
         *
         * The existing General Call button remains
         * the general-call entry point.
         *
         * Community calls can be exposed through
         * a channel/button later without changing
         * the general call architecture.
         */
    }


    /* =====================================================
       RENDER CHANNEL ERROR
       ===================================================== */

    function renderChannelError(message) {

        if (!DOM.channelList) {
            return;
        }


        DOM.channelList.innerHTML = `
            <div class="center-state">
                <div>
                    Unable to load channels.
                    <br>
                    <small>
                        ${escapeHTML(
                            message || ""
                        )}
                    </small>
                </div>
            </div>
        `;
    }


    /* =====================================================
       AUTH STATE
       ===================================================== */

    function subscribeToAuthChanges() {

        state.supabase.auth
            .onAuthStateChange(
                (event, session) => {

                    console.log(
                        "🔐 Auth state:",
                        event
                    );


                    if (
                        event ===
                        "SIGNED_OUT"
                    ) {

                        window.location.href =
                            "./studentLogin.html";
                    }
                }
            );
    }


    /* =====================================================
       CLEANUP
       ===================================================== */

    window.addEventListener(
        "beforeunload",
        () => {

            try {

                state.currentCall
                    .localStream
                    ?.getTracks()
                    .forEach(
                        track =>
                            track.stop()
                    );


                state.currentCall
                    .screenStream
                    ?.getTracks()
                    .forEach(
                        track =>
                            track.stop()
                    );


                state.realtimeChannels
                    .forEach(
                        channel =>
                            state.supabase
                                ?.removeChannel(
                                    channel
                                )
                    );

            } catch (_) {}
        }
    );


    /* =====================================================
       INITIALIZATION
       ===================================================== */

    async function init() {

        cacheDOM();


        try {

            await waitForSupabase();

            await loadCurrentUser();

            if (!state.user) {
                return;
            }


            await loadProfile();


            setupNavigation();

            setupChannelSearch();

            setupMessageComposer();

            setupEmojiButton();

            setupAttachments();

            setupCommunityModal();

            setupCallButtons();

            setupCommunityCallShortcut();


            await loadCommunities();


            subscribeToIncomingCalls();


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
                "Community failed to load."
            );
        }
    }


    /* =====================================================
       START
       ===================================================== */

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


    /* =====================================================
       PUBLIC API
       Useful for debugging and future buttons.
       ===================================================== */

    window.MwanikiCommunity = {

        state,

        loadCommunities,

        loadChannels,

        loadMessages,

        selectCommunity,

        selectChannel,

        sendMessage,

        deleteMessage,

        openCommunityModal,

        closeCommunityModal,

        openGeneralCallModal,

        closeGeneralCallModal,

        startGeneralCall,

        startCommunityCall,

        leaveCall,

        toggleMicrophone,

        toggleCamera,

        shareScreen
    };

})();
