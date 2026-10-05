```javascript
/* ============================================================
   MWANIKI SCHOLARS COMMUNITY
   Complete community controller

   IMPORTANT:
   - Uses the existing supabase.js client
   - Does NOT contain a duplicate call engine
   - Uses community-calls.js for real calls
   - Supports real profile photos
   - Supports Online / Idle / Offline
   - Matches the supplied community.html
   ============================================================ */

(() => {
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

        lastActivity: Date.now(),

        loadingMessages: false,
        sendingMessage: false,
        initialized: false
    };

    /* =========================================================
       DOM
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

    /* =========================================================
       BASIC HELPERS
       ========================================================= */

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function sleep(ms) {
        return new Promise(resolve =>
            setTimeout(resolve, ms)
        );
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

    function formatDateTime(value) {
        if (!value) {
            return "";
        }

        const date = new Date(value);

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

    function notify(message, type = "info") {
        const toast = $("toast");

        if (!toast) {
            console.log(message);
            return;
        }

        toast.textContent = message;
        toast.className = "toast";

        if (type) {
            toast.classList.add(type);
        }

        toast.classList.remove("hidden");

        clearTimeout(
            notify._timer
        );

        notify._timer = setTimeout(() => {
            toast.classList.add("hidden");
        }, 3500);
    }

    function getSenderId(message) {
        if (!message) {
            return null;
        }

        return (
            message.user_id ||
            message.sender_id ||
            message.author_id ||
            message.created_by ||
            null
        );
    }

    function getMessageText(message) {
        if (!message) {
            return "";
        }

        return (
            message.message ||
            message.content ||
            message.body ||
            message.text ||
            ""
        );
    }

    function getMessageType(message) {
        if (!message) {
            return "text";
        }

        return (
            message.message_type ||
            message.type ||
            "text"
        );
    }

    function getMemberUserId(member) {
        if (!member) {
            return null;
        }

        return (
            member.user_id ||
            member.member_id ||
            member.profile_id ||
            member.student_id ||
            null
        );
    }

    /* =========================================================
       PROFILE FIELD HELPERS

       Different versions of the Mwaniki database may use
       different names. We safely support the common ones.
       ========================================================= */

    function getProfileId(profile) {
        if (!profile) {
            return null;
        }

        return (
            profile.user_id ||
            profile.id ||
            null
        );
    }

    function getProfileName(profile, fallback = "Student") {
        if (!profile) {
            return fallback;
        }

        return (
            profile.full_name ||
            profile.name ||
            profile.display_name ||
            profile.username ||
            profile.student_name ||
            profile.first_name
                ? (
                    profile.full_name ||
                    profile.name ||
                    profile.display_name ||
                    profile.username ||
                    profile.student_name ||
                    [
                        profile.first_name,
                        profile.last_name
                    ]
                        .filter(Boolean)
                        .join(" ")
                )
                : fallback
        ) || fallback;
    }

    function getProfileAvatar(profile) {
        if (!profile) {
            return "";
        }

        const candidates = [
            profile.avatar_url,
            profile.photo_url,
            profile.profile_photo,
            profile.profile_image,
            profile.image_url,
            profile.image,
            profile.avatar,
            profile.photo,
            profile.picture,
            profile.profile_picture,
            profile.student_photo,
            profile.photo_path
        ];

        for (const value of candidates) {
            if (
                typeof value === "string" &&
                value.trim()
            ) {
                return value.trim();
            }
        }

        return "";
    }

    function getProfileInitial(profile) {
        const name =
            getProfileName(
                profile,
                "S"
            );

        return (
            name
                .trim()
                .charAt(0)
                .toUpperCase() ||
            "S"
        );
    }

    /* =========================================================
       SUPABASE
       ========================================================= */

    async function waitForSupabase() {
        for (let i = 0; i < 100; i++) {
            const client =
                window.supabaseClient ||
                window.mwanikiSupabase ||
                window.sb ||
                window.supabase;

            if (
                client &&
                client.auth &&
                client.from
            ) {
                state.db = client;

                console.log(
                    "✅ Community: Supabase client ready."
                );

                return true;
            }

            await sleep(100);
        }

        console.error(
            "❌ Community: Supabase client was not found."
        );

        notify(
            "Supabase could not be loaded.",
            "error"
        );

        return false;
    }

    async function loadAuthenticatedUser() {
        if (!state.db) {
            return false;
        }

        try {
            const {
                data,
                error
            } = await state.db.auth.getUser();

            if (error) {
                console.error(
                    "Authentication error:",
                    error
                );

                return false;
            }

            state.user =
                data?.user || null;

            if (!state.user) {
                notify(
                    "You must be signed in to use the community.",
                    "error"
                );

                return false;
            }

            console.log(
                "✅ Community authenticated user:",
                state.user.id
            );

            return true;

        } catch (error) {
            console.error(
                "Authentication exception:",
                error
            );

            return false;
        }
    }

    /* =========================================================
       PROFILE LOADING

       IMPORTANT:
       chat_public_profiles does NOT use user_id according
       to the supplied console error.

       We therefore try:
       1. chat_public_profiles.id
       2. students.user_id
       3. auth metadata
       ========================================================= */

    async function loadProfile() {
        state.profile = null;

        if (!state.user) {
            return;
        }

        try {
            const result =
                await state.db
                    .from("chat_public_profiles")
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
                "Public profile lookup failed:",
                error
            );
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
                id: state.user.id,

                full_name:
                    state.user.user_metadata?.full_name ||
                    state.user.user_metadata?.name ||
                    state.user.user_metadata?.display_name ||
                    state.user.email?.split("@")[0] ||
                    "Student",

                avatar_url:
                    state.user.user_metadata?.avatar_url ||
                    state.user.user_metadata?.picture ||
                    state.user.user_metadata?.photo_url ||
                    ""
            };
        }

        updateCurrentUserUI();
    }

    function updateCurrentUserUI() {
        if (!state.user) {
            return;
        }

        const name =
            getProfileName(
                state.profile,
                state.user.email?.split("@")[0] ||
                "Student"
            );

        const avatar =
            getProfileAvatar(
                state.profile
            );

        const headerName =
            $("headerProfileName");

        if (headerName) {
            headerName.textContent =
                name;
        }

        const headerAvatar =
            $("headerProfileAvatar");

        if (headerAvatar) {
            if (avatar) {
                headerAvatar.src =
                    avatar;

                headerAvatar.classList.add(
                    "has-avatar"
                );
            } else {
                headerAvatar.removeAttribute(
                    "src"
                );

                headerAvatar.classList.remove(
                    "has-avatar"
                );
            }

            headerAvatar.alt =
                name;
        }

        const profileAvatar =
            $("profileLargeAvatar");

        if (profileAvatar) {
            if (avatar) {
                profileAvatar.src =
                    avatar;
            } else {
                profileAvatar.removeAttribute(
                    "src"
                );
            }

            profileAvatar.alt =
                name;
        }

        const profileName =
            $("profileName");

        if (profileName) {
            profileName.textContent =
                name;
        }

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
    }

    /* =========================================================
       COMMUNITY ICONS
       ========================================================= */

    function getCommunityIcon(
        community
    ) {
        const name =
            String(
                community?.name ||
                community?.slug ||
                ""
            ).toLowerCase();

        if (
            name.includes("gaming") ||
            name.includes("game")
        ) {
            return "🎮";
        }

        if (
            name.includes("meme")
        ) {
            return "😂";
        }

        if (
            name.includes("mwaniki") ||
            name.includes("scholar")
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

        const rawIcon =
            String(
                community?.icon_url ||
                community?.image_url ||
                community?.avatar_url ||
                ""
            ).trim();

        const emojiValues = [
            "🎮",
            "😂",
            "🎓",
            "💬",
            "📚",
            "🩺",
            "🧪",
            "🏆"
        ];

        if (
            emojiValues.includes(
                rawIcon
            )
        ) {
            wrapper.textContent =
                rawIcon;

            return wrapper;
        }

        if (!rawIcon) {
            wrapper.textContent =
                getCommunityIcon(
                    community
                );

            return wrapper;
        }

        if (
            /^https?:\/\//i.test(
                rawIcon
            )
        ) {
            const image =
                document.createElement(
                    "img"
                );

            image.src =
                rawIcon;

            image.alt =
                community?.name ||
                "Community";

            image.loading =
                "lazy";

            image.onerror =
                function () {
                    wrapper.innerHTML = "";

                    wrapper.textContent =
                        getCommunityIcon(
                            community
                        );
                };

            wrapper.appendChild(
                image
            );

            return wrapper;
        }

        wrapper.textContent =
            rawIcon;

        return wrapper;
    }

    /* =========================================================
       LOAD COMMUNITIES
       ========================================================= */

    async function loadCommunities() {
        try {
            const result =
                await state.db
                    .from("chat_communities")
                    .select("*")
                    .eq(
                        "is_active",
                        true
                    );

            if (result.error) {
                console.error(
                    "Community loading error:",
                    result.error.message
                );

                notify(
                    "Unable to load communities.",
                    "error"
                );

                return;
            }

            state.communities =
                result.data || [];

            state.communities.sort(
                (a, b) => {
                    const aName =
                        String(
                            a.name || ""
                        ).toLowerCase();

                    const bName =
                        String(
                            b.name || ""
                        ).toLowerCase();

                    const aMain =
                        aName.includes(
                            "mwaniki"
                        );

                    const bMain =
                        bName.includes(
                            "mwaniki"
                        );

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

                    return aName.localeCompare(
                        bName
                    );
                }
            );

            renderCommunityRail();

        } catch (error) {
            console.error(
                "Community loading exception:",
                error
            );
        }
    }

    /* =========================================================
       COMMUNITY RAIL

       IMPORTANT:
       Render into #communityRailList.
       Never destroy the entire #communityRail.
       ========================================================= */

    function renderCommunityRail() {
        const rail =
            $("communityRailList");

        if (!rail) {
            return;
        }

        rail.innerHTML = "";

        state.communities.forEach(
            community => {
                const button =
                    document.createElement(
                        "button"
                    );

                button.type = "button";

                button.className =
                    "community-rail-button";

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

                button.appendChild(
                    createCommunityIcon(
                        community
                    )
                );

                button.addEventListener(
                    "click",
                    () =>
                        selectCommunity(
                            community.id
                        )
                );

                rail.appendChild(
                    button
                );
            }
        );
    }

    /* =========================================================
       SELECT COMMUNITY
       ========================================================= */

    async function selectCommunity(
        communityId
    ) {
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

        renderCommunityRail();
        updateCommunityHeader();

        await loadChannels(
            community.id
        );

        await loadMembers(
            community.id
        );

        subscribeToCommunity(
            community.id
        );

        const defaultChannel =
            chooseDefaultChannel();

        if (defaultChannel) {
            await selectChannel(
                defaultChannel.id
            );
        }

        console.log(
            "Community selected:",
            community.name
        );
    }

    function updateCommunityHeader() {
        const community =
            state.currentCommunity;

        if (!community) {
            return;
        }

        const name =
            $("selectedCommunityName");

        if (name) {
            name.textContent =
                community.name ||
                "Mwaniki Scholars";
        }

        const description =
            $("selectedCommunityDescription");

        if (description) {
            description.textContent =
                community.description ||
                "Academic community";
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

    function chooseDefaultChannel() {
        if (!state.channels.length) {
            return null;
        }

        const preferred = [
            "discussion",
            "general",
            "main",
            "lobby",
            "chat",
            "medical"
        ];

        for (const word of preferred) {
            const found =
                state.channels.find(
                    channel =>
                        String(
                            channel.name ||
                            ""
                        )
                            .toLowerCase()
                            .includes(word)
                );

            if (found) {
                return found;
            }
        }

        return state.channels[0];
    }

    /* =========================================================
       CHANNELS
       ========================================================= */

    async function loadChannels(
        communityId
    ) {
        try {
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
                    );

            if (result.error) {
                console.error(
                    "Channel loading error:",
                    result.error.message
                );

                state.channels = [];

                renderChannelLists();

                return;
            }

            state.channels =
                result.data || [];

            state.channels.sort(
                (a, b) => {
                    const aName =
                        String(
                            a.name || ""
                        ).toLowerCase();

                    const bName =
                        String(
                            b.name || ""
                        ).toLowerCase();

                    const preferred = [
                        "discussion",
                        "general",
                        "main",
                        "lobby"
                    ];

                    const ai =
                        preferred.findIndex(
                            x =>
                                aName.includes(
                                    x
                                )
                        );

                    const bi =
                        preferred.findIndex(
                            x =>
                                bName.includes(
                                    x
                                )
                        );

                    if (
                        ai !== -1 &&
                        bi === -1
                    ) {
                        return -1;
                    }

                    if (
                        ai === -1 &&
                        bi !== -1
                    ) {
                        return 1;
                    }

                    if (
                        ai !== -1 &&
                        bi !== -1
                    ) {
                        return ai - bi;
                    }

                    return aName.localeCompare(
                        bName
                    );
                }
            );

            renderChannelLists();

        } catch (error) {
            console.error(
                "Channel loading exception:",
                error
            );
        }
    }

    function getChannelCategory(
        channel
    ) {
        const category =
            String(
                channel.category ||
                channel.channel_category ||
                ""
            ).toLowerCase();

        const name =
            String(
                channel.name ||
                ""
            ).toLowerCase();

        if (
            category.includes(
                "course"
            ) ||
            channel.course_id ||
            name.includes(
                "course"
            )
        ) {
            return "course";
        }

        if (
            category.includes(
                "information"
            ) ||
            category.includes(
                "info"
            ) ||
            [
                "rules",
                "announcements",
                "welcome",
                "information"
            ].some(word =>
                name.includes(word)
            )
        ) {
            return "information";
        }

        return "discussion";
    }

    function renderChannelLists() {
        const containers = {
            information:
                $("informationChannels"),

            course:
                $("courseChannels"),

            discussion:
                $("communityChannels")
        };

        Object.values(
            containers
        ).forEach(container => {
            if (container) {
                container.innerHTML = "";
            }
        });

        state.channels.forEach(
            channel => {
                const category =
                    getChannelCategory(
                        channel
                    );

                const container =
                    containers[
                        category
                    ] ||
                    containers.discussion;

                if (!container) {
                    return;
                }

                const button =
                    document.createElement(
                        "button"
                    );

                button.type = "button";

                button.className =
                    "channel-button";

                button.dataset.channelId =
                    channel.id;

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

                const icon =
                    document.createElement(
                        "span"
                    );

                icon.className =
                    "channel-icon";

                icon.textContent =
                    channel.icon ||
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
                    icon
                );

                button.appendChild(
                    name
                );

                button.addEventListener(
                    "click",
                    () =>
                        selectChannel(
                            channel.id
                        )
                );

                container.appendChild(
                    button
                );
            }
        );

        updateChannelVisibility();
    }

    function updateChannelVisibility() {
        const containers = [
            $("informationChannels"),
            $("courseChannels"),
            $("communityChannels")
        ];

        containers.forEach(
            container => {
                if (!container) {
                    return;
                }

                const section =
                    container.closest(
                        ".channel-section"
                    );

                if (!section) {
                    return;
                }

                const hasItems =
                    container.children.length >
                    0;

                section.classList.toggle(
                    "empty",
                    !hasItems
                );
            }
        );
    }

    /* =========================================================
       SELECT CHANNEL
       ========================================================= */

    async function selectChannel(
        channelId
    ) {
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

        renderChannelLists();
        updateChannelHeader();

        await loadMessages(
            channel.id
        );

        subscribeToMessages(
            channel.id
        );

        await markChannelRead(
            channel.id
        );
    }

    function updateChannelHeader() {
        const channel =
            state.currentChannel;

        if (!channel) {
            return;
        }

        const icon =
            $("currentChannelIcon");

        if (icon) {
            icon.textContent =
                channel.icon ||
                "#";
        }

        const name =
            $("currentChannelName");

        if (name) {
            name.textContent =
                channel.name ||
                "discussion";
        }

        const description =
            $("currentChannelDescription");

        if (description) {
            description.textContent =
                channel.description ||
                channel.topic ||
                "Community discussion";
        }
    }

    /* =========================================================
       PROFILE MAP
       ========================================================= */

    async function loadProfilesForUsers(
        userIds
    ) {
        const ids = [
            ...new Set(
                userIds
                    .filter(Boolean)
                    .map(String)
            )
        ];

        const profiles = {};

        if (!ids.length) {
            return profiles;
        }

        /*
         * 1. chat_public_profiles.id
         */
        try {
            const result =
                await state.db
                    .from("chat_public_profiles")
                    .select("*")
                    .in(
                        "id",
                        ids
                    );

            if (!result.error) {
                (
                    result.data || []
                ).forEach(
                    profile => {
                        if (
                            profile.id
                        ) {
                            profiles[
                                String(
                                    profile.id
                                )
                            ] =
                                profile;
                        }
                    }
                );
            } else {
                console.warn(
                    "chat_public_profiles lookup:",
                    result.error.message
                );
            }

        } catch (error) {
            console.warn(
                "Public profile lookup exception:",
                error
            );
        }

        /*
         * 2. students.user_id
         */
        try {
            const result =
                await state.db
                    .from("students")
                    .select("*")
                    .in(
                        "user_id",
                        ids
                    );

            if (!result.error) {
                (
                    result.data || []
                ).forEach(
                    student => {
                        if (
                            student.user_id
                        ) {
                            const key =
                                String(
                                    student.user_id
                                );

                            profiles[key] = {
                                ...(profiles[key] ||
                                    {}),
                                ...student
                            };
                        }
                    }
                );
            }

        } catch (error) {
            console.warn(
                "Student profile lookup exception:",
                error
            );
        }

        /*
         * 3. Current user
         */
        if (state.user) {
            profiles[
                String(
                    state.user.id
                )
            ] = {
                ...(profiles[
                    String(
                        state.user.id
                    )
                ] || {}),
                ...(state.profile || {})
            };
        }

        return profiles;
    }

    /* =========================================================
       MESSAGES
       ========================================================= */

    async function loadMessages(
        channelId
    ) {
        if (state.loadingMessages) {
            return;
        }

        state.loadingMessages = true;

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
                    .from("chat_messages")
                    .select("*")
                    .eq(
                        "channel_id",
                        channelId
                    )
                    .order(
                        "created_at",
                        {
                            ascending: true
                        }
                    )
                    .limit(150);

            if (result.error) {
                console.error(
                    "Message loading error:",
                    result.error.message
                );

                state.messages = [];

                renderMessages();

                return;
            }

            state.messages =
                result.data || [];

            const ids =
                state.messages
                    .map(
                        getSenderId
                    )
                    .filter(Boolean);

            const profiles =
                await loadProfilesForUsers(
                    ids
                );

            state.messages =
                state.messages.map(
                    message => {
                        const senderId =
                            getSenderId(
                                message
                            );

                        return {
                            ...message,

                            _profile:
                                profiles[
                                    String(
                                        senderId
                                    )
                                ] ||
                                null
                        };
                    }
                );

            renderMessages();

        } catch (error) {
            console.error(
                "Message loading exception:",
                error
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

    function renderMessages() {
        const container =
            $("messageList");

        if (!container) {
            return;
        }

        container.innerHTML = "";

        if (!state.messages.length) {
            const empty =
                document.createElement(
                    "div"
                );

            empty.className =
                "empty-message-state";

            empty.innerHTML = `
                <div class="empty-message-icon">💬</div>
                <strong>No messages yet</strong>
                <span>Start the conversation.</span>
            `;

            container.appendChild(
                empty
            );

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

    function createAvatarHTML(
        profile,
        className,
        alt
    ) {
        const avatar =
            getProfileAvatar(
                profile
            );

        const initial =
            getProfileInitial(
                profile
            );

        if (avatar) {
            return `
                <div class="${className} has-image">
                    <img
                        src="${escapeHTML(avatar)}"
                        alt="${escapeHTML(alt || "Student")}"
                        loading="lazy"
                        onerror="this.parentElement.classList.remove('has-image');this.remove();this.parentElement.insertAdjacentHTML('afterbegin','<span>${escapeHTML(initial)}</span>');"
                    >
                </div>
            `;
        }

        return `
            <div class="${className}">
                <span>${escapeHTML(initial)}</span>
            </div>
        `;
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

        article.dataset.messageId =
            message.id || "";

        const senderId =
            getSenderId(message);

        const profile =
            message._profile ||
            {};

        const senderName =
            getProfileName(
                profile,
                senderId &&
                state.user &&
                String(senderId) ===
                    String(state.user.id)
                    ? "You"
                    : "Student"
            );

        const text =
            getMessageText(
                message
            );

        const type =
            getMessageType(
                message
            );

        const createdAt =
            message.created_at;

        const ownMessage =
            state.user &&
            senderId &&
            String(senderId) ===
                String(state.user.id);

        const avatar =
            createAvatarHTML(
                profile,
                "message-avatar",
                senderName
            );

        let bodyHTML = "";

        if (text) {
            bodyHTML += `
                <div class="message-text">
                    ${escapeHTML(text)
                        .replace(
                            /\n/g,
                            "<br>"
                        )}
                </div>
            `;
        }

        if (
            message.attachment_url
        ) {
            const attachmentUrl =
                message.attachment_url;

            const attachmentName =
                message.attachment_name ||
                "Attachment";

            const isImage =
                String(
                    message.message_type ||
                    type ||
                    ""
                ).toLowerCase() ===
                    "image" ||
                /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(
                    attachmentUrl
                );

            if (isImage) {
                bodyHTML += `
                    <div class="message-image-attachment">
                        <img
                            src="${escapeHTML(attachmentUrl)}"
                            alt="${escapeHTML(attachmentName)}"
                            loading="lazy"
                            class="message-attachment-image"
                            data-preview-url="${escapeHTML(attachmentUrl)}"
                        >
                    </div>
                `;
            } else {
                bodyHTML += `
                    <a
                        class="message-file-attachment"
                        href="${escapeHTML(attachmentUrl)}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <span class="attachment-file-icon">📎</span>
                        <span>
                            <strong>${escapeHTML(attachmentName)}</strong>
                            <small>Open attachment</small>
                        </span>
                    </a>
                `;
            }
        }

        if (
            message.voice_url
        ) {
            bodyHTML += `
                <audio
                    class="voice-message-player"
                    controls
                    preload="metadata"
                    src="${escapeHTML(message.voice_url)}"
                ></audio>
            `;
        }

        const actions = `
            <div class="message-actions">
                <button
                    type="button"
                    class="message-action reaction-message-button"
                    data-message-id="${escapeHTML(message.id)}"
                    title="React"
                >😊</button>

                ${
                    ownMessage
                        ? `
                            <button
                                type="button"
                                class="message-action delete-message-button"
                                data-message-id="${escapeHTML(message.id)}"
                                title="Delete message"
                            >🗑️</button>
                        `
                        : ""
                }
            </div>
        `;

        article.innerHTML = `
            ${avatar}

            <div class="message-content">
                <div class="message-meta">
                    <strong class="message-sender">
                        ${escapeHTML(senderName)}
                    </strong>

                    <time>
                        ${escapeHTML(
                            formatTime(
                                createdAt
                            )
                        )}
                    </time>
                </div>

                ${bodyHTML}

                ${actions}
            </div>
        `;

        article
            .querySelectorAll(
                ".delete-message-button"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () =>
                        deleteMessage(
                            button.dataset.messageId
                        )
                );
            });

        article
            .querySelectorAll(
                ".reaction-message-button"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () =>
                        addReaction(
                            button.dataset.messageId,
                            "❤️"
                        )
                );
            });

        article
            .querySelectorAll(
                ".message-attachment-image"
            )
            .forEach(image => {
                image.addEventListener(
                    "click",
                    () =>
                        openFilePreview(
                            image.dataset.previewUrl
                        )
                );
            });

        return article;
    }

    /* =========================================================
       SEND MESSAGE
       ========================================================= */

    async function sendMessage(
        suppliedText = null
    ) {
        if (
            !state.db ||
            !state.user ||
            !state.currentChannel ||
            state.sendingMessage
        ) {
            return;
        }

        const input =
            $("messageInput");

        const text =
            suppliedText !== null
                ? suppliedText.trim()
                : (
                    input?.value ||
                    ""
                ).trim();

        if (!text) {
            return;
        }

        state.sendingMessage =
            true;

        try {
            const payload = {
                channel_id:
                    state.currentChannel.id,

                user_id:
                    state.user.id,

                message:
                    text,

                content:
                    text,

                message_type:
                    "text"
            };

            const result =
                await state.db
                    .from("chat_messages")
                    .insert(payload)
                    .select()
                    .single();

            if (result.error) {
                /*
                 * Fallback for databases where
                 * content/message_type are different.
                 */
                const fallback =
                    await state.db
                        .from("chat_messages")
                        .insert({
                            channel_id:
                                state.currentChannel.id,

                            user_id:
                                state.user.id,

                            message:
                                text
                        })
                        .select()
                        .single();

                if (fallback.error) {
                    throw fallback.error;
                }
            }

            if (input) {
                input.value = "";
                autoResizeTextarea(
                    input
                );
            }

            closePickers();

        } catch (error) {
            console.error(
                "Send message failed:",
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
        messageId
    ) {
        if (
            !state.user ||
            !messageId
        ) {
            return;
        }

        try {
            let result =
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

            if (
                result.error
            ) {
                result =
                    await state.db
                        .from("chat_messages")
                        .delete()
                        .eq(
                            "id",
                            messageId
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
                    message =>
                        String(
                            message.id
                        ) !==
                        String(
                            messageId
                        )
                );

            renderMessages();

            notify(
                "Message deleted."
            );

        } catch (error) {
            console.error(
                "Delete message failed:",
                error
            );

            notify(
                "You could not delete this message.",
                "error"
            );
        }
    }

    /* =========================================================
       REALTIME MESSAGES
       ========================================================= */

    function unsubscribeMessageChannel() {
        if (
            state.messageSubscription &&
            state.db
        ) {
            try {
                state.db.removeChannel(
                    state.messageSubscription
                );
            } catch (error) {
                console.warn(
                    error
                );
            }

            state.messageSubscription =
                null;
        }
    }

    function subscribeToMessages(
        channelId
    ) {
        unsubscribeMessageChannel();

        if (!state.db) {
            return;
        }

        state.messageSubscription =
            state.db
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
                    async payload => {
                        if (
                            payload.eventType ===
                            "INSERT"
                        ) {
                            const message =
                                payload.new;

                            const profiles =
                                await loadProfilesForUsers(
                                    [
                                        getSenderId(
                                            message
                                        )
                                    ]
                                );

                            message._profile =
                                profiles[
                                    String(
                                        getSenderId(
                                            message
                                        )
                                    )
                                ] ||
                                null;

                            const exists =
                                state.messages.some(
                                    item =>
                                        String(
                                            item.id
                                        ) ===
                                        String(
                                            message.id
                                        )
                                );

                            if (!exists) {
                                state.messages.push(
                                    message
                                );

                                if (
                                    state.messages
                                        .length >
                                    150
                                ) {
                                    state.messages.shift();
                                }

                                renderMessages();
                            }
                        }

                        if (
                            payload.eventType ===
                            "DELETE"
                        ) {
                            state.messages =
                                state.messages.filter(
                                    message =>
                                        String(
                                            message.id
                                        ) !==
                                        String(
                                            payload.old.id
                                        )
                                );

                            renderMessages();
                        }

                        if (
                            payload.eventType ===
                            "UPDATE"
                        ) {
                            const index =
                                state.messages.findIndex(
                                    message =>
                                        String(
                                            message.id
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
                                ] = {
                                    ...state.messages[
                                        index
                                    ],
                                    ...payload.new
                                };

                                renderMessages();
                            }
                        }
                    }
                )
                .subscribe(
                    status => {
                        if (
                            status ===
                            "SUBSCRIBED"
                        ) {
                            console.log(
                                "Community message realtime: SUBSCRIBED"
                            );
                        }
                    }
                );
    }

    /* =========================================================
       COMMUNITY REALTIME
       ========================================================= */

    function unsubscribeCommunity() {
        if (
            state.communitySubscription &&
            state.db
        ) {
            try {
                state.db.removeChannel(
                    state.communitySubscription
                );
            } catch (error) {
                console.warn(
                    error
                );
            }

            state.communitySubscription =
                null;
        }
    }

    function subscribeToCommunity(
        communityId
    ) {
        unsubscribeCommunity();

        if (!state.db) {
            return;
        }

        state.communitySubscription =
            state.db
                .channel(
                    `community-${communityId}`
                )
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

                        if (
                            state.currentChannel
                        ) {
                            renderChannelLists();
                        }
                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_community_members",
                        filter:
                            `community_id=eq.${communityId}`
                    },
                    async () => {
                        await loadMembers(
                            communityId
                        );
                    }
                )
                .subscribe(
                    status => {
                        if (
                            status ===
                            "SUBSCRIBED"
                        ) {
                            console.log(
                                "Community channel realtime: SUBSCRIBED"
                            );
                        }
                    }
                );
    }

    /* =========================================================
       PRESENCE
       ========================================================= */

    async function loadPresence() {
        try {
            const result =
                await state.db
                    .from("chat_presence")
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
                result.data || []
            ).forEach(row => {
                if (row.user_id) {
                    state.presences[
                        String(
                            row.user_id
                        )
                    ] = row;
                }
            });

        } catch (error) {
            console.warn(
                "Presence loading failed:",
                error
            );
        }
    }

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

        return "offline";
    }

    async function updatePresence(
        status = "online"
    ) {
        if (!state.user) {
            return;
        }

        try {
            /*
             * UPDATE existing row.
             */
            let result =
                await state.db
                    .from("chat_presence")
                    .update({
                        status:
                            status,
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

                    activity:
                        "Community"
                };

                renderMembers();

                return;
            }

            /*
             * INSERT if it does not exist.
             */
            result =
                await state.db
                    .from("chat_presence")
                    .insert({
                        user_id:
                            state.user.id,

                        status:
                            status,

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

                    activity:
                        "Community"
                };

                renderMembers();

                return;
            }

            /*
             * Final minimal fallback.
             */
            result =
                await state.db
                    .from("chat_presence")
                    .insert({
                        user_id:
                            state.user.id,

                        status:
                            status
                    });

            if (
                result.error
            ) {
                console.warn(
                    "Presence update failed:",
                    result.error.message
                );
            }

        } catch (error) {
            console.warn(
                "Presence update skipped:",
                error
            );
        }
    }

    function setupActivityDetection() {
        const markActivity =
            () => {
                state.lastActivity =
                    Date.now();

                if (
                    state.user
                ) {
                    updatePresence(
                        "online"
                    );
                }

                clearTimeout(
                    state.idleTimer
                );

                state.idleTimer =
                    setTimeout(
                        () => {
                            updatePresence(
                                "idle"
                            );
                        },
                        2 * 60 * 1000
                    );
            };

        [
            "click",
            "keydown",
            "mousemove",
            "touchstart",
            "scroll"
        ].forEach(eventName => {
            document.addEventListener(
                eventName,
                markActivity,
                {
                    passive: true
                }
            );
        });

        markActivity();
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
                    const idleFor =
                        Date.now() -
                        state.lastActivity;

                    if (
                        idleFor >=
                        2 * 60 * 1000
                    ) {
                        updatePresence(
                            "idle"
                        );
                    } else {
                        updatePresence(
                            "online"
                        );
                    }
                },
                30000
            );

        setupActivityDetection();

        window.addEventListener(
            "beforeunload",
            () => {
                updatePresence(
                    "offline"
                );
            }
        );
    }

    function subscribeToPresence() {
        if (
            state.presenceSubscription &&
            state.db
        ) {
            try {
                state.db.removeChannel(
                    state.presenceSubscription
                );
            } catch (error) {
                console.warn(
                    error
                );
            }
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
                                row;

                            renderMembers();
                        }
                    }
                )
                .subscribe(
                    status => {
                        if (
                            status ===
                            "SUBSCRIBED"
                        ) {
                            console.log(
                                "Community presence realtime: SUBSCRIBED"
                            );
                        }
                    }
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
                    .from("chat_community_members")
                    .select("*")
                    .eq(
                        "community_id",
                        communityId
                    );

            if (
                result.error
            ) {
                console.error(
                    "Member query failed:",
                    result.error.message
                );
            } else {
                members =
                    result.data || [];
            }

        } catch (error) {
            console.error(
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
                    .map(String)
            )
        ];

        const profiles =
            await loadProfilesForUsers(
                ids
            );

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
         * Always show the logged-in user if their
         * membership row is missing.
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

    function getMemberStatus(
        member
    ) {
        const userId =
            getMemberUserId(
                member
            );

        const row =
            state.presences[
                String(userId)
            ];

        /*
         * Current user always follows our local state.
         */
        if (
            state.user &&
            String(userId) ===
                String(state.user.id)
        ) {
            const idleFor =
                Date.now() -
                state.lastActivity;

            if (
                idleFor >=
                2 * 60 * 1000
            ) {
                return "idle";
            }

            return "online";
        }

        return normalizePresence(
            row
        );
    }

    function renderMembers() {
        /*
         * IMPORTANT:
         * Do NOT wipe #memberSidebar.
         * It contains the header and search input.
         *
         * Render ONLY inside #memberList.
         */
        const container =
            $("memberList");

        if (!container) {
            return;
        }

        container.innerHTML = "";

        const search =
            $("memberSearchInput");

        const query =
            String(
                search?.value ||
                ""
            )
                .toLowerCase()
                .trim();

        const visibleMembers =
            state.members.filter(
                member => {
                    const profile =
                        member.profile ||
                        {};

                    const name =
                        getProfileName(
                            profile
                        );

                    return (
                        !query ||
                        name
                            .toLowerCase()
                            .includes(
                                query
                            )
                    );
                }
            );

        const groups = {
            online: [],
            idle: [],
            offline: []
        };

        visibleMembers.forEach(
            member => {
                const status =
                    getMemberStatus(
                        member
                    );

                groups[
                    status
                ].push(member);
            }
        );

        const order = [
            "online",
            "idle",
            "offline"
        ];

        order.forEach(
            status => {
                const members =
                    groups[status];

                if (!members.length) {
                    return;
                }

                const heading =
                    document.createElement(
                        "div"
                    );

                heading.className =
                    `member-group-title ${status}`;

                heading.innerHTML = `
                    <span class="member-group-dot"></span>
                    <span>
                        ${
                            status ===
                            "online"
                                ? "ONLINE"
                                : status ===
                                  "idle"
                                ? "IDLE"
                                : "OFFLINE"
                        }
                    </span>
                    <span class="member-group-count">
                        ${members.length}
                    </span>
                `;

                container.appendChild(
                    heading
                );

                members.forEach(
                    member => {
                        container.appendChild(
                            createMemberElement(
                                member,
                                status
                            )
                        );
                    }
                );
            }
        );

        updateMemberCount();
    }

    function updateMemberCount() {
        const count =
            $("memberCount");

        if (count) {
            count.textContent =
                state.members.length;
        }

        const onlineCount =
            state.members.filter(
                member =>
                    getMemberStatus(
                        member
                    ) ===
                    "online"
            ).length;

        document
            .querySelectorAll(
                "[data-online-count]"
            )
            .forEach(element => {
                element.textContent =
                    onlineCount;
            });

        const onlineElement =
            $("onlineCount");

        if (onlineElement) {
            onlineElement.textContent =
                onlineCount;
        }
    }

    function createMemberElement(
        member,
        status
    ) {
        const userId =
            getMemberUserId(
                member
            );

        const profile =
            member.profile ||
            {};

        const name =
            getProfileName(
                profile,
                "Student"
            );

        const role =
            member.role ||
            profile.role ||
            "Student";

        const avatar =
            getProfileAvatar(
                profile
            );

        const row =
            document.createElement(
                "div"
            );

        row.className =
            `member-row ${status}`;

        row.dataset.userId =
            userId || "";

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

            image.onerror =
                () => {
                    image.remove();

                    if (
                        !avatarWrapper.querySelector(
                            ".member-avatar-initial"
                        )
                    ) {
                        const initial =
                            document.createElement(
                                "span"
                            );

                        initial.className =
                            "member-avatar-initial";

                        initial.textContent =
                            getProfileInitial(
                                profile
                            );

                        avatarWrapper.appendChild(
                            initial
                        );
                    }
                };

            avatarWrapper.appendChild(
                image
            );
        } else {
            const initial =
                document.createElement(
                    "span"
                );

            initial.className =
                "member-avatar-initial";

            initial.textContent =
                getProfileInitial(
                    profile
                );

            avatarWrapper.appendChild(
                initial
            );
        }

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

        const info =
            document.createElement(
                "div"
            );

        info.className =
            "member-info";

        const nameElement =
            document.createElement(
                "strong"
            );

        nameElement.className =
            "member-name";

        nameElement.textContent =
            name;

        const activity =
            document.createElement(
                "span"
            );

        activity.className =
            "member-activity";

        activity.textContent =
            status === "online"
                ? "Online"
                : status === "idle"
                ? "Idle"
                : role;

        info.appendChild(
            nameElement
        );

        info.appendChild(
            activity
        );

        const actions =
            document.createElement(
                "div"
            );

        actions.className =
            "member-actions";

        const isSelf =
            state.user &&
            userId &&
            String(userId) ===
                String(
                    state.user.id
                );

        if (!isSelf) {
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
                        userId,
                        name
                    );
                }
            );

            actions.appendChild(
                messageButton
            );

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

    /* =========================================================
       DIRECT MESSAGE
       ========================================================= */

    async function openDirectMessage(
        userId,
        userName
    ) {
        if (
            !userId ||
            !state.user
        ) {
            return;
        }

        if (
            String(userId) ===
            String(state.user.id)
        ) {
            return;
        }

        try {
            /*
             * Find existing DM channel.
             */
            const result =
                await state.db
                    .from("chat_channels")
                    .select("*")
                    .eq(
                        "is_direct",
                        true
                    );

            if (result.error) {
                throw result.error;
            }

            let channel =
                (
                    result.data || []
                ).find(
                    item =>
                        String(
                            item.user_one_id ||
                            item.created_by ||
                            ""
                        ) ===
                        String(
                            state.user.id
                        ) &&
                        String(
                            item.user_two_id ||
                            ""
                        ) ===
                        String(userId)
                );

            /*
             * Also inspect membership table if needed.
             */
            if (!channel) {
                const memberships =
                    await state.db
                        .from(
                            "chat_channel_members"
                        )
                        .select(
                            "channel_id,user_id"
                        )
                        .in(
                            "user_id",
                            [
                                state.user.id,
                                userId
                            ]
                        );

                if (
                    !memberships.error
                ) {
                    const grouped = {};

                    (
                        memberships.data ||
                        []
                    ).forEach(row => {
                        const id =
                            row.channel_id;

                        if (!grouped[id]) {
                            grouped[id] =
                                [];
                        }

                        grouped[id].push(
                            String(
                                row.user_id
                            )
                        );
                    });

                    const match =
                        Object.entries(
                            grouped
                        ).find(
                            ([, ids]) =>
                                ids.includes(
                                    String(
                                        state.user.id
                                    )
                                ) &&
                                ids.includes(
                                    String(
                                        userId
                                    )
                                )
                        );

                    if (match) {
                        channel =
                            (
                                result.data ||
                                []
                            ).find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        match[0]
                                    )
                            );
                    }
                }
            }

            if (!channel) {
                notify(
                    "Direct messaging is not available for this member yet.",
                    "error"
                );

                return;
            }

            /*
             * Select the DM channel if it belongs to the
             * currently loaded channel list.
             */
            state.currentChannel =
                channel;

            updateChannelHeader();

            await loadMessages(
                channel.id
            );

            subscribeToMessages(
                channel.id
            );

            notify(
                `Direct message with ${userName}`
            );

        } catch (error) {
            console.error(
                "Direct message error:",
                error
            );

            notify(
                "Could not open direct messages.",
                "error"
            );
        }
    }

    /* =========================================================
       CALLS
       ========================================================= */

    async function callUser(
        userId
    ) {
        if (
            !userId ||
            String(userId) ===
                String(
                    state.user?.id
                )
        ) {
            return;
        }

        if (
            !window.MwanikiCalls ||
            typeof
                window.MwanikiCalls.callUser !==
                "function"
        ) {
            notify(
                "The call system is still loading.",
                "error"
            );

            return;
        }

        try {
            await window.MwanikiCalls.callUser(
                userId,
                state.currentCommunity?.id ||
                    null
            );
        } catch (error) {
            console.error(
                "Call error:",
                error
            );

            notify(
                "Could not start the call.",
                "error"
            );
        }
    }

    async function openCallPicker() {
        if (
            !window.MwanikiCalls ||
            typeof
                window.MwanikiCalls.openPicker !==
                "function"
        ) {
            notify(
                "The call system is still loading.",
                "error"
            );

            return;
        }

        try {
            await window.MwanikiCalls.openPicker(
                state.currentCommunity?.id ||
                    null
            );
        } catch (error) {
            console.error(
                "Call picker error:",
                error
            );
        }
    }

    async function startCommunityCall() {
        if (
            !window.MwanikiCalls ||
            typeof
                window.MwanikiCalls.callCommunity !==
                "function"
        ) {
            notify(
                "The call system is still loading.",
                "error"
            );

            return;
        }

        try {
            await window.MwanikiCalls.callCommunity(
                state.currentCommunity?.id
            );
        } catch (error) {
            console.error(
                "Community call error:",
                error
            );

            notify(
                "Could not start community call.",
                "error"
            );
        }
    }

    async function startGeneralCall() {
        await openCallPicker();
    }

    /* =========================================================
       ATTACHMENTS
       ========================================================= */

    async function uploadFile(
        file
    ) {
        if (
            !file ||
            !state.user ||
            !state.currentChannel
        ) {
            return;
        }

        const bucket =
            "chat-attachments";

        const safeName =
            file.name
                .replace(
                    /[^a-zA-Z0-9._-]/g,
                    "_"
                );

        const path =
            `${state.user.id}/${Date.now()}-${safeName}`;

        try {
            let result =
                await state.db.storage
                    .from(bucket)
                    .upload(
                        path,
                        file,
                        {
                            upsert: false
                        }
                    );

            let usedBucket =
                bucket;

            if (
                result.error
            ) {
                result =
                    await state.db.storage
                        .from(
                            "attachments"
                        )
                        .upload(
                            path,
                            file,
                            {
                                upsert: false
                            }
                        );

                usedBucket =
                    "attachments";
            }

            if (
                result.error
            ) {
                throw result.error;
            }

            const publicResult =
                state.db.storage
                    .from(
                        usedBucket
                    )
                    .getPublicUrl(
                        path
                    );

            const url =
                publicResult.data
                    ?.publicUrl;

            if (!url) {
                throw new Error(
                    "No public URL returned."
                );
            }

            const type =
                file.type.startsWith(
                    "image/"
                )
                    ? "image"
                    : file.type.startsWith(
                          "audio/"
                      )
                    ? "audio"
                    : "file";

            const insert =
                await state.db
                    .from("chat_messages")
                    .insert({
                        channel_id:
                            state.currentChannel.id,

                        user_id:
                            state.user.id,

                        message:
                            file.name,

                        content:
                            file.name,

                        message_type:
                            type,

                        attachment_url:
                            url,

                        attachment_name:
                            file.name
                    });

            if (
                insert.error
            ) {
                throw insert.error;
            }

            notify(
                "Attachment sent."
            );

        } catch (error) {
            console.error(
                "Attachment upload failed:",
                error
            );

            notify(
                "Could not upload the attachment.",
                "error"
            );
        }
    }

    function setupAttachments() {
        const button =
            $("attachButton");

        const input =
            $("attachmentInput");

        if (
            !button ||
            !input
        ) {
            return;
        }

        button.addEventListener(
            "click",
            () => input.click()
        );

        input.addEventListener(
            "change",
            async () => {
                const files =
                    Array.from(
                        input.files || []
                    );

                for (
                    const file of files
                ) {
                    await uploadFile(
                        file
                    );
                }

                input.value = "";
            }
        );
    }

    /* =========================================================
       VOICE NOTES
       ========================================================= */

    async function toggleVoiceRecording() {
        if (
            state.mediaRecorder &&
            state.mediaRecorder.state ===
                "recording"
        ) {
            stopVoiceRecording();

            return;
        }

        await startVoiceRecording();
    }

    async function startVoiceRecording() {
        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {
            notify(
                "Voice recording is not supported by this browser.",
                "error"
            );

            return;
        }

        try {
            state.recordingStream =
                await navigator.mediaDevices.getUserMedia(
                    {
                        audio: true
                    }
                );

            state.recordingChunks =
                [];

            let mimeType =
                "audio/webm";

            if (
                !MediaRecorder.isTypeSupported(
                    mimeType
                )
            ) {
                mimeType =
                    "";
            }

            state.mediaRecorder =
                new MediaRecorder(
                    state.recordingStream,
                    mimeType
                        ? {
                              mimeType
                          }
                        : undefined
                );

            state.mediaRecorder.ondataavailable =
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

            state.mediaRecorder.onstop =
                async () => {
                    const blob =
                        new Blob(
                            state.recordingChunks,
                            {
                                type:
                                    state.mediaRecorder
                                        ?.mimeType ||
                                    "audio/webm"
                            }
                        );

                    stopRecordingStream();

                    state.mediaRecorder =
                        null;

                    updateVoiceButton(
                        false
                    );

                    if (
                        blob.size
                    ) {
                        await uploadVoiceNote(
                            blob
                        );
                    }
                };

            state.mediaRecorder.start();

            updateVoiceButton(
                true
            );

            notify(
                "Recording voice note..."
            );

        } catch (error) {
            console.error(
                "Voice recording failed:",
                error
            );

            stopRecordingStream();

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
        } else {
            stopRecordingStream();

            updateVoiceButton(
                false
            );
        }
    }

    function stopRecordingStream() {
        if (
            state.recordingStream
        ) {
            state.recordingStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

            state.recordingStream =
                null;
        }
    }

    function updateVoiceButton(
        recording
    ) {
        const button =
            $("voiceNoteButton");

        if (!button) {
            return;
        }

        button.classList.toggle(
            "recording",
            recording
        );

        button.setAttribute(
            "aria-pressed",
            recording
                ? "true"
                : "false"
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

    async function uploadVoiceNote(
        blob
    ) {
        if (
            !state.user ||
            !state.currentChannel
        ) {
            return;
        }

        try {
            const path =
                `${state.user.id}/voice-${Date.now()}.webm`;

            let bucket =
                "chat-attachments";

            let result =
                await state.db.storage
                    .from(bucket)
                    .upload(
                        path,
                        blob,
                        {
                            contentType:
                                "audio/webm"
                        }
                    );

            if (
                result.error
            ) {
                bucket =
                    "attachments";

                result =
                    await state.db.storage
                        .from(bucket)
                        .upload(
                            path,
                            blob,
                            {
                                contentType:
                                    "audio/webm"
                            }
                        );
            }

            if (
                result.error
            ) {
                throw result.error;
            }

            const publicUrl =
                state.db.storage
                    .from(bucket)
                    .getPublicUrl(
                        path
                    )
                    .data
                    ?.publicUrl;

            if (!publicUrl) {
                throw new Error(
                    "Voice URL unavailable."
                );
            }

            const insert =
                await state.db
                    .from("chat_messages")
                    .insert({
                        channel_id:
                            state.currentChannel.id,

                        user_id:
                            state.user.id,

                        message:
                            "Voice note",

                        content:
                            "Voice note",

                        message_type:
                            "audio",

                        attachment_url:
                            publicUrl,

                        attachment_name:
                            "Voice note.webm"
                    });

            if (
                insert.error
            ) {
                throw insert.error;
            }

            notify(
                "Voice note sent."
            );

        } catch (error) {
            console.error(
                "Voice note upload failed:",
                error
            );

            notify(
                "Could not send the voice note.",
                "error"
            );
        }
    }

    /* =========================================================
       EMOJI PICKER
       ========================================================= */

    const emojiList = [
        "😀",
        "😃",
        "😄",
        "😁",
        "😆",
        "😅",
        "😂",
        "🤣",
        "😊",
        "😇",
        "🙂",
        "🙃",
        "😉",
        "😌",
        "😍",
        "🥰",
        "😘",
        "😎",
        "🤔",
        "😐",
        "😑",
        "🙄",
        "😮",
        "😴",
        "😭",
        "😢",
        "😡",
        "🤯",
        "❤️",
        "🩷",
        "🧡",
        "💛",
        "💚",
        "💙",
        "💜",
        "🤍",
        "🖤",
        "👍",
        "👎",
        "👏",
        "🙌",
        "🙏",
        "💪",
        "🔥",
        "✨",
        "🎉",
        "🎓",
        "🩺",
        "🧪",
        "📚",
        "💯"
    ];

    function setupEmojiPicker() {
        const button =
            $("emojiButton");

        const panel =
            $("emojiPanel");

        const close =
            $("closeEmojiButton");

        const grid =
            $("emojiGrid");

        if (
            !button ||
            !panel ||
            !grid
        ) {
            return;
        }

        renderEmojiGrid(
            emojiList
        );

        button.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                closeOtherPickers(
                    panel
                );

                panel.classList.toggle(
                    "hidden"
                );
            }
        );

        close?.addEventListener(
            "click",
            () =>
                panel.classList.add(
                    "hidden"
                )
        );

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
                    panel.classList.add(
                        "hidden"
                    );
                }
            }
        );

        const search =
            $("emojiSearch");

        search?.addEventListener(
            "input",
            () => {
                const query =
                    search.value
                        .toLowerCase()
                        .trim();

                renderEmojiGrid(
                    query
                        ? emojiList.filter(
                              emoji =>
                                  emoji.includes(
                                      query
                                  )
                          )
                        : emojiList
                );
            }
        );
    }

    function renderEmojiGrid(
        emojis
    ) {
        const grid =
            $("emojiGrid");

        if (!grid) {
            return;
        }

        grid.innerHTML = "";

        emojis.forEach(
            emoji => {
                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "emoji-item";

                button.textContent =
                    emoji;

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

        input.setSelectionRange(
            position,
            position
        );

        autoResizeTextarea(
            input
        );
    }

    /* =========================================================
       STICKERS / GIFS
       ========================================================= */

    function setupStickerPicker() {
        const button =
            $("stickerButton");

        const panel =
            $("stickerPanel");

        const close =
            $("closeStickerButton");

        const grid =
            $("stickerGrid");

        if (
            !button ||
            !panel ||
            !grid
        ) {
            return;
        }

        const stickers = [
            "🎉",
            "🔥",
            "😂",
            "❤️",
            "👏",
            "🙏",
            "💯",
            "🎓",
            "🩺",
            "📚"
        ];

        grid.innerHTML = "";

        stickers.forEach(
            sticker => {
                const item =
                    document.createElement(
                        "button"
                    );

                item.type =
                    "button";

                item.className =
                    "sticker-item";

                item.textContent =
                    sticker;

                item.addEventListener(
                    "click",
                    () => {
                        insertEmoji(
                            sticker
                        );

                        panel.classList.add(
                            "hidden"
                        );
                    }
                );

                grid.appendChild(
                    item
                );
            }
        );

        button.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                closeOtherPickers(
                    panel
                );

                panel.classList.toggle(
                    "hidden"
                );
            }
        );

        close?.addEventListener(
            "click",
            () =>
                panel.classList.add(
                    "hidden"
                )
        );
    }

    function setupGifPicker() {
        const button =
            $("gifButton");

        const panel =
            $("gifPanel");

        const close =
            $("closeGifButton");

        const grid =
            $("gifGrid");

        if (
            !button ||
            !panel ||
            !grid
        ) {
            return;
        }

        grid.innerHTML = `
            <div class="gif-placeholder">
                <strong>GIFs</strong>
                <span>GIF search can be connected to your preferred GIF provider.</span>
            </div>
        `;

        button.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                closeOtherPickers(
                    panel
                );

                panel.classList.toggle(
                    "hidden"
                );
            }
        );

        close?.addEventListener(
            "click",
            () =>
                panel.classList.add(
                    "hidden"
                )
        );
    }

    function closeOtherPickers(
        activePanel
    ) {
        [
            $("emojiPanel"),
            $("stickerPanel"),
            $("gifPanel")
        ].forEach(panel => {
            if (
                panel &&
                panel !==
                    activePanel
            ) {
                panel.classList.add(
                    "hidden"
                );
            }
        });
    }

    function closePickers() {
        [
            $("emojiPanel"),
            $("stickerPanel"),
            $("gifPanel")
        ].forEach(panel => {
            panel?.classList.add(
                "hidden"
            );
        });
    }

    /* =========================================================
       REACTIONS
       ========================================================= */

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
            const result =
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

            if (
                result.error
            ) {
                console.warn(
                    "Reaction failed:",
                    result.error.message
                );
            }

        } catch (error) {
            console.warn(
                "Reaction error:",
                error
            );
        }
    }

    /* =========================================================
       READ STATUS
       ========================================================= */

    async function markChannelRead(
        channelId
    ) {
        if (
            !state.user ||
            !channelId
        ) {
            return;
        }

        try {
            const result =
                await state.db
                    .from(
                        "chat_read_status"
                    )
                    .upsert(
                        {
                            channel_id:
                                channelId,

                            user_id:
                                state.user.id,

                            last_read_at:
                                new Date().toISOString()
                        },
                        {
                            onConflict:
                                "channel_id,user_id"
                        }
                    );

            if (
                result.error
            ) {
                console.warn(
                    "Read status update:",
                    result.error.message
                );
            }

        } catch (error) {
            console.warn(
                "Read status exception:",
                error
            );
        }
    }

    /* =========================================================
       SEARCH
       ========================================================= */

    function setupSearch() {
        const channelSearch =
            $("channelSearchInput");

        channelSearch?.addEventListener(
            "input",
            () => {
                filterChannels(
                    channelSearch.value
                );
            }
        );

        const memberSearch =
            $("memberSearchInput");

        memberSearch?.addEventListener(
            "input",
            () => {
                renderMembers();
            }
        );

        const messageSearchButton =
            $("channelSearchButton");

        const messageSearchBar =
            $("messageSearchBar");

        const messageSearchInput =
            $("messageSearchInput");

        const closeMessageSearch =
            $("closeMessageSearchButton");

        messageSearchButton?.addEventListener(
            "click",
            () => {
                messageSearchBar?.classList.remove(
                    "hidden"
                );

                messageSearchInput?.focus();
            }
        );

        closeMessageSearch?.addEventListener(
            "click",
            () => {
                messageSearchBar?.classList.add(
                    "hidden"
                );

                if (
                    messageSearchInput
                ) {
                    messageSearchInput.value =
                        "";

                    filterMessages(
                        ""
                    );
                }
            }
        );

        messageSearchInput?.addEventListener(
            "input",
            () => {
                filterMessages(
                    messageSearchInput.value
                );
            }
        );
    }

    function filterChannels(
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
                ".channel-button[data-channel-id]"
            )
            .forEach(button => {
                const name =
                    button
                        .querySelector(
                            ".channel-name"
                        )
                        ?.textContent
                        ?.toLowerCase() ||
                    "";

                button.style.display =
                    !value ||
                    name.includes(
                        value
                    )
                        ? ""
                        : "none";
            });
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
                ".community-message"
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
       COMPOSER
       ========================================================= */

    function autoResizeTextarea(
        textarea
    ) {
        if (!textarea) {
            return;
        }

        textarea.style.height =
            "auto";

        textarea.style.height =
            Math.min(
                textarea.scrollHeight,
                160
            ) + "px";
    }

    function setupComposer() {
        const input =
            $("messageInput");

        const send =
            $("sendMessageButton");

        input?.addEventListener(
            "input",
            () =>
                autoResizeTextarea(
                    input
                )
        );

        input?.addEventListener(
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

        send?.addEventListener(
            "click",
            () =>
                sendMessage()
        );
    }

    /* =========================================================
       VOICE BUTTON
       ========================================================= */

    function setupVoiceButton() {
        const button =
            $("voiceNoteButton");

        button?.addEventListener(
            "click",
            () =>
                toggleVoiceRecording()
        );
    }

    /* =========================================================
       HEADER / SIDEBARS / MODALS
       ========================================================= */

    function setupUIButtons() {
        $("generalCallButton")
            ?.addEventListener(
                "click",
                startGeneralCall
            );

        $("communityCallButton")
            ?.addEventListener(
                "click",
                startCommunityCall
            );

        $("closeMemberSidebarButton")
            ?.addEventListener(
                "click",
                () => {
                    $("memberSidebar")
                        ?.classList.remove(
                            "open"
                        );
                }
            );

        $("channelMembersButton")
            ?.addEventListener(
                "click",
                () => {
                    $("memberSidebar")
                        ?.classList.add(
                            "open"
                        );
                }
            );

        $("mobileSidebarButton")
            ?.addEventListener(
                "click",
                () => {
                    $("channelSidebar")
                        ?.classList.toggle(
                            "open"
                        );

                    $("communityRail")
                        ?.classList.toggle(
                            "open"
                        );
                }
            );

        $("communityHomeButton")
            ?.addEventListener(
                "click",
                () => {
                    const main =
                        state.communities.find(
                            community =>
                                String(
                                    community.name ||
                                    ""
                                )
                                    .toLowerCase()
                                    .includes(
                                        "mwaniki"
                                    )
                        );

                    if (main) {
                        selectCommunity(
                            main.id
                        );
                    }
                }
            );

        $("profileButton")
            ?.addEventListener(
                "click",
                () => {
                    $("profileModal")
                        ?.classList.remove(
                            "hidden"
                        );
                }
            );

        $("communityRulesButton")
            ?.addEventListener(
                "click",
                () => {
                    $("rulesModal")
                        ?.classList.remove(
                            "hidden"
                        );
                }
            );

        $("contestChannelButton")
            ?.addEventListener(
                "click",
                () => {
                    $("contestModal")
                        ?.classList.remove(
                            "hidden"
                        );
                }
            );

        $("friendsButton")
            ?.addEventListener(
                "click",
                () => {
                    $("friendsModal")
                        ?.classList.remove(
                            "hidden"
                        );
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
                        }
                    }
                );
            });
    }

    function openFilePreview(
        url
    ) {
        const modal =
            $("filePreviewModal");

        if (!modal || !url) {
            return;
        }

        const image =
            modal.querySelector(
                "img"
            );

        if (image) {
            image.src =
                url;
        }

        modal.classList.remove(
            "hidden"
        );
    }

    /* =========================================================
       INITIAL COMMUNITY SELECTION
       ========================================================= */

    function findMainCommunity() {
        return (
            state.communities.find(
                community =>
                    String(
                        community.name ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            "mwaniki scholars"
                        )
            ) ||
            state.communities.find(
                community =>
                    String(
                        community.slug ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            "mwaniki"
                        )
            ) ||
            state.communities.find(
                community =>
                    String(
                        community.name ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            "mwaniki"
                        )
            ) ||
            state.communities[0]
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

        console.log(
            "Community starting"
        );

        const ready =
            await waitForSupabase();

        if (!ready) {
            return;
        }

        const authenticated =
            await loadAuthenticatedUser();

        if (!authenticated) {
            return;
        }

        await loadProfile();

        setupUIButtons();
        setupComposer();
        setupAttachments();
        setupVoiceButton();
        setupEmojiPicker();
        setupStickerPicker();
        setupGifPicker();
        setupSearch();

        startPresence();

        await loadCommunities();

        const main =
            findMainCommunity();

        if (main) {
            await selectCommunity(
                main.id
            );
        }

        console.log(
            "✅ Mwaniki Scholars Community loaded"
        );
    }

    /* =========================================================
       PUBLIC API
       ========================================================= */

    window.MwanikiCommunity = {
        initialize,

        getState:
            () => state,

        selectCommunity,

        selectChannel,

        sendMessage,

        deleteMessage,

        callUser,

        startCommunityCall,

        startGeneralCall,

        openCallPicker,

        loadMembers,

        loadPresence,

        updatePresence
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
```
