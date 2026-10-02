/* ============================================================
   MWANIKI SCHOLARS
   COMMUNITY + CHAT + CALL ENGINE
   COMPLETE REPLACEMENT
   ============================================================ */

import { supabase } from "./supabase.js";

const COMMUNITY_ENGINE_KEY = "__MWANIKI_COMMUNITY_ENGINE__";

if (window[COMMUNITY_ENGINE_KEY]) {
    console.warn("⚠️ Mwaniki Community Engine already loaded. Duplicate load blocked.");
} else {

window[COMMUNITY_ENGINE_KEY] = true;

console.log("🚀 Mwaniki Scholars Community Engine loading...");


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
    currentCourse: null,

    currentRole: "student",

    currentReply: null,

    channelSearch: "",
    memberSearch: "",
    messageSearch: "",

    profileCache: new Map(),

    realtimeChannels: [],

    presenceTimer: null,

    initialized: false,

    loadingMessages: false,
    sendingMessage: false,

    /* ---------------- CALL STATE ---------------- */

    call: {
        active: false,

        room: null,

        roomId: null,

        callType: "video",

        callScope: "general",

        callerId: null,

        participants: new Map(),

        peerConnections: new Map(),

        pendingIce: new Map(),

        localStream: null,

        screenStream: null,

        muted: false,

        cameraOff: false,

        minimized: false,

        timerInterval: null,

        startedAt: null,

        realtimeChannel: null,

        participantSyncInterval: null,

        pendingIncoming: null,

        selectedUsers: new Set(),

        pickerScope: "general",

        pickerCallType: "video",

        selectedDirectUser: null
    }
};


/* ============================================================
   STORAGE
   ============================================================ */

const STORAGE = {

    communityId: "mwanikiCommunityId",

    communityName: "mwanikiCommunityName",

    courseId: "mwanikiCommunityCourseId",

    courseName: "mwanikiCommunityCourseName"
};


/* ============================================================
   ROLE ORDER
   ============================================================ */

const ROLE_ORDER = {

    super_admin: 5,

    admin: 4,

    moderator: 3,

    tutor: 2,

    student: 1
};


/* ============================================================
   DOM HELPERS
   ============================================================ */

function byId(id) {
    return document.getElementById(id);
}

function query(selector, parent = document) {
    return parent.querySelector(selector);
}

function queryAll(selector, parent = document) {
    return [...parent.querySelectorAll(selector)];
}

function showElement(element) {

    if (!element) return;

    element.classList.remove("hidden");

    element.style.display = "";
}

function hideElement(element) {

    if (!element) return;

    element.classList.add("hidden");

    element.style.display = "none";
}

function setText(idOrElement, value) {

    const element =
        typeof idOrElement === "string"
            ? byId(idOrElement)
            : idOrElement;

    if (!element) return;

    element.textContent =
        value === null || value === undefined
            ? ""
            : String(value);
}


/* ============================================================
   ESCAPE HTML
   ============================================================ */

function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* ============================================================
   SLUGIFY
   ============================================================ */

function slugify(value) {

    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}


/* ============================================================
   TOAST
   ============================================================ */

function toast(message, type = "info") {

    const element = byId("communityToast");

    if (!element) {

        console.log(`[${type}] ${message}`);

        return;
    }

    element.textContent = message;

    element.dataset.type = type;

    showElement(element);

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {

        hideElement(element);

    }, 3500);
}


/* ============================================================
   CURRENT USER NAME
   ============================================================ */

function getDisplayName(profile = state.profile, user = state.user) {

    return (

        profile?.full_name ||

        profile?.name ||

        profile?.student_name ||

        profile?.display_name ||

        user?.user_metadata?.full_name ||

        user?.user_metadata?.name ||

        user?.user_metadata?.display_name ||

        user?.email?.split("@")[0] ||

        "Student"

    );
}


/* ============================================================
   PROFILE PHOTO
   ============================================================ */

function getProfilePhoto(profile) {

    if (!profile) return "";

    return (

        profile.photo_url ||

        profile.profile_photo ||

        profile.profile_image ||

        profile.avatar_url ||

        profile.image_url ||

        profile.photo ||

        ""

    );
}


/* ============================================================
   INITIALS
   ============================================================ */

function getInitials(name) {

    const words = String(name || "Student")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!words.length) return "S";

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


/* ============================================================
   AVATAR HTML
   ============================================================ */

function avatarHTML(profile, name, size = 42) {

    const photo = getProfilePhoto(profile);

    const initials = getInitials(name);

    if (photo) {

        return `
            <img
                class="mwaniki-user-avatar"
                src="${escapeHTML(photo)}"
                alt="${escapeHTML(name)}"
                width="${size}"
                height="${size}"
                loading="lazy"
                decoding="async"
                style="
                    width:${size}px;
                    height:${size}px;
                    min-width:${size}px;
                    max-width:${size}px;
                    min-height:${size}px;
                    max-height:${size}px;
                    object-fit:cover;
                    border-radius:50%;
                    display:block;
                    flex:none;
                "
                onerror="
                    this.style.display='none';
                    if(this.nextElementSibling){
                        this.nextElementSibling.style.display='flex';
                    }
                "
            >

            <span
                class="mwaniki-avatar-fallback"
                style="
                    width:${size}px;
                    height:${size}px;
                    min-width:${size}px;
                    max-width:${size}px;
                    min-height:${size}px;
                    max-height:${size}px;
                    display:none;
                    align-items:center;
                    justify-content:center;
                    border-radius:50%;
                    flex:none;
                "
            >
                ${escapeHTML(initials)}
            </span>
        `;

    }

    return `
        <span
            class="mwaniki-avatar-fallback"
            style="
                width:${size}px;
                height:${size}px;
                min-width:${size}px;
                max-width:${size}px;
                min-height:${size}px;
                max-height:${size}px;
                display:flex;
                align-items:center;
                justify-content:center;
                border-radius:50%;
                flex:none;
            "
        >
            ${escapeHTML(initials)}
        </span>
    `;
}


/* ============================================================
   AUTHENTICATION
   ============================================================ */

async function loadAuthenticatedUser() {

    const {
        data,
        error
    } = await supabase.auth.getSession();

    if (error) {

        console.error("Authentication error:", error);

        throw error;
    }

    state.user = data?.session?.user || null;

    if (!state.user) {

        console.warn("No authenticated user.");

        toast(
            "Please sign in to use the community.",
            "warning"
        );

        return false;
    }

    console.log(
        "Authenticated user:",
        state.user.id
    );

    return true;
}


/* ============================================================
   PROFILE
   ============================================================ */

async function loadCurrentProfile() {

    if (!state.user) return;

    const {
        data,
        error
    } = await supabase
        .from("students")
        .select("*")
        .eq("id", state.user.id)
        .maybeSingle();

    if (error) {

        console.warn(
            "Student profile lookup failed:",
            error
        );

        state.profile = {

            id: state.user.id,

            full_name:
                state.user.user_metadata?.full_name ||
                state.user.user_metadata?.name ||
                state.user.email?.split("@")[0],

            photo_url:
                state.user.user_metadata?.photo_url ||
                state.user.user_metadata?.avatar_url ||
                ""
        };

    } else {

        state.profile = data || {

            id: state.user.id
        };
    }

    state.profileCache.set(
        state.user.id,
        state.profile
    );

    updateHeaderProfile();
}


/* ============================================================
   HEADER PROFILE
   ============================================================ */

function updateHeaderProfile() {

    const name = getDisplayName();

    const photo = getProfilePhoto(
        state.profile
    );

    const headerAvatar = byId(
        "headerProfileAvatar"
    );

    const largeAvatar = byId(
        "profileLargeAvatar"
    );

    if (headerAvatar && photo) {

        headerAvatar.src = photo;

        headerAvatar.style.objectFit = "cover";

    }

    if (largeAvatar && photo) {

        largeAvatar.src = photo;

        largeAvatar.style.objectFit = "cover";
    }

    const profileName =
        byId("profileName");

    if (profileName) {

        profileName.textContent = name;
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
        .select("*")
        .order("created_at", {
            ascending: true
        });

    if (error) {

        console.error(
            "Courses failed:",
            error
        );

        state.courses = [];

        return;
    }

    state.courses = data || [];

    console.log(
        "Courses loaded:",
        state.courses.length
    );

    populateCourseSelects();
}


/* ============================================================
   COURSE SELECTS
   ============================================================ */

function populateCourseSelects() {

    const selects = [

        byId("communityCourseSelect"),

        byId("channelCourseSelect")
    ];

    selects.forEach(select => {

        if (!select) return;

        const currentValue =
            select.value;

        select.innerHTML = `
            <option value="">
                No course
            </option>
        `;

        state.courses.forEach(course => {

            const option =
                document.createElement("option");

            option.value = course.id;

            option.textContent =
                course.title ||
                `Course ${course.id}`;

            select.appendChild(option);
        });

        if (currentValue) {

            select.value = currentValue;
        }
    });
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
        .select("*")
        .eq("is_active", true)
        .order("created_at", {
            ascending: true
        });

    if (error) {

        console.error(
            "Communities failed:",
            error
        );

        state.communities = [];

        renderCommunityError(
            error.message
        );

        return;
    }

    state.communities = data || [];

    console.log(
        "Communities loaded:",
        state.communities.length
    );

    renderCommunities();
}


/* ============================================================
   COMMUNITY ERROR
   ============================================================ */

function renderCommunityError(message) {

    const rail = byId(
        "communityRail"
    );

    if (!rail) return;

    rail.innerHTML = `
        <div class="channel-loading">
            <strong>Unable to load communities.</strong>
            <br>
            <small>
                ${escapeHTML(message || "Unknown error")}
            </small>
        </div>
    `;
}


/* ============================================================
   RENDER COMMUNITIES
   ============================================================ */

function renderCommunities() {

    const rail = byId(
        "communityRail"
    );

    if (!rail) return;

    rail.innerHTML = "";

    if (!state.communities.length) {

        rail.innerHTML = `
            <div class="channel-loading">
                No communities found.
            </div>
        `;

        return;
    }

    state.communities.forEach(
        community => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "community-rail-item";

            button.dataset.communityId =
                community.id;

            const icon =
                community.icon_url;

            button.innerHTML = `

                <span
                    class="community-rail-icon"
                >

                    ${
                        icon
                            ? `
                                <img
                                    src="${escapeHTML(icon)}"
                                    alt=""
                                    style="
                                        width:42px;
                                        height:42px;
                                        object-fit:cover;
                                        border-radius:50%;
                                    "
                                >
                            `
                            : escapeHTML(
                                getInitials(
                                    community.name
                                )
                            )
                    }

                </span>

                <span class="community-rail-name">
                    ${escapeHTML(
                        community.name
                    )}
                </span>

            `;

            button.addEventListener(
                "click",
                () => selectCommunity(community.id)
            );

            rail.appendChild(button);
        }
    );

    highlightActiveCommunity();
}


