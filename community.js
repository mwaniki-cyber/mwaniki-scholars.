/* ============================================================
   MWANIKI SCHOLARS COMMUNITY
   CLEAN COMMUNITY ENGINE
   ============================================================ */

import { supabase } from "./supabase.js";


/* ============================================================
   CONFIG
   ============================================================ */

const CONFIG = {
    messageLimit: 100,

    heartbeatMs: 20000,

    presenceFreshMs: 90000,

    awayAfterMs: 5 * 60 * 1000,

    maxAttachmentSize: 25 * 1024 * 1024,

    maxVoiceNoteMs: 120000,

    storageBucket: "chat-attachments",

    communityIcons: {
        "mwaniki-scholars": "🩺",
        "med-rizz": "😂",
        "mwaniki-games": "🎮",
        "contests": "🏆"
    },

    fallbackContests: {
        id: "virtual-contests",
        name: "Contests",
        slug: "contests",
        description: "Academic competitions using real course data.",
        icon_url: "🏆",
        isVirtual: true
    },

    emoji: [
        "😀","😃","😄","😁","😆","😅","😂","🤣",
        "😊","😇","🙂","🙃","😉","😌","😍","🥰",
        "😘","😎","🤓","🧐","🤩","🥳","😏","😐",
        "😑","😶","🙄","😬","🤔","🤭","🤗","😴",
        "🤒","🤕","🤢","🤮","🤧","🥶","🥵","😱",
        "😢","😭","😤","😡","🤬","🙏","👏","👍",
        "👎","👌","✌️","🤝","💪","❤️","💚","💙",
        "💜","🩺","🧪","🔬","🧬","💊","🩸","📚",
        "📖","📝","🎓","🏆","🔥","⭐","✨"
    ],

    stickers: [
        "🩺","🔬","🧪","🧬","💊","🩸",
        "📚","🎓","🏆","😂","🔥","👏"
    ],

    gifs: [
        "😂 laughing",
        "👏 applause",
        "🔥 fire",
        "🎉 celebration",
        "🤣 funny",
        "💀 dead",
        "❤️ love",
        "👍 approval",
        "😎 cool",
        "😭 crying"
    ]
};


/* ============================================================
   STATE
   ============================================================ */

const state = {
    user: null,

    communities: [],
    courses: [],

    currentCommunity: null,
    currentChannel: null,

    channels: [],
    messages: [],

    members: [],
    profiles: new Map(),
    presences: new Map(),

    attachments: new Map(),
    signedUrls: new Map(),

    selectedFiles: [],

    currentStatus: "online",
    manuallySelectedStatus: false,

    heartbeatTimer: null,
    awayTimer: null,

    realtimeChannels: [],

    recording: false,
    mediaRecorder: null,
    voiceChunks: [],
    voiceStartedAt: 0,

    callSelectedUsers: new Set(),

    typingTimer: null,

    storageBucket: CONFIG.storageBucket
};


/* ============================================================
   DOM HELPERS
   ============================================================ */

const $ = id => document.getElementById(id);

const dom = {
    communityRailList: $("communityRailList"),
    addCommunityButton: $("addCommunityButton"),

    selectedCommunityIcon: $("selectedCommunityIcon"),
    selectedCommunityName: $("selectedCommunityName"),
    selectedCommunityDescription: $("selectedCommunityDescription"),

    informationChannels: $("informationChannels"),
    generalChannels: $("generalChannels"),
    studyChannels: $("studyChannels"),
    courseChannels: $("courseChannels"),
    communityChannels: $("communityChannels"),
    voiceChannels: $("voiceChannels"),
    courseChannelCount: $("courseChannelCount"),

    channelSearchInput: $("channelSearchInput"),

    currentChannelIcon: $("currentChannelIcon"),
    currentChannelName: $("currentChannelName"),
    currentChannelDescription: $("currentChannelDescription"),
    currentChannelType: $("currentChannelType"),

    messageList: $("messageList"),
    messageLoading: $("messageLoading"),

    messageInput: $("messageInput"),
    sendMessageButton: $("sendMessageButton"),

    attachmentInput: $("attachmentInput"),
    attachmentPreview: $("attachmentPreview"),

    emojiPanel: $("emojiPanel"),
    emojiGrid: $("emojiGrid"),
    emojiSearch: $("emojiSearch"),

    stickerPanel: $("stickerPanel"),
    stickerGrid: $("stickerGrid"),

    gifPanel: $("gifPanel"),
    gifGrid: $("gifGrid"),
    gifSearch: $("gifSearch"),

    messageCharacterCount: $("messageCharacterCount"),

    memberList: $("memberList"),
    memberCount: $("memberCount"),
    channelMemberCount: $("channelMemberCount"),
    memberSearchInput: $("memberSearchInput"),

    headerProfileAvatar: $("headerProfileAvatar"),
    headerProfileName: $("headerProfileName"),
    headerPresenceDot: $("headerPresenceDot"),

    profileLargeAvatar: $("profileLargeAvatar"),
    sidebarPresenceDot: $("sidebarPresenceDot"),
    sidebarUserName: $("sidebarUserName"),
    sidebarUserStatus: $("sidebarUserStatus"),

    friendsModal: $("friendsModal"),
    friendsContent: $("friendsContent"),

    profileModal: $("profileModal"),
    profileModalContent: $("profileModalContent"),

    rulesModal: $("rulesModal"),

    filePreviewModal: $("filePreviewModal"),
    filePreviewContent: $("filePreviewContent"),

    contestModal: $("contestModal"),
    contestCourseSelector: $("contestCourseSelector"),
    contestCourseName: $("contestCourseName"),
    contestQuestionArea: $("contestQuestionArea"),

    createChannelModal: $("createChannelModal"),
    createChannelForm: $("createChannelForm"),

    callPickerModal: $("callPickerModal"),
    callMemberList: $("callMemberList"),
    callMemberSearch: $("callMemberSearch"),
    selectedCallMemberCount: $("selectedCallMemberCount"),

    notificationPanel: $("notificationPanel"),

    toast: $("toast")
};


/* ============================================================
   SAFE EVENT LISTENER
   ============================================================ */

function on(id, event, handler) {
    const element = $(id);

    if (!element) {
        return;
    }

    element.addEventListener(event, handler);
}


/* ============================================================
   BASIC HELPERS
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


function initials(name) {
    const text = String(name || "User").trim();

    if (!text) {
        return "U";
    }

    const parts = text.split(/\s+/);

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
            <rect width="120" height="120" rx="60" fill="#26333c"/>
            <text x="60" y="68"
                text-anchor="middle"
                font-family="Arial"
                font-size="42"
                font-weight="700"
                fill="#dce8e8">${letters}</text>
        </svg>
    `)}`;
}


function safeURL(url) {
    if (!url) {
        return "";
    }

    try {
        const parsed = new URL(
            url,
            window.location.href
        );

        if (
            parsed.protocol === "https:" ||
            parsed.protocol === "http:"
        ) {
            return parsed.href;
        }
    } catch {}

    return "";
}


function formatBytes(bytes) {
    const value = Number(bytes || 0);

    if (!value) {
        return "0 B";
    }

    const units = ["B", "KB", "MB", "GB"];

    const index = Math.min(
        Math.floor(Math.log(value) / Math.log(1024)),
        units.length - 1
    );

    return `${(
        value / Math.pow(1024, index)
    ).toFixed(index ? 1 : 0)} ${units[index]}`;
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

    return date.toLocaleString();
}


function slugify(value) {
    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 70);
}


function showToast(message) {
    if (!dom.toast) {
        return;
    }

    dom.toast.textContent = message;

    dom.toast.classList.add("visible");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
        dom.toast.classList.remove("visible");
    }, 3000);
}


function openModal(element) {
    if (!element) {
        return;
    }

    element.classList.remove("hidden");
}


function closeModal(element) {
    if (!element) {
        return;
    }

    element.classList.add("hidden");
}


function scrollMessagesToBottom() {
    if (!dom.messageList) {
        return;
    }

    requestAnimationFrame(() => {
        dom.messageList.scrollTop =
            dom.messageList.scrollHeight;
    });
}


/* ============================================================
   PROFILE RESOLUTION
   ============================================================ */

