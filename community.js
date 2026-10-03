```javascript
/* ============================================================
   MWANIKI SCHOLARS COMMUNITY
   CLEAN COMMUNITY ENGINE
   ------------------------------------------------------------
   Designed for:
   community.html
   supabase.js

   Database tables used:

   chat_communities
   chat_community_members
   chat_channels
   chat_channel_members
   chat_messages
   chat_message_reactions
   chat_attachments
   chat_call_rooms
   chat_call_participants
   chat_call_signals
   chat_presence

   ============================================================ */

(() => {
    "use strict";

    console.log("🚀 Mwaniki Scholars Community starting...");

    /* ========================================================
       CONFIG
       ======================================================== */

    const CONFIG = {
        attachmentBucket: "chat-attachments",
        maxFileSize: 25 * 1024 * 1024,

        emojis: [
            "😀", "😂", "😊", "😍", "😎",
            "🤔", "😮", "😢", "😡", "😭",
            "👍", "👎", "👏", "🙏", "❤️",
            "🔥", "🎉", "💯", "✅", "❌",
            "📚", "🩺", "🧪", "💊", "🧬"
        ]
    };


    /* ========================================================
       SUPABASE
       ======================================================== */

    const supabase =
        window.supabase ||
        window.supabaseClient ||
        window.sb ||
        window.mwanikiSupabase;

    if (!supabase) {
        console.error("❌ Supabase client was not found.");
        return;
    }

    console.log("✅ Supabase client ready");


    /* ========================================================
       STATE
       ======================================================== */

    const state = {
        user: null,
        profile: null,

        communities: [],
        channels: [],

        currentCommunity: null,
        currentChannel: null,

        messages: [],

        communitySubscription: null,
        messageSubscription: null,
        signalSubscription: null,
        incomingCallSubscription: null,

        selectedCallUsers: new Set(),

        localStream: null,
        screenStream: null,

        currentCallRoom: null,
        currentCallParticipants: new Map(),

        peers: new Map(),

        callStartedAt: null,
        callTimer: null,

        microphoneEnabled: true,
        cameraEnabled: true,
        screenSharing: false,

        minimizedCall: false,

        emojiPicker: null,

        pendingCall: null
    };


    /* ========================================================
       DOM HELPER
       ======================================================== */

    const $ = (id) => document.getElementById(id);

    const els = {
        app: $("communityApp"),

        homeButton: $("homeButton"),
        railHomeButton: $("railHomeButton"),
        railGeneralButton: $("railGeneralButton"),
        communityRailList: $("communityRailList"),

        railProfileButton: $("railProfileButton"),
        railProfileAvatar: $("railProfileAvatar"),

        communityBrandTitle: $("communityBrandTitle"),
        communityBrandSubtitle: $("communityBrandSubtitle"),

        openCommunityButton: $("openCommunityButton"),

        channelSearchInput: $("channelSearchInput"),
        communitySelectorButton: $("communitySelectorButton"),

        selectedCommunityIcon: $("selectedCommunityIcon"),
        selectedCommunityName: $("selectedCommunityName"),
        selectedCommunityDescription: $("selectedCommunityDescription"),

        channelList: $("channelList"),

        sidebarProfileButton: $("sidebarProfileButton"),
        sidebarProfileAvatar: $("sidebarProfileAvatar"),
        sidebarProfileName: $("sidebarProfileName"),

        mainChannelTitle: $("mainChannelTitle"),
        mainChannelDescription: $("mainChannelDescription"),

        dashboardButton: $("dashboardButton"),
        headerCommunityButton: $("headerCommunityButton"),
        generalCallButton: $("generalCallButton"),
        startConversationButton: $("startConversationButton"),

        messageList: $("messageList"),
        messageForm: $("messageForm"),
        messageInput: $("messageInput"),
        sendMessageButton: $("sendMessageButton"),

        attachButton: $("attachButton"),
        emojiButton: $("emojiButton"),

        welcomeStartButton: $("welcomeStartButton"),

        communityModal: $("communityModal"),
        closeCommunityModal: $("closeCommunityModal"),
        communityModalSearch: $("communityModalSearch"),
        communityChoiceList: $("communityChoiceList"),

        generalCallModal: $("generalCallModal"),
        closeGeneralCallModalButton:
            $("closeGeneralCallModalButton"),

        generalCallUserList: $("generalCallUserList"),
        generalCallUserStatus: $("generalCallUserStatus"),
        generalCallSelectionCount:
            $("generalCallSelectionCount"),

        generalCallMessage: $("generalCallMessage"),

        cancelGeneralCallButton:
            $("cancelGeneralCallButton"),

        startGeneralCallButton:
            $("startGeneralCallButton"),

        callOverlay: $("callOverlay"),
        callTitle: $("callTitle"),
        callSubtitle: $("callSubtitle"),
        callDuration: $("callDuration"),
        callVideoGrid: $("callVideoGrid"),
        localVideo: $("localVideo"),
        callParticipants: $("callParticipants"),

        toggleMicrophoneButton:
            $("toggleMicrophoneButton"),

        toggleCameraButton:
            $("toggleCameraButton"),

        shareScreenButton:
            $("shareScreenButton"),

        minimizeCallButton:
            $("minimizeCallButton"),

        leaveCallButton:
            $("leaveCallButton"),

        incomingCallToast:
            $("incomingCallToast"),

        incomingCallTitle:
            $("incomingCallTitle"),

        incomingCallText:
            $("incomingCallText"),

        acceptCallButton:
            $("acceptCallButton"),

        declineCallButton:
            $("declineCallButton"),

        status:
            $("communityStatus"),

        announcer:
            $("accessibilityAnnouncer")
    };


    /* ========================================================
       UTILITY
       ======================================================== */

    function announce(text) {
        if (els.status) els.status.textContent = text;
        if (els.announcer) els.announcer.textContent = text;
    }


    function escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    function formatTime(value) {
        if (!value) return "";

        return new Intl.DateTimeFormat(
            undefined,
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        ).format(new Date(value));
    }


    function formatDate(value) {
        if (!value) return "";

        return new Intl.DateTimeFormat(
            undefined,
            {
                day: "numeric",
                month: "short",
                year: "numeric"
            }
        ).format(new Date(value));
    }


    function initials(name) {
        const text = String(name || "Student").trim();

        if (!text) return "S";

        return text
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part.charAt(0))
            .join("")
            .toUpperCase();
    }


    function goHome() {
        window.location.href = "./dashboard.html";
    }


    function randomRoomCode() {
        return (
            "MW-" +
            crypto.randomUUID()
                .replaceAll("-", "")
                .slice(0, 12)
                .toUpperCase()
        );
    }


    /* ========================================================
       AUTH
       ======================================================== */

    async function getAuthenticatedUser() {
        const {
            data,
            error
        } = await supabase.auth.getUser();

        if (error) {
            console.error("❌ Auth error:", error);
            return null;
        }

        return data?.user || null;
    }


    /* ========================================================
       USER DISPLAY
       Avoids student_profiles because that endpoint is
       returning 404 in the current project.
       ======================================================== */

    function buildProfile(user) {
        const metadata =
            user?.user_metadata || {};

        const name =
            metadata.full_name ||
            metadata.name ||
            metadata.display_name ||
            metadata.username ||
            user?.email?.split("@")[0] ||
            "Student";

        const avatar =
            metadata.avatar_url ||
            metadata.picture ||
            metadata.avatar ||
            "";

        return {
            id: user.id,
            name,
            avatar,
            email: user.email || ""
        };
    }


    function renderProfile() {
        const profile = state.profile;

        if (!profile) return;

        if (els.sidebarProfileName) {
            els.sidebarProfileName.textContent =
                profile.name;
        }

        const avatarElements = [
            els.sidebarProfileAvatar,
            els.railProfileAvatar
        ];

        avatarElements.forEach(img => {
            if (!img) return;

            if (profile.avatar) {
                img.src = profile.avatar;
                img.style.display = "block";
            } else {
                img.removeAttribute("src");
                img.style.display = "none";
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
                created_at
            `)
            .eq("is_active", true)
            .order("created_at", {
                ascending: true
            });

        if (error) {
            console.error(
                "❌ Failed loading communities:",
                error
            );

            showCommunityError(error.message);
            return;
        }

        state.communities = data || [];

        renderCommunityRail();
        renderCommunityChoices();

        if (!state.communities.length) {
            renderEmptyCommunityState();
            return;
        }

        const savedId =
            localStorage.getItem(
                "mwanikiSelectedCommunity"
            );

        const selected =
            state.communities.find(
                c => c.id === savedId
            ) || state.communities[0];

        await selectCommunity(selected.id);
    }


    function renderCommunityRail() {

        if (!els.communityRailList) return;

        els.communityRailList.innerHTML = "";

        state.communities.forEach(community => {

            const button =
                document.createElement("button");

            button.type = "button";
            button.className = "rail-button";
            button.dataset.communityId =
                community.id;

            button.title = community.name;
            button.setAttribute(
                "aria-label",
                community.name
            );

            if (community.icon_url) {

                const img =
                    document.createElement("img");

                img.src = community.icon_url;
                img.alt = "";
                img.loading = "lazy";

                button.appendChild(img);

            } else {

                const span =
                    document.createElement("span");

                span.className = "rail-emoji";

                span.textContent =
                    initials(community.name);

                button.appendChild(span);
            }

            button.addEventListener(
                "click",
                () => selectCommunity(community.id)
            );

            els.communityRailList.appendChild(button);
        });

        updateActiveRail();
    }


    function updateActiveRail() {

        document
            .querySelectorAll(
                ".community-rail .rail-button"
            )
            .forEach(button => {

                const id =
                    button.dataset.communityId;

                button.classList.toggle(
                    "active",
                    id === state.currentCommunity?.id
                );
            });
    }


    function renderCommunityChoices(
        search = ""
    ) {

        if (!els.communityChoiceList) return;

        const query =
            search.trim().toLowerCase();

        const communities =
            state.communities.filter(c => {

                if (!query) return true;

                return (
                    c.name
                        ?.toLowerCase()
                        .includes(query) ||
                    c.description
                        ?.toLowerCase()
                        .includes(query)
                );
            });

        if (!communities.length) {

            els.communityChoiceList.innerHTML =
                `<div class="center-state">
                    No communities found.
                </div>`;

            return;
        }

        els.communityChoiceList.innerHTML = "";

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

            button.dataset.id =
                community.id;

            const icon =
                community.icon_url
                    ? `<img src="${escapeHTML(
                        community.icon_url
                    )}" alt="">`
                    : `<span class="community-choice-icon">
                        ${escapeHTML(
                            initials(community.name)
                        )}
                    </span>`;

            button.innerHTML = `
                ${icon}

                <span class="community-choice-text">
                    <strong>
                        ${escapeHTML(community.name)}
                    </strong>

                    <small>
                        ${escapeHTML(
                            community.description ||
                            "Mwaniki Scholars community"
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

                    closeModal(
                        els.communityModal
                    );
                }
            );

            els.communityChoiceList
                .appendChild(button);
        });
    }


    function renderEmptyCommunityState() {

        els.channelList.innerHTML = `
            <div class="center-state">
                No communities are available.
            </div>
        `;

        els.messageList.innerHTML = `
            <div class="welcome-card">
                <div class="welcome-icon">
                    💬
                </div>

                <h2>
                    No communities yet
                </h2>

                <p>
                    No active communities are available.
                </p>
            </div>
        `;
    }


    function showCommunityError(message) {

        if (!els.channelList) return;

        els.channelList.innerHTML = `
            <div class="center-state">
                Unable to load communities.
                <br>
                <small>
                    ${escapeHTML(message)}
                </small>
            </div>
        `;
    }


    async function selectCommunity(
        communityId
    ) {

        const community =
            state.communities.find(
                c => c.id === communityId
            );

        if (!community) return;

        state.currentCommunity =
            community;

        localStorage.setItem(
            "mwanikiSelectedCommunity",
            community.id
        );

        updateCommunityHeader();
        updateActiveRail();

        await ensureCommunityMembership(
            community.id
        );

        await loadChannels();

        subscribeCommunityRealtime();
    }


    function updateCommunityHeader() {

        const community =
            state.currentCommunity;

        if (!community) return;

        if (els.communityBrandTitle) {
            els.communityBrandTitle.textContent =
                community.name;
        }

        if (els.communityBrandSubtitle) {
            els.communityBrandSubtitle.textContent =
                community.description ||
                "Learn • Discuss • Connect";
        }

        if (els.selectedCommunityName) {
            els.selectedCommunityName.textContent =
                community.name;
        }

        if (els.selectedCommunityDescription) {
            els.selectedCommunityDescription
                .textContent =
                community.description ||
                "Mwaniki Scholars community";
        }

        if (els.selectedCommunityIcon) {

            if (community.icon_url) {

                els.selectedCommunityIcon.innerHTML =
                    `<img src="${escapeHTML(
                        community.icon_url
                    )}" alt="">`;

            } else {

                els.selectedCommunityIcon.textContent =
                    initials(community.name);
            }
        }
    }


    async function ensureCommunityMembership(
        communityId
    ) {

        if (!state.user) return;

        const {
            data,
            error
        } = await supabase
            .from("chat_community_members")
            .select("id")
            .eq("community_id", communityId)
            .eq("user_id", state.user.id)
            .maybeSingle();

        if (error) {
            console.warn(
                "Community membership check:",
                error.message
            );
            return;
        }

        if (data) return;

        const {
            error: insertError
        } = await supabase
            .from("chat_community_members")
            .insert({
                community_id: communityId,
                user_id: state.user.id,
                role: "student"
            });

        if (insertError) {

            console.warn(
                "Could not create community membership:",
                insertError.message
            );
        }
    }


    /* ========================================================
       CHANNELS
       ======================================================== */

    async function loadChannels() {

        if (!state.currentCommunity) return;

        if (els.channelList) {

            els.channelList.innerHTML = `
                <div class="center-state">
                    <div class="loader"></div>
                    Loading channels...
                </div>
            `;
        }

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
                created_at
            `)
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

        if (!state.channels.length) {

            renderNoChannels();

            state.currentChannel = null;

            return;
        }

        const savedChannel =
            localStorage.getItem(
                "mwanikiSelectedChannel"
            );

        const channel =
            state.channels.find(
                c => c.id === savedChannel
            ) || state.channels[0];

        await selectChannel(channel.id);
    }


    function renderChannels(
        search = ""
    ) {

        if (!els.channelList) return;

        const query =
            search.trim().toLowerCase();

        const channels =
            state.channels.filter(channel => {

                if (!query) return true;

                return (
                    channel.name
                        ?.toLowerCase()
                        .includes(query) ||
                    channel.description
                        ?.toLowerCase()
                        .includes(query)
                );
            });

        if (!channels.length) {

            els.channelList.innerHTML = `
                <div class="center-state">
                    No channels found.
                </div>
            `;

            return;
        }

        els.channelList.innerHTML = "";

        channels.forEach(channel => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "channel-button";

            button.dataset.channelId =
                channel.id;

            button.innerHTML = `
                <span class="channel-icon">
                    ${escapeHTML(
                        channel.icon ||
                        (channel.channel_type === "voice"
                            ? "🔊"
                            : "#")
                    )}
                </span>

                <span class="channel-name">
                    ${escapeHTML(channel.name)}
                </span>
            `;

            button.addEventListener(
                "click",
                () => selectChannel(channel.id)
            );

            els.channelList.appendChild(button);
        });

        updateActiveChannel();
    }


    function updateActiveChannel() {

        document
            .querySelectorAll(
                ".channel-button"
            )
            .forEach(button => {

                button.classList.toggle(
                    "active",
                    button.dataset.channelId ===
                    state.currentChannel?.id
                );
            });
    }


    function renderChannelError(message) {

        els.channelList.innerHTML = `
            <div class="center-state">
                Unable to load channels.
                <br>
                <small>
                    ${escapeHTML(message)}
                </small>
            </div>
        `;
    }


    function renderNoChannels() {

        els.channelList.innerHTML = `
            <div class="center-state">
                No channels have been created
                for this community.
            </div>
        `;
    }


    async function selectChannel(channelId) {

        const channel =
            state.channels.find(
                c => c.id === channelId
            );

        if (!channel) return;

        state.currentChannel = channel;

        localStorage.setItem(
            "mwanikiSelectedChannel",
            channel.id
        );

        updateActiveChannel();

        els.mainChannelTitle.textContent =
            "# " + channel.name;

        els.mainChannelDescription.textContent =
            channel.description ||
            "Community discussion";

        await loadMessages();

        subscribeMessageRealtime();

        markChannelRead();
    }


    /* ========================================================
       MESSAGES
       ======================================================== */

    async function loadMessages() {

        if (!state.currentChannel) return;

        els.messageList.innerHTML = `
            <div class="center-state">
                <div class="loader"></div>
                Loading messages...
            </div>
        `;

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
                state.currentChannel.id
            )
            .order("created_at", {
                ascending: true
            })
            .limit(200);

        if (error) {

            console.error(
                "❌ Message loading failed:",
                error
            );

            renderMessageError(error.message);
            return;
        }

        state.messages = data || [];

        await enrichMessages();

        renderMessages();
    }


    async function enrichMessages() {

        const userIds =
            [...new Set(
                state.messages
                    .map(m => m.user_id)
                    .filter(Boolean)
            )];

        const profiles = new Map();

        for (const userId of userIds) {

            if (userId === state.user?.id) {

                profiles.set(
                    userId,
                    state.profile
                );

                continue;
            }

            try {

                const {
                    data
                } = await supabase.auth.admin
                    ?.getUserById?.(userId);

                if (data?.user) {

                    profiles.set(
                        userId,
                        buildProfile(data.user)
                    );
                }

            } catch (_) {
                // Browser anon clients normally cannot
                // access auth.admin. Fallback below.
            }
        }

        state.messages.forEach(message => {

            message.displayProfile =
                profiles.get(message.user_id) || {
                    name:
                        message.user_id ===
                        state.user?.id
                            ? state.profile.name
                            : "Student",
                    avatar: ""
                };
        });
    }


    function renderMessages() {

        if (!state.messages.length) {

            els.messageList.innerHTML = `
                <div class="welcome-card">

                    <div class="welcome-icon">
                        💬
                    </div>

                    <h2>
                        Welcome to #${escapeHTML(
                            state.currentChannel.name
                        )}
                    </h2>

                    <p>
                        This channel is ready.
                        Send the first message.
                    </p>

                </div>
            `;

            return;
        }

        els.messageList.innerHTML = "";

        state.messages.forEach(message => {

            els.messageList.appendChild(
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

        const mine =
            message.user_id === state.user?.id;

        const deleted =
            message.is_deleted;

        const profile =
            message.displayProfile || {
                name: "Student",
                avatar: ""
            };

        const avatar =
            profile.avatar
                ? `<img src="${escapeHTML(
                    profile.avatar
                )}" alt="">`
                : `<span class="message-avatar-text">
                    ${escapeHTML(
                        initials(profile.name)
                    )}
                </span>`;

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

        wrapper.innerHTML = `
            <div class="message-avatar">
                ${avatar}
            </div>

            <div class="message-body">

                <div class="message-meta">

                    <strong>
                        ${escapeHTML(profile.name)}
                    </strong>

                    <time>
                        ${formatTime(
                            message.created_at
                        )}
                    </time>

                    ${
                        message.is_edited && !deleted
                            ? `<span>(edited)</span>`
                            : ""
                    }

                </div>

                ${content}

                <div class="message-actions">

                    ${
                        !deleted && mine
                            ? `
                                <button
                                    type="button"
                                    class="message-delete"
                                    data-delete-message="${message.id}"
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
                "[data-delete-message]"
            );

        if (deleteButton) {

            deleteButton.addEventListener(
                "click",
                () => deleteMessage(message.id)
            );
        }

        return wrapper;
    }


    function formatMessageContent(text) {

        const escaped =
            escapeHTML(text);

        return escaped
            .replace(
                /(https?:\/\/[^\s<]+)/g,
                `<a
                    href="$1"
                    target="_blank"
                    rel="noopener noreferrer"
                >$1</a>`
            )
            .replace(/\n/g, "<br>");
    }


    function renderMessageError(message) {

        els.messageList.innerHTML = `
            <div class="center-state">
                Unable to load messages.
                <br>
                <small>
                    ${escapeHTML(message)}
                </small>
            </div>
        `;
    }


    async function sendMessage(event) {

        event.preventDefault();

        if (!state.user) {
            announce("You must be signed in.");
            return;
        }

        if (!state.currentChannel) {
            announce("Select a channel first.");
            return;
        }

        const content =
            els.messageInput.value.trim();

        if (!content) return;

        els.sendMessageButton.disabled = true;

        const {
            error
        } = await supabase
            .from("chat_messages")
            .insert({
                channel_id:
                    state.currentChannel.id,

                user_id:
                    state.user.id,

                content,

                message_type: "text"
            });

        els.sendMessageButton.disabled = false;

        if (error) {

            console.error(
                "❌ Send message failed:",
                error
            );

            announce(
                "Message could not be sent."
            );

            return;
        }

        els.messageInput.value = "";
        resizeTextarea();

        announce("Message sent.");
    }


    async function deleteMessage(messageId) {

        if (!state.user) return;

        const message =
            state.messages.find(
                m => m.id === messageId
            );

        if (!message) return;

        if (
            message.user_id !==
            state.user.id
        ) {
            announce(
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
        } = await supabase
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
                "❌ Delete failed:",
                error
            );

            announce(
                "Message could not be deleted."
            );

            return;
        }

        announce("Message deleted.");
    }


    async function markChannelRead() {

        if (
            !state.user ||
            !state.currentChannel
        ) return;

        const last =
            state.messages[
                state.messages.length - 1
            ];

        if (!last) return;

        const {
            data
        } = await supabase
            .from("chat_read_status")
            .select("id")
            .eq(
                "channel_id",
                state.currentChannel.id
            )
            .eq(
                "user_id",
                state.user.id
            )
            .maybeSingle();

        const payload = {
            channel_id:
                state.currentChannel.id,

            user_id:
                state.user.id,

            last_read_message_id:
                last.id,

            last_read_at:
                new Date().toISOString()
        };

        if (data?.id) {

            await supabase
                .from("chat_read_status")
                .update(payload)
                .eq("id", data.id);

        } else {

            await supabase
                .from("chat_read_status")
                .insert(payload);
        }
    }


    function scrollMessagesToBottom() {

        requestAnimationFrame(() => {

            if (!els.messageList) return;

            els.messageList.scrollTop =
                els.messageList.scrollHeight;
        });
    }


    /* ========================================================
       REALTIME
       ======================================================== */

    function subscribeCommunityRealtime() {

        if (state.communitySubscription) {

            supabase.removeChannel(
                state.communitySubscription
            );
        }

        if (!state.currentCommunity) return;

        state.communitySubscription =
            supabase
                .channel(
                    "community-" +
                    state.currentCommunity.id
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_channels",
                        filter:
                            `community_id=eq.${state.currentCommunity.id}`
                    },
                    async () => {

                        console.log(
                            "Community channel update"
                        );

                        await loadChannels();
                    }
                )
                .subscribe(status => {

                    console.log(
                        "Community realtime:",
                        status
                    );
                });
    }


    function subscribeMessageRealtime() {

        if (state.messageSubscription) {

            supabase.removeChannel(
                state.messageSubscription
            );
        }

        if (!state.currentChannel) return;

        state.messageSubscription =
            supabase
                .channel(
                    "messages-" +
                    state.currentChannel.id +
                    "-" +
                    crypto.randomUUID()
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
                            state.messages.some(
                                m =>
                                    m.id ===
                                    payload.new.id
                            )
                        ) {
                            return;
                        }

                        const message =
                            payload.new;

                        message.displayProfile = {
                            name:
                                message.user_id ===
                                state.user?.id
                                    ? state.profile.name
                                    : "Student",
                            avatar:
                                message.user_id ===
                                state.user?.id
                                    ? state.profile.avatar
                                    : ""
                        };

                        state.messages.push(
                            message
                        );

                        const empty =
                            els.messageList
                                .querySelector(
                                    ".welcome-card"
                                );

                        if (empty) {
                            els.messageList.innerHTML =
                                "";
                        }

                        els.messageList.appendChild(
                            createMessageElement(
                                message
                            )
                        );

                        scrollMessagesToBottom();
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
                    payload => {

                        const index =
                            state.messages.findIndex(
                                m =>
                                    m.id ===
                                    payload.new.id
                            );

                        if (index === -1) return;

                        state.messages[index] =
                            {
                                ...state.messages[index],
                                ...payload.new
                            };

                        renderMessages();
                    }
                )
                .subscribe(status => {

                    console.log(
                        "Message realtime:",
                        status
                    );
                });
    }


    /* ========================================================
       ATTACHMENTS
       ======================================================== */

    function openFilePicker() {

        const input =
            document.createElement("input");

        input.type = "file";
        input.multiple = true;

        input.accept =
            "image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt";

        input.addEventListener(
            "change",
            async () => {

                const files =
                    [...input.files];

                for (const file of files) {

                    await uploadAttachment(
                        file
                    );
                }
            }
        );

        input.click();
    }


    async function uploadAttachment(file) {

        if (!state.user) return;

        if (!state.currentChannel) {

            announce(
                "Select a channel first."
            );

            return;
        }

        if (
            file.size >
            CONFIG.maxFileSize
        ) {

            announce(
                "File is larger than 25 MB."
            );

            return;
        }

        announce(
            `Uploading ${file.name}...`
        );

        const safeName =
            file.name.replace(
                /[^a-zA-Z0-9._-]/g,
                "_"
            );

        const path =
            `${state.user.id}/` +
            `${Date.now()}-${safeName}`;

        const {
            error: uploadError
        } = await supabase.storage
            .from(CONFIG.attachmentBucket)
            .upload(
                path,
                file,
                {
                    upsert: false,
                    contentType: file.type
                }
            );

        if (uploadError) {

            console.error(
                "❌ Attachment upload failed:",
                uploadError
            );

            announce(
                "Attachment upload failed. Check that the storage bucket exists."
            );

            return;
        }

        const {
            data: publicData
        } = supabase.storage
            .from(CONFIG.attachmentBucket)
            .getPublicUrl(path);

        const fileUrl =
            publicData?.publicUrl || null;

        const messageType =
            file.type.startsWith("image/")
                ? "image"
                : "file";

        const {
            data: message,
            error: messageError
        } = await supabase
            .from("chat_messages")
            .insert({
                channel_id:
                    state.currentChannel.id,

                user_id:
                    state.user.id,

                content:
                    file.name,

                message_type:
                    messageType
            })
            .select("id")
            .single();

        if (messageError) {

            console.error(
                "❌ Attachment message failed:",
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
                    file.name,

                file_path:
                    path,

                file_url:
                    fileUrl,

                mime_type:
                    file.type,

                file_size:
                    file.size
            });

        if (attachmentError) {

            console.error(
                "❌ Attachment record failed:",
                attachmentError
            );

            announce(
                "File uploaded but attachment record failed."
            );

            return;
        }

        announce(
            `${file.name} uploaded.`
        );
    }


    /* ========================================================
       EMOJI
       ======================================================== */

    function toggleEmojiPicker() {

        if (state.emojiPicker) {

            closeEmojiPicker();
            return;
        }

        const picker =
            document.createElement("div");

        picker.id =
            "mwanikiEmojiPicker";

        picker.className =
            "mwaniki-emoji-picker";

        picker.setAttribute(
            "role",
            "dialog"
        );

        picker.innerHTML = `
            <div class="emoji-picker-header">
                <strong>
                    Emoji
                </strong>

                <button
                    type="button"
                    id="closeMwanikiEmojiPicker"
                    aria-label="Close emoji picker"
                >
                    ×
                </button>
            </div>

            <div class="emoji-grid"></div>
        `;

        const grid =
            picker.querySelector(
                ".emoji-grid"
            );

        CONFIG.emojis.forEach(emoji => {

            const button =
                document.createElement("button");

            button.type = "button";
            button.textContent = emoji;
            button.className = "emoji-choice";

            button.addEventListener(
                "click",
                () => {

                    insertEmoji(emoji);
                    closeEmojiPicker();
                }
            );

            grid.appendChild(button);
        });

        document.body.appendChild(picker);

        state.emojiPicker = picker;

        $("closeMwanikiEmojiPicker")
            ?.addEventListener(
                "click",
                closeEmojiPicker
            );

        els.emojiButton?.setAttribute(
            "aria-expanded",
            "true"
        );
    }


    function insertEmoji(emoji) {

        if (!els.messageInput) return;

        const input =
            els.messageInput;

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

        const position =
            start + emoji.length;

        input.setSelectionRange(
            position,
            position
        );

        resizeTextarea();
    }


    function closeEmojiPicker() {

        if (state.emojiPicker) {

            state.emojiPicker.remove();
            state.emojiPicker = null;
        }

        els.emojiButton?.setAttribute(
            "aria-expanded",
            "false"
        );
    }


    /* ========================================================
       MODALS
       ======================================================== */

    function openModal(modal) {

        if (!modal) return;

        modal.classList.add("open");

        modal.setAttribute(
            "aria-hidden",
            "false"
        );

        const focusable =
            modal.querySelector(
                "button, input, textarea, select"
            );

        requestAnimationFrame(() => {
            focusable?.focus();
        });
    }


    function closeModal(modal) {

        if (!modal) return;

        const active =
            document.activeElement;

        if (
            active &&
            modal.contains(active)
        ) {
            active.blur();
        }

        modal.classList.remove("open");

        modal.setAttribute(
            "aria-hidden",
            "true"
        );
    }


    function toggleCommunityModal() {

        if (
            els.communityModal
                .classList.contains("open")
        ) {
            closeModal(
                els.communityModal
            );
        } else {

            renderCommunityChoices();

            openModal(
                els.communityModal
            );
        }
    }


    /* ========================================================
       GENERAL CALL USER LIST
       ======================================================== */

    async function openGeneralCall() {

        state.selectedCallUsers.clear();

        els.generalCallMessage.textContent =
            "";

        updateSelectionCount();

        await loadCallUsers();

        openModal(
            els.generalCallModal
        );
    }


    async function loadCallUsers() {

        els.generalCallUserList.innerHTML = `
            <div class="center-state">
                Loading students...
            </div>
        `;

        /*
         * We intentionally don't query student_profiles
         * because that table currently returns 404 in
         * this project.
         *
         * Community members are used instead.
         */

        const {
            data,
            error
        } = await supabase
            .from("chat_community_members")
            .select(`
                user_id,
                nickname,
                role,
                is_banned,
                is_muted
            `)
            .eq(
                "community_id",
                state.currentCommunity?.id
            )
            .eq("is_banned", false);

        if (error) {

            console.error(
                "❌ Call users failed:",
                error
            );

            els.generalCallUserList.innerHTML = `
                <div class="center-state">
                    Unable to load students.
                </div>
            `;

            return;
        }

        const users =
            (data || []).filter(
                user =>
                    user.user_id !==
                    state.user.id
            );

        if (!users.length) {

            els.generalCallUserList.innerHTML = `
                <div class="center-state">
                    No other students available.
                </div>
            `;

            return;
        }

        els.generalCallUserList.innerHTML = "";

        users.forEach(member => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "call-user-option";

            button.dataset.userId =
                member.user_id;

            button.innerHTML = `
                <span class="call-user-avatar">
                    ${escapeHTML(
                        initials(
                            member.nickname ||
                            "Student"
                        )
                    )}
                </span>

                <span class="call-user-info">
                    <strong>
                        ${escapeHTML(
                            member.nickname ||
                            "Student"
                        )}
                    </strong>

                    <small>
                        ${escapeHTML(
                            member.role ||
                            "student"
                        )}
                    </small>
                </span>

                <span class="call-user-check">
                    ✓
                </span>
            `;

            button.addEventListener(
                "click",
                () => {

                    const id =
                        member.user_id;

                    if (
                        state.selectedCallUsers
                            .has(id)
                    ) {

                        state.selectedCallUsers
                            .delete(id);

                        button.classList
                            .remove("selected");

                    } else {

                        state.selectedCallUsers
                            .add(id);

                        button.classList
                            .add("selected");
                    }

                    updateSelectionCount();
                }
            );

            els.generalCallUserList
                .appendChild(button);
        });

        els.generalCallUserStatus.textContent =
            `${users.length} students available`;
    }


    function updateSelectionCount() {

        const count =
            state.selectedCallUsers.size;

        els.generalCallSelectionCount
            .textContent =
            `${count} selected`;
    }


    /* ========================================================
       CALL ROOM CREATION
       ======================================================== */

    async function createCallRoom({
        communityId = null,
        scope = "general",
        type = "video",
        users = []
    } = {}) {

        if (!state.user) {
            throw new Error(
                "You are not authenticated."
            );
        }

        const roomCode =
            randomRoomCode();

        const {
            data: room,
            error
        } = await supabase
            .from("chat_call_rooms")
            .insert({
                community_id:
                    communityId,

                room_code:
                    roomCode,

                call_scope:
                    scope,

                call_type:
                    type,

                status:
                    "waiting",

                created_by:
                    state.user.id
            })
            .select("*")
            .single();

        if (error) {
            throw error;
        }

        const participantRows = [
            {
                room_id:
                    room.id,

                user_id:
                    state.user.id,

                status:
                    "joined",

                joined_at:
                    new Date().toISOString(),

                is_camera_on:
                    state.cameraEnabled,

                is_muted:
                    !state.microphoneEnabled
            }
        ];

        users.forEach(userId => {

            if (
                userId &&
                userId !== state.user.id
            ) {

                participantRows.push({
                    room_id:
                        room.id,

                    user_id:
                        userId,

                    status:
                        "invited"
                });
            }
        });

        const {
            error:
                participantError
        } = await supabase
            .from("chat_call_participants")
            .insert(
                participantRows
            );

        if (participantError) {

            await supabase
                .from("chat_call_rooms")
                .delete()
                .eq("id", room.id);

            throw participantError;
        }

        return room;
    }


    async function startGeneralCall() {

        const users =
            [...state.selectedCallUsers];

        if (!users.length) {

            els.generalCallMessage.textContent =
                "Select at least one student.";

            return;
        }

        els.startGeneralCallButton.disabled =
            true;

        try {

            const room =
                await createCallRoom({
                    communityId:
                        state.currentCommunity?.id ||
                        null,

                    scope:
                        "general",

                    type:
                        "video",

                    users
                });

            closeModal(
                els.generalCallModal
            );

            await enterCall(
                room,
                false
            );

        } catch (error) {

            console.error(
                "❌ Could not create call:",
                error
            );

            els.generalCallMessage.textContent =
                error.message ||
                "Could not start call.";

        } finally {

            els.startGeneralCallButton.disabled =
                false;
        }
    }


    async function startCommunityCall() {

        if (!state.currentCommunity) {

            announce(
                "Choose a community first."
            );

            return;
        }

        try {

            const members =
                await getCommunityUserIds();

            const room =
                await createCallRoom({
                    communityId:
                        state.currentCommunity.id,

                    scope:
                        "community",

                    type:
                        "video",

                    users:
                        members
                });

            await enterCall(
                room,
                false
            );

        } catch (error) {

            console.error(
                "❌ Community call failed:",
                error
            );

            announce(
                error.message ||
                "Could not start community call."
            );
        }
    }


    async function getCommunityUserIds() {

        const {
            data,
            error
        } = await supabase
            .from("chat_community_members")
            .select("user_id")
            .eq(
                "community_id",
                state.currentCommunity.id
            )
            .eq("is_banned", false);

        if (error) throw error;

        return (data || [])
            .map(row => row.user_id)
            .filter(
                id =>
                    id !== state.user.id
            );
    }


    /* ========================================================
       CALL UI
       ======================================================== */

    async function enterCall(
        room,
        incoming = false
    ) {

        state.currentCallRoom =
            room;

        state.callStartedAt =
            new Date();

        state.microphoneEnabled = true;
        state.cameraEnabled = true;

        els.callTitle.textContent =
            incoming
                ? "Incoming Mwaniki Call"
                : "Mwaniki Call";

        els.callSubtitle.textContent =
            "Connecting...";

        openCallOverlay();

        await startLocalMedia();

        await updateRoomStarted();

        subscribeCallSignals();

        await loadCallParticipants();

        els.callSubtitle.textContent =
            "Connected";
    }


    function openCallOverlay() {

        els.callOverlay.classList.add(
            "open"
        );

        els.callOverlay.setAttribute(
            "aria-hidden",
            "false"
        );

        startCallTimer();
    }


    function closeCallOverlay() {

        if (!els.callOverlay) return;

        els.callOverlay.classList.remove(
            "open"
        );

        els.callOverlay.setAttribute(
            "aria-hidden",
            "true"
        );

        stopCallTimer();
    }


    async function startLocalMedia() {

        try {

            state.localStream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: true,
                        video: true
                    });

            els.localVideo.srcObject =
                state.localStream;

        } catch (error) {

            console.warn(
                "Camera/microphone unavailable:",
                error
            );

            try {

                state.localStream =
                    await navigator.mediaDevices
                        .getUserMedia({
                            audio: true,
                            video: false
                        });

                els.localVideo.srcObject =
                    state.localStream;

                state.cameraEnabled =
                    false;

            } catch (audioError) {

                console.error(
                    "Media access failed:",
                    audioError
                );

                announce(
                    "Camera and microphone access was denied."
                );
            }
        }
    }


    async function updateRoomStarted() {

        if (!state.currentCallRoom) return;

        await supabase
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
            );
    }


    async function loadCallParticipants() {

        if (!state.currentCallRoom) return;

        const {
            data,
            error
        } = await supabase
            .from("chat_call_participants")
            .select("*")
            .eq(
                "room_id",
                state.currentCallRoom.id
            );

        if (error) {

            console.error(
                "Call participant error:",
                error
            );

            return;
        }

        state.currentCallParticipants
            .clear();

        (data || []).forEach(participant => {

            state.currentCallParticipants
                .set(
                    participant.user_id,
                    participant
                );

            if (
                participant.user_id !==
                state.user.id
            ) {
                createPeerConnection(
                    participant.user_id,
                    participant.status ===
                    "joined"
                );
            }
        });

        renderCallParticipants();
    }


    function renderCallParticipants() {

        els.callParticipants.innerHTML = "";

        state.currentCallParticipants
            .forEach(
                (participant, userId) => {

                    if (
                        userId ===
                        state.user.id
                    ) {
                        return;
                    }

                    const item =
                        document.createElement(
                            "div"
                        );

                    item.className =
                        "call-participant";

                    item.textContent =
                        participant.status ===
                        "joined"
                            ? "Participant"
                            : "Invited";

                    els.callParticipants
                        .appendChild(item);
                }
            );
    }


    /* ========================================================
       WEBRTC
       ======================================================== */

    function createPeerConnection(
        userId,
        shouldOffer = false
    ) {

        if (state.peers.has(userId)) {
            return state.peers.get(userId);
        }

        const peer =
            new RTCPeerConnection({
                iceServers: [
                    {
                        urls:
                            "stun:stun.l.google.com:19302"
                    },
                    {
                        urls:
                            "stun:stun1.l.google.com:19302"
                    }
                ]
            });

        state.peers.set(
            userId,
            peer
        );

        if (state.localStream) {

            state.localStream
                .getTracks()
                .forEach(track => {

                    peer.addTrack(
                        track,
                        state.localStream
                    );
                });
        }

        peer.onicecandidate =
            async event => {

                if (
                    !event.candidate ||
                    !state.currentCallRoom
                ) {
                    return;
                }

                await sendSignal(
                    userId,
                    "ice-candidate",
                    event.candidate
                );
            };


        peer.ontrack =
            event => {

                const stream =
                    event.streams[0];

                if (!stream) return;

                attachRemoteVideo(
                    userId,
                    stream
                );
            };


        peer.onconnectionstatechange =
            () => {

                if (
                    [
                        "failed",
                        "closed",
                        "disconnected"
                    ].includes(
                        peer.connectionState
                    )
                ) {

                    peer.close();

                    state.peers.delete(
                        userId
                    );
                }
            };


        if (shouldOffer) {

            createOffer(
                userId,
                peer
            );
        }

        return peer;
    }


    async function createOffer(
        userId,
        peer
    ) {

        try {

            const offer =
                await peer.createOffer();

            await peer.setLocalDescription(
                offer
            );

            await sendSignal(
                userId,
                "offer",
                offer
            );

        } catch (error) {

            console.error(
                "Offer error:",
                error
            );
        }
    }


    async function handleOffer(
        senderId,
        payload
    ) {

        const peer =
            createPeerConnection(
                senderId,
                false
            );

        await peer.setRemoteDescription(
            new RTCSessionDescription(
                payload
            )
        );

        const answer =
            await peer.createAnswer();

        await peer.setLocalDescription(
            answer
        );

        await sendSignal(
            senderId,
            "answer",
            answer
        );
    }


    async function handleAnswer(
        senderId,
        payload
    ) {

        const peer =
            state.peers.get(senderId);

        if (!peer) return;

        await peer.setRemoteDescription(
            new RTCSessionDescription(
                payload
            )
        );
    }


    async function handleIceCandidate(
        senderId,
        payload
    ) {

        const peer =
            state.peers.get(senderId);

        if (!peer) return;

        try {

            await peer.addIceCandidate(
                new RTCIceCandidate(
                    payload
                )
            );

        } catch (error) {

            console.warn(
                "ICE candidate error:",
                error
            );
        }
    }


    async function sendSignal(
        receiverId,
        signalType,
        payload
    ) {

        if (!state.currentCallRoom) return;

        const {
            error
        } = await supabase
            .from("chat_call_signals")
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
                "Signal error:",
                error
            );
        }
    }


    function subscribeCallSignals() {

        if (state.signalSubscription) {

            supabase.removeChannel(
                state.signalSubscription
            );
        }

        if (!state.currentCallRoom) return;

        state.signalSubscription =
            supabase
                .channel(
                    "signals-" +
                    state.currentCallRoom.id +
                    "-" +
                    crypto.randomUUID()
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "chat_call_signals",
                        filter:
                            `room_id=eq.${state.currentCallRoom.id}`
                    },
                    async payload => {

                        const signal =
                            payload.new;

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

                        switch (
                            signal.signal_type
                        ) {

                            case "offer":

                                await handleOffer(
                                    signal.sender_id,
                                    signal.payload
                                );

                                break;

                            case "answer":

                                await handleAnswer(
                                    signal.sender_id,
                                    signal.payload
                                );

                                break;

                            case "ice-candidate":

                                await handleIceCandidate(
                                    signal.sender_id,
                                    signal.payload
                                );

                                break;
                        }
                    }
                )
                .subscribe(status => {

                    console.log(
                        "Call signaling:",
                        status
                    );
                });
    }


    function attachRemoteVideo(
        userId,
        stream
    ) {

        let tile =
            document.getElementById(
                `remote-${userId}`
            );

        if (!tile) {

            tile =
                document.createElement(
                    "div"
                );

            tile.className =
                "remote-video-tile";

            tile.id =
                `remote-${userId}`;

            tile.innerHTML = `
                <video
                    autoplay
                    playsinline
                ></video>

                <span>
                    Participant
                </span>
            `;

            els.callVideoGrid
                .appendChild(tile);
        }

        const video =
            tile.querySelector("video");

        if (
            video &&
            video.srcObject !== stream
        ) {

            video.srcObject =
                stream;
        }
    }


    /* ========================================================
       INCOMING CALLS
       ======================================================== */

    function subscribeIncomingCalls() {

        if (state.incomingCallSubscription) {

            supabase.removeChannel(
                state.incomingCallSubscription
            );
        }

        state.incomingCallSubscription =
            supabase
                .channel(
                    "incoming-calls-" +
                    state.user.id
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
                    async payload => {

                        const participant =
                            payload.new;

                        if (
                            participant.status !==
                            "invited"
                        ) {
                            return;
                        }

                        await showIncomingCall(
                            participant.room_id
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


    async function showIncomingCall(
        roomId
    ) {

        const {
            data: room
        } = await supabase
            .from("chat_call_rooms")
            .select("*")
            .eq("id", roomId)
            .maybeSingle();

        if (!room) return;

        if (
            room.status === "ended"
        ) {
            return;
        }

        state.pendingCall = room;

        els.incomingCallTitle.textContent =
            "Incoming call";

        els.incomingCallText.textContent =
            "Someone is calling you.";

        els.incomingCallToast.classList.add(
            "show"
        );

        els.incomingCallToast.setAttribute(
            "aria-hidden",
            "false"
        );
    }


    async function acceptIncomingCall() {

        const room =
            state.pendingCall;

        if (!room) return;

        hideIncomingCall();

        const {
            error
        } = await supabase
            .from("chat_call_participants")
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

            console.error(
                "Accept call error:",
                error
            );

            announce(
                "Could not join the call."
            );

            return;
        }

        await enterCall(
            room,
            true
        );
    }


    async function declineIncomingCall() {

        const room =
            state.pendingCall;

        hideIncomingCall();

        if (!room) return;

        await supabase
            .from("chat_call_participants")
            .update({
                status: "declined",
                left_at:
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

        state.pendingCall = null;
    }


    function hideIncomingCall() {

        els.incomingCallToast.classList
            .remove("show");

        els.incomingCallToast
            .setAttribute(
                "aria-hidden",
                "true"
            );
    }


    /* ========================================================
       CALL CONTROLS
       ======================================================== */

    function toggleMicrophone() {

        if (!state.localStream) return;

        state.microphoneEnabled =
            !state.microphoneEnabled;

        state.localStream
            .getAudioTracks()
            .forEach(track => {

                track.enabled =
                    state.microphoneEnabled;
            });

        els.toggleMicrophoneButton
            .textContent =
            state.microphoneEnabled
                ? "🎙️"
                : "🔇";

        updateParticipantState({
            is_muted:
                !state.microphoneEnabled
        });
    }


    function toggleCamera() {

        if (!state.localStream) return;

        state.cameraEnabled =
            !state.cameraEnabled;

        state.localStream
            .getVideoTracks()
            .forEach(track => {

                track.enabled =
                    state.cameraEnabled;
            });

        els.toggleCameraButton
            .textContent =
            state.cameraEnabled
                ? "📹"
                : "🚫";

        updateParticipantState({
            is_camera_on:
                state.cameraEnabled
        });
    }


    async function toggleScreenShare() {

        if (!state.currentCallRoom) return;

        if (state.screenSharing) {

            stopScreenShare();
            return;
        }

        try {

            state.screenStream =
                await navigator.mediaDevices
                    .getDisplayMedia({
                        video: true
                    });

            const screenTrack =
                state.screenStream
                    .getVideoTracks()[0];

            for (
                const peer
                of state.peers.values()
            ) {

                const sender =
                    peer.getSenders()
                        .find(
                            s =>
                                s.track?.kind ===
                                "video"
                        );

                if (sender) {

                    await sender.replaceTrack(
                        screenTrack
                    );
                }
            }

            els.localVideo.srcObject =
                state.screenStream;

            state.screenSharing = true;

            screenTrack.onended =
                () => stopScreenShare();

            updateParticipantState({
                is_screen_sharing: true
            });

        } catch (error) {

            console.warn(
                "Screen share cancelled:",
                error
            );
        }
    }


    async function stopScreenShare() {

        if (!state.screenStream) return;

        const cameraTrack =
            state.localStream
                ?.getVideoTracks()[0];

        for (
            const peer
            of state.peers.values()
        ) {

            const sender =
                peer.getSenders()
                    .find(
                        s =>
                            s.track?.kind ===
                            "video"
                    );

            if (sender) {

                await sender.replaceTrack(
                    cameraTrack || null
                );
            }
        }

        state.screenStream
            .getTracks()
            .forEach(track =>
                track.stop()
            );

        state.screenStream = null;
        state.screenSharing = false;

        els.localVideo.srcObject =
            state.localStream;

        updateParticipantState({
            is_screen_sharing: false
        });
    }


    async function updateParticipantState(
        changes
    ) {

        if (
            !state.currentCallRoom ||
            !state.user
        ) {
            return;
        }

        await supabase
            .from("chat_call_participants")
            .update({
                ...changes,
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


    async function leaveCall() {

        if (!state.currentCallRoom) return;

        const roomId =
            state.currentCallRoom.id;

        if (state.screenStream) {
            await stopScreenShare();
        }

        if (state.localStream) {

            state.localStream
                .getTracks()
                .forEach(track =>
                    track.stop()
                );

            state.localStream = null;
        }

        state.peers.forEach(
            peer => peer.close()
        );

        state.peers.clear();

        await supabase
            .from("chat_call_participants")
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

        await supabase
            .from("chat_call_rooms")
            .update({
                status: "ended",
                ended_at:
                    new Date().toISOString(),
                updated_at:
                    new Date().toISOString()
            })
            .eq("id", roomId)
            .eq(
                "created_by",
                state.user.id
            );

        if (state.signalSubscription) {

            supabase.removeChannel(
                state.signalSubscription
            );

            state.signalSubscription =
                null;
        }

        state.currentCallRoom =
            null;

        state.currentCallParticipants
            .clear();

        els.localVideo.srcObject = null;

        document
            .querySelectorAll(
                ".remote-video-tile"
            )
            .forEach(tile =>
                tile.remove()
            );

        closeCallOverlay();

        announce("Call ended.");
    }


    function minimizeCall() {

        state.minimizedCall =
            !state.minimizedCall;

        els.callOverlay.classList.toggle(
            "minimized",
            state.minimizedCall
        );
    }


    function startCallTimer() {

        stopCallTimer();

        state.callStartedAt =
            new Date();

        state.callTimer =
            setInterval(() => {

                if (!state.callStartedAt) {
                    return;
                }

                const seconds =
                    Math.floor(
                        (
                            Date.now() -
                            state.callStartedAt
                        ) / 1000
                    );

                const minutes =
                    Math.floor(
                        seconds / 60
                    );

                const remaining =
                    seconds % 60;

                els.callDuration
                    .textContent =
                    String(minutes)
                        .padStart(2, "0") +
                    ":" +
                    String(remaining)
                        .padStart(2, "0");

            }, 1000);
    }


    function stopCallTimer() {

        if (state.callTimer) {

            clearInterval(
                state.callTimer
            );

            state.callTimer = null;
        }

        if (els.callDuration) {
            els.callDuration.textContent =
                "00:00";
        }
    }


    /* ========================================================
       TEXTAREA
       ======================================================== */

    function resizeTextarea() {

        if (!els.messageInput) return;

        els.messageInput.style.height =
            "auto";

        els.messageInput.style.height =
            Math.min(
                els.messageInput.scrollHeight,
                180
            ) + "px";
    }


    /* ========================================================
       EVENTS
       ======================================================== */

    function bindEvents() {

        els.homeButton
            ?.addEventListener(
                "click",
                goHome
            );

        els.railHomeButton
            ?.addEventListener(
                "click",
                goHome
            );

        els.dashboardButton
            ?.addEventListener(
                "click",
                goHome
            );

        els.openCommunityButton
            ?.addEventListener(
                "click",
                toggleCommunityModal
            );

        els.communitySelectorButton
            ?.addEventListener(
                "click",
                toggleCommunityModal
            );

        els.headerCommunityButton
            ?.addEventListener(
                "click",
                toggleCommunityModal
            );

        els.closeCommunityModal
            ?.addEventListener(
                "click",
                () =>
                    closeModal(
                        els.communityModal
                    )
            );

        els.communityModalSearch
            ?.addEventListener(
                "input",
                event =>
                    renderCommunityChoices(
                        event.target.value
                    )
            );

        els.channelSearchInput
            ?.addEventListener(
                "input",
                event =>
                    renderChannels(
                        event.target.value
                    )
            );

        els.messageForm
            ?.addEventListener(
                "submit",
                sendMessage
            );

        els.messageInput
            ?.addEventListener(
                "input",
                resizeTextarea
            );

        els.messageInput
            ?.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key === "Enter" &&
                        !event.shiftKey
                    ) {

                        event.preventDefault();

                        els.messageForm
                            .requestSubmit();
                    }
                }
            );

        els.attachButton
            ?.addEventListener(
                "click",
                openFilePicker
            );

        els.emojiButton
            ?.addEventListener(
                "click",
                toggleEmojiPicker
            );

        els.welcomeStartButton
            ?.addEventListener(
                "click",
                () =>
                    els.messageInput?.focus()
            );

        els.generalCallButton
            ?.addEventListener(
                "click",
                openGeneralCall
            );

        els.closeGeneralCallModalButton
            ?.addEventListener(
                "click",
                () =>
                    closeModal(
                        els.generalCallModal
                    )
            );

        els.cancelGeneralCallButton
            ?.addEventListener(
                "click",
                () =>
                    closeModal(
                        els.generalCallModal
                    )
            );

        els.startGeneralCallButton
            ?.addEventListener(
                "click",
                startGeneralCall
            );

        els.toggleMicrophoneButton
            ?.addEventListener(
                "click",
                toggleMicrophone
            );

        els.toggleCameraButton
            ?.addEventListener(
                "click",
                toggleCamera
            );

        els.shareScreenButton
            ?.addEventListener(
                "click",
                toggleScreenShare
            );

        els.minimizeCallButton
            ?.addEventListener(
                "click",
                minimizeCall
            );

        els.leaveCallButton
            ?.addEventListener(
                "click",
                leaveCall
            );

        els.acceptCallButton
            ?.addEventListener(
                "click",
                acceptIncomingCall
            );

        els.declineCallButton
            ?.addEventListener(
                "click",
                declineIncomingCall
            );


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Escape"
                ) {

                    closeEmojiPicker();

                    closeModal(
                        els.communityModal
                    );

                    closeModal(
                        els.generalCallModal
                    );
                }

                if (
                    event.key === "/" &&
                    document.activeElement !==
                    els.messageInput
                ) {

                    event.preventDefault();

                    els.channelSearchInput
                        ?.focus();
                }
            }
        );


        document.addEventListener(
            "click",
            event => {

                if (
                    state.emojiPicker &&
                    !state.emojiPicker.contains(
                        event.target
                    ) &&
                    !els.emojiButton.contains(
                        event.target
                    )
                ) {

                    closeEmojiPicker();
                }
            }
        );


        window.addEventListener(
            "beforeunload",
            () => {

                state.peers.forEach(
                    peer => peer.close()
                );

                if (state.localStream) {

                    state.localStream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );
                }
            }
        );
    }


    /* ========================================================
       AUTH STATE
       ======================================================== */

    function subscribeAuth() {

        supabase.auth.onAuthStateChange(
            async (
                event,
                session
            ) => {

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
                    session.user.id !==
                    state.user?.id
                ) {

                    state.user =
                        session.user;

                    state.profile =
                        buildProfile(
                            session.user
                        );

                    renderProfile();
                }
            }
        );
    }


    /* ========================================================
       INITIALIZATION
       ======================================================== */

    async function init() {

        bindEvents();

        state.user =
            await getAuthenticatedUser();

        if (!state.user) {

            console.warn(
                "⚠️ No authenticated user."
            );

            window.location.href =
                "./index.html";

            return;
        }

        console.log(
            "✅ Authenticated as:",
            state.user.id
        );

        state.profile =
            buildProfile(
                state.user
            );

        renderProfile();

        subscribeAuth();

        subscribeIncomingCalls();

        await loadCommunities();

        console.log(
            "✅ Mwaniki Scholars Community loaded"
        );

        announce(
            "Community loaded."
        );
    }


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
            { once: true }
        );

    } else {

        init();
    }

})();
```