/* ============================================================
   HIGHLIGHT COMMUNITY
   ============================================================ */

function highlightActiveCommunity() {

    queryAll(
        ".community-rail-item"
    ).forEach(button => {

        button.classList.toggle(
            "active",
            String(button.dataset.communityId) ===
            String(state.currentCommunity?.id)
        );
    });
}


/* ============================================================
   SELECT COMMUNITY
   ============================================================ */

async function selectCommunity(
    communityId
) {

    const community =
        state.communities.find(
            item =>
                String(item.id) ===
                String(communityId)
        );

    if (!community) return;

    state.currentCommunity =
        community;

    localStorage.setItem(
        STORAGE.communityId,
        community.id
    );

    localStorage.setItem(
        STORAGE.communityName,
        community.name
    );

    state.currentChannel = null;

    state.channels = [];

    state.members = [];

    state.messages = [];

    highlightActiveCommunity();

    renderActiveCommunity();

    await ensureCommunityMembership();

    await Promise.all([

        loadChannels(),

        loadMembers()
    ]);

    await selectInitialChannel();
}


/* ============================================================
   ACTIVE COMMUNITY
   ============================================================ */

function renderActiveCommunity() {

    const community =
        state.currentCommunity;

    if (!community) return;

    setText(
        "activeCommunityName",
        community.name
    );

    setText(
        "activeCommunityDescription",
        community.description ||
        "Community"
    );

    const icon =
        byId("activeCommunityIcon");

    if (icon) {

        if (community.icon_url) {

            icon.src =
                community.icon_url;

            icon.style.display =
                "block";

        } else {

            icon.style.display =
                "none";
        }
    }

    setText(
        "communityCourseLabel",
        "Community"
    );

    setText(
        "communityCourseName",
        ""
    );
}


/* ============================================================
   COMMUNITY MEMBERSHIP
   ============================================================ */

async function ensureCommunityMembership() {

    if (
        !state.user ||
        !state.currentCommunity
    ) return;

    const {
        data,
        error
    } = await supabase
        .from("chat_community_members")
        .select("*")
        .eq(
            "community_id",
            state.currentCommunity.id
        )
        .eq(
            "user_id",
            state.user.id
        )
        .maybeSingle();

    if (error) {

        console.warn(
            "Membership lookup failed:",
            error
        );

        state.currentRole =
            "student";

        return;
    }

    if (data) {

        state.currentRole =
            data.role || "student";

        return;
    }

    const {
        data: inserted,
        error: insertError
    } = await supabase
        .from("chat_community_members")
        .insert({

            community_id:
                state.currentCommunity.id,

            user_id:
                state.user.id,

            role:
                "student"
        })
        .select("*")
        .maybeSingle();

    if (insertError) {

        console.warn(
            "Could not create membership:",
            insertError
        );

        state.currentRole =
            "student";

        return;
    }

    state.currentRole =
        inserted?.role ||
        "student";
}


/* ============================================================
   CHANNELS
   ============================================================ */

async function loadChannels() {

    const community =
        state.currentCommunity;

    if (!community) return;

    const {
        data,
        error
    } = await supabase
        .from("chat_channels")
        .select("*")
        .eq(
            "community_id",
            community.id
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

        state.channels = [];

        renderChannelError(
            error.message
        );

        return;
    }

    state.channels = data || [];

    console.log(
        "Channels loaded:",
        state.channels.length
    );

    renderChannels();
}


/* ============================================================
   CHANNEL ERROR
   ============================================================ */

function renderChannelError(message) {

    const list =
        byId("channelList");

    if (!list) return;

    list.innerHTML = `
        <div class="channel-loading">
            <strong>Unable to load channels.</strong>
            <br>
            <small>
                ${escapeHTML(message || "")}
            </small>
        </div>
    `;
}


/* ============================================================
   RENDER CHANNELS
   ============================================================ */

function renderChannels() {

    const list =
        byId("channelList");

    if (!list) return;

    list.innerHTML = "";

    const search =
        state.channelSearch
            .trim()
            .toLowerCase();

    const channels =
        state.channels.filter(channel => {

            if (!search) return true;

            return (

                String(channel.name || "")
                    .toLowerCase()
                    .includes(search)

                ||

                String(channel.description || "")
                    .toLowerCase()
                    .includes(search)
            );
        });

    if (!channels.length) {

        list.innerHTML = `
            <div class="channel-loading">
                No channels found.
            </div>
        `;

        return;
    }

    channels.forEach(channel => {

        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            "channel-list-item";

        button.dataset.channelId =
            channel.id;

        const icon =
            channel.icon ||
            "#";

        button.innerHTML = `

            <span class="channel-icon">
                ${escapeHTML(icon)}
            </span>

            <span class="channel-item-content">

                <strong>
                    ${escapeHTML(
                        channel.name ||
                        "channel"
                    )}
                </strong>

                ${
                    channel.description
                        ? `
                            <small>
                                ${escapeHTML(
                                    channel.description
                                )}
                            </small>
                        `
                        : ""
                }

            </span>

        `;

        button.addEventListener(
            "click",
            () => selectChannel(channel.id)
        );

        list.appendChild(button);
    });

    highlightActiveChannel();
}


/* ============================================================
   SELECT INITIAL CHANNEL
   ============================================================ */

async function selectInitialChannel() {

    if (!state.channels.length) {

        renderMessagesEmpty(
            "No channels are available in this community."
        );

        return;
    }

    const saved =
        localStorage.getItem(
            "mwanikiChannelId"
        );

    const channel =
        state.channels.find(
            item =>
                String(item.id) ===
                String(saved)
        ) ||
        state.channels[0];

    await selectChannel(
        channel.id
    );
}


/* ============================================================
   SELECT CHANNEL
   ============================================================ */

async function selectChannel(channelId) {

    const channel =
        state.channels.find(
            item =>
                String(item.id) ===
                String(channelId)
        );

    if (!channel) return;

    state.currentChannel =
        channel;

    localStorage.setItem(
        "mwanikiChannelId",
        channel.id
    );

    setText(
        "activeChannelName",
        channel.name ||
        "Channel"
    );

    setText(
        "activeChannelDescription",
        channel.description || ""
    );

    const roleBadge =
        byId("activeRoleBadge");

    if (roleBadge) {

        roleBadge.textContent =
            state.currentRole;
    }

    const course =
        state.courses.find(
            item =>
                String(item.id) ===
                String(channel.course_id)
        );

    state.currentCourse =
        course || null;

    if (course) {

        localStorage.setItem(
            STORAGE.courseId,
            course.id
        );

        localStorage.setItem(
            STORAGE.courseName,
            course.title
        );

        setText(
            "communityCourseName",
            course.title
        );

        setText(
            "communityCourseLabel",
            "Course"
        );

    } else {

        setText(
            "communityCourseName",
            ""
        );

        setText(
            "communityCourseLabel",
            "Community"
        );
    }

    highlightActiveChannel();

    await loadMessages();
}


/* ============================================================
   HIGHLIGHT CHANNEL
   ============================================================ */

function highlightActiveChannel() {

    queryAll(
        ".channel-list-item"
    ).forEach(button => {

        button.classList.toggle(
            "active",
            String(button.dataset.channelId) ===
            String(state.currentChannel?.id)
        );
    });
}


/* ============================================================
   MEMBERS
   ============================================================ */

async function loadMembers() {

    if (!state.currentCommunity) return;

    const {
        data,
        error
    } = await supabase
        .from("chat_community_members")
        .select("*")
        .eq(
            "community_id",
            state.currentCommunity.id
        )
        .order(
            "joined_at",
            {
                ascending: true
            }
        );

    if (error) {

        console.error(
            "Members failed:",
            error
        );

        state.members = [];

        renderMembers();

        return;
    }

    state.members = data || [];

    await enrichProfiles(
        state.members.map(
            member => member.user_id
        )
    );

    renderMembers();
}


/* ============================================================
   PROFILE ENRICHMENT
   ============================================================ */

async function enrichProfiles(userIds) {

    const ids = [
        ...new Set(
            userIds
                .filter(Boolean)
                .map(String)
        )
    ];

    const missing =
        ids.filter(
            id =>
                !state.profileCache.has(id)
        );

    if (!missing.length) return;

    const {
        data,
        error
    } = await supabase
        .from("students")
        .select("*")
        .in("id", missing);

    if (error) {

        console.warn(
            "Profile enrichment failed:",
            error
        );

        return;
    }

    (data || []).forEach(profile => {

        state.profileCache.set(
            String(profile.id),
            profile
        );
    });
}


/* ============================================================
   GET PROFILE
   ============================================================ */

function getCachedProfile(userId) {

    if (!userId) return null;

    return state.profileCache.get(
        String(userId)
    ) || null;
}


/* ============================================================
   RENDER MEMBERS
   ============================================================ */