function profileName(userId) {
    if (!userId) {
        return "Unknown user";
    }

    const profile =
        state.profiles.get(userId);

    if (profile?.full_name) {
        return profile.full_name;
    }

    const member =
        state.members.find(
            item => item.user_id === userId
        );

    if (member?.display_name) {
        return member.display_name;
    }

    if (member?.nickname) {
        return member.nickname;
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


function profilePhoto(userId) {
    const profile =
        state.profiles.get(userId);

    if (profile?.photo_url) {
        return safeURL(profile.photo_url);
    }

    const member =
        state.members.find(
            item => item.user_id === userId
        );

    if (member?.avatar_url) {
        return safeURL(member.avatar_url);
    }

    if (
        state.user &&
        state.user.id === userId
    ) {
        return safeURL(
            state.user.user_metadata?.avatar_url ||
            state.user.user_metadata?.picture ||
            state.user.user_metadata?.photo_url
        );
    }

    return "";
}


function setAvatar(image, userId, name) {
    if (!image) {
        return;
    }

    const photo =
        profilePhoto(userId);

    image.src =
        photo ||
        avatarFallback(name);

    image.onerror = () => {
        image.onerror = null;
        image.src = avatarFallback(name);
    };
}


/* ============================================================
   PRESENCE
   ============================================================ */

function normalizeStatus(status) {
    if (
        status === "online" ||
        status === "away" ||
        status === "dnd" ||
        status === "offline"
    ) {
        return status;
    }

    return "offline";
}


function effectivePresence(userId, row) {
    if (
        state.user &&
        userId === state.user.id
    ) {
        if (
            document.visibilityState === "visible" &&
            !state.manuallySelectedStatus
        ) {
            return "online";
        }

        return normalizeStatus(
            state.currentStatus
        );
    }

    if (!row) {
        return "offline";
    }

    const status =
        normalizeStatus(row.status);

    const timestamp =
        new Date(
            row.updated_at ||
            row.last_seen_at ||
            0
        ).getTime();

    const age =
        Date.now() - timestamp;

    if (
        status !== "offline" &&
        (
            !timestamp ||
            age > CONFIG.presenceFreshMs
        )
    ) {
        return "offline";
    }

    return status;
}


function statusLabel(status) {
    switch (normalizeStatus(status)) {
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


function applyPresenceDot(element, status) {
    if (!element) {
        return;
    }

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


function updateOwnPresenceUI() {
    if (!state.user) {
        return;
    }

    const status =
        effectivePresence(
            state.user.id,
            state.presences.get(
                state.user.id
            )
        );

    applyPresenceDot(
        dom.headerPresenceDot,
        status
    );

    applyPresenceDot(
        dom.sidebarPresenceDot,
        status
    );

    if (dom.sidebarUserStatus) {
        dom.sidebarUserStatus.textContent =
            statusLabel(status);
    }
}


async function ensurePresence() {
    if (!state.user) {
        return;
    }

    const {
        data,
        error
    } = await supabase
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
            "Presence read failed:",
            error.message
        );
    }

    if (data) {
        state.presences.set(
            state.user.id,
            data
        );
    }

    state.currentStatus =
        "online";

    state.manuallySelectedStatus =
        false;

    await writePresence("online");

    startPresenceHeartbeat();
}


async function writePresence(status) {
    if (!state.user) {
        return;
    }

    const normalized =
        normalizeStatus(status);

    const now =
        new Date().toISOString();

    const payload = {
        user_id: state.user.id,
        status: normalized,
        last_seen_at: now,
        updated_at: now
    };

    const {
        data,
        error
    } = await supabase
        .from("chat_presence")
        .upsert(
            payload,
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

    if (state.currentChannel) {
        renderMemberList();
    }
}


function startPresenceHeartbeat() {
    clearInterval(
        state.heartbeatTimer
    );

    state.heartbeatTimer =
        setInterval(async () => {

            if (!state.user) {
                return;
            }

            if (
                document.visibilityState ===
                "hidden"
            ) {
                return;
            }

            if (
                state.manuallySelectedStatus
            ) {
                await writePresence(
                    state.currentStatus
                );

                return;
            }

            await writePresence("online");

        }, CONFIG.heartbeatMs);
}


function setupActivityPresence() {
    const activity = () => {
        if (!state.user) {
            return;
        }

        if (
            document.visibilityState !==
            "visible"
        ) {
            return;
        }

        if (
            state.manuallySelectedStatus
        ) {
            return;
        }

        if (
            state.currentStatus !==
            "online"
        ) {
            state.currentStatus =
                "online";

            writePresence("online");
        }

        clearTimeout(
            state.awayTimer
        );

        state.awayTimer =
            setTimeout(() => {

                if (
                    state.manuallySelectedStatus
                ) {
                    return;
                }

                state.currentStatus =
                    "away";

                writePresence("away");

            }, CONFIG.awayAfterMs);
    };

    [
        "mousemove",
        "mousedown",
        "keydown",
        "touchstart",
        "scroll",
        "click"
    ].forEach(eventName => {
        window.addEventListener(
            eventName,
            activity,
            { passive: true }
        );
    });

    document.addEventListener(
        "visibilitychange",
        () => {

            if (
                document.visibilityState ===
                "visible"
            ) {
                if (
                    !state.manuallySelectedStatus
                ) {
                    state.currentStatus =
                        "online";

                    activity();
                }
            }
        }
    );

    activity();
}


async function setOwnStatus(status) {
    const normalized =
        normalizeStatus(status);

    state.currentStatus =
        normalized;

    state.manuallySelectedStatus =
        normalized !== "online";

    clearTimeout(
        state.awayTimer
    );

    await writePresence(
        normalized
    );

    renderProfileModal();

    showToast(
        `Status changed to ${statusLabel(normalized)}.`
    );
}


/* ============================================================
   AUTHENTICATION
   ============================================================ */

async function requireUser() {
    const {
        data,
        error
    } = await supabase.auth.getUser();

    if (error) {
        throw error;
    }

    if (!data?.user) {
        window.location.href =
            "./index.html";

        return null;
    }

    state.user =
        data.user;

    return state.user;
}


/* ============================================================
   PROFILE LOADING
   ============================================================ */

async function loadOwnProfile() {
    if (!state.user) {
        return;
    }

    const userId =
        state.user.id;

    const [
        profileResult,
        studentResult
    ] = await Promise.all([

        supabase
            .from("chat_public_profiles")
            .select(
                "id,full_name,photo_url,updated_at"
            )
            .eq("id", userId)
            .maybeSingle(),

        supabase
            .from("students")
            .select(
                "id,full_name,course,level,photo_url"
            )
            .eq("id", userId)
            .maybeSingle()
    ]);

    if (
        profileResult.data
    ) {
        state.profiles.set(
            userId,
            profileResult.data
        );
    }

    if (
        studentResult.data
    ) {
        const current =
            state.profiles.get(
                userId
            ) || {};

        state.profiles.set(
            userId,
            {
                ...current,

                full_name:
                    current.full_name ||
                    studentResult.data.full_name,

                photo_url:
                    current.photo_url ||
                    studentResult.data.photo_url
            }
        );
    }

    const name =
        profileName(userId);

    if (dom.headerProfileName) {
        dom.headerProfileName.textContent =
            name;
    }

    if (dom.sidebarUserName) {
        dom.sidebarUserName.textContent =
            name;
    }

    setAvatar(
        dom.headerProfileAvatar,
        userId,
        name
    );

    setAvatar(
        dom.profileLargeAvatar,
        userId,
        name
    );

    updateOwnPresenceUI();
}


/* ============================================================
   LOAD USER PROFILES
   ============================================================ */

async function loadProfilesForUsers(userIds) {
    const ids = [
        ...new Set(
            userIds.filter(Boolean)
        )
    ];

    if (!ids.length) {
        return;
    }

    const missing =
        ids.filter(
            id => !state.profiles.has(id)
        );

    if (!missing.length) {
        return;
    }

    const [
        profilesResult,
        studentsResult,
        membersResult
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
                "id,full_name,course,level,photo_url"
            )
            .in("id", missing),

        supabase
            .from("chat_community_members")
            .select(
                "user_id,display_name,nickname,avatar_url"
            )
            .in("user_id", missing)
    ]);

    for (const profile of (
        profilesResult.data || []
    )) {
        state.profiles.set(
            profile.id,
            profile
        );
    }

    for (const student of (
        studentsResult.data || []
    )) {
        const current =
            state.profiles.get(
                student.id
            ) || {};

        state.profiles.set(
            student.id,
            {
                ...current,

                full_name:
                    current.full_name ||
                    student.full_name,

                photo_url:
                    current.photo_url ||
                    student.photo_url
            }
        );
    }

    for (const member of (
        membersResult.data || []
    )) {
        const current =
            state.profiles.get(
                member.user_id
            ) || {};

        state.profiles.set(
            member.user_id,
            {
                ...current,

                full_name:
                    current.full_name ||
                    member.display_name ||
                    member.nickname,

                photo_url:
                    current.photo_url ||
                    member.avatar_url
            }
        );
    }
}


/* ============================================================
   COURSES
   ============================================================ */

async function loadCourses() {
    const {
        data,
        error
    } = await supabase
        .from("courses")
        .select(
            "id,title,description,image,created_at"
        )
        .order(
            "title",
            { ascending: true }
        );

    if (error) {
        console.warn(
            "Courses load failed:",
            error.message
        );

        state.courses = [];

        return;
    }

    state.courses =
        data || [];
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
        .eq(
            "is_active",
            true
        )
        .order(
            "created_at",
            { ascending: true }
        );

    if (error) {
        console.error(
            "Community load failed:",
            error
        );

        showToast(
            "Unable to load communities."
        );

        state.communities = [];

    } else {
        state.communities =
            data || [];
    }

    if (
        !state.communities.some(
            community =>
                community.slug ===
                "contests"
        )
    ) {
        state.communities.push(
            CONFIG.fallbackContests
        );
    }

    renderCommunityRail();

    if (!state.currentCommunity) {
        const preferred =
            state.communities.find(
                community =>
                    community.slug ===
                    "mwaniki-scholars"
            ) ||
            state.communities[0];

        if (preferred) {
            await selectCommunity(
                preferred
            );
        }
    }
}


function communityIcon(community) {
    if (!community) {
        return "🩺";
    }

    if (
        community.icon_url &&
        community.icon_url.length <= 5
    ) {
        return community.icon_url;
    }

    return (
        CONFIG.communityIcons[
            community.slug
        ] ||
        "🩺"
    );
}


/* ============================================================
   HOME BUTTON + COMMUNITY RAIL
   ============================================================ */

function renderCommunityRail() {
    if (!dom.communityRailList) {
        return;
    }

    let html = `
        <button
            type="button"
            class="rail-community-button home-community-button"
            id="homeCommunityButton"
            title="Home"
            aria-label="Home"
        >
            🏠
        </button>
    `;

    html += state.communities
        .map(community => {

            const active =
                state.currentCommunity &&
                state.currentCommunity.id ===
                community.id;

            return `
                <button
                    type="button"
                    class="rail-community-button ${
                        active ? "active" : ""
                    }"
                    data-community-id="${
                        escapeAttribute(
                            community.id
                        )
                    }"
                    title="${
                        escapeAttribute(
                            community.name
                        )
                    }"
                    aria-label="${
                        escapeAttribute(
                            community.name
                        )
                    }"
                >
                    ${escapeHTML(
                        communityIcon(
                            community
                        )
                    )}
                </button>
            `;
        })
        .join("");

    dom.communityRailList.innerHTML =
        html;

    const home =
        $("homeCommunityButton");

    if (home) {
        home.addEventListener(
            "click",
            () => {
                window.location.href =
                    "./dashboard.html";
            }
        );
    }
}


/* ============================================================
   COMMUNITY SELECTION
   ============================================================ */

async function selectCommunity(
    community
) {
    if (!community) {
        return;
    }

    state.currentCommunity =
        community;

    state.currentChannel =
        null;

    state.channels = [];
    state.messages = [];

    clearRealtime();

    renderCommunityRail();

    updateCommunityHeader();

    if (
        community.isVirtual &&
        community.slug === "contests"
    ) {
        await renderVirtualContests();
        return;
    }

    await loadCommunityChannels(
        community.id
    );

    await loadCommunityMembers(
        community.id
    );

    subscribeToCommunity(
        community.id
    );
}


function updateCommunityHeader() {
    const community =
        state.currentCommunity;

    if (!community) {
        return;
    }

    if (dom.selectedCommunityIcon) {
        dom.selectedCommunityIcon.textContent =
            communityIcon(
                community
            );
    }

    if (dom.selectedCommunityName) {
        dom.selectedCommunityName.textContent =
            community.name;
    }

    if (dom.selectedCommunityDescription) {
        dom.selectedCommunityDescription.textContent =
            community.description ||
            "Mwaniki Scholars Community";
    }
}


/* ============================================================
   CHANNELS
   ============================================================ */

async function loadCommunityChannels(
    communityId
) {
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
            communityId
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
            { ascending: true }
        )
        .order(
            "name",
            { ascending: true }
        );

    if (error) {
        console.error(
            "Channel load failed:",
            error
        );

        showToast(
            "Unable to load channels."
        );

        return;
    }

    state.channels =
        data || [];

    renderChannels();

    if (!state.currentChannel) {
        const general =
            state.channels.find(
                channel =>
                    channel.slug ===
                    "general"
            ) ||
            state.channels.find(
                channel =>
                    channel.channel_type !==
                    "voice"
            ) ||
            state.channels[0];

        if (general) {
            await selectChannel(
                general
            );
        }
    }
}


function categorizeChannel(channel) {
    const name =
        String(
            channel.name || ""
        ).toLowerCase();

    const type =
        String(
            channel.channel_type || ""
        ).toLowerCase();

    if (type === "voice") {
        return "voice";
    }

    if (channel.course_id) {
        return "courses";
    }

    if (
        [
            "announcements",
            "rules",
            "university-news"
        ].includes(name)
    ) {
        return "information";
    }

    if (
        [
            "study-hall",
            "clinical-discussion",
            "case-studies",
            "study-groups"
        ].includes(name)
    ) {
        return "study";
    }

    if (
        [
            "general",
            "introductions",
            "help-desk"
        ].includes(name)
    ) {
        return "general";
    }

    return "community";
}


function renderChannels() {
    const groups = {
        information: [],
        general: [],
        study: [],
        courses: [],
        community: [],
        voice: []
    };

    for (const channel of state.channels) {
        const group =
            categorizeChannel(
                channel
            );

        groups[group].push(
            channel
        );
    }

    renderChannelGroup(
        dom.informationChannels,
        groups.information
    );

    renderChannelGroup(
        dom.generalChannels,
        groups.general
    );

    renderChannelGroup(
        dom.studyChannels,
        groups.study
    );

    renderChannelGroup(
        dom.courseChannels,
        groups.courses
    );

    renderChannelGroup(
        dom.communityChannels,
        groups.community
    );

    renderChannelGroup(
        dom.voiceChannels,
        groups.voice
    );

    if (dom.courseChannelCount) {
        dom.courseChannelCount.textContent =
            groups.courses.length
                ? `(${groups.courses.length})`
                : "";
    }
}


function renderChannelGroup(
    container,
    channels
) {
    if (!container) {
        return;
    }

    const search =
        String(
            dom.channelSearchInput?.value ||
            ""
        )
            .trim()
            .toLowerCase();

    const filtered =
        channels.filter(
            channel => {

                if (!search) {
                    return true;
                }

                return (
                    String(
                        channel.name || ""
                    )
                        .toLowerCase()
                        .includes(search) ||

                    String(
                        channel.description || ""
                    )
                        .toLowerCase()
                        .includes(search)
                );
            }
        );

    if (!filtered.length) {
        container.innerHTML =
            `<div class="empty-sidebar-message">
                No channels
            </div>`;

        return;
    }

    container.innerHTML =
        filtered
            .map(
                renderChannelButton
            )
            .join("");
}


function renderChannelButton(channel) {
    const active =
        state.currentChannel &&
        state.currentChannel.id ===
        channel.id;

    const icon =
        channel.channel_type === "voice"
            ? "🔊"
            : channel.icon || "#";

    return `
        <button
            type="button"
            class="channel-item ${
                active ? "active" : ""
            }"
            data-channel-id="${
                escapeAttribute(
                    channel.id
                )
            }"
        >
            <span class="channel-icon">
                ${escapeHTML(icon)}
            </span>

            <span class="channel-item-name">
                ${escapeHTML(
                    channel.name
                )}
            </span>
        </button>
    `;
}


/* ============================================================
   CHANNEL SELECTION
   ============================================================ */

async function selectChannel(channel) {
    if (!channel) {
        return;
    }

    state.currentChannel =
        channel;

    state.messages = [];

    state.attachments.clear();

    state.signedUrls.clear();

    renderChannels();

    updateChannelHeader();

    if (
        channel.channel_type ===
        "voice"
    ) {
        openCommunityVoiceChannel();
        return;
    }

    await loadChannelMessages(
        channel.id
    );

    await loadChannelAttachments();

    await loadChannelMembers();

    subscribeToChannel(
        channel.id
    );
}


function updateChannelHeader() {
    const channel =
        state.currentChannel;

    if (!channel) {
        return;
    }

    if (dom.currentChannelIcon) {
        dom.currentChannelIcon.textContent =
            channel.channel_type ===
            "voice"
                ? "🔊"
                : channel.icon || "#";
    }

    if (dom.currentChannelName) {
        dom.currentChannelName.textContent =
            channel.name;
    }

    if (dom.currentChannelDescription) {
        dom.currentChannelDescription.textContent =
            channel.description ||
            "Mwaniki Scholars discussion";
    }

    if (dom.currentChannelType) {
        dom.currentChannelType.textContent =
            channel.channel_type ||
            "text";
    }

    if (dom.messageInput) {
        dom.messageInput.placeholder =
            `Message #${channel.name}...`;
    }
}


/* ============================================================
   MESSAGES
   ============================================================ */

async function loadChannelMessages(
    channelId
) {
    if (dom.messageLoading) {
        dom.messageLoading.classList.remove(
            "hidden"
        );
    }

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
            channelId
        )
        .order(
            "created_at",
            { ascending: true }
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
            "Message load failed:",
            error
        );

        showToast(
            "Unable to load messages."
        );

        renderMessages();

        return;
    }

    state.messages =
        data || [];

    await loadProfilesForUsers(
        state.messages.map(
            message =>
                message.user_id
        )
    );

    renderMessages();

    scrollMessagesToBottom();
}


