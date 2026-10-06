/* ============================================================
   MWANIKI SCHOLARS COMMUNITY
   COMPLETE COMMUNITY ENGINE
   ------------------------------------------------------------
   Built for the CURRENT community.html
   Built around the CURRENT Supabase schema
   ============================================================ */

"use strict";

/* ============================================================
   SUPABASE
   ------------------------------------------------------------
   IMPORTANT:
   We intentionally DO NOT use:
       import { supabase } from "./supabase.js";

   Your current supabase.js creates the browser client globally.
   ============================================================ */

let supabase = window.supabaseClient || window.mwanikiSupabase || window.sb;

const SUPABASE_READY_EVENT = "mwaniki-supabase-ready";

async function waitForSupabase() {
    if (
        supabase &&
        typeof supabase.from === "function"
    ) {
        return supabase;
    }

    await new Promise((resolve) => {
        window.addEventListener(
            SUPABASE_READY_EVENT,
            resolve,
            { once: true }
        );
    });

    supabase =
        window.supabaseClient ||
        window.mwanikiSupabase ||
        window.sb ||
        window.supabase;

    if (
        !supabase ||
        typeof supabase.from !== "function"
    ) {
        throw new Error(
            "Mwaniki Scholars Supabase client was not initialized."
        );
    }

    return supabase;
}


/* ============================================================
   CONFIGURATION
   ============================================================ */

const CONFIG = {

    messageLimit: 100,

    presenceHeartbeat: 25000,

    presenceFresh: 90000,

    awayAfter: 5 * 60 * 1000,

    typingTimeout: 2500,

    maxAttachmentSize:
        25 * 1024 * 1024,

    maxVoiceDuration:
        120000,

    attachmentBuckets: [
        "chat-attachments",
        "community-files",
        "chat-files",
        "attachments"
    ],

    voiceBuckets: [
        "chat-attachments",
        "voice-notes",
        "voice-notes",
        "community-files"
    ],

    communityIcons: {
        "mwaniki-scholars": "🎓",
        "med-rizz": "😂",
        "mwaniki-games": "🎮",
        "contests": "🏆"
    }

};


/* ============================================================
   STATE
   ============================================================ */

const state = {

    user: null,

    communities: [],

    currentCommunity: null,

    channels: [],

    currentChannel: null,

    courses: [],

    units: [],

    messages: [],

    members: [],

    profiles: new Map(),

    presences: new Map(),

    typingUsers: new Map(),

    realtime: [],

    heartbeat: null,

    awayTimer: null,

    typingTimer: null,

    selectedFiles: [],

    mediaRecorder: null,

    voiceChunks: [],

    voiceStarted: 0,

    recording: false,

    currentStatus: "online",

    manualStatus: false,

    messageSearch: "",

    channelSearch: "",

    activePicker: null

};


/* ============================================================
   DOM HELPERS
   ============================================================ */

const $ = (id) =>
    document.getElementById(id);


/* ============================================================
   ACTUAL HTML ELEMENTS
   ============================================================ */

const dom = {

    home:
        $("communityHomeButton"),

    communityRail:
        $("communityRail"),

    communityRailList:
        $("communityRailList"),

    addCommunity:
        $("addCommunityButton"),

    communityIcon:
        $("selectedCommunityIcon"),

    communityName:
        $("selectedCommunityName"),

    communityDescription:
        $("selectedCommunityDescription"),

    communityMenu:
        $("communityMenuButton"),

    communityCall:
        $("communityCallButton"),

    generalCall:
        $("generalCallButton"),

    information:
        $("informationChannels"),

    courses:
        $("courseChannels"),

    communityChannels:
        $("communityChannels"),

    channelSearch:
        $("channelSearchInput"),

    channelIcon:
        $("currentChannelIcon"),

    channelName:
        $("currentChannelName"),

    channelDescription:
        $("currentChannelDescription"),

    channelMembers:
        $("channelMembersButton"),

    channelSearchButton:
        $("channelSearchButton"),

    messageSearchBar:
        $("messageSearchBar"),

    messageSearchInput:
        $("messageSearchInput"),

    closeMessageSearch:
        $("closeMessageSearchButton"),

    messageList:
        $("messageList"),

    messageLoading:
        $("messageLoading"),

    typingIndicator:
        $("typingIndicator"),

    attachmentInput:
        $("attachmentInput"),

    attachButton:
        $("attachButton"),

    attachmentPreview:
        $("attachmentPreview"),

    emojiButton:
        $("emojiButton"),

    emojiPanel:
        $("emojiPanel"),

    emojiSearch:
        $("emojiSearch"),

    emojiGrid:
        $("emojiGrid"),

    emojiCategories:
        $("emojiCategories"),

    closeEmoji:
        $("closeEmojiButton"),

    stickerButton:
        $("stickerButton"),

    stickerPanel:
        $("stickerPanel"),

    stickerGrid:
        $("stickerGrid"),

    closeSticker:
        $("closeStickerButton"),

    gifButton:
        $("gifButton"),

    gifPanel:
        $("gifPanel"),

    gifSearch:
        $("gifSearch"),

    gifGrid:
        $("gifGrid"),

    closeGif:
        $("closeGifButton"),

    messageInput:
        $("messageInput"),

    sendMessage:
        $("sendMessageButton"),

    voiceButton:
        $("voiceNoteButton"),

    memberSidebar:
        $("memberSidebar"),

    memberList:
        $("memberList"),

    memberCount:
        $("memberCount"),

    memberSearch:
        $("memberSearchInput"),

    closeMemberSidebar:
        $("closeMemberSidebarButton"),

    friendsButton:
        $("friendsButton"),

    friendsModal:
        $("friendsModal"),

    friendsContent:
        $("friendsContent"),

    closeFriends:
        $("closeFriendsButton"),

    rulesButton:
        $("communityRulesButton"),

    rulesModal:
        $("rulesModal"),

    closeRules:
        $("closeRulesButton"),

    profileButton:
        $("profileButton"),

    profileModal:
        $("profileModal"),

    profileContent:
        $("profileModalContent"),

    closeProfile:
        $("closeProfileButton"),

    headerAvatar:
        $("headerProfileAvatar"),

    headerName:
        $("headerProfileName"),

    headerPresence:
        $("headerPresenceDot"),

    fileModal:
        $("filePreviewModal"),

    fileContent:
        $("filePreviewContent"),

    closeFile:
        $("closeFilePreviewButton"),

    cancelFile:
        $("cancelAttachmentButton"),

    confirmFile:
        $("confirmAttachmentButton"),

    contestButton:
        $("contestChannelButton"),

    contestModal:
        $("contestModal"),

    contestSelector:
        $("contestCourseSelector"),

    contestCourseName:
        $("contestCourseName"),

    contestQuestionArea:
        $("contestQuestionArea"),

    closeContest:
        $("closeContestButton"),

    toast:
        $("toast")

};


/* ============================================================
   SECURITY / HTML HELPERS
   ============================================================ */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function escapeAttribute(value) {

    return escapeHTML(value);

}


function safeURL(value) {

    const text = String(value || "").trim();

    if (!text) {
        return "";
    }

    try {

        const url =
            new URL(
                text,
                window.location.href
            );

        if (
            url.protocol === "https:" ||
            url.protocol === "http:"
        ) {
            return url.href;
        }

    } catch (_) {}

    return "";

}


