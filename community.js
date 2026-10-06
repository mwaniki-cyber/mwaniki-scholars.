/* ============================================================
   MWANIKI SCHOLARS COMMUNITY
   COMPLETE COMMUNITY ENGINE
   ============================================================ */

import { supabase } from "./supabase.js";


/* ============================================================
   CONFIG
   ============================================================ */

const CONFIG = {
    messageLimit: 100,
    heartbeatMs: 25000,
    presenceFreshMs: 70000,
    awayAfterMs: 5 * 60 * 1000,
    maxAttachmentSize: 25 * 1024 * 1024,
    maxVoiceNoteMs: 120000,

    communityIcons: {
        "mwaniki-scholars": "🩺",
        "med-rizz": "😂",
        "mwaniki-games": "🎮",
        "contests": "🏆"
    },

    fallbackCommunities: [
        {
            id: "virtual-contests",
            name: "Contests",
            slug: "contests",
            description: "Academic competitions using real course data.",
            icon_url: "🏆",
            isVirtual: true
        }
    ],

    defaultChannelNames: {
        information: [
            ["announcements", "Important community announcements", "announcement"],
            ["rules", "Community rules and guidelines", "text"],
            ["university-news", "University and medical education news", "text"]
        ],

        general: [
            ["general", "General discussion", "text"],
            ["introductions", "Introduce yourself", "text"],
            ["help-desk", "Community help desk", "text"]
        ],

        study: [
            ["study-hall", "General study discussions", "study"],
            ["clinical-discussion", "Clinical discussions", "study"],
            ["case-studies", "Clinical case discussions", "study"],
            ["study-groups", "Find and organize study groups", "study"]
        ],

        community: [
            ["random", "General community chat", "text"],
            ["creations", "Share your creations", "text"]
        ],

        voice: [
            ["general-study-room", "General study voice room", "voice"],
            ["clinical-revision", "Clinical revision room", "voice"],
            ["group-discussion", "Group discussion room", "voice"]
        ]
    },

    emoji: [
        "😀","😃","😄","😁","😆","😅","😂","🤣",
        "😊","😇","🙂","🙃","😉","😌","😍","🥰",
        "😘","😎","🤓","🧐","🤩","🥳","😏","😐",
        "😑","😶","🙄","😬","🤔","🤭","🤗","😴",
        "🤒","🤕","🤢","🤮","🤧","🥶","🥵","😱",
        "😢","😭","😤","😡","🤬","😇","🙏","👏",
        "👍","👎","👌","✌️","🤝","💪","❤️","💚",
        "💙","💜","🩺","🧪","🔬","🧬","💊","🩸",
        "📚","📖","📝","🎓","🏆","🔥","⭐","✨"
    ],

    stickers: [
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
    ]
};


/* ============================================================
   STATE
   ============================================================ */

const state = {
    user: null,

    communities: [],
    courses: [],
    units: [],

    currentCommunity: null,
    currentChannel: null,

    channels: [],
    messages: [],
    attachments: new Map(),

    members: [],
    profiles: new Map(),
    presences: new Map(),

    selectedFiles: [],

    currentStatus: "online",
    manuallySelectedStatus: false,

    typingUsers: new Map(),
    typingTimer: null,

    realtimeChannels: [],

    heartbeatTimer: null,
    awayTimer: null,

    recording: false,
    mediaRecorder: null,
    voiceChunks: [],
    voiceStartedAt: 0,

    callSelectedUsers: new Set(),

    currentContestQuestions: [],
    currentContestIndex: 0,

    searchTerm: "",

    storageBucket: null
};


/* ============================================================
   DOM
   ============================================================ */

const $ = (id) => document.getElementById(id);

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
    emojiCategories: $("emojiCategories"),
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
    const label = initials(name);

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
            <rect width="120" height="120" rx="60" fill="#26333c"/>
            <text x="60" y="68"
                text-anchor="middle"
                font-family="Arial"
                font-size="42"
                font-weight="700"
                fill="#dce8e8">${label}</text>
        </svg>
    `)}`;
}

