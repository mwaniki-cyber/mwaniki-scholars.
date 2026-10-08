/* ============================================================
   MWANIKI SCHOLARS
   COMMUNITY ENGINE
   ------------------------------------------------------------
   Handles:
   - Communities
   - Channels
   - Members
   - Presence
   - Messages
   - Replies
   - Reactions
   - Edit/delete
   - Attachments
   - Voice notes
   - Emoji
   - GIF links
   - Typing indicator
   - Realtime
   ------------------------------------------------------------
   CALLING IS HANDLED ONLY BY:
       ./community-calls.js
   ============================================================ */

import { supabase } from "./supabase.js";

(() => {
    "use strict";

    const CONFIG = {
        messageLimit: 100,
        heartbeatMs: 25000,
        presenceFreshMs: 90000,
        awayAfterMs: 5 * 60 * 1000,
        maxAttachmentSize: 25 * 1024 * 1024,
        maxVoiceMs: 120000
    };

    const state = {
        user: null,
        profile: null,

        communities: [],
        channels: [],
        members: [],
        messages: [],
        profiles: new Map(),
        presences: new Map(),
        attachments: new Map(),

        currentCommunity: null,
        currentChannel: null,

        courseId: null,
        courseName: "",

        currentStatus: "online",
        manuallySelectedStatus: false,

        selectedFiles: [],
        replyingTo: null,

        realtime: [],
        heartbeat: null,
        awayTimer: null,
        typingTimer: null,

        recorder: null,
        voiceChunks: [],
        recording: false,

        storageBucket: null
    };

    const $ = id => document.getElementById(id);

    const dom = {
        rail: $("communityRailList"),
        home: $("communityHomeButton"),
        mobileSidebar: $("mobileSidebarButton"),

        selectedCommunityIcon: $("selectedCommunityIcon"),
        selectedCommunityName: $("selectedCommunityName"),
        selectedCommunityDescription: $("selectedCommunityDescription"),

        informationChannels: $("informationChannels"),
        courseChannels: $("courseChannels"),
        communityChannels: $("communityChannels"),

        channelSearch: $("channelSearchInput"),

        currentChannelIcon: $("currentChannelIcon"),
        currentChannelName: $("currentChannelName"),
        currentChannelDescription: $("currentChannelDescription"),

        messageList: $("messageList"),
        messageLoading: $("messageLoading"),
        typingIndicator: $("typingIndicator"),

        messageInput: $("messageInput"),
        sendButton: $("sendMessageButton"),
        attachmentInput: $("attachmentInput"),
        attachmentPreview: $("attachmentPreview"),

        emojiButton: $("emojiButton"),
        emojiPanel: $("emojiPanel"),
        emojiSearch: $("emojiSearch"),
        emojiGrid: $("emojiGrid"),
        closeEmoji: $("closeEmojiButton"),

        stickerButton: $("stickerButton"),
        stickerPanel: $("stickerPanel"),
        stickerGrid: $("stickerGrid"),
        closeSticker: $("closeStickerButton"),

        gifButton: $("gifButton"),
        gifPanel: $("gifPanel"),
        gifSearch: $("gifSearch"),
        gifGrid: $("gifGrid"),
        closeGif: $("closeGifButton"),

        memberSidebar: $("memberSidebar"),
        memberList: $("memberList"),
        memberCount: $("memberCount"),
        memberSearch: $("memberSearchInput"),

        profileButton: $("profileButton"),
        profileModal: $("profileModal"),
        profileModalContent: $("profileModalContent"),

        headerAvatar: $("headerProfileAvatar"),
        headerName: $("headerProfileName"),
        headerDot: $("headerPresenceDot"),

        sidebarAvatar: $("profileLargeAvatar"),
        sidebarName: $("sidebarUserName"),
        sidebarStatus: $("sidebarUserStatus"),
        sidebarDot: $("sidebarPresenceDot"),

        friendsButton: $("friendsButton"),
        friendsModal: $("friendsModal"),
        friendsContent: $("friendsContent"),

        rulesButton: $("communityRulesButton"),
        rulesModal: $("rulesModal"),

        searchButton: $("channelSearchButton"),
        searchBar: $("messageSearchBar"),
        searchInput: $("messageSearchInput"),
        closeSearch: $("closeMessageSearchButton"),

        membersButton: $("channelMembersButton"),
        closeMembers: $("closeMemberSidebarButton"),

        contestButton: $("contestChannelButton"),
        contestModal: $("contestModal"),
        contestCourseSelector: $("contestCourseSelector"),
        contestQuestionArea: $("contestQuestionArea"),

        toast: $("toast")
    };

    /* ============================================================
       HELPERS
       ============================================================ */

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function initials(name) {
        const value = String(name || "MS").trim();

        if (!value) return "MS";

        const parts = value.split(/\s+/);

        if (parts.length === 1) {
            return parts[0].slice(0, 2).toUpperCase();
        }

        return (
            parts[0][0] +
            parts[parts.length - 1][0]
        ).toUpperCase();
    }

    function avatarFallback(name) {
        const letters = initials(name);

        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
                <rect width="120" height="120" rx="60" fill="#087f73"/>
                <text x="60" y="70"
                    text-anchor="middle"
                    font-family="Arial"
                    font-size="40"
                    font-weight="700"
                    fill="white">${letters}</text>
            </svg>
        `)}`;
    }

    function safeURL(value) {
        if (!value) return "";

        try {
            const url = new URL(
                value,
                window.location.href
            );

            if (
                url.protocol === "https:" ||
                url.protocol === "http:"
            ) {
                return url.href;
            }
        } catch {
            return "";
        }

        return "";
    }

    function formatTime(value) {
        if (!value) return "";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function formatBytes(bytes) {
        const n = Number(bytes || 0);

        if (!n) return "0 B";

        if (n < 1024) return `${n} B`;

        if (n < 1024 * 1024) {
            return `${(n / 1024).toFixed(1)} KB`;
        }

        return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    }

    function toast(message) {
        if (!dom.toast) {
            console.log("[Community]", message);
            return;
        }

        dom.toast.textContent = message;
        dom.toast.classList.add("visible");

        clearTimeout(toast.timer);

        toast.timer = setTimeout(() => {
            dom.toast.classList.remove("visible");
        }, 2800);
    }

    function showModal(element) {
        element?.classList.remove("hidden");
    }

    function hideModal(element) {
        element?.classList.add("hidden");
    }

    function profileName(userId) {
        if (!userId) return "Mwaniki Scholar";

        if (state.profiles.has(userId)) {
            const p = state.profiles.get(userId);

            if (p.full_name) return p.full_name;
            if (p.display_name) return p.display_name;
            if (p.nickname) return p.nickname;
        }

        const member = state.members.find(
            m => String(m.user_id) === String(userId)
        );

        if (member) {
            if (member.display_name) return member.display_name;
            if (member.nickname) return member.nickname;
        }

        if (state.user?.id === userId) {
            return (
                state.user.user_metadata?.full_name ||
                state.user.user_metadata?.name ||
                state.user.email?.split("@")[0] ||
                "You"
            );
        }

        return "Mwaniki Scholar";
    }

    function profilePhoto(userId) {
        const p = state.profiles.get(userId);

        if (p?.photo_url) {
            return safeURL(p.photo_url);
        }

        const member = state.members.find(
            m => String(m.user_id) === String(userId)
        );

        if (member?.avatar_url) {
            return safeURL(member.avatar_url);
        }

        if (state.user?.id === userId) {
            return safeURL(
                state.user.user_metadata?.avatar_url ||
                state.user.user_metadata?.picture ||
                state.user.user_metadata?.photo_url
            );
        }

        return "";
    }

    function setAvatar(img, userId, name) {
        if (!img) return;

        img.src =
            profilePhoto(userId) ||
            avatarFallback(name);

        img.onerror = () => {
            img.onerror = null;
            img.src = avatarFallback(name);
        };
    }

    /* ============================================================
       URL / COURSE CONTEXT
       ============================================================ */

    function readCourseContext() {
        const params =
            new URLSearchParams(
                window.location.search
            );

        state.courseId =
            params.get("course_id") ||
            localStorage.getItem(
                "selectedCourse"
            ) ||
            null;

        state.courseName =
            params.get("course_name") ||
            localStorage.getItem(
                "selectedCourseName"
            ) ||
            "";

        if (state.courseId) {
            localStorage.setItem(
                "selectedCourse",
                state.courseId
            );
        }

        if (state.courseName) {
            localStorage.setItem(
                "selectedCourseName",
                state.courseName
            );
        }
    }

    /* ============================================================
       AUTH
       ============================================================ */

    async function requireUser() {
        const {
            data,
            error
        } = await supabase.auth.getUser();

        if (error) throw error;

        if (!data?.user) {
            window.location.href = "./index.html";
            return null;
        }

        state.user = data.user;

        return state.user;
    }

    /* ============================================================
       PROFILES
       ============================================================ */

    async function loadProfiles(userIds) {
        const ids = [
            ...new Set(
                (userIds || []).filter(Boolean)
            )
        ];

        if (!ids.length) return;

        const missing = ids.filter(
            id => !state.profiles.has(id)
        );

        if (!missing.length) return;

        const [
            publicProfiles,
            students,
            members
        ] = await Promise.all([
            supabase
                .from("chat_public_profiles")
                .select(
                    "id,full_name,photo_url,updated_at"
                )
                .in("id", missing),

            supabase
                .from("students")
                .select(
                    "id,full_name,photo_url,course,level"
                )
                .in("id", missing),

            state.currentCommunity
                ? supabase
                    .from("chat_community_members")
                    .select(
                        "user_id,display_name,nickname,avatar_url"
                    )
                    .eq(
                        "community_id",
                        state.currentCommunity.id
                    )
                    .in("user_id", missing)
                : Promise.resolve({
                    data: [],
                    error: null
                })
        ]);

        for (const row of publicProfiles.data || []) {
            state.profiles.set(
                row.id,
                row
            );
        }

        for (const row of students.data || []) {
            const existing =
                state.profiles.get(row.id) || {};

            state.profiles.set(
                row.id,
                {
                    ...existing,
                    id: row.id,
                    full_name:
                        existing.full_name ||
                        row.full_name,
                    photo_url:
                        existing.photo_url ||
                        row.photo_url
                }
            );
        }

        for (const row of members.data || []) {
            const existing =
                state.profiles.get(row.user_id) || {};

            state.profiles.set(
                row.user_id,
                {
                    ...existing,
                    id: row.user_id,
                    display_name:
                        existing.display_name ||
                        row.display_name,
                    nickname:
                        existing.nickname ||
                        row.nickname,
                    photo_url:
                        existing.photo_url ||
                        row.avatar_url
                }
            );
        }
    }

    async function loadOwnProfile() {
        await loadProfiles([
            state.user.id
        ]);

        const name =
            profileName(state.user.id);

        setAvatar(
            dom.headerAvatar,
            state.user.id,
            name
        );

        setAvatar(
            dom.sidebarAvatar,
            state.user.id,
            name
        );

        if (dom.headerName) {
            dom.headerName.textContent = name;
        }

        if (dom.sidebarName) {
            dom.sidebarName.textContent = name;
        }
    }

    /* ============================================================
       PRESENCE
       ============================================================ */

    function normalizeStatus(status) {
        return [
            "online",
            "away",
            "dnd",
            "offline"
        ].includes(status)
            ? status
            : "offline";
    }

    function effectiveStatus(row) {
        if (!row) return "offline";

        const status =
            normalizeStatus(row.status);

        const timestamp =
            row.updated_at ||
            row.last_seen_at;

        const time =
            timestamp
                ? new Date(timestamp).getTime()
                : 0;

        const age =
            Date.now() - time;

        if (
            status !== "offline" &&
            (!time ||
                age >
                    CONFIG.presenceFreshMs)
        ) {
            return "offline";
        }

        if (
            status === "online" &&
            age >
                CONFIG.awayAfterMs
        ) {
            return "away";
        }

        return status;
    }

    function applyStatus(element, status) {
        if (!element) return;

        element.classList.remove(
            "presence-online",
            "presence-away",
            "presence-dnd",
            "presence-offline"
        );

        element.classList.add(
            `presence-${normalizeStatus(status)}`
        );
    }

    function statusText(status) {
        switch (status) {
            case "online":
                return "Online";
            case "away":
                return "Away";
            case "dnd":
                return "Do Not Disturb";
            default:
                return "Offline";
        }
    }

    async function writePresence(status = state.currentStatus) {
        if (!state.user) return;

        const normalized =
            normalizeStatus(status);

        const now =
            new Date().toISOString();

        const {
            data,
            error
        } = await supabase
            .from("chat_presence")
            .upsert(
                {
                    user_id: state.user.id,
                    status: normalized,
                    last_seen_at: now,
                    updated_at: now
                },
                {
                    onConflict: "user_id"
                }
            )
            .select()
            .single();

        if (error) {
            console.warn(
                "Presence update failed:",
                error.message
            );
            return;
        }

        state.presences.set(
            state.user.id,
            data
        );

        updateOwnPresenceUI();
    }

    async function loadPresence() {
        if (!state.members.length) return;

        const ids = state.members
            .map(m => m.user_id)
            .filter(Boolean);

        if (state.user?.id) {
            ids.push(state.user.id);
        }

        const unique = [
            ...new Set(ids)
        ];

        const {
            data,
            error
        } = await supabase
            .from("chat_presence")
            .select(
                "user_id,status,custom_status,last_seen_at,updated_at"
            )
            .in("user_id", unique);

        if (error) {
            console.warn(
                "Presence load failed:",
                error.message
            );
            return;
        }

        state.presences.clear();

        for (const row of data || []) {
            state.presences.set(
                row.user_id,
                row
            );
        }

        renderMembers();
        updateOwnPresenceUI();
    }

    function updateOwnPresenceUI() {
        const row =
            state.presences.get(
                state.user?.id
            );

        const status =
            effectiveStatus(row);

        applyStatus(
            dom.headerDot,
            status
        );

        applyStatus(
            dom.sidebarDot,
            status
        );

        if (dom.sidebarStatus) {
            dom.sidebarStatus.textContent =
                statusText(status);
        }
    }

    function startPresence() {
        clearInterval(
            state.heartbeat
        );

        state.heartbeat =
            setInterval(
                () => {
                    if (
                        document.visibilityState ===
                        "visible"
                    ) {
                        writePresence(
                            state.currentStatus
                        );
                    }
                },
                CONFIG.heartbeatMs
            );

        const activity = () => {
            if (
                state.manuallySelectedStatus
            ) {
                return;
            }

            state.currentStatus =
                "online";

            clearTimeout(
                state.awayTimer
            );

            state.awayTimer =
                setTimeout(
                    () => {
                        if (
                            !state.manuallySelectedStatus
                        ) {
                            state.currentStatus =
                                "away";

                            writePresence(
                                "away"
                            );
                        }
                    },
                    CONFIG.awayAfterMs
                );

            writePresence("online");
        };

        [
            "mousemove",
            "mousedown",
            "keydown",
            "touchstart",
            "scroll"
        ].forEach(event => {
            window.addEventListener(
                event,
                activity,
                {
                    passive: true
                }
            );
        });

        document.addEventListener(
            "visibilitychange",
            () => {
                if (
                    document.visibilityState ===
                    "visible" &&
                    !state.manuallySelectedStatus
                ) {
                    state.currentStatus =
                        "online";

                    writePresence("online");
                }
            }
        );
    }

    /* ============================================================
       COMMUNITIES
       ============================================================ */

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
                created_at,
                updated_at
            `)
            .eq("is_active", true)
            .order("created_at", {
                ascending: true
            });

        if (error) {
            console.error(
                "Community load failed:",
                error
            );

            toast(
                "Unable to load communities."
            );

            return;
        }

        state.communities =
            data || [];

        renderCommunityRail();

        const saved =
            localStorage.getItem(
                "mwanikiCommunityId"
            );

        let selected =
            state.communities.find(
                c =>
                    String(c.id) ===
                    String(saved)
            );

        if (!selected) {
            selected =
                state.communities.find(
                    c =>
                        String(c.slug || "")
                            .toLowerCase() ===
                        "mwaniki-scholars"
                );
        }

        if (!selected) {
            selected =
                state.communities[0];
        }

        if (selected) {
            await selectCommunity(
                selected
            );
        }
    }

    function communityIcon(community) {
        if (!community) return "🩺";

        if (
            community.icon_url &&
            community.icon_url.length <= 5
        ) {
            return community.icon_url;
        }

        const slug =
            String(
                community.slug || ""
            ).toLowerCase();

        if (
            slug.includes("gaming") ||
            slug.includes("game")
        ) {
            return "🎮";
        }

        if (
            slug.includes("contest")
        ) {
            return "🏆";
        }

        return "🩺";
    }

    function renderCommunityRail() {
        if (!dom.rail) return;

        dom.rail.innerHTML =
            state.communities
                .map(community => {
                    const active =
                        state.currentCommunity &&
                        String(
                            state.currentCommunity.id
                        ) ===
                        String(community.id);

                    const icon =
                        communityIcon(
                            community
                        );

                    return `
                        <button
                            type="button"
                            class="rail-community-button ${
                                active
                                    ? "active"
                                    : ""
                            }"
                            data-community-id="${escapeHTML(
                                community.id
                            )}"
                            title="${escapeHTML(
                                community.name
                            )}"
                        >
                            ${
                                community.icon_url &&
                                community.icon_url.length > 5
                                    ? `
                                        <img
                                            src="${safeURL(
                                                community.icon_url
                                            )}"
                                            alt=""
                                        >
                                    `
                                    : escapeHTML(icon)
                            }
                        </button>
                    `;
                })
                .join("");
    }

    async function selectCommunity(community) {
        if (!community) return;

        clearRealtime();

        state.currentCommunity =
            community;

        state.currentChannel =
            null;

        state.channels = [];
        state.members = [];
        state.messages = [];
        state.attachments.clear();

        localStorage.setItem(
            "mwanikiCommunityId",
            String(community.id)
        );

        localStorage.setItem(
            "mwanikiCommunityName",
            community.name || ""
        );

        renderCommunityRail();

        if (dom.selectedCommunityName) {
            dom.selectedCommunityName.textContent =
                community.name;
        }

        if (dom.selectedCommunityDescription) {
            dom.selectedCommunityDescription.textContent =
                community.description ||
                "Medical learning community";
        }

        if (dom.selectedCommunityIcon) {
            if (
                community.icon_url &&
                community.icon_url.length > 5
            ) {
                dom.selectedCommunityIcon.innerHTML = `
                    <img
                        src="${safeURL(
                            community.icon_url
                        )}"
                        alt=""
                    >
                `;
            } else {
                dom.selectedCommunityIcon.textContent =
                    communityIcon(
                        community
                    );
            }
        }

        await Promise.all([
            loadChannels(),
            loadMembers()
        ]);
    }

    /* ============================================================
       CHANNELS
       ============================================================ */

    async function loadChannels() {
        if (!state.currentCommunity) return;

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
                created_by,
                created_at,
                updated_at
            `)
            .eq(
                "community_id",
                state.currentCommunity.id
            )
            .eq("is_active", true)
            .eq("is_archived", false)
            .order("position", {
                ascending: true
            })
            .order("name", {
                ascending: true
            });

        if (error) {
            console.error(
                "Channel load failed:",
                error
            );

            toast(
                "Unable to load channels."
            );

            return;
        }

        state.channels =
            data || [];

        renderChannels();

        let selected = null;

        if (state.courseId) {
            selected =
                state.channels.find(
                    channel =>
                        String(
                            channel.course_id
                        ) ===
                        String(
                            state.courseId
                        )
                );
        }

        selected =
            selected ||
            state.channels.find(
                channel =>
                    String(
                        channel.slug || ""
                    ).toLowerCase() ===
                    "general"
            ) ||
            state.channels.find(
                channel =>
                    String(
                        channel.channel_type || ""
                    ).toLowerCase() ===
                    "text"
            ) ||
            state.channels[0];

        if (selected) {
            await selectChannel(
                selected
            );
        }
    }

    function channelIcon(channel) {
        if (channel.icon) {
            return channel.icon;
        }

        if (
            channel.channel_type ===
            "voice"
        ) {
            return "🔊";
        }

        if (
            channel.channel_type ===
            "announcement"
        ) {
            return "📢";
        }

        if (
            channel.course_id
        ) {
            return "📚";
        }

        return "#";
    }

    function channelGroup(channel) {
        const name =
            String(
                channel.name || ""
            ).toLowerCase();

        if (channel.course_id) {
            return "course";
        }

        if (
            name.includes("announcement") ||
            name.includes("rules") ||
            name.includes("news")
        ) {
            return "information";
        }

        return "community";
    }

    function renderChannels() {
        const groups = {
            information:
                dom.informationChannels,
            course:
                dom.courseChannels,
            community:
                dom.communityChannels
        };

        Object.values(groups).forEach(
            element => {
                if (element) {
                    element.innerHTML = "";
                }
            }
        );

        const term =
            String(
                dom.channelSearch?.value ||
                ""
            )
                .trim()
                .toLowerCase();

        const channels =
            state.channels.filter(
                channel => {
                    if (!term) {
                        return true;
                    }

                    return (
                        String(
                            channel.name || ""
                        )
                            .toLowerCase()
                            .includes(term) ||
                        String(
                            channel.description || ""
                        )
                            .toLowerCase()
                            .includes(term)
                    );
                }
            );

        for (const channel of channels) {
            const group =
                channelGroup(
                    channel
                );

            const container =
                groups[group] ||
                groups.community;

            if (!container) continue;

            const active =
                state.currentChannel &&
                String(
                    state.currentChannel.id
                ) ===
                String(channel.id);

            const button =
                document.createElement(
                    "button"
                );

            button.type = "button";

            button.className =
                `channel-button ${
                    active ? "active" : ""
                }`;

            button.dataset.channelId =
                channel.id;

            button.innerHTML = `
                <span class="channel-icon">
                    ${escapeHTML(
                        channelIcon(channel)
                    )}
                </span>

                <span class="channel-name">
                    ${escapeHTML(
                        channel.name
                    )}
                </span>
            `;

            container.appendChild(
                button
            );
        }

        if (
            !dom.informationChannels
                ?.children.length
        ) {
            dom.informationChannels.innerHTML =
                `<div class="empty-channel">No information channels</div>`;
        }

        if (
            !dom.courseChannels
                ?.children.length
        ) {
            dom.courseChannels.innerHTML =
                `<div class="empty-channel">No course channels</div>`;
        }

        if (
            !dom.communityChannels
                ?.children.length
        ) {
            dom.communityChannels.innerHTML =
                `<div class="empty-channel">No discussion channels</div>`;
        }
    }

    async function selectChannel(channel) {
        if (!channel) return;

        state.currentChannel =
            channel;

        state.messages = [];
        state.attachments.clear();
        state.replyingTo = null;

        closePickers();
        updateChannelHeader();
        renderChannels();

        if (
            channel.channel_type ===
            "voice"
        ) {
            window.dispatchEvent(
                new CustomEvent(
                    "mwaniki:open-community-call",
                    {
                        detail: {
                            communityId:
                                state.currentCommunity?.id,
                            communityName:
                                state.currentCommunity?.name,
                            channelId:
                                channel.id,
                            channelName:
                                channel.name
                        }
                    }
                )
            );

            return;
        }

        await loadMessages();
        await loadAttachments();

        subscribeChannel();

        if (
            window.innerWidth <= 900
        ) {
            document
                .getElementById(
                    "channelSidebar"
                )
                ?.classList.remove(
                    "mobile-open"
                );
        }
    }

    function updateChannelHeader() {
        const channel =
            state.currentChannel;

        if (!channel) return;

        if (dom.currentChannelName) {
            dom.currentChannelName.textContent =
                channel.name;
        }

        if (
            dom.currentChannelDescription
        ) {
            dom.currentChannelDescription.textContent =
                channel.description ||
                "Mwaniki Scholars discussion";
        }

        if (dom.currentChannelIcon) {
            dom.currentChannelIcon.textContent =
                channelIcon(channel);
        }

        if (dom.messageInput) {
            dom.messageInput.placeholder =
                `Message #${channel.name}...`;
        }
    }

    /* ============================================================
       MEMBERS
       ============================================================ */

    async function loadMembers() {
        if (!state.currentCommunity) {
            return;
        }

        const {
            data,
            error
        } = await supabase
            .from("chat_community_members")
            .select(`
                user_id,
                community_id,
                role,
                nickname,
                display_name,
                avatar_url,
                created_at
            `)
            .eq(
                "community_id",
                state.currentCommunity.id
            );

        if (error) {
            console.error(
                "Members load failed:",
                error
            );

            if (dom.memberList) {
                dom.memberList.innerHTML =
                    `<div class="member-empty">Unable to load members.</div>`;
            }

            return;
        }

        state.members =
            data || [];

        await loadProfiles(
            state.members.map(
                member =>
                    member.user_id
            )
        );

        await loadPresence();

        renderMembers();
    }

    function renderMembers() {
        if (!dom.memberList) return;

        const term =
            String(
                dom.memberSearch?.value ||
                ""
            )
                .trim()
                .toLowerCase();

        const filtered =
            state.members.filter(
                member => {
                    const name =
                        profileName(
                            member.user_id
                        );

                    return (
                        !term ||
                        name
                            .toLowerCase()
                            .includes(term)
                    );
                }
            );

        const sorted =
            [...filtered].sort(
                (a, b) => {
                    const sa =
                        effectiveStatus(
                            state.presences.get(
                                a.user_id
                            )
                        );

                    const sb =
                        effectiveStatus(
                            state.presences.get(
                                b.user_id
                            )
                        );

                    const order = {
                        online: 0,
                        away: 1,
                        dnd: 2,
                        offline: 3
                    };

                    return (
                        order[sa] -
                        order[sb]
                    );
                }
            );

        dom.memberList.innerHTML =
            sorted.map(
                member => {
                    const name =
                        profileName(
                            member.user_id
                        );

                    const status =
                        effectiveStatus(
                            state.presences.get(
                                member.user_id
                            )
                        );

                    const role =
                        member.role ||
                        "student";

                    return `
                        <div
                            class="member-item"
                            data-user-id="${escapeHTML(
                                member.user_id
                            )}"
                        >
                            <div class="member-avatar-wrap">
                                <img
                                    class="member-avatar"
                                    src="${
                                        profilePhoto(
                                            member.user_id
                                        ) ||
                                        avatarFallback(name)
                                    }"
                                    alt=""
                                >

                                <span
                                    class="member-status presence-${status}"
                                ></span>
                            </div>

                            <div class="member-info">
                                <strong>
                                    ${escapeHTML(name)}
                                </strong>

                                <span>
                                    ${escapeHTML(
                                        statusText(status)
                                    )}
                                    ·
                                    ${escapeHTML(
                                        role
                                    )}
                                </span>
                            </div>

                            <button
                                type="button"
                                class="member-call-button"
                                data-call-user="${escapeHTML(
                                    member.user_id
                                )}"
                                title="Call ${escapeHTML(name)}"
                            >
                                📞
                            </button>
                        </div>
                    `;
                }
            ).join("");

        if (dom.memberCount) {
            dom.memberCount.textContent =
                state.members.length;
        }
    }

    /* ============================================================
       MESSAGES
       ============================================================ */

    async function loadMessages() {
        if (!state.currentChannel) return;

        dom.messageLoading?.classList.remove(
            "hidden"
        );

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
                updated_at,
                moderation_status,
                deleted_by,
                reply_to_user_id
            `)
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
                CONFIG.messageLimit
            );

        dom.messageLoading?.classList.add(
            "hidden"
        );

        if (error) {
            console.error(
                "Messages load failed:",
                error
            );

            renderMessages();

            toast(
                "Unable to load messages."
            );

            return;
        }

        state.messages =
            data || [];

        await loadProfiles(
            state.messages.map(
                message =>
                    message.user_id
            )
        );

        await loadAttachments();

        renderMessages();

        scrollMessages();
    }

    async function loadAttachments() {
        if (!state.messages.length) {
            state.attachments.clear();
            renderMessages();
            return;
        }

        const ids =
            state.messages.map(
                message =>
                    message.id
            );

        const {
            data,
            error
        } = await supabase
            .from("chat_attachments")
            .select(`
                id,
                message_id,
                uploaded_by,
                file_name,
                file_path,
                file_url,
                mime_type,
                file_size,
                created_at
            `)
            .in(
                "message_id",
                ids
            );

        if (error) {
            console.warn(
                "Attachment load failed:",
                error.message
            );

            return;
        }

        state.attachments.clear();

        for (const attachment of data || []) {
            const list =
                state.attachments.get(
                    attachment.message_id
                ) || [];

            list.push(
                attachment
            );

            state.attachments.set(
                attachment.message_id,
                list
            );
        }

        renderMessages();
    }

    function renderMessages() {
        if (!dom.messageList) return;

        if (!state.messages.length) {
            dom.messageList.innerHTML = `
                <div class="empty-messages">
                    <div class="empty-messages-icon">
                        💬
                    </div>

                    <strong>
                        No messages yet
                    </strong>

                    <span>
                        Start the discussion in
                        #${escapeHTML(
                            state.currentChannel?.name ||
                            "this channel"
                        )}.
                    </span>
                </div>
            `;

            return;
        }

        dom.messageList.innerHTML =
            state.messages
                .map(renderMessage)
                .join("");

        bindMessageButtons();
    }

    function renderMessage(message) {
        const mine =
            String(message.user_id) ===
            String(state.user?.id);

        const name =
            profileName(
                message.user_id
            );

        const photo =
            profilePhoto(
                message.user_id
            ) ||
            avatarFallback(name);

        const deleted =
            message.is_deleted;

        const attachments =
            state.attachments.get(
                message.id
            ) || [];

        const parent =
            message.parent_message_id
                ? state.messages.find(
                    item =>
                        String(item.id) ===
                        String(
                            message.parent_message_id
                        )
                )
                : null;

        return `
            <article
                class="message ${mine ? "mine" : ""}"
                data-message-id="${escapeHTML(
                    message.id
                )}"
            >
                <img
                    class="message-avatar"
                    src="${photo}"
                    alt=""
                    onerror="this.onerror=null;this.src='${avatarFallback(
                        name
                    )}'"
                >

                <div class="message-content">

                    <div class="message-meta">
                        <strong>
                            ${escapeHTML(name)}
                        </strong>

                        <time>
                            ${formatTime(
                                message.created_at
                            )}
                        </time>

                        ${
                            message.is_edited
                                ? `<span>edited</span>`
                                : ""
                        }
                    </div>

                    ${
                        parent
                            ? `
                                <div class="reply-reference">
                                    <strong>
                                        Replying to
                                        ${escapeHTML(
                                            profileName(
                                                parent.user_id
                                            )
                                        )}
                                    </strong>

                                    <span>
                                        ${escapeHTML(
                                            parent.content ||
                                            "Attachment"
                                        )}
                                    </span>
                                </div>
                            `
                            : ""
                    }

                    <div class="message-body">
                        ${
                            deleted
                                ? `
                                    <em class="deleted-message">
                                        This message was deleted.
                                    </em>
                                `
                                : renderMessageContent(
                                    message
                                )
                        }
                    </div>

                    ${
                        renderAttachments(
                            attachments
                        )
                    }

                    ${
                        !deleted
                            ? `
                                <div class="message-actions">

                                    <button
                                        type="button"
                                        data-action="reply"
                                        data-message-id="${escapeHTML(
                                            message.id
                                        )}"
                                        title="Reply"
                                    >
                                        ↩
                                    </button>

                                    <button
                                        type="button"
                                        data-action="react"
                                        data-message-id="${escapeHTML(
                                            message.id
                                        )}"
                                        title="React"
                                    >
                                        😊
                                    </button>

                                    ${
                                        mine
                                            ? `
                                                <button
                                                    type="button"
                                                    data-action="edit"
                                                    data-message-id="${escapeHTML(
                                                        message.id
                                                    )}"
                                                    title="Edit"
                                                >
                                                    ✎
                                                </button>

                                                <button
                                                    type="button"
                                                    data-action="delete"
                                                    data-message-id="${escapeHTML(
                                                        message.id
                                                    )}"
                                                    title="Delete"
                                                >
                                                    🗑
                                                </button>
                                            `
                                            : ""
                                    }

                                </div>
                            `
                            : ""
                    }

                </div>
            </article>
        `;
    }

    function renderMessageContent(message) {
        const type =
            message.message_type ||
            "text";

        if (
            type === "voice"
        ) {
            return `
                <div class="voice-message">
                    🎙 Voice note
                </div>
            `;
        }

        if (
            type === "gif"
        ) {
            return `
                <div class="gif-message">
                    ${escapeHTML(
                        message.content || ""
                    )}
                </div>
            `;
        }

        return `
            <div class="message-text">
                ${escapeHTML(
                    message.content || ""
                ).replace(
                    /\n/g,
                    "<br>"
                )}
            </div>
        `;
    }

    function renderAttachments(list) {
        if (!list.length) {
            return "";
        }

        return `
            <div class="message-attachments">
                ${list.map(
                    attachment => {
                        const url =
                            safeURL(
                                attachment.file_url
                            );

                        const isImage =
                            String(
                                attachment.mime_type ||
                                ""
                            ).startsWith(
                                "image/"
                            );

                        const isAudio =
                            String(
                                attachment.mime_type ||
                                ""
                            ).startsWith(
                                "audio/"
                            );

                        if (
                            isImage &&
                            url
                        ) {
                            return `
                                <a
                                    class="message-image-link"
                                    href="${url}"
                                    target="_blank"
                                    rel="noopener"
                                >
                                    <img
                                        class="message-image"
                                        src="${url}"
                                        alt="${escapeHTML(
                                            attachment.file_name
                                        )}"
                                        loading="lazy"
                                    >
                                </a>
                            `;
                        }

                        if (
                            isAudio &&
                            url
                        ) {
                            return `
                                <audio
                                    class="message-audio"
                                    controls
                                    preload="metadata"
                                    src="${url}"
                                ></audio>
                            `;
                        }

                        return `
                            <a
                                class="message-file"
                                href="${url || "#"}"
                                ${
                                    url
                                        ? `
                                            target="_blank"
                                            rel="noopener"
                                        `
                                        : ""
                                }
                            >
                                <span class="file-icon">
                                    📎
                                </span>

                                <span>
                                    <strong>
                                        ${escapeHTML(
                                            attachment.file_name ||
                                            "Attachment"
                                        )}
                                    </strong>

                                    <small>
                                        ${formatBytes(
                                            attachment.file_size
                                        )}
                                    </small>
                                </span>
                            </a>
                        `;
                    }
                ).join("")}
            </div>
        `;
    }

    /* ============================================================
       SEND / REPLY
       ============================================================ */

    async function sendMessage() {
        if (!state.user) return;

        const content =
            dom.messageInput?.value.trim() ||
            "";

        if (
            !content &&
            !state.selectedFiles.length
        ) {
            return;
        }

        if (!state.currentChannel) {
            toast(
                "Select a channel first."
            );
            return;
        }

        dom.sendButton.disabled = true;

        try {
            const payload = {
                channel_id:
                    state.currentChannel.id,

                user_id:
                    state.user.id,

                content:
                    content || "",

                message_type:
                    "text"
            };

            if (
                state.replyingTo?.id
            ) {
                payload.parent_message_id =
                    state.replyingTo.id;

                payload.reply_to_user_id =
                    state.replyingTo.user_id;
            }

            const {
                data,
                error
            } = await supabase
                .from("chat_messages")
                .insert(payload)
                .select()
                .single();

            if (error) {
                throw error;
            }

            const files =
                [...state.selectedFiles];

            dom.messageInput.value = "";

            clearReply();

            state.selectedFiles = [];

            renderAttachmentPreview();

            if (files.length) {
                await uploadAttachments(
                    data.id,
                    files
                );
            }

            await loadMessages();

        } catch (error) {
            console.error(
                "Send failed:",
                error
            );

            toast(
                error.message ||
                "Message could not be sent."
            );
        } finally {
            dom.sendButton.disabled =
                false;
        }
    }

    function setReply(message) {
        state.replyingTo =
            message;

        let bar =
            document.getElementById(
                "replyBar"
            );

        if (!bar) {
            bar =
                document.createElement(
                    "div"
                );

            bar.id =
                "replyBar";

            bar.className =
                "reply-bar";

            dom.messageInput
                ?.parentElement
                ?.insertAdjacentElement(
                    "beforebegin",
                    bar
                );
        }

        bar.innerHTML = `
            <div>
                <strong>
                    Replying to
                    ${escapeHTML(
                        profileName(
                            message.user_id
                        )
                    )}
                </strong>

                <span>
                    ${escapeHTML(
                        message.content ||
                        "Attachment"
                    )}
                </span>
            </div>

            <button
                type="button"
                id="cancelReplyButton"
            >
                ✕
            </button>
        `;

        document
            .getElementById(
                "cancelReplyButton"
            )
            ?.addEventListener(
                "click",
                clearReply
            );

        dom.messageInput?.focus();
    }

    function clearReply() {
        state.replyingTo =
            null;

        document
            .getElementById(
                "replyBar"
            )
            ?.remove();
    }

    /* ============================================================
       EDIT / DELETE
       ============================================================ */

    async function editMessage(id) {
        const message =
            state.messages.find(
                item =>
                    String(item.id) ===
                    String(id)
            );

        if (!message) return;

        const next =
            window.prompt(
                "Edit message:",
                message.content || ""
            );

        if (
            next === null ||
            !next.trim()
        ) {
            return;
        }

        const {
            error
        } = await supabase
            .from("chat_messages")
            .update({
                content:
                    next.trim(),

                is_edited:
                    true,

                edited_at:
                    new Date()
                        .toISOString(),

                updated_at:
                    new Date()
                        .toISOString()
            })
            .eq(
                "id",
                id
            )
            .eq(
                "user_id",
                state.user.id
            );

        if (error) {
            toast(
                "Message could not be edited."
            );
            return;
        }

        await loadMessages();
    }

    async function deleteMessage(id) {
        const yes =
            window.confirm(
                "Delete this message?"
            );

        if (!yes) return;

        const {
            error
        } = await supabase
            .from("chat_messages")
            .update({
                content:
                    "",

                is_deleted:
                    true,

                deleted_at:
                    new Date()
                        .toISOString(),

                deleted_by:
                    state.user.id,

                updated_at:
                    new Date()
                        .toISOString()
            })
            .eq(
                "id",
                id
            )
            .eq(
                "user_id",
                state.user.id
            );

        if (error) {
            console.error(
                error
            );

            toast(
                "Message could not be deleted."
            );

            return;
        }

        await loadMessages();
    }

    /* ============================================================
       REACTIONS
       ============================================================ */

    async function reactToMessage(id) {
        const reaction =
            window.prompt(
                "Enter one emoji:",
                "❤️"
            );

        if (!reaction) return;

        const {
            error
        } = await supabase
            .from(
                "chat_message_reactions"
            )
            .insert({
                message_id:
                    id,

                user_id:
                    state.user.id,

                reaction:
                    reaction,

                reaction_unicode:
                    reaction
            });

        if (error) {
            console.error(
                "Reaction failed:",
                error
            );

            toast(
                "Unable to add reaction."
            );
        }
    }

    /* ============================================================
       ATTACHMENTS
       ============================================================ */

    async function getStorageBucket() {
        if (state.storageBucket) {
            return state.storageBucket;
        }

        const {
            data,
            error
        } =
            await supabase
                .storage
                .listBuckets();

        if (error) {
            console.error(
                "Bucket discovery failed:",
                error
            );

            return null;
        }

        const names = [
            "chat-attachments",
            "chat_attachments",
            "community",
            "community-files",
            "attachments",
            "files"
        ];

        const preferred =
            names.find(
                name =>
                    data?.some(
                        bucket =>
                            bucket.name ===
                            name
                    )
            );

        state.storageBucket =
            preferred ||
            data?.[0]?.name ||
            null;

        return state.storageBucket;
    }

    function extension(name) {
        const match =
            String(name || "")
                .match(
                    /(\.[^./\\]+)$/
                );

        return match
            ? match[1]
            : "";
    }

    function slugify(value) {
        return String(value || "")
            .toLowerCase()
            .replace(
                /[^a-z0-9]+/g,
                "-"
            )
            .replace(
                /^-+|-+$/g,
                ""
            )
            .slice(0, 60);
    }

    async function uploadAttachments(
        messageId,
        files
    ) {
        const bucket =
            await getStorageBucket();

        if (!bucket) {
            toast(
                "No Supabase Storage bucket is available."
            );
            return;
        }

        for (const file of files) {
            if (
                file.size >
                CONFIG.maxAttachmentSize
            ) {
                toast(
                    `${file.name} is too large.`
                );
                continue;
            }

            try {
                const base =
                    slugify(
                        file.name.replace(
                            /\.[^/.]+$/,
                            ""
                        )
                    ) ||
                    "file";

                const path =
                    `community/${state.user.id}/${Date.now()}-${crypto.randomUUID()}-${base}${extension(file.name)}`;

                const {
                    data,
                    error
                } =
                    await supabase
                        .storage
                        .from(bucket)
                        .upload(
                            path,
                            file,
                            {
                                cacheControl:
                                    "3600",
                                upsert:
                                    false,
                                contentType:
                                    file.type ||
                                    "application/octet-stream"
                            }
                        );

                if (error) {
                    console.error(
                        "Upload failed:",
                        error
                    );
                    continue;
                }

                const {
                    data: publicData
                } =
                    supabase
                        .storage
                        .from(bucket)
                        .getPublicUrl(
                            data.path
                        );

                await supabase
                    .from(
                        "chat_attachments"
                    )
                    .insert({
                        message_id:
                            messageId,

                        uploaded_by:
                            state.user.id,

                        file_name:
                            file.name,

                        file_path:
                            data.path,

                        file_url:
                            publicData
                                ?.publicUrl ||
                            null,

                        mime_type:
                            file.type ||
                            null,

                        file_size:
                            file.size
                    });

            } catch (error) {
                console.error(
                    "Attachment error:",
                    error
                );
            }
        }
    }

    function handleFiles(files) {
        const valid =
            Array.from(files || [])
                .filter(
                    file =>
                        file.size <=
                        CONFIG.maxAttachmentSize
                );

        state.selectedFiles.push(
            ...valid
        );

        renderAttachmentPreview();
    }

    function renderAttachmentPreview() {
        if (!dom.attachmentPreview) {
            return;
        }

        if (!state.selectedFiles.length) {
            dom.attachmentPreview.classList.add(
                "hidden"
            );

            dom.attachmentPreview.innerHTML =
                "";

            return;
        }

        dom.attachmentPreview.classList.remove(
            "hidden"
        );

        dom.attachmentPreview.innerHTML =
            state.selectedFiles
                .map(
                    (file, index) => `
                        <div class="pending-file">
                            <span>
                                ${
                                    file.type.startsWith(
                                        "image/"
                                    )
                                        ? "🖼"
                                        : file.type.startsWith(
                                            "audio/"
                                        )
                                            ? "🎙"
                                            : "📎"
                                }
                            </span>

                            <span>
                                ${escapeHTML(
                                    file.name
                                )}

                                <small>
                                    ${formatBytes(
                                        file.size
                                    )}
                                </small>
                            </span>

                            <button
                                type="button"
                                data-remove-file="${index}"
                            >
                                ✕
                            </button>
                        </div>
                    `
                )
                .join("");
    }

    /* ============================================================
       VOICE NOTES
       ============================================================ */

    async function toggleVoiceNote() {
        if (state.recording) {
            stopVoiceNote();
            return;
        }

        if (
            !navigator.mediaDevices
                ?.getUserMedia
        ) {
            toast(
                "Voice recording is not supported."
            );
            return;
        }

        try {
            const stream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: true
                    });

            state.voiceChunks = [];

            state.recorder =
                new MediaRecorder(
                    stream
                );

            state.recorder.ondataavailable =
                event => {
                    if (
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

                    const blob =
                        new Blob(
                            state.voiceChunks,
                            {
                                type:
                                    state.recorder
                                        ?.mimeType ||
                                    "audio/webm"
                            }
                        );

                    state.recording =
                        false;

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

                    state.selectedFiles.push(
                        file
                    );

                    renderAttachmentPreview();

                    if (
                        dom.messageInput
                    ) {
                        dom.messageInput.value =
                            "Voice note";
                    }

                    toast(
                        "Voice note ready. Press Send."
                    );

                    updateVoiceButton();
                };

            state.recording =
                true;

            state.recorder.start();

            updateVoiceButton();

            setTimeout(
                () => {
                    if (
                        state.recording
                    ) {
                        stopVoiceNote();
                    }
                },
                CONFIG.maxVoiceMs
            );

        } catch (error) {
            console.error(
                error
            );

            toast(
                "Microphone access was not available."
            );
        }
    }

    function stopVoiceNote() {
        if (
            state.recorder &&
            state.recording
        ) {
            state.recorder.stop();
        }
    }

    function updateVoiceButton() {
        const button =
            document.getElementById(
                "voiceNoteButton"
            );

        if (!button) return;

        button.classList.toggle(
            "recording",
            state.recording
        );

        button.textContent =
            state.recording
                ? "⏹"
                : "🎙";
    }

    /* ============================================================
       EMOJI / STICKERS / GIF
       ============================================================ */

    const EMOJIS = [
        "😀","😃","😄","😁","😆","😅","😂","🤣",
        "😊","😇","🙂","🙃","😉","😌","😍","🥰",
        "😘","😎","🤓","🧐","🤩","🥳","😏","😐",
        "😑","😶","🙄","😬","🤔","🤭","🤗","😴",
        "🤒","🤕","🤢","🤮","🤧","🥶","🥵","😱",
        "😢","😭","😤","😡","🤬","🙏","👏","👍",
        "👎","👌","✌️","🤝","💪","❤️","💚","💙",
        "💜","🩺","🧪","🔬","🧬","💊","🩸","📚",
        "📖","📝","🎓","🏆","🔥","⭐","✨","💯",
        "✅","❌","⚕️","🫀","🫁","🧠","🦴","🦷",
        "🧫","🧴","💉","🔍","📌","📎","💡","🎯",
        "😂","🤣","😭","🙌","🤝","👏","❤️","💔"
    ];

    const STICKERS = [
        "🩺","🔬","🧪","🧬","💊",
        "🩸","📚","🎓","🏆","👏",
        "🔥","😂","❤️","💯"
    ];

    function renderEmoji(search = "") {
        if (!dom.emojiGrid) return;

        const term =
            String(search || "")
                .toLowerCase();

        const list =
            EMOJIS.filter(
                emoji =>
                    !term ||
                    emoji.includes(term)
            );

        dom.emojiGrid.innerHTML =
            list.map(
                emoji => `
                    <button
                        type="button"
                        class="emoji-item"
                        data-emoji="${emoji}"
                    >
                        ${emoji}
                    </button>
                `
            ).join("");
    }

    function renderStickers() {
        if (!dom.stickerGrid) return;

        dom.stickerGrid.innerHTML =
            STICKERS.map(
                sticker => `
                    <button
                        type="button"
                        class="emoji-item sticker-item"
                        data-sticker="${sticker}"
                    >
                        ${sticker}
                    </button>
                `
            ).join("");
    }

    function renderGIFs() {
        if (!dom.gifGrid) return;

        const search =
            String(
                dom.gifSearch?.value ||
                "medical"
            ).trim();

        const url =
            `https://tenor.com/search/${encodeURIComponent(
                search
            )}-gifs`;

        dom.gifGrid.innerHTML = `
            <a
                class="gif-search-link"
                href="${url}"
                target="_blank"
                rel="noopener"
            >
                🔎 Search GIFs for
                <strong>
                    ${escapeHTML(search)}
                </strong>
            </a>
        `;
    }

    function closePickers() {
        [
            dom.emojiPanel,
            dom.stickerPanel,
            dom.gifPanel
        ].forEach(
            panel =>
                panel?.classList.add(
                    "hidden"
                )
        );
    }

    /* ============================================================
       TYPING
       ============================================================ */

    function sendTyping() {
        if (
            !state.currentChannel ||
            !state.user
        ) {
            return;
        }

        const channel =
            supabase.channel(
                `typing-${state.currentChannel.id}`
            );

        channel.send({
            type: "broadcast",
            event: "typing",
            payload: {
                user_id:
                    state.user.id,

                name:
                    profileName(
                        state.user.id
                    )
            }
        }).catch(
            () => {}
        );

        setTimeout(
            () =>
                supabase.removeChannel(
                    channel
                ),
            1000
        );
    }

    /* ============================================================
       REALTIME
       ============================================================ */

    function clearRealtime() {
        for (const channel of state.realtime) {
            try {
                supabase.removeChannel(
                    channel
                );
            } catch {}
        }

        state.realtime = [];
    }

    function subscribeChannel() {
        if (!state.currentChannel) return;

        const channel =
            supabase
                .channel(
                    `community-channel-${state.currentChannel.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_messages",
                        filter:
                            `channel_id=eq.${state.currentChannel.id}`
                    },
                    async () => {
                        await loadMessages();
                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_attachments"
                    },
                    async () => {
                        await loadAttachments();
                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_presence"
                    },
                    async payload => {
                        const row =
                            payload.eventType ===
                            "DELETE"
                                ? payload.old
                                : payload.new;

                        if (
                            row?.user_id
                        ) {
                            state.presences.set(
                                row.user_id,
                                row
                            );
                        }

                        renderMembers();
                        updateOwnPresenceUI();
                    }
                )
                .on(
                    "broadcast",
                    {
                        event: "typing"
                    },
                    payload => {
                        const userId =
                            payload.payload
                                ?.user_id;

                        if (
                            !userId ||
                            userId ===
                                state.user.id
                        ) {
                            return;
                        }

                        if (
                            dom.typingIndicator
                        ) {
                            dom.typingIndicator
                                .textContent =
                                `${
                                    payload.payload?.name ||
                                    "Someone"
                                } is typing...`;

                            dom.typingIndicator.classList.remove(
                                "hidden"
                            );

                            clearTimeout(
                                state.typingTimer
                            );

                            state.typingTimer =
                                setTimeout(
                                    () => {
                                        dom.typingIndicator?.classList.add(
                                            "hidden"
                                        );
                                    },
                                    1800
                                );
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

        state.realtime.push(
            channel
        );
    }

    function subscribeCommunity() {
        if (!state.currentCommunity) {
            return;
        }

        const channel =
            supabase
                .channel(
                    `community-${state.currentCommunity.id}`
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
                        await loadChannels();
                    }
                )
                .on(
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
                )
                .subscribe();

        state.realtime.push(
            channel
        );
    }

    /* ============================================================
       MESSAGE EVENTS
       ============================================================ */

    function bindMessageButtons() {
        dom.messageList
            ?.querySelectorAll(
                "[data-action]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => {
                        const id =
                            button.dataset
                                .messageId;

                        const message =
                            state.messages.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(id)
                            );

                        switch (
                            button.dataset.action
                        ) {
                            case "reply":
                                setReply(
                                    message
                                );
                                break;

                            case "edit":
                                editMessage(
                                    id
                                );
                                break;

                            case "delete":
                                deleteMessage(
                                    id
                                );
                                break;

                            case "react":
                                reactToMessage(
                                    id
                                );
                                break;
                        }
                    }
                );
            });

        dom.messageList
            ?.querySelectorAll(
                "[data-call-user]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => {
                        window.dispatchEvent(
                            new CustomEvent(
                                "mwaniki:start-direct-call",
                                {
                                    detail: {
                                        userId:
                                            button.dataset
                                                .callUser
                                    }
                                }
                            )
                        );
                    }
                );
            });
    }

    /* ============================================================
       COMPOSER
       ============================================================ */

    function bindComposer() {
        document
            .getElementById(
                "attachButton"
            )
            ?.addEventListener(
                "click",
                () =>
                    dom.attachmentInput?.click()
            );

        dom.attachmentInput?.addEventListener(
            "change",
            event => {
                handleFiles(
                    event.target.files
                );

                event.target.value =
                    "";
            }
        );

        dom.attachmentPreview?.addEventListener(
            "click",
            event => {
                const button =
                    event.target.closest(
                        "[data-remove-file]"
                    );

                if (!button) return;

                state.selectedFiles.splice(
                    Number(
                        button.dataset
                            .removeFile
                    ),
                    1
                );

                renderAttachmentPreview();
            }
        );

        dom.sendButton?.addEventListener(
            "click",
            sendMessage
        );

        dom.messageInput?.addEventListener(
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

        dom.messageInput?.addEventListener(
            "input",
            sendTyping
        );

        document
            .getElementById(
                "voiceNoteButton"
            )
            ?.addEventListener(
                "click",
                toggleVoiceNote
            );

        dom.emojiButton?.addEventListener(
            "click",
            () => {
                dom.stickerPanel?.classList.add(
                    "hidden"
                );

                dom.gifPanel?.classList.add(
                    "hidden"
                );

                dom.emojiPanel?.classList.toggle(
                    "hidden"
                );
            }
        );

        dom.closeEmoji?.addEventListener(
            "click",
            () =>
                dom.emojiPanel?.classList.add(
                    "hidden"
                )
        );

        dom.stickerButton?.addEventListener(
            "click",
            () => {
                dom.emojiPanel?.classList.add(
                    "hidden"
                );

                dom.gifPanel?.classList.add(
                    "hidden"
                );

                dom.stickerPanel?.classList.toggle(
                    "hidden"
                );
            }
        );

        dom.closeSticker?.addEventListener(
            "click",
            () =>
                dom.stickerPanel?.classList.add(
                    "hidden"
                )
        );

        dom.gifButton?.addEventListener(
            "click",
            () => {
                dom.emojiPanel?.classList.add(
                    "hidden"
                );

                dom.stickerPanel?.classList.add(
                    "hidden"
                );

                dom.gifPanel?.classList.toggle(
                    "hidden"
                );

                renderGIFs();
            }
        );

        dom.closeGif?.addEventListener(
            "click",
            () =>
                dom.gifPanel?.classList.add(
                    "hidden"
                )
        );

        dom.emojiSearch?.addEventListener(
            "input",
            event =>
                renderEmoji(
                    event.target.value
                )
        );

        dom.emojiGrid?.addEventListener(
            "click",
            event => {
                const button =
                    event.target.closest(
                        "[data-emoji]"
                    );

                if (!button) return;

                dom.messageInput.value +=
                    button.dataset.emoji;

                dom.messageInput.focus();
            }
        );

        dom.stickerGrid?.addEventListener(
            "click",
            event => {
                const button =
                    event.target.closest(
                        "[data-sticker]"
                    );

                if (!button) return;

                dom.messageInput.value +=
                    button.dataset.sticker;

                dom.messageInput.focus();
            }
        );

        dom.gifSearch?.addEventListener(
            "input",
            renderGIFs
        );
    }

    /* ============================================================
       NAVIGATION / UI
       ============================================================ */

    function bindNavigation() {
        dom.home?.addEventListener(
            "click",
            () => {
                window.location.href =
                    "./dashboard.html";
            }
        );

        dom.mobileSidebar?.addEventListener(
            "click",
            () => {
                document
                    .getElementById(
                        "channelSidebar"
                    )
                    ?.classList.toggle(
                        "mobile-open"
                    );
            }
        );

        dom.channelSearch?.addEventListener(
            "input",
            renderChannels
        );

        dom.rail?.addEventListener(
            "click",
            async event => {
                const button =
                    event.target.closest(
                        "[data-community-id]"
                    );

                if (!button) return;

                const community =
                    state.communities.find(
                        item =>
                            String(
                                item.id
                            ) ===
                            String(
                                button.dataset
                                    .communityId
                            )
                    );

                if (community) {
                    await selectCommunity(
                        community
                    );
                }
            }
        );

        [
            dom.informationChannels,
            dom.courseChannels,
            dom.communityChannels
        ].forEach(container => {
            container?.addEventListener(
                "click",
                async event => {
                    const button =
                        event.target.closest(
                            "[data-channel-id]"
                        );

                    if (!button) return;

                    const channel =
                        state.channels.find(
                            item =>
                                String(
                                    item.id
                                ) ===
                                String(
                                    button.dataset
                                        .channelId
                                )
                        );

                    if (channel) {
                        await selectChannel(
                            channel
                        );
                    }
                }
            );
        });

        dom.membersButton?.addEventListener(
            "click",
            () =>
                dom.memberSidebar?.classList.toggle(
                    "open"
                )
        );

        dom.closeMembers?.addEventListener(
            "click",
            () =>
                dom.memberSidebar?.classList.remove(
                    "open"
                )
        );

        dom.memberSearch?.addEventListener(
            "input",
            renderMembers
        );

        dom.searchButton?.addEventListener(
            "click",
            () =>
                dom.searchBar?.classList.toggle(
                    "hidden"
                )
        );

        dom.closeSearch?.addEventListener(
            "click",
            () => {
                dom.searchBar?.classList.add(
                    "hidden"
                );

                if (dom.searchInput) {
                    dom.searchInput.value =
                        "";
                }
            }
        );

        dom.searchInput?.addEventListener(
            "input",
            event => {
                const term =
                    event.target.value
                        .trim()
                        .toLowerCase();

                document
                    .querySelectorAll(
                        ".message"
                    )
                    .forEach(message => {
                        message.style.display =
                            !term ||
                            message.textContent
                                .toLowerCase()
                                .includes(
                                    term
                                )
                                ? ""
                                : "none";
                    });
            }
        );

        dom.profileButton?.addEventListener(
            "click",
            () => {
                renderProfileModal();
                showModal(
                    dom.profileModal
                );
            }
        );

        document
            .getElementById(
                "closeProfileButton"
            )
            ?.addEventListener(
                "click",
                () =>
                    hideModal(
                        dom.profileModal
                    )
            );

        dom.rulesButton?.addEventListener(
            "click",
            () =>
                showModal(
                    dom.rulesModal
                )
        );

        document
            .getElementById(
                "closeRulesButton"
            )
            ?.addEventListener(
                "click",
                () =>
                    hideModal(
                        dom.rulesModal
                    )
            );

        dom.friendsButton?.addEventListener(
            "click",
            () => {
                renderFriends();
                showModal(
                    dom.friendsModal
                );
            }
        );

        document
            .getElementById(
                "closeFriendsButton"
            )
            ?.addEventListener(
                "click",
                () =>
                    hideModal(
                        dom.friendsModal
                    )
            );

        dom.memberList?.addEventListener(
            "click",
            event => {
                const button =
                    event.target.closest(
                        "[data-call-user]"
                    );

                if (!button) return;

                window.dispatchEvent(
                    new CustomEvent(
                        "mwaniki:start-direct-call",
                        {
                            detail: {
                                userId:
                                    button.dataset
                                        .callUser
                            }
                        }
                    )
                );
            }
        );
    }

    /* ============================================================
       PROFILE
       ============================================================ */

    function renderProfileModal() {
        if (!dom.profileModalContent) {
            return;
        }

        const name =
            profileName(
                state.user.id
            );

        const status =
            state.currentStatus;

        dom.profileModalContent.innerHTML = `
            <div class="profile-card">
                <img
                    src="${
                        profilePhoto(
                            state.user.id
                        ) ||
                        avatarFallback(name)
                    }"
                    alt=""
                    class="profile-modal-avatar"
                >

                <h3>
                    ${escapeHTML(name)}
                </h3>

                <p>
                    ${escapeHTML(
                        state.user.email ||
                        ""
                    )}
                </p>

                <div class="profile-status-options">
                    <button
                        type="button"
                        data-status="online"
                        class="${
                            status === "online"
                                ? "active"
                                : ""
                        }"
                    >
                        🟢 Online
                    </button>

                    <button
                        type="button"
                        data-status="away"
                        class="${
                            status === "away"
                                ? "active"
                                : ""
                        }"
                    >
                        🟡 Away
                    </button>

                    <button
                        type="button"
                        data-status="dnd"
                        class="${
                            status === "dnd"
                                ? "active"
                                : ""
                        }"
                    >
                        🔴 Do Not Disturb
                    </button>

                    <button
                        type="button"
                        data-status="offline"
                        class="${
                            status === "offline"
                                ? "active"
                                : ""
                        }"
                    >
                        ⚪ Offline
                    </button>
                </div>
            </div>
        `;

        dom.profileModalContent
            .querySelectorAll(
                "[data-status]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    async () => {
                        state.currentStatus =
                            button.dataset
                                .status;

                        state.manuallySelectedStatus =
                            state.currentStatus !==
                            "online";

                        await writePresence(
                            state.currentStatus
                        );

                        renderProfileModal();
                    }
                );
            });
    }

    /* ============================================================
       FRIENDS
       ============================================================ */

    function renderFriends() {
        if (!dom.friendsContent) {
            return;
        }

        const online =
            state.members.filter(
                member =>
                    effectiveStatus(
                        state.presences.get(
                            member.user_id
                        )
                    ) === "online"
            );

        dom.friendsContent.innerHTML = `
            <div class="friends-summary">
                <strong>
                    ${online.length}
                </strong>

                members currently online
            </div>

            <div class="friends-list">
                ${
                    online.length
                        ? online.map(
                            member => `
                                <div class="friend-item">
                                    <img
                                        src="${
                                            profilePhoto(
                                                member.user_id
                                            ) ||
                                            avatarFallback(
                                                profileName(
                                                    member.user_id
                                                )
                                            )
                                        }"
                                        alt=""
                                    >

                                    <div>
                                        <strong>
                                            ${escapeHTML(
                                                profileName(
                                                    member.user_id
                                                )
                                            )}
                                        </strong>

                                        <span>
                                            Online
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        data-call-user="${escapeHTML(
                                            member.user_id
                                        )}"
                                    >
                                        📞
                                    </button>
                                </div>
                            `
                        ).join("")
                        : `
                            <div class="friend-empty">
                                No other members are currently online.
                            </div>
                        `
                }
            </div>
        `;

        dom.friendsContent
            .querySelectorAll(
                "[data-call-user]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => {
                        hideModal(
                            dom.friendsModal
                        );

                        window.dispatchEvent(
                            new CustomEvent(
                                "mwaniki:start-direct-call",
                                {
                                    detail: {
                                        userId:
                                            button.dataset
                                                .callUser
                                    }
                                }
                            )
                        );
                    }
                );
            });
    }

    /* ============================================================
       CONTEST PLACEHOLDER
       ============================================================ */

    function openContest() {
        showModal(
            dom.contestModal
        );

        if (
            dom.contestQuestionArea
        ) {
            dom.contestQuestionArea.innerHTML = `
                <div class="contest-empty">
                    🏆
                    <strong>
                        Academic contests
                    </strong>

                    <span>
                        Contest functionality can use
                        your existing course and quiz data.
                    </span>
                </div>
            `;
        }
    }

    /* ============================================================
       SCROLL
       ============================================================ */

    function scrollMessages() {
        requestAnimationFrame(
            () => {
                if (dom.messageList) {
                    dom.messageList.scrollTop =
                        dom.messageList.scrollHeight;
                }
            }
        );
    }

    /* ============================================================
       INIT
       ============================================================ */

    async function initialize() {
        try {
            readCourseContext();

            await requireUser();

            if (!state.user) {
                return;
            }

            await loadOwnProfile();

            await writePresence(
                "online"
            );

            startPresence();

            renderEmoji();
            renderStickers();

            bindNavigation();
            bindComposer();

            await loadCommunities();

            subscribeCommunity();

            console.log(
                "✅ Mwaniki Scholars community loaded."
            );

        } catch (error) {
            console.error(
                "Community initialization failed:",
                error
            );

            toast(
                error.message ||
                "Community could not be loaded."
            );
        }
    }

    window.addEventListener(
        "beforeunload",
        () => {
            clearInterval(
                state.heartbeat
            );

            clearTimeout(
                state.awayTimer
            );

            clearRealtime();
        }
    );

    dom.contestButton?.addEventListener(
        "click",
        openContest
    );

    document
        .getElementById(
            "closeContestButton"
        )
        ?.addEventListener(
            "click",
            () =>
                hideModal(
                    dom.contestModal
                )
        );

    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key === "Escape"
            ) {
                closePickers();

                [
                    dom.profileModal,
                    dom.friendsModal,
                    dom.rulesModal,
                    dom.contestModal
                ].forEach(
                    hideModal
                );
            }
        }
    );

    initialize();

})();