async function loadChannelAttachments() {
    if (!state.messages.length) {
        return;
    }

    const messageIds =
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
            messageIds
        );

    if (error) {
        console.warn(
            "Attachment load failed:",
            error.message
        );

        return;
    }

    state.attachments.clear();

    for (const attachment of (
        data || []
    )) {
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


/* ============================================================
   RENDER MESSAGES
   ============================================================ */

function renderMessages() {
    if (!dom.messageList) {
        return;
    }

    if (!state.currentChannel) {
        dom.messageList.innerHTML =
            "";

        return;
    }

    if (!state.messages.length) {
        dom.messageList.innerHTML = `
            <div class="channel-welcome">
                <div class="channel-welcome-icon">
                    ${escapeHTML(
                        state.currentChannel.icon ||
                        "#"
                    )}
                </div>

                <h2>
                    Welcome to #${
                        escapeHTML(
                            state.currentChannel.name
                        )
                    }
                </h2>

                <p>
                    ${
                        escapeHTML(
                            state.currentChannel.description ||
                            "This is the beginning of this conversation."
                        )
                    }
                </p>
            </div>
        `;

        return;
    }

    dom.messageList.innerHTML =
        state.messages
            .map(renderMessage)
            .join("");

    loadRenderedAttachmentURLs();
}


function renderMessage(message) {
    const name =
        profileName(
            message.user_id
        );

    const photo =
        profilePhoto(
            message.user_id
        );

    const deleted =
        Boolean(
            message.is_deleted
        );

    const mine =
        state.user &&
        message.user_id ===
        state.user.id;

    const attachments =
        state.attachments.get(
            message.id
        ) || [];

    return `
        <article
            class="chat-message ${
                mine ? "own-message" : ""
            } ${
                deleted ? "deleted-message" : ""
            }"
            data-message-id="${
                escapeAttribute(
                    message.id
                )
            }"
        >

            <div class="message-avatar">
                <img
                    src="${
                        photo ||
                        avatarFallback(name)
                    }"
                    alt="${
                        escapeAttribute(name)
                    }"
                    loading="lazy"
                    onerror="this.onerror=null;this.src='${avatarFallback(name)}'"
                >
            </div>

            <div class="message-content">

                <div class="message-meta">

                    <strong class="message-author">
                        ${escapeHTML(name)}
                    </strong>

                    <time>
                        ${formatTime(
                            message.created_at
                        )}
                    </time>

                    ${
                        message.is_edited
                            ? `<span class="edited-label">(edited)</span>`
                            : ""
                    }

                </div>

                <div class="message-body">

                    ${
                        deleted
                            ? `<em>This message was deleted.</em>`
                            : renderMessageContent(
                                message.content
                            )
                    }

                </div>

                ${
                    !deleted &&
                    attachments.length
                        ? `
                            <div
                                class="message-attachments"
                                data-attachment-container="${
                                    escapeAttribute(
                                        message.id
                                    )
                                }"
                            >
                                ${attachments
                                    .map(
                                        renderAttachmentPlaceholder
                                    )
                                    .join("")}
                            </div>
                        `
                        : ""
                }

                ${
                    !deleted
                        ? `
                            <div class="message-actions">

                                <button
                                    type="button"
                                    title="React"
                                    data-message-action="react"
                                    data-message-id="${
                                        escapeAttribute(
                                            message.id
                                        )
                                    }"
                                >
                                    👍
                                </button>

                                <button
                                    type="button"
                                    title="Reply"
                                    data-message-action="reply"
                                    data-message-id="${
                                        escapeAttribute(
                                            message.id
                                        )
                                    }"
                                >
                                    ↩
                                </button>

                                ${
                                    mine
                                        ? `
                                            <button
                                                type="button"
                                                title="Edit"
                                                data-message-action="edit"
                                                data-message-id="${
                                                    escapeAttribute(
                                                        message.id
                                                    )
                                                }"
                                            >
                                                ✏️
                                            </button>

                                            <button
                                                type="button"
                                                title="Delete"
                                                data-message-action="delete"
                                                data-message-id="${
                                                    escapeAttribute(
                                                        message.id
                                                    )
                                                }"
                                            >
                                                🗑️
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


function renderMessageContent(content) {
    if (!content) {
        return "";
    }

    const escaped =
        escapeHTML(content);

    return escaped
        .replace(
            /\n/g,
            "<br>"
        )
        .replace(
            /(https?:\/\/[^\s<]+)/g,
            `<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>`
        );
}


/* ============================================================
   ATTACHMENT RENDERING
   ============================================================ */

function renderAttachmentPlaceholder(
    attachment
) {
    const type =
        attachment.mime_type || "";

    if (
        type.startsWith("image/")
    ) {
        return `
            <div
                class="attachment-item attachment-image"
                data-attachment-id="${
                    escapeAttribute(
                        attachment.id
                    )
                }"
            >
                <span>Loading image...</span>
            </div>
        `;
    }

    if (
        type.startsWith("audio/")
    ) {
        return `
            <div
                class="attachment-item attachment-audio"
                data-attachment-id="${
                    escapeAttribute(
                        attachment.id
                    )
                }"
            >
                <span>Loading voice note...</span>
            </div>
        `;
    }

    if (
        type.startsWith("video/")
    ) {
        return `
            <div
                class="attachment-item attachment-video"
                data-attachment-id="${
                    escapeAttribute(
                        attachment.id
                    )
                }"
            >
                <span>Loading video...</span>
            </div>
        `;
    }

    return `
        <div
            class="attachment-item attachment-file"
            data-attachment-id="${
                escapeAttribute(
                    attachment.id
                )
            }"
        >
            <span>Loading file...</span>
        </div>
    `;
}


async function loadRenderedAttachmentURLs() {
    const containers =
        document.querySelectorAll(
            "[data-attachment-id]"
        );

    for (const container of containers) {
        const attachment =
            findAttachment(
                container.dataset.attachmentId
            );

        if (!attachment) {
            continue;
        }

        const url =
            await getAttachmentURL(
                attachment
            );

        if (!url) {
            container.innerHTML =
                `<span>Attachment unavailable</span>`;

            continue;
        }

        const type =
            attachment.mime_type || "";

        if (
            type.startsWith("image/")
        ) {
            container.innerHTML = `
                <a
                    href="${escapeAttribute(url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <img
                        src="${escapeAttribute(url)}"
                        alt="${escapeAttribute(
                            attachment.file_name
                        )}"
                        class="chat-attachment-image"
                        loading="lazy"
                    >
                </a>
            `;
        } else if (
            type.startsWith("audio/")
        ) {
            container.innerHTML = `
                <div>
                    <div class="attachment-name">
                        🎙️ ${
                            escapeHTML(
                                attachment.file_name
                            )
                        }
                    </div>

                    <audio
                        controls
                        preload="metadata"
                        src="${escapeAttribute(url)}"
                    ></audio>
                </div>
            `;
        } else if (
            type.startsWith("video/")
        ) {
            container.innerHTML = `
                <video
                    controls
                    preload="metadata"
                    src="${escapeAttribute(url)}"
                ></video>
            `;
        } else {
            container.innerHTML = `
                <a
                    href="${escapeAttribute(url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="attachment-file-link"
                >
                    📎
                    ${escapeHTML(
                        attachment.file_name
                    )}

                    <small>
                        ${formatBytes(
                            attachment.file_size
                        )}
                    </small>
                </a>
            `;
        }
    }
}


function findAttachment(id) {
    for (const list of state.attachments.values()) {
        const found =
            list.find(
                item =>
                    item.id === id
            );

        if (found) {
            return found;
        }
    }

    return null;
}


/* ============================================================
   STORAGE
   ============================================================ */

async function getStorageBucket() {
    if (state.storageBucket) {
        return state.storageBucket;
    }

    const {
        data,
        error
    } = await supabase
        .storage
        .getBucket(
            CONFIG.storageBucket
        );

    if (error || !data) {
        console.error(
            "Chat storage bucket unavailable:",
            error?.message
        );

        showToast(
            "Chat storage is not configured. Create the chat-attachments bucket first."
        );

        return null;
    }

    state.storageBucket =
        CONFIG.storageBucket;

    return state.storageBucket;
}


async function uploadSingleAttachment(
    messageId,
    file
) {
    const bucket =
        await getStorageBucket();

    if (!bucket) {
        throw new Error(
            "Chat attachment storage is unavailable."
        );
    }

    if (
        file.size >
        CONFIG.maxAttachmentSize
    ) {
        throw new Error(
            `${file.name} is larger than 25 MB.`
        );
    }

    const cleanName =
        file.name
            .replace(
                /[^a-zA-Z0-9._-]/g,
                "_"
            );

    const path =
        `community/${state.user.id}/${Date.now()}-${crypto.randomUUID()}-${cleanName}`;

    const {
        error: uploadError
    } = await supabase
        .storage
        .from(bucket)
        .upload(
            path,
            file,
            {
                cacheControl: "3600",
                upsert: false,
                contentType:
                    file.type ||
                    "application/octet-stream"
            }
        );

    if (uploadError) {
        throw uploadError;
    }

    const {
        data,
        error: insertError
    } = await supabase
        .from("chat_attachments")
        .insert({
            message_id: messageId,
            uploaded_by: state.user.id,
            file_name: file.name,
            file_path: path,
            file_url: null,
            mime_type:
                file.type ||
                "application/octet-stream",
            file_size: file.size
        })
        .select()
        .single();

    if (insertError) {
        await supabase
            .storage
            .from(bucket)
            .remove([path]);

        throw insertError;
    }

    return data;
}


async function uploadAttachments(
    messageId,
    files
) {
    if (!files?.length) {
        return [];
    }

    const uploaded = [];

    for (const file of files) {
        try {
            const attachment =
                await uploadSingleAttachment(
                    messageId,
                    file
                );

            uploaded.push(
                attachment
            );
        } catch (error) {
            console.error(
                "Attachment upload failed:",
                error
            );

            showToast(
                `Could not upload ${file.name}: ${
                    error.message || "Upload failed"
                }`
            );
        }
    }

    return uploaded;
}


async function getAttachmentURL(
    attachment
) {
    if (!attachment) {
        return "";
    }

    if (
        attachment.file_url
    ) {
        return safeURL(
            attachment.file_url
        );
    }

    if (
        state.signedUrls.has(
            attachment.id
        )
    ) {
        return state.signedUrls.get(
            attachment.id
        );
    }

    const bucket =
        await getStorageBucket();

    if (!bucket) {
        return "";
    }

    const {
        data,
        error
    } = await supabase
        .storage
        .from(bucket)
        .createSignedUrl(
            attachment.file_path,
            3600
        );

    if (error) {
        console.warn(
            "Signed URL failed:",
            error.message
        );

        return "";
    }

    const url =
        data?.signedUrl || "";

    if (url) {
        state.signedUrls.set(
            attachment.id,
            url
        );
    }

    return url;
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

    const files =
        [...state.selectedFiles];

    if (
        !content &&
        !files.length
    ) {
        return;
    }

    if (
        files.some(
            file =>
                file.size >
                CONFIG.maxAttachmentSize
        )
    ) {
        showToast(
            "One or more files are larger than 25 MB."
        );

        return;
    }

    if (dom.sendMessageButton) {
        dom.sendMessageButton.disabled =
            true;
    }

    const {
        data: message,
        error
    } = await supabase
        .from("chat_messages")
        .insert({
            channel_id:
                state.currentChannel.id,

            user_id:
                state.user.id,

            content:
                content || null,

            message_type:
                files.length
                    ? "attachment"
                    : "text",

            moderation_status:
                "pending"
        })
        .select()
        .single();

    if (error) {
        console.error(
            "Message send failed:",
            error
        );

        showToast(
            error.message ||
            "Unable to send message."
        );

        if (dom.sendMessageButton) {
            dom.sendMessageButton.disabled =
                false;
        }

        return;
    }

    if (files.length) {
        await uploadAttachments(
            message.id,
            files
        );
    }

    dom.messageInput.value = "";

    state.selectedFiles = [];

    renderAttachmentPreview();

    updateCharacterCount();

    if (dom.sendMessageButton) {
        dom.sendMessageButton.disabled =
            false;
    }

    await loadChannelMessages(
        state.currentChannel.id
    );

    await loadChannelAttachments();

    scrollMessagesToBottom();
}


/* ============================================================
   DELETE MESSAGE
   ============================================================ */

async function deleteMessage(messageId) {
    if (!state.user) {
        return;
    }

    const message =
        state.messages.find(
            item =>
                item.id === messageId
        );

    if (!message) {
        return;
    }

    if (
        message.user_id !==
        state.user.id
    ) {
        showToast(
            "You can only delete your own messages."
        );

        return;
    }

    const attachments =
        state.attachments.get(
            messageId
        ) || [];

    const bucket =
        await getStorageBucket();

    if (bucket && attachments.length) {
        const paths =
            attachments
                .map(
                    item =>
                        item.file_path
                )
                .filter(Boolean);

        if (paths.length) {
            await supabase
                .storage
                .from(bucket)
                .remove(paths);
        }
    }

    const {
        error
    } = await supabase
        .from("chat_messages")
        .update({
            is_deleted: true,
            deleted_at:
                new Date().toISOString(),
            deleted_by:
                state.user.id,
            content: null
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

        showToast(
            error.message ||
            "Unable to delete message."
        );

        return;
    }

    await supabase
        .from("chat_attachments")
        .delete()
        .eq(
            "message_id",
            messageId
        );

    await loadChannelMessages(
        state.currentChannel.id
    );

    await loadChannelAttachments();

    showToast(
        "Message deleted."
    );
}


/* ============================================================
   EDIT MESSAGE
   ============================================================ */

async function editMessage(messageId) {
    const message =
        state.messages.find(
            item =>
                item.id === messageId
        );

    if (!message) {
        return;
    }

    if (
        message.user_id !==
        state.user.id
    ) {
        return;
    }

    const current =
        message.content || "";

    const replacement =
        window.prompt(
            "Edit your message:",
            current
        );

    if (
        replacement === null
    ) {
        return;
    }

    const content =
        replacement.trim();

    if (!content) {
        showToast(
            "Message cannot be empty."
        );

        return;
    }

    const {
        error
    } = await supabase
        .from("chat_messages")
        .update({
            content,
            is_edited: true,
            edited_at:
                new Date().toISOString()
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
        showToast(
            error.message ||
            "Unable to edit message."
        );

        return;
    }

    await loadChannelMessages(
        state.currentChannel.id
    );

    await loadChannelAttachments();
}


/* ============================================================
   REACTIONS
   ============================================================ */

async function toggleReaction(
    messageId,
    reaction
) {
    if (!state.user) {
        return;
    }

    const {
        data: existing,
        error: lookupError
    } = await supabase
        .from("chat_message_reactions")
        .select("id,reaction")
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

    if (lookupError) {
        console.warn(
            "Reaction lookup failed:",
            lookupError.message
        );

        return;
    }

    if (existing) {
        await supabase
            .from("chat_message_reactions")
            .delete()
            .eq(
                "id",
                existing.id
            );
    } else {
        await supabase
            .from("chat_message_reactions")
            .insert({
                message_id:
                    messageId,
                user_id:
                    state.user.id,
                reaction
            });
    }

    showToast(
        existing
            ? "Reaction removed."
            : "Reaction added."
    );
}


/* ============================================================
   FILE SELECTION
   ============================================================ */

function handleFilesSelected(
    fileList
) {
    const files =
        [...(fileList || [])];

    if (!files.length) {
        return;
    }

    const valid = [];

    for (const file of files) {
        if (
            file.size >
            CONFIG.maxAttachmentSize
        ) {
            showToast(
                `${file.name} is larger than 25 MB.`
            );

            continue;
        }

        valid.push(file);
    }

    state.selectedFiles.push(
        ...valid
    );

    renderAttachmentPreview();

    if (dom.attachmentInput) {
        dom.attachmentInput.value =
            "";
    }
}


function renderAttachmentPreview() {
    if (!dom.attachmentPreview) {
        return;
    }

    if (!state.selectedFiles.length) {
        dom.attachmentPreview.innerHTML =
            "";

        return;
    }

    dom.attachmentPreview.innerHTML =
        state.selectedFiles
            .map(
                (file, index) => `
                    <div class="attachment-preview-item">

                        <span>
                            📎
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
                            title="Remove"
                        >
                            ×
                        </button>

                    </div>
                `
            )
            .join("");
}


/* ============================================================
   VOICE NOTES
   ============================================================ */

async function toggleVoiceRecording() {
    if (state.recording) {
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
        showToast(
            "Your browser does not support voice recording."
        );

        return;
    }

    try {
        const stream =
            await navigator.mediaDevices.getUserMedia({
                audio: true
            });

        let mimeType = "";

        const choices = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/ogg;codecs=opus",
            "audio/mp4"
        ];

        for (const type of choices) {
            if (
                MediaRecorder.isTypeSupported(
                    type
                )
            ) {
                mimeType = type;
                break;
            }
        }

        state.mediaRecorder =
            new MediaRecorder(
                stream,
                mimeType
                    ? { mimeType }
                    : undefined
            );

        state.voiceChunks = [];

        state.voiceStartedAt =
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

                const duration =
                    Date.now() -
                    state.voiceStartedAt;

                const blob =
                    new Blob(
                        state.voiceChunks,
                        {
                            type:
                                mimeType ||
                                "audio/webm"
                        }
                    );

                state.recording =
                    false;

                state.mediaRecorder =
                    null;

                if (
                    duration <
                    500
                ) {
                    showToast(
                        "Voice note was too short."
                    );

                    return;
                }

                if (
                    duration >
                    CONFIG.maxVoiceNoteMs
                ) {
                    showToast(
                        "Voice note cannot exceed 2 minutes."
                    );

                    return;
                }

                await sendVoiceNote(
                    blob
                );
            };

        state.mediaRecorder.start(
            250
        );

        updateVoiceButton();

        showToast(
            "Recording voice note..."
        );

    } catch (error) {
        console.error(
            "Microphone error:",
            error
        );

        state.recording =
            false;

        showToast(
            "Microphone permission was not granted."
        );
    }
}


function stopVoiceRecording() {
    if (
        !state.mediaRecorder ||
        !state.recording
    ) {
        return;
    }

    state.mediaRecorder.stop();

    updateVoiceButton();
}


function updateVoiceButton() {
    const button =
        $("voiceNoteButton");

    if (!button) {
        return;
    }

    button.classList.toggle(
        "recording",
        state.recording
    );

    button.setAttribute(
        "aria-label",
        state.recording
            ? "Stop voice recording"
            : "Record voice note"
    );

    button.title =
        state.recording
            ? "Stop recording"
            : "Voice note";
}


async function sendVoiceNote(blob) {
    if (
        !state.currentChannel ||
        !state.user
    ) {
        return;
    }

    const extension =
        blob.type.includes("ogg")
            ? "ogg"
            : blob.type.includes("mp4")
                ? "m4a"
                : "webm";

    const file =
        new File(
            [
                blob
            ],
            `voice-note-${Date.now()}.${extension}`,
            {
                type:
                    blob.type ||
                    "audio/webm"
            }
        );

    const {
        data: message,
        error
    } = await supabase
        .from("chat_messages")
        .insert({
            channel_id:
                state.currentChannel.id,

            user_id:
                state.user.id,

            content: null,

            message_type:
                "voice"
        })
        .select()
        .single();

    if (error) {
        console.error(
            "Voice message insert failed:",
            error
        );

        showToast(
            error.message ||
            "Unable to send voice note."
        );

        return;
    }

    const uploaded =
        await uploadAttachments(
            message.id,
            [file]
        );

    if (!uploaded.length) {
        await supabase
            .from("chat_messages")
            .delete()
            .eq(
                "id",
                message.id
            );

        return;
    }

    await loadChannelMessages(
        state.currentChannel.id
    );

    await loadChannelAttachments();

    scrollMessagesToBottom();

    showToast(
        "Voice note sent."
    );
}


/* ============================================================
   EMOJI / STICKERS / GIF
   ============================================================ */

function renderEmojiPicker() {
    if (!dom.emojiGrid) {
        return;
    }

    dom.emojiGrid.innerHTML =
        CONFIG.emoji
            .map(
                emoji => `
                    <button
                        type="button"
                        data-emoji="${escapeAttribute(emoji)}"
                    >
                        ${emoji}
                    </button>
                `
            )
            .join("");
}


function renderStickers() {
    if (!dom.stickerGrid) {
        return;
    }

    dom.stickerGrid.innerHTML =
        CONFIG.stickers
            .map(
                sticker => `
                    <button
                        type="button"
                        data-sticker="${escapeAttribute(sticker)}"
                    >
                        ${sticker}
                    </button>
                `
            )
            .join("");
}


function renderGifPanel(
    items = CONFIG.gifs
) {
    if (!dom.gifGrid) {
        return;
    }

    dom.gifGrid.innerHTML =
        items
            .map(
                gif => `
                    <button
                        type="button"
                        data-gif="${escapeAttribute(gif)}"
                    >
                        ${escapeHTML(gif)}
                    </button>
                `
            )
            .join("");
}


function closeComposerPanels() {
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
}


function insertAtCursor(
    textarea,
    value
) {
    if (!textarea) {
        return;
    }

    const start =
        textarea.selectionStart ??
        textarea.value.length;

    const end =
        textarea.selectionEnd ??
        textarea.value.length;

    textarea.value =
        textarea.value.slice(
            0,
            start
        ) +
        value +
        textarea.value.slice(
            end
        );

    textarea.selectionStart =
        textarea.selectionEnd =
            start + value.length;

    textarea.focus();

    updateCharacterCount();
}


function updateCharacterCount() {
    if (!dom.messageCharacterCount) {
        return;
    }

    dom.messageCharacterCount.textContent =
        `${dom.messageInput?.value.length || 0}`;
}


/* ============================================================
   MEMBERS
   ============================================================ */

async function loadCommunityMembers(
    communityId
) {
    const {
        data,
        error
    } = await supabase
        .from("chat_community_members")
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
            communityId
        )
        .eq(
            "membership_status",
            "active"
        );

    if (error) {
        console.warn(
            "Community members failed:",
            error.message
        );

        state.members = [];

        return;
    }

    state.members =
        data || [];

    await loadProfilesForUsers(
        state.members.map(
            member =>
                member.user_id
        )
    );

    await loadPresences(
        state.members.map(
            member =>
                member.user_id
        )
    );

    renderMemberList();

    renderCallMemberPicker();
}


async function loadChannelMembers() {
    if (
        !state.currentCommunity
    ) {
        return;
    }

    /*
     * Community membership remains the source
     * of truth for the member sidebar.
     */
    renderMemberList();
}


async function loadPresences(userIds) {
    const ids = [
        ...new Set(
            userIds.filter(Boolean)
        )
    ];

    if (!ids.length) {
        return;
    }

    const {
        data,
        error
    } = await supabase
        .from("chat_presence")
        .select(`
            user_id,
            status,
            custom_status,
            last_seen_at,
            updated_at
        `)
        .in(
            "user_id",
            ids
        );

    if (error) {
        console.warn(
            "Presence list failed:",
            error.message
        );

        return;
    }

    for (const row of (
        data || []
    )) {
        state.presences.set(
            row.user_id,
            row
        );
    }
}


function renderMemberList() {
    if (!dom.memberList) {
        return;
    }

    const search =
        String(
            dom.memberSearchInput?.value ||
            ""
        )
            .trim()
            .toLowerCase();

    const members =
        state.members.filter(
            member => {

                if (!search) {
                    return true;
                }

                return profileName(
                    member.user_id
                )
                    .toLowerCase()
                    .includes(search);
            }
        );

    if (dom.memberCount) {
        dom.memberCount.textContent =
            state.members.length;
    }

    if (dom.channelMemberCount) {
        dom.channelMemberCount.textContent =
            state.members.length;
    }

    if (!members.length) {
        dom.memberList.innerHTML =
            `<div class="empty-members">
                No members found.
            </div>`;

        return;
    }

    dom.memberList.innerHTML =
        members
            .map(
                renderMember
            )
            .join("");
}


function renderMember(member) {
    const userId =
        member.user_id;

    const name =
        profileName(userId);

    const photo =
        profilePhoto(userId);

    const status =
        effectivePresence(
            userId,
            state.presences.get(
                userId
            )
        );

    const own =
        state.user &&
        userId ===
        state.user.id;

    return `
        <div
            class="community-member"
            data-user-id="${
                escapeAttribute(
                    userId
                )
            }"
        >

            <div class="member-avatar-wrap">

                <img
                    class="member-avatar"
                    src="${
                        photo ||
                        avatarFallback(name)
                    }"
                    alt="${
                        escapeAttribute(name)
                    }"
                    loading="lazy"
                    onerror="this.onerror=null;this.src='${avatarFallback(name)}'"
                >

                <span
                    class="member-presence presence-${
                        normalizeStatus(
                            status
                        )
                    }"
                    title="${
                        escapeAttribute(
                            statusLabel(status)
                        )
                    }"
                ></span>

            </div>

            <div class="member-details">

                <div class="member-name">
                    ${escapeHTML(name)}
                    ${
                        own
                            ? `<span class="you-label">You</span>`
                            : ""
                    }
                </div>

                <div class="member-status">
                    ${escapeHTML(
                        member.nickname ||
                        member.role ||
                        statusLabel(status)
                    )}
                </div>

            </div>

            ${
                !own
                    ? `
                        <div class="member-actions">

                            <button
                                type="button"
                                title="Call"
                                data-member-call="${
                                    escapeAttribute(
                                        userId
                                    )
                                }"
                            >
                                📞
                            </button>

                            <button
                                type="button"
                                title="Message"
                                data-member-message="${
                                    escapeAttribute(
                                        userId
                                    )
                                }"
                            >
                                💬
                            </button>

                        </div>
                    `
                    : ""
            }

        </div>
    `;
}


/* ============================================================
   CALL PICKER
   ============================================================ */

function renderCallMemberPicker() {
    if (!dom.callMemberList) {
        return;
    }

    const search =
        String(
            dom.callMemberSearch?.value ||
            ""
        )
            .trim()
            .toLowerCase();

    const online =
        state.members.filter(
            member => {

                if (
                    member.user_id ===
                    state.user?.id
                ) {
                    return false;
                }

                const status =
                    effectivePresence(
                        member.user_id,
                        state.presences.get(
                            member.user_id
                        )
                    );

                if (
                    status ===
                    "offline"
                ) {
                    return false;
                }

                if (!search) {
                    return true;
                }

                return profileName(
                    member.user_id
                )
                    .toLowerCase()
                    .includes(search);
            }
        );

    if (dom.selectedCallMemberCount) {
        dom.selectedCallMemberCount.textContent =
            state.callSelectedUsers.size;
    }

    if (!online.length) {
        dom.callMemberList.innerHTML =
            `<div class="empty-members">
                No online members available.
            </div>`;

        return;
    }

    dom.callMemberList.innerHTML =
        online
            .map(
                member => {

                    const userId =
                        member.user_id;

                    const name =
                        profileName(
                            userId
                        );

                    const photo =
                        profilePhoto(
                            userId
                        );

                    const checked =
                        state.callSelectedUsers
                            .has(userId);

                    const status =
                        effectivePresence(
                            userId,
                            state.presences.get(
                                userId
                            )
                        );

                    return `
                        <label
                            class="call-member-option"
                        >

                            <input
                                type="checkbox"
                                data-call-user="${
                                    escapeAttribute(
                                        userId
                                    )
                                }"
                                ${
                                    checked
                                        ? "checked"
                                        : ""
                                }
                            >

                            <img
                                src="${
                                    photo ||
                                    avatarFallback(
                                        name
                                    )
                                }"
                                alt=""
                                onerror="this.onerror=null;this.src='${avatarFallback(name)}'"
                            >

                            <span>
                                <strong>
                                    ${escapeHTML(name)}
                                </strong>

                                <small>
                                    ${escapeHTML(
                                        statusLabel(
                                            status
                                        )
                                    )}
                                </small>
                            </span>

                        </label>
                    `;
                }
            )
            .join("");
}


/* ============================================================
   CALL ROOMS
   ============================================================ */

async function startCommunityCall() {
    if (
        !state.currentCommunity ||
        state.currentCommunity.isVirtual
    ) {
        return;
    }

    state.callSelectedUsers.clear();

    renderCallMemberPicker();

    openModal(
        dom.callPickerModal
    );
}


async function startGeneralCall() {
    state.callSelectedUsers.clear();

    renderCallMemberPicker();

    openModal(
        dom.callPickerModal
    );
}


async function startSelectedCall() {
    if (!state.user) {
        return;
    }

    const selected =
        [
            ...state.callSelectedUsers
        ];

    if (!selected.length) {
        showToast(
            "Select at least one online member."
        );

        return;
    }

    const roomCode =
        `mw-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    const communityId =
        state.currentCommunity &&
        !state.currentCommunity.isVirtual
            ? state.currentCommunity.id
            : null;

    const targetUserId =
        selected.length === 1
            ? selected[0]
            : null;

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
                communityId
                    ? "community"
                    : "general",

            call_type:
                "video",

            status:
                "waiting",

            created_by:
                state.user.id,

            target_user_id:
                targetUserId,

            room_status:
                "ringing",

            max_participants:
                100
        })
        .select()
        .single();

    if (error) {
        console.error(
            "Call room creation failed:",
            error
        );

        showToast(
            error.message ||
            "Unable to start call."
        );

        return;
    }

    const participants = [
        {
            room_id:
                room.id,

            user_id:
                state.user.id,

            status:
                "joined",

            joined_at:
                new Date().toISOString()
        },

        ...selected.map(
            userId => ({
                room_id:
                    room.id,

                user_id:
                    userId,

                status:
                    "invited"
            })
        )
    ];

    const {
        error: participantError
    } = await supabase
        .from(
            "chat_call_participants"
        )
        .insert(
            participants
        );

    if (participantError) {
        console.error(
            "Call participants failed:",
            participantError
        );
    }

    closeModal(
        dom.callPickerModal
    );

    state.callSelectedUsers.clear();

    window.location.href =
        `./community-call.html?room=${encodeURIComponent(room.id)}&code=${encodeURIComponent(roomCode)}`;
}