function safeURL(url) {
    if (!url) {
        return "";
    }

    try {
        const parsed = new URL(url, window.location.href);

        if (
            parsed.protocol === "https:" ||
            parsed.protocol === "http:"
        ) {
            return parsed.href;
        }
    } catch {
        return "";
    }

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

    return `${(value / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
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
    }, 2800);
}

function openModal(element) {
    if (element) {
        element.classList.remove("hidden");
    }
}

function closeModal(element) {
    if (element) {
        element.classList.add("hidden");
    }
}

function profileName(userId) {
    if (!userId) {
        return "Unknown user";
    }

    const profile = state.profiles.get(userId);

    if (profile?.full_name) {
        return profile.full_name;
    }

    const member = state.members.find(
        (item) => item.user_id === userId
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
    const profile = state.profiles.get(userId);

    if (profile?.photo_url) {
        return safeURL(profile.photo_url);
    }

    const member = state.members.find(
        (item) => item.user_id === userId
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

    const url = profilePhoto(userId);

    image.src = url || avatarFallback(name);

    image.onerror = () => {
        image.onerror = null;
        image.src = avatarFallback(name);
    };
}


/* ============================================================
   STATUS
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
    if (!row) {
        return "offline";
    }

    const rawStatus = normalizeStatus(row.status);

    const updated = new Date(
        row.updated_at ||
        row.last_seen_at ||
        0
    ).getTime();

    const age = Date.now() - updated;

    if (
        rawStatus !== "offline" &&
        (!updated || age > CONFIG.presenceFreshMs)
    ) {
        return "offline";
    }

    if (
        rawStatus === "online" &&
        updated &&
        age > CONFIG.awayAfterMs
    ) {
        return "away";
    }

    return rawStatus;
}

function statusLabel(status) {
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

function updateCurrentUserPresenceUI() {
    if (!state.user) {
        return;
    }

    const row = state.presences.get(state.user.id);

    const status = effectivePresence(
        state.user.id,
        row
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


/* ============================================================
   AUTH
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
        window.location.href = "./index.html";
        return null;
    }

    state.user = data.user;

    return state.user;
}


/* ============================================================
   PROFILE LOADING
   ============================================================ */

async function loadOwnProfile() {
    if (!state.user) {
        return;
    }

    const userId = state.user.id;

    const [
        profileResult,
        studentResult
    ] = await Promise.all([
        supabase
            .from("chat_public_profiles")
            .select("id,full_name,photo_url,updated_at")
            .eq("id", userId)
            .maybeSingle(),

        supabase
            .from("students")
            .select("id,full_name,course,level,photo_url,created_at")
            .eq("id", userId)
            .maybeSingle()
    ]);

    if (
        !profileResult.error &&
        profileResult.data
    ) {
        state.profiles.set(
            userId,
            profileResult.data
        );
    }

    if (
        !studentResult.error &&
        studentResult.data
    ) {
        const current =
            state.profiles.get(userId) || {};

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

    const name = profileName(userId);

    dom.headerProfileName.textContent = name;
    dom.sidebarUserName.textContent = name;

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

    updateCurrentUserPresenceUI();
}


/* ============================================================
   PRESENCE
   ============================================================ */

async function ensurePresence() {
    if (!state.user) {
        return;
    }

    const {
        data,
        error
    } = await supabase
        .from("chat_presence")
        .select(
            "user_id,status,custom_status,last_seen_at,updated_at"
        )
        .eq("user_id", state.user.id)
        .maybeSingle();

    if (error) {
        console.warn(
            "Presence read failed:",
            error.message
        );
        return;
    }

    if (data) {
        state.presences.set(
            state.user.id,
            data
        );

        state.currentStatus =
            normalizeStatus(data.status);

        state.manuallySelectedStatus =
            state.currentStatus !== "online";
    }

    if (!data) {
        const {
            data: inserted,
            error: insertError
        } = await supabase
            .from("chat_presence")
            .insert({
                user_id: state.user.id,
                status: "online",
                last_seen_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (insertError) {
            console.warn(
                "Presence insert failed:",
                insertError.message
            );
            return;
        }

        state.presences.set(
            state.user.id,
            inserted
        );

        state.currentStatus = "online";
    }

    updateCurrentUserPresenceUI();

    startPresenceHeartbeat();
}

async function writePresence(
    status = state.currentStatus
) {
    if (!state.user) {
        return;
    }

    const normalized =
        normalizeStatus(status);

    const payload = {
        user_id: state.user.id,
        status: normalized,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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

    updateCurrentUserPresenceUI();
}

function startPresenceHeartbeat() {
    clearInterval(
        state.heartbeatTimer
    );

    state.heartbeatTimer = setInterval(
        async () => {

            if (
                document.visibilityState === "hidden"
            ) {
                return;
            }

            if (
                state.currentStatus === "offline"
            ) {
                return;
            }

            if (
                state.currentStatus === "away"
            ) {
                await writePresence("away");
                return;
            }

            if (
                state.currentStatus === "dnd"
            ) {
                await writePresence("dnd");
                return;
            }

            await writePresence("online");

        },
        CONFIG.heartbeatMs
    );
}

function setupActivityPresence() {
    const activity = () => {

        if (!state.user) {
            return;
        }

        if (
            state.currentStatus === "online" &&
            state.manuallySelectedStatus
        ) {
            return;
        }

        if (
            state.currentStatus === "away" &&
            !state.manuallySelectedStatus
        ) {
            state.currentStatus = "online";
            writePresence("online");
        }

        if (
            state.currentStatus === "online"
        ) {
            clearTimeout(
                state.awayTimer
            );

            state.awayTimer = setTimeout(
                () => {

                    if (
                        state.manuallySelectedStatus
                    ) {
                        return;
                    }

                    state.currentStatus = "away";

                    writePresence("away");

                },
                CONFIG.awayAfterMs
            );
        }
    };

    [
        "mousemove",
        "mousedown",
        "keydown",
        "touchstart",
        "scroll"
    ].forEach(
        (eventName) => {
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
                document.visibilityState === "visible"
            ) {
                if (
                    !state.manuallySelectedStatus
                ) {
                    state.currentStatus =
                        "online";

                    writePresence("online");
                }
            }
        }
    );
}

async function setOwnStatus(status) {
    const normalized =
        normalizeStatus(status);

    state.currentStatus =
        normalized;

    state.manuallySelectedStatus =
        normalized !== "online";

    await writePresence(normalized);

    renderProfileModal();

    showToast(
        `Status changed to ${statusLabel(normalized)}.`
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

        showToast(
            "Unable to load communities."
        );

        state.communities =
            CONFIG.fallbackCommunities;

        return;
    }

    state.communities =
        data || [];

    const hasContests =
        state.communities.some(
            (community) =>
                community.slug === "contests"
        );

    if (!hasContests) {
        state.communities.push(
            CONFIG.fallbackCommunities[0]
        );
    }

    renderCommunityRail();

    if (!state.currentCommunity) {

        const preferred =
            state.communities.find(
                (community) =>
                    community.slug ===
                    "mwaniki-scholars"
            ) ||
            state.communities[0];

        await selectCommunity(
            preferred
        );
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

function renderCommunityRail() {
    if (!dom.communityRailList) {
        return;
    }

    dom.communityRailList.innerHTML =
        state.communities
            .map(
                (community) => {

                    const active =
                        state.currentCommunity &&
                        state.currentCommunity.id ===
                        community.id;

                    return `
                        <button
                            class="rail-community-button ${active ? "active" : ""}"
                            type="button"
                            data-community-id="${escapeAttribute(community.id)}"
                            title="${escapeAttribute(community.name)}"
                        >
                            ${escapeHTML(
                                communityIcon(community)
                            )}
                        </button>
                    `;
                }
            )
            .join("");
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
        .order("title", {
            ascending: true
        });

    if (error) {
        console.error(
            "Courses load failed:",
            error
        );

        state.courses = [];

        return;
    }

    state.courses =
        data || [];
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

    state.currentChannel = null;
    state.channels = [];
    state.messages = [];

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

    dom.selectedCommunityIcon.textContent =
        communityIcon(community);

    dom.selectedCommunityName.textContent =
        community.name;

    dom.selectedCommunityDescription.textContent =
        community.description ||
        "Mwaniki Scholars Community";
}

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
        .eq("community_id", communityId)
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

        showToast(
            "Unable to load channels."
        );

        return;
    }

    state.channels =
        data || [];

    await ensureMedicalCourseChannels();

    renderChannels();

    if (!state.currentChannel) {

        const general =
            state.channels.find(
                (channel) =>
                    channel.slug ===
                    "general"
            ) ||
            state.channels[0];

        if (general) {
            await selectChannel(
                general
            );
        }
    }
}

async function ensureMedicalCourseChannels() {
    const community =
        state.currentCommunity;

    if (
        !community ||
        community.slug !== "mwaniki-scholars"
    ) {
        return;
    }

    /*
     * We deliberately DO NOT auto-create channels here.
     *
     * Existing channels remain the source of truth.
     * If a course channel exists, it is rendered.
     *
     * Authorized users can create missing channels
     * through the Create Channel interface.
     */
}

function categorizeChannel(channel) {
    const name =
        String(channel.name || "")
            .toLowerCase();

    const type =
        String(channel.channel_type || "")
            .toLowerCase();

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

    state.channels.forEach(
        (channel) => {

            const group =
                categorizeChannel(channel);

            if (groups[group]) {
                groups[group].push(channel);
            } else {
                groups.community.push(channel);
            }
        }
    );

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

    dom.courseChannelCount.textContent =
        groups.courses.length
            ? `(${groups.courses.length})`
            : "";
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
            (channel) => {

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

    container.innerHTML =
        filtered.length
            ? filtered
                .map(renderChannelButton)
                .join("")
            : `
                <div class="empty-sidebar-message">
                    No channels
                </div>
            `;
}

function renderChannelButton(channel) {
    const active =
        state.currentChannel &&
        state.currentChannel.id ===
        channel.id;

    const icon =
        channel.channel_type === "voice"
            ? "🔊"
            : channel.icon ||
              "#";

    return `
        <button
            type="button"
            class="channel-item ${active ? "active" : ""}"
            data-channel-id="${escapeAttribute(channel.id)}"
        >

            <span class="channel-icon">
                ${escapeHTML(icon)}
            </span>

            <span class="channel-item-name">
                ${escapeHTML(channel.name)}
            </span>

        </button>
    `;
}


/* ============================================================
   CHANNEL SELECTION
   ============================================================ */

async function selectChannel(
    channel
) {
    if (!channel) {
        return;
    }

    state.currentChannel =
        channel;

    state.messages = [];
    state.attachments.clear();

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

    dom.currentChannelName.textContent =
        channel.name;

    dom.currentChannelDescription.textContent =
        channel.description ||
        "Mwaniki Scholars discussion";

    dom.currentChannelIcon.textContent =
        channel.channel_type === "voice"
            ? "🔊"
            : channel.icon || "#";

    dom.currentChannelType.textContent =
        channel.channel_type || "Text";

    dom.messageInput.placeholder =
        `Message #${channel.name}...`;
}

