/* =========================================================
   MWANIKI SCHOLARS COMMUNITY
   COMPLETE COMMUNITY CONTROLLER
   Matched to community.html
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

        presences: {},

        currentCommunity: null,
        currentChannel: null,

        messageSubscription: null,
        communitySubscription: null,
        presenceSubscription: null,

        heartbeatTimer: null,
        idleTimer: null,

        mediaRecorder: null,
        recordingChunks: [],
        recordingStream: null,

        initialized: false,
        loadingMessages: false,
        sendingMessage: false,

        lastActivity: Date.now()
    };


    /* =========================================================
       DOM HELPERS
       ========================================================= */

    const $ = id => document.getElementById(id);

    function firstExisting(...ids) {
        for (const id of ids) {
            const element = $(id);

            if (element) {
                return element;
            }
        }

        return null;
    }

    function sleep(ms) {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function slugify(value) {
        return String(value || "")
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function formatTime(value) {
        if (!value) {
            return "";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
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
            member?.member_id ??
            member?.id ??
            null
        );
    }

    function getProfileName(profile) {
        return (
            profile?.full_name ||
            profile?.display_name ||
            profile?.name ||
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
            profile?.profile_image ||
            profile?.image_url ||
            profile?.photo ||
            ""
        );
    }

    function notify(message, type = "info") {
        console.log(
            `[Community ${type}]`,
            message
        );

        let toast = $("toast");

        if (!toast) {
            toast =
                document.querySelector(".toast");
        }

        if (!toast) {
            toast =
                document.createElement("div");

            toast.id = "communityDynamicToast";

            document.body.appendChild(toast);
        }

        toast.className =
            `toast community-toast community-toast-${type}`;

        toast.textContent = message;

        toast.hidden = false;

        clearTimeout(
            toast._communityTimer
        );

        toast._communityTimer =
            setTimeout(() => {
                toast.hidden = true;
                toast.classList.add("hidden");
            }, 3500);
    }


    /* =========================================================
       SUPABASE
       ========================================================= */

    async function waitForSupabase(
        timeout = 15000
    ) {
        const started = Date.now();

        while (
            Date.now() - started <
            timeout
        ) {
            const clients = [
                window.supabaseClient,
                window.mwanikiSupabase,
                window.sb,
                window.supabase
            ];

            for (const client of clients) {
                if (
                    client &&
                    typeof client.from ===
                        "function" &&
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
        const result =
            await state.db.auth.getUser();

        if (result.error) {
            throw result.error;
        }

        state.user =
            result.data?.user || null;

        if (!state.user) {
            throw new Error(
                "No authenticated user."
            );
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

        try {
            const result =
                await state.db
                    .from(
                        "chat_public_profiles"
                    )
                    .select("*")
                    .eq(
                        "user_id",
                        state.user.id
                    )
                    .maybeSingle();

            if (
                !result.error &&
                result.data
            ) {
                state.profile =
                    result.data;
            }
        } catch (error) {
            console.warn(
                "Public profile lookup failed:",
                error
            );
        }

        if (!state.profile) {
            try {
                const result =
                    await state.db
                        .from(
                            "chat_public_profiles"
                        )
                        .select("*")
                        .eq(
                            "id",
                            state.user.id
                        )
                        .maybeSingle();

                if (
                    !result.error &&
                    result.data
                ) {
                    state.profile =
                        result.data;
                }
            } catch (error) {
                console.warn(
                    "Profile ID lookup failed:",
                    error
                );
            }
        }

        if (!state.profile) {
            try {
                const result =
                    await state.db
                        .from("students")
                        .select("*")
                        .eq(
                            "user_id",
                            state.user.id
                        )
                        .maybeSingle();

                if (
                    !result.error &&
                    result.data
                ) {
                    state.profile =
                        result.data;
                }
            } catch (error) {
                console.warn(
                    "Student profile lookup failed:",
                    error
                );
            }
        }

        if (!state.profile) {
            state.profile = {
                user_id:
                    state.user.id,

                full_name:
                    state.user
                        .user_metadata
                        ?.full_name ||
                    state.user
                        .user_metadata
                        ?.name ||
                    state.user.email
                        ?.split("@")[0] ||
                    "Student",

                avatar_url:
                    state.user
                        .user_metadata
                        ?.avatar_url ||
                    state.user
                        .user_metadata
                        ?.picture ||
                    ""
            };
        }

        updateCurrentUserUI();
    }

    function updateCurrentUserUI() {
        const name =
            getProfileName(
                state.profile
            );

        const avatar =
            getProfileAvatar(
                state.profile
            );

        document
            .querySelectorAll(
                "[data-current-user-name]"
            )
            .forEach(element => {
                element.textContent =
                    name;
            });

        document
            .querySelectorAll(
                "[data-current-user-avatar]"
            )
            .forEach(element => {
                if (avatar) {
                    element.src =
                        avatar;
                }
            });

        const headerName =
            $("headerProfileName");

        if (headerName) {
            headerName.textContent =
                name;
        }

        const headerAvatar =
            $("headerProfileAvatar");

        if (
            headerAvatar &&
            avatar
        ) {
            headerAvatar.src =
                avatar;

            headerAvatar.alt =
                name;
        }
    }


    /* =========================================================
       COMMUNITY ICONS
       ========================================================= */

    function getCommunityIcon(
        community
    ) {
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

    function createCommunityIcon(
        community
    ) {
        const wrapper =
            document.createElement("div");

        wrapper.className =
            "community-icon";

        const image =
            community?.icon_url ||
            community?.image_url ||
            community?.avatar_url ||
            "";

        if (image) {
            const img =
                document.createElement("img");

            img.src = image;

            img.alt =
                community?.name ||
                "Community";

            img.onerror = function () {
                this.remove();

                wrapper.textContent =
                    getCommunityIcon(
                        community
                    );
            };

            wrapper.appendChild(img);
        } else {
            wrapper.textContent =
                getCommunityIcon(
                    community
                );
        }

        return wrapper;
    }


    /* =========================================================
       COMMUNITIES
       ========================================================= */

    async function loadCommunities() {
        const result =
            await state.db
                .from("chat_communities")
                .select("*")
                .eq(
                    "is_active",
                    true
                )
                .order("name", {
                    ascending: true
                });

        if (result.error) {
            throw result.error;
        }

        state.communities =
            result.data || [];

        state.communities.sort(
            (a, b) => {
                const aMain =
                    slugify(
                        a.slug ||
                        a.name
                    ) ===
                    "mwaniki-scholars";

                const bMain =
                    slugify(
                        b.slug ||
                        b.name
                    ) ===
                    "mwaniki-scholars";

                if (
                    aMain &&
                    !bMain
                ) {
                    return -1;
                }

                if (
                    !aMain &&
                    bMain
                ) {
                    return 1;
                }

                return String(
                    a.name || ""
                ).localeCompare(
                    String(
                        b.name || ""
                    )
                );
            }
        );

        renderCommunityRail();
    }

    function renderCommunityRail() {
        const rail =
            $("communityRail");

        if (!rail) {
            return;
        }

        /*
         * Preserve the add button.
         */

        const addButton =
            $("addCommunityButton");

        rail.innerHTML = "";

        const list =
            document.createElement("div");

        list.id =
            "communityRailList";

        list.className =
            "community-rail-list";

        state.communities.forEach(
            community => {
                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "community-rail-item";

                if (
                    state.currentCommunity &&
                    String(
                        state.currentCommunity.id
                    ) ===
                    String(
                        community.id
                    )
                ) {
                    button.classList.add(
                        "active"
                    );
                }

                button.title =
                    community.name ||
                    "Community";

                button.dataset.communityId =
                    community.id;

                button.appendChild(
                    createCommunityIcon(
                        community
                    )
                );

                button.addEventListener(
                    "click",
                    () => {
                        selectCommunity(
                            community.id
                        );
                    }
                );

                list.appendChild(
                    button
                );
            }
        );

        rail.appendChild(list);

        const divider =
            document.createElement(
                "div"
            );

        divider.className =
            "community-rail-divider";

        rail.appendChild(
            divider
        );

        if (addButton) {
            rail.appendChild(
                addButton
            );
        } else {
            const add =
                document.createElement(
                    "button"
                );

            add.type =
                "button";

            add.id =
                "addCommunityButton";

            add.className =
                "rail-add-button";

            add.title =
                "Add community";

            add.textContent =
                "+";

            rail.appendChild(
                add
            );
        }
    }


    /* =========================================================
       COMMUNITY SELECTION
       ========================================================= */

    async function selectCommunity(
        communityId
    ) {
        const community =
            state.communities.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        communityId
                    )
            );

        if (!community) {
            return;
        }

        state.currentCommunity =
            community;

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

    function chooseDefaultChannel(
        channels
    ) {
        if (!channels.length) {
            return null;
        }

        const preferred = [
            "general",
            "discussion",
            "main",
            "lobby",
            "chat",
            "medical"
        ];

        for (
            const word of preferred
        ) {
            const match =
                channels.find(
                    channel =>
                        String(
                            channel.name ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                word
                            )
                );

            if (match) {
                return match;
            }
        }

        return channels[0];
    }

    function updateCommunityHeader() {
        const community =
            state.currentCommunity;

        if (!community) {
            return;
        }

        const title =
            firstExisting(
                "selectedCommunityName",
                "communityTitle",
                "currentCommunityName"
            );

        if (title) {
            title.textContent =
                community.name ||
                "Community";
        }

        const description =
            firstExisting(
                "selectedCommunityDescription",
                "communityDescription",
                "currentCommunityDescription"
            );

        if (description) {
            description.textContent =
                community.description ||
                "Community";
        }

        const icon =
            $("selectedCommunityIcon");

        if (icon) {
            icon.innerHTML = "";

            icon.appendChild(
                createCommunityIcon(
                    community
                )
            );
        }
    }


    /* =========================================================
       CHANNELS
       ========================================================= */

    async function loadChannels(
        communityId
    ) {
        const result =
            await state.db
                .from("chat_channels")
                .select("*")
                .eq(
                    "community_id",
                    communityId
                )
                .eq(
                    "is_active",
                    true
                )
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

        state.channels =
            result.data || [];

        state.channels.sort(
            (a, b) => {
                const preferred = [
                    "general",
                    "discussion",
                    "main"
                ];

                const aName =
                    String(
                        a.name || ""
                    ).toLowerCase();

                const bName =
                    String(
                        b.name || ""
                    ).toLowerCase();

                const aIndex =
                    preferred.findIndex(
                        word =>
                            aName.includes(
                                word
                            )
                    );

                const bIndex =
                    preferred.findIndex(
                        word =>
                            bName.includes(
                                word
                            )
                    );

                if (
                    aIndex !== -1 &&
                    bIndex === -1
                ) {
                    return -1;
                }

                if (
                    aIndex === -1 &&
                    bIndex !== -1
                ) {
                    return 1;
                }

                if (
                    aIndex !== -1 &&
                    bIndex !== -1
                ) {
                    return (
                        aIndex -
                        bIndex
                    );
                }

                return aName.localeCompare(
                    bName
                );
            }
        );

        renderChannelList();
    }

    function getChannelCategory(
        channel
    ) {
        const raw =
            String(
                channel?.category ||
                channel?.channel_category ||
                channel?.type ||
                ""
            )
                .toLowerCase()
                .trim();

        const name =
            String(
                channel?.name || ""
            )
                .toLowerCase()
                .trim();

        if (
            raw.includes("course") ||
            channel?.course_id ||
            name.includes("course")
        ) {
            return "courses";
        }

        if (
            raw.includes("information") ||
            raw.includes("info") ||
            raw.includes("announcement") ||
            raw.includes("welcome") ||
            name.includes("announcement") ||
            name.includes("rules") ||
            name.includes("welcome")
        ) {
            return "information";
        }

        return "community";
    }

    function renderChannelList() {
        const information =
            $("informationChannels");

        const courses =
            $("courseChannels");

        const discussion =
            $("communityChannels");

        [
            information,
            courses,
            discussion
        ].forEach(container => {
            if (container) {
                container.innerHTML =
                    "";
            }
        });

        if (
            !information &&
            !courses &&
            !discussion
        ) {
            return;
        }

        state.channels.forEach(
            channel => {
                const button =
                    createChannelButton(
                        channel
                    );

                const category =
                    getChannelCategory(
                        channel
                    );

                if (
                    category ===
                    "information"
                ) {
                    information?.appendChild(
                        button
                    );
                } else if (
                    category ===
                    "courses"
                ) {
                    courses?.appendChild(
                        button
                    );
                } else {
                    discussion?.appendChild(
                        button
                    );
                }
            }
        );

        [
            information,
            courses,
            discussion
        ].forEach(container => {
            if (
                container &&
                !container.children.length
            ) {
                const empty =
                    document.createElement(
                        "div"
                    );

                empty.className =
                    "channel-empty";

                empty.textContent =
                    "No channels";

                container.appendChild(
                    empty
                );
            }
        });

        filterChannels(
            $("channelSearchInput")
                ?.value || ""
        );
    }

    function createChannelButton(
        channel
    ) {
        const button =
            document.createElement(
                "button"
            );

        button.type =
            "button";

        button.className =
            "channel-button channel-item";

        if (
            state.currentChannel &&
            String(
                state.currentChannel.id
            ) ===
            String(
                channel.id
            )
        ) {
            button.classList.add(
                "active"
            );
        }

        button.dataset.channelId =
            channel.id;

        const hash =
            document.createElement(
                "span"
            );

        hash.className =
            "channel-icon channel-hash";

        hash.textContent =
            "#";

        const name =
            document.createElement(
                "span"
            );

        name.className =
            "channel-name";

        name.textContent =
            channel.name ||
            "channel";

        button.appendChild(
            hash
        );

        button.appendChild(
            name
        );

        button.addEventListener(
            "click",
            () => {
                selectChannel(
                    channel.id
                );
            }
        );

        return button;
    }


    /* =========================================================
       CHANNEL SELECTION
       ========================================================= */

    async function selectChannel(
        channelId
    ) {
        const channel =
            state.channels.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        channelId
                    )
            );

        /*
         * Direct-message channels may not
         * exist in state.channels.
         */
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

        if (!channel) {
            return;
        }

        const name =
            $("currentChannelName");

        if (name) {
            name.textContent =
                `# ${channel.name || "channel"}`;
        }

        const description =
            $("currentChannelDescription");

        if (description) {
            description.textContent =
                channel.description ||
                channel.topic ||
                "Community discussion";
        }

        const icon =
            $("currentChannelIcon");

        if (icon) {
            icon.textContent =
                "#";
        }
    }

    function clearMessages() {
        state.currentChannel =
            null;

        state.messages = [];

        unsubscribeMessages();

        const list =
            $("messageList");

        if (list) {
            list.innerHTML = `
                <div class="community-message-empty">
                    <div class="empty-icon">💬</div>
                    <h3>No channel selected</h3>
                    <p>Select a channel to begin.</p>
                </div>
            `;
        }
    }


    /* =========================================================
       MESSAGES
       ========================================================= */

    async function loadMessages(
        channelId
    ) {
        if (
            state.loadingMessages
        ) {
            return;
        }

        state.loadingMessages =
            true;

        const loading =
            $("messageLoading");

        if (loading) {
            loading.classList.remove(
                "hidden"
            );
        }

        try {
            const result =
                await state.db
                    .from(
                        "chat_messages"
                    )
                    .select("*")
                    .eq(
                        "channel_id",
                        channelId
                    )
                    .order(
                        "created_at",
                        {
                            ascending:
                                true
                        }
                    )
                    .limit(150);

            if (result.error) {
                throw result.error;
            }

            state.messages =
                result.data || [];

            await enrichMessages();

            renderMessages();
        } catch (error) {
            console.error(
                "Message loading failed:",
                error
            );

            state.messages = [];

            renderMessages();

            notify(
                "Messages could not be loaded.",
                "error"
            );
        } finally {
            state.loadingMessages =
                false;

            if (loading) {
                loading.classList.add(
                    "hidden"
                );
            }
        }
    }

    async function enrichMessages() {
        const ids = [
            ...new Set(
                state.messages
                    .map(
                        getSenderId
                    )
                    .filter(Boolean)
            )
        ];

        if (!ids.length) {
            return;
        }

        const profiles = {};

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
                (
                    result.data ||
                    []
                ).forEach(profile => {
                    profiles[
                        getProfileId(
                            profile
                        )
                    ] = profile;
                });
            }
        } catch (error) {
            console.warn(
                "Message profiles failed:",
                error
            );
        }

        state.messages =
            state.messages.map(
                message => ({
                    ...message,

                    _profile:
                        profiles[
                            getSenderId(
                                message
                            )
                        ] || null
                })
            );
    }

    function renderMessages() {
        const container =
            $("messageList");

        if (!container) {
            return;
        }

        container.innerHTML =
            "";

        if (
            !state.messages.length
        ) {
            container.innerHTML = `
                <div class="community-message-empty">
                    <div class="empty-icon">💬</div>
                    <h3>Welcome to the channel</h3>
                    <p>
                        Start the discussion by sending
                        the first message.
                    </p>
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

        requestAnimationFrame(
            () => {
                container.scrollTop =
                    container.scrollHeight;
            }
        );
    }

    function createMessageElement(
        message
    ) {
        const article =
            document.createElement(
                "article"
            );

        article.className =
            "community-message";

        const senderId =
            getSenderId(message);

        if (
            String(senderId) ===
            String(state.user?.id)
        ) {
            article.classList.add(
                "own-message"
            );
        }

        if (
            message.deleted_at ||
            message.is_deleted
        ) {
            article.classList.add(
                "deleted-message"
            );
        }

        const profile =
            message._profile ||
            {};

        let name =
            getProfileName(
                profile
            );

        if (
            !name ||
            name === "Student"
        ) {
            if (
                String(senderId) ===
                String(state.user?.id)
            ) {
                name =
                    getProfileName(
                        state.profile
                    );
            }
        }

        const avatar =
            getProfileAvatar(
                profile
            );

        const header =
            document.createElement(
                "div"
            );

        header.className =
            "message-header";

        const avatarElement =
            document.createElement(
                "div"
            );

        avatarElement.className =
            "message-avatar";

        if (avatar) {
            const image =
                document.createElement(
                    "img"
                );

            image.src =
                avatar;

            image.alt =
                name;

            image.loading =
                "lazy";

            image.onerror =
                function () {
                    this.remove();

                    avatarElement.textContent =
                        name
                            .charAt(0)
                            .toUpperCase();
                };

            avatarElement.appendChild(
                image
            );
        } else {
            avatarElement.textContent =
                name
                    .charAt(0)
                    .toUpperCase();
        }

        const sender =
            document.createElement(
                "div"
            );

        sender.className =
            "message-sender";

        sender.textContent =
            name;

        const time =
            document.createElement(
                "time"
            );

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

        article.appendChild(
            header
        );

        const body =
            document.createElement(
                "div"
            );

        body.className =
            "message-body";

        if (
            message.deleted_at ||
            message.is_deleted
        ) {
            body.innerHTML =
                "<em>This message was deleted.</em>";
        } else {
            const text =
                getMessageText(
                    message
                );

            if (text) {
                const textElement =
                    document.createElement(
                        "div"
                    );

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
                getMessageType(
                    message
                )
            );
        }

        article.appendChild(
            body
        );

        const actions =
            createMessageActions(
                message
            );

        if (actions) {
            article.appendChild(
                actions
            );
        }

        return article;
    }


    /* =========================================================
       MESSAGE ATTACHMENTS
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
            /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(
                url
            )
        ) {
            const image =
                document.createElement(
                    "img"
                );

            image.className =
                "message-image";

            image.src =
                url;

            image.alt =
                name;

            image.loading =
                "lazy";

            container.appendChild(
                image
            );

            return;
        }

        if (
            type === "voice" ||
            type === "audio" ||
            /\.(mp3|wav|ogg|webm|m4a)$/i.test(
                url
            )
        ) {
            const audio =
                document.createElement(
                    "audio"
                );

            audio.controls =
                true;

            audio.src =
                url;

            audio.className =
                "message-audio";

            container.appendChild(
                audio
            );

            return;
        }

        const link =
            document.createElement(
                "a"
            );

        link.href =
            url;

        link.target =
            "_blank";

        link.rel =
            "noopener noreferrer";

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

    function createMessageActions(
        message
    ) {
        const actions =
            document.createElement(
                "div"
            );

        actions.className =
            "message-actions";

        const react =
            document.createElement(
                "button"
            );

        react.type =
            "button";

        react.title =
            "React";

        react.textContent =
            "😊";

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
            String(
                getSenderId(
                    message
                )
            ) ===
            String(
                state.user?.id
            )
        ) {
            const deleteButton =
                document.createElement(
                    "button"
                );

            deleteButton.type =
                "button";

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

        state.sendingMessage =
            true;

        try {
            let result =
                await state.db
                    .from(
                        "chat_messages"
                    )
                    .insert({
                        channel_id:
                            state.currentChannel.id,

                        user_id:
                            state.user.id,

                        content:
                            text,

                        message_type:
                            "text"
                    })
                    .select()
                    .single();

            if (
                result.error &&
                /user_id|column/i.test(
                    result.error.message ||
                    ""
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
                                text,

                            message_type:
                                "text"
                        })
                        .select()
                        .single();
            }

            if (result.error) {
                throw result.error;
            }

            input.value =
                "";

            input.dispatchEvent(
                new Event(
                    "input"
                )
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
            state.sendingMessage =
                false;
        }
    }


    /* =========================================================
       DELETE MESSAGE
       ========================================================= */

    async function deleteMessage(
        message
    ) {
        const senderId =
            getSenderId(
                message
            );

        if (
            String(senderId) !==
            String(
                state.user?.id
            )
        ) {
            return;
        }

        try {
            let result =
                await state.db
                    .from(
                        "chat_messages"
                    )
                    .delete()
                    .eq(
                        "id",
                        message.id
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    );

            if (
                result.error
            ) {
                result =
                    await state.db
                        .from(
                            "chat_messages"
                        )
                        .delete()
                        .eq(
                            "id",
                            message.id
                        )
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
                        String(
                            item.id
                        ) !==
                        String(
                            message.id
                        )
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
                    if (
                        !state.messages.some(
                            item =>
                                String(
                                    item.id
                                ) ===
                                String(
                                    payload.new.id
                                )
                        )
                    ) {
                        state.messages.push(
                            payload.new
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

                    if (
                        index !== -1
                    ) {
                        state.messages[
                            index
                        ] =
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
                    "Community message realtime:",
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
       PRESENCE
       ========================================================= */

    function normalizePresence(
        row
    ) {
        if (!row) {
            return "offline";
        }

        const raw =
            String(
                row.status ||
                row.presence_status ||
                row.state ||
                ""
            )
                .toLowerCase()
                .trim();

        if (
            raw === "online" ||
            raw === "active"
        ) {
            return "online";
        }

        if (
            raw === "idle" ||
            raw === "away" ||
            raw === "inactive"
        ) {
            return "idle";
        }

        /*
         * If a user was recently seen, don't
         * immediately display them as offline.
         */

        if (row.last_seen) {
            const last =
                new Date(
                    row.last_seen
                ).getTime();

            const age =
                Date.now() - last;

            if (
                age <
                2 * 60 * 1000
            ) {
                return "online";
            }

            if (
                age <
                10 * 60 * 1000
            ) {
                return "idle";
            }
        }

        return "offline";
    }

    function getPresenceForUser(
        userId
    ) {
        const row =
            state.presences[
                String(userId)
            ];

        if (!row) {
            return {
                status:
                    String(
                        userId
                    ) ===
                    String(
                        state.user?.id
                    )
                        ? "online"
                        : "offline",

                activity:
                    String(
                        userId
                    ) ===
                    String(
                        state.user?.id
                    )
                        ? "You"
                        : "Offline"
            };
        }

        return {
            status:
                normalizePresence(
                    row
                ),

            activity:
                row.activity ||
                row.presence_activity ||
                ""
        };
    }

    async function loadPresence() {
        try {
            const result =
                await state.db
                    .from(
                        "chat_presence"
                    )
                    .select("*");

            if (result.error) {
                console.warn(
                    "Presence query failed:",
                    result.error.message
                );

                return;
            }

            state.presences = {};

            (
                result.data ||
                []
            ).forEach(row => {
                if (
                    row.user_id
                ) {
                    state.presences[
                        String(
                            row.user_id
                        )
                    ] = row;
                }
            });

            renderMembers();

        } catch (error) {
            console.warn(
                "Presence loading failed:",
                error
            );
        }
    }

    function subscribeToPresence() {
        if (
            state.presenceSubscription
        ) {
            state.db.removeChannel(
                state.presenceSubscription
            );
        }

        const channel =
            state.db.channel(
                "mwaniki-community-presence"
            );

        channel.on(
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

                if (
                    row?.user_id
                ) {
                    state.presences[
                        String(
                            row.user_id
                        )
                    ] =
                        payload.eventType ===
                        "DELETE"
                            ? null
                            : row;

                    if (
                        payload.eventType ===
                        "DELETE"
                    ) {
                        delete state.presences[
                            String(
                                row.user_id
                            )
                        ];
                    }

                    renderMembers();
                }
            }
        );

        channel.subscribe(
            status => {
                console.log(
                    "Community presence realtime:",
                    status
                );
            }
        );

        state.presenceSubscription =
            channel;
    }

    async function updatePresence(
        status = "online"
    ) {
        if (!state.user) {
            return;
        }

        const now =
            new Date().toISOString();

        /*
         * First UPDATE.
         * This does not require a unique
         * constraint and avoids the previous
         * on_conflict 400.
         */

        try {
            let result =
                await state.db
                    .from(
                        "chat_presence"
                    )
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
                !result.error
            ) {
                state.presences[
                    String(
                        state.user.id
                    )
                ] = {
                    user_id:
                        state.user.id,

                    status:
                        status,

                    last_seen:
                        now,

                    activity:
                        "Community"
                };

                renderMembers();

                return;
            }

            /*
             * Try INSERT if no row existed.
             */

            result =
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
                            now,

                        activity:
                            "Community"
                    });

            if (
                !result.error
            ) {
                state.presences[
                    String(
                        state.user.id
                    )
                ] = {
                    user_id:
                        state.user.id,

                    status:
                        status,

                    last_seen:
                        now,

                    activity:
                        "Community"
                };

                renderMembers();

                return;
            }

            /*
             * Minimal fallback.
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
                    "Presence update failed:",
                    minimal.error.message
                );
            }

        } catch (error) {
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

        subscribeToPresence();

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

        setupActivityDetection();

        window.addEventListener(
            "beforeunload",
            () => {
                /*
                 * Best effort.
                 */
                updatePresence(
                    "offline"
                );
            }
        );
    }

    function setupActivityDetection() {
        const activityEvents = [
            "mousemove",
            "mousedown",
            "keydown",
            "scroll",
            "touchstart",
            "click"
        ];

        let idleSent =
            false;

        const markActive =
            () => {
                state.lastActivity =
                    Date.now();

                if (idleSent) {
                    idleSent =
                        false;

                    updatePresence(
                        "online"
                    );
                }
            };

        activityEvents.forEach(
            eventName => {
                window.addEventListener(
                    eventName,
                    markActive,
                    {
                        passive: true
                    }
                );
            }
        );

        if (
            state.idleTimer
        ) {
            clearInterval(
                state.idleTimer
            );
        }

        state.idleTimer =
            setInterval(
                () => {
                    const idleFor =
                        Date.now() -
                        state.lastActivity;

                    /*
                     * 5 minutes = idle.
                     */

                    if (
                        idleFor >=
                        5 * 60 * 1000
                    ) {
                        if (!idleSent) {
                            idleSent =
                                true;

                            updatePresence(
                                "idle"
                            );
                        }
                    }
                },
                30000
            );
    }


    /* =========================================================
       MEMBERS
       ========================================================= */

    async function loadMembers(
        communityId
    ) {
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

            if (
                !result.error
            ) {
                members =
                    result.data || [];
            } else {
                console.warn(
                    "Member query failed:",
                    result.error.message
                );
            }
        } catch (error) {
            console.warn(
                "Member query exception:",
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

                if (
                    !result.error
                ) {
                    (
                        result.data ||
                        []
                    ).forEach(
                        profile => {
                            profiles[
                                String(
                                    getProfileId(
                                        profile
                                    )
                                )
                            ] =
                                profile;
                        }
                    );
                }
            } catch (error) {
                console.warn(
                    "Member profile query failed:",
                    error
                );
            }
        }

        state.members =
            members.map(
                member => {
                    const userId =
                        getMemberUserId(
                            member
                        );

                    return {
                        ...member,

                        user_id:
                            userId,

                        profile:
                            profiles[
                                String(
                                    userId
                                )
                            ] ||
                            null
                    };
                }
            );

        /*
         * Always include the currently logged
         * in student.
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

                role:
                    "Student",

                profile:
                    state.profile
            });
        }

        await loadPresence();

        renderMembers();
    }

    function getMemberSearchValue() {
        return (
            $("memberSearchInput")
                ?.value ||
            ""
        )
            .toLowerCase()
            .trim();
    }

    function renderMembers() {
        /*
         * IMPORTANT:
         *
         * Render ONLY inside #memberList.
         * Never clear #memberSidebar.
         */

        const container =
            $("memberList");

        if (!container) {
            return;
        }

        const countElement =
            $("memberCount");

        const query =
            getMemberSearchValue();

        const filtered =
            state.members.filter(
                member => {
                    if (!query) {
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
                        query
                    );
                }
            );

        const online = [];
        const idle = [];
        const offline = [];

        filtered.forEach(
            member => {
                const presence =
                    getPresenceForUser(
                        member.user_id
                    );

                member._status =
                    presence.status;

                member._activity =
                    presence.activity;

                if (
                    presence.status ===
                    "online"
                ) {
                    online.push(
                        member
                    );
                } else if (
                    presence.status ===
                    "idle"
                ) {
                    idle.push(
                        member
                    );
                } else {
                    offline.push(
                        member
                    );
                }
            }
        );

        /*
         * Keep current user first.
         */

        const sortMembers =
            list => {
                list.sort(
                    (a, b) => {
                        const aMe =
                            String(
                                a.user_id
                            ) ===
                            String(
                                state.user?.id
                            );

                        const bMe =
                            String(
                                b.user_id
                            ) ===
                            String(
                                state.user?.id
                            );

                        if (
                            aMe &&
                            !bMe
                        ) {
                            return -1;
                        }

                        if (
                            !aMe &&
                            bMe
                        ) {
                            return 1;
                        }

                        return getProfileName(
                            a.profile
                        ).localeCompare(
                            getProfileName(
                                b.profile
                            )
                        );
                    }
                );
            };

        sortMembers(online);
        sortMembers(idle);
        sortMembers(offline);

        container.innerHTML =
            "";

        appendMemberGroup(
            container,
            "ONLINE",
            online
        );

        appendMemberGroup(
            container,
            "IDLE",
            idle
        );

        appendMemberGroup(
            container,
            "OFFLINE",
            offline
        );

        if (
            !online.length &&
            !idle.length &&
            !offline.length
        ) {
            const empty =
                document.createElement(
                    "div"
                );

            empty.className =
                "member-empty";

            empty.textContent =
                query
                    ? "No members found."
                    : "No members available.";

            container.appendChild(
                empty
            );
        }

        if (countElement) {
            countElement.textContent =
                state.members.length;
        }

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
            document.createElement(
                "div"
            );

        heading.className =
            "member-group-title";

        heading.textContent =
            `${title} — ${members.length}`;

        container.appendChild(
            heading
        );

        members.forEach(
            member => {
                container.appendChild(
                    createMemberElement(
                        member
                    )
                );
            }
        );
    }

    function createMemberElement(
        member
    ) {
        const profile =
            member.profile ||
            {};

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

        const status =
            member._status ||
            "offline";

        const activity =
            member._activity ||
            (
                String(userId) ===
                String(
                    state.user?.id
                )
                    ? "You"
                    : status ===
                      "online"
                        ? "Online"
                        : status ===
                          "idle"
                            ? "Idle"
                            : "Offline"
            );

        const row =
            document.createElement(
                "div"
            );

        row.className =
            "community-member";

        row.dataset.userId =
            userId;

        row.dataset.status =
            status;

        /*
         * REAL PROFILE PHOTO
         */

        const avatarWrapper =
            document.createElement(
                "div"
            );

        avatarWrapper.className =
            "member-avatar";

        if (avatar) {
            const image =
                document.createElement(
                    "img"
                );

            image.src =
                avatar;

            image.alt =
                name;

            image.loading =
                "lazy";

            image.referrerPolicy =
                "no-referrer";

            image.onerror =
                function () {
                    this.remove();

                    avatarWrapper.classList.add(
                        "avatar-fallback"
                    );

                    avatarWrapper.textContent =
                        name
                            .charAt(0)
                            .toUpperCase();
                };

            avatarWrapper.appendChild(
                image
            );
        } else {
            avatarWrapper.classList.add(
                "avatar-fallback"
            );

            avatarWrapper.textContent =
                name
                    .charAt(0)
                    .toUpperCase();
        }

        /*
         * STATUS DOT
         */

        const presenceDot =
            document.createElement(
                "span"
            );

        presenceDot.className =
            `member-presence-dot ${status}`;

        presenceDot.title =
            status === "online"
                ? "Online"
                : status === "idle"
                    ? "Idle"
                    : "Offline";

        avatarWrapper.appendChild(
            presenceDot
        );

        /*
         * MEMBER INFORMATION
         */

        const info =
            document.createElement(
                "div"
            );

        info.className =
            "member-info";

        const nameElement =
            document.createElement(
                "div"
            );

        nameElement.className =
            "member-name";

        nameElement.textContent =
            name;

        const activityElement =
            document.createElement(
                "div"
            );

        activityElement.className =
            `member-activity ${status}`;

        if (
            activity &&
            activity !== "Community"
        ) {
            activityElement.textContent =
                activity;
        } else {
            activityElement.textContent =
                status === "online"
                    ? "Online"
                    : status === "idle"
                        ? "Idle"
                        : "Offline";
        }

        info.appendChild(
            nameElement
        );

        info.appendChild(
            activityElement
        );

        /*
         * ACTIONS
         */

        const actions =
            document.createElement(
                "div"
            );

        actions.className =
            "member-actions";

        /*
         * PERSONAL MESSAGE
         */

        const messageButton =
            document.createElement(
                "button"
            );

        messageButton.type =
            "button";

        messageButton.className =
            "member-message-button";

        messageButton.title =
            `Message ${name}`;

        messageButton.setAttribute(
            "aria-label",
            `Message ${name}`
        );

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

        actions.appendChild(
            messageButton
        );

        /*
         * PERSONAL CALL
         */

        if (
            String(userId) !==
            String(
                state.user?.id
            )
        ) {
            const callButton =
                document.createElement(
                    "button"
                );

            callButton.type =
                "button";

            callButton.className =
                "member-call-button";

            callButton.title =
                `Call ${name}`;

            callButton.setAttribute(
                "aria-label",
                `Call ${name}`
            );

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

            actions.appendChild(
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
            actions
        );

        return row;
    }

    function updateOnlineCount(
        count
    ) {
        document
            .querySelectorAll(
                "[data-online-count]"
            )
            .forEach(element => {
                element.textContent =
                    count;
            });

        const element =
            $("onlineCount");

        if (element) {
            element.textContent =
                count;
        }
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
                    new Date()
                        .toISOString()
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
                    "Read status unavailable:",
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
       EMOJI PANEL
       ========================================================= */

    function setupEmojiPicker() {
        const button =
            $("emojiButton");

        const panel =
            $("emojiPanel");

        if (
            !button ||
            !panel
        ) {
            return;
        }

        button.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                closeOtherPickers(
                    panel
                );

                panel.classList.toggle(
                    "open"
                );

                panel.classList.toggle(
                    "hidden",
                    !panel.classList.contains(
                        "open"
                    )
                );

                panel.hidden =
                    !panel.classList.contains(
                        "open"
                    );

                populateEmojiGrid();
            }
        );

        panel.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                const target =
                    event.target.closest(
                        "[data-emoji]"
                    );

                if (!target) {
                    return;
                }

                const emoji =
                    target.dataset.emoji;

                insertEmoji(
                    emoji
                );
            }
        );

        const close =
            $("closeEmojiButton");

        if (close) {
            close.addEventListener(
                "click",
                () => {
                    closeEmojiPanel();
                }
            );
        }

        document.addEventListener(
            "click",
            event => {
                if (
                    !panel.contains(
                        event.target
                    ) &&
                    event.target !==
                        button
                ) {
                    closeEmojiPanel();
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
                    closeEmojiPanel();

                    closeStickerPanel();

                    closeGifPanel();
                }
            }
        );
    }

    function closeOtherPickers(
        current
    ) {
        const panels = [
            $("emojiPanel"),
            $("stickerPanel"),
            $("gifPanel")
        ];

        panels.forEach(
            panel => {
                if (
                    panel &&
                    panel !== current
                ) {
                    panel.classList.remove(
                        "open"
                    );

                    panel.classList.add(
                        "hidden"
                    );

                    panel.hidden =
                        true;
                }
            }
        );
    }

    function closeEmojiPanel() {
        const panel =
            $("emojiPanel");

        if (!panel) {
            return;
        }

        panel.classList.remove(
            "open"
        );

        panel.classList.add(
            "hidden"
        );

        panel.hidden =
            true;
    }

    function closeStickerPanel() {
        const panel =
            $("stickerPanel");

        if (!panel) {
            return;
        }

        panel.classList.remove(
            "open"
        );

        panel.classList.add(
            "hidden"
        );

        panel.hidden =
            true;
    }

    function closeGifPanel() {
        const panel =
            $("gifPanel");

        if (!panel) {
            return;
        }

        panel.classList.remove(
            "open"
        );

        panel.classList.add(
            "hidden"
        );

        panel.hidden =
            true;
    }

    function populateEmojiGrid() {
        const grid =
            $("emojiGrid");

        if (
            !grid ||
            grid.children.length
        ) {
            return;
        }

        const emojis = [
            "😀",
            "😃",
            "😄",
            "😁",
            "😆",
            "😅",
            "😂",
            "🤣",
            "😊",
            "🙂",
            "🙃",
            "😉",
            "😌",
            "😍",
            "🥰",
            "😘",
            "😎",
            "🤓",
            "🤔",
            "😐",
            "😑",
            "😶",
            "🙄",
            "😏",
            "😴",
            "🤗",
            "🤩",
            "😮",
            "😲",
            "😢",
            "😭",
            "😡",
            "🤬",
            "👍",
            "👎",
            "👏",
            "🙏",
            "💪",
            "🔥",
            "❤️",
            "💯",
            "🎉",
            "🎓",
            "🧪",
            "🩺",
            "🧬",
            "🔬",
            "📚",
            "✏️"
        ];

        emojis.forEach(
            emoji => {
                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.dataset.emoji =
                    emoji;

                button.textContent =
                    emoji;

                grid.appendChild(
                    button
                );
            }
        );
    }

    function insertEmoji(
        emoji
    ) {
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

        const position =
            start +
            emoji.length;

        input.selectionStart =
            position;

        input.selectionEnd =
            position;

        input.dispatchEvent(
            new Event(
                "input"
            )
        );
    }


    /* =========================================================
       STICKERS / GIFS
       ========================================================= */

    function setupStickerAndGifPanels() {
        const stickerButton =
            $("stickerButton");

        const stickerPanel =
            $("stickerPanel");

        if (
            stickerButton &&
            stickerPanel
        ) {
            stickerButton.addEventListener(
                "click",
                event => {
                    event.stopPropagation();

                    closeOtherPickers(
                        stickerPanel
                    );

                    stickerPanel.classList.toggle(
                        "open"
                    );

                    stickerPanel.classList.toggle(
                        "hidden",
                        !stickerPanel.classList.contains(
                            "open"
                        )
                    );

                    stickerPanel.hidden =
                        !stickerPanel.classList.contains(
                            "open"
                        );
                }
            );
        }

        const closeSticker =
            $("closeStickerButton");

        if (closeSticker) {
            closeSticker.addEventListener(
                "click",
                closeStickerPanel
            );
        }

        const gifButton =
            $("gifButton");

        const gifPanel =
            $("gifPanel");

        if (
            gifButton &&
            gifPanel
        ) {
            gifButton.addEventListener(
                "click",
                event => {
                    event.stopPropagation();

                    closeOtherPickers(
                        gifPanel
                    );

                    gifPanel.classList.toggle(
                        "open"
                    );

                    gifPanel.classList.toggle(
                        "hidden",
                        !gifPanel.classList.contains(
                            "open"
                        )
                    );

                    gifPanel.hidden =
                        !gifPanel.classList.contains(
                            "open"
                        );
                }
            );
        }

        const closeGif =
            $("closeGifButton");

        if (closeGif) {
            closeGif.addEventListener(
                "click",
                closeGifPanel
            );
        }
    }


    /* =========================================================
       REACTIONS
       ========================================================= */

    function openReactionPicker(
        messageId,
        button
    ) {
        const existing =
            document.querySelector(
                ".message-reaction-popup"
            );

        if (existing) {
            existing.remove();
        }

        const popup =
            document.createElement(
                "div"
            );

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
        ].forEach(
            emoji => {
                const option =
                    document.createElement(
                        "button"
                    );

                option.type =
                    "button";

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
            }
        );

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

            const result =
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

            if (result.error) {
                throw result.error;
            }

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

    async function uploadFile(
        file
    ) {
        if (!file) {
            return null;
        }

        const buckets = [
            "chat-attachments",
            "attachments"
        ];

        const safeName =
            file.name.replace(
                /[^a-zA-Z0-9._-]/g,
                "_"
            );

        const path =
            `${state.user.id}/${Date.now()}-${safeName}`;

        for (
            const bucket of buckets
        ) {
            try {
                const result =
                    await state.db
                        .storage
                        .from(bucket)
                        .upload(
                            path,
                            file,
                            {
                                upsert:
                                    false
                            }
                        );

                if (
                    !result.error
                ) {
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
                    `Storage bucket ${bucket} failed:`,
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
            !state.currentChannel ||
            !state.user
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

            let type =
                "file";

            if (
                file.type.startsWith(
                    "image/"
                )
            ) {
                type =
                    "image";
            } else if (
                file.type.startsWith(
                    "audio/"
                )
            ) {
                type =
                    "audio";
            }

            let result =
                await state.db
                    .from(
                        "chat_messages"
                    )
                    .insert({
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
                    });

            if (
                result.error &&
                /user_id|column/i.test(
                    result.error.message ||
                    ""
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
                        audio:
                            true
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
                        state.recordingChunks.push(
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
                                    recorder.mimeType ||
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

                    updateRecordingUI(
                        false
                    );

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

            return;
        }

        updateRecordingUI(
            false
        );
    }

    async function sendVoiceNote(
        blob
    ) {
        if (
            !state.currentChannel ||
            !state.user
        ) {
            return;
        }

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

            let result =
                await state.db
                    .from(
                        "chat_messages"
                    )
                    .insert({
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
                    });

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

        const button =
            $("voiceNoteButton");

        if (button) {
            button.classList.toggle(
                "recording",
                recording
            );

            button.title =
                recording
                    ? "Stop recording"
                    : "Record voice note";

            button.textContent =
                recording
                    ? "⏹️"
                    : "🎙️";
        }

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
            String(
                targetUserId
            ) ===
            String(
                state.user?.id
            )
        ) {
            return;
        }

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
                    );

            if (
                !result.error
            ) {
                const channels =
                    result.data ||
                    [];

                for (
                    const channel of
                    channels
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
         * Create a DM.
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
                    `dm-${state.user.id}-${targetUserId}-${Date.now()}`,

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

            const membersResult =
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

            if (
                membersResult.error
            ) {
                console.warn(
                    "DM members could not be created:",
                    membersResult.error
                );
            }

            await openDirectChannel(
                channel
            );

        } catch (error) {
            console.error(
                "Direct message creation failed:",
                error
            );

            notify(
                "Direct messaging could not be opened.",
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
       CALLING
       ========================================================= */

    function callUser(
        userId
    ) {
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
            typeof window
                .MwanikiCalls
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
            typeof window
                .MwanikiCalls
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
            typeof window
                .MwanikiCalls
                .callCommunity !==
            "function"
        ) {
            openCallPicker();

            return;
        }

        if (
            !state.currentCommunity
        ) {
            notify(
                "Select a community first.",
                "error"
            );

            return;
        }

        window.MwanikiCalls.callCommunity(
            state.currentCommunity.id
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
            typeof window
                .MwanikiCalls
                .openPicker ===
            "function"
        ) {
            /*
             * null means General Call.
             * The call engine should show its
             * visual online-user picker.
             */
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
            $("channelSearchInput");

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
            $("memberSearchInput");

        if (memberSearch) {
            memberSearch.addEventListener(
                "input",
                () => {
                    renderMembers();
                }
            );
        }
    }

    function filterChannels(
        value
    ) {
        const query =
            String(
                value || ""
            )
                .toLowerCase()
                .trim();

        document
            .querySelectorAll(
                ".channel-button.channel-item"
            )
            .forEach(
                button => {
                    const text =
                        button.textContent
                            .toLowerCase();

                    button.style.display =
                        !query ||
                        text.includes(
                            query
                        )
                            ? ""
                            : "none";
                }
            );
    }


    /* =========================================================
       BUTTONS
       ========================================================= */

    function setupButtons() {
        /*
         * SEND
         */

        const sendButton =
            $("sendMessageButton");

        if (sendButton) {
            sendButton.addEventListener(
                "click",
                sendMessage
            );
        }

        /*
         * MESSAGE INPUT
         */

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

        /*
         * ATTACHMENTS
         */

        const attachButton =
            $("attachButton");

        const attachmentInput =
            $("attachmentInput");

        if (
            attachButton &&
            attachmentInput
        ) {
            attachButton.addEventListener(
                "click",
                () => {
                    attachmentInput.click();
                }
            );

            attachmentInput.addEventListener(
                "change",
                async () => {
                    const files =
                        Array.from(
                            attachmentInput.files ||
                                []
                        );

                    for (
                        const file of files
                    ) {
                        await sendAttachment(
                            file
                        );
                    }

                    attachmentInput.value =
                        "";
                }
            );
        }

        /*
         * VOICE
         */

        const voiceButton =
            $("voiceNoteButton");

        if (voiceButton) {
            voiceButton.addEventListener(
                "click",
                () => {
                    if (
                        state.mediaRecorder
                    ) {
                        stopVoiceRecording();
                    } else {
                        startVoiceRecording();
                    }
                }
            );
        }

        const voiceStart =
            firstExisting(
                "voiceRecordButton",
                "startVoiceNoteButton"
            );

        if (
            voiceStart &&
            voiceStart !== voiceButton
        ) {
            voiceStart.addEventListener(
                "click",
                startVoiceRecording
            );
        }

        const voiceStop =
            firstExisting(
                "voiceStopButton",
                "stopVoiceNoteButton"
            );

        if (voiceStop) {
            voiceStop.addEventListener(
                "click",
                stopVoiceRecording
            );
        }

        /*
         * COMMUNITY CALL
         */

        const communityCall =
            $("communityCallButton");

        if (communityCall) {
            communityCall.addEventListener(
                "click",
                startCommunityCall
            );
        }

        /*
         * GENERAL CALL
         */

        const generalCall =
            $("generalCallButton");

        if (generalCall) {
            generalCall.addEventListener(
                "click",
                startGeneralCall
            );
        }

        /*
         * MEMBER SIDEBAR CLOSE
         */

        const closeMembers =
            $("closeMemberSidebarButton");

        if (closeMembers) {
            closeMembers.addEventListener(
                "click",
                () => {
                    document.body.classList.toggle(
                        "member-sidebar-closed"
                    );
                }
            );
        }

        /*
         * MOBILE SIDEBAR
         */

        const mobileSidebar =
            $("mobileSidebarButton");

        if (mobileSidebar) {
            mobileSidebar.addEventListener(
                "click",
                () => {
                    document.body.classList.toggle(
                        "mobile-community-sidebar-open"
                    );
                }
            );
        }

        /*
         * PROFILE
         */

        const profileButton =
            $("profileButton");

        if (profileButton) {
            profileButton.addEventListener(
                "click",
                () => {
                    openSimpleModal(
                        "profileModal"
                    );

                    renderProfileModal();
                }
            );
        }

        /*
         * RULES
         */

        const rulesButton =
            $("communityRulesButton");

        if (rulesButton) {
            rulesButton.addEventListener(
                "click",
                () => {
                    openSimpleModal(
                        "rulesModal"
                    );
                }
            );
        }

        /*
         * FRIENDS
         */

        const friendsButton =
            $("friendsButton");

        if (friendsButton) {
            friendsButton.addEventListener(
                "click",
                () => {
                    openSimpleModal(
                        "friendsModal"
                    );
                }
            );
        }

        /*
         * COMMUNITY HOME
         */

        const home =
            $("communityHomeButton");

        if (home) {
            home.addEventListener(
                "click",
                () => {
                    const main =
                        chooseDefaultCommunity();

                    if (main) {
                        selectCommunity(
                            main.id
                        );
                    }
                }
            );
        }

        /*
         * CHANNEL MESSAGE SEARCH
         */

        const searchButton =
            $("channelSearchButton");

        const searchBar =
            $("messageSearchBar");

        const closeSearch =
            $("closeMessageSearchButton");

        if (
            searchButton &&
            searchBar
        ) {
            searchButton.addEventListener(
                "click",
                () => {
                    searchBar.classList.toggle(
                        "hidden"
                    );

                    if (
                        !searchBar.classList.contains(
                            "hidden"
                        )
                    ) {
                        $("messageSearchInput")
                            ?.focus();
                    }
                }
            );
        }

        if (closeSearch) {
            closeSearch.addEventListener(
                "click",
                () => {
                    searchBar?.classList.add(
                        "hidden"
                    );

                    if ($("messageSearchInput")) {
                        $("messageSearchInput")
                            .value =
                            "";
                    }

                    renderMessages();
                }
            );
        }

        const messageSearch =
            $("messageSearchInput");

        if (messageSearch) {
            messageSearch.addEventListener(
                "input",
                () => {
                    filterMessages(
                        messageSearch.value
                    );
                }
            );
        }

        /*
         * CHANNEL MEMBERS BUTTON
         */

        const membersButton =
            $("channelMembersButton");

        if (membersButton) {
            membersButton.addEventListener(
                "click",
                () => {
                    document.body.classList.remove(
                        "member-sidebar-closed"
                    );
                }
            );
        }

        /*
         * CONTEST
         */

        const contest =
            $("contestChannelButton");

        if (contest) {
            contest.addEventListener(
                "click",
                () => {
                    openSimpleModal(
                        "contestModal"
                    );
                }
            );
        }

        setupModalCloseButtons();
    }

    function filterMessages(
        query
    ) {
        const value =
            String(
                query || ""
            )
                .toLowerCase()
                .trim();

        document
            .querySelectorAll(
                "#messageList .community-message"
            )
            .forEach(message => {
                const text =
                    message.textContent
                        .toLowerCase();

                message.style.display =
                    !value ||
                    text.includes(
                        value
                    )
                        ? ""
                        : "none";
            });
    }


    /* =========================================================
       MODALS
       ========================================================= */

    function openSimpleModal(
        id
    ) {
        const modal =
            $(id);

        if (!modal) {
            return;
        }

        modal.classList.remove(
            "hidden"
        );

        modal.hidden =
            false;
    }

    function closeSimpleModal(
        id
    ) {
        const modal =
            $(id);

        if (!modal) {
            return;
        }

        modal.classList.add(
            "hidden"
        );

        modal.hidden =
            true;
    }

    function setupModalCloseButtons() {
        const mappings = [
            [
                "closeFilePreviewButton",
                "filePreviewModal"
            ],
            [
                "closeFriendsButton",
                "friendsModal"
            ],
            [
                "closeRulesButton",
                "rulesModal"
            ],
            [
                "closeProfileButton",
                "profileModal"
            ],
            [
                "closeContestButton",
                "contestModal"
            ]
        ];

        mappings.forEach(
            ([buttonId, modalId]) => {
                const button =
                    $(buttonId);

                if (button) {
                    button.addEventListener(
                        "click",
                        () => {
                            closeSimpleModal(
                                modalId
                            );
                        }
                    );
                }
            }
        );

        document
            .querySelectorAll(
                ".modal-overlay"
            )
            .forEach(modal => {
                modal.addEventListener(
                    "click",
                    event => {
                        if (
                            event.target ===
                            modal
                        ) {
                            modal.classList.add(
                                "hidden"
                            );

                            modal.hidden =
                                true;
                        }
                    }
                );
            });
    }

    function renderProfileModal() {
        const container =
            $("profileModalContent");

        if (!container) {
            return;
        }

        const name =
            getProfileName(
                state.profile
            );

        const avatar =
            getProfileAvatar(
                state.profile
            );

        container.innerHTML =
            "";

        const wrapper =
            document.createElement(
                "div"
            );

        wrapper.className =
            "profile-modal-inner";

        if (avatar) {
            const image =
                document.createElement(
                    "img"
                );

            image.src =
                avatar;

            image.alt =
                name;

            image.className =
                "profile-modal-avatar";

            wrapper.appendChild(
                image
            );
        }

        const heading =
            document.createElement(
                "h3"
            );

        heading.textContent =
            name;

        wrapper.appendChild(
            heading
        );

        if (
            state.user?.email
        ) {
            const email =
                document.createElement(
                    "p"
                );

            email.textContent =
                state.user.email;

            wrapper.appendChild(
                email
            );
        }

        container.appendChild(
            wrapper
        );
    }


    /* =========================================================
       REFRESH
       ========================================================= */

    async function refreshCommunity() {
        try {
            await loadCommunities();

            const defaultCommunity =
                state.currentCommunity &&
                state.communities.find(
                    community =>
                        String(
                            community.id
                        ) ===
                        String(
                            state.currentCommunity
                                .id
                        )
                );

            if (defaultCommunity) {
                await selectCommunity(
                    defaultCommunity.id
                );

                return;
            }

            const main =
                chooseDefaultCommunity();

            if (main) {
                await selectCommunity(
                    main.id
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
                            community.name ||
                            ""
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
            async (
                event,
                session
            ) => {
                if (
                    event ===
                    "SIGNED_OUT"
                ) {
                    state.user =
                        null;

                    return;
                }

                if (
                    (
                        event ===
                        "SIGNED_IN" ||
                        event ===
                        "TOKEN_REFRESHED"
                    ) &&
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

            setupStickerAndGifPanels();

            setupSearch();

            setupAuthListener();

            startPresence();

            await loadCommunities();

            const defaultCommunity =
                chooseDefaultCommunity();

            if (defaultCommunity) {
                await selectCommunity(
                    defaultCommunity.id
                );
            } else {
                console.warn(
                    "No active communities found."
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