function openCommunityVoiceChannel() {
    if (!state.currentChannel) {
        return;
    }

    showToast(
        "Opening voice room..."
    );

    /*
     * Voice channels use the same call engine.
     * No second call engine is created here.
     */
    window.location.href =
        `./community-call.html?channel=${encodeURIComponent(
            state.currentChannel.id
        )}&community=${encodeURIComponent(
            state.currentCommunity?.id || ""
        )}`;
}


/* ============================================================
   REALTIME
   ============================================================ */

function clearRealtime() {
    for (
        const channel of
        state.realtimeChannels
    ) {
        try {
            supabase.removeChannel(
                channel
            );
        } catch {}
    }

    state.realtimeChannels =
        [];
}


function subscribeToCommunity(
    communityId
) {
    const channel =
        supabase
            .channel(
                `community-${communityId}-${crypto.randomUUID()}`
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_presence"
                },
                async payload => {

                    if (
                        payload.new?.user_id
                    ) {
                        state.presences.set(
                            payload.new.user_id,
                            payload.new
                        );

                        renderMemberList();

                        renderCallMemberPicker();

                        updateOwnPresenceUI();
                    }
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_call_rooms"
                },
                payload => {
                    handleIncomingCallRoom(
                        payload
                    );
                }
            )
            .subscribe();

    state.realtimeChannels.push(
        channel
    );
}


