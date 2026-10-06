/* ============================================================
   MWANIKI SCHOLARS COMMUNITY
   COMPLETE COMMUNITY ENGINE
   Supabase + Realtime
   ============================================================ */

"use strict";

/* ============================================================
   SUPABASE
   ============================================================ */

let supabase =
    window.supabaseClient ||
    window.mwanikiSupabase ||
    window.sb ||
    window.supabase ||
    null;

const SUPABASE_READY_EVENT =
    "mwaniki-supabase-ready";

async function waitForSupabase() {

    if (supabase) {
        return supabase;
    }

    const started =
        Date.now();

    while (
        !supabase &&
        Date.now() - started < 10000
    ) {

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    100
                )
        );

        supabase =
            window.supabaseClient ||
            window.mwanikiSupabase ||
            window.sb ||
            window.supabase ||
            null;
    }

    if (!supabase) {
        throw new Error(
            "Supabase client could not be loaded."
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

    presenceFresh:
        90000,

    awayAfter:
        5 * 60 * 1000,

    typingTimeout:
        2500,

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
        "community-files"
    ],

    communityIcons: {
        "mwaniki-scholars": "🎓",
        "med-rizz": "🩺",
        "mwaniki-games": "🎮",
        "mwaniki-gaming": "🎮",
        "mwaniki-memes": "😂"
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

    profiles:
        new Map(),

    presences:
        new Map(),

    typingUsers:
        new Map(),

    attachments:
        new Map(),

    realtime: [],

    heartbeat: null,

    awayTimer: null,

    typingTimer: null,

    selectedFiles: [],

    mediaRecorder: null,

    voiceStream: null,

    voiceChunks: [],

    voiceStarted: 0,

    recording: false,

    currentStatus:
        "online",

    manualStatus: false,

    messageSearch: "",

    channelSearch: "",

    memberSearch: "",

    activePicker: null,

    initialized: false

};


/* ============================================================
   DOM HELPERS
   ============================================================ */

const $ =
    id =>
        document.getElementById(id);


const dom = {

    home:
        $("communityHomeButton"),

    mobileSidebar:
        $("mobileSidebarButton"),

    communityRail:
        $("communityRail"),

    communityRailList:
        $("communityRailList"),

    addCommunity:
        $("addCommunityButton"),

    selectedCommunityIcon:
        $("selectedCommunityIcon"),

    selectedCommunityName:
        $("selectedCommunityName"),

    selectedCommunityDescription:
        $("selectedCommunityDescription"),

    communityMenu:
        $("communityMenuButton"),

    communityCall:
        $("communityCallButton"),

    channelSidebar:
        $("channelSidebar"),

    channelSearch:
        $("channelSearchInput"),

    informationChannels:
        $("informationChannels"),

    generalChannels:
        $("generalChannels"),

    studyChannels:
        $("studyChannels"),

    courseChannels:
        $("courseChannels"),

    communityChannels:
        $("communityChannels"),

    voiceChannels:
        $("voiceChannels"),

    currentChannelIcon:
        $("currentChannelIcon"),

    currentChannelName:
        $("currentChannelName"),

    currentChannelType:
        $("currentChannelType"),

    currentChannelDescription:
        $("currentChannelDescription"),

    channelSearchButton:
        $("channelSearchButton"),

    channelMembers:
        $("channelMembersButton"),

    channelMemberCount:
        $("channelMemberCount"),

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

    typingText:
        $("typingText"),

    attachmentPreview:
        $("attachmentPreview"),

    attachmentInput:
        $("attachmentInput"),

    attachButton:
        $("attachButton"),

    messageInput:
        $("messageInput"),

    emojiButton:
        $("emojiButton"),

    stickerButton:
        $("stickerButton"),

    gifButton:
        $("gifButton"),

    voiceButton:
        $("voiceNoteButton"),

    sendMessage:
        $("sendMessageButton"),

    messageCharacterCount:
        $("messageCharacterCount"),

    emojiPanel:
        $("emojiPanel"),

    closeEmoji:
        $("closeEmojiButton"),

    emojiSearch:
        $("emojiSearch"),

    emojiCategories:
        $("emojiCategories"),

    emojiGrid:
        $("emojiGrid"),

    stickerPanel:
        $("stickerPanel"),

    closeSticker:
        $("closeStickerButton"),

    stickerGrid:
        $("stickerGrid"),

    gifPanel:
        $("gifPanel"),

    closeGif:
        $("closeGifButton"),

    gifSearch:
        $("gifSearch"),

    gifGrid:
        $("gifGrid"),

    memberSidebar:
        $("memberSidebar"),

    memberCount:
        $("memberCount"),

    closeMemberSidebar:
        $("closeMemberSidebarButton"),

    memberSearch:
        $("memberSearchInput"),

    memberList:
        $("memberList"),

    friendsButton:
        $("friendsButton"),

    friendsModal:
        $("friendsModal"),

    friendsContent:
        $("friendsContent"),

    closeFriends:
        $("closeFriendsButton"),

    profileButton:
        $("profileButton"),

    profileModal:
        $("profileModal"),

    profileContent:
        $("profileModalContent"),

    closeProfile:
        $("closeProfileButton"),

    headerProfileAvatar:
        $("headerProfileAvatar"),

    headerProfileName:
        $("headerProfileName"),

    headerPresenceDot:
        $("headerPresenceDot"),

    profileLargeAvatar:
        $("profileLargeAvatar"),

    sidebarUserName:
        $("sidebarUserName"),

    sidebarUserStatus:
        $("sidebarUserStatus"),

    sidebarPresenceDot:
        $("sidebarPresenceDot"),

    notificationButton:
        $("notificationButton"),

    notificationPanel:
        $("notificationPanel"),

    notificationPanelContent:
        $("notificationPanelContent"),

    generalCall:
        $("generalCallButton"),

    callPickerModal:
        $("callPickerModal"),

    callMemberSearch:
        $("callMemberSearch"),

    callSelectAll:
        $("callSelectAllButton"),

    callMemberList:
        $("callMemberList"),

    selectedCallMemberCount:
        $("selectedCallMemberCount"),

    startSelectedCall:
        $("startSelectedCallButton"),

    closeCallPicker:
        $("closeCallPickerButton"),

    fileModal:
        $("filePreviewModal"),

    filePreviewContent:
        $("filePreviewContent"),

    confirmFile:
        $("confirmAttachmentButton"),

    cancelFile:
        $("cancelAttachmentButton"),

    closeFile:
        $("closeAttachmentPreviewButton"),

    rulesModal:
        $("rulesModal"),

    rulesButton:
        $("communityRulesButton"),

    closeRules:
        $("closeRulesButton"),

    contestModal:
        $("contestModal"),

    contestButton:
        $("contestChannelButton"),

    closeContest:
        $("closeContestButton"),

    toast:
        $("toast")

};


/* ============================================================
   GENERAL UTILITIES
   ============================================================ */

function escapeHTML(value) {

    return String(
        value ?? ""
    )
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function escapeAttribute(value) {
    return escapeHTML(value);
}


function initials(name) {

    const words =
        String(
            name || "User"
        )
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    if (!words.length) {
        return "U";
    }

    if (words.length === 1) {
        return words[0]
            .slice(0, 2)
            .toUpperCase();
    }

    return (
        words[0][0] +
        words[words.length - 1][0]
    ).toUpperCase();
}


function avatarFallback(name) {

    const text =
        initials(name);

    const svg =
        `
        <svg xmlns="http://www.w3.org/2000/svg"
             width="96"
             height="96"
             viewBox="0 0 96 96">
            <rect width="96" height="96" rx="48"
                  fill="#0b7285"/>
            <text
                x="48"
                y="53"
                text-anchor="middle"
                font-family="Arial,sans-serif"
                font-size="32"
                font-weight="700"
                fill="white">
                ${escapeHTML(text)}
            </text>
        </svg>
        `;

    return (
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(svg)
    );
}


function safeURL(url) {

    if (!url) {
        return "";
    }

    try {

        const parsed =
            new URL(
                url,
                window.location.origin
            );

        if (
            parsed.protocol === "http:" ||
            parsed.protocol === "https:"
        ) {
            return parsed.href;
        }

    } catch (_) {}

    return "";
}


function formatBytes(bytes) {

    const value =
        Number(bytes || 0);

    if (value < 1024) {
        return `${value} B`;
    }

    if (value < 1024 * 1024) {
        return `${(
            value / 1024
        ).toFixed(1)} KB`;
    }

    return `${(
        value /
        (1024 * 1024)
    ).toFixed(1)} MB`;
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


function formatDate(value) {

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

    return date.toLocaleDateString(
        [],
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );
}


function toast(message) {

    if (!dom.toast) {
        console.log(message);
        return;
    }

    dom.toast.textContent =
        message;

    dom.toast.classList.add(
        "show"
    );

    clearTimeout(
        toast.timer
    );

    toast.timer =
        setTimeout(
            () => {

                dom.toast.classList.remove(
                    "show"
                );

            },
            3500
        );

}


function openModal(modal) {

    if (!modal) {
        return;
    }

    modal.classList.add(
        "open"
    );

    modal.classList.remove(
        "hidden"
    );

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

}


function closeModal(modal) {

    if (!modal) {
        return;
    }

    modal.classList.remove(
        "open"
    );

    modal.classList.add(
        "hidden"
    );

    modal.setAttribute(
        "aria-hidden",
        "true"
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
            "Auth error:",
            error
        );

    }

    const user =
        data?.user ||
        null;

    if (!user) {

        toast(
            "Please sign in first."
        );

        setTimeout(
            () => {
                window.location.href =
                    "./studentLogin.html";
            },
            700
        );

        return null;
    }

    state.user =
        user;

    return user;
}


/* ============================================================
   PROFILE HELPERS
   ============================================================ */

function getProfile(userId) {

    return (
        state.profiles.get(
            userId
        ) ||
        null
    );
}


function getMember(userId) {

    return (
        state.members.find(
            member =>
                String(
                    member.user_id
                ) ===
                String(userId)
        ) ||
        null
    );
}


function getName(userId) {

    const member =
        getMember(userId);

    const profile =
        getProfile(userId);

    if (
        member?.display_name
    ) {
        return member.display_name;
    }

    if (
        member?.nickname
    ) {
        return member.nickname;
    }

    if (
        profile?.full_name
    ) {
        return profile.full_name;
    }

    if (
        String(userId) ===
        String(state.user?.id)
    ) {

        return (
            state.user?.user_metadata
                ?.full_name ||
            state.user?.user_metadata
                ?.name ||
            state.user?.email?.split("@")[0] ||
            "You"
        );

    }

    return "Student";
}


function getPhoto(userId) {

    const member =
        getMember(userId);

    const profile =
        getProfile(userId);

    if (
        member?.avatar_url
    ) {
        return safeURL(
            member.avatar_url
        );
    }

    if (
        member?.photo_url
    ) {
        return safeURL(
            member.photo_url
        );
    }

    if (
        profile?.photo_url
    ) {
        return safeURL(
            profile.photo_url
        );
    }

    if (
        String(userId) ===
        String(state.user?.id)
    ) {

        return safeURL(
            state.user?.user_metadata
                ?.avatar_url ||
            state.user?.user_metadata
                ?.picture ||
            state.user?.user_metadata
                ?.photo_url ||
            state.user?.user_metadata
                ?.photo
        );

    }

    return "";
}


function avatarHTML(
    userId,
    size = "message"
) {

    const name =
        getName(userId);

    const photo =
        getPhoto(userId) ||
        avatarFallback(name);

    const status =
        getStatus(userId);

    return `
        <span class="avatar-wrap avatar-${escapeAttribute(size)}">

            <img
                class="community-avatar"
                src="${escapeAttribute(photo)}"
                alt="${escapeAttribute(name)}"
                loading="lazy"
                onerror="this.onerror=null;this.src='${escapeAttribute(
                    avatarFallback(name)
                )}'"
            >

            <span
                class="avatar-status presence-${escapeAttribute(status)}"
                aria-label="${escapeAttribute(
                    statusLabel(status)
                )}"
            ></span>

        </span>
    `;
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

    try {

        const {
            data,
            error
        } =
            await supabase
                .from(
                    "chat_public_profiles"
                )
                .select(
                    "id,full_name,photo_url,updated_at"
                )
                .in(
                    "id",
                    ids
                );

        if (error) {

            console.warn(
                "Public profile query failed:",
                error.message
            );

            return;
        }

        (data || [])
            .forEach(
                profile => {

                    state.profiles.set(
                        String(profile.id),
                        profile
                    );

                }
            );

    } catch (error) {

        console.warn(
            "Profile loading failed:",
            error
        );

    }

}


/* ============================================================
   PRESENCE
   ============================================================ */

function normalizeStatus(status) {

    const value =
        String(
            status || ""
        ).toLowerCase();

    if (
        value === "dnd" ||
        value === "busy"
    ) {
        return "dnd";
    }

    if (
        value === "away" ||
        value === "idle"
    ) {
        return "away";
    }

    if (
        value === "online"
    ) {
        return "online";
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

    if (!row) {
        return Infinity;
    }

    const value =
        row.last_seen_at ||
        row.updated_at ||
        row.last_active_at;

    if (!value) {
        return Infinity;
    }

    return (
        Date.now() -
        new Date(value).getTime()
    );
}


function effectiveStatus(row) {

    if (!row) {
        return "offline";
    }

    const stored =
        normalizeStatus(
            row.status
        );

    const age =
        presenceAge(row);

    if (
        stored === "dnd" &&
        age <
        CONFIG.presenceFresh * 4
    ) {
        return "dnd";
    }

    if (
        stored === "away" &&
        age <
        CONFIG.presenceFresh * 4
    ) {
        return "away";
    }

    if (
        stored === "online" &&
        age <
        CONFIG.presenceFresh
    ) {
        return "online";
    }

    if (
        age <
        CONFIG.presenceFresh * 4
    ) {
        return "away";
    }

    return "offline";
}


function getStatus(userId) {

    if (
        String(userId) ===
        String(state.user?.id)
    ) {

        if (state.manualStatus) {
            return normalizeStatus(
                state.currentStatus
            );
        }

    }

    const row =
        state.presences.get(
            String(userId)
        );

    return effectiveStatus(row);
}


async function loadPresence() {

    try {

        const {
            data,
            error
        } =
            await supabase
                .from(
                    "chat_presence"
                )
                .select(
                    "*"
                );

        if (error) {

            console.warn(
                "Presence query failed:",
                error.message
            );

            return;
        }

        state.presences.clear();

        (data || [])
            .forEach(
                row => {

                    if (row.user_id) {

                        state.presences.set(
                            String(
                                row.user_id
                            ),
                            row
                        );

                    }

                }
            );

        renderMembers();
        updateHeaderPresence();
        renderSidebarUser();

    } catch (error) {

        console.warn(
            "Presence loading failed:",
            error
        );

    }

}


async function upsertOwnPresence(
    status = "online"
) {

    if (!state.user) {
        return;
    }

    const now =
        new Date()
            .toISOString();

    const normalized =
        normalizeStatus(
            status
        );

    state.currentStatus =
        normalized;

    try {

        const {
            data,
            error
        } =
            await supabase
                .from(
                    "chat_presence"
                )
                .upsert(
                    {
                        user_id:
                            state.user.id,

                        status:
                            normalized,

                        last_seen_at:
                            now,

                        last_active_at:
                            now,

                        updated_at:
                            now
                    },
                    {
                        onConflict:
                            "user_id"
                    }
                )
                .select()
                .maybeSingle();

        if (error) {
            throw error;
        }

        state.presences.set(
            String(
                state.user.id
            ),
            data || {
                user_id:
                    state.user.id,
                status:
                    normalized,
                last_seen_at:
                    now,
                updated_at:
                    now
            }
        );

        updateHeaderPresence();
        renderSidebarUser();
        renderMembers();

    } catch (error) {

        console.warn(
            "Presence update failed:",
            error
        );

    }

}


function updateHeaderPresence() {

    if (!state.user) {
        return;
    }

    const status =
        getStatus(
            state.user.id
        );

    if (dom.headerPresenceDot) {

        dom.headerPresenceDot.className =
            `header-presence-dot presence-${status}`;

    }

    if (dom.headerProfileName) {

        dom.headerProfileName.textContent =
            getName(
                state.user.id
            );

    }

    if (dom.headerProfileAvatar) {

        const photo =
            getPhoto(
                state.user.id
            ) ||
            avatarFallback(
                getName(
                    state.user.id
                )
            );

        dom.headerProfileAvatar.src =
            photo;

    }

}


function renderSidebarUser() {

    if (!state.user) {
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
        avatarFallback(name);

    const status =
        getStatus(
            state.user.id
        );

    if (dom.profileLargeAvatar) {

        dom.profileLargeAvatar.src =
            photo;

        dom.profileLargeAvatar.onerror =
            () => {

                dom.profileLargeAvatar.src =
                    avatarFallback(name);

            };

    }

    if (dom.sidebarUserName) {

        dom.sidebarUserName.textContent =
            name;

    }

    if (dom.sidebarUserStatus) {

        dom.sidebarUserStatus.textContent =
            statusLabel(status);

    }

    if (dom.sidebarPresenceDot) {

        dom.sidebarPresenceDot.className =
            `sidebar-presence-dot presence-${status}`;

    }

}


/* ============================================================
   ACTIVITY TRACKING
   ============================================================ */

function startPresence() {

    return upsertOwnPresence(
        "online"
    )
        .then(
            () => {

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

                                upsertOwnPresence(
                                    state.manualStatus
                                        ? state.currentStatus
                                        : "online"
                                );

                            }

                        },
                        CONFIG.presenceHeartbeat
                    );

            }
        );

}


function setupActivityTracking() {

    const activity =
        () => {

            if (
                document.visibilityState !==
                "visible"
            ) {
                return;
            }

            clearTimeout(
                state.awayTimer
            );

            if (
                !state.manualStatus &&
                state.currentStatus !==
                "online"
            ) {

                state.currentStatus =
                    "online";

                upsertOwnPresence(
                    "online"
                );

            }

            if (!state.manualStatus) {

                state.awayTimer =
                    setTimeout(
                        () => {

                            upsertOwnPresence(
                                "away"
                            );

                        },
                        CONFIG.awayAfter
                    );

            }

        };

    [
        "mousemove",
        "mousedown",
        "keydown",
        "touchstart",
        "scroll"
    ]
        .forEach(
            eventName => {

                document.addEventListener(
                    eventName,
                    activity,
                    {
                        passive:
                            true
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

                if (
                    !state.manualStatus
                ) {

                    upsertOwnPresence(
                        "online"
                    );

                }

            }

        }
    );

    activity();

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
            .select(
                "id,name,slug,description,icon_url,banner_url,is_public,is_active,created_by,created_at"
            )
            .eq(
                "is_active",
                true
            )
            .order(
                "created_at",
                {
                    ascending:
                        true
                }
            );

    if (error) {
        throw error;
    }

    state.communities =
        data || [];

    renderCommunityRail();

    if (!state.communities.length) {

        toast(
            "No active communities were found."
        );

        return;
    }

    let selected =
        state.communities.find(
            community =>
                community.slug ===
                "mwaniki-scholars"
        );

    if (!selected) {
        selected =
            state.communities[0];
    }

    await selectCommunity(
        selected.id
    );

}


function communityIcon(
    community
) {

    if (
        community?.icon_url
    ) {

        const url =
            safeURL(
                community.icon_url
            );

        if (url) {

            return `
                <img
                    src="${escapeAttribute(url)}"
                    alt=""
                    class="community-rail-image"
                >
            `;

        }

    }

    const key =
        String(
            community?.slug ||
            ""
        ).toLowerCase();

    return (
        CONFIG.communityIcons[key] ||
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

                    const selected =
                        String(
                            state.currentCommunity?.id
                        ) ===
                        String(
                            community.id
                        );

                    return `
                        <button
                            type="button"
                            class="
                                community-rail-button
                                ${selected ? "active" : ""}
                            "
                            data-community-id="${escapeAttribute(
                                community.id
                            )}"
                            title="${escapeAttribute(
                                community.name
                            )}"
                        >
                            ${communityIcon(
                                community
                            )}
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

                        await selectCommunity(
                            button.dataset.communityId
                        );

                    }
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

    state.currentCommunity =
        community;

    state.currentChannel =
        null;

    state.channels =
        [];

    state.messages =
        [];

    state.members =
        [];

    state.typingUsers.clear();

    closeAllPickers();

    renderCommunityRail();

    if (dom.selectedCommunityName) {

        dom.selectedCommunityName.textContent =
            community.name;

    }

    if (dom.selectedCommunityDescription) {

        dom.selectedCommunityDescription.textContent =
            community.description ||
            "Academic community";

    }

    if (dom.selectedCommunityIcon) {

        if (community.icon_url) {

            const url =
                safeURL(
                    community.icon_url
                );

            if (url) {

                dom.selectedCommunityIcon.innerHTML =
                    `
                    <img
                        src="${escapeAttribute(url)}"
                        alt=""
                    >
                    `;

            } else {

                dom.selectedCommunityIcon.textContent =
                    communityIcon(
                        community
                    );

            }

        } else {

            dom.selectedCommunityIcon.textContent =
                communityIcon(
                    community
                );

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
            .select(
                "id,community_id,name,slug,description,channel_type,icon,position,is_private,is_archived,is_active,course_id,unit_id,created_by,created_at"
            )
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
                    ascending:
                        true
                }
            )
            .order(
                "created_at",
                {
                    ascending:
                        true
                }
            );

    if (error) {

        console.error(
            "Channel loading failed:",
            error
        );

        toast(
            "Channels could not be loaded."
        );

        return;
    }

    state.channels =
        data || [];

    renderChannels();

    if (!state.channels.length) {

        if (dom.messageList) {

            dom.messageList.innerHTML =
                `
                    <div class="community-empty-state">
                        <div class="empty-icon">💬</div>
                        <h3>No channels yet</h3>
                        <p>This community has no active channels.</p>
                    </div>
                `;

        }

        return;
    }

    const preferred =
        state.channels.find(
            channel =>
                channel.slug ===
                "general"
        ) ||
        state.channels.find(
            channel =>
                String(
                    channel.channel_type
                ).toLowerCase() ===
                "text"
        ) ||
        state.channels[0];

    await selectChannel(
        preferred.id
    );

}


function channelIcon(
    channel
) {

    if (channel.icon) {
        return channel.icon;
    }

    const type =
        String(
            channel.channel_type ||
            ""
        ).toLowerCase();

    if (
        type.includes("voice")
    ) {
        return "🔊";
    }

    if (
        type.includes("announcement")
    ) {
        return "📢";
    }

    if (
        type.includes("study")
    ) {
        return "📚";
    }

    if (
        channel.course_id
    ) {
        return "🩺";
    }

    return "#";
}


function getChannelGroup(
    channel
) {

    const type =
        String(
            channel.channel_type ||
            ""
        ).toLowerCase();

    if (
        type.includes("voice") ||
        type.includes("call")
    ) {
        return "voice";
    }

    if (
        channel.course_id
    ) {
        return "course";
    }

    if (
        type.includes("announcement") ||
        type.includes("information") ||
        type === "info"
    ) {
        return "information";
    }

    if (
        type.includes("study")
    ) {
        return "study";
    }

    if (
        channel.slug === "general" ||
        channel.name?.toLowerCase() === "general"
    ) {
        return "general";
    }

    return "community";
}


function renderChannels() {

    const groups = {
        information:
            dom.informationChannels,

        general:
            dom.generalChannels,

        study:
            dom.studyChannels,

        course:
            dom.courseChannels,

        community:
            dom.communityChannels,

        voice:
            dom.voiceChannels
    };

    Object.values(groups)
        .forEach(
            element => {

                if (element) {
                    element.innerHTML = "";
                }

            }
        );

    const search =
        state.channelSearch
            .trim()
            .toLowerCase();

    const filtered =
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

    filtered.forEach(
        channel => {

            const group =
                getChannelGroup(
                    channel
                );

            const container =
                groups[group] ||
                groups.community;

            if (!container) {
                return;
            }

            container.appendChild(
                createChannelButton(
                    channel
                )
            );

        }
    );

    Object.entries(groups)
        .forEach(
            ([group, element]) => {

                if (!element) {
                    return;
                }

                const wrapper =
                    element.closest(
                        ".channel-group"
                    );

                if (wrapper) {

                    wrapper.classList.toggle(
                        "empty",
                        !element.children.length
                    );

                }

            }
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
        "channel-button";

    if (
        String(
            state.currentChannel?.id
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

    button.innerHTML =
        `
        <span class="channel-button-icon">
            ${escapeHTML(
                channelIcon(channel)
            )}
        </span>

        <span class="channel-button-name">
            ${escapeHTML(
                channel.name
            )}
        </span>

        ${
            channel.is_private
                ? `<span class="channel-lock">🔒</span>`
                : ""
        }
        `;

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

    stopTyping();

    removeRealtimeChannel(
        item =>
            item.__messageChannel ||
            item.__typingKey
    );

    state.currentChannel =
        channel;

    state.messages =
        [];

    state.typingUsers.clear();

    if (dom.currentChannelIcon) {
        dom.currentChannelIcon.textContent =
            channelIcon(channel);
    }

    if (dom.currentChannelName) {
        dom.currentChannelName.textContent =
            channel.name;
    }

    if (dom.currentChannelType) {
        dom.currentChannelType.textContent =
            channel.is_private
                ? "Private channel"
                : (
                    channel.channel_type ||
                    "Text channel"
                );
    }

    if (dom.currentChannelDescription) {
        dom.currentChannelDescription.textContent =
            channel.description ||
            "Academic discussion";
    }

    renderChannels();

    if (dom.typingIndicator) {
        dom.typingIndicator.classList.add(
            "hidden"
        );
    }

    await loadMessages();

    subscribeChannelRealtime();

    if (dom.messageInput) {
        dom.messageInput.focus();
    }

}


/* ============================================================
   MEMBERS
   ============================================================ */

async function loadMembers() {

    if (!state.currentCommunity) {
        return;
    }

    let members = [];

    try {

        const {
            data,
            error
        } =
            await supabase
                .from(
                    "chat_community_members"
                )
                .select(
                    "id,community_id,user_id,role,nickname,is_muted,is_banned,membership_status,display_name,avatar_url,last_seen_at,last_active_at,status"
                )
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
                        ascending:
                            true
                    }
                );

        if (!error) {
            members =
                data || [];
        } else {

            console.warn(
                "Community membership query failed:",
                error.message
            );

        }

    } catch (error) {

        console.warn(
            "Member query failed:",
            error
        );

    }

    /*
     * Important fallback:
     *
     * If the community membership table is empty,
     * use the public profile directory instead of
     * displaying "zero members".
     */

    if (!members.length) {

        try {

            const {
                data,
                error
            } =
                await supabase
                    .from(
                        "chat_public_profiles"
                    )
                    .select(
                        "id,full_name,photo_url,updated_at"
                    )
                    .order(
                        "full_name",
                        {
                            ascending:
                                true
                        }
                    )
                    .limit(
                        500
                    );

            if (!error) {

                members =
                    (data || [])
                        .map(
                            profile => ({
                                id:
                                    `profile-${profile.id}`,

                                community_id:
                                    state.currentCommunity.id,

                                user_id:
                                    profile.id,

                                role:
                                    String(
                                        profile.id
                                    ) ===
                                    String(
                                        state.user?.id
                                    )
                                        ? "Student"
                                        : "Student",

                                nickname:
                                    null,

                                is_muted:
                                    false,

                                is_banned:
                                    false,

                                membership_status:
                                    "active",

                                display_name:
                                    profile.full_name ||
                                    "Student",

                                avatar_url:
                                    profile.photo_url ||
                                    null
                            })
                        );

            }

        } catch (error) {

            console.warn(
                "Public profile fallback failed:",
                error
            );

        }

    }

    /*
     * Always include the currently signed-in user.
     */

    if (state.user) {

        const exists =
            members.some(
                member =>
                    String(
                        member.user_id
                    ) ===
                    String(
                        state.user.id
                    )
            );

        if (!exists) {

            members.unshift(
                {
                    id:
                        `self-${state.user.id}`,

                    community_id:
                        state.currentCommunity.id,

                    user_id:
                        state.user.id,

                    role:
                        "Student",

                    nickname:
                        null,

                    is_muted:
                        false,

                    is_banned:
                        false,

                    membership_status:
                        "active",

                    display_name:
                        state.user
                            .user_metadata
                            ?.full_name ||
                        state.user
                            .user_metadata
                            ?.name ||
                        state.user.email
                            ?.split("@")[0] ||
                        "You",

                    avatar_url:
                        state.user
                            .user_metadata
                            ?.avatar_url ||
                        state.user
                            .user_metadata
                            ?.picture ||
                        null
                }
            );

        }

    }

    state.members =
        members;

    await loadProfilesForUsers(
        members.map(
            member =>
                member.user_id
        )
    );

    await loadPresence();

    renderMembers();

    updateMemberCounts();

}


function updateMemberCounts() {

    const count =
        state.members.length;

    if (dom.memberCount) {

        dom.memberCount.textContent =
            count;

    }

    if (dom.channelMemberCount) {

        dom.channelMemberCount.textContent =
            count;

    }

}


function renderMembers() {

    if (!dom.memberList) {
        return;
    }

    const search =
        state.memberSearch
            .trim()
            .toLowerCase();

    const members =
        state.members.filter(
            member => {

                if (!search) {
                    return true;
                }

                const name =
                    getName(
                        member.user_id
                    )
                        .toLowerCase();

                const role =
                    String(
                        member.role || ""
                    )
                        .toLowerCase();

                return (
                    name.includes(search) ||
                    role.includes(search)
                );

            }
        );

    updateMemberCounts();

    if (!members.length) {

        dom.memberList.innerHTML =
            `
            <div class="empty-members">
                <div>👥</div>
                <strong>No members found</strong>
                <small>
                    Try clearing the search.
                </small>
            </div>
            `;

        return;
    }

    dom.memberList.innerHTML =
        members
            .map(
                member => {

                    const id =
                        member.user_id;

                    const status =
                        getStatus(id);

                    return `
                        <button
                            type="button"
                            class="member-row"
                            data-member-id="${escapeAttribute(id)}"
                        >

                            ${avatarHTML(
                                id,
                                "member"
                            )}

                            <span class="member-row-info">

                                <strong>
                                    ${escapeHTML(
                                        getName(id)
                                    )}
                                </strong>

                                <span>
                                    ${escapeHTML(
                                        statusLabel(status)
                                    )}
                                </span>

                            </span>

                            <span class="member-role">
                                ${escapeHTML(
                                    member.role ||
                                    "Student"
                                )}
                            </span>

                        </button>
                    `;

                }
            )
            .join("");

    dom.memberList
        .querySelectorAll(
            "[data-member-id]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        openDirectMessage(
                            button.dataset.memberId
                        );

                    }
                );

            }
        );

}


/* ============================================================
   DIRECT MESSAGE
   ============================================================ */

async function openDirectMessage(
    userId
) {

    if (
        !state.currentCommunity ||
        !state.user ||
        String(userId) ===
        String(state.user.id)
    ) {
        return;
    }

    /*
     * Find an existing DM/direct channel if your
     * channel table contains one.
     */

    const existing =
        state.channels.find(
            channel => {

                const type =
                    String(
                        channel.channel_type ||
                        ""
                    ).toLowerCase();

                const name =
                    String(
                        channel.name ||
                        ""
                    ).toLowerCase();

                return (
                    type === "dm" ||
                    type === "direct" ||
                    type === "private"
                ) &&
                (
                    name.includes(
                        getName(userId)
                            .toLowerCase()
                    )
                );

            }
        );

    if (existing) {

        await selectChannel(
            existing.id
        );

        if (dom.memberSidebar) {
            dom.memberSidebar.classList.remove(
                "open"
            );
        }

        return;
    }

    toast(
        `Selected ${getName(userId)}. A direct-message channel can be enabled from the community channel system.`
    );

}


/* ============================================================
   MESSAGES
   ============================================================ */

async function loadMessages() {

    if (
        !state.currentChannel
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
            .select(
                "id,channel_id,user_id,parent_message_id,content,message_type,is_edited,is_deleted,is_pinned,edited_at,deleted_at,created_at,updated_at,reply_to_user_id"
            )
            .eq(
                "channel_id",
                state.currentChannel.id
            )
            .order(
                "created_at",
                {
                    ascending:
                        true
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
            "Messages failed:",
            error
        );

        if (dom.messageList) {

            dom.messageList.innerHTML =
                `
                <div class="community-error-state">
                    <strong>Messages could not be loaded.</strong>
                    <small>${escapeHTML(
                        error.message
                    )}</small>
                </div>
                `;

        }

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

    await loadMessageAttachments();

    await loadMessageReactions();

    renderMessages();

}


async function loadMessageAttachments() {

    const ids =
        state.messages
            .map(
                message =>
                    message.id
            )
            .filter(Boolean);

    state.attachments =
        new Map();

    if (!ids.length) {
        return;
    }

    try {

        const {
            data,
            error
        } =
            await supabase
                .from(
                    "chat_attachments"
                )
                .select(
                    "id,message_id,uploaded_by,file_name,file_path,file_url,mime_type,file_size,created_at"
                )
                .in(
                    "message_id",
                    ids
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            true
                    }
                );

        if (error) {

            console.warn(
                "Attachment query failed:",
                error.message
            );

            return;
        }

        (data || [])
            .forEach(
                attachment => {

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
            );

    } catch (error) {

        console.warn(
            "Attachment loading failed:",
            error
        );

    }

}


/* ============================================================
   REACTIONS
   ============================================================ */

async function loadMessageReactions() {

    state.messageReactions =
        new Map();

    const ids =
        state.messages
            .map(
                message =>
                    message.id
            )
            .filter(Boolean);

    if (!ids.length) {
        return;
    }

    try {

        const {
            data,
            error
        } =
            await supabase
                .from(
                    "chat_message_reactions"
                )
                .select(
                    "*"
                )
                .in(
                    "message_id",
                    ids
                );

        if (error) {

            console.warn(
                "Reaction loading unavailable:",
                error.message
            );

            return;
        }

        (data || [])
            .forEach(
                row => {

                    const messageId =
                        row.message_id;

                    const emoji =
                        row.reaction ||
                        row.emoji ||
                        row.reaction_emoji;

                    if (
                        !messageId ||
                        !emoji
                    ) {
                        return;
                    }

                    if (
                        !state.messageReactions
                            .has(messageId)
                    ) {

                        state.messageReactions.set(
                            messageId,
                            []
                        );

                    }

                    state.messageReactions
                        .get(messageId)
                        .push(
                            {
                                ...row,
                                emoji
                            }
                        );

                }
            );

    } catch (error) {

        console.warn(
            "Reaction loading failed:",
            error
        );

    }

}


function reactionSummary(
    messageId
) {

    const rows =
        state.messageReactions
            ?.get(
                messageId
            ) ||
        [];

    const grouped =
        new Map();

    rows.forEach(
        row => {

            const emoji =
                row.emoji;

            if (!emoji) {
                return;
            }

            if (
                !grouped.has(
                    emoji
                )
            ) {

                grouped.set(
                    emoji,
                    {
                        emoji,
                        count: 0,
                        mine: false
                    }
                );

            }

            const item =
                grouped.get(
                    emoji
                );

            item.count++;

            if (
                String(
                    row.user_id
                ) ===
                String(
                    state.user?.id
                )
            ) {

                item.mine =
                    true;

            }

        }
    );

    return [
        ...grouped.values()
    ];

}


async function toggleReaction(
    messageId,
    emoji
) {

    if (!state.user) {
        return;
    }

    try {

        const {
            data,
            error
        } =
            await supabase
                .from(
                    "chat_message_reactions"
                )
                .select(
                    "*"
                )
                .eq(
                    "message_id",
                    messageId
                )
                .eq(
                    "user_id",
                    state.user.id
                );

        if (error) {
            throw error;
        }

        const existing =
            (data || [])
                .find(
                    row =>
                        (
                            row.reaction ||
                            row.emoji ||
                            row.reaction_emoji
                        ) === emoji
                );

        if (existing) {

            const {
                error:
                    deleteError
            } =
                await supabase
                    .from(
                        "chat_message_reactions"
                    )
                    .delete()
                    .eq(
                        "id",
                        existing.id
                    );

            if (deleteError) {
                throw deleteError;
            }

        } else {

            /*
             * Primary expected column is reaction.
             * If your table uses emoji instead, change
             * this one object to { emoji }.
             */

            const {
                error:
                    insertError
            } =
                await supabase
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

            if (insertError) {
                throw insertError;
            }

        }

        await loadMessages();

    } catch (error) {

        console.warn(
            "Reaction failed:",
            error
        );

        toast(
            "Reaction could not be saved. Check the reaction table columns."
        );

    }

}


function renderReactions(
    messageId
) {

    const reactions =
        reactionSummary(
            messageId
        );

    return `
        <div class="message-reactions">

            ${reactions
                .map(
                    reaction => `
                        <button
                            type="button"
                            class="
                                reaction-pill
                                ${reaction.mine ? "mine" : ""}
                            "
                            data-reaction-message="${escapeAttribute(
                                messageId
                            )}"
                            data-reaction="${escapeAttribute(
                                reaction.emoji
                            )}"
                        >
                            <span>
                                ${escapeHTML(
                                    reaction.emoji
                                )}
                            </span>
                            <b>
                                ${reaction.count}
                            </b>
                        </button>
                    `
                )
                .join("")}

            <button
                type="button"
                class="reaction-add"
                data-add-reaction="${escapeAttribute(
                    messageId
                )}"
                title="Add reaction"
            >
                +
            </button>

        </div>
    `;
}


/* ============================================================
   MESSAGE RENDERING
   ============================================================ */

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
            <div class="community-empty-state message-empty">

                <div class="empty-icon">
                    💬
                </div>

                <h3>
                    No messages yet
                </h3>

                <p>
                    Start the discussion in this channel.
                </p>

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

    const mine =
        String(
            message.user_id
        ) ===
        String(
            state.user?.id
        );

    const name =
        getName(
            message.user_id
        );

    const deleted =
        Boolean(
            message.is_deleted
        );

    const attachments =
        state.attachments
            ?.get(
                message.id
            ) ||
        [];

    const content =
        deleted
            ? `<span class="deleted-message">This message was deleted.</span>`
            : formatMessageContent(
                message.content
            );

    return `
        <article
            class="
                message-row
                ${mine ? "mine" : ""}
                ${deleted ? "deleted" : ""}
            "
            data-message-id="${escapeAttribute(
                message.id
            )}"
        >

            <div class="message-avatar-column">

                ${avatarHTML(
                    message.user_id,
                    "message"
                )}

            </div>

            <div class="message-main">

                <div class="message-meta">

                    <strong class="message-author">
                        ${escapeHTML(name)}
                    </strong>

                    <time>
                        ${escapeHTML(
                            formatTime(
                                message.created_at
                            )
                        )}
                    </time>

                    ${
                        message.is_edited && !deleted
                            ? `
                                <span class="edited-label">
                                    edited
                                </span>
                            `
                            : ""
                    }

                </div>

                <div class="message-content">

                    ${content}

                    ${
                        renderAttachments(
                            attachments,
                            message.message_type
                        )
                    }

                </div>

                ${
                    !deleted
                        ? renderReactions(
                            message.id
                        )
                        : ""
                }

                ${
                    !deleted
                        ? `
                            <div class="message-actions">

                                <button
                                    type="button"
                                    data-add-reaction="${escapeAttribute(
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


function formatMessageContent(
    content
) {

    return escapeHTML(
        content || ""
    )
        .replace(
            /\n/g,
            "<br>"
        );
}


function renderAttachments(
    attachments,
    messageType
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

                        if (!url) {
                            return "";
                        }

                        const mime =
                            String(
                                attachment.mime_type ||
                                ""
                            ).toLowerCase();

                        if (
                            mime.startsWith(
                                "image/"
                            )
                        ) {

                            return `
                                <a
                                    href="${escapeAttribute(url)}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="message-image-link"
                                >
                                    <img
                                        class="message-image"
                                        src="${escapeAttribute(url)}"
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
                            ) ||
                            messageType === "voice"
                        ) {

                            return `
                                <div class="voice-message">

                                    <span class="voice-icon">
                                        🎙️
                                    </span>

                                    <div class="voice-body">

                                        <strong>
                                            Voice note
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
                            <a
                                class="message-file"
                                href="${escapeAttribute(url)}"
                                target="_blank"
                                rel="noopener noreferrer"
                                download
                            >

                                <span class="file-icon">
                                    📄
                                </span>

                                <span>
                                    <strong>
                                        ${escapeHTML(
                                            attachment.file_name ||
                                            "Attachment"
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
        !state.currentChannel ||
        !dom.messageInput
    ) {
        return;
    }

    const content =
        dom.messageInput.value.trim();

    if (!content) {
        return;
    }

    const button =
        dom.sendMessage;

    if (button) {
        button.disabled =
            true;
    }

    try {

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

                    content:
                        content,

                    message_type:
                        "text"
                });

        if (error) {
            throw error;
        }

        dom.messageInput.value =
            "";

        updateCharacterCount();

        stopTyping();

        await loadMessages();

    } catch (error) {

        console.error(
            "Message send failed:",
            error
        );

        toast(
            error.message ||
            "Message could not be sent."
        );

    } finally {

        if (button) {
            button.disabled =
                false;
        }

        dom.messageInput.focus();

    }

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
                String(item.id) ===
                String(messageId)
        );

    if (!message) {
        return;
    }

    if (
        String(
            message.user_id
        ) !==
        String(
            state.user?.id
        )
    ) {
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

    const content =
        next.trim();

    if (!content) {
        toast(
            "A message cannot be empty."
        );
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
                content,
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

        console.error(
            "Edit failed:",
            error
        );

        toast(
            "Could not edit message."
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
                String(item.id) ===
                String(messageId)
        );

    if (!message) {
        return;
    }

    if (
        String(
            message.user_id
        ) !==
        String(
            state.user?.id
        )
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
   TYPING
   ============================================================ */

function getTypingRealtimeChannel() {

    if (
        !state.currentChannel
    ) {
        return null;
    }

    return state.realtime.find(
        channel =>
            channel.__typingKey ===
            `typing:${state.currentChannel.id}`
    ) || null;
}


async function broadcastTyping(
    isTyping
) {

    const channel =
        getTypingRealtimeChannel();

    if (!channel || !state.user) {
        return;
    }

    try {

        await channel.send({
            type:
                "broadcast",

            event:
                "typing",

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
            stopTyping,
            CONFIG.typingTimeout
        );

}


function stopTyping() {

    clearTimeout(
        state.typingTimer
    );

    state.typingTimer =
        null;

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
        ]
            .filter(
                user =>
                    String(
                        user.user_id
                    ) !==
                    String(
                        state.user?.id
                    )
            );

    if (!users.length) {

        dom.typingIndicator.classList.add(
            "hidden"
        );

        if (dom.typingText) {
            dom.typingText.textContent =
                "";
        }

        return;
    }

    const names =
        users
            .slice(
                0,
                3
            )
            .map(
                user =>
                    user.name ||
                    "Someone"
            );

    let text =
        "";

    if (
        names.length === 1
    ) {

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

    if (dom.typingText) {
        dom.typingText.textContent =
            text;
    } else {
        dom.typingIndicator.textContent =
            text;
    }

    dom.typingIndicator.classList.remove(
        "hidden"
    );

}


/* ============================================================
   ATTACHMENTS
   ============================================================ */

function handleAttachmentSelection(
    event
) {

    const files =
        [
            ...(event.target.files || [])
        ];

    if (!files.length) {
        return;
    }

    const valid =
        [];

    files.forEach(
        file => {

            if (
                file.size >
                CONFIG.maxAttachmentSize
            ) {

                toast(
                    `${file.name} is too large. Maximum size is 25 MB.`
                );

                return;
            }

            valid.push(
                file
            );

        }
    );

    state.selectedFiles =
        valid;

    renderAttachmentPreview();

    if (valid.length) {

        renderFilePreviewModal();

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

                    const image =
                        file.type?.startsWith(
                            "image/"
                        );

                    const preview =
                        image
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
                                            src="${escapeAttribute(
                                                preview
                                            )}"
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


function renderFilePreviewModal() {

    if (!dom.filePreviewContent) {
        return;
    }

    dom.filePreviewContent.innerHTML =
        `
        <div class="file-preview-list">

            ${state.selectedFiles
                .map(
                    file => {

                        const image =
                            file.type?.startsWith(
                                "image/"
                            );

                        return `
                            <div class="file-preview-card">

                                ${
                                    image
                                        ? `
                                            <img
                                                src="${escapeAttribute(
                                                    URL.createObjectURL(file)
                                                )}"
                                                alt=""
                                            >
                                        `
                                        : `
                                            <div class="large-file-icon">
                                                📄
                                            </div>
                                        `
                                }

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
                        `;

                    }
                )
                .join("")}

        </div>
        `;

}


async function findStorageBucket(
    candidates
) {

    for (
        const bucketName of candidates
    ) {

        try {

            const {
                error
            } =
                await supabase.storage
                    .from(
                        bucketName
                    )
                    .list(
                        "",
                        {
                            limit:
                                1
                        }
                    );

            if (!error) {
                return bucketName;
            }

        } catch (_) {}

    }

    return null;
}


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
            "No accessible Supabase storage bucket was found."
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
        error
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

    if (error) {
        throw error;
    }

    /*
     * First try public URL.
     */

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
     * Private bucket fallback.
     */

    if (!url) {

        const {
            data:
                signedData,
            error:
                signedError
        } =
            await supabase.storage
                .from(
                    bucket
                )
                .createSignedUrl(
                    path,
                    60 * 60 * 24 * 7
                );

        if (!signedError) {

            url =
                signedData?.signedUrl ||
                "";

        }

    }

    if (!url) {

        throw new Error(
            "The file uploaded but Supabase did not return a usable URL."
        );

    }

    return {
        bucket,
        path,
        url
    };

}


async function sendSelectedFiles() {

    if (
        !state.currentChannel ||
        !state.user ||
        !state.selectedFiles.length
    ) {
        return;
    }

    const files =
        [
            ...state.selectedFiles
        ];

    if (dom.confirmFile) {
        dom.confirmFile.disabled =
            true;
    }

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

        if (dom.attachmentInput) {
            dom.attachmentInput.value =
                "";
        }

        renderAttachmentPreview();

        closeModal(
            dom.fileModal
        );

        toast(
            "Attachment sent successfully."
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

    } finally {

        if (dom.confirmFile) {
            dom.confirmFile.disabled =
                false;
        }

    }

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

    if (!state.currentChannel) {

        toast(
            "Select a channel first."
        );

        return;
    }

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        toast(
            "Voice recording is not supported by this browser."
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

        state.voiceStream =
            stream;

        state.voiceChunks =
            [];

        let mimeType =
            "";

        if (
            MediaRecorder.isTypeSupported(
                "audio/webm;codecs=opus"
            )
        ) {

            mimeType =
                "audio/webm;codecs=opus";

        } else if (
            MediaRecorder.isTypeSupported(
                "audio/webm"
            )
        ) {

            mimeType =
                "audio/webm";

        }

        state.mediaRecorder =
            new MediaRecorder(
                stream,
                mimeType
                    ? {
                        mimeType
                    }
                    : undefined
            );

        state.recording =
            true;

        state.voiceStarted =
            Date.now();

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

        state.mediaRecorder.onerror =
            event => {

                console.error(
                    "MediaRecorder error:",
                    event.error
                );

                stopVoiceRecording();

            };

        state.mediaRecorder.onstop =
            async () => {

                const recorder =
                    state.mediaRecorder;

                const mime =
                    recorder?.mimeType ||
                    "audio/webm";

                state.recording =
                    false;

                updateVoiceButton();

                if (state.voiceStream) {

                    state.voiceStream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );

                }

                state.voiceStream =
                    null;

                const chunks =
                    [
                        ...state.voiceChunks
                    ];

                state.voiceChunks =
                    [];

                state.mediaRecorder =
                    null;

                const blob =
                    new Blob(
                        chunks,
                        {
                            type:
                                mime
                        }
                    );

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
            "Recording… click the microphone again to stop."
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

        if (state.voiceStream) {

            state.voiceStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

        }

        state.voiceStream =
            null;

        state.recording =
            false;

        updateVoiceButton();

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

        } catch (error) {

            console.warn(
                error
            );

        }

    }

}


function updateVoiceButton() {

    if (!dom.voiceButton) {
        return;
    }

    if (state.recording) {

        dom.voiceButton.textContent =
            "⏹";

        dom.voiceButton.classList.add(
            "recording"
        );

        dom.voiceButton.title =
            "Stop recording";

    } else {

        dom.voiceButton.textContent =
            "🎙";

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
            "Voice note failed:",
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

    channels.forEach(
        channel => {

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
    );

}


function subscribeTyping() {

    if (
        !state.currentChannel
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
            event:
                "typing"
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
                    String(
                        data.user_id
                    ),
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
                    String(
                        data.user_id
                    )
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


function subscribeChannelRealtime() {

    if (
        !state.currentChannel
    ) {
        return;
    }

    removeRealtimeChannel(
        channel =>
            channel.__messageChannel ===
            true ||
            channel.__typingKey
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
            event:
                "*",

            schema:
                "public",

            table:
                "chat_messages",

            filter:
                `channel_id=eq.${state.currentChannel.id}`
        },
        async () => {

            await loadMessages();

        }
    );

    channel.on(
        "postgres_changes",
        {
            event:
                "*",

            schema:
                "public",

            table:
                "chat_attachments"
        },
        async () => {

            await loadMessages();

        }
    );

    channel.on(
        "postgres_changes",
        {
            event:
                "*",

            schema:
                "public",

            table:
                "chat_message_reactions"
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
            channel.__communityChannel ===
            true
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
            event:
                "*",

            schema:
                "public",

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
            event:
                "*",

            schema:
                "public",

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
                    String(
                        row.user_id
                    ),
                    row
                );

                renderMembers();
                updateHeaderPresence();
                renderSidebarUser();

            }

        }
    );

    channel.subscribe();

    state.realtime.push(
        channel
    );

}


/* ============================================================
   EMOJI / STICKERS
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


function renderEmojiGrid(
    filter = ""
) {

    if (!dom.emojiGrid) {
        return;
    }

    const query =
        filter
            .trim()
            .toLowerCase();

    const emojis =
        query
            ? EMOJIS.filter(
                emoji =>
                    emoji.includes(
                        query
                    )
            )
            : EMOJIS;

    dom.emojiGrid.innerHTML =
        emojis
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


function renderGifPanel() {

    if (!dom.gifGrid) {
        return;
    }

    dom.gifGrid.innerHTML =
        `
        <div class="gif-empty">
            <div class="gif-symbol">GIF</div>
            <strong>GIF search</strong>
            <small>
                GIF provider integration can be added later.
            </small>
        </div>
        `;

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

    updateCharacterCount();

}


function togglePicker(
    panel,
    type
) {

    if (!panel) {
        return;
    }

    const currentlyOpen =
        !panel.classList.contains(
            "hidden"
        );

    closeAllPickers();

    if (!currentlyOpen) {

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
    ]
        .forEach(
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
   CHARACTER COUNT
   ============================================================ */

function updateCharacterCount() {

    if (
        !dom.messageCharacterCount ||
        !dom.messageInput
    ) {
        return;
    }

    dom.messageCharacterCount.textContent =
        dom.messageInput.value.length;

}


/* ============================================================
   MESSAGE SEARCH
   ============================================================ */

function setupMessageSearch() {

    dom.messageSearchInput
        ?.addEventListener(
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
        avatarFallback(name);

    const status =
        getStatus(
            state.user.id
        );

    dom.profileContent.innerHTML =
        `
        <div class="profile-card-content">

            <img
                class="profile-modal-avatar"
                src="${escapeAttribute(photo)}"
                alt="${escapeAttribute(name)}"
                onerror="this.onerror=null;this.src='${escapeAttribute(
                    avatarFallback(name)
                )}'"
            >

            <h2>
                ${escapeHTML(name)}
            </h2>

            <span
                class="profile-status status-${escapeAttribute(status)}"
            >
                <span class="profile-status-dot"></span>
                ${escapeHTML(
                    statusLabel(status)
                )}
            </span>

            <p>
                ${escapeHTML(
                    state.user.email || ""
                )}
            </p>

            <div class="profile-status-actions">

                <button
                    type="button"
                    data-set-status="online"
                >
                    <span>●</span>
                    Online
                </button>

                <button
                    type="button"
                    data-set-status="away"
                >
                    <span>◐</span>
                    Away
                </button>

                <button
                    type="button"
                    data-set-status="dnd"
                >
                    <span>−</span>
                    Do Not Disturb
                </button>

                <button
                    type="button"
                    data-clear-status
                >
                    Automatic status
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

                        state.manualStatus =
                            true;

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

    dom.profileContent
        .querySelector(
            "[data-clear-status]"
        )
        ?.addEventListener(
            "click",
            async () => {

                state.manualStatus =
                    false;

                state.currentStatus =
                    "online";

                await upsertOwnPresence(
                    "online"
                );

                renderProfileModal();

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

    const active =
        state.members.filter(
            member =>
                String(
                    member.user_id
                ) !==
                String(
                    state.user?.id
                )
        );

    dom.friendsContent.innerHTML =
        `
        <div class="friends-online-summary">

            <strong>
                ${active.filter(
                    member =>
                        getStatus(
                            member.user_id
                        ) !== "offline"
                ).length}
            </strong>

            active members

        </div>

        <div class="friends-member-list">

            ${
                active.length
                    ? active
                        .map(
                            member => {

                                const id =
                                    member.user_id;

                                return `
                                    <button
                                        type="button"
                                        class="friend-row"
                                        data-friend-id="${escapeAttribute(
                                            id
                                        )}"
                                    >

                                        ${avatarHTML(
                                            id,
                                            "friend"
                                        )}

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

                                        <span class="friend-arrow">
                                            →
                                        </span>

                                    </button>
                                `;

                            }
                        )
                        .join("")
                    :
                        `
                        <div class="empty-members">
                            No members available.
                        </div>
                        `
            }

        </div>
        `;

    dom.friendsContent
        .querySelectorAll(
            "[data-friend-id]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        await openDirectMessage(
                            button.dataset.friendId
                        );

                        closeModal(
                            dom.friendsModal
                        );

                    }
                );

            }
        );

}