function initials(name) {

    const value =
        String(name || "Student")
            .trim();

    if (!value) {
        return "S";
    }

    const parts =
        value.split(/\s+/);

    if (parts.length === 1) {
        return parts[0]
            .slice(0, 2)
            .toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();

}


function avatarFallback(name) {

    const text =
        initials(name);

    return (
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(`
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="96"
                height="96"
                viewBox="0 0 96 96"
            >
                <circle
                    cx="48"
                    cy="48"
                    r="48"
                    fill="#0b7285"
                />
                <text
                    x="48"
                    y="56"
                    text-anchor="middle"
                    font-family="Arial,sans-serif"
                    font-size="27"
                    font-weight="700"
                    fill="#ffffff"
                >${text}</text>
            </svg>
        `)
    );

}


/* ============================================================
   TOAST
   ============================================================ */

function toast(message) {

    if (!dom.toast) {
        console.log(message);
        return;
    }

    dom.toast.textContent =
        message;

    dom.toast.classList.remove(
        "hidden"
    );

    dom.toast.classList.add(
        "visible"
    );

    clearTimeout(
        toast.timer
    );

    toast.timer =
        setTimeout(() => {

            dom.toast.classList.remove(
                "visible"
            );

            dom.toast.classList.add(
                "hidden"
            );

        }, 3000);

}


/* ============================================================
   MODALS
   ============================================================ */

function openModal(element) {

    if (!element) return;

    element.classList.remove(
        "hidden"
    );

}


function closeModal(element) {

    if (!element) return;

    element.classList.add(
        "hidden"
    );

}


/* ============================================================
   AUTHENTICATION
   ============================================================ */

async function loadUser() {

    await waitForSupabase();

    const {
        data,
        error
    } =
        await supabase.auth.getUser();

    if (error) {
        console.error(
            "Authentication error:",
            error
        );
        return null;
    }

    if (!data?.user) {

        toast(
            "Please sign in first."
        );

        setTimeout(() => {

            window.location.href =
                "./studentLogin.html";

        }, 1000);

        return null;
    }

    state.user =
        data.user;

    return state.user;

}


/* ============================================================
   PROFILE DATA
   ============================================================ */

function getProfile(userId) {

    return (
        state.profiles.get(userId) ||
        {}
    );

}


function getMember(userId) {

    return (
        state.members.find(
            member =>
                String(member.user_id) ===
                String(userId)
        ) ||
        null
    );

}


function getName(userId) {

    if (!userId) {
        return "Mwaniki Scholar";
    }

    const member =
        getMember(userId);

    const profile =
        getProfile(userId);

    if (member?.display_name) {
        return member.display_name;
    }

    if (member?.nickname) {
        return member.nickname;
    }

    if (profile?.full_name) {
        return profile.full_name;
    }

    if (
        state.user &&
        state.user.id === userId
    ) {

        return (
            state.user.user_metadata?.full_name ||
            state.user.user_metadata?.name ||
            state.user.email?.split("@")[0] ||
            "You"
        );

    }

    return "Mwaniki Scholar";

}


function getPhoto(userId) {

    if (!userId) {
        return "";
    }

    const member =
        getMember(userId);

    const profile =
        getProfile(userId);

    return (
        safeURL(member?.avatar_url) ||
        safeURL(member?.photo_url) ||
        safeURL(profile?.photo_url) ||
        safeURL(
            state.user?.id === userId
                ? (
                    state.user.user_metadata?.avatar_url ||
                    state.user.user_metadata?.picture ||
                    state.user.user_metadata?.photo_url
                )
                : ""
        ) ||
        ""
    );

}


function avatarHTML(
    userId,
    size = "message"
) {

    const name =
        getName(userId);

    const photo =
        getPhoto(userId);

    const fallback =
        avatarFallback(name);

    return `
        <img
            class="message-avatar ${size}"
            src="${escapeAttribute(
                photo || fallback
            )}"
            data-user-id="${escapeAttribute(
                userId
            )}"
            alt="${escapeAttribute(
                name
            )}"
            loading="lazy"
            onerror="this.onerror=null;this.src='${fallback}'"
        >
    `;

}


/* ============================================================
   PRESENCE
   ============================================================ */

function normalizeStatus(status) {

    const value =
        String(status || "")
            .toLowerCase();

    if (
        value === "online" ||
        value === "away" ||
        value === "dnd" ||
        value === "offline"
    ) {
        return value;
    }

    return "offline";

}


function statusLabel(status) {

    switch (
        normalizeStatus(status)
    ) {

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


function presenceAge(row) {

    const time =
        new Date(
            row?.updated_at ||
            row?.last_seen_at ||
            0
        ).getTime();

    if (!time) {
        return Infinity;
    }

    return (
        Date.now() -
        time
    );

}


function effectiveStatus(row) {

    if (!row) {
        return "offline";
    }

    const raw =
        normalizeStatus(
            row.status
        );

    const age =
        presenceAge(row);

    /*
     * Do not mark a genuinely active user
     * offline merely because the page took
     * a few seconds to update.
     */

    if (
        raw === "online" &&
        age <= CONFIG.presenceFresh
    ) {
        return "online";
    }

    if (
        raw === "away" &&
        age <= CONFIG.presenceFresh * 4
    ) {
        return "away";
    }

    if (
        raw === "dnd" &&
        age <= CONFIG.presenceFresh * 4
    ) {
        return "dnd";
    }

    return "offline";

}


function getStatus(userId) {

    return effectiveStatus(
        state.presences.get(userId)
    );

}


function presenceDotHTML(userId) {

    const status =
        getStatus(userId);

    return `
        <span
            class="member-presence-dot presence-${status}"
            title="${escapeAttribute(
                statusLabel(status)
            )}"
        ></span>
    `;

}


/* ============================================================
   LOAD ALL PRESENCE
   ============================================================ */

async function loadPresence() {

    const {
        data,
        error
    } =
        await supabase
            .from("chat_presence")
            .select(`
                user_id,
                status,
                custom_status,
                last_seen_at,
                updated_at
            `);

    if (error) {

        console.warn(
            "Presence loading failed:",
            error.message
        );

        return;

    }

    state.presences.clear();

    for (
        const row of data || []
    ) {

        state.presences.set(
            row.user_id,
            row
        );

    }

    renderMembers();
    renderMessages();
    updateHeaderPresence();

}


/* ============================================================
   OWN PRESENCE
   ============================================================ */

async function upsertOwnPresence(
    status = "online"
) {

    if (!state.user) {
        return;
    }

    const now =
        new Date()
            .toISOString();

    const payload = {

        user_id:
            state.user.id,

        status:
            normalizeStatus(status),

        last_seen_at:
            now,

        updated_at:
            now

    };

    const {
        data,
        error
    } =
        await supabase
            .from("chat_presence")
            .upsert(
                payload,
                {
                    onConflict:
                        "user_id"
                }
            )
            .select()
            .single();

    if (error) {

        console.warn(
            "Could not update presence:",
            error.message
        );

        return;

    }

    state.currentStatus =
        normalizeStatus(
            data.status
        );

    state.presences.set(
        state.user.id,
        data
    );

    updateHeaderPresence();

}


function updateHeaderPresence() {

    if (!state.user) {
        return;
    }

    const status =
        getStatus(
            state.user.id
        );

    if (dom.headerPresence) {

        dom.headerPresence.className =
            `presence-dot presence-${status}`;

        dom.headerPresence.title =
            statusLabel(status);

    }

}


async function startPresence() {

    if (!state.user) {
        return;
    }

    const {
        data,
        error
    } =
        await supabase
            .from("chat_presence")
            .select(`
                user_id,
                status,
                custom_status,
                last_seen_at,
                updated_at
            `)
            .eq(
                "user_id",
                state.user.id
            )
            .maybeSingle();

    if (error) {

        console.warn(
            "Own presence read failed:",
            error.message
        );

    }

    if (data) {

        state.currentStatus =
            normalizeStatus(
                data.status
            );

        state.presences.set(
            state.user.id,
            data
        );

    } else {

        await upsertOwnPresence(
            "online"
        );

    }

    updateHeaderPresence();

    clearInterval(
        state.heartbeat
    );

    state.heartbeat =
        setInterval(
            async () => {

                if (
                    document.visibilityState ===
                    "hidden"
                ) {
                    return;
                }

                await upsertOwnPresence(
                    state.currentStatus
                );

            },
            CONFIG.presenceHeartbeat
        );

}


function setupActivityTracking() {

    let lastActivity = 0;

    const activity =
        () => {

            const now =
                Date.now();

            if (
                now -
                lastActivity <
                10000
            ) {
                return;
            }

            lastActivity =
                now;

            if (
                state.currentStatus ===
                "away"
            ) {

                state.currentStatus =
                    "online";

                upsertOwnPresence(
                    "online"
                );

            }

            clearTimeout(
                state.awayTimer
            );

            state.awayTimer =
                setTimeout(
                    () => {

                        if (
                            state.currentStatus ===
                            "online"
                        ) {

                            upsertOwnPresence(
                                "away"
                            );

                        }

                    },
                    CONFIG.awayAfter
                );

        };

    [
        "mousemove",
        "mousedown",
        "keydown",
        "touchstart",
        "scroll"
    ].forEach(
        eventName => {

            window.addEventListener(
                eventName,
                activity,
                {
                    passive: true
                }
            );

        }
    );

    document.addEventListener(
        "visibilitychange",
        () => {

            if (
                document.visibilityState ===
                "visible"
            ) {

                upsertOwnPresence(
                    "online"
                );

            }

        }
    );

    window.addEventListener(
        "beforeunload",
        () => {

            /*
             * We intentionally do not mark
             * offline using an async Supabase
             * request here because browsers
             * frequently terminate it.
             *
             * The heartbeat + freshness
             * calculation determines offline.
             */

        }
    );

}


/* ============================================================
   PROFILE LOADING
   ============================================================ */

async function loadProfilesForUsers(
    userIds
) {

    const ids =
        [
            ...new Set(
                (userIds || [])
                    .filter(Boolean)
                    .map(String)
            )
        ];

    if (!ids.length) {
        return;
    }

    const {
        data,
        error
    } =
        await supabase
            .from(
                "chat_public_profiles"
            )
            .select(`
                id,
                full_name,
                photo_url,
                updated_at
            `)
            .in(
                "id",
                ids
            );

    if (error) {

        console.warn(
            "Public profile loading failed:",
            error.message
        );

        return;

    }

    for (
        const profile of data || []
    ) {

        state.profiles.set(
            profile.id,
            profile
        );

    }

}


/* ============================================================
   COMMUNITIES
   ============================================================ */

async function loadCommunities() {

    const {
        data,
        error
    } =
        await supabase
            .from(
                "chat_communities"
            )
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
            .eq(
                "is_active",
                true
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );

    if (error) {

        console.error(
            "Communities failed:",
            error
        );

        toast(
            "Could not load communities."
        );

        return;

    }

    state.communities =
        data || [];

    renderCommunityRail();

    /*
     * Prefer Mwaniki Scholars as the
     * default community.
     */

    const preferred =
        state.communities.find(
            item =>
                item.slug ===
                "mwaniki-scholars"
        ) ||
        state.communities[0];

    if (preferred) {

        await selectCommunity(
            preferred
        );

    }

}


function communityIcon(
    community
) {

    const custom =
        safeURL(
            community?.icon_url
        );

    if (custom) {

        return `
            <img
                class="rail-community-image"
                src="${escapeAttribute(
                    custom
                )}"
                alt=""
                onerror="this.style.display='none'"
            >
        `;

    }

    return (
        CONFIG.communityIcons[
            community?.slug
        ] ||
        "🎓"
    );

}


function renderCommunityRail() {

    if (!dom.communityRailList) {
        return;
    }

    dom.communityRailList.innerHTML =
        state.communities
            .map(
                community => {

                    const active =
                        state.currentCommunity?.id ===
                        community.id;

                    return `
                        <button
                            type="button"
                            class="
                                community-rail-button
                                ${active ? "active" : ""}
                            "
                            data-community-id="${escapeAttribute(
                                community.id
                            )}"
                            title="${escapeAttribute(
                                community.name
                            )}"
                        >
                            <span class="community-rail-icon">
                                ${communityIcon(
                                    community
                                )}
                            </span>
                        </button>
                    `;

                }
            )
            .join("");

    dom.communityRailList
        .querySelectorAll(
            "[data-community-id]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

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

            }
        );

}


/* ============================================================
   COMMUNITY SELECTION
   ============================================================ */

async function selectCommunity(
    community
) {

    state.currentCommunity =
        community;

    state.currentChannel =
        null;

    renderCommunityRail();

    if (dom.communityName) {

        dom.communityName.textContent =
            community.name ||
            "Community";

    }

    if (dom.communityDescription) {

        dom.communityDescription.textContent =
            community.description ||
            "Academic community";

    }

    if (dom.communityIcon) {

        const custom =
            safeURL(
                community.icon_url
            );

        if (custom) {

            dom.communityIcon.innerHTML =
                `
                    <img
                        src="${escapeAttribute(
                            custom
                        )}"
                        alt=""
                    >
                `;

        } else {

            dom.communityIcon.textContent =
                CONFIG.communityIcons[
                    community.slug
                ] ||
                "🎓";

        }

    }

    await loadChannels();

    await loadMembers();

    subscribeCommunityRealtime();

}


/* ============================================================
   CHANNELS
   ============================================================ */

async function loadChannels() {

    if (!state.currentCommunity) {
        return;
    }

    const {
        data,
        error
    } =
        await supabase
            .from(
                "chat_channels"
            )
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
                created_at
            `)
            .eq(
                "community_id",
                state.currentCommunity.id
            )
            .eq(
                "is_active",
                true
            )
            .eq(
                "is_archived",
                false
            )
            .order(
                "position",
                {
                    ascending: true
                }
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );

    if (error) {

        console.error(
            "Channels failed:",
            error
        );

        toast(
            "Could not load channels."
        );

        return;

    }

    state.channels =
        data || [];

    await ensureDefaultChannel();

    renderChannels();

}


async function ensureDefaultChannel() {

    if (state.channels.length) {
        return;
    }

    /*
     * Do not manufacture channels in the
     * frontend if the database is empty.
     *
     * The application remains Supabase-driven.
     */

    toast(
        "This community has no active channels yet."
    );

}


/* ============================================================
   CHANNEL RENDERING
   ============================================================ */

function renderChannels() {

    const search =
        String(
            state.channelSearch ||
            ""
        )
            .toLowerCase()
            .trim();

    const channels =
        state.channels.filter(
            channel => {

                if (!search) {
                    return true;
                }

                return (
                    channel.name
                        ?.toLowerCase()
                        .includes(search) ||
                    channel.description
                        ?.toLowerCase()
                        .includes(search)
                );

            }
        );

    const information =
        channels.filter(
            channel =>
                !channel.course_id &&
                [
                    "announcement",
                    "info"
                ].includes(
                    String(
                        channel.channel_type
                    ).toLowerCase()
                )
        );

    const courseChannels =
        channels.filter(
            channel =>
                Boolean(
                    channel.course_id
                )
        );

    const communityChannels =
        channels.filter(
            channel =>
                !channel.course_id &&
                ![
                    "announcement",
                    "info"
                ].includes(
                    String(
                        channel.channel_type
                    ).toLowerCase()
                )
        );

    renderChannelGroup(
        dom.information,
        information
    );

    renderChannelGroup(
        dom.courses,
        courseChannels
    );

    renderChannelGroup(
        dom.communityChannels,
        communityChannels
    );

}


function channelIcon(
    channel
) {

    if (channel.icon) {
        return channel.icon;
    }

    switch (
        String(
            channel.channel_type ||
            "text"
        ).toLowerCase()
    ) {

        case "announcement":
            return "📢";

        case "study":
            return "📚";

        case "voice":
            return "🔊";

        default:
            return "#";

    }

}


function renderChannelGroup(
    container,
    channels
) {

    if (!container) {
        return;
    }

    container.innerHTML =
        channels.length
            ? channels
                .map(
                    channel => {

                        const active =
                            state.currentChannel?.id ===
                            channel.id;

                        return `
                            <button
                                type="button"
                                class="
                                    channel-button
                                    ${active ? "active" : ""}
                                "
                                data-channel-id="${escapeAttribute(
                                    channel.id
                                )}"
                            >
                                <span class="channel-icon">
                                    ${escapeHTML(
                                        channelIcon(
                                            channel
                                        )
                                    )}
                                </span>

                                <span class="channel-name">
                                    ${escapeHTML(
                                        channel.name
                                    )}
                                </span>
                            </button>
                        `;

                    }
                )
                .join("")
            :
                `
                    <div class="empty-channel-group">
                        No channels
                    </div>
                `;

    container
        .querySelectorAll(
            "[data-channel-id]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

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

            }
        );

}


/* ============================================================
   CHANNEL SELECTION
   ============================================================ */

async function selectChannel(
    channel
) {

    state.currentChannel =
        channel;

    if (dom.channelIcon) {

        dom.channelIcon.textContent =
            channelIcon(channel);

    }

    if (dom.channelName) {

        dom.channelName.textContent =
            channel.name ||
            "channel";

    }

    if (dom.channelDescription) {

        dom.channelDescription.textContent =
            channel.description ||
            "Community discussion";

    }

    renderChannels();

    await loadMessages();

    subscribeChannelRealtime();

}


/* ============================================================
   MEMBERS
   ============================================================ */

async function loadMembers() {

    if (!state.currentCommunity) {
        return;
    }

    /*
     * THIS is the critical correction.
     *
     * Members come from:
     *
     * chat_community_members
     *
     * NOT chat_public_profiles alone.
     */

    const {
        data,
        error
    } =
        await supabase
            .from(
                "chat_community_members"
            )
            .select(`
                id,
                community_id,
                user_id,
                role,
                nickname,
                is_muted,
                is_banned,
                membership_status,
                display_name,
                avatar_url,
                last_seen_at,
                last_active_at,
                status
            `)
            .eq(
                "community_id",
                state.currentCommunity.id
            )
            .eq(
                "is_banned",
                false
            )
            .order(
                "display_name",
                {
                    ascending: true,
                    nullsFirst: false
                }
            );

    if (error) {

        console.error(
            "MEMBERS QUERY FAILED:",
            error
        );

        toast(
            "Could not load community members."
        );

        return;

    }

    state.members =
        data || [];

    /*
     * If members table contains the actual
     * display_name/avatar_url, keep them.
     * Then supplement missing fields from
     * chat_public_profiles.
     */

    await loadProfilesForUsers(
        state.members.map(
            member =>
                member.user_id
        )
    );

    /*
     * Load presence separately.
     */

    await loadPresence();

    renderMembers();

}


function renderMembers() {

    if (!dom.memberList) {
        return;
    }

    const search =
        String(
            dom.memberSearch?.value ||
            ""
        )
            .toLowerCase()
            .trim();

    const visible =
        state.members.filter(
            member => {

                const name =
                    getName(
                        member.user_id
                    );

                const role =
                    String(
                        member.role || ""
                    );

                return (
                    !search ||
                    name
                        .toLowerCase()
                        .includes(search) ||
                    role
                        .toLowerCase()
                        .includes(search)
                );

            }
        );

    if (dom.memberCount) {

        dom.memberCount.textContent =
            String(
                state.members.length
            );

    }

    if (!visible.length) {

        dom.memberList.innerHTML =
            `
                <div class="empty-members">
                    <strong>No members found</strong>
                    <span>
                        Members of this community will appear here.
                    </span>
                </div>
            `;

        return;

    }

    dom.memberList.innerHTML =
        visible
            .map(
                member => {

                    const userId =
                        member.user_id;

                    const name =
                        getName(
                            userId
                        );

                    const status =
                        getStatus(
                            userId
                        );

                    const photo =
                        getPhoto(
                            userId
                        );

                    return `
                        <button
                            type="button"
                            class="member-row"
                            data-member-user-id="${escapeAttribute(
                                userId
                            )}"
                        >

                            <span class="member-avatar-wrap">

                                <img
                                    class="member-avatar"
                                    src="${escapeAttribute(
                                        photo ||
                                        avatarFallback(
                                            name
                                        )
                                    )}"
                                    alt="${escapeAttribute(
                                        name
                                    )}"
                                    loading="lazy"
                                    onerror="this.onerror=null;this.src='${avatarFallback(
                                        name
                                    )}'"
                                >

                                <span
                                    class="
                                        member-presence-dot
                                        presence-${status}
                                    "
                                    title="${escapeAttribute(
                                        statusLabel(
                                            status
                                        )
                                    )}"
                                ></span>

                            </span>

                            <span class="member-details">

                                <strong>
                                    ${escapeHTML(
                                        name
                                    )}
                                </strong>

                                <span>
                                    ${escapeHTML(
                                        member.role ||
                                        "Student"
                                    )}
                                </span>

                            </span>

                            <span
                                class="
                                    member-status-label
                                    status-${status}
                                "
                            >
                                ${escapeHTML(
                                    statusLabel(
                                        status
                                    )
                                )}
                            </span>

                        </button>
                    `;

                }
            )
            .join("");

}


/* ============================================================
   MESSAGES
   ============================================================ */

async function loadMessages() {

    if (
        !state.currentChannel ||
        !dom.messageList
    ) {
        return;
    }

    if (dom.messageLoading) {

        dom.messageLoading.classList.remove(
            "hidden"
        );

    }

    const {
        data,
        error
    } =
        await supabase
            .from(
                "chat_messages"
            )
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

    if (dom.messageLoading) {

        dom.messageLoading.classList.add(
            "hidden"
        );

    }

    if (error) {

        console.error(
            "Messages query failed:",
            error
        );

        toast(
            "Could not load messages."
        );

        return;

    }

    state.messages =
        data || [];

    const ids =
        state.messages
            .map(
                message =>
                    message.user_id
            )
            .filter(Boolean);

    /*
     * Ensure sender profiles are present.
     */

    await loadProfilesForUsers(
        ids
    );

    /*
     * Attachments are loaded separately.
     */

    await loadMessageAttachments();

    renderMessages();

}


async function loadMessageAttachments() {

    if (!state.messages.length) {
        return;
    }

    const ids =
        state.messages
            .map(
                message =>
                    message.id
            );

    const {
        data,
        error
    } =
        await supabase
            .from(
                "chat_attachments"
            )
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
            "Attachment loading failed:",
            error.message
        );

        return;

    }

    state.attachments =
        new Map();

    for (
        const attachment of data || []
    ) {

        if (
            !state.attachments.has(
                attachment.message_id
            )
        ) {

            state.attachments.set(
                attachment.message_id,
                []
            );

        }

        state.attachments
            .get(
                attachment.message_id
            )
            .push(
                attachment
            );

    }

}


function messageMatchesSearch(
    message
) {

    if (!state.messageSearch) {
        return true;
    }

    return String(
        message.content || ""
    )
        .toLowerCase()
        .includes(
            state.messageSearch
                .toLowerCase()
        );

}


function renderMessages() {

    if (!dom.messageList) {
        return;
    }

    const messages =
        state.messages.filter(
            message =>
                messageMatchesSearch(
                    message
                )
        );

    if (!messages.length) {

        dom.messageList.innerHTML =
            `
                <div class="empty-messages">

                    <div class="empty-messages-icon">
                        💬
                    </div>

                    <strong>
                        No messages yet
                    </strong>

                    <span>
                        Start the conversation.
                    </span>

                </div>
            `;

        return;

    }

    dom.messageList.innerHTML =
        messages
            .map(
                message =>
                    renderMessage(
                        message
                    )
            )
            .join("");

    scrollMessagesToBottom();

}


function renderMessage(
    message
) {

    const userId =
        message.user_id;

    const name =
        getName(userId);

    const status =
        getStatus(userId);

    const mine =
        state.user &&
        state.user.id ===
        userId;

    const deleted =
        Boolean(
            message.is_deleted
        );

    const attachments =
        state.attachments.get(
            message.id
        ) || [];

    let content =
        message.content || "";

    if (deleted) {

        content =
            "This message was deleted.";

    }

    const attachmentHTML =
        renderAttachments(
            attachments
        );

    return `
        <article
            class="
                chat-message
                ${mine ? "own-message" : ""}
                ${deleted ? "deleted-message" : ""}
            "
            data-message-id="${escapeAttribute(
                message.id
            )}"
        >

            <div class="message-avatar-column">

                ${avatarHTML(
                    userId,
                    "message"
                )}

                <span
                    class="
                        message-avatar-status
                        presence-${status}
                    "
                ></span>

            </div>

            <div class="message-body">

                <div class="message-meta">

                    <strong
                        class="message-sender"
                        title="${escapeAttribute(
                            statusLabel(status)
                        )}"
                    >
                        ${escapeHTML(
                            name
                        )}
                    </strong>

                    <span class="message-status-dot presence-${status}"></span>

                    <time>
                        ${escapeHTML(
                            formatTime(
                                message.created_at
                            )
                        )}
                    </time>

                    ${
                        message.is_edited
                            ? `
                                <span class="edited-label">
                                    edited
                                </span>
                            `
                            : ""
                    }

                </div>

                <div class="message-content">

                    ${
                        deleted
                            ? `
                                <em>
                                    This message was deleted.
                                </em>
                            `
                            :
                            formatMessageContent(
                                content
                            )
                    }

                </div>

                ${attachmentHTML}

                ${
                    mine && !deleted
                        ? `
                            <div class="message-actions">

                                <button
                                    type="button"
                                    data-edit-message="${escapeAttribute(
                                        message.id
                                    )}"
                                >
                                    Edit
                                </button>

                                <button
                                    type="button"
                                    data-delete-message="${escapeAttribute(
                                        message.id
                                    )}"
                                >
                                    Delete
                                </button>

                            </div>
                        `
                        : ""
                }

            </div>

        </article>
    `;

}


function formatMessageContent(
    content
) {

    const escaped =
        escapeHTML(
            content
        );

    return escaped
        .replace(
            /\n/g,
            "<br>"
        );

}


/* ============================================================
   ATTACHMENTS RENDERING
   ============================================================ */

function renderAttachments(
    attachments
) {

    if (!attachments.length) {
        return "";
    }

    return `
        <div class="message-attachments">

            ${attachments
                .map(
                    attachment => {

                        const url =
                            safeURL(
                                attachment.file_url
                            );

                        const mime =
                            String(
                                attachment.mime_type ||
                                ""
                            );

                        if (
                            mime.startsWith(
                                "image/"
                            ) &&
                            url
                        ) {

                            return `
                                <a
                                    href="${escapeAttribute(
                                        url
                                    )}"
                                    target="_blank"
                                    rel="noopener"
                                    class="message-image-link"
                                >
                                    <img
                                        class="message-image"
                                        src="${escapeAttribute(
                                            url
                                        )}"
                                        alt="${escapeAttribute(
                                            attachment.file_name
                                        )}"
                                        loading="lazy"
                                    >
                                </a>
                            `;

                        }

                        if (
                            mime.startsWith(
                                "audio/"
                            ) &&
                            url
                        ) {

                            return `
                                <div class="voice-message">

                                    <span class="voice-icon">
                                        🎙️
                                    </span>

                                    <div class="voice-file">

                                        <strong>
                                            ${escapeHTML(
                                                attachment.file_name
                                            )}
                                        </strong>

                                        <audio
                                            controls
                                            preload="metadata"
                                            src="${escapeAttribute(
                                                url
                                            )}"
                                        ></audio>

                                    </div>

                                </div>
                            `;

                        }

                        return `
                            <a
                                class="file-message"
                                href="${escapeAttribute(
                                    url
                                )}"
                                target="_blank"
                                rel="noopener"
                            >

                                <span class="file-message-icon">
                                    📄
                                </span>

                                <span>
                                    <strong>
                                        ${escapeHTML(
                                            attachment.file_name
                                        )}
                                    </strong>

                                    <small>
                                        ${escapeHTML(
                                            formatBytes(
                                                attachment.file_size
                                            )
                                        )}
                                    </small>
                                </span>

                            </a>
                        `;

                    }
                )
                .join("")}

        </div>
    `;

}


/* ============================================================
   SEND MESSAGE
   ============================================================ */

async function sendMessage() {

    if (
        !state.user ||
        !state.currentChannel
    ) {
        return;
    }

    const content =
        String(
            dom.messageInput?.value ||
            ""
        ).trim();

    if (!content) {
        return;
    }

    const {
        error
    } =
        await supabase
            .from(
                "chat_messages"
            )
            .insert({
                channel_id:
                    state.currentChannel.id,

                user_id:
                    state.user.id,

                content,

                message_type:
                    "text"
            });

    if (error) {

        console.error(
            "Message send failed:",
            error
        );

        toast(
            error.message ||
            "Could not send message."
        );

        return;

    }

    dom.messageInput.value = "";

    stopTyping();

    await loadMessages();

}


/* ============================================================
   EDIT MESSAGE
   ============================================================ */

async function editMessage(
    messageId
) {

    const message =
        state.messages.find(
            item =>
                item.id ===
                messageId
        );

    if (!message) {
        return;
    }

    if (
        message.user_id !==
        state.user?.id
    ) {
        return;
    }

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
    } =
        await supabase
            .from(
                "chat_messages"
            )
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
                messageId
            )
            .eq(
                "user_id",
                state.user.id
            );

    if (error) {

        toast(
            "Could not edit message."
        );

        console.error(
            error
        );

        return;

    }

    await loadMessages();

}


/* ============================================================
   DELETE MESSAGE
   ============================================================ */

async function deleteMessage(
    messageId
) {

    const message =
        state.messages.find(
            item =>
                item.id ===
                messageId
        );

    if (!message) {
        return;
    }

    if (
        message.user_id !==
        state.user?.id
    ) {
        return;
    }

    if (
        !window.confirm(
            "Delete this message?"
        )
    ) {
        return;
    }

    /*
     * Soft-delete.
     */

    const {
        error
    } =
        await supabase
            .from(
                "chat_messages"
            )
            .update({
                is_deleted:
                    true,

                deleted_at:
                    new Date()
                        .toISOString(),

                content:
                    ""
            })
            .eq(
                "id",
                messageId
            )
            .eq(
                "user_id",
                state.user.id
            );

    if (error) {

        console.error(
            "Delete failed:",
            error
        );

        toast(
            "Could not delete message."
        );

        return;

    }

    await loadMessages();

}


/* ============================================================
   TYPING INDICATOR
   ============================================================ */

async function broadcastTyping(
    isTyping
) {

    if (
        !state.currentChannel ||
        !state.user
    ) {
        return;
    }

    const channel =
        getTypingRealtimeChannel();

    if (!channel) {
        return;
    }

    try {

        await channel.send({
            type: "broadcast",
            event: "typing",
            payload: {

                user_id:
                    state.user.id,

                name:
                    getName(
                        state.user.id
                    ),

                typing:
                    Boolean(
                        isTyping
                    )

            }
        });

    } catch (error) {

        console.warn(
            "Typing broadcast failed:",
            error
        );

    }

}


function startTyping() {

    broadcastTyping(
        true
    );

    clearTimeout(
        state.typingTimer
    );

    state.typingTimer =
        setTimeout(
            () => {
                stopTyping();
            },
            CONFIG.typingTimeout
        );

}


function stopTyping() {

    clearTimeout(
        state.typingTimer
    );

    broadcastTyping(
        false
    );

}


function renderTypingIndicator() {

    if (!dom.typingIndicator) {
        return;
    }

    const users =
        [
            ...state.typingUsers.values()
        ].filter(
            user =>
                user.user_id !==
                state.user?.id
        );

    if (!users.length) {

        dom.typingIndicator.classList.add(
            "hidden"
        );

        dom.typingIndicator.textContent =
            "";

        return;

    }

    const names =
        users
            .slice(0, 3)
            .map(
                user =>
                    user.name ||
                    "Someone"
            );

    let text;

    if (names.length === 1) {

        text =
            `${names[0]} is typing…`;

    } else if (
        names.length === 2
    ) {

        text =
            `${names[0]} and ${names[1]} are typing…`;

    } else {

        text =
            `${names[0]}, ${names[1]} and others are typing…`;

    }

    dom.typingIndicator.textContent =
        text;

    dom.typingIndicator.classList.remove(
        "hidden"
    );

}


/* ============================================================
   TYPING REALTIME CHANNEL
   ============================================================ */

function getTypingRealtimeChannel() {

    if (
        !state.currentChannel ||
        !supabase
    ) {
        return null;
    }

    const key =
        `typing:${state.currentChannel.id}`;

    return state.realtime.find(
        channel =>
            channel.__typingKey ===
            key
    ) || null;

}


function subscribeTyping() {

    if (
        !state.currentChannel ||
        !supabase
    ) {
        return;
    }

    const key =
        `typing:${state.currentChannel.id}`;

    const existing =
        state.realtime.find(
            channel =>
                channel.__typingKey ===
                key
        );

    if (existing) {
        return;
    }

    const channel =
        supabase.channel(
            key
        );

    channel.__typingKey =
        key;

    channel.on(
        "broadcast",
        {
            event: "typing"
        },
        payload => {

            const data =
                payload.payload ||
                {};

            if (!data.user_id) {
                return;
            }

            if (
                data.typing
            ) {

                state.typingUsers.set(
                    data.user_id,
                    {
                        user_id:
                            data.user_id,

                        name:
                            data.name ||
                            getName(
                                data.user_id
                            )
                    }
                );

            } else {

                state.typingUsers.delete(
                    data.user_id
                );

            }

            renderTypingIndicator();

        }
    );

    channel.subscribe();

    state.realtime.push(
        channel
    );

}


/* ============================================================
   ATTACHMENT SELECTION
   ============================================================ */

function handleAttachmentSelection(
    event
) {

    const files =
        [
            ...(
                event.target.files ||
                []
            )
        ];

    if (!files.length) {
        return;
    }

    const valid =
        files.filter(
            file => {

                if (
                    file.size >
                    CONFIG.maxAttachmentSize
                ) {

                    toast(
                        `${file.name} is too large. Maximum is 25 MB.`
                    );

                    return false;
                }

                return true;

            }
        );

    state.selectedFiles =
        valid;

    renderAttachmentPreview();

    if (valid.length) {
        openModal(
            dom.fileModal
        );
    }

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
                file => {

                    const isImage =
                        file.type
                            ?.startsWith(
                                "image/"
                            );

                    const preview =
                        isImage
                            ? URL.createObjectURL(
                                file
                            )
                            : "";

                    return `
                        <div class="attachment-preview-item">

                            ${
                                preview
                                    ? `
                                        <img
                                            src="${preview}"
                                            alt=""
                                        >
                                    `
                                    : `
                                        <span class="preview-file-icon">
                                            📄
                                        </span>
                                    `
                            }

                            <div>

                                <strong>
                                    ${escapeHTML(
                                        file.name
                                    )}
                                </strong>

                                <small>
                                    ${escapeHTML(
                                        formatBytes(
                                            file.size
                                        )
                                    )}
                                </small>

                            </div>

                        </div>
                    `;

                }
            )
            .join("");

}


/* ============================================================
   STORAGE BUCKET DISCOVERY
   ============================================================ */

async function findStorageBucket(
    candidates
) {

    for (
        const bucketName of candidates
    ) {

        try {

            const {
                data,
                error
            } =
                await supabase.storage
                    .from(
                        bucketName
                    )
                    .list(
                        "",
                        {
                            limit: 1
                        }
                    );

            /*
             * A successful list means the
             * bucket exists and is accessible.
             */

            if (!error) {
                return bucketName;
            }

        } catch (_) {}

    }

    return null;

}


/* ============================================================
   UPLOAD ONE FILE
   ============================================================ */

async function uploadFile(
    file,
    folder = "attachments"
) {

    const bucket =
        await findStorageBucket(
            CONFIG.attachmentBuckets
        );

    if (!bucket) {

        throw new Error(
            "No accessible chat attachment storage bucket was found."
        );

    }

    const extension =
        file.name.includes(".")
            ? "." +
                file.name
                    .split(".")
                    .pop()
                    .toLowerCase()
            : "";

    const safeName =
        `${Date.now()}-${crypto.randomUUID()}${extension}`;

    const path =
        `${folder}/${state.user.id}/${safeName}`;

    const {
        error:
            uploadError
    } =
        await supabase.storage
            .from(
                bucket
            )
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

    if (uploadError) {

        throw uploadError;

    }

    const {
        data:
            publicData
    } =
        supabase.storage
            .from(
                bucket
            )
            .getPublicUrl(
                path
            );

    let url =
        publicData?.publicUrl ||
        "";

    /*
     * If the bucket is private, attempt
     * a signed URL.
     */

    if (!url) {

        const {
            data:
                signedData
        } =
            await supabase.storage
                .from(
                    bucket
                )
                .createSignedUrl(
                    path,
                    60 * 60 * 24
                );

        url =
            signedData?.signedUrl ||
            "";

    }

    if (!url) {

        throw new Error(
            "File uploaded but a usable file URL could not be generated."
        );

    }

    return {

        bucket,

        path,

        url

    };

}


/* ============================================================
   SEND ATTACHMENTS
   ============================================================ */

async function sendSelectedFiles() {

    if (
        !state.currentChannel ||
        !state.user
    ) {
        return;
    }

    if (!state.selectedFiles.length) {
        return;
    }

    const files =
        [
            ...state.selectedFiles
        ];

    try {

        for (
            const file of files
        ) {

            const uploaded =
                await uploadFile(
                    file,
                    "attachments"
                );

            const {
                data:
                    message,
                error:
                    messageError
            } =
                await supabase
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
                            file.type?.startsWith(
                                "image/"
                            )
                                ? "image"
                                : "file"
                    })
                    .select()
                    .single();

            if (messageError) {
                throw messageError;
            }

            const {
                error:
                    attachmentError
            } =
                await supabase
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
                            uploaded.path,

                        file_url:
                            uploaded.url,

                        mime_type:
                            file.type ||
                            "application/octet-stream",

                        file_size:
                            file.size
                    });

            if (attachmentError) {
                throw attachmentError;
            }

        }

        state.selectedFiles =
            [];

        if (
            dom.attachmentInput
        ) {
            dom.attachmentInput.value =
                "";
        }

        renderAttachmentPreview();

        closeModal(
            dom.fileModal
        );

        toast(
            "Attachment sent."
        );

        await loadMessages();

    } catch (error) {

        console.error(
            "Attachment upload failed:",
            error
        );

        toast(
            error.message ||
            "Attachment upload failed."
        );

    }

}


/* ============================================================
   VOICE NOTES
   ============================================================ */

async function toggleVoiceRecording() {

    if (
        state.recording
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

        toast(
            "Voice recording is not supported by this browser."
        );

        return;

    }

    if (
        !state.currentChannel
    ) {

        toast(
            "Select a channel first."
        );

        return;

    }

    try {

        const stream =
            await navigator.mediaDevices
                .getUserMedia({
                    audio: true
                });

        state.voiceChunks =
            [];

        let mime =
            "";

        if (
            MediaRecorder.isTypeSupported(
                "audio/webm;codecs=opus"
            )
        ) {

            mime =
                "audio/webm;codecs=opus";

        } else if (
            MediaRecorder.isTypeSupported(
                "audio/webm"
            )
        ) {

            mime =
                "audio/webm";

        }

        state.mediaRecorder =
            new MediaRecorder(
                stream,
                mime
                    ? {
                        mimeType:
                            mime
                    }
                    : undefined
            );

        state.voiceStarted =
            Date.now();

        state.recording =
            true;

        state.mediaRecorder.ondataavailable =
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

        state.mediaRecorder.onstop =
            async () => {

                stream
                    .getTracks()
                    .forEach(
                        track =>
                            track.stop()
                    );

                state.recording =
                    false;

                updateVoiceButton();

                const blob =
                    new Blob(
                        state.voiceChunks,
                        {
                            type:
                                state.mediaRecorder
                                    ?.mimeType ||
                                "audio/webm"
                        }
                    );

                state.mediaRecorder =
                    null;

                state.voiceChunks =
                    [];

                if (
                    blob.size
                ) {

                    await sendVoiceNote(
                        blob
                    );

                }

            };

        state.mediaRecorder.start(
            250
        );

        updateVoiceButton();

        toast(
            "Recording voice note… click the microphone again to stop."
        );

        setTimeout(
            () => {

                if (
                    state.recording
                ) {

                    stopVoiceRecording();

                }

            },
            CONFIG.maxVoiceDuration
        );

    } catch (error) {

        console.error(
            "Microphone error:",
            error
        );

        toast(
            "Microphone permission was not granted."
        );

    }

}


function stopVoiceRecording() {

    if (
        state.mediaRecorder &&
        state.recording
    ) {

        try {

            state.mediaRecorder.stop();

        } catch (_) {}

    }

}


function updateVoiceButton() {

    if (!dom.voiceButton) {
        return;
    }

    if (state.recording) {

        dom.voiceButton.textContent =
            "⏹️";

        dom.voiceButton.classList.add(
            "recording"
        );

        dom.voiceButton.title =
            "Stop recording";

    } else {

        dom.voiceButton.textContent =
            "🎙️";

        dom.voiceButton.classList.remove(
            "recording"
        );

        dom.voiceButton.title =
            "Record voice note";

    }

}


async function sendVoiceNote(
    blob
) {

    try {

        const extension =
            "webm";

        const file =
            new File(
                [
                    blob
                ],
                `voice-${Date.now()}.${extension}`,
                {
                    type:
                        blob.type ||
                        "audio/webm"
                }
            );

        const uploaded =
            await uploadFile(
                file,
                "voice-notes"
            );

        const {
            data:
                message,
            error:
                messageError
        } =
            await supabase
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
                        "voice"
                })
                .select()
                .single();

        if (messageError) {
            throw messageError;
        }

        const {
            error:
                attachmentError
        } =
            await supabase
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
                        uploaded.path,

                    file_url:
                        uploaded.url,

                    mime_type:
                        file.type,

                    file_size:
                        file.size
                });

        if (attachmentError) {
            throw attachmentError;
        }

        toast(
            "Voice note sent."
        );

        await loadMessages();

    } catch (error) {

        console.error(
            "Voice note upload failed:",
            error
        );

        toast(
            error.message ||
            "Voice note could not be sent."
        );

    }

}


/* ============================================================
   REALTIME
   ============================================================ */

function removeRealtimeChannel(
    predicate
) {

    const channels =
        state.realtime.filter(
            predicate
        );

    for (
        const channel of channels
    ) {

        try {

            supabase.removeChannel(
                channel
            );

        } catch (_) {}

        const index =
            state.realtime.indexOf(
                channel
            );

        if (index >= 0) {

            state.realtime.splice(
                index,
                1
            );

        }

    }

}


function subscribeChannelRealtime() {

    if (
        !state.currentChannel
    ) {
        return;
    }

    removeRealtimeChannel(
        channel =>
            channel.__messageChannel === true
    );

    const channel =
        supabase.channel(
            `messages:${state.currentChannel.id}`
        );

    channel.__messageChannel =
        true;

    channel.on(
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
    );

    channel.subscribe();

    state.realtime.push(
        channel
    );

    subscribeTyping();

}


function subscribeCommunityRealtime() {

    if (
        !state.currentCommunity
    ) {
        return;
    }

    removeRealtimeChannel(
        channel =>
            channel.__communityChannel === true
    );

    const channel =
        supabase.channel(
            `community:${state.currentCommunity.id}`
        );

    channel.__communityChannel =
        true;

    channel.on(
        "postgres_changes",
        {
            event: "*",
            schema: "public",
            table:
                "chat_community_members",
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
            table:
                "chat_presence"
        },
        payload => {

            const row =
                payload.new ||
                payload.old;

            if (
                row?.user_id
            ) {

                state.presences.set(
                    row.user_id,
                    row
                );

                renderMembers();

                renderMessages();

                updateHeaderPresence();

            }

        }
    );

    channel.subscribe();

    state.realtime.push(
        channel
    );

}


/* ============================================================
   EMOJI
   ============================================================ */

const EMOJIS = [
    "😀","😃","😄","😁","😆","😅","😂","🤣",
    "😊","😇","🙂","🙃","😉","😍","🥰","😘",
    "😎","🤓","🤩","🥳","🤔","🤭","🤗","😴",
    "😢","😭","😤","😡","🤬","🙏","👏","👍",
    "👎","👌","✌️","🤝","💪","❤️","💚","💙",
    "💜","🩺","🧪","🔬","🧬","💊","🩸","📚",
    "📖","📝","🎓","🏆","🔥","⭐","✨"
];


function renderEmojiGrid() {

    if (!dom.emojiGrid) {
        return;
    }

    dom.emojiGrid.innerHTML =
        EMOJIS
            .map(
                emoji => `
                    <button
                        type="button"
                        class="emoji-item"
                        data-emoji="${escapeAttribute(
                            emoji
                        )}"
                    >
                        ${emoji}
                    </button>
                `
            )
            .join("");

}


function insertAtCursor(
    input,
    text
) {

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
        text +
        input.value.slice(
            end
        );

    input.selectionStart =
        input.selectionEnd =
            start + text.length;

    input.focus();

}


function togglePicker(
    panel,
    type
) {

    if (!panel) {
        return;
    }

    const isOpen =
        !panel.classList.contains(
            "hidden"
        );

    closeAllPickers();

    if (!isOpen) {

        panel.classList.remove(
            "hidden"
        );

        state.activePicker =
            type;

    }

}


function closeAllPickers() {

    [
        dom.emojiPanel,
        dom.stickerPanel,
        dom.gifPanel
    ].forEach(
        panel => {

            if (panel) {

                panel.classList.add(
                    "hidden"
                );

            }

        }
    );

    state.activePicker =
        null;

}


/* ============================================================
   STICKERS
   ============================================================ */

const STICKERS = [
    "🩺",
    "🔬",
    "🧪",
    "🧬",
    "💊",
    "🩸",
    "📚",
    "🎓",
    "🏆",
    "😂",
    "🔥",
    "👏"
];


function renderStickers() {

    if (!dom.stickerGrid) {
        return;
    }

    dom.stickerGrid.innerHTML =
        STICKERS
            .map(
                sticker => `
                    <button
                        type="button"
                        class="sticker-item"
                        data-sticker="${escapeAttribute(
                            sticker
                        )}"
                    >
                        ${sticker}
                    </button>
                `
            )
            .join("");

}


/* ============================================================
   GIF
   ============================================================ */

function renderGifPanel() {

    if (!dom.gifGrid) {
        return;
    }

    dom.gifGrid.innerHTML =
        `
            <div class="gif-empty">
                <span>GIF</span>
                <strong>GIF search</strong>
                <small>
                    Connect a GIF provider later without changing the community engine.
                </small>
            </div>
        `;

}


/* ============================================================
   MESSAGE SEARCH
   ============================================================ */

function setupMessageSearch() {

    if (
        !dom.messageSearchInput
    ) {
        return;
    }

    dom.messageSearchInput
        .addEventListener(
            "input",
            () => {

                state.messageSearch =
                    dom.messageSearchInput
                        .value
                        .trim();

                renderMessages();

            }
        );

}


/* ============================================================
   EVENTS
   ============================================================ */

function setupEvents() {

    dom.home?.addEventListener(
        "click",
        () => {

            window.location.href =
                "./dashboard.html";

        }
    );


    dom.channelSearch
        ?.addEventListener(
            "input",
            () => {

                state.channelSearch =
                    dom.channelSearch
                        .value
                        .trim();

                renderChannels();

            }
        );


    dom.sendMessage
        ?.addEventListener(
            "click",
            sendMessage
        );


    dom.messageInput
        ?.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();

                    sendMessage();

                    return;

                }

                startTyping();

            }
        );


    dom.messageInput
        ?.addEventListener(
            "input",
            () => {

                if (
                    dom.messageInput
                        .value
                        .trim()
                ) {

                    startTyping();

                } else {

                    stopTyping();

                }

            }
        );


    dom.attachmentInput
        ?.addEventListener(
            "change",
            handleAttachmentSelection
        );


    dom.attachButton
        ?.addEventListener(
            "click",
            () => {

                dom.attachmentInput?.click();

            }
        );


    dom.confirmFile
        ?.addEventListener(
            "click",
            sendSelectedFiles
        );


    dom.cancelFile
        ?.addEventListener(
            "click",
            () => {

                state.selectedFiles =
                    [];

                if (
                    dom.attachmentInput
                ) {
                    dom.attachmentInput.value =
                        "";
                }

                renderAttachmentPreview();

                closeModal(
                    dom.fileModal
                );

            }
        );


    dom.closeFile
        ?.addEventListener(
            "click",
            () => {

                closeModal(
                    dom.fileModal
                );

            }
        );


    dom.voiceButton
        ?.addEventListener(
            "click",
            toggleVoiceRecording
        );


    dom.emojiButton
        ?.addEventListener(
            "click",
            () => {

                togglePicker(
                    dom.emojiPanel,
                    "emoji"
                );

            }
        );


    dom.closeEmoji
        ?.addEventListener(
            "click",
            closeAllPickers
        );


    dom.stickerButton
        ?.addEventListener(
            "click",
            () => {

                togglePicker(
                    dom.stickerPanel,
                    "sticker"
                );

            }
        );


    dom.closeSticker
        ?.addEventListener(
            "click",
            closeAllPickers
        );


    dom.gifButton
        ?.addEventListener(
            "click",
            () => {

                togglePicker(
                    dom.gifPanel,
                    "gif"
                );

            }
        );


    dom.closeGif
        ?.addEventListener(
            "click",
            closeAllPickers
        );


    dom.emojiGrid
        ?.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        "[data-emoji]"
                    );

                if (!button) {
                    return;
                }

                insertAtCursor(
                    dom.messageInput,
                    button.dataset.emoji
                );

            }
        );


    dom.stickerGrid
        ?.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        "[data-sticker]"
                    );

                if (!button) {
                    return;
                }

                insertAtCursor(
                    dom.messageInput,
                    button.dataset.sticker
                );

                closeAllPickers();

            }
        );


    dom.channelMembers
        ?.addEventListener(
            "click",
            () => {

                dom.memberSidebar?.classList.add(
                    "open"
                );

                renderMembers();

            }
        );


    dom.closeMemberSidebar
        ?.addEventListener(
            "click",
            () => {

                dom.memberSidebar?.classList.remove(
                    "open"
                );

            }
        );


    dom.memberSearch
        ?.addEventListener(
            "input",
            renderMembers
        );


    dom.channelSearchButton
        ?.addEventListener(
            "click",
            () => {

                dom.messageSearchBar?.classList.remove(
                    "hidden"
                );

                dom.messageSearchInput?.focus();

            }
        );


    dom.closeMessageSearch
        ?.addEventListener(
            "click",
            () => {

                state.messageSearch =
                    "";

                if (
                    dom.messageSearchInput
                ) {
                    dom.messageSearchInput.value =
                        "";
                }

                dom.messageSearchBar?.classList.add(
                    "hidden"
                );

                renderMessages();

            }
        );


    dom.rulesButton
        ?.addEventListener(
            "click",
            () => {

                openModal(
                    dom.rulesModal
                );

            }
        );


    dom.closeRules
        ?.addEventListener(
            "click",
            () => {

                closeModal(
                    dom.rulesModal
                );

            }
        );


    dom.profileButton
        ?.addEventListener(
            "click",
            () => {

                renderProfileModal();

                openModal(
                    dom.profileModal
                );

            }
        );


    dom.closeProfile
        ?.addEventListener(
            "click",
            () => {

                closeModal(
                    dom.profileModal
                );

            }
        );


    dom.friendsButton
        ?.addEventListener(
            "click",
            async () => {

                await renderFriends();

                openModal(
                    dom.friendsModal
                );

            }
        );


    dom.closeFriends
        ?.addEventListener(
            "click",
            () => {

                closeModal(
                    dom.friendsModal
                );

            }
        );


    dom.contestButton
        ?.addEventListener(
            "click",
            () => {

                openModal(
                    dom.contestModal
                );

            }
        );


    dom.closeContest
        ?.addEventListener(
            "click",
            () => {

                closeModal(
                    dom.contestModal
                );

            }
        );


    dom.messageList
        ?.addEventListener(
            "click",
            event => {

                const edit =
                    event.target.closest(
                        "[data-edit-message]"
                    );

                if (edit) {

                    editMessage(
                        edit.dataset.editMessage
                    );

                    return;

                }

                const del =
                    event.target.closest(
                        "[data-delete-message]"
                    );

                if (del) {

                    deleteMessage(
                        del.dataset.deleteMessage
                    );

                }

            }
        );


    document.addEventListener(
        "click",
        event => {

            if (
                !event.target.closest(
                    ".picker-panel"
                ) &&
                !event.target.closest(
                    ".composer-button"
                )
            ) {

                closeAllPickers();

            }

        }
    );

}


/* ============================================================
   PROFILE MODAL
   ============================================================ */

function renderProfileModal() {

    if (
        !dom.profileContent ||
        !state.user
    ) {
        return;
    }

    const name =
        getName(
            state.user.id
        );

    const photo =
        getPhoto(
            state.user.id
        ) ||
        avatarFallback(
            name
        );

    const status =
        getStatus(
            state.user.id
        );

    dom.profileContent.innerHTML =
        `
            <div class="profile-card-content">

                <img
                    class="profile-modal-avatar"
                    src="${escapeAttribute(
                        photo
                    )}"
                    alt="${escapeAttribute(
                        name
                    )}"
                >

                <h2>
                    ${escapeHTML(
                        name
                    )}
                </h2>

                <span
                    class="profile-status status-${status}"
                >
                    <span class="profile-status-dot"></span>
                    ${escapeHTML(
                        statusLabel(
                            status
                        )
                    )}
                </span>

                <p>
                    ${escapeHTML(
                        state.user.email ||
                        ""
                    )}
                </p>

                <div class="profile-status-actions">

                    <button
                        type="button"
                        data-set-status="online"
                    >
                        Online
                    </button>

                    <button
                        type="button"
                        data-set-status="away"
                    >
                        Away
                    </button>

                    <button
                        type="button"
                        data-set-status="dnd"
                    >
                        Do Not Disturb
                    </button>

                </div>

            </div>
        `;

    dom.profileContent
        .querySelectorAll(
            "[data-set-status]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const status =
                            button.dataset
                                .setStatus;

                        state.currentStatus =
                            status;

                        await upsertOwnPresence(
                            status
                        );

                        renderProfileModal();

                    }
                );

            }
        );

}


/* ============================================================
   FRIENDS
   ============================================================ */

async function renderFriends() {

    if (!dom.friendsContent) {
        return;
    }

    /*
     * Use community members as the
     * reliable visual online directory.
     */

    const online =
        state.members.filter(
            member =>
                getStatus(
                    member.user_id
                ) !== "offline"
        );

    dom.friendsContent.innerHTML =
        `
            <div class="friends-online-summary">
                <strong>
                    ${online.length}
                </strong>
                members currently active
            </div>

            <div class="friends-member-list">

                ${
                    online.length
                        ? online
                            .map(
                                member => {

                                    const id =
                                        member.user_id;

                                    return `
                                        <div class="friend-row">

                                            <span class="friend-avatar-wrap">

                                                <img
                                                    class="friend-avatar"
                                                    src="${escapeAttribute(
                                                        getPhoto(id) ||
                                                        avatarFallback(
                                                            getName(id)
                                                        )
                                                    )}"
                                                    alt=""
                                                >

                                                <span
                                                    class="
                                                        member-presence-dot
                                                        presence-${getStatus(id)}
                                                    "
                                                ></span>

                                            </span>

                                            <span class="friend-info">

                                                <strong>
                                                    ${escapeHTML(
                                                        getName(id)
                                                    )}
                                                </strong>

                                                <small>
                                                    ${escapeHTML(
                                                        statusLabel(
                                                            getStatus(id)
                                                        )
                                                    )}
                                                </small>

                                            </span>

                                        </div>
                                    `;

                                }
                            )
                            .join("")
                        :
                            `
                                <div class="empty-members">
                                    No active members right now.
                                </div>
                            `
                }

            </div>
        `;

}


/* ============================================================
   SCROLL
   ============================================================ */

function scrollMessagesToBottom() {

    if (!dom.messageList) {
        return;
    }

    requestAnimationFrame(
        () => {

            dom.messageList.scrollTop =
                dom.messageList.scrollHeight;

        }
    );

}


/* ============================================================
   INITIALIZATION
   ============================================================ */

async function init() {

    try {

        console.log(
            "Mwaniki Scholars Community starting…"
        );

        await waitForSupabase();

        console.log(
            "Supabase client ready."
        );

        const user =
            await loadUser();

        if (!user) {
            return;
        }

        setupEvents();

        renderEmojiGrid();

        renderStickers();

        renderGifPanel();

        await loadProfilesForUsers([
            state.user.id
        ]);

        await startPresence();

        setupActivityTracking();

        await loadCommunities();

        console.log(
            "Community initialized successfully."
        );

    } catch (error) {

        console.error(
            "COMMUNITY INITIALIZATION ERROR:",
            error
        );

        toast(
            error.message ||
            "Community could not start."
        );

    }

}


/* ============================================================
   START
   ============================================================ */

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