function subscribeToChannel(
    channelId
) {
    const channel =
        supabase
            .channel(
                `chat-channel-${channelId}-${crypto.randomUUID()}`
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
                async payload => {

                    const message =
                        payload.new;

                    if (
                        state.messages.some(
                            item =>
                                item.id ===
                                message.id
                        )
                    ) {
                        return;
                    }

                    state.messages.push(
                        message
                    );

                    await loadProfilesForUsers([
                        message.user_id
                    ]);

                    renderMessages();

                    await loadChannelAttachments();

                    scrollMessagesToBottom();
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_attachments"
                },
                async payload => {

                    const messageId =
                        payload.new?.message_id ||
                        payload.old?.message_id;

                    if (
                        state.messages.some(
                            item =>
                                item.id ===
                                messageId
                        )
                    ) {
                        await loadChannelAttachments();
                    }
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_message_reactions"
                },
                async () => {
                    /*
                     * Reaction realtime is intentionally
                     * lightweight. Messages remain stable.
                     */
                }
            )
            .subscribe();

    state.realtimeChannels.push(
        channel
    );
}


function handleIncomingCallRoom(
    payload
) {
    const room =
        payload.new;

    if (
        !room ||
        room.created_by ===
        state.user?.id
    ) {
        return;
    }

    if (
        room.target_user_id &&
        room.target_user_id !==
        state.user?.id
    ) {
        return;
    }

    if (
        room.room_status !==
        "ringing"
    ) {
        return;
    }

    const accepted =
        window.confirm(
            `${profileName(
                room.created_by
            )} is calling you. Join the call?`
        );

    if (!accepted) {
        return;
    }

    window.location.href =
        `./community-call.html?room=${encodeURIComponent(
            room.id
        )}&code=${encodeURIComponent(
            room.room_code
        )}`;
}