/* ============================================================
   CALL PICKER
   ============================================================ */

function renderCallMembers() {

    if (!dom.callMemberList) {
        return;
    }

    const search =
        dom.callMemberSearch
            ?.value
            .trim()
            .toLowerCase() ||
        "";

    const members =
        state.members.filter(
            member => {

                if (
                    String(
                        member.user_id
                    ) ===
                    String(
                        state.user?.id
                    )
                ) {
                    return false;
                }

                const status =
                    getStatus(
                        member.user_id
                    );

                if (
                    status === "offline"
                ) {
                    return false;
                }

                if (!search) {
                    return true;
                }

                return getName(
                    member.user_id
                )
                    .toLowerCase()
                    .includes(search);

            }
        );

    dom.callMemberList.innerHTML =
        members.length
            ? members
                .map(
                    member => `
                        <label
                            class="call-member-row"
                        >

                            <input
                                type="checkbox"
                                value="${escapeAttribute(
                                    member.user_id
                                )}"
                                data-call-member
                            >

                            ${avatarHTML(
                                member.user_id,
                                "call"
                            )}

                            <span>
                                <strong>
                                    ${escapeHTML(
                                        getName(
                                            member.user_id
                                        )
                                    )}
                                </strong>

                                <small>
                                    ${escapeHTML(
                                        statusLabel(
                                            getStatus(
                                                member.user_id
                                            )
                                        )
                                    )}
                                </small>
                            </span>

                        </label>
                    `
                )
                .join("")
            :
                `
                <div class="empty-members">
                    No online members are available.
                </div>
                `;

    updateSelectedCallCount();

}