function renderMembers() {

    const list =
        byId("memberList");

    if (!list) return;

    const search =
        state.memberSearch
            .trim()
            .toLowerCase();

    let members =
        state.members;

    if (search) {

        members =
            members.filter(member => {

                const profile =
                    getCachedProfile(
                        member.user_id
                    );

                const name =
                    getDisplayName(
                        profile,
                        member.user_id ===
                        state.user?.id
                            ? state.user
                            : null
                    );

                return name
                    .toLowerCase()
                    .includes(search);
            });
    }

    setText(
        "memberCount",
        state.members.length
    );

    list.innerHTML = "";

    if (!members.length) {

        list.innerHTML = `
            <div class="channel-loading">
                No members found.
            </div>
        `;

        return;
    }

    members.forEach(member => {

        const profile =
            getCachedProfile(
                member.user_id
            );

        const name =
            getDisplayName(
                profile,
                member.user_id ===
                state.user?.id
                    ? state.user
                    : null
            );

        const row =
            document.createElement("div");

        row.className =
            "community-member-row";

        row.innerHTML = `

            <div
                class="community-member-avatar"
            >
                ${avatarHTML(
                    profile,
                    name,
                    40
                )}
            </div>

            <div
                class="community-member-info"
                style="
                    min-width:0;
                    overflow:hidden;
                "
            >

                <strong
                    style="
                        display:block;
                        overflow:hidden;
                        text-overflow:ellipsis;
                        white-space:nowrap;
                    "
                >
                    ${escapeHTML(name)}
                </strong>

                <small>
                    ${escapeHTML(
                        member.role ||
                        "student"
                    )}
                </small>

            </div>

            ${
                member.user_id !==
                state.user?.id
                    ? `
                        <button
                            type="button"
                            class="member-call-button"
                            data-direct-call
                            data-user-id="${escapeHTML(
                                member.user_id
                            )}"
                            title="Call ${escapeHTML(name)}"
                        >
                            📞
                        </button>
                    `
                    : ""
            }

        `;

        list.appendChild(row);
    });
}


/* ============================================================
   MESSAGES
   ============================================================ */

async function loadMessages() {

    const channel =
        state.currentChannel;

    if (!channel) {

        renderMessagesEmpty(
            "Select a channel."
        );

        return;
    }

    state.loadingMessages = true;

    renderMessagesLoading();

    const {
        data,
        error
    } = await supabase
        .from("chat_messages")
        .select("*")
        .eq(
            "channel_id",
            channel.id
        )
        .order(
            "created_at",
            {
                ascending: true
            }
        )
        .limit(500);

    state.loadingMessages = false;

    if (error) {

        console.error(
            "Messages failed:",
            error
        );

        renderMessagesEmpty(
            `Unable to load messages: ${error.message}`
        );

        return;
    }

    state.messages =
        data || [];

    await enrichProfiles(
        state.messages.map(
            message =>
                message.user_id
        )
    );

    renderMessages();
}


/* ============================================================
   MESSAGE LOADING
   ============================================================ */

function renderMessagesLoading() {

    const list =
        byId("messageList");

    if (!list) return;

    list.innerHTML = `
        <div class="channel-loading">
            Loading messages...
        </div>
    `;
}


/* ============================================================
   MESSAGE EMPTY
   ============================================================ */

function renderMessagesEmpty(message) {

    const list =
        byId("messageList");

    if (!list) return;

    list.innerHTML = `
        <div class="channel-loading">
            ${escapeHTML(message)}
        </div>
    `;
}


/* ============================================================
   RENDER MESSAGES
   ============================================================ */

function renderMessages() {

    const list =
        byId("messageList");

    if (!list) return;

    const search =
        state.messageSearch
            .trim()
            .toLowerCase();

    let messages =
        state.messages;

    if (search) {

        messages =
            messages.filter(message => {

                return String(
                    message.content || ""
                )
                    .toLowerCase()
                    .includes(search);
            });
    }

    list.innerHTML = "";

    if (!messages.length) {

        renderMessagesEmpty(
            search
                ? "No matching messages."
                : "No messages yet. Start the conversation."
        );

        return;
    }

    messages.forEach(message => {

        const profile =
            getCachedProfile(
                message.user_id
            );

        const name =
            getDisplayName(
                profile,
                message.user_id ===
                state.user?.id
                    ? state.user
                    : null
            );

        const article =
            document.createElement("article");

        article.className =
            "chat-message";

        article.dataset.messageId =
            message.id;

        const time =
            message.created_at
                ? new Date(
                    message.created_at
                ).toLocaleString()
                : "";

        article.innerHTML = `

            <div
                class="chat-message-avatar"
                style="
                    width:44px;
                    min-width:44px;
                    max-width:44px;
                    height:44px;
                    overflow:hidden;
                    border-radius:50%;
                    flex:none;
                "
            >
                ${avatarHTML(
                    profile,
                    name,
                    44
                )}
            </div>

            <div
                class="chat-message-content"
                style="
                    min-width:0;
                    max-width:calc(100% - 56px);
                    overflow:hidden;
                "
            >

                <div
                    class="chat-message-header"
                    style="
                        display:flex;
                        align-items:center;
                        gap:8px;
                        min-width:0;
                    "
                >

                    <strong
                        style="
                            overflow:hidden;
                            text-overflow:ellipsis;
                            white-space:nowrap;
                        "
                    >
                        ${escapeHTML(name)}
                    </strong>

                    <time>
                        ${escapeHTML(time)}
                    </time>

                </div>

                <div
                    class="chat-message-text"
                    style="
                        overflow-wrap:anywhere;
                        word-break:break-word;
                    "
                >
                    ${escapeHTML(
                        message.content || ""
                    ).replaceAll("\n", "<br>")}
                </div>

            </div>
        `;

        list.appendChild(article);
    });

    list.scrollTop =
        list.scrollHeight;
}


/* ============================================================
   SEND MESSAGE
   ============================================================ */

async function sendMessage() {

    if (
        state.sendingMessage ||
        !state.user ||
        !state.currentChannel
    ) return;

    const input =
        byId("messageInput");

    if (!input) return;

    const content =
        input.value.trim();

    if (!content) return;

    state.sendingMessage = true;

    const button =
        byId("sendMessageButton");

    if (button) {

        button.disabled = true;
    }

    const payload = {

        channel_id:
            state.currentChannel.id,

        user_id:
            state.user.id,

        content
    };

    let result =
        await supabase
            .from("chat_messages")
            .insert(payload)
            .select("*")
            .maybeSingle();

    if (
        result.error &&
        state.currentReply
    ) {

        console.warn(
            "Message insert error:",
            result.error
        );
    }

    if (result.error) {

        console.error(
            "Send message failed:",
            result.error
        );

        toast(
            result.error.message,
            "error"
        );

    } else {

        input.value = "";

        state.currentReply =
            null;

        hideReplyPreview();

        if (result.data) {

            state.messages.push(
                result.data
            );

            await enrichProfiles([
                result.data.user_id
            ]);

            renderMessages();
        }
    }

    state.sendingMessage = false;

    if (button) {

        button.disabled = false;
    }
}


/* ============================================================
   REPLY
   ============================================================ */

function hideReplyPreview() {

    hideElement(
        byId("replyPreview")
    );
}

function cancelReply() {

    state.currentReply =
        null;

    hideReplyPreview();
}


/* ============================================================
   PRESENCE
   ============================================================ */

async function setOnlinePresence() {

    if (!state.user) return;

    const now =
        new Date().toISOString();

    const {
        error
    } = await supabase
        .from("chat_presence")
        .upsert({

            user_id:
                state.user.id,

            status:
                "online",

            last_seen_at:
                now,

            updated_at:
                now

        }, {
            onConflict:
                "user_id"
        });

    if (error) {

        console.error(
            "Presence update failed:",
            error
        );

        return;
    }

    console.log(
        "🟢 Presence online"
    );
}


/* ============================================================
   OFFLINE PRESENCE
   ============================================================ */

async function setOfflinePresence() {

    if (!state.user) return;

    await supabase
        .from("chat_presence")
        .update({

            status:
                "offline",

            last_seen_at:
                new Date().toISOString(),

            updated_at:
                new Date().toISOString()

        })
        .eq(
            "user_id",
            state.user.id
        );
}


/* ============================================================
   PRESENCE HEARTBEAT
   ============================================================ */

function startPresenceHeartbeat() {

    clearInterval(
        state.presenceTimer
    );

    state.presenceTimer =
        setInterval(
            setOnlinePresence,
            60000
        );
}


/* ============================================================
   ONLINE USERS
   ============================================================ */

async function loadOnlineUsers(
    scope = "general"
) {

    if (!state.user) {

        throw new Error(
            "You must be signed in."
        );
    }

    console.log(
        "📞 Loading online users...",
        scope
    );

    const {
        data: presenceRows,
        error: presenceError
    } = await supabase
        .from("chat_presence")
        .select(
            "user_id,status,last_seen_at,updated_at"
        )
        .eq(
            "status",
            "online"
        );

    if (presenceError) {

        console.error(
            "Online presence query failed:",
            presenceError
        );

        throw presenceError;
    }

    const now =
        Date.now();

    const recentUsers =
        (presenceRows || [])
            .filter(row => {

                if (
                    String(row.user_id) ===
                    String(state.user.id)
                ) {
                    return false;
                }

                const timestamp =
                    row.last_seen_at ||
                    row.updated_at;

                if (!timestamp) return true;

                return (
                    now -
                    new Date(timestamp).getTime()
                ) <
                5 * 60 * 1000;
            });

    let userIds =
        recentUsers.map(
            row => row.user_id
        );

    /* ---------------------------------------------
       COMMUNITY FILTER
       --------------------------------------------- */

    if (
        scope === "community" &&
        state.currentCommunity
    ) {

        const {
            data: members,
            error: memberError
        } = await supabase
            .from("chat_community_members")
            .select("user_id")
            .eq(
                "community_id",
                state.currentCommunity.id
            );

        if (memberError) {

            console.warn(
                "Community member filtering failed:",
                memberError
            );

        } else {

            const memberIds =
                new Set(
                    (members || [])
                        .map(
                            item =>
                                String(
                                    item.user_id
                                )
                        )
                );

            userIds =
                userIds.filter(
                    id =>
                        memberIds.has(
                            String(id)
                        )
                );
        }
    }

    userIds = [
        ...new Set(
            userIds.map(String)
        )
    ];

    if (!userIds.length) {

        console.log(
            "📞 No online users available."
        );

        return [];
    }

    /* ---------------------------------------------
       LOAD REAL STUDENT PROFILES
       --------------------------------------------- */

    await enrichProfiles(userIds);

    let profiles = [];

    const missingIds =
        userIds.filter(
            id =>
                !state.profileCache.has(id)
        );

    if (missingIds.length) {

        const {
            data,
            error
        } = await supabase
            .from("students")
            .select("*")
            .in(
                "id",
                missingIds
            );

        if (error) {

            console.warn(
                "Online user profiles failed:",
                error
            );

        } else {

            (data || []).forEach(profile => {

                state.profileCache.set(
                    String(profile.id),
                    profile
                );
            });
        }
    }

    profiles =
        userIds.map(userId => {

            const profile =
                getCachedProfile(userId);

            const presence =
                recentUsers.find(
                    row =>
                        String(
                            row.user_id
                        ) ===
                        String(userId)
                );

            return {

                user_id:
                    userId,

                profile:
                    profile || null,

                presence:
                    presence || null,

                name:
                    getDisplayName(
                        profile
                    ),

                photo:
                    getProfilePhoto(
                        profile
                    )
            };
        });

    console.log(
        "📞 Online users found:",
        profiles.length
    );

    return profiles;
}