/* ============================================================
   PROFILE MODAL
   ============================================================ */

function renderProfileModal() {
    if (!dom.profileModalContent) {
        return;
    }

    const name =
        profileName(
            state.user?.id
        );

    const photo =
        profilePhoto(
            state.user?.id
        );

    dom.profileModalContent.innerHTML = `
        <div class="profile-modal-user">

            <img
                src="${
                    photo ||
                    avatarFallback(name)
                }"
                alt=""
                class="profile-modal-avatar"
                onerror="this.onerror=null;this.src='${avatarFallback(name)}'"
            >

            <h3>
                ${escapeHTML(name)}
            </h3>

            <p>
                ${escapeHTML(
                    state.user?.email || ""
                )}
            </p>

            <div class="profile-status">
                Current status:
                <strong>
                    ${escapeHTML(
                        statusLabel(
                            state.currentStatus
                        )
                    )}
                </strong>
            </div>

            <div class="status-buttons">

                <button
                    type="button"
                    data-set-status="online"
                >
                    🟢 Online
                </button>

                <button
                    type="button"
                    data-set-status="away"
                >
                    🟡 Away
                </button>

                <button
                    type="button"
                    data-set-status="dnd"
                >
                    🔴 Do Not Disturb
                </button>

            </div>

        </div>
    `;
}


/* ============================================================
   FRIENDS
   ============================================================ */