async function loadChannelMessages(
    channelId
) {
    dom.messageLoading.classList.remove(
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
        .eq("channel_id", channelId)
        .order("created_at", {
            ascending: true
        })
        .limit(CONFIG.messageLimit);

    dom.messageLoading.classList.add(
        "hidden"
    );

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
            (message) =>
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
            (message) =>
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

    (data || []).forEach(
        (attachment) => {

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
    );

    renderMessages();
}


/* ============================================================
   PROFILE LOADING FOR USERS
   ============================================================ */

async function loadProfilesForUsers(
    userIds
) {
    const ids =
        [
            ...new Set(
                userIds.filter(Boolean)
            )
        ];

    if (!ids.length) {
        return;
    }

    const missing =
        ids.filter(
            (id) =>
                !state.profiles.has(id)
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
            .in(
                "user_id",
                missing
            )
    ]);

    (profilesResult.data || [])
        .forEach(
            (profile) => {
                state.profiles.set(
                    profile.id,
                    profile
                );
            }
        );

    (studentsResult.data || [])
        .forEach(
            (student) => {

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
        );

    (membersResult.data || [])
        .forEach(
            (member) => {

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
        );
}


/* ============================================================
   RENDER MESSAGES
   ============================================================ */

function renderMessages() {
    if (!dom.messageList) {
        return;
    }

    if (!state.currentChannel) {
        dom.messageList.innerHTML = "";
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
                    Welcome to #${escapeHTML(
                        state.currentChannel.name
                    )}
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
            .map(
                renderMessage
            )
            .join("");
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

    const attachments =
        state.attachments.get(
            message.id
        ) || [];

    const deleted =
        Boolean(
            message.is_deleted
        );

    return `
        <article
            class="message-row"
            data-message-id="${escapeAttribute(message.id)}"
        >

            <img
                class="avatar avatar-message"
                src="${escapeAttribute(
                    photo ||
                    avatarFallback(name)
                )}"
                alt="${escapeAttribute(name)}"
                loading="lazy"
                onerror="this.onerror=null;this.src='${escapeAttribute(
                    avatarFallback(name)
                )}'"
            >

            <div class="message-content-wrap">

                <div class="message-meta">

                    <span class="message-author">
                        ${escapeHTML(name)}
                    </span>

                    <span class="message-time">
                        ${escapeHTML(
                            formatDateTime(
                                message.created_at
                            )
                        )}
                    </span>

                    ${
                        message.is_edited
                            ? `
                                <span class="message-edited">
                                    edited
                                </span>
                            `
                            : ""
                    }

                </div>

                <div class="message-body ${
                    deleted
                        ? "deleted-message"
                        : ""
                }">

                    ${
                        deleted
                            ? "This message was deleted."
                            : renderMessageContent(
                                message.content
                            )
                    }

                </div>

                ${
                    !deleted &&
                    attachments.length
                        ? `
                            <div class="message-attachments">
                                ${attachments
                                    .map(
                                        renderAttachment
                                    )
                                    .join("")}
                            </div>
                        `
                        : ""
                }

            </div>

            ${
                !deleted
                    ? `
                        <div class="message-actions">

                            <button
                                type="button"
                                data-message-action="reply"
                                data-message-id="${escapeAttribute(message.id)}"
                                title="Reply"
                            >
                                ↩
                            </button>

                            <button
                                type="button"
                                data-message-action="react"
                                data-message-id="${escapeAttribute(message.id)}"
                                title="React"
                            >
                                😊
                            </button>

                            ${
                                message.user_id ===
                                state.user?.id
                                    ? `
                                        <button
                                            type="button"
                                            data-message-action="edit"
                                            data-message-id="${escapeAttribute(message.id)}"
                                            title="Edit"
                                        >
                                            ✎
                                        </button>

                                        <button
                                            type="button"
                                            data-message-action="delete"
                                            data-message-id="${escapeAttribute(message.id)}"
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

        </article>
    `;
}

function renderMessageContent(
    content
) {
    if (!content) {
        return "";
    }

    let text =
        escapeHTML(content);

    text =
        text.replace(
            /https?:\/\/[^\s<]+/g,
            (url) => {

                const safe =
                    safeURL(url);

                if (!safe) {
                    return url;
                }

                return `
                    <a
                        href="${escapeAttribute(safe)}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        ${escapeHTML(url)}
                    </a>
                `;
            }
        );

    text =
        text.replace(
            /\n/g,
            "<br>"
        );

    return text;
}

function renderAttachment(
    attachment
) {
    const mime =
        String(
            attachment.mime_type || ""
        ).toLowerCase();

    const url =
        safeURL(
            attachment.file_url
        );

    const isImage =
        mime.startsWith("image/");

    const isAudio =
        mime.startsWith("audio/") ||
        mime === "application/ogg";

    if (isImage && url) {
        return `
            <div class="attachment-card">

                <img
                    class="attachment-image"
                    src="${escapeAttribute(url)}"
                    alt="${escapeAttribute(
                        attachment.file_name
                    )}"
                    loading="lazy"
                >

            </div>
        `;
    }

    if (isAudio && url) {
        return `
            <div class="attachment-card voice-attachment">

                <div class="attachment-info">

                    <strong>
                        🎙 ${escapeHTML(
                            attachment.file_name
                        )}
                    </strong>

                    <audio
                        controls
                        preload="metadata"
                        src="${escapeAttribute(url)}"
                    ></audio>

                </div>

            </div>
        `;
    }

    return `
        <div class="attachment-card">

            <span class="attachment-file-icon">
                📎
            </span>

            <div class="attachment-info">

                <strong>
                    ${escapeHTML(
                        attachment.file_name
                    )}
                </strong>

                <span>
                    ${escapeHTML(
                        formatBytes(
                            attachment.file_size
                        )
                    )}
                </span>

                ${
                    url
                        ? `
                            <a
                                class="attachment-download"
                                href="${escapeAttribute(url)}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Open file
                            </a>
                        `
                        : ""
                }

            </div>

        </div>
    `;
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
        .eq("community_id", communityId)
        .eq("is_banned", false)
        .order("display_name", {
            ascending: true
        });

    if (error) {
        console.error(
            "Member load failed:",
            error
        );

        return;
    }

    state.members =
        data || [];

    await loadProfilesForUsers(
        state.members.map(
            (member) =>
                member.user_id
        )
    );

    await loadPresenceForMembers();

    renderMemberList();
}

async function loadChannelMembers() {
    if (!state.currentCommunity) {
        return;
    }

    await loadCommunityMembers(
        state.currentCommunity.id
    );
}

async function loadPresenceForMembers() {
    const ids =
        [
            ...new Set(
                state.members
                    .map(
                        (member) =>
                            member.user_id
                    )
                    .filter(Boolean)
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
        .select(
            "user_id,status,custom_status,last_seen_at,updated_at"
        )
        .in(
            "user_id",
            ids
        );

    if (error) {
        console.warn(
            "Presence member load failed:",
            error.message
        );

        return;
    }

    state.presences.clear();

    (data || []).forEach(
        (row) => {
            state.presences.set(
                row.user_id,
                row
            );
        }
    );
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
        state.members
            .filter(
                (member) => {

                    const name =
                        profileName(
                            member.user_id
                        ).toLowerCase();

                    return (
                        !search ||
                        name.includes(search)
                    );
                }
            )
            .map(
                (member) => ({
                    member,
                    status:
                        effectivePresence(
                            member.user_id,
                            state.presences.get(
                                member.user_id
                            )
                        )
                })
            )
            .sort(
                (a, b) => {

                    const order = {
                        online: 0,
                        dnd: 1,
                        away: 2,
                        offline: 3
                    };

                    if (
                        order[a.status] !==
                        order[b.status]
                    ) {
                        return (
                            order[a.status] -
                            order[b.status]
                        );
                    }

                    return profileName(
                        a.member.user_id
                    ).localeCompare(
                        profileName(
                            b.member.user_id
                        )
                    );
                }
            );

    dom.memberCount.textContent =
        state.members.length;

    dom.channelMemberCount.textContent =
        state.members.length;

    const groups = {
        online: [],
        away: [],
        offline: []
    };

    members.forEach(
        (item) => {

            if (
                item.status === "online" ||
                item.status === "dnd"
            ) {
                groups.online.push(item);
            } else if (
                item.status === "away"
            ) {
                groups.away.push(item);
            } else {
                groups.offline.push(item);
            }
        }
    );

    let html = "";

    if (groups.online.length) {
        html += `
            <div class="member-section-label">
                ONLINE — ${groups.online.length}
            </div>
        `;

        html += groups.online
            .map(
                renderMemberItem
            )
            .join("");
    }

    if (groups.away.length) {
        html += `
            <div class="member-section-label">
                AWAY — ${groups.away.length}
            </div>
        `;

        html += groups.away
            .map(
                renderMemberItem
            )
            .join("");
    }

    if (groups.offline.length) {
        html += `
            <div class="member-section-label">
                OFFLINE — ${groups.offline.length}
            </div>
        `;

        html += groups.offline
            .map(
                renderMemberItem
            )
            .join("");
    }

    dom.memberList.innerHTML =
        html ||
        `
            <div class="empty-sidebar-message">
                No members found.
            </div>
        `;
}

function renderMemberItem(
    item
) {
    const member =
        item.member;

    const userId =
        member.user_id;

    const name =
        profileName(userId);

    const photo =
        profilePhoto(userId);

    const status =
        item.status;

    return `
        <button
            class="member-item"
            type="button"
            data-member-user-id="${escapeAttribute(userId)}"
        >

            <span class="avatar-wrap">

                <img
                    class="avatar avatar-member"
                    src="${escapeAttribute(
                        photo ||
                        avatarFallback(name)
                    )}"
                    alt="${escapeAttribute(name)}"
                    loading="lazy"
                    onerror="this.onerror=null;this.src='${escapeAttribute(
                        avatarFallback(name)
                    )}'"
                >

                <span
                    class="presence-dot presence-${escapeAttribute(status)}"
                ></span>

            </span>

            <span class="member-copy">

                <span class="member-name-row">

                    <span class="member-name">
                        ${escapeHTML(name)}
                    </span>

                </span>

                <span class="member-status">
                    ${escapeHTML(
                        statusLabel(status)
                    )}
                </span>

                ${
                    member.role
                        ? `
                            <span class="member-role">
                                ${escapeHTML(
                                    member.role
                                )}
                            </span>
                        `
                        : ""
                }

            </span>

        </button>
    `;
}


/* ============================================================
   MESSAGE SEND
   ============================================================ */

async function sendMessage(
    content = null,
    files = []
) {
    if (!state.user) {
        showToast(
            "You must be signed in."
        );
        return;
    }

    if (!state.currentChannel) {
        showToast(
            "Select a channel first."
        );
        return;
    }

    const text =
        content !== null
            ? content
            : dom.messageInput.value.trim();

    if (
        !text &&
        !files.length
    ) {
        return;
    }

    const {
        data: inserted,
        error
    } = await supabase
        .from("chat_messages")
        .insert({
            channel_id:
                state.currentChannel.id,

            user_id:
                state.user.id,

            content:
                text || null,

            message_type:
                files.length
                    ? "attachment"
                    : "text"
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

        return;
    }

    if (files.length) {

        const uploadResult =
            await uploadAttachments(
                inserted.id,
                files
            );

        if (
            uploadResult.failed > 0
        ) {
            showToast(
                `${uploadResult.failed} attachment(s) failed.`
            );
        }
    }

    dom.messageInput.value = "";

    updateComposerHeight();
    updateCharacterCount();

    state.selectedFiles = [];

    renderAttachmentPreview();

    await loadChannelMessages(
        state.currentChannel.id
    );

    await loadChannelAttachments();

    scrollMessagesToBottom();
}

async function uploadAttachments(
    messageId,
    files
) {
    let uploaded = 0;
    let failed = 0;

    const bucket =
        await getStorageBucket();

    if (!bucket) {
        return {
            uploaded: 0,
            failed: files.length
        };
    }

    for (const file of files) {

        try {

            if (
                file.size >
                CONFIG.maxAttachmentSize
            ) {
                failed++;
                continue;
            }

            const extension =
                getExtension(file.name);

            const safeName =
                slugify(
                    file.name
                        .replace(
                            /\.[^/.]+$/,
                            ""
                        )
                ) ||
                "file";

            const path =
                `community/${state.user.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}${extension}`;

            const {
                data: uploadData,
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
                console.error(
                    "Storage upload failed:",
                    uploadError
                );

                failed++;
                continue;
            }

            let fileURL = "";

            const publicResult =
                supabase
                    .storage
                    .from(bucket)
                    .getPublicUrl(
                        uploadData.path
                    );

            fileURL =
                publicResult?.data?.publicUrl ||
                "";

            /*
             * If the bucket is private, file_url may remain empty.
             * The database still contains file_path and the UI will
             * not invent a URL.
             */

            const {
                error: attachmentError
            } = await supabase
                .from("chat_attachments")
                .insert({
                    message_id:
                        messageId,

                    uploaded_by:
                        state.user.id,

                    file_name:
                        file.name,

                    file_path:
                        uploadData.path,

                    file_url:
                        fileURL || null,

                    mime_type:
                        file.type ||
                        null,

                    file_size:
                        file.size
                });

            if (attachmentError) {
                console.error(
                    "Attachment record failed:",
                    attachmentError
                );

                failed++;
                continue;
            }

            uploaded++;

        } catch (error) {

            console.error(
                "Attachment exception:",
                error
            );

            failed++;
        }
    }

    return {
        uploaded,
        failed
    };
}

function getExtension(
    fileName
) {
    const match =
        String(fileName)
            .match(
                /(\.[^./\\]+)$/
            );

    return match
        ? match[1]
        : "";
}

async function getStorageBucket() {
    if (state.storageBucket) {
        return state.storageBucket;
    }

    try {

        const {
            data,
            error
        } =
            await supabase
                .storage
                .listBuckets();

        if (error) {
            console.warn(
                "Storage bucket discovery failed:",
                error.message
            );

            return null;
        }

        const buckets =
            data || [];

        if (!buckets.length) {
            showToast(
                "No Supabase Storage bucket is available."
            );

            return null;
        }

        const preferredNames = [
            "chat-attachments",
            "chat_attachments",
            "community",
            "community-files",
            "attachments",
            "files"
        ];

        const preferred =
            preferredNames.find(
                (name) =>
                    buckets.some(
                        (bucket) =>
                            bucket.name === name
                    )
            );

        state.storageBucket =
            preferred ||
            buckets[0].name;

        return state.storageBucket;

    } catch (error) {

        console.error(
            "Storage discovery error:",
            error
        );

        return null;
    }
}


/* ============================================================
   ATTACHMENT UI
   ============================================================ */

function renderAttachmentPreview() {
    if (
        !dom.attachmentPreview
    ) {
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
                                file.type?.startsWith(
                                    "image/"
                                )
                                    ? "🖼"
                                    : file.type?.startsWith(
                                        "audio/"
                                    )
                                        ? "🎙"
                                        : "📎"
                            }
                        </span>

                        <span class="pending-file-name">
                            ${escapeHTML(
                                file.name
                            )}
                        </span>

                        <button
                            class="pending-file-remove"
                            type="button"
                            data-remove-file="${index}"
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

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {
        showToast(
            "Voice recording is not supported by this browser."
        );
        return;
    }

    try {

        const stream =
            await navigator.mediaDevices.getUserMedia({
                audio: true
            });

        const preferred =
            MediaRecorder.isTypeSupported(
                "audio/webm;codecs=opus"
            )
                ? "audio/webm;codecs=opus"
                : "audio/webm";

        const recorder =
            new MediaRecorder(
                stream,
                {
                    mimeType:
                        preferred
                }
            );

        state.mediaRecorder =
            recorder;

        state.voiceChunks = [];

        state.recording = true;

        state.voiceStartedAt =
            Date.now();

        recorder.ondataavailable =
            (event) => {

                if (
                    event.data &&
                    event.data.size
                ) {
                    state.voiceChunks.push(
                        event.data
                    );
                }
            };

        recorder.onstop =
            async () => {

                stream
                    .getTracks()
                    .forEach(
                        (track) =>
                            track.stop()
                    );

                state.recording = false;

                const blob =
                    new Blob(
                        state.voiceChunks,
                        {
                            type:
                                recorder.mimeType ||
                                "audio/webm"
                        }
                    );

                state.voiceChunks = [];

                if (!blob.size) {
                    return;
                }

                if (
                    blob.size >
                    CONFIG.maxAttachmentSize
                ) {
                    showToast(
                        "Voice note is too large."
                    );
                    return;
                }

                const file =
                    new File(
                        [
                            blob
                        ],
                        `voice-note-${Date.now()}.webm`,
                        {
                            type:
                                blob.type ||
                                "audio/webm"
                        }
                    );

                await sendMessage(
                    null,
                    [
                        file
                    ]
                );
            };

        recorder.start();

        showToast(
            "Recording voice note… click 🎙 again to send."
        );

        setTimeout(
            () => {

                if (
                    state.recording &&
                    Date.now() -
                    state.voiceStartedAt >=
                    CONFIG.maxVoiceNoteMs
                ) {
                    stopVoiceRecording();
                }

            },
            CONFIG.maxVoiceNoteMs
        );

    } catch (error) {

        console.error(
            "Voice recording failed:",
            error
        );

        showToast(
            "Microphone permission was not granted."
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
}


/* ============================================================
   REACTIONS
   ============================================================ */

async function toggleReaction(
    messageId,
    reaction = "👍"
) {
    if (!state.user) {
        return;
    }

    const {
        data: existing,
        error: findError
    } = await supabase
        .from("chat_message_reactions")
        .select(
            "id,message_id,user_id,reaction"
        )
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

    if (findError) {
        console.warn(
            "Reaction lookup failed:",
            findError.message
        );
        return;
    }

    if (existing) {

        const {
            error
        } = await supabase
            .from("chat_message_reactions")
            .delete()
            .eq(
                "id",
                existing.id
            );

        if (error) {
            showToast(
                "Unable to remove reaction."
            );
        }

        return;
    }

    const {
        error
    } = await supabase
        .from("chat_message_reactions")
        .insert({
            message_id:
                messageId,

            user_id:
                state.user.id,

            reaction,

            reaction_unicode:
                reaction
        });

    if (error) {
        showToast(
            "Unable to add reaction."
        );
    }
}


/* ============================================================
   EDIT / DELETE
   ============================================================ */

async function editMessage(
    messageId
) {
    const message =
        state.messages.find(
            (item) =>
                item.id ===
                messageId
        );

    if (!message) {
        return;
    }

    const next =
        window.prompt(
            "Edit your message:",
            message.content || ""
        );

    if (
        next === null
    ) {
        return;
    }

    const text =
        next.trim();

    if (!text) {
        return;
    }

    const {
        error
    } = await supabase
        .from("chat_messages")
        .update({
            content: text,
            is_edited: true,
            edited_at:
                new Date().toISOString(),
            updated_at:
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
        console.error(
            "Edit failed:",
            error
        );

        showToast(
            error.message ||
            "Unable to edit message."
        );

        return;
    }

    await loadChannelMessages(
        state.currentChannel.id
    );
}

async function deleteMessage(
    messageId
) {
    const confirmed =
        window.confirm(
            "Delete this message?"
        );

    if (!confirmed) {
        return;
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
            updated_at:
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

    await loadChannelMessages(
        state.currentChannel.id
    );
}


/* ============================================================
   EMOJI / STICKERS / GIF
   ============================================================ */

function renderEmojiPicker() {
    const categories = [
        ["🙂", "Faces"],
        ["👍", "Reactions"],
        ["🩺", "Medical"],
        ["🎓", "Campus"]
    ];

    dom.emojiCategories.innerHTML =
        categories
            .map(
                ([icon, name], index) => `
                    <button
                        type="button"
                        class="${index === 0 ? "active" : ""}"
                        data-emoji-category="${escapeAttribute(name)}"
                    >
                        ${icon}
                    </button>
                `
            )
            .join("");

    renderEmojiGrid(
        CONFIG.emoji
    );
}

function renderEmojiGrid(
    emojis
) {
    dom.emojiGrid.innerHTML =
        emojis
            .map(
                (emoji) => `
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
    dom.stickerGrid.innerHTML =
        CONFIG.stickers
            .map(
                (sticker) => `
                    <button
                        type="button"
                        class="sticker-item"
                        data-sticker="${escapeAttribute(sticker)}"
                    >
                        ${sticker}
                    </button>
                `
            )
            .join("");
}

function renderGifPanel() {
    const items = [
        "MED STUDY",
        "GOOD JOB",
        "LOL",
        "BRAVO",
        "EXAM MODE",
        "CLINICAL",
        "LAB LIFE",
        "PHARMACY"
    ];

    dom.gifGrid.innerHTML =
        items
            .map(
                (item) => `
                    <button
                        type="button"
                        class="gif-item"
                        data-gif="${escapeAttribute(item)}"
                    >
                        GIF · ${escapeHTML(item)}
                    </button>
                `
            )
            .join("");
}

function closeComposerPanels() {
    dom.emojiPanel.classList.add(
        "hidden"
    );

    dom.stickerPanel.classList.add(
        "hidden"
    );

    dom.gifPanel.classList.add(
        "hidden"
    );
}


/* ============================================================
   CONTESTS
   ============================================================ */

async function renderVirtualContests() {
    dom.selectedCommunityIcon.textContent =
        "🏆";

    dom.selectedCommunityName.textContent =
        "Contests";

    dom.selectedCommunityDescription.textContent =
        "Academic competitions using real courses.";

    dom.informationChannels.innerHTML = "";
    dom.generalChannels.innerHTML = "";
    dom.studyChannels.innerHTML = "";
    dom.courseChannels.innerHTML = "";
    dom.communityChannels.innerHTML = "";
    dom.voiceChannels.innerHTML = "";

    dom.generalChannels.innerHTML = `
        <button
            class="channel-item active"
            type="button"
            data-contest-view="active"
        >
            <span class="channel-icon">🏆</span>
            <span class="channel-item-name">
                Active Contests
            </span>
        </button>

        <button
            class="channel-item"
            type="button"
            data-contest-view="upcoming"
        >
            <span class="channel-icon">📅</span>
            <span class="channel-item-name">
                Upcoming
            </span>
        </button>

        <button
            class="channel-item"
            type="button"
            data-contest-view="leaderboards"
        >
            <span class="channel-icon">📊</span>
            <span class="channel-item-name">
                Leaderboards
            </span>
        </button>

        <button
            class="channel-item"
            type="button"
            data-contest-view="history"
        >
            <span class="channel-icon">🕘</span>
            <span class="channel-item-name">
                History
            </span>
        </button>
    `;

    dom.currentChannelName.textContent =
        "Active Contests";

    dom.currentChannelDescription.textContent =
        "Choose a real Mwaniki Scholars course.";

    dom.currentChannelIcon.textContent =
        "🏆";

    dom.currentChannelType.textContent =
        "Contest";

    await populateContestCourses();

    renderContestLanding();
}

async function populateContestCourses() {
    dom.contestCourseSelector.innerHTML =
        `
            <option value="">
                Select a course
            </option>
        ` +
        state.courses
            .map(
                (course) => `
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
}

async function loadContestQuestions(
    courseId
) {
    if (!courseId) {
        return;
    }

    const {
        data,
        error
    } = await supabase
        .from("quizzes")
        .select(`
            id,
            course_id,
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
            "Contest quiz load failed:",
            error
        );

        showToast(
            "Unable to load contest questions."
        );

        return;
    }

    state.currentContestQuestions =
        data || [];

    state.currentContestIndex = 0;

    renderContestQuestion();
}

function renderContestLanding() {
    dom.messageList.innerHTML = `
        <div class="channel-welcome">

            <div class="channel-welcome-icon">
                🏆
            </div>

            <h2>
                Mwaniki Scholars Contests
            </h2>

            <p>
                Choose a real course from your dashboard
                and use its existing quiz questions.
                No duplicate course or quiz database is created.
            </p>

        </div>
    `;
}

function renderContestQuestion() {
    const questions =
        state.currentContestQuestions;

    if (!questions.length) {
        dom.contestQuestionArea.innerHTML = `
            <p>
                No quiz questions were found for this course.
            </p>
        `;

        return;
    }

    const question =
        questions[
            state.currentContestIndex
        ];

    dom.contestCourseName.textContent =
        question.course ||
        "Selected Course";

    dom.contestQuestionArea.innerHTML = `
        <div class="contest-question">

            <strong>
                Question ${
                    state.currentContestIndex + 1
                } of ${questions.length}
            </strong>

            <p>
                ${escapeHTML(
                    question.question
                )}
            </p>

            <div class="contest-options">

                ${renderContestOption(
                    "A",
                    question.option_a
                )}

                ${renderContestOption(
                    "B",
                    question.option_b
                )}

                ${renderContestOption(
                    "C",
                    question.option_c
                )}

                ${renderContestOption(
                    "D",
                    question.option_d
                )}

            </div>

        </div>
    `;
}

function renderContestOption(
    letter,
    value
) {
    if (!value) {
        return "";
    }

    return `
        <button
            type="button"
            class="contest-option"
            data-contest-answer="${escapeAttribute(letter)}"
        >
            <strong>${letter}</strong>
            <span>${escapeHTML(value)}</span>
        </button>
    `;
}


/* ============================================================
   CALL PICKER
   ============================================================ */

function openCallPicker(
    mode = "general"
) {
    state.callSelectedUsers.clear();

    renderCallMemberPicker();

    dom.callPickerModal.dataset.callMode =
        mode;

    openModal(
        dom.callPickerModal
    );
}

function renderCallMemberPicker() {
    const search =
        String(
            dom.callMemberSearch?.value ||
            ""
        )
            .trim()
            .toLowerCase();

    const members =
        state.members
            .filter(
                (member) =>
                    member.user_id !==
                    state.user?.id
            )
            .filter(
                (member) => {

                    const status =
                        effectivePresence(
                            member.user_id,
                            state.presences.get(
                                member.user_id
                            )
                        );

                    return (
                        status !==
                        "offline"
                    );
                }
            )
            .filter(
                (member) => {

                    const name =
                        profileName(
                            member.user_id
                        ).toLowerCase();

                    return (
                        !search ||
                        name.includes(search)
                    );
                }
            );

    dom.callMemberList.innerHTML =
        members.length
            ? members
                .map(
                    renderCallMember
                )
                .join("")
            : `
                <div class="empty-sidebar-message">
                    No online members found.
                </div>
            `;

    updateSelectedCallCount();
}

function renderCallMember(
    member
) {
    const userId =
        member.user_id;

    const selected =
        state.callSelectedUsers.has(
            userId
        );

    const name =
        profileName(userId);

    const status =
        effectivePresence(
            userId,
            state.presences.get(
                userId
            )
        );

    return `
        <label
            class="call-member ${selected ? "selected" : ""}"
        >

            <input
                type="checkbox"
                data-call-user="${escapeAttribute(userId)}"
                ${selected ? "checked" : ""}
            >

            <span class="avatar-wrap">

                <img
                    class="avatar avatar-member"
                    src="${escapeAttribute(
                        profilePhoto(userId) ||
                        avatarFallback(name)
                    )}"
                    alt="${escapeAttribute(name)}"
                    onerror="this.onerror=null;this.src='${escapeAttribute(
                        avatarFallback(name)
                    )}'"
                >

                <span
                    class="presence-dot presence-${escapeAttribute(status)}"
                ></span>

            </span>

            <span class="call-member-copy">

                <strong>
                    ${escapeHTML(name)}
                </strong>

                <span>
                    ${escapeHTML(
                        statusLabel(status)
                    )}
                </span>

            </span>

        </label>
    `;
}

function updateSelectedCallCount() {
    dom.selectedCallMemberCount.textContent =
        `${state.callSelectedUsers.size} selected`;
}

async function startSelectedCall() {
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

    const mode =
        dom.callPickerModal.dataset.callMode ||
        "general";

    closeModal(
        dom.callPickerModal
    );

    const params =
        new URLSearchParams();

    params.set(
        "mode",
        mode
    );

    params.set(
        "community_id",
        state.currentCommunity?.id || ""
    );

    params.set(
        "community_name",
        state.currentCommunity?.name || ""
    );

    params.set(
        "channel_id",
        state.currentChannel?.id || ""
    );

    params.set(
        "targets",
        selected.join(",")
    );

    params.set(
        "call_type",
        "video"
    );

    window.open(
        `./community-call.html?${params.toString()}`,
        "mwanikiScholarCall",
        "width=1100,height=760,resizable=yes,scrollbars=yes"
    );
}


/* ============================================================
   VOICE CHANNEL
   ============================================================ */

function openCommunityVoiceChannel() {
    if (!state.currentChannel) {
        return;
    }

    const params =
        new URLSearchParams();

    params.set(
        "mode",
        "community"
    );

    params.set(
        "community_id",
        state.currentCommunity.id
    );

    params.set(
        "community_name",
        state.currentCommunity.name
    );

    params.set(
        "channel_id",
        state.currentChannel.id
    );

    params.set(
        "channel_name",
        state.currentChannel.name
    );

    params.set(
        "targets",
        ""
    );

    params.set(
        "call_type",
        "video"
    );

    window.open(
        `./community-call.html?${params.toString()}`,
        "mwanikiCommunityVoice",
        "width=1100,height=760,resizable=yes,scrollbars=yes"
    );
}


/* ============================================================
   COMMUNITY CALL
   ============================================================ */

function startCommunityCall() {
    if (
        !state.currentCommunity ||
        state.currentCommunity.isVirtual
    ) {
        openCallPicker("general");
        return;
    }

    openCallPicker("community");
}

function startGeneralCall() {
    openCallPicker("general");
}


/* ============================================================
   CREATE CHANNEL
   ============================================================ */

function canManageCommunity() {
    const member =
        state.members.find(
            (item) =>
                item.user_id ===
                state.user?.id
        );

    if (!member) {
        return false;
    }

    return [
        "admin",
        "super_admin",
        "moderator",
        "tutor"
    ].includes(
        String(
            member.role || ""
        ).toLowerCase()
    );
}

function openCreateChannel(
    category = "community"
) {
    if (
        !canManageCommunity()
    ) {
        showToast(
            "Only authorized community roles can create channels."
        );
        return;
    }

    dom.createChannelModal.dataset.category =
        category;

    openModal(
        dom.createChannelModal
    );
}

async function createChannel(
    event
) {
    event.preventDefault();

    if (
        !state.currentCommunity ||
        state.currentCommunity.isVirtual
    ) {
        showToast(
            "This community is virtual and cannot contain database channels."
        );
        return;
    }

    if (
        !canManageCommunity()
    ) {
        showToast(
            "You do not have permission to create channels."
        );
        return;
    }

    const name =
        $("newChannelName")
            .value
            .trim();

    const description =
        $("newChannelDescription")
            .value
            .trim();

    const channelType =
        $("newChannelType")
            .value;

    const isPrivate =
        $("newChannelPrivate")
            .checked;

    if (!name) {
        return;
    }

    const slug =
        slugify(name);

    const maxPosition =
        state.channels.reduce(
            (max, channel) =>
                Math.max(
                    max,
                    Number(
                        channel.position ||
                        0
                    )
                ),
            0
        );

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
                description || null,

            channel_type:
                channelType,

            icon:
                channelType === "voice"
                    ? "🔊"
                    : "#",

            position:
                maxPosition + 1,

            is_private:
                isPrivate,

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
            "Channel creation failed:",
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

    dom.createChannelForm.reset();

    state.channels.push(
        data
    );

    renderChannels();

    showToast(
        `#${name} created.`
    );
}


/* ============================================================
   FRIENDS
   ============================================================ */

async function renderFriends(
    tab = "online"
) {
    if (!state.currentCommunity) {
        return;
    }

    if (
        tab === "requests"
    ) {
        dom.friendsContent.innerHTML = `
            <div class="empty-sidebar-message">
                Friend requests are handled through the
                existing friend-request system.
            </div>
        `;

        return;
    }

    const members =
        state.members
            .filter(
                (member) => {

                    if (
                        tab === "all"
                    ) {
                        return true;
                    }

                    return (
                        effectivePresence(
                            member.user_id,
                            state.presences.get(
                                member.user_id
                            )
                        ) !== "offline"
                    );
                }
            );

    dom.friendsContent.innerHTML =
        members.length
            ? members
                .map(
                    (member) => {

                        const userId =
                            member.user_id;

                        const name =
                            profileName(
                                userId
                            );

                        const status =
                            effectivePresence(
                                userId,
                                state.presences.get(
                                    userId
                                )
                            );

                        return `
                            <div class="friend-item">

                                <span class="avatar-wrap">

                                    <img
                                        class="avatar avatar-member"
                                        src="${escapeAttribute(
                                            profilePhoto(userId) ||
                                            avatarFallback(name)
                                        )}"
                                        alt="${escapeAttribute(name)}"
                                    >

                                    <span
                                        class="presence-dot presence-${escapeAttribute(status)}"
                                    ></span>

                                </span>

                                <div class="friend-item-copy">

                                    <strong>
                                        ${escapeHTML(name)}
                                    </strong>

                                    <span>
                                        ${escapeHTML(
                                            statusLabel(status)
                                        )}
                                    </span>

                                </div>

                                ${
                                    userId !==
                                    state.user?.id
                                        ? `
                                            <button
                                                type="button"
                                                class="secondary-button"
                                                data-friend-call="${escapeAttribute(userId)}"
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
                <div class="empty-sidebar-message">
                    No members found.
                </div>
            `;
}


/* ============================================================
   PROFILE MODAL
   ============================================================ */

function renderProfileModal() {
    const userId =
        state.user?.id;

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

    dom.profileModalContent.innerHTML = `
        <div class="profile-hero">

            <img
                src="${escapeAttribute(
                    photo ||
                    avatarFallback(name)
                )}"
                alt="${escapeAttribute(name)}"
            >

            <div class="profile-hero-copy">

                <strong>
                    ${escapeHTML(name)}
                </strong>

                <span>
                    ${escapeHTML(
                        state.user?.email || ""
                    )}
                </span>

            </div>

        </div>

        <div class="status-options">

            ${[
                ["online", "🟢 Online"],
                ["away", "🟡 Away"],
                ["dnd", "🔴 Do Not Disturb"],
                ["offline", "⚫ Offline"]
            ]
                .map(
                    ([value, label]) => `
                        <button
                            type="button"
                            class="status-option ${
                                status === value
                                    ? "active"
                                    : ""
                            }"
                            data-set-status="${value}"
                        >
                            ${label}
                        </button>
                    `
                )
                .join("")}

        </div>
    `;
}


/* ============================================================
   REALTIME
   ============================================================ */

function removeRealtimeSubscriptions() {
    state.realtimeChannels.forEach(
        (channel) => {
            try {
                supabase.removeChannel(
                    channel
                );
            } catch {
                /* Ignore cleanup failures. */
            }
        }
    );

    state.realtimeChannels = [];
}

function subscribeToCommunity(
    communityId
) {
    /*
     * We keep the channel subscription broad enough to catch
     * member/presence changes and call-related notifications.
     */

    const channel =
        supabase
            .channel(
                `community-${communityId}`
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_presence"
                },
                async () => {

                    await loadPresenceForMembers();

                    renderMemberList();

                    updateCurrentUserPresenceUI();
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

                    await loadCommunityMembers(
                        communityId
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
                `channel-${channelId}`
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
                async (payload) => {

                    const message =
                        payload.new;

                    if (
                        state.messages.some(
                            (item) =>
                                item.id ===
                                message.id
                        )
                    ) {
                        return;
                    }

                    state.messages.push(
                        message
                    );

                    await loadProfilesForUsers(
                        [
                            message.user_id
                        ]
                    );

                    renderMessages();

                    await loadChannelAttachments();

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
                        `channel_id=eq.${channelId}`
                },
                async () => {

                    await loadChannelMessages(
                        channelId
                    );

                    await loadChannelAttachments();
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
                async () => {

                    await loadChannelMessages(
                        channelId
                    );

                    await loadChannelAttachments();
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

                    await loadChannelAttachments();
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_message_reactions"
                },
                () => {
                    /* Reactions are persisted; no message reload
                       is required for the current lightweight UI. */
                }
            )
            .subscribe();

    state.realtimeChannels.push(
        channel
    );
}


/* ============================================================
   SCROLL
   ============================================================ */

function scrollMessagesToBottom() {
    requestAnimationFrame(
        () => {
            dom.messageList.scrollTop =
                dom.messageList.scrollHeight;
        }
    );
}


/* ============================================================
   COMPOSER
   ============================================================ */

function updateComposerHeight() {
    const input =
        dom.messageInput;

    if (!input) {
        return;
    }

    input.style.height =
        "auto";

    input.style.height =
        `${Math.min(
            input.scrollHeight,
            160
        )}px`;
}

function updateCharacterCount() {
    if (!dom.messageCharacterCount) {
        return;
    }

    dom.messageCharacterCount.textContent =
        `${dom.messageInput.value.length} / 5000`;
}

function handleComposerKeydown(
    event
) {
    if (
        event.key === "Enter" &&
        !event.shiftKey
    ) {
        event.preventDefault();

        sendMessage();

        return;
    }

    if (
        event.key === "Escape"
    ) {
        closeComposerPanels();
    }
}


/* ============================================================
   FILE SELECTION
   ============================================================ */

function handleFilesSelected(
    files
) {
    const list =
        Array.from(files || []);

    if (!list.length) {
        return;
    }

    const valid =
        list.filter(
            (file) => {

                if (
                    file.size >
                    CONFIG.maxAttachmentSize
                ) {
                    showToast(
                        `${file.name} is larger than 25 MB.`
                    );

                    return false;
                }

                return true;
            }
        );

    state.selectedFiles.push(
        ...valid
    );

    renderAttachmentPreview();

    dom.attachmentInput.value = "";
}


/* ============================================================
   EVENT BINDING
   ============================================================ */

function bindEvents() {

    /* Community rail */

    dom.communityRailList.addEventListener(
        "click",
        async (event) => {

            const button =
                event.target.closest(
                    "[data-community-id]"
                );

            if (!button) {
                return;
            }

            const community =
                state.communities.find(
                    (item) =>
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


    /* Channel list */

    [
        dom.informationChannels,
        dom.generalChannels,
        dom.studyChannels,
        dom.courseChannels,
        dom.communityChannels,
        dom.voiceChannels
    ].forEach(
        (container) => {

            container.addEventListener(
                "click",
                async (event) => {

                    const button =
                        event.target.closest(
                            "[data-channel-id]"
                        );

                    if (!button) {
                        return;
                    }

                    const channel =
                        state.channels.find(
                            (item) =>
                                String(
                                    item.id
                                ) ===
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
        }
    );


    /* Channel search */

    dom.channelSearchInput.addEventListener(
        "input",
        renderChannels
    );


    /* Send */

    dom.sendMessageButton.addEventListener(
        "click",
        () => sendMessage()
    );


    /* Composer */

    dom.messageInput.addEventListener(
        "input",
        () => {

            updateComposerHeight();

            updateCharacterCount();

            registerTyping();
        }
    );

    dom.messageInput.addEventListener(
        "keydown",
        handleComposerKeydown
    );


    /* Attachment */

    $("attachButton").addEventListener(
        "click",
        () =>
            dom.attachmentInput.click()
    );

    dom.attachmentInput.addEventListener(
        "change",
        (event) =>
            handleFilesSelected(
                event.target.files
            )
    );

    dom.attachmentPreview.addEventListener(
        "click",
        (event) => {

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

    $("emojiButton").addEventListener(
        "click",
        () => {

            dom.stickerPanel.classList.add(
                "hidden"
            );

            dom.gifPanel.classList.add(
                "hidden"
            );

            dom.emojiPanel.classList.toggle(
                "hidden"
            );
        }
    );

    $("closeEmojiButton").addEventListener(
        "click",
        () =>
            dom.emojiPanel.classList.add(
                "hidden"
            )
    );

    dom.emojiGrid.addEventListener(
        "click",
        (event) => {

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

    dom.emojiSearch.addEventListener(
        "input",
        () => {

            const term =
                dom.emojiSearch.value
                    .trim()
                    .toLowerCase();

            const filtered =
                CONFIG.emoji.filter(
                    (emoji) =>
                        !term ||
                        emoji
                            .toLowerCase()
                            .includes(term)
                );

            renderEmojiGrid(
                filtered
            );
        }
    );


    /* Stickers */

    $("stickerButton").addEventListener(
        "click",
        () => {

            dom.emojiPanel.classList.add(
                "hidden"
            );

            dom.gifPanel.classList.add(
                "hidden"
            );

            dom.stickerPanel.classList.toggle(
                "hidden"
            );
        }
    );

    $("closeStickerButton").addEventListener(
        "click",
        () =>
            dom.stickerPanel.classList.add(
                "hidden"
            )
    );

    dom.stickerGrid.addEventListener(
        "click",
        (event) => {

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
        }
    );


    /* GIF */

    $("gifButton").addEventListener(
        "click",
        () => {

            dom.emojiPanel.classList.add(
                "hidden"
            );

            dom.stickerPanel.classList.add(
                "hidden"
            );

            dom.gifPanel.classList.toggle(
                "hidden"
            );
        }
    );

    $("closeGifButton").addEventListener(
        "click",
        () =>
            dom.gifPanel.classList.add(
                "hidden"
            )
    );

    dom.gifGrid.addEventListener(
        "click",
        (event) => {

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


    /* Voice */

    $("voiceNoteButton").addEventListener(
        "click",
        toggleVoiceRecording
    );


    /* Message actions */

    dom.messageList.addEventListener(
        "click",
        async (event) => {

            const button =
                event.target.closest(
                    "[data-message-action]"
                );

            if (!button) {
                return;
            }

            const messageId =
                button.dataset.messageId;

            const action =
                button.dataset.messageAction;

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
                dom.messageInput.focus();

                const message =
                    state.messages.find(
                        (item) =>
                            item.id ===
                            messageId
                    );

                if (message) {
                    dom.messageInput.value =
                        `@${profileName(
                            message.user_id
                        )} `;
                }
            }
        }
    );


    /* Members */

    $("channelMembersButton").addEventListener(
        "click",
        () =>
            $("memberSidebar").classList.toggle(
                "mobile-open"
            )
    );

    $("closeMemberSidebarButton").addEventListener(
        "click",
        () =>
            $("memberSidebar").classList.remove(
                "mobile-open"
            )
    );

    dom.memberSearchInput.addEventListener(
        "input",
        renderMemberList
    );


    /* Mobile sidebar */

    $("mobileSidebarButton").addEventListener(
        "click",
        () =>
            $("channelSidebar").classList.toggle(
                "mobile-open"
            )
    );


    /* Community call */

    $("communityCallButton").addEventListener(
        "click",
        startCommunityCall
    );

    $("generalCallButton").addEventListener(
        "click",
        startGeneralCall
    );


    /* Call picker */

    $("closeCallPickerButton").addEventListener(
        "click",
        () =>
            closeModal(
                dom.callPickerModal
            )
    );

    $("callSelectAllButton").addEventListener(
        "click",
        () => {

            const online =
                state.members.filter(
                    (member) =>
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
                    (member) =>
                        state.callSelectedUsers.add(
                            member.user_id
                        )
                );
            }

            renderCallMemberPicker();
        }
    );

    $("startSelectedCallButton").addEventListener(
        "click",
        startSelectedCall
    );

    dom.callMemberSearch.addEventListener(
        "input",
        renderCallMemberPicker
    );

    dom.callMemberList.addEventListener(
        "change",
        (event) => {

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

    $("friendsButton").addEventListener(
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

    $("closeFriendsButton").addEventListener(
        "click",
        () =>
            closeModal(
                dom.friendsModal
            )
    );

    document
        .querySelectorAll(
            ".friends-tab"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    async () => {

                        document
                            .querySelectorAll(
                                ".friends-tab"
                            )
                            .forEach(
                                (item) =>
                                    item.classList.remove(
                                        "active"
                                    )
                            );

                        button.classList.add(
                            "active"
                        );

                        await renderFriends(
                            button.dataset.friendsTab
                        );
                    }
                );
            }
        );


    dom.friendsContent.addEventListener(
        "click",
        (event) => {

            const button =
                event.target.closest(
                    "[data-friend-call]"
                );

            if (!button) {
                return;
            }

            state.callSelectedUsers.clear();

            state.callSelectedUsers.add(
                button.dataset.friendCall
            );

            closeModal(
                dom.friendsModal
            );

            startSelectedCall();
        }
    );


    /* Profile */

    $("profileButton").addEventListener(
        "click",
        () => {

            renderProfileModal();

            openModal(
                dom.profileModal
            );
        }
    );

    $("closeProfileButton").addEventListener(
        "click",
        () =>
            closeModal(
                dom.profileModal
            )
    );

    dom.profileModalContent.addEventListener(
        "click",
        async (event) => {

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

    $("communityRulesButton")?.addEventListener(
        "click",
        () =>
            openModal(
                dom.rulesModal
            )
    );

    $("closeRulesButton").addEventListener(
        "click",
        () =>
            closeModal(
                dom.rulesModal
            )
    );


    /* File preview */

    $("closeFilePreviewButton").addEventListener(
        "click",
        () =>
            closeModal(
                dom.filePreviewModal
            )
    );

    $("cancelAttachmentButton").addEventListener(
        "click",
        () =>
            closeModal(
                dom.filePreviewModal
            )
    );


    /* Contests */

    $("closeContestButton").addEventListener(
        "click",
        () =>
            closeModal(
                dom.contestModal
            )
    );

    dom.contestCourseSelector.addEventListener(
        "change",
        async () => {

            const courseId =
                dom.contestCourseSelector
                    .value;

            if (!courseId) {
                return;
            }

            const course =
                state.courses.find(
                    (item) =>
                        String(item.id) ===
                        String(courseId)
                );

            dom.contestCourseName.textContent =
                course?.title ||
                "";

            await loadContestQuestions(
                courseId
            );
        }
    );


    /* Create channel */

    document
        .querySelectorAll(
            "[data-category-add]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () =>
                        openCreateChannel(
                            button.dataset.categoryAdd
                        )
                );
            }
        );

    $("closeCreateChannelButton").addEventListener(
        "click",
        () =>
            closeModal(
                dom.createChannelModal
            )
    );

    $("cancelCreateChannelButton").addEventListener(
        "click",
        () =>
            closeModal(
                dom.createChannelModal
            )
    );

    dom.createChannelForm.addEventListener(
        "submit",
        createChannel
    );


    /* Notifications */

    $("notificationButton").addEventListener(
        "click",
        () =>
            dom.notificationPanel.classList.toggle(
                "hidden"
            )
    );

    $("closeNotificationPanelButton").addEventListener(
        "click",
        () =>
            dom.notificationPanel.classList.add(
                "hidden"
            )
    );


    /* Global search */

    $("globalSearchInput").addEventListener(
        "keydown",
        (event) => {

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
                    (item) =>
                        item.name
                            ?.toLowerCase()
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
                    (item) =>
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


    /* Outside click for popovers */

    document.addEventListener(
        "click",
        (event) => {

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


    /* Ctrl + K */

    document.addEventListener(
        "keydown",
        (event) => {

            if (
                (event.ctrlKey ||
                    event.metaKey) &&
                event.key.toLowerCase() ===
                    "k"
            ) {
                event.preventDefault();

                $("globalSearchInput")
                    .focus();
            }
        }
    );
}


/* ============================================================
   CURSOR INSERT
   ============================================================ */

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
            start +
            value.length;

    textarea.focus();

    updateComposerHeight();
    updateCharacterCount();
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

                /*
                 * Do not make the page depend on a beforeunload
                 * database write. Presence freshness is determined
                 * by updated_at on the next client.
                 */
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