/* ============================================================
   GENERAL CALL MODAL
   ============================================================ */

async function openCallPicker(
    scope = "general",
    callType = "video",
    directUserId = null
) {

    state.call.pickerScope =
        scope;

    state.call.pickerCallType =
        callType;

    state.call.selectedUsers =
        new Set();

    state.call.selectedDirectUser =
        directUserId;

    const modal =
        byId("generalCallModal");

    if (!modal) {

        toast(
            "Call interface is missing from the page.",
            "error"
        );

        return;
    }

    const title =
        query(
            "#generalCallModal h2"
        ) ||
        query(
            "#generalCallModal .modal-title"
        );

    if (title) {

        title.textContent =
            directUserId
                ? "Call user"
                : scope === "community"
                    ? "Call community members"
                    : "Start a general call";
    }

    const oldInput =
        byId("generalCallUserInput");

    if (oldInput) {

        oldInput.style.display =
            "none";
    }

    const list =
        byId("generalCallUserList");

    if (!list) {

        toast(
            "Online user picker is missing from community.html.",
            "error"
        );

        return;
    }

    showElement(modal);

    list.innerHTML = `
        <div class="channel-loading">
            Loading online users...
        </div>
    `;

    setText(
        "generalCallUserStatus",
        "Searching for online users..."
    );

    setText(
        "generalCallSelectionCount",
        "0 users selected"
    );

    try {

        const users =
            await loadOnlineUsers(
                scope
            );

        if (
            directUserId &&
            users.length
        ) {

            const found =
                users.find(
                    user =>
                        String(user.user_id) ===
                        String(directUserId)
                );

            if (found) {

                state.call.selectedUsers.add(
                    String(found.user_id)
                );
            }
        }

        renderOnlineUserPicker(
            users
        );

    } catch (error) {

        console.error(
            "Call picker failed:",
            error
        );

        list.innerHTML = `
            <div class="channel-loading">

                <strong>
                    Could not load online users.
                </strong>

                <br>

                <small>
                    ${escapeHTML(
                        error.message ||
                        "Unknown error"
                    )}
                </small>

            </div>
        `;

        setText(
            "generalCallUserStatus",
            "Online user loading failed."
        );
    }
}


/* ============================================================
   RENDER ONLINE USER PICKER
   ============================================================ */

function renderOnlineUserPicker(users) {

    const list =
        byId("generalCallUserList");

    if (!list) return;

    list.innerHTML = "";

    if (!users.length) {

        list.innerHTML = `
            <div class="channel-loading">

                <strong>
                    No other online users found.
                </strong>

                <br>

                <small>
                    Users must have an active online presence.
                </small>

            </div>
        `;

        setText(
            "generalCallUserStatus",
            "No other online users."
        );

        updateCallSelectionCount();

        return;
    }

    setText(
        "generalCallUserStatus",
        `${users.length} online user${users.length === 1 ? "" : "s"} found`
    );

    users.forEach(user => {

        const row =
            document.createElement("label");

        row.className =
            "general-call-user-option";

        row.dataset.userId =
            user.user_id;

        const selected =
            state.call.selectedUsers.has(
                String(user.user_id)
            );

        row.innerHTML = `

            <input
                type="checkbox"
                class="general-call-user-checkbox"
                value="${escapeHTML(
                    user.user_id
                )}"
                ${selected ? "checked" : ""}
            >

            <span
                class="general-call-user-avatar"
                style="
                    width:46px;
                    height:46px;
                    min-width:46px;
                    max-width:46px;
                    overflow:hidden;
                    border-radius:50%;
                    flex:none;
                "
            >
                ${avatarHTML(
                    user.profile,
                    user.name,
                    46
                )}
            </span>

            <span
                class="general-call-user-info"
                style="
                    min-width:0;
                    flex:1;
                    overflow:hidden;
                "
            >

                <strong
                    style="
                        display:block;
                        overflow:hidden;
                        text-overflow:ellipsis;
                        white-space:nowrap;
                    "
                >
                    ${escapeHTML(
                        user.name
                    )}
                </strong>

                <small>
                    🟢 Online
                </small>

            </span>

            <span
                class="general-call-selected-mark"
            >
                ✓
            </span>

        `;

        const checkbox =
            query(
                ".general-call-user-checkbox",
                row
            );

        checkbox.addEventListener(
            "change",
            event => {

                const id =
                    String(
                        event.target.value
                    );

                if (
                    event.target.checked
                ) {

                    state.call.selectedUsers.add(
                        id
                    );

                } else {

                    state.call.selectedUsers.delete(
                        id
                    );
                }

                row.classList.toggle(
                    "selected",
                    event.target.checked
                );

                updateCallSelectionCount();
            }
        );

        if (selected) {

            row.classList.add(
                "selected"
            );
        }

        list.appendChild(row);
    });

    updateCallSelectionCount();
}


/* ============================================================
   SELECTION COUNT
   ============================================================ */

function updateCallSelectionCount() {

    const count =
        state.call.selectedUsers.size;

    setText(
        "generalCallSelectionCount",
        `${count} user${count === 1 ? "" : "s"} selected`
    );
}


/* ============================================================
   CLOSE CALL PICKER
   ============================================================ */

function closeCallPicker() {

    hideElement(
        byId("generalCallModal")
    );

    state.call.selectedUsers =
        new Set();

    state.call.selectedDirectUser =
        null;
}


/* ============================================================
   CREATE CALL ROOM
   ============================================================ */

async function createCallRoom(
    userIds,
    callType,
    scope,
    communityId = null
) {

    if (!state.user) {

        throw new Error(
            "You must be signed in."
        );
    }

    const roomCode =
        `MS-${crypto.randomUUID()
            .slice(0, 8)
            .toUpperCase()}`;

    const {
        data: room,
        error: roomError
    } = await supabase
        .from("chat_call_rooms")
        .insert({

            community_id:
                communityId || null,

            room_code:
                roomCode,

            call_scope:
                scope,

            call_type:
                callType,

            status:
                "waiting",

            created_by:
                state.user.id
        })
        .select("*")
        .single();

    if (roomError) {

        console.error(
            "Call room creation failed:",
            roomError
        );

        throw roomError;
    }

    const participants = [

        {
            room_id:
                room.id,

            user_id:
                state.user.id,

            status:
                "joined",

            is_muted:
                false,

            is_camera_on:
                callType === "video",

            is_screen_sharing:
                false,

            joined_at:
                new Date().toISOString()
        },

        ...userIds
            .filter(
                id =>
                    String(id) !==
                    String(state.user.id)
            )
            .map(userId => ({

                room_id:
                    room.id,

                user_id:
                    userId,

                status:
                    "invited",

                is_muted:
                    false,

                is_camera_on:
                    false,

                is_screen_sharing:
                    false
            }))
    ];

    const {
        error: participantError
    } = await supabase
        .from("chat_call_participants")
        .insert(participants);

    if (participantError) {

        console.error(
            "Call participants creation failed:",
            participantError
        );

        await supabase
            .from("chat_call_rooms")
            .delete()
            .eq("id", room.id);

        throw participantError;
    }

    return room;
}


/* ============================================================
   START SELECTED CALL
   ============================================================ */

async function startSelectedCall() {

    const selected =
        [
            ...state.call.selectedUsers
        ];

    if (!selected.length) {

        toast(
            "Select at least one online user.",
            "warning"
        );

        return;
    }

    const callType =
        state.call.pickerCallType ||
        "video";

    const scope =
        state.call.pickerScope ||
        "general";

    const communityId =
        scope === "community"
            ? state.currentCommunity?.id ||
              null
            : null;

    try {

        const room =
            await createCallRoom(
                selected,
                callType,
                scope,
                communityId
            );

        closeCallPicker();

        await joinCall(
            room,
            callType
        );

    } catch (error) {

        console.error(
            "Start call failed:",
            error
        );

        toast(
            `Unable to start call: ${error.message}`,
            "error"
        );
    }
}


/* ============================================================
   START GENERAL VOICE
   ============================================================ */

async function startGeneralVoiceCall() {

    state.call.pickerCallType =
        "voice";

    await openCallPicker(
        state.call.pickerScope || "general",
        "voice"
    );
}


/* ============================================================
   START GENERAL VIDEO
   ============================================================ */

async function startGeneralVideoCall() {

    state.call.pickerCallType =
        "video";

    await openCallPicker(
        state.call.pickerScope || "general",
        "video"
    );
}


/* ============================================================
   CALL MEDIA
   ============================================================ */

async function getCallMedia(
    callType
) {

    if (!navigator.mediaDevices?.getUserMedia) {

        throw new Error(
            "Camera/microphone access is not available. Use HTTPS."
        );
    }

    return navigator.mediaDevices.getUserMedia({

        audio: true,

        video:
            callType === "video"
    });
}


/* ============================================================
   JOIN CALL
   ============================================================ */

