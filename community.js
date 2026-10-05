/* =========================================================
   MWANIKI SCHOLARS COMMUNITY
   Clean Community Controller
   ========================================================= */

(function () {
    "use strict";

    /* =========================================================
       STATE
       ========================================================= */

    const state = {
        db: null,
        user: null,
        profile: null,

        communities: [],
        channels: [],
        members: [],
        messages: [],

        currentCommunity: null,
        currentChannel: null,

        messageSubscription: null,
        communitySubscription: null,
        presenceSubscription: null,

        presenceTimer: null,
        heartbeatTimer: null,

        mediaRecorder: null,
        recordingChunks: [],
        recordingStream: null,

        initialized: false,
        loadingMessages: false,
        sendingMessage: false
    };

    /* =========================================================
       DOM HELPERS
       ========================================================= */

    const $ = (id) => document.getElementById(id);

    function firstExisting(...ids) {
        for (const id of ids) {
            const element = $(id);
            if (element) return element;
        }

        return null;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
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

    function formatDateTime(dateValue) {
        if (!dateValue) return "";

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short"
        });
    }

    function slugify(value) {
        return String(value || "")
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function getSenderId(message) {
        return (
            message?.user_id ??
            message?.sender_id ??
            message?.author_id ??
            message?.created_by ??
            null
        );
    }

    function getMessageText(message) {
        return (
            message?.content ??
            message?.message ??
            message?.text ??
            ""
        );
    }

    function getMessageType(message) {
        return (
            message?.message_type ??
            message?.type ??
            "text"
        );
    }

    function getProfileId(profile) {
        return (
            profile?.user_id ??
            profile?.id ??
            null
        );
    }

    function getMemberUserId(member) {
        return (
            member?.user_id ??
            member?.student_id ??
            member?.profile_id ??
            member?.id ??
            null
        );
    }

    function notify(message, type = "info") {
        console.log(`[Community ${type}]`, message);

        const existing =
            document.querySelector(".community-toast") ||
            document.querySelector(".toast");

        if (existing) {
            existing.textContent = message;
            existing.className =
                `community-toast community-toast-${type}`;
            return;
        }

        const toast = document.createElement("div");

        toast.className =
            `community-toast community-toast-${type}`;

        toast.textContent = message;

        Object.assign(toast.style, {
            position: "fixed",
            right: "20px",
            bottom: "20px",
            zIndex: "99999",
            padding: "12px 16px",
            borderRadius: "10px",
            background: "#087f73",
            color: "#fff",
            fontSize: "14px",
            boxShadow: "0 8px 25px rgba(0,0,0,.18)"
        });

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    /* =========================================================
       SUPABASE
       ========================================================= */

    async function waitForSupabase(timeout = 15000) {
        const started = Date.now();

        while (Date.now() - started < timeout) {
            const possibleClients = [
                window.supabaseClient,
                window.mwanikiSupabase,
                window.sb,
                window.supabase
            ];

            for (const client of possibleClients) {
                if (
                    client &&
                    typeof client.from === "function" &&
                    client.auth
                ) {
                    return client;
                }
            }

            await sleep(100);
        }

        throw new Error(
            "Supabase client was not available."
        );
    }

    /* =========================================================
       AUTH
       ========================================================= */

    async function loadCurrentUser() {
        const result = await state.db.auth.getUser();

        if (result.error) {
            throw result.error;
        }

        state.user = result.data?.user || null;

        if (!state.user) {
            throw new Error("No authenticated user.");
        }

        console.log(
            "✅ Community authenticated user:",
            state.user.id
        );
    }

    /* =========================================================
       PROFILE
       ========================================================= */

    async function loadProfile() {
        state.profile = null;

        /*
         * First try chat_public_profiles.
         */

        try {
            const result = await state.db
                .from("chat_public_profiles")
                .select("*")
                .eq("user_id", state.user.id)
                .maybeSingle();

            if (!result.error && result.data) {
                state.profile = result.data;
            }
        } catch (error) {
            console.warn(
                "chat_public_profiles lookup failed:",
                error
            );
        }

        /*
         * Try id if user_id did not work.
         */

        if (!state.profile) {
            try {
                const result = await state.db
                    .from("chat_public_profiles")
                    .select("*")
                    .eq("id", state.user.id)
                    .maybeSingle();

                if (!result.error && result.data) {
                    state.profile = result.data;
                }
            } catch (error) {
                console.warn(
                    "Profile id lookup failed:",
                    error
                );
            }
        }

        /*
         * Fallback to students.
         */

        if (!state.profile) {
            try {
                const result = await state.db
                    .from("students")
                    .select("*")
                    .eq("user_id", state.user.id)
                    .maybeSingle();

                if (!result.error && result.data) {
                    state.profile = result.data;
                }
            } catch (error) {
                console.warn(
                    "students profile lookup failed:",
                    error
                );
            }
        }

        if (!state.profile) {
            state.profile = {
                user_id: state.user.id,
                full_name:
                    state.user.user_metadata?.full_name ||
                    state.user.user_metadata?.name ||
                    state.user.email?.split("@")[0] ||
                    "Student",
                avatar_url:
                    state.user.user_metadata?.avatar_url ||
                    state.user.user_metadata?.picture ||
                    ""
            };
        }

        updateCurrentUserUI();
    }

    function getProfileName(profile) {
        return (
            profile?.full_name ||
            profile?.name ||
            profile?.display_name ||
            profile?.username ||
            profile?.email ||
            "Student"
        );
    }

    function getProfileAvatar(profile) {
        return (
            profile?.avatar_url ||
            profile?.avatar ||
            profile?.photo_url ||
            profile?.profile_photo ||
            profile?.image_url ||
            ""
        );
    }

    function updateCurrentUserUI() {
        const name = getProfileName(state.profile);
        const avatar = getProfileAvatar(state.profile);

        const nameElements = document.querySelectorAll(
            "[data-current-user-name]"
        );

        nameElements.forEach(element => {
            element.textContent = name;
        });

        const avatarElements = document.querySelectorAll(
            "[data-current-user-avatar]"
        );

        avatarElements.forEach(element => {
            if (avatar) {
                element.src = avatar;
            }
        });
    }

    /* =========================================================
       COMMUNITY ICONS
       ========================================================= */

    function getCommunityIcon(community) {
        const slug =
            slugify(
                community?.slug ||
                community?.name
            );

        if (
            slug.includes("gaming") ||
            slug.includes("game")
        ) {
            return "🎮";
        }

        if (
            slug.includes("meme")
        ) {
            return "😂";
        }

        if (
            slug.includes("mwaniki") ||
            slug.includes("scholar")
        ) {
            return "🎓";
        }

        return "💬";
    }

    function createCommunityIcon(community) {
        const wrapper = document.createElement("div");

        wrapper.className = "community-icon";

        const image =
            community?.icon_url ||
            community?.image_url ||
            community?.avatar_url ||
            "";

        if (image) {
            const img = document.createElement("img");

            img.src = image;
            img.alt = community?.name || "Community";

            img.onerror = function () {
                this.remove();
                wrapper.textContent =
                    getCommunityIcon(community);
            };

            wrapper.appendChild(img);
        } else {
            /*
             * IMPORTANT:
             * Emoji is text, NOT an image URL.
             */
            wrapper.textContent =
                getCommunityIcon(community);
        }

        return wrapper;
    }

    /* =========================================================
       COMMUNITIES
       ========================================================= */

    async function loadCommunities() {
        let result = await state.db
            .from("chat_communities")
            .select("*")
            .eq("is_active", true)
            .order("name", {
                ascending: true
            });

        if (result.error) {
            console.error(
                "Community loading failed:",
                result.error
            );

            throw result.error;
        }

        state.communities = result.data || [];

        /*
         * Mwaniki Scholars must always be preferred.
         */

        state.communities.sort((a, b) => {
            const aMain =
                slugify(a.name) === "mwaniki-scholars" ||
                slugify(a.slug) === "mwaniki-scholars";

            const bMain =
                slugify(b.name) === "mwaniki-scholars" ||
                slugify(b.slug) === "mwaniki-scholars";

            if (aMain && !bMain) return -1;
            if (!aMain && bMain) return 1;

            return String(a.name || "")
                .localeCompare(
                    String(b.name || "")
                );
        });

        renderCommunityRail();
    }

    function renderCommunityRail() {
        const rail = $("communityRail");

        if (!rail) {
            console.warn(
                "communityRail element not found."
            );
            return;
        }

        rail.innerHTML = "";

        state.communities.forEach(community => {
            const button =
                document.createElement("button");

            button.type = "button";
            button.className =
                "community-rail-item";

            if (
                state.currentCommunity &&
                String(state.currentCommunity.id) ===
                String(community.id)
            ) {
                button.classList.add("active");
            }

            button.title =
                community.name || "Community";

            button.dataset.communityId =
                community.id;

            const icon =
                createCommunityIcon(community);

            button.appendChild(icon);

            button.addEventListener(
                "click",
                () => {
                    selectCommunity(community.id);
                }
            );

            rail.appendChild(button);
        });
    }

    /* =========================================================
       SELECT COMMUNITY
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

        state.currentCommunity = community;

        renderCommunityRail();
        updateCommunityHeader();

        await loadChannels(
            community.id
        );

        await loadMembers(
            community.id
        );

        subscribeToCommunityChanges(
            community.id
        );

        const defaultChannel =
            chooseDefaultChannel(
                state.channels
            );

        if (defaultChannel) {
            await selectChannel(
                defaultChannel.id
            );
        } else {
            clearMessages();
        }
    }

    function chooseDefaultChannel(channels) {
        if (!channels.length) {
            return null;
        }

        const preferredWords = [
            "general",
            "discussion",
            "main",
            "lobby",
            "chat",
            "medical"
        ];

        for (const word of preferredWords) {
            const found = channels.find(channel => {
                const name =
                    String(channel.name || "")
                        .toLowerCase();

                return name.includes(word);
            });

            if (found) {
                return found;
            }
        }

        return channels[0];
    }

    function updateCommunityHeader() {
        const community =
            state.currentCommunity;

        if (!community) return;

        const title =
            firstExisting(
                "communityTitle",
                "currentCommunityName"
            );

        if (title) {
            title.textContent =
                community.name || "Community";
        }

        const description =
            firstExisting(
                "communityDescription",
                "currentCommunityDescription"
            );

        if (description) {
            description.textContent =
                community.description || "";
        }
    }

    /* =========================================================
       CHANNELS
       ========================================================= */

    async function loadChannels(communityId) {
        const result = await state.db
            .from("chat_channels")
            .select("*")
            .eq("community_id", communityId)
            .eq("is_active", true)
            .order("name", {
                ascending: true
            });

        if (result.error) {
            console.error(
                "Channel loading failed:",
                result.error
            );

            state.channels = [];
            renderChannelList();

            return;
        }

        state.channels = result.data || [];

        state.channels.sort((a, b) => {
            const aName =
                String(a.name || "")
                    .toLowerCase();

            const bName =
                String(b.name || "")
                    .toLowerCase();

            const preferred = [
                "general",
                "discussion",
                "main"
            ];

            const aIndex =
                preferred.findIndex(word =>
                    aName.includes(word)
                );

            const bIndex =
                preferred.findIndex(word =>
                    bName.includes(word)
                );

            if (aIndex !== -1 && bIndex === -1) {
                return -1;
            }

            if (aIndex === -1 && bIndex !== -1) {
                return 1;
            }

            if (
                aIndex !== -1 &&
                bIndex !== -1 &&
                aIndex !== bIndex
            ) {
                return aIndex - bIndex;
            }

            return aName.localeCompare(bName);
        });

        renderChannelList();
    }

    function renderChannelList() {
        const container =
            $("channelList");

        if (!container) return;

        container.innerHTML = "";

        if (!state.channels.length) {
            const empty =
                document.createElement("div");

            empty.className =
                "community-empty-channels";

            empty.textContent =
                "No channels available.";

            container.appendChild(empty);

            return;
        }

        const groups = {};

        state.channels.forEach(channel => {
            const category =
                channel.category ||
                channel.channel_category ||
                "Discussion";

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
                    "channel-category-title";

                heading.textContent =
                    category;

                container.appendChild(
                    heading
                );

                channels.forEach(channel => {
                    const button =
                        document.createElement("button");

                    button.type = "button";

                    button.className =
                        "channel-item";

                    if (
                        state.currentChannel &&
                        String(
                            state.currentChannel.id
                        ) ===
                        String(channel.id)
                    ) {
                        button.classList.add(
                            "active"
                        );
                    }

                    button.dataset.channelId =
                        channel.id;

                    button.innerHTML = `
                        <span class="channel-hash">#</span>
                        <span class="channel-name">
                            ${escapeHTML(
                                channel.name ||
                                "channel"
                            )}
                        </span>
                    `;

                    button.addEventListener(
                        "click",
                        () => {
                            selectChannel(
                                channel.id
                            );
                        }
                    );

                    container.appendChild(
                        button
                    );
                });
            });
    }

    /* =========================================================
       SELECT CHANNEL
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

        renderChannelList();

        updateChannelHeader();

        unsubscribeMessages();

        await loadMessages(
            channel.id
        );

        subscribeToMessages(
            channel.id
        );

        markChannelRead(
            channel.id
        );
    }

    function updateChannelHeader() {
        const channel =
            state.currentChannel;

        if (!channel) return;

        const name =
            firstExisting(
                "currentChannelName",
                "channelTitle"
            );

        if (name) {
            name.textContent =
                `# ${channel.name || "channel"}`;
        }

        const topic =
            firstExisting(
                "currentChannelTopic",
                "channelTopic"
            );

        if (topic) {
            topic.textContent =
                channel.description ||
                channel.topic ||
                "";
        }
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
            const result = await state.db
                .from("chat_messages")
                .select("*")
                .eq("channel_id", channelId)
                .order("created_at", {
                    ascending: true
                })
                .limit(150);

            if (result.error) {
                console.error(
                    "Message loading failed:",
                    result.error
                );

                state.messages = [];

                renderMessages();

                return;
            }

            state.messages =
                result.data || [];

            await enrichMessages();

            renderMessages();

        } finally {
            state.loadingMessages = false;
        }
    }

    async function enrichMessages() {
        const ids = [
            ...new Set(
                state.messages
                    .map(getSenderId)
                    .filter(Boolean)
            )
        ];

        if (!ids.length) {
            return;
        }

        const profiles = {};

        try {
            const result = await state.db
                .from("chat_public_profiles")
                .select("*")
                .in("user_id", ids);

            if (!result.error) {
                (result.data || [])
                    .forEach(profile => {
                        profiles[
                            getProfileId(profile)
                        ] = profile;
                    });
            }
        } catch (error) {
            console.warn(
                "Could not load message profiles:",
                error
            );
        }

        /*
         * Attach profile information locally.
         */

        state.messages =
            state.messages.map(message => {
                const senderId =
                    getSenderId(message);

                return {
                    ...message,
                    _profile:
                        profiles[senderId] ||
                        null
                };
            });
    }

    function renderMessages() {
        const container =
            $("messageList");

        if (!container) {
            return;
        }

        container.innerHTML = "";

        if (!state.messages.length) {
            const empty =
                document.createElement("div");

            empty.className =
                "community-message-empty";

            empty.innerHTML = `
                <div class="empty-icon">💬</div>
                <h3>Welcome to the channel</h3>
                <p>
                    Start the discussion by sending
                    the first message.
                </p>
            `;

            container.appendChild(empty);

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

        requestAnimationFrame(() => {
            container.scrollTop =
                container.scrollHeight;
        });
    }

    function createMessageElement(message) {
        const wrapper =
            document.createElement("article");

        wrapper.className =
            "community-message";

        const senderId =
            getSenderId(message);

        if (
            String(senderId) ===
            String(state.user?.id)
        ) {
            wrapper.classList.add(
                "own-message"
            );
        }

        if (
            message.deleted_at ||
            message.is_deleted
        ) {
            wrapper.classList.add(
                "deleted-message"
            );
        }

        const profile =
            message._profile || {};

        const name =
            getProfileName(profile) ||
            (
                String(senderId) ===
                String(state.user?.id)
                    ? getProfileName(
                        state.profile
                    )
                    : "Student"
            );

        const avatar =
            getProfileAvatar(profile);

        const text =
            getMessageText(message);

        const type =
            getMessageType(message);

        const header =
            document.createElement("div");

        header.className =
            "message-header";

        const avatarElement =
            document.createElement("div");

        avatarElement.className =
            "message-avatar";

        if (avatar) {
            const image =
                document.createElement("img");

            image.src = avatar;
            image.alt = name;

            image.onerror = function () {
                this.remove();

                avatarElement.textContent =
                    name.charAt(0)
                        .toUpperCase();
            };

            avatarElement.appendChild(
                image
            );
        } else {
            avatarElement.textContent =
                name.charAt(0)
                    .toUpperCase();
        }

        const sender =
            document.createElement("div");

        sender.className =
            "message-sender";

        sender.textContent = name;

        const time =
            document.createElement("time");

        time.className =
            "message-time";

        time.textContent =
            formatTime(
                message.created_at
            );

        header.appendChild(
            avatarElement
        );

        header.appendChild(
            sender
        );

        header.appendChild(
            time
        );

        wrapper.appendChild(
            header
        );

        const body =
            document.createElement("div");

        body.className =
            "message-body";

        if (
            message.deleted_at ||
            message.is_deleted
        ) {
            body.innerHTML =
                "<em>This message was deleted.</em>";
        } else {
            if (text) {
                const textElement =
                    document.createElement("div");

                textElement.className =
                    "message-text";

                textElement.textContent =
                    text;

                body.appendChild(
                    textElement
                );
            }

            renderMessageAttachment(
                message,
                body,
                type
            );
        }

        wrapper.appendChild(
            body
        );

        const actions =
            createMessageActions(
                message
            );

        if (actions) {
            wrapper.appendChild(
                actions
            );
        }

        return wrapper;
    }

    /* =========================================================
       ATTACHMENTS
       ========================================================= */

    function renderMessageAttachment(
        message,
        container,
        type
    ) {
        const url =
            message.attachment_url ||
            message.file_url ||
            message.url ||
            null;

        const name =
            message.attachment_name ||
            message.file_name ||
            "Attachment";

        if (!url) {
            return;
        }

        if (
            type === "image" ||
            /\.(jpg|jpeg|png|gif|webp)$/i
                .test(url)
        ) {
            const image =
                document.createElement("img");

            image.className =
                "message-image";

            image.src = url;
            image.alt = name;

            container.appendChild(
                image
            );

            return;
        }

        if (
            type === "voice" ||
            type === "audio" ||
            /\.(mp3|wav|ogg|webm|m4a)$/i
                .test(url)
        ) {
            const audio =
                document.createElement("audio");

            audio.controls = true;
            audio.src = url;
            audio.className =
                "message-audio";

            container.appendChild(
                audio
            );

            return;
        }

        const link =
            document.createElement("a");

        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        link.className =
            "message-file";

        link.textContent =
            `📎 ${name}`;

        container.appendChild(
            link
        );
    }

    /* =========================================================
       MESSAGE ACTIONS
       ========================================================= */

    function createMessageActions(message) {
        const senderId =
            getSenderId(message);

        const actions =
            document.createElement("div");

        actions.className =
            "message-actions";

        const react =
            document.createElement("button");

        react.type = "button";
        react.title = "React";
        react.textContent = "😊";

        react.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                openReactionPicker(
                    message.id,
                    react
                );
            }
        );

        actions.appendChild(
            react
        );

        if (
            String(senderId) ===
            String(state.user?.id)
        ) {
            const deleteButton =
                document.createElement("button");

            deleteButton.type = "button";
            deleteButton.title =
                "Delete message";

            deleteButton.textContent =
                "🗑";

            deleteButton.addEventListener(
                "click",
                event => {
                    event.stopPropagation();

                    deleteMessage(
                        message
                    );
                }
            );

            actions.appendChild(
                deleteButton
            );
        }

        return actions;
    }

    /* =========================================================
       SEND MESSAGE
       ========================================================= */

    async function sendMessage() {
        if (
            state.sendingMessage ||
            !state.currentChannel ||
            !state.user
        ) {
            return;
        }

        const input =
            $("messageInput");

        if (!input) {
            return;
        }

        const text =
            input.value.trim();

        if (!text) {
            return;
        }

        state.sendingMessage = true;

        try {
            const payload = {
                channel_id:
                    state.currentChannel.id,

                user_id:
                    state.user.id,

                content:
                    text,

                message_type:
                    "text"
            };

            let result =
                await state.db
                    .from("chat_messages")
                    .insert(payload)
                    .select()
                    .single();

            /*
             * Fallback for schemas using sender_id.
             */

            if (
                result.error &&
                /user_id|column/i.test(
                    result.error.message || ""
                )
            ) {
                const fallback = {
                    channel_id:
                        state.currentChannel.id,

                    sender_id:
                        state.user.id,

                    content:
                        text,

                    message_type:
                        "text"
                };

                result =
                    await state.db
                        .from("chat_messages")
                        .insert(fallback)
                        .select()
                        .single();
            }

            if (result.error) {
                throw result.error;
            }

            input.value = "";

            input.dispatchEvent(
                new Event("input")
            );

        } catch (error) {
            console.error(
                "Message send failed:",
                error
            );

            notify(
                "Unable to send message.",
                "error"
            );

        } finally {
            state.sendingMessage = false;
        }
    }

    /* =========================================================
       DELETE MESSAGE
       ========================================================= */

    async function deleteMessage(message) {
        const senderId =
            getSenderId(message);

        if (
            String(senderId) !==
            String(state.user?.id)
        ) {
            return;
        }

        try {
            let result =
                await state.db
                    .from("chat_messages")
                    .delete()
                    .eq("id", message.id)
                    .eq(
                        "user_id",
                        state.user.id
                    );

            /*
             * Fallback for sender_id schemas.
             */

            if (result.error) {
                result =
                    await state.db
                        .from("chat_messages")
                        .delete()
                        .eq("id", message.id)
                        .eq(
                            "sender_id",
                            state.user.id
                        );
            }

            if (result.error) {
                throw result.error;
            }

            state.messages =
                state.messages.filter(
                    item =>
                        String(item.id) !==
                        String(message.id)
                );

            renderMessages();

        } catch (error) {
            console.error(
                "Delete failed:",
                error
            );

            notify(
                "Unable to delete this message.",
                "error"
            );
        }
    }

    /* =========================================================
       MESSAGE REALTIME
       ========================================================= */

    function unsubscribeMessages() {
        if (
            state.messageSubscription
        ) {
            state.db.removeChannel(
                state.messageSubscription
            );

            state.messageSubscription =
                null;
        }
    }

    function subscribeToMessages(
        channelId
    ) {
        unsubscribeMessages();

        const channel =
            state.db.channel(
                `community-messages-${channelId}`
            );

        channel.on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "chat_messages",
                filter:
                    `channel_id=eq.${channelId}`
            },
            async payload => {
                if (
                    payload.eventType ===
                    "INSERT"
                ) {
                    const message =
                        payload.new;

                    if (
                        !state.messages.some(
                            item =>
                                String(
                                    item.id
                                ) ===
                                String(
                                    message.id
                                )
                        )
                    ) {
                        state.messages.push(
                            message
                        );

                        await enrichMessages();

                        renderMessages();
                    }

                    return;
                }

                if (
                    payload.eventType ===
                    "UPDATE"
                ) {
                    const index =
                        state.messages.findIndex(
                            item =>
                                String(
                                    item.id
                                ) ===
                                String(
                                    payload.new.id
                                )
                        );

                    if (index !== -1) {
                        state.messages[index] =
                            payload.new;
                    }

                    await enrichMessages();

                    renderMessages();

                    return;
                }

                if (
                    payload.eventType ===
                    "DELETE"
                ) {
                    state.messages =
                        state.messages.filter(
                            item =>
                                String(
                                    item.id
                                ) !==
                                String(
                                    payload.old.id
                                )
                        );

                    renderMessages();
                }
            }
        );

        channel.subscribe(
            status => {
                console.log(
                    "Community realtime:",
                    status
                );
            }
        );

        state.messageSubscription =
            channel;
    }

    /* =========================================================
       COMMUNITY REALTIME
       ========================================================= */

    function subscribeToCommunityChanges(
        communityId
    ) {
        if (
            state.communitySubscription
        ) {
            state.db.removeChannel(
                state.communitySubscription
            );

            state.communitySubscription =
                null;
        }

        const channel =
            state.db.channel(
                `community-${communityId}`
            );

        channel.on(
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
        );

        channel.subscribe(
            status => {
                console.log(
                    "Community channel realtime:",
                    status
                );
            }
        );

        state.communitySubscription =
            channel;
    }

    /* =========================================================
       MEMBERS
       ========================================================= */

    async function loadMembers(communityId) {
        let members = [];

        try {
            const result =
                await state.db
                    .from(
                        "chat_community_members"
                    )
                    .select("*")
                    .eq(
                        "community_id",
                        communityId
                    );

            if (!result.error) {
                members =
                    result.data || [];
            }
        } catch (error) {
            console.warn(
                "Member query failed:",
                error
            );
        }

        const ids = [
            ...new Set(
                members
                    .map(
                        getMemberUserId
                    )
                    .filter(Boolean)
            )
        ];

        const profiles = {};

        if (ids.length) {
            try {
                const result =
                    await state.db
                        .from(
                            "chat_public_profiles"
                        )
                        .select("*")
                        .in(
                            "user_id",
                            ids
                        );

                if (!result.error) {
                    (result.data || [])
                        .forEach(profile => {
                            profiles[
                                getProfileId(
                                    profile
                                )
                            ] = profile;
                        });
                }
            } catch (error) {
                console.warn(
                    "Member profiles failed:",
                    error
                );
            }
        }

        state.members =
            members.map(member => {
                const userId =
                    getMemberUserId(
                        member
                    );

                return {
                    ...member,
                    user_id: userId,
                    profile:
                        profiles[userId] ||
                        null
                };
            });

        /*
         * If the current user isn't in the
         * membership result, include them.
         */

        if (
            state.user &&
            !state.members.some(
                member =>
                    String(
                        member.user_id
                    ) ===
                    String(
                        state.user.id
                    )
            )
        ) {
            state.members.unshift({
                user_id:
                    state.user.id,
                role: "Student",
                profile:
                    state.profile
            });
        }

        renderMembers();
    }

    function renderMembers() {
        const container =
            $("memberSidebar");

        if (!container) return;

        const searchInput =
            firstExisting(
                "memberSearch",
                "membersSearch"
            );

        const search =
            String(
                searchInput?.value || ""
            )
                .toLowerCase()
                .trim();

        container.innerHTML = "";

        const filtered =
            state.members.filter(
                member => {
                    if (!search) {
                        return true;
                    }

                    const profile =
                        member.profile ||
                        {};

                    const name =
                        getProfileName(
                            profile
                        )
                            .toLowerCase();

                    return name.includes(
                        search
                    );
                }
            );

        const online = [];
        const offline = [];

        filtered.forEach(member => {
            const status =
                member.status ||
                member.presence_status ||
                "offline";

            if (
                status === "online" ||
                status === "active"
            ) {
                online.push(member);
            } else {
                offline.push(member);
            }
        });

        appendMemberGroup(
            container,
            "ONLINE",
            online
        );

        appendMemberGroup(
            container,
            "OFFLINE",
            offline
        );

        updateOnlineCount(
            online.length
        );
    }

    function appendMemberGroup(
        container,
        title,
        members
    ) {
        if (!members.length) {
            return;
        }

        const heading =
            document.createElement("div");

        heading.className =
            "member-group-title";

        heading.textContent =
            `${title} — ${members.length}`;

        container.appendChild(
            heading
        );

        members.forEach(member => {
            container.appendChild(
                createMemberElement(
                    member
                )
            );
        });
    }

    function createMemberElement(
        member
    ) {
        const profile =
            member.profile || {};

        const name =
            getProfileName(
                profile
            );

        const avatar =
            getProfileAvatar(
                profile
            );

        const userId =
            member.user_id;

        const row =
            document.createElement("div");

        row.className =
            "community-member";

        row.dataset.userId =
            userId;

        const avatarWrapper =
            document.createElement("div");

        avatarWrapper.className =
            "member-avatar";

        if (avatar) {
            const image =
                document.createElement("img");

            image.src = avatar;
            image.alt = name;

            image.onerror =
                function () {
                    this.remove();

                    avatarWrapper.textContent =
                        name
                            .charAt(0)
                            .toUpperCase();
                };

            avatarWrapper.appendChild(
                image
            );
        } else {
            avatarWrapper.textContent =
                name
                    .charAt(0)
                    .toUpperCase();
        }

        const presenceDot =
            document.createElement("span");

        presenceDot.className =
            "member-presence-dot";

        avatarWrapper.appendChild(
            presenceDot
        );

        const info =
            document.createElement("div");

        info.className =
            "member-info";

        const nameElement =
            document.createElement("div");

        nameElement.className =
            "member-name";

        nameElement.textContent =
            name;

        const activity =
            document.createElement("div");

        activity.className =
            "member-activity";

        activity.textContent =
            member.activity ||
            member.presence_activity ||
            (
                String(userId) ===
                String(state.user?.id)
                    ? "You"
                    : "Offline"
            );

        info.appendChild(
            nameElement
        );

        info.appendChild(
            activity
        );

        const buttons =
            document.createElement("div");

        buttons.className =
            "member-actions";

        /*
         * Personal message button.
         */

        const messageButton =
            document.createElement("button");

        messageButton.type = "button";
        messageButton.className =
            "member-message-button";

        messageButton.title =
            "Message";

        messageButton.textContent =
            "💬";

        messageButton.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                openDirectMessage(
                    userId
                );
            }
        );

        buttons.appendChild(
            messageButton
        );

        /*
         * Personal call button.
         */

        if (
            String(userId) !==
            String(state.user?.id)
        ) {
            const callButton =
                document.createElement("button");

            callButton.type = "button";
            callButton.className =
                "member-call-button";

            callButton.title =
                "Call";

            callButton.textContent =
                "📞";

            callButton.addEventListener(
                "click",
                event => {
                    event.stopPropagation();

                    callUser(
                        userId
                    );
                }
            );

            buttons.appendChild(
                callButton
            );
        }

        row.appendChild(
            avatarWrapper
        );

        row.appendChild(
            info
        );

        row.appendChild(
            buttons
        );

        return row;
    }

    function updateOnlineCount(count) {
        const elements =
            document.querySelectorAll(
                "[data-online-count]"
            );

        elements.forEach(element => {
            element.textContent =
                count;
        });

        const element =
            firstExisting(
                "onlineCount"
            );

        if (element) {
            element.textContent =
                count;
        }
    }

    /* =========================================================
       PRESENCE
       ========================================================= */

    /*
     * IMPORTANT:
     *
     * We DO NOT use upsert(on_conflict:user_id).
     *
     * The 400 error you were getting means the current
     * chat_presence schema does not match that assumption.
     */

    async function updatePresence(
        status = "online"
    ) {
        if (!state.user) {
            return;
        }

        const now =
            new Date().toISOString();

        /*
         * First try to update an existing row.
         */

        try {
            const updateResult =
                await state.db
                    .from("chat_presence")
                    .update({
                        status:
                            status,

                        last_seen:
                            now,

                        activity:
                            "Community"
                    })
                    .eq(
                        "user_id",
                        state.user.id
                    );

            if (
                !updateResult.error
            ) {
                return;
            }

            /*
             * If update did not work, try a minimal
             * insert without on_conflict.
             */

            const insertResult =
                await state.db
                    .from("chat_presence")
                    .insert({
                        user_id:
                            state.user.id,

                        status:
                            status,

                        last_seen:
                            now,

                        activity:
                            "Community"
                    });

            if (
                insertResult.error
            ) {
                /*
                 * Some schemas only have user_id,
                 * status and last_seen.
                 */

                const minimal =
                    await state.db
                        .from(
                            "chat_presence"
                        )
                        .insert({
                            user_id:
                                state.user.id,

                            status:
                                status,

                            last_seen:
                                now
                        });

                if (
                    minimal.error
                ) {
                    console.warn(
                        "Presence could not be updated:",
                        minimal.error.message
                    );
                }
            }

        } catch (error) {
            /*
             * Presence must NEVER break the
             * rest of the community.
             */
            console.warn(
                "Presence update skipped:",
                error
            );
        }
    }

    function startPresence() {
        updatePresence(
            "online"
        );

        if (
            state.heartbeatTimer
        ) {
            clearInterval(
                state.heartbeatTimer
            );
        }

        state.heartbeatTimer =
            setInterval(
                () => {
                    updatePresence(
                        "online"
                    );
                },
                30000
            );

        window.addEventListener(
            "beforeunload",
            () => {
                /*
                 * Best effort only.
                 */
                updatePresence(
                    "offline"
                );
            }
        );
    }

    /* =========================================================
       READ STATUS
       ========================================================= */

    async function markChannelRead(
        channelId
    ) {
        if (!state.user) {
            return;
        }

        try {
            const payload = {
                channel_id:
                    channelId,

                user_id:
                    state.user.id,

                last_read_at:
                    new Date().toISOString()
            };

            const result =
                await state.db
                    .from(
                        "chat_read_status"
                    )
                    .upsert(
                        payload,
                        {
                            onConflict:
                                "channel_id,user_id"
                        }
                    );

            if (result.error) {
                console.debug(
                    "Read status not available:",
                    result.error.message
                );
            }
        } catch (error) {
            console.debug(
                "Read status skipped:",
                error
            );
        }
    }

    /* =========================================================
       EMOJI PICKER
       ========================================================= */

    function setupEmojiPicker() {
        const button =
            $("emojiButton");

        const picker =
            $("emojiPicker");

        if (!button || !picker) {
            return;
        }

        button.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                picker.classList.toggle(
                    "open"
                );

                picker.hidden =
                    !picker.classList.contains(
                        "open"
                    );
            }
        );

        picker.addEventListener(
            "click",
            event => {
                const target =
                    event.target.closest(
                        "[data-emoji]"
                    );

                if (!target) {
                    return;
                }

                const emoji =
                    target.dataset.emoji;

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
                    input.value.slice(
                        0,
                        start
                    ) +
                    emoji +
                    input.value.slice(
                        end
                    );

                input.focus();

                input.selectionStart =
                    input.selectionEnd =
                    start +
                    emoji.length;
            }
        );

        document.addEventListener(
            "click",
            event => {
                if (
                    !picker.contains(
                        event.target
                    ) &&
                    event.target !== button
                ) {
                    picker.classList.remove(
                        "open"
                    );

                    picker.hidden = true;
                }
            }
        );

        document.addEventListener(
            "keydown",
            event => {
                if (
                    event.key ===
                    "Escape"
                ) {
                    picker.classList.remove(
                        "open"
                    );

                    picker.hidden = true;
                }
            }
        );
    }

    /* =========================================================
       REACTIONS
       ========================================================= */

    function openReactionPicker(
        messageId,
        button
    ) {
        const old =
            document.querySelector(
                ".message-reaction-popup"
            );

        if (old) {
            old.remove();
        }

        const popup =
            document.createElement("div");

        popup.className =
            "message-reaction-popup";

        [
            "👍",
            "❤️",
            "😂",
            "😮",
            "😢",
            "👏",
            "🔥"
        ].forEach(emoji => {
            const option =
                document.createElement(
                    "button"
                );

            option.type = "button";

            option.textContent =
                emoji;

            option.addEventListener(
                "click",
                () => {
                    addReaction(
                        messageId,
                        emoji
                    );

                    popup.remove();
                }
            );

            popup.appendChild(
                option
            );
        });

        button.parentElement.appendChild(
            popup
        );
    }

    async function addReaction(
        messageId,
        emoji
    ) {
        if (!state.user) {
            return;
        }

        try {
            const existing =
                await state.db
                    .from(
                        "chat_message_reactions"
                    )
                    .select("*")
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

            if (
                !existing.error &&
                existing.data
            ) {
                await state.db
                    .from(
                        "chat_message_reactions"
                    )
                    .delete()
                    .eq(
                        "id",
                        existing.data.id
                    );

                return;
            }

            await state.db
                .from(
                    "chat_message_reactions"
                )
                .insert({
                    message_id:
                        messageId,

                    user_id:
                        state.user.id,

                    reaction:
                        emoji
                });

        } catch (error) {
            console.warn(
                "Reaction failed:",
                error
            );
        }
    }

    /* =========================================================
       FILE UPLOAD
       ========================================================= */

    async function uploadFile(file) {
        if (!file) {
            return null;
        }

        const buckets = [
            "chat-attachments",
            "attachments"
        ];

        const safeName =
            file.name
                .replace(
                    /[^a-zA-Z0-9._-]/g,
                    "_"
                );

        const path =
            `${state.user.id}/${Date.now()}-${safeName}`;

        for (const bucket of buckets) {
            try {
                const result =
                    await state.db
                        .storage
                        .from(bucket)
                        .upload(
                            path,
                            file,
                            {
                                upsert: false
                            }
                        );

                if (!result.error) {
                    const publicResult =
                        state.db
                            .storage
                            .from(bucket)
                            .getPublicUrl(
                                path
                            );

                    return {
                        url:
                            publicResult
                                .data
                                ?.publicUrl,

                        name:
                            file.name,

                        type:
                            file.type,

                        bucket
                    };
                }
            } catch (error) {
                console.warn(
                    `Bucket ${bucket} failed:`,
                    error
                );
            }
        }

        throw new Error(
            "No chat attachment storage bucket is available."
        );
    }

    async function sendAttachment(
        file
    ) {
        if (
            !file ||
            !state.currentChannel
        ) {
            return;
        }

        try {
            const uploaded =
                await uploadFile(
                    file
                );

            if (!uploaded?.url) {
                throw new Error(
                    "Upload URL missing."
                );
            }

            let type = "file";

            if (
                file.type.startsWith(
                    "image/"
                )
            ) {
                type = "image";
            }

            if (
                file.type.startsWith(
                    "audio/"
                )
            ) {
                type = "audio";
            }

            const payload = {
                channel_id:
                    state.currentChannel.id,

                user_id:
                    state.user.id,

                content:
                    "",

                message_type:
                    type,

                attachment_url:
                    uploaded.url,

                attachment_name:
                    uploaded.name
            };

            let result =
                await state.db
                    .from(
                        "chat_messages"
                    )
                    .insert(payload);

            if (
                result.error &&
                /user_id|column/i.test(
                    result.error.message || ""
                )
            ) {
                result =
                    await state.db
                        .from(
                            "chat_messages"
                        )
                        .insert({
                            channel_id:
                                state.currentChannel.id,

                            sender_id:
                                state.user.id,

                            content:
                                "",

                            message_type:
                                type,

                            attachment_url:
                                uploaded.url,

                            attachment_name:
                                uploaded.name
                        });
            }

            if (result.error) {
                throw result.error;
            }

        } catch (error) {
            console.error(
                "Attachment failed:",
                error
            );

            notify(
                "Unable to upload attachment.",
                "error"
            );
        }
    }

    /* =========================================================
       VOICE NOTES
       ========================================================= */

    async function startVoiceRecording() {
        if (
            state.mediaRecorder
        ) {
            return;
        }

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices
                .getUserMedia
        ) {
            notify(
                "Voice recording is not supported by this browser.",
                "error"
            );

            return;
        }

        try {
            const stream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: true
                    });

            state.recordingStream =
                stream;

            state.recordingChunks =
                [];

            const recorder =
                new MediaRecorder(
                    stream
                );

            state.mediaRecorder =
                recorder;

            recorder.ondataavailable =
                event => {
                    if (
                        event.data &&
                        event.data.size
                    ) {
                        state.recordingChunks
                            .push(
                                event.data
                            );
                    }
                };

            recorder.onstop =
                async () => {
                    const blob =
                        new Blob(
                            state.recordingChunks,
                            {
                                type:
                                    recorder
                                        .mimeType ||
                                    "audio/webm"
                            }
                        );

                    state.recordingChunks =
                        [];

                    stream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );

                    state.recordingStream =
                        null;

                    state.mediaRecorder =
                        null;

                    await sendVoiceNote(
                        blob
                    );
                };

            recorder.start();

            updateRecordingUI(
                true
            );

        } catch (error) {
            console.error(
                "Voice recording failed:",
                error
            );

            notify(
                "Microphone access was not available.",
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

        updateRecordingUI(
            false
        );
    }

    async function sendVoiceNote(
        blob
    ) {
        try {
            const file =
                new File(
                    [
                        blob
                    ],
                    `voice-${Date.now()}.webm`,
                    {
                        type:
                            blob.type ||
                            "audio/webm"
                    }
                );

            const uploaded =
                await uploadFile(
                    file
                );

            if (!uploaded?.url) {
                throw new Error(
                    "Voice upload failed."
                );
            }

            const payload = {
                channel_id:
                    state.currentChannel.id,

                user_id:
                    state.user.id,

                content:
                    "",

                message_type:
                    "voice",

                attachment_url:
                    uploaded.url,

                attachment_name:
                    uploaded.name
            };

            let result =
                await state.db
                    .from(
                        "chat_messages"
                    )
                    .insert(payload);

            if (
                result.error
            ) {
                result =
                    await state.db
                        .from(
                            "chat_messages"
                        )
                        .insert({
                            channel_id:
                                state.currentChannel.id,

                            sender_id:
                                state.user.id,

                            content:
                                "",

                            message_type:
                                "voice",

                            attachment_url:
                                uploaded.url,

                            attachment_name:
                                uploaded.name
                        });
            }

            if (result.error) {
                throw result.error;
            }

        } catch (error) {
            console.error(
                "Voice note failed:",
                error
            );

            notify(
                "Unable to send voice note.",
                "error"
            );
        }
    }

    function updateRecordingUI(
        recording
    ) {
        document.body.classList.toggle(
            "recording-voice",
            recording
        );

        const start =
            firstExisting(
                "startVoiceNoteButton",
                "voiceRecordButton"
            );

        const stop =
            firstExisting(
                "stopVoiceNoteButton",
                "voiceStopButton"
            );

        if (start) {
            start.hidden =
                recording;
        }

        if (stop) {
            stop.hidden =
                !recording;
        }
    }

    /* =========================================================
       DIRECT MESSAGES
       ========================================================= */

    async function openDirectMessage(
        targetUserId
    ) {
        if (
            !targetUserId ||
            String(targetUserId) ===
            String(state.user?.id)
        ) {
            return;
        }

        /*
         * Look for an existing private/direct
         * channel containing the current user.
         */

        try {
            const result =
                await state.db
                    .from(
                        "chat_channels"
                    )
                    .select("*")
                    .eq(
                        "is_private",
                        true
                    )
                    .eq(
                        "channel_type",
                        "dm"
                    );

            if (
                !result.error
            ) {
                const channels =
                    result.data || [];

                for (
                    const channel of channels
                ) {
                    const members =
                        await state.db
                            .from(
                                "chat_channel_members"
                            )
                            .select(
                                "user_id"
                            )
                            .eq(
                                "channel_id",
                                channel.id
                            );

                    if (
                        members.error
                    ) {
                        continue;
                    }

                    const ids =
                        (
                            members.data ||
                            []
                        ).map(
                            member =>
                                String(
                                    member.user_id
                                )
                        );

                    if (
                        ids.includes(
                            String(
                                state.user.id
                            )
                        ) &&
                        ids.includes(
                            String(
                                targetUserId
                            )
                        )
                    ) {
                        await openDirectChannel(
                            channel
                        );

                        return;
                    }
                }
            }
        } catch (error) {
            console.warn(
                "Direct channel lookup failed:",
                error
            );
        }

        /*
         * Try creating a direct channel.
         */

        try {
            const target =
                state.members.find(
                    member =>
                        String(
                            member.user_id
                        ) ===
                        String(
                            targetUserId
                        )
                );

            const targetName =
                getProfileName(
                    target?.profile
                );

            const currentName =
                getProfileName(
                    state.profile
                );

            const channelPayload = {
                name:
                    `${currentName} & ${targetName}`,

                slug:
                    `dm-${state.user.id}-${targetUserId}`,

                description:
                    "Direct conversation",

                is_public:
                    false,

                is_private:
                    true,

                channel_type:
                    "dm"
            };

            const created =
                await state.db
                    .from(
                        "chat_channels"
                    )
                    .insert(
                        channelPayload
                    )
                    .select()
                    .single();

            if (
                created.error
            ) {
                throw created.error;
            }

            const channel =
                created.data;

            await state.db
                .from(
                    "chat_channel_members"
                )
                .insert([
                    {
                        channel_id:
                            channel.id,

                        user_id:
                            state.user.id
                    },
                    {
                        channel_id:
                            channel.id,

                        user_id:
                            targetUserId
                    }
                ]);

            await openDirectChannel(
                channel
            );

        } catch (error) {
            console.error(
                "Direct message creation failed:",
                error
            );

            notify(
                "Direct messaging is not available with the current channel schema.",
                "error"
            );
        }
    }

    async function openDirectChannel(
        channel
    ) {
        state.currentChannel =
            channel;

        updateChannelHeader();

        unsubscribeMessages();

        await loadMessages(
            channel.id
        );

        subscribeToMessages(
            channel.id
        );
    }

    /* =========================================================
       CALLS
       ========================================================= */

    function callUser(userId) {
        if (
            !window.MwanikiCalls
        ) {
            notify(
                "Calling system is still loading.",
                "error"
            );

            return;
        }

        if (
            typeof window.MwanikiCalls
                .callUser !==
            "function"
        ) {
            notify(
                "Personal calling is unavailable.",
                "error"
            );

            return;
        }

        window.MwanikiCalls.callUser(
            userId,
            state.currentCommunity?.id ||
            null
        );
    }

    function openCallPicker() {
        if (
            !window.MwanikiCalls
        ) {
            notify(
                "Calling system is still loading.",
                "error"
            );

            return;
        }

        if (
            typeof window.MwanikiCalls
                .openPicker !==
            "function"
        ) {
            notify(
                "Call picker is unavailable.",
                "error"
            );

            return;
        }

        window.MwanikiCalls.openPicker(
            state.currentCommunity?.id ||
            null
        );
    }

    function startCommunityCall() {
        if (
            !window.MwanikiCalls
        ) {
            notify(
                "Calling system is still loading.",
                "error"
            );

            return;
        }

        if (
            typeof window.MwanikiCalls
                .callCommunity !==
            "function"
        ) {
            openCallPicker();
            return;
        }

        window.MwanikiCalls.callCommunity(
            state.currentCommunity?.id
        );
    }

    function startGeneralCall() {
        if (
            !window.MwanikiCalls
        ) {
            notify(
                "Calling system is still loading.",
                "error"
            );

            return;
        }

        if (
            typeof window.MwanikiCalls
                .openPicker ===
            "function"
        ) {
            window.MwanikiCalls.openPicker(
                null
            );
        }
    }

    /* =========================================================
       SEARCH
       ========================================================= */

    function setupSearch() {
        const channelSearch =
            firstExisting(
                "channelSearch",
                "searchChannelInput"
            );

        if (channelSearch) {
            channelSearch.addEventListener(
                "input",
                () => {
                    filterChannels(
                        channelSearch.value
                    );
                }
            );
        }

        const memberSearch =
            firstExisting(
                "memberSearch",
                "membersSearch"
            );

        if (memberSearch) {
            memberSearch.addEventListener(
                "input",
                () => {
                    renderMembers();
                }
            );
        }
    }

    function filterChannels(value) {
        const query =
            String(value || "")
                .toLowerCase()
                .trim();

        document
            .querySelectorAll(
                ".channel-item"
            )
            .forEach(button => {
                const text =
                    button.textContent
                        .toLowerCase();

                button.style.display =
                    !query ||
                    text.includes(query)
                        ? ""
                        : "none";
            });
    }

    /* =========================================================
       BUTTON BINDINGS
       ========================================================= */

    function setupButtons() {
        const sendButton =
            firstExisting(
                "sendMessageButton",
                "sendButton"
            );

        if (sendButton) {
            sendButton.addEventListener(
                "click",
                sendMessage
            );
        }

        const input =
            $("messageInput");

        if (input) {
            input.addEventListener(
                "keydown",
                event => {
                    if (
                        event.key ===
                        "Enter" &&
                        !event.shiftKey
                    ) {
                        event.preventDefault();

                        sendMessage();
                    }
                }
            );
        }

        const attachmentButton =
            firstExisting(
                "attachmentButton",
                "attachButton"
            );

        const attachmentInput =
            firstExisting(
                "attachmentInput",
                "messageFileInput"
            );

        if (
            attachmentButton &&
            attachmentInput
        ) {
            attachmentButton.addEventListener(
                "click",
                () => {
                    attachmentInput.click();
                }
            );

            attachmentInput.addEventListener(
                "change",
                async () => {
                    const file =
                        attachmentInput.files?.[0];

                    if (file) {
                        await sendAttachment(
                            file
                        );
                    }

                    attachmentInput.value =
                        "";
                }
            );
        }

        const voiceStart =
            firstExisting(
                "voiceRecordButton",
                "startVoiceNoteButton"
            );

        if (voiceStart) {
            voiceStart.addEventListener(
                "click",
                startVoiceRecording
            );
        }

        const voiceStop =
            firstExisting(
                "stopVoiceNoteButton",
                "voiceStopButton"
            );

        if (voiceStop) {
            voiceStop.addEventListener(
                "click",
                stopVoiceRecording
            );
        }

        const callButton =
            firstExisting(
                "callButton",
                "communityCallButton"
            );

        if (callButton) {
            callButton.addEventListener(
                "click",
                startCommunityCall
            );
        }

        const generalCall =
            $("generalCallButton");

        if (generalCall) {
            generalCall.addEventListener(
                "click",
                startGeneralCall
            );
        }

        const refresh =
            firstExisting(
                "refreshCommunityButton",
                "refreshButton"
            );

        if (refresh) {
            refresh.addEventListener(
                "click",
                refreshCommunity
            );
        }
    }

    /* =========================================================
       REFRESH
       ========================================================= */

    async function refreshCommunity() {
        try {
            await loadCommunities();

            if (
                state.currentCommunity
            ) {
                const stillExists =
                    state.communities.find(
                        community =>
                            String(
                                community.id
                            ) ===
                            String(
                                state.currentCommunity.id
                            )
                    );

                if (stillExists) {
                    await selectCommunity(
                        stillExists.id
                    );

                    return;
                }
            }

            const defaultCommunity =
                chooseDefaultCommunity();

            if (defaultCommunity) {
                await selectCommunity(
                    defaultCommunity.id
                );
            }

        } catch (error) {
            console.error(
                "Community refresh failed:",
                error
            );
        }
    }

    function chooseDefaultCommunity() {
        const main =
            state.communities.find(
                community => {
                    const slug =
                        slugify(
                            community.slug ||
                            community.name
                        );

                    return (
                        slug ===
                            "mwaniki-scholars" ||
                        slug.includes(
                            "mwaniki-scholars"
                        ) ||
                        String(
                            community.name
                        )
                            .toLowerCase()
                            .includes(
                                "mwaniki scholars"
                            )
                    );
                }
            );

        return (
            main ||
            state.communities[0] ||
            null
        );
    }

    /* =========================================================
       AUTH LISTENER
       ========================================================= */

    function setupAuthListener() {
        state.db.auth.onAuthStateChange(
            async (event, session) => {
                if (
                    event ===
                    "SIGNED_OUT"
                ) {
                    state.user = null;

                    return;
                }

                if (
                    event ===
                    "SIGNED_IN" &&
                    session?.user
                ) {
                    state.user =
                        session.user;

                    await loadProfile();
                }
            }
        );
    }

    /* =========================================================
       INITIALIZATION
       ========================================================= */

    async function initialize() {
        if (
            state.initialized
        ) {
            return;
        }

        state.initialized =
            true;

        try {
            state.db =
                await waitForSupabase();

            console.log(
                "✅ Community: Supabase client ready."
            );

            await loadCurrentUser();

            await loadProfile();

            setupButtons();
            setupEmojiPicker();
            setupSearch();
            setupAuthListener();

            startPresence();

            await loadCommunities();

            const defaultCommunity =
                chooseDefaultCommunity();

            if (
                defaultCommunity
            ) {
                await selectCommunity(
                    defaultCommunity.id
                );
            } else {
                console.warn(
                    "No communities found."
                );
            }

            console.log(
                "✅ Mwaniki Scholars Community loaded"
            );

        } catch (error) {
            console.error(
                "❌ Community initialization failed:",
                error
            );

            state.initialized =
                false;

            notify(
                "Community could not finish loading.",
                "error"
            );
        }
    }

    /* =========================================================
       PUBLIC API
       ========================================================= */

    window.MwanikiCommunity = {
        refresh:
            refreshCommunity,

        selectCommunity:
            selectCommunity,

        selectChannel:
            selectChannel,

        sendMessage:
            sendMessage,

        openDirectMessage:
            openDirectMessage,

        callUser:
            callUser,

        openCallPicker:
            openCallPicker,

        startCommunityCall:
            startCommunityCall,

        startGeneralCall:
            startGeneralCall,

        getState:
            () => state
    };

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

})();
