/* ============================================================
   MWANIKI SCHOLARS
   COMMUNITY ENGINE
   ============================================================

   Responsibilities:
   - Supabase community loading
   - Mwaniki Scholars default community
   - Community rail
   - Channel loading
   - Messages
   - Realtime messages
   - Online/activity status
   - Member list
   - One-to-one call buttons
   - Community call button
   - General call button
   - Emoji picker
   - Image/document attachments
   - Voice-note recording
   - Message deletion
   - Reactions
   - Notifications
   - Profile names/photos

   IMPORTANT:
   WebRTC is NOT implemented here.
   All actual calling is handled by:
       community-calls.js
   ============================================================ */

(function () {

    "use strict";

    /* ==========================================================
       GLOBAL STATE
       ========================================================== */

    const state = {

        db: null,
        user: null,
        profile: null,

        communities: [],
        currentCommunity: null,

        channels: [],
        currentChannel: null,

        members: [],
        onlineUsers: new Map(),

        messages: [],
        messageMap: new Map(),

        messageSubscription: null,
        presenceSubscription: null,
        notificationSubscription: null,

        initialized: false,
        initializing: false,

        loadingMessages: false,
        loadingChannels: false,

        messageLimit: 100,

        recorder: null,
        recordingStream: null,
        recordingChunks: [],
        recordingStartedAt: 0,
        recordingTimer: null,

        attachment: null,

        replyingTo: null,

        unreadChannels: new Set(),

        typingTimer: null,
        typingUsers: new Map(),

        currentSearch: "",

        emojiOpen: false
    };


    /* ==========================================================
       DOM HELPERS
       ========================================================== */

    function $(id) {
        return document.getElementById(id);
    }

    function qs(selector, parent) {
        return (parent || document).querySelector(selector);
    }

    function qsa(selector, parent) {
        return Array.from(
            (parent || document).querySelectorAll(selector)
        );
    }

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


    function initials(name) {

        const text =
            String(name || "User").trim();

        if (!text) {
            return "U";
        }

        const parts =
            text.split(/\s+/).filter(Boolean);

        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }

        return (
            parts[0][0] +
            parts[parts.length - 1][0]
        ).toUpperCase();
    }


    function avatarHTML(name, avatar, className) {

        const safeName =
            escapeHTML(name || "User");

        const safeAvatar =
            escapeHTML(avatar || "");

        const cls =
            className || "community-avatar";

        if (safeAvatar) {

            return `
                <img
                    class="${cls}"
                    src="${safeAvatar}"
                    alt="${safeName}"
                    loading="lazy"
                    onerror="
                        this.style.display='none';
                        this.nextElementSibling.style.display='grid';
                    "
                >

                <span
                    class="${cls} avatar-fallback"
                    style="display:none"
                >
                    ${escapeHTML(initials(name))}
                </span>
            `;
        }

        return `
            <span class="${cls} avatar-fallback">
                ${escapeHTML(initials(name))}
            </span>
        `;
    }


    /* ==========================================================
       NOTIFICATIONS / TOAST
       ========================================================== */

    function toast(message, type) {

        let container =
            $("communityToastContainer");

        if (!container) {

            container =
                document.createElement("div");

            container.id =
                "communityToastContainer";

            container.className =
                "community-toast-container";

            document.body.appendChild(container);
        }

        const item =
            document.createElement("div");

        item.className =
            "community-toast " +
            (type || "");

        item.textContent =
            message;

        container.appendChild(item);

        setTimeout(function () {

            item.remove();

        }, 4000);
    }


    /* ==========================================================
       SUPABASE
       ========================================================== */

    function getSupabase() {

        return (
            window.mwanikiSupabase ||
            window.supabaseClient ||
            window.mwanikiSupabaseClient ||
            window.sb ||
            (
                window.supabase &&
                window.supabase.auth &&
                typeof window.supabase.from === "function"
                    ? window.supabase
                    : null
            )
        );
    }


    function startAfterSupabase() {

        if (state.initialized || state.initializing) {
            return;
        }

        state.initializing = true;

        state.db =
            getSupabase();

        if (!state.db) {

            console.error(
                "❌ Community: Supabase client was not found."
            );

            state.initializing = false;

            return;
        }

        console.log(
            "✅ Community: Supabase client ready."
        );

        initializeCommunity();
    }


    /* ==========================================================
       AUTH
       ========================================================== */

    async function loadCurrentUser() {

        const {
            data,
            error
        } =
            await state.db.auth.getUser();

        if (error) {
            throw error;
        }

        state.user =
            data && data.user
                ? data.user
                : null;

        return state.user;
    }


    /* ==========================================================
       PROFILE
       ========================================================== */

    async function loadProfile() {

        if (!state.user) {
            return null;
        }

        let profile = null;

        /*
         * First try students.
         */

        try {

            const result =
                await state.db
                    .from("students")
                    .select("*")
                    .eq("id", state.user.id)
                    .maybeSingle();

            if (
                !result.error &&
                result.data
            ) {
                profile = result.data;
            }

        } catch (error) {

            console.warn(
                "Students profile lookup skipped:",
                error
            );
        }


        /*
         * Then try public profile.
         */

        if (!profile) {

            try {

                const result =
                    await state.db
                        .from("chat_public_profiles")
                        .select("*")
                        .eq("id", state.user.id)
                        .maybeSingle();

                if (
                    !result.error &&
                    result.data
                ) {
                    profile = result.data;
                }

            } catch (error) {

                console.warn(
                    "Public profile lookup skipped:",
                    error
                );
            }
        }


        state.profile =
            profile || {
                id: state.user.id,
                full_name:
                    state.user.user_metadata?.full_name ||
                    state.user.user_metadata?.name ||
                    state.user.email?.split("@")[0] ||
                    "User",
                avatar_url:
                    state.user.user_metadata?.avatar_url ||
                    ""
            };

        return state.profile;
    }


    function getProfileName(profile) {

        if (!profile) {
            return "User";
        }

        return (
            profile.full_name ||
            profile.name ||
            profile.display_name ||
            profile.username ||
            profile.email ||
            "User"
        );
    }


    function getProfileAvatar(profile) {

        if (!profile) {
            return "";
        }

        return (
            profile.avatar_url ||
            profile.avatar ||
            profile.photo_url ||
            profile.profile_photo ||
            ""
        );
    }


    /* ==========================================================
       COMMUNITIES
       ========================================================== */

    async function loadCommunities() {

        const container =
            $("communityRail");

        try {

            const {
                data,
                error
            } =
                await state.db
                    .from("chat_communities")
                    .select("*")
                    .eq("is_active", true)
                    .order("name", {
                        ascending: true
                    });

            if (error) {
                throw error;
            }

            state.communities =
                Array.isArray(data)
                    ? data
                    : [];

        } catch (error) {

            console.error(
                "❌ Could not load communities:",
                error
            );

            state.communities = [];
        }


        renderCommunityRail();


        /*
         * Always prefer Mwaniki Scholars as the initial
         * community.
         */

        let selected =
            state.communities.find(function (community) {

                const name =
                    String(
                        community.name || ""
                    ).toLowerCase();

                const slug =
                    String(
                        community.slug || ""
                    ).toLowerCase();

                return (
                    name === "mwaniki scholars" ||
                    slug === "mwaniki-scholars"
                );
            });


        if (!selected) {
            selected =
                state.communities[0] || null;
        }


        if (selected) {
            await selectCommunity(
                selected.id,
                false
            );
        }
    }


    function renderCommunityRail() {

        const rail =
            $("communityRail");

        if (!rail) {
            return;
        }

        rail.innerHTML = "";

        state.communities.forEach(function (community) {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "community-rail-item";

            button.dataset.communityId =
                community.id;

            const name =
                community.name ||
                "Community";

            const icon =
                community.icon_url ||
                community.image_url ||
                community.avatar_url ||
                "";

            if (icon) {

                button.innerHTML = `
                    <img
                        src="${escapeHTML(icon)}"
                        alt="${escapeHTML(name)}"
                    >
                `;

            } else {

                button.innerHTML = `
                    <span class="community-rail-fallback">
                        ${escapeHTML(initials(name))}
                    </span>
                `;
            }

            button.title =
                name;

            button.addEventListener(
                "click",
                function () {

                    selectCommunity(
                        community.id,
                        true
                    );
                }
            );

            rail.appendChild(button);
        });
    }


    async function selectCommunity(
        communityId,
        updateURL
    ) {

        const community =
            state.communities.find(function (item) {

                return String(item.id) ===
                    String(communityId);
            });

        if (!community) {
            return;
        }

        state.currentCommunity =
            community;

        qsa(
            "[data-community-id]"
        ).forEach(function (item) {

            item.classList.toggle(
                "active",
                String(
                    item.dataset.communityId
                ) === String(communityId)
            );
        });


        updateCommunityHeader();


        if (updateURL) {

            try {

                const url =
                    new URL(
                        window.location.href
                    );

                url.searchParams.set(
                    "community",
                    community.id
                );

                history.replaceState(
                    {},
                    "",
                    url
                );

            } catch (_) {}
        }


        await loadChannels();

        await loadMembers();
    }


    function updateCommunityHeader() {

        const community =
            state.currentCommunity;

        if (!community) {
            return;
        }

        const name =
            community.name ||
            "Mwaniki Scholars";


        const title =
            $("communityName");

        if (title) {
            title.textContent = name;
        }


        const description =
            $("communityDescription");

        if (description) {

            description.textContent =
                community.description ||
                "Academic community";
        }


        const avatar =
            $("communityHeaderAvatar");

        if (avatar) {

            const icon =
                community.icon_url ||
                community.image_url ||
                "";

            if (icon) {

                avatar.src = icon;

            } else {

                avatar.removeAttribute("src");

                avatar.alt =
                    initials(name);
            }
        }
    }


    /* ==========================================================
       CHANNELS
       ========================================================== */

    async function loadChannels() {

        if (!state.currentCommunity) {
            return;
        }

        state.loadingChannels = true;

        const list =
            $("channelList");

        if (list) {

            list.innerHTML = `
                <div class="community-loading">
                    Loading channels...
                </div>
            `;
        }


        try {

            const {
                data,
                error
            } =
                await state.db
                    .from("chat_channels")
                    .select("*")
                    .eq(
                        "community_id",
                        state.currentCommunity.id
                    )
                    .order("position", {
                        ascending: true
                    });

            if (error) {
                throw error;
            }

            state.channels =
                Array.isArray(data)
                    ? data
                    : [];

        } catch (error) {

            console.error(
                "❌ Could not load channels:",
                error
            );

            state.channels = [];
        }


        state.loadingChannels = false;

        renderChannels();


        /*
         * Prefer discussion/general channel.
         */

        const preferred =
            state.channels.find(function (channel) {

                const name =
                    String(
                        channel.name || ""
                    ).toLowerCase();

                return (
                    name === "general" ||
                    name === "discussion" ||
                    name === "discussions" ||
                    name.includes("discussion")
                );
            }) ||
            state.channels[0];


        if (preferred) {

            await selectChannel(
                preferred.id,
                false
            );
        }
    }


    function groupChannels(channels) {

        const groups = {};

        channels.forEach(function (channel) {

            const category =
                channel.category ||
                channel.channel_category ||
                "Channels";

            if (!groups[category]) {
                groups[category] = [];
            }

            groups[category].push(channel);
        });

        return groups;
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
                <div class="community-empty">
                    No channels available.
                </div>
            `;

            return;
        }


        const groups =
            groupChannels(state.channels);


        Object.keys(groups).forEach(
            function (category) {

                const wrapper =
                    document.createElement("div");

                wrapper.className =
                    "channel-category";


                const heading =
                    document.createElement("div");

                heading.className =
                    "channel-category-title";

                heading.textContent =
                    category;


                wrapper.appendChild(
                    heading
                );


                groups[category].forEach(
                    function (channel) {

                        const button =
                            document.createElement("button");

                        button.type = "button";

                        button.className =
                            "channel-item";

                        button.dataset.channelId =
                            channel.id;

                        const isVoice =
                            channel.type === "voice" ||
                            channel.channel_type === "voice";

                        button.innerHTML = `
                            <span class="channel-icon">
                                ${isVoice ? "🔊" : "#"}
                            </span>

                            <span class="channel-name">
                                ${escapeHTML(
                                    channel.name ||
                                    "channel"
                                )}
                            </span>

                            <span
                                class="channel-unread"
                                hidden
                            >
                                0
                            </span>
                        `;


                        button.addEventListener(
                            "click",
                            function () {

                                selectChannel(
                                    channel.id,
                                    true
                                );
                            }
                        );


                        wrapper.appendChild(
                            button
                        );
                    }
                );


                list.appendChild(
                    wrapper
                );
            }
        );
    }


    async function selectChannel(
        channelId,
        scrollToBottom
    ) {

        const channel =
            state.channels.find(function (item) {

                return String(item.id) ===
                    String(channelId);
            });

        if (!channel) {
            return;
        }

        state.currentChannel =
            channel;


        qsa(
            ".channel-item"
        ).forEach(function (item) {

            item.classList.toggle(
                "active",
                String(
                    item.dataset.channelId
                ) === String(channelId)
            );
        });


        updateChannelHeader();

        clearChannelUnread(channelId);

        await loadMessages();

        subscribeToMessages();


        if (scrollToBottom !== false) {
            scrollMessagesToBottom();
        }
    }


    function updateChannelHeader() {

        const channel =
            state.currentChannel;

        if (!channel) {
            return;
        }


        const title =
            $("channelTitle");

        if (title) {

            title.textContent =
                "#" +
                (
                    channel.name ||
                    "channel"
                );
        }


        const description =
            $("channelTopic");

        if (description) {

            description.textContent =
                channel.topic ||
                channel.description ||
                "";
        }
    }


    function clearChannelUnread(channelId) {

        state.unreadChannels.delete(
            String(channelId)
        );

        const item =
            qs(
                `[data-channel-id="${CSS.escape(
                    String(channelId)
                )}"]`
            );

        if (!item) {
            return;
        }

        const badge =
            qs(
                ".channel-unread",
                item
            );

        if (badge) {
            badge.hidden = true;
            badge.textContent = "0";
        }
    }


    /* ==========================================================
       MEMBERS
       ========================================================== */

    async function loadMembers() {

        if (!state.currentCommunity) {
            return;
        }

        try {

            const {
                data,
                error
            } =
                await state.db
                    .from("chat_community_members")
                    .select("*")
                    .eq(
                        "community_id",
                        state.currentCommunity.id
                    );

            if (error) {
                throw error;
            }

            state.members =
                Array.isArray(data)
                    ? data
                    : [];

        } catch (error) {

            console.error(
                "❌ Could not load community members:",
                error
            );

            state.members = [];
        }


        await enrichMemberProfiles();

        renderMembers();
    }


    async function enrichMemberProfiles() {

        if (!state.members.length) {
            return;
        }

        const ids =
            state.members
                .map(function (member) {

                    return (
                        member.user_id ||
                        member.id
                    );

                })
                .filter(Boolean);


        if (!ids.length) {
            return;
        }


        try {

            const {
                data,
                error
            } =
                await state.db
                    .from("chat_public_profiles")
                    .select("*")
                    .in("id", ids);

            if (error) {
                return;
            }


            const profiles =
                new Map(
                    (data || []).map(
                        function (profile) {

                            return [
                                String(profile.id),
                                profile
                            ];
                        }
                    )
                );


            state.members =
                state.members.map(
                    function (member) {

                        const id =
                            String(
                                member.user_id ||
                                member.id
                            );

                        const profile =
                            profiles.get(id);

                        return {
                            ...member,
                            profile:
                                profile ||
                                member.profile ||
                                null
                        };
                    }
                );

        } catch (_) {}
    }


    function renderMembers() {

        const sidebar =
            $("memberSidebar");

        if (!sidebar) {
            return;
        }


        let list =
            qs(
                ".member-list",
                sidebar
            );


        if (!list) {

            list =
                document.createElement("div");

            list.className =
                "member-list";

            sidebar.appendChild(list);
        }


        list.innerHTML = "";


        const online =
            [];

        const offline =
            [];


        state.members.forEach(
            function (member) {

                const profile =
                    member.profile ||
                    member;

                const id =
                    String(
                        member.user_id ||
                        member.id ||
                        profile.id ||
                        ""
                    );

                const isOnline =
                    state.onlineUsers.has(id);


                if (isOnline) {
                    online.push(member);
                } else {
                    offline.push(member);
                }
            }
        );


        renderMemberGroup(
            list,
            "ONLINE",
            online
        );

        renderMemberGroup(
            list,
            "OFFLINE",
            offline
        );
    }


    function renderMemberGroup(
        container,
        title,
        members
    ) {

        if (!members.length) {
            return;
        }


        const group =
            document.createElement("section");

        group.className =
            "member-group";


        const heading =
            document.createElement("div");

        heading.className =
            "member-group-title";

        heading.textContent =
            `${title} — ${members.length}`;


        group.appendChild(
            heading
        );


        members.forEach(
            function (member) {

                const profile =
                    member.profile ||
                    member;

                const userId =
                    String(
                        member.user_id ||
                        member.id ||
                        profile.id ||
                        ""
                    );

                const name =
                    getProfileName(profile);

                const avatar =
                    getProfileAvatar(profile);

                const row =
                    document.createElement("div");

                row.className =
                    "community-member";

                row.dataset.userId =
                    userId;


                const avatarBox =
                    document.createElement("div");

                avatarBox.className =
                    "community-member-avatar";

                avatarBox.innerHTML =
                    avatarHTML(
                        name,
                        avatar,
                        "member-photo"
                    );


                const info =
                    document.createElement("div");

                info.className =
                    "community-member-info";

                info.innerHTML = `
                    <div class="community-member-name">
                        ${escapeHTML(name)}
                    </div>

                    <div class="community-member-status">
                        ${state.onlineUsers.has(userId)
                            ? "Online"
                            : "Offline"}
                    </div>
                `;


                const actions =
                    document.createElement("div");

                actions.className =
                    "community-member-actions";


                if (
                    userId &&
                    userId !== String(state.user?.id)
                ) {

                    const callButton =
                        document.createElement("button");

                    callButton.type = "button";

                    callButton.className =
                        "member-call-button";

                    callButton.title =
                        "Call " + name;

                    callButton.textContent =
                        "☎";


                    callButton.addEventListener(
                        "click",
                        function (event) {

                            event.stopPropagation();

                            callUser(
                                userId
                            );
                        }
                    );


                    actions.appendChild(
                        callButton
                    );
                }


                row.appendChild(
                    avatarBox
                );

                row.appendChild(
                    info
                );

                row.appendChild(
                    actions
                );


                group.appendChild(
                    row
                );
            }
        );


        container.appendChild(
            group
        );
    }


    /* ==========================================================
       PRESENCE
       ========================================================== */

    async function updatePresence() {

        if (!state.user) {
            return;
        }

        try {

            await state.db
                .from("chat_presence")
                .upsert(
                    {
                        user_id:
                            state.user.id,

                        status:
                            "online",

                        last_seen:
                            new Date().toISOString()
                    },
                    {
                        onConflict:
                            "user_id"
                    }
                );

        } catch (error) {

            console.warn(
                "Presence update failed:",
                error
            );
        }
    }


    async function loadPresence() {

        try {

            const {
                data,
                error
            } =
                await state.db
                    .from("chat_presence")
                    .select("*");

            if (error) {
                throw error;
            }


            state.onlineUsers.clear();


            const now =
                Date.now();


            (data || []).forEach(
                function (presence) {

                    const lastSeen =
                        presence.last_seen
                            ? new Date(
                                presence.last_seen
                            ).getTime()
                            : 0;

                    const online =
                        presence.status === "online" &&
                        now - lastSeen <
                            120000;


                    if (online) {

                        state.onlineUsers.set(
                            String(
                                presence.user_id
                            ),
                            presence
                        );
                    }
                }
            );

        } catch (error) {

            console.warn(
                "Presence loading failed:",
                error
            );
        }


        renderMembers();
    }


    function subscribeToPresence() {

        if (state.presenceSubscription) {

            try {
                state.db.removeChannel(
                    state.presenceSubscription
                );
            } catch (_) {}
        }


        state.presenceSubscription =
            state.db
                .channel(
                    "mwaniki-community-presence"
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_presence"
                    },
                    function () {

                        loadPresence();
                    }
                )
                .subscribe();
    }


    async function markOffline() {

        if (!state.user || !state.db) {
            return;
        }

        try {

            await state.db
                .from("chat_presence")
                .upsert(
                    {
                        user_id:
                            state.user.id,

                        status:
                            "offline",

                        last_seen:
                            new Date().toISOString()
                    },
                    {
                        onConflict:
                            "user_id"
                    }
                );

        } catch (_) {}
    }


    /* ==========================================================
       MESSAGES
       ========================================================== */

    async function loadMessages() {

        if (
            !state.currentChannel ||
            state.loadingMessages
        ) {
            return;
        }

        state.loadingMessages = true;


        try {

            const {
                data,
                error
            } =
                await state.db
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
                    )
                    .limit(
                        state.messageLimit
                    );

            if (error) {
                throw error;
            }


            state.messages =
                Array.isArray(data)
                    ? data
                    : [];


            state.messageMap.clear();


            state.messages.forEach(
                function (message) {

                    state.messageMap.set(
                        String(message.id),
                        message
                    );
                }
            );


            await enrichMessageProfiles();

            renderMessages();

        } catch (error) {

            console.error(
                "❌ Could not load messages:",
                error
            );

            renderMessageError(
                "Unable to load messages."
            );

        } finally {

            state.loadingMessages = false;
        }
    }


    async function enrichMessageProfiles() {

        const ids =
            [
                ...new Set(
                    state.messages
                        .map(function (message) {

                            return (
                                message.user_id ||
                                message.sender_id ||
                                message.created_by
                            );

                        })
                        .filter(Boolean)
                )
            ];


        if (!ids.length) {
            return;
        }


        try {

            const {
                data,
                error
            } =
                await state.db
                    .from("chat_public_profiles")
                    .select("*")
                    .in("id", ids);

            if (error) {
                return;
            }


            const profiles =
                new Map(
                    (data || []).map(
                        function (profile) {

                            return [
                                String(profile.id),
                                profile
                            ];
                        }
                    )
                );


            state.messages =
                state.messages.map(
                    function (message) {

                        const id =
                            String(
                                message.user_id ||
                                message.sender_id ||
                                message.created_by ||
                                ""
                            );

                        return {
                            ...message,
                            profile:
                                profiles.get(id) ||
                                message.profile ||
                                null
                        };
                    }
                );

        } catch (_) {}
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
                <div class="message-empty">
                    <div class="message-empty-icon">
                        #
                    </div>

                    <h3>
                        Welcome to the channel
                    </h3>

                    <p>
                        Start the academic discussion.
                    </p>
                </div>
            `;

            return;
        }


        state.messages.forEach(
            function (message) {

                list.appendChild(
                    createMessageElement(
                        message
                    )
                );
            }
        );


        scrollMessagesToBottom();
    }


    function createMessageElement(message) {

        const wrapper =
            document.createElement("article");

        wrapper.className =
            "chat-message";


        const senderId =
            String(
                message.user_id ||
                message.sender_id ||
                message.created_by ||
                ""
            );


        if (
            senderId ===
            String(state.user?.id)
        ) {
            wrapper.classList.add("own-message");
        }


        wrapper.dataset.messageId =
            message.id;


        const profile =
            message.profile || {};

        const name =
            getProfileName(profile);


        const avatar =
            getProfileAvatar(profile);


        const created =
            message.created_at
                ? new Date(
                    message.created_at
                )
                : new Date();


        const time =
            created.toLocaleTimeString(
                [],
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );


        const header =
            document.createElement("div");

        header.className =
            "message-header";


        const avatarBox =
            document.createElement("div");

        avatarBox.className =
            "message-avatar";

        avatarBox.innerHTML =
            avatarHTML(
                name,
                avatar,
                "message-photo"
            );


        const meta =
            document.createElement("div");

        meta.className =
            "message-meta";

        meta.innerHTML = `
            <span class="message-author">
                ${escapeHTML(name)}
            </span>

            <span class="message-time">
                ${escapeHTML(time)}
            </span>
        `;


        header.appendChild(
            avatarBox
        );

        header.appendChild(
            meta
        );


        const body =
            document.createElement("div");

        body.className =
            "message-body";


        if (message.reply_to) {

            const reply =
                document.createElement("div");

            reply.className =
                "message-reply";

            reply.textContent =
                "Reply";

            body.appendChild(
                reply
            );
        }


        const text =
            message.content ||
            message.message ||
            message.text ||
            "";


        if (text) {

            const textElement =
                document.createElement("div");

            textElement.className =
                "message-text";

            textElement.innerHTML =
                formatMessageText(text);

            body.appendChild(
                textElement
            );
        }


        appendMessageAttachment(
            body,
            message
        );


        const footer =
            document.createElement("div");

        footer.className =
            "message-actions";


        /*
         * Reaction
         */

        const reactButton =
            document.createElement("button");

        reactButton.type =
            "button";

        reactButton.className =
            "message-action";

        reactButton.title =
            "React";

        reactButton.textContent =
            "😊";

        reactButton.addEventListener(
            "click",
            function () {

                addReaction(
                    message.id,
                    "👍"
                );
            }
        );


        /*
         * Reply
         */

        const replyButton =
            document.createElement("button");

        replyButton.type =
            "button";

        replyButton.className =
            "message-action";

        replyButton.title =
            "Reply";

        replyButton.textContent =
            "↩";

        replyButton.addEventListener(
            "click",
            function () {

                beginReply(
                    message
                );
            }
        );


        footer.appendChild(
            reactButton
        );

        footer.appendChild(
            replyButton
        );


        /*
         * Delete own message.
         */

        if (
            senderId ===
            String(state.user?.id)
        ) {

            const deleteButton =
                document.createElement("button");

            deleteButton.type =
                "button";

            deleteButton.className =
                "message-action delete";

            deleteButton.title =
                "Delete message";

            deleteButton.textContent =
                "🗑";

            deleteButton.addEventListener(
                "click",
                function () {

                    deleteMessage(
                        message.id
                    );
                }
            );

            footer.appendChild(
                deleteButton
            );
        }


        body.appendChild(
            footer
        );


        wrapper.appendChild(
            header
        );

        wrapper.appendChild(
            body
        );


        return wrapper;
    }


    function formatMessageText(text) {

        let value =
            escapeHTML(text);


        /*
         * URLs
         */

        value =
            value.replace(
                /(https?:\/\/[^\s<]+)/gi,
                function (url) {

                    return `
                        <a
                            href="${url}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            ${url}
                        </a>
                    `;
                }
            );


        /*
         * New lines
         */

        value =
            value.replace(
                /\n/g,
                "<br>"
            );


        return value;
    }


    function appendMessageAttachment(
        container,
        message
    ) {

        const url =
            message.file_url ||
            message.attachment_url ||
            message.media_url ||
            message.url;


        if (!url) {
            return;
        }


        const fileName =
            message.file_name ||
            message.attachment_name ||
            "Attachment";


        const type =
            String(
                message.file_type ||
                message.attachment_type ||
                ""
            ).toLowerCase();


        if (
            type.startsWith("image/") ||
            /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(
                url
            )
        ) {

            const image =
                document.createElement("img");

            image.className =
                "message-image";

            image.src =
                url;

            image.alt =
                fileName;

            image.loading =
                "lazy";

            image.addEventListener(
                "click",
                function () {

                    window.open(
                        url,
                        "_blank",
                        "noopener"
                    );
                }
            );

            container.appendChild(
                image
            );

            return;
        }


        const file =
            document.createElement("a");

        file.className =
            "message-file";

        file.href =
            url;

        file.target =
            "_blank";

        file.rel =
            "noopener noreferrer";

        file.innerHTML = `
            <span class="file-icon">
                📄
            </span>

            <span>
                ${escapeHTML(fileName)}
            </span>
        `;


        container.appendChild(
            file
        );
    }


    function renderMessageError(message) {

        const list =
            $("messageList");

        if (!list) {
            return;
        }

        list.innerHTML = `
            <div class="message-error">
                ${escapeHTML(message)}
            </div>
        `;
    }


    function scrollMessagesToBottom() {

        const list =
            $("messageList");

        if (!list) {
            return;
        }

        requestAnimationFrame(
            function () {

                list.scrollTop =
                    list.scrollHeight;
            }
        );
    }


    /* ==========================================================
       REALTIME MESSAGES
       ========================================================== */

    function subscribeToMessages() {

        if (!state.currentChannel) {
            return;
        }


        if (state.messageSubscription) {

            try {

                state.db.removeChannel(
                    state.messageSubscription
                );

            } catch (_) {}
        }


        const channelId =
            state.currentChannel.id;


        state.messageSubscription =
            state.db
                .channel(
                    `mwaniki-chat-${channelId}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "chat_messages",
                        filter:
                            `channel_id=eq.${channelId}`
                    },
                    async function (payload) {

                        await receiveMessage(
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
                    function (payload) {

                        updateMessage(
                            payload.new
                        );
                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "DELETE",
                        schema: "public",
                        table: "chat_messages",
                        filter:
                            `channel_id=eq.${channelId}`
                    },
                    function (payload) {

                        removeMessage(
                            payload.old
                        );
                    }
                )
                .subscribe(
                    function (status) {

                        console.log(
                            "Community realtime:",
                            status
                        );
                    }
                );
    }


    async function receiveMessage(message) {

        if (!message) {
            return;
        }


        const id =
            String(message.id);


        if (state.messageMap.has(id)) {
            return;
        }


        state.messageMap.set(
            id,
            message
        );


        state.messages.push(
            message
        );


        /*
         * Load sender profile.
         */

        try {

            const senderId =
                message.user_id ||
                message.sender_id ||
                message.created_by;


            if (senderId) {

                const {
                    data
                } =
                    await state.db
                        .from(
                            "chat_public_profiles"
                        )
                        .select("*")
                        .eq(
                            "id",
                            senderId
                        )
                        .maybeSingle();

                if (data) {
                    message.profile =
                        data;
                }
            }

        } catch (_) {}


        /*
         * Only append if current channel is still active.
         */

        if (
            state.currentChannel &&
            String(
                message.channel_id
            ) === String(
                state.currentChannel.id
            )
        ) {

            const list =
                $("messageList");

            if (list) {

                const empty =
                    qs(
                        ".message-empty",
                        list
                    );

                if (empty) {
                    list.innerHTML = "";
                }

                list.appendChild(
                    createMessageElement(
                        message
                    )
                );

                scrollMessagesToBottom();
            }

        } else {

            markChannelUnread(
                message.channel_id
            );
        }
    }


    function updateMessage(message) {

        const id =
            String(message.id);

        state.messageMap.set(
            id,
            message
        );


        const index =
            state.messages.findIndex(
                function (item) {

                    return String(item.id) === id;
                }
            );


        if (index !== -1) {
            state.messages[index] =
                message;
        }


        if (
            state.currentChannel &&
            String(
                message.channel_id
            ) === String(
                state.currentChannel.id
            )
        ) {
            renderMessages();
        }
    }


    function removeMessage(message) {

        if (!message) {
            return;
        }

        const id =
            String(message.id);


        state.messageMap.delete(
            id
        );


        state.messages =
            state.messages.filter(
                function (item) {

                    return String(item.id) !== id;
                }
            );


        const element =
            qs(
                `[data-message-id="${CSS.escape(id)}"]`
            );


        if (element) {
            element.remove();
        }
    }


    function markChannelUnread(channelId) {

        if (
            !channelId ||
            (
                state.currentChannel &&
                String(channelId) ===
                    String(state.currentChannel.id)
            )
        ) {
            return;
        }


        const key =
            String(channelId);

        state.unreadChannels.add(
            key
        );


        const item =
            qs(
                `[data-channel-id="${CSS.escape(key)}"]`
            );


        if (!item) {
            return;
        }


        const badge =
            qs(
                ".channel-unread",
                item
            );


        if (badge) {

            badge.hidden =
                false;

            badge.textContent =
                "•";
        }
    }


    /* ==========================================================
       SEND MESSAGE
       ========================================================== */

    async function sendMessage() {

        if (!state.db || !state.user) {

            toast(
                "Please sign in first.",
                "error"
            );

            return;
        }


        if (!state.currentChannel) {

            toast(
                "Select a channel first.",
                "error"
            );

            return;
        }


        const input =
            getMessageInput();


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
            getSendButton();


        if (button) {
            button.disabled = true;
        }


        try {

            let attachment =
                null;


            if (state.attachment) {

                attachment =
                    await uploadAttachment(
                        state.attachment
                    );
            }


            const payload = {

                channel_id:
                    state.currentChannel.id,

                user_id:
                    state.user.id,

                content:
                    content || null
            };


            if (attachment) {

                payload.file_url =
                    attachment.url;

                payload.file_name =
                    attachment.name;

                payload.file_type =
                    attachment.type;

                payload.file_size =
                    attachment.size;
            }


            /*
             * Optional reply.
             */

            if (state.replyingTo) {

                payload.reply_to =
                    state.replyingTo.id;
            }


            const {
                data,
                error
            } =
                await state.db
                    .from("chat_messages")
                    .insert(
                        payload
                    )
                    .select()
                    .single();


            if (error) {

                /*
                 * Some existing schemas may not contain
                 * reply_to or file metadata. Retry with
                 * the basic message if necessary.
                 */

                const basicPayload = {

                    channel_id:
                        state.currentChannel.id,

                    user_id:
                        state.user.id,

                    content:
                        content || null
                };


                const retry =
                    await state.db
                        .from("chat_messages")
                        .insert(
                            basicPayload
                        )
                        .select()
                        .single();


                if (retry.error) {
                    throw retry.error;
                }


                handleLocalMessage(
                    retry.data
                );

            } else {

                handleLocalMessage(
                    data
                );
            }


            input.value = "";

            clearAttachment();

            clearReply();


        } catch (error) {

            console.error(
                "❌ Send message failed:",
                error
            );

            toast(
                error.message ||
                "Message could not be sent.",
                "error"
            );

        } finally {

            if (button) {
                button.disabled = false;
            }

            input.focus();
        }
    }


    function handleLocalMessage(message) {

        if (!message) {
            return;
        }


        const id =
            String(message.id);


        /*
         * Realtime may also deliver this message.
         */

        if (
            state.messageMap.has(id)
        ) {
            return;
        }


        message.profile =
            state.profile;


        state.messageMap.set(
            id,
            message
        );

        state.messages.push(
            message
        );


        const list =
            $("messageList");

        if (list) {

            const empty =
                qs(
                    ".message-empty",
                    list
                );

            if (empty) {
                list.innerHTML = "";
            }

            list.appendChild(
                createMessageElement(
                    message
                )
            );

            scrollMessagesToBottom();
        }
    }


    function getMessageInput() {

        return (
            $("messageInput") ||
            $("chatMessageInput") ||
            qs(
                'textarea[name="message"]'
            ) ||
            qs(
                'input[name="message"]'
            )
        );
    }


    function getSendButton() {

        return (
            $("sendMessageButton") ||
            $("sendButton") ||
            qs(
                '[data-action="send-message"]'
            )
        );
    }


    /* ==========================================================
       ATTACHMENTS
       ========================================================== */

    async function uploadAttachment(file) {

        if (!file) {
            return null;
        }


        const safeName =
            file.name
                .replace(
                    /[^a-zA-Z0-9._-]/g,
                    "_"
                );


        const path =
            `${state.user.id}/${Date.now()}_${safeName}`;


        /*
         * Try the common chat-attachments bucket.
         */

        let bucket =
            "chat-attachments";


        let result =
            await state.db.storage
                .from(bucket)
                .upload(
                    path,
                    file,
                    {
                        upsert: false,
                        contentType:
                            file.type ||
                            "application/octet-stream"
                    }
                );


        /*
         * Fallback to the existing profile bucket only
         * if your project has a different attachment bucket.
         */

        if (result.error) {

            console.error(
                "Attachment upload failed:",
                result.error
            );

            throw result.error;
        }


        const publicURL =
            state.db.storage
                .from(bucket)
                .getPublicUrl(path);


        return {

            url:
                publicURL.data.publicUrl,

            name:
                file.name,

            type:
                file.type,

            size:
                file.size
        };
    }


    function setupAttachmentInput() {

        const input =
            $("attachmentInput") ||
            $("fileInput") ||
            qs(
                'input[type="file"][data-chat-attachment]'
            );


        if (!input) {
            return;
        }


        input.addEventListener(
            "change",
            function () {

                const file =
                    input.files &&
                    input.files[0];


                if (!file) {
                    return;
                }


                if (
                    file.size >
                    25 * 1024 * 1024
                ) {

                    toast(
                        "File is larger than 25 MB.",
                        "error"
                    );

                    input.value = "";

                    return;
                }


                state.attachment =
                    file;


                showAttachmentPreview(
                    file
                );
            }
        );
    }


    function showAttachmentPreview(file) {

        let preview =
            $("attachmentPreview");


        if (!preview) {
            return;
        }


        preview.hidden =
            false;


        preview.innerHTML = `
            <span>
                📎
                ${escapeHTML(file.name)}
            </span>

            <button
                type="button"
                id="removeAttachmentButton"
            >
                ×
            </button>
        `;


        const remove =
            $("removeAttachmentButton");


        if (remove) {

            remove.addEventListener(
                "click",
                clearAttachment
            );
        }
    }


    function clearAttachment() {

        state.attachment =
            null;


        const input =
            $("attachmentInput") ||
            $("fileInput");


        if (input) {
            input.value = "";
        }


        const preview =
            $("attachmentPreview");


        if (preview) {

            preview.hidden =
                true;

            preview.innerHTML = "";
        }
    }


    /* ==========================================================
       MESSAGE DELETE
       ========================================================== */

    async function deleteMessage(messageId) {

        if (!messageId || !state.user) {
            return;
        }


        const message =
            state.messageMap.get(
                String(messageId)
            );


        if (!message) {
            return;
        }


        const ownerId =
            String(
                message.user_id ||
                message.sender_id ||
                message.created_by ||
                ""
            );


        if (
            ownerId !==
            String(state.user.id)
        ) {

            toast(
                "You can only delete your own messages.",
                "error"
            );

            return;
        }


        if (
            !window.confirm(
                "Delete this message?"
            )
        ) {
            return;
        }


        try {

            const {
                error
            } =
                await state.db
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
                throw error;
            }


            removeMessage(
                message
            );


            toast(
                "Message deleted."
            );

        } catch (error) {

            console.error(
                "Delete message failed:",
                error
            );

            toast(
                "Unable to delete message.",
                "error"
            );
        }
    }


    /* ==========================================================
       REACTIONS
       ========================================================== */

    async function addReaction(
        messageId,
        emoji
    ) {

        if (
            !state.user ||
            !messageId
        ) {
            return;
        }


        try {

            const {
                error
            } =
                await state.db
                    .from(
                        "chat_message_reactions"
                    )
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
                throw error;
            }

        } catch (error) {

            console.warn(
                "Reaction failed:",
                error
            );
        }
    }


    /* ==========================================================
       REPLY
       ========================================================== */

    function beginReply(message) {

        state.replyingTo =
            message;


        const input =
            getMessageInput();


        const preview =
            $("replyPreview");


        if (preview) {

            preview.hidden =
                false;

            const profile =
                message.profile || {};

            preview.innerHTML = `
                <span>
                    Replying to
                    <strong>
                        ${escapeHTML(
                            getProfileName(profile)
                        )}
                    </strong>
                </span>

                <button
                    type="button"
                    id="cancelReplyButton"
                >
                    ×
                </button>
            `;


            const cancel =
                $("cancelReplyButton");


            if (cancel) {

                cancel.addEventListener(
                    "click",
                    clearReply
                );
            }
        }


        if (input) {
            input.focus();
        }
    }


    function clearReply() {

        state.replyingTo =
            null;


        const preview =
            $("replyPreview");


        if (preview) {

            preview.hidden =
                true;

            preview.innerHTML = "";
        }
    }


    /* ==========================================================
       EMOJI PICKER
       ========================================================== */

    const EMOJIS = [
        "😀",
        "😂",
        "😊",
        "😍",
        "😎",
        "🤔",
        "😅",
        "😭",
        "😮",
        "😡",
        "👍",
        "👎",
        "👏",
        "🙏",
        "❤️",
        "🔥",
        "🎉",
        "💯",
        "✅",
        "❌",
        "📚",
        "🧪",
        "🩺",
        "💊",
        "🧠",
        "🔬",
        "📖",
        "💡"
    ];


    function setupEmojiPicker() {

        const button =
            $("emojiButton") ||
            $("emojiPickerButton");


        if (!button) {
            return;
        }


        button.addEventListener(
            "click",
            function (event) {

                event.stopPropagation();

                toggleEmojiPicker(
                    button
                );
            }
        );
    }


    function toggleEmojiPicker(anchor) {

        let picker =
            $("communityEmojiPicker");


        if (!picker) {

            picker =
                document.createElement("div");

            picker.id =
                "communityEmojiPicker";

            picker.className =
                "community-emoji-picker";

            picker.innerHTML =
                EMOJIS.map(
                    function (emoji) {

                        return `
                            <button
                                type="button"
                                class="emoji-choice"
                                data-emoji="${emoji}"
                            >
                                ${emoji}
                            </button>
                        `;
                    }
                ).join("");

            document.body.appendChild(
                picker
            );


            qsa(
                ".emoji-choice",
                picker
            ).forEach(
                function (item) {

                    item.addEventListener(
                        "click",
                        function () {

                            insertEmoji(
                                item.dataset.emoji
                            );
                        }
                    );
                }
            );
        }


        const wasHidden =
            picker.hidden !== false;


        if (wasHidden) {

            const rect =
                anchor.getBoundingClientRect();


            picker.style.position =
                "fixed";

            picker.style.left =
                Math.max(
                    10,
                    Math.min(
                        rect.left,
                        window.innerWidth - 270
                    )
                ) + "px";

            picker.style.bottom =
                (
                    window.innerHeight -
                    rect.top +
                    8
                ) + "px";


            picker.hidden =
                false;

            state.emojiOpen =
                true;

        } else {

            closeEmojiPicker();
        }
    }


    function insertEmoji(emoji) {

        const input =
            getMessageInput();


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


        const position =
            start +
            emoji.length;


        try {

            input.setSelectionRange(
                position,
                position
            );

        } catch (_) {}
    }


    function closeEmojiPicker() {

        const picker =
            $("communityEmojiPicker");


        if (picker) {
            picker.hidden =
                true;
        }


        state.emojiOpen =
            false;
    }


    /* ==========================================================
       VOICE NOTES
       ========================================================== */

    function setupVoiceRecording() {

        const button =
            $("voiceNoteButton") ||
            $("recordVoiceButton");


        if (!button) {
            return;
        }


        button.addEventListener(
            "click",
            function () {

                if (state.recorder) {

                    stopVoiceRecording();

                } else {

                    startVoiceRecording();
                }
            }
        );
    }


    async function startVoiceRecording() {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            toast(
                "Voice recording is not supported here.",
                "error"
            );

            return;
        }


        try {

            state.recordingStream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: true
                    });


            state.recordingChunks =
                [];


            state.recorder =
                new MediaRecorder(
                    state.recordingStream
                );


            state.recordingStartedAt =
                Date.now();


            state.recorder.ondataavailable =
                function (event) {

                    if (
                        event.data &&
                        event.data.size
                    ) {

                        state.recordingChunks.push(
                            event.data
                        );
                    }
                };


            state.recorder.onstop =
                async function () {

                    const mime =
                        state.recorder?.mimeType ||
                        "audio/webm";


                    const blob =
                        new Blob(
                            state.recordingChunks,
                            {
                                type: mime
                            }
                        );


                    stopRecordingTracks();


                    state.recorder =
                        null;


                    await sendVoiceNote(
                        blob,
                        mime
                    );
                };


            state.recorder.start();

            updateRecordingUI(
                true
            );


            state.recordingTimer =
                setInterval(
                    updateRecordingDuration,
                    500
                );

        } catch (error) {

            console.error(
                "Voice recording failed:",
                error
            );

            toast(
                "Microphone permission was not granted.",
                "error"
            );

            stopRecordingTracks();
        }
    }


    function stopVoiceRecording() {

        if (!state.recorder) {
            return;
        }


        try {

            state.recorder.stop();

        } catch (_) {}


        updateRecordingUI(
            false
        );


        if (state.recordingTimer) {

            clearInterval(
                state.recordingTimer
            );

            state.recordingTimer =
                null;
        }
    }


    function stopRecordingTracks() {

        if (
            state.recordingStream
        ) {

            state.recordingStream
                .getTracks()
                .forEach(
                    function (track) {

                        track.stop();
                    }
                );

            state.recordingStream =
                null;
        }
    }


    function updateRecordingDuration() {

        const elapsed =
            Date.now() -
            state.recordingStartedAt;


        const seconds =
            Math.floor(
                elapsed / 1000
            );


        const display =
            $("voiceRecordingTimer");


        if (display) {

            const minutes =
                String(
                    Math.floor(
                        seconds / 60
                    )
                ).padStart(
                    2,
                    "0"
                );


            const secs =
                String(
                    seconds % 60
                ).padStart(
                    2,
                    "0"
                );


            display.textContent =
                `${minutes}:${secs}`;
        }
    }


    function updateRecordingUI(
        recording
    ) {

        const button =
            $("voiceNoteButton") ||
            $("recordVoiceButton");


        if (button) {

            button.classList.toggle(
                "recording",
                recording
            );

            button.textContent =
                recording
                    ? "⏹"
                    : "🎙";
        }
    }


    async function sendVoiceNote(
        blob,
        mime
    ) {

        if (!state.currentChannel) {
            return;
        }


        try {

            const extension =
                mime.includes("ogg")
                    ? "ogg"
                    : "webm";


            const file =
                new File(
                    [
                        blob
                    ],
                    `voice_${Date.now()}.${extension}`,
                    {
                        type: mime
                    }
                );


            const attachment =
                await uploadAttachment(
                    file
                );


            const {
                data,
                error
            } =
                await state.db
                    .from(
                        "chat_messages"
                    )
                    .insert(
                        {
                            channel_id:
                                state.currentChannel.id,

                            user_id:
                                state.user.id,

                            content:
                                "🎙 Voice note",

                            file_url:
                                attachment.url,

                            file_name:
                                attachment.name,

                            file_type:
                                attachment.type,

                            file_size:
                                attachment.size
                        }
                    )
                    .select()
                    .single();


            if (error) {
                throw error;
            }


            handleLocalMessage(
                data
            );

        } catch (error) {

            console.error(
                "Voice note send failed:",
                error
            );

            toast(
                "Voice note could not be sent.",
                "error"
            );
        }
    }


    /* ==========================================================
       CALLING
       ========================================================== */

    function getCallEngine() {

        if (
            window.MwanikiCalls
        ) {
            return window.MwanikiCalls;
        }

        return null;
    }


    async function callUser(
        userId
    ) {

        const calls =
            getCallEngine();


        if (
            !calls ||
            typeof calls.callUser !==
                "function"
        ) {

            toast(
                "Calling engine is not ready.",
                "error"
            );

            return;
        }


        try {

            await calls.callUser(
                userId,
                state.currentCommunity?.id ||
                null
            );

        } catch (error) {

            console.error(
                "Direct call failed:",
                error
            );

            toast(
                error.message ||
                "Unable to start call.",
                "error"
            );
        }
    }


    async function callCommunity() {

        const calls =
            getCallEngine();


        if (
            !calls ||
            typeof calls.callCommunity !==
                "function"
        ) {

            toast(
                "Calling engine is not ready.",
                "error"
            );

            return;
        }


        if (!state.currentCommunity) {

            toast(
                "Select a community first.",
                "error"
            );

            return;
        }


        try {

            await calls.callCommunity(
                state.currentCommunity.id
            );

        } catch (error) {

            console.error(
                "Community call failed:",
                error
            );

            toast(
                error.message ||
                "Unable to start community call.",
                "error"
            );
        }
    }


    async function openGeneralCall() {

        const calls =
            getCallEngine();


        if (
            !calls ||
            typeof calls.openPicker !==
                "function"
        ) {

            toast(
                "Calling engine is not ready.",
                "error"
            );

            return;
        }


        try {

            await calls.openPicker(
                null
            );

        } catch (error) {

            console.error(
                "General call failed:",
                error
            );
        }
    }


    function setupCallButtons() {

        const general =
            $("generalCallButton");


        if (general) {

            general.addEventListener(
                "click",
                function () {

                    openGeneralCall();
                }
            );
        }


        const community =
            $("communityCallButton");


        if (community) {

            community.addEventListener(
                "click",
                function () {

                    callCommunity();
                }
            );
        }


        /*
         * Alternative button IDs used by some
         * versions of the HTML.
         */

        qsa(
            "[data-call-community]"
        ).forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    callCommunity
                );
            }
        );


        qsa(
            "[data-general-call]"
        ).forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    openGeneralCall
                );
            }
        );


        qsa(
            "[data-call-user]"
        ).forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        const userId =
                            button.dataset.callUser;

                        if (userId) {

                            callUser(
                                userId
                            );
                        }
                    }
                );
            }
        );
    }


    /* ==========================================================
       SEARCH
       ========================================================== */

    function setupSearch() {

        const input =
            $("messageSearchInput") ||
            $("communitySearchInput");


        if (!input) {
            return;
        }


        input.addEventListener(
            "input",
            function () {

                state.currentSearch =
                    input.value.trim()
                        .toLowerCase();

                filterVisibleMessages();
            }
        );
    }


    function filterVisibleMessages() {

        const messages =
            qsa(
                ".chat-message"
            );


        messages.forEach(
            function (element) {

                if (!state.currentSearch) {

                    element.hidden =
                        false;

                    return;
                }


                const text =
                    element.textContent
                        .toLowerCase();


                element.hidden =
                    !text.includes(
                        state.currentSearch
                    );
            }
        );
    }


    /* ==========================================================
       COMPOSER
       ========================================================== */

    function setupComposer() {

        const input =
            getMessageInput();


        if (input) {

            input.addEventListener(
                "keydown",
                function (event) {

                    /*
                     * Enter sends.
                     * Shift + Enter creates a newline.
                     */

                    if (
                        event.key === "Enter" &&
                        !event.shiftKey
                    ) {

                        event.preventDefault();

                        sendMessage();
                    }
                }
            );
        }


        const send =
            getSendButton();


        if (send) {

            send.addEventListener(
                "click",
                sendMessage
            );
        }
    }


    /* ==========================================================
       NOTIFICATION PANEL
       ========================================================== */

    function setupNotifications() {

        const button =
            $("notificationButton");


        const panel =
            $("notificationPanel");


        if (!button || !panel) {
            return;
        }


        button.addEventListener(
            "click",
            function (event) {

                event.stopPropagation();

                panel.classList.toggle(
                    "open"
                );
            }
        );
    }


    /* ==========================================================
       MODALS
       ========================================================== */

    function setupModalClose() {

        document.addEventListener(
            "click",
            function (event) {

                const closeButton =
                    event.target.closest(
                        "[data-close-modal]"
                    );


                if (closeButton) {

                    const modal =
                        closeButton.closest(
                            ".modal"
                        );

                    if (modal) {
                        modal.classList.remove(
                            "open"
                        );
                    }
                }
            }
        );
    }


    /* ==========================================================
       KEYBOARD / GLOBAL EVENTS
       ========================================================== */

    function setupGlobalEvents() {

        document.addEventListener(
            "click",
            function (event) {

                /*
                 * Close emoji picker when clicking
                 * elsewhere.
                 */

                const picker =
                    $("communityEmojiPicker");


                if (
                    state.emojiOpen &&
                    picker &&
                    !picker.contains(
                        event.target
                    ) &&
                    !event.target.closest(
                        "#emojiButton"
                    ) &&
                    !event.target.closest(
                        "#emojiPickerButton"
                    )
                ) {

                    closeEmojiPicker();
                }
            }
        );


        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Escape"
                ) {

                    closeEmojiPicker();

                    clearReply();
                }
            }
        );


        window.addEventListener(
            "beforeunload",
            function () {

                markOffline();
            }
        );


        document.addEventListener(
            "visibilitychange",
            function () {

                if (
                    document.visibilityState ===
                    "visible"
                ) {

                    updatePresence();
                }
            }
        );
    }


    /* ==========================================================
       HEADER / PROFILE
       ========================================================== */

    function renderCurrentUser() {

        const name =
            getProfileName(
                state.profile
            );


        const avatar =
            getProfileAvatar(
                state.profile
            );


        const nameElements =
            qsa(
                "[data-current-user-name]"
            );


        nameElements.forEach(
            function (element) {

                element.textContent =
                    name;
            }
        );


        const avatarElements =
            qsa(
                "[data-current-user-avatar]"
            );


        avatarElements.forEach(
            function (element) {

                if (
                    element.tagName ===
                    "IMG"
                ) {

                    if (avatar) {
                        element.src =
                            avatar;
                    }

                    element.alt =
                        name;

                } else {

                    element.innerHTML =
                        avatarHTML(
                            name,
                            avatar
                        );
                }
            }
        );
    }


    /* ==========================================================
       STARTUP
       ========================================================== */

    async function initializeCommunity() {

        try {

            await loadCurrentUser();


            if (!state.user) {

                console.warn(
                    "⚠️ No authenticated user."
                );

                toast(
                    "Please sign in to use the community.",
                    "error"
                );

                state.initializing =
                    false;

                return;
            }


            console.log(
                "✅ Community authenticated user:",
                state.user.id
            );


            await loadProfile();

            renderCurrentUser();


            await loadCommunities();


            await loadPresence();


            updatePresence();


            subscribeToPresence();


            setupComposer();

            setupAttachmentInput();

            setupEmojiPicker();

            setupVoiceRecording();

            setupCallButtons();

            setupNotifications();

            setupModalClose();

            setupGlobalEvents();

            setupSearch();


            state.initialized =
                true;

            state.initializing =
                false;


            console.log(
                "✅ Mwaniki Scholars Community loaded"
            );


        } catch (error) {

            state.initializing =
                false;

            console.error(
                "❌ Community initialization failed:",
                error
            );

            toast(
                "Community could not be loaded.",
                "error"
            );
        }
    }


    /* ==========================================================
       SUPABASE READY EVENT
       ========================================================== */

    if (
        window.mwanikiSupabaseReady === true
    ) {

        startAfterSupabase();

    } else {

        window.addEventListener(
            "mwaniki-supabase-ready",
            function () {

                startAfterSupabase();
            },
            {
                once: true
            }
        );
    }


    /* ==========================================================
       PUBLIC API
       ========================================================== */

    window.MwanikiCommunity = {

        refresh: async function () {

            if (!state.db) {
                return;
            }

            await loadCommunities();

            await loadPresence();
        },

        selectCommunity:
            selectCommunity,

        selectChannel:
            selectChannel,

        sendMessage:
            sendMessage,

        deleteMessage:
            deleteMessage,

        callUser:
            callUser,

        callCommunity:
            callCommunity,

        generalCall:
            openGeneralCall,

        getState:
            function () {
                return state;
            }
    };


})();