async function joinCall(
    room,
    callType
) {

    if (
        state.call.active &&
        state.call.roomId !== room.id
    ) {

        await leaveCall();
    }

    state.call.active =
        true;

    state.call.room =
        room;

    state.call.roomId =
        room.id;

    state.call.callType =
        callType ||
        room.call_type ||
        "video";

    state.call.callScope =
        room.call_scope ||
        "general";

    state.call.startedAt =
        Date.now();

    try {

        state.call.localStream =
            await getCallMedia(
                state.call.callType
            );

    } catch (error) {

        console.error(
            "Media access failed:",
            error
        );

        state.call.active =
            false;

        toast(
            `Camera/microphone error: ${error.message}`,
            "error"
        );

        return;
    }

    await updateOwnParticipant(
        "joined"
    );

    await showCallOverlay();

    await setupCallRealtime();

    await syncCallParticipants();

    await loadPendingCallSignals();

    startCallTimer();

    clearInterval(
        state.call.participantSyncInterval
    );

    state.call.participantSyncInterval =
        setInterval(
            syncCallParticipants,
            3000
        );
}


/* ============================================================
   UPDATE OWN PARTICIPANT
   ============================================================ */

async function updateOwnParticipant(
    status
) {

    if (
        !state.call.roomId ||
        !state.user
    ) return;

    const values = {

        status,

        is_muted:
            state.call.muted,

        is_camera_on:
            !state.call.cameraOff &&
            state.call.callType === "video",

        updated_at:
            new Date().toISOString()
    };

    if (status === "joined") {

        values.joined_at =
            new Date().toISOString();
    }

    if (status === "left") {

        values.left_at =
            new Date().toISOString();
    }

    const {
        error
    } = await supabase
        .from("chat_call_participants")
        .update(values)
        .eq(
            "room_id",
            state.call.roomId
        )
        .eq(
            "user_id",
            state.user.id
        );

    if (error) {

        console.warn(
            "Participant status update failed:",
            error
        );
    }
}


/* ============================================================
   SHOW CALL OVERLAY
   ============================================================ */

async function showCallOverlay() {

    const overlay =
        byId("callOverlay");

    if (!overlay) return;

    showElement(overlay);

    setText(
        "callTitle",
        state.call.callScope === "community"
            ? state.currentCommunity?.name ||
              "Community Call"
            : "Mwaniki Call"
    );

    setText(
        "callSubtitle",
        state.call.callType === "video"
            ? "Video call"
            : "Voice call"
    );

    setText(
        "callDuration",
        "00:00"
    );

    const localVideo =
        byId("localVideo");

    if (localVideo) {

        localVideo.srcObject =
            state.call.localStream;

        localVideo.muted =
            true;

        localVideo.autoplay =
            true;

        localVideo.playsInline =
            true;

        if (
            state.call.callType ===
            "video"
        ) {

            localVideo.style.display =
                "block";

        } else {

            localVideo.style.display =
                "none";
        }
    }

    updateCallTypeControls();

    renderCallParticipants();
}


/* ============================================================
   CALL TYPE CONTROLS
   ============================================================ */

function updateCallTypeControls() {

    const camera =
        byId("toggleCameraButton");

    if (camera) {

        camera.disabled =
            state.call.callType !==
            "video";
    }

    const share =
        byId("shareScreenButton");

    if (share) {

        share.disabled =
            state.call.callType !==
            "video";
    }

    const icon =
        byId("callTypeIcon");

    if (icon) {

        icon.textContent =
            state.call.callType ===
            "video"
                ? "📹"
                : "📞";
    }
}


/* ============================================================
   CALL PARTICIPANTS
   ============================================================ */

async function syncCallParticipants() {

    if (
        !state.call.active ||
        !state.call.roomId
    ) return;

    const {
        data,
        error
    } = await supabase
        .from("chat_call_participants")
        .select("*")
        .eq(
            "room_id",
            state.call.roomId
        );

    if (error) {

        console.warn(
            "Call participants sync failed:",
            error
        );

        return;
    }

    const joined =
        (data || []).filter(
            participant =>
                participant.status ===
                "joined"
        );

    await enrichProfiles(
        joined.map(
            participant =>
                participant.user_id
        )
    );

    state.call.participants =
        new Map();

    joined.forEach(participant => {

        const profile =
            getCachedProfile(
                participant.user_id
            );

        state.call.participants.set(
            String(
                participant.user_id
            ),
            {

                ...participant,

                profile,

                name:
                    getDisplayName(
                        profile
                    )
            }
        );
    });

    renderCallParticipants();

    for (
        const participant
        of joined
    ) {

        if (
            String(
                participant.user_id
            ) ===
            String(state.user.id)
        ) {
            continue;
        }

        await ensurePeerConnection(
            participant.user_id,
            getDisplayName(
                getCachedProfile(
                    participant.user_id
                )
            )
        );
    }
}


/* ============================================================
   RENDER CALL PARTICIPANTS
   ============================================================ */

function renderCallParticipants() {

    const container =
        byId("callParticipants");

    if (!container) return;

    container.innerHTML = "";

    state.call.participants.forEach(
        participant => {

            const item =
                document.createElement("div");

            item.className =
                "call-participant-item";

            item.innerHTML = `

                ${avatarHTML(
                    participant.profile,
                    participant.name,
                    36
                )}

                <span>
                    ${escapeHTML(
                        participant.name
                    )}
                </span>

            `;

            container.appendChild(item);
        }
    );
}


/* ============================================================
   PEER CONNECTION
   ============================================================ */

async function ensurePeerConnection(
    remoteUserId,
    remoteName
) {

    remoteUserId =
        String(remoteUserId);

    if (
        state.call.peerConnections.has(
            remoteUserId
        )
    ) {

        return state.call.peerConnections.get(
            remoteUserId
        );
    }

    const pc =
        new RTCPeerConnection({

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
        });

    state.call.peerConnections.set(
        remoteUserId,
        pc
    );

    pc.__remoteUserId =
        remoteUserId;

    pc.__remoteName =
        remoteName || "User";

    pc.__offerStarted =
        false;

    if (state.call.localStream) {

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

            if (!event.candidate) return;

            await sendCallSignal(
                remoteUserId,
                "ice-candidate",
                event.candidate.toJSON()
            );
        };

    pc.ontrack =
        event => {

            const stream =
                event.streams?.[0];

            if (!stream) return;

            renderRemoteStream(
                remoteUserId,
                remoteName,
                stream
            );
        };

    pc.onconnectionstatechange =
        () => {

            const connectionState =
                pc.connectionState;

            console.log(
                "📞 Peer connection:",
                remoteName,
                connectionState
            );

            if (
                connectionState ===
                "failed" ||
                connectionState ===
                "closed"
            ) {

                removeRemotePeer(
                    remoteUserId
                );
            }
        };

    /* ---------------------------------------------
       DETERMINISTIC INITIATOR
       --------------------------------------------- */

    if (
        String(state.user.id) <
        String(remoteUserId)
    ) {

        await createOffer(
            remoteUserId,
            pc
        );
    }

    return pc;
}


/* ============================================================
   CREATE OFFER
   ============================================================ */

async function createOffer(
    remoteUserId,
    pc
) {

    if (pc.__offerStarted) return;

    pc.__offerStarted =
        true;

    try {

        const offer =
            await pc.createOffer();

        await pc.setLocalDescription(
            offer
        );

        await sendCallSignal(
            remoteUserId,
            "offer",
            offer
        );

    } catch (error) {

        pc.__offerStarted =
            false;

        console.error(
            "Offer creation failed:",
            error
        );
    }
}


/* ============================================================
   SEND CALL SIGNAL
   ============================================================ */

async function sendCallSignal(
    receiverId,
    signalType,
    payload
) {

    if (
        !state.call.roomId ||
        !state.user
    ) return;

    const {
        error
    } = await supabase
        .from("chat_call_signals")
        .insert({

            room_id:
                state.call.roomId,

            sender_id:
                state.user.id,

            receiver_id:
                receiverId,

            signal_type:
                signalType,

            payload:
                payload
        });

    if (error) {

        console.error(
            "Call signal failed:",
            error
        );
    }
}


/* ============================================================
   HANDLE CALL SIGNAL
   ============================================================ */

async function handleCallSignal(
    signal
) {

    if (
        !state.call.active ||
        String(signal.room_id) !==
        String(state.call.roomId)
    ) return;

    if (
        String(signal.sender_id) ===
        String(state.user.id)
    ) return;

    const remoteUserId =
        String(signal.sender_id);

    const profile =
        getCachedProfile(
            remoteUserId
        );

    const remoteName =
        getDisplayName(
            profile
        );

    const pc =
        await ensurePeerConnection(
            remoteUserId,
            remoteName
        );

    try {

        if (
            signal.signal_type ===
            "offer"
        ) {

            await pc.setRemoteDescription(
                signal.payload
            );

            const answer =
                await pc.createAnswer();

            await pc.setLocalDescription(
                answer
            );

            await sendCallSignal(
                remoteUserId,
                "answer",
                answer
            );

            await flushPendingIce(
                remoteUserId,
                pc
            );

        } else if (
            signal.signal_type ===
            "answer"
        ) {

            await pc.setRemoteDescription(
                signal.payload
            );

            await flushPendingIce(
                remoteUserId,
                pc
            );

        } else if (
            signal.signal_type ===
            "ice-candidate"
        ) {

            const candidate =
                new RTCIceCandidate(
                    signal.payload
                );

            if (
                pc.remoteDescription
            ) {

                await pc.addIceCandidate(
                    candidate
                );

            } else {

                if (
                    !state.call.pendingIce.has(
                        remoteUserId
                    )
                ) {

                    state.call.pendingIce.set(
                        remoteUserId,
                        []
                    );
                }

                state.call.pendingIce
                    .get(remoteUserId)
                    .push(candidate);
            }

        } else if (
            signal.signal_type ===
            "leave"
        ) {

            removeRemotePeer(
                remoteUserId
            );
        }

    } catch (error) {

        console.error(
            "Call signal handling failed:",
            error
        );
    }
}


/* ============================================================
   FLUSH ICE
   ============================================================ */