async function renderFriends(
    filter = "online"
) {
    if (!dom.friendsContent) {
        return;
    }

    let members =
        [...state.members];

    if (filter === "online") {
        members =
            members.filter(
                member =>
                    effectivePresence(
                        member.user_id,
                        state.presences.get(
                            member.user_id
                        )
                    ) !== "offline"
            );
    }

    if (filter === "offline") {
        members =
            members.filter(
                member =>
                    effectivePresence(
                        member.user_id,
                        state.presences.get(
                            member.user_id
                        )
                    ) === "offline"
            );
    }

    dom.friendsContent.innerHTML =
        members.length
            ? members
                .map(
                    member => {

                        const userId =
                            member.user_id;

                        const name =
                            profileName(
                                userId
                            );

                        const photo =
                            profilePhoto(
                                userId
                            );

                        const status =
                            effectivePresence(
                                userId,
                                state.presences.get(
                                    userId
                                )
                            );

                        if (
                            userId ===
                            state.user?.id
                        ) {
                            return "";
                        }

                        return `
                            <div class="friend-card">

                                <img
                                    src="${
                                        photo ||
                                        avatarFallback(name)
                                    }"
                                    alt=""
                                    onerror="this.onerror=null;this.src='${avatarFallback(name)}'"
                                >

                                <div>
                                    <strong>
                                        ${escapeHTML(name)}
                                    </strong>

                                    <small>
                                        ${escapeHTML(
                                            statusLabel(
                                                status
                                            )
                                        )}
                                    </small>
                                </div>

                                ${
                                    status !==
                                    "offline"
                                        ? `
                                            <button
                                                type="button"
                                                data-friend-call="${
                                                    escapeAttribute(
                                                        userId
                                                    )
                                                }"
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
                .join("")
            : `
                <div class="empty-members">
                    No members found.
                </div>
            `;
}


/* ============================================================
   CONTESTS
   ============================================================ */

async function renderVirtualContests() {
    updateCommunityHeader();

    if (dom.currentChannelName) {
        dom.currentChannelName.textContent =
            "Contests";
    }

    if (dom.currentChannelDescription) {
        dom.currentChannelDescription.textContent =
            "Academic contests using real Mwaniki Scholars courses and quizzes.";
    }

    if (!dom.messageList) {
        return;
    }

    dom.messageList.innerHTML = `
        <div class="channel-welcome contests-welcome">

            <div class="channel-welcome-icon">
                🏆
            </div>

            <h2>
                Mwaniki Scholars Contests
            </h2>

            <p>
                Choose a real course and start an academic quiz.
            </p>

            <button
                type="button"
                id="openContestFromCommunity"
                class="primary-button"
            >
                Start Contest
            </button>

        </div>
    `;

    const button =
        $("openContestFromCommunity");

    button?.addEventListener(
        "click",
        openContestModal
    );
}


function openContestModal() {
    if (
        !dom.contestCourseSelector
    ) {
        return;
    }

    dom.contestCourseSelector.innerHTML =
        `<option value="">
            Select a course
        </option>` +
        state.courses
            .map(
                course => `
                    <option
                        value="${escapeAttribute(
                            course.id
                        )}"
                    >
                        ${escapeHTML(
                            course.title
                        )}
                    </option>
                `
            )
            .join("");

    openModal(
        dom.contestModal
    );
}


async function loadContestQuestions(
    courseId
) {
    if (
        !dom.contestQuestionArea
    ) {
        return;
    }

    dom.contestQuestionArea.innerHTML =
        "Loading questions...";

    const {
        data,
        error
    } = await supabase
        .from("quizzes")
        .select(`
            question,
            option_a,
            option_b,
            option_c,
            option_d,
            correct_answer,
            course,
            unit
        `)
        .eq(
            "course_id",
            courseId
        )
        .limit(20);

    if (error) {
        console.error(
            "Contest question load failed:",
            error
        );

        dom.contestQuestionArea.innerHTML =
            `<p>
                Unable to load questions.
            </p>`;

        return;
    }

    const questions =
        data || [];

    if (!questions.length) {
        dom.contestQuestionArea.innerHTML =
            `<p>
                No quiz questions are available for this course yet.
            </p>`;

        return;
    }

    state.currentContestQuestions =
        questions;

    state.currentContestIndex =
        0;

    renderContestQuestion();
}


function renderContestQuestion() {
    const questions =
        state.currentContestQuestions;

    const index =
        state.currentContestIndex;

    if (
        !questions.length ||
        !dom.contestQuestionArea
    ) {
        return;
    }

    const question =
        questions[index];

    const options = [
        ["A", question.option_a],
        ["B", question.option_b],
        ["C", question.option_c],
        ["D", question.option_d]
    ];

    dom.contestQuestionArea.innerHTML = `
        <div class="contest-question">

            <div class="contest-progress">
                Question ${
                    index + 1
                } of ${
                    questions.length
                }
            </div>

            <h3>
                ${escapeHTML(
                    question.question
                )}
            </h3>

            <div class="contest-options">

                ${options
                    .map(
                        ([letter, text]) => `
                            <button
                                type="button"
                                data-contest-answer="${letter}"
                            >
                                <strong>
                                    ${letter}.
                                </strong>

                                ${escapeHTML(
                                    text || ""
                                )}
                            </button>
                        `
                    )
                    .join("")}

            </div>

        </div>
    `;
}


/* ============================================================
   CREATE CHANNEL
   ============================================================ */

function openCreateChannel(
    category = "community"
) {
    openModal(
        dom.createChannelModal
    );

    const categoryInput =
        $("createChannelCategory");

    if (categoryInput) {
        categoryInput.value =
            category;
    }
}


async function createChannel(
    event
) {
    event.preventDefault();

    if (
        !state.currentCommunity ||
        state.currentCommunity.isVirtual
    ) {
        return;
    }

    const nameInput =
        $("createChannelName");

    const descriptionInput =
        $("createChannelDescription");

    const typeInput =
        $("createChannelType");

    const name =
        nameInput?.value.trim();

    if (!name) {
        showToast(
            "Enter a channel name."
        );

        return;
    }

    const slug =
        slugify(name);

    const channelType =
        typeInput?.value ||
        "text";

    const position =
        state.channels.length + 1;

    const {
        data,
        error
    } = await supabase
        .from("chat_channels")
        .insert({
            community_id:
                state.currentCommunity.id,

            name,

            slug,

            description:
                descriptionInput?.value.trim() ||
                null,

            channel_type:
                channelType,

            position,

            is_private:
                false,

            is_archived:
                false,

            is_active:
                true,

            created_by:
                state.user.id
        })
        .select()
        .single();

    if (error) {
        console.error(
            "Create channel failed:",
            error
        );

        showToast(
            error.message ||
            "Unable to create channel."
        );

        return;
    }

    closeModal(
        dom.createChannelModal
    );

    if (dom.createChannelForm) {
        dom.createChannelForm.reset();
    }

    await loadCommunityChannels(
        state.currentCommunity.id
    );

    if (data) {
        await selectChannel(
            data
        );
    }

    showToast(
        "Channel created."
    );
}


/* ============================================================
   COMPOSER HEIGHT
   ============================================================ */

function updateComposerHeight() {
    if (!dom.messageInput) {
        return;
    }

    dom.messageInput.style.height =
        "auto";

    dom.messageInput.style.height =
        `${Math.min(
            dom.messageInput.scrollHeight,
            180
        )}px`;
}


/* ============================================================
   EVENT BINDING
   ============================================================ */

function bindEvents() {

    /* Community rail */

    dom.communityRailList?.addEventListener(
        "click",
        async event => {

            const button =
                event.target.closest(
                    "[data-community-id]"
                );

            if (!button) {
                return;
            }

            const community =
                state.communities.find(
                    item =>
                        String(item.id) ===
                        String(
                            button.dataset.communityId
                        )
                );

            if (community) {
                await selectCommunity(
                    community
                );
            }
        }
    );


    /* Add community */

    dom.addCommunityButton?.addEventListener(
        "click",
        () => {
            showToast(
                "Community creation can be enabled for authorized users."
            );
        }
    );


    /* Channels */

    document.addEventListener(
        "click",
        async event => {

            const button =
                event.target.closest(
                    "[data-channel-id]"
                );

            if (!button) {
                return;
            }

            const channel =
                state.channels.find(
                    item =>
                        String(item.id) ===
                        String(
                            button.dataset.channelId
                        )
                );

            if (channel) {
                await selectChannel(
                    channel
                );
            }
        }
    );


    /* Channel search */

    dom.channelSearchInput?.addEventListener(
        "input",
        renderChannels
    );


    /* Send */

    dom.sendMessageButton?.addEventListener(
        "click",
        sendMessage
    );


    dom.messageInput?.addEventListener(
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


    dom.messageInput?.addEventListener(
        "input",
        () => {
            updateComposerHeight();
            updateCharacterCount();
        }
    );


    /* Attachments */

    on(
        "attachButton",
        "click",
        () => {
            dom.attachmentInput?.click();
        }
    );


    dom.attachmentInput?.addEventListener(
        "change",
        event => {
            handleFilesSelected(
                event.target.files
            );
        }
    );


    dom.attachmentPreview?.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-remove-file]"
                );

            if (!button) {
                return;
            }

            const index =
                Number(
                    button.dataset.removeFile
                );

            state.selectedFiles.splice(
                index,
                1
            );

            renderAttachmentPreview();
        }
    );


    /* Emoji */

    on(
        "emojiButton",
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


    on(
        "closeEmojiButton",
        "click",
        () => {
            dom.emojiPanel?.classList.add(
                "hidden"
            );
        }
    );


    dom.emojiGrid?.addEventListener(
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


    dom.emojiSearch?.addEventListener(
        "input",
        event => {

            const term =
                event.target.value
                    .trim()
                    .toLowerCase();

            const filtered =
                CONFIG.emoji.filter(
                    emoji =>
                        !term ||
                        emoji
                            .toLowerCase()
                            .includes(term)
                );

            if (dom.emojiGrid) {
                dom.emojiGrid.innerHTML =
                    filtered
                        .map(
                            emoji => `
                                <button
                                    type="button"
                                    data-emoji="${escapeAttribute(emoji)}"
                                >
                                    ${emoji}
                                </button>
                            `
                        )
                        .join("");
            }
        }
    );


    /* Stickers */

    on(
        "stickerButton",
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


    on(
        "closeStickerButton",
        "click",
        () => {
            dom.stickerPanel?.classList.add(
                "hidden"
            );
        }
    );


    dom.stickerGrid?.addEventListener(
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
                `${button.dataset.sticker} `
            );

            closeComposerPanels();
        }
    );


    /* GIF */

    on(
        "gifButton",
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
        }
    );


    on(
        "closeGifButton",
        "click",
        () => {
            dom.gifPanel?.classList.add(
                "hidden"
            );
        }
    );


    dom.gifGrid?.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-gif]"
                );

            if (!button) {
                return;
            }

            insertAtCursor(
                dom.messageInput,
                `[GIF: ${button.dataset.gif}]`
            );

            closeComposerPanels();
        }
    );


    dom.gifSearch?.addEventListener(
        "input",
        event => {

            const term =
                event.target.value
                    .trim()
                    .toLowerCase();

            const filtered =
                CONFIG.gifs.filter(
                    gif =>
                        gif
                            .toLowerCase()
                            .includes(term)
                );

            renderGifPanel(
                filtered
            );
        }
    );


    /* Voice */

    on(
        "voiceNoteButton",
        "click",
        toggleVoiceRecording
    );


    /* Message actions */

    dom.messageList?.addEventListener(
        "click",
        async event => {

            const actionButton =
                event.target.closest(
                    "[data-message-action]"
                );

            if (actionButton) {

                const action =
                    actionButton.dataset
                        .messageAction;

                const messageId =
                    actionButton.dataset
                        .messageId;

                if (
                    action === "delete"
                ) {
                    await deleteMessage(
                        messageId
                    );
                }

                if (
                    action === "edit"
                ) {
                    await editMessage(
                        messageId
                    );
                }

                if (
                    action === "react"
                ) {
                    await toggleReaction(
                        messageId,
                        "👍"
                    );
                }

                if (
                    action === "reply"
                ) {
                    const message =
                        state.messages.find(
                            item =>
                                item.id ===
                                messageId
                        );

                    if (message) {
                        insertAtCursor(
                            dom.messageInput,
                            `@${profileName(
                                message.user_id
                            )} `
                        );
                    }
                }

                return;
            }


            const attachment =
                event.target.closest(
                    "[data-attachment-id]"
                );

            if (attachment) {
                return;
            }
        }
    );


    /* Members */

    on(
        "channelMembersButton",
        "click",
        () => {
            $("memberSidebar")
                ?.classList.toggle(
                    "mobile-open"
                );
        }
    );


    on(
        "closeMemberSidebarButton",
        "click",
        () => {
            $("memberSidebar")
                ?.classList.remove(
                    "mobile-open"
                );
        }
    );


    dom.memberSearchInput?.addEventListener(
        "input",
        renderMemberList
    );


    dom.memberList?.addEventListener(
        "click",
        event => {

            const call =
                event.target.closest(
                    "[data-member-call]"
                );

            if (call) {

                state.callSelectedUsers.clear();

                state.callSelectedUsers.add(
                    call.dataset.memberCall
                );

                renderCallMemberPicker();

                openModal(
                    dom.callPickerModal
                );

                return;
            }

            const message =
                event.target.closest(
                    "[data-member-message]"
                );

            if (message) {

                showToast(
                    "One-to-one messaging is ready for the DM interface."
                );
            }
        }
    );


    /* Mobile sidebar */

    on(
        "mobileSidebarButton",
        "click",
        () => {
            $("channelSidebar")
                ?.classList.toggle(
                    "mobile-open"
                );
        }
    );


    /* Calls */

    on(
        "communityCallButton",
        "click",
        startCommunityCall
    );


    on(
        "generalCallButton",
        "click",
        startGeneralCall
    );


    on(
        "closeCallPickerButton",
        "click",
        () => {
            closeModal(
                dom.callPickerModal
            );
        }
    );


    on(
        "callSelectAllButton",
        "click",
        () => {

            const online =
                state.members.filter(
                    member =>
                        member.user_id !==
                        state.user?.id &&
                        effectivePresence(
                            member.user_id,
                            state.presences.get(
                                member.user_id
                            )
                        ) !== "offline"
                );

            if (
                state.callSelectedUsers.size ===
                online.length
            ) {
                state.callSelectedUsers.clear();
            } else {
                online.forEach(
                    member =>
                        state.callSelectedUsers.add(
                            member.user_id
                        )
                );
            }

            renderCallMemberPicker();
        }
    );


    on(
        "startSelectedCallButton",
        "click",
        startSelectedCall
    );


    dom.callMemberSearch?.addEventListener(
        "input",
        renderCallMemberPicker
    );


    dom.callMemberList?.addEventListener(
        "change",
        event => {

            const checkbox =
                event.target.closest(
                    "[data-call-user]"
                );

            if (!checkbox) {
                return;
            }

            const userId =
                checkbox.dataset.callUser;

            if (checkbox.checked) {
                state.callSelectedUsers.add(
                    userId
                );
            } else {
                state.callSelectedUsers.delete(
                    userId
                );
            }

            renderCallMemberPicker();
        }
    );


    /* Friends */

    on(
        "friendsButton",
        "click",
        async () => {

            openModal(
                dom.friendsModal
            );

            await renderFriends(
                "online"
            );
        }
    );


    on(
        "closeFriendsButton",
        "click",
        () => {
            closeModal(
                dom.friendsModal
            );
        }
    );


    document
        .querySelectorAll(
            ".friends-tab"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        document
                            .querySelectorAll(
                                ".friends-tab"
                            )
                            .forEach(
                                item =>
                                    item.classList.remove(
                                        "active"
                                    )
                            );

                        button.classList.add(
                            "active"
                        );

                        await renderFriends(
                            button.dataset
                                .friendsTab
                        );
                    }
                );
            }
        );


    dom.friendsContent?.addEventListener(
        "click",
        event => {

            const call =
                event.target.closest(
                    "[data-friend-call]"
                );

            if (!call) {
                return;
            }

            state.callSelectedUsers.clear();

            state.callSelectedUsers.add(
                call.dataset.friendCall
            );

            closeModal(
                dom.friendsModal
            );

            startSelectedCall();
        }
    );


    /* Profile */

    on(
        "profileButton",
        "click",
        () => {

            renderProfileModal();

            openModal(
                dom.profileModal
            );
        }
    );


    on(
        "closeProfileButton",
        "click",
        () => {
            closeModal(
                dom.profileModal
            );
        }
    );


    dom.profileModalContent?.addEventListener(
        "click",
        async event => {

            const button =
                event.target.closest(
                    "[data-set-status]"
                );

            if (!button) {
                return;
            }

            await setOwnStatus(
                button.dataset.setStatus
            );
        }
    );


    /* Rules */

    on(
        "communityRulesButton",
        "click",
        () => {
            openModal(
                dom.rulesModal
            );
        }
    );


    on(
        "closeRulesButton",
        "click",
        () => {
            closeModal(
                dom.rulesModal
            );
        }
    );


    /* File preview */

    on(
        "closeFilePreviewButton",
        "click",
        () => {
            closeModal(
                dom.filePreviewModal
            );
        }
    );


    on(
        "cancelAttachmentButton",
        "click",
        () => {
            closeModal(
                dom.filePreviewModal
            );
        }
    );


    /* Contest */

    on(
        "openContestButton",
        "click",
        openContestModal
    );


    on(
        "closeContestButton",
        "click",
        () => {
            closeModal(
                dom.contestModal
            );
        }
    );


    dom.contestCourseSelector?.addEventListener(
        "change",
        async event => {

            const courseId =
                event.target.value;

            if (!courseId) {
                return;
            }

            const course =
                state.courses.find(
                    item =>
                        String(item.id) ===
                        String(courseId)
                );

            if (dom.contestCourseName) {
                dom.contestCourseName.textContent =
                    course?.title || "";
            }

            await loadContestQuestions(
                courseId
            );
        }
    );


    dom.contestQuestionArea?.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-contest-answer]"
                );

            if (!button) {
                return;
            }

            const question =
                state.currentContestQuestions[
                    state.currentContestIndex
                ];

            const answer =
                button.dataset.contestAnswer;

            const correct =
                String(
                    question.correct_answer ||
                    ""
                )
                    .trim()
                    .toUpperCase();

            const isCorrect =
                answer === correct ||
                question[
                    `option_${answer.toLowerCase()}`
                ] === question.correct_answer;

            button.classList.add(
                isCorrect
                    ? "correct"
                    : "incorrect"
            );

            showToast(
                isCorrect
                    ? "Correct answer."
                    : "Incorrect answer."
            );

            setTimeout(() => {

                if (
                    state.currentContestIndex <
                    state.currentContestQuestions.length -
                    1
                ) {
                    state.currentContestIndex++;

                    renderContestQuestion();

                } else {
                    dom.contestQuestionArea.innerHTML += `
                        <div class="contest-complete">
                            <strong>
                                Contest complete!
                            </strong>
                        </div>
                    `;
                }

            }, 900);
        }
    );


    /* Create channel */

    document
        .querySelectorAll(
            "[data-category-add]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {
                        openCreateChannel(
                            button.dataset.categoryAdd
                        );
                    }
                );
            }
        );


    on(
        "closeCreateChannelButton",
        "click",
        () => {
            closeModal(
                dom.createChannelModal
            );
        }
    );


    on(
        "cancelCreateChannelButton",
        "click",
        () => {
            closeModal(
                dom.createChannelModal
            );
        }
    );


    dom.createChannelForm?.addEventListener(
        "submit",
        createChannel
    );


    /* Notifications */

    on(
        "notificationButton",
        "click",
        () => {
            dom.notificationPanel?.classList.toggle(
                "hidden"
            );
        }
    );


    on(
        "closeNotificationPanelButton",
        "click",
        () => {
            dom.notificationPanel?.classList.add(
                "hidden"
            );
        }
    );


    /* Global search */

    on(
        "globalSearchInput",
        "keydown",
        event => {

            if (
                event.key !==
                "Enter"
            ) {
                return;
            }

            const query =
                event.target.value
                    .trim()
                    .toLowerCase();

            if (!query) {
                return;
            }

            const channel =
                state.channels.find(
                    item =>
                        String(
                            item.name || ""
                        )
                            .toLowerCase()
                            .includes(query)
                );

            if (channel) {
                selectChannel(
                    channel
                );

                return;
            }

            const member =
                state.members.find(
                    item =>
                        profileName(
                            item.user_id
                        )
                            .toLowerCase()
                            .includes(query)
                );

            if (member) {
                showToast(
                    profileName(
                        member.user_id
                    )
                );

                return;
            }

            showToast(
                "No matching channel or member found."
            );
        }
    );


    /* Outside popovers */

    document.addEventListener(
        "click",
        event => {

            if (
                !event.target.closest(
                    ".composer-popover"
                ) &&
                !event.target.closest(
                    "#emojiButton"
                ) &&
                !event.target.closest(
                    "#stickerButton"
                ) &&
                !event.target.closest(
                    "#gifButton"
                )
            ) {
                closeComposerPanels();
            }
        }
    );


    /* Keyboard search */

    document.addEventListener(
        "keydown",
        event => {

            if (
                (event.ctrlKey ||
                    event.metaKey) &&
                event.key.toLowerCase() ===
                "k"
            ) {
                event.preventDefault();

                $("globalSearchInput")
                    ?.focus();
            }
        }
    );


    /* Escape */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape"
            ) {
                closeComposerPanels();

                closeModal(
                    dom.callPickerModal
                );

                closeModal(
                    dom.friendsModal
                );

                closeModal(
                    dom.profileModal
                );

                closeModal(
                    dom.rulesModal
                );

                closeModal(
                    dom.filePreviewModal
                );

                closeModal(
                    dom.contestModal
                );

                closeModal(
                    dom.createChannelModal
                );
            }
        }
    );
}


/* ============================================================
   INITIALIZATION
   ============================================================ */

async function initialize() {
    try {

        console.log(
            "[Mwaniki Community] Starting..."
        );

        if (!supabase) {
            throw new Error(
                "Supabase client is unavailable."
            );
        }

        await requireUser();

        if (!state.user) {
            return;
        }

        console.log(
            "[Mwaniki Community] Authenticated:",
            state.user.id
        );

        bindEvents();

        renderEmojiPicker();
        renderStickers();
        renderGifPanel();

        await Promise.all([
            loadOwnProfile(),
            ensurePresence(),
            loadCourses()
        ]);

        await loadCommunities();

        setupActivityPresence();

        window.addEventListener(
            "beforeunload",
            () => {
                clearInterval(
                    state.heartbeatTimer
                );

                clearTimeout(
                    state.awayTimer
                );
            }
        );

        console.log(
            "[Mwaniki Community] Ready."
        );

    } catch (error) {

        console.error(
            "[Mwaniki Community] Initialization failed:",
            error
        );

        showToast(
            error.message ||
            "Community failed to initialize."
        );
    }
}


/* ============================================================
   START
   ============================================================ */

initialize();