function updateSelectedCallCount() {

    const selected =
        dom.callMemberList
            ?.querySelectorAll(
                "[data-call-member]:checked"
            )
            .length ||
        0;

    if (dom.selectedCallMemberCount) {

        dom.selectedCallMemberCount.textContent =
            selected;

    }

}


function openCallPicker() {

    renderCallMembers();

    openModal(
        dom.callPickerModal
    );

}


async function startSelectedCall() {

    const selected =
        [
            ...(dom.callMemberList
                ?.querySelectorAll(
                    "[data-call-member]:checked"
                ) ||
                [])
        ]
            .map(
                input =>
                    input.value
            );

    if (!selected.length) {

        toast(
            "Select at least one online member."
        );

        return;
    }

    /*
     * The existing call UI remains the single
     * call entry point. Do not ask for UUIDs.
     */

    toast(
        `Call selected for ${selected.length} member${selected.length === 1 ? "" : "s"}.`
    );

    closeModal(
        dom.callPickerModal
    );

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
   EVENTS
   ============================================================ */

function setupEvents() {

    /* Home */

    dom.home?.addEventListener(
        "click",
        () => {

            window.location.href =
                "./dashboard.html";

        }
    );


    /* Mobile sidebar */

    dom.mobileSidebar
        ?.addEventListener(
            "click",
            () => {

                dom.channelSidebar
                    ?.classList.toggle(
                        "mobile-open"
                    );

            }
        );


    /* Channel search */

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


    /* Send */

    dom.sendMessage
        ?.addEventListener(
            "click",
            sendMessage
        );


    /* Composer */

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

                if (
                    event.key !==
                    "Enter"
                ) {

                    startTyping();

                }

            }
        );


    dom.messageInput
        ?.addEventListener(
            "input",
            () => {

                updateCharacterCount();

                if (
                    dom.messageInput.value.trim()
                ) {

                    startTyping();

                } else {

                    stopTyping();

                }

            }
        );


    /* Attachment */

    dom.attachmentInput
        ?.addEventListener(
            "change",
            handleAttachmentSelection
        );

    dom.attachButton
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();

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


    /* Voice */

    dom.voiceButton
        ?.addEventListener(
            "click",
            toggleVoiceRecording
        );


    /* Emoji */

    dom.emojiButton
        ?.addEventListener(
            "click",
            event => {

                event.stopPropagation();

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

    dom.emojiSearch
        ?.addEventListener(
            "input",
            () => {

                renderEmojiGrid(
                    dom.emojiSearch.value
                );

            }
        );


    /* Stickers */

    dom.stickerButton
        ?.addEventListener(
            "click",
            event => {

                event.stopPropagation();

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


    /* GIF */

    dom.gifButton
        ?.addEventListener(
            "click",
            event => {

                event.stopPropagation();

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


    /* Members */

    dom.channelMembers
        ?.addEventListener(
            "click",
            () => {

                dom.memberSidebar
                    ?.classList.add(
                        "open"
                    );

                renderMembers();

            }
        );

    dom.closeMemberSidebar
        ?.addEventListener(
            "click",
            () => {

                dom.memberSidebar
                    ?.classList.remove(
                        "open"
                    );

            }
        );

    dom.memberSearch
        ?.addEventListener(
            "input",
            () => {

                state.memberSearch =
                    dom.memberSearch.value;

                renderMembers();

            }
        );


    /* Message search */

    dom.channelSearchButton
        ?.addEventListener(
            "click",
            () => {

                dom.messageSearchBar
                    ?.classList.remove(
                        "hidden"
                    );

                dom.messageSearchInput
                    ?.focus();

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

                dom.messageSearchBar
                    ?.classList.add(
                        "hidden"
                    );

                renderMessages();

            }
        );


    /* Profile */

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


    /* Friends */

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


    /* General call */

    dom.generalCall
        ?.addEventListener(
            "click",
            () => {

                openCallPicker();

            }
        );

    dom.communityCall
        ?.addEventListener(
            "click",
            () => {

                openCallPicker();

            }
        );

    dom.closeCallPicker
        ?.addEventListener(
            "click",
            () => {

                closeModal(
                    dom.callPickerModal
                );

            }
        );

    dom.callMemberSearch
        ?.addEventListener(
            "input",
            renderCallMembers
        );

    dom.callMemberList
        ?.addEventListener(
            "change",
            updateSelectedCallCount
        );

    dom.callSelectAll
        ?.addEventListener(
            "click",
            () => {

                const boxes =
                    dom.callMemberList
                        ?.querySelectorAll(
                            "[data-call-member]"
                        ) ||
                    [];

                const shouldSelect =
                    [
                        ...boxes
                    ].some(
                        box =>
                            !box.checked
                    );

                boxes.forEach(
                    box => {
                        box.checked =
                            shouldSelect;
                    }
                );

                updateSelectedCallCount();

            }
        );

    dom.startSelectedCall
        ?.addEventListener(
            "click",
            startSelectedCall
        );


    /* Message actions */

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

                    return;

                }

                const reaction =
                    event.target.closest(
                        "[data-reaction-message]"
                    );

                if (reaction) {

                    toggleReaction(
                        reaction.dataset
                            .reactionMessage,

                        reaction.dataset
                            .reaction
                    );

                    return;

                }

                const add =
                    event.target.closest(
                        "[data-add-reaction]"
                    );

                if (add) {

                    const emojis =
                        [
                            "👍",
                            "❤️",
                            "😂",
                            "👏",
                            "🔥",
                            "🙏"
                        ];

                    const emoji =
                        window.prompt(
                            "Choose a reaction:\n👍 ❤️ 😂 👏 🔥 🙏",
                            "👍"
                        );

                    if (
                        emoji &&
                        emojis.includes(
                            emoji
                        )
                    ) {

                        toggleReaction(
                            add.dataset
                                .addReaction,
                            emoji
                        );

                    }

                }

            }
        );


    /* Outside picker */

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


    /* Modal background */

    document.addEventListener(
        "click",
        event => {

            const modal =
                event.target.closest(
                    ".modal"
                );

            if (
                modal &&
                event.target === modal
            ) {

                closeModal(
                    modal
                );

            }

        }
    );


    setupMessageSearch();

}


/* ============================================================
   WINDOW CLEANUP
   ============================================================ */

window.addEventListener(
    "beforeunload",
    () => {

        clearInterval(
            state.heartbeat
        );

        clearTimeout(
            state.typingTimer
        );

        clearTimeout(
            state.awayTimer
        );

        if (
            state.voiceStream
        ) {

            state.voiceStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

        }

        state.realtime.forEach(
            channel => {

                try {
                    supabase.removeChannel(
                        channel
                    );
                } catch (_) {}

            }
        );

    }
);


/* ============================================================
   INITIALIZATION
   ============================================================ */

async function init() {

    if (state.initialized) {
        return;
    }

    state.initialized =
        true;

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

        updateVoiceButton();

        updateCharacterCount();

        await loadProfilesForUsers([
            state.user.id
        ]);

        await startPresence();

        setupActivityTracking();

        await loadCommunities();

        updateHeaderPresence();

        renderSidebarUser();

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
            once:
                true
        }
    );

} else {

    init();

}