async function flushPendingIce(
    remoteUserId,
    pc
) {

    const pending =
        state.call.pendingIce.get(
            remoteUserId
        ) || [];

    for (
        const candidate
        of pending
    ) {

        try {

            await pc.addIceCandidate(
                candidate
            );

        } catch (error) {

            console.warn(
                "ICE candidate failed:",
                error
            );
        }
    }

    state.call.pendingIce.delete(
        remoteUserId
    );
}


/* ============================================================
   REMOTE STREAM
   ============================================================ */

function renderRemoteStream(
    userId,
    name,
    stream
) {

    const grid =
        byId("callVideoGrid");

    if (!grid) return;

    let tile =
        document.querySelector(
            `[data-call-user-id="${CSS.escape(
                String(userId)
            )}"]`
        );

    if (!tile) {

        tile =
            document.createElement("div");

        tile.className =
            "call-video-tile";

        tile.dataset.callUserId =
            userId;

        tile.style.cssText = `
            position:relative;
            overflow:hidden;
            border-radius:12px;
            min-height:180px;
            background:#111;
        `;

        tile.innerHTML = `

            <video
                autoplay
                playsinline
                class="remote-call-video"
                style="
                    width:100%;
                    height:100%;
                    object-fit:cover;
                    display:block;
                "
            ></video>

            <span
                style="
                    position:absolute;
                    left:10px;
                    bottom:10px;
                    padding:4px 8px;
                    border-radius:6px;
                    background:rgba(0,0,0,.65);
                    color:#fff;
                    font-size:13px;
                "
            >
                ${escapeHTML(name)}
            </span>

        `;

        grid.appendChild(tile);
    }

    const video =
        query(
            "video",
            tile
        );

    if (!video) return;

    video.srcObject =
        stream;

    if (
        state.call.callType ===
        "voice"
    ) {

        video.style.display =
            "none";

        let audio =
            query(
                "audio",
                tile
            );

        if (!audio) {

            audio =
                document.createElement(
                    "audio"
                );

            audio.autoplay =
                true;

            tile.appendChild(
                audio
            );
        }

        audio.srcObject =
            stream;
    }
}


/* ============================================================
   REMOVE REMOTE PEER
   ============================================================ */

function removeRemotePeer(
    userId
) {

    userId =
        String(userId);

    const pc =
        state.call.peerConnections.get(
            userId
        );

    if (pc) {

        try {
            pc.close();
        } catch (_) {}

        state.call.peerConnections.delete(
            userId
        );
    }

    state.call.pendingIce.delete(
        userId
    );

    const tile =
        document.querySelector(
            `[data-call-user-id="${CSS.escape(
                userId
            )}"]`
        );

    if (tile) {

        tile.remove();
    }
}


/* ============================================================
   LOAD PENDING SIGNALS
   ============================================================ */

async function loadPendingCallSignals() {

    if (
        !state.call.roomId ||
        !state.user
    ) return;

    const {
        data,
        error
    } = await supabase
        .from("chat_call_signals")
        .select("*")
        .eq(
            "room_id",
            state.call.roomId
        )
        .eq(
            "receiver_id",
            state.user.id
        )
        .order(
            "created_at",
            {
                ascending: true
            }
        );

    if (error) {

        console.warn(
            "Pending call signals failed:",
            error
        );

        return;
    }

    for (
        const signal
        of data || []
    ) {

        await handleCallSignal(
            signal
        );
    }
}


/* ============================================================
   CALL REALTIME
   ============================================================ */

async function setupCallRealtime() {

    if (
        state.call.realtimeChannel
    ) {

        try {

            await supabase.removeChannel(
                state.call.realtimeChannel
            );

        } catch (_) {}
    }

    const roomId =
        state.call.roomId;

    const userId =
        state.user.id;

    const channel =
        supabase.channel(
            `mwaniki-call-${roomId}-${Date.now()}`
        );

    channel.on(
        "postgres_changes",
        {
            event: "*",
            schema: "public",
            table: "chat_call_participants",
            filter:
                `room_id=eq.${roomId}`
        },
        async payload => {

            console.log(
                "📞 Participant update:",
                payload.eventType
            );

            await syncCallParticipants();
        }
    );

    channel.on(
        "postgres_changes",
        {
            event: "INSERT",
            schema: "public",
            table: "chat_call_signals",
            filter:
                `receiver_id=eq.${userId}`
        },
        async payload => {

            await handleCallSignal(
                payload.new
            );
        }
    );

    channel.subscribe(
        status => {

            console.log(
                "📞 Call realtime:",
                status
            );
        }
    );

    state.call.realtimeChannel =
        channel;
}


/* ============================================================
   GLOBAL INCOMING CALL LISTENER
   ============================================================ */

let incomingListener = null;

function setupIncomingCallListener() {

    if (
        incomingListener ||
        !state.user
    ) return;

    incomingListener =
        supabase.channel(
            `mwaniki-incoming-calls-${state.user.id}`
        );

    incomingListener.on(
        "postgres_changes",
        {
            event: "INSERT",
            schema: "public",
            table: "chat_call_participants",
            filter:
                `user_id=eq.${state.user.id}`
        },
        async payload => {

            const participant =
                payload.new;

            if (
                participant.status !==
                "invited"
            ) return;

            await showIncomingCall(
                participant
            );
        }
    );

    incomingListener.subscribe(
        status => {

            console.log(
                "📞 Incoming call listener:",
                status
            );
        }
    );
}


/* ============================================================
   SHOW INCOMING CALL
   ============================================================ */

async function showIncomingCall(
    participant
) {

    if (
        state.call.active
    ) return;

    const {
        data: room,
        error
    } = await supabase
        .from("chat_call_rooms")
        .select("*")
        .eq(
            "id",
            participant.room_id
        )
        .maybeSingle();

    if (error || !room) return;

    if (
        room.status ===
        "ended"
    ) return;

    await enrichProfiles([
        room.created_by
    ]);

    const callerProfile =
        getCachedProfile(
            room.created_by
        );

    const callerName =
        getDisplayName(
            callerProfile
        );

    state.call.pendingIncoming = {

        room,

        participant,

        callerName
    };

    setText(
        "incomingCallTitle",
        `${callerName} is calling`
    );

    setText(
        "incomingCallText",
        room.call_type === "video"
            ? "Incoming video call"
            : "Incoming voice call"
    );

    showElement(
        byId("incomingCallToast")
    );
}


/* ============================================================
   ACCEPT INCOMING CALL
   ============================================================ */

async function acceptIncomingCall() {

    const incoming =
        state.call.pendingIncoming;

    if (!incoming) return;

    hideElement(
        byId("incomingCallToast")
    );

    state.call.pendingIncoming =
        null;

    const {
        room,
        participant
    } = incoming;

    const {
        error
    } = await supabase
        .from("chat_call_participants")
        .update({

            status:
                "joined",

            joined_at:
                new Date().toISOString()
        })
        .eq(
            "id",
            participant.id
        );

    if (error) {

        console.error(
            "Accept call failed:",
            error
        );

        toast(
            error.message,
            "error"
        );

        return;
    }

    await joinCall(
        room,
        room.call_type
    );
}


/* ============================================================
   DECLINE INCOMING CALL
   ============================================================ */

async function declineIncomingCall() {

    const incoming =
        state.call.pendingIncoming;

    if (!incoming) return;

    hideElement(
        byId("incomingCallToast")
    );

    state.call.pendingIncoming =
        null;

    await supabase
        .from("chat_call_participants")
        .update({

            status:
                "declined",

            left_at:
                new Date().toISOString()
        })
        .eq(
            "id",
            incoming.participant.id
        );
}


/* ============================================================
   CALL TIMER
   ============================================================ */

