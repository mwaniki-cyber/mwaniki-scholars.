/* ============================================================
   MWANIKI SCHOLARS COMMUNITY
   ============================================================
   FILE: community.js

   ONE CONSOLIDATED COMMUNITY + CALL ENGINE

   Requires:
       ./supabase.js

   HTML:
       <script type="module" src="./supabase.js"></script>
       <script type="module" src="./community.js"></script>

   Do NOT load community-calls.js separately.
   ============================================================ */

import { supabase } from "./supabase.js";

(() => {
    "use strict";

    /* ========================================================
       SUPABASE
       ======================================================== */

    const db = supabase;

    console.log("🚀 Mwaniki Scholars Community starting...");
    console.log("✅ Supabase client ready");


    /* ========================================================
       CONSTANTS
       ======================================================== */

    const CALL_PAGE = "./community-calls.html";

    const CALL_RING_TIMEOUT = 45000;

    const PRESENCE_TIMEOUT = 120000;

    const ROOM_PREFIX = "mwaniki-call-";

    const INCOMING_PREFIX = "mwaniki-incoming-";

    const MESSAGE_PAGE_SIZE = 80;

    const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

    const VOICE_MIME_TYPES = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4"
    ];

    const EMOJIS = [
        "😀","😃","😄","😁","😆","😅","😂","🤣",
        "😊","😇","🙂","🙃","😉","😌","😍","🥰",
        "😘","😗","😙","😚","😋","😛","😝","😜",
        "🤪","🤨","🧐","🤓","😎","🤩","🥳","😏",
        "😒","😞","😔","😟","😕","🙁","☹️","😣",
        "😖","😫","😩","🥺","😢","😭","😤","😠",
        "😡","🤬","🤯","😳","🥵","🥶","😱","😨",
        "😰","😥","😓","🤗","🤔","🤭","🤫","🤥",
        "😶","😐","😑","😬","🙄","😯","😦","😧",
        "😮","😲","🥱","😴","🤤","😪","😵","🤐",
        "🤢","🤮","🤧","😷","🤒","🤕","👍","👎",
        "👏","🙌","🙏","🤝","💪","❤️","🧡","💛",
        "💚","💙","💜","🖤","🤍","🤎","💔","🔥",
        "⭐","🎉","🎊","💯","😂","🤣","😭","😅"
    ];


    /* ========================================================
       STATE
       ======================================================== */

    const state = {
        user: null,
        profile: null,

        communities: [],
        courses: [],
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

        communityRealtime: null,
        messageRealtime: null,
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

            peerConnections: new Map(),
            remoteStreams: new Map(),
            pendingIce: new Map(),

            roomChannel: null,

            microphoneEnabled: true,
            cameraEnabled: true,
            screenSharing: false,

            started: false,
            ending: false
        }
    };


    /* ========================================================
       GENERIC HELPERS
       ======================================================== */

    function $(id) {
        return document.getElementById(id);
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
        const parts = String(name || "User")
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        if (!parts.length) {
            return "U";
        }

        if (parts.length === 1) {
            return parts[0].slice(0, 2).toUpperCase();
        }

        return (
            parts[0][0] +
            parts[parts.length - 1][0]
        ).toUpperCase();
    }


    function randomId(length = 12) {
        const chars =
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

        let output = "";

        for (let i = 0; i < length; i++) {
            output += chars[
                Math.floor(Math.random() * chars.length)
            ];
        }

        return output;
    }


    function generateRoomCode() {
        return (
            ROOM_PREFIX +
            Date.now().toString(36) +
            "-" +
            randomId(10)
        );
    }


    function displayName(profile) {
        if (!profile) {
            return "Mwaniki Scholar";
        }

        return (
            profile.full_name ||
            profile.display_name ||
            profile.username ||
            profile.name ||
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
            profile.avatar ||
            profile.image_url ||
            ""
        );
    }


    function formatTime(value) {
        if (!value) {
            return "";
        }

        try {
            return new Date(value).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            });
        } catch {
            return "";
        }
    }


    function showToast(message, type = "info") {
        const toast = $("toast");

        if (!toast) {
            console.log(`[${type}] ${message}`);
            return;
        }

        toast.textContent = message;
        toast.className = `toast ${type} show`;

        clearTimeout(showToast.timer);

        showToast.timer = setTimeout(() => {
            toast.classList.remove("show");
        }, 3500);
    }


    function openElement(element) {
        if (!element) return;

        element.hidden = false;
        element.classList.add("open");
        element.classList.remove("hidden");
    }


    function closeElement(element) {
        if (!element) return;

        element.hidden = true;
        element.classList.remove("open");
        element.classList.add("hidden");
    }


    function safeArray(value) {
        return Array.isArray(value) ? value : [];
    }


    /* ========================================================
       PROFILE
       ======================================================== */

    async function loadCurrentProfile() {
        if (!state.user?.id) {
            return null;
        }

        let profile = null;

        try {
            const result = await db
                .from("chat_public_profiles")
                .select("*")
                .eq("id", state.user.id)
                .maybeSingle();

            if (!result.error && result.data) {
                profile = result.data;
            }
        } catch (error) {
            console.warn("Public profile lookup failed:", error);
        }

        if (!profile) {
            try {
                const result = await db
                    .from("students")
                    .select("*")
                    .eq("id", state.user.id)
                    .maybeSingle();

                if (!result.error && result.data) {
                    profile = result.data;
                }
            } catch (error) {
                console.warn("Student profile lookup failed:", error);
            }
        }

        state.profile = profile || {
            id: state.user.id,
            full_name:
                state.user.user_metadata?.full_name ||
                state.user.user_metadata?.name ||
                state.user.email?.split("@")[0] ||
                "Mwaniki Scholar",
            avatar_url:
                state.user.user_metadata?.avatar_url ||
                ""
        };

        renderHeaderProfile();

        return state.profile;
    }


    function renderHeaderProfile() {
        const nameElement = $("headerProfileName");
        const avatarElement = $("headerProfileAvatar");
        const presenceDot = $("headerPresenceDot");

        const name = displayName(state.profile);
        const avatar = avatarURL(state.profile);

        if (nameElement) {
            nameElement.textContent = name;
        }

        if (avatarElement) {
            if (avatar) {
                avatarElement.src = avatar;
                avatarElement.alt = name;
            } else {
                avatarElement.removeAttribute("src");
                avatarElement.alt = name;
                avatarElement.dataset.initials =
                    initialsForName(name);
            }
        }

        if (presenceDot) {
            presenceDot.classList.add("online");
        }
    }


    /* ========================================================
       AUTH
       ======================================================== */

    async function getSession() {
        const {
            data,
            error
        } = await db.auth.getSession();

        if (error) {
            console.error("❌ Session error:", error);
            return null;
        }

        return data?.session || null;
    }


    async function requireAuthentication() {
        const session = await getSession();

        if (!session?.user) {
            console.warn("⚠️ No authenticated user.");

            showToast(
                "You must be signed in to use the community.",
                "error"
            );

            return false;
        }

        state.user = session.user;

        await loadCurrentProfile();

        return true;
    }


    /* ========================================================
       COURSES
       ======================================================== */

    async function loadCourses() {
        try {
            const {
                data,
                error
            } = await db
                .from("courses")
                .select("*")
                .order("id", {
                    ascending: true
                });

            if (error) {
                console.warn("Course loading failed:", error);
                state.courses = [];
                return [];
            }

            state.courses = data || [];

            return state.courses;

        } catch (error) {
            console.error("loadCourses:", error);
            state.courses = [];
            return [];
        }
    }


    /* ========================================================
       COMMUNITIES
       ======================================================== */

    async function loadCommunities() {
        try {
            const {
                data,
                error
            } = await db
                .from("chat_communities")
                .select("*")
                .eq("is_active", true)
                .order("name", {
                    ascending: true
                });

            if (error) {
                console.error(
                    "❌ Communities query failed:",
                    error
                );

                state.communities = [];

                return [];
            }

            state.communities = data || [];

            console.log(
                "🏠 Communities loaded:",
                state.communities.length
            );

            renderCommunityRail();

            return state.communities;

        } catch (error) {
            console.error("loadCommunities:", error);

            state.communities = [];

            return [];
        }
    }


    function findMainCommunity() {
        return (
            state.communities.find(
                community =>
                    String(community.name || "")
                        .toLowerCase()
                        .includes("mwaniki scholars")
            ) ||
            state.communities.find(
                community =>
                    String(community.slug || "")
                        .toLowerCase()
                        .includes("scholar")
            ) ||
            state.communities[0] ||
            null
        );
    }


    function renderCommunityRail() {
        const rail = $("communityRailList");

        if (!rail) {
            return;
        }

        if (!state.communities.length) {
            rail.innerHTML = `
                <div class="empty-communities">
                    No communities available.
                </div>
            `;

            return;
        }

        rail.innerHTML = state.communities
            .map(community => {
                const active =
                    state.currentCommunity?.id === community.id;

                const name =
                    community.name ||
                    "Community";

                const icon =
                    community.icon_url ||
                    community.image ||
                    "";

                return `
                    <button
                        type="button"
                        class="community-rail-item ${active ? "active" : ""}"
                        data-community-id="${escapeHTML(community.id)}"
                        title="${escapeHTML(name)}"
                    >
                        ${
                            icon
                                ? `
                                    <img
                                        src="${escapeHTML(icon)}"
                                        alt="${escapeHTML(name)}"
                                    >
                                `
                                : `
                                    <span>
                                        ${escapeHTML(
                                            initialsForName(name)
                                        )}
                                    </span>
                                `
                        }
                    </button>
                `;
            })
            .join("");

        rail
            .querySelectorAll("[data-community-id]")
            .forEach(button => {
                button.addEventListener("click", () => {
                    selectCommunity(
                        button.dataset.communityId
                    );
                });
            });
    }


    async function selectCommunity(communityId) {
        const community =
            state.communities.find(
                item =>
                    String(item.id) === String(communityId)
            );

        if (!community) {
            return;
        }

        state.currentCommunity = community;

        updateSelectedCommunityUI();

        renderCommunityRail();

        await cleanupCommunityRealtime();

        await loadChannels();

        /*
         * IMPORTANT:
         *
         * Members are loaded independently of presence.
         * This prevents "zero members" when nobody is online.
         */
        await loadMembers();

        await subscribeCommunityRealtime();

        /*
         * Prefer Mwaniki Scholars discussion/general channel.
         */
        const preferred =
            findPreferredChannel();

        if (preferred) {
            await selectChannel(preferred.id);
        }

        updateCallButtons();

        console.log(
            "✅ Community selected:",
            community.name
        );
    }


    function updateSelectedCommunityUI() {
        const community =
            state.currentCommunity;

        if (!community) {
            return;
        }

        const name = $("selectedCommunityName");
        const description =
            $("selectedCommunityDescription");
        const icon =
            $("selectedCommunityIcon");

        if (name) {
            name.textContent =
                community.name ||
                "Mwaniki Scholars";
        }

        if (description) {
            description.textContent =
                community.description ||
                "Academic community";
        }

        if (icon) {
            const image =
                community.icon_url ||
                community.image ||
                "";

            if (image) {
                icon.src = image;
            }
        }
    }


    /* ========================================================
       CHANNELS
       ======================================================== */

    async function loadChannels() {
        if (!state.currentCommunity?.id) {
            state.channels = [];
            renderChannels();
            return [];
        }

        try {
            const {
                data,
                error
            } = await db
                .from("chat_channels")
                .select("*")
                .eq(
                    "community_id",
                    state.currentCommunity.id
                )
                .order("position", {
                    ascending: true,
                    nullsFirst: false
                })
                .order("created_at", {
                    ascending: true
                });

            if (error) {
                console.error(
                    "❌ Channels query failed:",
                    error
                );

                state.channels = [];

                renderChannels();

                return [];
            }

            state.channels = data || [];

            renderChannels();

            return state.channels;

        } catch (error) {
            console.error("loadChannels:", error);

            state.channels = [];

            renderChannels();

            return [];
        }
    }


    function channelName(channel) {
        return (
            channel.name ||
            channel.title ||
            "discussion"
        );
    }


    function channelType(channel) {
        return String(
            channel.type ||
            channel.channel_type ||
            channel.category ||
            ""
        ).toLowerCase();
    }


    function isInformationChannel(channel) {
        const name =
            channelName(channel).toLowerCase();

        const type =
            channelType(channel);

        return (
            type.includes("info") ||
            name.includes("general") ||
            name.includes("rules") ||
            name.includes("announcement")
        );
    }


    function isCourseChannel(channel) {
        return Boolean(
            channel.course_id ||
            channel.linked_course_id
        );
    }


    function renderChannelGroup(
        elementId,
        channels
    ) {
        const element = $(elementId);

        if (!element) {
            return;
        }

        if (!channels.length) {
            element.innerHTML = "";
            return;
        }

        element.innerHTML = channels
            .map(channel => {
                const active =
                    state.currentChannel?.id ===
                    channel.id;

                const name =
                    channelName(channel);

                return `
                    <button
                        type="button"
                        class="channel-item ${active ? "active" : ""}"
                        data-channel-id="${escapeHTML(channel.id)}"
                    >
                        <span class="channel-hash">#</span>
                        <span class="channel-name">
                            ${escapeHTML(name)}
                        </span>
                    </button>
                `;
            })
            .join("");

        element
            .querySelectorAll("[data-channel-id]")
            .forEach(button => {
                button.addEventListener("click", () => {
                    selectChannel(
                        button.dataset.channelId
                    );
                });
            });
    }


    function renderChannels() {
        const information =
            state.channels.filter(
                isInformationChannel
            );

        const course =
            state.channels.filter(
                channel =>
                    isCourseChannel(channel) &&
                    !isInformationChannel(channel)
            );

        const community =
            state.channels.filter(
                channel =>
                    !isInformationChannel(channel) &&
                    !isCourseChannel(channel)
            );

        renderChannelGroup(
            "informationChannels",
            information
        );

        renderChannelGroup(
            "courseChannels",
            course
        );

        renderChannelGroup(
            "communityChannels",
            community
        );

        const contest =
            $("contestChannelButton");

        if (contest) {
            contest.onclick = () => {
                openContestModal();
            };
        }
    }


    function findPreferredChannel() {
        if (!state.channels.length) {
            return null;
        }

        const candidates = [
            "general",
            "discussion",
            "mwaniki-scholars",
            "chat",
            "main"
        ];

        for (const candidate of candidates) {
            const found =
                state.channels.find(
                    channel =>
                        channelName(channel)
                            .toLowerCase()
                            .replace(/\s+/g, "-")
                            === candidate
                );

            if (found) {
                return found;
            }
        }

        /*
         * Avoid opening Gaming or Memes by default.
         */
        const academic =
            state.channels.find(channel => {
                const name =
                    channelName(channel)
                        .toLowerCase();

                return (
                    !name.includes("gaming") &&
                    !name.includes("meme") &&
                    !name.includes("game")
                );
            });

        return academic || state.channels[0];
    }


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

        state.currentChannel = channel;

        renderChannels();

        const icon =
            $("currentChannelIcon");

        const name =
            $("currentChannelName");

        const description =
            $("currentChannelDescription");

        if (icon) {
            icon.textContent = "#";
        }

        if (name) {
            name.textContent =
                channelName(channel);
        }

        if (description) {
            description.textContent =
                channel.description ||
                "Mwaniki Scholars discussion channel";
        }

        await loadMessages();

        await markChannelRead(channel.id);

        await subscribeMessageRealtime();

        closeEmojiPanel();

        closeStickerPanel();

        closeGifPanel();
    }


    /* ========================================================
       MEMBERS
       ======================================================== */

    async function loadMembers() {
        if (!state.currentCommunity?.id) {
            state.members = [];
            renderMembers();
            return [];
        }

        const communityId =
            state.currentCommunity.id;

        console.log(
            "👥 Loading registered members:",
            communityId
        );

        try {
            /*
             * DO NOT use chat_presence here.
             *
             * chat_community_members is the source of truth
             * for who belongs to the community.
             */
            const {
                data: membershipRows,
                error: memberError
            } = await db
                .from("chat_community_members")
                .select("*")
                .eq(
                    "community_id",
                    communityId
                );

            if (memberError) {
                console.error(
                    "❌ Community members query failed:",
                    memberError
                );

                state.members = [];

                renderMembers();

                return [];
            }

            const rows =
                membershipRows || [];

            console.log(
                "👥 Membership rows:",
                rows.length
            );

            if (!rows.length) {
                state.members = [];

                renderMembers();

                return [];
            }

            const userIds = [
                ...new Set(
                    rows
                        .map(
                            row =>
                                row.user_id ||
                                row.profile_id
                        )
                        .filter(Boolean)
                )
            ];

            let profiles = [];

            if (userIds.length) {
                const {
                    data,
                    error
                } = await db
                    .from("chat_public_profiles")
                    .select("*")
                    .in("id", userIds);

                if (error) {
                    console.warn(
                        "⚠️ Public profile lookup failed:",
                        error
                    );
                } else {
                    profiles = data || [];
                }
            }

            const profileMap =
                new Map(
                    profiles.map(
                        profile => [
                            profile.id,
                            profile
                        ]
                    )
                );

            state.members =
                rows.map(member => {
                    const userId =
                        member.user_id ||
                        member.profile_id;

                    const profile =
                        profileMap.get(userId) ||
                        null;

                    return {
                        ...member,

                        user_id: userId,

                        id: userId,

                        profile,

                        name:
                            profile?.full_name ||
                            profile?.display_name ||
                            profile?.username ||
                            profile?.name ||
                            "Mwaniki Scholar",

                        avatar:
                            profile?.avatar_url ||
                            profile?.photo_url ||
                            profile?.avatar ||
                            "",

                        role:
                            member.role ||
                            profile?.role ||
                            "Student"
                    };
                });

            console.log(
                "✅ Registered community members:",
                state.members.length
            );

            renderMembers();

            await updateMemberPresenceDots();

            return state.members;

        } catch (error) {
            console.error(
                "❌ loadMembers() failed:",
                error
            );

            state.members = [];

            renderMembers();

            return [];
        }
    }


    function renderMembers() {
        const list =
            $("memberList");

        const count =
            $("memberCount");

        if (!list) {
            return;
        }

        let members =
            Array.isArray(state.members)
                ? state.members
                : [];

        if (state.memberSearch) {
            const query =
                state.memberSearch
                    .toLowerCase()
                    .trim();

            members =
                members.filter(member =>
                    String(
                        member.name || ""
                    )
                        .toLowerCase()
                        .includes(query)
                );
        }

        if (count) {
            count.textContent =
                String(state.members.length);
        }

        if (!members.length) {
            list.innerHTML = `
                <div class="empty-members">
                    No registered members found.
                </div>
            `;

            return;
        }

        list.innerHTML =
            members
                .map(member => {
                    const name =
                        member.name ||
                        "Mwaniki Scholar";

                    const avatar =
                        member.avatar || "";

                    const userId =
                        member.user_id ||
                        member.id ||
                        "";

                    return `
                        <div
                            class="member-row"
                            data-user-id="${escapeHTML(userId)}"
                        >
                            <div class="member-avatar">
                                ${
                                    avatar
                                        ? `
                                            <img
                                                src="${escapeHTML(avatar)}"
                                                alt="${escapeHTML(name)}"
                                            >
                                        `
                                        : `
                                            <span>
                                                ${escapeHTML(
                                                    initialsForName(name)
                                                )}
                                            </span>
                                        `
                                }

                                <span
                                    class="member-presence-dot"
                                    data-presence-user="${escapeHTML(userId)}"
                                ></span>
                            </div>

                            <div class="member-info">
                                <strong>
                                    ${escapeHTML(name)}
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
                                userId !== state.user?.id
                                    ? `
                                        <button
                                            type="button"
                                            class="member-call-button"
                                            data-call-user="${escapeHTML(userId)}"
                                            title="Call ${escapeHTML(name)}"
                                        >
                                            📞
                                        </button>
                                    `
                                    : ""
                            }
                        </div>
                    `;
                })
                .join("");

        list
            .querySelectorAll(
                "[data-call-user]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    event => {
                        event.stopPropagation();

                        startDirectCall(
                            button.dataset.callUser,
                            "audio"
                        );
                    }
                );
            });

        updateMemberPresenceDots();
    }


    /* ========================================================
       PRESENCE
       ======================================================== */

    async function updateOwnPresence(
        status = "online"
    ) {
        if (!state.user?.id) {
            return;
        }

        try {
            const payload = {
                user_id: state.user.id,
                status,
                last_seen: new Date().toISOString()
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
                    "Presence update failed:",
                    error
                );
            }

        } catch (error) {
            console.warn(
                "Presence error:",
                error
            );
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
                    "user_id,status,last_seen"
                )
                .eq("status", "online");

            if (error) {
                console.warn(
                    "Online presence query failed:",
                    error
                );

                return [];
            }

            const now =
                Date.now();

            return safeArray(data)
                .filter(row => {
                    if (
                        !row.user_id ||
                        row.user_id ===
                            state.user?.id
                    ) {
                        return false;
                    }

                    if (!row.last_seen) {
                        return true;
                    }

                    const age =
                        now -
                        new Date(
                            row.last_seen
                        ).getTime();

                    return (
                        age <
                        PRESENCE_TIMEOUT
                    );
                })
                .map(row => row.user_id);

        } catch (error) {
            console.warn(
                "getOnlineUserIds:",
                error
            );

            return [];
        }
    }


    async function updateMemberPresenceDots() {
        const onlineIds =
            await getOnlineUserIds();

        document
            .querySelectorAll(
                "[data-presence-user]"
            )
            .forEach(dot => {
                const userId =
                    dot.dataset.presenceUser;

                dot.classList.toggle(
                    "online",
                    onlineIds.includes(userId)
                );

                dot.classList.toggle(
                    "offline",
                    !onlineIds.includes(userId)
                );
            });
    }


    async function startPresence() {
        await updateOwnPresence(
            "online"
        );

        clearInterval(
            state.presenceTimer
        );

        state.presenceTimer =
            setInterval(() => {
                updateOwnPresence("online");
                updateMemberPresenceDots();
            }, 60000);

        if (state.presenceChannel) {
            try {
                await db.removeChannel(
                    state.presenceChannel
                );
            } catch {}
        }

        state.presenceChannel =
            db.channel(
                `mwaniki-presence-${state.user.id}`
            );

        state.presenceChannel
            .on(
                "presence",
                {
                    event: "sync"
                },
                () => {
                    updateMemberPresenceDots();
                }
            )
            .subscribe();
    }


    /* ========================================================
       MESSAGES
       ======================================================== */

    async function loadMessages() {
        if (
            !state.currentChannel?.id
        ) {
            state.messages = [];

            renderMessages();

            return [];
        }

        const channelId =
            state.currentChannel.id;

        const loading =
            $("messageLoading");

        if (loading) {
            loading.hidden = false;
        }

        try {
            const {
                data,
                error
            } = await db
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
                .limit(
                    MESSAGE_PAGE_SIZE
                );

            if (error) {
                console.error(
                    "❌ Messages query failed:",
                    error
                );

                state.messages = [];

                renderMessages();

                return [];
            }

            state.messages =
                data || [];

            /*
             * Enrich message authors.
             */
            await enrichMessageProfiles();

            renderMessages();

            return state.messages;

        } catch (error) {
            console.error(
                "loadMessages:",
                error
            );

            state.messages = [];

            renderMessages();

            return [];

        } finally {
            if (loading) {
                loading.hidden = true;
            }
        }
    }


    async function enrichMessageProfiles() {
        const userIds = [
            ...new Set(
                state.messages
                    .map(
                        message =>
                            message.user_id ||
                            message.sender_id ||
                            message.created_by
                    )
                    .filter(Boolean)
            )
        ];

        if (!userIds.length) {
            return;
        }

        try {
            const {
                data
            } = await db
                .from("chat_public_profiles")
                .select("*")
                .in("id", userIds);

            const profiles =
                new Map(
                    safeArray(data).map(
                        profile => [
                            profile.id,
                            profile
                        ]
                    )
                );

            state.messages =
                state.messages.map(
                    message => {
                        const id =
                            message.user_id ||
                            message.sender_id ||
                            message.created_by;

                        return {
                            ...message,
                            profile:
                                profiles.get(id) ||
                                null
                        };
                    }
                );

        } catch (error) {
            console.warn(
                "Message profile enrichment failed:",
                error
            );
        }
    }


    function renderMessages() {
        const list =
            $("messageList");

        if (!list) {
            return;
        }

        let messages =
            Array.isArray(state.messages)
                ? state.messages
                : [];

        if (state.messageSearch) {
            const query =
                state.messageSearch
                    .toLowerCase()
                    .trim();

            messages =
                messages.filter(message =>
                    String(
                        message.content ||
                        message.message ||
                        ""
                    )
                        .toLowerCase()
                        .includes(query)
                );
        }

        if (!messages.length) {
            list.innerHTML = `
                <div class="empty-messages">
                    No messages yet. Start the discussion.
                </div>
            `;

            return;
        }

        list.innerHTML =
            messages
                .map(
                    message =>
                        renderMessage(message)
                )
                .join("");

        bindMessageActions();

        list.scrollTop =
            list.scrollHeight;
    }


    function renderMessage(message) {
        const senderId =
            message.user_id ||
            message.sender_id ||
            message.created_by ||
            "";

        const profile =
            message.profile;

        const name =
            profile
                ? displayName(profile)
                : (
                    senderId ===
                    state.user?.id
                        ? displayName(
                            state.profile
                        )
                        : "Mwaniki Scholar"
                );

        const avatar =
            profile
                ? avatarURL(profile)
                : "";

        const content =
            message.content ??
            message.message ??
            "";

        const created =
            message.created_at;

        const own =
            senderId ===
            state.user?.id;

        const deleted =
            message.deleted === true ||
            message.is_deleted === true;

        const attachmentUrl =
            message.file_url ||
            message.attachment_url ||
            message.url ||
            "";

        const attachmentName =
            message.file_name ||
            message.attachment_name ||
            "";

        return `
            <article
                class="chat-message ${own ? "own-message" : ""}"
                data-message-id="${escapeHTML(message.id)}"
            >
                <div class="message-avatar">
                    ${
                        avatar
                            ? `
                                <img
                                    src="${escapeHTML(avatar)}"
                                    alt="${escapeHTML(name)}"
                                >
                            `
                            : `
                                <span>
                                    ${escapeHTML(
                                        initialsForName(name)
                                    )}
                                </span>
                            `
                    }
                </div>

                <div class="message-body">
                    <div class="message-meta">
                        <strong>
                            ${escapeHTML(name)}
                        </strong>

                        <time>
                            ${escapeHTML(
                                formatTime(created)
                            )}
                        </time>
                    </div>

                    <div class="message-content">
                        ${
                            deleted
                                ? `
                                    <em>
                                        Message deleted
                                    </em>
                                `
                                : `
                                    ${
                                        content
                                            ? `
                                                <div class="message-text">
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
                                        attachmentUrl
                                            ? `
                                                <div class="message-attachment">
                                                    <a
                                                        href="${escapeHTML(attachmentUrl)}"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        📎
                                                        ${escapeHTML(
                                                            attachmentName ||
                                                            "Attachment"
                                                        )}
                                                    </a>
                                                </div>
                                            `
                                            : ""
                                    }
                                `
                        }
                    </div>

                    <div class="message-actions">
                        <button
                            type="button"
                            data-react-message="${escapeHTML(message.id)}"
                        >
                            ❤️
                        </button>

                        ${
                            own && !deleted
                                ? `
                                    <button
                                        type="button"
                                        data-delete-message="${escapeHTML(message.id)}"
                                    >
                                        🗑️
                                    </button>
                                `
                                : ""
                        }
                    </div>
                </div>
            </article>
        `;
    }


    function bindMessageActions() {
        document
            .querySelectorAll(
                "[data-delete-message]"
            )
            .forEach(button => {
                button.onclick = () => {
                    deleteMessage(
                        button.dataset.deleteMessage
                    );
                };
            });

        document
            .querySelectorAll(
                "[data-react-message]"
            )
            .forEach(button => {
                button.onclick = () => {
                    toggleReaction(
                        button.dataset.reactMessage,
                        "❤️"
                    );
                };
            });
    }


    async function sendMessage() {
        if (!state.user?.id) {
            showToast(
                "Please sign in first.",
                "error"
            );

            return;
        }

        if (!state.currentChannel?.id) {
            showToast(
                "Select a channel first.",
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

        const hasAttachment =
            Boolean(
                state.pendingAttachment
            );

        if (!content && !hasAttachment) {
            return;
        }

        let attachment =
            null;

        if (hasAttachment) {
            attachment =
                await uploadAttachment(
                    state.pendingAttachment
                );

            if (!attachment) {
                return;
            }
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

        try {
            const {
                error
            } = await db
                .from("chat_messages")
                .insert(payload);

            if (error) {
                console.error(
                    "❌ Send message failed:",
                    error
                );

                showToast(
                    "Message could not be sent.",
                    "error"
                );

                return;
            }

            input.value = "";

            clearAttachment();

        } catch (error) {
            console.error(
                "sendMessage:",
                error
            );
        }
    }


    /* ========================================================
       DELETE MESSAGE
       ======================================================== */

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
            message.sender_id ||
            message.created_by;

        if (
            owner !==
            state.user?.id
        ) {
            showToast(
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
            /*
             * Try soft deletion first.
             */
            let result =
                await db
                    .from("chat_messages")
                    .update({
                        deleted: true,
                        content: "Message deleted"
                    })
                    .eq("id", messageId)
                    .eq(
                        "user_id",
                        state.user.id
                    );

            if (result.error) {
                /*
                 * Fallback to physical delete.
                 */
                result =
                    await db
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
            }

            if (result.error) {
                console.error(
                    "❌ Message deletion failed:",
                    result.error
                );

                showToast(
                    "Message could not be deleted.",
                    "error"
                );

                return;
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
                "deleteMessage:",
                error
            );
        }
    }


    /* ========================================================
       REACTIONS
       ======================================================== */

    async function toggleReaction(
        messageId,
        emoji
    ) {
        if (!state.user?.id) {
            return;
        }

        try {
            const existing =
                await db
                    .from(
                        "chat_message_reactions"
                    )
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

            if (
                existing.data?.id
            ) {
                await db
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
                    reaction:
                        emoji
                });

            if (error) {
                console.warn(
                    "Reaction failed:",
                    error
                );
            }

        } catch (error) {
            console.warn(
                "toggleReaction:",
                error
            );
        }
    }


    /* ========================================================
       ATTACHMENTS
       ======================================================== */

    function bindAttachmentInput() {
        const input =
            $("attachmentInput");

        const button =
            $("attachButton");

        if (button && input) {
            button.onclick = () => {
                input.click();
            };

            input.onchange = () => {
                const file =
                    input.files?.[0];

                if (file) {
                    prepareAttachment(file);
                }
            };
        }
    }


    function prepareAttachment(file) {
        if (!file) {
            return;
        }

        if (
            file.size >
            MAX_ATTACHMENT_SIZE
        ) {
            showToast(
                "File is too large. Maximum size is 25 MB.",
                "error"
            );

            return;
        }

        state.pendingAttachment =
            file;

        const preview =
            $("attachmentPreview");

        if (preview) {
            preview.innerHTML = `
                <div class="attachment-preview-item">
                    <span>
                        📎
                        ${escapeHTML(file.name)}
                    </span>

                    <button
                        type="button"
                        id="removeAttachmentButton"
                    >
                        ✕
                    </button>
                </div>
            `;

            const remove =
                $("removeAttachmentButton");

            if (remove) {
                remove.onclick =
                    clearAttachment;
            }
        }
    }


    function clearAttachment() {
        state.pendingAttachment =
            null;

        const preview =
            $("attachmentPreview");

        if (preview) {
            preview.innerHTML = "";
        }

        const input =
            $("attachmentInput");

        if (input) {
            input.value = "";
        }
    }


    async function uploadAttachment(
        file
    ) {
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
            `${state.user.id}/${Date.now()}-${safeName}`;

        /*
         * Try the existing common bucket names.
         */
        const buckets = [
            "chat-attachments",
            "attachments",
            "community-attachments"
        ];

        for (const bucket of buckets) {
            try {
                const {
                    error
                } = await db
                    .storage
                    .from(bucket)
                    .upload(
                        path,
                        file,
                        {
                            upsert: false
                        }
                    );

                if (error) {
                    continue;
                }

                const {
                    data
                } = db
                    .storage
                    .from(bucket)
                    .getPublicUrl(path);

                return {
                    url:
                        data?.publicUrl ||
                        "",
                    name:
                        file.name,
                    type:
                        file.type,
                    size:
                        file.size
                };

            } catch {}
        }

        showToast(
            "Could not upload this file. Check your storage bucket.",
            "error"
        );

        return null;
    }


    /* ========================================================
       VOICE NOTES
       ======================================================== */

    async function toggleVoiceRecording() {
        if (state.recording) {
            stopVoiceRecording();
            return;
        }

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {
            showToast(
                "Voice recording is not supported in this browser.",
                "error"
            );

            return;
        }

        try {
            const stream =
                await navigator
                    .mediaDevices
                    .getUserMedia({
                        audio: true
                    });

            const mimeType =
                VOICE_MIME_TYPES.find(
                    type =>
                        MediaRecorder
                            .isTypeSupported(
                                type
                            )
                ) || "";

            state.voiceChunks = [];

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
                        .forEach(track =>
                            track.stop()
                        );

                    const blob =
                        new Blob(
                            state.voiceChunks,
                            {
                                type:
                                    mimeType ||
                                    "audio/webm"
                            }
                        );

                    await sendVoiceNote(blob);

                    state.voiceChunks = [];
                };

            state.recorder.start();

            state.recording = true;

            const button =
                $("voiceNoteButton");

            if (button) {
                button.classList.add(
                    "recording"
                );

                button.textContent =
                    "⏹️";
            }

            showToast(
                "Recording voice note...",
                "info"
            );

        } catch (error) {
            console.error(
                "Voice recording failed:",
                error
            );

            showToast(
                "Microphone permission was denied or unavailable.",
                "error"
            );
        }
    }


    function stopVoiceRecording() {
        if (
            state.recorder &&
            state.recording
        ) {
            state.recorder.stop();
        }

        state.recording = false;

        const button =
            $("voiceNoteButton");

        if (button) {
            button.classList.remove(
                "recording"
            );

            button.textContent =
                "🎙️";
        }
    }


    async function sendVoiceNote(
        blob
    ) {
        if (!blob?.size) {
            return;
        }

        const file =
            new File(
                [blob],
                `voice-note-${Date.now()}.webm`,
                {
                    type:
                        blob.type ||
                        "audio/webm"
                }
            );

        const attachment =
            await uploadAttachment(file);

        if (!attachment) {
            return;
        }

        try {
            const {
                error
            } = await db
                .from("chat_messages")
                .insert({
                    channel_id:
                        state.currentChannel.id,
                    user_id:
                        state.user.id,
                    content:
                        "🎙️ Voice note",
                    file_url:
                        attachment.url,
                    file_name:
                        attachment.name,
                    file_type:
                        attachment.type,
                    file_size:
                        attachment.size
                });

            if (error) {
                console.error(
                    "Voice note message failed:",
                    error
                );
            }

        } catch (error) {
            console.error(
                "sendVoiceNote:",
                error
            );
        }
    }


    /* ========================================================
       EMOJI / STICKER / GIF
       ======================================================== */

    function setupEmojiPanel() {
        const button =
            $("emojiButton");

        const panel =
            $("emojiPanel");

        if (!button || !panel) {
            return;
        }

        button.onclick = event => {
            event.stopPropagation();

            if (
                panel.classList.contains(
                    "open"
                )
            ) {
                closeEmojiPanel();
            } else {
                closeStickerPanel();
                closeGifPanel();

                renderEmojiGrid();

                openElement(panel);
            }
        };

        panel.onclick = event => {
            event.stopPropagation();
        };
    }


    function renderEmojiGrid() {
        const grid =
            $("emojiGrid");

        if (!grid) {
            return;
        }

        grid.innerHTML =
            EMOJIS.map(
                emoji => `
                    <button
                        type="button"
                        class="emoji-item"
                        data-emoji="${emoji}"
                    >
                        ${emoji}
                    </button>
                `
            )
            .join("");

        grid
            .querySelectorAll(
                "[data-emoji]"
            )
            .forEach(button => {
                button.onclick = () => {
                    insertEmoji(
                        button.dataset.emoji
                    );
                };
            });
    }


    function insertEmoji(emoji) {
        const input =
            $("messageInput");

        if (!input) {
            return;
        }

        input.value += emoji;

        input.focus();
    }


    function closeEmojiPanel() {
        closeElement(
            $("emojiPanel")
        );
    }


    function closeStickerPanel() {
        closeElement(
            $("stickerPanel")
        );
    }


    function closeGifPanel() {
        closeElement(
            $("gifPanel")
        );
    }


    function setupStickerPanel() {
        const button =
            $("stickerButton");

        const panel =
            $("stickerPanel");

        if (!button || !panel) {
            return;
        }

        button.onclick = event => {
            event.stopPropagation();

            if (
                panel.classList.contains(
                    "open"
                )
            ) {
                closeStickerPanel();
            } else {
                closeEmojiPanel();
                closeGifPanel();

                renderStickerGrid();

                openElement(panel);
            }
        };

        panel.onclick = event => {
            event.stopPropagation();
        };
    }


    function renderStickerGrid() {
        const grid =
            $("stickerGrid");

        if (!grid) {
            return;
        }

        const stickers = [
            "👍",
            "❤️",
            "😂",
            "🔥",
            "🎉",
            "👏",
            "🙏",
            "💯",
            "🤣",
            "😭"
        ];

        grid.innerHTML =
            stickers
                .map(
                    sticker => `
                        <button
                            type="button"
                            data-sticker="${sticker}"
                        >
                            ${sticker}
                        </button>
                    `
                )
                .join("");

        grid
            .querySelectorAll(
                "[data-sticker]"
            )
            .forEach(button => {
                button.onclick = () => {
                    insertEmoji(
                        button.dataset.sticker
                    );

                    closeStickerPanel();
                };
            });
    }


    function setupGifPanel() {
        const button =
            $("gifButton");

        const panel =
            $("gifPanel");

        if (!button || !panel) {
            return;
        }

        button.onclick = event => {
            event.stopPropagation();

            if (
                panel.classList.contains(
                    "open"
                )
            ) {
                closeGifPanel();
            } else {
                closeEmojiPanel();
                closeStickerPanel();

                openElement(panel);
            }
        };

        panel.onclick = event => {
            event.stopPropagation();
        };
    }


    /* ========================================================
       READ STATUS
       ======================================================== */

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
            /*
             * Avoid relying on a nonexistent
             * unique constraint.
             */
            const {
                data: existing,
                error: selectError
            } = await db
                .from("chat_read_status")
                .select("id")
                .eq(
                    "channel_id",
                    channelId
                )
                .eq(
                    "user_id",
                    state.user.id
                )
                .maybeSingle();

            if (selectError) {
                console.warn(
                    "Read status lookup:",
                    selectError
                );

                return;
            }

            const payload = {
                channel_id:
                    channelId,
                user_id:
                    state.user.id,
                last_read_at:
                    new Date().toISOString()
            };

            if (existing?.id) {
                await db
                    .from("chat_read_status")
                    .update({
                        last_read_at:
                            payload.last_read_at
                    })
                    .eq(
                        "id",
                        existing.id
                    );
            } else {
                const {
                    error
                } = await db
                    .from("chat_read_status")
                    .insert(payload);

                if (error) {
                    console.warn(
                        "Read status insert:",
                        error
                    );
                }
            }

        } catch (error) {
            console.warn(
                "markChannelRead:",
                error
            );
        }
    }


    /* ========================================================
       REALTIME
       ======================================================== */

    async function cleanupCommunityRealtime() {
        if (
            state.communityRealtime
        ) {
            try {
                await db.removeChannel(
                    state.communityRealtime
                );
            } catch {}

            state.communityRealtime =
                null;
        }

        if (
            state.messageRealtime
        ) {
            try {
                await db.removeChannel(
                    state.messageRealtime
                );
            } catch {}

            state.messageRealtime =
                null;
        }
    }


    async function subscribeCommunityRealtime() {
        if (
            !state.currentCommunity?.id
        ) {
            return;
        }

        const channel =
            db.channel(
                `community-${state.currentCommunity.id}`
            );

        channel.on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "chat_community_members",
                filter:
                    `community_id=eq.${state.currentCommunity.id}`
            },
            async () => {
                await loadMembers();
            }
        );

        channel.on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "chat_presence"
            },
            () => {
                updateMemberPresenceDots();
            }
        );

        state.communityRealtime =
            channel;

        channel.subscribe(
            status => {
                if (
                    status ===
                    "SUBSCRIBED"
                ) {
                    console.log(
                        "Community realtime: SUBSCRIBED"
                    );
                }
            }
        );
    }


    async function subscribeMessageRealtime() {
        if (
            !state.currentChannel?.id
        ) {
            return;
        }

        if (
            state.messageRealtime
        ) {
            try {
                await db.removeChannel(
                    state.messageRealtime
                );
            } catch {}
        }

        const channelId =
            state.currentChannel.id;

        const channel =
            db.channel(
                `messages-${channelId}`
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
                    state.messages.push(
                        payload.new
                    );

                    await enrichMessageProfiles();

                    renderMessages();
                } else {
                    await loadMessages();
                }
            }
        );

        state.messageRealtime =
            channel;

        channel.subscribe();
    }


    /* ========================================================
       CALL DATABASE
       ======================================================== */

    async function createCallRoom({
        communityId = null,
        targetUserId = null,
        scope = "direct",
        mode = "audio"
    }) {
        if (!state.user?.id) {
            throw new Error(
                "You must be signed in."
            );
        }

        /*
         * CRITICAL:
         *
         * room_code is NOT NULL in your database.
         * Always generate it here.
         */
        const roomCode =
            generateRoomCode();

        const payload = {
            room_code:
                roomCode,

            community_id:
                communityId || null,

            created_by:
                state.user.id,

            target_user_id:
                targetUserId || null,

            room_status:
                "ringing",

            call_scope:
                scope,

            max_participants:
                scope === "community"
                    ? 100
                    : 2
        };

        console.log(
            "📞 Creating call room:",
            payload
        );

        const {
            data,
            error
        } = await db
            .from("chat_call_rooms")
            .insert(payload)
            .select("*")
            .single();

        if (error) {
            console.error(
                "❌ CALL ROOM CREATION FAILED:",
                error
            );

            throw error;
        }

        return {
            ...data,
            mode,
            room_code:
                data.room_code ||
                roomCode
        };
    }


    async function createCallInvite(
        roomId,
        receiverId
    ) {
        if (
            !roomId ||
            !receiverId ||
            !state.user?.id
        ) {
            return null;
        }

        const {
            data,
            error
        } = await db
            .from("chat_call_invites")
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
            console.error(
                "❌ Call invite failed:",
                error
            );

            return null;
        }

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

        const {
            error
        } = await db
            .from("chat_call_participants")
            .upsert(
                {
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
                        false,
                    joined_at:
                        status === "joined"
                            ? new Date().toISOString()
                            : null
                },
                {
                    onConflict:
                        "room_id,user_id"
                }
            );

        if (error) {
            /*
             * Duplicate rows should not destroy
             * the call.
             */
            if (
                !String(
                    error.message || ""
                ).toLowerCase()
                    .includes("duplicate")
            ) {
                console.warn(
                    "Participant insert:",
                    error
                );
            }
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
                .update(changes)
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
            await db
                .from(
                    "chat_call_rooms"
                )
                .update(changes)
                .eq(
                    "id",
                    roomId
                );
        } catch (error) {
            console.warn(
                "Call room update:",
                error
            );
        }
    }


    /* ========================================================
       ONLINE CALL RECIPIENTS
       ======================================================== */

    async function getOnlineUsers(
        communityId = null
    ) {
        const onlineIds =
            await getOnlineUserIds();

        if (!onlineIds.length) {
            return [];
        }

        let allowedIds =
            onlineIds;

        if (communityId) {
            try {
                const {
                    data
                } = await db
                    .from(
                        "chat_community_members"
                    )
                    .select(
                        "user_id"
                    )
                    .eq(
                        "community_id",
                        communityId
                    )
                    .in(
                        "user_id",
                        onlineIds
                    );

                allowedIds =
                    safeArray(data)
                        .map(
                            row =>
                                row.user_id
                        )
                        .filter(Boolean);

            } catch (error) {
                console.warn(
                    "Community online members:",
                    error
                );
            }
        }

        if (!allowedIds.length) {
            return [];
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
                    allowedIds
                );

            if (error) {
                console.warn(
                    "Online profile lookup:",
                    error
                );

                return [];
            }

            return safeArray(data)
                .filter(
                    profile =>
                        profile.id !==
                        state.user?.id
                )
                .map(profile => ({
                    id:
                        profile.id,
                    name:
                        displayName(profile),
                    avatar:
                        avatarURL(profile),
                    profile
                }));

        } catch (error) {
            console.warn(
                "getOnlineUsers:",
                error
            );

            return [];
        }
    }


    /* ========================================================
       CALL NOTIFICATION
       ======================================================== */

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
            payload => {
                const call =
                    payload.payload;

                if (!call) {
                    return;
                }

                if (
                    call.callerId ===
                    state.user.id
                ) {
                    return;
                }

                showIncomingCall(call);
            }
        );

        /*
         * Also watch the database.
         *
         * This makes incoming calls more reliable
         * than relying on a temporary broadcast alone.
         */
        channel.on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "chat_call_invites",
                filter:
                    `receiver_id=eq.${state.user.id}`
            },
            async payload => {
                const invite =
                    payload.new;

                if (
                    invite.status !==
                    "ringing"
                ) {
                    return;
                }

                await showIncomingInvite(
                    invite
                );
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


    async function notifyUserOfCall(
        receiverId,
        room,
        mode
    ) {
        if (!receiverId) {
            return;
        }

        const payload = {
            roomId:
                room.id,

            roomCode:
                room.room_code,

            callerId:
                state.user.id,

            callerName:
                displayName(
                    state.profile
                ),

            callerAvatar:
                avatarURL(
                    state.profile
                ),

            mode:
                mode || "audio",

            communityId:
                room.community_id,

            timestamp:
                Date.now()
        };

        /*
         * Broadcast to currently connected recipient.
         */
        try {
            const channel =
                db.channel(
                    `${INCOMING_PREFIX}${receiverId}`
                );

            channel.subscribe(
                async status => {
                    if (
                        status !==
                        "SUBSCRIBED"
                    ) {
                        return;
                    }

                    await channel.send({
                        type:
                            "broadcast",
                        event:
                            "incoming-call",
                        payload
                    });

                    setTimeout(() => {
                        db.removeChannel(
                            channel
                        );
                    }, 5000);
                }
            );
        } catch (error) {
            console.warn(
                "Call broadcast failed:",
                error
            );
        }
    }


    async function showIncomingInvite(
        invite
    ) {
        if (!invite?.room_id) {
            return;
        }

        if (
            invite.sender_id ===
            state.user?.id
        ) {
            return;
        }

        let caller =
            null;

        try {
            const {
                data
            } = await db
                .from(
                    "chat_public_profiles"
                )
                .select("*")
                .eq(
                    "id",
                    invite.sender_id
                )
                .maybeSingle();

            caller = data;
        } catch {}

        const room =
            await getCallRoom(
                invite.room_id
            );

        if (!room) {
            return;
        }

        showIncomingCall({
            roomId:
                room.id,

            roomCode:
                room.room_code,

            callerId:
                invite.sender_id,

            callerName:
                displayName(caller),

            callerAvatar:
                avatarURL(caller),

            mode:
                room.call_mode ||
                "audio",

            communityId:
                room.community_id,

            inviteId:
                invite.id
        });
    }


    function showIncomingCall(
        call
    ) {
        if (
            state.incomingCallVisible
        ) {
            return;
        }

        state.incomingCallVisible =
            true;

        state.incomingCall =
            call;

        removeIncomingCallUI();

        const overlay =
            document.createElement(
                "div"
            );

        overlay.id =
            "mwanikiIncomingCall";

        overlay.innerHTML = `
            <div class="mwaniki-incoming-call-card">

                <div class="mwaniki-incoming-avatar">
                    ${
                        call.callerAvatar
                            ? `
                                <img
                                    src="${escapeHTML(
                                        call.callerAvatar
                                    )}"
                                    alt="${escapeHTML(
                                        call.callerName ||
                                        "Caller"
                                    )}"
                                >
                            `
                            : `
                                <span>
                                    ${escapeHTML(
                                        initialsForName(
                                            call.callerName
                                        )
                                    )}
                                </span>
                            `
                    }
                </div>

                <h3>
                    ${escapeHTML(
                        call.callerName ||
                        "Mwaniki Scholar"
                    )}
                </h3>

                <p>
                    Incoming
                    ${
                        call.mode === "video"
                            ? "video"
                            : "audio"
                    }
                    call
                </p>

                <div class="mwaniki-incoming-actions">

                    <button
                        type="button"
                        id="mwanikiAcceptCall"
                    >
                        📞 Accept
                    </button>

                    <button
                        type="button"
                        id="mwanikiDeclineCall"
                    >
                        ✕ Decline
                    </button>

                </div>

            </div>
        `;

        document.body.appendChild(
            overlay
        );

        installIncomingCallStyles();

        $("mwanikiAcceptCall").onclick =
            () => {
                acceptIncomingCall(
                    call
                );
            };

        $("mwanikiDeclineCall").onclick =
            () => {
                declineIncomingCall(
                    call
                );
            };

        clearTimeout(
            showIncomingCall.timer
        );

        showIncomingCall.timer =
            setTimeout(() => {
                if (
                    state.incomingCallVisible
                ) {
                    declineIncomingCall(
                        call,
                        true
                    );
                }
            }, CALL_RING_TIMEOUT);
    }


    function removeIncomingCallUI() {
        const existing =
            $("mwanikiIncomingCall");

        if (existing) {
            existing.remove();
        }
    }


    function installIncomingCallStyles() {
        if (
            $("mwanikiIncomingCallStyles")
        ) {
            return;
        }

        const style =
            document.createElement(
                "style"
            );

        style.id =
            "mwanikiIncomingCallStyles";

        style.textContent = `
            #mwanikiIncomingCall {
                position: fixed;
                inset: 0;
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0,0,0,.62);
                padding: 20px;
            }

            .mwaniki-incoming-call-card {
                width: min(390px, 100%);
                background: #fff;
                border-radius: 22px;
                padding: 30px;
                text-align: center;
                box-shadow: 0 25px 70px rgba(0,0,0,.35);
            }

            .mwaniki-incoming-avatar {
                width: 86px;
                height: 86px;
                border-radius: 50%;
                margin: 0 auto 15px;
                overflow: hidden;
                background: #087f73;
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 28px;
                font-weight: 700;
            }

            .mwaniki-incoming-avatar img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .mwaniki-incoming-call-card h3 {
                margin: 0 0 7px;
            }

            .mwaniki-incoming-call-card p {
                margin: 0 0 24px;
                opacity: .7;
            }

            .mwaniki-incoming-actions {
                display: flex;
                gap: 12px;
            }

            .mwaniki-incoming-actions button {
                flex: 1;
                border: 0;
                border-radius: 12px;
                padding: 13px;
                cursor: pointer;
                font-weight: 700;
            }
        `;

        document.head.appendChild(
            style
        );
    }


    /* ========================================================
       CALL ROOM
       ======================================================== */

    async function getCallRoom(
        roomId
    ) {
        if (!roomId) {
            return null;
        }

        try {
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
                console.warn(
                    "Call room lookup:",
                    error
                );

                return null;
            }

            return data || null;

        } catch (error) {
            console.warn(
                "getCallRoom:",
                error
            );

            return null;
        }
    }


    function callURL(
        room,
        role,
        mode
    ) {
        const params =
            new URLSearchParams();

        params.set(
            "room",
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

        return (
            `${CALL_PAGE}?${params.toString()}`
        );
    }


    async function startDirectCall(
        targetUserId,
        mode = "audio"
    ) {
        if (!targetUserId) {
            showToast(
                "Select a member to call.",
                "error"
            );

            return;
        }

        if (
            targetUserId ===
            state.user?.id
        ) {
            return;
        }

        try {
            const room =
                await createCallRoom({
                    communityId:
                        state.currentCommunity?.id ||
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

            if (!invite) {
                throw new Error(
                    "Call invitation could not be created."
                );
            }

            await notifyUserOfCall(
                targetUserId,
                room,
                mode
            );

            await updateCallRoom(
                room.id,
                {
                    room_status:
                        "ringing"
                }
            );

            console.log(
                "📞 Direct call created:",
                room.room_code
            );

            window.location.href =
                callURL(
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
                "Could not start the call.",
                "error"
            );
        }
    }


    async function startCommunityCall(
        communityId,
        mode = "audio"
    ) {
        if (!communityId) {
            showToast(
                "No community selected.",
                "error"
            );

            return;
        }

        try {
            /*
             * Community calls use registered members,
             * not the online-only member picker.
             */
            const {
                data,
                error
            } = await db
                .from(
                    "chat_community_members"
                )
                .select(
                    "user_id"
                )
                .eq(
                    "community_id",
                    communityId
                );

            if (error) {
                throw error;
            }

            const recipients =
                safeArray(data)
                    .map(
                        row =>
                            row.user_id
                    )
                    .filter(
                        id =>
                            id &&
                            id !==
                                state.user.id
                    );

            if (!recipients.length) {
                showToast(
                    "There are no other members in this community.",
                    "error"
                );

                return;
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

            for (
                const userId
                of recipients
            ) {
                await addCallParticipant(
                    room.id,
                    userId,
                    "invited"
                );

                const invite =
                    await createCallInvite(
                        room.id,
                        userId
                    );

                if (invite) {
                    await notifyUserOfCall(
                        userId,
                        room,
                        mode
                    );
                }
            }

            await updateCallRoom(
                room.id,
                {
                    room_status:
                        "ringing"
                }
            );

            window.location.href =
                callURL(
                    room,
                    "caller",
                    mode
                );

        } catch (error) {
            console.error(
                "Community call failed:",
                error
            );

            showToast(
                "Could not start community call.",
                "error"
            );
        }
    }


    /* ========================================================
       GENERAL CALL PICKER
       ======================================================== */

    async function openGeneralCallPicker() {
        const communityId =
            state.currentCommunity?.id ||
            null;

        const users =
            await getOnlineUsers(
                communityId
            );

        if (!users.length) {
            showToast(
                "There are no other online users available.",
                "error"
            );

            return;
        }

        removeCallPicker();

        const overlay =
            document.createElement(
                "div"
            );

        overlay.id =
            "mwanikiCallPicker";

        overlay.innerHTML = `
            <div class="mwaniki-call-picker">

                <div class="mwaniki-call-picker-header">
                    <h3>Start General Call</h3>

                    <button
                        type="button"
                        id="closeMwanikiCallPicker"
                    >
                        ✕
                    </button>
                </div>

                <p>
                    Select the online members you want
                    to call.
                </p>

                <div class="mwaniki-call-picker-actions">

                    <button
                        type="button"
                        id="selectAllOnlineUsers"
                    >
                        Select Everyone Online
                    </button>

                    <button
                        type="button"
                        id="clearOnlineUsers"
                    >
                        Clear
                    </button>

                </div>

                <div
                    class="mwaniki-online-user-list"
                    id="mwanikiOnlineUserList"
                >
                    ${users.map(user => `
                        <label
                            class="mwaniki-online-user"
                        >
                            <input
                                type="checkbox"
                                value="${escapeHTML(user.id)}"
                                data-online-user
                            >

                            <span class="mwaniki-online-avatar">
                                ${
                                    user.avatar
                                        ? `
                                            <img
                                                src="${escapeHTML(user.avatar)}"
                                                alt="${escapeHTML(user.name)}"
                                            >
                                        `
                                        : `
                                            ${escapeHTML(
                                                initialsForName(
                                                    user.name
                                                )
                                            )}
                                        `
                                }
                            </span>

                            <span>
                                ${escapeHTML(user.name)}
                            </span>

                            <span class="mwaniki-online-dot">
                                ●
                            </span>
                        </label>
                    `).join("")}
                </div>

                <div class="mwaniki-call-picker-footer">

                    <button
                        type="button"
                        id="startSelectedGeneralCall"
                    >
                        📞 Start Call
                    </button>

                </div>

            </div>
        `;

        document.body.appendChild(
            overlay
        );

        installCallPickerStyles();

        $("closeMwanikiCallPicker").onclick =
            removeCallPicker;

        $("selectAllOnlineUsers").onclick =
            () => {
                document
                    .querySelectorAll(
                        "[data-online-user]"
                    )
                    .forEach(
                        checkbox => {
                            checkbox.checked =
                                true;
                        }
                    );
            };

        $("clearOnlineUsers").onclick =
            () => {
                document
                    .querySelectorAll(
                        "[data-online-user]"
                    )
                    .forEach(
                        checkbox => {
                            checkbox.checked =
                                false;
                        }
                    );
            };

        $("startSelectedGeneralCall").onclick =
            async () => {
                const selected =
                    [
                        ...document.querySelectorAll(
                            "[data-online-user]:checked"
                        )
                    ].map(
                        checkbox =>
                            checkbox.value
                    );

                if (!selected.length) {
                    showToast(
                        "Select at least one online user.",
                        "error"
                    );

                    return;
                }

                removeCallPicker();

                await startGeneralCall(
                    selected,
                    "audio"
                );
            };
    }


    function removeCallPicker() {
        const picker =
            $("mwanikiCallPicker");

        if (picker) {
            picker.remove();
        }
    }


    function installCallPickerStyles() {
        if (
            $("mwanikiCallPickerStyles")
        ) {
            return;
        }

        const style =
            document.createElement(
                "style"
            );

        style.id =
            "mwanikiCallPickerStyles";

        style.textContent = `
            #mwanikiCallPicker {
                position: fixed;
                inset: 0;
                z-index: 999998;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0,0,0,.6);
                padding: 20px;
            }

            .mwaniki-call-picker {
                width: min(520px,100%);
                max-height: 85vh;
                overflow: auto;
                background: #fff;
                border-radius: 20px;
                padding: 22px;
                box-shadow: 0 25px 70px rgba(0,0,0,.3);
            }

            .mwaniki-call-picker-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .mwaniki-call-picker-header h3 {
                margin: 0;
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
                margin: 15px 0;
            }

            .mwaniki-call-picker-actions button,
            #startSelectedGeneralCall {
                border: 0;
                border-radius: 10px;
                padding: 10px 14px;
                cursor: pointer;
            }

            .mwaniki-online-user-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .mwaniki-online-user {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px;
                border-radius: 12px;
                cursor: pointer;
            }

            .mwaniki-online-user:hover {
                background: #f2f6f5;
            }

            .mwaniki-online-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                overflow: hidden;
                background: #087f73;
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
            }

            .mwaniki-online-avatar img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .mwaniki-online-dot {
                margin-left: auto;
                color: #22a06b;
            }

            .mwaniki-call-picker-footer {
                margin-top: 18px;
            }

            #startSelectedGeneralCall {
                width: 100%;
                background: #087f73;
                color: #fff;
                font-weight: 700;
            }
        `;

        document.head.appendChild(
            style
        );
    }


    async function startGeneralCall(
        userIds,
        mode = "audio"
    ) {
        const recipients =
            safeArray(userIds)
                .filter(
                    id =>
                        id &&
                        id !==
                            state.user?.id
                );

        if (!recipients.length) {
            showToast(
                "Select at least one user.",
                "error"
            );

            return;
        }

        try {
            const room =
                await createCallRoom({
                    communityId:
                        state.currentCommunity?.id ||
                        null,

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
                of recipients
            ) {
                await addCallParticipant(
                    room.id,
                    userId,
                    "invited"
                );

                const invite =
                    await createCallInvite(
                        room.id,
                        userId
                    );

                if (invite) {
                    await notifyUserOfCall(
                        userId,
                        room,
                        mode
                    );
                }
            }

            window.location.href =
                callURL(
                    room,
                    "caller",
                    mode
                );

        } catch (error) {
            console.error(
                "General call failed:",
                error
            );

            showToast(
                "Could not start the general call.",
                "error"
            );
        }
    }


    /* ========================================================
       ACCEPT / DECLINE CALL
       ======================================================== */

    async function acceptIncomingCall(
        call
    ) {
        clearTimeout(
            showIncomingCall.timer
        );

        removeIncomingCallUI();

        state.incomingCallVisible =
            false;

        try {
            const room =
                await getCallRoom(
                    call.roomId
                );

            if (!room) {
                throw new Error(
                    "Call room no longer exists."
                );
            }

            await addCallParticipant(
                room.id,
                state.user.id,
                "joined"
            );

            if (call.inviteId) {
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
                        call.inviteId
                    );
            } else {
                await db
                    .from(
                        "chat_call_invites"
                    )
                    .update({
                        status:
                            "accepted"
                    })
                    .eq(
                        "room_id",
                        room.id
                    )
                    .eq(
                        "receiver_id",
                        state.user.id
                    );
            }

            await updateCallRoom(
                room.id,
                {
                    room_status:
                        "active"
                }
            );

            window.location.href =
                callURL(
                    room,
                    "receiver",
                    call.mode ||
                        "audio"
                );

        } catch (error) {
            console.error(
                "Accept call failed:",
                error
            );

            showToast(
                "Could not accept the call.",
                "error"
            );
        }
    }


    async function declineIncomingCall(
        call,
        expired = false
    ) {
        clearTimeout(
            showIncomingCall.timer
        );

        removeIncomingCallUI();

        state.incomingCallVisible =
            false;

        try {
            await db
                .from(
                    "chat_call_invites"
                )
                .update({
                    status:
                        expired
                            ? "expired"
                            : "declined"
                })
                .eq(
                    "room_id",
                    call.roomId
                )
                .eq(
                    "receiver_id",
                    state.user.id
                );

        } catch (error) {
            console.warn(
                "Decline call update:",
                error
            );
        }
    }


    /* ========================================================
       CALL PAGE ENGINE
       ======================================================== */

    function isCallPage() {
        return (
            window.location.pathname
                .toLowerCase()
                .endsWith(
                    "community-calls.html"
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
                params.get("room"),

            roomCode:
                params.get(
                    "room_code"
                ),

            role:
                params.get("role") ||
                "receiver",

            mode:
                params.get("mode") ||
                "audio"
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

                <header class="mwaniki-call-header">
                    <div>
                        <h1>
                            Mwaniki Scholars Call
                        </h1>

                        <span
                            id="mwanikiCallStatus"
                        >
                            Connecting...
                        </span>
                    </div>

                    <button
                        type="button"
                        id="mwanikiLeaveCall"
                    >
                        End Call
                    </button>
                </header>

                <section
                    id="mwanikiVideoGrid"
                    class="mwaniki-video-grid"
                >
                </section>

                <section
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
                        ☎️
                    </button>

                </section>

            </main>
        `;

        installCallPageStyles();
    }


    function installCallPageStyles() {
        if (
            $("mwanikiCallPageStyles")
        ) {
            return;
        }

        const style =
            document.createElement(
                "style"
            );

        style.id =
            "mwanikiCallPageStyles";

        style.textContent = `
            * {
                box-sizing: border-box;
            }

            body {
                margin: 0;
                font-family:
                    Inter,
                    system-ui,
                    sans-serif;
                background: #071a18;
                color: #fff;
            }

            .mwaniki-call-app {
                min-height: 100vh;
                display: flex;
                flex-direction: column;
            }

            .mwaniki-call-header {
                min-height: 74px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 15px 20px;
                background: #0b2925;
            }

            .mwaniki-call-header h1 {
                margin: 0 0 4px;
                font-size: 18px;
            }

            .mwaniki-call-header span {
                opacity: .7;
                font-size: 13px;
            }

            .mwaniki-call-header button {
                border: 0;
                border-radius: 10px;
                padding: 10px 15px;
                cursor: pointer;
                background: #d64545;
                color: #fff;
                font-weight: 700;
            }

            .mwaniki-video-grid {
                flex: 1;
                display: grid;
                grid-template-columns:
                    repeat(auto-fit,minmax(280px,1fr));
                gap: 12px;
                padding: 15px;
                align-content: center;
            }

            .mwaniki-video-tile {
                min-height: 240px;
                position: relative;
                overflow: hidden;
                border-radius: 18px;
                background: #102d2a;
            }

            .mwaniki-video-tile video {
                width: 100%;
                height: 100%;
                min-height: 240px;
                object-fit: cover;
            }

            .mwaniki-video-name {
                position: absolute;
                left: 10px;
                bottom: 10px;
                background: rgba(0,0,0,.55);
                padding: 6px 9px;
                border-radius: 8px;
            }

            .mwaniki-call-controls {
                min-height: 90px;
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 12px;
                padding: 15px;
                background: #0b2925;
            }

            .mwaniki-call-controls button {
                width: 52px;
                height: 52px;
                border: 0;
                border-radius: 50%;
                cursor: pointer;
                font-size: 20px;
            }

            #mwanikiEndButton {
                background: #d64545;
                color: #fff;
            }
        `;

        document.head.appendChild(
            style
        );
    }


    async function initializeCallPage() {
        ensureCallPageUI();

        const params =
            getCallParams();

        if (!params.roomId) {
            setCallStatus(
                "Invalid call room."
            );

            return;
        }

        state.call.role =
            params.role;

        state.call.mode =
            params.mode;

        state.call.currentRoom =
            await getCallRoom(
                params.roomId
            );

        if (
            !state.call.currentRoom
        ) {
            setCallStatus(
                "Call room not found."
            );

            return;
        }

        state.call.communityId =
            state.call.currentRoom
                .community_id;

        await addCallParticipant(
            state.call.currentRoom.id,
            state.user.id,
            "joined"
        );

        await updateCallParticipant(
            state.call.currentRoom.id,
            state.user.id,
            {
                status:
                    "joined",
                joined_at:
                    new Date().toISOString()
            }
        );

        await updateCallRoom(
            state.call.currentRoom.id,
            {
                room_status:
                    "active"
            }
        );

        bindCallControls();

        await startLocalMedia();

        await subscribeCallRoom();

        await discoverExistingParticipants();

        setCallStatus(
            "Connected to call room. Waiting for participants..."
        );
    }


    function setCallStatus(
        message
    ) {
        const element =
            $("mwanikiCallStatus");

        if (element) {
            element.textContent =
                message;
        }
    }


    async function startLocalMedia() {
        if (
            state.call.localStream
        ) {
            return;
        }

        try {
            const constraints = {
                audio: true,
                video:
                    state.call.mode ===
                    "video"
            };

            state.call.localStream =
                await navigator
                    .mediaDevices
                    .getUserMedia(
                        constraints
                    );

            state.call.microphoneEnabled =
                true;

            state.call.cameraEnabled =
                state.call.mode ===
                "video";

            renderLocalVideo();

        } catch (error) {
            console.error(
                "Local media failed:",
                error
            );

            /*
             * Audio fallback.
             */
            try {
                state.call.localStream =
                    await navigator
                        .mediaDevices
                        .getUserMedia({
                            audio: true
                        });

                state.call.microphoneEnabled =
                    true;

                renderLocalVideo();

                setCallStatus(
                    "Audio connected. Camera unavailable."
                );

            } catch (audioError) {
                console.error(
                    "Audio fallback failed:",
                    audioError
                );

                setCallStatus(
                    "Microphone/camera permission unavailable."
                );
            }
        }
    }


    function renderLocalVideo() {
        const grid =
            $("mwanikiVideoGrid");

        if (!grid) {
            return;
        }

        let tile =
            $("mwanikiLocalTile");

        if (!tile) {
            tile =
                document.createElement(
                    "div"
                );

            tile.id =
                "mwanikiLocalTile";

            tile.className =
                "mwaniki-video-tile";

            tile.innerHTML = `
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
            `;

            grid.prepend(tile);
        }

        const video =
            $("mwanikiLocalVideo");

        if (video) {
            video.srcObject =
                state.call.localStream;
        }
    }


    /* ========================================================
       WEBRTC
       ======================================================== */

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
                `call-room-${room.id}`
            );

        channel.on(
            "broadcast",
            {
                event:
                    "peer-ready"
            },
            async payload => {
                const sender =
                    payload.payload?.sender;

                if (
                    !sender ||
                    sender ===
                        state.user.id
                ) {
                    return;
                }

                await ensurePeerConnection(
                    sender
                );

                /*
                 * Both peers send readiness.
                 * The deterministic offerer creates
                 * the actual offer.
                 */
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
            async payload => {
                await handleOffer(
                    payload.payload
                );
            }
        );

        channel.on(
            "broadcast",
            {
                event:
                    "answer"
            },
            async payload => {
                await handleAnswer(
                    payload.payload
                );
            }
        );

        channel.on(
            "broadcast",
            {
                event:
                    "ice-candidate"
            },
            async payload => {
                await handleIceCandidate(
                    payload.payload
                );
            }
        );

        channel.on(
            "broadcast",
            {
                event:
                    "peer-left"
            },
            payload => {
                const userId =
                    payload.payload
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
            payload => {
                if (
                    payload.payload
                        ?.userId !==
                    state.user.id
                ) {
                    finishCall(false);
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

                    await channel.send({
                        type:
                            "broadcast",
                        event:
                            "peer-ready",
                        payload: {
                            sender:
                                state.user.id
                        }
                    });

                    /*
                     * Repeat readiness because Broadcast
                     * is ephemeral and a peer can join slightly
                     * later.
                     */
                    setTimeout(
                        async () => {
                            if (
                                state.call
                                    .roomChannel
                            ) {
                                try {
                                    await state.call
                                        .roomChannel
                                        .send({
                                            type:
                                                "broadcast",
                                            event:
                                                "peer-ready",
                                            payload: {
                                                sender:
                                                    state.user.id
                                            }
                                        });
                                } catch {}
                            }
                        },
                        1500
                    );
                }
            }
        );
    }


    async function discoverExistingParticipants() {
        const roomId =
            state.call.currentRoom?.id;

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
                    participant.user_id !==
                        state.user.id &&
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

                    /*
                     * Explicitly notify the peer.
                     */
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
            await state.call.roomChannel
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


    async function ensurePeerConnection(
        peerId
    ) {
        if (!peerId) {
            return null;
        }

        if (
            state.call.peerConnections.has(
                peerId
            )
        ) {
            return state.call
                .peerConnections
                .get(peerId);
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
                .forEach(track => {
                    pc.addTrack(
                        track,
                        state.call.localStream
                    );
                });
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
        /*
         * Deterministic negotiation:
         * only one side offers.
         */
        return (
            String(state.user.id) <
            String(peerId)
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
            payload.target !==
                state.user.id
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
            payload.target !==
                state.user.id
        ) {
            return;
        }

        const sender =
            payload.sender;

        if (!sender) {
            return;
        }

        const pc =
            state.call.peerConnections.get(
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
            payload.target !==
                state.user.id
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
         * IMPORTANT:
         *
         * ICE can arrive before the remote description.
         * Queue it instead of throwing it away.
         */
        if (
            !pc.remoteDescription
        ) {
            const queue =
                state.call.pendingIce.get(
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
            state.call.peerConnections.get(
                peerId
            );

        if (
            !pc ||
            !pc.remoteDescription
        ) {
            return;
        }

        const queue =
            state.call.pendingIce.get(
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
            } catch {}
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

            grid.appendChild(tile);

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
        }
    }


    function removePeer(
        peerId
    ) {
        const pc =
            state.call.peerConnections.get(
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


    /* ========================================================
       CALL CONTROLS
       ======================================================== */

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
                () => finishCall(true);
        }

        if (headerEnd) {
            headerEnd.onclick =
                () => finishCall(true);
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
            !state.call.microphoneEnabled;

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
            !state.call.cameraEnabled;

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
            stopScreenShare();

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
                .forEach(track =>
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

        if (!cameraTrack) {
            return;
        }

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
            state.call.currentRoom?.id;

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

            await updateCallRoom(
                roomId,
                {
                    room_status:
                        "ended"
                }
            );

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
                .forEach(track =>
                    track.stop()
                );
        }

        if (
            state.call.screenStream
        ) {
            state.call.screenStream
                .getTracks()
                .forEach(track =>
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

        if (isCallPage()) {
            window.location.href =
                "./community.html";
        }
    }


    /* ========================================================
       CALL BUTTONS
       ======================================================== */

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


    /* ========================================================
       SEARCH
       ======================================================== */

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
            .forEach(item => {
                const text =
                    item.textContent
                        .toLowerCase();

                item.hidden =
                    Boolean(
                        query &&
                        !text.includes(query)
                    );
            });
    }


    /* ========================================================
       UI EVENTS
       ======================================================== */

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

        /*
         * Escape closes floating panels.
         */
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


    /* ========================================================
       BASIC MODALS
       ======================================================== */

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
                <h3>Community Rules</h3>

                <ol>
                    <li>Respect other Mwaniki Scholars.</li>
                    <li>Keep discussions academic and constructive.</li>
                    <li>No spam or harassment.</li>
                    <li>Do not share private information.</li>
                    <li>Use the appropriate channel.</li>
                </ol>
            `;
        }

        openElement(modal);
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

        openElement(modal);
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
                                    src="${escapeHTML(avatar)}"
                                    alt="${escapeHTML(name)}"
                                >
                            `
                            : `
                                <div>
                                    ${escapeHTML(
                                        initialsForName(name)
                                    )}
                                </div>
                            `
                    }

                    <h3>
                        ${escapeHTML(name)}
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

        openElement(modal);
    }


    function openTicketModal() {
        const modal =
            $("ticketModal");

        if (!modal) {
            return;
        }

        openElement(modal);
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

        openElement(modal);
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
                        target.dataset.closeModal;

                    closeElement(
                        $(modalId)
                    );
                }
            }
        );
    }


    /* ========================================================
       AUTH LISTENER
       ======================================================== */

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
                        "SIGNED_IN"
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


    /* ========================================================
       INITIALIZATION
       ======================================================== */

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

        await startPresence();

        await subscribeIncomingCalls();

        await loadCourses();

        await loadCommunities();

        /*
         * MAIN COMMUNITY FIRST.
         *
         * This prevents the application from opening
         * Mwaniki Gaming or Mwaniki Memes by accident.
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


    /* ========================================================
       GLOBAL API
       ======================================================== */

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
     * Backwards-compatible calling API.
     *
     * Other HTML elements or old code can still call:
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
            () => finishCall(true),

        getOnlineUsers
    };


    /* ========================================================
       START
       ======================================================== */

    if (isCallPage()) {
        /*
         * Call page needs authentication first,
         * then initializes the WebRTC engine.
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
