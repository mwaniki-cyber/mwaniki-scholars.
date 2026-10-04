/* ============================================================
   MWANIKI SCHOLARS COMMUNITY
   CONSOLIDATED COMMUNITY + CALL ENGINE
   ============================================================

   REQUIRED:
   - ./supabase.js
   - ./community.js

   DO NOT LOAD:
   - community-calls.js

   FEATURES:
   - Communities
   - Channels
   - Course channels
   - Messages
   - Attachments
   - Voice notes
   - Emoji / stickers / GIF panels
   - Reactions
   - Message deletion
   - Presence
   - Members
   - Search
   - General calls
   - Direct calls
   - Community calls
   - Incoming call UI
   - WebRTC audio/video
   - Screen sharing
   - One consolidated call engine
   ============================================================ */

(() => {
    "use strict";

    /* ============================================================
       SUPABASE
       ============================================================ */

    const db =
        window.supabase ||
        window.supabaseClient ||
        window.sb ||
        window.mwanikiSupabase;

    if (!db) {
        console.error(
            "❌ Supabase client was not found."
        );
        return;
    }

    console.log(
        "🚀 Mwaniki Scholars Community starting..."
    );

    console.log(
        "✅ Supabase client ready"
    );


    /* ============================================================
       CONSTANTS
       ============================================================ */

    const CALL_PAGE =
        "./community-calls.html";

    const CALL_RING_TIMEOUT =
        45000;

    const PRESENCE_TIMEOUT =
        5 * 60 * 1000;

    const ROOM_PREFIX =
        "call-room-";

    const INCOMING_PREFIX =
        "incoming-call-";

    const MESSAGE_PAGE_SIZE =
        80;

    const MAX_ATTACHMENT_SIZE =
        25 * 1024 * 1024;

    const VOICE_MIME_TYPES = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4"
    ];

    const EMOJIS = [
        "😀",
        "😂",
        "🤣",
        "😊",
        "😍",
        "🥰",
        "😘",
        "😎",
        "🤔",
        "😢",
        "😭",
        "😡",
        "😮",
        "😱",
        "🙌",
        "👏",
        "👍",
        "👎",
        "❤️",
        "🔥",
        "🎉",
        "💯",
        "🙏",
        "💡",
        "📚",
        "🧪",
        "🩺",
        "🧬",
        "🦠",
        "💊",
        "🎓"
    ];


    /* ============================================================
       STATE
       ============================================================ */

    const state = {
        user: null,

        profile: null,

        courses: [],

        communities: [],

        channels: [],

        members: [],

        messages: [],

        currentCommunity: null,

        currentChannel: null,

        messageSearch: "",

        memberSearch: "",

        channelSearch: "",

        pendingAttachment: null,

        initialized: false,

        realtimeChannels: [],

        communityChannel: null,

        messageChannel: null,

        presenceChannel: null,

        presenceTimer: null,

        recording: false,

        recorder: null,

        voiceChunks: [],

        incomingChannel: null,

        incomingCallVisible: false,

        incomingCall: null,

        call: {
            currentRoom: null,

            currentInvite: null,

            role: null,

            mode: "audio",

            communityId: null,

            localStream: null,

            screenStream: null,

            peerConnections:
                new Map(),

            remoteStreams:
                new Map(),

            pendingIce:
                new Map(),

            roomChannel: null,

            microphoneEnabled: true,

            cameraEnabled: false,

            screenSharing: false,

            started: false,

            ending: false
        }
    };


    /* ============================================================
       BASIC HELPERS
       ============================================================ */

    function $(id) {
        return document.getElementById(id);
    }


    function safeArray(value) {
        return Array.isArray(value)
            ? value
            : [];
    }


    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function initialsForName(name) {
        const text =
            String(name || "Mwaniki Scholar")
                .trim();

        if (!text) {
            return "MS";
        }

        const parts =
            text
                .split(/\s+/)
                .filter(Boolean);

        if (parts.length === 1) {
            return parts[0]
                .substring(0, 2)
                .toUpperCase();
        }

        return (
            parts[0][0] +
            parts[parts.length - 1][0]
        ).toUpperCase();
    }


    function randomId(length = 10) {
        return Math.random()
            .toString(36)
            .substring(2, 2 + length);
    }


    function generateRoomCode() {
        return (
            "MW-" +
            Date.now()
                .toString(36)
                .toUpperCase() +
            "-" +
            randomId(8).toUpperCase()
        );
    }


    function displayName(profile) {
        if (!profile) {
            return "Mwaniki Scholar";
        }

        return (
            profile.display_name ||
            profile.full_name ||
            profile.username ||
            profile.name ||
            profile.email ||
            "Mwaniki Scholar"
        );
    }


    function avatarURL(profile) {
        if (!profile) {
            return "";
        }

        return (
            profile.avatar_url ||
            profile.photo_url ||
            profile.profile_photo ||
            profile.image_url ||
            profile.avatar ||
            ""
        );
    }


    function formatTime(value) {
        if (!value) {
            return "";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
        }

        return date.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }


    function showToast(
        message,
        type = "info"
    ) {
        let toast =
            $("mwanikiToast");

        if (!toast) {
            toast =
                document.createElement(
                    "div"
                );

            toast.id =
                "mwanikiToast";

            toast.className =
                "mwaniki-toast";

            document.body.appendChild(
                toast
            );
        }

        toast.textContent =
            message;

        toast.dataset.type =
            type;

        toast.classList.add(
            "show"
        );

        clearTimeout(
            toast._timer
        );

        toast._timer =
            setTimeout(() => {
                toast.classList.remove(
                    "show"
                );
            }, 3500);
    }


    function openElement(element) {
        if (!element) {
            return;
        }

        element.hidden = false;

        element.classList.add(
            "open",
            "active"
        );
    }


    function closeElement(element) {
        if (!element) {
            return;
        }

        element.classList.remove(
            "open",
            "active"
        );

        element.hidden = true;
    }


    /* ============================================================
       AUTHENTICATION
       ============================================================ */

    async function requireAuthentication() {
        try {
            const {
                data,
                error
            } = await db.auth.getSession();

            if (error) {
                console.error(
                    "❌ Session error:",
                    error
                );

                return false;
            }

            if (!data?.session?.user) {
                showToast(
                    "You must be signed in.",
                    "error"
                );

                return false;
            }

            state.user =
                data.session.user;

            console.log(
                "✅ Authenticated:",
                state.user.id
            );

            await loadCurrentProfile();

            return true;

        } catch (error) {
            console.error(
                "❌ Authentication failed:",
                error
            );

            return false;
        }
    }


    async function loadCurrentProfile() {
        if (!state.user?.id) {
            return null;
        }

        try {
            let profile = null;

            const result =
                await db
                    .from(
                        "chat_public_profiles"
                    )
                    .select("*")
                    .eq(
                        "id",
                        state.user.id
                    )
                    .maybeSingle();

            if (!result.error) {
                profile =
                    result.data;
            }

            if (!profile) {
                const studentResult =
                    await db
                        .from("students")
                        .select("*")
                        .eq(
                            "id",
                            state.user.id
                        )
                        .maybeSingle();

                if (
                    !studentResult.error
                ) {
                    profile =
                        studentResult.data;
                }
            }

            state.profile =
                profile || {
                    id:
                        state.user.id,

                    full_name:
                        state.user.user_metadata
                            ?.full_name ||
                        state.user.user_metadata
                            ?.name ||
                        state.user.email
                };

            updateProfileUI();

            return state.profile;

        } catch (error) {
            console.warn(
                "Profile loading:",
                error
            );

            state.profile = {
                id:
                    state.user.id,

                full_name:
                    state.user.user_metadata
                        ?.full_name ||
                    state.user.email
            };

            return state.profile;
        }
    }


    function updateProfileUI() {
        const name =
            displayName(
                state.profile
            );

        const avatar =
            avatarURL(
                state.profile
            );

        const avatarElements = [
            $("headerProfileAvatar"),
            $("profileLargeAvatar")
        ];

        avatarElements.forEach(
            element => {
                if (!element) {
                    return;
                }

                if (avatar) {
                    if (
                        element.tagName
                            .toLowerCase() ===
                        "img"
                    ) {
                        element.src =
                            avatar;

                        element.alt =
                            name;
                    } else {
                        element.innerHTML =
                            `<img src="${escapeHTML(
                                avatar
                            )}" alt="${escapeHTML(
                                name
                            )}">`;
                    }
                } else {
                    element.textContent =
                        initialsForName(
                            name
                        );
                }
            }
        );
    }


    /* ============================================================
       COURSES
       ============================================================ */

    async function loadCourses() {
        try {
            const {
                data,
                error
            } = await db
                .from("courses")
                .select("*")
                .order(
                    "id",
                    {
                        ascending: true
                    }
                );

            if (error) {
                console.warn(
                    "Course loading:",
                    error
                );

                state.courses = [];

                return [];
            }

            state.courses =
                safeArray(data);

            return state.courses;

        } catch (error) {
            console.warn(
                "loadCourses:",
                error
            );

            return [];
        }
    }


    /* ============================================================
       COMMUNITIES
       ============================================================ */

    async function loadCommunities() {
        try {
            const {
                data,
                error
            } = await db
                .from(
                    "chat_communities"
                )
                .select("*")
                .eq(
                    "is_active",
                    true
                )
                .order(
                    "name",
                    {
                        ascending: true
                    }
                );

            if (error) {
                console.error(
                    "❌ Communities loading:",
                    error
                );

                return [];
            }

            state.communities =
                safeArray(data);

            console.log(
                "🏠 Communities loaded:",
                state.communities.length
            );

            renderCommunityRail();

            return state.communities;

        } catch (error) {
            console.error(
                "loadCommunities:",
                error
            );

            return [];
        }
    }


    function findMainCommunity() {
        return (
            state.communities.find(
                community =>
                    String(
                        community.name ||
                        ""
                    )
                        .toLowerCase()
                        .trim() ===
                    "mwaniki scholars"
            ) ||
            state.communities.find(
                community =>
                    String(
                        community.slug ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            "mwaniki-scholars"
                        )
            ) ||
            state.communities[0] ||
            null
        );
    }


    function renderCommunityRail() {
        const rail =
            $("communityRail");

        if (!rail) {
            return;
        }

        rail.innerHTML =
            state.communities
                .map(
                    community => {
                        const active =
                            state.currentCommunity
                                ?.id ===
                            community.id;

                        const name =
                            community.name ||
                            "Community";

                        const icon =
                            community.icon_url;

                        return `
                            <button
                                type="button"
                                class="community-rail-item ${
                                    active
                                        ? "active"
                                        : ""
                                }"
                                data-community-id="${escapeHTML(
                                    community.id
                                )}"
                                title="${escapeHTML(
                                    name
                                )}"
                            >
                                ${
                                    icon
                                        ? `
                                            <img
                                                src="${escapeHTML(
                                                    icon
                                                )}"
                                                alt=""
                                            >
                                        `
                                        : `
                                            <span>
                                                ${escapeHTML(
                                                    initialsForName(
                                                        name
                                                    )
                                                )}
                                            </span>
                                        `
                                }
                            </button>
                        `;
                    }
                )
                .join("");

        rail
            .querySelectorAll(
                "[data-community-id]"
            )
            .forEach(
                button => {
                    button.onclick =
                        () =>
                            selectCommunity(
                                button.dataset
                                    .communityId
                            );
                }
            );
    }


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

        await cleanupCommunityRealtime();

        state.currentCommunity =
            community;

        console.log(
            "✅ Community selected:",
            community.name
        );

        renderCommunityRail();

        await loadChannels(
            community.id
        );

        await loadMembers(
            community.id
        );

        await subscribeCommunityRealtime(
            community.id
        );

        const preferred =
            findPreferredChannel();

        if (preferred) {
            await selectChannel(
                preferred.id
            );
        }

        updateCallButtons();
    }


    /* ============================================================
       CHANNELS
       ============================================================ */

    async function loadChannels(
        communityId
    ) {
        if (!communityId) {
            return [];
        }

        try {
            const {
                data,
                error
            } = await db
                .from(
                    "chat_channels"
                )
                .select("*")
                .eq(
                    "community_id",
                    communityId
                )
                .order(
                    "position",
                    {
                        ascending: true,
                        nullsFirst: false
                    }
                )
                .order(
                    "name",
                    {
                        ascending: true
                    }
                );

            if (error) {
                console.error(
                    "❌ Channels loading:",
                    error
                );

                state.channels = [];

                return [];
            }

            state.channels =
                safeArray(data);

            renderChannels();

            return state.channels;

        } catch (error) {
            console.error(
                "loadChannels:",
                error
            );

            return [];
        }
    }


    function channelName(channel) {
        return (
            channel?.name ||
            channel?.title ||
            "Discussion"
        );
    }


    function channelType(channel) {
        return String(
            channel?.channel_type ||
            channel?.type ||
            ""
        ).toLowerCase();
    }


    function isGamingChannel(channel) {
        const text =
            (
                channelName(channel) +
                " " +
                channelType(channel)
            )
                .toLowerCase();

        return (
            text.includes("gaming") ||
            text.includes("game")
        );
    }


    function isMemeChannel(channel) {
        const text =
            (
                channelName(channel) +
                " " +
                channelType(channel)
            )
                .toLowerCase();

        return (
            text.includes("meme")
        );
    }


    function isInfoChannel(channel) {
        const text =
            (
                channelName(channel) +
                " " +
                channelType(channel)
            )
                .toLowerCase();

        return (
            text.includes("info") ||
            text.includes("welcome") ||
            text.includes("announcement") ||
            text.includes("rules")
        );
    }


    function findPreferredChannel() {
        const channels =
            state.channels;

        if (!channels.length) {
            return null;
        }

        /*
         * IMPORTANT:
         * Never automatically open Gaming or Memes.
         */

        const nonGaming =
            channels.filter(
                channel =>
                    !isGamingChannel(
                        channel
                    ) &&
                    !isMemeChannel(
                        channel
                    )
            );

        const discussion =
            nonGaming.find(
                channel => {
                    const text =
                        channelName(
                            channel
                        )
                            .toLowerCase();

                    return (
                        text.includes(
                            "discussion"
                        ) ||
                        text.includes(
                            "general"
                        ) ||
                        text.includes(
                            "chat"
                        )
                    );
                }
            );

        return (
            discussion ||
            nonGaming.find(
                channel =>
                    !isInfoChannel(
                        channel
                    )
            ) ||
            nonGaming[0] ||
            channels[0]
        );
    }


    function renderChannels() {
        const list =
            $("channelList");

        if (!list) {
            return;
        }

        const groups = {};

        state.channels.forEach(
            channel => {
                const category =
                    channel.category ||
                    channel.category_name ||
                    "Channels";

                if (!groups[category]) {
                    groups[category] = [];
                }

                groups[category].push(
                    channel
                );
            }
        );

        list.innerHTML =
            Object.entries(groups)
                .map(
                    ([category, channels]) =>
                        `
                            <section class="channel-group">
                                <h4>
                                    ${escapeHTML(
                                        category
                                    )}
                                </h4>

                                ${channels
                                    .map(
                                        channel => {
                                            const active =
                                                state.currentChannel
                                                    ?.id ===
                                                channel.id;

                                            return `
                                                <button
                                                    type="button"
                                                    class="channel-item ${
                                                        active
                                                            ? "active"
                                                            : ""
                                                    }"
                                                    data-channel-id="${escapeHTML(
                                                        channel.id
                                                    )}"
                                                >
                                                    <span class="channel-icon">
                                                        ${
                                                            channelType(
                                                                channel
                                                            ).includes(
                                                                "voice"
                                                            )
                                                                ? "🔊"
                                                                : "#"
                                                        }
                                                    </span>

                                                    <span>
                                                        ${escapeHTML(
                                                            channelName(
                                                                channel
                                                            )
                                                        )}
                                                    </span>
                                                </button>
                                            `;
                                        }
                                    )
                                    .join("")}
                            </section>
                        `
                )
                .join("");

        list
            .querySelectorAll(
                "[data-channel-id]"
            )
            .forEach(
                button => {
                    button.onclick =
                        () =>
                            selectChannel(
                                button.dataset
                                    .channelId
                            );
                }
            );

        filterChannels();
    }


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

        renderChannels();

        const title =
            $("channelTitle");

        if (title) {
            title.textContent =
                channelName(
                    channel
                );
        }

        const description =
            $("channelDescription");

        if (description) {
            description.textContent =
                channel.description ||
                "";
        }

        await loadMessages(
            channel.id
        );

        await subscribeMessageRealtime(
            channel.id
        );

        await markChannelRead(
            channel.id
        );
    }


    /* ============================================================
       MEMBERS
       ============================================================ */

    async function loadMembers(
        communityId
    ) {
        if (!communityId) {
            return [];
        }

        try {
            const {
                data: memberships,
                error
            } = await db
                .from(
                    "chat_community_members"
                )
                .select("*")
                .eq(
                    "community_id",
                    communityId
                );

            if (error) {
                console.error(
                    "❌ Membership loading:",
                    error
                );

                state.members = [];

                renderMembers();

                return [];
            }

            console.log(
                "👥 Membership rows:",
                memberships?.length || 0
            );

            const ids =
                safeArray(
                    memberships
                )
                    .map(
                        row =>
                            row.user_id ||
                            row.profile_id ||
                            row.member_id
                    )
                    .filter(Boolean);

            let profiles = [];

            if (ids.length) {
                const result =
                    await db
                        .from(
                            "chat_public_profiles"
                        )
                        .select("*")
                        .in(
                            "id",
                            ids
                        );

                if (!result.error) {
                    profiles =
                        safeArray(
                            result.data
                        );
                }
            }

            const profileMap =
                new Map(
                    profiles.map(
                        profile => [
                            String(
                                profile.id
                            ),
                            profile
                        ]
                    )
                );

            state.members =
                safeArray(
                    memberships
                ).map(
                    membership => {
                        const userId =
                            membership.user_id ||
                            membership.profile_id ||
                            membership.member_id;

                        const profile =
                            profileMap.get(
                                String(
                                    userId
                                )
                            ) || {};

                        return {
                            ...membership,
                            ...profile,
                            user_id:
                                userId
                        };
                    }
                );

            console.log(
                "✅ Registered community members:",
                state.members.length
            );

            renderMembers();

            return state.members;

        } catch (error) {
            console.error(
                "loadMembers:",
                error
            );

            return [];
        }
    }


    function renderMembers() {
        const sidebar =
            $("memberList");

        if (!sidebar) {
            return;
        }

        const query =
            state.memberSearch
                .toLowerCase()
                .trim();

        const members =
            state.members.filter(
                member => {
                    if (!query) {
                        return true;
                    }

                    return displayName(
                        member
                    )
                        .toLowerCase()
                        .includes(query);
                }
            );

        sidebar.innerHTML =
            members
                .map(
                    member => {
                        const name =
                            displayName(
                                member
                            );

                        const avatar =
                            avatarURL(
                                member
                            );

                        const userId =
                            member.user_id;

                        return `
                            <div
                                class="community-member"
                                data-user-id="${escapeHTML(
                                    userId
                                )}"
                            >
                                <div class="member-avatar">
                                    ${
                                        avatar
                                            ? `
                                                <img
                                                    src="${escapeHTML(
                                                        avatar
                                                    )}"
                                                    alt="${escapeHTML(
                                                        name
                                                    )}"
                                                >
                                            `
                                            : `
                                                <span>
                                                    ${escapeHTML(
                                                        initialsForName(
                                                            name
                                                        )
                                                    )}
                                                </span>
                                            `
                                    }
                                </div>

                                <div class="member-info">
                                    <strong>
                                        ${escapeHTML(
                                            name
                                        )}
                                    </strong>

                                    <small>
                                        ${escapeHTML(
                                            member.role ||
                                            "Student"
                                        )}
                                    </small>
                                </div>

                                ${
                                    userId &&
                                    userId !==
                                        state.user?.id
                                        ? `
                                            <button
                                                type="button"
                                                class="member-call-button"
                                                title="Call ${escapeHTML(
                                                    name
                                                )}"
                                                data-call-user="${escapeHTML(
                                                    userId
                                                )}"
                                            >
                                                📞
                                            </button>
                                        `
                                        : ""
                                }
                            </div>
                        `;
                    }
                )
                .join("");

        sidebar
            .querySelectorAll(
                "[data-call-user]"
            )
            .forEach(
                button => {
                    button.onclick =
                        event => {
                            event.stopPropagation();

                            startDirectCall(
                                button.dataset
                                    .callUser,
                                "audio"
                            );
                        };
                }
            );
    }


    /* ============================================================
       PRESENCE
       ============================================================ */

    async function updateOwnPresence(
        status = "online"
    ) {
        if (!state.user?.id) {
            return false;
        }

        try {
            const payload = {
                user_id:
                    state.user.id,

                status,

                /*
                 * CORRECT COLUMN:
                 * last_seen_at
                 */
                last_seen_at:
                    new Date().toISOString()
            };

            const {
                error
            } = await db
                .from("chat_presence")
                .upsert(
                    payload,
                    {
                        onConflict:
                            "user_id"
                    }
                );

            if (error) {
                console.warn(
                    "❌ Presence update failed:",
                    error
                );

                return false;
            }

            return true;

        } catch (error) {
            console.warn(
                "❌ Presence exception:",
                error
            );

            return false;
        }
    }


    async function getOnlineUserIds() {
        try {
            const {
                data,
                error
            } = await db
                .from("chat_presence")
                .select(
                    "user_id,status,last_seen_at"
                )
                .eq(
                    "status",
                    "online"
                );

            if (error) {
                console.warn(
                    "❌ Online presence query failed:",
                    error
                );

                /*
                 * IMPORTANT:
                 * Presence must never block calls.
                 */
                return [];
            }

            const now =
                Date.now();

            return safeArray(data)
                .filter(row => {
                    if (!row.user_id) {
                        return false;
                    }

                    if (
                        !row.last_seen_at
                    ) {
                        return true;
                    }

                    const lastSeen =
                        new Date(
                            row.last_seen_at
                        ).getTime();

                    if (
                        !Number.isFinite(
                            lastSeen
                        )
                    ) {
                        return true;
                    }

                    return (
                        now -
                            lastSeen <=
                        PRESENCE_TIMEOUT
                    );
                })
                .map(
                    row =>
                        row.user_id
                );

        } catch (error) {
            console.warn(
                "getOnlineUserIds:",
                error
            );

            return [];
        }
    }


    async function startPresence() {
        if (!state.user?.id) {
            return;
        }

        await updateOwnPresence(
            "online"
        );

        if (state.presenceTimer) {
            clearInterval(
                state.presenceTimer
            );
        }

        state.presenceTimer =
            setInterval(
                () =>
                    updateOwnPresence(
                        "online"
                    ),
                60 * 1000
            );

        window.addEventListener(
            "beforeunload",
            () => {
                /*
                 * Best effort only.
                 */
                updateOwnPresence(
                    "offline"
                );
            }
        );
    }


    async function getOnlineUsers(
        communityId = null
    ) {
        try {
            const onlineIds =
                await getOnlineUserIds();

            if (!onlineIds.length) {
                return [];
            }

            const result =
                await db
                    .from(
                        "chat_public_profiles"
                    )
                    .select("*")
                    .in(
                        "id",
                        onlineIds
                    );

            if (result.error) {
                console.warn(
                    "Online profile loading:",
                    result.error
                );

                return [];
            }

            let users =
                safeArray(
                    result.data
                );

            if (communityId) {
                const communityMembers =
                    state.members.length &&
                    String(
                        state.currentCommunity
                            ?.id
                    ) ===
                        String(
                            communityId
                        )
                        ? state.members
                        : await loadMembers(
                              communityId
                          );

                const memberIds =
                    new Set(
                        safeArray(
                            communityMembers
                        ).map(
                            member =>
                                String(
                                    member.user_id
                                )
                        )
                    );

                users =
                    users.filter(
                        user =>
                            memberIds.has(
                                String(
                                    user.id
                                )
                            )
                    );
            }

            return users;

        } catch (error) {
            console.warn(
                "getOnlineUsers:",
                error
            );

            return [];
        }
    }


    /* ============================================================
       MESSAGES
       ============================================================ */

    async function loadMessages(
        channelId
    ) {
        if (!channelId) {
            return [];
        }

        try {
            const {
                data,
                error
            } = await db
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
                        ascending: true
                    }
                )
                .limit(
                    MESSAGE_PAGE_SIZE
                );

            if (error) {
                console.error(
                    "❌ Messages loading:",
                    error
                );

                state.messages = [];

                renderMessages();

                return [];
            }

            state.messages =
                safeArray(data);

            await enrichMessages();

            renderMessages();

            return state.messages;

        } catch (error) {
            console.error(
                "loadMessages:",
                error
            );

            return [];
        }
    }


    async function enrichMessages() {
        const ids =
            state.messages
                .map(
                    message =>
                        message.user_id ||
                        message.sender_id
                )
                .filter(Boolean);

        const uniqueIds =
            [...new Set(ids)];

        if (!uniqueIds.length) {
            return;
        }

        try {
            const {
                data,
                error
            } = await db
                .from(
                    "chat_public_profiles"
                )
                .select("*")
                .in(
                    "id",
                    uniqueIds
                );

            if (error) {
                return;
            }

            const map =
                new Map(
                    safeArray(data).map(
                        profile => [
                            String(
                                profile.id
                            ),
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
                                String(
                                    message.user_id ||
                                    message.sender_id
                                )
                            ) || null
                    })
                );

        } catch {}
    }


    function renderMessages() {
        const list =
            $("messageList");

        if (!list) {
            return;
        }

        const query =
            state.messageSearch
                .toLowerCase()
                .trim();

        const messages =
            state.messages.filter(
                message => {
                    if (!query) {
                        return true;
                    }

                    return String(
                        message.content ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            query
                        );
                }
            );

        list.innerHTML =
            messages
                .map(
                    message =>
                        renderMessage(
                            message
                        )
                )
                .join("");

        list
            .querySelectorAll(
                "[data-delete-message]"
            )
            .forEach(
                button => {
                    button.onclick =
                        () =>
                            deleteMessage(
                                button.dataset
                                    .deleteMessage
                            );
                }
            );

        list
            .querySelectorAll(
                "[data-reaction]"
            )
            .forEach(
                button => {
                    button.onclick =
                        () =>
                            toggleReaction(
                                button.dataset
                                    .reactionMessage,
                                button.dataset
                                    .reaction
                            );
                }
            );

        list.scrollTop =
            list.scrollHeight;
    }


    function renderMessage(
        message
    ) {
        const userId =
            message.user_id ||
            message.sender_id;

        const own =
            String(userId) ===
            String(state.user?.id);

        const profile =
            message.profile || {};

        const name =
            displayName(
                profile
            );

        const avatar =
            avatarURL(
                profile
            );

        const content =
            message.content || "";

        const attachment =
            message.attachment_url ||
            message.file_url;

        const attachmentName =
            message.attachment_name ||
            message.file_name ||
            "Attachment";

        const isVoice =
            String(
                message.message_type ||
                message.type ||
                ""
            ).toLowerCase() ===
            "voice";

        return `
            <article
                class="community-message ${
                    own
                        ? "own-message"
                        : ""
                }"
                data-message-id="${escapeHTML(
                    message.id
                )}"
            >
                <div class="message-avatar">
                    ${
                        avatar
                            ? `
                                <img
                                    src="${escapeHTML(
                                        avatar
                                    )}"
                                    alt="${escapeHTML(
                                        name
                                    )}"
                                >
                            `
                            : `
                                <span>
                                    ${escapeHTML(
                                        initialsForName(
                                            name
                                        )
                                    )}
                                </span>
                            `
                    }
                </div>

                <div class="message-body">
                    <div class="message-meta">
                        <strong>
                            ${escapeHTML(
                                name
                            )}
                        </strong>

                        <time>
                            ${escapeHTML(
                                formatTime(
                                    message.created_at
                                )
                            )}
                        </time>
                    </div>

                    ${
                        content
                            ? `
                                <div class="message-content">
                                    ${escapeHTML(
                                        content
                                    ).replace(
                                        /\n/g,
                                        "<br>"
                                    )}
                                </div>
                            `
                            : ""
                    }

                    ${
                        attachment
                            ? isVoice
                                ? `
                                    <div class="message-voice">
                                        <audio
                                            controls
                                            src="${escapeHTML(
                                                attachment
                                            )}"
                                        ></audio>
                                    </div>
                                `
                                : `
                                    <div class="message-attachment">
                                        <a
                                            href="${escapeHTML(
                                                attachment
                                            )}"
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            📎
                                            ${escapeHTML(
                                                attachmentName
                                            )}
                                        </a>
                                    </div>
                                `
                            : ""
                    }

                    <div class="message-actions">
                        <button
                            type="button"
                            data-reaction-message="${escapeHTML(
                                message.id
                            )}"
                            data-reaction="👍"
                        >
                            👍
                        </button>

                        <button
                            type="button"
                            data-reaction-message="${escapeHTML(
                                message.id
                            )}"
                            data-reaction="❤️"
                        >
                            ❤️
                        </button>

                        ${
                            own
                                ? `
                                    <button
                                        type="button"
                                        class="delete-message-button"
                                        data-delete-message="${escapeHTML(
                                            message.id
                                        )}"
                                    >
                                        Delete
                                    </button>
                                `
                                : ""
                        }
                    </div>
                </div>
            </article>
        `;
    }


    async function sendMessage() {
        if (!state.user?.id) {
            showToast(
                "You must be signed in.",
                "error"
            );

            return;
        }

        const input =
            $("messageInput");

        const content =
            input?.value?.trim() ||
            "";

        if (
            !content &&
            !state.pendingAttachment
        ) {
            return;
        }

        if (!state.currentChannel?.id) {
            showToast(
                "Select a channel first.",
                "error"
            );

            return;
        }

        try {
            let attachment = null;

            if (
                state.pendingAttachment
            ) {
                attachment =
                    await uploadAttachment(
                        state.pendingAttachment
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
                payload.attachment_url =
                    attachment.url;

                payload.attachment_name =
                    attachment.name;

                payload.attachment_type =
                    attachment.type;

                payload.attachment_size =
                    attachment.size;
            }

            const {
                error
            } = await db
                .from(
                    "chat_messages"
                )
                .insert(
                    payload
                );

            if (error) {
                throw error;
            }

            if (input) {
                input.value = "";
            }

            clearAttachment();

            await loadMessages(
                state.currentChannel.id
            );

        } catch (error) {
            console.error(
                "❌ Send message failed:",
                error
            );

            showToast(
                error?.message ||
                    "Could not send message.",
                "error"
            );
        }
    }


    async function deleteMessage(
        messageId
    ) {
        if (!messageId) {
            return;
        }

        const message =
            state.messages.find(
                item =>
                    String(item.id) ===
                    String(messageId)
            );

        if (!message) {
            return;
        }

        const owner =
            message.user_id ||
            message.sender_id;

        if (
            String(owner) !==
            String(state.user?.id)
        ) {
            showToast(
                "You can only delete your own messages.",
                "error"
            );

            return;
        }

        try {
            /*
             * First attempt soft deletion if the
             * schema has a deleted_at column.
             */
            let softDeleteWorked =
                false;

            const soft =
                await db
                    .from(
                        "chat_messages"
                    )
                    .update({
                        deleted_at:
                            new Date().toISOString(),
                        content:
                            "[Message deleted]"
                    })
                    .eq(
                        "id",
                        messageId
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    );

            if (!soft.error) {
                softDeleteWorked = true;
            }

            /*
             * If deleted_at doesn't exist, use physical
             * deletion. This also fixes old installations.
             */
            if (!softDeleteWorked) {
                const hard =
                    await db
                        .from(
                            "chat_messages"
                        )
                        .delete()
                        .eq(
                            "id",
                            messageId
                        )
                        .eq(
                            "user_id",
                            state.user.id
                        );

                if (hard.error) {
                    throw hard.error;
                }
            }

            state.messages =
                state.messages.filter(
                    item =>
                        String(item.id) !==
                        String(messageId)
                );

            renderMessages();

        } catch (error) {
            console.error(
                "❌ Delete message failed:",
                error
            );

            showToast(
                "Could not delete this message.",
                "error"
            );
        }
    }


    /* ============================================================
       REACTIONS
       ============================================================ */

    async function toggleReaction(
        messageId,
        reaction
    ) {
        if (
            !state.user?.id ||
            !messageId ||
            !reaction
        ) {
            return;
        }

        try {
            const existing =
                await db
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
                        reaction
                    )
                    .maybeSingle();

            if (
                existing.error &&
                existing.error.code !==
                    "PGRST116"
            ) {
                throw existing.error;
            }

            if (existing.data) {
                const {
                    error
                } = await db
                    .from(
                        "chat_message_reactions"
                    )
                    .delete()
                    .eq(
                        "id",
                        existing.data.id
                    );

                if (error) {
                    throw error;
                }
            } else {
                const {
                    error
                } = await db
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

                if (error) {
                    throw error;
                }
            }

        } catch (error) {
            console.warn(
                "Reaction:",
                error
            );
        }
    }


    /* ============================================================
       ATTACHMENTS
       ============================================================ */

    function bindAttachmentInput() {
        const input =
            $("attachmentInput");

        if (!input) {
            return;
        }

        input.onchange =
            () => {
                const file =
                    input.files?.[0];

                if (!file) {
                    return;
                }

                prepareAttachment(
                    file
                );
            };
    }


    function prepareAttachment(
        file
    ) {
        if (
            file.size >
            MAX_ATTACHMENT_SIZE
        ) {
            showToast(
                "Attachment is larger than 25 MB.",
                "error"
            );

            return;
        }

        state.pendingAttachment =
            file;

        const status =
            $("attachmentStatus");

        if (status) {
            status.textContent =
                file.name;
        }
    }


    function clearAttachment() {
        state.pendingAttachment =
            null;

        const input =
            $("attachmentInput");

        if (input) {
            input.value = "";
        }

        const status =
            $("attachmentStatus");

        if (status) {
            status.textContent = "";
        }
    }


    async function uploadAttachment(
        file
    ) {
        if (!file) {
            return null;
        }

        const buckets = [
            "chat-attachments",
            "attachments",
            "community-attachments"
        ];

        const extension =
            file.name.includes(".")
                ? "." +
                  file.name
                      .split(".")
                      .pop()
                : "";

        const path =
            `${state.user.id}/` +
            `${Date.now()}-` +
            `${randomId(8)}` +
            extension;

        let lastError = null;

        for (
            const bucket
            of buckets
        ) {
            try {
                const upload =
                    await db.storage
                        .from(bucket)
                        .upload(
                            path,
                            file,
                            {
                                upsert: false
                            }
                        );

                if (upload.error) {
                    lastError =
                        upload.error;

                    continue;
                }

                const publicResult =
                    db.storage
                        .from(bucket)
                        .getPublicUrl(
                            path
                        );

                return {
                    url:
                        publicResult
                            .data
                            ?.publicUrl ||
                        "",

                    name:
                        file.name,

                    type:
                        file.type,

                    size:
                        file.size,

                    bucket,

                    path
                };

            } catch (error) {
                lastError =
                    error;
            }
        }

        throw (
            lastError ||
            new Error(
                "No attachment storage bucket is available."
            )
        );
    }


    /* ============================================================
       VOICE NOTES
       ============================================================ */

    async function toggleVoiceRecording() {
        if (state.recording) {
            stopVoiceRecording();

            return;
        }

        if (
            !navigator.mediaDevices
                ?.getUserMedia
        ) {
            showToast(
                "Microphone is not available.",
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

            let mimeType =
                "";

            for (
                const type
                of VOICE_MIME_TYPES
            ) {
                if (
                    window.MediaRecorder
                        ?.isTypeSupported?.(
                            type
                        )
                ) {
                    mimeType =
                        type;

                    break;
                }
            }

            state.voiceChunks =
                [];

            state.recorder =
                new MediaRecorder(
                    stream,
                    mimeType
                        ? {
                              mimeType
                          }
                        : undefined
                );

            state.recorder.ondataavailable =
                event => {
                    if (
                        event.data &&
                        event.data.size
                    ) {
                        state.voiceChunks.push(
                            event.data
                        );
                    }
                };

            state.recorder.onstop =
                async () => {
                    stream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );

                    const actualType =
                        mimeType ||
                        "audio/webm";

                    const blob =
                        new Blob(
                            state.voiceChunks,
                            {
                                type:
                                    actualType
                            }
                        );

                    state.voiceChunks =
                        [];

                    if (
                        blob.size >
                        0
                    ) {
                        await sendVoiceNote(
                            blob,
                            actualType
                        );
                    }
                };

            state.recorder.start();

            state.recording =
                true;

            updateVoiceButton();

        } catch (error) {
            console.error(
                "Voice recording:",
                error
            );

            showToast(
                "Microphone permission was not available.",
                "error"
            );
        }
    }


    function stopVoiceRecording() {
        if (
            state.recorder &&
            state.recorder.state !==
                "inactive"
        ) {
            state.recorder.stop();
        }

        state.recording =
            false;

        updateVoiceButton();
    }


    function updateVoiceButton() {
        const button =
            $("voiceNoteButton");

        if (!button) {
            return;
        }

        button.textContent =
            state.recording
                ? "⏹️"
                : "🎙️";

        button.title =
            state.recording
                ? "Stop recording"
                : "Voice note";
    }


    async function sendVoiceNote(
        blob,
        mimeType
    ) {
        if (
            !state.currentChannel?.id ||
            !state.user?.id
        ) {
            return;
        }

        try {
            const extension =
                mimeType.includes("ogg")
                    ? ".ogg"
                    : ".webm";

            const file =
                new File(
                    [
                        blob
                    ],
                    `voice-${Date.now()}${extension}`,
                    {
                        type:
                            mimeType
                    }
                );

            const uploaded =
                await uploadAttachment(
                    file
                );

            const {
                error
            } = await db
                .from(
                    "chat_messages"
                )
                .insert({
                    channel_id:
                        state.currentChannel.id,

                    user_id:
                        state.user.id,

                    content:
                        null,

                    message_type:
                        "voice",

                    attachment_url:
                        uploaded.url,

                    attachment_name:
                        uploaded.name,

                    attachment_type:
                        uploaded.type,

                    attachment_size:
                        uploaded.size
                });

            if (error) {
                throw error;
            }

            await loadMessages(
                state.currentChannel.id
            );

        } catch (error) {
            console.error(
                "❌ Voice note failed:",
                error
            );

            showToast(
                "Could not send the voice note.",
                "error"
            );
        }
    }


    /* ============================================================
       EMOJI / STICKERS / GIF
       ============================================================ */

    function setupEmojiPanel() {
        const button =
            $("emojiButton");

        const panel =
            $("emojiPanel");

        if (!button || !panel) {
            return;
        }

        button.onclick =
            event => {
                event.stopPropagation();

                panel.classList.toggle(
                    "open"
                );

                panel.hidden =
                    !panel.classList.contains(
                        "open"
                    );

                if (
                    panel.classList.contains(
                        "open"
                    )
                ) {
                    panel.innerHTML =
                        EMOJIS.map(
                            emoji =>
                                `
                                    <button
                                        type="button"
                                        class="emoji-choice"
                                    >
                                        ${emoji}
                                    </button>
                                `
                        ).join("");

                    panel
                        .querySelectorAll(
                            ".emoji-choice"
                        )
                        .forEach(
                            emojiButton => {
                                emojiButton.onclick =
                                    event => {
                                        event.stopPropagation();

                                        const input =
                                            $("messageInput");

                                        if (input) {
                                            input.value +=
                                                emojiButton
                                                    .textContent
                                                    .trim();

                                            input.focus();
                                        }
                                    };
                            }
                        );
                }
            };
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

        panel.hidden = true;
    }


    function setupStickerPanel() {
        const button =
            $("stickerButton");

        const panel =
            $("stickerPanel");

        if (!button || !panel) {
            return;
        }

        button.onclick =
            event => {
                event.stopPropagation();

                panel.classList.toggle(
                    "open"
                );

                panel.hidden =
                    !panel.classList.contains(
                        "open"
                    );
            };
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

        panel.hidden = true;
    }


    function setupGifPanel() {
        const button =
            $("gifButton");

        const panel =
            $("gifPanel");

        if (!button || !panel) {
            return;
        }

        button.onclick =
            event => {
                event.stopPropagation();

                panel.classList.toggle(
                    "open"
                );

                panel.hidden =
                    !panel.classList.contains(
                        "open"
                    );
            };
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

        panel.hidden = true;
    }


    /* ============================================================
       READ STATUS
       ============================================================ */

    async function markChannelRead(
        channelId
    ) {
        if (
            !channelId ||
            !state.user?.id
        ) {
            return;
        }

        try {
            const existing =
                await db
                    .from(
                        "chat_read_status"
                    )
                    .select("*")
                    .eq(
                        "channel_id",
                        channelId
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    )
                    .maybeSingle();

            if (
                existing.error &&
                existing.error.code !==
                    "PGRST116"
            ) {
                return;
            }

            const now =
                new Date().toISOString();

            if (existing.data) {
                await db
                    .from(
                        "chat_read_status"
                    )
                    .update({
                        last_read_at:
                            now
                    })
                    .eq(
                        "id",
                        existing.data.id
                    );
            } else {
                await db
                    .from(
                        "chat_read_status"
                    )
                    .insert({
                        channel_id:
                            channelId,

                        user_id:
                            state.user.id,

                        last_read_at:
                            now
                    });
            }

        } catch (error) {
            console.warn(
                "Read status:",
                error
            );
        }
    }


    /* ============================================================
       REALTIME
       ============================================================ */

    async function cleanupCommunityRealtime() {
        const channels =
            [
                state.communityChannel,
                state.messageChannel,
                state.presenceChannel
            ].filter(Boolean);

        for (
            const channel
            of channels
        ) {
            try {
                await db.removeChannel(
                    channel
                );
            } catch {}
        }

        state.communityChannel =
            null;

        state.messageChannel =
            null;

        state.presenceChannel =
            null;
    }


    async function subscribeCommunityRealtime(
        communityId
    ) {
        if (!communityId) {
            return;
        }

        const channel =
            db.channel(
                `community-${communityId}`
            );

        channel.on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table:
                    "chat_community_members",
                filter:
                    `community_id=eq.${communityId}`
            },
            async () => {
                await loadMembers(
                    communityId
                );
            }
        );

        state.communityChannel =
            channel;

        channel.subscribe(
            status => {
                console.log(
                    "Community realtime:",
                    status
                );
            }
        );
    }


    async function subscribeMessageRealtime(
        channelId
    ) {
        if (!channelId) {
            return;
        }

        if (
            state.messageChannel
        ) {
            try {
                await db.removeChannel(
                    state.messageChannel
                );
            } catch {}
        }

        const channel =
            db.channel(
                `messages-${channelId}`
            );

        channel.on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table:
                    "chat_messages",
                filter:
                    `channel_id=eq.${channelId}`
            },
            async () => {
                await loadMessages(
                    channelId
                );
            }
        );

        state.messageChannel =
            channel;

        channel.subscribe(
            status => {
                console.log(
                    "Message realtime:",
                    status
                );
            }
        );
    }


    /* ============================================================
       CALL DATABASE HELPERS
       ============================================================ */

    async function createCallRoom({
        communityId = null,
        targetUserId = null,
        scope = "direct",
        mode = "audio"
    } = {}) {
        if (!state.user?.id) {
            throw new Error(
                "You must be signed in before starting a call."
            );
        }

        const roomCode =
            generateRoomCode();

        /*
         * IMPORTANT:
         * Do not send optional NULL fields.
         * This prevents failures caused by NOT NULL /
         * foreign-key / schema differences.
         */

        const payload = {
            room_code:
                roomCode,

            created_by:
                state.user.id,

            room_status:
                "ringing",

            call_scope:
                scope,

            max_participants:
                scope === "direct"
                    ? 2
                    : 100
        };

        if (
            communityId !== null &&
            communityId !== undefined &&
            communityId !== ""
        ) {
            payload.community_id =
                communityId;
        }

        if (
            targetUserId !== null &&
            targetUserId !== undefined &&
            targetUserId !== ""
        ) {
            payload.target_user_id =
                targetUserId;
        }

        /*
         * mode is intentionally not inserted unless the
         * database actually has a mode column.
         */
        void mode;

        console.log(
            "📞 Creating call room:",
            payload
        );

        const {
            data,
            error
        } = await db
            .from(
                "chat_call_rooms"
            )
            .insert(
                payload
            )
            .select("*")
            .single();

        if (error) {
            console.error(
                "❌ CALL ROOM CREATION FAILED"
            );

            console.error(
                "Payload:",
                payload
            );

            console.error(
                "Code:",
                error.code
            );

            console.error(
                "Message:",
                error.message
            );

            console.error(
                "Details:",
                error.details
            );

            console.error(
                "Hint:",
                error.hint
            );

            throw error;
        }

        if (!data?.id) {
            throw new Error(
                "Supabase created the room but returned no room ID."
            );
        }

        console.log(
            "✅ Call room created:",
            data
        );

        return data;
    }


    async function addCallParticipant(
        roomId,
        userId,
        status = "invited"
    ) {
        if (
            !roomId ||
            !userId
        ) {
            return;
        }

        try {
            const existing =
                await db
                    .from(
                        "chat_call_participants"
                    )
                    .select("*")
                    .eq(
                        "room_id",
                        roomId
                    )
                    .eq(
                        "user_id",
                        userId
                    )
                    .maybeSingle();

            if (
                existing.error &&
                existing.error.code !==
                    "PGRST116"
            ) {
                throw existing.error;
            }

            const payload = {
                room_id:
                    roomId,

                user_id:
                    userId,

                status,

                is_muted:
                    false,

                camera:
                    false,

                screen_share:
                    false
            };

            if (
                status ===
                "joined"
            ) {
                payload.joined_at =
                    new Date().toISOString();
            }

            if (existing.data) {
                const {
                    error
                } = await db
                    .from(
                        "chat_call_participants"
                    )
                    .update(
                        payload
                    )
                    .eq(
                        "id",
                        existing.data.id
                    );

                if (error) {
                    throw error;
                }

                return existing.data;
            }

            const {
                data,
                error
            } = await db
                .from(
                    "chat_call_participants"
                )
                .insert(
                    payload
                )
                .select("*")
                .single();

            if (error) {
                throw error;
            }

            return data;

        } catch (error) {
            console.warn(
                "Call participant:",
                error
            );

            return null;
        }
    }


    async function updateCallParticipant(
        roomId,
        userId,
        changes
    ) {
        if (
            !roomId ||
            !userId
        ) {
            return;
        }

        try {
            await db
                .from(
                    "chat_call_participants"
                )
                .update(
                    changes
                )
                .eq(
                    "room_id",
                    roomId
                )
                .eq(
                    "user_id",
                    userId
                );
        } catch (error) {
            console.warn(
                "Participant update:",
                error
            );
        }
    }


    async function updateCallRoom(
        roomId,
        changes
    ) {
        if (!roomId) {
            return;
        }

        try {
            const {
                error
            } = await db
                .from(
                    "chat_call_rooms"
                )
                .update(
                    changes
                )
                .eq(
                    "id",
                    roomId
                );

            if (error) {
                console.warn(
                    "Call room update:",
                    error
                );
            }
        } catch (error) {
            console.warn(
                "Call room update:",
                error
            );
        }
    }


    async function createCallInvite(
        roomId,
        receiverId
    ) {
        const {
            data,
            error
        } = await db
            .from(
                "chat_call_invites"
            )
            .insert({
                room_id:
                    roomId,

                sender_id:
                    state.user.id,

                receiver_id:
                    receiverId,

                status:
                    "ringing"
            })
            .select("*")
            .single();

        if (error) {
            throw error;
        }

        return data;
    }


    async function getCallRoom(
        roomId
    ) {
        if (!roomId) {
            return null;
        }

        const {
            data,
            error
        } = await db
            .from(
                "chat_call_rooms"
            )
            .select("*")
            .eq(
                "id",
                roomId
            )
            .maybeSingle();

        if (error) {
            throw error;
        }

        return data;
    }


    /* ============================================================
       INCOMING CALL NOTIFICATIONS
       ============================================================ */

    async function subscribeIncomingCalls() {
        if (!state.user?.id) {
            return;
        }

        if (
            state.incomingChannel
        ) {
            try {
                await db.removeChannel(
                    state.incomingChannel
                );
            } catch {}
        }

        const channel =
            db.channel(
                `${INCOMING_PREFIX}${state.user.id}`
            );

        channel.on(
            "broadcast",
            {
                event:
                    "incoming-call"
            },
            async event => {
                const payload =
                    event?.payload ||
                    event;

                await showIncomingInvite(
                    payload
                );
            }
        );

        channel.on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table:
                    "chat_call_invites",
                filter:
                    `receiver_id=eq.${state.user.id}`
            },
            async event => {
                const invite =
                    event?.new;

                if (!invite) {
                    return;
                }

                if (
                    invite.status !==
                        "ringing" &&
                    invite.status !==
                        "pending"
                ) {
                    return;
                }

                await showIncomingInvite({
                    roomId:
                        invite.room_id,

                    inviteId:
                        invite.id,

                    callerId:
                        invite.sender_id
                });
            }
        );

        state.incomingChannel =
            channel;

        channel.subscribe(
            status => {
                if (
                    status ===
                    "SUBSCRIBED"
                ) {
                    console.log(
                        "📞 Incoming call listener ready"
                    );
                }
            }
        );
    }


    async function notifyUserOfCall({
        room,
        invite,
        targetUserId,
        mode = "audio"
    }) {
        if (
            !state.user?.id ||
            !targetUserId
        ) {
            return;
        }

        const channel =
            db.channel(
                `${INCOMING_PREFIX}${targetUserId}`
            );

        const profile =
            state.profile || {};

        try {
            await channel.subscribe(
                async status => {
                    if (
                        status ===
                        "SUBSCRIBED"
                    ) {
                        await channel.send({
                            type:
                                "broadcast",

                            event:
                                "incoming-call",

                            payload: {
                                roomId:
                                    room.id,

                                roomCode:
                                    room.room_code,

                                inviteId:
                                    invite.id,

                                callerId:
                                    state.user.id,

                                callerName:
                                    displayName(
                                        profile
                                    ),

                                callerAvatar:
                                    avatarURL(
                                        profile
                                    ),

                                targetUserId,

                                communityId:
                                    room.community_id ||
                                    null,

                                mode,

                                timestamp:
                                    Date.now()
                            }
                        });

                        setTimeout(
                            () => {
                                try {
                                    db.removeChannel(
                                        channel
                                    );
                                } catch {}
                            },
                            3000
                        );
                    }
                }
            );

        } catch (error) {
            console.warn(
                "Call notification:",
                error
            );
        }
    }


    async function showIncomingInvite(
        payload
    ) {
        if (
            !payload ||
            state.incomingCallVisible
        ) {
            return;
        }

        const roomId =
            payload.roomId ||
            payload.room_id;

        if (!roomId) {
            return;
        }

        try {
            const room =
                await getCallRoom(
                    roomId
                );

            if (!room) {
                return;
            }

            if (
                room.room_status ===
                "ended"
            ) {
                return;
            }

            let caller = null;

            if (
                payload.callerId
            ) {
                const result =
                    await db
                        .from(
                            "chat_public_profiles"
                        )
                        .select("*")
                        .eq(
                            "id",
                            payload.callerId
                        )
                        .maybeSingle();

                if (
                    !result.error
                ) {
                    caller =
                        result.data;
                }
            }

            caller =
                caller || {
                    id:
                        payload.callerId,

                    display_name:
                        payload.callerName ||
                        "Mwaniki Scholar",

                    avatar_url:
                        payload.callerAvatar ||
                        ""
                };

            showIncomingCall({
                room,
                inviteId:
                    payload.inviteId,
                caller,
                mode:
                    payload.mode ||
                    "audio"
            });

        } catch (error) {
            console.warn(
                "Incoming invite:",
                error
            );
        }
    }


    function showIncomingCall({
        room,
        inviteId,
        caller,
        mode
    }) {
        removeIncomingCallUI();

        state.incomingCallVisible =
            true;

        state.incomingCall = {
            room,
            inviteId,
            caller,
            mode
        };

        const overlay =
            document.createElement(
                "div"
            );

        overlay.id =
            "mwanikiIncomingCall";

        overlay.className =
            "mwaniki-incoming-call";

        const name =
            displayName(
                caller
            );

        const avatar =
            avatarURL(
                caller
            );

        overlay.innerHTML = `
            <div class="mwaniki-incoming-card">
                <div class="mwaniki-incoming-avatar">
                    ${
                        avatar
                            ? `
                                <img
                                    src="${escapeHTML(
                                        avatar
                                    )}"
                                    alt="${escapeHTML(
                                        name
                                    )}"
                                >
                            `
                            : `
                                <span>
                                    ${escapeHTML(
                                        initialsForName(
                                            name
                                        )
                                    )}
                                </span>
                            `
                    }
                </div>

                <div class="mwaniki-incoming-label">
                    Incoming ${
                        mode === "video"
                            ? "video"
                            : "audio"
                    } call
                </div>

                <h3>
                    ${escapeHTML(
                        name
                    )}
                </h3>

                <div class="mwaniki-incoming-actions">
                    <button
                        type="button"
                        id="mwanikiAcceptIncoming"
                    >
                        📞 Accept
                    </button>

                    <button
                        type="button"
                        id="mwanikiDeclineIncoming"
                    >
                        ❌ Decline
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(
            overlay
        );

        $("mwanikiAcceptIncoming")
            .onclick =
            () =>
                acceptIncomingCall();

        $("mwanikiDeclineIncoming")
            .onclick =
            () =>
                declineIncomingCall();

        state.incomingCall.timer =
            setTimeout(
                () =>
                    declineIncomingCall(
                        true
                    ),
                CALL_RING_TIMEOUT
            );
    }


    function removeIncomingCallUI() {
        const overlay =
            $("mwanikiIncomingCall");

        if (overlay) {
            overlay.remove();
        }

        if (
            state.incomingCall?.timer
        ) {
            clearTimeout(
                state.incomingCall.timer
            );
        }

        state.incomingCallVisible =
            false;

        state.incomingCall =
            null;
    }


    async function acceptIncomingCall() {
        const incoming =
            state.incomingCall;

        if (!incoming) {
            return;
        }

        const room =
            incoming.room;

        const inviteId =
            incoming.inviteId;

        const mode =
            incoming.mode ||
            "audio";

        try {
            if (inviteId) {
                await db
                    .from(
                        "chat_call_invites"
                    )
                    .update({
                        status:
                            "accepted"
                    })
                    .eq(
                        "id",
                        inviteId
                    );
            }

            removeIncomingCallUI();

            await addCallParticipant(
                room.id,
                state.user.id,
                "joined"
            );

            window.location.href =
                buildCallURL(
                    room,
                    "receiver",
                    mode
                );

        } catch (error) {
            console.error(
                "Accept call:",
                error
            );

            showToast(
                "Could not accept the call.",
                "error"
            );
        }
    }


    async function declineIncomingCall(
        silent = false
    ) {
        const incoming =
            state.incomingCall;

        if (!incoming) {
            return;
        }

        try {
            if (
                incoming.inviteId
            ) {
                await db
                    .from(
                        "chat_call_invites"
                    )
                    .update({
                        status:
                            "declined"
                    })
                    .eq(
                        "id",
                        incoming.inviteId
                    );
            }

            if (
                incoming.room?.id
            ) {
                await db
                    .from(
                        "chat_call_rooms"
                    )
                    .update({
                        room_status:
                            "ended"
                    })
                    .eq(
                        "id",
                        incoming.room.id
                    );
            }

        } catch (error) {
            console.warn(
                "Decline call:",
                error
            );
        }

        removeIncomingCallUI();

        if (!silent) {
            showToast(
                "Call declined.",
                "info"
            );
        }
    }


    /* ============================================================
       CALL URL
       ============================================================ */

    function buildCallURL(
        room,
        role,
        mode
    ) {
        const params =
            new URLSearchParams();

        params.set(
            "room_id",
            room.id
        );

        params.set(
            "room_code",
            room.room_code
        );

        params.set(
            "role",
            role
        );

        params.set(
            "mode",
            mode
        );

        if (
            room.community_id
        ) {
            params.set(
                "community_id",
                room.community_id
            );
        }

        return (
            CALL_PAGE +
            "?" +
            params.toString()
        );
    }


    /* ============================================================
       DIRECT CALL
       ============================================================ */

    async function startDirectCall(
        targetUserId,
        mode = "audio"
    ) {
        try {
            if (!state.user?.id) {
                throw new Error(
                    "You must be signed in."
                );
            }

            if (!targetUserId) {
                throw new Error(
                    "No call recipient was selected."
                );
            }

            if (
                String(
                    targetUserId
                ) ===
                String(
                    state.user.id
                )
            ) {
                throw new Error(
                    "You cannot call yourself."
                );
            }

            /*
             * Presence is NOT required here.
             * A user can still receive the invite even
             * if presence is temporarily unavailable.
             */

            const room =
                await createCallRoom({
                    communityId:
                        state.currentCommunity
                            ?.id ||
                        null,

                    targetUserId,

                    scope:
                        "direct",

                    mode
                });

            await addCallParticipant(
                room.id,
                state.user.id,
                "joined"
            );

            await addCallParticipant(
                room.id,
                targetUserId,
                "invited"
            );

            const invite =
                await createCallInvite(
                    room.id,
                    targetUserId
                );

            await notifyUserOfCall({
                room,
                invite,
                targetUserId,
                mode
            });

            window.location.href =
                buildCallURL(
                    room,
                    "caller",
                    mode
                );

        } catch (error) {
            console.error(
                "❌ Could not start call:",
                error
            );

            showToast(
                error?.message ||
                    "Could not start the call.",
                "error"
            );
        }
    }


    /* ============================================================
       COMMUNITY CALL
       ============================================================ */

    async function startCommunityCall(
        communityId,
        mode = "audio"
    ) {
        try {
            if (!state.user?.id) {
                throw new Error(
                    "You must be signed in."
                );
            }

            if (!communityId) {
                throw new Error(
                    "No community was selected."
                );
            }

            const room =
                await createCallRoom({
                    communityId,

                    scope:
                        "community",

                    mode
                });

            await addCallParticipant(
                room.id,
                state.user.id,
                "joined"
            );

            /*
             * Invite registered community members.
             */
            const members =
                await loadMembers(
                    communityId
                );

            const others =
                safeArray(
                    members
                ).filter(
                    member =>
                        String(
                            member.user_id
                        ) !==
                        String(
                            state.user.id
                        )
                );

            for (
                const member
                of others
            ) {
                const userId =
                    member.user_id;

                if (!userId) {
                    continue;
                }

                await addCallParticipant(
                    room.id,
                    userId,
                    "invited"
                );

                try {
                    const invite =
                        await createCallInvite(
                            room.id,
                            userId
                        );

                    await notifyUserOfCall({
                        room,
                        invite,
                        targetUserId:
                            userId,
                        mode
                    });
                } catch (
                    inviteError
                ) {
                    console.warn(
                        "Community invite failed:",
                        inviteError
                    );
                }
            }

            window.location.href =
                buildCallURL(
                    room,
                    "caller",
                    mode
                );

        } catch (error) {
            console.error(
                "❌ Community call failed:",
                error
            );

            showToast(
                error?.message ||
                    "Could not start community call.",
                "error"
            );
        }
    }


    /* ============================================================
       GENERAL CALL PICKER
       ============================================================ */

    async function openGeneralCallPicker() {
        removeCallPicker();

        const users =
            await getOnlineUsers();

        if (!users.length) {
            showToast(
                "No online users are currently available.",
                "info"
            );

            return;
        }

        const overlay =
            document.createElement(
                "div"
            );

        overlay.id =
            "mwanikiCallPicker";

        overlay.className =
            "mwaniki-call-picker";

        overlay.innerHTML = `
            <div class="mwaniki-call-picker-card">

                <div class="mwaniki-call-picker-header">
                    <div>
                        <h3>
                            General Call
                        </h3>

                        <p>
                            Select who should receive the call.
                        </p>
                    </div>

                    <button
                        type="button"
                        id="mwanikiCloseCallPicker"
                    >
                        ✕
                    </button>
                </div>

                <div class="mwaniki-call-picker-actions">
                    <button
                        type="button"
                        id="mwanikiSelectAllOnline"
                    >
                        Select everyone online
                    </button>

                    <button
                        type="button"
                        id="mwanikiClearOnline"
                    >
                        Clear
                    </button>
                </div>

                <div
                    class="mwaniki-online-user-list"
                    id="mwanikiOnlineUserList"
                >
                    ${users
                        .map(
                            user => {
                                const name =
                                    displayName(
                                        user
                                    );

                                const avatar =
                                    avatarURL(
                                        user
                                    );

                                return `
                                    <label
                                        class="mwaniki-online-user"
                                    >
                                        <input
                                            type="checkbox"
                                            value="${escapeHTML(
                                                user.id
                                            )}"
                                            class="mwaniki-online-checkbox"
                                        >

                                        <div class="online-user-avatar">
                                            ${
                                                avatar
                                                    ? `
                                                        <img
                                                            src="${escapeHTML(
                                                                avatar
                                                            )}"
                                                            alt="${escapeHTML(
                                                                name
                                                            )}"
                                                        >
                                                    `
                                                    : `
                                                        <span>
                                                            ${escapeHTML(
                                                                initialsForName(
                                                                    name
                                                                )
                                                            )}
                                                        </span>
                                                    `
                                            }
                                        </div>

                                        <div>
                                            <strong>
                                                ${escapeHTML(
                                                    name
                                                )}
                                            </strong>

                                            <small>
                                                Online
                                            </small>
                                        </div>
                                    </label>
                                `;
                            }
                        )
                        .join("")}
                </div>

                <div class="mwaniki-call-picker-footer">
                    <button
                        type="button"
                        id="mwanikiStartSelectedCall"
                    >
                        📞 Start Audio Call
                    </button>

                    <button
                        type="button"
                        id="mwanikiStartSelectedVideoCall"
                    >
                        📹 Start Video Call
                    </button>
                </div>

            </div>
        `;

        document.body.appendChild(
            overlay
        );

        $("mwanikiCloseCallPicker")
            .onclick =
            removeCallPicker;

        $("mwanikiSelectAllOnline")
            .onclick =
            () => {
                overlay
                    .querySelectorAll(
                        ".mwaniki-online-checkbox"
                    )
                    .forEach(
                        checkbox =>
                            checkbox.checked =
                                true
                    );
            };

        $("mwanikiClearOnline")
            .onclick =
            () => {
                overlay
                    .querySelectorAll(
                        ".mwaniki-online-checkbox"
                    )
                    .forEach(
                        checkbox =>
                            checkbox.checked =
                                false
                    );
            };

        $("mwanikiStartSelectedCall")
            .onclick =
            () =>
                startGeneralCall(
                    "audio"
                );

        $("mwanikiStartSelectedVideoCall")
            .onclick =
            () =>
                startGeneralCall(
                    "video"
                );
    }


    function getSelectedCallUsers() {
        const picker =
            $("mwanikiCallPicker");

        if (!picker) {
            return [];
        }

        return [
            ...picker.querySelectorAll(
                ".mwaniki-online-checkbox:checked"
            )
        ].map(
            checkbox =>
                checkbox.value
        );
    }


    async function startGeneralCall(
        mode = "audio"
    ) {
        const selected =
            getSelectedCallUsers();

        if (!selected.length) {
            showToast(
                "Select at least one online user.",
                "error"
            );

            return;
        }

        removeCallPicker();

        try {
            const room =
                await createCallRoom({
                    scope:
                        "general",

                    mode
                });

            await addCallParticipant(
                room.id,
                state.user.id,
                "joined"
            );

            for (
                const userId
                of selected
            ) {
                await addCallParticipant(
                    room.id,
                    userId,
                    "invited"
                );

                try {
                    const invite =
                        await createCallInvite(
                            room.id,
                            userId
                        );

                    await notifyUserOfCall({
                        room,
                        invite,
                        targetUserId:
                            userId,
                        mode
                    });
                } catch (
                    inviteError
                ) {
                    console.warn(
                        "General call invite:",
                        inviteError
                    );
                }
            }

            window.location.href =
                buildCallURL(
                    room,
                    "caller",
                    mode
                );

        } catch (error) {
            console.error(
                "General call:",
                error
            );

            showToast(
                error?.message ||
                    "Could not start general call.",
                "error"
            );
        }
    }


    function removeCallPicker() {
        const picker =
            $("mwanikiCallPicker");

        if (picker) {
            picker.remove();
        }
    }


    /* ============================================================
       CALL PAGE
       ============================================================ */

    function isCallPage() {
        return (
            window.location.pathname
                .toLowerCase()
                .includes(
                    "community-calls"
                )
        );
    }


    function getCallParams() {
        const params =
            new URLSearchParams(
                window.location.search
            );

        return {
            roomId:
                params.get(
                    "room_id"
                ),

            roomCode:
                params.get(
                    "room_code"
                ),

            role:
                params.get(
                    "role"
                ) ||
                "receiver",

            mode:
                params.get(
                    "mode"
                ) ||
                "audio",

            communityId:
                params.get(
                    "community_id"
                )
        };
    }


    function ensureCallPageUI() {
        if (
            $("mwanikiCallApp")
        ) {
            return;
        }

        document.body.innerHTML = `
            <main
                id="mwanikiCallApp"
                class="mwaniki-call-app"
            >
                <header
                    class="mwaniki-call-header"
                >
                    <div>
                        <h1>
                            Mwaniki Scholars Call
                        </h1>

                        <p
                            id="mwanikiCallStatus"
                        >
                            Connecting...
                        </p>
                    </div>

                    <button
                        type="button"
                        id="mwanikiLeaveCall"
                    >
                        Leave
                    </button>
                </header>

                <section
                    id="mwanikiVideoGrid"
                    class="mwaniki-video-grid"
                >
                    <div
                        class="mwaniki-video-tile mwaniki-local-tile"
                        id="mwanikiLocalTile"
                    >
                        <video
                            id="mwanikiLocalVideo"
                            autoplay
                            muted
                            playsinline
                        ></video>

                        <span
                            class="mwaniki-video-name"
                        >
                            You
                        </span>
                    </div>
                </section>

                <footer
                    class="mwaniki-call-controls"
                >
                    <button
                        type="button"
                        id="mwanikiMicButton"
                    >
                        🎙️
                    </button>

                    <button
                        type="button"
                        id="mwanikiCameraButton"
                    >
                        📷
                    </button>

                    <button
                        type="button"
                        id="mwanikiScreenButton"
                    >
                        🖥️
                    </button>

                    <button
                        type="button"
                        id="mwanikiEndButton"
                    >
                        🔴
                    </button>
                </footer>
            </main>
        `;

        installCallPageStyles();
    }


    function installCallPageStyles() {
        if (
            $("mwanikiCallRuntimeStyles")
        ) {
            return;
        }

        const style =
            document.createElement(
                "style"
            );

        style.id =
            "mwanikiCallRuntimeStyles";

        style.textContent = `
            .mwaniki-call-app {
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                background: #071b1a;
                color: #fff;
                font-family: Inter, system-ui, sans-serif;
            }

            .mwaniki-call-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 18px 24px;
                background: rgba(0,0,0,.25);
            }

            .mwaniki-call-header h1 {
                margin: 0 0 4px;
                font-size: 20px;
            }

            .mwaniki-call-header p {
                margin: 0;
                opacity: .75;
            }

            .mwaniki-call-header button {
                border: 0;
                border-radius: 10px;
                padding: 10px 16px;
                cursor: pointer;
            }

            .mwaniki-video-grid {
                flex: 1;
                display: grid;
                grid-template-columns:
                    repeat(auto-fit, minmax(280px, 1fr));
                gap: 14px;
                padding: 18px;
            }

            .mwaniki-video-tile {
                position: relative;
                min-height: 240px;
                background: #102625;
                border-radius: 16px;
                overflow: hidden;
            }

            .mwaniki-video-tile video {
                width: 100%;
                height: 100%;
                min-height: 240px;
                object-fit: cover;
                display: block;
            }

            .mwaniki-video-name {
                position: absolute;
                left: 12px;
                bottom: 12px;
                padding: 5px 9px;
                border-radius: 8px;
                background: rgba(0,0,0,.6);
            }

            .mwaniki-call-controls {
                display: flex;
                justify-content: center;
                gap: 12px;
                padding: 18px;
                background: rgba(0,0,0,.35);
            }

            .mwaniki-call-controls button {
                width: 52px;
                height: 52px;
                border: 0;
                border-radius: 50%;
                cursor: pointer;
                font-size: 20px;
            }

            .mwaniki-incoming-call,
            .mwaniki-call-picker {
                position: fixed;
                inset: 0;
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0,0,0,.72);
                padding: 20px;
            }

            .mwaniki-incoming-card,
            .mwaniki-call-picker-card {
                width: min(520px, 100%);
                max-height: 90vh;
                overflow: auto;
                background: #fff;
                color: #14201f;
                border-radius: 20px;
                padding: 24px;
                box-shadow: 0 25px 70px rgba(0,0,0,.35);
            }

            .mwaniki-incoming-avatar,
            .online-user-avatar {
                width: 58px;
                height: 58px;
                border-radius: 50%;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #087f73;
                color: #fff;
                font-weight: 700;
            }

            .mwaniki-incoming-avatar {
                margin: 0 auto 14px;
            }

            .mwaniki-incoming-avatar img,
            .online-user-avatar img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .mwaniki-incoming-label {
                text-align: center;
                opacity: .65;
            }

            .mwaniki-incoming-card h3 {
                text-align: center;
                margin: 8px 0 20px;
            }

            .mwaniki-incoming-actions,
            .mwaniki-call-picker-footer {
                display: flex;
                gap: 10px;
                justify-content: center;
                flex-wrap: wrap;
            }

            .mwaniki-incoming-actions button,
            .mwaniki-call-picker-footer button {
                border: 0;
                border-radius: 10px;
                padding: 11px 16px;
                cursor: pointer;
            }

            .mwaniki-call-picker-header {
                display: flex;
                justify-content: space-between;
                gap: 12px;
            }

            .mwaniki-call-picker-header h3 {
                margin: 0;
            }

            .mwaniki-call-picker-header p {
                margin: 4px 0 0;
                opacity: .65;
            }

            .mwaniki-call-picker-header button {
                border: 0;
                background: transparent;
                cursor: pointer;
                font-size: 20px;
            }

            .mwaniki-call-picker-actions {
                display: flex;
                gap: 8px;
                margin: 18px 0;
            }

            .mwaniki-call-picker-actions button {
                border: 1px solid #d8dfde;
                background: #f7f9f9;
                border-radius: 9px;
                padding: 8px 10px;
                cursor: pointer;
            }

            .mwaniki-online-user-list {
                display: grid;
                gap: 8px;
                max-height: 430px;
                overflow: auto;
                margin-bottom: 18px;
            }

            .mwaniki-online-user {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px;
                border: 1px solid #e2e8e7;
                border-radius: 12px;
                cursor: pointer;
            }

            .mwaniki-online-user input {
                width: 18px;
                height: 18px;
            }

            .mwaniki-online-user small {
                display: block;
                color: #087f73;
            }

            .mwaniki-toast {
                position: fixed;
                right: 20px;
                bottom: 20px;
                z-index: 100000;
                padding: 12px 16px;
                border-radius: 10px;
                background: #17201f;
                color: #fff;
                transform: translateY(30px);
                opacity: 0;
                pointer-events: none;
                transition: .2s ease;
            }

            .mwaniki-toast.show {
                transform: translateY(0);
                opacity: 1;
            }
        `;

        document.head.appendChild(
            style
        );
    }


    /* ============================================================
       CALL PAGE INITIALIZATION
       ============================================================ */

    async function initializeCallPage() {
        ensureCallPageUI();

        const params =
            getCallParams();

        if (!params.roomId) {
            setCallStatus(
                "No call room was supplied."
            );

            return;
        }

        let room = null;

        try {
            room =
                await getCallRoom(
                    params.roomId
                );
        } catch (error) {
            console.error(
                "Room loading:",
                error
            );

            setCallStatus(
                "Could not load the call room."
            );

            return;
        }

        if (!room) {
            setCallStatus(
                "Call room not found."
            );

            return;
        }

        state.call.currentRoom =
            room;

        state.call.role =
            params.role;

        state.call.mode =
            params.mode;

        state.call.communityId =
            params.communityId ||
            room.community_id ||
            null;

        state.call.ending =
            false;

        await addCallParticipant(
            room.id,
            state.user.id,
            "joined"
        );

        await updateCallRoom(
            room.id,
            {
                room_status:
                    "active"
            }
        );

        bindCallControls();

        await startLocalMedia(
            params.mode
        );

        await subscribeCallRoom();

        await discoverExistingParticipants();

        state.call.started =
            true;

        setCallStatus(
            "Call connected. Waiting for participants..."
        );
    }


    function setCallStatus(
        message
    ) {
        const status =
            $("mwanikiCallStatus");

        if (status) {
            status.textContent =
                message;
        }

        console.log(
            "📞",
            message
        );
    }


    async function startLocalMedia(
        mode
    ) {
        if (
            !navigator.mediaDevices
                ?.getUserMedia
        ) {
            throw new Error(
                "Your browser does not support microphone access."
            );
        }

        const wantsVideo =
            mode === "video";

        try {
            state.call.localStream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: true,
                        video:
                            wantsVideo
                    });

            state.call.microphoneEnabled =
                true;

            state.call.cameraEnabled =
                wantsVideo;

        } catch (error) {
            console.warn(
                "Requested media unavailable:",
                error
            );

            /*
             * Fall back to audio if camera permission
             * is denied/unavailable.
             */
            try {
                state.call.localStream =
                    await navigator.mediaDevices
                        .getUserMedia({
                            audio: true,
                            video: false
                        });

                state.call.microphoneEnabled =
                    true;

                state.call.cameraEnabled =
                    false;

                if (wantsVideo) {
                    showToast(
                        "Camera was unavailable. Continuing with audio.",
                        "info"
                    );
                }

            } catch (
                audioError
            ) {
                throw audioError;
            }
        }

        renderLocalVideo();
    }


    function renderLocalVideo() {
        const video =
            $("mwanikiLocalVideo");

        if (!video) {
            return;
        }

        video.srcObject =
            state.call.localStream;

        video.muted =
            true;

        video.autoplay =
            true;

        video.playsInline =
            true;

        /*
         * Audio-only calls should not display
         * a blank camera area.
         */
        if (
            !state.call.localStream
                ?.getVideoTracks()
                .length
        ) {
            video.style.display =
                "none";
        }
    }


    /* ============================================================
       WEBRTC ROOM SIGNALING
       ============================================================ */

    async function subscribeCallRoom() {
        const room =
            state.call.currentRoom;

        if (!room) {
            return;
        }

        if (
            state.call.roomChannel
        ) {
            try {
                await db.removeChannel(
                    state.call.roomChannel
                );
            } catch {}
        }

        const channel =
            db.channel(
                `${ROOM_PREFIX}${room.id}`
            );

        channel.on(
            "broadcast",
            {
                event:
                    "peer-ready"
            },
            async event => {
                const payload =
                    event?.payload ||
                    {};

                const sender =
                    payload.sender;

                if (
                    !sender ||
                    String(sender) ===
                        String(
                            state.user.id
                        )
                ) {
                    return;
                }

                await ensurePeerConnection(
                    sender
                );

                await maybeCreateOffer(
                    sender
                );
            }
        );

        channel.on(
            "broadcast",
            {
                event:
                    "offer"
            },
            async event => {
                await handleOffer(
                    event?.payload ||
                    {}
                );
            }
        );

        channel.on(
            "broadcast",
            {
                event:
                    "answer"
            },
            async event => {
                await handleAnswer(
                    event?.payload ||
                    {}
                );
            }
        );

        channel.on(
            "broadcast",
            {
                event:
                    "ice-candidate"
            },
            async event => {
                await handleIceCandidate(
                    event?.payload ||
                    {}
                );
            }
        );

        channel.on(
            "broadcast",
            {
                event:
                    "peer-left"
            },
            event => {
                const userId =
                    event?.payload
                        ?.userId;

                if (userId) {
                    removePeer(
                        userId
                    );
                }
            }
        );

        channel.on(
            "broadcast",
            {
                event:
                    "call-ended"
            },
            event => {
                const userId =
                    event?.payload
                        ?.userId;

                if (
                    String(userId) !==
                    String(
                        state.user.id
                    )
                ) {
                    finishCall(
                        false
                    );
                }
            }
        );

        state.call.roomChannel =
            channel;

        channel.subscribe(
            async status => {
                if (
                    status ===
                    "SUBSCRIBED"
                ) {
                    setCallStatus(
                        "Call signaling connected."
                    );

                    await sendCallBroadcast(
                        "peer-ready",
                        {
                            sender:
                                state.user.id
                        }
                    );

                    /*
                     * Broadcast is ephemeral.
                     * Retry readiness several times.
                     */
                    [1000, 2500, 5000].forEach(
                        delay => {
                            setTimeout(
                                async () => {
                                    if (
                                        state.call
                                            .roomChannel
                                    ) {
                                        await sendCallBroadcast(
                                            "peer-ready",
                                            {
                                                sender:
                                                    state.user
                                                        .id
                                            }
                                        );

                                        await discoverExistingParticipants();
                                    }
                                },
                                delay
                            );
                        }
                    );
                }
            }
        );
    }


    async function discoverExistingParticipants() {
        const roomId =
            state.call.currentRoom
                ?.id;

        if (!roomId) {
            return;
        }

        try {
            const {
                data,
                error
            } = await db
                .from(
                    "chat_call_participants"
                )
                .select("*")
                .eq(
                    "room_id",
                    roomId
                );

            if (error) {
                console.warn(
                    "Participant discovery:",
                    error
                );

                return;
            }

            for (
                const participant
                of safeArray(data)
            ) {
                if (
                    participant.user_id &&
                    String(
                        participant.user_id
                    ) !==
                        String(
                            state.user.id
                        ) &&
                    (
                        participant.status ===
                            "joined" ||
                        participant.status ===
                            "invited"
                    )
                ) {
                    await ensurePeerConnection(
                        participant.user_id
                    );

                    await sendCallBroadcast(
                        "peer-ready",
                        {
                            sender:
                                state.user.id
                        }
                    );

                    await maybeCreateOffer(
                        participant.user_id
                    );
                }
            }

        } catch (error) {
            console.warn(
                "discoverExistingParticipants:",
                error
            );
        }
    }


    async function sendCallBroadcast(
        event,
        payload
    ) {
        if (
            !state.call.roomChannel
        ) {
            return false;
        }

        try {
            await state.call
                .roomChannel
                .send({
                    type:
                        "broadcast",

                    event,

                    payload
                });

            return true;

        } catch (error) {
            console.warn(
                "Call broadcast:",
                error
            );

            return false;
        }
    }


    /* ============================================================
       WEBRTC PEERS
       ============================================================ */

    async function ensurePeerConnection(
        peerId
    ) {
        if (!peerId) {
            return null;
        }

        const existing =
            state.call.peerConnections
                .get(
                    peerId
                );

        if (existing) {
            return existing;
        }

        const configuration = {
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
        };

        const pc =
            new RTCPeerConnection(
                configuration
            );

        state.call.peerConnections.set(
            peerId,
            pc
        );

        state.call.pendingIce.set(
            peerId,
            []
        );

        if (
            state.call.localStream
        ) {
            state.call.localStream
                .getTracks()
                .forEach(
                    track => {
                        try {
                            pc.addTrack(
                                track,
                                state.call
                                    .localStream
                            );
                        } catch {}
                    }
                );
        }

        pc.onicecandidate =
            async event => {
                if (
                    event.candidate
                ) {
                    await sendCallBroadcast(
                        "ice-candidate",
                        {
                            sender:
                                state.user.id,

                            target:
                                peerId,

                            candidate:
                                event.candidate
                        }
                    );
                }
            };

        pc.ontrack =
            event => {
                const stream =
                    event.streams?.[0];

                if (!stream) {
                    return;
                }

                state.call.remoteStreams.set(
                    peerId,
                    stream
                );

                renderRemoteVideo(
                    peerId,
                    stream
                );
            };

        pc.onconnectionstatechange =
            () => {
                const status =
                    pc.connectionState;

                console.log(
                    "📡 Peer connection",
                    peerId,
                    status
                );

                if (
                    status ===
                    "connected"
                ) {
                    setCallStatus(
                        "Call connected."
                    );
                }

                if (
                    status ===
                        "failed" ||
                    status ===
                        "closed"
                ) {
                    removePeer(
                        peerId
                    );
                }
            };

        return pc;
    }


    function shouldOfferTo(
        peerId
    ) {
        return (
            String(
                state.user.id
            ) <
            String(
                peerId
            )
        );
    }


    async function maybeCreateOffer(
        peerId
    ) {
        if (
            !shouldOfferTo(peerId)
        ) {
            return;
        }

        const pc =
            await ensurePeerConnection(
                peerId
            );

        if (!pc) {
            return;
        }

        if (
            pc.signalingState !==
            "stable"
        ) {
            return;
        }

        try {
            const offer =
                await pc.createOffer();

            await pc.setLocalDescription(
                offer
            );

            await sendCallBroadcast(
                "offer",
                {
                    sender:
                        state.user.id,

                    target:
                        peerId,

                    description:
                        pc.localDescription
                }
            );

        } catch (error) {
            console.warn(
                "Offer creation failed:",
                error
            );
        }
    }


    async function handleOffer(
        payload
    ) {
        if (!payload) {
            return;
        }

        if (
            payload.target &&
            String(
                payload.target
            ) !==
                String(
                    state.user.id
                )
        ) {
            return;
        }

        const sender =
            payload.sender;

        if (!sender) {
            return;
        }

        const pc =
            await ensurePeerConnection(
                sender
            );

        try {
            /*
             * Handle simultaneous offers safely.
             */
            if (
                pc.signalingState !==
                    "stable" &&
                pc.signalingState !==
                    "have-local-offer"
            ) {
                return;
            }

            await pc.setRemoteDescription(
                new RTCSessionDescription(
                    payload.description
                )
            );

            await flushPendingIce(
                sender
            );

            const answer =
                await pc.createAnswer();

            await pc.setLocalDescription(
                answer
            );

            await sendCallBroadcast(
                "answer",
                {
                    sender:
                        state.user.id,

                    target:
                        sender,

                    description:
                        pc.localDescription
                }
            );

        } catch (error) {
            console.warn(
                "Offer handling failed:",
                error
            );
        }
    }


    async function handleAnswer(
        payload
    ) {
        if (!payload) {
            return;
        }

        if (
            payload.target &&
            String(
                payload.target
            ) !==
                String(
                    state.user.id
                )
        ) {
            return;
        }

        const sender =
            payload.sender;

        if (!sender) {
            return;
        }

        const pc =
            state.call.peerConnections
                .get(
                    sender
                );

        if (!pc) {
            return;
        }

        try {
            await pc.setRemoteDescription(
                new RTCSessionDescription(
                    payload.description
                )
            );

            await flushPendingIce(
                sender
            );

        } catch (error) {
            console.warn(
                "Answer handling failed:",
                error
            );
        }
    }


    async function handleIceCandidate(
        payload
    ) {
        if (!payload) {
            return;
        }

        if (
            payload.target &&
            String(
                payload.target
            ) !==
                String(
                    state.user.id
                )
        ) {
            return;
        }

        const sender =
            payload.sender;

        if (!sender) {
            return;
        }

        const pc =
            await ensurePeerConnection(
                sender
            );

        /*
         * ICE can arrive BEFORE the remote
         * description. Queue it.
         */
        if (
            !pc.remoteDescription
        ) {
            const queue =
                state.call.pendingIce
                    .get(
                        sender
                    ) || [];

            queue.push(
                payload.candidate
            );

            state.call.pendingIce.set(
                sender,
                queue
            );

            return;
        }

        try {
            await pc.addIceCandidate(
                new RTCIceCandidate(
                    payload.candidate
                )
            );

        } catch (error) {
            console.warn(
                "ICE candidate failed:",
                error
            );
        }
    }


    async function flushPendingIce(
        peerId
    ) {
        const pc =
            state.call.peerConnections
                .get(
                    peerId
                );

        if (
            !pc ||
            !pc.remoteDescription
        ) {
            return;
        }

        const queue =
            state.call.pendingIce
                .get(
                    peerId
                ) || [];

        if (!queue.length) {
            return;
        }

        state.call.pendingIce.set(
            peerId,
            []
        );

        for (
            const candidate
            of queue
        ) {
            try {
                await pc.addIceCandidate(
                    new RTCIceCandidate(
                        candidate
                    )
                );
            } catch (error) {
                console.warn(
                    "Queued ICE candidate failed:",
                    error
                );
            }
        }
    }


    async function renderRemoteVideo(
        peerId,
        stream
    ) {
        const grid =
            $("mwanikiVideoGrid");

        if (!grid) {
            return;
        }

        let tile =
            document.getElementById(
                `mwanikiRemote-${peerId}`
            );

        if (!tile) {
            tile =
                document.createElement(
                    "div"
                );

            tile.id =
                `mwanikiRemote-${peerId}`;

            tile.className =
                "mwaniki-video-tile";

            tile.innerHTML = `
                <video
                    autoplay
                    playsinline
                ></video>

                <span
                    class="mwaniki-video-name"
                >
                    Mwaniki Scholar
                </span>
            `;

            grid.appendChild(
                tile
            );

            try {
                const {
                    data
                } = await db
                    .from(
                        "chat_public_profiles"
                    )
                    .select(
                        "full_name,display_name,username"
                    )
                    .eq(
                        "id",
                        peerId
                    )
                    .maybeSingle();

                const name =
                    displayName(
                        data
                    );

                const label =
                    tile.querySelector(
                        ".mwaniki-video-name"
                    );

                if (label) {
                    label.textContent =
                        name;
                }

            } catch {}
        }

        const video =
            tile.querySelector(
                "video"
            );

        if (video) {
            video.srcObject =
                stream;

            try {
                await video.play();
            } catch {}
        }
    }


    function removePeer(
        peerId
    ) {
        const pc =
            state.call.peerConnections
                .get(
                    peerId
                );

        if (pc) {
            try {
                pc.close();
            } catch {}
        }

        state.call.peerConnections.delete(
            peerId
        );

        state.call.remoteStreams.delete(
            peerId
        );

        state.call.pendingIce.delete(
            peerId
        );

        const tile =
            document.getElementById(
                `mwanikiRemote-${peerId}`
            );

        if (tile) {
            tile.remove();
        }
    }


    /* ============================================================
       CALL CONTROLS
       ============================================================ */

    function bindCallControls() {
        const mic =
            $("mwanikiMicButton");

        const camera =
            $("mwanikiCameraButton");

        const screen =
            $("mwanikiScreenButton");

        const end =
            $("mwanikiEndButton");

        const headerEnd =
            $("mwanikiLeaveCall");

        if (mic) {
            mic.onclick =
                toggleMicrophone;
        }

        if (camera) {
            camera.onclick =
                toggleCamera;
        }

        if (screen) {
            screen.onclick =
                toggleScreenShare;
        }

        if (end) {
            end.onclick =
                () =>
                    finishCall(
                        true
                    );
        }

        if (headerEnd) {
            headerEnd.onclick =
                () =>
                    finishCall(
                        true
                    );
        }
    }


    function toggleMicrophone() {
        const tracks =
            state.call.localStream
                ?.getAudioTracks() ||
            [];

        if (!tracks.length) {
            return;
        }

        state.call.microphoneEnabled =
            !state.call
                .microphoneEnabled;

        tracks.forEach(
            track => {
                track.enabled =
                    state.call
                        .microphoneEnabled;
            }
        );

        const button =
            $("mwanikiMicButton");

        if (button) {
            button.textContent =
                state.call
                    .microphoneEnabled
                    ? "🎙️"
                    : "🔇";
        }
    }


    function toggleCamera() {
        const tracks =
            state.call.localStream
                ?.getVideoTracks() ||
            [];

        if (!tracks.length) {
            showToast(
                "Camera is not available.",
                "error"
            );

            return;
        }

        state.call.cameraEnabled =
            !state.call
                .cameraEnabled;

        tracks.forEach(
            track => {
                track.enabled =
                    state.call
                        .cameraEnabled;
            }
        );

        const button =
            $("mwanikiCameraButton");

        if (button) {
            button.textContent =
                state.call
                    .cameraEnabled
                    ? "📷"
                    : "🚫";
        }
    }


    async function toggleScreenShare() {
        if (
            state.call.screenSharing
        ) {
            await stopScreenShare();

            return;
        }

        if (
            !navigator.mediaDevices
                ?.getDisplayMedia
        ) {
            showToast(
                "Screen sharing is not supported.",
                "error"
            );

            return;
        }

        try {
            const stream =
                await navigator
                    .mediaDevices
                    .getDisplayMedia({
                        video: true
                    });

            state.call.screenStream =
                stream;

            const screenTrack =
                stream.getVideoTracks()[0];

            for (
                const pc
                of state.call
                    .peerConnections
                    .values()
            ) {
                const sender =
                    pc.getSenders()
                        .find(
                            item =>
                                item.track
                                    ?.kind ===
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

            screenTrack.onended =
                () => {
                    stopScreenShare();
                };

            const button =
                $("mwanikiScreenButton");

            if (button) {
                button.textContent =
                    "🛑";
            }

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
                    track =>
                        track.stop()
                );
        }

        state.call.screenStream =
            null;

        state.call.screenSharing =
            false;

        const cameraTrack =
            state.call.localStream
                ?.getVideoTracks()
                ?.[0];

        if (cameraTrack) {
            for (
                const pc
                of state.call
                    .peerConnections
                    .values()
            ) {
                const sender =
                    pc.getSenders()
                        .find(
                            item =>
                                item.track
                                    ?.kind ===
                                "video"
                        );

                if (sender) {
                    try {
                        await sender.replaceTrack(
                            cameraTrack
                        );
                    } catch {}
                }
            }
        }

        const button =
            $("mwanikiScreenButton");

        if (button) {
            button.textContent =
                "🖥️";
        }
    }


    /* ============================================================
       FINISH CALL
       ============================================================ */

    async function finishCall(
        notifyOthers = true
    ) {
        if (
            state.call.ending
        ) {
            return;
        }

        state.call.ending =
            true;

        const roomId =
            state.call.currentRoom
                ?.id;

        if (
            notifyOthers &&
            roomId
        ) {
            await sendCallBroadcast(
                "call-ended",
                {
                    userId:
                        state.user.id
                }
            );
        }

        if (roomId) {
            await updateCallParticipant(
                roomId,
                state.user.id,
                {
                    status:
                        "left",

                    left_at:
                        new Date().toISOString()
                }
            );

            /*
             * Only the room creator should normally
             * end the entire room.
             */
            if (
                String(
                    state.call.currentRoom
                        ?.created_by
                ) ===
                String(
                    state.user.id
                )
            ) {
                await updateCallRoom(
                    roomId,
                    {
                        room_status:
                            "ended"
                    }
                );
            }

            try {
                await db
                    .from(
                        "chat_call_invites"
                    )
                    .update({
                        status:
                            "ended"
                    })
                    .eq(
                        "room_id",
                        roomId
                    )
                    .eq(
                        "sender_id",
                        state.user.id
                    );
            } catch {}
        }

        if (
            state.call.localStream
        ) {
            state.call.localStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );
        }

        if (
            state.call.screenStream
        ) {
            state.call.screenStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );
        }

        for (
            const pc
            of state.call
                .peerConnections
                .values()
        ) {
            try {
                pc.close();
            } catch {}
        }

        state.call.peerConnections.clear();

        state.call.remoteStreams.clear();

        state.call.pendingIce.clear();

        if (
            state.call.roomChannel
        ) {
            try {
                await db.removeChannel(
                    state.call.roomChannel
                );
            } catch {}
        }

        state.call.roomChannel =
            null;

        state.call.localStream =
            null;

        state.call.screenStream =
            null;

        state.call.currentRoom =
            null;

        state.call.currentInvite =
            null;

        if (isCallPage()) {
            window.location.href =
                "./community.html";
        }
    }


    /* ============================================================
       CALL BUTTONS
       ============================================================ */

    function updateCallButtons() {
        const general =
            $("generalCallButton");

        const community =
            $("communityCallButton");

        if (general) {
            general.onclick =
                openGeneralCallPicker;
        }

        if (community) {
            community.onclick =
                () => {
                    if (
                        state.currentCommunity
                    ) {
                        startCommunityCall(
                            state
                                .currentCommunity
                                .id,
                            "audio"
                        );
                    }
                };
        }
    }


    /* ============================================================
       SEARCH
       ============================================================ */

    function setupSearch() {
        const input =
            $("messageSearch");

        if (input) {
            input.addEventListener(
                "input",
                () => {
                    state.messageSearch =
                        input.value;

                    renderMessages();
                }
            );
        }

        const memberInput =
            $("memberSearch");

        if (memberInput) {
            memberInput.addEventListener(
                "input",
                () => {
                    state.memberSearch =
                        memberInput.value;

                    renderMembers();
                }
            );
        }

        const channelInput =
            $("channelSearch");

        if (channelInput) {
            channelInput.addEventListener(
                "input",
                () => {
                    state.channelSearch =
                        channelInput.value;

                    filterChannels();
                }
            );
        }
    }


    function filterChannels() {
        const query =
            state.channelSearch
                .toLowerCase()
                .trim();

        document
            .querySelectorAll(
                ".channel-item"
            )
            .forEach(
                item => {
                    const text =
                        item.textContent
                            .toLowerCase();

                    item.hidden =
                        Boolean(
                            query &&
                            !text.includes(
                                query
                            )
                        );
                }
            );
    }


    /* ============================================================
       UI EVENTS
       ============================================================ */

    function bindUI() {
        const send =
            $("sendMessageButton");

        if (send) {
            send.onclick =
                sendMessage;
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

        const voice =
            $("voiceNoteButton");

        if (voice) {
            voice.onclick =
                toggleVoiceRecording;
        }

        bindAttachmentInput();

        setupEmojiPanel();

        setupStickerPanel();

        setupGifPanel();

        setupSearch();

        const memberButton =
            $("channelMembersButton");

        if (memberButton) {
            memberButton.onclick =
                () => {
                    const sidebar =
                        $("memberSidebar");

                    if (sidebar) {
                        sidebar.classList.toggle(
                            "open"
                        );
                    }
                };
        }

        const home =
            $("communityHomeButton");

        if (home) {
            home.onclick =
                () => {
                    const main =
                        findMainCommunity();

                    if (main) {
                        selectCommunity(
                            main.id
                        );
                    }
                };
        }

        const rules =
            $("communityRulesButton");

        if (rules) {
            rules.onclick =
                openRulesModal;
        }

        const friends =
            $("friendsButton");

        if (friends) {
            friends.onclick =
                openFriendsModal;
        }

        const profile =
            $("profileButton");

        if (profile) {
            profile.onclick =
                openProfileModal;
        }

        const ticket =
            $("ticketButton");

        if (ticket) {
            ticket.onclick =
                openTicketModal;
        }

        const contest =
            $("contestButton");

        if (contest) {
            contest.onclick =
                openContestModal;
        }

        document.addEventListener(
            "click",
            event => {
                if (
                    !event.target.closest(
                        "#emojiPanel"
                    ) &&
                    !event.target.closest(
                        "#emojiButton"
                    )
                ) {
                    closeEmojiPanel();
                }

                if (
                    !event.target.closest(
                        "#stickerPanel"
                    ) &&
                    !event.target.closest(
                        "#stickerButton"
                    )
                ) {
                    closeStickerPanel();
                }

                if (
                    !event.target.closest(
                        "#gifPanel"
                    ) &&
                    !event.target.closest(
                        "#gifButton"
                    )
                ) {
                    closeGifPanel();
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

                    removeCallPicker();
                }
            }
        );
    }


    /* ============================================================
       BASIC MODALS
       ============================================================ */

    function openRulesModal() {
        const modal =
            $("rulesModal");

        if (!modal) {
            return;
        }

        const content =
            $("rulesContent");

        if (content) {
            content.innerHTML = `
                <h3>
                    Community Rules
                </h3>

                <ol>
                    <li>
                        Respect other Mwaniki Scholars.
                    </li>

                    <li>
                        Keep discussions academic and constructive.
                    </li>

                    <li>
                        No spam or harassment.
                    </li>

                    <li>
                        Do not share private information.
                    </li>

                    <li>
                        Use the appropriate channel.
                    </li>
                </ol>
            `;
        }

        openElement(
            modal
        );
    }


    function openFriendsModal() {
        const modal =
            $("friendsModal");

        if (!modal) {
            return;
        }

        const content =
            $("friendsContent");

        if (content) {
            content.innerHTML = `
                <p>
                    Friends and friend requests
                    are available from your
                    Mwaniki Scholars profile.
                </p>
            `;
        }

        openElement(
            modal
        );
    }


    function openProfileModal() {
        const modal =
            $("profileModal");

        if (!modal) {
            return;
        }

        const content =
            $("profileModalContent");

        if (content) {
            const name =
                displayName(
                    state.profile
                );

            const avatar =
                avatarURL(
                    state.profile
                );

            content.innerHTML = `
                <div class="profile-preview">
                    ${
                        avatar
                            ? `
                                <img
                                    src="${escapeHTML(
                                        avatar
                                    )}"
                                    alt="${escapeHTML(
                                        name
                                    )}"
                                >
                            `
                            : `
                                <div>
                                    ${escapeHTML(
                                        initialsForName(
                                            name
                                        )
                                    )}
                                </div>
                            `
                    }

                    <h3>
                        ${escapeHTML(
                            name
                        )}
                    </h3>

                    <p>
                        ${escapeHTML(
                            state.user?.email ||
                            ""
                        )}
                    </p>
                </div>
            `;
        }

        openElement(
            modal
        );
    }


    function openTicketModal() {
        const modal =
            $("ticketModal");

        if (!modal) {
            return;
        }

        openElement(
            modal
        );
    }


    function openContestModal() {
        const modal =
            $("contestModal");

        if (!modal) {
            return;
        }

        const courseName =
            $("contestCourseName");

        if (courseName) {
            courseName.textContent =
                state.currentChannel
                    ? channelName(
                          state.currentChannel
                      )
                    : "Mwaniki Scholars";
        }

        openElement(
            modal
        );
    }


    function setupModalClosers() {
        document.addEventListener(
            "click",
            event => {
                const target =
                    event.target;

                if (
                    target.matches(
                        "[data-close-modal]"
                    )
                ) {
                    const modalId =
                        target.dataset
                            .closeModal;

                    closeElement(
                        $(modalId)
                    );
                }
            }
        );
    }


    /* ============================================================
       AUTH LISTENER
       ============================================================ */

    function setupAuthListener() {
        db.auth.onAuthStateChange(
            async (
                event,
                session
            ) => {
                if (
                    session?.user
                ) {
                    state.user =
                        session.user;

                    await loadCurrentProfile();

                    if (
                        event ===
                            "SIGNED_IN" ||
                        !state.incomingChannel
                    ) {
                        await startPresence();

                        await subscribeIncomingCalls();
                    }
                } else {
                    state.user =
                        null;

                    state.profile =
                        null;
                }
            }
        );
    }


    /* ============================================================
       INITIALIZATION
       ============================================================ */

    async function initializeCommunity() {
        if (
            state.initialized
        ) {
            return;
        }

        state.initialized =
            true;

        const authenticated =
            await requireAuthentication();

        if (!authenticated) {
            return;
        }

        bindUI();

        setupModalClosers();

        setupAuthListener();

        await startPresence();

        await subscribeIncomingCalls();

        await loadCourses();

        await loadCommunities();

        /*
         * MAIN COMMUNITY FIRST.
         *
         * This deliberately prevents Mwaniki Gaming
         * or Mwaniki Memes from opening first.
         */
        const main =
            findMainCommunity();

        if (main) {
            await selectCommunity(
                main.id
            );
        }

        updateCallButtons();

        console.log(
            "✅ Mwaniki Scholars Community ready."
        );
    }


    /* ============================================================
       GLOBAL API
       ============================================================ */

    window.MwanikiCommunity = {
        state,

        selectCommunity,

        selectChannel,

        loadMembers,

        loadCommunities,

        loadChannels,

        loadMessages,

        sendMessage,

        deleteMessage,

        startDirectCall,

        startCommunityCall,

        openGeneralCallPicker,

        startGeneralCall,

        getOnlineUsers,

        acceptIncomingCall,

        declineIncomingCall,

        finishCall
    };


    /*
     * BACKWARDS COMPATIBILITY
     *
     * Existing buttons or old code can continue using:
     *
     * window.MwanikiCalls.callUser(...)
     */

    window.MwanikiCalls = {
        callUser:
            startDirectCall,

        callCommunity:
            startCommunityCall,

        openPicker:
            openGeneralCallPicker,

        generalCall:
            startGeneralCall,

        leave:
            () =>
                finishCall(
                    true
                ),

        getOnlineUsers
    };


    /* ============================================================
       START
       ============================================================ */

    if (isCallPage()) {
        /*
         * The exact same community.js controls the
         * call page. There is no second call engine.
         */
        (async () => {
            const authenticated =
                await requireAuthentication();

            if (!authenticated) {
                return;
            }

            await initializeCallPage();
        })();

    } else {
        initializeCommunity();
    }

})();