function startCallTimer() {

    clearInterval(
        state.call.timerInterval
    );

    state.call.timerInterval =
        setInterval(() => {

            if (
                !state.call.startedAt
            ) return;

            const seconds =
                Math.floor(
                    (
                        Date.now() -
                        state.call.startedAt
                    ) / 1000
                );

            const minutes =
                Math.floor(
                    seconds / 60
                );

            const remaining =
                seconds % 60;

            setText(
                "callDuration",
                `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
            );

        }, 1000);
}


/* ============================================================
   MUTE
   ============================================================ */

function toggleMicrophone() {

    if (
        !state.call.localStream
    ) return;

    state.call.muted =
        !state.call.muted;

    state.call.localStream
        .getAudioTracks()
        .forEach(track => {

            track.enabled =
                !state.call.muted;
        });

    const button =
        byId(
            "toggleMicrophoneButton"
        );

    if (button) {

        button.textContent =
            state.call.muted
                ? "🔇"
                : "🎙️";
    }
}


/* ============================================================
   CAMERA
   ============================================================ */

function toggleCamera() {

    if (
        !state.call.localStream ||
        state.call.callType !==
        "video"
    ) return;

    state.call.cameraOff =
        !state.call.cameraOff;

    state.call.localStream
        .getVideoTracks()
        .forEach(track => {

            track.enabled =
                !state.call.cameraOff;
        });

    const button =
        byId(
            "toggleCameraButton"
        );

    if (button) {

        button.textContent =
            state.call.cameraOff
                ? "🚫"
                : "📹";
    }
}


/* ============================================================
   SCREEN SHARE
   ============================================================ */

async function toggleScreenShare() {

    if (
        state.call.callType !==
        "video"
    ) return;

    if (
        !navigator.mediaDevices
            ?.getDisplayMedia
    ) {

        toast(
            "Screen sharing is not supported here.",
            "warning"
        );

        return;
    }

    try {

        if (
            state.call.screenStream
        ) {

            stopScreenShare();

            return;
        }

        const screenStream =
            await navigator.mediaDevices
                .getDisplayMedia({

                    video: true
                });

        const screenTrack =
            screenStream.getVideoTracks()[0];

        state.call.screenStream =
            screenStream;

        for (
            const pc
            of state.call.peerConnections.values()
        ) {

            const sender =
                pc.getSenders().find(
                    item =>
                        item.track?.kind ===
                        "video"
                );

            if (sender) {

                await sender.replaceTrack(
                    screenTrack
                );
            }
        }

        const localVideo =
            byId("localVideo");

        if (localVideo) {

            localVideo.srcObject =
                screenStream;
        }

        screenTrack.onended =
            () => {

                stopScreenShare();
            };

    } catch (error) {

        console.error(
            "Screen share failed:",
            error
        );
    }
}


/* ============================================================
   STOP SCREEN SHARE
   ============================================================ */

async function stopScreenShare() {

    if (
        !state.call.screenStream
    ) return;

    state.call.screenStream
        .getTracks()
        .forEach(
            track => track.stop()
        );

    state.call.screenStream =
        null;

    const cameraTrack =
        state.call.localStream
            ?.getVideoTracks()[0];

    if (cameraTrack) {

        for (
            const pc
            of state.call.peerConnections.values()
        ) {

            const sender =
                pc.getSenders().find(
                    item =>
                        item.track?.kind ===
                        "video"
                );

            if (sender) {

                await sender.replaceTrack(
                    cameraTrack
                );
            }
        }

        const localVideo =
            byId("localVideo");

        if (localVideo) {

            localVideo.srcObject =
                state.call.localStream;
        }
    }
}


/* ============================================================
   LEAVE CALL
   ============================================================ */

async function leaveCall() {

    if (!state.call.active) {

        hideElement(
            byId("callOverlay")
        );

        return;
    }

    const roomId =
        state.call.roomId;

    const wasCreator =
        String(
            state.call.room?.created_by
        ) ===
        String(
            state.user?.id
        );

    clearInterval(
        state.call.timerInterval
    );

    clearInterval(
        state.call.participantSyncInterval
    );

    state.call.timerInterval =
        null;

    state.call.participantSyncInterval =
        null;

    await updateOwnParticipant(
        "left"
    );

    if (
        state.call.localStream
    ) {

        state.call.localStream
            .getTracks()
            .forEach(
                track => track.stop()
            );
    }

    if (
        state.call.screenStream
    ) {

        state.call.screenStream
            .getTracks()
            .forEach(
                track => track.stop()
            );
    }

    state.call.peerConnections
        .forEach(pc => {

            try {
                pc.close();
            } catch (_) {}
        });

    state.call.peerConnections =
        new Map();

    state.call.pendingIce =
        new Map();

    if (
        state.call.realtimeChannel
    ) {

        try {

            await supabase.removeChannel(
                state.call.realtimeChannel
            );

        } catch (_) {}
    }

    state.call.realtimeChannel =
        null;

    if (
        wasCreator &&
        roomId
    ) {

        await supabase
            .from("chat_call_rooms")
            .update({

                status:
                    "ended",

                ended_at:
                    new Date().toISOString(),

                updated_at:
                    new Date().toISOString()

            })
            .eq(
                "id",
                roomId
            );
    }

    state.call.active =
        false;

    state.call.room =
        null;

    state.call.roomId =
        null;

    state.call.participants =
        new Map();

    state.call.localStream =
        null;

    state.call.screenStream =
        null;

    state.call.startedAt =
        null;

    state.call.muted =
        false;

    state.call.cameraOff =
        false;

    const localVideo =
        byId("localVideo");

    if (localVideo) {

        localVideo.srcObject =
            null;
    }

    const grid =
        byId("callVideoGrid");

    if (grid) {

        grid.innerHTML = "";
    }

    hideElement(
        byId("callOverlay")
    );
}


/* ============================================================
   MINIMIZE CALL
   ============================================================ */

function toggleMinimizeCall() {

    const overlay =
        byId("callOverlay");

    if (!overlay) return;

    state.call.minimized =
        !state.call.minimized;

    overlay.classList.toggle(
        "call-minimized",
        state.call.minimized
    );
}


/* ============================================================
   COMMUNITY CALL
   ============================================================ */

async function startCommunityCall(
    callType
) {

    if (!state.currentCommunity) {

        toast(
            "Select a community first.",
            "warning"
        );

        return;
    }

    await openCallPicker(
        "community",
        callType
    );
}


/* ============================================================
   GENERAL CALL
   ============================================================ */

async function openGeneralCall() {

    await openCallPicker(
        "general",
        "video"
    );
}


/* ============================================================
   EVENT BINDING
   ============================================================ */

function bindEvents() {

    /* ---------------- GENERAL CALL ---------------- */

    byId(
        "generalCallButton"
    )?.addEventListener(
        "click",
        openGeneralCall
    );

    byId(
        "generalVoiceCallButton"
    )?.addEventListener(
        "click",
        () => {

            state.call.pickerCallType =
                "voice";

            toast(
                "Voice call selected. Choose online users.",
                "info"
            );
        }
    );

    byId(
        "generalVideoCallButton"
    )?.addEventListener(
        "click",
        () => {

            state.call.pickerCallType =
                "video";

            toast(
                "Video call selected. Choose online users.",
                "info"
            );
        }
    );

    byId(
        "startGeneralCallButton"
    )?.addEventListener(
        "click",
        startSelectedCall
    );

    byId(
        "cancelGeneralCallButton"
    )?.addEventListener(
        "click",
        closeCallPicker
    );

    byId(
        "closeGeneralCallModalButton"
    )?.addEventListener(
        "click",
        closeCallPicker
    );


    /* ---------------- COMMUNITY CALLS ---------------- */

    byId(
        "voiceCallButton"
    )?.addEventListener(
        "click",
        () =>
            startCommunityCall(
                "voice"
            )
    );

    byId(
        "videoCallButton"
    )?.addEventListener(
        "click",
        () =>
            startCommunityCall(
                "video"
            )
    );


    /* ---------------- CALL OVERLAY ---------------- */

    byId(
        "toggleMicrophoneButton"
    )?.addEventListener(
        "click",
        toggleMicrophone
    );

    byId(
        "toggleCameraButton"
    )?.addEventListener(
        "click",
        toggleCamera
    );

    byId(
        "shareScreenButton"
    )?.addEventListener(
        "click",
        toggleScreenShare
    );

    byId(
        "leaveCallButton"
    )?.addEventListener(
        "click",
        leaveCall
    );

    byId(
        "minimizeCallButton"
    )?.addEventListener(
        "click",
        toggleMinimizeCall
    );


    /* ---------------- INCOMING CALL ---------------- */

    byId(
        "acceptCallButton"
    )?.addEventListener(
        "click",
        acceptIncomingCall
    );

    byId(
        "declineCallButton"
    )?.addEventListener(
        "click",
        declineIncomingCall
    );


    /* ---------------- MESSAGE ---------------- */

    byId(
        "messageForm"
    )?.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            sendMessage();
        }
    );

    byId(
        "sendMessageButton"
    )?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            sendMessage();
        }
    );

    byId(
        "cancelReplyButton"
    )?.addEventListener(
        "click",
        cancelReply
    );


    /* ---------------- CHANNEL SEARCH ---------------- */

    byId(
        "channelSearchInput"
    )?.addEventListener(
        "input",
        event => {

            state.channelSearch =
                event.target.value;

            renderChannels();
        }
    );


    /* ---------------- MEMBER SEARCH ---------------- */

    byId(
        "memberSearchInput"
    )?.addEventListener(
        "input",
        event => {

            state.memberSearch =
                event.target.value;

            renderMembers();
        }
    );


    /* ---------------- MESSAGE SEARCH ---------------- */

    byId(
        "messageSearchInput"
    )?.addEventListener(
        "input",
        event => {

            state.messageSearch =
                event.target.value;

            renderMessages();
        }
    );


    /* ---------------- MESSAGE SEARCH PANEL ---------------- */

    byId(
        "chatSearchButton"
    )?.addEventListener(
        "click",
        () => {

            showElement(
                byId("messageSearchPanel")
            );
        }
    );

    byId(
        "closeMessageSearchButton"
    )?.addEventListener(
        "click",
        () => {

            hideElement(
                byId("messageSearchPanel")
            );

            state.messageSearch =
                "";

            const input =
                byId(
                    "messageSearchInput"
                );

            if (input) {
                input.value = "";
            }

            renderMessages();
        }
    );


    /* ---------------- MEMBER DRAWER ---------------- */

    byId(
        "memberToggleButton"
    )?.addEventListener(
        "click",
        () => {

            showElement(
                byId("memberSidebar")
            );
        }
    );

    byId(
        "closeMemberSidebarButton"
    )?.addEventListener(
        "click",
        () => {

            hideElement(
                byId("memberSidebar")
            );
        }
    );


    /* ---------------- CHANNEL DRAWER ---------------- */

    byId(
        "channelToggleButton"
    )?.addEventListener(
        "click",
        () => {

            showElement(
                byId("channelSidebar")
            );
        }
    );


    /* ---------------- ATTACHMENT ---------------- */

    byId(
        "attachmentButton"
    )?.addEventListener(
        "click",
        () => {

            toast(
                "Attachment upload will use the Mwaniki attachment system.",
                "info"
            );
        }
    );


    /* ---------------- DIRECT CALL BUTTONS ---------------- */

    document.addEventListener(
        "click",
        async event => {

            const button =
                event.target.closest(
                    "[data-direct-call]"
                );

            if (!button) return;

            const userId =
                button.dataset.userId;

            if (!userId) {

                toast(
                    "Unable to identify this user.",
                    "error"
                );

                return;
            }

            await openCallPicker(
                "general",
                "video",
                userId
            );
        }
    );


    /* ---------------- CREATE COMMUNITY ---------------- */

    byId(
        "createCommunityButton"
    )?.addEventListener(
        "click",
        openCommunityModal
    );

    byId(
        "communityMenuCreateCommunity"
    )?.addEventListener(
        "click",
        openCommunityModal
    );

    byId(
        "closeCommunityModalButton"
    )?.addEventListener(
        "click",
        closeCommunityModal
    );

    byId(
        "cancelCommunityButton"
    )?.addEventListener(
        "click",
        closeCommunityModal
    );

    byId(
        "communityForm"
    )?.addEventListener(
        "submit",
        createCommunity
    );


    /* ---------------- CREATE CHANNEL ---------------- */

    byId(
        "createChannelButton"
    )?.addEventListener(
        "click",
        openChannelModal
    );

    byId(
        "communityMenuCreateChannel"
    )?.addEventListener(
        "click",
        openChannelModal
    );

    byId(
        "closeChannelModalButton"
    )?.addEventListener(
        "click",
        closeChannelModal
    );

    byId(
        "cancelChannelButton"
    )?.addEventListener(
        "click",
        closeChannelModal
    );

    byId(
        "channelForm"
    )?.addEventListener(
        "submit",
        createChannel
    );


    /* ---------------- REFRESH ---------------- */

    byId(
        "communityMenuRefresh"
    )?.addEventListener(
        "click",
        refreshCommunity
    );


    /* ---------------- BEFORE UNLOAD ---------------- */

    window.addEventListener(
        "beforeunload",
        () => {

            setOfflinePresence();
        }
    );
}


/* ============================================================
   COMMUNITY MODAL
   ============================================================ */

function openCommunityModal() {

    showElement(
        byId("communityModal")
    );
}

function closeCommunityModal() {

    hideElement(
        byId("communityModal")
    );
}


/* ============================================================
   CREATE COMMUNITY
   ============================================================ */

async function createCommunity(
    event
) {

    event.preventDefault();

    if (!state.user) return;

    const name =
        byId(
            "communityNameInput"
        )?.value.trim();

    const description =
        byId(
            "communityDescriptionInput"
        )?.value.trim();

    const icon =
        byId(
            "communityIconInput"
        )?.value.trim();

    const message =
        byId(
            "communityFormMessage"
        );

    if (!name) {

        if (message) {

            message.textContent =
                "Community name is required.";
        }

        return;
    }

    const baseSlug =
        slugify(name);

    const slug =
        `${baseSlug}-${Date.now()
            .toString()
            .slice(-5)}`;

    const {
        data,
        error
    } = await supabase
        .from("chat_communities")
        .insert({

            name,

            slug,

            description:
                description || null,

            icon_url:
                icon || null,

            is_public:
                true,

            is_active:
                true,

            created_by:
                state.user.id
        })
        .select("*")
        .single();

    if (error) {

        console.error(
            "Community creation failed:",
            error
        );

        if (message) {

            message.textContent =
                error.message;
        }

        return;
    }

    closeCommunityModal();

    toast(
        "Community created.",
        "success"
    );

    await loadCommunities();

    if (data) {

        await selectCommunity(
            data.id
        );
    }
}


/* ============================================================
   CHANNEL MODAL
   ============================================================ */

function openChannelModal() {

    if (!state.currentCommunity) {

        toast(
            "Select a community first.",
            "warning"
        );

        return;
    }

    showElement(
        byId("channelModal")
    );
}

function closeChannelModal() {

    hideElement(
        byId("channelModal")
    );
}


/* ============================================================
   CREATE CHANNEL
   ============================================================ */

async function createChannel(
    event
) {

    event.preventDefault();

    if (
        !state.user ||
        !state.currentCommunity
    ) return;

    const name =
        byId(
            "channelNameInput"
        )?.value.trim();

    const description =
        byId(
            "channelDescriptionInput"
        )?.value.trim();

    const visibility =
        byId(
            "channelVisibilitySelect"
        )?.value ||
        "public";

    const courseId =
        byId(
            "channelCourseSelect"
        )?.value ||
        null;

    const message =
        byId(
            "channelFormMessage"
        );

    if (!name) {

        if (message) {

            message.textContent =
                "Channel name is required.";
        }

        return;
    }

    const payload = {

        community_id:
            state.currentCommunity.id,

        name,

        slug:
            slugify(name) +
            "-" +
            Date.now()
                .toString()
                .slice(-5),

        description:
            description || null,

        channel_type:
            "text",

        icon:
            "#",

        position:
            state.channels.length,

        is_private:
            visibility === "private",

        is_archived:
            false,

        is_active:
            true,

        course_id:
            courseId || null,

        created_by:
            state.user.id
    };

    let result =
        await supabase
            .from("chat_channels")
            .insert(payload)
            .select("*")
            .single();

    /*
       If the database has a category column,
       use it when available. We intentionally
       keep the core insert compatible with the
       schema already used by Mwaniki Scholars.
    */

    if (result.error) {

        console.error(
            "Channel creation failed:",
            result.error
        );

        if (message) {

            message.textContent =
                result.error.message;
        }

        return;
    }

    closeChannelModal();

    toast(
        "Channel created.",
        "success"
    );

    await loadChannels();

    if (result.data) {

        await selectChannel(
            result.data.id
        );
    }
}


/* ============================================================
   REALTIME COMMUNITY CHAT
   ============================================================ */

async function setupCommunityRealtime() {

    state.realtimeChannels.forEach(
        channel => {

            supabase.removeChannel(
                channel
            );
        }
    );

    state.realtimeChannels =
        [];

    if (!state.user) return;

    /* ---------------- MESSAGES ---------------- */

    const messageChannel =
        supabase.channel(
            `mwaniki-messages-${state.user.id}-${Date.now()}`
        );

    messageChannel.on(
        "postgres_changes",
        {
            event: "INSERT",
            schema: "public",
            table: "chat_messages"
        },
        async payload => {

            const message =
                payload.new;

            if (
                !state.currentChannel ||
                String(
                    message.channel_id
                ) !==
                String(
                    state.currentChannel.id
                )
            ) return;

            if (
                state.messages.some(
                    item =>
                        String(item.id) ===
                        String(message.id)
                )
            ) return;

            await enrichProfiles([
                message.user_id
            ]);

            state.messages.push(
                message
            );

            renderMessages();
        }
    );

    messageChannel.subscribe();

    state.realtimeChannels.push(
        messageChannel
    );


    /* ---------------- CHANNELS ---------------- */

    const channelChannel =
        supabase.channel(
            `mwaniki-channel-events-${state.user.id}-${Date.now()}`
        );

    channelChannel.on(
        "postgres_changes",
        {
            event: "*",
            schema: "public",
            table: "chat_channels"
        },
        async () => {

            if (state.currentCommunity) {

                await loadChannels();
            }
        }
    );

    channelChannel.subscribe();

    state.realtimeChannels.push(
        channelChannel
    );
}


/* ============================================================
   REFRESH
   ============================================================ */

async function refreshCommunity() {

    try {

        await loadCommunities();

        if (
            state.currentCommunity
        ) {

            const exists =
                state.communities.some(
                    community =>
                        String(
                            community.id
                        ) ===
                        String(
                            state.currentCommunity.id
                        )
                );

            if (exists) {

                await loadChannels();

                await loadMembers();

                if (
                    state.currentChannel
                ) {

                    await loadMessages();
                }
            }

        } else if (
            state.communities.length
        ) {

            await selectCommunity(
                state.communities[0].id
            );
        }

        await setOnlinePresence();

        toast(
            "Community refreshed.",
            "success"
        );

    } catch (error) {

        console.error(
            "Refresh failed:",
            error
        );

        toast(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   SETUP CALL UI FALLBACKS
   ============================================================ */

function ensureCallPickerMarkup() {

    const modal =
        byId("generalCallModal");

    if (!modal) return;

    /*
       This protects against an older HTML file
       that still contains the UUID input.
    */

    let list =
        byId("generalCallUserList");

    if (!list) {

        list =
            document.createElement(
                "div"
            );

        list.id =
            "generalCallUserList";

        list.className =
            "general-call-user-list";

        const oldInput =
            byId(
                "generalCallUserInput"
            );

        if (oldInput) {

            oldInput.insertAdjacentElement(
                "afterend",
                list
            );

        } else {

            modal.appendChild(
                list
            );
        }
    }

    let status =
        byId(
            "generalCallUserStatus"
        );

    if (!status) {

        status =
            document.createElement(
                "div"
            );

        status.id =
            "generalCallUserStatus";

        list.before(status);
    }

    let count =
        byId(
            "generalCallSelectionCount"
        );

    if (!count) {

        count =
            document.createElement(
                "div"
            );

        count.id =
            "generalCallSelectionCount";

        list.before(count);
    }
}


/* ============================================================
   COMMUNITY INITIALIZATION
   ============================================================ */

async function initialize() {

    try {

        const authenticated =
            await loadAuthenticatedUser();

        if (!authenticated) {

            state.initialized =
                true;

            return;
        }

        await loadCurrentProfile();

        await loadCourses();

        await loadCommunities();

        if (
            state.communities.length
        ) {

            const savedId =
                localStorage.getItem(
                    STORAGE.communityId
                );

            const savedCommunity =
                state.communities.find(
                    community =>
                        String(
                            community.id
                        ) ===
                        String(savedId)
                );

            await selectCommunity(
                savedCommunity?.id ||
                state.communities[0].id
            );

        } else {

            renderCommunityError(
                "No active communities found."
            );
        }

        await setOnlinePresence();

        startPresenceHeartbeat();

        setupCommunityRealtime();

        setupIncomingCallListener();

        ensureCallPickerMarkup();

        bindEvents();

        state.initialized =
            true;

        console.log(
            "Mwaniki Community fully initialized."
        );

        console.log(
            "📞 Mwaniki Universal Call Engine loading..."
        );

        console.log(
            "✅ Mwaniki Universal Call Engine ready"
        );

    } catch (error) {

        console.error(
            "❌ Mwaniki Community initialization failed:",
            error
        );

        toast(
            `Community initialization failed: ${error.message}`,
            "error"
        );
    }
}


/* ============================================================
   PUBLIC API
   ============================================================ */

window.mwanikiCommunity = {

    state,

    refresh:
        refreshCommunity,

    selectCommunity,

    selectChannel,

    sendMessage,

    cancelReply,

    loadOnlineUsers,

    openCallPicker,

    startCommunityCall,

    leaveCall
};


window.mwanikiCallEngine = {

    state,

    open:
        openCallPicker,

    general:
        openGeneralCall,

    communityVoice:
        () =>
            startCommunityCall("voice"),

    communityVideo:
        () =>
            startCommunityCall("video"),

    leave:
        leaveCall,

    mute:
        toggleMicrophone,

    camera:
        toggleCamera,

    screenShare:
        toggleScreenShare
};


/* ============================================================
   START
   ============================================================ */

initialize();


} // END GLOBAL COMMUNITY ENGINE GUARD
